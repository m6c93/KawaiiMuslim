import test from 'node:test';
import assert from 'node:assert/strict';
import {juzStats,homeJuz} from '../applications/coran/juz-garden.mjs';
test('thirty juz cover every verse exactly once',()=>{const rows=Array.from({length:30},(_,i)=>juzStats(i+1,{treeEarned:[],treeReview:{}}));const refs=rows.flatMap(r=>r.refs);assert.equal(refs.length,6236);assert.equal(new Set(refs).size,6236);assert.ok(rows.every(r=>r.refs.length>0));assert.equal(homeJuz(114),30)});
test('a verse counts only in its actual juz, independently from tree home',()=>{const p={treeEarned:['2:142'],treeReview:{'2:142':1}};assert.equal(homeJuz(2),1);assert.equal(juzStats(1,p).done.length,0);assert.equal(juzStats(2,p).done.length,1);assert.equal(juzStats(2,p).due.length,1)});
