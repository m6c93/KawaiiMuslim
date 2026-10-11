import type { Environment as AppleEnvironment } from 'npm:@apple/app-store-server-library@3.1.0';
type Environment = AppleEnvironment;
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { X509, ASN1HEX, KEYUTIL } from 'npm:jsrsasign@11.1.0';
// Preserve the original certificate bytes where Edge Runtime omits raw/toString.
const OriginalCertificate: any = crypto.X509Certificate;
const certificateBytes = new WeakMap<object, Buffer>();
class CompatibleCertificate extends OriginalCertificate {
  constructor(input: any) {
    super(input);
    const bytes = Buffer.from(input);
    const text = bytes.toString('utf8');
    certificateBytes.set(this, text.includes('-----BEGIN CERTIFICATE-----')
      ? Buffer.from(text.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g,''),'base64') : bytes);
  }
  verify(key: any) {
    const cert = new X509(); cert.readCertHex(this.raw.toString('hex'));
    const alg = cert.getSignatureAlgorithmField();
    const hashes: Record<string,string> = {SHA256withRSA:'sha256',SHA384withRSA:'sha384',SHA512withRSA:'sha512',SHA256withECDSA:'sha256',SHA384withECDSA:'sha384',SHA512withECDSA:'sha512'};
    if(!hashes[alg]) throw new Error('Unsupported certificate signature algorithm');
    return crypto.verify(hashes[alg], Buffer.from(ASN1HEX.getTLVbyList(this.raw.toString('hex'),0,[0])!,'hex'),key,Buffer.from(cert.getSignatureValueHex(),'hex'));
  }
  get infoAccess() { const cert = new X509(); cert.readCertHex(this.raw.toString('hex')); return (cert.getExtAIAInfo()?.ocsp || []).map((url: string) => 'OCSP - URI:' + url).join('\n'); }
  get ca() { const cert = new X509(); cert.readCertHex(this.raw.toString('hex')); return cert.getExtBasicConstraints()?.cA === true; }
  get raw() { return Buffer.from(certificateBytes.get(this)!); }
  toString() { return '-----BEGIN CERTIFICATE-----\n' + this.raw.toString('base64').match(/.{1,64}/g)!.join('\n') + '\n-----END CERTIFICATE-----\n'; }
}
crypto.X509Certificate = CompatibleCertificate as typeof crypto.X509Certificate;
const originalCreatePublicKey = crypto.createPublicKey;
crypto.createPublicKey = ((input: any) => {
  const key = originalCreatePublicKey(input);
  if(key.asymmetricKeyType === 'ec') {
    const parsed = KEYUTIL.getKey(key.export({type:'spki',format:'pem'}) as string) as any;
    const curves: Record<string,string> = {secp256r1:'prime256v1',prime256v1:'prime256v1',secp384r1:'secp384r1',secp521r1:'secp521r1'};
    if(!curves[parsed.curveName]) throw new Error('Unsupported public key curve');
    Object.defineProperty(key,'asymmetricKeyDetails',{value:{...key.asymmetricKeyDetails,namedCurve:curves[parsed.curveName]},configurable:true});
  }
  return key;
}) as typeof crypto.createPublicKey;
// Load Apple's verifier after the compatibility functions so its dependencies
// bind the correct public-key metadata. Signature and OCSP checks stay enabled.
const { AppStoreServerAPIClient, SignedDataVerifier, Environment } = await import('npm:@apple/app-store-server-library@3.1.0');
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
