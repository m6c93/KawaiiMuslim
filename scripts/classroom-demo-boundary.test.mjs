import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicDemoUrl} from '../coran-licence/demonstration.mjs';

const root=new URL('../',import.meta.url);
test('old admin demo parameters can only open the teaching demonstration',()=>{
 const target=new URL(publicDemoUrl('https://presentation.coran.kawaiimuslimworld.com/coran-licence/demonstration.html?view=admin&role=admin&reset=1#licenses'));
 assert.equal(target.pathname,'/presentation-coran/');
 assert.equal(target.search,'?view=teacher');
 assert.equal(target.hash,'');
});
test('legacy pupil links preserve their class and pupil without an admin switch',()=>{
 const target=new URL(publicDemoUrl('https://coran.kawaiimuslimworld.com/coran-licence/demonstration.html?class-id=class-1&student-id=pupil-2&student=Maryam&view=admin'));
 assert.equal(target.searchParams.get('class-id'),'class-1');
 assert.equal(target.searchParams.get('student-id'),'pupil-2');
 assert.equal(target.searchParams.get('student'),'Maryam');
 assert.equal(target.searchParams.has('view'),false);
});
test('public entry documents cannot load the administrative demo',async()=>{
 for(const path of ['coran-licence/demonstration.html','coran-licence/demonstration.mjs','presentation-coran/index.html','presentation-coran/presentation.js']){
  const source=await readFile(new URL(path,root),'utf8');
  assert.doesNotMatch(source,/mountSuperAdmin|platform-admin|view=admin|>Administration</,path);
 }
});
test('presentation admin URLs redirect at the server without blocking the real admin host',async()=>{
 const {redirects}=JSON.parse(await readFile(new URL('vercel.json',root),'utf8'));
 for(const source of ['/coran-licence/administration.html','/administration.html','/Admin.dc.html','/Admin-Coran-Plateforme-Essai.html']){
  const rule=redirects.find(r=>r.source===source);
  assert.equal(rule?.destination,'/presentation-coran/');
  assert.deepEqual(rule.has,[{type:'host',value:'presentation.coran.kawaiimuslimworld.com'}]);
 }
 assert.equal(redirects.find(r=>r.source==='/coran-licence/demonstration.html')?.destination,'/presentation-coran/');
});
