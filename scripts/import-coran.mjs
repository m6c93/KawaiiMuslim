import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const destination=new URL('../applications/coran/data/',import.meta.url);
await mkdir(destination,{recursive:true});
const licenseNotice=await readFile(new URL('NOTICE.txt',destination),'utf8');
const editions=['quran-uthmani','fr.hamidullah','ar.hudhaify'];
const raw=[];
for(const edition of editions){
 const response=await fetch(`https://api.alquran.cloud/v1/quran/${edition}`,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error(`${edition}: ${response.status}`);
 const text=await response.text();const json=JSON.parse(text);
 if(json.code!==200||json.data.surahs.length!==114)throw new Error('Incomplete corpus');
 raw.push({edition,data:json.data,sha256:createHash('sha256').update(text).digest('hex')});
}
const index=[];let count=0;
for(let n=0;n<114;n++){
 const ar=raw[0].data.surahs[n],fr=raw[1].data.surahs[n],audio=raw[2].data.surahs[n];
 if(ar.number!==n+1||fr.number!==ar.number||audio.number!==ar.number||ar.ayahs.length!==fr.ayahs.length||ar.ayahs.length!==audio.ayahs.length)throw new Error('Surah mismatch');
 const meta={id:ar.number,name:ar.englishName,arabic:ar.name,count:ar.ayahs.length,revelation:ar.revelationType};index.push(meta);
 const verses=ar.ayahs.map((v,i)=>{
  const f=fr.ayahs[i],a=audio.ayahs[i];
  if(v.numberInSurah!==i+1||v.number!==++count||a.number!==v.number||f.number!==v.number||a.text!==v.text)throw new Error('Verse alignment mismatch');
  if(!a.audio.startsWith('https://cdn.islamic.network/quran/audio/128/ar.hudhaify/'))throw new Error('Unexpected reciter');
  return {id:`${ar.number}:${v.numberInSurah}`,number:v.number,verse:v.numberInSurah,arabic:v.text,translation:f.text,audio:a.audio,juz:v.juz,page:v.page};
 });
 await writeFile(new URL(`${ar.number}.json`,destination),JSON.stringify({source:'Tanzil via Al Quran Cloud; French translation: Muhammad Hamidullah; recitation: Ali Al-Hudhaify',licenseNotice,...meta,verses}));
}
if(count!==6236)throw new Error(`Unexpected verse count ${count}`);
await writeFile(new URL('index.json',destination),JSON.stringify(index));
await writeFile(new URL('sources.json',destination),JSON.stringify({retrievedAt:new Date().toISOString(),surahs:114,verses:count,editions:raw.map(({edition,sha256,data})=>({edition,sha256,metadata:data.edition})),textLicense:'https://tanzil.net/docs/Text_License',serviceTerms:'https://alquran.cloud/terms-and-conditions',cdnDocs:'https://alquran.cloud/cdn',audioMode:'Direct streaming; no audio files copied to this project; rights remain with reciters.'},null,2));
console.log(`Imported and aligned ${count} verses, ${index.length} surahs, Uthmani text, Hamidullah translation, Ali Al-Hudhaify audio URLs.`);
