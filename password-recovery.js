(() => {
  const form = document.getElementById("recoveryForm");
  const message = document.getElementById("message");
  const button = document.getElementById("savePassword");
  if (window.KMApple || window.webkit?.messageHandlers?.kmShell) {
    document.getElementById("recoveryReturnNote").textContent = "Connecte-toi avec ton e-mail et ton nouveau mot de passe pour retrouver ton espace parent dans KMW.";
    document.getElementById("recoveryLogin").textContent = "Se connecter dans KMW";
  }
  let ready = false;
  KMAuth.getPasswordRecoverySession(recoveryToken).then(({ user }) => {
    document.getElementById("identity").textContent = user.email;
    ready = true;
    form.hidden = false;
  }).catch(error => {
    document.getElementById("identity").textContent = "Ton lien n’est plus valide.";
    document.getElementById("requestNew").hidden = false;
    message.textContent = KMAuth.friendlyError(error);
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!ready || button.disabled) return;
    const password = document.getElementById("newPassword");
    const confirmation = document.getElementById("confirmPassword");
    if (password.value.length < 8 || password.value !== confirmation.value) {
      message.textContent = "Les deux mots de passe doivent être identiques et contenir au moins 8 caractères.";
      return;
    }
    button.disabled = true;
    message.textContent = "Enregistrement…";
    try {
      await KMAuth.updatePassword(password.value);
      password.value = "";
      confirmation.value = "";
      form.hidden = true;
      message.textContent = "";
      document.getElementById("done").hidden = false;
    } catch (error) {
      button.disabled = false;
      message.textContent = KMAuth.friendlyError(error);
    }
  });
})();
