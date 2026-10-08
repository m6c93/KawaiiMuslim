/* The server owns identity, confirmation and freshness checks. No email-only fallback. */
(function () {
  const form = document.getElementById('deletionForm');
  if (!form) return;
  const message = document.getElementById('deletionMessage');
  const password = document.getElementById('deletionPassword');
  const code = document.getElementById('deletionCode');
  const codeField = document.getElementById('deletionMFA');
  const confirm = document.getElementById('deletionConfirm');
  const button = document.getElementById('deletionSubmit');
  let reauthenticated = false;
  let busy = false;
  const showReceipt = request => {
    form.hidden = true;
    document.getElementById('deletionDetails').open = true;
    message.textContent = `Demande enregistrée le ${new Date(request.requested_at).toLocaleDateString('fr-FR')}. Référence : ${request.id}. Suppression définitive du compte et des données familiales au plus tard le ${new Date(request.due_at).toLocaleDateString('fr-FR')}. Une confirmation sera envoyée à l’adresse de ton compte une fois la suppression terminée. Tu n’as pas besoin d’écrire à l’assistance.`;
  };
  const loadRequest = async () => {
    const context = await KMAuth.getContext();
    if (!context) return;
    const result = await KMAuth.client().from('account_deletion_requests')
      .select('id,status,requested_at,due_at').eq('user_id', context.user.id).maybeSingle();
    if (result.error) throw result.error;
    if (result.data) showReceipt(result.data);
    else button.disabled = false;
  };
  loadRequest().catch(() => {
    message.textContent = 'Le suivi de suppression est indisponible. Réessaie plus tard. Aucune nouvelle demande n’a été confirmée.';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true;
    button.disabled = true;
    message.textContent = 'Vérification…';
    try {
      if (!reauthenticated) {
        const before = await KMAuth.getSession();
        const signed = await KMAuth.reauthenticate(password.value);
        if (!before || signed.user.id !== before.user.id) throw new Error('Reconnecte-toi au compte parent.');
        reauthenticated = true;
        password.value = '';
        password.required = false;
        password.disabled = true;
      }
      const mfa = await KMAuth.getMFAStatus();
      if (mfa.nextLevel === 'aal2' && mfa.currentLevel !== 'aal2') {
        codeField.hidden = false;
        code.required = true;
        if (!code.value) {
          message.textContent = 'Saisis le code de ton application de double authentification, puis confirme.';
          code.focus();
          return;
        }
        if (!mfa.factors[0]) throw new Error('Reconnecte-toi pour vérifier ta double authentification.');
        await KMAuth.verifyMFACode({ factorId: mfa.factors[0].id, code: code.value });
      }
      const result = await KMAuth.client().rpc('request_account_deletion', { confirmed: confirm.checked });
      if (result.error) throw result.error;
      if (!result.data?.id) throw new Error('La demande n’a pas pu être confirmée. Réessaie.');
      showReceipt(result.data);
    } catch (error) {
      // On an uncertain network result, a retry returns the original receipt and deadline.
      message.textContent = error.message || 'Demande non confirmée. Réessaie plus tard.';
      reauthenticated = false;
      password.disabled = false;
      password.required = true;
    } finally {
      password.value = '';
      code.value = '';
      button.disabled = false;
      busy = false;
    }
  });
  document.getElementById('deletionCancel').addEventListener('click', () => {
    if (busy) return;
    form.reset();
    reauthenticated = false;
    password.disabled = false;
    password.required = true;
    code.required = false;
    codeField.hidden = true;
    document.getElementById('deletionDetails').open = false;
    message.textContent = '';
  });
})();
