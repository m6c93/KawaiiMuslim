(() => {
  'use strict';
  const colors = {
    rouge: ['أَحْمَر','Ahmar','#e44661'],
    bleu: ['أَزْرَق','Azraq','#3380cf'],
    jaune: ['أَصْفَر','Asfar','#ffd24f'],
    vert: ['أَخْضَر','Akhdar','#318a60'],
    rose: ['وَرْدِيّ','Wardi','#ee91b4'],
    violet: ['بَنَفْسَجِيّ','Banafsaji','#8b5cb8'],
    blanc: ['أَبْيَض','Abyad','#fff'],
    noir: ['أَسْوَد','Aswad','#292737']
  };
  const packs = [
    {name:'Premiers crayons',keys:['rouge','bleu','jaune'],stamp:'🖍️'},
    {name:'De nouvelles couleurs',keys:['vert','rose','violet'],stamp:'🌷'},
    {name:'Mon arc-en-ciel',keys:['blanc','noir','bleu'],stamp:'🌈'}
  ];
  const key = 'kmw-aya-chansons-v1';
  let done = [];
  try {const data=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(data))done=packs.map((_,i)=>i).filter(i=>data.includes(i));} catch {}
  const screen = document.querySelector('#screen');
  const clip = new Audio();
  let pack=0,step=0,questions=[],mistakes=0,answerFound=false;
  let currentView='home';
  const nextPack=()=>packs.findIndex((_,i)=>!done.includes(i));
  const title=s=>s[0].toUpperCase()+s.slice(1);
  const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const button=(selector,run)=>screen.querySelector(selector)?.addEventListener('click',run);
  const stop=()=>{clip.pause();screen.querySelector('#colors-video')?.pause();};
  addEventListener('aya:pause-colors', stop);
  function render(markup,view){
    stop();window.AyaFlow.show('colors',view==='carnet'?'Mon carnet':'Les couleurs');currentView=view;screen.innerHTML=markup;window.scrollTo(0,0);
    const heading=screen.querySelector('h1');heading.tabIndex=-1;heading.focus({preventScroll:true});
  }
  function play(word){
    stop();
    clip.src='media/'+word+'.mp3';
    clip.play().catch(()=>{if(clip.paused){const note=screen.querySelector('#sound-status');if(note)note.textContent='Réessaie en touchant Écouter.';}});
  }
  function word(key,showFrench=true){const [ar,latin]=colors[key];return `<div class="word-line"><span class="word" dir="rtl" lang="ar">${ar}</span><span>${latin}${showFrench?' · '+title(key):''}</span></div>`;}
  const progress=(n,total,label)=>`<div class="activity-bar"><span>${label}</span><div class="dots" aria-label="Étape ${n} sur ${total}">${Array.from({length:total},(_,i)=>`<i class="${i<n?'on':''}" aria-hidden="true"></i>`).join('')}</div></div>`;
  function home(){window.AyaFlow.home();}
  function colorsVideo(){window.AyaFlow.show('colors','Les couleurs');window.AyaFlow.video(screen,'colors','Les couleurs','media/couleurs.mp4','media/couleurs.webp',startNext);}
  function startNext(){const next=nextPack();if(next<0){pack=0;questions=shuffle(Object.keys(colors)).slice(0,3);step=0;question(true);}else start(next);}
  function start(index){pack=index;step=0;discover();}
  function discover(){
    const {keys}=packs[pack], target=keys[step];
    render(`<section class="activity view">${progress(step+1,keys.length,'Les couleurs · J’écoute')}<h1>Répète avec Aya</h1><div class="lesson-image" style="--color:${colors[target][2]}" aria-hidden="true"></div>${word(target)}<button class="listen lesson-sound" type="button" id="listen">♫ Écouter</button><span id="sound-status" class="muted" role="status"></span><button class="primary" type="button" id="next">${step+1===keys.length?'À moi de jouer':'Mot suivant'} →</button></section>`,'discover');
    button('#listen',()=>play(target));
    button('#next',()=>{if(++step<keys.length)discover();else{step=0;questions=shuffle(keys);question(false);}});
  }
  function question(review){
    mistakes=0;answerFound=false;
    const target=questions[step], shape=step===questions.length-1?'balloon':'crayon';
    const candidates=review?Object.keys(colors):packs[pack].keys;
    const choices=shuffle([target,...shuffle(candidates.filter(k=>k!==target)).slice(0,2)]);
    render(`<section class="activity view">${progress(step+1,questions.length,review?'Les couleurs · Je révise':'Les couleurs · Je joue')}<h1>${shape==='balloon'?'Trouve le ballon':'Choisis le crayon'}</h1>${word(target,false)}<div class="drop" id="box"><span>${shape==='balloon'?'✦ Touche le bon ballon':'▱ Dépose le crayon ici'}</span></div><div class="tray" aria-label="Choix de couleurs">${choices.map(k=>`<button type="button" class="choice" data-word="${k}" aria-label="${title(k)}" style="--color:${colors[k][2]}"><span class="shape ${shape}" aria-hidden="true"></span></button>`).join('')}</div><div class="feedback" id="feedback" role="status" aria-live="polite">${shape==='balloon'?'':'Tu peux aussi toucher un crayon.'}</div><div class="step-next"><button class="quiet" type="button" id="hint-audio">♫ Écouter</button><button class="primary" id="continue" type="button" hidden>${step===questions.length-1?'Terminer':'Continuer'} →</button></div></section>`,'quiz');
    const box=screen.querySelector('#box'), feedback=screen.querySelector('#feedback'), next=screen.querySelector('#continue'), listen=screen.querySelector('#hint-audio');
    const tiles=[...screen.querySelectorAll('.choice')], correct=tiles.find(t=>t.dataset.word===target);
    const hint=()=>{feedback.textContent='Cherche '+target+'.';correct.classList.add('hint');};
    listen.addEventListener('click',()=>play(target));
    function choose(tile){
      if(answerFound)return;
      if(tile!==correct){++mistakes;tile.classList.add('try');feedback.textContent='Essaie une autre couleur.';if(mistakes>=2)hint();return;}
      answerFound=true;tiles.forEach(t=>{t.classList.remove('try','hint');t.setAttribute('aria-disabled','true');});tile.classList.add('correct');box.classList.add('done');box.textContent='✓ Bien trouvé !';feedback.textContent=title(target)+' !';play(target);listen.hidden=true;next.hidden=false;next.focus({preventScroll:true});
    }
    for(const tile of tiles){
      let pointer=null,dragged=false,cancelClick=false,x=0,y=0;
      tile.addEventListener('click',()=>{if(!cancelClick)choose(tile);cancelClick=false;});
      if(shape!=='crayon')continue;
      tile.addEventListener('pointerdown',e=>{if(answerFound||!e.isPrimary||e.button!==0)return;pointer=e.pointerId;x=e.clientX;y=e.clientY;dragged=false;cancelClick=false;tile.setPointerCapture(pointer);});
      tile.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;const dx=e.clientX-x,dy=e.clientY-y;if(Math.hypot(dx,dy)>8)dragged=true;if(!dragged)return;tile.classList.add('is-drag');tile.style.setProperty('--dx',dx+'px');tile.style.setProperty('--dy',dy+'px');box.classList.toggle('over',inBox(e));});
      function inBox(e){const {left,right,top,bottom}=box.getBoundingClientRect();return e.clientX>=left-10&&e.clientX<=right+10&&e.clientY>=top-10&&e.clientY<=bottom+10;}
      function reset(e){if(e.pointerId!==pointer)return false;pointer=null;box.classList.remove('over');tile.classList.remove('is-drag');cancelClick=dragged;return true;}
      tile.addEventListener('pointerup',e=>{if(reset(e)&&dragged&&inBox(e))choose(tile);});
      tile.addEventListener('pointercancel',reset);tile.addEventListener('lostpointercapture',reset);
    }
    next.addEventListener('click',()=>{if(++step<questions.length)question(review);else reward(review);});
  }
  function reward(review){
    if(!review&&!done.includes(pack)){done.push(pack);try{localStorage.setItem(key,JSON.stringify(done));}catch{}}
    const next=nextPack();
    render(`<section class="reward view"><img src="media/aya-bravo.webp" alt="Aya sourit"><h1>Bravo !</h1><span class="sticker" aria-hidden="true">${review?'✦':packs[pack].stamp}</span><p>${review?'Tu as retrouvé les couleurs !':'Un autocollant dans ton carnet !'}</p><button class="primary" id="reward-next" type="button">${next>=0?'Encore des couleurs':'Ouvrir mon carnet'} →</button><button class="text-back" type="button" id="back-home">Retour à Aya</button></section>`,'reward');
    screen.querySelector('#reward-next').textContent='Chanson suivante →';button('#reward-next',()=>window.AyaFlow.open('alphabet'));button('#back-home',home);
  }
  function carnet(){
    render(`<section class="carnet view"><p class="eyebrow">Mes couleurs avec Aya</p><h1>Mon carnet</h1><div class="stickers">${packs.map(({name,stamp},i)=>`<div class="stamp"><span class="sticker ${done.includes(i)?'':'locked'}" role="img" aria-label="${done.includes(i)?'Gagné':'À gagner'} : ${name}">${done.includes(i)?stamp:'☆'}</span><small>${name}</small></div>`).join('')}</div><p>${done.length} / ${packs.length} autocollants</p><button class="primary" type="button" id="carnet-play">${nextPack()<0?'Réviser les couleurs':'Jouer aux couleurs'} →</button><button class="text-back" type="button" id="carnet-back">Retour à Aya</button></section>`,'carnet');
    button('#carnet-play',startNext);button('#carnet-back',home);
  }
  
  document.querySelector('#book').addEventListener('click',()=>currentView==='carnet'?home():carnet());
  const catalog=document.querySelector('#catalog');
  try {const ref=new URL(document.referrer);if(ref.origin===location.origin&&/^\/(?:Applications|Application)\.dc(?:\.html)?$/i.test(ref.pathname)&&ref.searchParams.get('guest')!=='1'&&sessionStorage.getItem('km-guest-mode')!=='1')catalog.href='/Application.dc.html?section=apps';}catch{}
  window.AyaColors={video:colorsVideo,game:startNext,stop};
})();
