/* Kawaii Muslim World — statistiques anonymes de fréquentation */
(() => {
  if (!/^https?:$/.test(location.protocol)) return;
  const SUPABASE_URL = "https://pasgxojzybmvbjhuokkk.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JfiHxlqfI8pXr4Emho4vOw_QBePfSHm";
  const STORAGE_KEY = "km-anonymous-visitor-v1";

  const getVisitorId = () => {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() :
          "km-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch (_) {
      return "km-session-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  };

  const width = Math.min(screen.width || innerWidth, innerWidth || screen.width);
  const device = width < 768 ? "mobile" : width < 1100 ? "tablet" : "desktop";
  let referrerHost = "";
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch (_) {}

  fetch(SUPABASE_URL + "/rest/v1/rpc/track_site_visit", {
    method: "POST",
    keepalive: true,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_visitor_id: getVisitorId(),
      p_path: location.pathname,
      p_referrer_host: referrerHost,
      p_device: device
    })
  }).catch(() => {});
})();
