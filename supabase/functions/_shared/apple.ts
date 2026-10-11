import { AppStoreServerAPIClient, SignedDataVerifier, Environment } from 'npm:@apple/app-store-server-library@3.1.0';
import { Buffer } from 'node:buffer';
import { APPLE_ROOTS_BASE64 } from './apple-roots.ts';
import { entitlementFromApple } from '../apple-purchase/core.mjs';
export { Environment };
export function appleServices(environment: Environment) {
  const key = Deno.env.get('APPLE_IAP_PRIVATE_KEY');
  const keyId = Deno.env.get('APPLE_IAP_KEY_ID');
  const issuer = Deno.env.get('APPLE_IAP_ISSUER_ID');
  if (!key || !keyId || !issuer) throw new Error('Apple purchase service not configured');
  const roots = APPLE_ROOTS_BASE64.map(value=>Buffer.from(value,'base64'));
  return {
    verifier: new SignedDataVerifier(roots,true,environment,'com.kawaiimuslimworld.ios',6818828243),
    api: new AppStoreServerAPIClient(key.replace(/\\n/g,'\n'),keyId,issuer,'com.kawaiimuslimworld.ios',environment),
  };
}
export function permitsSandbox(owner: string) {
  return (Deno.env.get('APPLE_SANDBOX_USER_IDS')||'').split(',').map(x=>x.trim()).includes(owner);
}
export async function currentAppleEntitlement(service: ReturnType<typeof appleServices>, original: string, owner: string, environment: Environment) {
  const statuses=await service.api.getAllSubscriptionStatuses(original);
  let latest: any;
  let status: number | undefined;
  for(const group of statuses.data||[]) for(const item of group.lastTransactions||[]) {
    if(item.originalTransactionId!==original || !item.signedTransactionInfo) continue;
    const decoded=await service.verifier.verifyAndDecodeTransaction(item.signedTransactionInfo);
    if(decoded.originalTransactionId!==original) throw new Error('Apple transaction mismatch');
    if(!latest || (decoded.signedDate||0)>(latest.signedDate||0)) {latest=decoded;status=item.status;}
  }
  if(!latest) throw new Error('Apple subscription not found');
  return entitlementFromApple(latest,owner,environment,Date.now(),status);
}
export async function readAppleBody(request: Request) {
  if(Number(request.headers.get('content-length')||0)>65536) throw new Error('Request too large');
  // Bound streamed/chunked bodies too, without buffering an unbounded request.
  const reader=request.body?.getReader();
  if(!reader) throw new Error('Missing request');
  let size=0;const chunks: Uint8Array[]=[];
  while(true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new Error('Request too large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function activeApple(entitlement: any) {
  return [1,4].includes(entitlement.apple_status) && !entitlement.revoked_at && Date.parse(entitlement.expires_at)>Date.now();
}
