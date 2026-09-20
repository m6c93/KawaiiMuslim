import {localAttendance,remoteAttendance,mountAttendanceSummary} from './attendance.mjs';
import {esc,portal,client,invitationLink} from './live-client.mjs';
import {demoClasses} from './demo.mjs';
import {shareSchoolTeacher,sharedTeacherClasses} from './school-sharing.mjs';
import {demoLink} from '../../presentation-coran/shared-demo.mjs';
const KEY='km-school-demo-v1';
export const schoolTeacherKey=id=>`km-classroom-preview-v1:school-demo-${id}`;
const read=(key,fallback)=>{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
export async function schoolDemo(){
 let school=read(KEY,null);
 if(!school){
  const r=await fetch(new URL('../coran/data/index.json',import.meta.url));if(!r.ok)throw Error('Catalogue indisponible');
  const classes=demoClasses(await r.json());
  school={name:'École des Oliviers',teachers:[{id:'sarah',name:'Mme Sarah'},{id:'youssef',name:'M. Youssef'}]};
  for(const [i,t]of school.teachers.entries())write(schoolTeacherKey(t.id),{classes:classes.filter((_,n)=>n%2===i),demoV2:true,demoReviewV3:true,demoVerseCommentsV1:true});
  write(KEY,school);
 }
 return {
  async load(){school=read(KEY,school);const classes=[];for(const t of school.teachers){let db=read(schoolTeacherKey(t.id),{classes:[]});if(t.shareExpiresAt){db={...db,classes:await sharedTeacherClasses(t)};write(schoolTeacherKey(t.id),db)}classes.push(...db.classes.map(c=>({...c,teacherId:t.id})))}return {...school,invites:[],classes}},
  async attendance(){school=read(KEY,school);const parts=await Promise.all(school.teachers.map(t=>t.shareExpiresAt?remoteAttendance({token:t.shareToken}).load():localAttendance(schoolTeacherKey(t.id)).load()));return Object.assign({},...parts)},
  async invite(id){school=read(KEY,school);const t=school.teachers.find(t=>t.id===id);if(!t)throw Error('Professeur introuvable');if(t.shareExpiresAt)return {url:demoLink(t.shareToken),expiresAt:t.shareExpiresAt};return shareSchoolTeacher(t,read(schoolTeacherKey(id),{classes:[]}),read(schoolTeacherKey(id)+':messaging-v1',{})?.settings||{},()=>write(KEY,school))},
  async add(name){const t={id:crypto.randomUUID(),name};const next=read(KEY,school);next.teachers.push(t);write(schoolTeacherKey(t.id),{classes:[],demoV2:true,demoReviewV3:true,demoVerseCommentsV1:true});write(KEY,next);return {url:schoolTeacherUrl(t.id),local:true}},
  async reassign(id,teacherId){const state=await this.load(),c=state.classes.find(c=>c.id===id);if(!c||!state.teachers.some(t=>t.id===teacherId))throw Error('Classe ou professeur introuvable');if(c.teacherId===teacherId)return;if(state.teachers.some(t=>(t.id===c.teacherId||t.id===teacherId)&&t.shareExpiresAt))throw Error('Une classe partagée reste rattachée à son professeur dans cet essai. Le transfert est disponible dans les vrais comptes École.');const oldId=c.teacherId;const old=read(schoolTeacherKey(oldId),{classes:[]}),next=read(schoolTeacherKey(teacherId),{classes:[]});delete c.teacherId;next.classes.push(c);write(schoolTeacherKey(teacherId),next);old.classes=old.classes.filter(x=>x.id!==id);write(schoolTeacherKey(oldId),old);}
 };
}
export function schoolTeacherUrl(id,classId){const u=new URL(location.pathname,location.origin);u.searchParams.set('local','1');u.searchParams.set('school-teacher',id);u.searchParams.set('view','teacher');if(classId)u.searchParams.set('class-id',classId);return u.href}
export function schoolLive(organization){return {
 attendance:()=>remoteAttendance({organization}).load(),
 async load(){const {data,error}=await client().rpc('quran_school',{action:'snapshot',payload:{organization}});if(error)throw error;return data},
 async add(name,email){const r=await portal('invite',{organization,name,email,role:'teacher'});return {url:invitationLink(r.token)}},
 async reassign(classId,teacherId){const {error}=await client().rpc('quran_school',{action:'reassign',payload:{organization,classId,teacherId}});if(error)throw error}
}}
export async function mountSchool(root,{adapter,demo=false,openClass}){
 if(!document.querySelector('link[data-school-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./school.css',import.meta.url);css.dataset.schoolStyle='';document.head.append(css)}
 root.classList.add('school-space');let data,busy=false,tab='teachers',notice='';
 const link=(t,c)=>{const teacher=data?.teachers.find(x=>x.id===t);if(demo&&teacher?.shareExpiresAt){const u=new URL(demoLink(teacher.shareToken));if(c)u.searchParams.set('class-id',c);return u.href}return demo?schoolTeacherUrl(t,c):openClass(c)};
 const total=c=>c.students?.length||0;
 async function refresh(){data=await adapter.load();render()}
 function render(){
  const students=data.classes.flatMap(c=>c.students||[]),validated=students.reduce((n,s)=>n+Object.values(s.trees||{}).filter(t=>t.completedAt).length,0);
  root.innerHTML=`<section class="school-hero"><span>🏫 ESPACE DIRECTION${demo?' · DÉMONSTRATION':''}</span><h2>${esc(data.name)}</h2><p>Vous réunissez l’équipe. Vos professeurs font grandir leurs classes.</p></section><div class="school-stats">${[[data.teachers.length,'professeurs'],[data.classes.length,'classes'],[students.length,'élèves'],[validated,'sourates validées']].map(([n,l])=>`<div><strong>${n}</strong><span>${l}</span></div>`).join('')}</div><nav class="school-tabs" aria-label="Votre école">${[['teachers','Professeurs'],['classes','Classes'],['progress','Suivi des élèves'],['attendance','Présences']].map(([id,label])=>`<button data-tab="${id}" aria-current="${tab===id?'page':'false'}">${label}</button>`).join('')}</nav><p role="status">${esc(notice)}</p><div class="school-content"></div>`;
  const content=root.querySelector('.school-content');
  if(tab==='attendance')mountAttendanceSummary(content,data.classes,()=>adapter.attendance());
  if(tab==='teachers')content.innerHTML=`<form class="school-add"><h3>Ajouter un professeur de Coran</h3><p>Il pourra créer ses classes et accompagner ses élèves.</p><label>Nom du professeur<input name="name" required maxlength="80" placeholder="Ex. Mme Fatima"></label>${demo?'':'<label>Son adresse e-mail<input name="email" type="email" required></label>'}<button>Ajouter le professeur</button>${demo?'<small>Ajoutez le professeur, puis cliquez sur Inviter pour lui transmettre son accès de démonstration.</small>':'<small>Vous pourrez copier son invitation personnelle et la lui transmettre.</small>'}</form><div class="school-grid">${data.teachers.map(t=>`<article><h3><span aria-hidden="true">📏</span> ${esc(t.name)}</h3><p>${data.classes.filter(c=>c.teacherId===t.id).length} classe(s) · ${data.classes.filter(c=>c.teacherId===t.id).reduce((n,c)=>n+total(c),0)} élèves</p>${demo?`<a class="school-button" href="${esc(link(t.id))}">Ouvrir son espace professeur →</a><button type="button" data-invite="${esc(t.id)}">Inviter · Copier son lien</button>`:''}</article>`).join('')||'<p>Ajoutez votre premier professeur pour commencer.</p>'}</div>${data.invites?.length?`<h3>Invitations en attente</h3>${data.invites.map(i=>`<p>${esc(i.name)} · ${esc(i.email)}</p>`).join('')}`:''}`;
  if(tab==='classes')content.innerHTML=`<p>Chaque professeur crée ses classes depuis son espace. Vous retrouvez toute l’école ici.</p><div class="school-grid">${data.classes.map(c=>`<article><h3>${esc(c.name)}</h3><p>${total(c)} élèves · ${esc(data.teachers.find(t=>t.id===c.teacherId)?.name||'À attribuer')}</p><a class="school-button" href="${esc(link(c.teacherId,c.id))}">Voir la classe →</a><label>Professeur responsable<select data-class="${esc(c.id)}"><option value="">Choisir un professeur</option>${data.teachers.map(t=>`<option value="${esc(t.id)}" ${t.id===c.teacherId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label></article>`).join('')||'<p>Vos professeurs peuvent maintenant créer leur première classe.</p>'}</div>`;
  if(tab==='progress')content.innerHTML=`<div class="school-grid">${data.classes.map(c=>`<article><h3>${esc(c.name)}</h3>${(c.students||[]).map(s=>`<div class="school-pupil"><strong>${esc(s.name)}</strong><span>${Object.values(s.trees||{}).filter(t=>t.completedAt).length} sourate(s) validée(s)</span></div>`).join('')||'<p>Aucun élève pour le moment.</p>'}<a class="school-button" href="${esc(link(c.teacherId,c.id))}">Ouvrir les jardins →</a></article>`).join('')||'<p>Le suivi apparaîtra dès l’arrivée des premières classes.</p>'}</div>`;
  root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;notice='';render()});
  root.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);await run(async()=>{const r=await adapter.add(String(f.get('name')).trim(),String(f.get('email')||''));await refresh();notice='Professeur ajouté.';render();const box=document.createElement('div');box.className='school-invite';const a=document.createElement('a');a.href=r.url;a.textContent=demo?'Ouvrir son espace d’essai →':'Ouvrir son invitation →';box.append(a);if(!r.local){const input=document.createElement('input');input.readOnly=true;input.value=r.url;input.setAttribute('aria-label','Lien d’invitation');box.append(input);const copy=document.createElement('button');copy.textContent='Copier le lien';copy.onclick=async()=>{try{await navigator.clipboard.writeText(r.url);copy.textContent='Lien copié'}catch{input.select()}};box.append(copy)}root.querySelector('.school-content').prepend(box)})});
  root.querySelectorAll('[data-invite]').forEach(b=>b.onclick=()=>run(async()=>{const r=await adapter.invite(b.dataset.invite);await refresh();const box=document.createElement('section');box.className='school-invite';box.innerHTML='<h3>Son accès professeur est prêt</h3><p>Ce lien ouvre uniquement ses classes, sur un autre appareil. Transmettez-le au professeur concerné.</p>';const input=document.createElement('input');input.readOnly=true;input.value=r.url;input.setAttribute('aria-label','Lien professeur');const copy=document.createElement('button');copy.textContent='Copier le lien professeur';copy.onclick=async()=>{try{await navigator.clipboard.writeText(r.url);copy.textContent='Lien copié !'}catch{input.focus();input.select()}};const a=document.createElement('a');a.href=r.url;a.textContent='Ouvrir son espace professeur →';box.append(input,copy,a);root.querySelector('.school-content').prepend(box);box.scrollIntoView({block:'nearest'});}));
  root.querySelectorAll('[data-class]').forEach(s=>s.onchange=async()=>{if(!s.value)return;await run(async()=>{await adapter.reassign(s.dataset.class,s.value);notice='La classe a été confiée au professeur choisi.';await refresh()})});
 }
 async function run(fn){if(busy)return;busy=true;root.querySelectorAll('button,select').forEach(e=>e.disabled=true);try{await fn()}catch(e){notice=e.message;render()}finally{busy=false;root.querySelectorAll('button,select').forEach(e=>e.disabled=false)}}
 await refresh();
}
