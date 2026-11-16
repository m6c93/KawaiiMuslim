(() => {
 'use strict';
 const fractions=[.25,.5,.75];
 const colorWords=[['rouge','أَحْمَر','Ahmar'],['bleu','أَزْرَق','Azraq'],['jaune','أَصْفَر','Asfar']];
 let dispose=()=>{};
 addEventListener('aya:leave',()=>dispose());
 addEventListener('pagehide',()=>dispose());
 function questions(key){
  if(key==='colors')return colorWords.map(([audio,arabic,reading],answer)=>({audio,arabic,reading,prompt:'Touche la bonne couleur',choices:['Rouge','Bleu','Jaune'],answer}));
  const topic=window.AyaPremium?.topics[key];
  return topic?.questions.map(([arabic,reading,choices,answer],i)=>({audio:key+'-'+i,arabic,reading,choices,answer,prompt:topic.prompt}))||[];
 }
 function attach(root,key,enabled=true){
  dispose();
  const player=root.querySelector('video'),stage=root.querySelector('.watch-stage');
  if(!player||!stage)return;
  const items=questions(key),seen=new Set();let active=false,closed=false,restored=false;
  const controller=new AbortController(),signal=controller.signal;
  const tools=document.createElement('div');tools.className='interactive-tools';
  tools.innerHTML='<div class="checkpoints" aria-label="Trois pauses pour jouer">'+items.map((_,i)=>`<span class="checkpoint" title="Pause ${i+1}" aria-label="Pause ${i+1}"></span>`).join('')+'</div><button class="quiet" type="button" id="watch-mode"></button>';
  root.querySelector('.watch-title').after(tools);
  const toggle=tools.querySelector('button');
  function label(){toggle.textContent=enabled?'Chanter et jouer ✓':'Chanson seule';toggle.setAttribute('aria-pressed',String(enabled));tools.querySelector('.checkpoints').hidden=!enabled;root.querySelector('.watch-next-hint').textContent=enabled?'La chanson fait des pauses pour jouer':'Un petit moment pour chanter avec Aya';}
  label();
  const overlay=document.createElement('section');overlay.className='video-question';overlay.hidden=true;overlay.setAttribute('aria-label','Pause pour jouer');stage.append(overlay);
  function stopVoice(){window.AyaQuestionAudio?.stop();}
  function close(resume){
   if(!active)return;
   stopVoice();active=false;overlay.hidden=true;overlay.replaceChildren();stage.classList.remove('is-question');player.hidden=false;
   if(resume&&!closed){player.play().catch(()=>{player.focus();});}
  }
  function mark(index){seen.add(index);tools.querySelectorAll('.checkpoint')[index]?.classList.add('visited');}
  function ask(index){
   const q=items[index];if(!q||active||closed)return;
   mark(index);active=true;player.pause();if(player.webkitDisplayingFullscreen)player.webkitExitFullscreen?.();if(document.fullscreenElement===player)document.exitFullscreen?.().catch(()=>{});player.hidden=true;stage.classList.add('is-question');overlay.hidden=false;
   const order=q.choices.map((_,i)=>i);if(key!=='colors')for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
   overlay.innerHTML=`<div class="question-heading"><small>À toi de jouer · ${index+1} / ${items.length}</small><h2 tabindex="-1">${q.prompt}</h2><div class="question-word"><span lang="ar" dir="rtl">${q.arabic}</span><small>${q.reading}</small></div></div><div class="answer-scene"><div class="scene-answers ${key==='colors'?'sweater-answers':''}">${order.map(i=>{const choice=q.choices[i];return `<button type="button" class="scene-answer ${key==='colors'?'sweater sweater-'+i:''}" data-answer="${i}" aria-label="${Array.isArray(choice)?choice[1]:choice}">${key==='colors'?`<span class="sweater-art" aria-hidden="true"></span><span class="answer-label">${choice}</span>`:Array.isArray(choice)?`<span class="answer-symbol" aria-hidden="true">${choice[0]}</span><span>${choice[1]}</span>`:key==='alphabet'?`<span class="answer-letter" lang="ar" dir="rtl">${choice}</span>`:`<span class="day-card" aria-hidden="true">▦</span><span>${choice}</span>`}</button>`;}).join('')}</div></div><p class="scene-feedback" role="status" aria-live="polite">Écoute puis touche ta réponse.</p><div class="question-actions"><button type="button" class="quiet" data-question-audio>🔊 Réécouter</button><button type="button" class="primary" data-resume>Continuer la chanson →</button></div>`;
   let solved=false,tries=0;
   const buttons=[...overlay.querySelectorAll('[data-answer]')],status=overlay.querySelector('[role=status]');
   buttons.forEach(button=>button.onclick=()=>{
    if(solved)return;
    if(Number(button.dataset.answer)!==q.answer){button.classList.add('try-again');status.textContent='Essaie encore, tu peux réécouter.';if(++tries>=2)buttons.find(b=>Number(b.dataset.answer)===q.answer).classList.add('answer-hint');return;}
    solved=true;stopVoice();buttons.forEach(b=>{b.disabled=true;b.classList.remove('answer-hint');});button.classList.add('answer-correct');status.textContent='✓ Bravo, tu as trouvé !';overlay.querySelector('[data-resume]').focus({preventScroll:true});
   });
   overlay.querySelector('[data-resume]').onclick=()=>close(true);
   overlay.querySelector('h2').focus({preventScroll:true});
   // These local clips were recorded with the selected ElevenLabs Maman V4 voice.
   // French instructions and the target word/letter in Arabic; no browser TTS fallback.
   window.AyaQuestionAudio?.attach(overlay,q.audio);
  }
  function restore(){if(restored||!Number.isFinite(player.duration)||player.duration<=0)return;restored=true;fractions.forEach((fraction,i)=>{if(player.currentTime>player.duration*fraction+1)mark(i);});}
  player.addEventListener('loadedmetadata',restore,{signal});
  player.addEventListener('timeupdate',()=>{
   if(closed||active||!Number.isFinite(player.duration)||player.duration<=0)return;
   restore();const due=fractions.map((fraction,i)=>({at:fraction*player.duration,i})).filter(p=>p.at<=player.currentTime&&!seen.has(p.i));
   if(!due.length)return;
   // Seeking across several stops shows the most recent one, never a queue of interruptions.
   due.slice(0,-1).forEach(p=>mark(p.i));
   const latest=due.at(-1);if(enabled)ask(latest.i);else mark(latest.i);
  },{signal});
  player.addEventListener('play',()=>{if(active)player.pause();},{signal});
  player.addEventListener('ended',()=>{close(false);tools.hidden=true;stopVoice();},{signal});
  root.querySelector('#watch-again')?.addEventListener('click',()=>{seen.clear();restored=false;tools.hidden=false;tools.querySelectorAll('.checkpoint').forEach(dot=>dot.classList.remove('visited'));},{signal});
  toggle.onclick=()=>{enabled=!enabled;label();if(!enabled)close(true);};
  const cleanup=()=>{closed=true;close(false);controller.abort();tools.remove();overlay.remove();stopVoice();};
  root.querySelector('#watch-questions')?.addEventListener('click',cleanup,{capture:true,signal});
  root.querySelector('#watch-game')?.addEventListener('click',cleanup,{capture:true,signal});
  dispose=cleanup;
 }
 window.AyaInteractive={attach};
})();
