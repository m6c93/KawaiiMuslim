import {esc} from './live-client.mjs';

const icon = (kind) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
 copy:'<rect x="8" y="8" width="12" height="13" rx="3"/><path d="M16 8V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 arrow:'<path d="M7 17 17 7M7 7h10v10"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>'
}[kind]}</svg>`;

/** The same invitation card is used by the real classroom and the isolated demo. */
export function showInviteLink({url,name='',expiresAt,demo=false,teacher=false}) {
 const previousFocus=document.activeElement;
 const dialog=document.createElement('dialog');
 dialog.className='cc-access-dialog';
 dialog.setAttribute('aria-labelledby','cc-access-title');
 dialog.setAttribute('aria-describedby','cc-access-description');
 const date=expiresAt?new Date(expiresAt):null;
 const expiry=date&&!Number.isNaN(date.getTime())?date.toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short'}):null;
 const title=teacher?'Votre espace vous suit.':`Le jardin de ${name} l’attend.`;
 const description=teacher?'Gardez ce lien pour retrouver votre espace professeur sur un autre appareil.':`Copiez ce lien et envoyez-le à l’élève ou à son parent. ${demo?'Son espace s’ouvre sans inscription.':'L’invitation est réservée à l’adresse e-mail indiquée.'}`;
 const deadline=teacher?'Votre accès professeur':demo?'Fin du compte d’essai':'Invitation valable';
 const expiryText=expiry?`Jusqu’au ${expiry}`:teacher?'Votre session de démonstration':'Pendant 7 jours';
 dialog.innerHTML=`
  <button class="cc-access-close" type="button" aria-label="Fermer">${icon('close')}</button>
  <div class="cc-access-banner" aria-hidden="true">
   <div class="cc-access-trees"><img src="/applications/coran/art/tree-seedling.png" alt=""><img src="/applications/coran/art/tree-apple.png" alt=""><img src="/applications/coran/art/tree-blossom.png" alt=""></div>
   <span class="cc-access-ready">${icon('check')} ${teacher?'À conserver':'Prêt à partager'}</span>
  </div>
  <div class="cc-access-body">
   <span class="cc-access-eyebrow">${teacher?'MON ESPACE PROFESSEUR':'UNE INVITATION À APPRENDRE'}</span>
   <h2 id="cc-access-title">${esc(title)}</h2>
   <p id="cc-access-description">${esc(description)}</p>
   <button class="cc-access-copy" type="button" autofocus>${icon('copy')} <span>Copier le lien${teacher?' professeur':''}</span></button>
   <p class="cc-access-status" role="status" aria-live="polite">À coller ensuite dans votre message.</p>
   ${teacher?'':`<a class="cc-access-open" href="${esc(url)}" target="_blank" rel="noopener">Voir l’espace élève ${icon('arrow')}</a>`}
   <div class="cc-access-expiry">${icon('clock')}<div><strong>${deadline}</strong><span>${esc(expiryText)}</span></div></div>
   ${demo&&!teacher?'<p class="cc-access-footnote">Jardin, messages et audios supprimés à cette date. Recopier le lien ne prolonge pas l’essai.</p>':''}
   ${teacher?'<p class="cc-access-footnote">Ce lien ouvre le côté professeur. Conservez-le pour vous.</p>':''}
   <details class="cc-access-details"><summary>Afficher le lien complet</summary><label>${teacher?'Lien professeur':'Lien élève'}<input type="text" readonly spellcheck="false" autocomplete="off" value="${esc(url)}"></label></details>
  </div>`;
 document.body.append(dialog);
 dialog.querySelector('.cc-access-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dialog.remove();if(previousFocus?.isConnected)previousFocus.focus()},{once:true});
 const input=dialog.querySelector('input'),copy=dialog.querySelector('.cc-access-copy'),status=dialog.querySelector('[role="status"]');
 input.onclick=()=>input.select();
 copy.onclick=async()=>{
  try{await navigator.clipboard.writeText(url);copy.innerHTML=`${icon('check')} <span>Lien copié !</span>`;copy.classList.add('is-copied');status.textContent='Collez-le dans votre message pour le transmettre.'}
  catch{dialog.querySelector('details').open=true;input.focus();input.select();status.textContent='Copiez le lien sélectionné, puis collez-le dans votre message.'}
 };
 dialog.showModal();
 return dialog;
}
