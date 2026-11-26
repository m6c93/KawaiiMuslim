(function () {
  "use strict";

  // The shared picture reader owns its complete pointer sequence.
  if (document.documentElement.hasAttribute("data-picture-reader")) return;
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
  script.src = "/km-reading-progress.js?v=family-reading-3";
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
  styles.href = '/books/reader-controls.css?v=reader-tools-2';
  document.head.append(styles);

  // The iPhone shell can also arrange the legacy reader elements. Keep the
  // book, page controls and settings in independent, clipped layout regions.
  function createLandscapeControls({book, dock, home, pages, settings, offer, shellControls, guardTaps}) {
    const viewport = document.createElement('km-book-viewport');
    viewport.classList.toggle('shell-controls', shellControls);
    const shadow = viewport.attachShadow({mode:'open'});
    shadow.innerHTML = `
      <style>
        :host {
          position:absolute!important; inset:0 auto auto 0!important; display:block!important;
          width:var(--km-reader-width)!important; height:var(--km-reader-height)!important;
          margin:0!important; padding:0!important; border:0!important; z-index:15;
          background:#b8cec5; color:#25483d; font:700 12px/1.15 system-ui,sans-serif;
        }
        .layout {
          box-sizing:border-box; width:100%; height:100%; overflow:hidden;
          --rail:68px;
          display:grid; grid-template-columns:var(--rail) minmax(0,1fr) var(--rail);
          grid-template-rows:minmax(0,1fr) auto; gap:6px 7px;
          padding:calc(var(--safe-top) + 7px) calc(var(--safe-right) + 7px)
            calc(var(--safe-bottom) + 7px) calc(var(--safe-left) + 7px);
        }
        .art { position:relative; grid-area:1/2; min-width:0; min-height:0; display:grid; place-items:center;
          overflow:hidden; overflow:clip; isolation:isolate; }
        .rail { position:relative; grid-area:1/1; min-width:0; min-height:0; overflow:auto;
          display:flex; flex-direction:column; align-items:stretch; overscroll-behavior:contain; }
        .tools { margin-block:auto; display:grid; align-items:start; gap:4px; }
        .bottom { grid-area:2/1/3/-1; display:grid; justify-items:center; align-items:end; min-width:0; }
        :host(.settings-open) .layout { grid-template-columns:min(162px,32%) minmax(0,1fr) 0; }
        /* The app draws its own Options pill at bottom centre and its exit at bottom left. */
        :host(.shell-controls) .bottom {
          min-height:78px; justify-items:end; align-items:center;
          padding-left:calc(var(--km-reader-width) / 2 + 58px - 7px - var(--safe-left)); box-sizing:border-box;
        }
        ::slotted([slot=art]) {
          box-sizing:border-box!important; display:block!important; position:relative!important;
          inset:auto!important; margin:0!important; padding:0!important; min-width:0!important; min-height:0!important;
          width:var(--apple-spread)!important; height:calc(var(--apple-spread) / 2)!important;
          max-width:none!important; max-height:none!important; align-self:center!important; justify-self:center!important;
          --km-cover-limit-width:var(--apple-cover-width); --km-cover-limit-height:var(--apple-cover-height);
        }
        ::slotted([slot=art]:not([aria-busy=true])) { transform:none!important; }
        ::slotted([slot=bottom]) {
          position:static!important; display:grid!important; inset:auto!important; transform:none!important;
          grid-area:auto!important; width:min(100%,570px)!important; min-width:0!important; max-width:100%!important;
          margin:0!important; align-self:center!important;
        }
        ::slotted([slot=tool]) {
          box-sizing:border-box!important; position:static!important; inset:auto!important; transform:none!important;
          width:100%!important; max-width:100%!important; min-width:0!important; height:auto!important;
          margin:0!important; pointer-events:auto!important;
        }
        ::slotted(.home),::slotted(#gridBtn) {
          display:grid!important; place-content:center!important; justify-items:center!important; gap:1px!important;
          min-height:44px!important; padding:2px!important; color:#25483d!important; background:#fffdf5!important;
          border:1px solid #91aaa0!important; border-radius:12px!important;
          font:700 11px/1.1 system-ui,sans-serif!important; text-decoration:none!important;
        }
        :host(.settings-open) ::slotted([slot=tool]:not(.reader-settings)),
        ::slotted(.preview-end[hidden]) { display:none!important; }
      </style>
      <div class="layout">
        <div class="rail"><div class="tools"><slot name="tool"></slot></div></div>
        <div class="art"><slot name="art"></slot></div>
        <div class="bottom"><slot name="bottom"></slot></div>
      </div>`;
    const art = shadow.querySelector('.art');
    const parts = [[book,'art'],[home,'tool'],[pages,'tool'],[settings,'tool'],[dock,'bottom']];
    if (offer) parts.push([offer,'tool']);
    function fitSettings() {
      viewport.classList.toggle('settings-open', settings.open);
    }
    settings.addEventListener('toggle', fitSettings);
    const origins = new Map();
    let active = false;
    function size() {
      if (!active || !art.clientWidth || !art.clientHeight) return;
      const width = Math.min(art.clientWidth, viewport.clientWidth * .85);
      const height = Math.min(art.clientHeight, viewport.clientHeight * .85);
      viewport.style.setProperty('--apple-spread', Math.min(width, height*2) + 'px');
      viewport.style.setProperty('--apple-cover-width', width + 'px');
      viewport.style.setProperty('--apple-cover-height', height + 'px');
    }
    const observer = window.ResizeObserver ? new ResizeObserver(size) : null;
    function keepTapOnPage(event) {
      if (!active || !event.target.closest?.('.paper') || event.target.closest('button,a,input')) return;
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
    }
    if (guardTaps) {
      book.addEventListener('click', keepTapOnPage, true);
      book.addEventListener('dblclick', keepTapOnPage, true);
    }
    return enabled => {
      if (enabled !== active) {
        active = enabled;
        if (active) {
          document.body.append(viewport);
          for (const [node, slot] of parts) {
            const marker = document.createComment('reader control');
            node.before(marker); origins.set(node, marker);
            node.slot = slot; viewport.append(node);
          }
          root.classList.add('km-landscape-controls');
          fitSettings();
          observer?.observe(art);
        } else {
          observer?.disconnect();
          for (const [node, marker] of origins) {
            node.removeAttribute('slot'); marker.replaceWith(node);
          }
          origins.clear(); viewport.remove(); root.classList.remove('km-landscape-controls');
        }
      }
      size();
    };
  }

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
    settings.innerHTML = '<summary aria-label="Réglages du lecteur"><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 7h6m4 0h8M3 17h11m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></svg>Réglages</summary>';
    const actions = toolbar.querySelector('.actions');
    settings.append(actions);
    document.body.append(settings);
    const sound = byId('soundBtn'), full = byId('fullscreenBtn');
    sound.title = 'Son des pages';
    sound.setAttribute('aria-pressed', 'true');
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
      dock.append(offer);
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
        const bounds = frames[0].getBoundingClientRect();
        const physical = {left:safe.left-left, top:safe.top-top,
          right:left+bounds.width-safe.right, bottom:top+bounds.height-safe.bottom};
        // The coloring footer and its iframe rotate together in the parent.
        const parentTurned = libraryFrame && window.parent.document.documentElement.classList.contains('km-landscape-page')
          && window.parent.matchMedia('screen and (orientation: portrait)').matches
          && !document.fullscreenElement && !document.webkitFullscreenElement;
        const insets = parentTurned
          ? {left:physical.top, top:physical.right, right:physical.bottom, bottom:physical.left}
          : physical;
        for (const side of Object.keys(insets)) {
          const distance = Math.max(0, Math.ceil(insets[side]) || 0)+'px';
          if (root.style.getPropertyValue('--reader-host-'+side)!==distance) root.style.setProperty('--reader-host-'+side, distance);
        }
      } catch { releaseHost(); }
    }
    window.addEventListener('pagehide', releaseHost);
    const appleDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      Boolean(window.webkit?.messageHandlers?.kmShell || window.KMApple);
    const shellControls = Boolean(window.webkit?.messageHandlers?.kmShell || window.KMApple) ||
      /iPhone|iPod/i.test(navigator.userAgent);
    const landscapeControls = window.Element?.prototype.attachShadow
      ? createLandscapeControls({book, dock, home, pages, settings, offer, shellControls, guardTaps:appleDevice}) : null;
    let fitFrame = 0, fitLater = 0;
    function fit() {
      const viewport = window.visualViewport;
      const unzoomed = viewport && Math.abs(viewport.scale - 1) < .01;
      const w = Math.round(unzoomed ? viewport.width : innerWidth);
      const h = Math.round(unzoomed ? viewport.height : innerHeight);
      if (!w || !h) return;
      root.style.setProperty('--km-view-x', (unzoomed ? viewport.offsetLeft || 0 : 0) + 'px');
      root.style.setProperty('--km-view-y', (unzoomed ? viewport.offsetTop || 0 : 0) + 'px');
      readHostEdges();
      const turned = h > w && !presentationFrame;
      const width = turned ? h : w, height = turned ? w : h;
      root.classList.toggle('km-reader-turned', turned);
      root.classList.toggle('km-reader-wide', width >= height && width >= 500);
      root.style.setProperty('--km-reader-width', width + 'px');
      root.style.setProperty('--km-reader-height', height + 'px');
      measureStage();
      full.hidden = !(document.fullscreenEnabled || root.webkitRequestFullscreen);
      landscapeControls?.(width > height && width >= 430);
    }
    function queueFit() {
      cancelAnimationFrame(fitFrame);
      clearTimeout(fitLater);
      fitFrame = requestAnimationFrame(fit);
      fitLater = setTimeout(fit, 250);
    }
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

    fit();
  }
  document.addEventListener('km-reader-ready', mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
