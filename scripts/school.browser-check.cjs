const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const home='http://127.0.0.1:4319/presentation-coran/?local=1&view=school';
  await p.goto(home);await p.getByRole('heading',{name:'École des Oliviers'}).waitFor();
  assert.equal(await p.locator('.school-grid article').count(),2);
  await p.getByLabel('Nom du professeur').fill('Mme Fatima');await p.getByRole('button',{name:'Ajouter le professeur',exact:true}).click();
  await p.getByRole('link',{name:'Ouvrir son espace d’essai'}).click();
  const teacherUrl=p.url();
  await p.getByLabel('Nom de la classe',{exact:true}).fill('Les étoiles');await p.getByRole('button',{name:'Créer ma classe',exact:true}).click();
  await p.locator('[data-form="student"] input[name="name"]').fill('Hakim');await p.locator('[data-form="student"] button').click();
  await p.getByRole('heading',{name:'Hakim',exact:true}).waitFor();
  await p.goto(home);await p.getByRole('button',{name:'Classes',exact:true}).click();
  const card=p.locator('.school-grid article').filter({has:p.getByRole('heading',{name:'Les étoiles',exact:true})});
  await card.waitFor();assert.match(await card.innerText(),/Mme Fatima/);
  await card.getByRole('combobox').selectOption('sarah');await p.getByRole('status').filter({hasText:'confiée'}).waitFor();
  await p.goto(teacherUrl);assert.equal(await p.getByRole('heading',{name:'Les étoiles',exact:true}).count(),0);
  await p.goto(home);await p.getByRole('button',{name:'Classes',exact:true}).click();await card.getByRole('link',{name:'Voir la classe'}).click();
  await p.getByRole('heading',{name:'Hakim',exact:true}).waitFor();
  const pupilLink=await p.locator('a.cc-preview-link').getAttribute('href');assert.match(pupilLink,/school-teacher=sarah/);
  await p.goto(pupilLink);await p.getByRole('button',{name:'Coran',exact:true}).waitFor();
  await p.goto(home);await p.getByRole('button',{name:'Suivi des élèves',exact:true}).click();await p.getByText('Hakim',{exact:true}).waitFor();
  for(const w of [320,390,768]){await p.setViewportSize({width:w,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${w}`)}
  assert.equal(await p.getByRole('link',{name:/licence|administration/i}).count(),0);assert.deepEqual(errors,[]);
  console.log('School demo passed: add teacher, create class/student, director totals, transfer, teacher separation, pupil link, responsive, no private admin.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
