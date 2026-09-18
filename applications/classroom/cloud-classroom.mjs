import {client,portal} from './live-client.mjs';
// No localStorage fallback: server acknowledgement is required for every write.
export function createCloudClassroom(organization,{studentId=null}={}){
 let confirmed={classes:[]},tail=Promise.resolve(),blocked=false;
 const plain=c=>JSON.stringify({...c,revision:undefined});
 async function load(){confirmed=await portal('classes',{organization});blocked=false;return structuredClone(confirmed)}
 function save(db){
  const snapshot=structuredClone(db);
  const operation=tail.then(async()=>{
   if(blocked)throw Error('Actualisez la page pour récupérer les dernières données avant de modifier la classe.');
   for(const c of snapshot.classes){
    const previous=confirmed.classes.find(x=>x.id===c.id);
    if(previous&&plain(c)===plain(previous))continue;
    const result=studentId
     ?await portal('save_student',{student:studentId,revision:previous?.revision,studentData:c.students.find(s=>s.id===studentId)})
     :await portal('save_class',{organization,revision:previous?.revision??0,class:c});
    const at=confirmed.classes.findIndex(x=>x.id===c.id);if(at>=0)confirmed.classes[at]=result;else confirmed.classes.push(result);
   }
   return structuredClone(confirmed);
  });
  tail=operation.catch(error=>{if(error.code==='40001')blocked=true});
  return operation;
 }
 const path=(classId,pupil,id)=>`${classId}/${pupil}/${id}`;
 return {load,save,studentId,
  async audioSave(classId,pupil,id,blob){
   if(blob.size>25*1024*1024)throw Error('Cet enregistrement dépasse 25 Mo. Choisissez un passage plus court.');
   const {error}=await client().storage.from('quran-classroom-audio').upload(path(classId,pupil,id),blob,{contentType:blob.type.split(';')[0],upsert:false});
   if(error&&String(error.statusCode)!=='409')throw error;
  },
  async audioLoad(classId,pupil,id){const {data,error}=await client().storage.from('quran-classroom-audio').download(path(classId,pupil,id));if(error)throw error;return data}
 };
}
