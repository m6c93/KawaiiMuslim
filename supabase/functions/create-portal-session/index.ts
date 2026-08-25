import Stripe from "npm:stripe@22.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PLANS, SITE_URL } from "../_shared/billing.ts";

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
    if (userError || !user) return jsonResponse({ error: "Connexion requise." }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const { data: billing, error: billingError } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();
    if (billingError || !billing?.stripe_customer_id) {
      return jsonResponse({ error: "Aucun abonnement Stripe n’est encore associé à ce compte." }, 404);
    }

    const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 1 });
    const configuration = configurations.data[0] || await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Gère simplement ton abonnement Kawaii Muslim World",
      },
      features: {
        customer_update: { enabled: true, allowed_updates: ["email", "address"] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          cancellation_reason: {
            enabled: true,
            options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
          },
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          proration_behavior: "create_prorations",
          products: [{
            product: "prod_V6MKu5snqlf8SQ",
            prices: Object.values(PLANS).map((plan) => plan.priceId),
          }],
        },
      },
    });

    const portal = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      configuration: configuration.id,
      return_url: `${SITE_URL}/Compte.dc.html`,
    });
    return jsonResponse({ url: portal.url });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "L’espace de gestion ne peut pas s’ouvrir pour le moment." }, 500);
  }
});
