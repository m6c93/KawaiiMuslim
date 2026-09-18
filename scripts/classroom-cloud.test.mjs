import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudClassroom} from '../applications/classroom/cloud-classroom.mjs';

const initial=()=>({classes:[{id:'class-1',name:'Classe',revision:4,juz:[30],surahs:[],students:[{id:'student-1',name:'Élève',trees:{},submissions:[]}]}]});
function server(){let data=initial(),calls=[],fail=false;return {
 get data(){return structuredClone(data)},calls,set fail(v){fail=v},
 async rpc(action,payload){calls.push({action,payload});if(action==='classes')return structuredClone(data);if(fail)throw Error('Réseau indisponible');
 const c=data.classes[0];assert.equal(payload.revision,c.revision);
 if(action==='save_class')data.classes[0]={...structuredClone(payload.class),revision:c.revision+1};
 else if(action==='save_student'){c.students=[structuredClone(payload.studentData)];c.revision++}
 return structuredClone(data.classes[0]);}
}}
test('writes are queued with server revisions and immutable snapshots',async()=>{
 const s=server(),cloud=createCloudClassroom('org',{rpc:s.rpc}),db=await cloud.load();
 db.classes[0].name='Première modification';const first=cloud.save(db);
 db.classes[0].name='Deuxième modification';const second=cloud.save(db);db.classes[0].name='Non envoyée';
 assert.equal((await first).classes[0].name,'Première modification');
 assert.equal((await second).classes[0].name,'Deuxième modification');
 assert.deepEqual(s.calls.filter(x=>x.action==='save_class').map(x=>x.payload.revision),[4,5]);
});
test('failed write rejects, blocks queued writes and requires reloading confirmed data',async()=>{
 const s=server(),cloud=createCloudClassroom('org',{rpc:s.rpc}),db=await cloud.load();s.fail=true;db.classes[0].name='Échec';
 const results=await Promise.allSettled([cloud.save(db),cloud.save(db)]);
 assert.ok(results.every(x=>x.status==='rejected'));assert.equal(s.calls.filter(x=>x.action==='save_class').length,1);
 s.fail=false;const confirmed=await cloud.load();assert.equal(confirmed.classes[0].name,'Classe');
 confirmed.classes[0].name='Réessai';await cloud.save(confirmed);assert.equal(s.data.classes[0].name,'Réessai');
});
test('student saves only its own class and never calls teacher write',async()=>{
 const s=server(),cloud=createCloudClassroom('org',{rpc:s.rpc,studentId:'student-1'}),db=await cloud.load();
 db.classes.push({id:'other',students:[{id:'someone-else'}]});db.classes[0].students[0].submissions.push({id:'audio'});
 await cloud.save(db);assert.equal(s.calls.filter(x=>x.action==='save_student').length,1);assert.ok(!s.calls.some(x=>x.action==='save_class'));
});
test('background check does not accept a new revision before the UI receives it',async()=>{
 const s=server(),cloud=createCloudClassroom('org',{rpc:s.rpc});const db=await cloud.load();
 await s.rpc('save_class',{revision:4,class:{...db.classes[0],name:'Autre appareil'}});
 const checked=await cloud.check();assert.equal(checked.classes[0].revision,5);
 db.classes[0].name='Ancienne vue';await assert.rejects(cloud.save(db));
 const refreshed=await cloud.load();refreshed.classes[0].name='Dernière vue';await cloud.save(refreshed);
});
test('audio uses the private class/student path, enforces size, tolerates retry conflict',async()=>{
 const calls=[],blob=new Blob(['recording'],{type:'audio/webm;codecs=opus'});
 const cloud=createCloudClassroom('org',{storage:()=>({upload:async(...args)=>{calls.push(args);return {error:{statusCode:'409'}}},download:async path=>{calls.push(path);return {data:blob}}})});
 await cloud.audioSave('c','s','audio',blob);assert.equal(calls[0][0],'c/s/audio');assert.deepEqual(calls[0][2],{contentType:'audio/webm',upsert:false});
 assert.equal(await cloud.audioLoad('c','s','audio'),blob);
 await assert.rejects(cloud.audioSave('c','s','audio',{size:26*1024*1024}),/25 Mo/);
});
