// Browser microphone permissions and cleanup using Chrome's test input device.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:4321';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream']});
 try{
  const context=await browser.newContext();context.setDefaultTimeout(15000);
  await context.grantPermissions([],{origin});
  // Observe the real streams returned by Chrome, without altering them.
  await context.addInitScript(()=>{window.qaMicrophoneStreams=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await get(...args);window.qaMicrophoneStreams.push(stream);return stream}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/presentation-coran/?local=1&student=Maryam');
  await page.locator('[data-action="tab-recite"]').click();await page.locator('[data-rec="start"]').click();
  await page.getByText('Micro refusé. Autorise-le dans Chrome pour enregistrer.',{exact:true}).waitFor();
  assert.ok(await page.locator('[data-rec="start"]').isEnabled());assert.equal(await page.locator('[data-rec="send"]').count(),0);
  console.log('PASS: denied microphone explains permission and keeps retry available');
  await context.grantPermissions(['microphone'],{origin});
  await page.locator('[data-rec="start"]').click();await page.locator('.cc-mic-live').waitFor();
  await page.locator('[data-rec="cancel"]').click();await page.locator('[data-rec="start"]').waitFor();
  assert.ok(await page.evaluate(()=>qaMicrophoneStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  console.log('PASS: permission can be granted, retry works, cancel closes every microphone track');
  await page.locator('[data-rec="start"]').click();await page.locator('.cc-mic-live').waitFor();await page.waitForTimeout(1300);
  await page.locator('[data-rec="finish"]').click();await page.locator('[data-rec="send"]').waitFor();
  assert.ok(await page.evaluate(()=>qaMicrophoneStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  await page.locator('[data-rec="discard"]').click();await page.locator('[data-rec="start"]').waitFor();
  await page.locator('[data-action="tab-garden"]').click();await page.locator('.cc-board').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: finish closes microphone, discard removes draft, garden navigation works');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
