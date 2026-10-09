import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const parent = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const session = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('account deletion PostgreSQL permissions, identity and request lifecycle (fictional data only)', async t => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create table auth.sessions(id uuid primary key, user_id uuid);
    create table auth.mfa_factors(user_id uuid, status text);
    create function auth.jwt() returns jsonb language sql as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql as
      $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.jwt(), auth.uid() to anon, authenticated;
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, role text, is_active boolean);
    create table public.child_profiles(id uuid primary key default gen_random_uuid(), parent_id uuid references public.profiles(id) on delete cascade);
    insert into auth.users values('${parent}','parent@example.invalid'),('${other}','other@example.invalid'),('${admin}','admin@example.invalid');
    insert into public.profiles values('${parent}','parent',true),('${other}','parent',true),('${admin}','admin',true);
    insert into auth.sessions values('${session}','${parent}');
    insert into public.child_profiles(parent_id) values('${parent}'),('${other}');
  `);
  const migration = await readFile(new URL('../supabase/migrations/20261008123000_account_deletion_requests.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  const claims = async (uid = parent, overrides = {}, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({sub:uid, session_id:session, aal:'aal1', amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}],...overrides})]);
    await db.exec(`set role ${role}`);
  };
  const request = async confirmed => {
    const result = await db.query('select public.request_account_deletion($1) as receipt', [confirmed]);
    return { rows: result.rows.map(row => row.receipt) };
  };
  try {
    await t.test('anonymous and direct writes are denied', async () => {
      await claims(null, {}, 'anon');
      await assert.rejects(request(true), /permission denied/);
      await claims();
      await assert.rejects(db.query('insert into public.account_deletion_requests(user_id) values($1)', [other]), /permission denied/);
      await assert.rejects(db.query("update public.account_deletion_requests set status='processing'"), /permission denied/);
    });
    await t.test('confirmation is mandatory', async () => {
      await claims();
      for (const value of [false, null]) await assert.rejects(request(value), /Confirme/);
    });
    await t.test('fresh token without fresh password is rejected', async () => {
      for (const amr of [[], [{method:'token_refresh',timestamp:Date.now()/1000}], [{method:'password',timestamp:Date.now()/1000-601}], [{method:'password',timestamp:Date.now()/1000+3600}]]) {
        await claims(parent, {amr,iat:Date.now()/1000});
        await assert.rejects(request(true), /mot de passe/);
      }
    });
    await t.test('a revoked session cannot initiate deletion', async () => {
      await claims(parent, {session_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
      await assert.rejects(request(true), /Connexion/);
    });
    await t.test('fresh password creates receipt only; retry preserves deadline', async () => {
      await claims();
      const first = (await request(true)).rows[0];
      const again = (await request(true)).rows[0];
      assert.deepEqual(first, again);
      assert.equal(first.user_id, parent);
      assert.equal(first.status, 'pending');
      assert.equal(Date.parse(first.due_at)-Date.parse(first.requested_at),30*86400000);
      await db.exec('reset role');
      assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n, 3);
      assert.equal((await db.query('select count(*)::int as n from public.child_profiles')).rows[0].n, 2);
    });
    await t.test('families cannot read other requests or call admin RPC', async () => {
      await claims(other);
      assert.equal((await db.query('select * from public.account_deletion_requests')).rows.length,0);
      await assert.rejects(db.query('select * from public.admin_list_account_deletions()'), /administrateur/);
    });
    await t.test('MFA cannot be bypassed with a fresh password alone', async () => {
      await db.exec('reset role');
      await db.query("insert into auth.mfa_factors values($1,'verified')", [parent]);
      await claims();
      await assert.rejects(request(true), /double authentification/);
      await claims(parent, {aal:'aal2'});
      assert.equal((await request(true)).rows[0].user_id,parent);
    });
    await t.test('admin queue requires active admin AND MFA, not support staff', async () => {
      await claims(admin);
      await assert.rejects(db.query('select * from public.admin_list_account_deletions()'), /administrateur/);
      await claims(admin,{aal:'aal2'});
      assert.equal((await db.query('select * from public.admin_list_account_deletions()')).rows[0].email,'parent@example.invalid');
      await db.exec('reset role');
      await db.query("update public.profiles set role='support' where id=$1",[admin]);
      await claims(admin,{aal:'aal2'});
      await assert.rejects(db.query('select * from public.admin_list_account_deletions()'), /administrateur/);
    });
    await t.test('queue disappears only on actual auth deletion; another family stays intact', async () => {
      await db.exec('reset role');
      await db.query('delete from auth.users where id=$1',[parent]);
      assert.equal((await db.query('select * from public.account_deletion_requests')).rows.length,0);
      assert.equal((await db.query('select parent_id from public.child_profiles')).rows[0].parent_id,other);
    });
  } finally { await db.close(); }
});
