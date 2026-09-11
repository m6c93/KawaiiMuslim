// One persistent native element; no synthesized audio or guessed word timings.
export class QuranPlayer{
 constructor(audio,onState){this.audio=audio;this.onState=onState;this.queue=[];this.position=0;this.round=0;this.repeat=1;this.gap=false;this.timer=null;this.loadTimer=null;this.token=0;this.failedToken=-1;this.variant=0;this.state='idle';this.current=null;this.rate=1;
  audio.addEventListener('timeupdate',()=>this.emit());
  audio.addEventListener('ended',()=>this.ended());
  audio.addEventListener('error',()=>{if(['loading','playing'].includes(this.state))this.fail(this.token)});
  audio.addEventListener('waiting',()=>{if(!audio.paused&&this.current){this.state='loading';this.emit()}});
  audio.addEventListener('playing',()=>{if(this.current){clearTimeout(this.loadTimer);this.state='playing';this.emit()}});
 }
 emit(){this.onState({state:this.state,current:this.current,time:this.audio.currentTime||0,duration:Number.isFinite(this.audio.duration)?this.audio.duration:0,position:this.position,total:this.queue.length,round:this.round+1,repeat:this.repeat,passageRepeat:this.passageRepeat||1,passageRound:(this.passageRound||0)+1,rate:this.rate})}
 stop(){this.token++;clearTimeout(this.timer);clearTimeout(this.loadTimer);this.timer=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.current=null;this.state='idle';this.queue=[];this.emit()}
 start(queue,{repeat=1,gap=false,gapSeconds=null,passageRepeat=1}={}){this.stop();if(!queue.length)return;this.queue=queue;this.position=0;this.round=0;this.repeat=repeat;this.gap=gap;this.gapSeconds=gapSeconds;this.passageRepeat=passageRepeat;this.passageRound=0;this.load()}
 async load(fallback=false){const token=++this.token;clearTimeout(this.timer);clearTimeout(this.loadTimer);this.timer=null;if(!fallback)this.variant=0;this.current=this.queue[this.position];if(!this.current)return;this.state='loading';this.audio.src=[this.current.audio,...(this.current.audioSecondary||[])][this.variant];this.audio.playbackRate=this.rate;this.emit();this.loadTimer=setTimeout(()=>this.fail(token),15000);try{await this.audio.play();if(this.token===token){clearTimeout(this.loadTimer);this.state='playing';this.emit()}}catch(e){if(this.token===token){clearTimeout(this.loadTimer);if(e.name==='NotAllowedError'){this.state='paused';this.emit()}else this.fail(token)}}}
 fail(token){if(!this.current||token!==this.token||this.failedToken===token)return;this.failedToken=token;clearTimeout(this.loadTimer);if(this.variant<(this.current.audioSecondary||[]).length){this.variant++;this.load(true)}else{this.state='error';this.emit()}}
 ended(){const token=this.token;const advance=()=>{if(token!==this.token)return;if(this.round+1<this.repeat){this.round++;this.load()}else if(this.position+1<this.queue.length){this.round=0;this.position++;this.load()}else if(this.passageRound+1<this.passageRepeat){this.passageRound++;this.position=0;this.round=0;this.load()}else{this.state='ended';this.emit()}};
  const more=this.round+1<this.repeat||this.position+1<this.queue.length||this.passageRound+1<this.passageRepeat;
  if(this.gap&&more){this.state='gap';this.emit();this.timer=setTimeout(advance,this.gapSeconds===null?2000:Math.max(0,Math.min(30,this.gapSeconds))*1000)}else advance();
 }
 async toggle(){if(!this.current)return;if(['playing','loading','gap'].includes(this.state)){this.token++;clearTimeout(this.timer);clearTimeout(this.loadTimer);this.timer=null;this.audio.pause();this.state='paused';this.emit();return}if(['ended','error'].includes(this.state)||this.audio.ended){this.round=0;this.load();return}const token=++this.token;try{await this.audio.play();if(token===this.token){this.state='playing';this.emit()}}catch{if(token===this.token){this.state='error';this.emit()}}}
 move(delta){const pos=this.position+delta;if(pos<0||pos>=this.queue.length)return;this.audio.pause();this.position=pos;this.round=0;this.load()}
 seek(seconds){if(Number.isFinite(this.audio.duration))this.audio.currentTime=Math.max(0,Math.min(this.audio.duration,seconds))}
 setRate(value){if(![.75,1].includes(value))return;this.rate=value;this.audio.playbackRate=value;this.emit()}
}
