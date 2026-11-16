'use strict';
const {readFile}=require('node:fs/promises');
const {join}=require('node:path');
const {createDecipheriv}=require('node:crypto');
const AUTH='https://pasgxojzybmvbjhuokkk.supabase.co';
const ANON='sb_publishable_JfiHxlqfI8pXr4Emho4vOw_QBePfSHm';
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const reply=(status,access)=>res.status(status).json({access});
 if(req.method!=='POST')return reply(405,'unavailable');
 const path=req.query?.resource ? '/api/aya/'+req.query.resource : new URL(req.url,'https://kawaiimuslimworld.com').pathname;
 const match=/^\/api\/aya\/media\/(jours|corps|ecole|alphabet)$/.exec(path);
 if(path!=='/api/aya/access'&&!match)return reply(404,'unavailable');
 const auth=req.headers.authorization||'';
 if(!/^Bearer [\w.-]{1,8192}$/.test(auth))return reply(401,'signin');
 try{
  const headers={authorization:auth,apikey:ANON,accept:'application/json'};
  const signal=AbortSignal.timeout(6500);
  const identity=await fetch(AUTH+'/auth/v1/user',{headers,signal});
  if([401,403].includes(identity.status))return reply(401,'signin');
  if(!identity.ok)return reply(503,'unavailable');
  const user=await identity.json();
  if(!/^[0-9a-f-]{36}$/i.test(user.id||''))return reply(401,'signin');
  const [profileResponse,subscriptionResponse]=await Promise.all([
   fetch(AUTH+'/rest/v1/profiles?select=is_active&id=eq.'+encodeURIComponent(user.id),{headers,signal}),
   fetch(AUTH+'/rest/v1/rpc/get_family_subscription',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}',signal})
  ]);
  if(!profileResponse.ok||!subscriptionResponse.ok)return reply(503,'unavailable');
  const profiles=await profileResponse.json(),result=await subscriptionResponse.json();
  const subscription=Array.isArray(result)?result[0]:result;
  if(profiles?.[0]?.is_active!==true||!['active','trialing'].includes(subscription?.status))return reply(403,'subscribe');
  if(subscription.current_period_end&&Date.parse(subscription.current_period_end)<=Date.now())return reply(403,'subscribe');
  const key=process.env.AYA_PRODUCTION_MEDIA_KEY;
  if(!/^[a-f0-9]{64}$/.test(key||''))return reply(503,'unavailable');
  if(!match)return reply(200,'allowed');
  const encrypted=await readFile(join(process.cwd(),'applications/aya-chansons/media',match[1]+'.bin'));
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),encrypted.subarray(0,12));
  decipher.setAuthTag(encrypted.subarray(-16));
  const bytes=Buffer.concat([decipher.update(encrypted.subarray(12,-16)),decipher.final()]);
  res.setHeader('Content-Type','video/mp4');
  return res.status(200).send(bytes);
 }catch{return reply(503,'unavailable');}
};
