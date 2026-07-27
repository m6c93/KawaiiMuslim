/* Kawaii Muslim — authentification Supabase sécurisée */
window.KMAuth = (() => {
  const ACTIVE_PROFILE_KEY = "km-active-profile-v2";
  let clientInstance = null;

  const client = () => {
    if (clientInstance) return clientInstance;
    const config = window.KM_CONFIG || {};
    if (!window.supabase?.createClient || !config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error("Le service de connexion n’est pas encore configuré.");
    }
    clientInstance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return clientInstance;
  };

  const friendlyError = error => {
    const message = String(error?.message || error || "");
    if (/invalid login/i.test(message)) return "E-mail ou mot de passe incorrect.";
    if (/already registered|already been registered/i.test(message)) return "Un compte existe déjà avec cet e-mail.";
    if (/password/i.test(message) && /6 characters/i.test(message)) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (/email rate limit/i.test(message)) return "Trop d’e-mails ont été envoyés. Réessaie dans quelques minutes.";
    if (/network|fetch/i.test(message)) return "Connexion impossible. Vérifie internet puis réessaie.";
    return message || "Une erreur est survenue. Réessaie doucement.";
  };

  const requireSuccess = result => {
    if (result?.error) throw new Error(friendlyError(result.error));
    return result?.data;
  };

  const getSession = async () => {
    const data = requireSuccess(await client().auth.getSession());
    return data.session || null;
  };

  const getProfile = async userId => {
    const result = await client().from("profiles").select("*").eq("id", userId).single();
    return requireSuccess(result);
  };

  const getChildren = async parentId => {
    const result = await client()
      .from("child_profiles")
      .select("*")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true });
    return requireSuccess(result) || [];
  };

  const getContext = async () => {
    const session = await getSession();
    if (!session) return null;
    const profile = await getProfile(session.user.id);
    if (!profile.is_active) {
      await client().auth.signOut();
      throw new Error("Ce compte est actuellement désactivé. Contacte Kawaii Muslim.");
    }
    const children = await getChildren(session.user.id);
    return { session, user: session.user, profile, children };
  };

  const setActiveProfile = selection => {
    const clean = selection?.type === "child"
      ? { type: "child", id: String(selection.id), name: String(selection.name || ""), avatar: String(selection.avatar || "🐤") }
      : { type: "parent", id: null, name: String(selection?.name || ""), avatar: String(selection?.avatar || "🌸") };
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(clean));
    return clean;
  };

  const getActiveProfile = () => {
    try {
      return JSON.parse(localStorage.getItem(ACTIVE_PROFILE_KEY)) || { type: "parent", id: null };
    } catch {
      return { type: "parent", id: null };
    }
  };

  const validateActiveProfile = context => {
    const active = getActiveProfile();
    if (active.type !== "child") {
      return setActiveProfile({
        type: "parent",
        name: context.profile.full_name,
        avatar: context.profile.avatar
      });
    }
    const child = context.children.find(item => item.id === active.id);
    if (!child) {
      return setActiveProfile({
        type: "parent",
        name: context.profile.full_name,
        avatar: context.profile.avatar
      });
    }
    return setActiveProfile({ type: "child", ...child });
  };

  return {
    client,
    friendlyError,
    getSession,
    getContext,
    getActiveProfile,
    validateActiveProfile,
    setActiveProfile,

    signup: async ({ name, email, password }) => {
      const data = requireSuccess(await client().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/Profils.dc.html`
        }
      }));
      return data;
    },

    login: async ({ email, password }) => {
      return requireSuccess(await client().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      }));
    },

    logout: async () => {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
      requireSuccess(await client().auth.signOut());
    },

    resetPassword: async email => {
      return requireSuccess(await client().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/Connexion.dc.html?reset=1`
      }));
    },

    updateParent: async ({ fullName, avatar }) => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      return requireSuccess(await client().from("profiles")
        .update({ full_name: fullName.trim(), avatar })
        .eq("id", session.user.id)
        .select()
        .single());
    },

    addChild: async ({ name, avatar, ageGroup }) => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      return requireSuccess(await client().from("child_profiles").insert({
        parent_id: session.user.id,
        name: name.trim(),
        avatar,
        age_group: ageGroup
      }).select().single());
    },

    updateChild: async (id, changes) => {
      return requireSuccess(await client().from("child_profiles")
        .update(changes)
        .eq("id", id)
        .select()
        .single());
    },

    removeChild: async id => {
      return requireSuccess(await client().from("child_profiles").delete().eq("id", id));
    },

    listFamilies: async () => {
      const profiles = requireSuccess(await client().from("profiles")
        .select("id,email,full_name,avatar,role,plan,is_active,created_at")
        .order("created_at", { ascending: false }));
      const children = requireSuccess(await client().from("child_profiles")
        .select("id,parent_id,name,avatar,age_group,created_at")
        .order("created_at", { ascending: true }));
      return { profiles: profiles || [], children: children || [] };
    },

    setUserStatus: async (userId, enabled) => {
      return requireSuccess(await client().rpc("admin_set_user_status", {
        target_user: userId,
        enabled
      }));
    },

    setUserRole: async (userId, role) => {
      return requireSuccess(await client().rpc("admin_set_user_role", {
        target_user: userId,
        new_role: role
      }));
    }
  };
})();
