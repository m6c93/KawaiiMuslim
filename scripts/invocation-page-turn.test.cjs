const { test } = require('node:test');
const assert = require('node:assert/strict');
const { leafGeometry, paperColumns, pageImageRect } = require('../invocation-page-turn.js');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('page crop removes the printer border while retaining text and page numbers', () => {
  // Both invocation editions use 1579 × 1600 page exports. Printer marks sit
  // in the outer 20 pixels; page numbers remain around y=1500.
  for (const size of [183, 657.5]) {
    const crop = pageImageRect(1579, 1600, size, size);
    assert.ok(crop.x > 20 && crop.y > 20);
    assert.ok(crop.x + crop.width < 1559 && crop.y + crop.height < 1580);
    assert.ok(crop.y + crop.height > 1520, 'page number stays visible');
    assert.equal(crop.width, crop.height, 'fill square pages without letterboxing or stretching');
  }
});

for (const forward of [true, false]) {
  test(`sheet stays continuous and settles flat (${forward ? 'next' : 'previous'})`, () => {
    const width = 640, count = 16;
    for (const p of [0, .1, .35, .5, .8, 1]) {
      const leaf = leafGeometry(width, p, forward, count);
      leaf.forEach((s, i) => {
        assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.angle));
        if (p === 0 || p === 1) assert.ok(Math.abs(s.z) < 1e-9, 'no raised edge at rest');
        if (i === count - 1) return;
        const next = leaf[i + 1], angle = s.angle * Math.PI / 180;
        const endX = forward ? s.x + Math.cos(angle) * s.width : s.x + s.width - Math.cos(angle) * s.width;
        const nextStart = forward ? next.x : next.x + next.width;
        assert.ok(Math.abs(endX - nextStart) < 1e-9, 'no gap between adjacent strips');
        const endZ = s.z + (forward ? -1 : 1) * Math.sin(angle) * s.width;
        assert.ok(Math.abs(endZ - next.z) < 1e-9, 'continuous paper depth');
      });
      if (p > 0 && p < 1) assert.notEqual(leaf[0].angle, leaf.at(-1).angle, 'paper curves instead of rotating rigidly');
    }
  });
  test(`back of the page remains readable (${forward ? 'next' : 'previous'})`, () => {
    const leaf = leafGeometry(640, 1, forward, 16);
    for (const s of leaf) {
      assert.equal(s.frontOffset + s.backOffset, 600, 'reverse the slice order, not the text');
      assert.equal(Math.abs(s.angle), 180);
    }
  });
}

test('curved paper covers every column once without gaps in either direction', () => {
  for (const width of [183, 657.5]) for (const ratio of [1, 2]) for (const forward of [true, false]) {
    for (const p of [0, .05, .2, .4, .5, .6, .8, .95, 1]) {
      const columns = paperColumns(width, width, p, forward, ratio).filter(Boolean);
      assert.ok(columns.length > 0);
      columns.forEach((column, i) => {
        assert.ok(column.u >= 0 && column.u <= 1, 'texture remains inside one page');
        assert.ok(column.scale >= .999 && column.scale < 1.4);
        if (i) assert.equal(column.x, columns[i - 1].x + 1, 'no gap revealing the underlying page');
        if (p === 0 || p === 1) {
          assert.equal(column.back, p === 1, 'only the visible face is painted');
          if (i) assert.ok(column.u >= columns[i - 1].u, 'neither face mirrors its text');
        }
      });
    }
  }
});

// Exercise the reader contract without browser automation or image assets.
function reader({ reduced = false, failedImages = false } = {}) {
  const listeners = {}, frames = new Map(), timers = new Map();
  let frameId = 0, timerId = 0, resize;
  function element() {
    return {
      style: {}, dataset: {}, children: [], attributes: {}, clientWidth: 800, clientHeight: 400,
      classList: { add() {} },
      append(...nodes) { this.children.push(...nodes); nodes.forEach(n => { n.parent = this; }); },
      setAttribute(k, v) { this.attributes[k] = v; },
      removeAttribute(k) { delete this.attributes[k]; },
      remove() { this.parent.children = this.parent.children.filter(n => n !== this); },
      querySelector() { return { src: 'cover', currentSrc: 'cover' }; },
      getContext(type) { return type === 'webgl' ? null : { setTransform() {}, clearRect() {}, scale() {}, fillRect() {}, drawImage() {} }; }
    };
  }
  const els = Object.fromEntries(['book', 'cover', 'spread', 'leftPaper', 'rightPaper', 'left', 'right'].map(k => [k, element()]));
  const ctx = {
    els, position: 1, turning: false, rendered: [], go() {},
    maxPosition: () => 3, pagesFor: p => p ? [p * 2 - 1, p * 2] : [0, 0],
    pageSrc: n => n > 0 && n <= 5 ? `page-${n}` : '', isBookSinglePage: () => false,
    render() { ctx.rendered.push(ctx.position); }, pageSound() {},
    setEmbedPage(image, page) { image.page = page; },
    matchMedia: query => ({ matches: query.includes('reduced-motion') && reduced, addEventListener() {} }),
    location: { pathname: '/books/invocations-aya-ali.html' },
    document: { readyState: 'complete', head: element(), createElement: element,
      addEventListener(type, fn) { listeners[type] = fn; } },
    window: { addEventListener(type, fn) { listeners[type] = fn; }, ResizeObserver: true },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} },
    Image: class {
      naturalWidth = 500; naturalHeight = 500;
      set src(_) { queueMicrotask(() => failedImages ? this.onerror() : this.onload()); }
    },
    devicePixelRatio: 1,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(readFileSync(require.resolve('../invocation-page-turn.js'), 'utf8'), ctx);
  return { ctx, els, resize: () => resize(), frame(time) {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(time));
  }, assertSettled(target) {
    assert.equal(ctx.position, target);
    assert.equal(ctx.turning, false);
    assert.equal(els.book.attributes['aria-busy'], undefined);
    assert.equal(els.book.children.length, 0);
    assert.equal(frames.size, 0);
    assert.equal(timers.size, 0);
  } };
}

test('turn completes, rejects a second click and removes transient layers', async () => {
  const r = reader();
  await r.ctx.go(2);
  assert.equal(r.els.book.children.filter(n => n.className === 'km-paper-leaf').length, 1, 'one opaque canvas, no overlapping DOM strips');
  await r.ctx.go(3);
  assert.equal(r.ctx.position, 1, 'reading progress changes only when the turn finishes');
  r.frame(0); r.frame(1000);
  r.assertSettled(2);
});

test('manual rotation during a turn finishes and unlocks navigation', async () => {
  const r = reader();
  await r.ctx.go(2);
  r.els.book.clientWidth = 400; r.resize();
  r.assertSettled(2);
  await r.ctx.go(1); r.frame(0); r.frame(1000);
  r.assertSettled(1);
});

test('reduced motion and unavailable page images retain working navigation', async () => {
  for (const options of [{ reduced: true }, { failedImages: true }]) {
    const r = reader(options);
    await r.ctx.go(2);
    r.assertSettled(2);
  }
});

test('cover and odd last spread settle without leaving hidden or busy layers', async () => {
  const r = reader();
  await r.ctx.go(0); r.frame(0); r.frame(1100); r.assertSettled(0);
  await r.ctx.go(1); r.frame(2000); r.frame(3100); r.assertSettled(1);
  await r.ctx.go(3); r.frame(4000); r.frame(5000); r.assertSettled(3);
  assert.equal(r.els.leftPaper.style.opacity, undefined);
});
