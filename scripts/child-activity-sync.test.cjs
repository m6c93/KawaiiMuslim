const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {randomUUID} = require('node:crypto');
const vm = require('node:vm');
const test = require('node:test');

const clientScripts = ['km-activity-progress.js','km-activity-sync.js'].map(path=>readFileSync(path,'utf8'));
const stickers = 'kmw-aya-premium-stamps';
const journal = 'kmw-salah-journal-v1';
const ritual = 'kmw-dua-sleep-ritual-v1';
const weekly = 'kmw-dua-sleep-week-1795478400000';

function localStore() {
  const items = new Map();
  return {
    get length() { return items.size; },
    key: index => [...items.keys()][index],
    getItem: key => items.get(key) ?? null,
    setItem: (key,value) => items.set(key,String(value)),
    removeItem: key => items.delete(key)
  };
}

function database() {
  const rows = new Map();
  const receipts = new Set();
  const server = {
    reads: 0, writes: 0, available: true, loseReply: false,
    get(child,key) { return rows.get(child+':'+key)?.state ?? null; },
    auth: {getSession:async()=>({data:{session:{user:{id:'test-parent'}}}})},
    from(table) {
      assert.equal(table,'child_activity_progress');
      return { select(fields) {
        assert.equal(fields,'progress_key,state,revision');
        return { async eq(column,child) {
          assert.equal(column,'child_profile_id');
          server.reads++;
          if(server.beforeRead) await server.beforeRead();
          if(!server.available) return {error:{code:'PGRST205'}};
          return {data:structuredClone([...rows.values()].filter(x=>x.child===child))};
        }};
      }};
    },
    async rpc(name,{p_child_id:child,p_key:key,p_state:state,p_operation_id:id,p_revision:revision}) {
      assert.equal(name,'save_child_activity_progress');
      const slot=child+':'+key;
      const old=rows.get(slot) || {revision:0,state:null};
      if(receipts.has(id))return {data:{applied:true,revision:old.revision,state:structuredClone(old.state)}};
      if(revision!==old.revision)return {data:{applied:false,revision:old.revision,state:structuredClone(old.state)}};
      rows.set(slot,{child,progress_key:key,state:structuredClone(state),revision:revision+1});
      receipts.add(id);server.writes++;
      if(server.loseReply){ server.loseReply=false;throw new Error('Reply lost after commit'); }
      return {data:{applied:true,revision:revision+1,state:structuredClone(state)}};
    }
  };
  return server;
}

function device(server,child,{local=localStore(),guest=false}={}) {
  if(child) local.setItem('km-active-profile-v2',JSON.stringify({type:'child',id:child}));
  const timers=new Map();
  let next=0;
  const bus=new EventTarget();
  const document=new EventTarget();
  document.readyState='complete';document.hidden=false;
  const window={
    URL,URLSearchParams,CustomEvent,document,localStorage:local,sessionStorage:localStore(),
    location:new URL('https://example.test/applications/salah/'+(guest?'?guest=1':'')),
    crypto:{randomUUID},KMAuth:{client:()=>server},
    addEventListener:bus.addEventListener.bind(bus),
    setTimeout(callback){timers.set(++next,callback);return next;},clearTimeout(id){timers.delete(id);}
  };
  window.window=window;
  const context=vm.createContext(window);
  for(const code of clientScripts)vm.runInContext(code,context);
  const storage=window.KMActivityProgress.storage;
  return {
    local, document, storage,
    write(key,value){if(value===null)storage.removeItem(key);else storage.setItem(key,JSON.stringify(value));},
    read(key){return JSON.parse(storage.getItem(key));},
    wake(){bus.dispatchEvent(new Event('online'));},
    async tick(){const scheduled=[...timers.values()];timers.clear();await Promise.all(scheduled.map(fn=>fn()));},
    scheduled:()=>timers.size
  };
}

test('two devices combine earned stickers, dated rituals, sessions and prayer attempts, then restore them on a fresh screen',async()=>{
  const server=database(),a=device(server,'amal'),b=device(server,'amal');
  const restores=[];a.document.addEventListener('km-activity-restored',e=>restores.push(e.detail.key));
  a.write(journal,{stand:{tries:2,lastTried:30}});
  await a.tick();await b.tick();
  assert.deepEqual(b.read(journal),{stand:{tries:2,lastTried:30}});
  a.write(stickers,['alphabet']);b.write(stickers,['ecole']);
  a.write(ritual,['2026-11-23']);b.write(ritual,['2026-11-24']);
  a.write(weekly,1);b.write(weekly,1);
  a.write(journal,{stand:{tries:3,lastTried:50}});
  b.write(journal,{stand:{tries:3,lastTried:45},sit:{tries:1}});
  await a.tick();await b.tick();
  a.wake();await a.tick();
  assert.deepEqual(a.read(stickers),['alphabet','ecole']);
  assert.deepEqual(a.read(ritual),['2026-11-23','2026-11-24']);
  assert.equal(a.read(weekly),2);
  assert.deepEqual(a.read(journal),{stand:{tries:4,lastTried:50},sit:{tries:1}});
  assert.ok(restores.includes(stickers));
  const fresh=device(server,'amal');await fresh.tick();
  assert.deepEqual(fresh.read(journal),a.read(journal));
  const sibling=device(server,'nour');await sibling.tick();
  assert.equal(sibling.read(journal),null);assert.equal(sibling.read(stickers),null);
});

test('an accepted write with a lost reply replays after restart without doubling concurrent earned sessions',async()=>{
  const server=database(),a=device(server,'amal'),b=device(server,'amal');
  a.write(weekly,5);await a.tick();await b.tick();
  server.loseReply=true;
  a.write(weekly,6);await a.tick();
  assert.equal(server.get('amal',weekly),6);
  a.write(weekly,7); // Unsynced work since the lost reply.
  b.write(weekly,6);await b.tick();
  assert.equal(server.get('amal',weekly),7);
  const reopened=device(server,'amal',{local:a.local});
  await reopened.tick();
  assert.equal(server.get('amal',weekly),8);
  assert.equal(reopened.read(weekly),8);
  assert.equal(server.writes,4);
  reopened.write('kmw-salah-session-v2',{mode:'water',step:2});await reopened.tick();
  b.wake();await b.tick();assert.deepEqual(b.read('kmw-salah-session-v2'),{mode:'water',step:2});
  reopened.write('kmw-salah-session-v2',null);await reopened.tick();
  b.wake();await b.tick();assert.equal(b.read('kmw-salah-session-v2'),null);
});

test('weekly invocation changes keep separate histories while merging concurrent recitations and rituals',async()=>{
  const key='kmw-weekly-dua-preview-v1', week='1795478400000';
  const server=database(),a=device(server,'amal'),b=device(server,'amal');
  a.write(key,{learned:['sleep'],practices:{sleep:3}});await a.tick();await b.tick();
  a.write(key,{learned:['sleep','leaving'],practices:{sleep:3,leaving:1},ritualDays:{leaving:['2026-11-26']},weeklySessions:{leaving:{[week]:{tries:1}}}});
  b.write(key,{learned:['sleep'],practices:{sleep:3,leaving:1},ritualDays:{leaving:['2026-11-27']},weeklySessions:{leaving:{[week]:{tries:1}}}});
  await a.tick();await b.tick();a.wake();await a.tick();
  const restored=a.read(key);
  assert.deepEqual(restored.learned,['sleep','leaving']);
  assert.deepEqual(restored.practices,{sleep:3,leaving:2});
  assert.deepEqual(restored.ritualDays.leaving,['2026-11-26','2026-11-27']);
  assert.equal(restored.weeklySessions.leaving[week].tries,2);
});

test('missing schema keeps local progress; a future connection sends it, guest mode never queries it',async()=>{
  const server=database();server.available=false;
  const a=device(server,'amal');
  a.write(stickers,['ecole']);await a.tick();
  assert.deepEqual(a.read(stickers),['ecole']);assert.equal(server.writes,0);assert.equal(a.scheduled(),0);
  server.available=true;a.wake();await a.tick();
  assert.deepEqual(server.get('amal',stickers),['ecole']);
  const reads=server.reads,guest=device(server,'amal',{local:a.local,guest:true});
  guest.write(stickers,['colors']);guest.wake();await guest.tick();
  assert.equal(server.reads,reads);assert.deepEqual(server.get('amal',stickers),['ecole']);
  assert.deepEqual(a.read(stickers),['ecole']);
});

test('a reply arriving after a profile switch cannot render or write data into the newly active profile',async()=>{
  const server=database(),source=device(server,'amal');source.write(stickers,['alphabet']);await source.tick();
  let unblock,started;const inFlight=new Promise(resolve=>started=resolve);
  server.beforeRead=()=>new Promise(resolve=>{unblock=resolve;started();});
  const a=device(server,'amal'),restored=[];a.document.addEventListener('km-activity-restored',e=>restored.push(e.detail));
  const pending=a.tick();await inFlight;
  const b=device(server,'nour',{local:a.local});unblock();await pending;
  delete server.beforeRead;await b.tick();assert.equal(b.read(stickers),null);assert.deepEqual(restored,[]);
});
