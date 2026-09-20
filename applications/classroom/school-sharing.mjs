import {demoRequest,demoLink} from '../../presentation-coran/shared-demo.mjs';
import {loadRecording} from './recordings.mjs';
const token=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function shareSchoolTeacher(teacher,db,settings={},persist=()=>{}){
 if(!teacher.shareToken){teacher.shareToken=token();persist()}
 const snapshot=structuredClone(db);
 // Fixture audio is not a real recording. Never publish dangling audio controls.
 for(const c of snapshot.classes)for(const s of c.students){
  const ids=[...(s.submissions||[]).map(r=>r.id),...Object.values(s.trees||{}).flatMap(t=>(t.verseComments||[]).map(m=>m.audioId).filter(Boolean))];
  for(const id of new Set(ids))if(await loadRecording(id))throw Error('Cette classe contient des enregistrements locaux. Leur transfert en ligne nécessite votre accord. Les nouvelles classes peuvent être partagées sans transfert audio.');
  for(const t of Object.values(s.trees||{}))t.verseComments=(t.verseComments||[]).filter(m=>!m.audioId||m.text).map(m=>({...m,audioId:''}));
  s.submissions=[];
 }
 const result=await demoRequest('create',{owner:teacher.shareToken,data:snapshot,settings});
 teacher.shareExpiresAt=result.expiresAt;persist();
 return {url:demoLink(teacher.shareToken),expiresAt:result.expiresAt};
}
export async function sharedTeacherClasses(teacher){return (await demoRequest('classes',{},teacher.shareToken)).classes}
