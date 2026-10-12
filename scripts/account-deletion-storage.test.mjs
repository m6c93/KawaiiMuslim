import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
test('billing owner state and surviving-JWT storage isolation (real safety migration)',async t=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
   create table auth.users(id uuid primary key);
   create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,role text,is_active boolean);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   grant usage on schema auth,storage to authenticated;grant select on profiles to authenticated;
   create table storage.objects(name text,bucket_id text);alter table storage.objects enable row level security;
   grant select,insert,update,delete on storage.objects to authenticated;
   create policy old_owner_prefix on storage.objects for all to authenticated using(split_part(name,'/',1)=auth.uid()::text) with check(split_part(name,'/',1)=auth.uid()::text);
   insert into auth.users values('${a}'),('${b}');insert into profiles values('${a}','parent',true),('${b}','parent',true);
   insert into storage.objects values('${a}/child/art.png','child-artworks'),('${b}/child/art.png','child-artworks');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261012102000_account_deletion_safety.sql',import.meta.url),'utf8'));
  const asParent=async id=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');};
  await t.test('active parent keeps own access, other family remains private',async()=>{
   await asParent(a);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
   await assert.rejects(db.query("insert into storage.objects values($1,'child-artworks')",[b+'/foreign.png']),/row-level security/);
  });
  await t.test('authenticated clients cannot probe Auth existence through billing RPC',async()=>{
   await assert.rejects(db.query('select billing_owner_state($1)',[a]),/permission denied/);
  });
  await t.test('service differentiates active, restricted, broken and absent owners',async()=>{
   await db.exec('reset role');
   const state=async()=> (await db.query('select billing_owner_state($1) as state',[a])).rows[0].state;
   assert.equal(await state(),'active_parent');
   await db.query('update profiles set is_active=false where id=$1',[a]);assert.equal(await state(),'restricted');
   await db.query('delete from profiles where id=$1',[a]);await assert.rejects(state(),/no profile/);
   await db.query('delete from auth.users where id=$1',[a]);assert.equal(await state(),'absent');
  });
  await t.test('deleted owner with surviving JWT cannot read, upload or overwrite artwork',async()=>{
   await asParent(a);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
   await assert.rejects(db.query("insert into storage.objects values($1,'child-artworks')",[a+'/new.png']),/row-level security/);
   assert.equal((await db.query("update storage.objects set name=name returning *")).rows.length,0);
   await asParent(b);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  });
 }finally{await db.close();}
});
