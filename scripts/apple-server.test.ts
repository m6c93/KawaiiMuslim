import { appleServices, currentAppleEntitlement, readAppleBody, activeApple, Environment } from '../supabase/functions/_shared/apple.ts';
import { SignedDataVerifier } from 'npm:@apple/app-store-server-library@3.1.0';
import {Buffer} from 'node:buffer';
import {APPLE_ROOTS_BASE64} from '../supabase/functions/_shared/apple-roots.ts';
import crypto from 'node:crypto';
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
