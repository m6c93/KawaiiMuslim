import test from 'node:test';
import assert from 'node:assert/strict';
import {treeAppearance,treeHealth,cleanGarden,placeTree} from '../applications/coran/garden.mjs';
test('all 114 surahs have a distinct stable visual variant',()=>{assert.equal(new Set(Array.from({length:114},(_,i)=>JSON.stringify(treeAppearance(i+1)))).size,114)});
test('freshness changes after seven and eight days without losing trees',()=>{const last=100;assert.equal(treeHealth(last,last+6*86400000).thirsty,false);assert.equal(treeHealth(last,last+7*86400000).thirsty,true);assert.equal(treeHealth(last,last+8*86400000).faded,true);assert.equal(treeHealth(last+8*86400000,last+8*86400000).faded,false)});
test('only earned trees can be placed; occupied positions are protected',()=>{const completed={'1:1':{},'1:2':{}},state=cleanGarden(null,completed);assert.equal(placeTree(state,'1:1',4,completed),true);assert.equal(placeTree(state,'1:2',4,completed),false);assert.equal(placeTree(state,'1:3',8,completed),false);assert.equal(placeTree(state,'1:1',6,completed),true);assert.equal(state.positions['1:1'],6)});
test('saved garden restores positions and drops invalid or duplicate data',()=>{const c={'1:1':{},'1:2':{},'2:1':{}};const s=cleanGarden({positions:{'1:1':1,'1:2':1,'2:1':24,'9:9':4},watered:{'1:1':123,'9:9':23}},c);assert.deepEqual(s,{positions:{'1:1':1,'2:1':24},watered:{'1:1':123}})});
