(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const state = { context: null, config: null, agents: [], current: null, editing: null, avatar: null, conversationId: null, conversations: [], memories: [], busy: false, pendingConfirm: null };

  const escapeHtml = value => String(value || "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const showNotice = (message, type = "") => { const node = $("#notice"); node.textContent = message; node.className = `notice show ${type}`; clearTimeout(showNotice.timer); showNotice.timer = setTimeout(() => node.className = "notice", 6500); };
  const setBusy = (button, busy, busyText) => { if (!button) return; if (busy) { button.dataset.label = button.textContent; button.textContent = busyText || "Patiente…"; } else if (button.dataset.label) button.textContent = button.dataset.label; button.disabled = busy; };
  const formatDate = value => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
  const getToken = async () => (await KMAuth.getSession())?.access_token || "";
  const api = async (action, payload = {}) => {
    const token = await getToken();
    const response = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...payload }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
    return data;
  };

  // ---------- Avatars kawaii en SVG ----------
  const AVATAR = {
    colors: ["#e477a7", "#f5a8c8", "#a58bff", "#63bea8", "#f0b646", "#5aa9e6", "#ff8f6b", "#2d3b86"],
    skins: ["#ffe1c9", "#f6c9a4", "#e0a97a", "#b9784f", "#8a5636", "#5b3a26"],
    heads: [["hijab", "Voile"], ["bonnet", "Bonnet"], ["cap", "Casquette"], ["ribbon", "Ruban"], ["none", "Aucune"]],
    eyes: [["round", "Ronds"], ["happy", "Rieurs"], ["star", "Étoiles"], ["wink", "Clin d’œil"]],
    accessories: [["none", "Rien"], ["glasses", "Lunettes"], ["flower", "Fleur"], ["moon", "Croissant"], ["headset", "Casque"]],
    mouths: [["smile", "Sourire"], ["open", "Joyeuse"], ["cat", "Chat"], ["calm", "Sereine"]]
  };
  const randomAvatar = () => ({ color: pick(AVATAR.colors), skin: pick(AVATAR.skins), head: pick(AVATAR.heads)[0], eyes: pick(AVATAR.eyes)[0], accessory: pick(AVATAR.accessories)[0], mouth: pick(AVATAR.mouths)[0] });
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const normalizeAvatar = value => ({ ...randomAvatar(), ...(value && typeof value === "object" ? value : {}) });
  const shade = (hex, amount) => { const n = parseInt(hex.slice(1), 16); const c = k => Math.max(0, Math.min(255, ((n >> k) & 255) + amount)); return `#${[16, 8, 0].map(k => c(k).toString(16).padStart(2, "0")).join("")}`; };
  const avatarSvg = (value, size = 96) => {
    const a = normalizeAvatar(value); const dark = shade(a.color, -40); const light = shade(a.color, 70);
    const eyes = {
      round: `<circle cx="42" cy="56" r="5" fill="#2b2650"/><circle cx="70" cy="56" r="5" fill="#2b2650"/><circle cx="44" cy="54" r="1.8" fill="#fff"/><circle cx="72" cy="54" r="1.8" fill="#fff"/>`,
      happy: `<path d="M36 57q6-7 12 0" stroke="#2b2650" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M64 57q6-7 12 0" stroke="#2b2650" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      star: `<path d="M42 50l1.8 4 4.2.4-3.2 2.8 1 4.2-3.8-2.3-3.8 2.3 1-4.2-3.2-2.8 4.2-.4z" fill="#2b2650"/><path d="M70 50l1.8 4 4.2.4-3.2 2.8 1 4.2-3.8-2.3-3.8 2.3 1-4.2-3.2-2.8 4.2-.4z" fill="#2b2650"/>`,
      wink: `<circle cx="42" cy="56" r="5" fill="#2b2650"/><circle cx="44" cy="54" r="1.8" fill="#fff"/><path d="M64 57q6-6 12 0" stroke="#2b2650" stroke-width="3" fill="none" stroke-linecap="round"/>`
    }[a.eyes];
    const mouth = {
      smile: `<path d="M50 70q6 6 12 0" stroke="#2b2650" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      open: `<path d="M49 68q7 10 14 0z" fill="#2b2650"/><path d="M52 71q4 3 8 0z" fill="#ff8fa6"/>`,
      cat: `<path d="M48 69q4 5 8 0q4 5 8 0" stroke="#2b2650" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      calm: `<path d="M51 70h10" stroke="#2b2650" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    }[a.mouth];
    const head = {
      hijab: `<path d="M22 66C18 34 36 16 56 16s38 18 34 50c0 16-8 30-34 30S22 82 22 66z" fill="${a.color}"/><path d="M31 63c-1-20 10-33 25-33s26 13 25 33c-2 11-11 15-25 15S33 74 31 63z" fill="${a.skin}"/><path d="M40 92c2-8 9-11 16-11s14 3 16 11z" fill="${dark}"/>`,
      bonnet: `<circle cx="56" cy="60" r="27" fill="${a.skin}"/><path d="M26 56c2-24 14-34 30-34s28 10 30 34c-8-6-18-9-30-9s-22 3-30 9z" fill="${a.color}"/><circle cx="56" cy="22" r="6" fill="${light}"/>`,
      cap: `<circle cx="56" cy="60" r="27" fill="${a.skin}"/><path d="M28 52c2-20 14-30 28-30s26 10 28 30z" fill="${a.color}"/><path d="M24 52h64v6H24z" fill="${dark}"/>`,
      ribbon: `<circle cx="56" cy="60" r="27" fill="${a.skin}"/><path d="M29 58c0-22 12-34 27-34s27 12 27 34c-5-9-14-13-27-13S34 49 29 58z" fill="${dark}"/><path d="M74 30l-9 7 9 7 3-7zM88 30l-9 7 9 7 3-7z" fill="${a.color}"/><circle cx="79" cy="37" r="3" fill="${light}"/>`,
      none: `<circle cx="56" cy="60" r="27" fill="${a.skin}"/><path d="M29 58c0-22 12-34 27-34s27 12 27 34c-5-9-14-13-27-13S34 49 29 58z" fill="${dark}"/>`
    }[a.head];
    const accessory = {
      none: "",
      glasses: `<circle cx="42" cy="56" r="9" stroke="#2b2650" stroke-width="2" fill="rgba(255,255,255,.35)"/><circle cx="70" cy="56" r="9" stroke="#2b2650" stroke-width="2" fill="rgba(255,255,255,.35)"/><path d="M51 56h10" stroke="#2b2650" stroke-width="2"/>`,
      flower: `<g transform="translate(80 34)"><circle r="4" cx="0" cy="-5" fill="${light}"/><circle r="4" cx="5" cy="0" fill="${light}"/><circle r="4" cx="0" cy="5" fill="${light}"/><circle r="4" cx="-5" cy="0" fill="${light}"/><circle r="3" fill="#f0b646"/></g>`,
      moon: `<path d="M84 26a9 9 0 1 0 6 15 7 7 0 1 1-6-15z" fill="#f0b646"/>`,
      headset: `<path d="M27 58v-6c0-16 13-28 29-28s29 12 29 28v6" stroke="#2b2650" stroke-width="3.5" fill="none"/><rect x="22" y="54" width="9" height="14" rx="4" fill="#2b2650"/><rect x="81" y="54" width="9" height="14" rx="4" fill="#2b2650"/><path d="M86 68c0 8-6 12-14 12" stroke="#2b2650" stroke-width="3" fill="none"/>`
    }[a.accessory];
    return `<svg viewBox="0 0 112 112" width="${size}" height="${size}" role="img" aria-hidden="true"><defs><radialGradient id="g${a.color.slice(1)}" cx=".5" cy=".3"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${shade(a.color, 30)}"/></radialGradient></defs><rect width="112" height="112" rx="56" fill="url(#g${a.color.slice(1)})"/>${head}<ellipse cx="38" cy="65" rx="4.5" ry="2.6" fill="#ff8fa6" opacity=".7"/><ellipse cx="74" cy="65" rx="4.5" ry="2.6" fill="#ff8fa6" opacity=".7"/>${eyes}${mouth}${accessory}</svg>`;
  };

  // ---------- Modèles prêts à l’emploi ----------
  const PRESETS = [
    { name: "Noor", role: "Assistante newsletter", tone: "douce", avatar: { color: "#e477a7", skin: "#f6c9a4", head: "hijab", eyes: "happy", accessory: "flower", mouth: "smile" }, mission: "Tu aides à préparer les newsletters Kawaii Muslim World : idées d’objets d’e-mails, textes chaleureux pour les familles, relectures, suggestions de moments d’envoi. Tu proposes toujours deux variantes courtes et une plus longue. Tu vérifies sur le web les fêtes et dates importantes du calendrier musulman avant de proposer un planning." },
    { name: "Amina", role: "Community manager Instagram", tone: "enjouée", avatar: { color: "#a58bff", skin: "#e0a97a", head: "hijab", eyes: "star", accessory: "none", mouth: "open" }, mission: "Tu crées des idées de posts, carrousels et légendes Instagram pour Kawaii Muslim World, avec hashtags. Tu surveilles sur le web les tendances de contenus pour enfants et familles musulmanes et tu proposes un calendrier éditorial hebdomadaire. Pas de musique, pas de représentation de prophètes, ton doux et éducatif." },
    { name: "Yusuf", role: "Chercheur et veilleur", tone: "pro", avatar: { color: "#2d3b86", skin: "#b9784f", head: "cap", eyes: "round", accessory: "glasses", mouth: "calm" }, mission: "Tu sors sur le web pour trouver des informations fiables et récentes : concurrents, prix, réglementations, outils, fournisseurs. Tu reviens avec une synthèse structurée, des sources citées et une recommandation claire. Tu signales quand une information est incertaine." },
    { name: "Layla", role: "Rédactrice d’histoires", tone: "douce", avatar: { color: "#63bea8", skin: "#ffe1c9", head: "ribbon", eyes: "happy", accessory: "moon", mouth: "smile" }, mission: "Tu écris et améliores des histoires courtes pour enfants musulmans de 4 à 10 ans : valeurs de l’islam, douceur, humour léger, vocabulaire simple. Tu proposes des titres, des résumés et des idées d’illustrations kawaii. Tu vérifies les récits religieux avant de les utiliser." },
    { name: "Sami", role: "Assistant boutique et commandes", tone: "pro", avatar: { color: "#f0b646", skin: "#8a5636", head: "bonnet", eyes: "wink", accessory: "headset", mouth: "cat" }, mission: "Tu aides à gérer la boutique : fiches produits claires, réponses aux clientes, idées de promotions, suivi des tâches de la semaine. Tu compares sur le web les prix et pratiques d’autres boutiques pour enfants et tu proposes des améliorations concrètes." },
    { name: "Hana", role: "Organisatrice du quotidien", tone: "calme", avatar: { color: "#5aa9e6", skin: "#f6c9a4", head: "hijab", eyes: "round", accessory: "none", mouth: "smile" }, mission: "Tu aides à organiser les journées : listes de tâches priorisées, rappels, préparation de réunions, résumés de documents, brouillons de messages. Tu retiens les habitudes et préférences pour proposer des routines de plus en plus adaptées." }
  ];

  // ---------- Navigation ----------
  const views = ["home", "editor", "chat"];
  const switchView = name => {
    views.forEach(view => $(`#view-${view}`).classList.toggle("active", view === name));
    $(".studio-sidebar").classList.remove("open");
    const title = $("#topbarTitle"); const actions = $("#topbarActions"); actions.innerHTML = "";
    if (name === "home") title.innerHTML = `<p class="eyebrow">Studio d’agents</p><h1>Bonjour <span>${escapeHtml((state.context?.profile?.full_name || "Maman").split(" ")[0])}</span> 🌸</h1>`;
    if (name === "editor") title.innerHTML = `<p class="eyebrow">${state.editing ? "Modifier" : "Nouvel agent"}</p><h1>${state.editing ? escapeHtml(state.editing.name) : "Donne vie à ton agent"}</h1>`;
    if (name === "chat" && state.current) { title.innerHTML = `<p class="eyebrow">${escapeHtml(state.current.role || "Agent")}</p><h1>${escapeHtml(state.current.name)}</h1>`; actions.innerHTML = `<button type="button" class="ghost small" id="editCurrent">✏️ Modifier</button><button type="button" class="ghost small" id="homeBtn">🏠 Accueil</button>`; $("#editCurrent").onclick = () => openEditor(state.current); $("#homeBtn").onclick = () => switchView("home"); }
    history.replaceState(null, "", `#${name}${name === "chat" && state.current ? `/${state.current.id}` : ""}`);
    window.scrollTo({ top: 0 });
  };

  // ---------- Accueil ----------
  const renderRoster = () => {
    $("#agentRoster").innerHTML = state.agents.map(agent => `<button type="button" class="roster-item ${state.current?.id === agent.id ? "active" : ""}" data-id="${agent.id}">${avatarSvg(agent.avatar, 38)}<span><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.role || "Agent")}</small></span></button>`).join("") || `<p class="side-empty" style="color:#cfd3f1">Aucun agent pour l’instant.</p>`;
    $$(".roster-item").forEach(item => item.onclick = () => openChat(state.agents.find(agent => agent.id === item.dataset.id)));
  };
  const renderHome = () => {
    $("#agentCount").textContent = state.agents.length ? `${state.agents.length} agent${state.agents.length > 1 ? "s" : ""}` : "";
    $("#agentGrid").innerHTML = state.agents.map(agent => `<article class="agent-card">${avatarSvg(agent.avatar, 96)}<h4>${escapeHtml(agent.name)}</h4><p>${escapeHtml(agent.role || "Agent polyvalent")}</p><div class="tags">${agent.tools.includes("web_search") ? `<span class="tag">🔎 Web</span>` : ""}${agent.tools.includes("web_fetch") ? `<span class="tag">📄 Lecture</span>` : ""}${agent.tools.includes("memory") ? `<span class="tag">🧠 Mémoire</span>` : ""}</div><div class="card-actions"><button type="button" class="primary small" data-chat="${agent.id}">Lui parler</button><button type="button" class="icon-btn" data-edit="${agent.id}" title="Modifier">✏️</button><button type="button" class="icon-btn" data-delete="${agent.id}" title="Supprimer">🗑️</button></div></article>`).join("") + `<button type="button" class="agent-card empty" id="gridNewAgent">＋ Créer un nouvel agent</button>`;
    $$("[data-chat]").forEach(button => button.onclick = () => openChat(state.agents.find(agent => agent.id === button.dataset.chat)));
    $$("[data-edit]").forEach(button => button.onclick = () => openEditor(state.agents.find(agent => agent.id === button.dataset.edit)));
    $$("[data-delete]").forEach(button => button.onclick = () => confirmAction("Supprimer cet agent ?", "Ses missions et sa mémoire seront effacées définitivement.", async () => { await api("deleteAgent", { id: button.dataset.delete }); state.agents = state.agents.filter(agent => agent.id !== button.dataset.delete); if (state.current?.id === button.dataset.delete) state.current = null; renderAll(); showNotice("Agent supprimé.", "success"); }));
    $("#gridNewAgent").onclick = () => openEditor(null);
    $("#presetGrid").innerHTML = PRESETS.map((preset, index) => `<button type="button" class="preset-card" data-preset="${index}">${avatarSvg(preset.avatar, 64)}<span><strong>${escapeHtml(preset.name)} · ${escapeHtml(preset.role)}</strong><small>${escapeHtml(preset.mission.slice(0, 110))}…</small></span></button>`).join("");
    $$("[data-preset]").forEach(button => button.onclick = () => openEditor({ ...PRESETS[button.dataset.preset], tools: ["web_search", "web_fetch", "memory"] }, true));
    $("#heroArt").innerHTML = `<span class="orbit">🌍 sort sur le web… et revient</span>` + (state.agents.length ? state.agents.slice(0, 3) : PRESETS.slice(0, 3)).map(agent => avatarSvg(agent.avatar, 120)).join("");
  };
  const renderSetup = () => {
    const steps = [];
    if (!state.config?.ready) steps.push(`Ajoute la variable <code>ANTHROPIC_API_KEY</code> dans Vercel (Settings → Environment Variables), puis redéploie.`);
    if (state.config?.tablesMissing) steps.push(`Exécute le fichier <code>supabase/agents.sql</code> dans l’éditeur SQL de Supabase pour créer les tables des agents.`);
    $("#setupCard").hidden = !steps.length; $("#setupSteps").innerHTML = steps.map(step => `<li>${step}</li>`).join("");
  };
  const renderAll = () => { renderRoster(); renderHome(); renderSetup(); };

  // ---------- Éditeur ----------
  const renderAvatarControls = () => {
    const a = state.avatar;
    $("#avatarPreview").innerHTML = avatarSvg(a, 180);
    $("#swatchColor").innerHTML = AVATAR.colors.map(color => `<button type="button" class="swatch ${a.color === color ? "active" : ""}" style="background:${color}" data-k="color" data-v="${color}" aria-label="Couleur"></button>`).join("");
    $("#swatchSkin").innerHTML = AVATAR.skins.map(color => `<button type="button" class="swatch ${a.skin === color ? "active" : ""}" style="background:${color}" data-k="skin" data-v="${color}" aria-label="Peau"></button>`).join("");
    const chips = (list, key) => list.map(([value, label]) => `<button type="button" class="chip ${a[key] === value ? "active" : ""}" data-k="${key}" data-v="${value}">${label}</button>`).join("");
    $("#chipHead").innerHTML = chips(AVATAR.heads, "head"); $("#chipEyes").innerHTML = chips(AVATAR.eyes, "eyes"); $("#chipAccessory").innerHTML = chips(AVATAR.accessories, "accessory"); $("#chipMouth").innerHTML = chips(AVATAR.mouths, "mouth");
    $$("[data-k]").forEach(button => button.onclick = () => { state.avatar[button.dataset.k] = button.dataset.v; renderAvatarControls(); });
  };
  const openEditor = (agent, fromPreset = false) => {
    state.editing = fromPreset ? null : agent;
    const source = agent || { name: "", role: "", mission: "", tone: "douce", tools: ["web_search", "web_fetch", "memory"], avatar: randomAvatar() };
    $("#agentName").value = source.name || ""; $("#agentRole").value = source.role || ""; $("#agentMission").value = source.mission || ""; $("#agentTone").value = source.tone || "douce";
    $("#toolSearch").checked = source.tools.includes("web_search"); $("#toolFetch").checked = source.tools.includes("web_fetch"); $("#toolMemory").checked = source.tools.includes("memory");
    state.avatar = normalizeAvatar(source.avatar); renderAvatarControls(); switchView("editor"); $("#agentName").focus();
  };
  const saveAgent = async event => {
    event.preventDefault();
    const tools = [$("#toolSearch").checked && "web_search", $("#toolFetch").checked && "web_fetch", $("#toolMemory").checked && "memory"].filter(Boolean);
    const payload = { id: state.editing?.id, name: $("#agentName").value.trim(), role: $("#agentRole").value.trim(), mission: $("#agentMission").value.trim(), tone: $("#agentTone").value, tools, avatar: state.avatar };
    setBusy($("#saveAgent"), true, "Enregistrement…");
    try {
      const data = await api("saveAgent", payload);
      const index = state.agents.findIndex(agent => agent.id === data.agent.id);
      if (index >= 0) state.agents[index] = data.agent; else state.agents.push(data.agent);
      if (state.current?.id === data.agent.id) state.current = data.agent;
      renderAll(); showNotice(`${data.agent.name} est prêt${state.editing ? "" : " à travailler"} ✨`, "success"); openChat(data.agent);
    } catch (error) { showNotice(error.message, "error"); } finally { setBusy($("#saveAgent"), false); }
  };

  // ---------- Conversation ----------
  const SUGGESTIONS = ["Prépare-moi un plan de la semaine", "Cherche les dernières nouveautés dans mon domaine et résume-les", "Rédige un message doux pour mes abonnées", "Que retiens-tu de moi ?"];
  const renderAgentCard = busy => { const agent = state.current; $("#chatAgentCard").innerHTML = `${avatarSvg(agent.avatar, 92)}<strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.role || "Agent polyvalent")}</small><span class="status ${busy ? "busy" : ""}"><i></i>${busy ? "En mission…" : "Disponible"}</span>`; };
  const renderConversations = () => {
    $("#conversationList").innerHTML = state.conversations.map(item => `<div class="conversation-item ${state.conversationId === item.id ? "active" : ""}" data-id="${item.id}" role="button" tabindex="0"><span>${escapeHtml(item.title)}</span><button type="button" class="x" data-x="${item.id}" title="Supprimer">×</button></div>`).join("") || `<p class="side-empty">Aucune mission pour l’instant.</p>`;
    $$(".conversation-item").forEach(item => item.onclick = event => { if (event.target.dataset.x) return; loadConversation(item.dataset.id); });
    $$("[data-x]").forEach(button => button.onclick = () => confirmAction("Supprimer cette mission ?", "L’historique de cette conversation sera effacé.", async () => { await api("deleteConversation", { id: button.dataset.x }); if (state.conversationId === button.dataset.x) newConversation(); await loadConversations(); }));
  };
  const renderMemories = () => {
    $("#memoryList").innerHTML = state.memories.map(item => `<div class="memory-item"><span>${escapeHtml(item.content)}</span><button type="button" class="x" data-m="${item.id}" title="Oublier">×</button></div>`).join("") || `<p class="side-empty">Rien encore. ${escapeHtml(state.current?.name || "L’agent")} retiendra ce qui compte au fil des missions.</p>`;
    $$("[data-m]").forEach(button => button.onclick = async () => { try { await api("deleteMemory", { id: button.dataset.m }); state.memories = state.memories.filter(item => item.id !== button.dataset.m); renderMemories(); } catch (error) { showNotice(error.message, "error"); } });
  };
  const loadConversations = async () => { try { state.conversations = (await api("listConversations", { agentId: state.current.id })).conversations || []; } catch (error) { state.conversations = []; } renderConversations(); };
  const loadMemories = async () => { try { state.memories = (await api("listMemories", { agentId: state.current.id })).memories || []; } catch (error) { state.memories = []; } renderMemories(); };
  const renderMarkdown = text => {
    let html = escapeHtml(text);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code.trim()}</pre>`);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`).replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, `$1<a href="$2" target="_blank" rel="noopener">$2</a>`);
    const blocks = html.split(/\n{2,}/).map(block => {
      if (/^(?:- |• |\* )/m.test(block)) return `<ul>${block.split("\n").filter(Boolean).map(line => `<li>${line.replace(/^(?:- |• |\* )/, "")}</li>`).join("")}</ul>`;
      if (/^\d+[.)] /m.test(block)) return `<ol>${block.split("\n").filter(Boolean).map(line => `<li>${line.replace(/^\d+[.)] /, "")}</li>`).join("")}</ol>`;
      if (/^#{1,3} /.test(block)) return `<p><strong>${block.replace(/^#{1,3} /, "")}</strong></p>`;
      if (block.startsWith("<pre>")) return block;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    });
    return blocks.join("");
  };
  const stepIcon = { search: "🔎", results: "🌍", fetch: "📄", read: "✅", memory: "🧠", error: "⚠️" };
  const tripHtml = (steps, live = false) => {
    if (!steps?.length && !live) return "";
    const outside = steps?.some(step => ["search", "fetch", "results", "read"].includes(step.kind));
    return `<div class="trip ${live ? "live open" : ""}"><div class="trip-head"><span class="plane">${live ? "🚀" : outside ? "🛬" : "🗒️"}</span>${live ? "Parti chercher…" : outside ? `Sorti sur le web · ${steps.length} étape${steps.length > 1 ? "s" : ""}` : `${steps.length} action${steps.length > 1 ? "s" : ""}`}</div><div class="trip-steps">${(steps || []).map(step => `<div class="step ${step.kind}"><i>${stepIcon[step.kind] || "•"}</i><div>${escapeHtml(step.label)}${step.sources?.length ? `<div class="srcs">${step.sources.map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title || source.url)}</a>`).join("")}</div>` : ""}</div></div>`).join("")}</div></div>`;
  };
  const messageHtml = message => {
    if (message.role === "user") return `<div class="msg user"><div class="you">${escapeHtml((state.context?.profile?.full_name || "M")[0].toUpperCase())}</div><div class="msg-body"><div class="bubble">${renderMarkdown(typeof message.content === "string" ? message.content : "")}</div></div></div>`;
    return `<div class="msg agent">${avatarSvg(state.current.avatar, 36)}<div class="msg-body">${tripHtml(message.steps)}<div class="bubble">${renderMarkdown(typeof message.content === "string" ? message.content : "")}</div>${message.sources?.length ? `<div class="sources">${message.sources.slice(0, 6).map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener" title="${escapeHtml(source.title)}">🔗 ${escapeHtml(source.title || source.url)}</a>`).join("")}</div>` : ""}</div></div>`;
  };
  const renderThread = messages => {
    $("#chatThread").innerHTML = messages.map(messageHtml).join("");
    $("#chatEmpty").hidden = !!messages.length;
    if (!messages.length) { $("#chatEmpty").innerHTML = `${avatarSvg(state.current.avatar, 84)}<h4>Assalamou alaykoum, je suis ${escapeHtml(state.current.name)}.</h4><p>${escapeHtml(state.current.role ? `${state.current.role}. ` : "")}Confie-moi une tâche : je peux sortir sur le web, lire des pages et revenir avec une réponse.</p><div class="suggestions">${SUGGESTIONS.map(text => `<button type="button" data-suggest="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join("")}</div>`; $$("[data-suggest]").forEach(button => button.onclick = () => { $("#chatInput").value = button.dataset.suggest; $("#chatInput").focus(); }); }
    $$(".trip-head").forEach(head => head.onclick = () => head.parentElement.classList.toggle("open"));
    $("#chatScroll").scrollTop = $("#chatScroll").scrollHeight;
  };
  const openChat = async agent => {
    if (!agent) return;
    state.current = agent; state.conversationId = null; state.thread = [];
    renderRoster(); renderAgentCard(false); switchView("chat"); renderThread([]);
    await Promise.all([loadConversations(), loadMemories()]);
  };
  const newConversation = () => { state.conversationId = null; state.thread = []; renderThread([]); renderConversations(); $("#chatInput").focus(); };
  const loadConversation = async id => {
    try { const data = await api("getConversation", { id }); state.conversationId = id; state.thread = data.conversation.messages || []; renderThread(state.thread); renderConversations(); }
    catch (error) { showNotice(error.message, "error"); }
  };
  const sendMessage = async event => {
    event?.preventDefault();
    const text = $("#chatInput").value.trim(); if (!text || state.busy) return;
    state.busy = true; $("#chatInput").value = ""; setBusy($("#chatSend"), true, "…");
    state.thread = [...(state.thread || []), { role: "user", content: text }];
    renderThread(state.thread);
    const outside = state.current.tools.includes("web_search") || state.current.tools.includes("web_fetch");
    $("#chatThread").insertAdjacentHTML("beforeend", `<div class="msg agent" id="pendingMsg">${avatarSvg(state.current.avatar, 36)}<div class="msg-body">${outside ? tripHtml([], true) : ""}<div class="bubble thinking"><span class="dots"><i></i><i></i><i></i></span>${escapeHtml(state.current.name)} réfléchit${outside ? " et peut sortir chercher" : ""}…</div></div></div>`);
    $("#chatScroll").scrollTop = $("#chatScroll").scrollHeight; renderAgentCard(true);
    try {
      const data = await api("chat", { agentId: state.current.id, conversationId: state.conversationId, message: text });
      state.conversationId = data.conversationId; state.thread.push(data.reply); renderThread(state.thread);
      if (data.reply.steps?.some(step => step.kind === "memory")) loadMemories();
      loadConversations();
    } catch (error) { $("#pendingMsg")?.remove(); state.thread.pop(); renderThread(state.thread); $("#chatInput").value = text; showNotice(error.message, "error"); }
    finally { state.busy = false; setBusy($("#chatSend"), false); renderAgentCard(false); $("#chatInput").focus(); }
  };

  // ---------- Divers ----------
  const confirmAction = (title, text, action) => { $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; state.pendingConfirm = action; $("#confirmModal").hidden = false; };
  $("#confirmCancel").onclick = () => { $("#confirmModal").hidden = true; state.pendingConfirm = null; };
  $("#confirmOk").onclick = async () => { const action = state.pendingConfirm; $("#confirmModal").hidden = true; state.pendingConfirm = null; try { await action?.(); } catch (error) { showNotice(error.message, "error"); } };
  $("#newAgent").onclick = () => openEditor(null); $("#heroNewAgent").onclick = () => openEditor(null); $("#heroPresets").onclick = () => $("#presetGrid").scrollIntoView({ behavior: "smooth" });
  $("#cancelEditor").onclick = () => switchView(state.current ? "chat" : "home");
  $("#agentForm").addEventListener("submit", saveAgent); $("#randomAvatar").onclick = () => { state.avatar = randomAvatar(); renderAvatarControls(); };
  $("#chatForm").addEventListener("submit", sendMessage);
  $("#chatInput").addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
  $("#newConversation").onclick = newConversation;
  $("#addMemory").onclick = async () => { const content = prompt(`Que doit retenir ${state.current.name} ?`); if (!content?.trim()) return; try { const data = await api("addMemory", { agentId: state.current.id, content: content.trim() }); state.memories.unshift(data.memory); renderMemories(); } catch (error) { showNotice(error.message, "error"); } };
  $("#mobileMenu").onclick = () => $(".studio-sidebar").classList.toggle("open");

  const initialize = async () => {
    try {
      if (["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).has("demo")) {
        state.context = { profile: { full_name: "Kawaii Muslim", role: "admin" } }; state.config = { ready: false };
        state.agents = PRESETS.slice(0, 3).map((preset, index) => ({ ...preset, id: `demo-${index}`, tools: ["web_search", "web_fetch", "memory"] }));
        $("#adminName").textContent = "Kawaii Muslim"; renderAll(); $("#studio").hidden = false; $("#authLoader").remove(); document.body.classList.remove("is-loading"); switchView("home"); return;
      }
      state.context = await KMAuth.getContext(); if (!state.context) return location.replace("/Connexion.dc.html?next=%2Fagents%2F");
      if (state.context.profile.role !== "admin") return location.replace("/Profils.dc.html");
      const mfa = await KMAuth.getMFAStatus(); if (mfa.currentLevel !== "aal2") return location.replace(`/MFA.dc.html?next=${encodeURIComponent("/agents/")}`);
      $("#adminName").textContent = state.context.profile.full_name || "Administration";
      state.config = await api("status");
      try { state.agents = (await api("listAgents")).agents || []; } catch (error) { state.config.tablesMissing = /agents\.sql/.test(error.message); if (!state.config.tablesMissing) showNotice(error.message, "error"); }
      renderAll(); $("#studio").hidden = false; $("#authLoader").remove(); document.body.classList.remove("is-loading");
      const wanted = location.hash.match(/^#chat\/(.+)$/)?.[1]; const found = wanted && state.agents.find(agent => agent.id === wanted);
      if (found) openChat(found); else switchView("home");
    } catch (error) { $("#authLoader").innerHTML = `<strong>Impossible d’ouvrir le studio.</strong><small>${escapeHtml(error.message)}</small>`; }
  };
  initialize();
})();
