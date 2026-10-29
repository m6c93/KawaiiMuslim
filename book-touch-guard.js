(function () {
  "use strict";

  var multiTouchGesture = false;

  document.addEventListener("touchstart", function (event) {
    if (event.touches.length > 1) multiTouchGesture = true;
  }, { capture: true, passive: true });

  document.addEventListener("touchmove", function (event) {
    if (event.touches.length > 1) multiTouchGesture = true;
  }, { capture: true, passive: true });

  document.addEventListener("touchend", function (event) {
    if (!multiTouchGesture) return;
    event.stopImmediatePropagation();
    if (event.touches.length === 0) {
      window.setTimeout(function () { multiTouchGesture = false; }, 0);
    }
  }, { capture: true, passive: true });

  document.addEventListener("touchcancel", function () {
    multiTouchGesture = false;
  }, { capture: true, passive: true });
})();

(function () {
  "use strict";

  if (window.KMReadingProgress || document.querySelector('script[src*="km-reading-progress.js"]')) return;
  var script = document.createElement("script");
  script.src = "/km-reading-progress.js?v=family-reading-2";
  script.defer = true;
  document.head.appendChild(script);
})();

/* Give invocation books the entire viewport, including inside the library. */
(() => {
  'use strict';
  if (!/\/books\/invocations-(?:aya-ali|decouverte)(?:\.html)?$/.test(location.pathname)) return;
  function mount() {
    if (window.KM_BOOK_EMBED || document.documentElement.classList.contains('km-reader-clean')) return;
    const root=document.documentElement, book=document.getElementById('book'), toolbar=document.querySelector('.topbar');
    if (!book || !toolbar) return;
    root.classList.add('km-reader-clean');
    const style=document.createElement('style');
    style.textContent=`
    html.km-reader-clean,html.km-reader-clean body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#fbfcf7!important}
    .km-reader-clean .reader{position:fixed!important;inset:0!important;width:100%!important;height:100dvh!important;padding:0!important;display:grid!important;place-items:center!important}
    .km-reader-clean .book-shell{width:100%!important;height:100%!important;min-height:0!important;display:grid!important;place-items:center!important;padding:0!important;gap:0!important}
    .km-reader-clean .book{width:var(--km-page-width)!important;height:var(--km-page-height)!important;max-width:none!important;max-height:none!important;aspect-ratio:2/1!important;filter:none!important}
    .km-reader-clean .progress-wrap,.km-reader-clean .hint,.km-reader-clean .mobile-page-controls,.km-reader-clean .rotate-notice,.km-reader-clean .preview-end,.km-reader-clean .sky{display:none!important}
    .km-reader-clean .topbar{position:fixed!important;inset:auto auto max(8px,env(safe-area-inset-bottom)) 50%!important;transform:translateX(-50%);z-index:80!important;width:max-content!important;max-width:calc(100vw - 16px)!important;height:48px!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:6px!important;padding:4px 6px!important;border:1px solid #ffffff30!important;border-radius:16px;background:#17382de8!important;backdrop-filter:blur(12px)!important;box-shadow:0 3px 12px #0002;pointer-events:auto!important;transition:opacity .18s}
    .km-reader-clean .title,.km-reader-clean #soundBtn,.km-reader-clean #zoomBtn{display:none!important}
    .km-reader-clean .actions{display:contents!important}
    .km-reader-clean .home,.km-reader-clean .icon{width:40px!important;height:40px!important;min-width:40px!important;flex:0 0 40px!important;order:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;font-size:23px!important}
    .km-reader-clean .home:focus-visible,.km-reader-clean .icon:focus-visible{outline:2px solid #ffd86c;outline-offset:-2px}
    .km-reader-clean .nav{display:grid!important;place-items:center;position:fixed!important;top:50%!important;transform:translateY(-50%)!important;z-index:70!important;width:40px!important;height:52px!important;min-width:40px!important;border-radius:13px!important;font-size:30px!important;background:#17382dbb!important;box-shadow:none!important;transition:opacity .18s}
    .km-reader-clean #prevBtn{left:max(5px,env(safe-area-inset-left))!important;right:auto!important}
    .km-reader-clean #nextBtn{right:max(5px,env(safe-area-inset-right))!important;left:auto!important}
    .km-reader-clean .nav:disabled{visibility:hidden!important}
    .km-reader-clean .reader-page-count{font-size:11px;white-space:nowrap;min-width:50px;text-align:center;color:#fff6e6}
    .km-reader-clean .reader-unlock{padding:9px 11px;color:#fff;background:#ac517a;border-radius:12px;text-decoration:none;font-size:12px;font-weight:800;white-space:nowrap}
    .km-reader-clean.reader-controls-hidden .topbar,.km-reader-clean.reader-controls-hidden .nav{opacity:0!important;pointer-events:none!important}
    .km-reader-clean .drawer{z-index:100!important}.km-reader-clean .scrim{z-index:99!important}
    .km-reader-clean .book:not(.is-open) .cover-stage{inset:0 25%!important;width:50%!important}
    @media(prefers-reduced-motion:reduce){.km-reader-clean .topbar,.km-reader-clean .nav{transition:none!important}}

    /* A passive tip: no backdrop, focus trap, or overlay intercepting the book. */
    .km-landscape-tip{position:fixed;z-index:85;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);box-sizing:border-box;width:max-content;max-width:calc(100vw - 24px);display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;border:1px solid #d9e4d8;border-radius:16px;background:#fffaf3ed;color:#28483d;font:13px/1.4 "Trebuchet MS",system-ui,sans-serif;box-shadow:0 3px 12px #17382d12;pointer-events:none}
    .km-landscape-tip button{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;padding:0;border:0;border-radius:12px;background:transparent;color:inherit;font:24px system-ui,sans-serif;pointer-events:auto;cursor:pointer}
    .km-landscape-tip button:focus-visible{outline:2px solid #a95579;outline-offset:-3px}

    /* The reader can turn inside a portrait-only host without locking the device. */
    .km-reader-clean .reader{width:var(--km-reader-width)!important;height:var(--km-reader-height)!important}
    .km-reader-clean.km-reader-turned body{position:fixed!important;inset:50% auto auto 50%!important;width:var(--km-reader-width)!important;height:var(--km-reader-height)!important;transform:translate(-50%,-50%) rotate(90deg);transform-origin:center}
    .km-reader-clean .reader-rotate{flex:0 0 auto;min-width:72px;min-height:40px;padding:0 8px;border:0;border-radius:11px;background:#fffaf3;color:#244b3d;font:800 11px system-ui,sans-serif;cursor:pointer;white-space:nowrap}
    .km-reader-clean .reader-rotate:focus-visible{outline:2px solid #ffd86c;outline-offset:2px}
    .km-reader-clean .topbar{max-width:calc(var(--km-reader-width) - 16px)!important;gap:4px!important}
    .km-reader-clean .reader-page-count{min-width:40px}
    .km-reader-clean .reader-unlock{padding:9px 8px}
    .km-reader-clean.km-reader-portrait.reader-controls-hidden .topbar,.km-reader-clean.km-reader-portrait.reader-controls-hidden .nav{opacity:1!important;pointer-events:auto!important}
    .km-reader-clean.km-reader-turned .drawer{width:min(520px,94%)}
    .km-reader-clean.km-reader-turned #zoomDialog{position:fixed;inset:50% auto auto 50%;margin:0;box-sizing:border-box;width:calc(var(--km-reader-width) - 24px);height:calc(var(--km-reader-height) - 24px);max-width:none;max-height:none;transform:translate(-50%,-50%) rotate(90deg)}
    .km-reader-clean.km-reader-turned #zoomPages img{width:100%;max-width:100%}
    `;
    document.head.append(style);
    const counter=document.createElement('span');counter.className='reader-page-count';counter.setAttribute('aria-live','polite');toolbar.append(counter);
    const home=toolbar.querySelector('.home');if(home){home.textContent='×';home.setAttribute('aria-label','Quitter le livre');home.title='Quitter le livre';}
    const full=document.getElementById('fullscreenBtn');
    const end=document.getElementById('previewEnd');
    let unlock=null;
    if(end?.querySelector('a')){unlock=end.querySelector('a').cloneNode(true);unlock.className='reader-unlock';unlock.textContent='🔒 La suite';unlock.hidden=true;toolbar.append(unlock);}
    const label=document.getElementById('pageLabel'),total=document.getElementById('totalLabel');
    const sync=()=>{counter.textContent=(label?.textContent||'Couverture').replace('Pages ','').replace('Page ','')+' / '+(total?.textContent||'').replace(' pages','');if(unlock)unlock.hidden=end.hidden;book.classList.toggle('is-open',document.getElementById('coverStage')?.hidden===true);};
    new MutationObserver(sync).observe(document.querySelector('.reader'),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});sync();
    const handheld=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
    let manualLandscape=false,fitFrame=0,fitLater=0;
    const rotate=document.createElement('button');rotate.type='button';rotate.className='reader-rotate';rotate.id='readerRotateBtn';toolbar.append(rotate);
    function fit(){
      const viewport=window.visualViewport,unzoomed=viewport&&Math.abs(viewport.scale-1)<.01;
      const w=Math.round(unzoomed?viewport.width:window.innerWidth),h=Math.round(unzoomed?viewport.height:window.innerHeight);
      if(!w||!h)return;
      const portrait=h>w;
      if(!portrait)manualLandscape=false;
      const turned=portrait&&manualLandscape;
      root.classList.toggle('km-reader-turned',turned);
      root.classList.toggle('km-reader-portrait',portrait&&!turned);
      const width=turned?h:w,height=turned?w:h,pageWidth=Math.min(width,height*2);
      root.style.setProperty('--km-reader-width',width+'px');root.style.setProperty('--km-reader-height',height+'px');
      root.style.setProperty('--km-page-width',pageWidth+'px');root.style.setProperty('--km-page-height',pageWidth/2+'px');
      rotate.hidden=!(handheld||w<700)||!portrait;
      rotate.textContent=turned?'↶ Portrait':'↻ Paysage';
      rotate.setAttribute('aria-label',turned?'Revenir en portrait':'Faire pivoter le livre en paysage');
      rotate.setAttribute('aria-pressed',String(turned));
      full.hidden=width<600;
    }
    function queueFit(){
      cancelAnimationFrame(fitFrame);clearTimeout(fitLater);
      fitFrame=requestAnimationFrame(fit);
      // Some mobile webviews report their new size after the orientation event.
      fitLater=setTimeout(fit,300);
    }
    rotate.addEventListener('click',()=>{manualLandscape=!manualLandscape;dismissLandscapeTip();fit();show();});
    screen.orientation?.addEventListener?.('change',queueFit);
    window.addEventListener('pageshow',queueFit);
    if(window.ResizeObserver)new ResizeObserver(queueFit).observe(root);
    let turnGesture=null;
    book.addEventListener('touchstart',event=>{
      if(event.touches.length!==1){if(turnGesture)turnGesture.pinch=true;return;}
      const touch=event.touches[0];
      turnGesture={x:touch.clientX,y:touch.clientY,turned:root.classList.contains('km-reader-turned'),pinch:false};
    },{capture:true,passive:true});
    book.addEventListener('touchmove',event=>{if(turnGesture&&event.touches.length>1)turnGesture.pinch=true;},{capture:true,passive:true});
    book.addEventListener('touchend',event=>{
      const gesture=turnGesture;if(!gesture?.turned)return;
      event.stopImmediatePropagation();
      if(event.touches.length)return;
      turnGesture=null;
      if(gesture.pinch||!event.changedTouches.length)return;
      const touch=event.changedTouches[0],dx=touch.clientY-gesture.y,dy=touch.clientX-gesture.x;
      if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.35){
        event.preventDefault();
        document.getElementById(dx<0?'nextBtn':'prevBtn')?.click();
      }
    },{capture:true,passive:false});
    book.addEventListener('touchcancel',()=>{turnGesture=null;},{capture:true,passive:true});
    let timer=0;
    function show(){root.classList.remove('reader-controls-hidden');clearTimeout(timer);timer=setTimeout(()=>{if(!toolbar.querySelector(':focus-visible')&&document.getElementById('drawer')?.getAttribute('aria-hidden')!=='false')root.classList.add('reader-controls-hidden');},2800);}
    document.addEventListener('pointermove',show,{passive:true});document.addEventListener('pointerdown',show,{passive:true});document.addEventListener('focusin',show);document.addEventListener('keydown',show);
    // If native fullscreen is unavailable (e.g. iPhone), the reader still fills its window.
    async function toggleFullscreen(event){event.preventDefault();event.stopImmediatePropagation();try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else root.classList.toggle('reader-focus-mode');}catch{root.classList.toggle('reader-focus-mode');}fit();show();syncFullscreen();}
    function syncFullscreen(){const active=!!document.fullscreenElement||root.classList.contains('reader-focus-mode');full.setAttribute('aria-label',active?'Quitter le plein écran':'Plein écran');full.title=active?'Quitter le plein écran':'Plein écran';full.setAttribute('aria-pressed',String(active));}
    full.addEventListener('click',toggleFullscreen,true);
    document.addEventListener('fullscreenchange',()=>{fit();syncFullscreen();show();});window.addEventListener('resize',queueFit);window.visualViewport?.addEventListener('resize',queueFit);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')root.classList.remove('reader-focus-mode');});
    fit();show();syncFullscreen();

    // Rotation stays under the reader's control; never request an orientation lock.
    const portraitReading=matchMedia('(orientation: portrait)');
    let landscapeTip=null,tipTimer=0;
    function dismissLandscapeTip(){
      clearTimeout(tipTimer);
      landscapeTip?.remove();
      landscapeTip=null;
    }
    function syncOrientation(){
      if(!portraitReading.matches)dismissLandscapeTip();
      queueFit();
    }
    if(portraitReading.matches&&handheld&&matchMedia('(max-width: 1024px)').matches){
      landscapeTip=document.createElement('div');
      landscapeTip.className='km-landscape-tip';
      landscapeTip.innerHTML='<span role="status">Le livre ne tourne pas ? Touche « Paysage ».</span><button type="button" aria-label="Masquer le conseil paysage">×</button>';
      landscapeTip.querySelector('button').addEventListener('click',dismissLandscapeTip);
      document.body.append(landscapeTip);
      // Reading starts immediately, even with rotation disabled on the phone.
      document.querySelector('.reader').addEventListener('pointerdown',dismissLandscapeTip,{once:true,passive:true});
      document.addEventListener('keydown',event=>{if(event.key==='Escape')dismissLandscapeTip();});
      landscapeTip.addEventListener('focusout',dismissLandscapeTip,{once:true});
      tipTimer=setTimeout(()=>{
        if(!landscapeTip?.contains(document.activeElement))dismissLandscapeTip();
      },6000);
    }
    if(portraitReading.addEventListener)portraitReading.addEventListener('change',syncOrientation);
    else portraitReading.addListener?.(syncOrientation);
    window.addEventListener('resize',syncOrientation);
    window.addEventListener('orientationchange',syncOrientation);
    window.addEventListener('pagehide',dismissLandscapeTip);

  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
