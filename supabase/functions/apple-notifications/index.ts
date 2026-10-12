import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { appleServices, permitsSandbox, currentAppleEntitlement, readAppleBody, Environment } from '../_shared/apple.ts';
import { jsonResponse } from '../_shared/cors.ts';

// Public Apple callback: authentication is Apple's certificate-validated JWS, not a user JWT.
Deno.serve(async request => {
  if(request.method!=='POST') return jsonResponse({error:'Method not allowed'},405);
  try {
    const body=await readAppleBody(request);
    if(typeof body.signedPayload!=='string' || body.signedPayload.length>60000) return jsonResponse({error:'Missing signed notification'},400);
    let environment=Environment.PRODUCTION;
    let service=appleServices(environment);
    let notification;
    try {notification=await service.verifier.verifyAndDecodeNotification(body.signedPayload);}
    catch {environment=Environment.SANDBOX;service=appleServices(environment);notification=await service.verifier.verifyAndDecodeNotification(body.signedPayload);}
    const signed=notification.data?.signedTransactionInfo;
    if(!signed) return jsonResponse({received:true}); // Apple TEST notifications have no transaction.
    const transaction=await service.verifier.verifyAndDecodeTransaction(signed);
    const owner=transaction.appAccountToken;
    if(!owner || !transaction.originalTransactionId || (environment===Environment.SANDBOX && !permitsSandbox(owner))) throw new Error('Invalid owner');
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:ownerState,error:ownerError}=await admin.rpc('billing_owner_state',{p_user_id:owner});
    if(ownerError) throw ownerError; // An unavailable DB must still cause a retry.
    if(ownerState==='absent') return jsonResponse({received:true});
    if(!['active_parent','restricted'].includes(ownerState)) throw new Error('Invalid owner state');
    const {data:profile,error:profileError}=await admin.from('profiles').select('role,is_active').eq('id',owner).single();
    if(profileError || profile?.role!=='parent') throw new Error('Parent not found');
    const entitlement=await currentAppleEntitlement(service,transaction.originalTransactionId,owner,environment);
    const {error}=await admin.rpc('save_verified_apple_subscription',{p:entitlement});
    if(error) throw error;
    return jsonResponse({received:true});
  } catch(error) {
    console.error('Apple notification rejected',error instanceof Error?error.name:'error');
    // Non-2xx makes Apple retry; a failure never grants access.
    return jsonResponse({error:'Notification not processed'},422);
  }
});
