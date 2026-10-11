import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const login=readFileSync(new URL('../Connexion.dc.html',import.meta.url),'utf8');
const source=login.slice(login.indexOf('    const loginParams'),login.indexOf('    document.getElementById("togglePassword")'));
async function run(next,role='parent',signedIn=true){
 const stored=new Map([['km-guest-mode','1']]);
 const window={location:{origin:'https://www.kawaiimuslimworld.com',search:'?reason=parent&next='+encodeURIComponent(next),replace(url){this.href=url;}}};
 const message={textContent:''};
 const sandbox=vm.createContext({window,message,URL,URLSearchParams,sessionStorage:{removeItem:k=>stored.delete(k),setItem:(k,v)=>stored.set(k,v)},KMAuth:{getContext:async()=>signedIn?{profile:{role}}:null}});
 vm.runInContext(source,sandbox);
 await vm.runInContext('continueAfterAuthentication()',sandbox);
 return {window,stored,message};
}
test('parent sign-in resumes the subscription page including its query',async()=>{
 const r=await run('/Compte.dc.html?abonnement=requis');
 assert.equal(r.window.location.href,'/Compte.dc.html?abonnement=requis');
 assert.equal(r.stored.has('km-after-profile'),false);
 assert.equal(r.stored.has('km-guest-mode'),false);
 assert.match(r.message.textContent,/Connecte-toi/);
});
test('administrator still passes through MFA before any requested parent page',async()=>{
 const r=await run('/Compte.dc.html','admin');
 assert.equal(r.window.location.href,'MFA.dc.html?next=%2FChoisir-administration.dc.html');
});
test('external and backslash destinations cannot escape the site',async()=>{
 for(const next of ['//example.com/Compte.dc.html','/\\example.com/Compte.dc.html','https://example.com/']){
  const r=await run(next);assert.equal(r.window.location.href,'Profils.dc.html');
  assert.equal(r.stored.get('km-after-profile'),'Aujourd%27hui.dc.html');
 }
});
test('missing session does not continue as an authenticated parent',async()=>{
 await assert.rejects(run('/Compte.dc.html','parent',false),/Connecte-toi/);
});
test('opening account without session preserves the destination for login',async()=>{
 const account=readFileSync(new URL('../Compte.dc.html',import.meta.url),'utf8');
 const prefix=account.slice(account.indexOf('    const load = async () => {'),account.indexOf('      document.getElementById("hello")'));
 const location={pathname:'/Compte.dc.html',search:'?abonnement=requis',replace(url){this.href=url;}};
 const box=vm.createContext({window:{location},KMAuth:{getContext:async()=>null}});
 await vm.runInContext(prefix+'}; load();',box);
 const url=new URL(location.href,'https://www.kawaiimuslimworld.com/');
 assert.equal(url.pathname,'/Connexion.dc.html');
 assert.equal(url.searchParams.get('next'),'/Compte.dc.html?abonnement=requis');
 assert.equal(url.searchParams.get('reason'),'parent');
});
