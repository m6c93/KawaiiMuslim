(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const state = { context: null, config: null, contacts: [], campaigns: [], pendingCampaign: null };
  const titles = { dashboard: "Bonjour", contacts: "Mes contacts", composer: "Créer un e-mail", history: "Mes campagnes" };

  const escapeHtml = value => String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const showNotice = (message, type = "") => {
    const node = $("#notice"); node.textContent = message; node.className = `notice show ${type}`;
    clearTimeout(showNotice.timer); showNotice.timer = setTimeout(() => node.className = "notice", 6500);
  };
  const setBusy = (button, busy, busyText) => {
    if (!button) return;
    if (busy) { button.dataset.label = button.textContent; button.textContent = busyText || "Patiente…"; }
    else if (button.dataset.label) button.textContent = button.dataset.label;
    button.disabled = busy;
  };
  const getToken = async () => (await KMAuth.getSession())?.access_token || "";
  const api = async (action, payload = {}) => {
    const token = await getToken();
    const response = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...payload }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
    return data;
  };

  const switchView = name => {
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === name));
    $$(".studio-view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
    $("#viewTitle").innerHTML = name === "dashboard" ? `Bonjour <span>${escapeHtml((state.context?.profile?.full_name || "Maman").split(" ")[0])}</span> 🌸` : titles[name];
    $(".studio-sidebar").classList.remove("open");
    history.replaceState(null, "", `#${name}`);
    if (name === "contacts") loadContacts();
    if (name === "history") loadCampaigns();
  };

  const formatDate = value => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—";
  const renderStatus = () => {
    const config = state.config || {};
    $("#formspreeStatus").textContent = config.formspree ? "Connecté" : "Connexion nécessaire";
    $("#shopifyStatus").textContent = config.shopify ? "Connecté" : "Connexion nécessaire";
    $("#formspreeStatus").classList.toggle("connected", !!config.formspree);
    $("#shopifyStatus").classList.toggle("connected", !!config.shopify);
    $("#checkSender").classList.toggle("done", !!config.sender);
    $("#checkSources").classList.toggle("done", !!(config.formspree || config.shopify));
    ["#sendTest", "#sendCampaign"].forEach(id => $(id).disabled = !config.sender);
  };

  const loadContacts = async () => {
    if (!state.config?.brevo) return;
    try {
      const data = await api("contacts"); state.contacts = data.contacts || [];
      $("#statContacts").textContent = data.count ?? state.contacts.length;
      $("#contactsCount").textContent = data.count ?? state.contacts.length;
      $("#recipientSummary").textContent = `Destinataires actifs : ${data.count ?? state.contacts.length}`;
      renderContacts();
    } catch (error) { showNotice(error.message, "error"); }
  };
  const renderContacts = () => {
    const query = $("#contactSearch").value.trim().toLowerCase();
    const source = $("#sourceFilter").value;
    const items = state.contacts.filter(item => {
      const itemSource = String(item.attributes?.SOURCE || "").toLowerCase();
      return (!query || `${item.email} ${item.attributes?.PRENOM || ""} ${item.attributes?.NOM || ""}`.toLowerCase().includes(query)) && (!source || itemSource.includes(source));
    });
    $("#contactsBody").innerHTML = items.map(item => `<tr><td><div class="contact-person"><strong>${escapeHtml([item.attributes?.PRENOM,item.attributes?.NOM].filter(Boolean).join(" ") || "Contact")}</strong><small>${escapeHtml(item.email)}</small></div></td><td><span class="source-tag">${escapeHtml(item.attributes?.SOURCE || "Newsletter")}</span></td><td>${formatDate(item.addedAt || item.modifiedAt)}</td><td><span class="status-tag">Actif</span></td></tr>`).join("") || '<tr><td colspan="4" class="empty">Aucun contact ne correspond à cette recherche.</td></tr>';
  };

  const syncSource = async (source, button) => {
    setBusy(button, true, "Synchronisation…");
    try {
      const data = await api(source === "formspree" ? "syncFormspree" : "syncShopify");
      showNotice(`${data.imported || 0} contact(s) ${source === "formspree" ? "Formspree" : "Shopify"} synchronisé(s), sans doublons.`, "success");
      if (source === "formspree") $("#statFormspree").textContent = data.imported || 0;
      else $("#statShopify").textContent = data.imported || 0;
      await loadContacts();
    } catch (error) { showNotice(error.message, "error"); }
    finally { setBusy(button, false); }
  };

  const parseCsv = text => {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
    const split = line => line.split(new RegExp(`${separator}(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)`)).map(value => value.replace(/^\"|\"$/g, "").trim());
    const headers = split(lines[0]).map(value => value.toLowerCase());
    const emailIndex = headers.findIndex(value => /e-?mail|email/.test(value));
    const firstIndex = headers.findIndex(value => /first.?name|pr[ée]nom/.test(value));
    const lastIndex = headers.findIndex(value => /last.?name|nom/.test(value));
    const rows = lines.slice(emailIndex >= 0 ? 1 : 0).map(line => split(line));
    return rows.map(columns => ({ email: columns[emailIndex >= 0 ? emailIndex : columns.findIndex(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))], firstName: firstIndex >= 0 ? columns[firstIndex] : "", lastName: lastIndex >= 0 ? columns[lastIndex] : "", source: "CSV" })).filter(item => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email || ""));
  };
  const importCsv = async file => {
    const button = document.querySelector(".file-button"); button.classList.add("disabled");
    try {
      const contacts = parseCsv(await file.text());
      if (!contacts.length) throw new Error("Aucune adresse e-mail valide trouvée dans ce fichier.");
      const unique = [...new Map(contacts.map(item => [item.email.toLowerCase(), item])).values()];
      const data = await api("importContacts", { contacts: unique });
      showNotice(`${data.imported || unique.length} contact(s) importé(s) sans doublons.`, "success");
      await loadContacts();
    } catch (error) { showNotice(error.message, "error"); }
    finally { button.classList.remove("disabled"); $("#csvFile").value = ""; }
  };

  const templates = {
    ...window.KMWGrowthCampaigns,
    launch: { subject:"Kawaii Muslim World est enfin prêt ✨", preheader:"Découvrez un univers doux pour lire, apprendre et créer en famille.", title:"Une nouvelle aventure commence 🌙", body:"Assalamou alaykoum,\n\nC’est avec beaucoup d’émotion que je vous annonce l’ouverture de Kawaii Muslim World : un univers numérique doux et enrichissant pensé pour accompagner les enfants musulmans.\n\nHistoires autour de l’Islam, découvertes scientifiques, coloriages et espace parent vous attendent.", button:"Découvrir Kawaii Muslim World" },
    newbooks: { subject:"De nouveaux livres sont arrivés 📚", preheader:"De nouvelles histoires et activités attendent vos enfants.", title:"De nouvelles découvertes à partager", body:"Assalamou alaykoum,\n\nDe nouveaux livres viennent de rejoindre Kawaii Muslim World. Des histoires douces, des découvertes enrichissantes et des coloriages attendent les enfants.\n\nConnectez-vous pour les découvrir ensemble.", button:"Voir les nouveaux livres" },
    news: { subject:"Des nouvelles de Kawaii Muslim World 🌙", preheader:"Un petit message doux pour toute la famille.", title:"Une belle nouvelle à partager", body:"Assalamou alaykoum,\n\nAujourd’hui, j’avais envie de partager avec vous une nouveauté de l’univers Kawaii Muslim World.\n\nMerci de faire partie de cette belle aventure.", button:"Découvrir la nouveauté" }
  };
  const emailHtml = () => {
    const paragraphHtml = escapeHtml($("#emailBody").value).split(/\n{2,}/).map(p => `<p style="margin:0 0 18px;color:#4f5272;font-size:16px;line-height:1.72">${p.replace(/\n/g,"<br>")}</p>`).join("");
    return `<!doctype html><html><body style="margin:0;background:#f7f3f7;font-family:Arial,sans-serif;color:#292b51"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml($("#preheader").value)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3f7"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:24px;overflow:hidden"><tr><td align="center" style="padding:28px 24px 20px;background:#1b2258"><img src="https://www.kawaiimuslimworld.com/brand/assets/logo-kawaii-muslim.png" width="72" height="72" alt="Kawaii Muslim World" style="display:block;border-radius:50%;background:#fff7d1"><div style="margin-top:10px;color:#fff;font-size:19px;font-weight:700">Kawaii Muslim World</div></td></tr><tr><td align="center" style="padding:38px 34px 16px"><div style="color:#e477a7;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Un univers doux pour grandir</div><h1 style="margin:10px 0 18px;color:#292b51;font-size:34px;line-height:1.1">${escapeHtml($("#emailTitle").value)}</h1></td></tr><tr><td style="padding:0 38px 12px">${paragraphHtml}</td></tr><tr><td align="center" style="padding:12px 28px 42px"><a href="${escapeHtml($("#buttonUrl").value)}" style="display:inline-block;padding:15px 25px;border-radius:999px;background:#e477a7;color:#fff;text-decoration:none;font-size:16px;font-weight:700">${escapeHtml($("#buttonLabel").value)}</a></td></tr><tr><td align="center" style="padding:22px;background:#fff7ed;color:#85819a;font-size:11px;line-height:1.55">Vous recevez cet e-mail car vous avez demandé à suivre les nouveautés de Kawaii Muslim World.<br><a href="{{ unsubscribe }}" style="color:#777095">Se désinscrire</a> · <a href="https://www.kawaiimuslimworld.com/" style="color:#777095">kawaiimuslimworld.com</a></td></tr></table></td></tr></table></body></html>`;
  };
  const updatePreview = () => {
    $("#subjectCount").textContent = `${$("#subject").value.length}/60`; $("#preheaderCount").textContent = `${$("#preheader").value.length}/90`;
    $("#emailPreview").srcdoc = emailHtml().replace("{{ unsubscribe }}", "#");
    const draft = { subject:$("#subject").value,preheader:$("#preheader").value,title:$("#emailTitle").value,body:$("#emailBody").value,button:$("#buttonLabel").value,url:$("#buttonUrl").value,test:$("#testEmail").value };
    try { localStorage.setItem("km_newsletter_draft", JSON.stringify(draft)); } catch (_) {}
  };
  const applyTemplate = name => {
    const value = templates[name]; if (!value) return;
    $("#subject").value=value.subject; $("#preheader").value=value.preheader; $("#emailTitle").value=value.title; $("#emailBody").value=value.body; $("#buttonLabel").value=value.button;
    $("#buttonUrl").value=value.url || "https://www.kawaiimuslimworld.com/";
    $$(".template").forEach(button => button.classList.toggle("active", button.dataset.template === name)); updatePreview();
  };
  const restoreDraft = () => {
    try { const d=JSON.parse(localStorage.getItem("km_newsletter_draft")||"null"); if(!d)return; $("#subject").value=d.subject||""; $("#preheader").value=d.preheader||""; $("#emailTitle").value=d.title||""; $("#emailBody").value=d.body||""; $("#buttonLabel").value=d.button||""; $("#buttonUrl").value=d.url||""; $("#testEmail").value=d.test||""; } catch (_) {}
  };
  const campaignPayload = () => ({ subject:$("#subject").value.trim(), preheader:$("#preheader").value.trim(), html:emailHtml(), name:`${$("#subject").value.trim()} — ${new Date().toLocaleDateString("fr-FR")}` });
  const sendTest = async () => {
    const button=$("#sendTest"), email=$("#testEmail").value.trim(); if(!email) return showNotice("Indique l’adresse qui doit recevoir le test.","error");
    setBusy(button,true,"Envoi du test…"); try { await api("sendTest",{...campaignPayload(),email}); showNotice(`E-mail test envoyé à ${email}.`,"success"); } catch(error){showNotice(error.message,"error");} finally{setBusy(button,false);}
  };
  const openConfirmation = () => {
    const form=$("#campaignForm"); if(!form.reportValidity())return; $("#confirmText").textContent=`La campagne « ${$("#subject").value.trim()} » sera envoyée à tous les contacts actifs de la liste.`; $("#consentCheck").checked=false; $("#confirmSend").disabled=true; $("#confirmModal").hidden=false;
  };
  const sendCampaign = async () => {
    const button=$("#confirmSend"); setBusy(button,true,"Envoi en cours…");
    try { const data=await api("sendCampaign",campaignPayload()); $("#confirmModal").hidden=true; showNotice(`Campagne lancée avec succès${data.campaignId?` (n° ${data.campaignId})`:""}.`,"success"); switchView("history"); }
    catch(error){showNotice(error.message,"error");} finally{setBusy(button,false);}
  };
  const loadCampaigns = async () => {
    if(!state.config?.brevo)return;
    try { const data=await api("campaigns"); state.campaigns=data.campaigns||[]; $("#statCampaigns").textContent=data.count??state.campaigns.length; $("#campaignList").innerHTML=state.campaigns.map(item=>`<article class="campaign-row"><div><strong>${escapeHtml(item.subject||item.name)}</strong><small>${formatDate(item.sentDate||item.scheduledAt||item.createdAt)} · ${escapeHtml(item.status||"brouillon")}</small></div><div class="campaign-metric"><b>${item.statistics?.globalStats?.uniqueViews||0}</b><small>ouvertures</small></div><div class="campaign-metric"><b>${item.statistics?.globalStats?.clickers||0}</b><small>clics</small></div><div class="campaign-metric"><b>${item.statistics?.globalStats?.unsubscriptions||0}</b><small>désinscriptions</small></div></article>`).join("")||'<p class="empty">Aucune campagne envoyée pour le moment.</p>'; }
    catch(error){showNotice(error.message,"error");}
  };

  const initialize = async () => {
    try {
      if (["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).has("demo")) {
        state.context={profile:{full_name:"Kawaii Muslim",role:"admin"}};
        state.config={brevo:false,sender:true,formspree:true,shopify:true,senderEmail:"salam@kawaiimuslimworld.com"};
        $("#adminName").textContent="Kawaii Muslim"; $("#adminFirstName").textContent="Kawaii";
        renderStatus(); restoreDraft(); updatePreview(); $("#studio").hidden=false; $("#authLoader").remove(); document.body.classList.remove("is-loading"); switchView(location.hash.slice(1)&&titles[location.hash.slice(1)]?location.hash.slice(1):"dashboard"); return;
      }
      state.context=await KMAuth.getContext(); if(!state.context)return location.replace("/Connexion.dc.html?next=%2Fnewsletter%2F");
      if(state.context.profile.role!=="admin")return location.replace("/Profils.dc.html");
      const mfa=await KMAuth.getMFAStatus(); if(mfa.currentLevel!=="aal2")return location.replace(`/MFA.dc.html?next=${encodeURIComponent("/newsletter/")}`);
      $("#adminName").textContent=state.context.profile.full_name||"Administration"; $("#adminFirstName").textContent=(state.context.profile.full_name||"Maman").split(" ")[0];
      state.config=await api("status"); renderStatus(); restoreDraft(); updatePreview();
      $("#studio").hidden=false; $("#authLoader").remove(); document.body.classList.remove("is-loading");
      switchView(location.hash.slice(1)&&titles[location.hash.slice(1)]?location.hash.slice(1):"dashboard");
      if(state.config.brevo){loadContacts();loadCampaigns();}
    } catch(error){$("#authLoader").innerHTML=`<strong>Impossible d’ouvrir le studio.</strong><small>${escapeHtml(error.message)}</small>`;}
  };

  $$(".nav-item").forEach(button=>button.addEventListener("click",()=>switchView(button.dataset.view)));
  $$('[data-open-view]').forEach(button=>button.addEventListener("click",()=>switchView(button.dataset.openView)));
  $("#mobileMenu").addEventListener("click",()=>$(".studio-sidebar").classList.toggle("open"));
  $("#syncFormspree").addEventListener("click",()=>syncSource("formspree",$("#syncFormspree")));
  $("#syncShopify").addEventListener("click",()=>syncSource("shopify",$("#syncShopify")));
  $("#csvFile").addEventListener("change",event=>event.target.files[0]&&importCsv(event.target.files[0]));
  $("#refreshContacts").addEventListener("click",loadContacts); $("#contactSearch").addEventListener("input",renderContacts); $("#sourceFilter").addEventListener("change",renderContacts);
  $$(".composer-form input,.composer-form textarea").forEach(input=>input.addEventListener("input",updatePreview));
  $$(".template").forEach(button=>button.addEventListener("click",()=>applyTemplate(button.dataset.template)));
  $$(".device").forEach(button=>button.addEventListener("click",()=>{$$(".device").forEach(item=>item.classList.toggle("active",item===button));$(".email-preview-wrap").classList.toggle("mobile",button.dataset.device==="mobile");}));
  $("#sendTest").addEventListener("click",sendTest); $("#campaignForm").addEventListener("submit",event=>{event.preventDefault();openConfirmation();});
  $("#consentCheck").addEventListener("change",event=>$("#confirmSend").disabled=!event.target.checked); $("#cancelSend").addEventListener("click",()=>$("#confirmModal").hidden=true); $("#confirmSend").addEventListener("click",sendCampaign);
  $("#refreshCampaigns").addEventListener("click",loadCampaigns);
  initialize();
})();
