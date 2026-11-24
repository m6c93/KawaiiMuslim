(function () {
  "use strict";

  var multiTouchGesture = false;

  document.addEventListener("touchstart", function (event) {
    if (event.touches.length > 1) multiTouchGesture = true;
  }, { capture: true, passive: true });

  document.addEventListener("touchmove", function (event) {
    if (event.touches.length > 1) multiTouchGesture = true;
  }, { capture: true, passive: true });

  document.addEventListener("touchend", function (event) {
    if (!multiTouchGesture) return;
    event.stopImmediatePropagation();
    if (event.touches.length === 0) {
      window.setTimeout(function () { multiTouchGesture = false; }, 0);
    }
  }, { capture: true, passive: true });

  document.addEventListener("touchcancel", function () {
    multiTouchGesture = false;
  }, { capture: true, passive: true });
})();

(function () {
  "use strict";

  if (window.KMReadingProgress || document.querySelector('script[src*="km-reading-progress.js"]')) return;
  var script = document.createElement("script");
  script.src = "/km-reading-progress.js?v=family-reading-2";
  script.defer = true;
  document.head.appendChild(script);
})();

/* Shared controls for the library, its book frames and the PDF reader. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.hasAttribute('data-picture-reader')) return;
  let libraryFrame = false, presentationFrame = false;
  try {
    libraryFrame = window.frameElement?.id === 'bookFrame';
    presentationFrame = Boolean(window.frameElement?.classList.contains('sample-real-reader'));
  } catch {}
  if (window.KM_BOOK_EMBED && !libraryFrame && !presentationFrame) return;

  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = '/books/reader-controls.css?v=phone-viewport-5';
  document.head.append(styles);

  function mount() {
    const byId = id => document.getElementById(id);
    const book = byId('book'), toolbar = document.querySelector('.topbar');
    if (!book || !toolbar || root.classList.contains('km-reader-clean')) return;
    root.classList.remove('embed-book');
    root.classList.add('km-reader-clean');

    const home = toolbar.querySelector('.home');
    home.innerHTML = '<span aria-hidden="true">←</span>Retour';
    home.title = 'Retour à la bibliothèque';
    if (libraryFrame || presentationFrame) {
      home.target = '_parent';
      if (presentationFrame || new URLSearchParams(location.search).get('guest') === '1') home.search = '?guest=1';
    }
    const pages = byId('gridBtn');
    pages.innerHTML = '<span aria-hidden="true">▦</span>Pages';
    pages.title = 'Choisir une page';
    pages.setAttribute('aria-controls', 'drawer');
    toolbar.append(pages);

    const settings = document.createElement('details');
    settings.className = 'reader-settings';
    settings.innerHTML = '<summary aria-label="Réglages du lecteur"><span aria-hidden="true">⚙︎</span>Réglages</summary>';
    const actions = toolbar.querySelector('.actions');
    settings.append(actions);
    document.body.append(settings);
    const sound = byId('soundBtn'), full = byId('fullscreenBtn');
    sound.title = 'Son des pages';
    sound.setAttribute('aria-pressed', 'true');
    const rotate = document.createElement('button');
    rotate.type = 'button'; rotate.className = 'icon'; rotate.id = 'readerRotateBtn';
    actions.append(rotate);
    const summary = settings.querySelector('summary');
    function closeSettings() { settings.open = false; }
    document.addEventListener('pointerdown', event => {
      if (settings.open && !settings.contains(event.target)) closeSettings();
    });
    document.addEventListener('focusin', event => {
      if (settings.open && !settings.contains(event.target)) closeSettings();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && settings.open) { closeSettings(); summary.focus(); }
    });
    byId('zoomBtn').addEventListener('click', closeSettings);

    const dock = document.createElement('nav');
    dock.className = 'reader-dock'; dock.setAttribute('aria-label', 'Navigation dans le livre');
    const progress = document.querySelector('.progress-wrap');
    const label = byId('pageLabel'), range = byId('progress'), total = byId('totalLabel');
    dock.append(byId('prevBtn'), progress, byId('nextBtn'));
    document.body.append(dock);

    // Keep the original subscription action and any guest-specific handler.
    const offer = byId('previewEnd');
    if (offer) {
      const link = offer.querySelector('a');
      if (offer.hasAttribute('data-discovery')) link.addEventListener('click', event => {
        if (window.KMDiscovery) { event.preventDefault(); window.KMDiscovery.openUnlock(); }
      });
      document.body.append(offer);
    }
    function syncPage() {
      range.setAttribute('aria-valuetext', label.textContent + ' · ' + total.textContent);
      const max = Number(range.max);
      range.style.setProperty('--read', (max > 0 ? Number(range.value) / max * 100 : 0) + '%');
      book.classList.toggle('is-open', byId('coverStage').hidden);
    }
    new MutationObserver(syncPage).observe(label, {childList:true, characterData:true, subtree:true});
    syncPage();

    const stage = document.querySelector('.reader');
    function measureStage() {
      // clientHeight follows the grid rows even when their parent is rotated.
      const size = stage.clientHeight + 'px';
      if (root.style.getPropertyValue('--km-stage-height') !== size) root.style.setProperty('--km-stage-height', size);
    }
    if (window.ResizeObserver) new ResizeObserver(measureStage).observe(stage);
    styles.addEventListener('load', measureStage, {once:true});
    // A reader inside the library does not inherit native CSS safe-area values
    // from the outer window. Intersect its frame with the device's safe area.
    let hostWindow = null, edgeProbe = null;
    function releaseHost() {
      edgeProbe?.remove(); edgeProbe = null;
      if (!hostWindow) return;
      hostWindow.removeEventListener('resize', queueFit);
      hostWindow.visualViewport?.removeEventListener('resize', queueFit);
      hostWindow.visualViewport?.removeEventListener('scroll', queueFit);
      hostWindow = null;
    }
    function readHostEdges() {
      if (window === window.top || presentationFrame) return;
      try {
        const frames = [];
        let current = window;
        while (current !== current.top) {
          const frame = current.frameElement;
          if (!frame || !(frame.id === 'bookFrame' || frame.classList.contains('km-app-view'))) break;
          frames.push(frame);
          current = current.parent;
        }
        if (!frames.length || !current.document.body) return;
        if (!edgeProbe) {
          hostWindow = current;
          edgeProbe = current.document.createElement('span');
          edgeProbe.setAttribute('aria-hidden', 'true');
          edgeProbe.style.cssText = 'position:fixed;inset:0 auto auto 0;visibility:hidden;pointer-events:none';
          for (const side of ['top','right','bottom','left']) {
            edgeProbe.style.setProperty('padding-'+side, 'max(env(safe-area-inset-'+side+', 0px), var(--km-safe-'+side+', 0px))');
          }
          current.document.body.append(edgeProbe);
          current.addEventListener('resize', queueFit);
          current.visualViewport?.addEventListener('resize', queueFit);
          current.visualViewport?.addEventListener('scroll', queueFit);
        }
        const viewport = current.visualViewport;
        if (viewport && Math.abs(viewport.scale - 1) >= .01) return;
        const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
        const edges = current.getComputedStyle(edgeProbe);
        const safe = {left:x+parseFloat(edges.paddingLeft), top:y+parseFloat(edges.paddingTop),
          right:x+(viewport?.width || current.innerWidth)-parseFloat(edges.paddingRight),
          bottom:y+(viewport?.height || current.innerHeight)-parseFloat(edges.paddingBottom)};
        let left = 0, top = 0;
        for (const frame of frames) {
          const rect = frame.getBoundingClientRect(); left += rect.left + frame.clientLeft; top += rect.top + frame.clientTop;
        }
        const insets = {left:safe.left-left, top:safe.top-top, right:left+innerWidth-safe.right, bottom:top+innerHeight-safe.bottom};
        for (const side of Object.keys(insets)) {
          const distance = Math.max(0, Math.ceil(insets[side]) || 0)+'px';
          if (root.style.getPropertyValue('--reader-host-'+side)!==distance) root.style.setProperty('--reader-host-'+side, distance);
        }
      } catch { releaseHost(); }
    }
    window.addEventListener('pagehide', releaseHost);
    let manualLandscape = false, fitFrame = 0, fitLater = 0;
    function fit() {
      const viewport = window.visualViewport;
      const unzoomed = viewport && Math.abs(viewport.scale - 1) < .01;
      const w = Math.round(unzoomed ? viewport.width : innerWidth);
      const h = Math.round(unzoomed ? viewport.height : innerHeight);
      if (!w || !h) return;
      root.style.setProperty('--km-view-x', (unzoomed ? viewport.offsetLeft || 0 : 0) + 'px');
      root.style.setProperty('--km-view-y', (unzoomed ? viewport.offsetTop || 0 : 0) + 'px');
      readHostEdges();
      const portrait = h > w;
      if (!portrait) manualLandscape = false;
      const turned = portrait && manualLandscape;
      const width = turned ? h : w, height = turned ? w : h;
      root.classList.toggle('km-reader-turned', turned);
      root.classList.toggle('km-reader-wide', width >= height && width >= 500);
      root.style.setProperty('--km-reader-width', width + 'px');
      root.style.setProperty('--km-reader-height', height + 'px');
      measureStage();
      const touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
      rotate.hidden = presentationFrame || !portrait || (!touch && w >= 700);
      rotate.textContent = turned ? '↶' : '↻';
      rotate.title = turned ? 'Revenir en portrait' : 'Lire en paysage';
      rotate.setAttribute('aria-label', rotate.title);
      rotate.setAttribute('aria-pressed', String(turned));
      full.hidden = !(document.fullscreenEnabled || root.webkitRequestFullscreen);
    }
    function queueFit() {
      cancelAnimationFrame(fitFrame);
      clearTimeout(fitLater);
      fitFrame = requestAnimationFrame(fit);
      fitLater = setTimeout(fit, 250);
    }
    rotate.addEventListener('click', () => {
      manualLandscape = !manualLandscape; fit(); closeSettings(); summary.focus();
    });
    async function toggleFullscreen(event) {
      event.preventDefault(); event.stopImmediatePropagation(); closeSettings();
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
        else if (root.requestFullscreen) await root.requestFullscreen();
        else root.webkitRequestFullscreen?.();
      } catch {}
      queueFit();
    }
    function fullscreenChanged() {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      full.title = active ? 'Quitter le plein écran' : 'Plein écran';
      full.setAttribute('aria-label', full.title);
      full.setAttribute('aria-pressed', String(active));
      queueFit();
    }
    full.addEventListener('click', toggleFullscreen, true);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    document.addEventListener('webkitfullscreenchange', fullscreenChanged);
    screen.orientation?.addEventListener?.('change', queueFit);
    window.addEventListener('orientationchange', queueFit);
    window.addEventListener('pageshow', queueFit);
    window.addEventListener('resize', queueFit);
    window.visualViewport?.addEventListener('resize', queueFit);
    window.visualViewport?.addEventListener('scroll', queueFit);

    // In manual landscape the physical Y axis runs across the book.
    let swipe = null;
    book.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { if (swipe) swipe.pinch = true; return; }
      if (!root.classList.contains('km-reader-turned')) return;
      const touch = event.touches[0]; swipe = {x:touch.clientX, y:touch.clientY};
    }, {capture:true, passive:true});
    book.addEventListener('touchmove', event => {
      if (swipe && event.touches.length > 1) swipe.pinch = true;
    }, {capture:true, passive:true});
    book.addEventListener('touchend', event => {
      if (!swipe) return;
      event.stopImmediatePropagation();
      if (event.touches.length) return;
      const start = swipe; swipe = null;
      if (start.pinch || !event.changedTouches.length) return;
      const touch = event.changedTouches[0], dx = touch.clientY - start.y, dy = touch.clientX - start.x;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        event.preventDefault(); byId(dx < 0 ? 'nextBtn' : 'prevBtn').click();
      }
    }, {capture:true, passive:false});
    book.addEventListener('touchcancel', () => { swipe = null; }, {capture:true, passive:true});
    fit();
  }
  document.addEventListener('km-reader-ready', mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
