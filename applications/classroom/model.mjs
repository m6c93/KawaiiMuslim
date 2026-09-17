export function emptyTree(){return {verses:[],pendingVerses:[],completedAt:null,teacher:'',messages:[],verseComments:[],events:[],assignment:null,requested:false,review:false,positions:{}};}
export function propose(tree,from,to,total,now=new Date().toISOString()){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>total)throw new Error('Choisissez un passage valide.');
  const confirmed=new Set(tree.verses);
  const previous=new Set(tree.pendingVerses||[]),newly=Array.from({length:to-from+1},(_,i)=>from+i).filter(v=>!confirmed.has(v)&&!previous.has(v));
  tree.pendingVerses=[...previous,...newly].sort((a,b)=>a-b);
  if(newly.length){tree.events||=[];tree.events.push({kind:'pending',from,to,at:now,author:'Analyse de récitation à vérifier'});}
  return tree;
}
export function validate(tree,from,to,total,teacher,now=new Date().toISOString()){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>total)throw new Error('Choisissez un passage valide.');
  const previous=new Set(tree.verses),newly=Array.from({length:to-from+1},(_,i)=>from+i).filter(v=>!previous.has(v));
  tree.verses=[...new Set([...tree.verses,...Array.from({length:to-from+1},(_,i)=>from+i)])].sort((a,b)=>a-b);
  tree.pendingVerses=(tree.pendingVerses||[]).filter(v=>!tree.verses.includes(v));
  if(newly.length){tree.events||=[];tree.events.push({kind:'validation',from,to,at:now,author:teacher});}
  tree.teacher=teacher; tree.requested=false; tree.review=false; tree.lastValidatedAt=now;
  if(tree.assignment&&Array.from({length:tree.assignment.to-tree.assignment.from+1},(_,i)=>tree.assignment.from+i).every(v=>tree.verses.includes(v)))tree.assignment=null;
  if(tree.verses.length===total&&!tree.completedAt)tree.completedAt=now;
  return tree;
}
export function assignReview(tree,from,to,total,teacher,note='',now=new Date().toISOString()){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>total)throw new Error('Choisissez des versets valides.');
  tree.assignment={from,to,note:String(note).trim(),at:now,author:teacher};tree.review=true;
  tree.events||=[];tree.events.push({kind:'assignment',...tree.assignment});
  return tree;
}
export function markReviewed(tree,now=new Date().toISOString()){
  if(!tree.assignment)return tree;
  tree.events||=[];tree.events.push({kind:'reviewed',from:tree.assignment.from,to:tree.assignment.to,at:now,author:'Élève'});
  tree.lastReviewedAt=now;tree.assignment=null;tree.review=false;
  return tree;
}
export function growth(tree,total){return tree.completedAt?100:Math.min(99,Math.floor(tree.verses.length/total*100));}
export function visibleGrowth(tree,total){
  const count=new Set([...tree.verses,...(tree.pendingVerses||[])]).size;
  return count===total?100:Math.floor(count/total*100);
}
export function validatePending(tree,total,teacher,now=new Date().toISOString()){
  for(const verse of tree.pendingVerses||[])validate(tree,verse,verse,total,teacher,now);
  return tree;
}
export function due(tree,now=Date.now()){return tree.review||Boolean(tree.lastValidatedAt&&now-new Date(tree.lastReviewedAt||tree.lastValidatedAt).getTime()>=7*86400000);}
