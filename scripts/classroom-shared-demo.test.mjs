import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedDemo,demoLink,demoRequest} from '../presentation-coran/shared-demo.mjs';

test('student link carries only a fragment capability, no teacher query',()=>{
 const url=new URL(demoLink('student-key','https://example.com/presentation-coran/?view=teacher&class-id=secret'));
 assert.equal(url.search,'');assert.equal(url.hash,'#demo=student-key');
});
test('shared demo serializes saves and stops on revision conflict',async()=>{
 const calls=[];let fail=false;
 const initial={classes:[{id:'c',revision:1,students:[{id:'s',trees:{},submissions:[]}]}]};
 const rpc=async(action,payload,token)=>{calls.push({action,payload,token});if(action==='classes')return structuredClone(initial);if(fail)throw Error('Conflict');return {...initial.classes[0],revision:2,students:[payload.studentData]}};
 const cloud=createSharedDemo('child-secret',{studentId:'s'},{rpc});const db=await cloud.load();db.classes[0].students[0].trees={112:{requested:true}};
 await cloud.save(db);assert.equal(calls[1].action,'save_student');assert.equal(calls[1].payload.revision,1);assert.equal(calls[1].token,'child-secret');
 fail=true;db.classes[0].students[0].trees={};await assert.rejects(cloud.save(db),/Conflict/);fail=false;
 await assert.rejects(cloud.save(db),/Actualisez/);await cloud.load();await cloud.save(db);
});
test('audio uses separate demo endpoint, retains bytes and rejects oversize',async()=>{
 let data;const rpc=async(action,payload)=>{if(action==='audio_save'){data=payload;return {saved:true}}return data};
 const cloud=createSharedDemo('demo-only',{}, {rpc});await cloud.audioSave('c','s','id',new Blob(['audio bytes'],{type:'audio/webm'}));
 const blob=await cloud.audioLoad('c','s','id');assert.equal(await blob.text(),'audio bytes');assert.equal(data.student,'s');
 await assert.rejects(cloud.audioSave('c','s','id',{size:7*1024*1024}),/6 Mo/);
});
test('demo calls carry no real authentication and surface server errors',async()=>{
 await assert.rejects(demoRequest('classes',{},'demo-token',async(url,options)=>{
  assert.match(url,/quran_demo$/);assert.equal(options.headers.Authorization,undefined);assert.equal(JSON.parse(options.body).token,'demo-token');return {ok:false,json:async()=>({message:'Lien expiré'})};
 }),/Lien expiré/);
});

test('expired capabilities stop the active demo without renewing the pupil link',async()=>{
 let expired=0;const error=Object.assign(Error('Compte expiré'),{code:'42501'});
 const cloud=createSharedDemo('expired',{studentId:'s'},{rpc:async()=>{throw error},onExpired:()=>expired++});
 await assert.rejects(cloud.check(),/expiré/);assert.equal(expired,1);
});
