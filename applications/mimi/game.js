(()=>{
const c=document.querySelector('#game'),x=c.getContext('2d');
const A=['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
const bg=new Image(),mimi=new Image();bg.src='sky.jpg';mimi.src='mimi-flight.webp';
let mode='letters',play=false,over=false,y=300,vy=0,dist=0,score=0,best=0,time=20,index=0,timer=.8,items=[],last=performance.now(),msg='',msgLife=0;
const key=()=>`km-mimi-${mode}-best`;
function reset(){best=+(localStorage.getItem(key())||0);play=false;over=false;y=300;vy=0;dist=0;score=0;time=20;index=0;timer=.8;items=[];msg='';document.querySelector('#record').textContent=`Record ${best}`}
function choose(next){mode=next;document.querySelector('#normal').classList.toggle('active',mode==='normal');document.querySelector('#letters').classList.toggle('active',mode==='letters');reset()}
function tap(){if(over){reset();play=true}else if(!play){play=true;msg='GO !';msgLife=.7}vy=Math.max(vy-175,-350)}
function spawn(){const py=145+Math.random()*335;if(mode==='letters'){const good=Math.random()<.65;let n=(index+2+Math.floor(Math.random()*24))%A.length;if(n===index)n=(n+4)%A.length;items.push({x:410,y:py,type:good?'good':'bad',label:good?A[index]:A[n]})}else items.push({x:410,y:py,type:'bad',label:'✦'})}
function finish(){over=true;play=false;best=Math.max(best,score);localStorage.setItem(key(),best);document.querySelector('#record').textContent=`Record ${best}`}
function update(dt){
 msgLife=Math.max(0,msgLife-dt);if(!play)return;dist+=140*dt;
 if(mode==='letters'){time=Math.max(0,time-dt);if(time<=0)return finish()}else score=Math.floor(dist/12);
 vy+=510*dt;y+=vy*dt;if(y<70){y=70;vy=40}if(y>570)return finish();
 timer-=dt;if(timer<=0){spawn();timer=2.15}items.forEach(o=>o.x-=140*dt);
 for(const o of items){if(o.hit)continue;const hit=o.x+24>72&&o.x-24<132&&o.y+24>y+8&&o.y-24<y+66;if(!hit)continue;o.hit=true;if(mode==='normal')return finish();if(o.type==='good'){index++;score+=10;time+=5;msg=`${o.label} ✓  +5 s`;msgLife=1;if(index===A.length){index=0;score+=100;time+=10;msg='ALPHABET COMPLET !';msgLife=1.6}}else{time=Math.max(0,time-2);msg='MAUVAISE LETTRE  −2 s';msgLife=1;if(time<=0)return finish()}}
 items=items.filter(o=>!o.hit&&o.x>-50);
}
function box(px,py,w,h,r,fill,stroke){x.beginPath();x.roundRect(px,py,w,h,r);x.fillStyle=fill;x.fill();if(stroke){x.strokeStyle=stroke;x.lineWidth=3;x.stroke()}}
function drawWorld(){if(bg.complete){const s=640/bg.height,w=bg.width*s,off=(dist*.72)%w;x.drawImage(bg,-off,0,w,640);x.drawImage(bg,w-off,0,w,640)}else{x.fillStyle='#87d8ff';x.fillRect(0,0,360,640)}x.fillStyle='rgba(255,255,255,.1)';x.fillRect(0,0,360,640)}
function drawItems(){for(const o of items){if(o.hit)continue;const good=o.type==='good';box(o.x-25,o.y-25,50,50,16,good?'#fff3a8':'#ffd0dc','#242044');x.fillStyle=good?'#1f765e':'#b92f55';x.textAlign='center';x.font='900 31px Arial';x.fillText(o.label,o.x,o.y+11)}}
function label(text,cx,cy,size=12,color='#242044'){x.fillStyle=color;x.textAlign='center';x.font=`900 ${size}px Arial`;x.fillText(text,cx,cy)}
function draw(){drawWorld();drawItems();if(mimi.complete){const f=Math.floor(performance.now()/75)%8;x.drawImage(mimi,f*272,0,272,272,62,y-6,80,80)}box(10,10,104,50,14,'rgba(255,255,255,.94)','#242044');label(mode==='letters'?'PROCHAINE':'SCORE',62,28);label(mode==='letters'?A[index]:score,62,51,22);if(mode==='letters'){box(246,10,104,50,14,'rgba(255,255,255,.94)',time<6?'#d73352':'#242044');label('TEMPS',298,28,12,time<6?'#d73352':'#242044');label(`${Math.ceil(time)} s`,298,51,22,time<6?'#d73352':'#242044')}if(msgLife>0){box(50,112,260,48,15,'rgba(255,255,255,.94)','#ef80ad');label(msg,180,143,18,'#b53870')}if(!play){box(34,205,292,205,20,'rgba(255,255,255,.94)','#242044');label(over?'TERMINÉ !':'MIMI',180,250,31);label(mode==='letters'?'MODE LETTRES':'MODE NORMAL',180,280,14,'#d85c95');label(over?`Score : ${score}`:'TOUCHE POUR JOUER',180,325,18);label(mode==='letters'?'Bonne lettre +5 s · mauvaise −2 s':'Évite les obstacles en volant',180,360,12);if(over)label('Touche pour recommencer',180,389,12)}}
function loop(now){const dt=Math.min((now-last)/1000,.034);last=now;update(dt);draw();requestAnimationFrame(loop)}
document.querySelector('#normal').onclick=()=>choose('normal');document.querySelector('#letters').onclick=()=>choose('letters');document.querySelector('#frame').onpointerdown=e=>{e.preventDefault();tap()};addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();tap()}});reset();requestAnimationFrame(loop);
})();
