(()=>{'use strict';
const statuses=new Set(['active','trialing','past_due']),staff=new Set(['admin','support','content_admin']);
const note=document.getElementById('salahAccessStatus'),retry=document.getElementById('salahAccessRetry');
const links=[...document.querySelectorAll('.premium-option,.overview-end .primary')];
let client=null,pending=null,state='checking';
function show(next,message){state=next;if(note)note.textContent=message;if(retry)retry.hidden=next!=='error';for(const link of links){if(next==='checking'||next==='error')link.setAttribute('aria-disabled','true');else link.removeAttribute('aria-disabled')}}
async function check(){
 if(!window.supabase||!window.KM_CONFIG)throw Error('Connexion indisponible');
 const config=window.KM_CONFIG;
 if(!config.supabaseUrl||!config.supabaseAnonKey)throw Error('Configuration indisponible');
 if(!client)client=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const sessionResult=await client.auth.getSession();if(sessionResult.error)throw sessionResult.error;
 const session=sessionResult.data?.session;if(!session)return false;
 const [profileResult,subscriptionResult]=await Promise.all([
  client.from('profiles').select('role,is_active').eq('id',session.user.id).single(),
  client.rpc('get_family_subscription').maybeSingle()
 ]);
 if(profileResult.error)throw profileResult.error;
 const profile=profileResult.data;
 if(!profile||profile.is_active===false)return false;
 if(staff.has(profile.role))return true;
 if(subscriptionResult.error)throw subscriptionResult.error;
 return !!subscriptionResult.data&&statuses.has(subscriptionResult.data.status);
}
function refresh(){
 if(pending)return pending;
 show('checking','Vérification de ton accès KMW…');
 pending=check().then(allowed=>{
  if(allowed){show('member','Ton abonnement est reconnu. Ouverture de Kawaii Salah…');window.location.replace(new URL('./',window.location.href).href)}
  else show('guest','Accès découverte · Les parcours guidés sont inclus dans Premium.');
 }).catch(()=>show('error','Impossible de vérifier ton abonnement pour le moment. Réessaie avant de choisir une formule.')).finally(()=>{pending=null});
 return pending;
}
for(const link of links)link.addEventListener('click',event=>{if(state==='checking'||state==='error'){event.preventDefault();refresh()}});
retry?.addEventListener('click',refresh);
window.addEventListener('focus',refresh);
window.addEventListener('pageshow',event=>{if(event.persisted)refresh()});
window.SalahAccess={check,refresh};
refresh();
})();
