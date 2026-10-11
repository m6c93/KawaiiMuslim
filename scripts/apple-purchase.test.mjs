import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {entitlementFromApple,APPLE_PRODUCTS} from '../supabase/functions/apple-purchase/core.mjs';
const parent='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const now=Date.now();
const receipt={appAccountToken:parent,bundleId:'com.kawaiimuslimworld.ios',environment:'Production',type:'Auto-Renewable Subscription',productId:Object.keys(APPLE_PRODUCTS)[0],transactionId:'t1',originalTransactionId:'o1',signedDate:now,expiresDate:now+86400000};
test('verified entitlement validation rejects wrong account, app, environment, product and invalid dates',()=>{
 for(const patch of [{appAccountToken:other},{bundleId:'other'},{environment:'Sandbox'},{productId:'other'},{isUpgraded:true},{type:'Consumable'},{expiresDate:NaN},{signedDate:now+120000},{transactionId:null}]) assert.throws(()=>entitlementFromApple({...receipt,...patch},parent,'Production',now));
 assert.throws(()=>entitlementFromApple(receipt,parent,'Production',now,999));
 for(const [product,limit] of Object.entries(APPLE_PRODUCTS)) assert.equal(entitlementFromApple({...receipt,productId:product},parent,'Production',now).child_limit,limit);
 assert.equal(entitlementFromApple({...receipt,revocationDate:now},parent,'Production',now,5).apple_status,5);
});

test('Apple billing does not use Stripe or unlock after cancellation, pending purchase or backend failure',async()=>{
 const script=await readFile(new URL('../km-auth.js',import.meta.url),'utf8');
 let result, subscription=null, fail, stripeCalls=0;const navigation=[];
 const session={user:{id:parent},access_token:'test-token'};
 const client={auth:{getSession:async()=>({data:{session}}),updateUser:async()=>({data:{}})},rpc:()=>({maybeSingle:async()=>({data:subscription})}),functions:{invoke:async()=>{stripeCalls++;return {data:{url:'https://checkout.stripe.test/session'}};}}};
 const window={KM_CONFIG:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'test'},supabase:{createClient:()=>client},location:{assign:url=>navigation.push(url),origin:'https://example.invalid',href:'https://example.invalid',pathname:'/Compte.dc.html',hostname:'example.invalid',search:''},KMApple:{purchase:async data=>{assert.equal(data.userID,parent);assert.equal(data.accessToken,'test-token');if(fail)throw new Error('server failed');return result;},restore:async()=>({active:true}),manage:async()=>({ok:true})}};
 const context={window,localStorage:{removeItem(){}},console,URL,URLSearchParams,setTimeout,clearTimeout,document:{}};
 vm.runInNewContext(script,context);
 for(const value of [{cancelled:true},{pending:true},{verified:true,active:false}]) {result=value;await assert.rejects(window.KMAuth.startCheckout('family_1_child'));assert.equal(navigation.length,0);}
 fail=true;await assert.rejects(window.KMAuth.startCheckout('family_1_child'));assert.equal(navigation.length,0);fail=false;
 subscription={provider:'stripe',status:'active'};await assert.rejects(window.KMAuth.startCheckout('family_1_child'),/déjà actif/);subscription=null;
 result={verified:true,active:true};await window.KMAuth.startCheckout('family_1_child');assert.deepEqual(navigation,['Profils.dc.html']);assert.equal(stripeCalls,0);
 assert.equal((await window.KMAuth.restoreApplePurchases()).active,true);
 delete window.KMApple;await window.KMAuth.startCheckout('family_1_child');assert.equal(stripeCalls,1);assert.equal(navigation.at(-1),'https://checkout.stripe.test/session');
});

test('PostgreSQL Apple entitlements, ownership, expiry, child limits and RLS',async t=>{
 const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
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
 await db.exec('create trigger child_limit before insert on child_profiles for each row execute function enforce_child_profile_limit()');
 const payload=entitlementFromApple({...receipt,productId:Object.keys(APPLE_PRODUCTS)[2]},parent,'Production',now);
 const save=p=>db.query('select save_verified_apple_subscription($1::jsonb)',[JSON.stringify(p)]);
 const claims=async id=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');};
 try {
 await save(payload);
 await t.test('own read and private book access; another parent cannot read or write purchases',async()=>{
 await claims(parent);assert.equal((await db.query('select * from get_family_subscription()')).rows[0].child_limit,3);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await assert.rejects(save(payload),/permission denied/);await assert.rejects(db.query('delete from apple_subscriptions'),/permission denied/);
 await claims(other);assert.equal((await db.query('select * from apple_subscriptions')).rows.length,0);assert.equal((await db.query('select * from get_family_subscription()')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 });
 await db.exec('reset role');
 await t.test('ownership transfer and stale receipt cannot overwrite an entitlement',async()=>{
 await assert.rejects(save({...payload,user_id:other}),/owner mismatch/);
 await assert.rejects(save({...payload,signed_at:new Date(now-1000).toISOString()}),/stale transaction/);
 });
 await t.test('three child profiles allowed, fourth denied',async()=>{
 for(let n=0;n<3;n++) await db.query('insert into child_profiles(parent_id) values($1)',[parent]);
 await assert.rejects(db.query('insert into child_profiles(parent_id) values($1)',[parent]),/maximum 3/);
 });
 await t.test('revoked and expired Apple purchases do not grant access; active Stripe remains valid',async()=>{
 await save({...payload,apple_status:5});await claims(parent);assert.equal((await db.query('select * from get_family_subscription()')).rows.length,0);
 await db.exec('reset role');await save({...payload,expires_at:new Date(now-1000).toISOString()});await claims(parent);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await db.exec('reset role');await db.query("insert into subscriptions values($1,'family_2_children',2,'active',false,now()+interval '1 month','stripeprice')",[parent]);await claims(parent);assert.equal((await db.query('select * from get_family_subscription()')).rows[0].provider,'stripe');
 await db.exec('reset role');await db.query('update profiles set is_active=false where id=$1',[parent]);await claims(parent);assert.equal((await db.query('select * from get_family_subscription()')).rows.length,0);
 });
 } finally {await db.close();}
});
