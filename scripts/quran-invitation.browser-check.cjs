const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:4399',token='a'.repeat(64);
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 for(const scenario of ['new','existing','wrong','expired','invalid-proof','no-invite']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(scenario=>{
   const state=window.fixture={scenario,calls:[],user:scenario==='wrong'?{email:'admin@example.test'}:null};
   const api={auth:{
    getUser:async()=>({data:{user:state.user}}),
    verifyOtp:async input=>{state.calls.push(['verify',input]);if(scenario==='invalid-proof')return {error:{message:'Expired'}};state.user={email:'invited@example.test'};return {data:{user:state.user}}},
    updateUser:async input=>{state.calls.push(['password',input]);return {}},
    signOut:async()=>{state.user=null;return {}},onAuthStateChange:()=>{},
   },rpc:async(name,payload)=>{
    state.calls.push([name,payload]);
    if(name==='quran_invitation_info')return scenario==='expired'?{error:{message:'Cette invitation a expiré.'}}:{data:{valid:true,matches:state.user?.email==='invited@example.test'}};
    return {data:{accepted:true,organization:'org-test'}};
   }};
   window.KMAuth={client:()=>api,friendlyError:e=>e.message};
  },scenario);
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();
   if(['/km-auth.js','/km-config.js'].includes(u.pathname))return route.fulfill({body:'',contentType:'text/javascript'});
   if(u.pathname.endsWith('/interface.html'))return route.fulfill({body:'<h1>Votre espace</h1>',contentType:'text/html'});
   const file=path.join(root,u.pathname);if(!fs.existsSync(file))return route.abort();
   return route.fulfill({path:file,contentType:u.pathname.endsWith('.mjs')||u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.html')?'text/html':u.pathname.endsWith('.css')?'text/css':'image/png'});
  });
  if(scenario==='no-invite'){
   await page.goto(origin+'/coran-licence/inscription.html?mode=signup');await page.waitForFunction(()=>!!document.querySelector('#loginForm').onsubmit);
   assert.equal(await page.locator('#signupForm').isVisible(),false);assert.equal(await page.locator('#signupTab').isVisible(),false);assert.equal(await page.locator('#loginForm').isVisible(),true);
  }else{
   const hash=scenario==='wrong'||scenario==='expired'?token:`invitation=${token}&proof=test-proof&type=${scenario==='existing'?'magiclink':'invite'}&setup=${scenario==='existing'?'0':'1'}`;
   await page.goto(origin+'/coran-licence/invitation.html#'+hash);
   await page.waitForFunction(()=>document.querySelector('#invitation-status').textContent!=='Vérification du lien personnel…');
   assert.equal(new URL(page.url()).hash,'');
   assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c[0]==='verify')),false);
   if(scenario==='wrong'){assert.equal(await page.locator('#switch-account').isVisible(),true);assert.equal(await page.locator('#accept-invitation').isVisible(),false)}
   else if(scenario==='expired')assert.equal(await page.locator('#accept-invitation').isVisible(),false);
   else{
    await page.locator('#accept-invitation').click();
    if(scenario==='invalid-proof'){await page.getByText(/Ce lien d’activation a expiré/).waitFor();assert.equal(await page.locator('#activation-form').isVisible(),false)}
    else if(scenario==='new'){
     await page.locator('#activation-form').waitFor();
     await page.locator('[name=password]').fill('Fixture-only-123');await page.locator('[name=confirm]').fill('Mismatch-123');await page.locator('#activation-form button').click();
     await page.getByText('Les mots de passe ne correspondent pas.').waitFor();
     assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c[0]==='password')),false);
     await page.locator('[name=confirm]').fill('Fixture-only-123');await page.locator('#activation-form button').click();
     await page.waitForURL('**/interface.html?organization=org-test');
    }else await page.waitForURL('**/interface.html?organization=org-test');
   }
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log('PASS invitation:',scenario);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
