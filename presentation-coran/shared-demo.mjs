// Temporary demonstration capabilities. Never uses the real account/session API.
export const DEMO_KEY='km-presentation-shared-v1';
const endpoint='https://pasgxojzybmvbjhuokkk.supabase.co/rest/v1/rpc/quran_demo';
const publicKey='sb_publishable_JfiHxlqfI8pXr4Emho4vOw_QBePfSHm';
export async function demoRequest(action,payload={},token='',fetcher=fetch){
 const response=await fetcher(endpoint,{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({action,payload,token}),cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw Error(data.message||'La démo partagée ne répond pas. Réessayez.');
 return data;
}
export function demoLink(token,base=location.href){const url=new URL(base);url.search='';url.hash='demo='+token;return url.href}
export function createSharedDemo(token,context,{rpc=demoRequest}={}){
 let confirmed={classes:[]},tail=Promise.resolve(),blocked=false;
 const request=(action,payload={})=>rpc(action,payload,token);
 const plain=c=>JSON.stringify({...c,revision:undefined});
 return {demo:true,studentId:context.studentId||null,pollInterval:5000,
  async load(){await tail;confirmed=await request('classes');blocked=false;return structuredClone(confirmed)},
  check:()=>request('classes'),accept(next){confirmed=structuredClone(next)},
  save(db){const snapshot=structuredClone(db);const operation=tail.then(async()=>{
   if(blocked)throw Error('Actualisez pour retrouver les derniers changements avant de réessayer.');
   for(const c of snapshot.classes){const previous=confirmed.classes.find(x=>x.id===c.id);if(previous&&plain(c)===plain(previous))continue;
    const result=context.studentId?await request('save_student',{class:c.id,revision:previous?.revision,studentData:c.students.find(s=>s.id===context.studentId)}):await request('save_class',{class:c,revision:previous?.revision||0});
    if(!result?.id)throw Error('La sauvegarde n’a pas été confirmée.');
    const at=confirmed.classes.findIndex(x=>x.id===c.id);if(at<0)confirmed.classes.push(result);else confirmed.classes[at]=result;
   }return structuredClone(confirmed);
  });tail=operation.catch(()=>{blocked=true});return operation},
  message:(action,payload={})=>request('chat_'+action,payload),
  async share(classId,studentId){const r=await request('invite',{class:classId,student:studentId});return {url:demoLink(r.token),expiresAt:r.expiresAt}},
  async audioSave(classId,student,id,blob){
   if(blob.size>6*1024*1024)throw Error('Pour cet essai, choisissez un enregistrement plus court (6 Mo maximum).');
   const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
   await request('audio_save',{class:classId,student,id,mime:blob.type.split(';')[0]||'audio/webm',data:btoa(binary)});
  },
  async audioLoad(classId,student,id){const data=await request('audio_load',{class:classId,student,id});return new Blob([Uint8Array.from(atob(data.data),c=>c.charCodeAt(0))],{type:data.mime})}
 };
}
