(() => {
  'use strict';
  if (window.KMActivityProgress) return;
  const activeKey = 'km-active-profile-v2';
  function profileScope() {
    try {
      if (new URLSearchParams(location.search).get('guest') === '1' || sessionStorage.getItem('km-guest-mode') === '1') return 'guest';
      const profile = JSON.parse(localStorage.getItem(activeKey) || 'null');
      if (profile?.type === 'child' && profile.id) return 'child:' + profile.id;
      if (profile?.type === 'parent') return profile.ownerId ? 'parent:' + profile.ownerId : null;
      return 'guest';
    } catch { return null; }
  }
  // Capture the owner of this screen. A hidden tab must never write another child's work.
  const scope = profileScope();
  const prefix = scope && 'km-activity-v1:' + scope + ':';
  const memory = new Map();
  const isCurrent = () => scope === profileScope();
  function write(key,value) {
    if (!isCurrent()) return;
    if (value===null) {
      if(prefix) localStorage.removeItem(prefix+key); else memory.delete(key);
    } else if(prefix) localStorage.setItem(prefix+key,value);
    else memory.set(key,String(value));
  }
  function notify(key) {
    if (isCurrent() && !key.startsWith('sync:')) document.dispatchEvent(new CustomEvent('km-activity-write',{detail:key}));
  }
  const storage = {
    getItem(key) { if(!isCurrent()) return null;return prefix ? localStorage.getItem(prefix+key) : memory.get(key) ?? null; },
    setItem(key,value) { write(key,String(value));notify(key); },
    removeItem(key) { write(key,null);notify(key); },
    applyRemote(key,value) {write(key,value==null ? null : JSON.stringify(value));},
    logicalKey(key) {return prefix && key?.startsWith(prefix) ? key.slice(prefix.length) : null;},
    keys() {const keys=[];if(prefix && isCurrent())for(let i=0;i<localStorage.length;i++){const k=this.logicalKey(localStorage.key(i));if(k)keys.push(k);}return keys;}
  };
  const appNames = {'salah':'Kawaii Salat','aya-chansons':'Aya chante l’arabe','lis-arabe':'Kawaii Lis l’Arabe','mimi':'Mimi Fly','coran':'Mon Coran'};
  function activityFor(href, title) {
    let u;
    try { u = new URL(href, location.href); } catch { return null; }
    if (u.origin !== location.origin) return null;
    const app = u.pathname.match(/^\/applications\/([\w-]+)(?:\/index(?:\.html)?|\/)?$/i);
    const book = u.pathname.match(/^\/books\/([\w-]+?)(?:\.html)?$/i);
    const query = new URLSearchParams();
    let name, dest;
    if (app && Object.hasOwn(appNames, app[1])) { name = appNames[app[1]]; dest = '/applications/' + app[1] + '/'; if (app[1] === 'aya-chansons' && ['colors','alphabet','corps','ecole','jours'].includes(u.searchParams.get('lecon'))) query.set('lecon',u.searchParams.get('lecon')); }
    else if (book) { name = title || book[1].replaceAll('-',' '); dest = '/books/' + book[1] + '.html'; }
    else if (/^\/LivreColoriage\.dc(?:\.html)?$/i.test(u.pathname) && /^[\w-]+$/.test(u.searchParams.get('book') || '')) { name = u.searchParams.get('title') || title || 'Mon livre de coloriage'; dest='/LivreColoriage.dc.html'; query.set('book',u.searchParams.get('book')); query.set('title',name); }
    else if (/^\/prophetes\/(?:index\.html)?$/.test(u.pathname)) { name='Les prophètes'; dest='/prophetes/'; const n=u.searchParams.get('prophet'); if (/^(?:[0-9]|1[0-9]|2[0-4])$/.test(n||'')) query.set('prophet',n); }
    else if (/^\/Safe(?:%20| )Place\.dc(?:\.html)?$/i.test(u.pathname) && /^#dua-[a-z-]+$/.test(u.hash)) { name=title || 'Mon invocation'; dest='/Safe%20Place.dc.html'; }
    else if (/^\/Atelier\.dc(?:\.html)?$/i.test(u.pathname) && u.hash==='#galerie') { name=title || 'Mon coloriage'; dest='/Atelier.dc.html'; }
    else if (/^\/(?:Aujourd%27hui|Aujourd'hui)\.dc(?:\.html)?$/i.test(u.pathname) && u.hash==='#weeklyDua') { name='Invocation de la semaine'; dest='/Aujourd%27hui.dc.html'; }
    else return null;
    if (scope === 'guest') query.set('guest','1');
    const hash = (['#galerie','#weeklyDua'].includes(u.hash) || (dest==='/Safe%20Place.dc.html' && /^#dua-[a-z-]+$/.test(u.hash))) ? u.hash : '';
    return {href:dest + (query.size?'?'+query:'') + hash,title:String(name).trim().slice(0,160)};
  }
  function remember(href, title) {
    const activity = activityFor(href, title);
    if (!activity) return;
    try { storage.setItem('recent',JSON.stringify({...activity,time:Date.now()})); } catch {}
  }
  function recent() {
    try { const item=JSON.parse(storage.getItem('recent'));const activity=item && activityFor(item.href,item.title);return activity && Number.isFinite(item.time) ? {...activity,time:item.time} : null; } catch { return null; }
  }
  window.KMActivityProgress = {storage, remember, recent, activityFor,scope,isCurrent};
  function refreshOwner() { if (scope !== profileScope()) location.reload(); }
  addEventListener('storage',e=>{if (e.key===null || e.key===activeKey || e.key==='km-guest-mode') refreshOwner();});
  addEventListener('pageshow',refreshOwner);
  addEventListener('km-profile-selected',refreshOwner);
  document.addEventListener('km-app-active',refreshOwner);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshOwner();});
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');
    if (!link || event.button !== 0 || link.hasAttribute('download') || link.getAttribute('aria-disabled')==='true') return;
    const card=link.closest('article,[data-book],.book-card,.card');
    const title=card?.querySelector('h2,h3,[data-title]')?.textContent || link.getAttribute('title');
    remember(link.href,title);
  });
})();
