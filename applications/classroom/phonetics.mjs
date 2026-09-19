// Optional reading aid; never affects audio, verse selection or validation.
export function mountPhonetics(host,{surah,base,storageKey}){
 const bar=document.createElement('div');
 bar.className='cc-phonetics-controls';
 bar.innerHTML='<div class="cc-reading-options" role="group" aria-label="Aides à la lecture"><label><input type="checkbox" name="phonetics"> Phonétique</label><label><input type="checkbox" name="translation" checked> Traduction</label></div><small role="status" hidden></small>';
 const source=document.createElement('a');source.textContent='Source de la phonétique';source.href=new URL('data/transliteration/NOTICE.json',base).href;source.target='_blank';source.rel='noopener';source.hidden=true;bar.append(source);
 host.querySelector('.cc-all-verses').before(bar);
 const toggle=bar.querySelector('[name="phonetics"]'),translation=bar.querySelector('[name="translation"]'),hint=bar.querySelector('small');
 const translationKey=`${storageKey}:translation`;
 try{translation.checked=localStorage.getItem(translationKey)!=='false'}catch{}
 function paintTranslation(){host.querySelectorAll('.cc-verse > small').forEach(el=>{el.hidden=!translation.checked;el.classList.add('cc-translation')})}
 translation.addEventListener('change',()=>{try{localStorage.setItem(translationKey,String(translation.checked))}catch{}paintTranslation()});
 paintTranslation();
 let enabled=false,values=null,pending=null;
 try{enabled=localStorage.getItem(storageKey)==='true'}catch{}
 function paint(){
  toggle.checked=enabled;
  host.querySelectorAll('.cc-phonetic').forEach(el=>{el.hidden=!enabled});
  hint.hidden=!enabled;
  source.hidden=!enabled;
 }
 async function show(){
  paint();if(!enabled)return;
  hint.textContent=values?'Une aide pour lire. Écoute le récitateur pour la prononciation.':'Chargement de la phonétique…';
  if(values)return;
  try{
   pending ||= fetch(new URL(`data/transliteration/${surah}.json`,base)).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(d.surah!==Number(surah)||d.verses.length!==host.querySelectorAll('.cc-verse').length||d.verses.some(v=>typeof v!=='string'||!v.trim()))throw Error();return d.verses});
   const result=await pending;
   if(!bar.isConnected||values)return;
   values=result;
   host.querySelectorAll('.cc-verse').forEach(card=>{
    const line=document.createElement('span');line.className='cc-phonetic';line.lang='ar-Latn';line.dir='ltr';line.textContent=values[Number(card.dataset.verse)-1];line.hidden=!enabled;
    card.querySelector('small').before(line);
   });
   hint.textContent='Une aide pour lire. Écoute le récitateur pour la prononciation.';
  }catch{
   pending=null;enabled=false;paint();hint.hidden=false;hint.textContent='Phonétique indisponible. Appuie à nouveau pour réessayer.';
   try{localStorage.setItem(storageKey,'false')}catch{}
  }
 }
 toggle.addEventListener('change',()=>{enabled=toggle.checked;try{localStorage.setItem(storageKey,String(enabled))}catch{}show()});
 show();
}
