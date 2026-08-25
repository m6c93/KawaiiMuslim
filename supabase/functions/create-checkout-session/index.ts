import Stripe from "npm:stripe@22.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PLANS, SITE_URL, type PlanCode } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.kawaiimuslimworld.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2026-06-24.dahlia",
});

const checkoutIdentifier = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `kmw_checkout_${Array.from(bytes, (byte) => String.fromCharCode(97 + (byte % 26))).join("")}`;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Méthode non autorisée." }, 405);

  try {
    const authorization = request.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Connecte-toi pour choisir une offre." }, 401);

    const body = await request.json().catch(() => ({}));
    const planCode = String(body.planCode || "") as PlanCode;
    const selectedPlan = PLANS[planCode];
    if (!selectedPlan) return jsonResponse({ error: "Cette offre n’existe pas." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name,email")
      .eq("id", user.id)
      .single();
    const { data: currentBilling } = await admin
      .from("subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentBilling?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(currentBilling.status)) {
      return jsonResponse({ error: "Ton abonnement est déjà actif. Utilise « Gérer mon abonnement » pour changer d’offre." }, 409);
    }

    let customerId = currentBilling?.stripe_customer_id || "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile?.email || undefined,
        name: profile?.full_name || undefined,
        metadata: { supabase_user_id: user.id, app: "kawaii_muslim_world" },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      integration_identifier: checkoutIdentifier(),
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: selectedPlan.priceId, quantity: 1 }],
      locale: "fr",
      success_url: `${SITE_URL}/Profils.dc.html?abonnement=confirme&setup=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/index.html?paiement=annule#tarifs`,
      metadata: { supabase_user_id: user.id, plan_code: planCode },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan_code: planCode },
      },
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Le paiement ne peut pas s’ouvrir pour le moment. Réessaie dans quelques instants." }, 500);
  }
});
