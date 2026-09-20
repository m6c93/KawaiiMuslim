// Explicitly authorized QA: real expiring demo backend, fresh fictitious identities,
// separate browsers and Chrome's generated test microphone. Never records a person.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'https://presentation.coran.kawaiimuslimworld.com';
const out=process.env.QA_OUTPUT||path.join(require('node:os').tmpdir(),'classroom-online-recording-qa');
fs.mkdirSync(out,{recursive:true});
const evidence={origin,started:new Date().toISOString(),microphone:'Chrome simulated audio, not a human voice',backend:'real isolated quran_demo',steps:[]};
const pass=label=>{evidence.steps.push(label);console.log('PASS:',label)};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const errors=[],pages=[];
 async function open(url){const c=await browser.newContext({viewport:{width:1280,height:900},permissions:['microphone']});c.setDefaultTimeout(20000);c.setDefaultNavigationTimeout(30000);const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.goto(url);return p;}
 async function ready(p){await p.locator('.cc-sync[data-state="saved"]').waitFor();}
 async function record(p,control,stop,review){await p.locator(control).click();await p.waitForTimeout(1600);await p.locator(stop).click();await p.locator(review).waitFor();}
 async function played(p,selector){await p.waitForFunction(selector=>{const a=document.querySelector(selector);return !!a&&a.readyState>=2&&a.currentTime>0.2&&!a.error},selector);}
 try{
  const director=await open(origin+'/presentation-coran/?local=1&view=school');
  await director.getByLabel('Nom du professeur').fill('Professeur — audit audio');
  await director.getByRole('button',{name:'Ajouter le professeur',exact:true}).click();
  const card=director.locator('.school-grid article').filter({hasText:'Professeur — audit audio'});
  await card.getByRole('button',{name:'Inviter · Copier son lien'}).click();
  const teacherUrl=await director.getByRole('textbox',{name:'Lien professeur',exact:true}).inputValue();
  const teacher=await open(teacherUrl);
  await teacher.getByLabel('Nom de la classe',{exact:true}).fill('Audit audio · classe fictive');
  await teacher.locator('[name="messaging"]').check();
  await teacher.getByRole('button',{name:'Créer ma classe',exact:true}).click();
  await teacher.locator('[data-form="student"] input[name="name"]').fill('Élève — test audio');
  await teacher.locator('[data-form="student"] button').click();await ready(teacher);
  pass('Director invitation opens an isolated real demo teacher workspace');
  await teacher.locator('.cc-work-details>summary').click();
  await teacher.locator('[data-form="program"] select').selectOption('30');
  await teacher.locator('[data-form="program"] button').click();await ready(teacher);
  await teacher.locator('.cc-work-details>summary').click();
  const group=teacher.locator('[data-form="group-review"]');
  await group.locator('[name="surah"]').selectOption('114');
  await group.locator('[name="from"]').fill('5');await group.locator('[name="to"]').fill('6');
  await group.locator('[name="note"]').fill('Données fictives : vérification technique du microphone.');
  await group.locator('button').click();await ready(teacher);
  await teacher.locator('[data-action="invite-student"]').click();
  const access=teacher.locator('.cc-access-dialog');await access.waitFor();
  const pupilUrl=await access.locator('.cc-access-open').getAttribute('href');
  await access.getByRole('button',{name:'Fermer',exact:true}).click();
  const pupil=await open(pupilUrl);
  await pupil.locator('.cc-today').waitFor();assert.match(await pupil.locator('.cc-today').innerText(),/versets 5 à 6/);
  assert.equal(await pupil.locator('[data-action="classes"],[data-action="invite-student"],[data-action="toggle"]').count(),0);
  pass('Pupil link opens own assigned verses 5–6 in a separate browser context');
  await pupil.locator('[data-action="next-practice"]').click();
  await pupil.locator('[data-action="record-passage"]').click();
  await pupil.locator('[data-rec="start"]').waitFor();
  assert.equal(await pupil.locator('#cc-rec-from').inputValue(),'5');assert.equal(await pupil.locator('#cc-rec-to').inputValue(),'6');
  await pupil.locator('#cc-rec-from').fill('7');await pupil.locator('[data-rec="range"]').click();
  assert.match(await pupil.locator('.cc-recite-status').innerText(),/passage valide/);
  await record(pupil,'[data-rec="start"]','[data-rec="finish"]','[data-rec="send"]');
  await pupil.locator('[data-action="tab-garden"]').click();assert.ok(await pupil.locator('[data-rec="send"]').isVisible());
  await record(pupil,'[data-rec="redo"]','[data-rec="finish"]','[data-rec="send"]');
  const audio=pupil.locator('.cc-recording-review audio');await audio.evaluate(a=>a.play());await played(pupil,'.cc-recording-review audio');
  pass('Record, finish, protect unsent draft, redo, and decode/play the new recording');
  // Offline upload failure must keep the draft; only this QA browser is offline.
  await pupil.context().setOffline(true);await pupil.locator('[data-rec="send"]').click();
  await pupil.waitForFunction(()=>document.querySelector('.cc-recite-status')?.textContent.includes('Ton essai reste ici'));
  assert.ok(await pupil.locator('[data-rec="send"]').isVisible());await pupil.context().setOffline(false);
  await pupil.locator('[data-rec="send"]').click();
  await pupil.waitForFunction(()=>document.querySelector('.cc-recite-status')?.textContent.includes('Enregistrement envoyé au professeur'));
  assert.ok(!(await pupil.locator('#cc-recite-workspace').innerText()).includes('L’envoi n’a pas été sauvegardé.'),'An earlier send error must disappear after confirmed success');
  pass('Offline upload preserves the recording; retry receives server confirmation');
  await teacher.reload();await teacher.getByRole('button',{name:'Ouvrir la classe',exact:true}).click();await teacher.locator('[data-action="inbox-student"]').first().click();
  assert.equal(await teacher.locator('.cc-submission').count(),1);
  await teacher.locator('[data-action="play-submission"]').click();await played(teacher,'.cc-submission-audio audio');
  await teacher.screenshot({path:path.join(out,'professeur-audio-recu.png'),fullPage:true});
  pass('Teacher receives exactly one recording and the returned server audio actually plays');
  await teacher.locator('[data-action="mark-listened"]').click();
  await teacher.locator('.cc-submission').waitFor({state:'detached'});
  await teacher.locator('[data-action="inbox-done"]').click();await teacher.locator('.cc-submission').waitFor();
  await teacher.locator('[data-action="open-submission-tree"]').click();
  assert.equal(await teacher.locator('[data-form="validate"] [name="from"]').inputValue(),'1');
  pass('Marking listened keeps teacher validation separate');
  const note=teacher.locator('[data-form="verse-comment"]');
  await note.locator('[name="verse"]').fill('5');await note.locator('[name="message"]').fill('Message fictif de test audio : réception vérifiée.');
  await record(teacher,'[data-action="start-verse-note"]','[data-action="stop-verse-note"]','.cc-verse-audio-preview audio');
  await note.locator('button.cc-primary').click();await ready(teacher);
  await pupil.reload();await pupil.locator('[data-action="next-practice"]').click();
  await pupil.locator('[data-action="play-verse-comment"]').first().click();await played(pupil,'.cc-verse-comment-audio audio');
  pass('Teacher records a verse-specific voice note; pupil receives and plays it from the server');
  await pupil.locator('[data-action="close"]').click();await pupil.locator('[data-action="tab-messages"]').click();
  await record(pupil,'[data-chat="record"]','[data-chat="record"]','.cc-chat-draft-audio audio');
  await pupil.getByLabel('Votre message',{exact:true}).fill('Message vocal fictif de contrôle.');
  await pupil.locator('.cc-chat-compose [type="submit"]').click();
  await pupil.waitForFunction(()=>document.querySelector('.cc-chat-status')?.textContent.includes('Message envoyé'));
  await teacher.locator('[data-action="close"]').click();await teacher.locator('[data-action="roster"]').click();await teacher.locator('[data-action="chat-open"]').first().click();
  await teacher.locator('[data-chat="play"]').first().click();await played(teacher,'.cc-chat-log audio');
  pass('Private voice message is delivered and playable by the teacher');
  await director.reload();await director.getByRole('button',{name:'Classes',exact:true}).click();
  await director.getByRole('heading',{name:'Audit audio · classe fictive',exact:true}).waitFor();
  pass('School director sees the newly created shared class');
  for(const width of [390,820]){await pupil.setViewportSize({width,height:900});await pupil.screenshot({path:path.join(out,'audio-eleve-'+width+'.png'),fullPage:true});assert.ok(await pupil.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
  assert.deepEqual(errors,[]);pass('No uncaught application errors or horizontal overflow at 390/820px');
  evidence.status='passed';
 }catch(error){evidence.status='failed';evidence.failure=error.message;for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:path.join(out,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(out,'failure-'+i+'.txt'),await pages[i].locator('body').innerText().catch(()=>''))}throw error}
 finally{evidence.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
