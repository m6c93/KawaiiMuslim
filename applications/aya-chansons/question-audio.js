(() => {
 'use strict';
 const voice=new Audio();let active=null;
 function stop(){voice.pause();voice.currentTime=0;active=null;}
 addEventListener('aya:leave',stop);addEventListener('pagehide',stop);
 function attach(root,key){
  stop();const button=root.querySelector('[data-question-audio]');if(!button)return;
  active=button;voice.src='media/questions/'+key+'.mp3?v=fr-ar-2';
  const play=()=>{voice.pause();voice.currentTime=0;button.textContent='🔊 Écouter la question';voice.play().catch(()=>{if(active===button)button.textContent='🔊 Toucher pour écouter';});};
  button.onclick=play;play();
 }
 window.AyaQuestionAudio={attach,stop};
})();
