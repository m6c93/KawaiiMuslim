(() => {
  'use strict';
  const config=JSON.parse(document.getElementById('discovery-data').textContent);
  const key='km-discovery-reading:'+config.id;
  const stage=document.getElementById('discovery-stage'),counter=document.getElementById('discovery-counter'),next=document.getElementById('discovery-next'),prev=document.getElementById('discovery-prev'),color=document.getElementById('discovery-color');
  let page=0;try{page=Math.max(0,Math.min(config.pages.length-1,Number(localStorage.getItem(key))||0));}catch{}
  function render(){
    stage.replaceChildren();const img=document.createElement('img');img.src=config.pages[page];img.alt=(config.coloring?'Coloriage':'Page')+' '+(page+1)+' · '+config.title;img.draggable=false;stage.appendChild(img);
    counter.textContent=(page+1)+' / '+config.pages.length+' '+(config.coloring?'coloriages offerts':'pages offertes');prev.disabled=page===0;next.textContent=page===config.pages.length-1?'Continuer →':'Suivant →';
    try{localStorage.setItem(key,String(page));}catch{}
  }
  function advance(){if(page===config.pages.length-1){window.KMDiscovery.openUnlock();return;}page++;render();}
  next.onclick=advance;prev.onclick=()=>{if(page){page--;render();}};
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(e.key==='ArrowRight')advance();if(e.key==='ArrowLeft'&&page){page--;render();}});
  let start=null;stage.addEventListener('pointerdown',e=>{start=[e.clientX,e.clientY];});stage.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start[0],dy=e.clientY-start[1];start=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){if(dx<0)advance();else if(page){page--;render();}}});
  if(config.coloring){color.hidden=false;color.onclick=()=>{const q=new URLSearchParams({guest:'1',src:'discovery-coloring:hijabi:'+String(page+1),title:'Hijabi Girls · Coloriage '+String(page+1),format:'image',return:'/books/hijabi-decouverte.html?guest=1'});location.href='/Coloriage.dc.html?'+q;};}
  render();
})();
