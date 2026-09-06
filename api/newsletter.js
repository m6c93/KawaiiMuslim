const SUPABASE_URL = process.env.SUPABASE_URL || "https://pasgxojzybmvbjhuokkk.supabase.co";
const ALLOWED_SIGNUP_ORIGINS = new Set([
  "https://kawaiimuslim.com",
  "https://www.kawaiimuslim.com",
  "https://kawaiimuslimworld.com",
  "https://www.kawaiimuslimworld.com",
  "https://newsletter.kawaiimuslimworld.com"
]);

function allowSignupOrigin(req,res){
  const origin=String(req.headers.origin||"");
  if(origin&&ALLOWED_SIGNUP_ORIGINS.has(origin)){
    res.setHeader("Access-Control-Allow-Origin",origin);
    res.setHeader("Vary","Origin");
    res.setHeader("Access-Control-Allow-Headers","Content-Type");
    res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  }
  return !origin||ALLOWED_SIGNUP_ORIGINS.has(origin);
}

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_JfiHxlqfI8pXr4Emho4vOw_QBePfSHm";
const BREVO_API = "https://api.brevo.com/v3";
const BREVO_KEY = process.env.BREVO_API_KEY || "";
const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID || 0);
const SENDER_EMAIL = process.env.NEWSLETTER_SENDER_EMAIL || "salam@kawaiimuslimworld.com";
const SENDER_NAME = process.env.NEWSLETTER_SENDER_NAME || "Kawaii Muslim World";
const FORMSPREE_TOKEN = process.env.FORMSPREE_TOKEN || "";
const FORMSPREE_FORM_ID = process.env.FORMSPREE_FORM_ID || "xnjedkpy";
const SHOPIFY_STORE = String(process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || ""; const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || ""; const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || ""; let shopifyTokenCache = { value: "", expiresAt: 0 };

const json = (res, status, data) => { res.statusCode=status; res.setHeader("Content-Type","application/json; charset=utf-8"); res.setHeader("Cache-Control","no-store"); res.end(JSON.stringify(data)); };
const readBody = req => new Promise((resolve,reject)=>{let raw="";req.on("data",chunk=>{raw+=chunk;if(raw.length>2_000_000)reject(new Error("Requête trop volumineuse."));});req.on("end",()=>{try{resolve(JSON.parse(raw||"{}"));}catch(error){reject(new Error("Données invalides."));}});req.on("error",reject);});
const decodeJwt = token => { try { return JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8")); } catch (_) { return {}; } };
const cleanEmail = value => String(value||"").trim().toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(value));
const safeText = (value,max=2000) => String(value||"").trim().slice(0,max);

async function authenticateAdmin(req){
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""); if(!token)throw Object.assign(new Error("Connexion requise."),{status:401});
  const claims=decodeJwt(token); if(claims.aal&&claims.aal!=="aal2")throw Object.assign(new Error("Double authentification requise."),{status:403});
  const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}}); if(!userResponse.ok)throw Object.assign(new Error("Session expirée."),{status:401});
  const user=await userResponse.json();
  const profileResponse=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active&limit=1`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}});
  const profiles=profileResponse.ok?await profileResponse.json():[]; const profile=profiles[0];
  if(!profile||profile.role!=="admin"||!profile.is_active)throw Object.assign(new Error("Accès administratrice requis."),{status:403});
  return user;
}
async function brevo(path,options={}){
  if(!BREVO_KEY)throw Object.assign(new Error("Le service d’envoi doit encore être connecté."),{status:503});
  const response=await fetch(`${BREVO_API}${path}`,{...options,headers:{accept:"application/json","api-key":BREVO_KEY,...(options.body?{"content-type":"application/json"}:{}),...(options.headers||{})}});
  const data=await response.json().catch(()=>({})); if(!response.ok)throw Object.assign(new Error(data.message||"Le service d’envoi a refusé la demande."),{status:response.status}); return data;
}
function normalizeContacts(items,source){
  const map=new Map(); for(const raw of items||[]){const email=cleanEmail(raw.email);if(!validEmail(email))continue;map.set(email,{email,attributes:{PRENOM:safeText(raw.firstName||raw.firstname||raw.name,80),NOM:safeText(raw.lastName||raw.lastname,80),SOURCE:safeText(raw.source||source||"Newsletter",80)}});} return [...map.values()];
}
async function importContacts(items,source){
  if(!BREVO_LIST_ID)throw Object.assign(new Error("La liste d’envoi doit encore être configurée."),{status:503});
  const contacts=normalizeContacts(items,source); if(!contacts.length)return {imported:0}; if(contacts.length>10000)throw Object.assign(new Error("Import limité à 10 000 contacts à la fois."),{status:400});
  await ensureContactAttribute("SOURCE"); const result=await brevo("/contacts/import",{method:"POST",body:JSON.stringify({jsonBody:contacts,listIds:[BREVO_LIST_ID],updateExistingContacts:true,emptyContactsAttributes:false,emailBlacklist:false,smsBlacklist:false})}); return {imported:contacts.length,processId:result.processId};
}
async function formspreeContacts(){
  if(!FORMSPREE_TOKEN)throw Object.assign(new Error("Formspree doit encore être connecté au studio."),{status:503});
  const response=await fetch(`https://formspree.io/api/0/forms/${encodeURIComponent(FORMSPREE_FORM_ID)}/submissions?limit=1000`,{headers:{Authorization:`Bearer ${FORMSPREE_TOKEN}`,Accept:"application/json"}}); const data=await response.json().catch(()=>({})); if(!response.ok)throw Object.assign(new Error(data.error||"Impossible de lire la liste Formspree."),{status:response.status});
  const rows=Array.isArray(data)?data:(data.submissions||[]); return rows.map(item=>{const values=item.data||item;return{email:values.email||values._replyto||values.Email,firstName:values.firstname||values.prenom||values.name||"",lastName:values.lastname||values.nom||"",source:"Formspree"};});
}
async function shopifyAccessToken(){if(SHOPIFY_TOKEN)return SHOPIFY_TOKEN;if(!SHOPIFY_STORE||!SHOPIFY_CLIENT_ID||!SHOPIFY_CLIENT_SECRET)throw Object.assign(new Error("Shopify doit encore être connecté au studio."),{status:503});if(shopifyTokenCache.value&&shopifyTokenCache.expiresAt>Date.now()+60000)return shopifyTokenCache.value;const response=await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:SHOPIFY_CLIENT_ID,client_secret:SHOPIFY_CLIENT_SECRET,grant_type:"client_credentials"})});const data=await response.json().catch(()=>({}));if(!response.ok||!data.access_token)throw Object.assign(new Error(data.error_description||data.error||"Impossible d’autoriser la lecture des abonnés Shopify."),{status:response.status||502});const lifetime=Math.max(300,Number(data.expires_in)||86400);shopifyTokenCache={value:data.access_token,expiresAt:Date.now()+(lifetime-120)*1000};return shopifyTokenCache.value;} async function shopifyContacts(){
  if(!SHOPIFY_STORE)throw Object.assign(new Error("Shopify doit encore être connecté au studio."),{status:503}); const accessToken=await shopifyAccessToken();
  const contacts=[]; let cursor=null; let hasNext=true; let pages=0;
  while(hasNext&&pages<20){const query=`query NewsletterCustomers($cursor:String){customers(first:250,after:$cursor,query:"accepts_marketing:true"){nodes{id firstName lastName defaultEmailAddress{emailAddress marketingState}}pageInfo{hasNextPage endCursor}}}`; const response=await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-07/graphql.json`,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":accessToken},body:JSON.stringify({query,variables:{cursor}})}); const data=await response.json().catch(()=>({})); if(!response.ok||data.errors)throw Object.assign(new Error(data.errors?.[0]?.message||"Impossible de lire les contacts Shopify."),{status:response.status||502}); const connection=data.data?.customers; for(const customer of connection?.nodes||[]){const address=customer.defaultEmailAddress;if(address?.emailAddress&&address.marketingState==="SUBSCRIBED")contacts.push({email:address.emailAddress,firstName:customer.firstName,lastName:customer.lastName,source:"Shopify"});}hasNext=!!connection?.pageInfo?.hasNextPage;cursor=connection?.pageInfo?.endCursor;pages++;}
  return contacts;
}
function validateCampaign(body){const subject=safeText(body.subject,60),html=String(body.html||""),name=safeText(body.name||subject,120),preheader=safeText(body.preheader,90);if(!subject||!html||html.length>250000)throw Object.assign(new Error("Le contenu de la campagne est incomplet."),{status:400});if(!/^https?:\/\//i.test(String(body.html).match(/href="([^"]+)"/)?.[1]||"https://www.kawaiimuslimworld.com")){}return{subject,html,name,preheader};}

module.exports=async(req,res)=>{
  if(req.method!=="POST")return json(res,405,{error:"Méthode non autorisée."});
  try{
    await authenticateAdmin(req); const body=await readBody(req); const action=body.action;
    if(action==="status")return json(res,200,{brevo:!!(BREVO_KEY&&BREVO_LIST_ID),sender:!!(BREVO_KEY&&BREVO_LIST_ID&&SENDER_EMAIL),formspree:!!FORMSPREE_TOKEN,shopify:!!(SHOPIFY_STORE&&(SHOPIFY_TOKEN||(SHOPIFY_CLIENT_ID&&SHOPIFY_CLIENT_SECRET))),senderEmail:SENDER_EMAIL});
    if(action==="importContacts")return json(res,200,await importContacts(body.contacts,"CSV"));
    if(action==="syncFormspree"){const contacts=await formspreeContacts();return json(res,200,await importContacts(contacts,"Formspree"));}
    if(action==="syncShopify"){const contacts=await shopifyContacts();return json(res,200,await importContacts(contacts,"Shopify"));}
    if(action==="contacts"){if(!BREVO_LIST_ID)throw Object.assign(new Error("La liste d’envoi doit encore être configurée."),{status:503});const data=await brevo(`/contacts/lists/${BREVO_LIST_ID}/contacts?limit=500&offset=0&sort=desc`);const contacts=(data.contacts||[]).filter(item=>!item.emailBlacklisted&&!(item.listUnsubscribed||[]).includes(BREVO_LIST_ID));return json(res,200,{contacts,count:contacts.length,total:data.count||0});}
    if(action==="campaigns"){const data=await brevo("/emailCampaigns?type=classic&limit=30&offset=0&sort=desc");return json(res,200,{campaigns:data.campaigns||[],count:data.count||0});}
    if(action==="sendTest"){const campaign=validateCampaign(body),email=cleanEmail(body.email);if(!validEmail(email))throw Object.assign(new Error("Adresse de test invalide."),{status:400});const data=await brevo("/smtp/email",{method:"POST",body:JSON.stringify({sender:{name:SENDER_NAME,email:SENDER_EMAIL},to:[{email}],replyTo:{email:SENDER_EMAIL,name:SENDER_NAME},subject:`[TEST] ${campaign.subject}`,htmlContent:campaign.html.replace(/{{\s*unsubscribe\s*}}/gi,"https://www.kawaiimuslimworld.com/")})});return json(res,200,{messageId:data.messageId});}
    if(action==="sendCampaign"){if(!BREVO_LIST_ID)throw Object.assign(new Error("La liste d’envoi doit encore être configurée."),{status:503});const campaign=validateCampaign(body);const created=await brevo("/emailCampaigns",{method:"POST",body:JSON.stringify({name:campaign.name,subject:campaign.subject,previewText:campaign.preheader,sender:{name:SENDER_NAME,email:SENDER_EMAIL},replyTo:SENDER_EMAIL,type:"classic",htmlContent:campaign.html,recipients:{listIds:[BREVO_LIST_ID]},inlineImageActivation:false,mirrorActive:false})});await brevo(`/emailCampaigns/${created.id}/sendNow`,{method:"POST"});return json(res,200,{campaignId:created.id});}
    return json(res,400,{error:"Action inconnue."});
  }catch(error){console.error("newsletter-api",error);return json(res,error.status||500,{error:error.message||"Erreur interne."});}
};

async function ensureContactAttribute(name){
  const current=await brevo("/contacts/attributes");
  if((current.attributes||[]).some(attribute=>attribute.name===name))return;
  await brevo(`/contacts/attributes/normal/${encodeURIComponent(name)}`,{method:"POST",body:JSON.stringify({type:"text"})});
}

async function subscribeFromLanding(body){
  const email=cleanEmail(body.email);
  if(body.website)return {subscribed:true};
  if(!validEmail(email))throw Object.assign(new Error("Adresse e-mail invalide."),{status:400});
  if(!BREVO_LIST_ID)throw Object.assign(new Error("La liste d inscription n est pas encore disponible."),{status:503});
  await ensureContactAttribute("KM_SOURCE");
  await ensureContactAttribute("KM_CONSENT_AT");
  await brevo("/contacts",{method:"POST",body:JSON.stringify({email,listIds:[BREVO_LIST_ID],updateEnabled:true,attributes:{KM_SOURCE:"Landing page Kawaii Muslim",KM_CONSENT_AT:new Date().toISOString()}})});
  return {subscribed:true};
}

const newsletterAdminHandler=module.exports;
module.exports=async(req,res)=>{
  const action=new URL(req.url,"https://www.kawaiimuslimworld.com").searchParams.get("action");
  const signupOriginAllowed=allowSignupOrigin(req,res);
  if(req.method==="OPTIONS")return res.end();
  if(action!=="subscribe")return newsletterAdminHandler(req,res);
  if(req.method!=="POST")return json(res,405,{error:"Méthode non autorisée."});
  try{
    if(!signupOriginAllowed)throw Object.assign(new Error("Origine non autorisée."),{status:403});
    const body=await readBody(req);
    return json(res,200,await subscribeFromLanding(body));
  }catch(error){
    console.error("newsletter-signup",error);
    return json(res,error.status||500,{error:error.message||"Erreur interne."});
  }
};
