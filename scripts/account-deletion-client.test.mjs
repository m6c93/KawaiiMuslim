import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../km-auth.js', import.meta.url), 'utf8');
function fixture(result, { session = true, storageBlocked = false } = {}) {
  const calls = [];
  const storage = { 'km-active-profile-v2': 'child-A', 'kmw-drawing': 'drawing', unrelated: 'keep' };
  Object.defineProperties(storage, {
    getItem: { value: key => storage[key] },
    removeItem: { value: key => { if (storageBlocked) throw new Error('blocked'); delete storage[key]; } },
  });
  const mock = {
    auth: {
      getSession: async () => ({ data: { session: session ? { user: { id: 'parent-A' } } : null } }),
      signOut: async () => { calls.push('signOut'); },
    },
    functions: { invoke: async (name, body) => { calls.push([name, body]); return result; } },
  };
  const window = {
    location: { pathname: '/Compte.dc.html', hostname: 'localhost', search: '' },
    KM_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'test-public-key' },
    supabase: { createClient: () => mock },
  };
  vm.runInNewContext(source, { window, localStorage: storage, URLSearchParams, URL, console });
  return { api: window.KMAuth, calls, storage };
}
const input = { password: 'fake-test-password', confirmation: 'SUPPRIMER' };
test('server failure preserves local session and progress and presents server error', async () => {
  const f = fixture({ error: { context: { json: async () => ({ error: 'Mot de passe incorrect.' }) } } });
  await assert.rejects(f.api.deleteAccount(input), /Mot de passe incorrect/);
  assert.equal(f.storage['kmw-drawing'], 'drawing');
  assert.equal(f.calls.length, 1);
});
test('missing explicit server confirmation never logs out or clears progress', async () => {
  const f = fixture({ data: { deleted: false } });
  await assert.rejects(f.api.deleteAccount(input), /pas été confirmée/);
  assert.equal(f.storage['km-active-profile-v2'], 'child-A');
  assert.equal(f.calls.length, 1);
});
test('confirmed deletion clears family caches and keeps unrelated storage', async () => {
  const f = fixture({ data: { deleted: true } });
  await f.api.deleteAccount(input);
  assert.equal(f.storage['km-active-profile-v2'], undefined);
  assert.equal(f.storage['kmw-drawing'], undefined);
  assert.equal(f.storage.unrelated, 'keep');
  assert.equal(f.calls.at(-1), 'signOut');
});
test('blocked browser storage cannot turn successful deletion into a false failure', async () => {
  const f = fixture({ data: { deleted: true } }, { storageBlocked: true });
  assert.equal((await f.api.deleteAccount(input)).deleted, true);
});
test('anonymous caller cannot invoke deletion endpoint', async () => {
  const f = fixture({ data: { deleted: true } }, { session: false });
  await assert.rejects(f.api.deleteAccount(input), /Connexion requise/);
  assert.equal(f.calls.length, 0);
});
