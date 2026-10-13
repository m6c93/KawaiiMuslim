import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { appleServices, permitsSandbox, currentAppleEntitlement, readAppleBody, activeApple, Environment } from '../_shared/apple.ts';
import { entitlementFromApple } from '../apple-purchase/core.mjs';
import { jsonResponse } from '../_shared/cors.ts';

const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async request=>{
  if(request.method==='OPTIONS') return jsonResponse({});
  if(request.method!=='POST') return jsonResponse({error:'Method not allowed'},405);
  let stage='request';
  try {
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body=await readAppleBody(request);
    if(body.action==='reserve') {
      stage='reserve';
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.accountToken||'') || !/^[0-9a-f]{64}$/i.test(body.secret||'')) throw new Error('Invalid reservation');
      const secretHash=await digest(body.secret);
      // Hash instead of storing source IPs. Serialize reservation quotas in SQL.
      const sourceHash=await digest((request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown')+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
      const {error}=await admin.rpc('reserve_apple_purchase',{p_token:body.accountToken,p_secret_hash:secretHash,p_source_hash:sourceHash});
      if(error) throw error;
      return jsonResponse({reserved:true});
    }
    stage='authenticate';
    const auth=request.headers.get('authorization')?.replace(/^Bearer /i,'');
    const {data,error:authError}=await admin.auth.getUser(auth||'');
    if(authError || !data.user) return jsonResponse({error:'Connexion requise.'},401);
    const owner=data.user.id;
    if(body.action==='tokens') {
      stage='load-linked-tokens';
      const {data:rows,error}=await admin.from('apple_purchase_reservations').select('account_token').eq('user_id',owner);
      if(error) throw error;
      return jsonResponse({tokens:(rows||[]).map(row=>row.account_token)});
    }
    if(body.action!=='claim' || typeof body.signedTransaction!=='string' || body.signedTransaction.length>30000 || !/^[0-9a-f]{64}$/i.test(body.secret||'')) throw new Error('Invalid claim');
    stage='verify-production';
    let environment=Environment.PRODUCTION,service=appleServices(environment),transaction;
    try {transaction=await service.verifier.verifyAndDecodeTransaction(body.signedTransaction);}
    catch(error) {
      if(!permitsSandbox(owner)) {stage='sandbox-account-not-enabled';throw error;}
      stage='verify-sandbox';
      environment=Environment.SANDBOX;service=appleServices(environment);
      transaction=await service.verifier.verifyAndDecodeTransaction(body.signedTransaction);
    }
    // Validate Apple identity against the reserved token before mapping to a parent.
    stage='validate-receipt';
    const token=transaction.appAccountToken;
    if(!token) throw new Error('Missing account token');
    entitlementFromApple(transaction,token,environment);
    stage='current-apple-status';
    const entitlement=await currentAppleEntitlement(service,transaction.originalTransactionId!,token,environment);
    stage='active-entitlement';
    if(!activeApple(entitlement)) throw new Error('Purchase no longer active');
    stage='claim-reservation';
    const {error}=await admin.rpc('claim_apple_purchase',{p_token:token,p_secret_hash:await digest(body.secret),p_owner:owner,p_entitlement:{...entitlement,user_id:owner}});
    if(error) throw error;
    return jsonResponse({verified:true,active:true,accountToken:token});
  } catch(error) {
    // Fixed stage/reasons only: never log customer receipts, JWTs, secrets or IDs.
    const diagnostic=error as {name?:string,httpStatusCode?:number,message?:string};
    const reasons=new Set(['Reservation proof invalid','Purchase already assigned','Transaction mismatch','Owner mismatch','Parent required','Purchase no longer active','Compte Apple associé à un autre compte parent.','Application ou environnement invalide.','Abonnement invalide.','Transaction invalide.','Apple subscription not found']);
    console.error('Apple onboarding rejected',JSON.stringify({stage,name:error instanceof Error?error.name:'error',httpStatus:typeof diagnostic?.httpStatusCode==='number'?diagnostic.httpStatusCode:null,reason:reasons.has(diagnostic?.message||'')?diagnostic.message:undefined}));
    return jsonResponse({error:'La préparation ou la reprise de ton achat n’a pas abouti. Ne paie pas une deuxième fois ; réessaie ou contacte le support.'},422);
  }
});
