import {mountClassroom} from '../applications/classroom/classroom.mjs';
import {DEMO_KEY,demoRequest,demoLink,createSharedDemo} from './shared-demo.mjs';
import {loadRecording} from '../applications/classroom/recordings.mjs';
import {esc} from '../applications/classroom/live-client.mjs';

const root=document.querySelector('#demoRoot'),params=new URLSearchParams(location.search);
const LOCAL_KEY='km-classroom-preview-v1:standalone-presentation-demo-v1';
const fragment=new URLSearchParams(location.hash.slice(1));
let token=fragment.get('demo'),context=null,cloud=null,currentView={};
const read=(key,store=localStorage)=>{try{return JSON.parse(store.getItem(key))}catch{return null}};
let owner=params.has('local')?null:read(DEMO_KEY);
if(!token&&owner)token=owner.token;
const note=document.querySelector('.demo-note');
document.querySelector('.demo-skip').onclick=e=>{e.preventDefault();root.scrollIntoView({block:'start'});root.focus()};
function updatePresentation(view){
 currentView=view;const {studentView,classId,studentId,studentName}=view;
 for(const link of document.querySelectorAll('[data-space]'))link.setAttribute('aria-current',link.dataset.space===(studentView?'student':'teacher')?'page':'false');
 document.querySelector('#demo-title').textContent=studentView?'Découvrez le côté élève.':'Découvrez le côté professeur.';
 document.querySelector('#demo-hint').textContent=studentView?`Explorez le jardin de ${studentName}, retrouvez les consignes et essayez Coran, Réciter et la messagerie si elle est activée.`:'Créez une classe, ajoutez vos élèves d’essai et partagez leur lien pour essayer ensemble, même sur un autre appareil.';
 if(context?.studentId){document.querySelector('.demo-switch').hidden=true;document.querySelector('.demo-help').hidden=true;document.querySelector('.brand').href=demoLink(token);return}
 const teacherParams=new URLSearchParams({view:'teacher'});if(classId)teacherParams.set('class-id',classId);if(params.has('local'))teacherParams.set('local','1');
 document.querySelector('[data-space="teacher"]').href='?'+teacherParams;
 const studentParams=studentId&&classId?new URLSearchParams({'class-id':classId,'student-id':studentId}):new URLSearchParams({student:'Maryam'});if(params.has('local'))studentParams.set('local','1');
 document.querySelector('[data-space="student"]').href='?'+studentParams;
}
function linkDialog(result,name,teacher=false){
 const dialog=document.createElement('dialog');dialog.className='cc-invite-dialog demo-share-dialog';
 dialog.innerHTML=`<h2>${teacher?'Retrouver mon espace professeur':`Le lien de ${esc(name)} est prêt`}</h2><p>${teacher?'Gardez ce lien pour retrouver votre session sur un autre ordinateur. Il donne accès au côté professeur.':'Transmettez ce lien à votre participant. Il ouvrira directement ce compte élève sur son téléphone ou ordinateur, sans inscription.'}</p><label>${teacher?'Mon lien professeur':'Lien élève'}<input readonly value="${esc(result.url)}"></label><p class="demo-note">Démo partagée jusqu’au ${new Date(result.expiresAt).toLocaleDateString('fr-FR')}. Les vrais comptes restent séparés.</p><div class="cc-row"><button type="button" data-copy class="cc-primary">Copier le lien</button>${teacher?'':`<a class="demo-open" href="${esc(result.url)}" target="_blank" rel="noopener">Ouvrir le compte élève ↗</a>`}<button type="button" data-close>Fermer</button></div><p role="status"></p>`;
 document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
 dialog.querySelector('input').onclick=e=>e.target.select();
 dialog.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(result.url);dialog.querySelector('[role="status"]').textContent='Lien copié. Vous pouvez le coller dans votre message.'}catch{dialog.querySelector('input').select();dialog.querySelector('[role="status"]').textContent='Sélectionnez puis copiez ce lien.'}};
}
async function startSharing(db,classId,studentId){
 // Preserve the complete local demo. Only an explicit share action starts a remote copy.
 let pending=read(DEMO_KEY+'-pending');if(!pending){pending={token:[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('')};localStorage.setItem(DEMO_KEY+'-pending',JSON.stringify(pending))}
 const snapshot=structuredClone(db),uploads=[];
 for(const c of snapshot.classes)for(const s of c.students){
  const ids=[...(s.submissions||[]).map(r=>r.id),...Object.values(s.trees).flatMap(t=>(t.verseComments||[]).map(m=>m.audioId).filter(Boolean))];
  const available=new Set();for(const id of new Set(ids)){const blob=await loadRecording(id);if(blob){uploads.push({classId:c.id,studentId:s.id,id,blob});available.add(id)}}
  s.submissions=(s.submissions||[]).filter(r=>available.has(r.id));
  for(const t of Object.values(s.trees))t.verseComments=(t.verseComments||[]).map(m=>m.audioId&&!available.has(m.audioId)?{...m,audioId:''}:m).filter(m=>m.text||m.audioId);
 }
 const settings=read(LOCAL_KEY+':messaging-v1')?.settings||{};
 const created=await demoRequest('create',{owner:pending.token,data:snapshot,settings});
 const adapter=createSharedDemo(pending.token,{});
 for(const u of uploads)await adapter.audioSave(u.classId,u.studentId,u.id,u.blob);
 const result=await adapter.share(classId,studentId);
 localStorage.setItem(DEMO_KEY,JSON.stringify({token:pending.token,expiresAt:created.expiresAt}));localStorage.removeItem(DEMO_KEY+'-pending');
 return result;
}
async function showDemoLink({db,classId,studentId,name,cloud:active}){
 const dialog=document.createElement('dialog');dialog.className='cc-invite-dialog';dialog.innerHTML='<h2>Préparation du lien élève…</h2><p role="status">La session de démonstration sera accessible sur plusieurs appareils pendant 14 jours. Utilisez des profils d’essai.</p>';document.body.append(dialog);dialog.showModal();
 try{
  const result=active?await active.share(classId,studentId):await startSharing(db,classId,studentId);
  dialog.close();dialog.remove();
  if(!active){sessionStorage.setItem(DEMO_KEY+'-result',JSON.stringify({result,name}));location.href='?view=teacher&class-id='+encodeURIComponent(classId);return}
  linkDialog(result,name);
 }catch(error){dialog.querySelector('[role="status"]').textContent=error.message;const close=document.createElement('button');close.textContent='Fermer et réessayer';close.onclick=()=>{dialog.close();dialog.remove()};dialog.append(close)}
}
try{
 if(token){
  context=await demoRequest('context',{},token);cloud=createSharedDemo(token,context);
  if(!context.studentId){localStorage.setItem(DEMO_KEY,JSON.stringify({token,expiresAt:context.expiresAt}));if(fragment.has('demo'))history.replaceState(null,'','?view=teacher')}
  note.textContent=`Démo partagée · Synchronisation entre appareils · Disponible jusqu’au ${new Date(context.expiresAt).toLocaleDateString('fr-FR')} · Comptes d’essai uniquement.`;
  if(!context.studentId){const btn=document.createElement('button');btn.className='demo-owner-link';btn.textContent='Retrouver mon espace professeur';btn.onclick=()=>linkDialog({url:demoLink(token),expiresAt:context.expiresAt},'',true);note.after(btn)}
 }
 await mountClassroom(root,{id:'standalone-presentation-demo-v1',role:'admin',full_name:'Professeur · Démonstration'},{
  cloud,studentName:cloud?null:params.get('student'),className:'Les oliviers',studentId:context?.studentId||(cloud?null:params.get('student-id')),classId:context?.classId||params.get('class-id'),previewPath:location.pathname,onViewChange:updatePresentation,shareDemo:true,showDemoLink
 });
 const studentLink=document.querySelector('[data-space="student"]');
 if(cloud&&!context.studentId)studentLink.onclick=async e=>{e.preventDefault();try{const db=await cloud.check(),c=db.classes.find(c=>c.id===currentView.classId)||db.classes[0],s=c?.students.find(s=>s.id===currentView.studentId)||c?.students[0];if(!s){note.textContent='Ajoutez un élève dans cette classe pour essayer son compte.';return}const link=await cloud.share(c.id,s.id);const target=new URL(link.url);if(location.search===target.search){location.hash=target.hash;location.reload()}else location.assign(link.url)}catch(error){note.textContent=error.message}};
 const pending=read(DEMO_KEY+'-result',sessionStorage);if(pending&&!context?.studentId){sessionStorage.removeItem(DEMO_KEY+'-result');linkDialog(pending.result,pending.name)}
}catch(error){
 console.error('Démonstration indisponible',error);
 root.innerHTML=`<section class="demo-error" role="alert"><h2>La démonstration n’a pas pu se charger.</h2><p>${esc(error.message)}</p><a href="">Réessayer</a> <a href="?local=1&view=teacher">Revenir à ma démo locale</a></section>`;
}finally{root.setAttribute('aria-busy','false')}
