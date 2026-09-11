export const RECITER={id:'ar.hudhaify',name:'Ali Al-Houdhaïfi',arabic:'علي الحذيفي',source:'Al Quran Cloud'};
export const STEPS=['Écouter','Répéter','Comprendre','Réciter'];
export const STARTER=[1,112,113,114,108,103,110,109,107,106,105,104];
export const GOALS={discover:'Je débute',read:'Je veux mieux lire',memorize:'Je veux mémoriser',listen:'Je veux écouter',together:'Avec mon enfant'};
export const DEFAULT={version:2,goal:'discover',together:false,completed:{},bookmarks:[],treeEarned:[],treeReview:{},lastRead:{surah:1,verse:1},session:null,font:1,translation:true};
export function validRef(ref,index){return ref&&Number.isInteger(ref.surah)&&Number.isInteger(ref.verse)&&ref.verse>0&&ref.verse<=(index.find(s=>s.id===ref.surah)?.count||0)}
export function cleanProgress(raw,index){
 const next={...DEFAULT,completed:{},bookmarks:[],treeEarned:[],treeReview:{},lastRead:{surah:1,verse:1}};
 if(!raw||typeof raw!=='object')return next;
 if(raw.version===1){for(const id of Array.isArray(raw.completed)?raw.completed:[])if(/^112:[1-4]$/.test(id))next.completed[id]={times:1,last:0,due:0};next.lastRead={surah:112,verse:Math.min(4,Math.max(1,Math.floor(Number(raw.verse)||0)+1))};return next}
 if(GOALS[raw.goal])next.goal=raw.goal;next.together=raw.together===true;next.font=[1,1.2,1.4].includes(raw.font)?raw.font:1;next.translation=raw.translation!==false;
 if(validRef(raw.lastRead,index))next.lastRead=raw.lastRead;
 for(const [id,entry]of Object.entries(raw.completed||{})){const [surah,verse]=id.split(':').map(Number);if(validRef({surah,verse},index)&&Number.isFinite(entry?.last)&&Number.isFinite(entry?.due)&&Number.isInteger(entry?.times)&&entry.times>0)next.completed[id]={times:Math.min(entry.times,10000),last:entry.last,due:entry.due}}
 next.bookmarks=[...new Set(Array.isArray(raw.bookmarks)?raw.bookmarks:[])].filter(id=>{if(typeof id!=='string')return false;const[surah,verse]=id.split(':').map(Number);return validRef({surah,verse},index)});
 next.treeEarned=[...new Set(Array.isArray(raw.treeEarned)?raw.treeEarned:[])].filter(id=>{if(typeof id!=='string')return false;const[surah,verse]=id.split(':').map(Number);return validRef({surah,verse},index)});
 for(const[id,date]of Object.entries(raw.treeReview||{})){const[surah,verse]=id.split(':').map(Number);if(validRef({surah,verse},index)&&Number.isFinite(date)&&date>=0)next.treeReview[id]=date}
 const s=raw.session;if(s&&Array.isArray(s.items)&&s.items.length>0&&s.items.length<=2&&s.items.every(v=>validRef(v,index))&&Number.isInteger(s.position)&&s.position>=0&&s.position<s.items.length&&Number.isInteger(s.step)&&s.step>=0&&s.step<4)next.session={items:s.items,position:s.position,step:s.step};
 return next;
}
export function nextRef(progress,index){
 const order=[...STARTER,...index.map(s=>s.id).filter(id=>!STARTER.includes(id))];
 for(const surah of order){const c=index.find(s=>s.id===surah);for(let verse=1;verse<=c.count;verse++)if(!progress.completed[`${surah}:${verse}`])return{surah,verse}}
 return progress.lastRead;
}
export function createSession(progress,index,now=Date.now(),selected=null){
 const next=selected||nextRef(progress,index);
 const due=Object.entries(progress.completed).filter(([id,c])=>c.due<=now&&id!==`${next.surah}:${next.verse}`).sort((a,b)=>a[1].due-b[1].due)[0];
 const items=[];if(due&&!selected){const[surah,verse]=due[0].split(':').map(Number);items.push({surah,verse,review:true})}items.push({...next,review:!!progress.completed[`${next.surah}:${next.verse}`]});
 return{items,position:0,step:0};
}
export function completeVerse(progress,ref,now=Date.now()){
 const id=`${ref.surah}:${ref.verse}`,times=(progress.completed[id]?.times||0)+1;
 const days=[1,3,7,14,30][Math.min(times-1,4)];
 return{...progress,completed:{...progress.completed,[id]:{times,last:now,due:now+days*86400000}}};
}
export function earnTree(progress,ref,now=Date.now()){
 const id=`${ref.surah}:${ref.verse}`,next=completeVerse(progress,ref,now);
 return{...next,treeEarned:next.treeEarned.includes(id)?next.treeEarned:[...next.treeEarned,id],treeReview:{...next.treeReview,[id]:now}};
}
export function normalize(text){return String(text).normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g,'').replace(/[أإآٱ]/g,'ا').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase().replace(/([aeiou])\1+/g,'$1')}
export function matches(s,q){return [s.id,s.name,s.arabic].some(v=>normalize(v).includes(normalize(q)))}
export function parentPlan(count){return Array.from({length:Math.min(5,count)},(_,i)=>{const days=Math.min(5,count);return{day:i+1,from:Math.floor(i*count/days)+1,to:Math.floor((i+1)*count/days)}})}
// The upstream corpus prepends the basmala to opening verses except 1 and 9.
// Separate that preface for display while preserving the exact stored string.
export function splitBasmala(v){
 const opening=['بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ','بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ '].find(prefix=>v.arabic.startsWith(prefix));
 if(v.verse===1&&v.id!=='1:1'&&opening)return{preface:opening,text:v.arabic.slice(opening.length)};
 return{preface:'',text:v.arabic};
}
