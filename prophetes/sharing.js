(()=>{'use strict';
const base='https://www.kawaiimuslimworld.com/prophetes/';
const panel=document.getElementById('share-panel'),status=document.getElementById('share-status'),field=document.getElementById('share-url');
let payload={};
function sharePayload(index){const card=Number.isInteger(index)&&index>=0&&index<names.length;const url=new URL(base);if(card){url.searchParams.set('prophet',index);url.searchParams.set('shared','1')}return {title:card?'Découvre '+names[index]+' · Kawaii Muslim World':'Le jardin des 25 prophètes',text:card?'Une carte gratuite pour découvrir '+names[index]+' en famille 🌿':'Une activité gratuite pour découvrir les 25 prophètes avec les enfants 🌿',url:url.href}}
function record(action,index){window.dispatchEvent(new CustomEvent('kmw:prophets-action',{detail:{action,prophet:Number.isInteger(index)?index:null}}));try{const k='kmw-prophets-actions-v1';const counts=JSON.parse(localStorage.getItem(k)||'{}');counts[action]=(Number(counts[action])||0)+1;localStorage.setItem(k,JSON.stringify(counts))}catch{}}
function fallback(data){payload=data;field.value=data.url;document.getElementById('share-whatsapp').href='https://wa.me/?text='+encodeURIComponent(data.text+' '+data.url);panel.hidden=false;document.getElementById('share-dialog').showModal();status.textContent='Choisis WhatsApp ou copie le lien pour l’envoyer.';document.getElementById('share-copy').focus()}
async function share(index){const data=sharePayload(index);record('share_open',index);if(typeof navigator.share==='function'){try{await navigator.share(data);record('share_completed',index);return}catch(e){if(e.name==='AbortError')return}}fallback(data)}
const collectionShare=document.getElementById('share-collection');if(collectionShare)collectionShare.onclick=()=>share();document.getElementById('share-card').onclick=()=>share(current);
document.getElementById('share-copy').onclick=async()=>{try{if(!navigator.clipboard)throw Error();await navigator.clipboard.writeText(payload.url);status.textContent='Lien copié ! Tu peux maintenant l’envoyer.';record('share_link_copied')}catch{field.focus();field.select();status.textContent='Sélectionne et copie le lien ci-dessus.'}};
document.getElementById('share-whatsapp').onclick=()=>record('share_whatsapp_open');
document.getElementById('share-panel-close').onclick=()=>{document.getElementById('share-dialog').close()};
function reflection(){const d=document.getElementById('prophet-reflection');d.open=false;document.getElementById('reflection-answer').textContent=content[current].bubbles[3].body}
window.addEventListener('kmw:prophet-open',reflection);if(reader.open)reflection();
document.querySelectorAll('.kmw-free-top,.kmw-free-button').forEach(a=>{a.addEventListener('click',()=>record('explore_free_kmw'));const u=new URL(a.href);u.searchParams.set('utm_source','jardin_prophetes');u.searchParams.set('utm_medium','referral');a.href=u.href});
if(new URLSearchParams(location.search).get('weekly')==='1'){show(window.KMWeeklyProphet.indexForDate());record('weekly_open')}
window.KMProphetsSharing={sharePayload};
})();