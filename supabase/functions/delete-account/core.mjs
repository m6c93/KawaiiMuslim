export class DeletionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// The target always comes from verified authentication, never from request data.
export async function deleteFamilyAccount(input, services) {
  if (input?.confirmation !== 'SUPPRIMER' || typeof input.password !== 'string' || !input.password) {
    throw new DeletionError('Confirme la suppression et saisis ton mot de passe.');
  }
  if (input.appleSubscriptionAcknowledged !== true) {
    throw new DeletionError('Confirme que la suppression du compte ne résilie pas un abonnement Apple.');
  }
  const user = await services.authenticate();
  if (!user?.id || !user.email) throw new DeletionError('Connexion requise.', 401);
  await services.verifyPassword(user, input.password);
  const profile = await services.profile(user.id);
  if (profile?.role !== 'parent') {
    throw new DeletionError('Pour un compte professionnel ou administrateur, contacte l’assistance.', 403);
  }
  if (await services.hasProfessionalData(user.id)) {
    throw new DeletionError('Ce compte est aussi lié à une classe. Contacte l’assistance pour préserver les données partagées.', 409);
  }
  // Old requests retain their deadline and manual processing; never auto-convert consent.
  if (await services.existingRequest(user.id)) {
    throw new DeletionError('Une demande de suppression est déjà suivie par l’équipe. Sa référence et son échéance restent inchangées.', 409);
  }
  // Preflight all data reads before irreversible steps. Stripe cancellation is not silently
  // deferred. Apple renewal remains controlled by the parent through Apple.
  const billing = await services.billing(user.id);
  const files = await services.files(user.id);
  if (files.some(path => !path.startsWith(user.id + '/'))) {
    throw new DeletionError('La suppression des créations ne peut pas être vérifiée.', 409);
  }
  await services.cancelSubscriptions(billing);
  await services.removeFiles(files);
  await services.deleteUser(user.id);
  return { deleted: true };
}

export function requireMFA(user, aal) {
  if (user.factors?.some(factor => factor.status === 'verified') && aal !== 'aal2') {
    throw new DeletionError('Confirme ta double authentification avant suppression.', 403);
  }
}
