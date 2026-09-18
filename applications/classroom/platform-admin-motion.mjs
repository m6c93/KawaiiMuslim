// Motion stays decorative; the dashboard remains usable without it.
const paths = {
 home:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-8h6v8',
 school:'M3 21V8l9-5 9 5v13M1 21h22M8 21v-6h8v6M7 9h.01M12 9h.01M17 9h.01',
 users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 key:'M15 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0M21 10a7 7 0 0 1-9 3L4 21H1v-4l8-8a7 7 0 1 1 12 1',
 chart:'M4 3v18h18M8 16v-4M13 16V7M18 16v-7',
 settings:'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
 book:'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1',
 leaf:'M20 3c-11-1-18 4-16 11 2 7 12 7 15-1 1-3 1-7 1-10ZM3 21 15 9',
 tree:'M12 22v-6M8 19h8M7 16c-6 0-6-7-2-8 0-6 9-8 12-3 6 0 8 11 1 11H7',
 mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
 mail:'M3 5h18v14H3V5ZM3 5l9 8 9-8',
 clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 check:'m5 12 4 4L19 6',
 arrow:'M4 12h16m-6-6 6 6-6 6',
 spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
 shield:'m12 2 9 4v6c0 5-5 9-9 10-4-1-9-5-9-10V6l9-4Zm-4 10 3 3 5-6',
 plus:'M12 5v14M5 12h14'
};
const emojiIcons={'⌂':'home','🏫':'school','👥':'users','👩‍🏫':'users','🧒':'users','👤':'users','🔔':'bell','🔑':'key','📊':'chart','📈':'chart','⚙️':'settings','📚':'book','🌿':'leaf','🌱':'leaf','🌳':'tree','🎙️':'mic','✉️':'mail','⏳':'clock','⏱️':'clock','✅':'check','🟢':'check','🛡️':'shield','➕':'plus','🔓':'key','⏸️':'clock','🚫':'shield','📥':'mail'};
export const icon = name => `<svg class="qa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.leaf}"/></svg>`;

export function createAdminMotion(root, {closeModal, moveTask}) {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
 const controller=new AbortController(),signal=controller.signal;
 const running=new Set();
 let frame=0,toastTimer=0,returnFocus=null,oldOverflow='',modalOpen=false,disposed=false;
 let disabled=false;
 try { disabled=localStorage.getItem('km-platform-motion')==='off'; } catch {}
 const enabled=()=>!reduced.matches&&!disabled;
 function animate(node, frames, options={}) {
  if(!enabled()||!node?.animate)return null;
  const animation=node.animate(frames,{duration:380,easing:'cubic-bezier(.2,.75,.25,1)',...options});
  running.add(animation);
  animation.finished.then(()=>running.delete(animation),()=>running.delete(animation));
  return animation;
 }
 function motionPreference(){
  root.dataset.motion=enabled()?'on':'off';
  if(!enabled()){running.forEach(a=>a.cancel());running.clear();root.style.setProperty('--qa-pointer-x','0px');root.style.setProperty('--qa-pointer-y','0px');root.style.setProperty('--qa-scroll','0px');}
  const b=root.querySelector('[data-motion-toggle]');
  if(b){b.setAttribute('aria-pressed',String(enabled()));b.innerHTML=icon('spark')+`<span>Animations ${enabled()?'actives':'réduites'}</span>`;b.title=reduced.matches?'Votre préférence système réduit les animations.':'Activer ou réduire les animations';}
 }
 reduced.addEventListener('change',motionPreference,{signal});
 root.querySelector('[data-motion-toggle]')?.addEventListener('click',()=>{disabled=!disabled;try{localStorage.setItem('km-platform-motion',disabled?'off':'on')}catch{}motionPreference()},{signal});
 motionPreference();

 const nav=root.querySelector('.qa-main-nav'),hero=root.querySelector('.qa-hero');
 function indicator(){
  const active=nav.querySelector('[aria-current="page"]'),marker=nav.querySelector('.qa-nav-marker');
  if(!active||!marker)return;
  marker.style.width=`${active.offsetWidth}px`;
  marker.style.height=`${active.offsetHeight}px`;
  marker.style.transform=`translate(${active.offsetLeft}px,${active.offsetTop}px)`;
 }
 const resize=new ResizeObserver(indicator);resize.observe(nav);
 document.fonts?.ready.then(()=>{if(!disposed)indicator()});
 hero?.addEventListener('pointermove',e=>{
  if(!enabled()||!fine.matches)return;
  const r=hero.getBoundingClientRect();
  root.style.setProperty('--qa-pointer-x',`${((e.clientX-r.left)/r.width-.5)*18}px`);
  root.style.setProperty('--qa-pointer-y',`${((e.clientY-r.top)/r.height-.5)*10}px`);
 },{signal,passive:true});
 hero?.addEventListener('pointerleave',()=>{root.style.setProperty('--qa-pointer-x','0px');root.style.setProperty('--qa-pointer-y','0px')},{signal});
 function scroll(){
  if(frame||!enabled()||!fine.matches)return;
  frame=requestAnimationFrame(()=>{frame=0;if(!disposed)root.style.setProperty('--qa-scroll',`${Math.max(-75,Math.min(75,hero.getBoundingClientRect().top*.13))}px`)});
 }
 window.addEventListener('scroll',scroll,{signal,passive:true});
 const observer=new IntersectionObserver(entries=>{root.dataset.heroVisible=entries[0]?.isIntersecting?'true':'false'});
 if(hero)observer.observe(hero);
 document.addEventListener('visibilitychange',()=>{root.dataset.paused=String(document.hidden)},{signal});

 function decorate(scope){
  scope.querySelectorAll('.qa-stat>span,.qa-avatar,.qa-feed-icon,.qa-mini-tasks button>span,.qa-task>span').forEach(n=>{const name=emojiIcons[n.textContent.trim()];if(name)n.innerHTML=icon(name)});
  scope.querySelectorAll('[data-filter]').forEach(n=>{if(!n.hasAttribute('aria-label'))n.setAttribute('aria-label',({search:'Rechercher',role:'Filtrer par rôle',org:'Filtrer par structure','report-scope':'État des structures'})[n.dataset.filter]||'Filtrer')});
  scope.querySelectorAll('.qa-progress').forEach(n=>{const fill=n.querySelector('span');const value=Math.round(parseFloat(fill?.style.width)||0);n.setAttribute('role','meter');n.setAttribute('aria-label',n.closest('.qa-usage,.qa-report-bar,.qa-license')?.querySelector('strong')?.textContent||'Occupation');n.setAttribute('aria-valuemin','0');n.setAttribute('aria-valuemax','100');n.setAttribute('aria-valuenow',String(value))});
 }
 function enter(scope,{stagger=true}={}){
  decorate(scope);
  if(!enabled())return;
  // Only the entering view moves, so the menu and existing controls never jump.
  animate(scope,[{opacity:.3,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:300});
  if(stagger)scope.querySelectorAll('.qa-stat,.qa-card,.qa-org,.qa-user-row,.qa-task,.qa-license,.qa-detail-grid article').forEach((n,i)=>animate(n,[{opacity:.1,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{delay:Math.min(i*32,192),duration:420}));
  scope.querySelectorAll('.qa-progress span').forEach(n=>animate(n,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:680,delay:100}));
  scope.querySelectorAll('[data-count]').forEach(n=>{
   const target=Number(n.dataset.count);if(!Number.isFinite(target))return;
   const final=n.textContent,start=performance.now();
   const tick=now=>{if(disposed||!enabled()||!n.isConnected){n.textContent=final;return}const progress=Math.min(1,(now-start)/650);n.textContent=Math.round(target*(1-Math.pow(1-progress,3))).toLocaleString('fr-FR');if(progress<1)requestAnimationFrame(tick);else n.textContent=final};
   requestAnimationFrame(tick);
  });
 }
 function syncModal(open,changed){
  if(open&&!modalOpen){returnFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  ['.qa-hero','.qa-main-nav','.qa-workspace','.qa-guide','.qa-context'].forEach(s=>{const n=root.querySelector(s);if(n)n.inert=open});
  if(open&&changed){
   const card=root.querySelector('.qa-modal-card');
   if(card){card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('tabindex','-1');const heading=card.querySelector('h3');if(heading){heading.id='qa-dialog-title';card.setAttribute('aria-labelledby',heading.id)}
    decorate(card);if(!modalOpen)animate(card,[{opacity:0,transform:'translateY(18px) scale(.98)'},{opacity:1,transform:'none'}],{duration:340});else enter(card.querySelector('.qa-detail-body')||card,{stagger:false});
    card.focus({preventScroll:true});
   }
  }
  if(!open&&modalOpen){document.body.style.overflow=oldOverflow;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else root.querySelector('.qa-main-nav [aria-current="page"]')?.focus({preventScroll:true});returnFocus=null;}
  modalOpen=open;
 }
 root.addEventListener('keydown',e=>{
  if(!modalOpen)return;
  if(e.key==='Escape'){e.preventDefault();closeModal();return;}
  if(e.key!=='Tab')return;
  const card=root.querySelector('.qa-modal-card');
  const focusable=[...card.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(n=>n.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(!first){e.preventDefault();return;}
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===card)){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===card)){e.preventDefault();first.focus()}
 },{signal});
 root.addEventListener('click',e=>{if(e.target.classList.contains('qa-modal'))closeModal()},{signal});
 root.addEventListener('dragstart',e=>{const card=e.target.closest('[data-task-id]');if(!card)return;if(e.target.closest('button')){e.preventDefault();return}e.dataTransfer.setData('text/plain',card.dataset.taskId);e.dataTransfer.effectAllowed='move';card.classList.add('qa-dragging')},{signal});
 root.addEventListener('dragover',e=>{const col=e.target.closest('[data-priority]');if(col){e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('qa-drop-target')}},{signal});
 root.addEventListener('dragleave',e=>{const col=e.target.closest('[data-priority]');if(col&&!col.contains(e.relatedTarget))col.classList.remove('qa-drop-target')},{signal});
 root.addEventListener('drop',e=>{const col=e.target.closest('[data-priority]');if(col){e.preventDefault();moveTask(e.dataTransfer.getData('text/plain'),col.dataset.priority)}},{signal});
 root.addEventListener('dragend',()=>root.querySelectorAll('.qa-dragging,.qa-drop-target').forEach(n=>n.classList.remove('qa-dragging','qa-drop-target')),{signal});
 function notify(text,action){
  const n=root.querySelector('.qa-toast');if(!n)return;
  clearTimeout(toastTimer);n.replaceChildren(document.createTextNode(text));
  if(action){const b=document.createElement('button');b.type='button';b.textContent=action.label;b.onclick=()=>{action.run();n.classList.remove('show')};n.append(b)}
  n.classList.add('show');
  // Undo remains available until used or another notification replaces it.
  if(!action)toastTimer=setTimeout(()=>n.classList.remove('show'),4200);
 }
 return {decorate,enter,syncModal,indicator,notify,
  async exit(card){const a=animate(card,[{opacity:1,transform:'none'},{opacity:0,transform:'translateX(12px) scale(.97)'}],{duration:190});if(a)await a.finished.catch(()=>{})},
  destroy(){disposed=true;controller.abort();resize.disconnect();observer.disconnect();cancelAnimationFrame(frame);clearTimeout(toastTimer);running.forEach(a=>a.cancel());if(modalOpen)document.body.style.overflow=oldOverflow;}
 };
}
