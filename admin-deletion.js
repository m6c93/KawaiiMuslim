(async function () {
  const panel = document.getElementById('adminDeletions');
  if (!panel) return;
  try {
    const context = await KMAuth.getContext();
    if (!context || context.profile.role !== 'admin') return;
    const mfa = await KMAuth.getMFAStatus();
    if (mfa.currentLevel !== 'aal2') return;
    panel.hidden = false;
    const list = document.getElementById('deletionQueue');
    const load = async () => {
      list.textContent = 'Chargement…';
      const result = await KMAuth.client().rpc('admin_list_account_deletions');
      if (result.error) { list.textContent = 'La file des suppressions est indisponible. Réessaie ; vérifie la migration Supabase.'; return; }
      list.replaceChildren();
      if (!result.data.length) list.textContent = 'Aucune demande de suppression en attente.';
      for (const request of result.data) {
        const row = document.createElement('p');
        row.textContent = `${request.email} — demande ${request.id} — compte ${request.user_id} — échéance ${new Date(request.due_at).toLocaleDateString('fr-FR')}${Date.parse(request.due_at) < Date.now() ? ' — EN RETARD' : ''}`;
        list.append(row);
      }
    };
    document.getElementById('refreshDeletions').addEventListener('click', () => load().catch(() => { list.textContent = 'Chargement impossible. Réessaie.'; }));
    await load();
  } catch (_) {
    // Main admin authentication handles missing sessions and MFA redirects.
    if (!panel.hidden) document.getElementById('deletionQueue').textContent = 'La file des suppressions est indisponible. Réessaie.';
  }
})();
