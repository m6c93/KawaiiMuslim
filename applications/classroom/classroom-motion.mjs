// Decorative motion lives outside Quran text and player controls.
import {createGardenBirds} from './garden-birds.mjs';
export function createClassroomMotion(root) {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  let preference = true, frame = 0, board = null, birds = null, inView = false, destroyed = false;
  let pointer = {x: 0, y: 0};
  const animations = new Set();
  try { preference = localStorage.getItem('km-classroom-motion') !== 'off'; } catch {}
  const enabled = () => preference && !query.matches && !document.hidden;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.target === board) inView = entry.isIntersecting;
    update();
  }, {threshold: .05});
  function update() {
    root.dataset.motion = enabled() ? 'on' : 'off';
    root.dataset.gardenVisible = inView && enabled() ? 'true' : 'false';
    birds?.setActive(inView && enabled());
    const button = root.querySelector('[data-action="motion"]');
    if (button) {
      button.setAttribute('aria-pressed', String(preference && !query.matches));
      const label = query.matches ? 'Animations réduites' : preference ? 'Animations activées' : 'Animations en pause';
      if (button.textContent !== label) button.textContent = label;
      button.title = query.matches ? 'Le réglage de votre appareil réduit les animations.' : 'Activer ou mettre en pause les animations décoratives';
    }
    if (!enabled()) { for (const animation of animations) animation.cancel(); animations.clear(); }
    schedule();
  }
  function refresh() {
    if (destroyed) return;
    const next = root.querySelector('.cc-board');
    if (next !== board) {
      if (board) observer.unobserve(board);
      birds?.destroy(); birds = null;
      board = next; pointer = {x: 0, y: 0}; inView = false;
      if (board) {
        const decor = document.createElement('div');
        decor.className = 'cc-garden-depth'; decor.setAttribute('aria-hidden', 'true');
        decor.innerHTML = '<i class="cc-leaf cc-leaf-one"></i><i class="cc-leaf cc-leaf-two"></i><i class="cc-leaf cc-leaf-three"></i>';
        board.prepend(decor); observer.observe(board);
        birds = createGardenBirds(board);
        board.querySelectorAll('.cc-planted').forEach((tree, i) => {
          tree.style.setProperty('--tree-delay', `${-i * .8}s`);
          tree.style.setProperty('--arrival-delay', `${Math.min(i * 60, 420)}ms`);
        });
      }
    }
    update();
  }
  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(paint);
  }
  function paint() {
    frame = 0; if (!board) return;
    const rect = board.getBoundingClientRect();
    const scroll = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top - rect.height / 2) / innerHeight));
    const active = enabled() && inView;
    board.style.setProperty('--depth-x', `${active ? pointer.x * 6 : 0}px`);
    board.style.setProperty('--depth-y', `${active ? scroll * 10 + pointer.y * 4 : 0}px`);
  }
  function move(event) {
    if (!board || event.pointerType === 'touch' || !enabled() || !board.contains(event.target)) return;
    const r = board.getBoundingClientRect();
    pointer = {x: (event.clientX - r.left) / r.width - .5, y: (event.clientY - r.top) / r.height - .5}; schedule();
  }
  function enter(element, direction = 0) {
    if (!element || !enabled() || element.matches('.cc-coran-panel,.cc-reader')) return;
    const animation = element.animate([
      {opacity: .2, transform: direction ? `translateX(${direction * 22}px)` : 'translateY(8px)'},
      {opacity: 1, transform: 'translate(0,0)'}
    ], {duration: direction ? 380 : 280, easing: 'cubic-bezier(.2,.75,.25,1)'});
    animations.add(animation); animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  }
  function toggle() {
    preference = !preference;
    try {localStorage.setItem('km-classroom-motion', preference ? 'on' : 'off');} catch {}
    update();
  }
  const mutation = new MutationObserver(refresh);
  mutation.observe(root, {childList: true, subtree: true});
  root.addEventListener('pointermove', move, {passive: true});
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  document.addEventListener('visibilitychange', update);
  query.addEventListener('change', update);
  refresh();
  function destroy() {
    destroyed = true; cancelAnimationFrame(frame); observer.disconnect(); mutation.disconnect();
    birds?.destroy(); birds = null;
    for (const animation of animations) animation.cancel();
    root.removeEventListener('pointermove', move); window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule); document.removeEventListener('visibilitychange', update);
    query.removeEventListener('change', update);
  }
  return {enabled, refresh, enter, toggle, destroy};
}
