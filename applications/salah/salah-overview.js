(()=>{'use strict';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const simple={
 preparer:'Je me tiens debout, tourné vers la qibla.',
 takbir:'Je lève les mains et je dis « Allâhu akbar ».',
 mains:'Je pose ma main droite sur ma main gauche, sur la poitrine.',
 fatiha:'Debout, je récite Al-Fâtiha.',
 'courte-sourate':'Je récite ensuite une courte sourate, par exemple Al-Ikhlâs.',
 inclinaison:'Je dis « Allâhu akbar », puis je m’incline, les mains sur les genoux.',
 redressement:'Je me relève et je reste bien droit.',
 prosternation:'Je dis « Allâhu akbar », puis je pose le front et le nez au sol.',
 assise:'Je dis « Allâhu akbar », puis je m’assieds entre les deux prosternations.',
 'deuxieme-prosternation':'Je dis « Allâhu akbar » et je me prosterne une deuxième fois.',
 'raka-suivante':'Je dis « Allâhu akbar », je me relève et je place mes mains.',
 tachahhoud:'Je reste assis et je récite le tachahhoud.',
 'tachahhoud-final':'Je m’assieds pour le dernier tachahhoud.',
 salawat:'Toujours assis, je récite la prière sur le Prophète ﷺ.',
 protection:'Avant les salutations, je demande la protection d’Allah.',
 'salam-droite':'Je tourne la tête vers ma droite et je dis le salam.',
 'salam-gauche':'Puis je tourne la tête vers ma gauche et je dis le salam.'
};
const summaries=[
 'Je commence debout. Al-Fâtiha, une courte sourate, puis les mouvements.',
 'Je refais la même suite. Après les deux prosternations, je reste assis pour le premier tachahhoud.',
 'Je me relève. Je récite Al-Fâtiha, puis je fais les mouvements.',
 'Je récite Al-Fâtiha et je fais les mouvements. Puis je termine assis, avec les paroles et les deux salams.'
];
function groups(){const {items}=window.SalahPrayers.build('dhohr');return [1,2,3,4].map(r=>({rakah:r,summary:summaries[r-1],steps:items.map((d,index)=>({lesson:d,index})).filter(x=>x.lesson[7].rakah===r)}))}
function render(){return `<section class="prayer-overview" aria-labelledby="overviewTitle"><div class="overview-intro"><span class="eyebrow">AVANT DE COMMENCER · JE VOIS LE CHEMIN</span><h2 id="overviewTitle">Une prière de 4 rak‘as, en images</h2><p>Voici l’exemple de Dhohr, du début jusqu’au salam. Une rak‘a, c’est une unité de prière.</p><p class="note repetition-source">Pour les prosternations : 3 répétitions, selon Al-Albânî, rubrique « Les invocations de la prosternation ». <a href="https://shamela.org/gen/b79899caae08d0f7d3da286d2351b648_gen.pdf#page=32" target="_blank" rel="noopener">Voir le passage ↗</a></p><p class="overview-before">Avant de prier : mes ablutions sont faites, l’heure de la prière est entrée et j’ai l’intention de prier dans mon cœur.</p><p class="note">Tout est sur cette page. Touche une image pour apprendre le geste, les paroles et voir ses références.</p></div><nav class="overview-jumps" aria-label="Aller à une rak‘a">${[1,2,3,4].map(r=>`<button class="quiet" data-overview-jump="${r}">${r}<span>${r===1?'re':'e'} rak‘a</span></button>`).join('')}</nav>${groups().map(g=>`<section class="overview-rakah" id="overviewRakah${g.rakah}" aria-labelledby="overviewRakahTitle${g.rakah}" tabindex="-1"><div class="overview-rakah-head"><span class="rakah-number" aria-hidden="true">${g.rakah}</span><div><h3 id="overviewRakahTitle${g.rakah}">${g.rakah===1?'Première':g.rakah===2?'Deuxième':g.rakah===3?'Troisième':'Quatrième'} rak‘a</h3><p>${g.summary}</p></div></div><ol class="overview-grid">${g.steps.map(({lesson:d,index},i)=>{const id=d[4].id;const shortWords=d[5]&&!['tachahhoud','tachahhoud-final','salawat','protection'].includes(id);return `<li><button class="overview-card" data-overview-step="${index}" aria-label="${escape(`${g.rakah}${g.rakah===1?'re':'e'} rak‘a, étape ${i+1} : ${d[0]}. Voir le détail`)}"><span class="overview-image"><span class="overview-number">${i+1}</span><img src="art/${d[2]==='bow'?'bow-flat':d[2]}.webp" alt="" loading="lazy" decoding="async" width="180" height="240"></span><span class="overview-copy"><strong>${escape(d[0])}</strong><span>${simple[id]||escape(d[1])}</span>${shortWords?`<span class="overview-words">${escape(d[5][1])}${d[4].repetition?`<strong class="repetition-label">${escape(d[4].repetition.label)}</strong>`:''}</span>`:''}${id==='tachahhoud-final'?'<span class="overview-detail">Assise finale en tawarruk : voir le détail.</span>':''}</span></button></li>`}).join('')}</ol>${g.rakah<4?`<p class="overview-transition">↓ ${g.rakah===2?'Après le premier tachahhoud, je me relève pour la troisième rak‘a.':`Je passe à la ${g.rakah===1?'deuxième':'quatrième'} rak‘a.`}</p>`:'<p class="overview-complete">✓ Les deux salams terminent la prière.</p>'}</section>`).join('')}<div class="overview-end"><p>J’ai vu l’ensemble. Maintenant, je peux apprendre une étape à la fois.</p><button class="primary" id="overviewPractice">Apprendre Dhohr pas à pas →</button></div></section>`}
function bind(root,openStep){root.querySelectorAll('[data-overview-step]').forEach(b=>b.addEventListener('click',()=>openStep(Number(b.dataset.overviewStep))));root.querySelectorAll('[data-overview-jump]').forEach(b=>b.addEventListener('click',()=>{const group=root.querySelector('#overviewRakah'+b.dataset.overviewJump);group.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});group.focus({preventScroll:true})}));root.querySelector('#overviewPractice')?.addEventListener('click',()=>openStep(0))}
window.SalahOverview={render,bind,groups};
})();
