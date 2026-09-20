const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,channel:'chrome'});try{
 const director=await b.newPage(),errors=[];director.on('pageerror',e=>errors.push(e.message));
 const home=(process.env.TEST_ORIGIN||'http://127.0.0.1:4319')+'/presentation-coran/?local=1&view=school';
 await director.goto(home);await director.getByLabel('Nom du professeur').fill('Amine · Test invitation');await director.getByRole('button',{name:'Ajouter le professeur',exact:true}).click();
 const card=director.locator('.school-grid article').filter({hasText:'Amine · Test invitation'});
 await card.getByRole('button',{name:'Inviter · Copier son lien'}).click();
 const input=director.getByRole('textbox',{name:'Lien professeur',exact:true});await input.waitFor({timeout:30000});const url=await input.inputValue();
 const teacher=await b.newPage();await teacher.goto(url);await teacher.getByLabel('Nom de la classe',{exact:true}).fill('Les jasmins · Test');await teacher.getByRole('button',{name:'Créer ma classe',exact:true}).click();
 await teacher.locator('[data-form="student"] input[name="name"]').fill('Élève fictif');await teacher.locator('[data-form="student"] button').click();await teacher.getByRole('heading',{name:'Élève fictif',exact:true}).waitFor();
 await director.goto(home);await director.getByRole('button',{name:'Classes',exact:true}).click();await director.getByRole('heading',{name:'Les jasmins · Test',exact:true}).waitFor();
 assert.equal(await teacher.getByText('Les oliviers · Démonstration',{exact:true}).count(),0);
 await director.getByRole('button',{name:'Professeurs',exact:true}).click();await card.getByRole('button',{name:'Inviter · Copier son lien'}).click();await input.waitFor();assert.equal(await input.inputValue(),url);
 assert.deepEqual(errors,[]);console.log('PASS: new teacher invitation, isolated browser, own class/student, director synchronized, stable invitation link.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
