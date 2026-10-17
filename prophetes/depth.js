(()=>{'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const scenery=document.createElement('div');scenery.className='prophet-scenery';scenery.setAttribute('aria-hidden','true');document.body.prepend(scenery);
let frame=0,x=0,y=0,targetX=0,targetY=0,activeCard=null,enabled=!reduced.matches;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function paint(){
 frame=0;if(!enabled||document.hidden)return;
 x+=(targetX-x)*.13;y+=(targetY-y)*.13;
 const height=innerHeight||1,scrollDepth=clamp(scrollY*.035,0,42);
 scenery.style.setProperty('--scene-x',(-x*10).toFixed(2)+'px');
 scenery.style.setProperty('--scene-y',(-scrollDepth-y*9).toFixed(2)+'px');
 document.querySelectorAll('.story-tile,.original[open] img,.story-hero').forEach(card=>{
  if(!card.getClientRects().length)return;
  const rect=card.getBoundingClientRect();if(rect.bottom< -60||rect.top>height+60)return;
  // offsetTop is unaffected by the transform: no feedback during a scroll.
  const center=card.offsetTop+card.offsetHeight/2-scrollY;
  const scrollLift=clamp((height/2-center)/height,-.75,.75)*16;
  const hovered=card===activeCard;
  card.style.setProperty('--card-x',(x*(hovered?7:2)).toFixed(2)+'px');
  card.style.setProperty('--card-y',(scrollLift+y*(hovered?5:2)).toFixed(2)+'px');
  card.style.setProperty('--tilt-x',(hovered?-y*2.5:0).toFixed(2)+'deg');
  card.style.setProperty('--tilt-y',(hovered?x*3:0).toFixed(2)+'deg');
 });
 if(Math.abs(targetX-x)>.002||Math.abs(targetY-y)>.002)schedule();
}
function schedule(){if(enabled&&!frame)frame=requestAnimationFrame(paint)}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
document.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;targetX=clamp(event.clientX/innerWidth*2-1,-1,1);targetY=clamp(event.clientY/innerHeight*2-1,-1,1);activeCard=event.target.closest('.story-tile');schedule()},{passive:true});
document.addEventListener('pointerleave',()=>{targetX=targetY=0;activeCard=null;schedule()});
document.addEventListener('toggle',schedule,true);
document.addEventListener('load',schedule,true);
document.addEventListener('km-app-active',schedule);
document.addEventListener('km-app-inactive',()=>{if(frame)cancelAnimationFrame(frame);frame=0;targetX=targetY=x=y=0});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0}else schedule()});
reduced.addEventListener('change',()=>{enabled=!reduced.matches;if(!enabled&&frame){cancelAnimationFrame(frame);frame=0}else schedule()});
new MutationObserver(schedule).observe(document.querySelector('#story-grid'),{childList:true});
new MutationObserver(schedule).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open']});
schedule();
})();
