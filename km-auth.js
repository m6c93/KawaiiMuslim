/* ============================================================
   Kawaii Muslim — moteur de comptes (MODE DÉMO)
   ------------------------------------------------------------
   Ce fichier fait "comme si" pour que le site fonctionne tout
   de suite, SANS serveur : les comptes sont stockés dans le
   navigateur (localStorage).

   ⚠️  POUR LA VRAIE MISE EN LIGNE : remplace le contenu des
   fonctions marquées « BRANCHEMENT » par des appels à Supabase
   (comptes + base de données) et Stripe (paiement). Les endroits
   exacts sont indiqués par des commentaires « === BRANCHEMENT ... ».
   La logique du site (les pages) n'aura pas besoin de changer.
   ============================================================ */
window.KMAuth = (function () {
  var KEY = 'km_user';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function write(u) { localStorage.setItem(KEY, JSON.stringify(u)); return u; }

  function freshUser(email, name, plan) {
    return {
      name: name || '',
      email: email,
      plan: plan || 'annuel',           // 'mensuel' | 'annuel'
      trialStart: Date.now(),           // début de l'essai gratuit
      subscribed: true,                 // essai actif = accès complet
      children: [{ id: 1, name: 'Aya', emoji: '🐤' }],
    };
  }

  return {
    getUser: read,
    isLoggedIn: function () { return !!read(); },

    /* Inscription -------------------------------------------------- */
    signup: function (opts) {
      opts = opts || {};
      // === BRANCHEMENT SUPABASE + STRIPE ===========================
      // 1) créer le compte :        supabase.auth.signUp({email, password})
      // 2) créer l'abonnement :      redirection vers Stripe Checkout
      //    (prix mensuel 6,99€ ou annuel 59€, essai de 7 jours)
      // 3) stocker le profil en base (table "profiles")
      // -------------------------------------------------------------
      return write(freshUser(opts.email, opts.name, opts.plan));
    },

    /* Connexion ---------------------------------------------------- */
    login: function (opts) {
      opts = opts || {};
      // === BRANCHEMENT SUPABASE ====================================
      //    supabase.auth.signInWithPassword({email, password})
      //    puis charger le profil + l'état d'abonnement depuis la base
      // -------------------------------------------------------------
      var u = read();
      if (!u) u = freshUser(opts.email, '', 'annuel');
      u.email = opts.email;
      return write(u);
    },

    /* Déconnexion -------------------------------------------------- */
    logout: function () {
      // === BRANCHEMENT SUPABASE : supabase.auth.signOut() ==========
      localStorage.removeItem(KEY);
    },

    /* Abonnement --------------------------------------------------- */
    setPlan: function (plan) { var u = read(); if (u) { u.plan = plan; write(u); } return u; },
    cancel: function () {
      // === BRANCHEMENT STRIPE : annuler l'abonnement ===============
      var u = read(); if (u) { u.subscribed = false; write(u); } return u;
    },
    resume: function () {
      // === BRANCHEMENT STRIPE : réactiver l'abonnement =============
      var u = read(); if (u) { u.subscribed = true; write(u); } return u;
    },
    isSubscribed: function () { var u = read(); return !!(u && u.subscribed); },

    /* Profils enfants --------------------------------------------- */
    getChildren: function () { var u = read(); return (u && u.children) || []; },
    addChild: function (name, emoji) {
      var u = read(); if (!u) return null;
      u.children = u.children || [];
      u.children.push({ id: Date.now(), name: name || 'Nouvel enfant', emoji: emoji || '🧒' });
      return write(u);
    },
    removeChild: function (id) {
      var u = read(); if (!u) return null;
      u.children = (u.children || []).filter(function (c) { return c.id !== id; });
      return write(u);
    },
  };
})();
