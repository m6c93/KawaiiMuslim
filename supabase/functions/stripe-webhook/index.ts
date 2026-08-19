import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { planFromPrice } from "../_shared/billing.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-06-30.basil",
});

const activeStatuses = new Set(["active", "trialing", "past_due"]);

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error("Invalid webhook signature", error);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  try {
    let subscription: Stripe.Subscription | null = null;
    let userId = "";

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      userId = session.client_reference_id || session.metadata?.supabase_user_id || "";
      if (typeof session.subscription === "string") {
        subscription = await stripe.subscriptions.retrieve(session.subscription);
      }
    } else if ([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)) {
      subscription = event.data.object as Stripe.Subscription;
      userId = subscription.metadata?.supabase_user_id || "";
    } else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : "";
      if (subscriptionId) subscription = await stripe.subscriptions.retrieve(subscriptionId);
      userId = subscription?.metadata?.supabase_user_id || "";
    } else {
      return new Response("ok", { status: 200 });
    }

    if (!subscription) return new Response("ok", { status: 200 });
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    if (!userId) {
      const { data: existing } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = existing?.user_id || "";
    }
    if (!userId) throw new Error("No Supabase user associated with this Stripe subscription");

    const item = subscription.items.data[0];
    const priceId = item?.price?.id || "";
    const matchedPlan = planFromPrice(priceId);
    if (!matchedPlan) throw new Error(`Unknown Stripe price: ${priceId}`);

    const currentPeriodStart = item?.current_period_start || 0;
    const currentPeriodEnd = item?.current_period_end || 0;
    const payload = {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      price_id: priceId,
      plan_code: matchedPlan.planCode,
      child_limit: matchedPlan.childLimit,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      payment_failed_at: event.type === "invoice.payment_failed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await admin.from("subscriptions").upsert(payload, { onConflict: "user_id" });
    if (saveError) throw saveError;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ plan: activeStatuses.has(subscription.status) ? "mensuel" : "gratuit" })
      .eq("id", userId);
    if (profileError) throw profileError;

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Webhook processing failed", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
