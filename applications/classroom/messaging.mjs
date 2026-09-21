import {startLiveRefresh} from './live-refresh.mjs';
import {esc} from './live-client.mjs';
import {saveRecording,loadRecording} from './recordings.mjs';
import {createDemoMessaging} from './messaging-data.mjs';

export function createClassMessaging({root,key,cloud,getContext,onStatus}){
 const demo=cloud?null:createDemoMessaging({storage:localStorage,key:key+':messaging-v1',getClasses:()=>getContext().classes});
 let statuses=[],statusError='',refreshBusy=false,statusVersion=0,pane=null,serial=0,session=null,opening=false,sending=false,reading=false,requestKey='',draftAudio=null,draftAudioId='',draftUrl='',timer;
 const drafts=new Map(),urls=new Set();
 const context=()=>{const c=getContext();return {...c,role:c.studentView?'student':'teacher'}};
 const request=(action,payload={})=>{const c=context();return cloud?cloud.message(action,payload):demo(action,payload,{role:c.role,name:c.studentView?c.studentName:c.teacher,studentId:c.studentId})};
 const enabled=id=>statuses.find(c=>c.id===id)?.enabled===true;
 const unread=(id,student)=>{const c=statuses.find(c=>c.id===id);return c?.enabled?(student?c.students.find(s=>s.id===student)?.unread||0:c.unread||0):0};
 const badge=(id,student)=>{const n=unread(id,student);return n?`<span class="cc-chat-count" aria-label="${n} message${n>1?'s':''} non lu${n>1?'s':''}">${n>99?'99+':n}</span>`:''};
 const draftKey=()=>{const c=context();return c.studentId+':'+c.role};
 const say=(text,error=false)=>{const el=pane?.host.querySelector('.cc-chat-status');if(el){el.textContent=text;el.dataset.error=String(error)}};
 function syncBadges(){for(const el of root.querySelectorAll('[data-chat-count]'))el.innerHTML=badge(el.dataset.chatClass,el.dataset.chatCount);}
 async function refresh(){
  if(refreshBusy||document.hidden)return;refreshBusy=true;const version=statusVersion;
  try{const next=await request('status');if(version!==statusVersion)return;const changed=JSON.stringify(statuses)!==JSON.stringify(next.classes);statuses=next.classes||[];statusError='';if(changed)onStatus?.();syncBadges();
   if(pane?.host.isConnected&&!sending){if(!enabled(pane.classId)){say('Le professeur a désactivé la messagerie. Les anciens échanges sont conservés.');setControls(true)}else await loadThread(false)}
  }catch(error){statusError=error.message||'La messagerie est momentanément indisponible.';if(pane?.host.isConnected)say('Connexion indisponible. Ton brouillon est conservé. Tu peux réessayer.',true);return false}finally{refreshBusy=false}
 }
 const creationHtml=()=>`<label class="cc-chat-choice"><input type="checkbox" name="messaging"><span><strong>Activer la messagerie</strong><small>Chaque élève pourra échanger en privé avec vous.</small></span></label>`;
 function settingsHtml(){const id=context().classId;return `<section class="cc-card cc-chat-settings"><div><h3>💬 Messagerie de la classe</h3><p>${enabled(id)?'Activée · chaque élève peut vous écrire en privé.':'Désactivée · aucun bouton Messagerie dans l’espace élève.'}</p><small>Vous pouvez changer ce choix à tout moment. Les échanges sont conservés.</small></div><button type="button" data-action="chat-configure" aria-pressed="${enabled(id)}">${enabled(id)?'Désactiver':'Activer la messagerie'}</button></section>`}
 async function configure(id,value){if(context().studentView)throw Error('Seul le professeur peut choisir cette option.');await request('configure',{class:id,enabled:value});statusVersion++;const existing=statuses.find(c=>c.id===id);if(existing)existing.enabled=value;else statuses.push({id,enabled:value,students:[],unread:0});onStatus?.();syncBadges();await refresh();}
 function disposePane(){serial++;if(pane){for(const audio of pane.host.querySelectorAll('audio'))audio.pause();drafts.set(pane.key,pane.host.querySelector('textarea')?.value||drafts.get(pane.key)||'');pane=null}for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
 function clearAudio(){if(draftUrl)URL.revokeObjectURL(draftUrl);draftAudio=null;draftAudioId='';draftUrl='';requestKey='';pane?.host.querySelector('[data-chat="record"]')?.replaceChildren(document.createTextNode('🎙️ Message vocal'));}
 function setControls(locked=false){if(!pane?.host.isConnected)return;for(const el of pane.host.querySelectorAll('.cc-chat-compose button,.cc-chat-compose textarea'))el.disabled=locked||sending||opening;const submit=pane.host.querySelector('[type="submit"]');if(submit)submit.disabled=locked||sending||opening||!!session;}
 function audioPreview(){const host=pane?.host.querySelector('.cc-chat-draft-audio');if(!host)return;host.innerHTML=draftAudio?`<audio controls src="${draftUrl}" aria-label="Réécouter mon message vocal"></audio><button type="button" data-chat="discard">Supprimer cet audio</button>`:'';}
 async function record(){
  if(session||opening||sending)return;opening=true;setControls();say('Autorise le micro pour enregistrer ton message.');const current=serial;let stream;
  try{if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw Error('Le micro n’est pas disponible. Ouvre cette page dans Chrome ou envoie un message écrit.');
   stream=await navigator.mediaDevices.getUserMedia({audio:true});if(current!==serial){stream.getTracks().forEach(t=>t.stop());return}
   const recorder=new MediaRecorder(stream),chunks=[];const s={stream,recorder,chunks,limit:null};session=s;
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   recorder.onstop=()=>{clearTimeout(s.limit);stream.getTracks().forEach(t=>t.stop());if(session!==s)return;session=null;clearAudio();draftAudio=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});if(!draftAudio.size){clearAudio();say('Aucun audio enregistré. Tu peux recommencer.',true);setControls();return}draftAudioId='chat-'+context().role+'-'+crypto.randomUUID();draftUrl=URL.createObjectURL(draftAudio);audioPreview();pane?.host.querySelector('[data-chat="record"]')?.replaceChildren(document.createTextNode('🎙️ Refaire l’audio'));say('Audio prêt. Réécoute-le, puis appuie sur Envoyer.');setControls()};
   recorder.onerror=()=>{say('L’enregistrement a été interrompu. Tu peux recommencer.',true);stopRecording()};
   recorder.start();s.limit=setTimeout(stopRecording,180000);pane.host.querySelector('[data-chat="record"]').textContent='⏹ Terminer l’audio';say('Enregistrement en cours · appuie sur Terminer quand tu as fini (3 minutes maximum).');
  }catch(error){stream?.getTracks().forEach(t=>t.stop());say(error.name==='NotAllowedError'?'Micro non autorisé. Tu peux l’autoriser dans ton navigateur ou écrire ton message.':error.message,true)}finally{opening=false;setControls()}
 }
 function stopRecording(){if(session?.recorder.state!=='inactive')session?.recorder.stop()}
 async function playAudio(button){const p=pane;if(!p)return;button.disabled=true;try{const blob=cloud?await cloud.audioLoad(p.classId,p.studentId,button.dataset.audio):await loadRecording(button.dataset.audio);if(!blob)throw Error('Cet audio n’est plus disponible.');if(p!==pane)return;const url=URL.createObjectURL(blob);urls.add(url);const audio=document.createElement('audio');audio.controls=true;audio.src=url;audio.setAttribute('aria-label','Message vocal');button.after(audio);button.remove();await audio.play().catch(()=>{})}catch(error){say(error.message,true)}finally{button.disabled=false}}
 function renderMessages(){const p=pane;if(!p?.host.isConnected)return;const list=p.host.querySelector('.cc-chat-log'),nearEnd=list.scrollHeight-list.scrollTop-list.clientHeight<90,oldHeight=list.scrollHeight;list.querySelector('.cc-chat-empty')?.remove();
  const ordered=[...p.messages.values()].sort((a,b)=>a.sequence-b.sequence);
  for(const message of ordered){if([...list.children].some(el=>el.dataset.message===message.id))continue;const item=document.createElement('article');item.dataset.message=message.id;item.dataset.sequence=message.sequence;item.className='cc-chat-bubble'+(message.role===p.role?' cc-chat-own':'');
   const date=new Date(message.at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});
   item.innerHTML=`<small><strong>${message.role===p.role?'Vous':esc(message.author||'Professeur')}</strong> · <time datetime="${esc(message.at)}">${esc(date)}</time></small>${message.text?`<p>${esc(message.text)}</p>`:''}${message.audioId?`<button type="button" data-chat="play" data-audio="${esc(message.audioId)}">▶ Écouter le message vocal</button>`:''}`;
   const after=[...list.children].find(el=>Number(el.dataset.sequence)>message.sequence);list.insertBefore(item,after||null);
  }
  if(!ordered.length)list.innerHTML='<p class="cc-chat-empty">Une question, une précision ou un encouragement ? Écrivez votre premier message.</p>';
  const more=p.host.querySelector('[data-chat="older"]');more.hidden=!p.hasOlder;
  if(p.prepending){list.scrollTop+=list.scrollHeight-oldHeight;p.prepending=false}else if(nearEnd||p.first){list.scrollTop=list.scrollHeight;p.first=false}
  markRead();
 }
 async function markRead(){const p=pane;if(reading||!p?.host.isConnected||document.hidden||!enabled(p.classId))return;const list=p.host.querySelector('.cc-chat-log');if(list.scrollHeight-list.scrollTop-list.clientHeight>90)return;const sequence=Math.max(0,...[...p.messages.values()].map(m=>m.sequence));if(!sequence||sequence<=p.readSequence)return;reading=true;try{await request('read',{student:p.studentId,sequence});if(p!==pane)return;p.readSequence=sequence;const st=statuses.find(c=>c.id===p.classId),s=st?.students.find(s=>s.id===p.studentId);if(s){st.unread=Math.max(0,st.unread-s.unread);s.unread=0;syncBadges()}}catch{}finally{reading=false}}
 async function loadThread(older=false){const p=pane;if(!p||p.loading)return;p.loading=true;try{const before=older?Math.min(...p.messages.keys()):undefined;const result=await request('thread',{student:p.studentId,...(before?{before}:{})});if(p!==pane)return;for(const m of result.messages)p.messages.set(m.sequence,m);if(older||!p.messages.size||p.first)p.hasOlder=result.hasOlder;p.prepending=older;renderMessages();setControls();}catch(error){if(p===pane)say(error.message,true)}finally{p.loading=false}}
 function mount(host){disposePane();const c=context(),key=draftKey();pane={host,key,classId:c.classId,studentId:c.studentId,role:c.role,messages:new Map(),hasOlder:false,first:true,readSequence:0};
  host.innerHTML=`<section class="cc-card cc-chat-panel"><header class="cc-chat-header"><span class="cc-chat-avatar" aria-hidden="true">💬</span><div><h3>${c.studentView?'Avec mon professeur':'Avec '+esc(c.studentName)}</h3><p>Une conversation privée, à votre rythme.</p></div><button type="button" data-chat="refresh" aria-label="Actualiser les messages">↻</button></header><button type="button" data-chat="older" hidden>Voir les messages précédents</button><div class="cc-chat-log" role="log" aria-label="Conversation privée" aria-live="polite" tabindex="0"><p class="cc-chat-empty">Chargement des messages…</p></div><form class="cc-chat-compose"><label for="cc-chat-text">Votre message<textarea id="cc-chat-text" maxlength="3000" rows="3" placeholder="Écrivez ici…">${esc(drafts.get(key)||'')}</textarea></label><div class="cc-chat-draft-audio"></div><div class="cc-row cc-between"><button type="button" data-chat="record">🎙️ Message vocal</button><button type="submit" class="cc-primary">Envoyer ↗</button></div><p class="cc-chat-status" role="status"></p></form></section>`;
  host.querySelector('textarea').oninput=e=>{drafts.set(key,e.target.value);requestKey=''};
  host.querySelector('.cc-chat-log').onscroll=()=>markRead();
  host.onclick=e=>{const b=e.target.closest('[data-chat]');if(!b)return;e.stopPropagation();if(b.dataset.chat==='record'){session?stopRecording():record()}else if(b.dataset.chat==='discard'){clearAudio();audioPreview();say('Audio supprimé.')}else if(b.dataset.chat==='play')playAudio(b);else if(b.dataset.chat==='older')loadThread(true);else if(b.dataset.chat==='refresh')refresh()};
  host.querySelector('form').onsubmit=async e=>{e.preventDefault();e.stopPropagation();if(sending||session||opening)return;const p=pane,text=host.querySelector('textarea').value.trim();if(!text&&!draftAudio){say('Écrivez un message ou enregistrez un audio.',true);return}if(!enabled(c.classId)){say('Le professeur a désactivé la messagerie.',true);return}sending=true;setControls();say('Envoi en cours…');requestKey||=crypto.randomUUID();
   try{if(draftAudio){if(cloud)await cloud.audioSave(c.classId,c.studentId,draftAudioId,draftAudio);else await saveRecording(draftAudioId,draftAudio)}
    const message=await request('send',{student:c.studentId,id:requestKey,text,audioId:draftAudioId});if(!message?.id)throw Error('L’envoi n’a pas été confirmé. Réessayez.');if(p!==pane)return;p.messages.set(message.sequence,message);drafts.delete(key);host.querySelector('textarea').value='';clearAudio();audioPreview();renderMessages();host.querySelector('.cc-chat-log').scrollTop=host.querySelector('.cc-chat-log').scrollHeight;say('Message envoyé ✓');
   }catch(error){say(error.message||'Envoi impossible. Votre message est conservé : réessayez.',true)}finally{sending=false;setControls();host.querySelector('textarea')?.focus({preventScroll:true})}
  };
  if(!enabled(c.classId)){say(statusError||'Le professeur n’a pas activé la messagerie.');setControls(true)}else loadThread();
 }
 // Messaging stays responsive while avoiding a status query (and an optional thread query)
 // every five seconds for every open classroom session.
 const tick=()=>{if(root.isConnected)return refresh()};timer=startLiveRefresh(tick,{interval:20000});const storageListener=e=>{if(e.key===key+':messaging-v1')refresh()};if(!cloud)window.addEventListener('storage',storageListener);
 return {enabled,badge,creationHtml,settingsHtml,configure,refresh,mount,leave:disposePane,get busy(){return sending||opening||!!session||!!draftAudio},destroy(){timer?.();window.removeEventListener('storage',storageListener);if(session){clearTimeout(session.limit);session.stream.getTracks().forEach(t=>t.stop());session=null}clearAudio();disposePane()}};
}
