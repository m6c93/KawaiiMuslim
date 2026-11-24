import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const migration = await readFile(new URL('../supabase/migrations/20261124143000_child_activity_progress.sql', import.meta.url), 'utf8');

test('family activity progress SQL', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const parent = randomUUID(), child = randomUUID(), sibling = randomUUID();
  const neighbor = randomUUID(), otherChild = randomUUID();
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('test.parent', true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table public.profiles(id uuid primary key);
    create table public.child_profiles(id uuid primary key, parent_id uuid not null references public.profiles(id) on delete cascade);
    grant select on public.child_profiles to authenticated;
  `);
  await db.query('insert into profiles values ($1),($2)', [parent, neighbor]);
  await db.query('insert into child_profiles values ($1,$3),($2,$3),($4,$5)', [child, sibling, parent, otherChild, neighbor]);
  await db.exec(migration);
  const signIn = async id => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('test.parent', $1, false)", [id]);
  };
  const write = async (id, key, revision, state, operation = randomUUID()) => {
    const result = await db.query(
      'select public.save_child_activity_progress($1, $2, $3, $4::jsonb, $5) as value',
      [id, key, revision, JSON.stringify(state) ?? null, operation]
    );
    return result.rows[0].value;
  };
  const journal = 'kmw-salah-journal-v1';

  await t.test('a retry after a lost response returns the latest state without incrementing twice', async () => {
    await signIn(parent);
    const a = randomUUID(), b = randomUUID(), first = {salam:{tries:1}}, second = {salam:{tries:2}};
    assert.deepEqual(await write(child,journal,0,first,a), {applied:true,revision:1,state:first});
    assert.deepEqual(await write(child,journal,1,second,b), {applied:true,revision:2,state:second});
    assert.deepEqual(await write(child,journal,0,first,a), {applied:true,revision:2,state:second});
    const c = randomUUID(), third = {salam:{tries:3}};
    assert.deepEqual(await write(child,journal,1,third,c), {applied:false,revision:2,state:second});
    assert.deepEqual(await write(child,journal,2,third,c), {applied:true,revision:3,state:third});
    assert.deepEqual(await write(child,journal,0,{},randomUUID()), {applied:false,revision:3,state:third});
  });

  await t.test('creation has a single winner and an absent key reports version zero', async () => {
    const week = 'kmw-dua-sleep-week-1795478400000';
    assert.deepEqual(await write(sibling,week,1,7), {applied:false,revision:0,state:null});
    const values = await Promise.all([write(sibling,week,0,3), write(sibling,week,0,4)]);
    assert.equal(values.filter(row => row.applied).length, 1);
    assert.equal(values[0].state, values[1].state);
    assert.equal(values[0].revision, 1);
    assert.equal(values[1].revision, 1);
  });

  await t.test('clearing creates a tombstone and cannot be undone by a stale retry', async () => {
    const key = 'kmw-salah-session-v2', op = randomUUID(), session = {mode:'water',step:2};
    await write(child,key,0,session,op);
    assert.deepEqual(await write(child,key,1,undefined), {applied:true,revision:2,state:null});
    assert.deepEqual(await write(child,key,0,session,op), {applied:true,revision:2,state:null});
    assert.deepEqual(await write(child,key,1,session), {applied:false,revision:2,state:null});
    assert.deepEqual(await write(child,key,2,null), {applied:true,revision:3,state:null});
  });

  await t.test('local data shapes are accepted, unknown keys, invalid shapes and oversized state are rejected', async () => {
    for (const [key, value] of [
      ['kmw-aya-chansons-v1',[0,1]], ['kmw-aya-premium-stamps',['corps']],
      ['kmw-dua-sleep-ritual-v1',['2026-11-24']], ['kmw-weekly-dua-preview-v1',{learned:['sleep'],practices:{sleep:2}}],
      ['kmw-salah-v1',{water:true}], ['kmw-salah-surahs-v1',{}],
      ['kmw-salah-inline-position',{'1':2}], ['kmw-salah-learn-position',{'1':3}]
    ]) assert.equal((await write(child,key,0,value)).applied, true);
    for (const [key, value] of [
      ['arbitrary',{}], ['kmw-dua-sleep-week-invalid',1], ['kmw-dua-sleep-week-1795478400000','4'],
      ['kmw-dua-sleep-week-1795478400000',-1], ['kmw-aya-chansons-v1',[1.5]], ['kmw-aya-chansons-v1',['0']],
      ['kmw-aya-premium-stamps',[2]], ['kmw-dua-sleep-ritual-v1',{}], [journal,[]], [journal,{word:'a'.repeat(65536)}]
    ]) await assert.rejects(write(sibling,key,99,value), {code:'22023'});
    await assert.rejects(write(child,journal,-1,{}), {code:'22023'});
  });

  await t.test('anonymous and unrelated families cannot read or write; owners have no direct write or receipt access', async () => {
    const read = () => db.query('select child_profile_id from public.child_activity_progress');
    assert.ok((await read()).rows.some(row => row.child_profile_id === child));
    await assert.rejects(db.query("update public.child_activity_progress set revision=20"), {code:'42501'});
    await assert.rejects(db.query("delete from public.child_activity_progress"), {code:'42501'});
    await assert.rejects(db.query("select * from public.child_activity_operations"), {code:'42501'});
    await signIn(neighbor);
    assert.deepEqual((await read()).rows, []);
    await assert.rejects(write(child,journal,0,{}), {code:'42501'});
    assert.equal((await write(otherChild,journal,0,{seen:true})).applied, true);
    await signIn(parent);
    assert.ok((await read()).rows.every(row => row.child_profile_id !== otherChild));
    await db.exec('reset role; set role anon');
    await assert.rejects(read(), {code:'42501'});
    await assert.rejects(write(child,journal,0,{}), {code:'42501'});
  });

  await t.test('deleting a child clears their records and operation receipts only', async () => {
    await db.exec('reset role');
    await db.query('delete from public.child_profiles where id=$1', [child]);
    for (const name of ['child_activity_progress','child_activity_operations']) {
      const rows = (await db.query('select child_profile_id from public.' + name)).rows;
      assert.ok(rows.every(row => row.child_profile_id !== child));
      assert.ok(rows.some(row => row.child_profile_id === sibling));
      assert.ok(rows.some(row => row.child_profile_id === otherChild));
    }
  });
});
