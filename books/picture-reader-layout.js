const pictureReaderLayout = `
<div class="sky" aria-hidden="true"></div>
  <header class="topbar">
    <a class="home" href="/Bibliotheque%20Kawaii%20Muslim.dc.html" aria-label="Retour à la bibliothèque">⌂</a>
    <div class="title"><strong></strong><small>Livre interactif</small></div>
    <div class="actions">
      <button class="icon" id="gridBtn" type="button" aria-label="Voir toutes les pages" title="Toutes les pages">☷</button>
      <button class="icon" id="zoomBtn" type="button" aria-label="Agrandir la page" title="Agrandir">⌕</button><button class="icon" id="soundBtn" type="button" aria-label="Activer ou couper le son" title="Son">♪</button>
      <button class="icon" id="fullscreenBtn" type="button" aria-label="Plein écran" title="Plein écran">⛶</button>
    </div>
  </header>
  <main class="reader">
    <section class="book-shell" aria-live="polite">
      <button class="nav" id="prevBtn" type="button" aria-label="Page précédente">‹</button>
      <div class="book" id="book">
        <div class="cover-stage" id="coverStage">
          <div class="cover-image" role="img" aria-label="Couverture du livre"></div>
          <button class="open-book" id="openBtn" type="button" aria-label="Ouvrir le livre"><span>Ouvrir le livre</span><b>→</b></button>
        </div>
        <div class="spread" id="spread" hidden>
          <figure class="paper left-paper" id="leftPaper"><img id="leftPage" alt=""></figure>
          <div class="binding" aria-hidden="true"></div>
          <figure class="paper right-paper" id="rightPaper"><img id="rightPage" alt=""></figure>
        </div>
        <div class="turn-sheet" id="turnSheet" hidden aria-hidden="true">
          <div class="turn-face turn-front"><img id="turnFront" alt=""></div>
          <div class="turn-face turn-back"><img id="turnBack" alt=""></div>
        </div>
      </div>
      <button class="nav" id="nextBtn" type="button" aria-label="Page suivante">›</button>
    </section>
    <section class="mobile-page-controls" aria-label="Tourner les pages">
      <button id="mobilePrevBtn" type="button" aria-label="Page précédente"><span aria-hidden="true">←</span> Page précédente</button>
      <button id="mobileNextBtn" type="button" aria-label="Page suivante">Page suivante <span aria-hidden="true">→</span></button>
    </section>
    <section class="progress-wrap" aria-label="Progression dans le livre">
      <span id="pageLabel">Couverture</span>
      <input class="progress" id="progress" type="range" min="0" value="0" aria-label="Aller à une page">
      <span id="totalLabel"></span>
    </section>
    <p class="hint">Utilise les flèches ou glisse la page du doigt</p>
  </main>
  <aside class="rotate-notice" id="rotateNotice" role="status" aria-live="polite" hidden>
    <span class="rotate-icon" aria-hidden="true">↻</span>
    <div><strong>Tourne ton téléphone</strong><small>Pour mieux lire les deux pages, mets-le à l’horizontale.</small></div>
    <button id="rotateDismiss" type="button" aria-label="Fermer le conseil">D’accord</button>
  </aside>
  <aside class="drawer" id="drawer" aria-hidden="true">
    <div class="drawer-head"><div><small>SOMMAIRE VISUEL</small><h2>Toutes les pages</h2></div><button class="close" id="closeDrawer" type="button" aria-label="Fermer">×</button></div>
    <div class="thumbs" id="thumbs"></div>
  </aside>
  <div class="scrim" id="scrim" hidden></div>
`;
