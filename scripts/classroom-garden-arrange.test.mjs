import test from 'node:test';
import assert from 'node:assert/strict';
import {keepTreeInside} from '../applications/classroom/garden-arrange.mjs';

test('tree placement stays in the lawn and within server-supported limits',()=>{
 for(const [w,h,tw,th] of [[820,450,115,145],[290,480,70,115]]){
  for(const x of [-500,0,45,100,500])for(const y of [-500,0,65,100,500]){
   const p=keepTreeInside(x,y,w,h,tw,th);
   assert.ok(p.x>=16&&p.x<=84&&p.y>=35&&p.y<=92);
   assert.ok(p.x/100*w-tw/2>=14);
   assert.ok(p.x/100*w+tw/2<=w-14);
   assert.ok(p.y/100*h-th>=14);
  }
 }
 assert.deepEqual(keepTreeInside(52,65,820,450,115,145),{x:52,y:65});
});
