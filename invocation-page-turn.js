/* Shared paper animation for the full and discovery Aya & Ali invocation books. */
(function () {
  'use strict';

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => value * value * (3 - 2 * value);
  // The page exports include a white printer border and crop marks. Keep the
  // original assets intact and use the same small crop in CSS and the turn.
  const PAGE_TRIM = 0.016;
  function pageImageRect(imageWidth, imageHeight, pageWidth, pageHeight) {
    const aspect = pageWidth / pageHeight;
    const width = Math.min(imageWidth, imageHeight * aspect) * (1 - PAGE_TRIM * 2);
    const height = width / aspect;
    return { x: (imageWidth - width) / 2, y: (imageHeight - height) / 2, width, height };
  }

  // Integrate the tangent along the sheet: unlike a flat rotateY, the outer
  // edge follows the spine with a gentle bend, then settles completely flat.
  function leafGeometry(width, progress, forward, count, stiff = false) {
    const p = clamp(progress), step = width / count;
    const bend = Math.sin(Math.PI * p) * (stiff ? 0.10 : 0.76);
    let x = 0, z = 0;
    return Array.from({ length: count }, (_, i) => {
      const angle = Math.PI * p + bend * ((i + 0.5) / count - 0.5);
      const segment = {
        x: forward ? x : -x - step,
        z,
        angle: (forward ? -angle : angle) * 180 / Math.PI,
        frontOffset: (forward ? i : count - i - 1) * step,
        backOffset: (forward ? count - i - 1 : i) * step,
        width: step
      };
      x += Math.cos(angle) * step;
      z += Math.sin(angle) * step;
      return segment;
    });
  }

  // Shared vertices form one opaque surface. Separate overlapping CSS faces
  // allow their backs to bleed through at the joins on some compositors.
  function paperMesh(width, height, progress, forward, count = 64, stiff = false) {
    const segments = leafGeometry(width, progress, forward, count, stiff);
    const vertices = new Float32Array((count + 1) * 2 * 6);
    let offset = 0;
    for (let i = 0; i <= count; i++) {
      const s = segments[Math.min(i, count - 1)], radians = s.angle * Math.PI / 180;
      let x = forward ? s.x : s.x + s.width, z = s.z;
      if (i === count) {
        x += (forward ? 1 : -1) * Math.cos(radians) * s.width;
        z += (forward ? -1 : 1) * Math.sin(radians) * s.width;
      }
      const u = forward ? i / count : 1 - i / count;
      for (const v of [0, 1]) {
        vertices.set([x, v * height, z, u, v, Math.cos(radians)], offset);
        offset += 6;
      }
    }
    return vertices;
  }

  // Paint each device-pixel column once, choosing the nearest part of the
  // curved sheet. No antialiased strip joins or translucent CSS backs remain.
  function paperColumns(width, height, progress, forward, ratio = 1, stiff = false) {
    const mesh = paperMesh(width, height, progress, forward, 64, stiff);
    const padding = Math.ceil(height * .22), perspective = Math.max(1400, width * 4);
    const columns = new Array(Math.ceil((width * 2 + padding * 2) * ratio));
    for (let i = 0; i < 64; i++) {
      const a = i * 12, b = (i + 1) * 12;
      const sa = perspective / (perspective - mesh[a + 2]);
      const sb = perspective / (perspective - mesh[b + 2]);
      const xa = (padding + width + mesh[a] * sa) * ratio;
      const xb = (padding + width + mesh[b] * sb) * ratio;
      if (Math.abs(xb - xa) < .0001) continue;
      const from = Math.max(0, Math.ceil(Math.min(xa, xb) - .5));
      const to = Math.min(columns.length - 1, Math.floor(Math.max(xa, xb) - .5));
      for (let x = from; x <= to; x++) {
        const t = clamp((x + .5 - xa) / (xb - xa)), scale = sa + (sb - sa) * t;
        if (columns[x] && columns[x].scale > scale) continue;
        const normal = mesh[a + 5] + (mesh[b + 5] - mesh[a + 5]) * t;
        const u = (mesh[a + 3] * sa * (1 - t) + mesh[b + 3] * sb * t) / scale;
        columns[x] = { x, scale, u: normal >= 0 ? u : 1 - u, back: normal < 0,
          normal, sampleWidth: Math.abs(mesh[b + 3] - mesh[a + 3]) / Math.abs(xb - xa) };
      }
    }
    return columns;
  }

  function createPaperRenderer() {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { alpha: true });
    canvas.className = 'km-paper-leaf'; canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.renderer = 'opaque-continuous-surface';
    const faces = [document.createElement('canvas'), document.createElement('canvas')];
    let width, height, padding, ratio;
    return {
      canvas,
      prepare(front, back, pageWidth, pageHeight, frontIsCover = false, backIsCover = false) {
        width = pageWidth; height = pageHeight; padding = Math.ceil(height * .22);
        ratio = Math.min(devicePixelRatio || 1, 2);
        const cw = width * 2 + padding * 2, ch = height + padding * 2;
        canvas.width = Math.ceil(cw * ratio); canvas.height = Math.ceil(ch * ratio);
        Object.assign(canvas.style, { left: -padding + 'px', top: -padding + 'px', width: cw + 'px', height: ch + 'px' });
        [front, back].forEach((image, i) => {
          const face = faces[i]; face.width = Math.min(2048, Math.ceil(width * ratio));
          face.height = Math.min(2048, Math.ceil(height * ratio));
          const context = face.getContext('2d');
          context.fillStyle = '#fffdf9'; context.fillRect(0, 0, face.width, face.height);
          if (image) {
            if (i === 0 ? frontIsCover : backIsCover) {
              const fit = Math.min(face.width / image.naturalWidth, face.height / image.naturalHeight);
              const w = image.naturalWidth * fit, h = image.naturalHeight * fit;
              context.drawImage(image, (face.width - w) / 2, (face.height - h) / 2, w, h);
            } else {
              const crop = pageImageRect(image.naturalWidth, image.naturalHeight, pageWidth, pageHeight);
              context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, face.width, face.height);
            }
          }
        });
      },
      draw(progress, forward, stiff) {
        const lift = Math.sin(Math.PI * progress);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const column of paperColumns(width, height, progress, forward, ratio, stiff)) {
          if (!column) continue;
          const face = faces[column.back ? 1 : 0];
          const sample = Math.min(face.width, Math.max(.5, column.sampleWidth * face.width));
          const sx = Math.max(0, Math.min(face.width - sample, column.u * face.width - sample / 2));
          const top = (padding + height * .5 * (1 - column.scale)) * ratio;
          const span = height * column.scale * ratio;
          ctx.globalAlpha = 1;
          ctx.drawImage(face, sx, 0, sample, face.height, column.x, top, 1, span);
          ctx.fillStyle = '#322718';
          ctx.globalAlpha = lift * (.05 + .10 * (1 - Math.abs(column.normal)));
          ctx.fillRect(column.x, top, 1, span);
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { leafGeometry, paperMesh, paperColumns, pageImageRect, ease };
  }
  if (typeof document === 'undefined') return;

  function mount() {
    if (!/\/books\/invocations-(?:aya-ali|decouverte)(?:\.html)?$/.test(location.pathname)) return;
    // These bindings belong to the existing reader. Its access gate, page
    // numbering, progress persistence, zoom, touch and controls stay in charge.
    if (typeof go !== 'function' || typeof els === 'undefined' || els.book.dataset.paperTurn) return;
    const book = els.book, reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
    book.dataset.paperTurn = 'continuous-v3-trimmed';
    book.classList.add('km-natural-book');
    const style = document.createElement('style');
    style.textContent = `
      html.km-reader-clean,html.km-reader-clean body{background:#b8cec5!important}
      .km-reader-clean .reader{background:radial-gradient(ellipse at 50% 35%,#dce8e2,#adc5ba)!important}
      .km-reader-clean .book.km-natural-book{--km-book-gutter:48px;width:calc(var(--km-page-width) - var(--km-book-gutter))!important;height:calc(var(--km-page-height) - var(--km-book-gutter)/2)!important}
      @media(max-width:700px){.km-reader-clean .book.km-natural-book{--km-book-gutter:24px}}
      .book.km-natural-book{filter:none!important;transform-style:flat;perspective:none!important;isolation:isolate}
      .km-natural-book .spread{box-shadow:0 16px 34px #19382f45,0 2px 5px #19382f38;outline:1px solid #49645840;border-radius:8px}
      .km-natural-book .cover-stage{box-shadow:0 16px 34px #19382f50,0 2px 5px #19382f38;outline:1px solid #49645840}
      .km-natural-book .paper img{user-select:none;-webkit-user-drag:none;object-fit:cover;transform:scale(${1 / (1 - PAGE_TRIM * 2)});transform-origin:center}
      #zoomPages img,.thumb img{clip-path:inset(${PAGE_TRIM * 100}%)}
      .km-natural-book .binding{width:28px;background:linear-gradient(90deg,transparent,#271e1014 35%,#271e1038 49%,#fff9e84d 53%,#271e100a 68%,transparent)}
      .km-natural-book .km-paper-leaf{position:absolute;display:block;z-index:40;pointer-events:none;opacity:1;mix-blend-mode:normal}
      .km-paper-cast{position:absolute;top:1%;height:98%;width:50%;z-index:25;pointer-events:none;background:radial-gradient(ellipse at center,#21170945,transparent 73%);filter:blur(11px);opacity:0;will-change:opacity,transform}
      .km-natural-book[aria-busy=true] .paper::after{opacity:0}
    `;
    document.head.append(style);

    const cache = new Map();
    function imageFor(source) {
      if (!source) return Promise.resolve(null);
      if (cache.has(source)) return cache.get(source);
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        const timeout = setTimeout(() => reject(new Error('Page image timed out')), 8000);
        image.onload = () => { clearTimeout(timeout); resolve(image); };
        image.onerror = () => { clearTimeout(timeout); cache.delete(source); reject(new Error('Page image unavailable')); };
        image.src = source;
      });
      cache.set(source, promise);
      if (cache.size > 6) cache.delete(cache.keys().next().value);
      return promise;
    }
    function coverSource() {
      const image = els.cover.querySelector('img');
      if (image) return image.currentSrc || image.src;
      const background = getComputedStyle(els.cover.querySelector('.cover-image')).backgroundImage;
      return background.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || '';
    }
    let paperRenderer;
    let finishActive = null;
    // A resize, rotation or backgrounded tab must never leave a half-turned leaf.
    window.addEventListener('resize', () => finishActive?.());
    if (window.ResizeObserver) {
      let lastWidth = book.clientWidth, lastHeight = book.clientHeight;
      new ResizeObserver(() => {
        const width = book.clientWidth, height = book.clientHeight;
        if (width !== lastWidth || height !== lastHeight) finishActive?.();
        lastWidth = width; lastHeight = height;
      }).observe(book);
    }
    window.addEventListener('pagehide', () => finishActive?.());
    document.addEventListener('visibilitychange', () => { if (document.hidden) finishActive?.(); });
    reducedMotion.addEventListener?.('change', () => { if (reducedMotion.matches) finishActive?.(); });

    go = async function turnInvocationPage(next) {
      const target = Math.max(0, Math.min(maxPosition(), next));
      if (target === position || turning) return;
      if (reducedMotion.matches || isBookSinglePage()) { position = target; render(); return; }
      turning = true;
      book.setAttribute('aria-busy', 'true');
      const origin = position, opening = origin === 0, closing = target === 0;
      const forward = target > origin;
      const [currentLeft, currentRight] = pagesFor(origin);
      const [targetLeft, targetRight] = pagesFor(target);
      const frontSource = opening ? coverSource() : pageSrc(forward ? currentRight : currentLeft);
      const backSource = closing ? coverSource() : pageSrc(forward ? targetLeft : targetRight);
      const underSource = opening ? pageSrc(targetRight) : closing ? '' : pageSrc(forward ? targetRight : targetLeft);
      let leaf, cast, frame = 0, timer = 0, finished = false;
      const saved = { transform: book.style.transform, perspective: book.style.perspective, leftOpacity: els.leftPaper.style.opacity };
      const done = () => {
        if (finished) return;
        finished = true; cancelAnimationFrame(frame); clearTimeout(timer);
        position = target;
        book.style.transform = saved.transform; book.style.perspective = saved.perspective;
        els.leftPaper.style.opacity = saved.leftOpacity;
        render(); leaf?.remove(); cast?.remove();
        book.removeAttribute('aria-busy'); turning = false; finishActive = null;
      };
      finishActive = done;
      try {
        const [front, back] = await Promise.all([imageFor(frontSource), imageFor(backSource), imageFor(underSource)]);
        if (finished) return;
        // clientWidth/clientHeight remain in book coordinates when the phone's
        // portrait-only host rotates the whole reader into landscape.
        const width = book.clientWidth / 2, height = book.clientHeight;
        paperRenderer ||= createPaperRenderer();
        paperRenderer.prepare(front, back, width, height, opening, closing);
        paperRenderer.draw(0, forward, opening || closing);
        leaf = paperRenderer.canvas;
        cast = document.createElement('div'); cast.className = 'km-paper-cast'; cast.setAttribute('aria-hidden', 'true');
        book.append(cast, leaf);
        if (opening) {
          els.cover.hidden = true; els.spread.hidden = false; els.leftPaper.style.opacity = '0';
          setEmbedPage(els.right, targetRight);
        } else if (closing) {
          els.leftPaper.style.opacity = '0';
        } else {
          setEmbedPage(forward ? els.right : els.left, forward ? targetRight : targetLeft);
        }
        pageSound();
        const duration = opening || closing ? 1050 : 900;
        let start;
        function draw(timestamp) {
          if (finished) return;
          if (start === undefined) start = timestamp;
          const elapsed = clamp((timestamp - start) / duration), p = ease(elapsed);
          const lift = Math.sin(Math.PI * p);
          try { paperRenderer.draw(p, forward, opening || closing); }
          catch (_) { paperRenderer = null; done(); return; }
          cast.style.opacity = lift * 0.7;
          cast.style.transform = `translateX(${width * (forward ? 1 - p : p)}px) scaleX(${0.5 + lift * 0.6})`;
          if (opening || closing) book.style.transform = `translateX(${-width / 2 * (opening ? 1 - p : p)}px)`;
          if (elapsed < 1) frame = requestAnimationFrame(draw); else done();
        }
        frame = requestAnimationFrame(draw);
        timer = setTimeout(done, duration + 350);
      } catch (_) {
        // Reading remains usable if a canvas or an image cannot be prepared.
        done();
      }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
