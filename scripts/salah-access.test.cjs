const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root='https://www.kawaiimuslimworld.com';
const dir='applications/salah/';
const gate=fs.readFileSync('km-access-gate.js','utf8');

function browserAt(path){
 const url=new URL(path,root),redirects=[];
 const window={location:{href:url.href,pathname:url.pathname,search:url.search,hash:url.hash,
  replace(href){redirects.push(href)}}};
 return {window,redirects};
}

for(const filename of ['salah-access.js','salah-discovery.js']){
 const script=fs.readFileSync(dir+filename,'utf8');
 for(const path of ['decouverte','decouverte.html','decouverte/']){
  test(filename+' forwards '+path+' to the full lesson without authentication',()=>{
   const {window,redirects}=browserAt('/'+dir+path+'?from=today&guest=1#priere');
   const run=()=>vm.runInNewContext(script,{window,URL});
   run();run();
   assert.deepEqual(redirects,[root+'/'+dir+'?from=today&guest=1#priere']);
  });
 }
 test(filename+' leaves the complete Salah entry unchanged',()=>{
  const {window,redirects}=browserAt('/'+dir);
  vm.runInNewContext(script,{window,URL});
  assert.deepEqual(redirects,[]);
 });
}

test('public Salah routes skip the member gate even when authentication and storage are unavailable',()=>{
 for(const suffix of ['salah','salah/','salah/index','salah/index.html','salah/decouverte','salah/decouverte.html']){
  const {window,redirects}=browserAt('/applications/'+suffix);
  vm.runInNewContext(gate,{window});
  assert.deepEqual(redirects,[]);
 }
});

test('the discovery fallback has a working free link when scripts are disabled',()=>{
 const fallback=fs.readFileSync(dir+'decouverte.html','utf8');
 assert.match(fallback,/href="\/applications\/salah\/">Ouvrir Kawaii Salah gratuitement/);
 assert.match(fallback,/<script src="salah-access\.js\?[^"]+" defer><\/script>/);
});
