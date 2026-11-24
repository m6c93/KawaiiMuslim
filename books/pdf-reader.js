const PDFJS_BASE = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/";
const PDFJS_BUILD = PDFJS_BASE + "legacy/build/";
const params = new URLSearchParams(location.search);
const title = (params.get("title") || "Mon livre").slice(0, 160);
const status = document.getElementById("pdfStatus");
const message = status.querySelector("p");

function showReaderError() {
  document.body.prepend(status);
  status.style.zIndex = "2147483647";
  status.hidden = false;
  const fallback = status.querySelector("[data-pdf-fallback]");
  if (fallback) fallback.hidden = false;
  message.textContent = fallback
    ? "Le lecteur n’a pas pu afficher ce livre. Tu peux ouvrir le PDF original sur cet appareil."
    : "Le livre n’a pas pu être ouvert. Réessaie depuis la bibliothèque.";
}

async function sourceURL(source) {
  if (source.startsWith("private://content-books/")) source = await window.KMAuth.bookFileUrl(source);
  const url = new URL(source, location.href);
  const localFile = ["localhost", "127.0.0.1"].includes(location.hostname) && url.origin === location.origin;
  const storedBook = url.protocol === "https:" && url.origin === window.KM_CONFIG.supabaseUrl.replace(/\/$/, "") &&
    /^\/storage\/v1\/object\/(public|sign|authenticated)\/content-books\//.test(url.pathname);
  if (!(storedBook || localFile) || !/\.pdf$/i.test(url.pathname)) throw new Error("Adresse de livre indisponible.");
  return url;
}

async function start() {
  const context = await window.KMAuth.getContext();
  if (!context) {
    location.replace("Connexion.dc.html?next=" + encodeURIComponent(location.pathname + location.search));
    return;
  }
  const active = window.KMAuth.validateActiveProfile(context);
  const url = await sourceURL(params.get("src") || "");
  // Make the authorized source available if the device cannot run the PDF renderer.
  const originalFallback = document.createElement("a");
  originalFallback.href = url.href;
  originalFallback.textContent = "Ouvrir le PDF original";
  originalFallback.dataset.pdfFallback = "";
  originalFallback.hidden = true;
  status.insertBefore(originalFallback, status.querySelector("a"));
  const pdfjs = await import(PDFJS_BUILD + "pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_BUILD + "pdf.worker.min.mjs";
  const loading = pdfjs.getDocument({url:url.href, cMapUrl:PDFJS_BASE + "cmaps/", cMapPacked:true,
    standardFontDataUrl:PDFJS_BASE + "standard_fonts/", wasmUrl:PDFJS_BASE + "wasm/"});
  loading.onProgress = ({loaded, total}) => { if (total) message.textContent = "Ouverture du livre · " + Math.min(100, Math.round(loaded * 100 / total)) + " %"; };
  const pdf = await loading.promise;
  const cache = new Map();
  let rewardChecked = false;
  const fileName = url.pathname.split("/").pop();
  async function raster(number, thumb) {
    const page = await pdf.getPage(number);
    const natural = page.getViewport({scale:1});
    const edge = thumb ? 200 : Math.min(1850, Math.max(1000, Math.max(innerWidth, innerHeight) * devicePixelRatio));
    const viewport = page.getViewport({scale:edge / Math.max(natural.width, natural.height)});
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext("2d", {alpha:false}), viewport}).promise;
    const src = canvas.toDataURL("image/jpeg", thumb ? .8 : .94);
    canvas.width = canvas.height = 0; return src;
  }
  function pageSource(index, thumb = false) {
    const key = index + ":" + thumb;
    if (!cache.has(key)) {
      if (cache.size >= 20) cache.delete(cache.keys().next().value);
      cache.set(key, raster(index + 1, thumb).catch(error => { cache.delete(key); throw error; }));
    }
    return cache.get(key);
  }
  async function paint(img, index, thumb) {
    try { img.src = await pageSource(index, thumb); }
    catch {
      img.alt = "Cette page n’a pas pu être chargée.";
      if (!thumb && img.isConnected) showReaderError();
    }
  }
  const thumbnails = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      thumbnails.unobserve(entry.target); paint(entry.target, Number(entry.target.dataset.pdfIndex), true);
    }
  });
  status.hidden = true; document.title = title + " — Kawaii Muslim";
  const storagePath = url.pathname.split("/content-books/").pop();
  // Signed download URLs can change. The object path identifies this PDF across devices.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(storagePath));
  const progressSlug = "pdf:" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  mountPictureReader({
    title, pageSource, slug:"pdf:" + storagePath, progressSlug, numberOffset:1,
    pages:Array.from({length:pdf.numPages - 1}, (_, i) => i + 2),
    loadImage(img, index, thumb) {
      if (!thumb) { paint(img, index, false); return; }
      img.dataset.pdfIndex = index; thumbnails.observe(img);
    },
    onPosition(position, last) {
      if (position !== last || active.type !== "child" || rewardChecked) return;
      rewardChecked = true;
      window.KMAuth.awardChildStars({childId:active.id, eventType:"book_complete",
        sourceKey:"book:" + fileName, description:"Livre terminé : " + title}).then(reward => {
        if (!reward?.awarded) return;
        const toast = document.createElement("p"); toast.className = "reader-reward"; toast.setAttribute("role","status");
        toast.textContent = "Livre terminé · +" + reward.awarded + " étoiles ⭐";
        document.body.append(toast); setTimeout(() => toast.remove(), 2800);
      }).catch(() => {});
    }
  });
  const original = document.createElement("a");
  original.href = url.href; original.target = "_blank"; original.rel = "noopener"; original.className = "icon pdf-original";
  original.textContent = "⇩"; original.setAttribute("aria-label", "Ouvrir le PDF original"); original.title = "Ouvrir le PDF original";
  document.querySelector(".actions").append(original);
}
start().catch(showReaderError);
