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
async function publicOffers(products,failed=false,payBeforeAccount=false){
 const nodes=new Map();
 const node=()=>({hidden:false,textContent:'',classList:{add(){}},querySelector(){return node();}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const options=[1,2,3].map(limit=>{const strong=node(),small=node();return {dataset:{limit},querySelector:s=>s==='strong'?strong:small,strong,small};});
 const members=[node(),node()];
 const apple={payBeforeAccount,pending:async()=>({paid:false}),products:async()=>{if(failed)throw Error('offline');return {products};}};
 const box=vm.createContext({document:{getElementById:get,querySelectorAll:()=>options},window:{KMApple:apple},memberOnlyElements:members,subscriptionCard:node(),subscriptionIntro:node(),billingNote:node(),billingMessage:node()});
 const source=account.slice(account.indexOf('    const renderSignedOutOffer'),account.indexOf('    const load = async'));
 await vm.runInContext(source+'renderSignedOutOffer();',box);
 return {nodes,options,members,apple,billingMessage:box.billingMessage,retry:()=>vm.runInContext('renderSignedOutOffer();',box)};
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

test('pay-first Apple offers recover from unavailable prices without allowing unpaid signup',async()=>{
 for(const failure of [false,true]){
  const offer=await publicOffers([],failure,true);
  assert.ok(offer.options.every(option=>option.disabled));
  assert.equal(offer.nodes.get('createParentAccount').hidden,true);
  assert.equal(offer.nodes.get('appleOfferRecovery').hidden,false);
  assert.doesNotMatch(offer.billingMessage.textContent,/créer ton compte gratuitement/);
  offer.apple.products=async()=>({products:[{id:'com.kawaiimuslimworld.family1.monthly',price:'4,99 €'}]});
  await offer.retry();
  assert.equal(offer.options[0].disabled,false);
  assert.equal(offer.nodes.get('appleOfferRecovery').hidden,true);
  assert.equal(offer.nodes.get('createParentAccount').hidden,true);
 }
});
test('failure checking an existing Apple purchase allows a retry without another purchase',async()=>{
 const offer=await publicOffers([],false,true);
 offer.apple.pending=async()=>{throw Error('bridge offline')};
 await offer.retry();
 assert.equal(offer.nodes.get('appleOfferRecovery').hidden,false);
 assert.ok(offer.options.every(option=>option.disabled));
 offer.apple.pending=async()=>({paid:true});
 await offer.retry();
 assert.equal(offer.nodes.get('appleOfferRecovery').hidden,true);
 assert.equal(offer.nodes.get('planOptions').hidden,true);
 assert.equal(offer.nodes.get('createParentAccount').href,'Inscription.dc.html?apple_paid=1');
});
test('manual logout closes the web session even if the native bridge fails and can retry',async()=>{
 const stored=new Map([['km-active-profile-v2','parent']]);
 const storage={getItem:key=>stored.get(key),setItem:(key,item)=>stored.set(key,item),removeItem:key=>stored.delete(key)};
 let nativeClearCalls=0,webSignouts=0,offline=true;
 const window={location:new URL('https://example.test/Compte.dc.html'),
  KM_CONFIG:{supabaseUrl:'https://example.test',supabaseAnonKey:'test'},
  KMApple:{clear:async()=>{nativeClearCalls++;if(offline)throw Error('bridge offline')}},
  supabase:{createClient:()=>({auth:{signOut:async()=>{webSignouts++;return {}}}})}};
 vm.runInNewContext(readFileSync(new URL('../km-auth.js',import.meta.url),'utf8'),{URLSearchParams,URL,window,localStorage:storage,sessionStorage:storage});
 const {applePending}=await window.KMAuth.logout();
 assert.equal(applePending,true);assert.equal(webSignouts,1);assert.equal(stored.has('km-active-profile-v2'),false);
 assert.equal(window.KMAuth.hasPendingAppleLogout(),true);
 offline=false;await window.KMAuth.clearNativeSession();
 assert.equal(window.KMAuth.hasPendingAppleLogout(),false);assert.equal(nativeClearCalls,2);
});
test('web signup shows real trial terms before submission, and links to the published notices',()=>{
 const html=readFileSync(new URL('../Inscription.dc.html',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="signupBillingNote"')<html.indexOf('id="submitButton"'));
 assert.ok(html.indexOf('id="webOfferTerms"')<html.indexOf('id="submitButton"'));
 assert.match(html,/href="presentation.html#tarifs"/);
 assert.match(html,/href="Confidentialite.dc.html"/);
 assert.match(html,/apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula/);
});

test('leaving login opens the guest library without requiring a session, or the public parent offers',()=>{
 assert.match(login,/id="backFromLogin"[^>]*>← Retour à la découverte<\/a>/);
 const guestHref=login.match(/id="backFromLogin" href="([^"]+)"/)[1].replaceAll('&amp;','&');
 const start=login.indexOf('    if (parentDestination || loginParams');
 const block=login.slice(start,login.indexOf('    document.getElementById("forgotPassword")',start));
 const back={href:guestHref,querySelector:()=>({})};
 vm.runInNewContext(block,{parentDestination:false,loginParams:new URLSearchParams(),document:{getElementById:()=>back}});
 const target=new URL(back.href,'https://example.test');
 assert.equal(target.searchParams.get('section'),'library');
 assert.equal(target.searchParams.get('guest'),'1');
 const entry=readFileSync(new URL('../km-app-shell-entry.js',import.meta.url),'utf8');
 const storage=new Map();const sessionStorage={getItem:key=>storage.get(key),setItem:(key,val)=>storage.set(key,val)};
 const hop={href:target.href,pathname:target.pathname,search:target.search,hash:'',replace:url=>hop.next=url};
 vm.runInNewContext(entry,{window:{webkit:{messageHandlers:{kmShell:{}}}},location:hop,URL,URLSearchParams,sessionStorage});
 const window={location:new URL(hop.next)};
 const gate=readFileSync(new URL('../km-access-gate.js',import.meta.url),'utf8');
 vm.runInNewContext(gate,{window,URL,URLSearchParams,sessionStorage,document:{documentElement:{}}});
 assert.equal(window.KM_GUEST_MODE,true);
 vm.runInNewContext(block,{parentDestination:true,loginParams:new URLSearchParams('reason=parent&next=https://unrelated.invalid'),document:{getElementById:()=>back}});
 assert.equal(back.href,'Compte.dc.html');
});
