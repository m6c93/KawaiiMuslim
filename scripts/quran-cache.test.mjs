import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuranCache} from '../applications/classroom/quran-cache.mjs';
test('concurrent and repeat reads fetch public Quran JSON only once',async()=>{
 let calls=0;const load=createQuranCache(async()=>{calls++;return {ok:true,json:async()=>({verses:[1]})}});
 const [a,b]=await Promise.all([load('1.json'),load('1.json')]);assert.equal(a,b);await load('1.json');assert.equal(calls,1);
});
test('failed responses can be retried, including invalid JSON',async()=>{
 let calls=0;const load=createQuranCache(async()=>({ok:++calls>1,json:async()=>{if(calls===2)throw Error('bad JSON');return {ok:true}}}));
 await assert.rejects(load('1'));await assert.rejects(load('1'));await load('1');assert.equal(calls,3);
});
test('cache has a bounded LRU footprint',async()=>{
 const calls=[];const load=createQuranCache(async url=>{calls.push(url);return {ok:true,json:async()=>url}},2);
 await load('1');await load('2');await load('1');await load('3');await load('2');assert.deepEqual(calls,['1','2','3','2']);
});
