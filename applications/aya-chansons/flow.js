(() => {
 'use strict';
 const screen=document.querySelector('#screen'), lesson=document.querySelector('#aya-premium');
 const top=document.querySelector('.top'), back=document.querySelector('#home');
 const catalog=document.querySelector('#catalog'),book=document.querySelector('#book');
 const names={colors:'Les couleurs',alphabet:'L’alphabet',corps:'Le corps',ecole:'L’école',jours:'Les jours'};
 const icons={colors:'🌈',alphabet:'أ ب',corps:'👋',ecole:'🎒',jours:'🗓️'};
 const order=Object.keys(names);let current=null;
 const storage='kmw-aya-watch-v2';
 const read=()=>{try{return JSON.parse(localStorage.getItem(storage))||{};}catch{return {};}};
 const write=value=>{try{localStorage.setItem(storage,JSON.stringify(value));}catch{}};
 function mode(value){document.body.dataset.ayaView=value;}
 function leave(){document.querySelectorAll('video').forEach(v=>v.pause());window.AyaColors?.stop();dispatchEvent(new Event('aya:leave'));}
 function show(key,title){
  leave();current=key;mode('lesson');screen.hidden=key!=='colors';lesson.hidden=key==='colors';
  catalog.hidden=true;book.hidden=true;back.textContent='← Accueil';back.setAttribute('aria-label','Retour à l’accueil des chansons');
  top.dataset.lesson=title;screen.replaceChildren();document.querySelector('#premium-content').replaceChildren();
  if(history.state?.ayaLesson!==key){if(history.state?.ayaLesson)history.replaceState({ayaLesson:key},'', '#'+key);else history.pushState({ayaLesson:key},'', '#'+key);}
  window.scrollTo(0,0);
 }
 function renderHome(){
  leave();current=null;mode('home');lesson.hidden=true;screen.hidden=false;catalog.hidden=false;book.hidden=false;
  top.dataset.lesson='';back.textContent='Avec Aya';back.setAttribute('aria-label','Accueil des chansons');
  const saved=read();const last=Object.hasOwn(names,saved.last)?saved.last:null;
  screen.innerHTML=`<section class="house-welcome"><p class="eyebrow">L’arabe en chansons</p><h1>La maison d’Aya</h1><p>Où veux-tu jouer ?</p></section><div class="aya-house" aria-label="Choisir une pièce de la maison"><img src="media/house/home.webp" alt="La maison d’Aya et Mimi : dressing, miroir, coin lecture, bureau et calendrier" width="1120" height="1400" fetchpriority="high">${order.map(key=>`<button class="house-room room-${key}" data-song="${key}"><span>${key==='alphabet'?'Les lettres':names[key]}</span><small>${key==='colors'?'Découverte gratuite':'Abonnés'}</small></button>`).join('')}</div><button class="resume-song house-resume" id="resume-song"><span class="resume-icon" aria-hidden="true">▶</span><span><strong>${last?'Reprendre ma chanson':'Chanter avec Aya'}</strong><small>${names[last||'colors']}</small></span><span aria-hidden="true">→</span></button>`;
  screen.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>open(b.dataset.song));
  screen.querySelector('#resume-song')?.addEventListener('click',()=>open(last||'colors'));
  screen.querySelector('h1').tabIndex=-1;screen.querySelector('h1').focus({preventScroll:true});window.scrollTo(0,0);
 }
 function home(){if(history.state?.ayaLesson){history.back();}else renderHome();}
 function open(key){
  if(!Object.hasOwn(names,key))return;
  show(key,names[key]);mode('intro');
  const root=key==='colors'?screen:document.querySelector('#premium-content');
  root.innerHTML=`<section class="lesson-intro"><span class="intro-icon" aria-hidden="true">${icons[key]}</span><h1>${names[key]}</h1><p>Chante, écoute… puis touche la bonne réponse !</p><ol class="lesson-plan"><li><span class="plan-number">1</span><div><strong>Je chante avec Aya</strong><small>La chanson fait des pauses pour jouer.</small></div></li><li><span class="plan-number">2</span><div><strong>Je touche la bonne réponse</strong><small>J’écoute la question, puis je choisis.</small></div></li><li><span class="plan-number">✦</span><div><strong>Je gagne ma récompense</strong><small>Un bravo pour mes découvertes !</small></div></li></ol><button class="primary" id="start-lesson" type="button">▶ Chanter et jouer</button><button class="quiet intro-questions" id="start-questions" type="button">Jouer avec les mots →</button><button class="text-back" type="button" id="start-song-only">Chanson seule</button><small class="intro-choice">Choisis ce qui te fait envie.</small></section>`;
  root.querySelector('#start-lesson').onclick=()=>key==='colors'?window.AyaColors.video():window.AyaPremium.open(key);
  root.querySelector('#start-questions').onclick=()=>key==='colors'?window.AyaColors.questions():window.AyaPremium.open(key,'questions');
  root.querySelector('#start-song-only').onclick=()=>key==='colors'?window.AyaColors.video(false):window.AyaPremium.open(key,'song-only');
  const heading=root.querySelector('h1');heading.tabIndex=-1;heading.focus({preventScroll:true});
 }
 function next(key){open(order[(order.indexOf(key)+1)%order.length]);}
 function video(root,key,title,src,poster,game,interactive=true){
  mode('video');const saved=read();saved.last=key;write(saved);
  root.innerHTML=`<section class="watch-screen" aria-label="${title}"><div class="watch-title"><div><h1>${title}</h1><p class="watch-next-hint">${interactive?'La chanson fait des pauses pour jouer':'Un petit moment pour chanter avec Aya'}</p></div><button class="nav" type="button" id="expand-video" aria-label="Afficher la vidéo en plein écran">⛶ <span>Plein écran</span></button></div><div class="watch-stage"><video controls controlslist="nofullscreen nodownload noremoteplayback" disablepictureinpicture playsinline preload="metadata" poster="${poster}" aria-label="${title}"></video></div><div class="watch-actions"><div class="watch-companion"><img src="media/aya.webp" alt="" width="48" height="60"><p>À ton rythme<small>Tu peux aussi jouer tout de suite.</small></p></div><button type="button" class="primary" id="watch-questions">Passer aux questions →</button></div><section class="watch-end" hidden><span class="end-star" aria-hidden="true">✦</span><h2>À toi de jouer !</h2><button type="button" class="primary" id="watch-game">Jouer avec Aya →</button><button type="button" class="quiet" id="watch-again">Revoir la chanson</button></section><p class="watch-error" role="status" hidden>La vidéo n’a pas chargé. <button type="button" class="quiet" id="watch-retry">Réessayer</button></p></section>`;
  const player=root.querySelector('video'),stage=root.querySelector('.watch-stage'),end=root.querySelector('.watch-end'),expand=root.querySelector('#expand-video');
  root.querySelector('h1').tabIndex=-1;root.querySelector('h1').focus({preventScroll:true});
  player.src=src;let lastSaved=-1;
  const persist=()=>{const data=read();data.last=key;data[key]=player.ended?0:player.currentTime;write(data);};
  player.addEventListener('loadedmetadata',()=>{const at=Number(read()[key]);if(Number.isFinite(at)&&at>0&&at<player.duration-3)player.currentTime=at;});
  player.addEventListener('timeupdate',()=>{const tick=Math.floor(player.currentTime/3);if(tick!==lastSaved){lastSaved=tick;persist();}});
  player.addEventListener('pause',persist);
  player.addEventListener('error',()=>{root.querySelector('.watch-error').hidden=false;});
  player.addEventListener('ended',()=>{
   persist();if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});if(player.webkitDisplayingFullscreen)player.webkitExitFullscreen?.();
   root.querySelector('.watch-actions').hidden=true;stage.hidden=true;end.hidden=false;expand.hidden=true;mode('finished');root.querySelector('#watch-game').focus();
  });
  root.querySelector('#watch-again').onclick=()=>{root.querySelector('.watch-actions').hidden=false;end.hidden=true;stage.hidden=false;expand.hidden=false;mode('video');player.currentTime=0;player.play().catch(()=>{});};
  const goToQuestions=()=>{player.pause();persist();mode('game');game();};
  root.querySelector('#watch-game').onclick=goToQuestions;
  root.querySelector('#watch-questions').onclick=goToQuestions;
  root.querySelector('#watch-retry').onclick=()=>{root.querySelector('.watch-error').hidden=true;player.load();};
  window.AyaInteractive?.attach(root,key,interactive);
  expand.onclick=()=>{const shell=root.querySelector('.watch-screen');if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else if(shell.requestFullscreen)shell.requestFullscreen().catch(()=>shell.classList.toggle('expanded'));else shell.classList.toggle('expanded');};
 }
 back.onclick=home;
 addEventListener('popstate',()=>{const key=history.state?.ayaLesson;if(Object.hasOwn(names,key))open(key);else renderHome();});
 addEventListener('pagehide',leave);
 window.AyaFlow={home,show,mode,open,next,video,init(){
  const key=new URLSearchParams(location.search).get('lecon')||location.hash.slice(1);
  history.replaceState({ayaHome:true},'',location.pathname+location.search+'#home');renderHome();if(Object.hasOwn(names,key))open(key);
 }};
})();
