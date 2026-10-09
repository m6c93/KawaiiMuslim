import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteFamilyAccount, requireMFA } from '../supabase/functions/delete-account/core.mjs';

function fixture(overrides = {}) {
  const calls = [];
  const services = {
    authenticate: async () => ({ id: 'parent-A', email: 'parent@example.test' }),
    verifyPassword: async user => { calls.push(['password', user.id]); },
    profile: async () => ({ role: 'parent' }),
    hasProfessionalData: async () => false,
    billing: async () => ({ stripe_customer_id: 'customer-A' }),
    files: async () => ['parent-A/child/drawing.png'],
    cancelSubscriptions: async () => { calls.push(['cancel']); },
    removeFiles: async paths => { calls.push(['files', paths]); },
    deleteUser: async id => { calls.push(['delete', id]); },
    ...overrides,
  };
  return { calls, services };
}
const input = { confirmation: 'SUPPRIMER', password: 'fake-test-password' };
test('only the authenticated parent is deleted, regardless of supplied target', async () => {
  const f = fixture();
  assert.deepEqual(await deleteFamilyAccount({ ...input, userId: 'victim-B' }, f.services), { deleted: true });
  assert.deepEqual(f.calls.at(-1), ['delete', 'parent-A']);
  assert.deepEqual(f.calls.map(c => c[0]), ['password', 'cancel', 'files', 'delete']);
});
test('no confirmation, no destructive operation', async () => {
  const f = fixture();
  await assert.rejects(deleteFamilyAccount({ ...input, confirmation: '' }, f.services));
  assert.equal(f.calls.length, 0);
});
test('unauthenticated callers cannot delete', async () => {
  const f = fixture({ authenticate: async () => null });
  await assert.rejects(deleteFamilyAccount(input, f.services));
  assert.equal(f.calls.length, 0);
});
test('wrong password stops before files, billing or deletion', async () => {
  const f = fixture({ verifyPassword: async () => { throw new Error('incorrect'); } });
  await assert.rejects(deleteFamilyAccount(input, f.services));
  assert.equal(f.calls.length, 0);
});
for (const role of ['admin', 'support', 'content_admin']) {
  test(`protect ${role} accounts`, async () => {
    const f = fixture({ profile: async () => ({ role }) });
    await assert.rejects(deleteFamilyAccount(input, f.services));
    assert.deepEqual(f.calls.map(c => c[0]), ['password']);
  });
}
test('professional/shared classroom data cannot be deleted by family endpoint', async () => {
  const f = fixture({ hasProfessionalData: async () => true });
  await assert.rejects(deleteFamilyAccount(input, f.services));
  assert.deepEqual(f.calls.map(c => c[0]), ['password']);
});
test('foreign storage paths fail closed before cancellation', async () => {
  const f = fixture({ files: async () => ['victim-B/child/drawing.png'] });
  await assert.rejects(deleteFamilyAccount(input, f.services));
  assert.deepEqual(f.calls.map(c => c[0]), ['password']);
});
test('failed cancellation preserves account and artwork', async () => {
  const f = fixture({ cancelSubscriptions: async () => { throw new Error('stripe unavailable'); } });
  await assert.rejects(deleteFamilyAccount(input, f.services));
  assert.deepEqual(f.calls.map(c => c[0]), ['password']);
});
test('failed storage deletion does not delete authentication', async () => {
  const f = fixture({ removeFiles: async () => { throw new Error('storage unavailable'); } });
  await assert.rejects(deleteFamilyAccount(input, f.services));
  assert.deepEqual(f.calls.map(c => c[0]), ['password', 'cancel']);
});

test('verified MFA factor requires an AAL2 session', () => {
  assert.throws(() => requireMFA({ factors: [{ status: 'verified' }] }, 'aal1'));
  assert.throws(() => requireMFA({ factors: [{ status: 'verified' }] }, undefined));
  assert.doesNotThrow(() => requireMFA({ factors: [{ status: 'verified' }] }, 'aal2'));
});
test('family without enrolled MFA can use password confirmation', () => {
  assert.doesNotThrow(() => requireMFA({}, 'aal1'));
  assert.doesNotThrow(() => requireMFA({ factors: [{ status: 'unverified' }] }, 'aal1'));
});
