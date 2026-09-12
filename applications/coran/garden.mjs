const DAY=86400000;
export const PLOTS=12;

export function treeStage(percent){
 if(percent>=100)return{file:'apple',label:'Arbre accompli'};
 if(percent>=75)return{file:'blossom',label:'En fleurs'};
 if(percent>=50)return{file:'young',label:'Jeune arbre'};
 if(percent>=25)return{file:'sapling',label:'Petit arbre'};
 return{file:'seedling',label:'Jeune pousse'};
}
export function treeAppearance(surah,percent=100){const stage=treeStage(percent),n=surah-1,base=stage.file==='seedling'?1.55:stage.file==='sapling'?1.18:1;return{...stage,hue:(n*47)%360,shape:base+(n%5)*.025}}
export function treeHealth(last,now=Date.now()){const days=Math.max(0,Math.floor((now-last)/DAY));return{days,thirsty:days>=7,faded:days>=8,label:days>=7?'À rafraîchir':`Prochaine révision dans ${7-days} jour${7-days>1?'s':''}`}}
const surahId=id=>String(id).split(':')[0];
export function earnedSurahs(completed){return new Set(Object.keys(completed||{}).filter(id=>completed[id]).map(surahId))}
export function cleanGarden(raw,completed){
 const next={positions:{},watered:{}};if(!raw||typeof raw!=='object')return next;
 const earned=earnedSurahs(completed),occupied=new Set();
 for(const[id,pos]of Object.entries(raw.positions||{})){const surah=surahId(id);if(earned.has(surah)&&Number.isInteger(pos)&&pos>=0&&pos<PLOTS&&!occupied.has(pos)&&next.positions[surah]===undefined){next.positions[surah]=pos;occupied.add(pos)}}
 for(const[id,date]of Object.entries(raw.watered||{})){const surah=surahId(id);if(earned.has(surah)&&Number.isFinite(date)&&date>=0)next.watered[surah]=Math.max(next.watered[surah]||0,date)}
 return next;
}
export function placeTree(state,id,pos,completed){const surah=surahId(id),earned=earnedSurahs(completed);if(!earned.has(surah)||!Number.isInteger(pos)||pos<0||pos>=PLOTS||Object.entries(state.positions).some(([other,p])=>other!==surah&&p===pos))return false;state.positions[surah]=pos;return true}
export function removeTree(state,id){delete state.positions[surahId(id)]}

export function createGarden({getProgress,index,review,escape:esc}){
 const key='km-coran-garden-v1';let raw=null,memoryOnly=false;try{raw=JSON.parse(localStorage.getItem(key))}catch{}
 const earnedMap=()=>Object.fromEntries(getProgress().treeEarned.map(id=>[id,true]));
 let state=cleanGarden(raw,earnedMap()),root=null,selected='',moving='',filter='all',message='',limit=120,focusRequested=false;
 function save(){try{localStorage.setItem(key,JSON.stringify(state));memoryOnly=false}catch{memoryOnly=true}}
 function verses(id){return [...new Set(getProgress().treeEarned.filter(ref=>surahId(ref)===String(id)).map(ref=>Number(ref.split(':')[1])))].filter(Boolean).sort((a,b)=>a-b)}
 function summary(id){
  const s=index.find(item=>item.id===Number(id)),done=verses(id),now=Date.now();
  const due=done.filter(v=>treeHealth(getProgress().treeReview[`${id}:${v}`]||0,now).thirsty);
  const faded=done.some(v=>treeHealth(getProgress().treeReview[`${id}:${v}`]||0,now).faded);
  const percent=Math.min(100,Math.round(done.length/s.count*100));
  return{s,done,due,faded,percent,a:treeAppearance(s.id,percent)};
 }
 function ids(){return[...earnedSurahs(earnedMap())].map(Number).sort((a,b)=>a-b)}
 function nextVerse(id){const x=summary(id);return x.due[0]||Array.from({length:x.s.count},(_,i)=>i+1).find(v=>!x.done.includes(v))||x.done[0]||1}
 function image(id){const x=summary(id);return`<img src="art/tree-${x.a.file}.png" alt="" style="--tree-hue:${x.a.hue}deg;--tree-shape:${x.a.shape}" class="${x.faded?'tree-faded':''}" width="1280" height="1280"><span class="tree-number">${x.s.id}</span>${x.due.length?`<span class="tree-drop" aria-label="${x.due.length} versets à revoir">💧<b>${x.due.length}</b></span>`:''}`}
 function progressBar(x){return`<div class="tree-growth"><span style="width:${x.percent}%"></span></div><small>${x.done.length} / ${x.s.count} versets · ${x.percent}%</small>`}
 function draw(){
  if(!root?.isConnected)return;state=cleanGarden(state,earnedMap());const all=ids(),placed=Object.keys(state.positions).length;
  const waiting=all.filter(id=>state.positions[id]===undefined),thirsty=all.filter(id=>summary(id).due.length),matches=all.filter(id=>filter==='waiting'?state.positions[id]===undefined:filter==='thirsty'?summary(id).due.length:true);
  const totalDue=all.reduce((n,id)=>n+summary(id).due.length,0);
  root.innerHTML=`<div class="grove-header"><div><p class="eyebrow">MON JARDIN DU CORAN</p><h1>Une sourate, un arbre qui grandit.</h1><p>Chaque verset appris fait évoluer l’arbre de sa sourate.</p></div><img src="art/aya-mimi-lecture-transparent.png" width="1280" height="1280" alt="Aya et Mimi prennent soin du jardin"></div>
  <div class="grove-stats"><span><strong>${all.length}</strong> sourates commencées</span><span><strong>${placed}</strong> arbres dans mon jardin</span><span><strong>${totalDue}</strong> versets à revoir</span></div>
  <div class="grove-toolbar"><div><h2>Mon petit jardin</h2><p>Choisis jusqu’à 12 arbres. Les autres restent dans ta collection.</p></div><span>${placed} / ${PLOTS}</span></div>
  <p class="grove-message" role="status">${moving?'Touche une place libre pour installer cet arbre.':message||(waiting.length?'Choisis un arbre dans ta collection pour le placer ici.':'Touche un arbre pour voir sa progression.')} ${moving?'<button data-g="cancel">Annuler</button>':''}</p>
  <div class="grove-board ${moving?'placing':''}" aria-label="Petit jardin de 12 places">${Array.from({length:PLOTS},(_,pos)=>{const id=Object.keys(state.positions).find(ref=>state.positions[ref]===pos);return id?`<button class="grove-tree" data-g="tree" data-id="${id}" aria-label="${esc(summary(id).s.name)}, ${summary(id).percent}%" ${selected===id?'aria-pressed="true"':''}>${image(id)}</button>`:`<button class="grove-spot" data-g="place" data-pos="${pos}" ${moving?'':'disabled'} aria-label="Place ${pos+1}"><span>${moving?'+':'·'}</span></button>`}).join('')}</div>
  <div id="grove-detail"></div>
  <section class="grove-collection"><div class="grove-toolbar"><div><h2>Ma collection</h2><p>Tous les arbres de mes sourates restent ici.</p></div><label>Afficher <select id="grove-filter"><option value="all" ${filter==='all'?'selected':''}>Toutes</option><option value="waiting" ${filter==='waiting'?'selected':''}>À placer (${waiting.length})</option><option value="thirsty" ${filter==='thirsty'?'selected':''}>À rafraîchir (${thirsty.length})</option></select></label></div>
  ${all.length?`<div class="grove-inventory">${matches.slice(0,limit).map(id=>{const x=summary(id);return`<button data-g="tree" data-id="${id}" class="grove-inventory-tree">${image(id)}<strong>${esc(x.s.name)}</strong>${progressBar(x)}<em class="tree-stage-label">${x.a.label}${state.positions[id]===undefined?' · À placer':''}</em></button>`}).join('')||'<p>Aucun arbre dans cette sélection.</p>'}</div>${matches.length>limit?'<button data-g="more">Voir plus</button>':''}`:'<div class="grove-empty"><h3>Ta première pousse t’attend 🌱</h3><p>Dans Coran, répète un verset 10 fois pour commencer l’arbre de sa sourate.</p><a href="#read" class="primary">Choisir une sourate</a></div>'}</section>
  <details class="grove-help"><summary>Comment mon arbre grandit-il ?</summary><p>Une sourate correspond à un arbre. Chaque verset répété 10 fois dans Coran ajoute une étape à sa croissance. L’évolution est calculée selon le nombre total de versets de la sourate.</p><p>Après 7 jours, une goutte indique les versets à revoir. Dès le 8e jour, les couleurs s’adoucissent. Une nouvelle série de 10 répétitions les rafraîchit. Aucun arbre ne disparaît.</p><p>Le petit jardin accueille 12 arbres choisis. Tous les autres restent disponibles dans ta collection.</p></details><p class="grove-save">${memoryOnly?'La sauvegarde est indisponible : garde cette page ouverte.':'Jardin enregistré sur cet appareil.'}</p>`;
  if(selected&&all.includes(Number(selected)))detail();
 }
 function detail(){const x=summary(selected),verse=nextVerse(selected),placed=state.positions[selected]!==undefined,host=root.querySelector('#grove-detail');if(!host)return;host.innerHTML=`<section class="grove-card"><button class="grove-close" data-g="close" aria-label="Fermer">×</button><div class="grove-card-title"><div class="grove-preview">${image(selected)}</div><div><p class="eyebrow">ARBRE DE LA SOURATE ${x.s.id}</p><h2>${esc(x.s.name)}</h2><p>${x.a.label}</p>${progressBar(x)}</div></div><div class="tree-review-callout ${x.due.length?'':'fresh'}">${x.due.length?`💧 ${x.due.length} verset${x.due.length>1?'s':''} à répéter pour rafraîchir cet arbre.`:'🌸 Cet arbre est bien rafraîchi.'}</div><div class="grove-actions"><button data-g="review" class="primary">${x.due.length?'Revoir le prochain verset':'Continuer cet arbre'}</button><button data-g="move">${placed?'Déplacer':'Placer dans mon jardin'}</button>${placed?'<button data-g="remove">Retirer du petit jardin</button>':''}</div><p role="status">Le verset ${verse} s’ouvrira dans Coran. Dix répétitions le feront compter dans cet arbre.</p></section>`;if(focusRequested){focusRequested=false;host.scrollIntoView({behavior:'smooth',block:'center'})}}
 function click(e){const b=e.target.closest('[data-g]');if(!b)return;const action=b.dataset.g;
  if(action==='tree'){selected=surahId(b.dataset.id);if(e.target.closest('.tree-drop')){review(`${selected}:${nextVerse(selected)}`);return}moving='';draw();root.querySelector('#grove-detail')?.scrollIntoView({behavior:'smooth',block:'nearest'})}
  else if(action==='review')review(`${selected}:${nextVerse(selected)}`);
  else if(action==='move'){moving=selected;selected='';message='';draw();root.querySelector('.grove-board')?.scrollIntoView({behavior:'smooth',block:'center'})}
  else if(action==='place'&&moving&&placeTree(state,moving,Number(b.dataset.pos),earnedMap())){save();message='Ton arbre est bien installé 🌱';moving='';draw()}
  else if(action==='remove'){removeTree(state,selected);save();message='Ton arbre reste dans ta collection.';selected='';draw()}
  else if(action==='more'){limit+=120;draw()}
  else if(action==='cancel'||action==='close'){moving='';selected='';draw()}
 }
 return{mount(element){root=element;state=cleanGarden(state,earnedMap());const[,surah]=location.hash.slice(1).split('/');selected=ids().includes(Number(surah))?String(Number(surah)):'';focusRequested=!!selected;root.addEventListener('click',click);root.addEventListener('change',e=>{if(e.target.id==='grove-filter'){filter=e.target.value;limit=120;selected='';draw()}});draw()},unmount(){root=null},refresh:draw};
}
