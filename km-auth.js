/* Mode préouverture Kawaii Muslim — accès réservé à l’équipe */
(() => {
  const page = decodeURIComponent(window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const teamPages = new Set(["index.html", "connexion.dc.html", "mfa.dc.html", "admin.dc.html"]);
  const teamPreview = localStorage.getItem("km-site-preview") === "staff";
  const localDesignPreview = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    && new URLSearchParams(window.location.search).get("preview") === "1";
  if (!teamPages.has(page) && !teamPreview && !localDesignPreview) {
    window.location.replace("/");
  }
})();
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
    const status = Number(error?.status || error?.statusCode || 0);

    if (/invalid login|invalid credentials/i.test(message)) return "E-mail ou mot de passe incorrect.";
    if (/email not confirmed/i.test(message)) return "Confirme d’abord ton adresse e-mail grâce au message reçu.";
    if (/already registered|already been registered|user already exists/i.test(message)) return "Un compte existe déjà avec cet e-mail.";
    if (/weak password|password.*(?:6|8) characters|password should be at least/i.test(message)) return "Choisis un mot de passe d’au moins 8 caractères.";
    if (/email rate limit|over_email_send_rate_limit/i.test(message)) return "Trop d’e-mails ont été envoyés. Attends quelques minutes avant de réessayer.";
    if (/rate limit|too many requests/i.test(message) || status === 429) return "Trop de tentatives ont été effectuées. Attends quelques minutes avant de réessayer.";
    if (/expired|invalid.*(?:token|otp)|otp.*invalid/i.test(message)) return "Ce lien ou ce code a expiré. Demande-en un nouveau.";
    if (/signup.*disabled|signups not allowed/i.test(message)) return "Les inscriptions sont momentanément fermées.";
    if (/network|fetch|timeout|timed out|load failed|connection refused|service unavailable/i.test(message) || status >= 500) {
      return "Le service de connexion est momentanément indisponible. Réessaie dans quelques minutes.";
    }
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

  const withArtworkUrls = async rows => {
    return Promise.all((rows || []).map(async artwork => {
      if (!artwork.image_path) return { ...artwork, image_url: artwork.source_url || "" };
      const signed = requireSuccess(await client().storage
        .from("child-artworks")
        .createSignedUrl(artwork.image_path, 60 * 60));
      return { ...artwork, image_url: signed?.signedUrl || "" };
    }));
  };

  const validateArtworkChild = async childId => {
    const session = await getSession();
    if (!session) throw new Error("Connexion requise.");
    const child = requireSuccess(await client().from("child_profiles")
      .select("id,name,avatar")
      .eq("id", childId)
      .eq("parent_id", session.user.id)
      .single());
    return { session, child };
  };

  const getContext = async () => {
    const session = await getSession();
    if (!session) return null;
    const profile = await getProfile(session.user.id);
    if (["admin", "support", "content_admin"].includes(profile.role)) {
      localStorage.setItem("km-site-preview", "staff");
    }
    if (!profile.is_active) {
      await client().auth.signOut();
      throw new Error("Ce compte est actuellement désactivé. Contacte Kawaii Muslim.");
    }
    const children = await getChildren(session.user.id);
    startInactivityGuard();
    return { session, user: session.user, profile, children };
  };

  const getMFAStatus = async () => {
    const session = await getSession();
    if (!session) throw new Error("Connexion requise.");
    const levels = requireSuccess(await client().auth.mfa.getAuthenticatorAssuranceLevel());
    const factors = requireSuccess(await client().auth.mfa.listFactors());
    const allTotpFactors = factors?.totp || [];
    const totpFactors = allTotpFactors.filter(factor => factor.status === "verified");
    return {
      currentLevel: levels?.currentLevel || "aal1",
      nextLevel: levels?.nextLevel || "aal1",
      factors: totpFactors,
      unverifiedFactors: allTotpFactors.filter(factor => factor.status !== "verified")
    };
  };

  const clearUnverifiedMFAFactors = async factors => {
    for (const factor of factors || []) {
      requireSuccess(await client().auth.mfa.unenroll({ factorId: factor.id }));
    }
  };

  const enrollMFA = async () => {
    const session = await getSession();
    if (!session) throw new Error("Connexion requise.");
    const data = requireSuccess(await client().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Kawaii Muslim Admin"
    }));
    return {
      factorId: data.id,
      qrCode: data.totp?.qr_code || "",
      secret: data.totp?.secret || "",
      uri: data.totp?.uri || ""
    };
  };

  const verifyMFACode = async ({ factorId, code }) => {
    const cleanCode = String(code || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new Error("Entre le code à 6 chiffres de ton application.");
    }
    const challenge = requireSuccess(await client().auth.mfa.challenge({ factorId }));
    return requireSuccess(await client().auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: cleanCode
    }));
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
    getMFAStatus,
    enrollMFA,
    verifyMFACode,
    clearUnverifiedMFAFactors,
    getActiveProfile,
    validateActiveProfile,
    setActiveProfile,
    getPlannerDays,
    savePlannerDay,
    startInactivityGuard,

    listArtworks: async childId => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      let query = client().from("child_artworks")
        .select("*")
        .eq("owner_id", session.user.id)
        .order("updated_at", { ascending: false });
      if (childId) query = query.eq("child_profile_id", childId);
      return withArtworkUrls(requireSuccess(await query) || []);
    },

    findArtworkDraft: async ({ childId, sourceUrl }) => {
      await validateArtworkChild(childId);
      const result = await client().from("child_artworks")
        .select("*")
        .eq("child_profile_id", childId)
        .eq("source_url", sourceUrl)
        .eq("status", "in_progress")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return requireSuccess(result);
    },

    saveArtworkDraft: async ({ id, childId, title, sourceUrl, drawingData }) => {
      const { session } = await validateArtworkChild(childId);
      const payload = {
        owner_id: session.user.id,
        child_profile_id: childId,
        title: String(title || "Mon coloriage").trim().slice(0, 160),
        source_url: sourceUrl,
        kind: "digital",
        status: "in_progress",
        drawing_data: drawingData || { strokes: [] }
      };
      if (id) {
        delete payload.owner_id;
        delete payload.child_profile_id;
        return requireSuccess(await client().from("child_artworks")
          .update(payload)
          .eq("id", id)
          .eq("owner_id", session.user.id)
          .select()
          .single());
      }
      return requireSuccess(await client().from("child_artworks")
        .insert(payload)
        .select()
        .single());
    },

    completeArtwork: async ({ id, childId, imageBlob, drawingData }) => {
      const { session } = await validateArtworkChild(childId);
      if (!id || !imageBlob) throw new Error("Le coloriage n’est pas encore prêt.");
      if (imageBlob.size > 10 * 1024 * 1024) throw new Error("Le coloriage est trop lourd pour être enregistré.");
      const path = `${session.user.id}/${childId}/${id}-${Date.now()}.png`;
      requireSuccess(await client().storage.from("child-artworks").upload(path, imageBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/png"
      }));
      return requireSuccess(await client().from("child_artworks")
        .update({
          status: "completed",
          image_path: path,
          drawing_data: drawingData || { strokes: [] },
          completed_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("owner_id", session.user.id)
        .select()
        .single());
    },

    uploadPaperArtwork: async ({ childId, title, file }) => {
      const { session } = await validateArtworkChild(childId);
      if (!file || !String(file.type).startsWith("image/")) {
        throw new Error("Choisis ou photographie une image du coloriage.");
      }
      if (file.size > 10 * 1024 * 1024) throw new Error("La photo doit peser moins de 10 Mo.");
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const artworkId = crypto.randomUUID();
      const path = `${session.user.id}/${childId}/${artworkId}-${Date.now()}.${extension}`;
      requireSuccess(await client().storage.from("child-artworks").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      }));
      return requireSuccess(await client().from("child_artworks").insert({
        id: artworkId,
        owner_id: session.user.id,
        child_profile_id: childId,
        title: String(title || "Mon coloriage papier").trim().slice(0, 160),
        kind: "paper",
        status: "completed",
        image_path: path,
        completed_at: new Date().toISOString()
      }).select().single());
    },

    deleteArtwork: async id => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      const artwork = requireSuccess(await client().from("child_artworks")
        .select("id,image_path")
        .eq("id", id)
        .eq("owner_id", session.user.id)
        .single());
      if (artwork.image_path) {
        requireSuccess(await client().storage.from("child-artworks").remove([artwork.image_path]));
      }
      return requireSuccess(await client().from("child_artworks")
        .delete().eq("id", id).eq("owner_id", session.user.id));
    },

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

    uploadCover: async file => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      if (!file) throw new Error("Choisis une image de couverture.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Choisis une image JPG, PNG ou WebP.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("L’image doit peser moins de 5 Mo.");
      }
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const uploaded = await client().storage.from("content-covers").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });
      requireSuccess(uploaded);
      const publicUrl = client().storage.from("content-covers").getPublicUrl(path);
      return publicUrl.data.publicUrl;
    },

    uploadBook: async file => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      if (!file) throw new Error("Choisis le fichier PDF du livre.");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) throw new Error("Le fichier du livre doit être un PDF.");
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("Le PDF doit peser moins de 50 Mo.");
      }
      const safeName = file.name.replace(/\.pdf$/i, "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "livre";
      const path = `${session.user.id}/${Date.now()}-${safeName}.pdf`;
      const uploaded = await client().storage.from("content-books").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf"
      });
      requireSuccess(uploaded);
      const publicUrl = client().storage.from("content-books").getPublicUrl(path);
      return publicUrl.data.publicUrl;
    },

    deleteBook: async url => {
      if (!url) return;
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      let source = url;
      try {
        const readerUrl = new URL(url, window.location.href);
        if (readerUrl.pathname.endsWith("/Livre.dc.html") || readerUrl.pathname.endsWith("Livre.dc.html")) {
          source = readerUrl.searchParams.get("src") || "";
        }
        const objectUrl = new URL(source);
        const marker = "/storage/v1/object/public/content-books/";
        const markerIndex = objectUrl.pathname.indexOf(marker);
        if (objectUrl.hostname !== "pasgxojzybmvbjhuokkk.supabase.co" || markerIndex < 0) return;
        const path = decodeURIComponent(objectUrl.pathname.slice(markerIndex + marker.length));
        if (!path) return;
        requireSuccess(await client().storage.from("content-books").remove([path]));
      } catch (error) {
        if (error?.message === "Connexion requise.") throw error;
      }
    },

    uploadColoring: async file => {
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      if (!file) throw new Error("Choisis le fichier du coloriage.");
      const extension = (file.name.split(".").pop() || "").toLowerCase();
      const typeByExtension = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        webp: "image/webp", pdf: "application/pdf"
      };
      const contentType = file.type || typeByExtension[extension] || "";
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowed.includes(contentType)) {
        throw new Error("Choisis une image JPG, PNG, WebP ou un PDF.");
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("Le coloriage doit peser moins de 20 Mo.");
      }
      const safeName = file.name.replace(/\.[^.]+$/, "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "coloriage";
      const safeExtension = extension === "jpeg" ? "jpg" : extension;
      const path = `${session.user.id}/${Date.now()}-${safeName}.${safeExtension}`;
      const uploaded = await client().storage.from("content-colorings").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType
      });
      requireSuccess(uploaded);
      const publicUrl = client().storage.from("content-colorings").getPublicUrl(path);
      return {
        url: publicUrl.data.publicUrl,
        kind: contentType === "application/pdf" ? "pdf" : "image"
      };
    },

    deleteColoring: async url => {
      if (!url) return;
      const session = await getSession();
      if (!session) throw new Error("Connexion requise.");
      let source = url;
      try {
        const viewerUrl = new URL(url, window.location.href);
        if (viewerUrl.pathname.endsWith("/Coloriage.dc.html") || viewerUrl.pathname.endsWith("Coloriage.dc.html")) {
          source = viewerUrl.searchParams.get("src") || "";
        }
        const objectUrl = new URL(source);
        const marker = "/storage/v1/object/public/content-colorings/";
        const markerIndex = objectUrl.pathname.indexOf(marker);
        if (objectUrl.hostname !== "pasgxojzybmvbjhuokkk.supabase.co" || markerIndex < 0) return;
        const path = decodeURIComponent(objectUrl.pathname.slice(markerIndex + marker.length));
        if (!path) return;
        requireSuccess(await client().storage.from("content-colorings").remove([path]));
      } catch (error) {
        if (error?.message === "Connexion requise.") throw error;
      }
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

    getStarShop: async childId => {
      if (!childId) throw new Error("Choisis d’abord un profil enfant.");
      return requireSuccess(await client().rpc("get_child_star_shop", {
        target_child: childId
      }));
    },

    awardChildStars: async ({ childId, eventType, sourceKey, description }) => {
      if (!childId) return { awarded: 0, balance: 0 };
      return requireSuccess(await client().rpc("award_child_stars", {
        target_child: childId,
        event_type: eventType,
        source_key: String(sourceKey || "").slice(0, 200),
        event_description: String(description || "").slice(0, 180)
      }));
    },

    redeemStarItem: async ({ childId, itemId }) => {
      if (!childId) throw new Error("Choisis d’abord un profil enfant.");
      return requireSuccess(await client().rpc("redeem_star_shop_item", {
        target_child: childId,
        target_item: itemId
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
