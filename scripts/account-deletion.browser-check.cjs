// Mocked parent UI. All network is intercepted; no real login or account is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Compte.dc.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']} : {})});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (url.hostname === 'km-test.invalid' && file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':'image/png'});
      }
      return route.abort();
    });
    const boot = async (mode='normal') => {
      await page.setContent(html.replace('<head>', '<head><base href="https://km-test.invalid/">'));
      await page.evaluate(mode => {
        window.calls = {reauth:0,rpc:0,mfa:0};
        window.receipt = {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',requested_at:'2026-10-08T12:00:00Z',due_at:'2026-11-07T12:00:00Z'};
        window.mode = mode;
        window.KMAuth = {
          getContext:async()=>({user:{id:'fictional-parent'}}),
          getSession:async()=>({user:{id:'fictional-parent'}}),
          reauthenticate:async password=>{
            calls.reauth++;
            if(password!=='fictional-password')throw Error('Mot de passe incorrect.');
            return {user:{id:'fictional-parent'}};
          },
          getMFAStatus:async()=>({currentLevel:mode==='mfa'&&calls.mfa?'aal2':'aal1',nextLevel:mode==='mfa'?'aal2':'aal1',factors:mode==='mfa'?[{id:'fictional-factor'}]:[]}),
          verifyMFACode:async ({code})=>{if(code!=='123456')throw Error('Code incorrect.');calls.mfa++;},
          client:()=>({
            from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:mode==='pending'?receipt:null,error:mode==='unavailable'?{message:'unavailable'}:null})})})}),
            rpc:async (_,body)=>{
              calls.rpc++;
              if(mode==='network')throw Error('Connexion interrompue. Demande non confirmée.');
              if(!body.confirmed)throw Error('Confirmation requise.');
              return {data:receipt,error:null};
            }
          })
        };
      },mode);
      await page.addScriptTag({path:path.join(root,'account-deletion.js')});
      if(mode!=='pending'&&mode!=='unavailable')await page.waitForFunction(()=>!document.getElementById('deletionSubmit').disabled);
    };
    const fill = async (password='fictional-password') => {
      await page.locator('#deletionDetails').evaluate(el=>el.open=true);
      await page.locator('#deletionPassword').fill(password);
      await page.locator('#deletionConfirm').check();
    };
    await boot();
    await fill();
    await page.locator('#deletionConfirm').uncheck();
    await page.locator('#deletionSubmit').click();
    assert.equal(await page.evaluate(()=>calls.rpc),0);
    await page.locator('#deletionConfirm').check();
    await page.locator('#deletionCancel').click();
    assert.equal(await page.evaluate(()=>calls.rpc),0);
    assert.equal(await page.locator('#deletionPassword').inputValue(),'');
    console.log('PASS: confirmation and cancel do not initiate requests');
    await boot();await fill('wrong');await page.locator('#deletionSubmit').click();
    await page.waitForFunction(()=>document.getElementById('deletionMessage').textContent.includes('incorrect'));
    assert.equal(await page.evaluate(()=>calls.rpc),0);
    assert.equal(await page.locator('#deletionPassword').inputValue(),'');
    console.log('PASS: wrong password does not request erasure and is cleared');
    await boot('network');await fill();await page.locator('#deletionSubmit').click();
    await page.waitForFunction(()=>document.getElementById('deletionMessage').textContent.includes('interrompue'));
    assert.equal(await page.locator('#deletionForm').isVisible(),true);
    console.log('PASS: network failure never displays success');
    await boot('mfa');await fill();await page.locator('#deletionSubmit').click();
    await page.waitForFunction(()=>!document.getElementById('deletionMFA').hidden);
    assert.equal(await page.evaluate(()=>calls.rpc),0);
    await page.locator('#deletionCode').fill('123456');await page.locator('#deletionSubmit').click();
    await page.waitForFunction(()=>document.getElementById('deletionForm').hidden);
    assert.equal(await page.evaluate(()=>calls.mfa),1);
    assert.equal(await page.evaluate(()=>calls.rpc),1);
    console.log('PASS: MFA challenge is required before request');
    await boot();await fill();await page.locator('#deletionSubmit').click();
    await page.waitForFunction(()=>document.getElementById('deletionForm').hidden);
    assert.match(await page.locator('#deletionMessage').innerText(),/07\/11\/2026/);
    console.log('PASS: parent receives a dated receipt and actual deadline');
    await boot('pending');await page.waitForFunction(()=>document.getElementById('deletionForm').hidden);
    assert.equal(await page.evaluate(()=>calls.rpc),0);
    for(const width of [390,820,1280]) {
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#suppression-compte').scrollIntoViewIfNeeded();
    if(process.env.QA_SCREENSHOT)await page.screenshot({path:process.env.QA_SCREENSHOT});
    console.log('PASS: existing request survives reload, no duplicate request, responsive receipt');
    await boot('unavailable');
    await page.waitForFunction(()=>document.getElementById('deletionMessage').textContent.includes('indisponible'));
    assert.equal(await page.locator('#deletionSubmit').isDisabled(),true);
    console.log('PASS: unconfigured backend stays visibly unavailable');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
