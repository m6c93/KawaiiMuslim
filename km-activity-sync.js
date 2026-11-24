(() => {
  'use strict';
  const progress = window.KMActivityProgress;
  if (!progress?.scope?.startsWith('child:')) return;
  const childId = progress.scope.slice(6);
  const storage = progress.storage;
  const arrayKeys = new Set(['kmw-aya-chansons-v1','kmw-aya-premium-stamps','kmw-dua-sleep-ritual-v1']);
  const objectKeys = new Set(['kmw-salah-v1','kmw-salah-journal-v1','kmw-salah-session-v2','kmw-salah-surahs-v1',
    'kmw-salah-inline-position','kmw-salah-learn-position','kmw-weekly-dua-preview-v1']);
  const week = /^kmw-dua-sleep-week-\d{12,14}$/;
  const supported = key => arrayKeys.has(key) || objectKeys.has(key) || week.test(key);
  const equal = (first,second) => {
    if (first === second) return true;
    if (!first || !second || typeof first !== 'object' || typeof second !== 'object') return false;
    const keys=Object.keys(first);
    return Array.isArray(first)===Array.isArray(second) && keys.length===Object.keys(second).length &&
      keys.every(key=>Object.hasOwn(second,key) && equal(first[key],second[key]));
  };
  function merge(key,base,local,remote,path='') {
    if (equal(base,local)) return remote;
    if (equal(base,remote) || remote == null) return local;
    if (local == null) return local; // A deliberate clear stays a clear.
    if (Array.isArray(local) && Array.isArray(remote)) return [...new Set([...remote,...local])];
    if (week.test(key) || path.endsWith('/tries') || path.startsWith('/practices/')) {
      return Number(remote) + Math.max(0, Number(local) - Number(base || 0));
    }
    if (path.endsWith('/lastSeen') || path.endsWith('/lastTried')) return Math.max(Number(remote),Number(local));
    // A resumed prayer is a single position; its mode and step must travel together.
    if (key==='kmw-salah-session-v2') return local;
    if (typeof local==='object' && typeof remote==='object') {
      const result=Object.create(null);
      for(const field of new Set([...Object.keys(remote),...Object.keys(local),...Object.keys(base||{})])) {
        if (field==='__proto__' || field==='prototype' || field==='constructor') continue;
        const value=merge(key,base?.[field],local[field],remote[field],path+'/'+field);
        if (value !== undefined) result[field]=value;
      }
      return result;
    }
    return local;
  }
  function read(key) { return JSON.parse(storage.getItem(key) || 'null'); }
  const metaKey = key=>'sync:'+key;
  const metadata = key=>read(metaKey(key)) || {revision:0,state:null};
  function saveMerged(key,base,local,remote) {
    const merged=merge(key,base,local,remote);
    if (!equal(merged,local)) {
      storage.applyRemote(key,merged);
      document.dispatchEvent(new CustomEvent('km-activity-restored',{detail:{key,value:merged}}));
    }
    return merged;
  }
  function loadScript(source) {
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=source; script.onload=resolve; script.onerror=()=>{script.remove();reject(new Error('Offline'));};
      document.head.append(script);
    });
  }
  let client;
  async function connection() {
    if (!client) {
      if (window.KMAuth?.client) client=window.KMAuth.client();
      else if (window.AyaPremium?.client) client=await window.AyaPremium.client();
      else {
        if (!window.KM_CONFIG) await loadScript('/km-config.js');
        if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        client=window.supabase.createClient(KM_CONFIG.supabaseUrl,KM_CONFIG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
      }
    }
    const response=await client.auth.getSession();
    return response.data?.session && progress.isCurrent() ? client : null;
  }
  const pending=new Set();
  let needsRefresh=true, running=false, timer, retry=1500, unavailable=false;
  function schedule(ms=600) {
    clearTimeout(timer);
    if (!running && !unavailable && progress.isCurrent()) timer=setTimeout(sync,ms);
  }
  function refresh() { if(!document.hidden){needsRefresh=true;unavailable=false;schedule(80);} }
  async function send(db,key) {
    // Persist the exact request before transmission. A lost success reply can be replayed safely.
    for(let round=0;round<4 && progress.isCurrent();round++) {
      const meta=metadata(key),local=read(key);
      if (!meta.pending && equal(meta.state,local)) return true;
      const attempt=meta.pending || {id:crypto.randomUUID(),state:local};
      if (!meta.pending) storage.setItem(metaKey(key),JSON.stringify({...meta,pending:attempt}));
      const {data,error}=await db.rpc('save_child_activity_progress',{p_child_id:childId,p_key:key,
        p_revision:meta.revision,p_state:attempt.state,p_operation_id:attempt.id});
      if (error) throw error;
      if (!progress.isCurrent()) return true;
      if (metadata(key).pending?.id!==attempt.id) return false; // Another tab already processed this reply.
      const latest=read(key);
      const merged=saveMerged(key,data.applied?attempt.state:meta.state,latest,data.state);
      storage.setItem(metaKey(key),JSON.stringify({revision:data.revision,state:data.state}));
      if (equal(merged,data.state)) return true;
    }
    return false;
  }
  async function sync() {
    if (running || unavailable || !progress.isCurrent()) return;
    running=true;
    try {
      const db=await connection(); if (!db) {retry=60000;return;}
      if (needsRefresh) {
        const {data,error}=await db.from('child_activity_progress').select('progress_key,state,revision').eq('child_profile_id',childId);
        if(error) throw error;
        if (!progress.isCurrent()) return;
        needsRefresh=false;
        for(const row of data||[]) {
          const key=row.progress_key;if (!supported(key)) continue;
          const meta=metadata(key);
          if (!meta.pending && row.revision>meta.revision) {
            saveMerged(key,meta.state,read(key),row.state);
            storage.setItem(metaKey(key),JSON.stringify({revision:row.revision,state:row.state}));
          }
          pending.add(key);
        }
        for(const key of storage.keys()) {
          if (supported(key)) pending.add(key);
          if (key.startsWith('sync:') && supported(key.slice(5))) pending.add(key.slice(5));
        }
      }
      for (const key of [...pending]) {
        if (await send(db,key)) pending.delete(key);
      }
      retry=1500;
    } catch (error) {
      unavailable=['42P01','42883','PGRST202','PGRST204','PGRST205'].includes(error?.code);
      retry=Math.min(120000,retry*2);
    } finally {
      running=false;
      if (needsRefresh || pending.size) schedule(retry);
    }
  }
  document.addEventListener('km-activity-write',event=>{
    if(supported(event.detail)){pending.add(event.detail);schedule();}
  });
  addEventListener('storage',event=>{
    const key=progress.storage.logicalKey(event.key);
    if(supported(key) && progress.isCurrent()){
      try {document.dispatchEvent(new CustomEvent('km-activity-restored',{detail:{key,value:read(key)}}));} catch {}
      pending.add(key);
      schedule();
    }
  });
  addEventListener('online',refresh);
  addEventListener('pageshow',refresh);
  document.addEventListener('visibilitychange',refresh);
  document.addEventListener('km-app-active',refresh);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',refresh,{once:true}); else refresh();
})();
