import {createClassMessaging} from './messaging.mjs';
import {emptyTree,propose,validate,validatePending,visibleGrowth,assignReview,markReviewed,growth,due} from './model.mjs';
import {saveRecording,loadRecording} from './recordings.mjs';
import {copyInvitation,esc as escapeText,message as portalMessage} from './live-client.mjs';
import {demoClasses} from './demo.mjs';
import {JUZ_RANGES,JUZ_NAMES} from '../coran/juz-data.mjs';
import {QuranPlayer} from '../coran/audio.mjs';
import {splitBasmala} from '../coran/model.mjs';
import {createClassroomMotion} from './classroom-motion.mjs';
import {queueTreeMoment,nextTreeMoment,hasUnreadTreeMessage,treeMessages} from './moments.mjs';
export async function mountClassroom(root,profile,options={}){
 root.id='classroomRoot';
 if(profile?.role!=='admin')throw new Error('Accès administrateur requis');
 const base=new URL('../coran/',import.meta.url),response=await fetch(new URL('data/index.json',base));
 if(!response.ok)throw new Error('Catalogue indisponible');
 const index=await response.json(),key=`km-classroom-preview-v1:${profile.id}`,teacher=profile.full_name||'Professeur',cloud=options.cloud||null;
 let pendingWrites=0,saveFailure='',formBusy=false,practicePassage=null,polling=false,refreshTimer=0;
 const recordingIds=new WeakMap();
 let db={classes:[]},classId='',studentId='',selected=0,studentView=false,parcel=30,moving=false,notice='',activePlayer=null,requestVersion=0,studentSection='garden',librarySurah=1,reciteSurah=112,recordingSession=null,draftBlob=null,draftUrl=null,playedUrl=null,verseNoteSession=null,verseNoteBlob=null,verseNoteUrl=null,recitationData=null,recitationState={surah:112,from:1,to:1,message:'',phase:'idle',errorCode:''},bloom=null,latestSent=null,sendMotionUntil=0,progressFrame=0;
 if(cloud){db=await cloud.load()}
 else {try{const stored=JSON.parse(localStorage.getItem(key));if(stored?.classes)db=stored}catch{notice='La sauvegarde précédente ne peut pas être lue. Les essais restent disponibles.'}}
 if(!cloud&&!db.demoV2){db.classes.push(...demoClasses(index));db.demoV2=true;save();}
 if(!cloud&&!db.demoReviewV3){
  const maryam=db.classes.find(c=>c.id==='demo-v2-class-1')?.students.find(s=>s.name==='Maryam');
  if(maryam?.trees[114]&&!maryam.trees[114].assignment){
   assignReview(maryam.trees[114],5,6,6,'Mme Sarah · Démonstration',
    'Maryam, reprends les versets 5 et 6 à ton rythme. Nous les écouterons ensemble au prochain cours.');
  }
  db.demoReviewV3=true;save();
 }
 if(!cloud&&!db.demoVerseCommentsV1){
  const maryam=db.classes.find(c=>c.id==='demo-v2-class-1')?.students.find(s=>s.name==='Maryam');
  const t=maryam?.trees?.[114];
  if(t){t.verseComments||=[];t.verseComments.push({id:'demo-verse-note-114-5',verse:5,text:'Reprends ce verset doucement et fais une petite pause à la fin. Ta récitation progresse très bien.',author:'Mme Sarah · Démonstration',at:new Date(Date.now()-43200000).toISOString()});}
  db.demoVerseCommentsV1=true;save();
 }
 if(options.studentId||options.studentName){
  const match=db.classes.flatMap(c=>c.students.map(s=>({classroom:c,student:s})))
   .find(({classroom,student})=>options.studentId
    ?classroom.id===options.classId&&student.id===options.studentId
    :student.name===options.studentName&&(!options.className||classroom.name.includes(options.className)));
 if(match){classId=match.classroom.id;studentId=match.student.id;studentView=true;parcel=initialParcel(match.classroom);}
 }
 if(!studentView&&options.classId&&db.classes.some(c=>c.id===options.classId))classId=options.classId;
 if(cloud?.studentId&&!studentView)throw Error('Ce compte élève n’est plus accessible. Revenez à votre espace.');
 root.dataset.live=String(Boolean(cloud&&!cloud.demo));
 const motion=createClassroomMotion(root);
 let shellIdentity='',inboxTab='pending',activeMoment=null,incomingDb=null,transitionBusy=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const basmalaMarkup=v=>{const {preface}=splitBasmala(v);return preface?`<div class="cc-opening cc-basmala"><small>Basmala · avant la sourate</small><span lang="ar" dir="rtl">${esc(preface)}</span></div>`:''};
 const verseArabic=v=>`<span class="cc-verse-arabic" lang="ar" dir="rtl">${esc(splitBasmala(v).text)}</span>`;
 const cls=()=>db.classes.find(c=>c.id===classId),pupil=()=>cls()?.students.find(s=>s.id===studentId),chapter=id=>index.find(s=>s.id===Number(id));
 function initialParcel(c){return c.juz[0]||JUZ_RANGES.find(entry=>entry.surah===c.surahs[0])?.ranges[0]?.juz||30}
 const previewUrl=(c,s)=>{const url=options.previewPath?new URL(options.previewPath,location.href):location.pathname.endsWith('/demonstration.html')?new URL('demonstration.html',location.href):new URL('../../Admin-Classe-Coran-Essai.html',import.meta.url);url.search='';url.hash='';url.searchParams.set('preview','1');if(new URLSearchParams(location.search).get('qa')==='motion')url.searchParams.set('qa','motion');url.searchParams.set('class-id',c.id);url.searchParams.set('student-id',s.id);return url.href};
 const tree=id=>pupil().trees[id]||(pupil().trees[id]=emptyTree());
 const nameDate=d=>new Date(d).toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short'});
 const button=(text,action,id='',primary=false)=>`<button data-action="${action}" data-id="${id}" class="${primary?'cc-primary':''}">${text}</button>`;
 const messaging=createClassMessaging({root,key,cloud,getContext:()=>({classes:db.classes,classId,studentId,studentName:pupil()?.name||'',studentView,teacher}),onStatus:()=>{
  if(!root.querySelector('#cc-content'))return;
  updateShell();const settings=root.querySelector('.cc-chat-settings-wrap');if(settings)settings.innerHTML=messaging.settingsHtml();
 }});
 function syncStatus(){
  root.dataset.saving=String(pendingWrites>0);const host=root.querySelector('.cc-sync');if(!host)return;
  host.innerHTML=saveFailure?`<span>⚠ ${esc(saveFailure)}</span><button type="button" data-action="refresh-cloud">Actualiser les données</button>`:pendingWrites?'Enregistrement en cours…':cloud?`✓ ${cloud.demo?'Démo partagée · synchronisée':'Enregistré en ligne'}`:'';
  host.dataset.state=saveFailure?'error':pendingWrites?'saving':'saved';
 }
 function save(){
  if(!cloud){try{localStorage.setItem(key,JSON.stringify(db));return true}catch{notice='Sauvegarde impossible dans ce navigateur.';return false}}
  if(saveFailure){syncStatus();return Promise.resolve(false)}
  pendingWrites++;syncStatus();
  return cloud.save(db).then(confirmed=>{if(pendingWrites===1)db=confirmed;return true}).catch(error=>{
   saveFailure=portalMessage(error)||'La sauvegarde n’a pas été confirmée. Actualisez les données avant de continuer.';bloom=null;notice='';root.querySelector('.cc-status')?.replaceChildren();return false;
  }).finally(()=>{pendingWrites--;syncStatus()});
 }
 async function refreshCloud(manual=false){
  if(!cloud||polling||pendingWrites||formBusy||(!manual&&saveFailure)||document.hidden)return;
  if(recordingSession||verseNoteSession||['opening','sending'].includes(recitationState.phase))return;
  if(!manual&&(selected||activePlayer||draftBlob||verseNoteBlob||root.querySelector('form :focus')))return;
  const before=JSON.stringify(db);polling=true;
  try{const next=await (manual?cloud.load():cloud.check());
   if(!manual&&(pendingWrites||formBusy||before!==JSON.stringify(db)))return;
   if(manual){
    const drafts=[...root.querySelectorAll('form[data-form]')].map(form=>({kind:form.dataset.form,values:[...new FormData(form)].filter(([,v])=>typeof v==='string')}));
    const file=root.querySelector('.cc-verse-comment-form [name="audio"]')?.files?.[0],noteBlob=verseNoteBlob||(file?.size?file:null);
    db=next;incomingDb=null;saveFailure='';notice='Les dernières données sont chargées. Tu peux reprendre ton essai.';syncStatus();
    if(draftBlob)renderRecitationWorkspace();else{
     draw();
     for(const draft of drafts){const form=root.querySelector(`form[data-form="${draft.kind}"]`);if(form)for(const [name,value] of draft.values){const field=form.elements.namedItem(name);if(field&&'value' in field&&field.type!=='checkbox')field.value=value}}
     if(noteBlob&&root.querySelector('.cc-verse-comment-form')){verseNoteBlob=noteBlob;verseNoteUrl=URL.createObjectURL(noteBlob);verseNoteStatus('Votre message audio est conservé. Vous pouvez réessayer.',true)}
    }
    return;
   }
   if(JSON.stringify(next)!==JSON.stringify(db)){incomingDb=next;receiveUpdates()}
  }catch(error){if(manual){saveFailure=error.message;syncStatus()}}
  finally{polling=false}
 }

 function growthMotion(id){return bloom?.studentId===studentId&&bloom?.surahId===Number(id)&&performance.now()-bloom.at<1600}
 function progressSnapshot(id){const t=tree(id);return {verses:t.verses.length,pending:(t.pendingVerses||[]).length,completed:Boolean(t.completedAt)}}
 function cueGrowth(id,previous){const current=tree(id),pending=(current.pendingVerses||[]).length;if(current.verses.length>previous.verses||pending<previous.pending){queueTreeMoment(current,previous,chapter(id).count);const encouragement=root.querySelector('[name="encouragement"]')?.value.trim();if(encouragement&&current.moment){const message={text:encouragement,author:teacher,at:current.moment.at};current.messages.unshift(message);current.moment.message=message}bloom={studentId,surahId:Number(id),at:performance.now(),progressFrom:Number(root.querySelector('progress[aria-label="Avancement du Juz’"]')?.value),colorReveal:previous.pending>0&&pending===0,complete:!previous.completed&&Boolean(current.completedAt)}}}
 function animateProgress(progress,to){if(!progress||!Number.isFinite(bloom?.progressFrom)||bloom.progressFrom===to||!motion.enabled())return;cancelAnimationFrame(progressFrame);const from=bloom.progressFrom,start=performance.now();progress.value=from;const tick=now=>{if(!progress.isConnected)return;if(!motion.enabled()){progress.value=to;return}const fraction=Math.min(1,(now-start)/800),ease=1-(1-fraction)**3;progress.value=from+(to-from)*ease;if(fraction<1)progressFrame=requestAnimationFrame(tick)};progressFrame=requestAnimationFrame(tick)}
 function art(id){const t=tree(id),pending=(t.pendingVerses||[]).length,p=visibleGrowth(t,chapter(id).count),file=p===100?'blossom':p>=60?'young':p>=25?'sapling':'seedling';return `<img class="cc-art ${pending?'cc-pending-art':''} ${growthMotion(id)?bloom.colorReveal?'cc-bloom-art':'cc-grow-art':''}" src="${new URL(`art/tree-${file}.png`,base)}" alt="${pending?`Arbre gris en attente de validation, ${p} %`:p===100?'Arbre complet':`Arbre en croissance, ${p} %`}">`}
 function allowed(){return index.filter(c=>cls().surahs.includes(c.id)||JUZ_RANGES.find(s=>s.surah===c.id).ranges.some(r=>cls().juz.includes(r.juz)))}
 function openedSurah(id){return cls().surahs.includes(id)||JUZ_RANGES.find(s=>s.surah===id).ranges.some(r=>cls().juz.includes(r.juz))}
 function programPanel(){
  const openedJuz=cls().juz.slice().sort((a,b)=>a-b),directSurahs=cls().surahs.slice().sort((a,b)=>a-b);
  const nextJuz=JUZ_NAMES.slice(1).findIndex((_,i)=>!openedJuz.includes(i+1))+1;
  const nextSurah=index.find(s=>!openedSurah(s.id))?.id,accessible=index.filter(s=>openedSurah(s.id));
  return `<section class="cc-card cc-program"><h3>📖 Programme ouvert pour la classe</h3><p>Les élèves de cette classe voient ces Juz’ et ces sourates dans leur jardin.</p><div class="cc-program-status"><div><strong>Juz’ débloqués</strong><p>${openedJuz.length?openedJuz.map(j=>`<span class="cc-chip">Juz’ ${j} · ${esc(JUZ_NAMES[j])}</span>`).join(''):'<span class="cc-muted">Aucun Juz’ pour le moment</span>'}</p></div><div><strong>Sourates ajoutées séparément</strong><p>${directSurahs.length?directSurahs.map(id=>`<span class="cc-chip">${esc(chapter(id).name)}</span>`).join(''):'<span class="cc-muted">Aucune sourate ajoutée séparément</span>'}</p></div></div><details class="cc-open-list"><summary>Voir les ${accessible.length} sourates déjà accessibles</summary><div class="cc-chip-list">${accessible.map(s=>`<span class="cc-chip">${esc(s.name)}</span>`).join('')||"Aucune sourate ouverte pour le moment."}</div></details><p class="cc-note">Débloquer un Juz’ ouvre ses sourates. Vous pouvez aussi ouvrir une sourate sans ouvrir tout son Juz’.</p><div class="cc-grid cc-program-forms"><form data-form="program" class="cc-card"><h3>Ouvrir un Juz’ entier</h3><label>Choisir un Juz’ encore fermé<select name="juz" ${nextJuz?'':'disabled'}>${nextJuz?`<option value="" disabled>Choisir un Juz’</option>`:''}${JUZ_NAMES.slice(1).map((n,i)=>`<option value="${i+1}" ${openedJuz.includes(i+1)?'disabled':''} ${nextJuz===i+1?'selected':''}>Juz’ ${i+1} · ${esc(n)}${openedJuz.includes(i+1)?' · déjà ouvert':''}</option>`).join('')}</select></label><p><button ${nextJuz?'':'disabled'}>Débloquer ce Juz’</button></p></form><form data-form="surah" class="cc-card"><h3>Ouvrir une seule sourate</h3><label>Choisir une sourate encore fermée<select name="surah" ${nextSurah?'':'disabled'}>${nextSurah?`<option value="" disabled>Choisir une sourate</option>`:''}${index.map(s=>`<option value="${s.id}" ${openedSurah(s.id)?'disabled':''} ${nextSurah===s.id?'selected':''}>${esc(s.name)}${openedSurah(s.id)?' · déjà ouverte':''}</option>`).join('')}</select></label><p><button ${nextSurah?'':'disabled'}>Débloquer cette sourate</button></p></form></div></section>`;
 }
 function stopRecordingMonitor(session){const monitor=session?.monitor;if(!monitor)return;cancelAnimationFrame(monitor.frame);monitor.context.close().catch(()=>{});session.monitor=null}
 function monitorRecording(session){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  let context,analyser;
  try{context=new Audio();analyser=context.createAnalyser();analyser.fftSize=512;context.createMediaStreamSource(session.stream).connect(analyser);context.resume().catch(()=>{})}
  catch{context?.close().catch(()=>{});return}
  const samples=new Uint8Array(analyser.fftSize),monitor={context,frame:0};session.monitor=monitor;
  session.startedAt=performance.now();let lastPaint=0;
  const tick=now=>{if(recordingSession!==session||session.recorder.state!=='recording')return;if(document.hidden||now-lastPaint<80){monitor.frame=requestAnimationFrame(tick);return}lastPaint=now;analyser.getByteTimeDomainData(samples);let energy=0;for(const sample of samples){const point=(sample-128)/128;energy+=point*point}const level=Math.sqrt(energy/samples.length);root.querySelectorAll('.cc-wave span').forEach((bar,i)=>{bar.style.height=`${motion.enabled()?Math.min(32,6+level*(170+i%3*55)):6}px`});const timer=root.querySelector('.cc-record-time');if(timer){const seconds=Math.floor((now-session.startedAt)/1000);const time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;if(timer.textContent!==time)timer.textContent=time}const signal=root.querySelector('.cc-record-level');if(signal){const label=level>.012?'Le micro capte du son':'Micro ouvert · à ton rythme';if(signal.textContent!==label)signal.textContent=label}monitor.frame=requestAnimationFrame(tick)};
  monitor.frame=requestAnimationFrame(tick);
 }
 function stop(){
  if(recordingSession){const session=recordingSession;recordingSession=null;stopRecordingMonitor(session);session.recorder.ondataavailable=session.recorder.onstop=session.recorder.onerror=null;if(session.recorder.state!=='inactive')try{session.recorder.stop()}catch{}session.stream.getTracks().forEach(track=>track.stop())}
  if(draftUrl){URL.revokeObjectURL(draftUrl);draftUrl=null}draftBlob=null;
  if(playedUrl){URL.revokeObjectURL(playedUrl);playedUrl=null}
  if(verseNoteSession){const session=verseNoteSession;verseNoteSession=null;session.recorder.ondataavailable=session.recorder.onstop=null;if(session.recorder.state!=='inactive')try{session.recorder.stop()}catch{}session.stream.getTracks().forEach(track=>track.stop())}
  if(verseNoteUrl){URL.revokeObjectURL(verseNoteUrl);verseNoteUrl=null}verseNoteBlob=null;
  activePlayer?.stop();activePlayer=null;
  root.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.removeAttribute('src');audio.load()});
  cancelAnimationFrame(progressFrame);
  if(['recording','opening','processing','ready'].includes(recitationState.phase)){recitationState.phase='idle';recitationState.message='Enregistrement arrêté. Tu peux recommencer.'}
  requestVersion++;
 }
 function recitePanel(){
  const available=allowed();if(!available.some(s=>s.id===reciteSurah))reciteSurah=available[0]?.id||112;
  if(recitationState.surah!==reciteSurah){recitationState={surah:reciteSurah,from:1,to:1,message:'',phase:'idle',errorCode:''};recitationData=null}
  return `<section class="cc-card cc-recite-panel"><h3>🎙️ Ma récitation</h3><p>Choisis ta sourate et ton passage. Enregistre-toi à ton rythme, puis écoute avant d’envoyer au professeur.</p>${available.length?`<label for="cc-recite-surah">Ma sourate<select id="cc-recite-surah">${available.map(s=>`<option value="${s.id}" ${s.id===reciteSurah?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><div id="cc-recite-workspace">Chargement des versets…</div>`:'<p>Le professeur n’a pas encore ouvert de sourate pour cette classe.</p>'}<p class="cc-note">${cloud?'Ton enregistrement est privé. Il rejoint ta classe pour que ton professeur puisse l’écouter et te répondre.':'Démonstration : les enregistrements restent dans ce navigateur.'}</p></section>`;
 }
 async function loadRecitation(){
  const host=root.querySelector('#cc-recite-workspace');if(!host)return;
  const version=requestVersion;
  try{const response=await fetch(new URL(`data/${reciteSurah}.json`,base));if(!response.ok)throw Error();const data=await response.json();if(version!==requestVersion||!host.isConnected)return;recitationData=data;renderRecitationWorkspace()}
  catch{if(version===requestVersion&&host.isConnected)host.textContent='Cette sourate ne peut pas être chargée. Réessaie.'}
 }
 function renderRecitationWorkspace(){
  const data=recitationData,host=root.querySelector('#cc-recite-workspace');if(!data||!host)return;
  const state=recitationState,recording=Boolean(recordingSession),ready=Boolean(draftBlob),sent=(pupil().submissions||[]).filter(item=>item.surah===data.id).slice().reverse();
  const status=state.message||'Quand tu es prêt, appuie sur Enregistrer.';
  const action=recording?`<button type="button" data-rec="finish" class="cc-primary" ${state.phase==='processing'?'disabled':''}>${state.phase==='processing'?'Je prépare ton essai…':'■ Terminer l’enregistrement'}</button><button type="button" data-rec="cancel">Annuler</button>`:ready?`<button type="button" data-rec="send" class="cc-primary" ${state.phase==='sending'?'disabled':''}>✉️ ${state.phase==='sending'?'Envoi en cours…':'Envoyer au professeur'}</button><button type="button" data-rec="redo">↻ Refaire l’enregistrement</button><button type="button" data-rec="discard">Supprimer cet essai</button>`:`<button type="button" data-rec="start" class="cc-primary" ${window.MediaRecorder&&navigator.mediaDevices?.getUserMedia&&state.phase!=='opening'?'':'disabled'}>🎙️ ${state.phase==='opening'?'Ouverture du micro…':'Enregistrer ma récitation'}</button>`;
  host.innerHTML=`<div class="cc-recite-range"><label>Du verset<input id="cc-rec-from" type="number" min="1" max="${data.count}" value="${state.from}" ${recording||ready?'disabled':''}></label><label>Au verset<input id="cc-rec-to" type="number" min="1" max="${data.count}" value="${state.to}" ${recording||ready?'disabled':''}></label><button type="button" data-rec="range" ${recording||ready?'disabled':''}>Choisir ce passage</button><button type="button" data-rec="whole" ${recording||ready?'disabled':''}>Toute la sourate</button></div><p class="cc-recite-count">${state.from===state.to?`Verset ${state.from}`:`Versets ${state.from} à ${state.to}`} · ${data.name}</p><div class="cc-mic-state ${recording?'cc-mic-live':''}"><strong>${recording?'<span class="cc-recording-signal" aria-hidden="true"></span>':''}${recording?'🎙️ Enregistrement en cours':ready?'🌸 Ton enregistrement est prêt':state.phase==='sent'?'✉️ Enregistrement envoyé':'🎙️ À toi de réciter'}</strong><p class="cc-recite-status" role="status" aria-live="polite">${esc(status)}</p>${recording?`<div class="cc-record-live"><span class="cc-record-time" role="timer" aria-label="Durée de l’enregistrement">00:00</span><span class="cc-record-level">Micro ouvert · à ton rythme</span></div><div class="cc-wave" aria-hidden="true">${Array.from({length:7},()=>'<span></span>').join('')}</div>`:''}${state.phase==='sent'&&performance.now()<sendMotionUntil?'<div class="cc-send-motion" aria-hidden="true"><span class="cc-envelope">✉️</span><span class="cc-arrival">✓</span></div>':''}</div><div class="cc-row cc-reader-actions">${action}</div>${ready?`<div class="cc-recording-review"><strong>Réécoute ton essai avant de l’envoyer</strong><audio controls src="${draftUrl}" aria-label="Ton enregistrement"></audio><small>Le professeur pourra écouter ce passage et décider des versets à valider.</small></div>`:''}${state.errorCode?`<p class="cc-note">${esc(state.errorCode)}</p>`:''}${sent.length?`<div class="cc-sent-list"><h4>Mes enregistrements envoyés</h4>${sent.map(item=>`<p>✉️ ${esc(nameDate(item.at))} · versets ${item.from} à ${item.to} ${item.listenedAt?'· écouté par le professeur':'· en attente d’écoute'}</p>`).join('')}</div>`:''}`;
  host.onclick=e=>{const control=e.target.closest('[data-rec]');if(!control)return;const action=control.dataset.rec;if(state.phase==='sending')return;
   if(action==='range'){const from=Number(host.querySelector('#cc-rec-from').value),to=Number(host.querySelector('#cc-rec-to').value);if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>data.count){state.message='Choisis un passage valide dans cette sourate.';renderRecitationWorkspace();return}state.from=from;state.to=to;state.message='Passage choisi. Tu peux enregistrer.';renderRecitationWorkspace()}
   else if(action==='whole'){state.from=1;state.to=data.count;state.message='Toute la sourate est choisie.';renderRecitationWorkspace()}
   else if(action==='start')startRecording()
   else if(action==='finish')finishRecording()
   else if(action==='cancel'||action==='discard'){stop();state.phase='idle';state.message=action==='cancel'?'Enregistrement annulé. Tu peux recommencer.':'Cet essai est supprimé. Tu peux recommencer.';renderRecitationWorkspace()}
   else if(action==='redo'){stop();state.phase='idle';state.message='On recommence tranquillement.';renderRecitationWorkspace();startRecording()}
   else if(action==='send')sendRecording()
  };
 }
 async function startRecording(){
  const state=recitationState;if(recordingSession||['opening','sending'].includes(state.phase)||!recitationData||!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia)return;
  stop();const version=requestVersion;state.phase='opening';state.errorCode='';state.message='J’ouvre le micro…';renderRecitationWorkspace();
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(error){if(version!==requestVersion)return;state.phase='idle';state.errorCode=error.name==='NotAllowedError'?'Micro refusé. Autorise-le dans Chrome pour enregistrer.':error.name==='NotFoundError'?'Aucun micro détecté.':'Le micro ne peut pas être ouvert ici.';state.message='Aucun enregistrement n’a été fait.';renderRecitationWorkspace();return}
  if(version!==requestVersion){stream.getTracks().forEach(track=>track.stop());return}
  let recorder;
  try{const format=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported?.(type));recorder=new MediaRecorder(stream,format?{mimeType:format}:undefined)}catch{stream.getTracks().forEach(track=>track.stop());state.phase='idle';state.errorCode='Ce navigateur ne peut pas enregistrer ce micro.';renderRecitationWorkspace();return}
  const session={recorder,stream,chunks:[],version};recordingSession=session;
  recorder.ondataavailable=e=>{if(e.data?.size)session.chunks.push(e.data)};
  recorder.onerror=()=>{if(recordingSession!==session)return;stop();state.phase='idle';state.errorCode='L’enregistrement a été interrompu. Réessaie.';renderRecitationWorkspace()};
  recorder.onstop=()=>{if(recordingSession!==session)return;stopRecordingMonitor(session);recordingSession=null;stream.getTracks().forEach(track=>track.stop());if(version!==requestVersion)return;const blob=new Blob(session.chunks,{type:recorder.mimeType||'audio/webm'});if(!blob.size){state.phase='idle';state.errorCode='Aucun son n’a été enregistré. Tu peux recommencer.'}else{draftBlob=blob;draftUrl=URL.createObjectURL(blob);state.phase='ready';state.message='Écoute ton essai, puis envoie-le au professeur quand tu veux.'}renderRecitationWorkspace()};
  try{recorder.start(1000)}catch{stop();state.phase='idle';state.errorCode='L’enregistrement ne peut pas démarrer ici.';renderRecitationWorkspace();return}
  state.phase='recording';state.message='Récite à ton rythme. Appuie sur Terminer quand tu as fini.';renderRecitationWorkspace();monitorRecording(session);
 }
 function finishRecording(){const session=recordingSession;if(!session||session.recorder.state==='inactive')return;stopRecordingMonitor(session);recitationState.phase='processing';recitationState.message='Je prépare ton enregistrement…';renderRecitationWorkspace();try{session.recorder.stop()}catch{stop();recitationState.phase='idle';recitationState.errorCode='Impossible de terminer cet essai. Réessaie.';renderRecitationWorkspace()}}
 async function sendRecording(){
  const state=recitationState,blob=draftBlob;if(!blob||state.phase==='sending')return;
  state.phase='sending';state.message='Je dépose ton enregistrement dans la classe…';renderRecitationWorkspace();
  const id=recordingIds.get(blob)||crypto.randomUUID();recordingIds.set(blob,id);const item={id,surah:recitationData.id,from:state.from,to:state.to,at:new Date().toISOString(),listenedAt:null};
  try{if(cloud)await cloud.audioSave(classId,studentId,id,blob);else await saveRecording(id,blob);if(draftBlob!==blob)return;const inbox=pupil().submissions||(pupil().submissions=[]);if(!inbox.some(x=>x.id===id))inbox.push(item);if(!await save()){pupil().submissions=(pupil().submissions||[]).filter(r=>r.id!==id);throw new Error('Sauvegarde impossible')}URL.revokeObjectURL(draftUrl);draftUrl=null;draftBlob=null;latestSent={studentId,id,at:performance.now()};sendMotionUntil=performance.now()+1600;state.phase='sent';state.message='Enregistrement envoyé au professeur. Tu peux en faire un autre quand tu veux.';renderRecitationWorkspace()}
  catch{state.phase='ready';state.errorCode='L’envoi n’a pas été sauvegardé. Réessaie sans fermer cette page.';state.message='Ton essai reste ici pour que tu puisses réessayer.';renderRecitationWorkspace()}
 }
 function teacherInbox(){
  const items=(pupil().submissions||[]).slice().reverse(),pending=items.filter(item=>!item.listenedAt).length;
  const visible=items.filter(item=>inboxTab==='pending'?!item.listenedAt:Boolean(item.listenedAt));
  return `<section class="cc-card cc-submissions"><div class="cc-row cc-between"><h3>🎙️ Récitations reçues</h3><span class="cc-inbox-count">${pending} à écouter</span></div><div class="cc-inbox-tabs" role="group" aria-label="Filtrer les récitations"><button data-action="inbox-pending" aria-pressed="${inboxTab==='pending'}">À écouter · ${pending}</button><button data-action="inbox-done" aria-pressed="${inboxTab==='done'}">Traitées · ${items.length-pending}</button></div>${visible.map(item=>`<article class="cc-submission" data-submission="${item.id}"><strong>${esc(chapter(item.surah)?.name||'Sourate')} · versets ${item.from} à ${item.to}</strong><small>Envoyé le ${esc(nameDate(item.at))} ${item.listenedAt?'· écoute terminée ✓':'· à écouter'}</small><div class="cc-row"><button data-action="play-submission" data-id="${item.id}">▶ Écouter l’élève</button><button data-action="open-submission-tree" data-id="${item.surah}">🌳 Ouvrir son arbre</button>${!item.listenedAt?`<button data-action="mark-listened" data-id="${item.id}">Marquer écouté</button>`:''}</div><div class="cc-submission-audio"></div></article>`).join('')||`<p class="cc-inbox-empty">${inboxTab==='pending'?'Tout est à jour pour cet élève. Les prochaines récitations apparaîtront ici.':'Les récitations marquées comme écoutées apparaîtront ici.'}</p>`}</section>`;
 }
 function refreshInbox(){const host=root.querySelector('.cc-submissions');if(host)host.outerHTML=teacherInbox()}
 async function markListened(id,button){
  if(transitionBusy)return;const item=(pupil().submissions||[]).find(item=>item.id===id);if(!item||item.listenedAt)return;
  const previous=item.listenedAt;item.listenedAt=new Date().toISOString();
  if(!await save()){item.listenedAt=previous;root.querySelector('.cc-status').textContent=notice;return}
  const identity=studentId,card=button.closest('.cc-submission');transitionBusy=true;button.disabled=true;
  root.querySelector('.cc-status').textContent='Récitation déplacée dans Traitées. La validation de la sourate reste à votre choix.';
  card?.querySelector('audio')?.pause();
  if(motion.enabled()&&card){const animation=card.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(18px)'}],{duration:220,easing:'ease-in'});await animation.finished.catch(()=>{})}
  transitionBusy=false;if(studentId===identity&&!studentView)refreshInbox();
 }
 async function playSubmission(id){
  const host=root.querySelector(`[data-submission="${CSS.escape(id)}"] .cc-submission-audio`);if(!host)return;
  try{const blob=cloud?await cloud.audioLoad(classId,studentId,id):await loadRecording(id);if(!blob){host.textContent='Cet enregistrement n’est pas disponible. Réessayez après avoir actualisé.';return}if(!host.isConnected)return;root.querySelectorAll('.cc-submission-audio audio').forEach(audio=>audio.pause());if(playedUrl)URL.revokeObjectURL(playedUrl);playedUrl=URL.createObjectURL(blob);host.innerHTML=`<audio controls src="${playedUrl}" aria-label="Récitation de l’élève"></audio>`;host.querySelector('audio').play().catch(()=>{})}
  catch{host.textContent='Impossible de lire cet enregistrement dans ce navigateur.'}
 }
 async function playVerseComment(id,control){
  const host=control?.closest('.cc-verse-comment')?.querySelector('.cc-verse-comment-audio');if(!host)return;
  try{const blob=cloud?await cloud.audioLoad(classId,studentId,id):await loadRecording(id);if(!blob){host.textContent='Ce message audio n’est pas disponible. Réessayez.';return}if(playedUrl)URL.revokeObjectURL(playedUrl);playedUrl=URL.createObjectURL(blob);host.innerHTML=`<audio controls autoplay src="${playedUrl}" aria-label="Message audio du professeur"></audio>`}
  catch{host.textContent='Impossible de lire ce message audio.'}
 }
 function verseNoteStatus(message,ready=false){const form=root.querySelector('.cc-verse-comment-form');if(!form)return;const status=form.querySelector('.cc-verse-audio-status');if(status)status.textContent=message;form.querySelector('[data-action="start-verse-note"]')?.toggleAttribute('disabled',Boolean(verseNoteSession));form.querySelector('[data-action="stop-verse-note"]')?.toggleAttribute('disabled',!verseNoteSession);const preview=form.querySelector('.cc-verse-audio-preview');if(preview)preview.innerHTML=ready&&verseNoteUrl?`<audio controls src="${verseNoteUrl}" aria-label="Votre message audio"></audio><small>Le message est prêt. Appuyez sur Ajouter sous ce verset.</small>`:''}
 async function startVerseNote(){
  if(verseNoteSession)return;const version=requestVersion;verseNoteBlob=null;if(verseNoteUrl){URL.revokeObjectURL(verseNoteUrl);verseNoteUrl=null}verseNoteStatus('J’ouvre le micro…');
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch{verseNoteStatus('Micro indisponible. Autorisez-le ou choisissez un fichier audio.');return}
  if(version!==requestVersion||studentView){stream.getTracks().forEach(track=>track.stop());return}
  let recorder;try{recorder=new MediaRecorder(stream)}catch{stream.getTracks().forEach(track=>track.stop());verseNoteStatus('Enregistrement impossible dans ce navigateur.');return}
  const session={stream,recorder,chunks:[]};verseNoteSession=session;recorder.ondataavailable=e=>{if(e.data?.size)session.chunks.push(e.data)};recorder.onstop=()=>{if(verseNoteSession!==session)return;stream.getTracks().forEach(track=>track.stop());verseNoteSession=null;verseNoteBlob=new Blob(session.chunks,{type:recorder.mimeType||'audio/webm'});if(verseNoteUrl)URL.revokeObjectURL(verseNoteUrl);verseNoteUrl=URL.createObjectURL(verseNoteBlob);verseNoteStatus('Message audio prêt.',true)};recorder.start();verseNoteStatus('🎙️ Enregistrement en cours… parlez puis appuyez sur Terminer.')
 }
 function stopVerseNote(){if(verseNoteSession&&verseNoteSession.recorder.state!=='inactive')verseNoteSession.recorder.stop()}
 function commentsForVerse(surahId,verse){return (tree(surahId).verseComments||[]).filter(note=>Number(note.verse)===Number(verse)).sort((a,b)=>new Date(b.at)-new Date(a.at))}
 function verseCommentsMarkup(surahId,verse){
  const notes=commentsForVerse(surahId,verse);if(!notes.length)return '';
  return `<div class="cc-verse-comments">${notes.map(note=>`<article class="cc-verse-comment"><div><strong>💬 Message du professeur</strong><small>${esc(note.author)} · ${esc(nameDate(note.at))}</small></div>${note.text?`<p>${esc(note.text)}</p>`:''}${note.audioId?`<button type="button" data-action="play-verse-comment" data-id="${esc(note.audioId)}">▶ Écouter le message audio</button><div class="cc-verse-comment-audio"></div>`:''}</article>`).join('')}</div>`;
 }
 function pendingPanel(s,t){
  const pending=t.pendingVerses||[];if(!pending.length)return '';
  return `<div class="cc-pending-note"><strong>🌫️ ${pending.length} verset(s) en attente du professeur</strong><p>L’arbre montre ${visibleGrowth(t,s.count)} % en gris. Le professeur vérifie la récitation avant de confirmer ces versets.</p>${!studentView?button('Valider les versets en attente','validate-pending',s.id,true):''}</div>`;
 }
 function updateShell(){
  if(!root.querySelector('#cc-content'))root.innerHTML=`${!cloud||cloud.demo?'<div class="cc-note cc-demo-note">Démonstration · comptes fictifs</div>':''}<div class="cc-hero"><div><small>MA CLASSE CORAN</small><h2></h2><p></p></div><img width="120" height="145" alt="Aya et Mimi"></div><div class="cc-shell-actions cc-row cc-between"><div class="cc-row cc-back-actions"></div><button type="button" data-action="motion" class="cc-motion-toggle" aria-pressed="true">Animations activées</button></div><p class="cc-sync" role="status" aria-live="polite"></p><p class="cc-status" role="status"></p><div id="cc-navigation"></div><div id="cc-moment"></div><div id="cc-content"></div>`;
  const identity=[classId,studentId,studentView,messaging.enabled(classId)].join(':');
  const title=studentId?`${studentSection==='messages'?'La messagerie':studentView&&studentSection==='coran'?'Le Coran':studentView&&studentSection==='recite'?'La récitation':'Le jardin'} de ${pupil().name}`:classId?cls().name:'Un jardin pour chaque élève';
  const heading=root.querySelector('.cc-hero h2');if(heading.textContent!==title)heading.textContent=title;
  const subtitle=root.querySelector('.cc-hero p');const text=studentId?(studentView?'Un petit pas à ton rythme. Ton professeur t’accompagne.':'Écoutez, accompagnez et validez les progrès de cet élève.'):'Accompagner, écouter et encourager, simplement.';if(subtitle.textContent!==text)subtitle.textContent=text;
  const guide=root.querySelector('.cc-hero img'),image=new URL(studentSection==='recite'?'art/aya-mimi-ecoute-transparent.png':'art/aya-mimi-lecture-transparent.png',base).href;if(guide.src!==image)guide.src=image;
  root.querySelector('.cc-status').textContent=notice;syncStatus();
  if(shellIdentity!==identity){
   shellIdentity=identity;
   root.querySelector('.cc-back-actions').innerHTML=cloud?.studentId?'':`${classId?button('← Mes classes','classes'):''}${studentId?button('← Liste des élèves','roster')+(!cloud?button(studentView?'Revenir au professeur':'Voir comme l’élève','toggle'):''):''}`;
   root.querySelector('#cc-navigation').innerHTML=studentView?`<nav class="cc-student-nav" aria-label="Espaces de l’élève"><button type="button" data-action="tab-garden"><span aria-hidden="true">🌳</span><span>Mon jardin</span></button><button type="button" data-action="tab-coran"><span aria-hidden="true">📖</span><span>Coran</span></button><button type="button" data-action="tab-recite"><span aria-hidden="true">🎙️</span><span>Réciter</span></button>${messaging.enabled(classId)?`<button type="button" data-action="tab-messages"><span aria-hidden="true">💬</span><span>Messagerie</span><span data-chat-count="${esc(studentId)}" data-chat-class="${esc(classId)}">${messaging.badge(classId,studentId)}</span></button>`:''}</nav>`:studentId?`<nav class="cc-pupil-nav cc-row cc-between" aria-label="Passer d’un élève à l’autre">${button('← Élève précédent','previous-student')}<strong>${esc(pupil().name)} · ${cls().students.findIndex(s=>s.id===studentId)+1} / ${cls().students.length}</strong>${button('Élève suivant →','next-student')}${messaging.enabled(classId)?button('💬 Messagerie','chat-open',studentId)+button('Voir le jardin','chat-garden'):''}</nav>`:'';
  }
  root.querySelectorAll('.cc-student-nav button').forEach(button=>button.setAttribute('aria-current',button.dataset.action==='tab-'+studentSection?'page':'false'));
 }
 async function inviteStudent(id){
  if(cloud?.share||options.shareDemo){if(cloud?.studentId)return;const s=cls().students.find(s=>s.id===id);if(!s)return;await options.showDemoLink({db,classId,studentId:id,name:s.name,cloud});return;}
  if(!cloud||cloud.studentId)return;const s=cls().students.find(s=>s.id===id);if(!s)return;
  const dialog=document.createElement('dialog');dialog.className='cc-invite-dialog';
  dialog.innerHTML=`<form><h2>L’accès de ${esc(s.name)}</h2><p>Indiquez l’adresse de l’élève ou de son parent. Le lien sera réservé à cette adresse.</p><label>E-mail<input type="email" name="email" required autocomplete="off"></label><p role="status"></p><div class="cc-row"><button class="cc-primary">Créer le lien personnel</button><button type="button" data-close>Fermer</button></div><div class="cc-invite-result"></div></form>`;
  root.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
  dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();event.stopPropagation();const form=event.target,btn=form.querySelector('button'),status=form.querySelector('[role="status"]');btn.disabled=true;try{const r=await cloud.invite(id,new FormData(form).get('email'),s.name);const link=await copyInvitation(r.token);dialog.querySelector('.cc-invite-result').innerHTML=`<label>Lien à transmettre<input readonly value="${escapeText(link)}"></label><small>Valable 7 jours. Copiez ce lien et transmettez-le à la personne. Aucun message n’est envoyé automatiquement.</small>`;status.textContent='Le lien personnel est prêt.'}catch(error){status.textContent=error.message}finally{btn.disabled=false}};
 }
 function showMoment(){
  const host=root.querySelector('#cc-moment');
  if(!studentView||studentSection!=='garden'){host.innerHTML='';activeMoment=null;return}
  if(activeMoment?.studentId!==studentId)activeMoment=null;
  if(!activeMoment){const next=nextTreeMoment(pupil());if(next){const [id,t]=next;activeMoment={studentId,surahId:Number(id),...t.moment};t.moment.seenAt=new Date().toISOString();save()}}
  if(!activeMoment){host.innerHTML='';return}
  if(host.dataset.moment===activeMoment.id&&host.children.length)return;
  const t=tree(activeMoment.surahId),s=chapter(activeMoment.surahId),message=activeMoment.message;
  host.dataset.moment=activeMoment.id;
  host.innerHTML=`<aside class="cc-moment-card" aria-label="Nouveau progrès validé"><div class="cc-moment-art" aria-hidden="true">${art(s.id)}<span class="cc-moment-petals">✿ · ✿</span></div><div class="cc-moment-copy"><small>UN MESSAGE POUR TOI</small><h3>${activeMoment.complete?'Ton arbre a fleuri !':'Ton arbre a grandi !'}</h3><p><strong>${esc(s.name)} · ${activeMoment.from} % → ${activeMoment.to} % validés</strong><br>${esc(t.teacher)} a validé tes progrès.</p>${message?`<blockquote>${esc(message.text)}</blockquote>`:''}<div class="cc-row">${button('Voir mon arbre','moment-tree',s.id,true)}${button('Merci, je continue','moment-close')}</div></div><span class="cc-mimi-cheer" role="img" aria-label="Mimi t’encourage"></span></aside>`;
  motion.enter(host.firstElementChild);
 }
 function draw(direction=0){stop();moving=false;if(incomingDb){db=incomingDb;cloud?.accept(db);incomingDb=null}renderScreen();motion.refresh();showMoment();if(studentView&&studentSection==='coran')return;motion.enter(direction?root.querySelector('.cc-board'):root.querySelector('#cc-content'),direction);}
 function renderScreen(){
 messaging.leave();
 if(studentSection==='messages'&&!messaging.enabled(classId))studentSection='garden';
 updateShell();
 options.onViewChange?.({studentView,classId,studentId,studentName:pupil()?.name||''});
 const host=root.querySelector('#cc-content');
 if(!classId){host.innerHTML=`<form data-form="class" class="cc-card cc-row"><label>Nom de la classe<input name="name" required maxlength="80" placeholder="Ex. Les petits oliviers"></label>${messaging.creationHtml()}<button class="cc-primary">Créer ma classe</button></form><div class="cc-grid">${db.classes.map(c=>`<article class="cc-card"><h3>${esc(c.name)}</h3><p>${c.students.length} élève(s)</p><small>${esc(c.description||'')}</small>${button('Ouvrir la classe','class',c.id,true)}</article>`).join('')}</div>${!cloud&&!db.classes.length?`<p>Commencez une classe vide ou explorez avec trois élèves fictifs.</p>${button('Essayer avec une classe de démonstration','demo')}`:''}`;return}
 if(!studentId){host.innerHTML=`${teacherOverview()}<div class="cc-chat-settings-wrap">${messaging.settingsHtml()}</div><details class="cc-work-details"><summary>Programme et consignes de la classe</summary>${programPanel()}${groupAssignment()}</details><div class="cc-grid"><form data-form="student" class="cc-card"><h3>Ajouter un élève</h3><label>Prénom<input name="name" required maxlength="60"></label><p><button class="cc-primary">Ajouter</button></p></form></div><h3>Mes élèves</h3><div class="cc-grid">${cls().students.map(s=>{const ts=Object.values(s.trees);return `<article class="cc-card"><h3>${esc(s.name)}</h3><p>${ts.filter(t=>t.completedAt).length} sourate(s) validée(s)<br>${ts.filter(t=>t.verses.length&&!t.completedAt).length} en cours<br>${(s.submissions||[]).filter(item=>!item.listenedAt).length} récitation(s) à écouter<br>${ts.filter(t=>(t.pendingVerses||[]).length).length} arbre(s) en attente<br>${ts.filter(t=>due(t)).length} à réviser</p><div class="cc-student-actions">${button('Voir son jardin','student',s.id,true)}${messaging.enabled(classId)?button(`💬 Messagerie <span data-chat-count="${esc(s.id)}" data-chat-class="${esc(classId)}">${messaging.badge(classId,s.id)}</span>`,'chat-open',s.id):''}${cloud?.share||options.shareDemo?button("Copier le lien élève","invite-student",s.id):cloud?button(s.profileId?"Gérer le lien d’accès":"Inviter cet élève","invite-student",s.id):`<a class="cc-preview-link" href="${esc(previewUrl(cls(),s))}" target="_blank" rel="noopener">Ouvrir son compte élève ↗</a>`}</div></article>`}).join('')||'<p>Ajoutez votre premier élève.</p>'}</div>`;return}
 host.innerHTML='';
 if(studentSection==='messages'&&messaging.enabled(classId)){messaging.mount(host);return}
 if(studentView){if(studentSection==='coran'){host.innerHTML+=`<section class="cc-card cc-coran-panel"><h3>📖 Mon Coran</h3><p>Choisis librement une sourate, puis lis-la ou écoute le passage que tu veux. Ton professeur valide tes progrès dans le jardin.</p><label for="cc-library">Choisir une sourate<select id="cc-library">${index.map(s=>`<option value="${s.id}" ${s.id===librarySurah?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><div id="cc-practice"></div></section>`;root.querySelector('#cc-library').onchange=e=>{librarySurah=Number(e.target.value);practice(librarySurah)};practice(librarySurah);return}if(studentSection==='recite'){host.innerHTML+=recitePanel();root.querySelector('#cc-recite-surah')?.addEventListener('change',e=>{if(recordingSession||draftBlob||['opening','sending'].includes(recitationState.phase)){e.target.value=String(reciteSurah);return}reciteSurah=Number(e.target.value);draw()});loadRecitation();return}}
 const priority=s=>Number(Boolean(tree(s.id).assignment))*4+Number(hasUnreadTreeMessage(tree(s.id)))*2+Number(visibleGrowth(tree(s.id),s.count)>0);
 const all=allowed(),visible=all.filter(s=>JUZ_RANGES.find(r=>r.surah===s.id).ranges.some(r=>r.juz===parcel)).sort((a,b)=>priority(b)-priority(a));
 const ranges=JUZ_RANGES.flatMap(s=>s.ranges.filter(r=>r.juz===parcel).map(r=>({...r,surah:s.surah}))),total=ranges.reduce((n,r)=>n+r.to-r.from+1,0),done=ranges.reduce((n,r)=>n+(pupil().trees[r.surah]?.verses||[]).filter(v=>v>=r.from&&v<=r.to).length,0);
 host.innerHTML+=`${!studentView?teacherInbox():nextStep()}<p class="cc-note">${studentView?'Touche un arbre pour retrouver ton passage et les messages de ton professeur.':'Vue professeur : touchez un arbre pour valider et écrire votre appréciation.'}</p><div class="cc-row"><label>Ma parcelle<select id="cc-parcel">${JUZ_NAMES.slice(1).map((n,i)=>`<option value="${i+1}" ${parcel===i+1?'selected':''}>Juz’ ${i+1} · ${esc(n)}</option>`).join('')}</select></label></div><p>${done} / ${total} versets validés dans ce Juz’</p><progress value="${done}" max="${total}" aria-label="Avancement du Juz’"></progress><div class="cc-tree-list">${visible.map(s=>`<button class="cc-tree-option ${hasUnreadTreeMessage(tree(s.id))?'cc-has-message':''}" data-action="tree" data-id="${s.id}">${art(s.id)}<strong>${esc(s.name)}</strong><small>${tree(s.id).verses.length}/${s.count} validés ${(tree(s.id).pendingVerses||[]).length?` · ${(tree(s.id).pendingVerses||[]).length} en attente`:``} ${due(tree(s.id))?'💧':''} ${messageBadge(s.id)}</small></button>`).join('')||'<p>Cette parcelle attend ses premières sourates. Tu peux toujours explorer le Coran.</p>'}</div><div class="cc-board" aria-label="Jardin personnel">${visible.filter(s=>tree(s.id).positions[parcel]).map(s=>{const pos=tree(s.id).positions[parcel];return `<button class="cc-planted ${hasUnreadTreeMessage(tree(s.id))?'cc-has-message':''} ${growthMotion(s.id)&&(bloom.colorReveal||bloom.complete)?'cc-celebrate':''}" style="left:${pos.x}%;top:${pos.y}%" data-action="tree" data-id="${s.id}"><span class="cc-tree-crown">${art(s.id)}</span><span>${esc(s.name)} ${due(tree(s.id))?'💧':''} </span>${messageBadge(s.id,true)}</button>`}).join('')}</div><div id="cc-detail"></div>`;
 if(growthMotion(bloom?.surahId))animateProgress(root.querySelector('progress[aria-label="Avancement du Juz’"]'),done);
 root.querySelector('#cc-parcel').onchange=e=>{const previous=parcel;parcel=Number(e.target.value);selected=0;draw(parcel>previous?1:-1);root.querySelector('#cc-parcel')?.focus({preventScroll:true})};
 if(selected&&all.some(s=>s.id===selected))detail();
 }
 function nextStep(){
  const assignments=allowed().filter(s=>pupil().trees[s.id]?.assignment).sort((a,b)=>new Date(tree(b.id).assignment.at)-new Date(tree(a.id).assignment.at));
  const first=assignments[0];const unread=allowed().find(s=>pupil().trees[s.id]&&hasUnreadTreeMessage(pupil().trees[s.id]));
  const total=(pupil().submissions||[]).filter(item=>!item.listenedAt).length;
  const action=first?button('Écouter mon passage','next-practice',first.id,true):unread?button('Lire mon message','moment-tree',unread.id,true):button('Choisir une sourate','tab-coran','',true);
  return `<aside class="cc-today"><span class="cc-today-icon" aria-hidden="true">${first?'💧':unread?'💌':'🌱'}</span><div><small>UN PETIT PAS POUR AUJOURD’HUI</small><h3>${first?esc(first.name)+' · versets '+tree(first.id).assignment.from+' à '+tree(first.id).assignment.to:unread?'Ton professeur t’a écrit':'Fais grandir ton jardin'}</h3><p>${first?'Ton passage est prêt, avec la voix d’Al-Hudhaifi.':total?`${total} récitation(s) attendent ton professeur. Tu peux continuer à ton rythme.`:'Choisis ce que tu veux écouter et apprendre.'}</p>${action}</div></aside>`;
 }
 function teacherOverview(){
  const received=cls().students.flatMap(s=>(s.submissions||[]).filter(r=>!r.listenedAt).map(r=>({s,r}))).sort((a,b)=>new Date(a.r.at)-new Date(b.r.at));
  return `<section class="cc-teacher-hub"><div><small>VOTRE CLASSE EN UN COUP D’ŒIL</small><h3>${received.length?received.length+' récitation(s) à écouter':'Les récitations sont à jour'}</h3><p>${cls().students.length} élèves · ${cls().students.reduce((n,s)=>n+Object.values(s.trees).filter(t=>t.completedAt).length,0)} sourates validées</p></div>${received.length?button('Écouter la prochaine récitation','inbox-student',received[0].s.id,true):''}<div class="cc-class-inbox">${received.slice(0,5).map(({s,r})=>`<button data-action="inbox-student" data-id="${s.id}"><strong>${esc(s.name)}</strong><span>${esc(chapter(r.surah)?.name)} · ${r.from}–${r.to}</span><span aria-hidden="true">↗</span></button>`).join('')}</div></section>`;
 }
 function groupAssignment(){return `<form data-form="group-review" class="cc-card cc-group-review"><h3>Un passage pour plusieurs élèves</h3><p>Chaque élève le retrouvera sur son arbre, avec le récitateur.</p><label>Sourate<select name="surah" required>${allowed().map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><div class="cc-row"><label>Du verset<input name="from" type="number" min="1" max="286" value="1" required></label><label>Au verset<input name="to" type="number" min="1" max="286" value="1" required></label></div><label>Votre consigne<textarea name="note" maxlength="1500" placeholder="Écoutez puis répétez tranquillement ce passage."></textarea></label><fieldset><legend>Pour quels élèves ?</legend><label class="cc-check"><input type="checkbox" data-group-all checked> Toute la classe</label>${cls().students.map(s=>`<label class="cc-check"><input type="checkbox" name="students" value="${s.id}" checked> ${esc(s.name)}</label>`).join('')}</fieldset><button class="cc-primary" ${!allowed().length||!cls().students.length?'disabled':''}>Envoyer le passage sélectionné</button></form>`}
 function messageBadge(id,planted=false){
  if(!hasUnreadTreeMessage(tree(id)))return '';
  const envelope='<svg class="cc-message-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="4" y="8" width="24" height="18" rx="4" fill="#fffdf3" stroke="currentColor" stroke-width="1.8"/><path d="m5 10 9 7a3 3 0 0 0 4 0l9-7M5 24l7-7m8 0 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="26" cy="7" r="5" fill="#347359" stroke="#fff9e7" stroke-width="2"/></svg>';
  return planted?`<span class="cc-unread cc-message-seal" aria-hidden="true">${envelope}</span><span class="cc-unread cc-message-caption">Nouveau message</span>`:`<span class="cc-unread cc-message-tag">${envelope}<span>Nouveau message</span></span>`;
 }
 function messagePanel(messages){
  if(!messages.length)return '';
  return `<section class="cc-message-panel" aria-labelledby="cc-message-title"><h4 id="cc-message-title" tabindex="-1">💌 ${studentView?'Les messages de ton professeur':'Messages pour cet élève'}</h4>${messages.map(message=>`<article class="cc-message-card cc-verse-comment"><div><strong>${message.kind==='verse'?`À propos du verset ${Number(message.verse)}`:'Un encouragement pour toi'}</strong><small>${esc(message.author)} · ${esc(nameDate(message.at))}</small></div>${message.text?`<p>${esc(message.text)}</p>`:''}${message.audioId?`<button type="button" data-action="play-verse-comment" data-id="${esc(message.audioId)}">▶ Écouter le message audio</button><div class="cc-verse-comment-audio"></div>`:''}</article>`).join('')}<small>Les messages précédents restent dans l’historique de l’arbre.</small></section>`;
 }
 function focusTreeDetail(){
  const target=root.querySelector('#cc-message-title')||root.querySelector('#cc-detail h3');
  if(!target)return;target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:'instant'});
 }
 function detail(){const s=chapter(selected),t=tree(selected),host=root.querySelector('#cc-detail');if(!host)return;
  const messages=treeMessages(t),unread=messages.filter(message=>message.at>(t.messagesSeenAt||''));
  if(studentView&&unread.length){
   t.messagesSeenAt=new Date().toISOString();save();
   root.querySelectorAll(`[data-action="tree"][data-id="${selected}"]`).forEach(button=>{
    button.classList.remove('cc-has-message');button.querySelectorAll('.cc-unread').forEach(badge=>badge.remove());
   });
  }
  const next=Array.from({length:s.count},(_,i)=>i+1).find(v=>!t.verses.includes(v));
  const passage=t.assignment,history=[...(t.events||[]),...(t.messages||[]).map(m=>({kind:'message',at:m.at,author:m.author,text:m.text})),...(t.verseComments||[]).map(m=>({kind:'verse-comment',at:m.at,author:m.author,text:m.text,verse:m.verse,audioId:m.audioId}))];
  if(t.lastValidatedAt&&!history.some(event=>event.kind==='validation'))history.push({kind:'legacy',at:t.lastValidatedAt,author:t.teacher,from:1,to:t.verses.length});
  history.sort((a,b)=>new Date(b.at)-new Date(a.at));
  const range=(from,to)=>from===to?`verset ${from}`:`versets ${from} à ${to}`;
  const timeline=history.map(event=>`<div class="cc-history-entry"><strong>${event.kind==='message'?'💌 Appréciation globale':event.kind==='verse-comment'?`💬 Commentaire sous le verset ${event.verse}`:event.kind==='assignment'?'💧 Passage conseillé':event.kind==='reviewed'?'🌿 Révision faite':event.kind==='pending'?`🌫️ ${range(event.from,event.to)} en attente`:`✅ ${range(event.from,event.to)} validés`}</strong><small>${esc(event.author)} · ${esc(nameDate(event.at))}</small>${['message','verse-comment'].includes(event.kind)&&event.text?`<p>${esc(event.text)}</p>`:event.kind==='assignment'&&event.note?`<p>${esc(event.note)}</p>`:''}${event.kind==='verse-comment'&&event.audioId?'<small>🎙️ Message audio joint</small>':''}</div>`).join('')||'<p>Aucun événement pour cet arbre pour le moment.</p>';
  host.innerHTML=`<article class="cc-card cc-tree-detail"><div class="cc-row cc-between"><h3>${esc(s.name)}</h3>${button('Fermer','close')}</div>${messagePanel(unread.length?unread:messages.slice(0,1))}${art(s.id)}${pendingPanel(s,t)}<p>${t.verses.length} / ${s.count} versets validés</p><progress class="${(t.pendingVerses||[]).length?'cc-pending-progress':''}" max="100" value="${visibleGrowth(t,s.count)}"></progress>${t.completedAt?`<p>🌸 Sourate validée par ${esc(t.teacher)}<br>${esc(nameDate(t.completedAt))}</p>`:'<p>L’arbre grandit après la validation du professeur.</p>'}<div class="cc-next"><strong>🌱 Prochaine étape</strong><p>${next?`Apprendre ${range(next,Math.min(next+1,s.count))}.`:'Tous les versets sont validés. Tu peux revoir cette sourate quand tu veux.'}</p></div>${passage?`<div class="cc-assignment"><strong>💧 Ton professeur te propose de revoir ${range(passage.from,passage.to)}</strong>${passage.note?`<p>${esc(passage.note)}</p>`:''}<small>${esc(passage.author)} · ${esc(nameDate(passage.at))}</small>${studentView?`<div class="cc-row">${button(`Écouter ${range(passage.from,passage.to)}`,'practice-assigned',s.id,true)}${button('J’ai révisé','reviewed')}</div>`:''}</div>`:due(t)?'<p class="cc-note">💧 Un petit moment de révision est conseillé.</p>':''}<div class="cc-row">${studentView?button('Écouter et répéter','practice',s.id)+button(t.requested?'Demande envoyée ✓':'Je veux réciter','request')+button('Placer / déplacer mon arbre','move'):''}</div>${!studentView?`<form data-form="validate" class="cc-teacher-form"><h4>Valider après la récitation</h4><p>${t.requested?'🔔 Cet élève souhaite réciter.':'Choisissez le passage réussi après avoir écouté l’élève.'}</p><div class="cc-row"><label>Du verset<input name="from" type="number" min="1" max="${s.count}" value="1" required></label><label>Au verset<input name="to" type="number" min="1" max="${s.count}" value="${Math.min(5,s.count)}" required></label><button class="cc-primary">Valider le passage</button></div><label class="cc-validation-note">Un encouragement avec cette validation <span class="cc-optional">facultatif · visible lors de la découverte de l’arbre</span><textarea name="encouragement" maxlength="1500" placeholder="Ex. Maryam, ta récitation était très appliquée. Bravo pour tes efforts !"></textarea></label></form><p>${button('Valider toute la sourate','complete')}</p><form data-form="review" class="cc-teacher-form"><h4>Conseiller un passage à revoir</h4><div class="cc-row"><label>Du verset<input name="from" type="number" min="1" max="${s.count}" value="${next||1}" required></label><label>Au verset<input name="to" type="number" min="1" max="${s.count}" value="${Math.min((next||1)+1,s.count)}" required></label></div><label>Votre consigne personnelle<textarea name="note" maxlength="1500" placeholder="Ex. Maryam, reprends les versets 5 et 6 tranquillement…"></textarea></label><p><button class="cc-primary">Envoyer ce passage</button></p></form><form data-form="message" class="cc-teacher-form"><h4>Écrire une appréciation</h4><label>Votre message personnalisé<textarea name="message" maxlength="1500" required placeholder="Écrivez votre message pour cet élève…"></textarea></label><p><button class="cc-primary">Déposer le message sur l’arbre</button></p></form>`:''}<section class="cc-history"><h4>Historique de cet arbre</h4>${timeline}</section><div id="cc-practice"></div></article>`;
  if(!studentView)host.querySelector('.cc-history')?.insertAdjacentHTML('beforebegin',`<form data-form="verse-comment" class="cc-teacher-form cc-verse-comment-form"><h4>Commenter un verset précis</h4><p>Ce commentaire apparaîtra directement sous le verset. L’appréciation globale reste disponible.</p><label>Verset concerné<input name="verse" type="number" min="1" max="${s.count}" value="${next||1}" required></label><label>Commentaire écrit <span class="cc-optional">facultatif si vous ajoutez un audio</span><textarea name="message" maxlength="1500" placeholder="Ex. Reprends doucement ce mot…"></textarea></label><label class="cc-audio-picker">🎙️ Message audio <span class="cc-optional">facultatif</span><input name="audio" type="file" accept="audio/*" capture></label><small>Sur téléphone, vous pouvez enregistrer votre voix. Sur ordinateur, choisissez un fichier audio.</small><p><button class="cc-primary">Ajouter sous ce verset</button></p></form>`);
  if(!studentView)host.querySelector('.cc-verse-comment-form .cc-audio-picker')?.insertAdjacentHTML('beforebegin','<div class="cc-verse-audio-recorder"><strong>🎙️ Enregistrer directement</strong><div class="cc-row"><button type="button" data-action="start-verse-note">Commencer</button><button type="button" data-action="stop-verse-note" disabled>Terminer</button></div><p class="cc-verse-audio-status" role="status">Vous pouvez enregistrer votre voix ou choisir un fichier audio.</p><div class="cc-verse-audio-preview"></div></div>');
  root.querySelectorAll('[data-action="tree"]').forEach(button=>button.classList.toggle('cc-selected-tree',Number(button.dataset.id)===selected));
 }
 async function practice(id,startVerse=1,endVerse=startVerse){
  stop();const version=requestVersion,host=root.querySelector('#cc-practice')||root.querySelector('#cc-detail');
  host.innerHTML='<p>Chargement de la sourate…</p>';
  try{
   const r=await fetch(new URL(`data/${id}.json`,base));if(!r.ok)throw Error();
   const data=await r.json();if(version!==requestVersion||!host.isConnected)return;
   let from=Math.max(1,Math.min(data.verses.length,startVerse)),to=Math.max(from,Math.min(data.verses.length,endVerse)),choosingEnd=false;
   host.innerHTML=`<section class="cc-reader"><h3>${esc(data.name)} · tous les versets</h3><p>Pour choisir un passage, touche son premier verset puis son dernier. Par exemple : 2 puis 3.</p><div class="cc-repeat-setting"><label for="cc-passage-repeat">🔁 Combien de fois répéter le passage ?</label><div class="cc-row"><input id="cc-passage-repeat" type="number" min="1" max="50" step="1" value="1" inputmode="numeric" aria-describedby="cc-repeat-hint"><div class="cc-row cc-repeat-presets" role="group" aria-label="Choix rapide du nombre de répétitions">${[1,3,5,10].map(n=>`<button type="button" data-reader="repeat" data-count="${n}" aria-pressed="${n===1}">×${n}</button>`).join('')}</div></div><small id="cc-repeat-hint">Choisis de 1 à 50 fois. Le récitateur répète tout le passage dans l’ordre.</small></div><div class="cc-row cc-reader-actions"><button type="button" data-reader="play" class="cc-primary">▶ Écouter le passage</button><button type="button" data-reader="whole">🎧 Écouter toute la sourate</button><button type="button" data-reader="pause">⏸ Pause</button><button type="button" data-reader="resume">▶ Reprendre</button><button type="button" data-reader="stop">■ Arrêter</button></div><p id="cc-passage" aria-live="polite"></p><p id="cc-player-status" role="status" aria-live="polite">Prêt à écouter. Tu peux mettre pause à tout moment.</p><audio preload="none" aria-label="Récitation par Ali Al-Hudhaify"></audio>${basmalaMarkup(data.verses[0])}<div class="cc-all-verses" role="group" aria-label="Tous les versets de la sourate">${data.verses.map(v=>`<button type="button" class="cc-verse" data-reader="verse" data-verse="${v.verse}" aria-pressed="false"><strong>Verset ${v.verse}</strong>${verseArabic(v)}<small>${esc(v.translation)}</small></button>`).join('')}</div>${studentView&&allowed().some(s=>s.id===Number(id))?`<div class="cc-practice-next"><span>Quand tu es prêt</span>${button('Enregistrer ce passage','record-passage',id,true)}</div>`:''}<small>Récitation : Ali Al-Hudhaify · Texte et traduction : <a href="${new URL('data/NOTICE.txt',base)}" target="_blank" rel="noopener">sources</a></small></section>`;
   host.querySelectorAll('.cc-verse').forEach(card=>{const markup=verseCommentsMarkup(id,card.dataset.verse);if(markup)card.insertAdjacentHTML('afterend',markup)});
   const audio=host.querySelector('audio'),status=host.querySelector('#cc-player-status');
   const player=new QuranPlayer(audio,state=>{
    if(!host.isConnected||version!==requestVersion)return;
    host.querySelectorAll('.cc-verse').forEach(card=>card.classList.toggle('playing',Number(card.dataset.verse)===state.current?.verse));
    if(state.state==='error')status.textContent='Audio indisponible. Vérifie ta connexion puis réessaie.';
    else if(state.state==='ended')status.textContent='Passage terminé. Tu peux maintenant répéter, ou le réécouter.';
    else if(state.state==='paused')status.textContent='Lecture en pause. Appuie sur Reprendre quand tu veux.';
    else if(state.current)status.textContent=`Répétition ${state.passageRound} sur ${state.passageRepeat} · le récitateur lit le verset ${state.current.verse} (${state.position+1} sur ${state.total}).`;
   });activePlayer=player;
   function showSelection(){
    practicePassage={id:Number(id),from,to};
    host.querySelector('#cc-passage').textContent=from===to?`Passage choisi : verset ${from}`:`Passage choisi : versets ${from} à ${to}`;
    host.querySelectorAll('.cc-verse').forEach(card=>card.setAttribute('aria-pressed',String(Number(card.dataset.verse)>=from&&Number(card.dataset.verse)<=to)));
   }
   function repeatCount(){const field=host.querySelector('#cc-passage-repeat');const count=Math.max(1,Math.min(50,Number.parseInt(field.value,10)||1));field.value=String(count);return count;}
   function repeatChanged(){player.stop();const count=repeatCount();host.querySelectorAll('[data-reader="repeat"]').forEach(btn=>btn.setAttribute('aria-pressed',String(Number(btn.dataset.count)===count)));status.textContent=`Le passage sera récité ${count} fois. Appuie sur Écouter le passage.`;}
   function play(){const queue=data.verses.filter(v=>v.verse>=from&&v.verse<=to);player.start(queue,{gap:false,passageRepeat:repeatCount()});}
   host.querySelector('#cc-passage-repeat').onchange=repeatChanged;
   showSelection();host.onclick=e=>{
    const control=e.target.closest('[data-reader]');if(!control)return;
    if(control.dataset.reader==='verse'){
     const verse=Number(control.dataset.verse);player.stop();
     if(!choosingEnd){from=to=verse;choosingEnd=true;status.textContent=`Verset ${verse} choisi. Touche un autre verset pour terminer le passage.`;}
     else{from=Math.min(from,verse);to=Math.max(to,verse);choosingEnd=false;status.textContent='Passage choisi. Appuie sur Écouter le passage.';}
     showSelection();
    }else if(control.dataset.reader==='repeat'){host.querySelector('#cc-passage-repeat').value=control.dataset.count;repeatChanged();}
    else if(control.dataset.reader==='whole'){from=1;to=data.verses.length;choosingEnd=false;showSelection();play();}
    else if(control.dataset.reader==='play'){choosingEnd=false;play();}
    else if(control.dataset.reader==='pause'){if(['playing','loading','gap'].includes(player.state))player.toggle();}
    else if(control.dataset.reader==='resume'){if(player.state==='paused')player.toggle();}
    else if(control.dataset.reader==='stop'){player.stop();status.textContent='Lecture arrêtée. Tu peux choisir un autre passage.';}
   };
  }catch{if(version===requestVersion)host.innerHTML='<p>Impossible de charger la sourate. Réessayez.</p>'}
 }
 root.addEventListener('submit',async e=>{if(cloud?.studentId||pendingWrites||saveFailure||formBusy){e.preventDefault();syncStatus();return}const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();if(incomingDb){db=incomingDb;cloud?.accept(db);incomingDb=null}const f=new FormData(form);notice='';formBusy=true;form.setAttribute('aria-busy','true');
 try{if(form.dataset.form==='verse-comment'){
  try{if(studentView)return;const verse=Number(f.get('verse')),text=String(f.get('message')||'').trim(),audio=f.get('audio'),audioBlob=verseNoteBlob||(audio instanceof File&&audio.size?audio:null);if(!Number.isInteger(verse)||verse<1||verse>chapter(selected).count)throw Error('Choisissez un verset valide.');if(!text&&!audioBlob)throw Error('Ajoutez un commentaire écrit ou un message audio.');let audioId='';if(audioBlob){audioId=`verse-comment-${crypto.randomUUID()}`;if(cloud)await cloud.audioSave(classId,studentId,audioId,audioBlob);else await saveRecording(audioId,audioBlob)}const t=tree(selected);t.verseComments||=[];t.verseComments.unshift({id:crypto.randomUUID(),verse,text,audioId,author:teacher,at:new Date().toISOString()});notice=`Commentaire ajouté sous le verset ${verse}.`;if(await save())draw()}catch(error){root.querySelector('.cc-status').textContent=error.message}return
 }
 try{switch(form.dataset.form){case'group-review':{if(studentView)return;const sid=Number(f.get('surah')),ch=chapter(sid),from=Number(f.get('from')),to=Number(f.get('to')),ids=f.getAll('students');if(!openedSurah(sid)||!ids.length)throw Error('Choisissez une sourate ouverte et au moins un élève.');assignReview(emptyTree(),from,to,ch.count,teacher,f.get('note'));for(const pupil of cls().students.filter(s=>ids.includes(s.id))){pupil.trees[sid]||=emptyTree();assignReview(pupil.trees[sid],from,to,ch.count,teacher,f.get('note'))}notice=`Passage envoyé à ${ids.length} élève(s).`;break}case'class':{const name=f.get('name').trim();if(!name)throw Error('Indiquez le nom de la classe.');const c={id:crypto.randomUUID(),name,students:[],juz:[],surahs:[]};db.classes.push(c);classId=c.id;break}case'student':{const name=f.get('name').trim();if(!name)throw Error('Indiquez un prénom.');cls().students.push({id:crypto.randomUUID(),name,trees:{}});break}case'program':{const juz=Number(f.get('juz'));if(!Number.isInteger(juz)||juz<1||juz>30||cls().juz.includes(juz))throw Error('Ce Juz’ est déjà ouvert ou le choix est invalide.');cls().juz.push(juz);notice='Juz’ ouvert pour cette classe.';break}case'surah':{const surah=Number(f.get('surah'));if(!Number.isInteger(surah)||surah<1||surah>114||openedSurah(surah))throw Error('Cette sourate est déjà ouverte ou le choix est invalide.');cls().surahs.push(surah);notice='Sourate ouverte pour cette classe.';break}case'validate':if(studentView)return;{const previous=progressSnapshot(selected);validate(tree(selected),Number(f.get('from')),Number(f.get('to')),chapter(selected).count,teacher);cueGrowth(selected,previous);notice='Les versets sont validés. L’arbre a grandi 🌱'}break;case'review':if(studentView)return;assignReview(tree(selected),Number(f.get('from')),Number(f.get('to')),chapter(selected).count,teacher,f.get('note'));notice='Le passage conseillé apparaît sur l’arbre 💧';break;case'message':if(studentView)return;{const text=f.get('message').trim();if(!text)throw Error('Écrivez votre appréciation.');tree(selected).messages.unshift({text,author:teacher,at:new Date().toISOString()});notice='Votre message est déposé sur l’arbre.'}break}if(await save()){if(form.dataset.form==='class'&&f.get('messaging')){try{await messaging.configure(classId,true)}catch(error){notice='La classe est créée. La messagerie n’a pas été activée : réessayez depuis les réglages de la classe.'}}draw()}}catch(error){root.querySelector('.cc-status').textContent=error.message}}finally{formBusy=false;form.removeAttribute('aria-busy')}});
 root.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b){if(pendingWrites||formBusy||saveFailure)return;if(moving&&e.target.closest('.cc-board')){const rect=root.querySelector('.cc-board').getBoundingClientRect();tree(selected).positions[parcel]={x:Math.max(16,Math.min(84,(e.clientX-rect.left)/rect.width*100)),y:Math.max(35,Math.min(92,(e.clientY-rect.top)/rect.height*100))};notice='Ton arbre a trouvé sa place 🌱';if(await save())draw()}return}const a=b.dataset.action,id=b.dataset.id;if(a==='refresh-cloud'){await refreshCloud(true);return}if(pendingWrites||formBusy||(saveFailure&&a!=='motion')){syncStatus();return}if(cloud?.studentId&&['classes','class','roster','student','toggle','demo','invite-student','inbox-student'].includes(a))return;notice='';if(incomingDb&&a!=='motion'){db=incomingDb;cloud?.accept(db);incomingDb=null}
 const changingSpace=['classes','class','roster','student','toggle','tree','close','next-student','previous-student','inbox-student','next-practice','record-passage','moment-tree','chat-open','chat-garden','chat-configure'].includes(a)||a.startsWith('tab-');
 if(changingSpace&&messaging.busy){root.querySelector('.cc-status').textContent='Terminez et envoyez votre message vocal, ou supprimez cet audio avant de changer d’espace.';return}
 if(changingSpace&&(recordingSession||draftBlob||verseNoteSession||verseNoteBlob||['opening','sending'].includes(recitationState.phase))){root.querySelector('.cc-status').textContent=studentView?'Termine puis envoie ton enregistrement, ou annule cet essai avant de changer d’espace.':'Terminez puis ajoutez votre message audio avant de changer d’élève.';return}
 if(a==='chat-configure'){if(studentView||cloud?.studentId)return;b.disabled=true;try{await messaging.configure(classId,!messaging.enabled(classId));notice=messaging.enabled(classId)?'Messagerie activée pour cette classe.':'Messagerie désactivée. Les anciens échanges sont conservés.';draw()}catch(error){root.querySelector('.cc-status').textContent=error.message}finally{b.disabled=false}return}
 if(a==='chat-open'||a==='tab-messages'){if(!messaging.enabled(classId))return;if(a==='chat-open'){if(studentView||cloud?.studentId)return;if(!cls().students.some(s=>s.id===id))return;studentId=id;studentView=false}selected=0;studentSection='messages';draw();return}
 if(a==='chat-garden'){studentSection='garden';selected=0;draw();return}
 if(a==='invite-student'){await inviteStudent(id);return}
 if(a==='inbox-student'){studentId=id;studentView=false;selected=0;inboxTab='pending';parcel=initialParcel(cls());draw();root.querySelector('.cc-submissions')?.scrollIntoView({block:'start'});return}
 if(a==='next-practice'){selected=Number(id);studentSection='garden';parcel=JUZ_RANGES.find(r=>r.surah===selected).ranges[0].juz;draw();const t=tree(selected);await practice(selected,t.assignment?.from||1,t.assignment?.to||1);root.querySelector('#cc-practice')?.scrollIntoView({block:'start'});return}
 if(a==='record-passage'){const p=practicePassage;if(!p)return;reciteSurah=p.id;recitationState={surah:p.id,from:p.from,to:p.to,phase:'idle',message:'Ton passage est prêt. Enregistre quand tu veux.',errorCode:''};studentSection='recite';draw();root.querySelector('.cc-recite-panel')?.scrollIntoView({block:'start'});return}
 if(a==='motion'){motion.toggle();return}
 if(a==='moment-close'){activeMoment=null;root.querySelector('#cc-moment').innerHTML='';showMoment();return}
 if(a==='moment-tree'){selected=Number(id);const range=JUZ_RANGES.find(r=>r.surah===selected)?.ranges;parcel=range?.find(r=>cls().juz.includes(r.juz))?.juz||range?.[0]?.juz||parcel;activeMoment=null;root.querySelector('#cc-moment').innerHTML='';draw();root.querySelector('#cc-detail')?.scrollIntoView({block:'nearest'});return}
 if(a==='inbox-pending'||a==='inbox-done'){inboxTab=a==='inbox-done'?'done':'pending';refreshInbox();root.querySelector(`[data-action="${a}"]`)?.focus({preventScroll:true});return}
 if(a==='next-student'||a==='previous-student'){if(studentView)return;const students=cls().students,at=students.findIndex(s=>s.id===studentId);studentId=students[(at+(a==='next-student'?1:students.length-1))%students.length].id;selected=0;inboxTab='pending';parcel=initialParcel(cls());draw(a==='next-student'?1:-1);root.querySelector('.cc-pupil-nav')?.scrollIntoView({block:'nearest'});return}
 if(a.startsWith('tab-')&&studentSection===a.slice(4))return;
 if(a.startsWith('tab-')&&(recordingSession||draftBlob||['opening','sending'].includes(recitationState.phase))){root.querySelector('.cc-status').textContent='Termine puis envoie ton enregistrement, ou annule cet essai avant de changer d’espace.';return}
 if(a==='start-verse-note'){if(studentView)return;startVerseNote();return}
 if(a==='stop-verse-note'){if(studentView)return;stopVerseNote();return}
 if(a==='play-verse-comment'){playVerseComment(id,b);return}
 switch(a){case'play-submission':if(studentView)return;playSubmission(id);return;case'mark-listened':if(studentView)return;{markListened(id,b);return}case'open-submission-tree':if(studentView)return;selected=Number(id);detail();root.querySelector("#cc-detail")?.scrollIntoView({block:"nearest"});return;case'classes':studentSection='garden';classId=studentId='';selected=0;studentView=false;break;case'class':studentSection='garden';classId=id;break;case'roster':studentSection='garden';studentId='';selected=0;studentView=false;break;case'student':studentId=id;selected=0;studentSection='garden';parcel=initialParcel(cls());break;case'toggle':studentView=!studentView;studentSection='garden';break;case'tab-garden':if(!studentView)return;studentSection='garden';draw();return;case'tab-coran':if(!studentView)return;studentSection='coran';draw();return;case'tab-recite':if(!studentView)return;studentSection='recite';draw();return;case'recite-request':if(!studentView||!allowed().some(s=>s.id===Number(id)))return;tree(id).requested=true;notice='Le professeur retrouvera ta demande de récitation.';if(await save())draw();return;case'demo':{if(cloud)return;const c={id:crypto.randomUUID(),name:'Les petits oliviers · Démonstration',juz:[30],surahs:[1],students:['Adam','Maryam','Youssef'].map(name=>({id:crypto.randomUUID(),name,trees:{}}))};db.classes.push(c);classId=c.id;await save();break}case'tree':stop();selected=Number(id);detail();focusTreeDetail();return;case'close':selected=0;break;case'validate-pending':if(studentView)return;{const previous=progressSnapshot(id);validatePending(tree(Number(id)),chapter(id).count,teacher);cueGrowth(id,previous);notice='Les versets vérifiés par le professeur ont rendu leurs couleurs à l’arbre 🌳';await save()}break;case'complete':if(studentView)return;{const previous=progressSnapshot(selected);validate(tree(selected),1,chapter(selected).count,chapter(selected).count,teacher);cueGrowth(selected,previous);notice='Sourate validée : l’arbre est complet 🌸';await save()}break;case'reviewed':if(!studentView)return;markReviewed(tree(selected));notice='Tu as noté ta révision. Ton professeur peut toujours valider les versets.';await save();break;case'request':if(!studentView)return;tree(selected).requested=true;notice='Le professeur retrouvera votre demande dans la liste de classe.';await save();break;case'move':if(!studentView)return;moving=true;root.querySelector('.cc-status').textContent='Touchez un endroit dans la parcelle pour y placer votre arbre.';root.querySelector('.cc-board').scrollIntoView({block:'center'});return;case'practice-assigned':{const assignment=tree(id).assignment;practice(Number(id),assignment?.from||1,assignment?.to||assignment?.from||1);return}case'practice':{const c=chapter(id),next=Array.from({length:c.count},(_,i)=>i+1).find(v=>!tree(id).verses.includes(v))||1;practice(Number(id),next);return}}draw()});
 const adminView=root.closest('.admin-view');if(adminView)new MutationObserver(()=>{if(!adminView.classList.contains('active'))stop()}).observe(adminView,{attributes:true,attributeFilter:['class']});
 function receiveUpdates(){
  if(!incomingDb||selected||activePlayer||recordingSession||draftBlob||verseNoteSession||verseNoteBlob||['opening','sending'].includes(recitationState.phase)||root.querySelector('form :focus'))return;
  if(studentView&&studentSection!=='garden')return;
  if(!studentView){db=incomingDb;cloud?.accept(db);incomingDb=null;draw();return}
  const next=incomingDb.classes.find(c=>c.id===classId)?.students.find(s=>s.id===studentId);if(!next)return;db=incomingDb;cloud?.accept(db);incomingDb=null;notice='Ton jardin est à jour avec les nouvelles indications du professeur.';draw();
 }
 window.addEventListener('storage',event=>{if(!cloud&&event.key===key&&event.newValue){try{const next=JSON.parse(event.newValue);if(next.classes){incomingDb=next;receiveUpdates()}}catch{}}});
 window.addEventListener('focus',()=>{receiveUpdates();refreshCloud()});
 if(cloud)refreshTimer=setInterval(()=>refreshCloud(),cloud.pollInterval||20000);
 root.addEventListener('change',e=>{
  const form=e.target.closest('[data-form="group-review"]');if(!form)return;
  const boxes=[...form.querySelectorAll('[name="students"]')],all=form.querySelector('[data-group-all]');
  if(e.target===all)boxes.forEach(input=>input.checked=all.checked);
  if(e.target.name==='students'){all.checked=boxes.every(input=>input.checked);all.indeterminate=!all.checked&&boxes.some(input=>input.checked)}
  if(e.target.name==='surah')for(const field of form.querySelectorAll('input[type="number"]')){field.max=chapter(e.target.value).count;field.value=Math.max(1,Math.min(Number(field.value)||1,Number(field.max)))}
 });
 window.addEventListener('beforeunload',e=>{if(messaging.busy||pendingWrites||formBusy||recordingSession||draftBlob||verseNoteSession||verseNoteBlob){e.preventDefault();e.returnValue=''}});
 window.addEventListener('pagehide',()=>{clearInterval(refreshTimer);messaging.destroy();stop();motion.destroy()},{once:true});await messaging.refresh();draw();
}
