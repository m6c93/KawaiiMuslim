(() => {
  'use strict';

  const card = document.querySelector('#weeklyDua');
  const dialog = document.querySelector('#duaPractice');
  const progress = window.KMDuaProgress;
  const activity = window.KMActivityProgress;
  if (!card || !dialog || !progress || !activity) return;

  const duaId = card.dataset.duaId || 'leaving';
  const audio = card.querySelector('audio');
  const homeStatus = card.querySelector('.dua-status');
  const train = card.querySelector('[data-train]');
  const outside = card.querySelector('[data-outside]');
  const slow = card.querySelector('#duaSlow');
  const homeListen = card.querySelector('[data-listen]');
  const stars = card.querySelector('[data-ritual-stars]');
  const homeConfidence = card.querySelector('[data-confidence]');
  const title = dialog.querySelector('#duaPracticeTitle');
  const coach = dialog.querySelector('.dua-coach');
  const words = dialog.querySelector('.dua-words');
  const reveal = dialog.querySelector('[data-reveal]');
  const listen = dialog.querySelector('[data-listen]');
  const listenedElsewhere = dialog.querySelector('[data-listened-elsewhere]');
  const audioLink = dialog.querySelector('[data-audio-link]');
  const previous = dialog.querySelector('#duaPrevious');
  const next = dialog.querySelector('[data-next]');
  const dialogStatus = dialog.querySelector('.dua-status');
  const dialogConfidence = dialog.querySelector('[data-dialog-confidence]');
  const confidenceButtons = [...document.querySelectorAll('#weeklyDua [data-confidence-choice], #duaPractice [data-confidence-choice]')];
  const listenButtons = [homeListen, listen];
  const bedtime = duaId === 'sleep';
  const goals = [
    { title: 'Je découvre les mots.', repeat: 'Répète doucement avec les mots. Tu peux demander de l’aide.' },
    { title: 'Je répète le début.', repeat: 'Répète d’abord le début, puis toute l’invocation avec de l’aide.' },
    { title: 'Je récite toute l’invocation.', repeat: 'Reprends toute l’invocation. Les mots et l’audio sont là pour t’aider.' },
    { title: 'Je comprends ce que je dis.', repeat: 'Relis le sens de l’invocation, puis répète les mots tranquillement.' },
    { title: 'J’essaie sans regarder.', repeat: 'Essaie de cacher les mots. Tu peux les retrouver dès que tu en as besoin.' },
    { title: 'Je la récite au bon moment.', repeat: bedtime ? 'Imagine que tu vas te coucher. Récite l’invocation doucement.' : 'Imagine que tu vas sortir de la maison. Récite l’invocation doucement.' },
    { title: 'Je reprends à mon rythme.', repeat: 'Récite toute l’invocation, avec ou sans aide. Prends ton temps.' }
  ];
  const dateLabel = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const isCurrent = () => !activity.isCurrent || activity.isCurrent();
  let snapshot = progress.read(duaId);
  let mode = null;
  let step = 0;
  let sessionDay = 1;
  let heard = false;
  let activeAudioButton = null;
  let audioTicket = 0;
  let launcher = null;
  let inactive = false;
  let refreshTimer = null;
  let completion = null;

  function focusTitle() {
    title.focus?.({ preventScroll: true });
  }

  function renderConfidence(value) {
    const labels = { help: 'Je la récite avec de l’aide', alone: 'Je peux la réciter seul' };
    card.querySelector('[data-confidence-label]').textContent = labels[value.confidence] || 'Comment je la récite';
    homeConfidence.hidden = !value.complete;
    confidenceButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.confidenceChoice === value.confidence));
    });
  }

  function renderHome() {
    snapshot = progress.read(duaId);
    const { count, day, todayDone, complete } = snapshot;
    card.dataset.trainingState = complete ? 'complete' : todayDone ? 'done-today' : 'learning';
    card.querySelector('[data-ritual-progress]').textContent = count + (count > 1 ? ' jours sur 7' : ' jour sur 7');
    stars.setAttribute('aria-label', count + (count > 1 ? ' étoiles acquises sur 7' : ' étoile acquise sur 7'));
    stars.querySelectorAll('[data-day]').forEach((star, index) => {
      const earned = index < count;
      const current = !complete && index === day - 1;
      star.classList.toggle('is-earned', earned);
      star.classList.toggle('is-current', current);
      star.setAttribute('aria-current', current ? 'step' : 'false');
      const savedDay = snapshot.days[index];
      const label = earned && savedDay ? 'Jour ' + (index + 1) + ', validé le ' + dateLabel.format(new Date(savedDay + 'T12:00:00Z')) : 'Jour ' + (index + 1) + ', à découvrir';
      star.setAttribute('aria-label', label);
    });
    card.querySelector('[data-training-label]').textContent = complete ? 'Tes 7 jours sont terminés' : todayDone ? 'Aujourd’hui, c’est fait' : 'Jour ' + day + ' sur 7';
    card.querySelector('[data-day-goal]').textContent = complete ? 'Continue à réviser, à ton rythme.' : goals[day - 1].title;
    card.querySelector('[data-ritual-note]').textContent = complete ? 'Tes étoiles sont gardées. Tu peux continuer à la réciter.' : 'À ton rythme. Tes étoiles restent, même si tu fais une pause.';
    train.textContent = complete ? 'Réviser l’invocation' : todayDone ? 'Réviser tranquillement' : count ? 'Mon entraînement' : 'Commencer mon entraînement';
    outside.hidden = complete || todayDone;
    train.disabled = !isCurrent();
    outside.disabled = !isCurrent();
    renderConfidence(snapshot);
  }

  function resetAudioButtons() {
    homeListen.textContent = 'Écouter';
    listen.textContent = mode === 'training' && step === 0 && !heard ? 'Écouter l’invocation' : 'Réécouter';
    listenButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
    card.classList.remove('is-playing');
    activeAudioButton = null;
  }

  function stopAudio() {
    audioTicket++;
    audio.pause();
    try { audio.currentTime = 0; } catch {}
    resetAudioButtons();
    homeStatus.textContent = '';
    dialogStatus.textContent = '';
  }

  function updateListenGate() {
    if (mode !== 'training' || step !== 0) return;
    next.hidden = !heard;
    next.disabled = !heard;
    listen.classList.toggle('main', !heard);
  }

  function audioFailure(button) {
    stopAudio();
    const inDialog = button === listen && dialog.open;
    const output = inDialog ? dialogStatus : homeStatus;
    output.textContent = 'L’audio n’a pas démarré. Tu peux réessayer ou ouvrir le fichier audio.';
    if (inDialog) {
      audioLink.hidden = false;
      listenedElsewhere.hidden = mode !== 'training' || step !== 0;
    }
  }

  listenButtons.forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.onclick = async () => {
      if (!isCurrent() || inactive || document.hidden || (button === listen && !dialog.open)) return;
      if (activeAudioButton === button) { stopAudio(); return; }
      stopAudio();
      const request = ++audioTicket;
      const output = button === listen ? dialogStatus : homeStatus;
      activeAudioButton = button;
      button.textContent = 'Arrêter l’écoute';
      button.setAttribute('aria-pressed', 'true');
      output.textContent = 'Chargement de l’audio…';
      audio.playbackRate = slow.checked ? 0.8 : 1;
      try {
        await audio.play();
        if (request !== audioTicket) return;
        card.classList.add('is-playing');
        output.textContent = 'Écoute tranquillement, jusqu’au bout.';
      } catch {
        if (request === audioTicket) audioFailure(button);
      }
    };
  });

  audio.addEventListener('ended', () => {
    const button = activeAudioButton;
    if (!button || inactive || document.hidden || !isCurrent()) return;
    const completedListening = button === listen && dialog.open && mode === 'training' && step === 0;
    stopAudio();
    if (completedListening) {
      heard = true;
      resetAudioButtons();
      updateListenGate();
      listenedElsewhere.hidden = true;
      audioLink.hidden = true;
      dialogStatus.textContent = 'À toi de répéter, sans te presser.';
    } else {
      (button === listen ? dialogStatus : homeStatus).textContent = 'Tu peux répéter ou réécouter à ton rythme.';
    }
  });
  audio.addEventListener('error', () => { if (activeAudioButton) audioFailure(activeAudioButton); });
  slow.onchange = () => { audio.playbackRate = slow.checked ? 0.8 : 1; };

  function setWordsVisible(visible) {
    words.hidden = !visible;
    reveal.textContent = visible ? 'Cacher les mots' : 'Afficher les mots';
    reveal.setAttribute('aria-expanded', String(visible));
    reveal.setAttribute('aria-pressed', String(visible));
  }

  function renderDialog(focus = true) {
    dialog.dataset.mode = mode;
    dialog.dataset.step = String(step);
    listen.hidden = true;
    listen.classList.remove('main');
    listenedElsewhere.hidden = true;
    audioLink.hidden = true;
    previous.hidden = true;
    reveal.hidden = true;
    words.hidden = true;
    dialogConfidence.hidden = true;
    next.hidden = false;
    next.disabled = false;
    dialogStatus.textContent = '';

    if (mode === 'training') {
      dialog.querySelector('.part').textContent = (snapshot.complete ? 'Révision' : 'Jour ' + sessionDay) + ' · Étape ' + (step + 1) + ' sur 3';
      title.textContent = ['Écoute l’invocation', 'À toi de répéter', 'Tu l’as récitée ?'][step];
      coach.textContent = step === 0 ? 'Écoute une fois jusqu’au bout. Tu répéteras ensuite.' : step === 1 ? goals[sessionDay - 1].repeat : 'Même avec les mots, l’audio ou un adulte, tu peux valider ta récitation.';
      listen.hidden = false;
      previous.hidden = step === 0;
      reveal.hidden = step === 0;
      setWordsVisible(step !== 2);
      next.textContent = ['À moi de répéter', 'J’ai répété', 'Oui, je l’ai récitée'][step];
      updateListenGate();
    } else if (mode === 'outside') {
      dialog.querySelector('.part').textContent = 'Mon entraînement';
      title.textContent = 'Tu l’as récitée aujourd’hui ?';
      coach.textContent = 'Avec ou sans aide, tu peux garder une étoile pour ta récitation d’aujourd’hui.';
      next.textContent = 'Oui, je l’ai récitée';
    } else if (mode === 'success') {
      const result = completion;
      dialog.querySelector('.part').textContent = snapshot.complete ? 'Mes 7 jours' : 'Mon entraînement';
      if (result.awarded && snapshot.complete) {
        title.textContent = '7 jours de pratique !';
        coach.textContent = 'Bravo pour ces moments d’apprentissage. Tu peux continuer à réviser.';
      } else if (result.awarded) {
        title.textContent = 'Ton étoile est enregistrée';
        coach.textContent = snapshot.count + (snapshot.count === 1 ? ' jour d’entraînement. ' : ' jours d’entraînement. ') + 'La suite t’attend dès demain.';
      } else {
        title.textContent = 'Bravo pour ta révision';
        coach.textContent = snapshot.complete ? 'Tu peux revoir l’invocation aussi souvent que tu veux.' : 'Ton étoile d’aujourd’hui est déjà gardée. La suite t’attend dès demain.';
      }
      dialogConfidence.hidden = !snapshot.complete;
      renderConfidence(snapshot);
      next.textContent = 'Terminer';
    }
    resetAudioButtons();
    if (focus) {
      dialog.scrollTop = 0;
      focusTitle();
    }
  }

  function openPractice(target, source) {
    if (inactive || !isCurrent() || dialog.open) return;
    stopAudio();
    renderHome();
    activity.remember('/Aujourd%27hui.dc.html#weeklyDua');
    launcher = source;
    mode = target;
    step = 0;
    sessionDay = snapshot.day;
    heard = false;
    completion = null;
    renderDialog(false);
    dialog.showModal();
    dialog.scrollTop = 0;
    focusTitle();
  }

  function saveRecitation() {
    const result = progress.complete(duaId, { source: mode === 'outside' ? 'outside' : 'guided' });
    renderHome();
    if (!result.saved) {
      dialogStatus.textContent = 'La progression n’a pas pu être enregistrée. Réessaie avant de fermer.';
      return;
    }
    completion = result;
    mode = 'success';
    renderDialog();
  }

  train.onclick = () => openPractice('training', train);
  outside.onclick = () => openPractice('outside', outside);
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    stopAudio();
    mode = null;
    renderHome();
    if (!inactive && isCurrent()) (launcher?.hidden || launcher?.disabled ? train : launcher)?.focus?.({ preventScroll: true });
  });
  dialog.addEventListener('cancel', stopAudio);
  reveal.onclick = () => { setWordsVisible(words.hidden); };
  listenedElsewhere.onclick = () => {
    if (!dialog.open || mode !== 'training' || step !== 0 || listenedElsewhere.hidden || !isCurrent()) return;
    stopAudio();
    heard = true;
    listenedElsewhere.hidden = true;
    audioLink.hidden = true;
    resetAudioButtons();
    updateListenGate();
    dialogStatus.textContent = 'À toi de répéter, sans te presser.';
  };
  previous.onclick = () => {
    if (!dialog.open || mode !== 'training' || step === 0) return;
    stopAudio();
    step--;
    renderDialog();
  };
  next.onclick = event => {
    if (!dialog.open || !isCurrent() || inactive || event?.detail > 1) return;
    if (mode === 'success') { dialog.close(); return; }
    if (mode === 'training' && step === 0 && !heard) return;
    stopAudio();
    if (mode === 'outside' || (mode === 'training' && step === 2)) saveRecitation();
    else if (mode === 'training') { step++; renderDialog(); }
  };

  confidenceButtons.forEach(button => {
    button.onclick = () => {
      if (!isCurrent() || !progress.read(duaId).complete) return;
      const result = progress.setConfidence(duaId, button.dataset.confidenceChoice);
      renderHome();
      renderConfidence(snapshot);
      const output = dialog.open ? dialogStatus : homeStatus;
      output.textContent = result.saved ? 'C’est enregistré. Tu peux changer ton choix quand tu veux.' : 'Ton choix n’a pas pu être enregistré. Réessaie.';
    };
  });

  function refresh() {
    if (!isCurrent()) {
      stopAudio();
      if (dialog.open) dialog.close();
    }
    renderHome();
  }
  function startRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (!document.hidden && !inactive) refresh(); }, 60000);
  }
  document.addEventListener('km-activity-restored', event => {
    if (event.detail?.key === progress.key || event.detail?.key === progress.legacyKey) refresh();
  });
  window.addEventListener('storage', event => {
    const key = activity.storage.logicalKey?.(event.key) || event.key;
    if (event.key === null || key === progress.key || key === progress.legacyKey || event.key === 'km-active-profile-v2') refresh();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); else refresh(); });
  document.addEventListener('km-app-inactive', () => {
    inactive = true;
    stopAudio();
    if (dialog.open) dialog.close();
  });
  document.addEventListener('km-app-active', () => { inactive = false; refresh(); });
  window.addEventListener('km-profile-selected', refresh);
  window.addEventListener('pagehide', () => { stopAudio(); clearInterval(refreshTimer); });
  window.addEventListener('pageshow', () => { refresh(); startRefresh(); });
  renderHome();
  resetAudioButtons();
  startRefresh();
})();
