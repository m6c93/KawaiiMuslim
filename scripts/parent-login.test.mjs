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
 const sandbox=vm.createContext({window,message,URL,URLSearchParams,sessionStorage:{removeItem:k=>stored.delete(k),setItem:(k,v)=>stored.set(k,v)},KMAuth:{completeAppleSignup:async()=>false,getContext:async()=>signedIn?{profile:{role}}:null}});
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
const account=readFileSync(new URL('../Compte.dc.html',import.meta.url),'utf8');
test('signed-out parent stays on offers without loading private account data',async()=>{
 const prefix=account.slice(account.indexOf('    const load = async () => {'),account.indexOf('      document.querySelectorAll("[data-auth-only]")'));
 let rendered=0;
 const box=vm.createContext({KMAuth:{completeAppleSignup:async()=>false,getContext:async()=>null},renderSignedOutOffer:async()=>{rendered++;}});
 await vm.runInContext(prefix+'}; load();',box);
 assert.equal(rendered,1);
});
async function publicOffers(products,failed=false){
 const nodes=new Map();
 const node=()=>({hidden:false,textContent:'',classList:{add(){}},querySelector(){return node();}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const options=[1,2,3].map(limit=>{const strong=node(),small=node();return {dataset:{limit},querySelector:s=>s==='strong'?strong:small,strong,small};});
 const members=[node(),node()];
 const box=vm.createContext({document:{getElementById:get,querySelectorAll:()=>options},window:{KMApple:{products:async()=>{if(failed)throw Error('offline');return {products};}}},memberOnlyElements:members,subscriptionCard:node(),subscriptionIntro:node(),billingNote:node(),billingMessage:node()});
 const source=account.slice(account.indexOf('    const renderSignedOutOffer'),account.indexOf('    const load = async'));
 await vm.runInContext(source+'renderSignedOutOffer();',box);
 return {nodes,options,members};
}
test('public native offers show Apple prices and free sign-up, with private views hidden',async()=>{
 const r=await publicOffers([{id:'com.kawaiimuslimworld.family1.monthly',price:'4,99 €'}]);
 assert.equal(r.nodes.get('logout').hidden,true);
 assert.equal(r.nodes.get('parentWelcome').hidden,false);
 assert.match(r.nodes.get('createParentAccount').textContent,/gratuitement/);
 assert.ok(r.members.every(item=>item.hidden));
 assert.equal(r.options[0].strong.textContent,'4,99 €');
 assert.equal(r.options[0].disabled,false);
 assert.equal(r.options[1].disabled,true);
});
test('unavailable Apple products never display fabricated prices',async()=>{
 const r=await publicOffers([],true);
 assert.ok(r.options.every(item=>item.disabled&&item.strong.textContent==='Indisponible'));
});
test('anonymous plan selection goes to account creation and never starts checkout',async()=>{
 const start=account.indexOf('      const option = event.target.closest("[data-plan]")');
 const end=account.indexOf('      const buttons',start);
 let destination;
 const box=vm.createContext({context:null,event:{target:{closest:()=>({dataset:{plan:'family_2_children'}})}},window:{location:{assign:url=>{destination=url;}}},encodeURIComponent});
 await vm.runInContext('(async()=>{'+account.slice(start,end)+'})()',box);
 assert.equal(destination,'Inscription.dc.html?plan=family_2_children');
});
