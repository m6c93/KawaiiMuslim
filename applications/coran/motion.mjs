// Decorative illustrations only; Quran text and controls never move.
export function mountParallax(root) {
  const scenes=[...root.querySelectorAll('[data-parallax-scene]')];
  if(!scenes.length)return()=>{};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0;
  function paint(){
    frame=0;
    for(const scene of scenes){
      const box=scene.getBoundingClientRect();
      const offset=innerHeight*.45-(box.top+box.height/2);
      const limit=innerWidth<600?12:32;
      for(const layer of scene.querySelectorAll('[data-depth]')){
        const y=reduced.matches?0:Math.max(-limit,Math.min(limit,offset*Number(layer.dataset.depth)));
        layer.style.setProperty('--parallax-y',`${y.toFixed(2)}px`);
      }
    }
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(paint)}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  reduced.addEventListener('change',schedule);
  schedule();
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule)};
}
