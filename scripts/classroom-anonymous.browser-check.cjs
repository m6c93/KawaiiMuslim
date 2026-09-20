// Read-only public checks. No credentials, account creation or email sent.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const p=await browser.newPage();p.setDefaultTimeout(20000);
  for(const route of ['interface.html','administration.html','securite.html']){
   await p.goto('https://coran.kawaiimuslimworld.com/coran-licence/'+route);
   await p.waitForURL('**/inscription.html?mode=login');
   await p.getByRole('button',{name:'Me connecter',exact:true}).waitFor();
   console.log('PASS: anonymous '+route+' redirects to login');
  }
  await p.goto('https://coran.kawaiimuslimworld.com/coran-licence/invitation.html#invalid-qa-link');
  await p.getByText('Ouvrez le lien personnel fourni par votre professeur ou votre responsable.',{exact:true}).waitFor();
  assert.ok(!(await p.locator('#accept-invitation').isVisible()));
  console.log('PASS: malformed invitation cannot be accepted');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
