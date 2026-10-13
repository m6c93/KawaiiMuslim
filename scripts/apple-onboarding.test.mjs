import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const parent='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('payment before account never signs up, uses Stripe, or advances on cancellation/pending/failure',async()=>{
 const script=await readFile(new URL('../km-auth.js',import.meta.url),'utf8');let result,fail=false;const nav=[];
 const window={KMApple:{payBeforeAccount:true,purchaseFirst:async()=>{if(fail)throw Error('offline');return result;}},location:{assign:x=>nav.push(x),pathname:"/Compte.dc.html",hostname:"example.invalid",search:""}};
 vm.runInNewContext(script,{window,console,document:{},URL,URLSearchParams,setTimeout,clearTimeout,localStorage:{}});
 for(const value of [{cancelled:true},{pending:true},{paid:false}]){result=value;await assert.rejects(window.KMAuth.startAppleSignup('family_1_child'));assert.equal(nav.length,0);}
 fail=true;await assert.rejects(window.KMAuth.startAppleSignup('family_1_child'));assert.equal(nav.length,0);fail=false;
 await assert.rejects(window.KMAuth.startAppleSignup('invalid'));result={paid:true};await window.KMAuth.startAppleSignup('family_1_child');assert.deepEqual(nav,['Inscription.dc.html?apple_paid=1']);
});
test('reservation creates no access; authenticated clients cannot read secrets or claim purchases',async()=>{
 const {PGlite}=await import(process.env.PGLITE_MODULE);const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table public.profiles(id uuid primary key,role text,is_active boolean);
 create table public.child_profiles(id uuid primary key default gen_random_uuid(),parent_id uuid references public.profiles(id));
 create table public.subscriptions(user_id uuid,plan_code text,child_limit smallint,status text,cancel_at_period_end boolean,current_period_end timestamptz,price_id text);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
 create function public.can_manage_content() returns boolean language sql as $$select false$$;
 insert into profiles values('${parent}','parent',true),('${other}','parent',true);insert into storage.objects(bucket_id) values('content-books');`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261010170000_apple_subscriptions.sql',import.meta.url),'utf8'));

 await db.exec(await readFile(new URL('../supabase/migrations/20261013150000_apple_purchase_before_account.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261013153000_protect_existing_apple_account_tokens.sql',import.meta.url),'utf8'));
 const token='33333333-3333-4333-8333-333333333333',secret='a'.repeat(64);
 const reserve=(id=token,hash=secret)=>db.query('select reserve_apple_purchase($1,$2,$3)',[id,hash,'source']);
 const entitlement={user_id:parent,original_transaction_id:'onboard',transaction_id:'t',environment:'Production',product_id:'com.kawaiimuslimworld.family1.monthly',child_limit:1,apple_status:1,expires_at:new Date(Date.now()+3600000).toISOString(),signed_at:new Date().toISOString()};
 const claim=(hash=secret,owner=parent,payload=entitlement)=>db.query('select claim_apple_purchase($1,$2,$3,$4::jsonb)',[token,hash,owner,JSON.stringify(payload)]);
 try {
 await assert.rejects(reserve(parent),/existing parent/);
 await reserve();await reserve();assert.equal((await db.query('select * from apple_subscriptions')).rows.length,0);
 await assert.rejects(reserve(token,'b'.repeat(64)),/mismatch/);
 await assert.rejects(claim('b'.repeat(64)),/proof invalid/);
 await claim();await claim();assert.equal((await db.query('select * from apple_subscriptions')).rows[0].user_id,parent);
 await assert.rejects(claim(secret,other,{...entitlement,user_id:other}),/already assigned/);
 await assert.rejects(claim(secret,parent,{...entitlement,original_transaction_id:'other'}),/Transaction mismatch/);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from apple_purchase_reservations'),/permission denied/);await assert.rejects(claim(),/permission denied/);await db.exec('reset role');
 for(let i=0;i<4;i++)await reserve(`44444444-4444-4444-8444-44444444444${i}`);
 await assert.rejects(reserve('44444444-4444-4444-8444-444444444449'),/rate limit/);
 } finally {await db.close();}
});
test('signed-out recovery resumes paid setup or requests the original parent account without starting another purchase',async()=>{
 const html=await readFile(new URL('../Compte.dc.html',import.meta.url),'utf8');
 const source=html.slice(html.indexOf('    document.getElementById("restoreApple").addEventListener'),html.indexOf('    const billingResult'));
 for(const paid of [true,false]){
  let handler,destination;const button={disabled:false};
  vm.runInNewContext(source,{context:null,document:{getElementById:()=>({addEventListener:(_,fn)=>handler=fn})},window:{KMApple:{payBeforeAccount:true,pending:async()=>({paid})},location:{assign:x=>destination=x}},billingMessage:{},KMAuth:{restoreApplePurchases:async()=>{throw Error('Unexpected restore');},friendlyError:e=>e.message}});
  await handler({currentTarget:button});assert.equal(button.disabled,false);
  assert.equal(destination,paid?'Inscription.dc.html?apple_paid=1':'Connexion.dc.html?reason=parent&next=%2FCompte.dc.html');
 }
});
