import { appleServices, currentAppleEntitlement, readAppleBody, activeApple, Environment, AppStoreServerAPIClient, normalizeECKeyMetadata } from '../supabase/functions/_shared/apple.ts';
import {Buffer} from 'node:buffer';
import {APPLE_ROOTS_BASE64} from '../supabase/functions/_shared/apple-roots.ts';
import crypto from 'node:crypto';
const { SignedDataVerifier } = await import('npm:@apple/app-store-server-library@3.1.0');
const assert=(value:boolean,message:string)=>{if(!value)throw new Error(message);};
const owner='11111111-1111-4111-8111-111111111111';
const now=Date.now();
const transaction={appAccountToken:owner,bundleId:'com.kawaiimuslimworld.ios',environment:'Production',type:'Auto-Renewable Subscription',productId:'com.kawaiimuslimworld.family1.monthly',transactionId:'t',originalTransactionId:'o',signedDate:now,expiresDate:now+86400000};
Deno.test('Edge certificate compatibility preserves bytes and rejects the wrong signing key',()=>{
 const roots=APPLE_ROOTS_BASE64.map(x=>new crypto.X509Certificate(Buffer.from(x,'base64')));
 for(let i=0;i<roots.length;i++) {
  assert(roots[i].raw.equals(Buffer.from(APPLE_ROOTS_BASE64[i],'base64')),'Certificate bytes changed');
  assert(new crypto.X509Certificate(roots[i].toString()).raw.equals(roots[i].raw),'PEM changed certificate');
  assert(roots[i].ca,'Root lost CA constraint');
  assert(roots[i].verify(roots[i].publicKey),'Valid root signature rejected');
  assert(!roots[i].verify(roots[1-i].publicKey),'Wrong root signature accepted');
 }
});
Deno.test('Official Apple verifier rejects an unsigned fabricated entitlement',async()=>{
 const verifier=new SignedDataVerifier(APPLE_ROOTS_BASE64.map(x=>Buffer.from(x,'base64')),true,Environment.PRODUCTION,transaction.bundleId,6818828243);
 const forged=[{alg:'none'},transaction].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.';
 let rejected=false;try{await verifier.verifyAndDecodeTransaction(forged);}catch{rejected=true;}assert(rejected,'Forged purchase accepted');
});
Deno.test('Current Apple status wins over old receipts, including refunds',async()=>{
 let status=5;
 const service={api:{getAllSubscriptionStatuses:async()=>({data:[{lastTransactions:[{originalTransactionId:'o',signedTransactionInfo:'verified-test-fixture',status}]}]})},verifier:{verifyAndDecodeTransaction:async()=>transaction}} as unknown as ReturnType<typeof appleServices>;
 let entitlement=await currentAppleEntitlement(service,'o',owner,Environment.PRODUCTION);assert(!activeApple(entitlement),'Refund granted access');
 status=2;entitlement=await currentAppleEntitlement(service,'o',owner,Environment.PRODUCTION);assert(!activeApple(entitlement),'Expired status granted access');
 status=1;entitlement=await currentAppleEntitlement(service,'o',owner,Environment.PRODUCTION);assert(activeApple(entitlement),'Valid current status denied');
});
Deno.test('Oversized chunked request rejected, valid request parsed',async()=>{
 let rejected=false;try{await readAppleBody(new Request('https://example.invalid',{method:'POST',body:'x'.repeat(70000)}));}catch{rejected=true;}assert(rejected,'Oversized request accepted');
 assert((await readAppleBody(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({signedTransaction:'example'})}))).signedTransaction==='example','Valid request lost');
});
Deno.test('Apple API authorization signs valid ES256 requests and rejects the wrong private curve',async()=>{
 let authorization='';
 class TestClient extends AppStoreServerAPIClient {
   protected override async makeFetchRequest(_path:string,_query:URLSearchParams,_method:string,_body:unknown,headers:Record<string,string>):Promise<any> {
     authorization=headers.Authorization;
     return new Response(JSON.stringify({data:[]}),{status:200,headers:{'Content-Type':'application/json'}});
   }
 }
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 // Simulate the older Supabase Edge runtime's missing private-curve metadata.
 Object.defineProperty(privateKey,'asymmetricKeyDetails',{value:{},configurable:true});
 const missingCurve=new TestClient(privateKey as unknown as string,'TESTKEY','test','com.kawaiimuslimworld.ios',Environment.SANDBOX);
 let missingRejected=false;try{await missingCurve.getAllSubscriptionStatuses('test-only-transaction');}catch{missingRejected=true;}
 assert(missingRejected,'Missing private curve should be rejected by the official signer');
 assert(normalizeECKeyMetadata(privateKey).asymmetricKeyDetails.namedCurve==='prime256v1','Private curve was not recovered');
 const client=new TestClient(privateKey.export({type:'pkcs8',format:'pem'}) as string,'TESTKEY','00000000-0000-4000-8000-000000000000','com.kawaiimuslimworld.ios',Environment.SANDBOX);
 await client.getAllSubscriptionStatuses('test-only-transaction');
 const [header,payload,signature]=authorization.replace(/^Bearer /,'').split('.');
 assert(JSON.parse(Buffer.from(header,'base64url').toString()).alg==='ES256','Wrong JWT algorithm');
 assert(crypto.verify('sha256',Buffer.from(header+'.'+payload),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),'API JWT signature invalid');
 const wrong=crypto.generateKeyPairSync('ec',{namedCurve:'secp384r1'}).privateKey;
 const invalid=new TestClient(wrong.export({type:'pkcs8',format:'pem'}) as string,'TESTKEY','test','com.kawaiimuslimworld.ios',Environment.SANDBOX);
 let rejected=false;try{await invalid.getAllSubscriptionStatuses('test-only-transaction');}catch{rejected=true;}assert(rejected,'Invalid ES256 curve accepted');
});
