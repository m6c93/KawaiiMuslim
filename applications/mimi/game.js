(()=>{
const c=document.querySelector('#game'),x=c.getContext('2d');
const A=['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
const bg=new Image(),mimi=new Image(),run=new Image();bg.src='sky.jpg';mimi.src='mimi-flight.webp';run.src='mimi-run.webp';
const firstPlatforms=()=>[{x:-40,y:486,w:330},{x:360,y:448,w:210},{x:645,y:492,w:235},{x:955,y:408,w:220}];
let mode='letters',play=false,over=false,y=300,vy=0,ground=false,flaps=2,dist=0,score=0,best=0,time=20,index=0,timer=.8,items=[],platforms=firstPlatforms(),last=performance.now(),msg='',msgLife=0;
const key=()=>`km-mimi-${mode}-best`;
function reset(){best=+(localStorage.getItem(key())||0);play=false;over=false;y=mode==='normal'?416:300;vy=0;ground=mode==='normal';flaps=2;dist=0;score=0;time=20;index=0;timer=.8;items=[];platforms=firstPlatforms();msg='';document.querySelector('#record').textContent=`Record ${best}`}
function choose(next){mode=next;document.querySelector('#normal').classList.toggle('active',mode==='normal');document.querySelector('#letters').classList.toggle('active',mode==='letters');reset()}
function tap(){if(over){reset();play=true}else if(!play){play=true;msg='GO !';msgLife=.7}if(mode==='letters')vy=Math.max(vy-175,-350);else if(ground){ground=false;flaps=2;vy=-340}else if(flaps>0){flaps--;vy=Math.max(vy-125,-390)}}
function spawn(){const py=145+Math.random()*335;if(mode==='letters'){const good=Math.random()<.65;let n=(index+2+Math.floor(Math.random()*24))%A.length;if(n===index)n=(n+4)%A.length;items.push({x:410,y:py,type:good?'good':'bad',label:good?A[index]:A[n]})}else items.push({x:410,y:py,type:'bad',label:'✦'})}
function finish(){over=true;play=false;best=Math.max(best,score);localStorage.setItem(key(),best);document.querySelector('#record').textContent=`Record ${best}`}
function update(dt){
 msgLife=Math.max(0,msgLife-dt);if(!play)return;dist+=140*dt;
 if(mode==='letters'){time=Math.max(0,time-dt);if(time<=0)return finish();vy+=510*dt;y+=vy*dt;if(y<70){y=70;vy=40}if(y>570)return finish()}
 else{
  score=Math.floor(dist/12);platforms.forEach(p=>p.x-=140*dt);platforms=platforms.filter(p=>p.x+p.w>-60);
  const lastP=platforms[platforms.length-1];if(lastP.x+lastP.w<760){const levels=[405,448,486,510],ny=levels[Math.floor(Math.random()*levels.length)],gap=80+Math.random()*55;platforms.push({x:lastP.x+lastP.w+gap,y:ny,w:125+Math.random()*100})}
  if(ground){const support=platforms.find(p=>102>p.x&&82<p.x+p.w&&Math.abs(y+70-p.y)<15);if(support)y=support.y-70;else{ground=false;vy=20}}
  if(!ground){const oldBottom=y+70;vy+=800*dt;y+=vy*dt;if(vy>0){const landing=platforms.find(p=>132>p.x&&72<p.x+p.w&&oldBottom<=p.y+8&&y+70>=p.y);if(landing){y=landing.y-70;vy=0;ground=true;flaps=2}}}if(y>650)return finish();if(y<45){y=45;vy=40}
 }
 timer-=dt;if(timer<=0){spawn();timer=2.15}items.forEach(o=>o.x-=140*dt);
 for(const o of items){if(o.hit)continue;const hit=o.x+24>72&&o.x-24<132&&o.y+24>y+8&&o.y-24<y+66;if(!hit)continue;o.hit=true;if(mode==='normal')return finish();if(o.type==='good'){index++;score+=10;time+=5;msg=`${o.label} ✓  +5 s`;msgLife=1;if(index===A.length){index=0;score+=100;time+=10;msg='ALPHABET COMPLET !';msgLife=1.6}}else{time=Math.max(0,time-2);msg='MAUVAISE LETTRE  −2 s';msgLife=1;if(time<=0)return finish()}}
 items=items.filter(o=>!o.hit&&o.x>-50);
}
function box(px,py,w,h,r,fill,stroke){x.beginPath();x.roundRect(px,py,w,h,r);x.fillStyle=fill;x.fill();if(stroke){x.strokeStyle=stroke;x.lineWidth=3;x.stroke()}}
function drawWorld(){if(bg.complete){const s=640/bg.height,w=bg.width*s,off=(dist*.72)%w;x.drawImage(bg,-off,0,w,640);x.drawImage(bg,w-off,0,w,640)}else{x.fillStyle='#87d8ff';x.fillRect(0,0,360,640)}x.fillStyle='rgba(255,255,255,.1)';x.fillRect(0,0,360,640)}
function drawItems(){for(const o of items){if(o.hit)continue;const good=o.type==='good';box(o.x-25,o.y-25,50,50,16,good?'#fff3a8':'#ffd0dc','#242044');x.fillStyle=good?'#1f765e':'#b92f55';x.textAlign='center';x.font='900 31px Arial';x.fillText(o.label,o.x,o.y+11)}}
function drawNormal(){const colors=['#f3aac4','#98d1bd','#aebdf2','#f7c76d'];platforms.forEach((p,i)=>box(p.x,p.y,p.w,22,9,colors[i%4],'#242044'));x.save();x.strokeStyle='#493d76';x.lineCap='round';for(let i=0;i<15;i++){const yy=75+i*34,phase=(dist*.7+i*61)%260;x.globalAlpha=.12;x.beginPath();x.moveTo(360-phase,yy);x.lineTo(315-phase,yy);x.stroke()}x.restore()}
function label(text,cx,cy,size=12,color='#242044'){x.fillStyle=color;x.textAlign='center';x.font=`900 ${size}px Arial`;x.fillText(text,cx,cy)}
function draw(){drawWorld();if(mode==='normal')drawNormal();drawItems();const sprite=mode==='normal'&&ground?run:mimi;if(sprite.complete){const f=Math.floor(performance.now()/75)%8;x.drawImage(sprite,f*272,0,272,272,62,y-6,80,80)}box(10,10,104,50,14,'rgba(255,255,255,.94)','#242044');label(mode==='letters'?'PROCHAINE':'SCORE',62,28);label(mode==='letters'?A[index]:score,62,51,22);if(mode==='letters'){box(246,10,104,50,14,'rgba(255,255,255,.94)',time<6?'#d73352':'#242044');label('TEMPS',298,28,12,time<6?'#d73352':'#242044');label(`${Math.ceil(time)} s`,298,51,22,time<6?'#d73352':'#242044')}else{label(`AILES ${flaps}`,300,35,13)}if(msgLife>0){box(50,112,260,48,15,'rgba(255,255,255,.94)','#ef80ad');label(msg,180,143,18,'#b53870')}if(!play){box(34,205,292,205,20,'rgba(255,255,255,.94)','#242044');label(over?'TERMINÉ !':'MIMI',180,250,31);label(mode==='letters'?'MODE LETTRES':'MODE NORMAL',180,280,14,'#d85c95');label(over?`Score : ${score}`:'TOUCHE POUR JOUER',180,325,18);label(mode==='letters'?'Bonne lettre +5 s · mauvaise −2 s':'Cours, saute et vole entre les plateformes',180,360,12);if(over)label('Touche pour recommencer',180,389,12)}}
function loop(now){const dt=Math.min((now-last)/1000,.034);last=now;update(dt);draw();requestAnimationFrame(loop)}
document.querySelector('#normal').onclick=()=>choose('normal');document.querySelector('#letters').onclick=()=>choose('letters');document.querySelector('#frame').onpointerdown=e=>{e.preventDefault();tap()};addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();tap()}});reset();requestAnimationFrame(loop);
})();
