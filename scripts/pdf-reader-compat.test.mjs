import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../books/pdf-reader.js', import.meta.url), 'utf8');
const moduleCode = source.replace('await import(PDFJS_BUILD + "pdf.min.mjs")', 'await loadModule(PDFJS_BUILD + "pdf.min.mjs")');

async function openBook({signedIn=true, src='private://content-books/family/book.pdf'}={}) {
  const state={signed:0, engine:null, worker:null, fallback:null, message:{}};
  const location=new URL('https://example.test/Livre.dc.html?src='+encodeURIComponent(src));
  location.replace=url=>{state.redirect=url};
  const status={
    style:{},
    querySelector:selector=>selector==='p'?state.message:selector==='[data-pdf-fallback]'?state.fallback:{},
    insertBefore:link=>{state.fallback=link}
  };
  const document={getElementById:()=>status,createElement:()=>({dataset:{}}),body:{prepend(){}}};
  const pdf={GlobalWorkerOptions:{},getDocument(){state.worker=this.GlobalWorkerOptions.workerSrc;return {promise:Promise.reject(Error('renderer unavailable'))}}};
  const allowed='https://books.example.test/storage/v1/object/sign/content-books/family/book.pdf?token=test';
  const window={KM_CONFIG:{supabaseUrl:'https://books.example.test'},KMAuth:{
    getContext:async()=>signedIn?{}:null, validateActiveProfile:()=>({type:'parent'}),
    bookFileUrl:async()=>{state.signed++;return allowed}
  }};
  vm.runInNewContext(moduleCode,{document,window,location,URL,URLSearchParams,loadModule:async url=>{state.engine=url;return pdf}});
  await new Promise(resolve=>setImmediate(resolve));
  return {state,allowed};
}

test('authorized PDF uses the compatibility matching engine and worker, then offers the authorized original on failure',async()=>{
  const {state,allowed}=await openBook();
  assert.match(state.engine,/\/legacy\/build\/pdf\.min\.mjs$/);
  assert.equal(state.worker,state.engine.replace('pdf.min.mjs','pdf.worker.min.mjs'));
  assert.equal(state.fallback.href,allowed);
  assert.equal(state.fallback.hidden,false);
  assert.match(state.message.textContent,/ouvrir le PDF original/);
});

test('unauthenticated requests and arbitrary PDF destinations never expose an original link',async()=>{
  const {state:anon}=await openBook({signedIn:false});
  assert.match(anon.redirect,/^Connexion\.dc\.html\?next=/);
  assert.equal(anon.signed,0);
  assert.equal(anon.fallback,null);
  const {state:rejected}=await openBook({src:'https://unrelated.example/doc.pdf'});
  assert.equal(rejected.fallback,null);
  assert.equal(rejected.engine,null);
  assert.match(rejected.message.textContent,/Réessaie depuis la bibliothèque/);
});
