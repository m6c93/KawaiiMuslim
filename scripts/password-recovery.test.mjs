import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const authSource=await readFile(new URL('../km-auth.js',import.meta.url),'utf8');
function authMock({recovery=false,session={access_token:'recovery-token',user:{id:'parent'}},user={id:'parent',email:'test@example.invalid'}}={}){
 let unsubscribed=false,updates=0,redirect;const auth={onAuthStateChange:fn=>{if(recovery)fn('PASSWORD_RECOVERY');return {data:{subscription:{unsubscribe(){unsubscribed=true;}}}};},getSession:async()=>({data:{session}}),getUser:async()=>({data:{user}}),updateUser:async()=>{updates++;return {data:{user}};},resetPasswordForEmail:async(email,options)=>{redirect=options.redirectTo;return {data:{}};}};
 const window={KM_CONFIG:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'},supabase:{createClient:()=>({auth})},location:{origin:'https://www.kawaiimuslimworld.com',pathname:'/Reinitialiser-mot-de-passe.dc.html',hostname:'www.kawaiimuslimworld.com',search:''}};
 vm.runInNewContext(authSource,{window,document:{},localStorage:{},URL,URLSearchParams,console,setTimeout,clearTimeout});
 return {api:window.KMAuth,get unsubscribed(){return unsubscribed;},get updates(){return updates;},get redirect(){return redirect;}};
}
test('password recovery rejects an unrelated existing session and expired links without changing a password',async()=>{
 for(const options of [{},{session:null},{user:{id:'another'}}]){
  const r=authMock(options);await assert.rejects(r.api.getPasswordRecoverySession(options.user?'recovery-token':null));assert.equal(r.updates,0);assert.equal(r.unsubscribed,true);
 }
});
test('validated recovery token and SDK recovery event both allow the correct account',async()=>{
 for(const recovery of [false,true]){
  const r=authMock({recovery});assert.equal((await r.api.getPasswordRecoverySession(recovery?null:'recovery-token')).user.id,'parent');assert.equal(r.unsubscribed,true);assert.equal(r.updates,0);
 }
});
test('new mail links use the dedicated reset page and short passwords never reach the server',async()=>{
 const r=authMock();await r.api.resetPassword('test@example.invalid');assert.equal(r.redirect,'https://www.kawaiimuslimworld.com/Reinitialiser-mot-de-passe.dc.html');await assert.rejects(r.api.updatePassword('short'));assert.equal(r.updates,0);
});
test('old reset links preserve recovery fragment but never automatically enter profiles or checkout',async()=>{
 const html=await readFile(new URL('../Connexion.dc.html',import.meta.url),'utf8');const script=html.match(/<script>\s*\(\(\) => \{[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g,'');let destination;
 const location={origin:'https://www.kawaiimuslimworld.com',search:'?reset=1',hash:'#access_token=synthetic&type=recovery',replace:x=>destination=x};const window={};
 vm.runInNewContext(script,{location,window,URL,URLSearchParams});assert.equal(window.__kmPasswordRecoveryRedirect,true);assert.equal(destination,'/Reinitialiser-mot-de-passe.dc.html#access_token=synthetic&type=recovery');
});
