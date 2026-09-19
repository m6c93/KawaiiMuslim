// Demonstration only. Real accounts use the authenticated messaging RPC.
export function createDemoMessaging({storage,key,getClasses,now=()=>new Date().toISOString()}){
 const read=()=>{const raw=storage.getItem(key);return raw?JSON.parse(raw):{settings:{},threads:{},sequence:0}};
 const write=data=>storage.setItem(key,JSON.stringify(data));
 function initialize(){const data=read();if(data.seeded)return;data.seeded=true;
  const c=getClasses().find(c=>c.id==='demo-v2-class-1'),s=c?.students.find(s=>s.name==='Maryam');
  if(c&&s){data.settings[c.id]=true;data.threads[s.id]={messages:[{id:'demo-chat-welcome',sequence:++data.sequence,role:'teacher',author:'Mme Sarah · Démonstration',text:'Bonjour Maryam ! Tu peux m’écrire ici si tu as une question sur ton apprentissage. Je te répondrai dès que possible.',audioId:'',at:now()}],seen:{}}}write(data);
 }
 let initializationError;try{initialize()}catch(error){initializationError=error}
 return async function request(action,payload={},actor={role:'teacher',name:'Professeur'}){
  if(initializationError)throw Error('Le stockage de la messagerie est indisponible dans ce navigateur.');
  const data=read(),classes=getClasses(),role=actor.role==='student'?'student':'teacher';
  const visible=c=>role==='teacher'||c.students.some(s=>s.id===actor.studentId);
  const unread=sid=>{const t=data.threads[sid];return(t?.messages||[]).filter(m=>m.role!==role&&m.sequence>(t.seen?.[role]||0)).length};
  if(action==='status')return {classes:classes.filter(visible).map(c=>{const students=c.students.filter(s=>role==='teacher'||s.id===actor.studentId).map(s=>({id:s.id,unread:unread(s.id)}));return{id:c.id,enabled:data.settings[c.id]===true,students,unread:students.reduce((n,s)=>n+s.unread,0)}})};
  if(action==='configure'){
   const c=classes.find(c=>c.id===payload.class);if(role!=='teacher'||!c)throw Error('Seul le professeur peut choisir cette option.');
   if(typeof payload.enabled!=='boolean')throw Error('Choisissez une option valide.');data.settings[c.id]=payload.enabled;write(data);return {enabled:payload.enabled};
  }
  const c=classes.find(c=>c.students.some(s=>s.id===payload.student));
  if(!c||!visible(c)||(role==='student'&&actor.studentId!==payload.student))throw Error('Conversation inaccessible.');
  if(!data.settings[c.id])throw Error('Le professeur a désactivé la messagerie pour cette classe.');
  const t=data.threads[payload.student]||={messages:[],seen:{}};
  if(action==='thread'){const all=t.messages.filter(m=>!payload.before||m.sequence<Number(payload.before)),messages=all.slice(-100);return {messages,hasOlder:all.length>messages.length}}
  if(action==='read'){const max=Math.max(0,...t.messages.map(m=>m.sequence));t.seen[role]=Math.max(t.seen[role]||0,Math.min(Number(payload.sequence)||0,max));write(data);return {saved:true}}
  if(action==='send'){
   const existing=t.messages.find(m=>m.id===payload.id);if(existing){if(existing.role!==role)throw Error('Message inaccessible.');return existing}
   const text=String(payload.text||'').trim(),audioId=String(payload.audioId||'');
   if((!text&&!audioId)||text.length>3000)throw Error('Écris un message de 3 000 caractères maximum, ou ajoute un audio.');
   const message={id:payload.id,sequence:++data.sequence,role,author:actor.name,text,audioId,at:now()};t.messages.push(message);write(data);return message;
  }
  throw Error('Action inconnue.');
 };
}
