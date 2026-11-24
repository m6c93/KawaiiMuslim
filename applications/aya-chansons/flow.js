(() => {
 'use strict';
 const screen=document.querySelector('#screen'), lesson=document.querySelector('#aya-premium');
 const top=document.querySelector('.top'), back=document.querySelector('#home');
 const catalog=document.querySelector('#catalog'),book=document.querySelector('#book');
 const names={colors:'Les couleurs',alphabet:'L’alphabet',corps:'Le corps',ecole:'L’école',jours:'Les jours'};
 const icons={colors:'🌈',alphabet:'أ ب',corps:'👋',ecole:'🎒',jours:'🗓️'};
 const order=Object.keys(names);let current=null;
 const storage='kmw-aya-watch-v2';
 const read=()=>{try{return JSON.parse(window.KMActivityProgress.storage.getItem(storage))||{};}catch{return {};}};
 const write=value=>{try{window.KMActivityProgress.storage.setItem(storage,JSON.stringify(value));}catch{}};
 function mode(value){document.body.dataset.ayaView=value;}
 function leave(){document.querySelectorAll('video').forEach(v=>v.pause());window.AyaColors?.stop();dispatchEvent(new Event('aya:leave'));}
 function show(key,title){
  window.KMActivityProgress.remember('/applications/aya-chansons/?lecon='+key);
  leave();current=key;mode('lesson');screen.hidden=key!=='colors';lesson.hidden=key==='colors';
  catalog.hidden=true;book.hidden=true;back.textContent='← Maison';back.setAttribute('aria-label','Retour à la maison');
  top.dataset.lesson=title;screen.replaceChildren();document.querySelector('#premium-content').replaceChildren();
  if(history.state?.ayaLesson!==key){if(history.state?.ayaLesson)history.replaceState({ayaLesson:key},'', '#'+key);else history.pushState({ayaLesson:key},'', '#'+key);}
  window.scrollTo(0,0);
 }
 function renderHome(){
  leave();current=null;mode('home');lesson.hidden=true;screen.hidden=false;catalog.hidden=false;book.hidden=false;
  top.dataset.lesson='';back.textContent='Avec Aya';back.setAttribute('aria-label','Accueil des chansons');
  const saved=read();const last=Object.hasOwn(names,saved.last)?saved.last:null;
  screen.innerHTML=`<section class="house-welcome"><p class="eyebrow">L’arabe en chansons</p><h1>La maison d’Aya</h1><p>Touche une télé pour regarder la chanson.</p></section><div class="aya-house tv-house" aria-label="Les télés de la maison"><img src="media/house/home-tv.webp" alt="La maison avec cinq pièces et Mimi près de la porte" width="1122" height="1402" fetchpriority="high">${order.map(key=>`<button class="room-tv tv-${key}" data-song="${key}" aria-label="Regarder la chanson : ${names[key]}"><span class="television"><span class="tv-display"><img src="media/${key==='colors'?'couleurs.webp':key+'-poster.webp'}" alt=""><span class="tv-play" aria-hidden="true">▶</span></span><span class="tv-knobs" aria-hidden="true">●<br>●</span></span><span class="tv-caption">${key==='alphabet'?'Les lettres':names[key]}</span></button>`).join('')}</div>${last?`<button class="resume-song house-resume" id="resume-song"><span class="resume-icon" aria-hidden="true">▶</span><span><strong>Reprendre ma chanson</strong><small>${names[last]}</small></span><span aria-hidden="true">→</span></button>`:''}<section class="house-games" aria-labelledby="questions-title"><h2 id="questions-title">Les questions par thème</h2><p>À toi de jouer, même sans regarder la vidéo.</p><div class="theme-questions">${order.map(key=>`<button type="button" data-questions="${key}"><span aria-hidden="true">${icons[key]}</span><strong>${names[key]}</strong><small>${key==='colors'?'Gratuit':'Abonnés'}</small></button>`).join('')}</div></section>`;
  screen.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>open(b.dataset.song));
  screen.querySelectorAll('[data-questions]').forEach(b=>b.onclick=()=>open(b.dataset.questions,'questions'));
  screen.querySelector('#resume-song')?.addEventListener('click',()=>open(last));
  screen.querySelector('h1').tabIndex=-1;screen.querySelector('h1').focus({preventScroll:true});window.scrollTo(0,0);
 }
 function home(){if(history.state?.ayaLesson){history.back();}else renderHome();}
 function open(key,destination='video'){
  if(!Object.hasOwn(names,key))return;
  if(key==='colors'){
   if(destination==='questions')window.AyaColors.questions();else window.AyaColors.video();
  }else window.AyaPremium.open(key,destination);
 }
 function next(key){open(order[(order.indexOf(key)+1)%order.length]);}
 function video(root,key,title,src,poster,game,interactive=true){
  mode('video');const saved=read();saved.last=key;write(saved);
  root.innerHTML=`<section class="watch-screen" aria-label="${title}"><div class="watch-title"><div><h1>${title}</h1><p class="watch-next-hint">La chanson, puis les questions</p></div><button class="nav" type="button" id="expand-video" aria-label="Afficher la vidéo en plein écran">⛶ <span>Plein écran</span></button></div><div class="watch-stage"><video controls autoplay controlslist="nofullscreen nodownload noremoteplayback" disablepictureinpicture playsinline preload="metadata" poster="${poster}" aria-label="${title}"></video></div><div class="watch-actions"><div class="watch-companion"><img src="media/aya.webp" alt="" width="48" height="60"><p>Après la chanson<small>Les questions arrivent juste après.</small></p></div><button type="button" class="primary" id="watch-questions">Passer aux questions →</button></div><section class="watch-end" hidden><span class="end-star" aria-hidden="true">✦</span><h2>À toi de jouer !</h2><button type="button" class="primary" id="watch-game">Jouer avec Aya →</button><button type="button" class="quiet" id="watch-again">Revoir la chanson</button></section><p class="watch-error" role="status" hidden>La vidéo n’a pas chargé. <button type="button" class="quiet" id="watch-retry">Réessayer</button></p></section>`;
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
   mode('game');game();
  });
  root.querySelector('#watch-again').onclick=()=>{root.querySelector('.watch-actions').hidden=false;end.hidden=true;stage.hidden=false;expand.hidden=false;mode('video');player.currentTime=0;player.play().catch(()=>{});};
  const goToQuestions=()=>{player.pause();persist();mode('game');game();};
  root.querySelector('#watch-game').onclick=goToQuestions;
  root.querySelector('#watch-questions').onclick=goToQuestions;
  root.querySelector('#watch-retry').onclick=()=>{root.querySelector('.watch-error').hidden=true;player.load();};
  player.play().catch(()=>{ /* Mobile browsers may require touching the native play control. */ });
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
