/* Same KMW membership checks, with a public first escale instead of a page-wide redirect. */
(()=>{'use strict';
const test=document.documentElement.dataset.access==='test';
const access=window.KMArabicAccess={full:test,status:test?'test':'checking'};
function set(full,status){access.full=full;access.status=status;window.dispatchEvent(new Event('km-arabic-access'))}
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)})}
let pending=false,client;
async function check(){if(test||pending)return;pending=true;set(false,'checking');try{
 if(!window.supabase)await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
 if(!window.KM_CONFIG)await load('/km-config.js');
 const c=window.KM_CONFIG;if(!c?.supabaseUrl||!c?.supabaseAnonKey)throw Error('Missing config');
 if(!client){client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')set(false,'guest');if(event==='SIGNED_IN')setTimeout(check,0)})}
 const result=await client.auth.getSession();if(result.error)throw result.error;
 const session=result.data?.session;if(!session){set(false,'guest');return}
 const [p,s]=await Promise.all([client.from('profiles').select('role,is_active').eq('id',session.user.id).single(),client.rpc('get_family_subscription').maybeSingle()]);
 const profile=p.data,sub=s.data;
 if(profile&&profile.is_active!==false&&['admin','support','content_admin'].includes(profile.role)){set(true,'member');return}
 if(p.error||s.error)throw Error('Access unavailable');
 set(!!(profile&&profile.is_active!==false&&sub&&['active','trialing','past_due'].includes(sub.status)),'member-checked');
 }catch{set(false,'error')}finally{pending=false}}
if(test)document.addEventListener('DOMContentLoaded',()=>{const badge=document.querySelector('.test');const button=document.createElement('button');button.className='secondary access-preview-toggle';button.textContent='Tester la vue visiteur';button.addEventListener('click',()=>{set(!access.full,access.full?'guest':'test');button.textContent=access.full?'Tester la vue visiteur':'Revenir à mon accès complet';if(badge)badge.textContent=access.full?'Test · accès complet':'Test · vue visiteur'});document.querySelector('header').after(button)});
window.KMArabicRefresh=check;if(!test){check();window.addEventListener('pageshow',e=>{if(e.persisted)check()})}
})();
