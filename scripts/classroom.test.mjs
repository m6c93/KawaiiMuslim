import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyTree,validate,propose,validatePending,visibleGrowth,assignReview,markReviewed,growth,due} from '../applications/classroom/model.mjs';
import {splitBasmala} from '../applications/coran/model.mjs';
test('partial validations merge without double counting; completion date stays stable',()=>{
 const t=emptyTree();validate(t,1,2,4,'Professeur','2026-09-14T10:00:00Z');assert.equal(growth(t,4),50);assert.equal(t.completedAt,null);
 validate(t,2,3,4,'Professeur');assert.equal(t.verses.length,3);
 validate(t,4,4,4,'Professeur','2026-09-14T11:00:00Z');assert.equal(growth(t,4),100);assert.equal(t.completedAt,'2026-09-14T11:00:00Z');
 validate(t,1,4,4,'Professeur');assert.equal(t.completedAt,'2026-09-14T11:00:00Z');
});
test('invalid ranges never change a tree',()=>{const t=emptyTree();for(const [a,b] of [[0,2],[3,2],[1,5],[1.5,2]])assert.throws(()=>validate(t,a,b,4,'Professeur'));assert.deepEqual(t,emptyTree());});
test('review appears after seven days without removing progress',()=>{const t=emptyTree();validate(t,1,4,4,'Professeur','2026-09-01T12:00:00Z');assert.equal(due(t,Date.parse('2026-09-08T11:59:00Z')),false);assert.equal(due(t,Date.parse('2026-09-08T12:00:00Z')),true);assert.equal(growth(t,4),100);});
test('teacher assigns verses 5 and 6; pupil review preserves validation and history',()=>{
 const t=emptyTree();validate(t,1,4,6,'Professeur','2026-09-01T12:00:00Z');
 assignReview(t,5,6,6,'Mme Sarah','Reprends ces deux versets.','2026-09-02T12:00:00Z');
 assert.deepEqual([t.assignment.from,t.assignment.to],[5,6]);assert.equal(t.events.length,2);assert.equal(due(t),true);
 markReviewed(t,'2026-09-03T12:00:00Z');assert.equal(t.assignment,null);assert.equal(t.verses.length,4);assert.equal(t.events.at(-1).kind,'reviewed');
});
test('invalid teacher review range leaves the tree unchanged',()=>{
 const t=emptyTree();assert.throws(()=>assignReview(t,5,6,5,'Professeur'));
 assert.deepEqual(t,emptyTree());
});
test('existing gray proposals remain pending until the teacher validates them',()=>{
 const t=emptyTree();propose(t,1,2,4);
 assert.equal(visibleGrowth(t,4),50);assert.equal(growth(t,4),0);assert.equal(t.completedAt,null);
 validate(t,1,1,4,'Professeur');assert.deepEqual(t.pendingVerses,[2]);assert.equal(visibleGrowth(t,4),50);
 propose(t,3,4,4);assert.equal(visibleGrowth(t,4),100);assert.equal(t.completedAt,null);
 validatePending(t,4,'Professeur');assert.equal(growth(t,4),100);assert.deepEqual(t.pendingVerses,[]);
 assert.equal(t.teacher,'Professeur');assert.ok(t.completedAt);
});
test('Al-Ikhlaas verse 1 displays the basmala as a preface, not as verse text',()=>{
 const surah=JSON.parse(readFileSync(new URL('../applications/coran/data/112.json',import.meta.url)));
 const opening=splitBasmala(surah.verses[0]);
 assert.equal(surah.count,4);
 assert.match(opening.preface,/بِسْمِ ٱللَّهِ/);
 assert.equal(opening.text,'قُلْ هُوَ ٱللَّهُ أَحَدٌ');
});
test('all 114 surahs use consistent basmala display and verse numbering',()=>{
 let separated=0;
 for(let id=1;id<=114;id++){
  const surah=JSON.parse(readFileSync(new URL(`../applications/coran/data/${id}.json`,import.meta.url)));
  const first=surah.verses[0],opening=splitBasmala(first);
  assert.equal(first.verse,1,`surah ${id}`);
  assert.equal(surah.verses.length,surah.count,`surah ${id}`);
  if(id===1||id===9){assert.equal(opening.preface,'',`surah ${id}`);assert.equal(opening.text,first.arabic)}
  else{assert.ok(opening.preface,`surah ${id}`);assert.ok(opening.text,`surah ${id}`);assert.equal(opening.preface+opening.text,first.arabic,`surah ${id}`);separated++}
 }
 assert.equal(separated,112);
});
