'use strict';
// Server only: Auth proof is emailed to the verified invitation recipient and
// is NEVER returned to the inviting teacher/admin or written to logs.
const BASE='https://coran.kawaiimuslimworld.com';
const AUTH=process.env.SUPABASE_URL||'https://pasgxojzybmvbjhuokkk.supabase.co';
const ANON=process.env.SUPABASE_ANON_KEY||'sb_publishable_JfiHxlqfI8pXr4Emho4vOw_QBePfSHm';
const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function request(url,headers,body){
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw fail(r.status===401||r.status===403?403:502,'L’envoi n’a pas abouti. Réessayez depuis cet accès.');
 return data;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const reply=(code,data)=>res.status(code).json(data);
 if(req.method!=='POST')return reply(405,{error:'Méthode non autorisée.'});
 let claim;
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const serviceHeaders={apikey:service,Authorization:`Bearer ${service}`};
 const finish=payload=>request(`${AUTH}/rest/v1/rpc/quran_invitation_delivery`,serviceHeaders,{action:'finish',payload});
 try{
  if(![BASE,'https://www.kawaiimuslimworld.com','https://kawaiimuslimworld.com'].includes(req.headers.origin))throw fail(403,'Origine non autorisée.');
  if(!service||!process.env.BREVO_API_KEY)throw fail(503,'L’envoi des invitations doit encore être activé par l’administration. Aucun e-mail n’a été envoyé.');
  const auth=req.headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth))throw fail(401,'Reconnectez-vous pour envoyer l’invitation.');
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||Object.keys(body).some(k=>k!=='token')||!/^[a-f0-9]{64}$/.test(body.token||''))throw fail(400,'Invitation invalide.');
  claim=await request(`${AUTH}/rest/v1/rpc/quran_invitation_delivery`,{apikey:ANON,Authorization:auth},{action:'claim',payload:{token:body.token}});
  const proof=await request(`${AUTH}/auth/v1/admin/generate_link`,serviceHeaders,{
   type:claim.existing?'magiclink':'invite',email:claim.email,
   ...(!claim.existing?{data:{full_name:claim.name}}:{}),
   redirect_to:`${BASE}/coran-licence/invitation.html`
  });
  if(!proof.hashed_token||!['invite','magiclink'].includes(proof.verification_type))throw fail(502,'Le lien sécurisé n’a pas pu être préparé.');
  const fragment=new URLSearchParams({invitation:body.token,proof:proof.hashed_token,type:proof.verification_type,setup:claim.needsPassword?'1':'0'});
  const url=`${BASE}/coran-licence/invitation.html#${fragment}`;
  const sent=await request('https://api.brevo.com/v3/smtp/email',{'api-key':process.env.BREVO_API_KEY},{
   sender:{email:process.env.NEWSLETTER_SENDER_EMAIL||'salam@kawaiimuslimworld.com',name:'Kawaii Muslim Coran'},
   to:[{email:claim.email,name:claim.name||claim.email}],
   subject:'Votre accès à Kawaii Muslim Coran est prêt',
   htmlContent:`<div style="background:#f4f2e6;padding:30px;font-family:Arial,sans-serif;color:#173f37"><div style="max-width:520px;margin:auto;background:#fffdf7;padding:30px;border-radius:20px"><p>🌳 Kawaii Muslim Coran</p><h1>Votre place vous attend</h1><p>Bonjour ${escape(claim.name)},</p><p>Votre accès à <strong>${escape(claim.organization)}</strong> a été créé.</p><p>${claim.needsPassword?'Cliquez ci-dessous pour choisir votre mot de passe et activer votre compte.':'Cliquez ci-dessous pour rejoindre votre espace avec votre compte existant.'}</p><p style="margin:30px 0"><a href="${escape(url)}" style="padding:15px 22px;background:#2f765b;color:white;border-radius:12px;text-decoration:none;font-weight:bold">${claim.needsPassword?'Créer mon compte':'Activer mon accès'}</a></p><p>Ce lien est personnel. Utilisez-le rapidement. S’il a expiré, demandez une nouvelle invitation à votre responsable.</p><p>Si la licence n’est pas encore active, votre responsable pourra l’activer après votre inscription.</p><p style="font-size:12px">Vous n’attendiez pas cet e-mail ? Ignorez-le. Ne partagez pas ce lien.</p></div></div>`,
   tags:['coran-invitation'],headers:{'X-Mailin-trackClick':'0','X-Mailin-trackOpen':'0'}
  });
  if(!sent.messageId)throw fail(502,'Le service e-mail n’a pas confirmé l’envoi.');
  await finish({id:claim.id,attempt:claim.attempt,sent:true,messageId:sent.messageId}).catch(()=>{});
  return reply(200,{sent:true});
 }catch(error){
  if(claim)await finish({id:claim.id,attempt:claim.attempt,sent:false}).catch(()=>{});
  return reply(error.status||502,{error:error.status?error.message:'Envoi interrompu. Vérifiez cet accès avant de réessayer.'});
 }
};
