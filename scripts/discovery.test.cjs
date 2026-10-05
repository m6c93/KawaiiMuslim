const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const [id,count] of [['tawakkul',5],['miracles',5],['hijabi',3]]){
 const html=fs.readFileSync(path.join(root,'books/'+id+'-decouverte.html'),'utf8');
 const config=JSON.parse(html.match(/id="discovery-data">([^<]+)<\/script>/)[1]);
 assert.equal(config.pages.length,count);assert(html.includes('leaf-cast'));assert(html.includes('rotateY('));assert(!html.includes('/discovery-reader.js'));assert(!html.includes('data:image'));for(const asset of config.pages)assert(fs.existsSync(path.join(root,asset)));
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
const excerpt=fs.readFileSync(path.join(root,'books/miracles-decouverte.html'),'utf8');
const renderBase=excerpt.slice(excerpt.indexOf('    function renderBase(){'),excerpt.indexOf('    function setEmbedPage'));
const node=()=>({style:{},classList:{toggle(name,value){this[name]=value},remove(name){delete this[name]}},removeAttribute(name){delete this[name]}});
const els={progress:node(),prev:node(),next:node(),cover:node(),spread:node(),book:node(),label:node(),left:node(),right:node(),leftPaper:node(),rightPaper:node()};
const ctx={els,position:3,TOTAL:5,maxPosition:()=>3,pagesFor:()=>[5,6],isBookSinglePage:()=>false,pageSrc:n=>n<=5?'page-'+n:'',localStorage:{setItem(){}},progressKey:'test',document:{querySelectorAll:()=>[]},Image:function(){}};
vm.runInNewContext(renderBase+';renderBase()',ctx);
assert.equal(els.rightPaper.style.visibility,'visible');assert.equal(els.rightPaper.classList['discovery-blank'],true);assert.equal(els.right.hidden,true);assert.equal(els.right.src,undefined);
console.log('PASS: odd final spread retains a visible blank right leaf and requests no sixth image.');
