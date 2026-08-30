(function () {
  "use strict";

  if (window.KMReadingProgress) return;

  const params = new URLSearchParams(location.search);
  const disabled = window.KM_BOOK_EMBED || window.KM_GUEST_MODE || params.get("guest") === "1" || params.has("previewPages");
  let clientPromise = null;
  let saveTimer = null;

  const activeChild = () => {
    try {
      const profile = JSON.parse(localStorage.getItem("km-active-profile-v2"));
      return profile?.type === "child" && profile.id ? profile : null;
    } catch {
      return null;
    }
  };

  const loadScript = source => new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(script => script.src?.includes(source));
    if (existing && ((source.includes("supabase") && window.supabase) || (source.includes("km-config") && window.KM_CONFIG))) return resolve();
    const script = existing || document.createElement("script");
    if (!existing) {
      script.src = source;
      document.head.appendChild(script);
    }
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
  });

  const getClient = () => {
    if (!clientPromise) clientPromise = (async () => {
      if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      if (!window.KM_CONFIG) await loadScript("/km-config.js");
      if (!window.KM_CONFIG?.supabaseUrl || !window.KM_CONFIG?.supabaseAnonKey) throw new Error("Configuration de lecture indisponible");
      return window.supabase.createClient(window.KM_CONFIG.supabaseUrl, window.KM_CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    })();
    return clientPromise;
  };

  const bookSlug = () => decodeURIComponent(location.pathname.split("/").pop() || "livre").replace(/\.html$/i, "");
  const bookTitle = () => (document.title || bookSlug())
    .replace(/\s*[-—|]\s*(livre interactif|livre numérique|kawaii muslim).*$/i, "")
    .trim();

  const restore = async ({ slug = bookSlug() } = {}) => {
    const child = activeChild();
    if (disabled || !child) return null;
    try {
      const client = await getClient();
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) return null;
      const { data, error } = await client.from("reading_progress")
        .select("position,total_positions,completed,last_read_at")
        .eq("child_profile_id", child.id)
        .eq("book_slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn("Progression de lecture non restaurée", error);
      return null;
    }
  };

  const save = async ({ slug = bookSlug(), title = bookTitle(), position = 0, total = 1 } = {}) => {
    const child = activeChild();
    if (disabled || !child) return null;
    const safeTotal = Math.max(1, Number(total) || 1);
    const safePosition = Math.max(0, Math.min(safeTotal, Number(position) || 0));
    try {
      const client = await getClient();
      const { data: sessionData } = await client.auth.getSession();
      const parentId = sessionData?.session?.user?.id;
      if (!parentId) return null;
      const { data, error } = await client.from("reading_progress").upsert({
        parent_id: parentId,
        child_profile_id: child.id,
        book_slug: String(slug).slice(0, 120),
        book_title: String(title || slug).slice(0, 180),
        position: safePosition,
        total_positions: safeTotal,
        completed: safePosition >= safeTotal,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: "child_profile_id,book_slug" }).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn("Progression de lecture non synchronisée", error);
      return null;
    }
  };

  const queueSave = payload => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(payload), 450);
  };

  const connectRangeReader = async () => {
    const range = document.getElementById("progress");
    if (disabled || !activeChild() || !range || range.tagName !== "INPUT") return;
    const payload = () => ({ position: Number(range.value), total: Number(range.max) || 1 });
    ["input", "change"].forEach(eventName => range.addEventListener(eventName, () => queueSave(payload())));
    ["prevBtn", "nextBtn", "openBtn"].forEach(id => document.getElementById(id)?.addEventListener("click", () => setTimeout(() => queueSave(payload()), 80)));
    window.addEventListener("pagehide", () => save(payload()));

    const remote = await restore();
    if (remote && Number(remote.position) > Number(range.value)) {
      range.value = Math.min(Number(range.max) || 1, Number(remote.position));
      range.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      queueSave(payload());
    }
  };

  const connectBookFallback = () => {
    if (disabled || !activeChild() || document.getElementById("progress")) return;
    const counter = document.getElementById("counter");
    const bar = document.getElementById("bar");
    if (!counter || !bar) return;

    const payload = () => {
      const label = String(counter.textContent || "");
      const match = label.match(/(?:Lecture\s+)?(\d+)\s*\/\s*(\d+)/i);
      if (match) return { position: Number(match[1]), total: Math.max(1, Number(match[2])) };
      const width = Number.parseFloat(bar.style.width || "0");
      return { position: Math.round(width), total: 100 };
    };

    ["prev", "next", "restart", "zoneL", "zoneR"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", () => setTimeout(() => queueSave(payload()), 1250));
    });
    document.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowRight", " ", "Home", "End"].includes(event.key)) {
        setTimeout(() => queueSave(payload()), 1250);
      }
    });
    window.addEventListener("pagehide", () => save(payload()));
    setTimeout(() => queueSave(payload()), 1500);
  };

  window.KMReadingProgress = { save, restore, queueSave };
  const connect = () => {
    connectRangeReader();
    connectBookFallback();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connect, { once: true });
  else connect();
})();
