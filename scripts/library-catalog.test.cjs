const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('Bibliotheque Kawaii Muslim.dc.html');

function setup(embedded = false) {
  const storage = new Map();
  const listeners = {}, callbacks = {};
  const shelf = {scrollTop: 72};
  const search = {value: 'miracles', focus() { this.focused = true; }};
  const card = {
    dataset: {libraryTarget: 'Les miracles scientifiques du Coran'},
    focus(options) { this.focusOptions = options; },
    closest(selector) { return selector.includes('data-library-scope') ? {dataset: {libraryScope: 'guest'}} : this; }
  };
  const document = {
    addEventListener: (name, fn) => { callbacks[name] = fn; },
    getElementById: id => id === 'librarySearch' ? search : null,
    querySelector: () => shelf,
    querySelectorAll: () => [card]
  };
  const window = {
    location: {hash:''}, parent: {location: {search:''}},
    addEventListener: (name, fn) => { listeners[name] = fn; },
    scrollY: 415,
    scrollTo: (_, y) => { window.scrollY = y; },
    frameElement: embedded ? {classList: {contains: name => name === 'km-app-view'}} : null
  };
  const sessionStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  };
  const context = {window, document, sessionStorage, URLSearchParams, URL, requestAnimationFrame: fn => fn()};
  vm.runInNewContext(read('library-catalog.js'), context);
  const logic = source.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  context.DCLogic = class {
    props = {};
    setState(values, callback) { Object.assign(this.state, values); callback?.(); }
  };
  const Component = vm.runInNewContext(logic + '\nComponent', context);
  return {window, catalog: window.KMLibraryCatalog, listeners, callbacks, card, shelf, search, Component};
}

test('catalogue invité, recherche accentuée, surbrillance et effacement', () => {
  const {Component, search} = setup();
  const app = new Component();
  app.openLibrary('guest', {profile:'enfant', profileName:'Découverte', guestMode:true});
  let view = app.renderVals();
  assert.equal(view.sub, 'Quel livre veux-tu lire ?');
  assert.equal(view.books.length, 11);
  assert.equal(view.books.filter(b => b.canRead).length, 5);
  const arabic = view.books.find(b => b.title.includes('apprends'));
  assert.match(arabic.url, /colorie-ecris-apprends.html\?guest=1&from=library$/);
  assert.equal(arabic.locked, false);
  assert.equal(arabic.cardId, 'livre-colorie-ecris-et-apprends-l-arabe');
  assert.match(arabic.sub, /3 lettres/);
  view.searchBooks({target:{value:'  ECRIS  '}});
  view = app.renderVals();
  assert.equal(view.books.length, 1);
  assert.equal(view.searchStatus, '1 livre trouvé');
  assert.equal(view.books[0].titleParts.find(p=>p.style).text, 'écris');
  view.searchBooks({target:{value:'not-a-book'}});
  assert.equal(app.renderVals().searchStatus, 'Aucun livre trouvé');
  app.renderVals().resetSearch();
  assert.equal(app.renderVals().books.length, 11);
  assert.equal(app.renderVals().searchStatus, '');
  assert.equal(search.focused, true);
});

test('titres et descriptions sont conservés et recherchables, y compris apostrophes et accents décomposés', () => {
  const {catalog} = setup();
  const source = [{title:'L’esprit',sub:'E\u0301te\u0301 · ÉTÉ'}];
  assert.equal(catalog.search(source,"l'es").books.length,1);
  const runs = catalog.search(source,'ete').books[0].subParts;
  assert.equal(runs.map(run=>run.text).join(''),source[0].sub);
  assert.equal(runs.filter(run=>run.style).length,2);
});

for (const embedded of [false,true]) test('retour avec recherche, focus et défilement ' + (embedded ? 'dans la coquille' : 'direct'), () => {
  const {window,catalog,listeners,callbacks,card,shelf} = setup(embedded);
  listeners.click({target:card,button:0});
  assert.equal(catalog.takeReturn('child:other'),null);
  const saved=catalog.takeReturn('guest');
  assert.equal(saved.query,'miracles');
  assert.equal(catalog.takeReturn('guest'),null);
  window.scrollY=0;shelf.scrollTop=0;
  catalog.restoreView(saved);
  if (embedded) { assert.equal(window.scrollY,0);callbacks['km-app-active'](); }
  assert.equal(window.scrollY,415);assert.equal(shelf.scrollTop,72);assert.equal(card.focusOptions.preventScroll,true);
});

test('les droits du catalogue abonné et l’offre découverte sont distincts', () => {
  const {Component} = setup();
  const app = new Component();
  app.openLibrary('child:test', {profile:'enfant',profileName:'Nour',guestMode:false,subscribed:true});
  let view = app.renderVals();
  assert.equal(view.sub, 'Quel livre lit-on ce soir, Nour ?');
  assert.equal(view.books.filter(b=>b.canRead).length,11);
  assert(!view.books.some(b=>b.url.includes('guest=1')));
  app.setState({subscribed:false});
  view=app.renderVals();
  assert.equal(view.books.filter(b=>b.canRead).length,1);
  assert(view.books.find(b=>b.title.includes('apprends')).locked);
});

test('présentation et Découverte annoncent les limites réellement publiées', () => {
  for (const slug of ['tawakkul','miracles']) {
    const html = read('books/'+slug+'-decouverte.html');
    const data = JSON.parse(html.match(/id="bookConfig">([\s\S]*?)<\/script>/)[1]);
    const total = data.pages.length + (data.numberOffset || 0);
    const badge = read('Decouverte.dc.html').match(new RegExp('href="books/'+slug+'-decouverte.html[^"]*"><span class="badge">(\\d+) pages'));
    assert.equal(Number(badge[1]),total);
    if (slug==='miracles') {
      const landing = read('presentation.html');
      assert.match(landing,/class="sample-real-reader" src="books\/miracles-decouverte.html\?embed=1"/);
      assert.match(landing,new RegExp(total+' pages offertes'));assert.doesNotMatch(landing,/neuf premières pages|previewPages=9/);
      assert(!html.includes('km-access-gate.js'));
    }
  }
});
