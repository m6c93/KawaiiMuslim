(function () {
  "use strict";

  if (window.__kmAccessGateStarted) return;
  window.__kmAccessGateStarted = true;

  var root = document.documentElement;
  var localPreview = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    && new URLSearchParams(window.location.search).get("preview") === "1";
  if (localPreview) return;

  var explicitGuestMode = new URLSearchParams(window.location.search).get("guest") === "1";
  var storedGuestMode = sessionStorage.getItem("km-guest-mode") === "1";
  var currentPath = decodeURIComponent(window.location.pathname);
  var previewPages = new URLSearchParams(window.location.search).get("previewPages");
  var guestBookPreview = explicitGuestMode && (
    (window.self !== window.top && previewPages === "4" && currentPath === "/books/aya-armure-de-lumiere.html")
    || (previewPages === "5" && currentPath === "/books/tawakkul.html")
  );
  var guestPages = new Set([
    "/Aujourd'hui.dc.html",
    "/Bibliotheque Kawaii Muslim.dc.html",
    "/Atelier.dc.html",
    "/Safe Place.dc.html",
    "/Applications.dc.html",
    "/LivreColoriage.dc.html",
    "/Coloriage.dc.html"
  ]);
  if (storedGuestMode && !explicitGuestMode && guestPages.has(currentPath)) {
    var restoredUrl = new URL(window.location.href);
    restoredUrl.searchParams.set("guest", "1");
    window.location.replace(restoredUrl.href);
    return;
  }
  if ((explicitGuestMode && guestPages.has(currentPath)) || guestBookPreview) {
    sessionStorage.setItem("km-guest-mode", "1");
    window.KM_GUEST_MODE = true;
    return;
  }

  root.style.visibility = "hidden";
  var activeStatuses = new Set(["active", "trialing", "past_due"]);
  var staffRoles = new Set(["admin", "support", "content_admin"]);

  function loadScript(source) {
    return new Promise(function (resolve, reject) {
      var existing = Array.from(document.scripts).find(function (script) {
        return script.src && script.src.indexOf(source) !== -1;
      });
      if (existing && ((source.indexOf("supabase") !== -1 && window.supabase) || (source.indexOf("km-config") !== -1 && window.KM_CONFIG))) {
        resolve();
        return;
      }
      var script = existing || document.createElement("script");
      if (!existing) {
        script.src = source;
        document.head.appendChild(script);
      }
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
    });
  }

  function redirect(path) {
    window.location.replace(path);
  }

  function showTemporaryError() {
    root.style.visibility = "visible";
    document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#171b45;color:white;font-family:system-ui,sans-serif;text-align:center"><section style="max-width:480px;padding:30px;border-radius:26px;background:#242b63"><h1 style="margin-top:0">Connexion momentanément indisponible</h1><p>Nous n’arrivons pas à vérifier ton abonnement pour le moment. Aucun contenu ni paiement n’est perdu.</p><button onclick="location.reload()" style="border:0;border-radius:999px;padding:13px 22px;font-weight:800;cursor:pointer">Réessayer</button></section></main>';
  }

  async function checkAccess() {
    if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    if (!window.KM_CONFIG) await loadScript("/km-config.js");
    var config = window.KM_CONFIG || {};
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("Configuration manquante");

    var client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    var sessionResult = await client.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if (!session) {
      var destination = window.location.pathname + window.location.search + window.location.hash;
      redirect("/Connexion.dc.html?next=" + encodeURIComponent(destination));
      return;
    }

    var results = await Promise.all([
      client.from("profiles").select("role,is_active").eq("id", session.user.id).single(),
      client.from("subscriptions").select("status").eq("user_id", session.user.id).maybeSingle()
    ]);
    var profile = results[0].data;
    var subscription = results[1].data;
    if (profile && profile.is_active !== false && staffRoles.has(profile.role)) {
      root.style.visibility = "visible";
      return;
    }
    if (!profile || profile.is_active === false || !subscription || !activeStatuses.has(subscription.status)) {
      redirect("/Compte.dc.html?abonnement=requis");
      return;
    }
    root.style.visibility = "visible";
  }

  checkAccess().catch(showTemporaryError);
})();
