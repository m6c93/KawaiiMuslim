import {client,portal,page,requireContext,message,esc,copyInvitation} from '../applications/classroom/live-client.mjs';
import {createCloudClassroom} from '../applications/classroom/cloud-classroom.mjs';
const status=document.querySelector('#portal-status'),params=new URLSearchParams(location.search),isAdminPage=location.pathname.endsWith('/administration.html');
if(params.get('demo')==='1')location.replace(page('demonstration.html'));else start().catch(e=>{status.className='portal-status';status.textContent=message(e)});
async function start(){
 let context=await requireContext();if(!context)return;
 const logout=document.querySelector('#logout');logout.hidden=false;logout.onclick=async()=>{await client().auth.signOut();location.href=page('inscription.html?mode=login')};
 if(context.admin&&isAdminPage){const {mountLiveAdmin}=await import('../applications/classroom/platform-live.mjs');await mountLiveAdmin(document.querySelector('#quranPlatformRoot'),context.profile);status.textContent='';return}
 if(isAdminPage){status.textContent='Cet espace est réservé au compte administrateur.';return}
 if(context.admin&&!params.get('organization')){location.replace(page('administration.html'));return}
 const home=document.querySelector('#portal-home');
 const chosenStudent=context.students.find(s=>s.id===params.get('student-id'))||(!context.organizations.length&&context.students.length===1?context.students[0]:null);
 const chosenOrg=params.get('organization')||(!chosenStudent&&context.organizations.length===1?context.organizations[0].id:null),membership=context.organizations.find(o=>o.id===chosenOrg);
 if(!chosenStudent&&!chosenOrg&&!context.organizations.length){
  const {data}=await client().auth.getUser(),meta=data.user?.user_metadata;
  if(meta?.quran_organization){await portal('request_access',{name:meta.quran_organization,plan:meta.quran_plan});context=await portal('context')}
  else{home.innerHTML=`<section class="portal-card"><h1>Bienvenue ${esc(context.profile.name||'')}</h1><p>Pour rejoindre une classe, ouvrez le lien personnel de votre professeur.</p><form id="request-access"><h3>Vous êtes professeur ou responsable ?</h3><label>Nom de votre structure<input class="qa-input" name="name" minlength="2" maxlength="160" required></label><button class="qa-button">Demander mon accès professeur</button></form></section>`;status.textContent='';home.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await portal('request_access',{name:new FormData(e.target).get('name')});location.reload()}catch(error){status.textContent=message(error)}};return}
 }
 if(chosenStudent){if(!chosenStudent.enabled){status.textContent='Votre professeur ou l’administration doit activer la licence de cette classe.';return}const cloud=createCloudClassroom(chosenStudent.organization,{studentId:chosenStudent.id});const {mountClassroom}=await import('../applications/classroom/classroom.mjs');await mountClassroom(document.querySelector('#classroomRoot'),{id:context.profile.id,role:'admin',full_name:context.profile.name},{cloud,studentId:chosenStudent.id,classId:chosenStudent.classId});status.textContent='';return}
 if(chosenOrg&&(context.admin||membership)){
  if(membership&&!membership.enabled){home.innerHTML=`<section class="portal-card"><h2>${esc(membership.name)}</h2><p>La licence doit être activée par l’administration avant l’ouverture des classes.</p></section>`;status.textContent='';return}
  home.innerHTML=`<section class="portal-card"><h1>${esc(membership?.name||'Mes classes')}</h1><p>Les classes, les jardins et les récitations sont enregistrés en ligne.</p><div id="classes-list">Chargement des classes…</div></section>`;
  const cloud=createCloudClassroom(chosenOrg),roster=await cloud.load();const list=home.querySelector('#classes-list');list.innerHTML=roster.classes.map(c=>`<article class="portal-card"><h3>${esc(c.name)}</h3><p>${c.students.length} élève(s) · ${c.juz.length} Juz’ ouvert(s)</p><a class="qa-button" href="${page('interface.html?organization='+chosenOrg+'&class-id='+c.id)}">Ouvrir la classe</a></article>`).join('')||'<p>Aucune classe créée pour le moment.</p>';
  const {mountClassroom}=await import('../applications/classroom/classroom.mjs');await mountClassroom(document.querySelector('#classroomRoot'),{id:context.profile.id,role:'admin',full_name:context.profile.name},{cloud,classId:params.get('class-id')||undefined});status.textContent='';return;
 }
 home.innerHTML=`<div class="portal-grid">${context.organizations.map(o=>`<article class="portal-card"><h2>${esc(o.name)}</h2><p>${o.enabled?'Licence active':'Licence à activer'} · ${o.student_limit} places</p><a class="qa-button" href="${page('interface.html?organization='+o.id)}">Ouvrir mes classes</a></article>`).join('')}${context.students.map(s=>`<article class="portal-card"><h2>Le jardin de ${esc(s.name)}</h2><p>${esc(s.className)}</p><a class="qa-button" href="${page('interface.html?student-id='+s.id)}">Ouvrir mon jardin</a></article>`).join('')}</div>`;status.textContent='';
}
