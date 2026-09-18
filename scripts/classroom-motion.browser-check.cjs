// Isolated Chrome profile and synthetic microphone: never reads the user's recordings.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.QA_OUTPUT||path.join(require('node:os').tmpdir(),'kawaii-classroom-motion-qa'));
fs.mkdirSync(out,{recursive:true});
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:4210';
const base=origin+'/Admin-Classe-Coran-Essai.html?preview=1&qa=motion';
const studentURL=base+'&class-id=demo-v2-class-1&student-id=demo-v2-student-1-0';
const KEY='km-classroom-preview-v1:local-preview-admin-motion-qa';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:920},permissions:['microphone'],reducedMotion:'no-preference'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const act=name=>page.locator(`[data-action="${name}"]`);
 const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 const pupil=async()=>(await state()).classes.find(c=>c.id==='demo-v2-class-1').students.find(s=>s.id==='demo-v2-student-1-0');
 const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
 const shot=async name=>{await page.waitForTimeout(650);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true})};
 await page.goto(studentURL);await page.locator('.cc-board').waitFor();await page.evaluate(()=>document.fonts.ready);
 const menu=await page.locator('.cc-student-nav').elementHandle(),hero=await page.locator('.cc-hero').elementHandle();
 await act('tab-coran').click();await page.locator('.cc-verse').first().waitFor();
 assert.ok(await menu.evaluate(el=>el.isConnected));assert.ok(await hero.evaluate(el=>el.isConnected));
 assert.equal(await page.locator('#cc-library option').count(),114);
 assert.equal(await page.locator('.cc-coran-panel').evaluate(el=>getComputedStyle(el).transform),'none');
 await act('tab-garden').click();await page.locator('.cc-board').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('#classroomRoot').dataset.gardenVisible==='true');
 const r=await page.locator('.cc-board').boundingBox();await page.mouse.move(r.x+r.width*.8,r.y+r.height*.5);
 await page.waitForTimeout(200);
 assert.notEqual(await page.locator('.cc-board').evaluate(el=>el.style.getPropertyValue('--depth-x')),'0px');
 await page.locator('#cc-parcel').selectOption('29');await page.locator('#cc-parcel').selectOption('30');
 assert.ok(await menu.evaluate(el=>el.isConnected));
 await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>document.querySelector('#classroomRoot').dataset.gardenVisible==='false');
 assert.equal(await page.locator('.cc-tree-crown').first().evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
 await act('motion').click();assert.equal(await page.locator('#classroomRoot').getAttribute('data-motion'),'off');
 assert.equal(await page.locator('.cc-tree-crown').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.reload();await page.locator('.cc-board').waitFor();assert.equal(await page.locator('#classroomRoot').getAttribute('data-motion'),'off');
 await act('motion').click();
 // Teacher validation in another tab: a single pupil discovery, then no replay on reload.
 const teacher=await context.newPage();teacher.on('pageerror',e=>errors.push(e.message));
 await teacher.goto(base);await teacher.locator('[data-action="class"][data-id="demo-v2-class-1"]').click();
 await teacher.locator('[data-action="student"][data-id="demo-v2-student-1-0"]').click();
 await teacher.locator('[data-action="tree"][data-id="113"]').first().click();
 await teacher.locator('[name="encouragement"]').fill('Maryam, bravo pour ta belle récitation !');
 await teacher.locator('[data-action="complete"]').click();
 await page.locator('.cc-moment-card').waitFor();
 assert.match(await page.locator('.cc-moment-card').innerText(),/100 %/);
 assert.match(await page.locator('.cc-moment-card').innerText(),/Maryam, bravo pour ta belle récitation !/);
 assert.ok((await pupil()).trees[113].completedAt);
 await shot('01-validation-desktop');
 await page.reload();await page.locator('.cc-board').waitFor();assert.equal(await page.locator('.cc-moment-card').count(),0);
 // Next pupil without returning to the roster, plus original Quran available.
 await teacher.locator('[data-action="next-student"]').click();assert.doesNotMatch(await teacher.locator('.cc-pupil-nav strong').innerText(),/Maryam/);
 await teacher.locator('[data-action="previous-student"]').click();assert.match(await teacher.locator('.cc-pupil-nav strong').innerText(),/Maryam/);
 // A real MediaRecorder fed by Chrome's fake device exercises the complete audio lifecycle.
 await act('tab-recite').click();await page.locator('[data-rec="start"]').waitFor();
 await page.locator('[data-rec="start"]').click();await page.locator('.cc-mic-live').waitFor();
 await page.waitForFunction(()=>document.querySelector('.cc-record-time')?.textContent!=='00:00');
 assert.ok(await page.locator('.cc-wave span').evaluateAll(bars=>bars.some(bar=>parseFloat(bar.style.height)>6)));
 await act('tab-garden').click();assert.equal(await page.locator('.cc-mic-live').count(),1,'Navigation must not silently discard a recording');
 await page.locator('[data-rec="finish"]').click();await page.locator('.cc-recording-review audio').waitFor();
 await page.locator('[data-rec="send"]').click();await page.locator('.cc-mic-state strong').filter({hasText:'Enregistrement envoyé'}).waitFor();
 const submissions=(await pupil()).submissions;assert.ok(submissions.length);
 await shot('02-recitation-sent');
 await teacher.reload();await teacher.locator('[data-action="class"][data-id="demo-v2-class-1"]').click();await teacher.locator('[data-action="student"][data-id="demo-v2-student-1-0"]').click();
 await teacher.locator('[data-action="play-submission"]').first().click();await teacher.locator('.cc-submission-audio audio').waitFor();
 const completedBefore=JSON.stringify((await pupil()).trees);
 await teacher.locator('[data-action="mark-listened"]').first().click();await teacher.waitForTimeout(400);
 await teacher.locator('[data-action="inbox-done"]').click();assert.ok(await teacher.locator('.cc-submission').count());
 assert.equal(JSON.stringify((await pupil()).trees),completedBefore,'Marking listened is not validation');
 await teacher.screenshot({path:path.join(out,'03-professeur.png'),fullPage:true});
 await act('tab-garden').click();
 for(const width of [360,820,1280]){
  await page.setViewportSize({width,height:900});await noOverflow();await page.locator('.cc-board').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('.cc-board').evaluate(board=>[...board.querySelectorAll('.cc-planted')].every(tree=>{const a=tree.getBoundingClientRect(),b=board.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom})),'trees must fit entirely');
  await shot('04-garden-'+width);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#classroomRoot').dataset.motion==='off');assert.equal(await page.locator('#classroomRoot').getAttribute('data-motion'),'off');
 assert.equal(await page.locator('.cc-tree-crown').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(errors,[]);
 console.log('PASS: persistent navigation, 114 surahs, parallax, parcel switch, motion preferences, one-time validation, pupil switching, microphone/waveform, send/listen separation, 3 responsive sizes.');
 console.log('Screenshots: '+out);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
