const {test}=require('node:test');const assert=require('node:assert/strict');
const handler=require('../api/aya');
const crypto=require('node:crypto');
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},send(v){this.body=v;return this}}}
const req=(resource='access',token='Bearer valid')=>({method:'POST',url:'/api/aya',query:{resource},headers:{authorization:token}});
function mock(status='active',active=true){return async url=>Response.json(url.includes('/auth/')?{id:'b79a0ca0-5381-44b3-b169-24a7acd26b90'}:url.includes('/profiles?')?[{is_active:active}]:[{status}])}
test('only real active/trial subscriptions authorize and no key is returned',async t=>{
 process.env.AYA_PRODUCTION_MEDIA_KEY='8'.repeat(64);
 for(const [status,active,code] of [['active',true,200],['trialing',true,200],['past_due',true,403],['canceled',true,403],['active',false,403]]){
  t.mock.method(globalThis,'fetch',mock(status,active));const res=response();await handler(req(),res);assert.equal(res.code,code);assert.equal(res.body.key,undefined);
 }
});
test('guest, invalid topic and invalid token fail closed',async t=>{
 for(const [request,code] of [[req('media/jours',''),401],[req('media/../../foo'),404],[{...req(),method:'GET'},405]]){const res=response();await handler(request,res);assert.equal(res.code,code)}
 t.mock.method(globalThis,'fetch',async()=>new Response('',{status:401}));const res=response();await handler(req(),res);assert.equal(res.code,401);
});
