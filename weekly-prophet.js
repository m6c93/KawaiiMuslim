(function () {
  'use strict';
  const names = ['Adam','Idris','Nuh','Hud','Salih','Ibrahim','Lut','Ismail','Ishaq','Yaqub','Yusuf','Ayyub','Shuayb','Musa','Harun','Dawud','Sulayman','Ilyas','Al-Yasa','Dhul-Kifl','Yunus','Zakariya','Yahya','Isa','Muhammad'];
  const lessons = ['Après une erreur, je peux demander pardon.','Je choisis la vérité et la patience.','Je persévère dans le bien.','Je reste humble.','Je prends soin de ce qui m’entoure.','Ma foi se voit aussi dans mes actions.','Je choisis de faire le bien.','Je tiens mes promesses.','Je remercie Allah pour Ses bienfaits.','Je garde confiance en Allah.','Je pardonne et je fais le bien.','Je peux demander de l’aide quand je souffre.','Je suis honnête et juste.','Je trouve le courage de parler avec douceur.','Je peux aider les autres.','Je remercie Allah et je fais le bien.','Je remercie Allah pour Ses bienfaits.','Je reste fidèle à Allah.','Je suis l’exemple des gens vertueux.','Je m’entraîne à être patient.','Je reconnais mes erreurs.','Je demande à Allah avec confiance.','Je respecte mes parents.','Je fais preuve de bonté.','Je suis le bel exemple du Prophète.'];
  function indexForDate(now) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now || new Date());
    const value = type => Number(parts.find(p => p.type === type).value);
    const day = Date.UTC(value('year'), value('month')-1, value('day'));
    const weeks = Math.floor((day - Date.UTC(2026,9,12)) / (7 * 86400000));
    return ((weeks % names.length) + names.length) % names.length;
  }
  window.KMWeeklyProphet = {indexForDate,names,lessons};
  function refresh() {
    const card = document.getElementById('weeklyProphet');
    if (!card) return;
    const i=indexForDate();
    card.querySelector('[data-prophet-name]').textContent=names[i];
    card.querySelector('[data-prophet-title]').src='./prophetes/assets/title-'+i+'.webp';
    card.querySelector('[data-prophet-title]').alt=names[i]+' — Que la paix soit sur lui';
    card.querySelector('[data-prophet-art]').src='./prophetes/assets/art-'+i+'.webp';
    card.querySelector('[data-prophet-lesson]').textContent=lessons[i];
    card.querySelector('[data-prophet-link]').href='./prophetes/?prophet='+i;
  }
  refresh();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  setInterval(refresh,60000);
})();
