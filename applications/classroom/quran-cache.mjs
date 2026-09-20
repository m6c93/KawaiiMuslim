// Only public, immutable Quran JSON belongs here. Never cache account data.
export function createQuranCache(fetcher=fetch,limit=12){
 const entries=new Map();
 return function load(url){
  const key=String(url);
  if(entries.has(key)){const result=entries.get(key);entries.delete(key);entries.set(key,result);return result}
  const request=Promise.resolve().then(()=>fetcher(url)).then(response=>{
   if(!response.ok)throw Error('Sourate indisponible');
   return response.json();
  }).catch(error=>{if(entries.get(key)===request)entries.delete(key);throw error});
  entries.set(key,request);
  while(entries.size>limit)entries.delete(entries.keys().next().value);
  return request;
 };
}
export const loadQuranJson=createQuranCache();
