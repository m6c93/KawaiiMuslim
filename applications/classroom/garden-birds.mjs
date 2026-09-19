// Small, silent garden visitors. No timers, data writes or interaction targets.
const birdArt=`<svg viewBox="0 0 52 48" fill="none" aria-hidden="true" focusable="false">
 <g class="cc-bird-feet" stroke="#94734d" stroke-width="1.3" stroke-linecap="round"><path d="m25 35-1 7-4 1m4-1 3 1"/><path d="m33 35 1 7 4 1m-4-1-3 1"/></g>
 <path d="M17 30 3 23l4 12 15 1" fill="var(--bird-tail)" stroke="#647962" stroke-width=".7"/>
 <path d="M14 23c4-9 23-10 29 1 6 13-11 18-22 13-6-2-10-8-7-14Z" fill="var(--bird-body)" stroke="#817d614d" stroke-width=".8"/>
 <path d="M25 31c5 2 10 1 15-3-1 10-14 12-19 7Z" fill="var(--bird-belly)"/>
 <g class="cc-bird-head"><path d="M29 23c-5-4-3-14 5-16 9-2 15 4 14 12-1 6-10 11-19 4Z" fill="var(--bird-body)" stroke="#817d614d" stroke-width=".8"/>
 <path d="M35 21c5 1 7-2 10-3 0 7-8 10-12 7Z" fill="var(--bird-belly)"/>
 <path d="m46 17 6 3-7 2Z" fill="#c5a052"/>
 <circle cx="41.5" cy="15.3" r="1.6" fill="#33453e"/><circle cx="42" cy="14.8" r=".5" fill="#fffef0"/>
 <path d="m34 10 3-1" stroke="#fffdf5" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/></g>
 <g class="cc-bird-wing"><path d="M30 22C23 16 14 21 12 27c-2 8 12 10 21 3 2-2 1-6-3-8Z" fill="var(--bird-wing)" stroke="#68776170" stroke-width=".8"/>
 <path d="m17 27 9 2m-10 2 7 2" stroke="#fffceb" stroke-opacity=".45" stroke-width="1" stroke-linecap="round"/></g>
</svg>`;

const routes=[
 {points:[[.19,.72],[.34,.76],[.66,.57],[.53,.74]],duration:34000,phase:.06},
 {points:[[.75,.81],[.60,.83],[.34,.52],[.47,.60]],duration:39000,phase:.30},
 {points:[[.36,.39],[.49,.44],[.73,.68],[.70,.48]],duration:43000,phase:.59}
];

export function createGardenBirds(board){
 const layer=document.createElement('div');
 layer.className='cc-garden-birds';layer.setAttribute('aria-hidden','true');layer.inert=true;
 layer.innerHTML=routes.map((_,i)=>`<span class="cc-garden-bird cc-garden-bird-${i+1}"><span class="cc-bird-shadow"></span><span class="cc-bird-face"><span class="cc-bird-hop">${birdArt}</span></span></span>`).join('');
 board.prepend(layer);
 let active=false,destroyed=false,lastWidth=0,lastHeight=0;
 const groups=[];
 function motion(el,frames,duration,time){
  const a=el.animate(frames,{duration,iterations:Infinity,easing:'linear'});
  a.pause();a.currentTime=time;
  if(active)a.play();
  return a;
 }
 function refresh(){
  if(destroyed)return;
  const width=board.clientWidth,height=board.clientHeight;
  if(!width||!height||(width===lastWidth&&height===lastHeight))return;
  lastWidth=width;lastHeight=height;
  routes.forEach((route,i)=>{
   const el=layer.children[i],size=el.offsetWidth;
   const previous=groups[i],time=previous?.[0].currentTime??route.duration*route.phase;
   previous?.forEach(a=>a.cancel());
   const [a,b,c,d]=route.points.map(([x,y])=>({x:Math.max(size,Math.min(width-size,x*width))-size/2,y:Math.max(size,Math.min(height-size,y*height))-size}));
   const t=(p,lift=0)=>`translate(${p.x}px,${p.y-lift}px)`;
   const midway=(p,q)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
   const path=[{offset:0,transform:t(a)},{offset:.10,transform:t(a)},{offset:.25,transform:t(b)},{offset:.40,transform:t(b)},
    {offset:.46,transform:t(midway(b,c),28)},{offset:.52,transform:t(c)},{offset:.68,transform:t(c)},{offset:.82,transform:t(d)},
    {offset:.90,transform:t(d)},{offset:.95,transform:t(midway(d,a),24)},{offset:1,transform:t(a)}];
   const turn=(p,q)=>`scaleX(${q.x>=p.x?1:-1})`;
   const faces=[{offset:0,transform:turn(a,b)},{offset:.3999,transform:turn(a,b)},{offset:.40,transform:turn(b,c)},
    {offset:.6799,transform:turn(b,c)},{offset:.68,transform:turn(c,d)},{offset:.8999,transform:turn(c,d)},{offset:.90,transform:turn(d,a)},{offset:1,transform:turn(d,a)}];
   const hops=[{offset:0,transform:'translateY(0)'}],feet=[{offset:0,transform:'rotate(0deg)'}];
   for(const [start,end] of [[.10,.25],[.68,.82]]){
    hops.push({offset:start,transform:'translateY(0)'});feet.push({offset:start,transform:'rotate(0deg)'});
    for(let n=0;n<7;n++){
     const offset=start+(end-start)*(n+.5)/7,finish=start+(end-start)*(n+1)/7;
     hops.push({offset,transform:'translateY(-3px)'},{offset:finish,transform:'translateY(0)'});
     feet.push({offset,transform:`rotate(${n%2?10:-10}deg)`},{offset:finish,transform:'rotate(0deg)'});
    }
   }
   hops.push({offset:1,transform:'translateY(0)'});feet.push({offset:1,transform:'rotate(0deg)'});
   const wings=[{offset:0,transform:'rotate(0deg)'}];
   for(const [start,end] of [[.40,.52],[.90,1]]){
    wings.push({offset:start,transform:'rotate(0deg)'});
    for(let n=0;n<10;n++)wings.push({offset:start+(end-start)*(n+.5)/10,transform:'rotate(72deg) scaleY(.8)'},{offset:start+(end-start)*(n+1)/10,transform:'rotate(-12deg)'});
   }
   const head=[{offset:0,transform:'rotate(0deg)'}];
   for(const offset of [.04,.31,.58,.86])head.push({offset,transform:'rotate(0deg)'},{offset:offset+.012,transform:'rotate(15deg)'},{offset:offset+.028,transform:'rotate(0deg)'});
   head.push({offset:1,transform:'rotate(0deg)'});
   const shadow=[{offset:0,opacity:.16,transform:'scale(1)'},{offset:.40,opacity:.16,transform:'scale(1)'},{offset:.46,opacity:.07,transform:'scale(.65)'},{offset:.52,opacity:.16,transform:'scale(1)'},{offset:.90,opacity:.16,transform:'scale(1)'},{offset:.95,opacity:.07,transform:'scale(.65)'},{offset:1,opacity:.16,transform:'scale(1)'}];
   groups[i]=[[el,path],['.cc-bird-face',faces],['.cc-bird-hop',hops],['.cc-bird-feet',feet],['.cc-bird-wing',wings],['.cc-bird-head',head],['.cc-bird-shadow',shadow]].map(([target,frames])=>motion(typeof target==='string'?el.querySelector(target):target,frames,route.duration,time));
   if(width<=520&&i===2)groups[i].forEach(a=>a.pause());
  });
 }
 const resize=new ResizeObserver(refresh);resize.observe(board);refresh();
 return {
  setActive(value){
   if(destroyed||active===value)return;
   active=value;
   groups.forEach((animations,i)=>animations.forEach(a=>active&&(lastWidth>520||i<2)?a.play():a.pause()));
  },
  destroy(){destroyed=true;resize.disconnect();groups.flat().forEach(a=>a.cancel());layer.remove()}
 };
}
