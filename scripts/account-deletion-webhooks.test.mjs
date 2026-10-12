import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync} from 'node:fs';
const script=name=>stripTypeScriptTypes(readFileSync(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
for(const state of ['absent','active_parent','database-error','invalid-signature']) {
 test(`signed Apple notification: ${state}`,async()=>{
  let handler,lookup=0,saves=0,current=0;
  const admin={rpc:async name=>{if(name==='billing_owner_state'){lookup++;return state==='database-error'?{error:new Error('offline')}:{data:state};}saves++;return {};},
    from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:'parent'}})})})})};
  vm.runInNewContext(script('apple-notifications'),{Deno:{env:{get:()=>''},serve:fn=>handler=fn},
    createClient:()=>admin,Environment:{PRODUCTION:'Production',SANDBOX:'Sandbox'},
    readAppleBody:async()=>({signedPayload:'fixture'}),permitsSandbox:()=>true,
    appleServices:()=>({verifier:{verifyAndDecodeNotification:async()=>{if(state==='invalid-signature')throw Error('invalid');return {data:{signedTransactionInfo:'signed'}};},
      verifyAndDecodeTransaction:async()=>({appAccountToken:'owner',originalTransactionId:'transaction'})}}),
    currentAppleEntitlement:async()=>{current++;return {};},
    jsonResponse:(body,status=200)=>new Response(JSON.stringify(body),{status}),console:{error(){}}});
  const response=await handler({method:'POST'});
  assert.equal(response.status,['absent','active_parent'].includes(state)?200:422);
  assert.equal(saves,state==='active_parent'?1:0);
  assert.equal(current,state==='active_parent'?1:0);
  assert.equal(lookup,state==='invalid-signature'?0:1);
 });
 test(`signed Stripe webhook: ${state}`,async()=>{
  let handler,saves=0,lookup=0;
  const event={type:'customer.subscription.updated',data:{object:{id:'sub',customer:'cus',metadata:{supabase_user_id:'owner'},items:{data:[{price:{id:'price'}}]},status:'active'}}};
  class Stripe {
   constructor(){this.webhooks={constructEventAsync:async()=>{if(state==='invalid-signature')throw Error('invalid');return event;}};}
   static createSubtleCryptoProvider() { return {}; }
  }
  const admin={rpc:async()=>{lookup++;return state==='database-error'?{error:new Error('offline')}:{data:state};},
    from:()=>({upsert:async()=>{saves++;return {};},update:()=>({eq:async()=>({})})})};
  vm.runInNewContext(script('stripe-webhook'),{Stripe,Deno:{env:{get:()=>''},serve:fn=>handler=fn},
    createClient:()=>admin,Response,console:{error(){}},planFromPrice:()=>({planCode:'family_1_child',childLimit:1})});
  const response=await handler(new Request('https://fake.invalid',{method:'POST',headers:{'stripe-signature':'fixture'},body:'{}'}));
  assert.equal(response.status,state==='invalid-signature'?400:state==='database-error'?500:200);
  assert.equal(saves,state==='active_parent'?1:0);
  assert.equal(lookup,state==='invalid-signature'?0:1);
 });
}
