const DATABASE='km-classroom-recordings-preview-v1';
const STORE='audio';

function database(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error('Stockage audio indisponible'));return}
  const request=indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Stockage audio indisponible'));
 });
}

async function transact(mode,operation){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const transaction=db.transaction(STORE,mode),request=operation(transaction.objectStore(STORE));
  let value;
  request.onsuccess=()=>{value=request.result};
  request.onerror=()=>reject(request.error||new Error('Enregistrement indisponible'));
  transaction.oncomplete=()=>resolve(value);
  transaction.onabort=()=>reject(transaction.error||new Error('Enregistrement indisponible'));
 })}finally{db.close()}
}

export function saveRecording(id,blob){return transact('readwrite',store=>store.put(blob,id))}
export function loadRecording(id){return transact('readonly',store=>store.get(id))}
