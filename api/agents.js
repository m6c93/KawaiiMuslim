// Kawaii Muslim World — API du Studio d’agents IA.
// Chaque agent est une personnalité configurée par l’administratrice. Il peut
// sortir du site (recherche et lecture web côté Anthropic), retenir des
// informations (mémoire en base) et revenir avec une réponse sourcée.
const Anthropic = require("@anthropic-ai/sdk");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pasgxojzybmvbjhuokkk.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_JfiHxlqfI8pXr4Emho4vOw_QBePfSHm";
const MODEL = process.env.AGENTS_MODEL || "claude-opus-5";
const MAX_TURNS = 8;
const MAX_HISTORY = 24;

const json = (res, status, data) => { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(data)); };
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const readBody = req => new Promise((resolve, reject) => { let raw = ""; req.on("data", chunk => { raw += chunk; if (raw.length > 400000) reject(fail("Requête trop volumineuse.")); }); req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (_) { reject(fail("Données invalides.")); } }); req.on("error", reject); });
const decodeJwt = token => { try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch (_) { return {}; } };
const safeText = (value, max = 2000) => String(value || "").trim().slice(0, max);

async function authenticateAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw fail("Connexion requise.", 401);
  const claims = decodeJwt(token);
  if (claims.aal && claims.aal !== "aal2") throw fail("Double authentification requise.", 403);
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) throw fail("Session expirée.", 401);
  const user = await userResponse.json();
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active,full_name&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  const profile = (profileResponse.ok ? await profileResponse.json() : [])[0];
  if (!profile || profile.role !== "admin" || !profile.is_active) throw fail("Accès administratrice requis.", 403);
  return { id: user.id, token, name: profile.full_name || "" };
}

// Accès aux tables Supabase avec le jeton de l’administratrice : les règles RLS s’appliquent.
async function db(admin, path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json", Prefer: options.prefer || "return=representation", ...(options.headers || {}) } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.hint || `Erreur base de données (${response.status}).`;
    if (/relation .* does not exist/i.test(message)) throw fail("Les tables du studio d’agents n’existent pas encore. Exécute supabase/agents.sql dans Supabase.", 503);
    throw fail(message, response.status);
  }
  return data;
}

const AGENT_FIELDS = "id,name,role,mission,tone,avatar,tools,created_at,updated_at";
function cleanAgent(body) {
  const tools = Array.isArray(body.tools) ? body.tools.filter(tool => ["web_search", "web_fetch", "memory"].includes(tool)) : ["web_search", "web_fetch", "memory"];
  const avatar = body.avatar && typeof body.avatar === "object" ? body.avatar : {};
  const name = safeText(body.name, 60);
  if (!name) throw fail("Donne un prénom à ton agent.");
  return { name, role: safeText(body.role, 120), mission: safeText(body.mission, 4000), tone: safeText(body.tone, 60) || "douce", avatar, tools };
}

async function getAgent(admin, id) {
  const rows = await db(admin, `ai_agents?id=eq.${encodeURIComponent(id)}&select=${AGENT_FIELDS}&limit=1`);
  if (!rows?.length) throw fail("Cet agent n’existe plus.", 404);
  return rows[0];
}

function systemPrompt(agent, admin, memories) {
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "Europe/Paris" }).format(new Date());
  const lines = [
    `Tu es ${agent.name}${agent.role ? `, ${agent.role}` : ""}, un agent personnel du studio Kawaii Muslim World. Tu aides ${admin.name || "l’administratrice"} dans ses tâches quotidiennes.`,
    `Nous sommes le ${date}. Tu réponds en français, avec un ton ${agent.tone}. Tu tutoies.`,
    agent.mission ? `Ta mission :\n${agent.mission}` : "",
    "Kawaii Muslim World est un univers numérique doux pour enfants musulmans : histoires, découvertes, coloriages, espace parents, boutique et newsletter. Reste respectueux des valeurs de l’islam dans tout ce que tu proposes.",
    agent.tools.includes("web_search") ? "Quand une information peut avoir changé ou que tu n’es pas sûr, sors sur le web avec web_search, lis les pages utiles avec web_fetch, puis reviens avec une réponse claire et cite tes sources (titre + lien)." : "Tu n’as pas accès au web : dis-le si une information récente est demandée.",
    agent.tools.includes("memory") ? "Tu disposes d’une mémoire durable : appelle save_memory pour retenir une préférence, une décision ou un fait important que l’on te confie, sans demander la permission. N’enregistre jamais de mots de passe." : "",
    memories.length ? `Ce dont tu te souviens déjà :\n${memories.map(item => `- ${item.content}`).join("\n")}` : "",
    "Termine par une action concrète ou une question si cela aide vraiment. Sois concis : pas de préambule, pas de répétition de la question."
  ];
  return lines.filter(Boolean).join("\n\n");
}

function buildTools(agent) {
  const tools = [];
  if (agent.tools.includes("web_search")) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" } });
  if (agent.tools.includes("web_fetch")) tools.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: 6, max_content_tokens: 30000 });
  if (agent.tools.includes("memory")) tools.push({
    name: "save_memory",
    description: "Retient durablement une information importante pour les prochaines missions (préférence, décision, fait, contact). Une phrase courte et autonome.",
    input_schema: { type: "object", properties: { content: { type: "string", description: "Ce qu’il faut retenir, en une phrase." } }, required: ["content"], additionalProperties: false },
    strict: true
  });
  return tools;
}

// Résume les blocs de la réponse en étapes lisibles pour la frise d’activité du studio.
function stepsFromContent(content) {
  const steps = [];
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") steps.push({ kind: "search", label: `Recherche sur le web : « ${block.input?.query || ""} »` });
    if (block.type === "server_tool_use" && block.name === "web_fetch") steps.push({ kind: "fetch", label: `Lecture de ${block.input?.url || "une page"}`, url: block.input?.url });
    if (block.type === "web_search_tool_result") {
      const results = Array.isArray(block.content) ? block.content : [];
      if (!Array.isArray(block.content)) steps.push({ kind: "error", label: "La recherche web a échoué." });
      else steps.push({ kind: "results", label: `${results.length} résultat(s) trouvé(s)`, sources: results.slice(0, 5).map(item => ({ title: item.title, url: item.url })) });
    }
    if (block.type === "web_fetch_tool_result") steps.push({ kind: Array.isArray(block.content) || block.content?.type === "web_fetch_result" ? "read" : "error", label: block.content?.type === "web_fetch_result" ? `Page lue : ${block.content.url || ""}` : "La lecture de la page a échoué." });
    if (block.type === "tool_use" && block.name === "save_memory") steps.push({ kind: "memory", label: `Mémorisé : ${block.input?.content || ""}` });
  }
  return steps;
}

async function runAgent(admin, agent, history) {
  const client = new Anthropic();
  const memories = agent.tools.includes("memory") ? (await db(admin, `ai_memories?agent_id=eq.${agent.id}&select=id,content&order=created_at.desc&limit=40`)) || [] : [];
  const tools = buildTools(agent);
  const messages = history.slice(-MAX_HISTORY).map(item => ({ role: item.role, content: item.content }));
  const steps = [];
  const sources = new Map();
  let text = "";
  let finalMessage = null;
  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: systemPrompt(agent, admin, memories), cache_control: { type: "ephemeral" } }],
      tools,
      messages
    });
    finalMessage = response;
    steps.push(...stepsFromContent(response.content));
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
        for (const citation of block.citations || []) if (citation.url) sources.set(citation.url, { url: citation.url, title: citation.title || citation.url });
      }
    }
    if (response.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: response.content }); continue; }
    if (response.stop_reason === "refusal") { text += "\n\nJe préfère ne pas répondre à cette demande."; break; }
    if (response.stop_reason !== "tool_use") break;
    const toolUses = response.content.filter(block => block.type === "tool_use");
    const results = [];
    for (const use of toolUses) {
      if (use.name === "save_memory") {
        const content = safeText(use.input?.content, 2000);
        try { const saved = await db(admin, "ai_memories", { method: "POST", body: JSON.stringify({ agent_id: agent.id, owner_id: admin.id, content }) }); memories.push(saved[0]); results.push({ type: "tool_result", tool_use_id: use.id, content: "Mémorisé." }); }
        catch (error) { results.push({ type: "tool_result", tool_use_id: use.id, content: `Impossible de mémoriser : ${error.message}`, is_error: true }); }
      } else results.push({ type: "tool_result", tool_use_id: use.id, content: "Outil inconnu.", is_error: true });
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }
  return { text: text.trim() || "Je n’ai pas réussi à formuler une réponse. Peux-tu reformuler ?", steps, sources: [...sources.values()], usage: finalMessage?.usage || null };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Méthode non autorisée." });
  try {
    const admin = await authenticateAdmin(req);
    const body = await readBody(req);
    const action = body.action;

    if (action === "status") return json(res, 200, { ready: !!process.env.ANTHROPIC_API_KEY, model: MODEL, name: admin.name });

    if (action === "listAgents") return json(res, 200, { agents: await db(admin, `ai_agents?select=${AGENT_FIELDS}&order=created_at.asc`) });
    if (action === "saveAgent") {
      const agent = cleanAgent(body);
      if (body.id) { const rows = await db(admin, `ai_agents?id=eq.${encodeURIComponent(body.id)}&select=${AGENT_FIELDS}`, { method: "PATCH", body: JSON.stringify({ ...agent, updated_at: new Date().toISOString() }) }); return json(res, 200, { agent: rows[0] }); }
      const rows = await db(admin, `ai_agents?select=${AGENT_FIELDS}`, { method: "POST", body: JSON.stringify({ ...agent, owner_id: admin.id }) });
      return json(res, 200, { agent: rows[0] });
    }
    if (action === "deleteAgent") { await db(admin, `ai_agents?id=eq.${encodeURIComponent(body.id)}`, { method: "DELETE", prefer: "return=minimal" }); return json(res, 200, { deleted: true }); }

    if (action === "listConversations") return json(res, 200, { conversations: await db(admin, `ai_conversations?agent_id=eq.${encodeURIComponent(body.agentId)}&select=id,title,updated_at,created_at&order=updated_at.desc&limit=30`) });
    if (action === "getConversation") { const rows = await db(admin, `ai_conversations?id=eq.${encodeURIComponent(body.id)}&select=id,agent_id,title,messages,updated_at&limit=1`); if (!rows?.length) throw fail("Conversation introuvable.", 404); return json(res, 200, { conversation: rows[0] }); }
    if (action === "deleteConversation") { await db(admin, `ai_conversations?id=eq.${encodeURIComponent(body.id)}`, { method: "DELETE", prefer: "return=minimal" }); return json(res, 200, { deleted: true }); }

    if (action === "listMemories") return json(res, 200, { memories: await db(admin, `ai_memories?agent_id=eq.${encodeURIComponent(body.agentId)}&select=id,content,created_at&order=created_at.desc&limit=100`) });
    if (action === "deleteMemory") { await db(admin, `ai_memories?id=eq.${encodeURIComponent(body.id)}`, { method: "DELETE", prefer: "return=minimal" }); return json(res, 200, { deleted: true }); }
    if (action === "addMemory") { const rows = await db(admin, "ai_memories", { method: "POST", body: JSON.stringify({ agent_id: body.agentId, owner_id: admin.id, content: safeText(body.content, 2000) }) }); return json(res, 200, { memory: rows[0] }); }

    if (action === "chat") {
      if (!process.env.ANTHROPIC_API_KEY) throw fail("La clé ANTHROPIC_API_KEY doit être ajoutée dans les variables Vercel pour réveiller les agents.", 503);
      const message = safeText(body.message, 12000);
      if (!message) throw fail("Écris un message à ton agent.");
      const agent = await getAgent(admin, body.agentId);
      let conversation = null;
      if (body.conversationId) { const rows = await db(admin, `ai_conversations?id=eq.${encodeURIComponent(body.conversationId)}&select=id,title,messages&limit=1`); conversation = rows?.[0] || null; }
      const history = [...(conversation?.messages || []), { role: "user", content: message, at: new Date().toISOString() }];
      const result = await runAgent(admin, agent, history.map(item => ({ role: item.role, content: item.content })));
      const reply = { role: "assistant", content: result.text, steps: result.steps, sources: result.sources, at: new Date().toISOString() };
      const messagesToStore = [...history, reply];
      const title = conversation?.title && conversation.title !== "Nouvelle mission" ? conversation.title : message.slice(0, 80);
      if (conversation) await db(admin, `ai_conversations?id=eq.${conversation.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ messages: messagesToStore, title, updated_at: new Date().toISOString() }) });
      else { const rows = await db(admin, "ai_conversations?select=id", { method: "POST", body: JSON.stringify({ agent_id: agent.id, owner_id: admin.id, title, messages: messagesToStore }) }); conversation = rows[0]; }
      return json(res, 200, { conversationId: conversation.id, title, reply, usage: result.usage });
    }

    return json(res, 400, { error: "Action inconnue." });
  } catch (error) {
    console.error("agents-api", error);
    const status = error.status || (error instanceof Anthropic.APIError ? error.status : 500) || 500;
    const message = error instanceof Anthropic.AuthenticationError ? "La clé Anthropic configurée sur Vercel est invalide." : error instanceof Anthropic.RateLimitError ? "Les agents sont très sollicités, réessaie dans une minute." : error.message || "Erreur interne.";
    return json(res, status, { error: message });
  }
};
