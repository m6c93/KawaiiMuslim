(()=>{'use strict';
const items=[['today','Aujourd’hui',"Aujourd%27hui.dc.html"],['library','Bibliothèque','Bibliotheque%20Kawaii%20Muslim.dc.html'],['workshop','Atelier','Atelier.dc.html'],['invocations','Safe Place','Safe%20Place.dc.html'],['apps','Applications','Applications.dc.html']];
const host=document.getElementById('kmAppViews'),start=document.getElementById('kmAppStart'),status=document.getElementById('kmAppStatus'),retry=document.getElementById('kmAppRetry'),records=new Map();
let active=null,wanted=null,requestId=0,statusTimer=0;
const params=new URLSearchParams(location.search);let guest=params.get('guest')==='1';try{guest=guest||sessionStorage.getItem('km-guest-mode')==='1';if(guest)sessionStorage.setItem('km-guest-mode','1')}catch{}
const normalize=p=>decodeURIComponent(p).replace(/\.html$/i,'').toLowerCase();
function keyFor(url){const path=normalize(url.pathname);return items.find(i=>normalize('/'+i[2])===path)?.[0]||(path==='/aujourd-hui.dc'?'today':null)}
function source(item){const u=new URL(item[2],location.href);u.searchParams.set('kmShell','1');if(item[0]==='today')u.searchParams.set('v','salat-desktop-right-20261021');if(guest)u.searchParams.set('guest','1');for(const name of ['preview','theme'])if(params.has(name))u.searchParams.set(name,params.get(name));return u}
function externalAccount(url){return /\/(?:Connexion|Inscription|Compte|Profils|MFA)\.dc(?:\.html)?$/i.test(url.pathname)}
function notice(message,error=false){status.querySelector('span').textContent=message;status.hidden=!message;retry.hidden=!error}
function markNav(){const index=items.findIndex(i=>i[0]===active);document.body.dataset.kmSection=active||wanted||'today';const nav=document.querySelector('.km-app-nav');if(!nav)return;nav.style.setProperty('--km-nav-index',Math.max(0,index));nav.querySelectorAll('a[data-km-nav-index]').forEach(a=>{const key=items[Number(a.dataset.kmNavIndex)][0];if(key===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');a.classList.toggle('is-pending',key===wanted&&wanted!==active)})}
function load(key,replace=false){const item=items.find(i=>i[0]===key);let entry=records.get(key);if(entry&&!replace)return entry;
 if(entry){entry.frame.remove();records.delete(key)}
 const frame=document.createElement('iframe');frame.className='km-app-view';frame.title=item[1];frame.allowFullscreen=true;frame.setAttribute('allow','autoplay; fullscreen');frame.setAttribute('aria-hidden','true');frame.inert=true;
 entry={key,frame,ready:false,promise:null};records.set(key,entry);
 entry.promise=new Promise((resolve,reject)=>{let deadline=setTimeout(()=>{clearInterval(poll);reject(Error('timeout'))},25000),poll=0;
 function inspect(){let doc,url;try{doc=frame.contentDocument;url=new URL(frame.contentWindow.location.href)}catch{return}if(!doc||url.href==='about:blank')return;if(externalAccount(url)){if(wanted===key||active===key)location.assign(url.href);return}if(doc.readyState!=='complete'||getComputedStyle(doc.documentElement).visibility==='hidden')return;
 const root=doc.getElementById('dc-root');if(root&&!root.firstElementChild)return;
 for(const id of ['kmLibraryBoot','todayLoading']){const loader=doc.getElementById(id);if(loader){const css=frame.contentWindow.getComputedStyle(loader);if(!loader.classList.contains('is-hidden')&&css.display!=='none'&&css.visibility!=='hidden'&&Number(css.opacity)!==0&&!loader.hidden)return}}
 clearTimeout(deadline);clearInterval(poll);entry.ready=true;if(active!==key&&wanted!==key)suspend(entry);resolve(entry)}
 frame.addEventListener('load',()=>{try{const d=frame.contentDocument;if(d?.body){d.body.classList.add('km-shell-child');d.querySelectorAll('.km-app-nav').forEach(n=>n.remove());if(!frame.contentWindow.__kmAppShellBridge){const bridge=d.createElement('script');bridge.src='/km-app-shell-entry.js?v=continuous-1';d.head.append(bridge)}}}catch{}inspect();if(!entry.ready&&!poll)poll=setInterval(inspect,80)});frame.addEventListener('error',()=>{clearTimeout(deadline);clearInterval(poll);reject(Error('load'))},{once:true});frame.src=source(item).href;host.append(frame);
 });entry.promise.catch(()=>{});return entry}
function suspend(entry){try{entry.frame.contentDocument.querySelectorAll('audio,video').forEach(media=>media.pause())}catch{}entry.frame.classList.remove('is-active');entry.frame.setAttribute('aria-hidden','true');entry.frame.inert=true;try{entry.frame.contentWindow.postMessage({type:'km-app-active',active:false},location.origin)}catch{}}
async function navigate(key,{historyMode='push',anchor='',force=false}={}){if(!items.some(i=>i[0]===key))return;wanted=key;const token=++requestId;clearTimeout(statusTimer);notice('');markNav();statusTimer=setTimeout(()=>{if(wanted!==active)notice('Ouverture de '+items.find(i=>i[0]===key)[1]+'…')},700);
 let entry=load(key,force);try{let current;try{current=new URL(entry.frame.contentWindow.location.href)}catch{}if(entry.ready&&current&&keyFor(current)!==key)entry=load(key,true);await entry.promise;if(token!==requestId)return;
 records.forEach(other=>{if(other!==entry)suspend(other)});document.body.classList.remove('km-immersive-reader');document.querySelector('.km-app-nav')?.setAttribute('aria-hidden','false');entry.frame.inert=false;entry.frame.setAttribute('aria-hidden','false');entry.frame.classList.add('is-active');active=key;wanted=key;start.hidden=true;clearTimeout(statusTimer);notice('');markNav();document.title=items.find(i=>i[0]===key)[1]+' — Kawaii Muslim World';
 try{entry.frame.contentWindow.postMessage({type:'km-app-active',active:true},location.origin);if(anchor)entry.frame.contentDocument.getElementById(anchor)?.scrollIntoView()}catch{}
 if(historyMode!=='none'){const u=new URL(location.href);u.searchParams.set('section',key);u.searchParams.delete('anchor');if(guest)u.searchParams.set('guest','1');history[historyMode==='replace'?'replaceState':'pushState']({section:key},'',u.href)}
 }catch{if(token!==requestId)return;clearTimeout(statusTimer);notice('Cette rubrique n’a pas pu s’ouvrir.',true);markNav()}}
window.KMAppShell={navigate};
document.addEventListener('click',event=>{const link=event.target.closest('.km-app-nav a[data-km-nav-index]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();const key=items[Number(link.dataset.kmNavIndex)][0];navigate(key,{historyMode:key===active?'none':'push'})},true);
addEventListener('message',event=>{if(event.origin!==location.origin||!event.data)return;const entry=[...records.values()].find(e=>e.frame.contentWindow===event.source);if(!entry)return;
 if(event.data.type==='km-app-route'||event.data.type==='km-app-exit'){let u;try{u=new URL(event.data.href,location.origin)}catch{return}if(u.origin!==location.origin)return;const key=keyFor(u);if(event.data.type==='km-app-route'&&key)navigate(key,{anchor:u.hash.slice(1)});else if(event.data.type==='km-app-exit'&&externalAccount(u))location.assign(u.href)}
 if(event.data.type==='km-reader-mode'&&entry.key===active){document.body.classList.toggle('km-immersive-reader',!!event.data.active);try{entry.frame.contentDocument.body.classList.toggle('km-app-reading',!!event.data.active)}catch{}document.querySelector('.km-app-nav')?.setAttribute('aria-hidden',String(!!event.data.active))}});
addEventListener('popstate',()=>{const key=new URLSearchParams(location.search).get('section')||'today';navigate(key,{historyMode:'none'})});retry.addEventListener('click',()=>navigate(wanted||'today',{historyMode:'replace',force:true}));
const initial=items.some(i=>i[0]===params.get('section'))?params.get('section'):'today';document.body.dataset.kmSection=initial;
navigate(initial,{historyMode:'replace',anchor:params.get('anchor')||''}).then(async()=>{if(!active)return;for(const item of items){if(item[0]===initial)continue;await new Promise(r=>setTimeout(r,160));try{await load(item[0]).promise}catch{}}});
})();

/* Keep the application navigation outside the book, including nested readers. */
(()=>{
  'use strict';
  const host=document.getElementById('kmAppViews');
  if(!host)return;
  const bar=document.createElement('div');bar.className='km-reader-return';bar.hidden=true;
  const back=document.createElement('button');back.type='button';back.textContent='← Retour à la bibliothèque';
  back.addEventListener('click',()=>window.KMAppShell.navigate('library',{force:true}));
  bar.append(back);document.body.append(bar);
  const bookPath=path=>/^\/(?:books\/(?!colorie-ecris-apprends(?:\.html)?$)[^/]+(?:\.html)?|uploads\/[^/]+\.html|Livre\.dc(?:\.html)?)$/i.test(decodeURIComponent(path));
  function visible(frame){
    if(frame.hidden||frame.closest('[hidden],[aria-hidden="true"]'))return false;
    const win=frame.ownerDocument.defaultView,style=win.getComputedStyle(frame),rect=frame.getBoundingClientRect();
    return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
  }
  function reading(frame,depth=0){
    if(depth>4||!visible(frame))return false;
    try{
      const win=frame.contentWindow,doc=frame.contentDocument;if(!doc)return false;
      if(bookPath(win.location.pathname))return true;
      return [...doc.querySelectorAll('iframe')].some(child=>{
        const r=child.getBoundingClientRect();
        // Small book previews in the catalogue do not enter immersive reading.
        return r.width>=win.innerWidth*.65&&r.height>=win.innerHeight*.6&&reading(child,depth+1);
      });
    }catch{return false;}
  }
  function sync(){
    const frame=host.querySelector('.km-app-view.is-active');
    const active=!!frame&&reading(frame);
    document.body.classList.toggle('km-book-reading',active);
    let clean=false;try{clean=active&&frame.contentDocument.documentElement.classList.contains("km-reader-clean")}catch{}
    document.body.classList.toggle("km-clean-book-reading",clean);
    bar.hidden=!active||clean;
    const nav=document.querySelector('.km-app-nav');
    if(nav){nav.inert=active;if(active)nav.setAttribute('aria-hidden','true');else if(!document.body.classList.contains('km-immersive-reader'))nav.setAttribute('aria-hidden','false');}
  }
  host.addEventListener('load',sync,true);
  new MutationObserver(sync).observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('pageshow',sync);window.addEventListener('resize',sync);
  // A child document can open or close a nested book without changing the host DOM.
  window.setInterval(()=>{if(!document.hidden)sync()},400);
  sync();
})();
