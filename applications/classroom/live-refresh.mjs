// Refresh only visible, connected sessions; serialize requests and back off on failure.
export function startLiveRefresh(refresh,{interval=5000,maxDelay=60000,win=window,doc=document,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let stopped=false,running=false,timer=null,delay=interval;
 const available=()=>!doc.hidden&&win.navigator?.onLine!==false;
 async function tick(){
  if(stopped||running)return;
  clearTimer(timer);
  if(!available()){timer=null;return}
  running=true;
  try{const ok=await refresh();delay=ok===false?Math.min(maxDelay,delay*2):interval}
  catch{delay=Math.min(maxDelay,delay*2)}
  finally{running=false;if(!stopped&&available())timer=setTimer(tick,delay)}
 }
 const wake=()=>{if(available())void tick();else{clearTimer(timer);timer=null}};
 doc.addEventListener('visibilitychange',wake);
 win.addEventListener('online',wake);win.addEventListener('offline',wake);win.addEventListener('focus',wake);
 timer=setTimer(tick,interval);
 return ()=>{stopped=true;clearTimer(timer);doc.removeEventListener('visibilitychange',wake);for(const event of ['online','offline','focus'])win.removeEventListener(event,wake)};
}