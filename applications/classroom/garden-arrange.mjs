// Positions use the tree's bottom centre, like the existing saved gardens.
export function keepTreeInside(x,y,width,height,treeWidth,treeHeight){
 const margin=14;
 const minX=Math.max(16,Math.min(50,(treeWidth/2+margin)/width*100));
 const minY=Math.max(35,Math.min(92,(treeHeight+margin)/height*100));
 return {x:Math.max(minX,Math.min(100-minX,x)),y:Math.max(minY,Math.min(92,100-margin/height*100,y))};
}

export function createGardenArrange(root,{canMove,savePosition}){
 let board=null,enabled=false,chosen=null,drag=null,saving=false,suppressClick=false;
 const announce=text=>{const status=root.querySelector('.cc-arrange-status');if(status)status.textContent=text};
 const paint=(el,pos)=>{el.style.left=pos.x+'%';el.style.top=pos.y+'%'};
 function clamp(el,x,y){return keepTreeInside(x,y,board.clientWidth,board.clientHeight,el.offsetWidth,el.offsetHeight)}
 function select(el){chosen?.classList.remove('cc-arrange-selected');chosen=el;el?.classList.add('cc-arrange-selected')}
 function mode(value){
  enabled=value;root.dataset.gardenArrange=String(value);board?.classList.toggle('cc-arranging',value);
  root.querySelector('[data-arrange-toggle]')?.setAttribute('aria-pressed',String(value));
  const toggle=root.querySelector('[data-arrange-toggle]');if(toggle)toggle.textContent=value?'✓ Terminer':'✥ Organiser le jardin';
  select(null);announce(value?'Glisse un arbre, ou touche-le puis touche sa nouvelle place. Au clavier : utilise les flèches.':'Chaque arbre peut changer de place.');
 }
 async function commit(el,pos,old){
  if(!canMove()||saving){paint(el,old);return}
  saving=true;root.dataset.gardenPositionSaving='true';paint(el,pos);announce('Enregistrement de la position…');
  try{if(!await savePosition(Number(el.dataset.id),pos))throw Error('Position non enregistrée');announce('La nouvelle place est enregistrée 🌱')}
  catch{paint(el,old);announce('La position n’a pas été enregistrée. Réessaie après avoir actualisé les données.')}
  finally{saving=false;root.dataset.gardenPositionSaving='false'}
 }
 const oldPosition=el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)});
 function down(e){
  const el=e.target.closest('.cc-planted');if(!enabled||!el||!board?.contains(el)||saving||!canMove()||e.button!==0||!e.isPrimary)return;
  select(el);const old=oldPosition(el);drag={el,id:e.pointerId,x:e.clientX,y:e.clientY,old,moved:false,pos:old};
  el.setPointerCapture(e.pointerId);e.preventDefault();
 }
 function move(e){
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<6)return;
  drag.moved=true;drag.el.classList.add('cc-dragging');
  drag.pos=clamp(drag.el,drag.old.x+dx/board.clientWidth*100,drag.old.y+dy/board.clientHeight*100);
  paint(drag.el,drag.pos);e.preventDefault();
 }
 function finish(e){
  if(!drag||drag.id!==e.pointerId)return;
  const current=drag;drag=null;current.el.classList.remove('cc-dragging');
  if(current.el.hasPointerCapture(e.pointerId))current.el.releasePointerCapture(e.pointerId);
  if(e.type==='pointercancel'||e.type==='lostpointercapture'){paint(current.el,current.old);return}
  if(current.moved){suppressClick=true;setTimeout(()=>{suppressClick=false},0);void commit(current.el,current.pos,current.old)}
 }
 function click(e){
  if(e.target.closest('[data-arrange-toggle]')){e.preventDefault();e.stopImmediatePropagation();if(!saving)mode(!enabled);return}
  if(!enabled||!board?.contains(e.target))return;
  e.preventDefault();e.stopImmediatePropagation();if(suppressClick||saving||!canMove())return;
  const el=e.target.closest('.cc-planted');if(el){select(el);announce('Touche une place dans le jardin pour y mettre cet arbre.');return}
  if(chosen){const rect=board.getBoundingClientRect();void commit(chosen,clamp(chosen,(e.clientX-rect.left)/rect.width*100,(e.clientY-rect.top)/rect.height*100),oldPosition(chosen))}
 }
 function keydown(e){
  if(!enabled)return;
  if(e.key==='Escape'){e.preventDefault();if(drag){paint(drag.el,drag.old);drag=null}if(!saving)mode(false);return}
  const el=e.target.closest('.cc-planted'),delta={ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]}[e.key];
  if(!el||!delta)return;e.preventDefault();if(saving||!canMove())return;
  select(el);const old=oldPosition(el);void commit(el,clamp(el,old.x+delta[0],old.y+delta[1]),old);
 }
 function refresh(){
  const next=root.querySelector('.cc-board');if(next===board)return;
  if(drag){paint(drag.el,drag.old);drag=null}board=next;enabled=false;chosen=null;root.dataset.gardenArrange='false';
  if(!board)return;
  const toolbar=document.createElement('div');toolbar.className='cc-arrange-toolbar';
  toolbar.innerHTML='<button type="button" data-arrange-toggle aria-pressed="false">✥ Organiser le jardin</button><p class="cc-arrange-status" role="status" aria-live="polite">Chaque arbre peut changer de place.</p>';
  board.before(toolbar);
 }
 root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move,{passive:false});
 root.addEventListener('pointerup',finish);root.addEventListener('pointercancel',finish);root.addEventListener('lostpointercapture',finish);
 root.addEventListener('click',click,true);root.addEventListener('keydown',keydown);
 root.addEventListener('dragstart',e=>{if(e.target.closest('.cc-planted'))e.preventDefault()});
 return {refresh,destroy(){root.removeEventListener('pointerdown',down);root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',finish);root.removeEventListener('pointercancel',finish);root.removeEventListener('lostpointercapture',finish);root.removeEventListener('click',click,true);root.removeEventListener('keydown',keydown)}};
}
