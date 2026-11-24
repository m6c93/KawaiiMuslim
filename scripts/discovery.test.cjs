const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const [id,count] of [['tawakkul',5],['miracles',5],['hijabi',3]]){
 const html=fs.readFileSync(path.join(root,'books/'+id+'-decouverte.html'),'utf8');
 const config=JSON.parse(html.match(/id="bookConfig">([^<]+)<\/script>/)[1]);
 assert.equal(config.pages.length + (config.numberOffset || 0), count);
 assert(html.includes('/books/picture-reader.js?'));assert(html.includes('/invocation-page-turn.js?'));
 assert(config.discovery);assert(!html.includes('data:image'));
 for(const asset of [config.cover,...config.pages])assert(fs.existsSync(path.join(root,asset)));
}
function gate(url){
 let redirected=null,guest=false,hidden=false;
 const location=new URL(url),session=new Map();location.replace=value=>redirected=value;
 const element={style:{set visibility(value){hidden=value==='hidden';}},classList:{add(){}}};
 const context={URL,URLSearchParams,Set,Promise,sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)},document:{documentElement:element,scripts:[],head:{appendChild(){}},createElement:()=>({addEventListener(){}})},window:{location},};context.window.self=context.window;context.window.top=context.window;
 vm.runInNewContext(fs.readFileSync(path.join(root,'km-access-gate.js'),'utf8'),context);return{redirected,guest:context.window.KM_GUEST_MODE,hidden};
}
assert.equal(gate('https://example.com/Bibliotheque%20Kawaii%20Muslim.dc.html?guest=1').guest,true);
assert.equal(gate('https://example.com/books/tawakkul.html?guest=1&previewPages=1000').redirected,'/books/tawakkul-decouverte.html?guest=1');
assert.equal(gate('https://example.com/books/vers-allah.html?guest=1').hidden,true);
assert.equal(gate('https://example.com/Admin.dc.html?guest=1').hidden,true);
console.log('PASS: 5/5/3 fixed excerpts; asset files exist; arbitrary guest limits do not open full books; no guest admin access.');

// An odd final spread must keep a blank paper leaf instead of hiding the book's right half.
const controller=fs.readFileSync(path.join(root,'books/picture-reader.js'),'utf8');
const code=controller.slice(controller.indexOf('  function showPaper('), controller.indexOf('  function render()'));
const leaves=[{},{}].map(()=>({replaceChildren(){this.empty=true;}}));
vm.runInNewContext(code + ';showPaper(1, undefined)', {papers:leaves,position:3});
assert.equal(leaves[1].hidden,false);assert.equal(leaves[1].empty,true);
console.log('PASS: odd final spread retains a visible blank right leaf and requests no sixth image.');
