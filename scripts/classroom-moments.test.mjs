import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTree,validate,propose} from '../applications/classroom/model.mjs';
import {queueTreeMoment,nextTreeMoment,hasUnreadTreeMessage} from '../applications/classroom/moments.mjs';

test('only new teacher validations create a discovery; repeating a validation never replays it',()=>{
 const tree=emptyTree(),student={trees:{112:tree}};
 propose(tree,1,4,4);assert.equal(queueTreeMoment(tree,{verses:0,completed:false},4),null);
 validate(tree,1,2,4,'Mme Sarah');queueTreeMoment(tree,{verses:0,completed:false},4,'2026-09-18T09:00:00Z');
 assert.equal(nextTreeMoment(student)[1].moment.to,50);assert.equal(tree.completedAt,null);
 tree.moment.seenAt='2026-09-18T09:01:00Z';assert.equal(nextTreeMoment(student),null);
 validate(tree,1,2,4,'Mme Sarah');assert.equal(queueTreeMoment(tree,{verses:2,completed:false},4),null);
 assert.equal(nextTreeMoment(student),null);
 validate(tree,3,4,4,'Mme Sarah');queueTreeMoment(tree,{verses:2,completed:false},4);
 assert.equal(tree.moment.from,50);assert.equal(tree.moment.to,100);assert.equal(tree.moment.complete,true);
});
test('several validations before a pupil visits combine into one coherent growth moment',()=>{
 const tree=emptyTree();validate(tree,1,1,4,'Professeur');queueTreeMoment(tree,{verses:0},4);
 validate(tree,2,3,4,'Professeur');queueTreeMoment(tree,{verses:1},4);
 assert.deepEqual([tree.moment.from,tree.moment.to],[0,75]);
});
test('written and audio verse notes are unread until the pupil opens the tree',()=>{
 const tree=emptyTree();tree.verseComments=[{at:'2026-09-18T10:00:00Z',audioId:'recording'}];
 assert.equal(hasUnreadTreeMessage(tree),true);
 tree.messagesSeenAt='2026-09-18T10:01:00Z';assert.equal(hasUnreadTreeMessage(tree),false);
 tree.messages.push({at:'2026-09-18T10:02:00Z',text:'Bravo'});assert.equal(hasUnreadTreeMessage(tree),true);
});
