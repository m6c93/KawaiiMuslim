import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('administrator login opens a protected choice between both products',async()=>{
 const login=await read('Connexion.dc.html'),choice=await read('Choisir-administration.dc.html');
 assert.match(login,/context\.profile\.role === "admin"[\s\S]*Choisir-administration\.dc\.html/);
 assert.match(choice,/Admin\.dc\.html#overview/);
 assert.match(choice,/https:\/\/coran\.kawaiimuslimworld\.com\/administration\.html/);
 assert.match(choice,/getMFAStatus/);
});

test('world administration no longer embeds Quran platform controls',async()=>{
 const admin=await read('Admin.dc.html');
 assert.doesNotMatch(admin,/data-view="quran-platform"|data-view="classroom"/);
 assert.doesNotMatch(admin,/mountSuperAdmin|mountClassroom/);
 assert.match(admin,/switchView\(initialButton \? initial : "overview"\)/);
});
