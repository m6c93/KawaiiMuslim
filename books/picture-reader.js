/* The same two-page reader serves the library, its excerpts and uploaded PDFs. */
function mountPictureReader(config) {
  const byId = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const embedded = Boolean(window.KM_BOOK_EMBED);
  if (config.discovery) document.documentElement.classList.add("preview-book");
  const slug = config.slug || location.pathname.split("/").pop().replace(/\.html$/, "");
  const limit = Math.max(0, Math.floor(Number(params.get("previewPages")) || 0));
  const pages = config.pages.slice();
  if (config.ending) pages.push(null);
  const offset = config.numberOffset || 0;
  let count = pages.length;
  if (embedded || (limit && !config.discovery)) {
    const cap = embedded ? Math.min(limit || 5, 5) : limit;
    count = Math.min(count, Math.max(0, cap - offset));
  }
  if (slug === "aya-armure-de-lumiere" && params.get("guest") === "1") count = Math.min(count, 4);
  const lastSpread = Math.ceil(count / 2);
  const total = count + offset - (config.blankOpening ? 1 : 0);
  const pageNumber = index => index + offset - (config.blankOpening ? 1 : 0);
  const pageLabel = index => pageNumber(index) === 0 ? "Page blanche" : "Page " + pageNumber(index);
  const indices = spread => spread ? [2 * spread - 1, 2 * spread].filter(index => index <= count) : [];
  const bound = value => Math.max(0, Math.min(lastSpread, Math.floor(Number(value) || 0)));

  document.body.insertAdjacentHTML("beforeend", pictureReaderLayout);
  const book = byId("book"), cover = byId("coverStage"), spread = byId("spread");
  const range = byId("progress"), drawer = byId("drawer"), zoom = byId("zoomDialog");
  range.dataset.readingSlug = config.progressSlug || slug;
  range.dataset.readingTitle = config.title;
  if (config.discovery) range.dataset.readingPreview = "true";
  const coverImage = cover.querySelector(".cover-image");
  let profileId = "parent";
  try { profileId = JSON.parse(localStorage.getItem("km-active-profile-v2"))?.id || profileId; } catch {}
  const key = "km-reading:" + slug + ":" + profileId + (limit ? ":preview-" + limit : "");
  let position = 0;
  if (!embedded) {
    try {
      const legacy = limit && slug === "tawakkul" ? "tawakkul_book_preview_" + limit : config.legacyKey;
      position = bound(localStorage.getItem(key) ?? (legacy && localStorage.getItem(legacy)));
    } catch {}
  }
  if (params.has("page")) position = bound(params.get("page"));
  let sound = true;
  let drawerTrigger = null;

  document.querySelector(".title strong").textContent = config.title;
  coverImage.setAttribute("aria-label", "Couverture du livre " + config.title);
  // Clip only the back and binding of a printed wrap. Every presentation uses
  // the same front rectangle, with its original proportions inside the page.
  function coverArtwork(thumbnail = false) {
    const frame = document.createElement("span");
    frame.className = "cover-front";
    const clip = document.createElement("span");
    clip.className = "cover-front-clip";
    const image = new Image(); image.alt = ""; image.draggable = false;
    const front = config.coverFront;
    if (front) {
      const ratio = front.width / front.height;
      clip.style.width = Math.min(1, ratio) * 100 + "%";
      clip.style.height = Math.min(1, 1 / ratio) * 100 + "%";
      image.style.width = (front.left + front.width) / front.width * 100 + "%";
    } else if (config.wrap) {
      image.style.width = (config.wrapSize || 200) + "%";
    }
    if (config.loadImage) config.loadImage(image, 0, thumbnail);
    else image.src = config.cover;
    clip.append(image); frame.append(clip);
    return frame;
  }
  coverImage.append(coverArtwork());
  const home = document.querySelector(".home");
  if (config.discovery) home.search = "?guest=1";
  // In the colouring workspace the close button returns the whole view to the shelf.
  if (window.parent !== window) {
    try { if (window.frameElement?.id === "bookFrame") home.target = "_parent"; } catch {}
  }
  range.max = lastSpread;
  byId("totalLabel").textContent = total + (total === 1 ? " page" : " pages");
  const offer = config.discovery || (config.limitedMessage && window.KM_BOOK_PREVIEW);
  if (offer) {
    const end = document.createElement("aside");
    end.id = "previewEnd"; end.className = "preview-end"; end.hidden = true;
    if (config.discovery && !config.unlock) end.dataset.discovery = "";
    end.innerHTML = '<a href="/Compte.dc.html?abonnement=requis">Lire la suite</a>';
    const link = end.querySelector("a");
    if (config.unlock) link.href = config.unlock;
    if (config.limitedMessage) { link.href = home.href; link.textContent = "Bibliothèque"; }
    document.querySelector(".reader").append(end);
  }

  function imageFor(index, thumbnail = false) {
    if (!pages[index - 1] && config.ending && index === pages.length) {
      const end = document.createElement("div");
      end.className = "book-ending";
      end.innerHTML = '<strong>Fin 🌙</strong><p>Qu’Allah remplisse le cœur de votre enfant de confiance et de paix.</p><small>Avec tout notre amour,<br>l’équipe KawaiiMuslim 🤍</small><img src="/brand/assets/logo-kawaii-muslim.png" alt="KawaiiMuslim">';
      return end;
    }
    const img = new Image(); img.alt = pageLabel(index); img.draggable = false;
    if (thumbnail) img.loading = "lazy";
    if (config.loadImage) config.loadImage(img, index, thumbnail);
    else img.src = (thumbnail && config.thumbs?.[index - 1]) || pages[index - 1];
    return img;
  }
  const papers = [byId("leftPaper"), byId("rightPaper")];
  function showPaper(side, index) {
    const paper = papers[side];
    paper.hidden = !index && !position;
    paper.replaceChildren();
    if (!index) return;
    const content = imageFor(index);
    content.id = side ? "rightPage" : "leftPage";
    content.dataset.pageIndex = index;
    content.dataset.pageNumber = pageNumber(index);
    paper.append(content);
    if (config.pageAction) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "book-page-action";
      const coloring = config.pageAction === "color";
      button.textContent = coloring ? "🎨 Colorier" : "⇩";
      button.setAttribute("aria-label", (coloring ? "Colorier" : "Télécharger") + " · " + pageLabel(index));
      button.addEventListener("click", event => {
        event.stopPropagation();
        if (coloring) {
          const q = new URLSearchParams({guest:"1", src:"discovery-coloring:hijabi:" + index,
            title:"Hijabi Girls · Coloriage " + index, format:"image", return:"/books/hijabi-decouverte.html?guest=1"});
          location.assign("/Coloriage.dc.html?" + q);
        } else {
          const link = document.createElement("a"); link.href = pages[index - 1];
          link.download = slug + "-" + pageLabel(index).replace(/ /g, "-") + ".jpg"; link.click();
        }
      });
      paper.append(button);
    }
  }
  function render() {
    cover.hidden = position !== 0; spread.hidden = position === 0;
    const visible = indices(position);
    papers.forEach((_, side) => showPaper(side, visible[side]));
    range.value = position;
    byId("prevBtn").disabled = byId("mobilePrevBtn").disabled = position === 0;
    byId("nextBtn").disabled = byId("mobileNextBtn").disabled = position >= lastSpread;
    byId("pageLabel").textContent = !position ? "Couverture" : visible.length === 1 ? pageLabel(visible[0])
      : pageNumber(visible[0]) === 0 ? "Page 1" : "Pages " + pageNumber(visible[0]) + "–" + pageNumber(visible[1]);
    if (offer) byId("previewEnd").hidden = position < lastSpread;
    if (!embedded) {
      try { localStorage.setItem(key, String(position)); } catch {}
    }
    for (const thumb of byId("thumbs").children) thumb.classList.toggle("active", Number(thumb.dataset.spread) === position);
    range.dispatchEvent(new Event("km-reader-position"));
    config.onPosition?.(position, lastSpread);
    if (position && !config.loadImage && position < lastSpread) {
      for (const i of indices(position + 1)) { if (pages[i - 1]) new Image().src = pages[i - 1]; }
    }
  }

  let audioContext;
  function rustle() {
    if (!sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * .06, audioContext.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) * .025;
      const node = audioContext.createBufferSource(); node.buffer = buffer; node.connect(audioContext.destination); node.start();
    } catch {}
  }
  const paper = window.KMPicturePaper?.attach({
    els: { book, cover, spread, leftPaper:papers[0], rightPaper:papers[1] },
    trimPages:Boolean(config.trimPages), coverFront:config.coverFront, wrapCover:Boolean(config.wrap),
    coverPlacement() {
      // Read in book coordinates even when the iPhone shell rotates the view.
      const hidden = cover.hidden;
      cover.hidden = false;
      const scale = book.clientWidth ? cover.offsetWidth / (book.clientWidth / 2) : 1;
      const offsetY = cover.offsetTop - book.clientHeight / 2;
      cover.hidden = hidden;
      return {scale:scale || 1, offsetY};
    },
    maxPosition:() => lastSpread,
    pagesFor:indices, render, pageSound:rustle,
    get position() { return position; },
    set position(value) { position = bound(value); },
    coverSource:() => config.pageSource ? config.pageSource(0) : config.cover,
    pageSrc:index => index && index <= count ? (config.pageSource ? config.pageSource(index) : pages[index - 1]) : "",
    paintSide:(side, index) => showPaper(side === "right" ? 1 : 0, index)
  });
  function move(value, animated = true) {
    const target = bound(value);
    if (animated && paper) { paper.turn(target); return; }
    paper?.finish();
    if (target !== position) { position = target; render(); }
  }
  function openZoom(ids) {
    const selectedImages = ids.filter(Boolean);
    if (!selectedImages.length && position) return;
    const images = selectedImages.length ? selectedImages.map(i => imageFor(i)) : [coverArtwork()];
    if (!selectedImages.length) {
      images[0].setAttribute("role", "img");
      images[0].setAttribute("aria-label", "Couverture du livre " + config.title);
    }
    byId("zoomPages").replaceChildren(...images);
    if (!zoom.open) zoom.showModal();
  }
  function closeDrawer() {
    drawer.classList.remove("open"); drawer.inert = true; drawer.setAttribute("aria-hidden", "true");
    byId("scrim").hidden = true; drawerTrigger?.focus();
  }
  function openDrawer() {
    drawerTrigger = document.activeElement;
    if (!byId("thumbs").childElementCount) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i <= count; i++) {
        const b = document.createElement("button"); b.type = "button"; b.className = "thumb";
        const target = Math.ceil(i / 2); b.dataset.spread = target;
        const label = i ? pageLabel(i) : "Couverture"; b.setAttribute("aria-label", label);
        const badge = document.createElement("span"); badge.textContent = i ? pageNumber(i) || "Ouverture" : label;
        const art = i ? imageFor(i, true) : coverArtwork(true);
        b.append(art, badge); b.classList.toggle("active", target === position);
        b.onclick = () => { move(target, false); closeDrawer(); }; fragment.append(b);
      }
      byId("thumbs").append(fragment);
    }
    drawer.inert = false; drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false");
    byId("scrim").hidden = false; byId("closeDrawer").focus();
  }
  if (config.topics) {
    const topics = document.createElement("div");
    topics.className = "topics";
    for (const topic of config.topics.filter(item => item.page <= count)) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "topic"; button.textContent = topic.label;
      button.onclick = () => { move(Math.ceil(topic.page / 2), false); closeDrawer(); };
      topics.append(button);
    }
    byId("thumbs").before(topics);
  }
  drawer.inert = true;
  byId("openBtn").onclick = () => lastSpread ? move(1) : openDrawer();
  byId("prevBtn").onclick = byId("mobilePrevBtn").onclick = () => move(position - 1);
  byId("nextBtn").onclick = byId("mobileNextBtn").onclick = () => move(position + 1);
  byId("gridBtn").onclick = openDrawer; byId("closeDrawer").onclick = byId("scrim").onclick = closeDrawer;
  range.oninput = () => move(range.value, false);
  byId("soundBtn").onclick = () => { sound = !sound; byId("soundBtn").setAttribute("aria-pressed", String(sound)); };
  byId("zoomBtn").onclick = () => openZoom(indices(position)); byId("zoomClose").onclick = () => zoom.close();
  byId("fullscreenBtn").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
  let gesture = null, lastSwipe = -1000;
  for (const [side, paper] of papers.entries()) paper.addEventListener("click", event => {
    if (event.pointerType === "touch" || event.pointerType === "pen" || performance.now() - lastSwipe < 450) return;
    // Touch readers keep the spread still on a tap; swipes and arrows turn it.
    if (matchMedia("(max-width:1024px), (pointer:coarse)").matches) return;
    move(position + (side ? 1 : -1));
  });
  book.addEventListener("touchstart", e => { gesture = e.touches.length === 1 ? e.touches[0] : null; }, {passive:true});
  book.addEventListener("touchmove", e => { if (e.touches.length > 1) gesture = null; }, {passive:true});
  book.addEventListener("touchcancel", () => { gesture = null; }, {passive:true});
  book.addEventListener("touchend", e => {
    if (!gesture || e.touches.length) return;
    const dx = e.changedTouches[0].clientX - gesture.clientX, dy = e.changedTouches[0].clientY - gesture.clientY;
    gesture = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.35) { lastSwipe = performance.now(); move(position + (dx < 0 ? 1 : -1)); }
  }, {passive:true});
  document.addEventListener("keydown", e => {
    if (document.querySelector("dialog[open]")) return;
    if (!drawer.inert) { if (e.key === "Escape") closeDrawer(); return; }
    if (e.target.matches("input,textarea,select") || (e.key === " " && e.target.closest("button,a"))) return;
    const commands = {ArrowRight:position + 1, PageDown:position + 1, " ":position + 1, ArrowLeft:position - 1, PageUp:position - 1, Home:0, End:lastSpread};
    if (Object.hasOwn(commands, e.key)) { e.preventDefault(); move(commands[e.key], !["Home","End"].includes(e.key)); }
  });
  render();
  document.dispatchEvent(new Event("km-reader-ready"));
}
const pictureBookConfig = document.getElementById("bookConfig");
if (pictureBookConfig) mountPictureReader(JSON.parse(pictureBookConfig.textContent));
