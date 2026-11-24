const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('km-activity-progress.js','utf8');
const profileKey = 'km-active-profile-v2';
function store() {
  const items = new Map();
  return {getItem:key=>items.get(key) ?? null, setItem:(key,value)=>items.set(key,String(value)), removeItem:key=>items.delete(key)};
}
function openPage(localStorage, profile, query='') {
  if (profile) localStorage.setItem(profileKey,JSON.stringify(profile)); else localStorage.removeItem(profileKey);
  const location = new URL('https://www.kawaiimuslimworld.com/Atelier.dc.html'+query);
  const window = {location, URL, URLSearchParams, document:new EventTarget(), CustomEvent, localStorage,sessionStorage:store(),addEventListener(){}};
  window.window = window;
  vm.runInNewContext(code,window);
  return window.KMActivityProgress;
}
test('a stale screen cannot read or write a sibling’s progress; another parent and the guest have independent histories',()=>{
  const db=store();
  db.setItem('kmw-salah-v1','anonymous legacy record');
  const a=openPage(db,{type:'child',id:'amal'});
  a.storage.setItem('kmw-salah-v1','position 4'); a.remember('/applications/salah/');
  const b=openPage(db,{type:'child',id:'nour'});
  assert.equal(b.storage.getItem('kmw-salah-v1'),null); assert.equal(b.recent(),null);
  a.storage.setItem('kmw-salah-v1','delayed save'); assert.equal(b.storage.getItem('kmw-salah-v1'),null);
  b.remember('/applications/aya-chansons/?lecon=alphabet');
  const guest=openPage(db,{type:'child',id:'nour'},'?guest=1');assert.equal(guest.recent(),null);
  guest.remember('/applications/mimi/');assert.equal(guest.recent().href,'/applications/mimi/?guest=1');
  assert.equal(openPage(db,{type:'child',id:'nour'}).recent().href,'/applications/aya-chansons/?lecon=alphabet');
  const again=openPage(db,{type:'child',id:'amal'});assert.equal(again.storage.getItem('kmw-salah-v1'),'position 4');assert.equal(again.recent().href,'/applications/salah/');
  const parent=openPage(db,{type:'parent',ownerId:'family-a'});parent.remember('/books/tawakkul.html','Tawakkul');
  assert.equal(openPage(db,{type:'parent',ownerId:'family-b'}).recent(),null);assert.equal(db.getItem('kmw-salah-v1'),'anonymous legacy record');
});
test('only durable activity routes can become a resume link',()=>{
  const page=openPage(store(),{type:'child',id:'amal'});
  for(const bad of ['https://other.example/books/tawakkul.html','/Compte.dc.html','/api/aya','javascript:alert(1)'])page.remember(bad);
  assert.equal(page.recent(),null);
  page.remember('/Atelier.dc.html?child=other#galerie','Mon dessin');assert.equal(page.recent().href,'/Atelier.dc.html#galerie');
  page.remember('/books/tawakkul.html?token=unused','Tawakkul');assert.equal(page.recent().href,'/books/tawakkul.html');
  page.remember('/Aujourd%27hui.dc.html#weeklyDua');assert.equal(page.recent().title,'Invocation de la semaine');
});
