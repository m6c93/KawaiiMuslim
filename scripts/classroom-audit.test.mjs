import test from 'node:test';
import assert from 'node:assert/strict';
import {useSavedTeacher,requestedPupil} from '../presentation-coran/routing.mjs';
import {schoolDemo,schoolTeacherKey} from '../applications/classroom/school.mjs';
import {attendanceSummary} from '../applications/classroom/attendance.mjs';

test('attendance distinguishes newly enrolled pupils and excludes removed classes/pupils',()=>{
 const records={a:{classId:'a',date:'2026-09-20',rows:{one:{status:'present'},removed:{status:'absent'}}},old:{classId:'old',date:'2026-09-20',rows:{x:{status:'absent'}}}};
 const result=attendanceSummary(records,[{id:'a',students:[{id:'one'},{id:'new'}]}],'2026-09-20');
 assert.equal(result.complete,0);assert.equal(result.absent,0);assert.equal(result.calls.length,1);assert.deepEqual(Object.keys(result.calls[0].rows),['one']);
});

test('presentation links do not inherit an unrelated teacher session',()=>{
 for(const query of ['student=Maryam','view=school','school-teacher=amine','local=1'])assert.equal(useSavedTeacher(new URLSearchParams(query)),false);
 assert.equal(useSavedTeacher(new URLSearchParams('view=teacher')),true);
 const classes=[{id:'a',students:[{id:'one'}]},{id:'b',students:[{id:'two'}]}];
 assert.deepEqual(requestedPupil(classes,new URLSearchParams('student-id=two&class-id=b')),{classId:'b',studentId:'two'});
 assert.throws(()=>requestedPupil(classes,new URLSearchParams('student-id=two&class-id=a')),/introuvable/);
 assert.throws(()=>requestedPupil(classes,new URLSearchParams('student-id=expired')),/expiré/);
});
function fixture(teachers){
 const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,String(v))};
 globalThis.location={href:'https://demo.example/presentation-coran/',origin:'https://demo.example',pathname:'/presentation-coran/'};
 localStorage.setItem('km-school-demo-v1',JSON.stringify({name:'QA only',teachers}));
 for(const t of teachers)localStorage.setItem(schoolTeacherKey(t.id),JSON.stringify({classes:[{id:t.id+'-class',name:'QA',students:[{id:t.id+'-pupil',trees:{},submissions:[]}]}],demoV2:true}));
 return storage;
}
test('one expired or disconnected teacher does not break the school or expose stale pupils',async()=>{
 const originalFetch=globalThis.fetch;
 try{
  fixture([{id:'local',name:'Local'},{id:'expired',name:'Expiré',shareToken:'x',shareExpiresAt:'2000-01-01'},{id:'offline',name:'Hors ligne',shareToken:'y',shareExpiresAt:'2099-01-01'}]);
  globalThis.fetch=async()=>{throw Error('Network offline')};
  const adapter=await schoolDemo(),state=await adapter.load();
  assert.deepEqual(state.classes.map(c=>c.id),['local-class']);
  assert.equal(state.teachers[1].shareState,'expired');assert.equal(state.teachers[2].shareState,'unavailable');
  const attendance=await adapter.attendance();assert.deepEqual(attendance.records,{});assert.equal(attendance.warnings.length,2);
  await assert.rejects(adapter.invite('expired'),/expiré/);
 }finally{globalThis.fetch=originalFetch}
});
test('moving a local class keeps attendance editable by its new teacher',async()=>{
 fixture([{id:'a',name:'A'},{id:'b',name:'B'}]);
 const call={classId:'a-class',date:'2026-09-20',revision:2,rows:{'a-pupil':{status:'absent',note:'QA'}}};
 localStorage.setItem(schoolTeacherKey('a')+':attendance-v1',JSON.stringify({'a-class/2026-09-20':call}));
 const adapter=await schoolDemo();await adapter.reassign('a-class','b');
 assert.deepEqual(JSON.parse(localStorage.getItem(schoolTeacherKey('a')+':attendance-v1')),{});
 assert.deepEqual(JSON.parse(localStorage.getItem(schoolTeacherKey('b')+':attendance-v1'))['a-class/2026-09-20'],call);
 assert.equal((await adapter.load()).classes.find(c=>c.id==='a-class').teacherId,'b');
});
test('sharing teacher access transfers previous attendance once without replacing newer remote calls',async()=>{
 const originalFetch=globalThis.fetch;
 try{
  fixture([{id:'a',name:'A',shareToken:'qa',shareExpiresAt:'2099-01-01'}]);
  const call={classId:'a-class',date:'2026-09-20',rows:{'a-pupil':{status:'late'}},revision:1};
  localStorage.setItem(schoolTeacherKey('a')+':attendance-v1',JSON.stringify({'a-class/2026-09-20':call}));
  const remote={};let saves=0;
  globalThis.fetch=async(url,options)=>{const {action,payload}=JSON.parse(options.body);let result;
   if(action==='classes')result=JSON.parse(localStorage.getItem(schoolTeacherKey('a')));
   else if(action==='load')result=remote;
   else if(action==='save'){saves++;result=remote[payload.classId+'/'+payload.date]={...payload,revision:1}}
   else throw Error('Unexpected action');
   return {ok:true,json:async()=>result};
  };
  const adapter=await schoolDemo();await adapter.invite('a');assert.equal(saves,1);
  remote['a-class/2026-09-20'].rows['a-pupil'].status='present';
  await adapter.invite('a');assert.equal(saves,1);assert.equal(remote['a-class/2026-09-20'].rows['a-pupil'].status,'present');
 }finally{globalThis.fetch=originalFetch}
});
