import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cleanProgress} from '../applications/coran/model.mjs';
import {withAdminDemoProgress,ADMIN_DEMO_LAYOUT} from '../applications/coran/admin-demo.mjs';
import {juzStats} from '../applications/coran/juz-garden.mjs';

const index=JSON.parse(await readFile(new URL('../applications/coran/data/index.json',import.meta.url),'utf8'));

test('administrator demo shows complete, partial and review trees in Juz Amma',()=>{
 const now=Date.now(),progress=withAdminDemoProgress(cleanProgress(null,index),index,now);
 const count=surah=>progress.treeEarned.filter(id=>id.startsWith(`${surah}:`)).length;
 assert.equal(count(112),4);
 assert.equal(count(114),6);
 assert.equal(count(108),2);
 assert.equal(count(109),3);
 assert.equal(count(110),1);
 assert.equal(count(113),5);
 assert.equal(juzStats(30,progress).due.length,5);
 assert.deepEqual(Object.keys(ADMIN_DEMO_LAYOUT).map(Number).sort((a,b)=>a-b),[108,109,110,112,113,114]);
});

test('administrator demo preserves existing progress',()=>{
 const base=cleanProgress({version:2,treeEarned:['107:1'],treeReview:{'107:1':123}},index);
 const progress=withAdminDemoProgress(base,index,20*86400000);
 assert.ok(progress.treeEarned.includes('107:1'));
 assert.equal(progress.treeReview['107:1'],123);
});
