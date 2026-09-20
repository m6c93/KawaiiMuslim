export const portalHome=new URL('../../coran-licence/',import.meta.url);
export const page=name=>new URL(name,portalHome).href;
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function client(){if(!window.KMAuth)throw Error('Le service de connexion ne peut pas se charger.');return window.KMAuth.client()}
export async function portal(action,payload={}){const {data,error}=await client().rpc('quran_portal',{action,payload});if(error)throw error;return data}
export async function messaging(action,payload={}){const {data,error}=await client().rpc('quran_messaging',{action,payload});if(error)throw error;return data}
export function message(error){const text=String(error?.message||error);if(/fetch|network/i.test(text))return 'Connexion interrompue. Vérifiez votre réseau puis réessayez. Rien n’a été confirmé.';if(/quran_portal|schema cache/i.test(text))return 'L’espace réel est en cours de préparation. Les données de démonstration restent dans leur espace séparé.';return window.KMAuth?.friendlyError(error)||text}
export async function requireContext(){
 const {data,error}=await client().auth.getUser();
 if(error||!data.user){location.replace(page('inscription.html?mode=login'));return null}
 const context=await portal('context');
 if(context.needsMfa){location.replace(page('securite.html'));return null}
 return context;
}
export function invitationLink(token){const url=new URL('invitation.html',portalHome);url.hash=token;return url.href}
export async function copyInvitation(token){const link=invitationLink(token);try{await navigator.clipboard.writeText(link)}catch{}return link}
export function downloadCsv(filename,rows){const csv=rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export async function sendInvitation(token){
 const {data}=await client().auth.getSession();
 const response=await fetch('/api/quran-invitation',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session?.access_token||''}`},body:JSON.stringify({token})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.sent)throw Error(result.error||'Aucun envoi confirmé. Réessayez depuis cet accès.');
 return result;
}
