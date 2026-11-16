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
  screen.innerHTML=`<section class="song-welcome"><div><p class="eyebrow">L’arabe en chansons</p><h1>Chante avec Aya</h1><p>Quelle chanson choisis-tu ?</p></div><img src="media/aya.webp" alt="" width="112" height="140"></section>${last?`<button class="resume-song" id="resume-song"><span class="resume-icon" aria-hidden="true">▶</span><span><strong>Continuer</strong><small>${names[last]}</small></span><span aria-hidden="true">→</span></button>`:''}<div class="song-grid" aria-label="Choisir une chanson">${order.map(key=>`<button class="song-card song-${key}" data-song="${key}"><span class="song-icon" aria-hidden="true">${icons[key]}</span><strong>${names[key]}</strong><small>${key==='colors'?'Découverte gratuite':'Abonnés'}</small><span class="song-arrow" aria-hidden="true">▶</span></button>`).join('')}</div>`;
  screen.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>open(b.dataset.song));
  screen.querySelector('#resume-song')?.addEventListener('click',()=>open(last));
  screen.querySelector('h1').tabIndex=-1;screen.querySelector('h1').focus({preventScroll:true});window.scrollTo(0,0);
 }
 function home(){if(history.state?.ayaLesson){history.back();}else renderHome();}
 function open(key){if(!Object.hasOwn(names,key))return;key==='colors'?window.AyaColors.video():window.AyaPremium.open(key);}
 function next(key){open(order[(order.indexOf(key)+1)%order.length]);}
 function video(root,key,title,src,poster,game){
  mode('video');const saved=read();saved.last=key;write(saved);
  root.innerHTML=`<section class="watch-screen" aria-label="${title}"><div class="watch-title"><h1>${title}</h1><button class="nav" type="button" id="expand-video" aria-label="Afficher la vidéo en plein écran">⛶ <span>Plein écran</span></button></div><div class="watch-stage"><video controls playsinline preload="metadata" poster="${poster}" aria-label="${title}"></video></div><section class="watch-end" hidden><span class="end-star" aria-hidden="true">✦</span><h2>À toi de jouer !</h2><button type="button" class="primary" id="watch-game">Jouer avec Aya →</button><button type="button" class="quiet" id="watch-again">Revoir la chanson</button></section><p class="watch-error" role="status" hidden>La vidéo n’a pas chargé. <button type="button" class="quiet" id="watch-retry">Réessayer</button></p></section>`;
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
   stage.hidden=true;end.hidden=false;expand.hidden=true;mode('finished');root.querySelector('#watch-game').focus();
  });
  root.querySelector('#watch-again').onclick=()=>{end.hidden=true;stage.hidden=false;expand.hidden=false;mode('video');player.currentTime=0;player.play().catch(()=>{});};
  root.querySelector('#watch-game').onclick=()=>{player.pause();mode('game');game();};
  root.querySelector('#watch-retry').onclick=()=>{root.querySelector('.watch-error').hidden=true;player.load();};
  expand.onclick=()=>{if(player.webkitEnterFullscreen)player.webkitEnterFullscreen();else player.requestFullscreen?.().catch(()=>{});};
 }
 back.onclick=home;
 addEventListener('popstate',()=>{const key=history.state?.ayaLesson;if(Object.hasOwn(names,key))open(key);else renderHome();});
 addEventListener('pagehide',leave);
 window.AyaFlow={home,show,mode,open,next,video,init(){
  const key=new URLSearchParams(location.search).get('lecon')||location.hash.slice(1);
  history.replaceState({ayaHome:true},'',location.pathname+location.search+'#home');renderHome();if(Object.hasOwn(names,key))open(key);
 }};
})();
