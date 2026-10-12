import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const auth = readFileSync(new URL('../km-auth.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../Compte.dc.html', import.meta.url), 'utf8');
for (const native of [false, true]) for (const provider of ['apple', 'stripe']) {
  test(`management routes ${provider} correctly on ${native ? 'native' : 'web'}`, async () => {
    let stripe = 0, apple = 0; const destinations = [];
    const client = {auth:{getSession:async()=>({data:{session:{user:{id:'parent-A'}}}})},
      rpc:()=>({maybeSingle:async()=>({data:{provider}})}),
      functions:{invoke:async()=>{stripe++;return {data:{url:'https://stripe.invalid/portal'}};}}};
    const window = {KM_CONFIG:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'fake'},supabase:{createClient:()=>client},
      location:{pathname:'/Compte.dc.html',hostname:'example.invalid',search:'',assign:url=>destinations.push(url)}};
    if (native) window.KMApple = {manage:async()=>{apple++;}};
    vm.runInNewContext(auth,{window,URL,URLSearchParams,console});
    if (native && provider === 'stripe') {
      await assert.rejects(window.KMAuth.openBillingPortal(), /sur le site/);
    } else await window.KMAuth.openBillingPortal();
    assert.equal(apple, native && provider === 'apple' ? 1 : 0);
    assert.equal(stripe, !native && provider === 'stripe' ? 1 : 0);
    if (!native) assert.equal(destinations[0],provider === 'apple' ? 'https://apps.apple.com/account/subscriptions/' : 'https://stripe.invalid/portal');
  });
}
function dialogFixture(failure = false) {
  const nodes = new Map(); let calls = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id,{id,hidden:false,value:'fictional-password',checked:true,disabled:false,
      textContent:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},
      reset(){},reportValidity(){return true;},showModal(){},close(){},appendChild(){},focus(){}});
    return nodes.get(id);
  };
  const notice = node('deleteAccountAppleNotice');
  const oldParagraph = node('otherParagraph');
  node('deleteAccountDialog').querySelectorAll = () => [notice,oldParagraph];
  const source = html.slice(html.indexOf('    const deletionDialog ='),html.indexOf('    load().catch'));
  vm.runInNewContext(source,{document:{getElementById:node,createElement:()=>({})},window:{},
    KMAuth:{getMFAStatus:async()=>({nextLevel:'aal1'}),deleteAccount:async input=>{
      calls++;assert.equal(input.appleSubscriptionAcknowledged,true);
      if(failure)throw new Error('Service unavailable');return {deleted:true};
    }}});
  return {node,notice,oldParagraph,calls:()=>calls};
}
test('successful deletion keeps Apple warning visible and prevents a second deletion', async () => {
  const f = dialogFixture();
  await f.node('deleteAccountForm').listeners.submit({preventDefault(){}});
  assert.equal(f.calls(),1);
  assert.equal(f.notice.hidden,false);
  assert.equal(f.oldParagraph.hidden,true);
  assert.equal(f.node('deleteAccountForm').hidden,true);
  assert.equal(f.node('openAccountDeletion').disabled,true);
  assert.equal(f.node('deleteAccountTitle').textContent,'Ton compte est supprimé');
});
test('failed deletion never claims success or hides the Apple warning', async () => {
  const f = dialogFixture(true);
  await f.node('deleteAccountForm').listeners.submit({preventDefault(){}});
  assert.equal(f.notice.hidden,false);
  assert.equal(f.node('deleteAccountForm').hidden,false);
  assert.equal(f.node('deleteAccountMessage').textContent,'Service unavailable');
  assert.equal(f.node('deleteAccountPassword').value,'');
});
test('dialog requires Apple acknowledgement and preserves the legacy deep link', () => {
  assert.match(html, /id="deleteAccountAppleAcknowledged"[^>]*required/);
  assert.match(html, /id="suppression-compte"/);
  assert.match(html, /La facturation Apple continue/);
});
test('a mixed-provider parent can manage Stripe separately from the selected Apple entitlement',async()=>{
 let stripe=0;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'parent'}}}})},
  rpc:()=>({maybeSingle:async()=>({data:{provider:'apple'}})}),
  functions:{invoke:async name=>{assert.equal(name,'create-portal-session');stripe++;return {data:{url:'https://stripe.invalid/portal'}};}}};
 const destinations=[];
 const window={KM_CONFIG:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'fake'},supabase:{createClient:()=>client},location:{pathname:'/Compte.dc.html',hostname:'example.invalid',search:'',assign:url=>destinations.push(url)}};
 vm.runInNewContext(auth,{window,URL,URLSearchParams,console});
 await window.KMAuth.openStripeBillingPortal();
 assert.equal(stripe,1);assert.equal(destinations[0],'https://stripe.invalid/portal');
});
