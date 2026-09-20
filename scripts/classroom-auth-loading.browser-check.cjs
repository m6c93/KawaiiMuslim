// Login controls must stay unavailable until JavaScript handles credentials.
// Uses no real credentials and intercepts any unsafe request before it is sent.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'https://coran.kawaiimuslimworld.com';
const overrides=process.env.QA_OVERRIDE_ROOT;
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 for(const blocked of [true,false]){
  const p=await browser.newPage();let unsafe=0;
  await p.route('**/*',async route=>{const u=new URL(route.request().url());if(u.searchParams.has('password')||u.searchParams.has('confirm')){unsafe++;return route.abort()}
   if(blocked&&u.pathname==='/coran-licence/account.js')return route.abort();
   if(overrides&&['/coran-licence/inscription.html','/coran-licence/account.js','/coran-licence/portal.css'].includes(u.pathname)){return route.fulfill({path:path.join(overrides,u.pathname),contentType:u.pathname.endsWith('.html')?'text/html':u.pathname.endsWith('.js')?'text/javascript':'text/css'})}return route.continue();
  });
  await p.goto(origin+'/coran-licence/inscription.html?mode=login');
  for(const form of ['loginForm','signupForm','recoveryForm'])assert.equal(await p.locator('#'+form).getAttribute('method'),'post');
  if(blocked){assert.ok(await p.locator('#loginForm [name=email]').isDisabled());assert.ok(await p.locator('#loginForm [name=password]').isDisabled());assert.ok(await p.locator('#loginForm button.button').isDisabled());await p.keyboard.press('Tab');await p.keyboard.press('Enter');assert.equal(unsafe,0);console.log('PASS: missing/delayed login module cannot submit credentials');}
  else{await p.waitForFunction(()=>[...document.querySelectorAll('.auth-form fieldset')].every(f=>!f.disabled));assert.equal(await p.locator('#loginForm [name=password]').isDisabled(),false);assert.equal(await p.evaluate(()=>typeof document.querySelector('#loginForm').onsubmit),'function');assert.equal(await p.locator('#authStatus').innerText(),'');for(const width of [390,820]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}console.log('PASS: initialized login is enabled with handlers, no overflow at 390/820px');}
  await p.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
