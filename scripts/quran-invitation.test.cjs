const test=require('node:test'),assert=require('node:assert/strict');
process.env.BREVO_API_KEY='test-only';process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-only';
const handler=require('../api/quran-invitation');
const token='a'.repeat(64);
async function invoke(body={token},options={}){
 const calls=[];global.fetch=async(url,init)=>{
  const data=JSON.parse(init.body);calls.push({url,data});
  if(url.includes('/rpc/')){
   if(data.action==='finish')return {ok:true,json:async()=>({saved:true})};
   if(options.denied)return {ok:false,status:403,json:async()=>({})};
   return {ok:true,json:async()=>({id:'invite',attempt:'attempt',email:'invited@example.test',name:'Test <b>',organization:'École',existing:!!options.existing,needsPassword:!options.existing})};
  }
  if(url.includes('/generate_link'))return {ok:true,json:async()=>({hashed_token:'secret-recipient-proof',verification_type:options.existing?'magiclink':'invite'})};
  return {ok:!options.mailFailure,status:503,json:async()=>options.mailFailure?{}:{messageId:'message-test'}};
 };
 const response={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:'POST',headers:{origin:options.origin||'https://coran.kawaiimuslimworld.com',authorization:'Bearer test.jwt'},body},response);
 return {response,calls};
}
test('new recipient: server resolves email, emails proof, never returns it',async()=>{
 const {response,calls}=await invoke();assert.equal(response.code,200);assert.deepEqual(response.data,{sent:true});
 const mail=calls.find(c=>c.url.includes('brevo')).data;assert.equal(mail.to[0].email,'invited@example.test');assert.match(mail.htmlContent,/Créer mon compte/);assert.match(mail.htmlContent,/Test &lt;b&gt;/);assert.equal(mail.headers['X-Mailin-trackClick'],'0');
 assert.equal(calls.find(c=>c.url.includes('generate_link')).data.type,'invite');
 assert.equal(calls.at(-1).data.payload.sent,true);
});
test('existing recipient keeps existing identity and password',async()=>{const {calls}=await invoke({token},{existing:true});const proof=calls.find(c=>c.url.includes('generate_link')).data;assert.equal(proof.type,'magiclink');assert.equal(proof.password,undefined);assert.equal(proof.data,undefined)});
test('cannot choose recipient email or privileges in API payload',async()=>{const {response,calls}=await invoke({token,email:'attacker@example.test',role:'owner'});assert.equal(response.code,400);assert.equal(calls.length,0)});
test('wrong origin cannot send',async()=>{const {response,calls}=await invoke({token},{origin:'https://evil.example'});assert.equal(response.code,403);assert.equal(calls.length,0)});
test('RPC denied means no Auth proof or email generated',async()=>{const {response,calls}=await invoke({token},{denied:true});assert.equal(response.code,403);assert.equal(calls.length,1)});
test('provider failure is not reported as sent',async()=>{const {response,calls}=await invoke({token},{mailFailure:true});assert.equal(response.code,502);assert.equal(calls.at(-1).data.payload.sent,false)});
test('missing configuration fails closed before any network request',async()=>{delete process.env.SUPABASE_SERVICE_ROLE_KEY;const {response,calls}=await invoke();assert.equal(response.code,503);assert.equal(calls.length,0);process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-only'});
