(() => {
  'use strict';
  const topics = {
    jours: {name:'Les jours', icon:'🗓️', lesson:'Les jours de la semaine', prompt:'Quel jour est-ce ?', questions:[
      ['الْجُمُعَة','Al-joumou‘a',['Vendredi','Lundi','Dimanche'],0],
      ['الِاثْنَيْن','Al-ithnayn',['Jeudi','Lundi','Samedi'],1],
      ['السَّبْت','As-sabt',['Mardi','Vendredi','Samedi'],2]
    ]},
    corps: {name:'Le corps',icon:'👀',lesson:'Les parties du corps',prompt:'Touche la bonne image',questions:[
      ['عَيْن','‘Ayn',[['👁️','L’œil'],['👂','L’oreille'],['👃','Le nez']],0],
      ['أُذُن','Oudhoune',[['👃','Le nez'],['👂','L’oreille'],['👁️','L’œil']],1],
      ['رَأْس','Ra’s',[['👂','L’oreille'],['👃','Le nez'],['🙂','La tête']],2]
    ]},
    ecole: {name:'L’école',icon:'🎒',lesson:'Mon école',prompt:'Touche la bonne image',questions:[
      ['مَدْرَسَة','Madrasa',[['🏫','L’école'],['📚','La bibliothèque'],['🛝','La cour']],0],
      ['مَكْتَبَة','Maktaba',[['🛝','La cour'],['📚','La bibliothèque'],['🏫','L’école']],1],
      ['سَاحَة','Sâha',[['📚','La bibliothèque'],['🏫','L’école'],['🛝','La cour']],2]
    ]},
    alphabet: {name:'L’alphabet',icon:'🔤',lesson:'L’alphabet arabe',prompt:'Quelle est la première lettre ?',questions:[
      ['بَطَّة','Canard',['ت','ب','ث'],1],
      ['تُفَّاحَة','Pomme',['ب','ث','ت'],2],
      ['ثَلْج','Neige',['ث','ت','ب'],0]
    ]}
  };
  const dialog=document.querySelector('#aya-premium'), panel=document.querySelector('#premium-content');
  const title=document.querySelector('#premium-title');
  const appPath='/applications/aya-chansons/';
  const account='/Compte.dc.html?abonnement=requis';
  const authScript='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  let clientPromise, access='unknown', current, request, objectUrl;
  let awarded=[];
  try {const saved=JSON.parse(localStorage.getItem('kmw-aya-premium-stamps')||'[]');if(Array.isArray(saved))awarded=Object.keys(topics).filter(k=>saved.includes(k));} catch {}

  function loadScript(src) {
    return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});
  }
  function client(){
    if(!clientPromise)clientPromise=Promise.all([
      window.supabase?null:loadScript(authScript),
      window.KM_CONFIG?null:loadScript('/km-config.js')
    ]).then(()=>window.supabase.createClient(window.KM_CONFIG.supabaseUrl,window.KM_CONFIG.supabaseAnonKey))
      .catch(err=>{clientPromise=null;throw err;});
    return clientPromise;
  }
  async function session(){const result=await (await client()).auth.getSession();if(result.error)throw result.error;return result.data.session;}
  async function check(token,path,signal){
    const headers={Authorization:'Bearer '+token};
    const childId=window.KM_CONFIG?.currentChildId?.();
    if(childId)headers['X-KMW-Child-Profile']=childId;
    return fetch(path,{method:'POST',headers,cache:'no-store',signal});
  }
  const snap=()=>{};
  function release(){
    if(request)request.abort();
    request=null;
    panel.querySelector('video')?.pause();
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
  }
  addEventListener('aya:leave',()=>{release();current=null;});
  function showLocked(kind,key){
    const signin=kind==='signin';
    const login='/Connexion.dc.html?next='+encodeURIComponent(appPath+'?lecon='+key);
    panel.innerHTML=`<div class="premium-intro"><p>Cette leçon est réservée aux abonnés.</p><div class="premium-actions">${signin?`<a class="primary" href="${login}">Se connecter</a><a class="quiet" href="/presentation.html#tarifs">Voir les abonnements</a>`:`<a class="primary" href="${account}">Voir les abonnements</a>`}</div></div>`;
  }
  function showUnavailable(key,destination='video'){
    panel.innerHTML='<div class="premium-intro"><p role="status">Impossible d’ouvrir la leçon pour le moment.</p><button class="quiet" type="button" id="premium-retry">Réessayer</button></div>';
    panel.querySelector('#premium-retry').onclick=()=>open(key,destination);
  }
  async function open(key,destination='video'){
    if(!Object.hasOwn(topics,key))return;
    window.AyaFlow.show(key,topics[key].lesson);
    release();current=key;
    const controller=new AbortController();request=controller;
    const pending=()=>!dialog.hidden&&request===controller;
    title.textContent=topics[key].lesson;
    panel.innerHTML='<p class="premium-intro" role="status">Ouverture de la leçon…</p>';

    const timer=setTimeout(()=>controller.abort(),60000);
    try {
      const signedIn=await session();
      if(!pending())return;
      if(!signedIn?.access_token){access='signin';snap();showLocked('signin',key);return;}
      const response=await check(signedIn.access_token,destination==='questions'?'/api/aya/access':'/api/aya/media/'+key,controller.signal);
      if(!pending())return;
      if(response.status===401||response.status===403){
        const detail=response.status===403 ? await response.json().catch(()=>null) : null;
        if(!pending())return;
        access=response.status===401?'signin':'subscribe';snap();
        showLocked(access,key);
        return;
      }
      if(destination==='questions'&&response.ok){access='allowed';quiz(key,0);return;}
      if(!response.ok||!response.headers.get('content-type')?.startsWith('video/mp4')){showUnavailable(key,destination);return;}
      const video=await response.blob();
      if(!pending())return;
      access='allowed';snap();
      objectUrl=URL.createObjectURL(video);
      window.AyaFlow.video(panel,key,topics[key].lesson,objectUrl,'media/'+key+'-poster.webp',()=>{release();quiz(key,0);});
    } catch {if(pending())showUnavailable(key,destination);}
    finally {clearTimeout(timer);}
  }
  function quiz(key,index){
    if(dialog.hidden||current!==key||access!=='allowed')return;
    window.AyaFlow.mode('game');
    const t=topics[key];
    if(index>=t.questions.length){
      if(!awarded.includes(key)){awarded.push(key);try{localStorage.setItem('kmw-aya-premium-stamps',JSON.stringify(awarded));}catch{}}
      panel.innerHTML=`<div class="premium-intro"><span class="premium-reward" aria-hidden="true">${t.icon}</span><h3>Bravo !</h3><p>Tu as terminé la leçon.</p><button type="button" class="primary" id="premium-finish">Chanson suivante →</button><button type="button" class="text-back" id="premium-home">Accueil</button></div>`;
      panel.querySelector('#premium-finish').onclick=()=>window.AyaFlow.next(key);panel.querySelector('#premium-home').onclick=()=>window.AyaFlow.home();snap();return;
    }
    const [arabic,reading,choices,answer]=t.questions[index];
    const order=choices.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    panel.innerHTML=`<section class="premium-question"><small>Étape ${index+1} sur ${t.questions.length}</small><h3>${t.prompt}</h3><div class="word" lang="ar" dir="rtl">${arabic}</div><div>${reading}</div><div class="premium-cards">${order.map(i=>`<button type="button" class="premium-choice" data-choice="${i}">${Array.isArray(choices[i])?`<span aria-hidden="true">${choices[i][0]}</span>${choices[i][1]}`:key==='alphabet'?`<span lang="ar">${choices[i]}</span>`:choices[i]}</button>`).join('')}</div><p role="status"></p><button type="button" class="primary" id="premium-next" hidden>${index+1===t.questions.length?'Terminer':'Continuer'} →</button></section>`;
    const choicesButtons=[...panel.querySelectorAll('[data-choice]')], feedback=panel.querySelector('[role=status]'), next=panel.querySelector('#premium-next');
    let tries=0;
    choicesButtons.forEach(b=>b.onclick=()=>{
      if(Number(b.dataset.choice)!==answer){b.classList.add('wrong');feedback.textContent=++tries>=2?'Essaie la réponse entourée.':'Essaie encore.';if(tries>=2)choicesButtons.find(c=>Number(c.dataset.choice)===answer).classList.add('good');return;}
      choicesButtons.forEach(c=>c.disabled=true);b.classList.add('good');feedback.textContent='Bien trouvé !';next.hidden=false;next.focus();
    });
    next.onclick=()=>quiz(key,index+1);
  }
  window.AyaPremium={open,topics};
  window.AyaFlow.init();
})();
