(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const guest = params.get('guest') === '1' || sessionStorage.getItem('km-guest-mode') === '1';
  const library = '/Bibliotheque%20Kawaii%20Muslim.dc.html?guest=1';
  const routes = {
    '/books/tawakkul.html':'/books/tawakkul-decouverte.html',
    '/books/miracles-du-coran.html':'/books/miracles-decouverte.html',
    '/books/hijabi-girls.html':'/books/hijabi-decouverte.html'
  };
  function openUnlock() {
    let sheet = document.getElementById('km-discovery-unlock');
    if (!sheet) {
      sheet = document.createElement('dialog'); sheet.id = 'km-discovery-unlock';
      sheet.setAttribute('aria-labelledby','km-unlock-title');
      sheet.innerHTML = `<button class="km-unlock-close" aria-label="Fermer">×</button><div class="km-unlock-content"><p class="km-unlock-tag">Espace parents</p><h2 id="km-unlock-title">La découverte continue…</h2><p>Des histoires à partager, des activités pour apprendre et de beaux moments en famille.</p><ul><li>Les livres et leurs histoires complètes</li><li>Tous les coloriages et l’atelier créatif</li><li>Les invocations et les activités éducatives</li></ul><p class="km-unlock-price">À partir de <strong>4,99 € / mois</strong><br><small>Pour 1 enfant · consulte les formules et leurs conditions.</small></p></div><div class="km-unlock-actions"><a class="km-unlock-primary" href="/Compte.dc.html?abonnement=requis">Voir l’accès complet</a><button class="km-unlock-continue">Continuer la découverte</button></div>`;
      document.body.appendChild(sheet);
      sheet.querySelector('.km-unlock-close').onclick = sheet.querySelector('.km-unlock-continue').onclick = () => sheet.close();
      sheet.addEventListener('click', e => { if(e.target === sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)sheet.close();} });
    }
    if(!sheet.open) sheet.showModal();
  }
  window.KMDiscovery = {openUnlock};
  function mount() {
    const style=document.createElement('style');style.textContent=`
    #km-discovery-unlock{box-sizing:border-box;width:calc(100% - 28px);max-width:460px;max-height:90dvh;overflow:auto;border:1px solid #edd4e3;border-radius:28px;background:#fff8ee;color:#49335f;padding:32px 24px 20px;font:16px/1.5 Nunito,system-ui;text-align:center}
    #km-discovery-unlock::backdrop{background:#34223c88}#km-discovery-unlock h2{font:800 29px/1.1 'Baloo 2',system-ui;margin:8px 0 16px}.km-unlock-tag{font-size:12px;color:#965081;font-weight:800}.km-unlock-close{position:absolute;right:8px;top:8px;border:0;background:transparent;color:#49335f;font-size:28px;width:44px;height:44px}#km-discovery-unlock ul{text-align:left;padding-left:22px;font-size:14px}#km-discovery-unlock li{margin:8px 0}.km-unlock-price{padding:16px 0;border-top:1px solid #efdce5}.km-unlock-price small{font-size:12px}.km-unlock-primary,.km-discovery-entry{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:16px;padding:6px 16px;background:linear-gradient(110deg,#c64d8e,#a654a3);color:white;text-decoration:none;font-weight:800}.km-unlock-continue{display:block;margin:10px auto 0;min-height:44px;border:0;background:transparent;color:#80527c;font-weight:800}.km-discovery-entry{order:12;margin-top:16px;background:#fff0f5;color:#965081;border:1px solid #e9bfd6}.km-discovery-note{order:13;text-align:center;color:#806c86;font:12px/1.4 system-ui;margin:8px 0}

    #km-discovery-unlock{position:fixed!important;inset:0!important;margin:auto!important;width:calc(100% - 32px);max-width:520px;max-height:calc(100dvh - 32px);padding:28px 20px 16px;overflow:hidden}
    #km-discovery-unlock[open]{display:flex;flex-direction:column;gap:12px}
    #km-discovery-unlock .km-unlock-content{min-height:0;overflow:auto;overscroll-behavior:contain;padding-top:8px}
    #km-discovery-unlock .km-unlock-actions{flex:none;padding-top:12px;border-top:1px solid #efdce5}
    #km-discovery-unlock .km-unlock-close{z-index:2;flex:none;background:#fff8ee;border-radius:50%}
    #km-discovery-unlock .km-unlock-primary{box-sizing:border-box;min-height:48px}
    #km-discovery-unlock .km-unlock-continue{margin:4px auto 0;min-height:44px}
    @media(max-height:560px){#km-discovery-unlock{max-width:min(620px,calc(100vw - 128px - var(--km-safe-left,0px) - var(--km-safe-right,0px)));padding:12px 18px;gap:6px}#km-discovery-unlock .km-unlock-tag{margin:0 0 4px}#km-discovery-unlock h2{font-size:22px;margin:4px 30px 8px}#km-discovery-unlock .km-unlock-content{font-size:13px;padding-top:0}#km-discovery-unlock ul{font-size:13px;margin:8px 0}#km-discovery-unlock li{margin:2px 0}#km-discovery-unlock .km-unlock-price{margin:8px 0 0;padding:6px 0 0}#km-discovery-unlock .km-unlock-actions{display:flex;align-items:center;gap:10px;padding-top:6px}#km-discovery-unlock .km-unlock-primary,#km-discovery-unlock .km-unlock-continue{flex:1;margin:0;font-size:13px}}
    `;document.head.appendChild(style);
    if(decodeURIComponent(location.pathname)==='/Connexion.dc.html'){
      const form=document.getElementById('loginForm');
      if(form&&!document.getElementById('km-discovery-entry')){
        const link=document.createElement('a');link.id='km-discovery-entry';link.className='km-discovery-entry';link.href=library;link.textContent='Découvrir gratuitement';form.appendChild(link);
        const note=document.createElement('p');note.className='km-discovery-note';note.textContent='Sans compte · quelques livres, coloriages et invocations offerts';link.after(note);
      }
    }
    if(!guest)return;
    if(decodeURIComponent(location.pathname)==='/Coloriage.dc.html'){
      document.body.classList.add('discovery-coloring');
      const editorStyle=document.createElement('style');editorStyle.textContent=`
      body.discovery-coloring,body.discovery-coloring .workspace{background:#fff8ee;color:#49335f}body.discovery-coloring .topbar{background:#fff8ee;color:#49335f;border-color:#ead4e3;display:flex;align-items:center;flex-wrap:nowrap;padding:8px;gap:6px}body.discovery-coloring .topbar .title{flex:1;min-width:0}body.discovery-coloring .title strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.discovery-coloring .title small{display:none}body.discovery-coloring .top-actions{display:flex;gap:4px;flex-wrap:nowrap}body.discovery-coloring #compareButton,body.discovery-coloring #printButton,body.discovery-coloring #saveButton{display:none}body.discovery-coloring .action,body.discovery-coloring #backAction{background:#fff0f5;color:#80527c;border-color:#e4c6dd;min-width:42px;min-height:44px;padding:8px}body.discovery-coloring .tools{background:#fff8ee;border-color:#ecdce7}body.discovery-coloring .zoom button,body.discovery-coloring .tool{background:#f2e4ee;color:#80527c;border-color:#e4c6dd}body.discovery-coloring #finishButton{background:#bb589d;color:white}body.discovery-coloring .zoom{background:#fff8eecc;color:#49335f}
      `;document.head.appendChild(editorStyle);
      for(const [id,label] of [['undoButton','Annuler le dernier trait'],['redoButton','Rétablir le dernier trait']]){const b=document.getElementById(id);if(b){b.setAttribute('aria-label',label);b.textContent=id==='undoButton'?'↶':'↷';}}
    }
    document.addEventListener('click',e=>{
      const link=e.target.closest('a[href]');if(!link)return;
      const u=new URL(link.href,location.href);if(u.origin!==location.origin)return;
      const path=decodeURIComponent(u.pathname);
      if(routes[path]){e.preventDefault();e.stopImmediatePropagation();location.href=routes[path]+'?guest=1';}
      else if(path==='/LivreColoriage.dc.html'){e.preventDefault();e.stopImmediatePropagation();if(u.searchParams.get('book')==='hijabi-girls')location.href='/books/hijabi-decouverte.html?guest=1';else openUnlock();}
      else if(u.hash==='#tarifs'||link.classList.contains('km-guest-pill')){e.preventDefault();e.stopImmediatePropagation();openUnlock();}
      else if(path==='/books/colorie-ecris-apprends.html'||path.startsWith('/applications/coran')){e.preventDefault();e.stopImmediatePropagation();openUnlock();}
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
