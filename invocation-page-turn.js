/* Shared paper animation for the full and discovery Aya & Ali invocation books. */
(function () {
  'use strict';

  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => value * value * (3 - 2 * value);

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

  if (typeof module === 'object' && module.exports) {
    module.exports = { leafGeometry, ease };
  }
  if (typeof document === 'undefined') return;

  function mount() {
    if (!/\/books\/invocations-(?:aya-ali|decouverte)(?:\.html)?$/.test(location.pathname)) return;
    // These bindings belong to the existing reader. Its access gate, page
    // numbering, progress persistence, zoom, touch and controls stay in charge.
    if (typeof go !== 'function' || typeof els === 'undefined' || els.book.dataset.paperTurn) return;
    const book = els.book, reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
    book.dataset.paperTurn = 'curved-v1';
    book.classList.add('km-natural-book');
    const style = document.createElement('style');
    style.textContent = `
      .book.km-natural-book{filter:none!important;transform-style:preserve-3d;isolation:auto}
      .km-natural-book .paper img{user-select:none;-webkit-user-drag:none}
      .km-natural-book .binding{width:28px;background:linear-gradient(90deg,transparent,#271e1014 35%,#271e1038 49%,#fff9e84d 53%,#271e100a 68%,transparent)}
      .km-natural-book .km-paper-leaf{position:absolute;left:50%;top:0;width:50%;height:100%;z-index:40;pointer-events:none;transform-style:preserve-3d}
      .km-paper-strip{position:absolute;left:0;top:0;height:100%;transform-style:preserve-3d;will-change:transform}
      .km-paper-face{position:absolute;inset:0;background:#fffdf9;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}
      .km-paper-face.back{transform:rotateY(180deg)}
      .km-paper-face canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
      .km-paper-tone{position:absolute;inset:0;background:#322718;pointer-events:none;opacity:0}
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
    function face(image, offset, width, height, pageWidth, back) {
      const element = document.createElement('div');
      element.className = 'km-paper-face' + (back ? ' back' : '');
      const canvas = document.createElement('canvas');
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.scale(canvas.width / width, canvas.height / height);
      ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, width, height);
      if (image) {
        const fit = Math.min(pageWidth / image.naturalWidth, height / image.naturalHeight);
        const w = image.naturalWidth * fit, h = image.naturalHeight * fit;
        ctx.drawImage(image, (pageWidth - w) / 2 - offset, (height - h) / 2, w, h);
      }
      const tone = document.createElement('div'); tone.className = 'km-paper-tone';
      element.append(canvas, tone);
      return { element, tone };
    }

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
        const count = matchMedia('(pointer:coarse)').matches ? 12 : 18;
        const strips = leafGeometry(width, 0, forward, count, opening || closing);
        leaf = document.createElement('div'); leaf.className = 'km-paper-leaf'; leaf.setAttribute('aria-hidden', 'true');
        const pieces = strips.map(segment => {
          const piece = document.createElement('div'); piece.className = 'km-paper-strip';
          piece.style.width = (segment.width + 1.2) + 'px';
          piece.style.transformOrigin = forward ? 'left center' : 'right center';
          const a = face(front, segment.frontOffset, segment.width + 1.2, height, width, false);
          const b = face(back, segment.backOffset, segment.width + 1.2, height, width, true);
          piece.append(a.element, b.element); leaf.append(piece);
          return { piece, frontTone: a.tone, backTone: b.tone };
        });
        cast = document.createElement('div'); cast.className = 'km-paper-cast'; cast.setAttribute('aria-hidden', 'true');
        book.append(cast, leaf);
        book.style.perspective = Math.max(1400, width * 4) + 'px';
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
          const geometry = leafGeometry(width, p, forward, count, opening || closing);
          const lift = Math.sin(Math.PI * p);
          geometry.forEach((segment, i) => {
            pieces[i].piece.style.transform = `translate3d(${segment.x}px,0,${segment.z}px) rotateY(${segment.angle}deg)`;
            const shade = lift * (0.08 + 0.13 * i / count);
            pieces[i].frontTone.style.opacity = shade;
            pieces[i].backTone.style.opacity = shade * 0.72;
          });
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
