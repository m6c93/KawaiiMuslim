import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {immediateDeletionAvailable} from '../supabase/functions/delete-account/release.mjs';
import {DeletionError} from '../supabase/functions/delete-account/core.mjs';
const path=new URL('../supabase/functions/delete-account/index.ts',import.meta.url);
const source=stripTypeScriptTypes(readFileSync(path,'utf8').replace(/^import .*;\n/gm,''));
for(const signedIn of [true,false]) for(const method of ['GET','POST']) {
 test(`${method}: release gate protects ${signedIn?'authenticated':'anonymous'} caller`,async()=>{
  let handler,coreCalls=0,clients=0,bodyReads=0;
  vm.runInNewContext(source,{Deno:{env:{get:()=>''},serve:fn=>handler=fn},Response,
   sharedCorsHeaders:{},jsonResponse:(body,status=200)=>new Response(JSON.stringify(body),{status}),
   createClient:()=>{clients++;assert.equal(clients,1,'No admin client while release is closed');return {auth:{getUser:async()=>({data:{user:signedIn?{id:'parent'}:null}})}};},
   immediateDeletionAvailable,DeletionError,
   deleteFamilyAccount:async()=>{coreCalls++;throw Error('must not run');}});
  const response=await handler({method,headers:new Headers(),json:async()=>{bodyReads++;return {force:true,enabled:true}}});
  assert.equal(response.status,!signedIn?401:method==='GET'?200:409);
  if(signedIn&&method==='GET') assert.equal((await response.json()).immediateDeletion,false);
  assert.equal(coreCalls,0);assert.equal(bodyReads,0);
 });
}
test('unavailable backend capability leaves the manual route available',async()=>{
 const source=readFileSync(new URL('../km-auth.js',import.meta.url),'utf8');
 for(const result of [{error:new Error('old endpoint')},{data:{immediateDeletion:false}},null]){
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'parent'}}}})},functions:{invoke:async()=>{if(result===null)throw Error('network');return result;}}};
  const window={KM_CONFIG:{supabaseUrl:'https://test.invalid',supabaseAnonKey:'fake'},supabase:{createClient:()=>client},location:{pathname:'/Compte.dc.html',hostname:'test.invalid',search:''}};
  vm.runInNewContext(source,{window,URL,URLSearchParams,console});
  assert.equal(await window.KMAuth.isImmediateDeletionAvailable(),false);
 }
 const html=readFileSync(new URL('../Compte.dc.html',import.meta.url),'utf8');
 assert.match(html, /id="deletionForm"/);assert.match(html,/account-deletion\.js\?v=2/);
});
