import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { appleServices, permitsSandbox, currentAppleEntitlement, readAppleBody, activeApple, Environment } from '../_shared/apple.ts';
import { entitlementFromApple } from './core.mjs';
import { jsonResponse } from '../_shared/cors.ts';

Deno.serve(async request => {
  if (request.method==='OPTIONS') return jsonResponse({});
  if (request.method!=='POST') return jsonResponse({error:'Method not allowed'},405);
  try {
    if (Number(request.headers.get('content-length')||0)>65536) return jsonResponse({error:'Request too large'},413);
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth=request.headers.get('authorization')?.replace(/^Bearer /i,'');
    if (!auth) return jsonResponse({error:'Connexion requise.'},401);
    const {data: userData,error:authError}=await admin.auth.getUser(auth);
    if (authError || !userData.user) return jsonResponse({error:'Connexion requise.'},401);
    const owner=userData.user.id;
    const {data:profile,error:profileError}=await admin.from('profiles').select('is_active,role').eq('id',owner).single();
    if(profileError || profile?.is_active!==true || profile?.role!=='parent') return jsonResponse({error:'Compte parent requis.'},403);
    const body=await readAppleBody(request);
    if(typeof body.signedTransaction!=='string' || body.signedTransaction.length>30000) return jsonResponse({error:'Transaction manquante.'},400);
    let environment=Environment.PRODUCTION;
    let service=appleServices(environment);
    let transaction;
    try {transaction=await service.verifier.verifyAndDecodeTransaction(body.signedTransaction);}
    catch(error) {
      if(!permitsSandbox(owner)) throw error;
      environment=Environment.SANDBOX;service=appleServices(environment);
      transaction=await service.verifier.verifyAndDecodeTransaction(body.signedTransaction);
    }
    entitlementFromApple(transaction,owner,environment);
    // Query Apple for the CURRENT group status: old signed receipts cannot restore a refund.
    const entitlement=await currentAppleEntitlement(service,transaction.originalTransactionId!,owner,environment);
    const {error}=await admin.rpc('save_verified_apple_subscription',{p:entitlement});
    if(error) throw error;
    const active=activeApple(entitlement);
    return jsonResponse({verified:true,active,childLimit:entitlement.child_limit,expiresAt:entitlement.expires_at});
  } catch(error) {
    // Never log JWTs, keys or customer receipts.
    console.error('Apple verification failed',error instanceof Error?error.name:'error');
    return jsonResponse({error:'La vérification Apple n’a pas abouti. Aucun nouvel accès n’a été accordé. Réessaie depuis Restaurer mes achats.'},422);
  }
});
