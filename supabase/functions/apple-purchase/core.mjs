export const APPLE_PRODUCTS = Object.freeze({
  'com.kawaiimuslimworld.family1.monthly': 1,
  'com.kawaiimuslimworld.family2.monthly': 2,
  'com.kawaiimuslimworld.family3.monthly': 3,
});
export function entitlementFromApple(transaction, owner, environment, now = Date.now(), status = 1) {
  if (!owner || String(transaction.appAccountToken || '').toLowerCase() !== owner.toLowerCase()) throw new Error('Compte Apple associé à un autre compte parent.');
  if (transaction.bundleId !== 'com.kawaiimuslimworld.ios' || transaction.environment !== environment) throw new Error('Application ou environnement invalide.');
  const childLimit = APPLE_PRODUCTS[transaction.productId];
  if (!childLimit || transaction.type !== 'Auto-Renewable Subscription' || transaction.isUpgraded === true) throw new Error('Abonnement invalide.');
  if (!transaction.transactionId || !transaction.originalTransactionId || !Number.isFinite(transaction.expiresDate) || !Number.isFinite(transaction.signedDate) || transaction.signedDate > now + 60000) throw new Error('Transaction invalide.');
  if (![1,2,3,4,5].includes(status)) throw new Error("Statut Apple invalide.");
  return {
    apple_status: status,
    original_transaction_id: transaction.originalTransactionId,
    transaction_id: transaction.transactionId, user_id: owner,
    product_id: transaction.productId, environment, child_limit: childLimit,
    expires_at: new Date(transaction.expiresDate).toISOString(),
    revoked_at: transaction.revocationDate ? new Date(transaction.revocationDate).toISOString() : null,
    signed_at: new Date(transaction.signedDate).toISOString(),
  };
}
