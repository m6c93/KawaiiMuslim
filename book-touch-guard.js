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
    function fit(){const w=window.innerWidth,h=window.innerHeight;const width=Math.min(w,h*2);root.style.setProperty('--km-page-width',width+'px');root.style.setProperty('--km-page-height',width/2+'px');}
    let timer=0;
    function show(){root.classList.remove('reader-controls-hidden');clearTimeout(timer);timer=setTimeout(()=>{if(!toolbar.querySelector(':focus-visible')&&document.getElementById('drawer')?.getAttribute('aria-hidden')!=='false')root.classList.add('reader-controls-hidden');},2800);}
    document.addEventListener('pointermove',show,{passive:true});document.addEventListener('pointerdown',show,{passive:true});document.addEventListener('focusin',show);document.addEventListener('keydown',show);
    // If native fullscreen is unavailable (e.g. iPhone), the reader still fills its window.
    async function toggleFullscreen(event){event.preventDefault();event.stopImmediatePropagation();try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else root.classList.toggle('reader-focus-mode');}catch{root.classList.toggle('reader-focus-mode');}fit();show();syncFullscreen();}
    function syncFullscreen(){const active=!!document.fullscreenElement||root.classList.contains('reader-focus-mode');full.setAttribute('aria-label',active?'Quitter le plein écran':'Plein écran');full.title=active?'Quitter le plein écran':'Plein écran';full.setAttribute('aria-pressed',String(active));}
    full.addEventListener('click',toggleFullscreen,true);
    document.addEventListener('fullscreenchange',()=>{fit();syncFullscreen();show();});window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')root.classList.remove('reader-focus-mode');});
    fit();show();syncFullscreen();

    // Rotation stays under the reader's control; never request an orientation lock.
    const portraitReading=matchMedia('(orientation: portrait)');
    const handheld=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
    let landscapeTip=null,tipTimer=0;
    function dismissLandscapeTip(){
      clearTimeout(tipTimer);
      landscapeTip?.remove();
      landscapeTip=null;
    }
    function syncOrientation(){
      if(!portraitReading.matches)dismissLandscapeTip();
      fit();
    }
    if(portraitReading.matches&&handheld&&matchMedia('(max-width: 1024px)').matches){
      landscapeTip=document.createElement('div');
      landscapeTip.className='km-landscape-tip';
      landscapeTip.innerHTML='<span role="status">Tu peux tourner ton téléphone pour lire en paysage.</span><button type="button" aria-label="Masquer le conseil paysage">×</button>';
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
    window.addEventListener('orientationchange',()=>requestAnimationFrame(syncOrientation));
    window.addEventListener('pagehide',dismissLandscapeTip);

  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
