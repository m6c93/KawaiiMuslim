(()=>{
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header=document.querySelector('[data-header]');
  const reveals=[...document.querySelectorAll('.reveal')];
  const parallaxItems=[...document.querySelectorAll('[data-parallax]')];
  const tiltItems=[...document.querySelectorAll('.interactive-tilt')];
  const magneticItems=[...document.querySelectorAll('.button,.text-link')];
  const bookRail=document.querySelector('[data-book-rail]');

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
    if(bookRail){
      const box=bookRail.getBoundingClientRect();
      const scene=(innerHeight-box.top)/(innerHeight+box.height);
      bookRail.style.setProperty('--rail-shift',`${Math.max(-18,Math.min(18,(scene-.5)*36)).toFixed(1)}px`);
    }
  };
  let ticking=false;
  const onScroll=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{updateScroll();ticking=false})};
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onScroll,{passive:true});
  updateScroll();

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
})();
