// Real portal UI and adapter; isolated accounts and a deterministic RPC/storage double.
// Database authorization is tested separately in classroom-security.sql.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:4318';
const out=process.env.QA_OUTPUT||path.join(require('node:os').tmpdir(),'classroom-live-qa');fs.mkdirSync(out,{recursive:true});
const cid='10000000-0000-4000-8000-000000000001',sid='20000000-0000-4000-8000-000000000001',sid2='20000000-0000-4000-8000-000000000002';
let state={classes:[{id:cid,name:'Les oliviers',revision:0,juz:[30],surahs:[1],students:[sid,sid2].map((id,i)=>({id,name:i?'Adam':'Maryam',trees:{},submissions:[]}))}]},failSave=false,saveGate=null;
const audio=new Map(),calls=[];
const authStub=`window.KMAuth={friendlyError:e=>e.message,client:()=>({
 auth:{getUser:async()=>({data:{user:{id:window.qaRole}}}),signOut:async()=>({})},
 rpc:async(_,body)=>{const r=await fetch('/__qa/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-QA-Role':window.qaRole},body:JSON.stringify(body)});const x=await r.json();return r.ok?{data:x}:{error:x}},
 storage:{from:()=>({upload:async(path,blob)=>{const r=await fetch('/__qa/audio/'+path,{method:'POST',body:blob});return r.ok?{}:{error:{message:'Audio non reçu',statusCode:String(r.status)}}},download:async path=>{const r=await fetch('/__qa/audio/'+path);return r.ok?{data:await r.blob()}:{error:Error('Audio indisponible')}}})}
})};`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const errors=[];
 try{
 async function open(role,query){
  const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['microphone']});
  await context.addInitScript(role=>{window.qaRole=role},role);
  await context.route('**/km-auth.js',r=>r.fulfill({contentType:'application/javascript',body:authStub}));
  await context.route('**/cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await context.route('**/__qa/audio/**',async r=>{const key=new URL(r.request().url()).pathname;if(r.request().method()==='POST'){audio.set(key,r.request().postDataBuffer());await r.fulfill({status:200,body:'ok'})}else await r.fulfill({status:audio.has(key)?200:404,contentType:'audio/webm',body:audio.get(key)||Buffer.from('')})});
  await context.route('**/__qa/rpc',async route=>{
   const {action,payload}=route.request().postDataJSON(),role=route.request().headers()['x-qa-role'];calls.push({action,role});
   let result,status=200;
   if(action==='status')result={classes:[]}; // Messaging is outside this isolated adapter test.
   else if(action==='context')result={admin:false,needsMfa:false,profile:{id:role,name:role==='teacher'?'Mme Sarah':'Maryam'},organizations:role==='teacher'?[{id:'org',name:'Ma structure',enabled:true}]:[],students:role==='student'?[{id:sid,name:'Maryam',classId:cid,organization:'org',enabled:true}]:[]};
   else if(action==='classes'){result=structuredClone(state);if(role==='student')result.classes[0].students=result.classes[0].students.filter(s=>s.id===sid)}
   else if(action==='save_class'||action==='save_student'){
    if(saveGate){const gate=saveGate;saveGate=null;await gate}
    if(failSave){failSave=false;status=503;result={message:'Connexion interrompue. Réessayez après actualisation.'}}
    else if(payload.revision!==state.classes[0].revision){status=409;result={message:'La classe a changé. Actualisez.'}}
    else if(action==='save_class'&&role==='teacher'){state.classes[0]={...payload.class,revision:state.classes[0].revision+1};result=state.classes[0]}
    else if(action==='save_student'&&role==='student'){state.classes[0].students[0]=payload.studentData;state.classes[0].revision++;result={...state.classes[0],students:[state.classes[0].students[0]]}}
    else{status=403;result={message:'Interdit'}}
   }else if(action==='invite')result={token:'qa-invitation'};
   else{status=400;result={message:'Action QA inconnue'}}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>console.error('requestfailed',r.url(),r.failure()));page.on('console',m=>{if(m.type()==='error')console.error('console',m.text())});await page.goto(origin+'/coran-licence/interface.html?'+query);return page;
 }
 const teacher=await open('teacher','organization=org&class-id='+cid);
 await teacher.locator('.cc-teacher-hub').waitFor();assert.equal(await teacher.locator('#classes-list').count(),0);
 await teacher.locator('.cc-work-details>summary').click();
 const group=teacher.locator('[data-form="group-review"]');await group.locator('[name="surah"]').selectOption('114');await group.locator('[name="from"]').fill('5');await group.locator('[name="to"]').fill('6');await group.locator('[name="note"]').fill('Reprends tranquillement les versets 5 et 6.');await group.locator('button').click();
 await teacher.waitForFunction(()=>document.querySelector('.cc-status')?.textContent.includes('2 élève'));
 assert.ok(state.classes[0].students.every(s=>s.trees[114].assignment.from===5));
 await teacher.screenshot({path:path.join(out,'professeur-classe.png'),fullPage:true});
 const pupil=await open('student','student-id='+sid);
 await pupil.locator('.cc-today').waitFor();assert.match(await pupil.locator('.cc-today').innerText(),/versets 5 à 6/);
 assert.equal(await pupil.locator('[data-action="classes"],[data-action="toggle"],[data-action="demo"]').count(),0);
 await pupil.locator('[data-action="next-practice"]').click();await pupil.locator('[data-action="record-passage"]').waitFor();
 assert.match(await pupil.locator('#cc-passage').innerText(),/5.*6/s);
 await pupil.locator('[data-action="record-passage"]').click();await pupil.locator('[data-rec="start"]').waitFor();
 assert.equal(await pupil.locator('#cc-rec-from').inputValue(),'5');assert.equal(await pupil.locator('#cc-rec-to').inputValue(),'6');
 await pupil.locator('[data-rec="start"]').click();await pupil.locator('.cc-mic-live').waitFor();await pupil.waitForTimeout(1200);
 await pupil.locator('[data-rec="finish"]').click();await pupil.locator('[data-rec="send"]').waitFor();
 await pupil.locator('[data-action="tab-garden"]').click();assert.ok(await pupil.locator('[data-rec="send"]').isVisible(),'unsent draft protected');
 failSave=true;await pupil.locator('[data-rec="send"]').click();await pupil.locator('.cc-sync[data-state="error"]').waitFor();
 assert.ok(await pupil.locator('[data-rec="send"]').isVisible(),'draft retained after failed save');assert.equal(state.classes[0].students[0].submissions.length,0);
 await pupil.locator('[data-action="refresh-cloud"]').click();await pupil.locator('.cc-sync[data-state="saved"]').waitFor();
 let release;saveGate=new Promise(resolve=>release=resolve);await pupil.locator('[data-rec="send"]').click();await pupil.locator('.cc-sync[data-state="saving"]').waitFor();
 assert.ok(!(await pupil.locator('#cc-recite-workspace').innerText()).includes('Enregistrement envoyé au professeur.'));
 release();await pupil.waitForFunction(()=>document.querySelector('#cc-recite-workspace')?.textContent.includes('Enregistrement envoyé au professeur.'));
 assert.ok(!(await pupil.locator('#cc-recite-workspace').innerText()).includes('L’envoi n’a pas été sauvegardé.'),'successful retry clears the earlier failure');
 assert.equal(await pupil.locator('.cc-status').innerText(),'','successful retry clears an obsolete navigation warning');
 assert.equal(state.classes[0].students[0].submissions.length,1);assert.equal(audio.size,1,'retry reuses uploaded audio');
 await teacher.reload();await teacher.locator('[data-action="inbox-student"]').first().click();
 await teacher.locator('[data-action="play-submission"]').click();await teacher.locator('.cc-submission-audio audio').waitFor();
 await teacher.waitForFunction(()=>document.querySelector('.cc-submission-audio audio')?.currentTime>0.2);
 await teacher.locator('[data-action="tree"][data-id="114"]').first().click();
 const note=teacher.locator('[data-form="verse-comment"]');await note.locator('[name="verse"]').fill('5');await note.locator('[name="message"]').fill('Bravo, écoute ce conseil pour le verset 5.');
 await note.locator('input[type="file"]').setInputFiles({name:'conseil.webm',mimeType:'audio/webm',buffer:[...audio.values()][0]});await note.locator('button[type="submit"],button:not([type])').last().click();
 await teacher.waitForFunction(()=>document.querySelector('.cc-status')?.textContent.includes('Commentaire ajouté'));
 await pupil.reload();await pupil.locator('[data-action="tree"][data-id="114"]').first().click();await pupil.locator('[data-action="practice-assigned"]').click();await pupil.locator('[data-action="play-verse-comment"]').first().click();await pupil.locator('.cc-verse-comment-audio audio').waitFor();
 assert.equal(audio.size,2);assert.ok(!calls.some(c=>c.role==='student'&&c.action==='save_class'));
 await pupil.locator('[data-action="close"]').click();
 for(const width of [360,820]){await pupil.setViewportSize({width,height:900});await pupil.waitForTimeout(650);await pupil.screenshot({path:path.join(out,'eleve-'+width+'.png'),fullPage:true});assert.ok(await pupil.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
 const demo=await teacher.context().newPage();demo.on('pageerror',e=>errors.push(e.message));await demo.goto(origin+'/coran-licence/demonstration.html?class-id=demo-v2-class-1');await demo.locator('.cc-teacher-hub').waitFor();
 assert.equal(new URL(demo.url()).pathname,'/presentation-coran/');
 await demo.locator('[data-space="student"]').click();await demo.locator('.cc-student-nav').waitFor();assert.match(await demo.locator('.cc-hero h2').innerText(),/Maryam/);
 assert.deepEqual(errors,[]);console.log('PASS: live portal roles, group assignment, assigned passage, draft protection, failed save/retry, awaited confirmation, cloud student/teacher audio, 360/820px.');
 }catch(error){for(const context of browser.contexts())for(const page of context.pages()){console.error(page.url(),(await page.locator('body').innerText()).slice(0,900))}throw error}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
