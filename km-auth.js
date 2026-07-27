/* Kawaii Muslim — authentification Supabase sécurisée */
window.KMAuth = (() => {
  const ACTIVE_PROFILE_KEY = "km-active-profile-v2";
  const INACTIVITY_LIMIT = 30 * 60 * 1000;
  let clientInstance = null;
  let inactivityTimer = null;
  let inactivityStarted = false;

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

  const startInactivityGuard = () => {
    if (inactivityStarted) return;
    inactivityStarted = true;
    const reset = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(async () => {
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
        await client().auth.signOut().catch(() => {});
        window.location.href = "Connexion.dc.html?expired=1";
      }, INACTIVITY_LIMIT);
    };
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(eventName => {
      window.addEventListener(eventName, reset, { passive: true });
    });
    reset();
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

  const getPlannerDays = async () => {
    const session = await getSession();
    if (!session) throw new Error("Connexion requise.");
    const result = await client()
      .from("planner_days")
      .select("id,day,content,updated_at")
      .eq("owner_id", session.user.id)
      .is("child_profile_id", null)
      .order("day", { ascending: true });
    return requireSuccess(result) || [];
  };

  const savePlannerDay = async (day, content) => {
    const session = await getSession();
    if (!session) throw new Error("Connexion requise.");

    const existing = await client()
      .from("planner_days")
      .select("id")
      .eq("owner_id", session.user.id)
      .is("child_profile_id", null)
      .eq("day", day)
      .maybeSingle();
    const row = requireSuccess(existing);

    if (row?.id) {
      return requireSuccess(await client()
        .from("planner_days")
        .update({ content })
        .eq("id", row.id)
        .select()
        .single());
    }

    return requireSuccess(await client().from("planner_days").insert({
      owner_id: session.user.id,
      child_profile_id: null,
      day,
      content
    }).select().single());
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
    startInactivityGuard();
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
    getPlannerDays,
    savePlannerDay,
    startInactivityGuard,

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

    reauthenticate: async password => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      return requireSuccess(await client().auth.signInWithPassword({
        email: session.user.email,
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
      return requireSuccess(await client().rpc("staff_list_families")) || [];
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
    },

    setUserPlan: async (userId, plan) => {
      return requireSuccess(await client().rpc("admin_set_user_plan", {
        target_user: userId,
        new_plan: plan
      }));
    },

    listContent: async () => {
      return requireSuccess(await client().from("content_items")
        .select("*")
        .order("sort_order", { ascending: true })) || [];
    },

    saveContent: async item => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      const payload = {
        slug: item.slug.trim().toLowerCase(),
        title: item.title.trim(),
        description: item.description.trim(),
        content_type: item.content_type,
        audience: item.audience,
        status: item.status,
        url: item.url.trim(),
        cover_url: item.cover_url.trim(),
        sort_order: Number(item.sort_order) || 0,
        created_by: session.user.id
      };
      if (item.id) {
        delete payload.created_by;
        return requireSuccess(await client().from("content_items")
          .update(payload).eq("id", item.id).select().single());
      }
      return requireSuccess(await client().from("content_items")
        .insert(payload).select().single());
    },

    archiveContent: async (id, restore = false) => {
      return requireSuccess(await client().from("content_items")
        .update({ status: restore ? "draft" : "archived" })
        .eq("id", id).select().single());
    },

    listTickets: async () => {
      return requireSuccess(await client().from("support_tickets")
        .select("id,requester_id,subject,category,message,status,priority,staff_note,assigned_to,created_at,updated_at")
        .order("created_at", { ascending: false })) || [];
    },

    createTicket: async ({ subject, category, message }) => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      return requireSuccess(await client().from("support_tickets").insert({
        requester_id: session.user.id,
        subject: subject.trim(),
        category,
        message: message.trim()
      }).select().single());
    },

    updateTicket: async ({ id, status, priority, note }) => {
      return requireSuccess(await client().rpc("staff_update_ticket", {
        target_ticket: id,
        new_status: status,
        new_priority: priority,
        new_note: note || ""
      }));
    },

    listAuditLogs: async () => {
      return requireSuccess(await client().from("admin_audit_logs")
        .select("id,actor_id,action,target_type,target_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(200)) || [];
    },

    logExport: async type => {
      return requireSuccess(await client().rpc("staff_log_export", {
        export_type: type
      }));
    },

    getSettings: async () => {
      return requireSuccess(await client().from("site_settings")
        .select("*").order("key", { ascending: true })) || [];
    },

    saveSetting: async ({ key, value, description }) => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      return requireSuccess(await client().from("site_settings").upsert({
        key,
        value,
        description,
        updated_by: session.user.id
      }, { onConflict: "key" }).select().single());
    }
  };
})();
