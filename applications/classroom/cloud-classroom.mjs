import {remoteAttendance} from './attendance.mjs';
import {client,portal,messaging} from './live-client.mjs';
// No localStorage fallback: server acknowledgement is required for every write.
export function createCloudClassroom(organization,{studentId=null,rpc=portal,messagingRpc=messaging,storage=()=>client().storage.from('quran-classroom-audio')}={}){
 let confirmed={classes:[]},tail=Promise.resolve(),blocked=false,pending=0;
 const plain=c=>JSON.stringify({...c,revision:undefined});
 async function load(){await tail;const next=await rpc('classes',{organization});confirmed=next;blocked=false;return structuredClone(confirmed)}
 function save(db){
  const snapshot=structuredClone(db);pending++;
  const operation=tail.then(async()=>{
   if(blocked)throw Error('Actualisez la page pour récupérer les dernières données avant de modifier la classe.');
   for(const c of snapshot.classes){
    if(studentId&&!c.students.some(s=>s.id===studentId))continue;
    const previous=confirmed.classes.find(x=>x.id===c.id);
    if(previous&&plain(c)===plain(previous))continue;
    const result=studentId
     ?await rpc('save_student',{student:studentId,revision:previous?.revision,studentData:c.students.find(s=>s.id===studentId)})
     :await rpc('save_class',{organization,revision:previous?.revision??0,class:c});
    if(!result?.id)throw Error('La sauvegarde n’a pas été confirmée. Actualisez les données.');
    const at=confirmed.classes.findIndex(x=>x.id===c.id);if(at>=0)confirmed.classes[at]=result;else confirmed.classes.push(result);
   }
   return structuredClone(confirmed);
  });
  tail=operation.catch(()=>{blocked=true}).finally(()=>{pending--});
  return operation;
 }
 const path=(classId,pupil,id)=>`${classId}/${pupil}/${id}`;
 return {load,save,studentId,attendance:remoteAttendance({organization}),get pending(){return pending},
  message:(action,payload={})=>messagingRpc(action,{...payload,organization}),
  check:()=>rpc('classes',{organization}),
  accept(next){confirmed=structuredClone(next)},
  async invite(student,email,name){return rpc('invite',{organization,student,email,name,role:'student'})},
  async audioSave(classId,pupil,id,blob){
   if(blob.size>25*1024*1024)throw Error('Cet enregistrement dépasse 25 Mo. Choisissez un passage plus court.');
   const {error}=await storage().upload(path(classId,pupil,id),blob,{contentType:blob.type.split(';')[0]||'audio/webm',upsert:false});
   if(error&&String(error.statusCode)!=='409')throw error;
  },
  async audioLoad(classId,pupil,id){const {data,error}=await storage().download(path(classId,pupil,id));if(error)throw error;return data}
 };
}
