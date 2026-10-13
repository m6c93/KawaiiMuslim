import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../km-auth.js',import.meta.url),'utf8');
async function signup(native,planCode='family_2_children'){
 let request;
 const window={KM_CONFIG:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'test'},location:{origin:'https://www.kawaiimuslimworld.com',pathname:'/Inscription.dc.html',hostname:'www.kawaiimuslimworld.com',search:''},supabase:{createClient:()=>({auth:{signUp:async body=>{request=body;return {data:{user:{id:'new-parent'},session:null}};}}})}};
 if(native)window.KMApple={};
 vm.runInNewContext(source,{window,localStorage:{},document:{},console,setTimeout,clearTimeout,URL,URLSearchParams});
 await window.KMAuth.signup({name:' Parent ',email:' Parent@example.com ',password:'test-password',planCode});
 return request;
}
test('native sign-up confirmation opens parent login without website checkout metadata',async()=>{
 const r=await signup(true);
 assert.equal(r.email,'parent@example.com');
 assert.equal(r.options.data.full_name,'Parent');
 assert.equal('pending_plan_code' in r.options.data,false);
 const destination=new URL(r.options.emailRedirectTo);
 assert.equal(destination.pathname,'/Connexion.dc.html');
 assert.equal(destination.searchParams.get('next'),'/Compte.dc.html');
 assert.equal(destination.searchParams.has('checkout_plan'),false);
});
test('website sign-up retains its selected plan and confirmation checkout destination',async()=>{
 const r=await signup(false);
 assert.equal(r.options.data.pending_plan_code,'family_2_children');
 const destination=new URL(r.options.emailRedirectTo);
 assert.equal(destination.pathname,'/Profils.dc.html');
 assert.equal(destination.searchParams.get('checkout_plan'),'family_2_children');
});
test('invalid website plan cannot be injected into confirmation URL',async()=>{
 const r=await signup(false,'https://example.com');
 assert.equal('pending_plan_code' in r.options.data,false);
 assert.equal(new URL(r.options.emailRedirectTo).search,'');
});
