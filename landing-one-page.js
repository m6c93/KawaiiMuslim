(()=>{
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header=document.querySelector('[data-header]');
  const reveals=[...document.querySelectorAll('.reveal')];
  const parallaxItems=[...document.querySelectorAll('[data-parallax]')];
  const tiltItems=[...document.querySelectorAll('.interactive-tilt')];
  const magneticItems=[...document.querySelectorAll('.button,.text-link')];
  const bookRail=document.querySelector('[data-book-rail]');
  const bookMarquee=document.querySelector('[data-book-marquee]');
  const bookGroup=document.querySelector('[data-book-group]');

  document.documentElement.classList.add('motion-ready');
  const progress=document.createElement('div');
  progress.className='scroll-progress';
  progress.setAttribute('aria-hidden','true');
  document.body.append(progress);
  const spotlight=document.createElement('div');
  spotlight.className='pointer-spotlight';
  spotlight.setAttribute('aria-hidden','true');
  document.body.append(spotlight);

  const observer=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}
    });
  },{threshold:.13,rootMargin:'0px 0px -8%'});
  reveals.forEach(item=>observer.observe(item));

  const updateScroll=()=>{
    header?.classList.toggle('is-scrolled',scrollY>28);
    const maxScroll=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    progress.style.transform=`scaleX(${Math.min(1,scrollY/maxScroll)})`;
    if(reduceMotion)return;
    const viewport=innerHeight;
    parallaxItems.forEach(item=>{
      const box=item.getBoundingClientRect();
      if(box.bottom<0||box.top>viewport)return;
      const speed=Number(item.dataset.parallax||0);
      const offset=(viewport/2-(box.top+box.height/2))*speed;
      item.style.setProperty('--scroll-y',`${offset.toFixed(1)}px`);
      item.style.translate=`0 var(--scroll-y)`;
    });
  };
  let ticking=false;
  const onScroll=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{updateScroll();ticking=false})};
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onScroll,{passive:true});
  updateScroll();

  if(bookMarquee&&bookRail&&bookGroup){
    const duplicate=bookGroup.cloneNode(true);
    duplicate.setAttribute('aria-hidden','true');
    duplicate.removeAttribute('data-book-group');
    duplicate.querySelectorAll('a').forEach(link=>link.tabIndex=-1);
    bookRail.append(duplicate);

    let resumeTimer=0;
    if(reduceMotion)bookMarquee.classList.add('is-paused');
    const resumeSoon=()=>{
      clearTimeout(resumeTimer);
      resumeTimer=setTimeout(()=>{
        if(!reduceMotion)bookMarquee.classList.remove('is-paused');
      },900);
    };
    const pause=()=>{bookMarquee.classList.add('is-paused');clearTimeout(resumeTimer)};
    bookMarquee.addEventListener('pointerdown',pause,{passive:true});
    bookMarquee.addEventListener('pointerup',resumeSoon,{passive:true});
    bookMarquee.addEventListener('pointercancel',resumeSoon,{passive:true});
    bookMarquee.addEventListener('focusin',pause);
    bookMarquee.addEventListener('focusout',resumeSoon);
  }

  if(!reduceMotion&&matchMedia('(pointer:fine)').matches){
    addEventListener('pointermove',event=>{
      spotlight.style.setProperty('--spot-x',`${event.clientX}px`);
      spotlight.style.setProperty('--spot-y',`${event.clientY}px`);
      spotlight.classList.add('is-active');
    },{passive:true});
    tiltItems.forEach(item=>{
      item.addEventListener('pointermove',event=>{
        const rect=item.getBoundingClientRect();
        const x=(event.clientX-rect.left)/rect.width-.5;
        const y=(event.clientY-rect.top)/rect.height-.5;
        item.style.setProperty('--tilt-x',`${(x*5).toFixed(2)}deg`);
        item.style.setProperty('--tilt-y',`${(-y*4).toFixed(2)}deg`);
        item.style.setProperty('--mouse-x',`${(x*5).toFixed(1)}px`);
        item.style.setProperty('--mouse-y',`${(y*5).toFixed(1)}px`);
      });
      item.addEventListener('pointerleave',()=>{
        item.style.setProperty('--tilt-x','0deg');item.style.setProperty('--tilt-y','0deg');
        item.style.setProperty('--mouse-x','0px');item.style.setProperty('--mouse-y','0px');
      });
    });
    magneticItems.forEach(item=>{
      item.addEventListener('pointermove',event=>{
        const rect=item.getBoundingClientRect();
        const x=(event.clientX-rect.left-rect.width/2)*.12;
        const y=(event.clientY-rect.top-rect.height/2)*.12;
        item.style.setProperty('--magnet-x',`${x.toFixed(1)}px`);
        item.style.setProperty('--magnet-y',`${y.toFixed(1)}px`);
      });
      item.addEventListener('pointerleave',()=>{
        item.style.setProperty('--magnet-x','0px');
        item.style.setProperty('--magnet-y','0px');
      });
    });
  }

  document.querySelectorAll('.journey-step,.plan,.book-cover').forEach((item,index)=>{
    item.style.setProperty('--reveal-delay',`${Math.min(index%5,4)*70}ms`);
  });

  document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
    const target=document.querySelector(link.getAttribute('href'));
    if(!target)return;
    event.preventDefault();
    target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
  }));

  const samplePages=[1,2,3,4].map(number=>`brand/books/miracles-du-coran/page-${String(number).padStart(2,'0')}.jpg`);
  const sampleBook=document.getElementById('landingBook');
  if(false&&sampleBook){
    const sampleVolume=sampleBook.querySelector('.sample-book-volume'),sampleCover=document.getElementById('landingBookCover'),sampleSpread=document.getElementById('landingSpread'),sampleLeft=document.getElementById('landingLeftPage'),sampleRight=document.getElementById('landingRightPage'),sampleCount=document.getElementById('landingBookCount'),samplePrev=document.getElementById('landingBookPrev'),sampleNext=document.getElementById('landingBookNext');
    let samplePosition=0,sampleTurning=false,sampleTouchX=0;
    const sampleMobile=()=>matchMedia('(max-width:600px)').matches;
    const sampleMax=()=>sampleMobile()?4:3;
    const samplePair=position=>sampleMobile()?[position,0]:(position===1?[0,1]:(position===2?[2,3]:[4,0]));
    const sampleSource=page=>page?samplePages[page-1]:'';
    const setPage=(image,page)=>{
      image.hidden=!page;
      image.parentElement.classList.toggle('sample-blank-page',!page);
      if(page){image.src=sampleSource(page);image.alt=`Page ${page} du livre`}
      else{image.removeAttribute('src');image.alt='Page intérieure vide'}
    };
    const renderBook=()=>{
      const mobile=sampleMobile();
      samplePosition=Math.min(samplePosition,sampleMax());sampleCover.hidden=samplePosition!==0;sampleSpread.hidden=samplePosition===0;samplePrev.disabled=samplePosition===0;sampleNext.disabled=samplePosition===sampleMax();
      if(!samplePosition){sampleCount.textContent='Couverture';return}
      const[left,right]=samplePair(samplePosition);sampleLeft.src=sampleSource(left);sampleLeft.alt=`Page ${left} du livre`;if(right){sampleRight.src=sampleSource(right);sampleRight.alt=`Page ${right} du livre`}sampleLeft.parentElement.classList.toggle('mobile-visible',mobile);sampleRight.parentElement.classList.toggle('mobile-visible',!mobile);sampleCount.textContent=mobile?`${left} / 4`:`Pages ${left}–${right}`;
    };
    const turnBook=target=>{
      target=Math.max(0,Math.min(sampleMax(),target));if(target===samplePosition||sampleTurning)return;
      if(samplePosition===0||target===0||reduceMotion){samplePosition=target;renderBook();return}
      sampleTurning=true;const mobile=sampleMobile(),forward=target>samplePosition,[currentLeft,currentRight]=samplePair(samplePosition),[targetLeft,targetRight]=samplePair(target),leaf=document.createElement('div');leaf.className=`sample-flip ${forward?'':'backward'}`;const front=mobile?currentLeft:(forward?currentRight:currentLeft),back=mobile?targetLeft:(forward?targetLeft:targetRight);if(mobile||!forward)sampleLeft.src=sampleSource(targetLeft);else sampleRight.src=sampleSource(targetRight);leaf.innerHTML=`<div class="sample-flip-face front"><img src="${sampleSource(front)}" alt="Page ${front}"></div><div class="sample-flip-face back"><img src="${sampleSource(back)}" alt="Page ${back}"></div>`;sampleVolume.appendChild(leaf);void leaf.offsetWidth;leaf.classList.add('turning');leaf.style.transition='transform 950ms cubic-bezier(.34,.04,.26,1)';requestAnimationFrame(()=>leaf.style.transform=`rotateY(${forward?-180:180}deg)`);const finish=()=>{samplePosition=target;renderBook();leaf.remove();sampleTurning=false};leaf.addEventListener('transitionend',finish,{once:true});setTimeout(()=>{if(sampleTurning)finish()},1100)
    };
    document.getElementById('landingBookOpen').addEventListener('click',()=>turnBook(1));samplePrev.addEventListener('click',()=>turnBook(samplePosition-1));sampleNext.addEventListener('click',()=>turnBook(samplePosition+1));sampleVolume.addEventListener('touchstart',event=>{if(event.touches.length===1)sampleTouchX=event.touches[0].clientX},{passive:true});sampleVolume.addEventListener('touchend',event=>{const distance=event.changedTouches[0].clientX-sampleTouchX;if(Math.abs(distance)>55)turnBook(samplePosition+(distance<0?1:-1))},{passive:true});window.addEventListener('resize',renderBook);renderBook();
    const sampleAudioButton=document.getElementById('landingDuaAudio'),sampleAudio=new Audio('audio/safe-place/yunus.mp3');sampleAudioButton.addEventListener('click',()=>{if(sampleAudio.paused){sampleAudio.play();sampleAudioButton.innerHTML='<span>Ⅱ</span> Mettre en pause'}else{sampleAudio.pause();sampleAudioButton.innerHTML='<span>▶</span> Écouter l\'invocation'}});sampleAudio.addEventListener('ended',()=>sampleAudioButton.innerHTML='<span>▶</span> Écouter l\'invocation');
  }

  if(sampleBook&&sampleBook.querySelector('.sample-book-volume')){
    const sampleVolume=sampleBook.querySelector('.sample-book-volume');
    const sampleCover=document.getElementById('landingBookCover');
    const sampleSpread=document.getElementById('landingSpread');
    const sampleLeft=document.getElementById('landingLeftPage');
    const sampleRight=document.getElementById('landingRightPage');
    const sampleCount=document.getElementById('landingBookCount');
    const samplePrev=document.getElementById('landingBookPrev');
    const sampleNext=document.getElementById('landingBookNext');
    const sampleOpen=document.getElementById('landingBookOpen');
    const sampleFullscreen=document.getElementById('landingBookFullscreen');
    let samplePosition=0;
    let sampleTurning=false;
    let sampleTouchX=0;
    let sampleTouchBlocked=false;
    const sampleMobile=()=>matchMedia('(max-width:600px)').matches;
    const sampleMax=()=>sampleMobile()?4:3;
    const samplePair=position=>sampleMobile()?[position,0]:(position===1?[0,1]:(position===2?[2,3]:[4,0]));
    const sampleSource=page=>page?samplePages[page-1]:'';
    const setPage=(image,page)=>{
      image.hidden=!page;
      image.parentElement.classList.toggle('sample-blank-page',!page);
      if(page){image.src=sampleSource(page);image.alt=`Page ${page} du livre`}
      else{image.removeAttribute('src');image.alt=''}
    };
    const setSpread=position=>{
      const mobile=sampleMobile();
      const [left,right]=samplePair(position);
      sampleSpread.classList.remove('sample-cover-back','sample-only-right');
      sampleSpread.classList.toggle('sample-only-left',!mobile&&Boolean(left)&&!right);
      setPage(sampleLeft,left);
      setPage(sampleRight,right);
      sampleLeft.parentElement.classList.toggle('mobile-visible',mobile);
      sampleRight.parentElement.classList.toggle('mobile-visible',!mobile);
      sampleCount.textContent=mobile?`${left} / 4`:(left&&right?`Pages ${left}–${right}`:`Page ${left||right}`);
    };
    const renderBook=()=>{
      samplePosition=Math.min(samplePosition,sampleMax());
      sampleVolume.classList.toggle('sample-binding-visible',samplePosition!==0);
      sampleCover.hidden=samplePosition!==0;
      sampleSpread.hidden=samplePosition===0;
      samplePrev.disabled=samplePosition===0||sampleTurning;
      sampleNext.disabled=samplePosition===sampleMax()||sampleTurning;
      if(!samplePosition){sampleCount.textContent='Couverture';return}
      setSpread(samplePosition);
    };
    const openBook=()=>{
      if(sampleTurning||samplePosition!==0)return;
      if(reduceMotion){samplePosition=1;sampleSpread.hidden=false;renderBook();return}
      sampleTurning=true;
      sampleVolume.classList.add('sample-binding-visible');
      setSpread(1);
      sampleSpread.classList.add('sample-opening');
      sampleSpread.hidden=false;
      sampleCover.hidden=false;
      samplePrev.disabled=true;
      sampleNext.disabled=true;
      sampleCover.style.transition='';
      sampleCover.style.transform='';
      const openingAnimation=sampleCover.animate([
        {transform:'rotateY(0deg) translateZ(0)',offset:0},
        {transform:'rotateY(-16deg) translateZ(8px)',offset:.12},
        {transform:'rotateY(-72deg) translateZ(18px)',offset:.42},
        {transform:'rotateY(-132deg) translateZ(12px)',offset:.72},
        {transform:'rotateY(-174deg) translateZ(3px)',offset:.94},
        {transform:'rotateY(-180deg) translateZ(0)',offset:1}
      ],{duration:1250,easing:'cubic-bezier(.2,.65,.18,1)',fill:'forwards'});
      let completed=false;
      const finish=()=>{
        if(completed)return;
        completed=true;
        samplePosition=1;
        sampleCover.hidden=true;
        openingAnimation.cancel();
        sampleCover.style.transform='';
        sampleSpread.classList.remove('sample-opening');
        sampleTurning=false;
        renderBook();
      };
      openingAnimation.finished.then(finish).catch(()=>{});
      setTimeout(finish,1450);
    };
    const turnBook=target=>{
      target=Math.max(0,Math.min(sampleMax(),target));
      if(target===samplePosition||sampleTurning)return;
      if(samplePosition===0&&target===1){openBook();return}
      if(target===0){sampleCover.getAnimations().forEach(animation=>animation.cancel());sampleCover.style.transform='';sampleSpread.classList.remove('sample-opening');sampleVolume.classList.remove('sample-binding-visible');samplePosition=0;renderBook();return}
      if(reduceMotion){samplePosition=target;renderBook();return}
      sampleTurning=true;
      const mobile=sampleMobile();
      const forward=target>samplePosition;
      const [currentLeft,currentRight]=samplePair(samplePosition);
      const [targetLeft,targetRight]=samplePair(target);
      const front=mobile?currentLeft:(forward?currentRight:currentLeft);
      const back=mobile?targetLeft:(forward?targetLeft:targetRight);
      if(mobile||!forward)setPage(sampleLeft,targetLeft);
      else setPage(sampleRight,targetRight);
      const leaf=document.createElement('div');
      leaf.className=`sample-flip ${forward?'':'backward'}`;
      leaf.innerHTML=`<div class="sample-flip-face front"><img src="${sampleSource(front)}" alt="Page ${front}"></div><div class="sample-flip-face back"><img src="${sampleSource(back)}" alt="Page ${back}"></div>`;
      sampleVolume.appendChild(leaf);
      void leaf.offsetWidth;
      leaf.classList.add('turning');
      leaf.style.transition='transform 950ms cubic-bezier(.34,.04,.26,1)';
      requestAnimationFrame(()=>leaf.style.transform=`rotateY(${forward?-180:180}deg)`);
      let completed=false;
      const finish=()=>{
        if(completed)return;
        completed=true;
        samplePosition=target;
        leaf.remove();
        sampleTurning=false;
        renderBook();
      };
      leaf.addEventListener('transitionend',finish,{once:true});
      setTimeout(finish,1100);
    };
    sampleOpen.addEventListener('click',openBook);
    samplePrev.addEventListener('click',()=>turnBook(samplePosition-1));
    sampleNext.addEventListener('click',()=>turnBook(samplePosition+1));
    sampleVolume.addEventListener('touchstart',event=>{
      sampleTouchBlocked=event.touches.length!==1;
      if(!sampleTouchBlocked)sampleTouchX=event.touches[0].clientX;
    },{passive:true});
    sampleVolume.addEventListener('touchmove',event=>{if(event.touches.length>1)sampleTouchBlocked=true},{passive:true});
    sampleVolume.addEventListener('touchend',event=>{
      if(sampleTouchBlocked||!event.changedTouches.length){sampleTouchBlocked=false;return}
      const distance=event.changedTouches[0].clientX-sampleTouchX;
      if(Math.abs(distance)>55)turnBook(samplePosition+(distance<0?1:-1));
      sampleTouchBlocked=false;
    },{passive:true});
    sampleFullscreen?.addEventListener('click',async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await sampleBook.requestFullscreen()}catch(_error){}
    });
    document.addEventListener('fullscreenchange',()=>{if(sampleFullscreen)sampleFullscreen.textContent=document.fullscreenElement?'×':'⛶'});
    window.addEventListener('resize',()=>{if(!sampleTurning)renderBook()});
    renderBook();

    const sampleAudioButton=document.getElementById('landingDuaAudio');
    const sampleAudio=new Audio('audio/safe-place/yunus.mp3');
    sampleAudioButton?.addEventListener('click',()=>{
      if(sampleAudio.paused){sampleAudio.play();sampleAudioButton.innerHTML='<span>Ⅱ</span> Mettre en pause'}
      else{sampleAudio.pause();sampleAudioButton.innerHTML='<span>▶</span> Écouter l\'invocation'}
    });
    sampleAudio.addEventListener('ended',()=>sampleAudioButton.innerHTML='<span>▶</span> Écouter l\'invocation');
  }
  if(!sampleBook){
    const sampleAudioButton=document.getElementById('landingDuaAudio');
    const sampleAudio=new Audio('audio/safe-place/yunus.mp3');
    const learning=document.getElementById('landingDuaLearning');
    const learningPanel=document.getElementById('landingLearningPanel');
    const stageLabel=document.getElementById('landingStageLabel');
    const stageButtons=[...document.querySelectorAll('[data-landing-stage]')];
    const starReward=document.getElementById('landingStarReward');
    const starCount=document.getElementById('landingStarCount');
    const questions=[
      {phrase:'Lâ ilâha ____ Anta, subhânaka innî kuntu mina-dh-dhâlimîn.',correct:'illâ',choices:['illâ','kuntu','Anta']},
      {phrase:'Lâ ilâha illâ Anta, ____ innî kuntu mina-dh-dhâlimîn.',correct:'subhânaka',choices:['innî','subhânaka','dhâlimîn']},
      {phrase:'Lâ ilâha illâ Anta, subhânaka innî kuntu mina-dh-____.',correct:'dhâlimîn',choices:['Anta','illâ','dhâlimîn']}
    ];
    let stage=0,quizIndex=0,repeatLeft=0;
    const celebrateStar=()=>{starReward?.classList.add('celebrate');setTimeout(()=>starReward?.classList.remove('celebrate'),900)};
    const playDua=(speed=1,repeats=1)=>{
      sampleAudio.playbackRate=speed;repeatLeft=repeats;sampleAudio.currentTime=0;
      sampleAudio.play().then(()=>{if(sampleAudioButton)sampleAudioButton.innerHTML='<span>Ⅱ</span> Mettre en pause'}).catch(()=>{});
    };
    const renderLearning=()=>{
      stageLabel.textContent=`Étape ${stage+1} sur 4`;
      starReward?.classList.toggle('earned',stage===3);
      if(starCount)starCount.textContent=stage===3?'1 / 1 étoile illuminée':'0 / 1 étoile illuminée';
      stageButtons.forEach((button,index)=>{button.classList.toggle('active',index===stage);button.classList.toggle('done',index<stage)});
      if(stage===0)learningPanel.innerHTML=`<span class="coach-tag">Séance de 2 minutes</span><h4>1. Découvre et écoute</h4><p>Lis le sens de l’invocation, puis écoute-la une première fois sans pression.</p><div class="sample-coach-actions"><button class="primary" data-learning-action="listen">▶ Écouter et continuer</button></div>`;
      if(stage===1)learningPanel.innerHTML=`<span class="coach-tag">Répétition guidée</span><h4>2. Répète passage par passage</h4><p>Écoute lentement, lis la phonétique sous l’arabe, puis répète chaque passage trois fois.</p><div class="sample-practice-part"><div class="sample-practice-arabic" lang="ar" dir="rtl">لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ</div><div class="sample-practice-phonetic">Lâ ilâha illâ Anta, subhânaka</div></div><div class="sample-practice-part"><div class="sample-practice-arabic" lang="ar" dir="rtl">إِنِّي كُنْتُ مِنَ الظَّالِمِينَ</div><div class="sample-practice-phonetic">innî kuntu mina-dh-dhâlimîn</div></div><div class="sample-coach-actions"><button data-learning-action="slow">▶ Écouter lentement</button><button class="primary" data-learning-action="repeated">J’ai répété 3 fois</button></div>`;
      if(stage===2){
        if(quizIndex<questions.length){const question=questions[quizIndex];learningPanel.innerHTML=`<span class="coach-tag">Quiz phonétique · ${quizIndex+1} / ${questions.length}</span><h4>3. Quel mot manque ?</h4><p>Choisis le bon mot parmi les trois propositions.</p><div class="sample-quiz-phrase">${question.phrase.replace('____','<span class="sample-quiz-blank">______</span>')}</div><div class="sample-quiz-choices">${question.choices.map(choice=>`<button data-learning-action="choice" data-correct="${choice===question.correct?'1':'0'}">${choice}</button>`).join('')}</div><div class="sample-coach-actions"><button data-learning-action="listen-again">🔊 Réécouter</button></div>`}
        else learningPanel.innerHTML=`<span class="coach-tag">Quiz terminé</span><h4>Tu as retrouvé les trois mots</h4><p>Relis maintenant l’invocation complète, puis indique si tu la connais.</p><div class="sample-memory"><strong>Lâ ilâha illâ Anta…</strong><span>Tu peux toujours revenir à la répétition si nécessaire.</span></div><div class="sample-coach-actions"><button data-learning-action="review">Je veux encore réviser</button><button class="primary" data-learning-action="known">Je la connais</button></div>`;
      }
      if(stage===3)learningPanel.innerHTML=`<span class="coach-tag">Mâ shâ Allah</span><h4>4. Invocation mémorisée</h4><p>Une courte révision au bon moment t’aidera à la garder dans ton cœur.</p><div class="sample-memory"><strong>★ Une étoile s’illumine</strong><span>Prochaine révision conseillée : demain, puis dans 3 jours et 7 jours.</span></div><div class="sample-coach-actions"><button data-learning-action="review-now">Réviser maintenant</button></div>`;
    };
    sampleAudioButton?.addEventListener('click',()=>{
      if(sampleAudio.paused){sampleAudio.play();sampleAudioButton.innerHTML='<span>Ⅱ</span> Mettre en pause'}
      else{sampleAudio.pause();sampleAudioButton.innerHTML='<span>▶</span> Écouter l\'invocation'}
    });
    sampleAudio.addEventListener('ended',()=>{if(repeatLeft>1){repeatLeft--;sampleAudio.currentTime=0;sampleAudio.play()}else{repeatLeft=0;if(sampleAudioButton)sampleAudioButton.innerHTML='<span>▶</span> Écouter l\'invocation'}});
    stageButtons.forEach(button=>button.addEventListener('click',()=>{const previous=stage;stage=Number(button.dataset.landingStage);if(stage===2)quizIndex=0;renderLearning();if(stage===3&&previous!==3)celebrateStar()}));
    learning?.addEventListener('click',event=>{
      const target=event.target.closest('[data-learning-action]');if(!target)return;
      const action=target.dataset.learningAction;
      if(action==='listen'){playDua();stage=1;renderLearning()}
      if(action==='slow')playDua(.75,3);
      if(action==='repeated'){stage=2;quizIndex=0;renderLearning()}
      if(action==='listen-again')playDua();
      if(action==='choice'){if(target.dataset.correct==='1'){target.classList.add('correct');learning.querySelectorAll('.sample-quiz-choices button').forEach(button=>button.disabled=true);setTimeout(()=>{quizIndex++;renderLearning()},500)}else target.classList.add('wrong')}
      if(action==='review'){stage=1;quizIndex=0;renderLearning()}
      if(action==='known'){stage=3;renderLearning();celebrateStar()}
      if(action==='review-now'){stage=2;quizIndex=0;renderLearning()}
    });
    renderLearning();
  }
})();


/* Bouton d’abonnement discret : apparaît pendant la découverte et s’efface près des tarifs. */
(()=>{
  const subscribeFloat=document.querySelector('[data-subscribe-float]');
  const pricingSection=document.getElementById('tarifs');
  const finalCta=document.querySelector('.final-cta');
  if(!subscribeFloat)return;
  let ticking=false;
  const update=()=>{
    const pricingBox=pricingSection?.getBoundingClientRect();
    const finalBox=finalCta?.getBoundingClientRect();
    const pricingVisible=!!pricingBox&&pricingBox.top<innerHeight*.88&&pricingBox.bottom>0;
    const finalVisible=!!finalBox&&finalBox.top<innerHeight*.88&&finalBox.bottom>0;
    const journeyStarted=scrollY>Math.min(420,innerHeight*.52);
    subscribeFloat.classList.toggle('is-visible',journeyStarted&&!pricingVisible&&!finalVisible);
  };
  const requestUpdate=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{update();ticking=false})};
  addEventListener('scroll',requestUpdate,{passive:true});
  addEventListener('resize',requestUpdate);
  update();
})();
