const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../books/picture-reader.js'), 'utf8');

function setup({turned = false, onCover = false} = {}) {
  const window = new EventTarget();
  const document = {getElementById: () => null, documentElement: {classList: {contains: () => turned}}};
  const context = vm.createContext({window, document});
  vm.runInContext(source, context);
  const area = width => ({
    clientWidth: width, clientHeight: 240,
    getBoundingClientRect: () => ({left: 10, right: 10 + (turned ? 240 : width), top: 20,
      width: turned ? 240 : width, height: turned ? width : 240})
  });
  const book = Object.assign(new EventTarget(), area(480), {
    classList: {toggle() {}}, hasAttribute: () => false, setPointerCapture() {}, closest: () => null
  });
  const spread = {style: {}}, coverArt = {style: {}};
  const coverImage = {...area(240), firstElementChild: coverArt};
  const zoomButton = {setAttribute() {}}, turns = [];
  const bindings = context.bindBookGestures({book, spread, coverImage, cover: {hidden: !onCover},
    zoomButton, turn: direction => turns.push(direction)});
  function finger(type, id, x, y) {
    const event = Object.assign(new Event('pointer' + type), {
      pointerId: id, button: 0, pointerType: 'touch',
      clientX: turned ? 250 - y : 10 + x, clientY: turned ? 20 + x : 20 + y
    });
    book.dispatchEvent(event);
  }
  function clickAllowed() {
    return book.dispatchEvent(Object.assign(new Event('click', {cancelable:true}), {detail:1}));
  }
  return {finger, clickAllowed, turns, spread, coverArt, zoomButton, bindings, window};
}

for (const turned of [false, true]) {
  test('pinch holds the focal point, then pans without turning; rotated = ' + turned, () => {
    const {finger, spread, turns, clickAllowed} = setup({turned});
    finger('down', 1, 60, 80);
    finger('down', 2, 100, 80);
    finger('move', 1, 40, 80);
    finger('move', 2, 120, 80);
    assert.equal(spread.style.transform, 'translate(-80px, -80px) scale(2)');
    finger('up', 2, 120, 80);
    finger('move', 1, 10, 90);
    assert.equal(spread.style.transform, 'translate(-110px, -70px) scale(2)');
    finger('up', 1, 10, 90);
    assert.equal(clickAllowed(), false);
    assert.deepEqual(turns, []);
    finger('down', 1, 200, 100);
    finger('move', 1, 20, 100);
    finger('up', 1, 20, 100);
    assert.deepEqual(turns, []);
  });
}
test('a pinch back to normal and its last finger never turn a page; the next swipe turns once', () => {
  const {finger, turns, spread, clickAllowed, zoomButton} = setup({turned:true});
  zoomButton.onclick();
  finger('down', 1, 40, 120);
  finger('down', 2, 200, 120);
  finger('move', 1, 110, 120);
  finger('move', 2, 130, 120);
  assert.equal(spread.style.transform, '');
  finger('up', 2, 130, 120);
  finger('up', 1, 10, 120);
  assert.equal(clickAllowed(), false);
  assert.deepEqual(turns, []);
  finger('down', 1, 200, 120);
  finger('up', 1, 100, 120);
  assert.deepEqual(turns, [1]);
});
test('cover pinch stays on the artwork with bounded scale and pan; rotation restores the view', () => {
  const {finger, spread, coverArt, window, turns} = setup({onCover:true});
  finger('down', 1, 100, 100);
  finger('down', 2, 110, 100);
  finger('move', 2, 210, 100);
  finger('up', 2, 210, 100);
  finger('move', 1, 1200, -900);
  assert.equal(coverArt.style.transform, 'translate(0px, -720px) scale(4)');
  assert.equal(spread.style.transform, '');
  window.dispatchEvent(new Event('orientationchange'));
  finger('up', 1, 80, 80);
  assert.equal(coverArt.style.transform, '');
  assert.deepEqual(turns, []);
});
test('interrupted touches, keyboard pan and escape preserve the current spread', () => {
  const {finger, turns, bindings, zoomButton, spread} = setup();
  finger('down', 1, 100, 20);
  finger('cancel', 1, 20, 20);
  finger('up', 1, 20, 20);
  assert.deepEqual(turns, []);
  zoomButton.onclick();
  const key = key => bindings.handleKey({key, preventDefault() {}});
  assert.equal(key('ArrowRight'), true);
  assert.equal(spread.style.transform, 'translate(-64px, -120px) scale(2)');
  assert.equal(key('Escape'), true);
  assert.equal(spread.style.transform, '');
  assert.equal(key('ArrowRight'), false);
});
