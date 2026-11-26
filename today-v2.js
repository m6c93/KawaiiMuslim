(function () {
  "use strict";

  var loading = document.getElementById("todayLoading");
  var profileName = document.getElementById("todayProfileName");
  var welcomeName = document.getElementById("todayWelcomeName");
  var avatar = document.getElementById("todayAvatar");
  var starBalance = document.getElementById("todayStarBalance");
  var starUnit = document.getElementById("todayStarUnit");
  var dateLabel = document.getElementById("todayDate");
  var prayerCard = document.getElementById("prayerCard");
  var prayerEyebrow = document.getElementById("prayerEyebrow");
  var prayerTitle = document.getElementById("prayerTitle");
  var prayerCityButton = document.getElementById("prayerCityButton");
  var prayerCityLabel = document.getElementById("prayerCityLabel");
  var prayerCityForm = document.getElementById("prayerCityForm");
  var prayerCityInput = document.getElementById("prayerCityInput");
  var prayerCityCancel = document.getElementById("prayerCityCancel");
  var prayerCitySubmit = document.getElementById("prayerCitySubmit");
  var prayerCitySuggestions = document.getElementById("prayerCitySuggestions");
  var prayerCitySearchStatus = document.getElementById("prayerCitySearchStatus");
  var prayerCityWorld = document.getElementById("prayerCityWorld");
  var prayerCityHelp = document.getElementById("prayerCityHelp");
  var prayerCityAttribution = document.getElementById("prayerCityAttribution");
  var prayerSource = document.getElementById("prayerSource");
  var prayerCalendar = document.getElementById("prayerCalendar");
  var prayerLocateButton = document.getElementById("prayerLocateButton");
  var prayerApproxButton = document.getElementById("prayerApproxButton");
  var prayerRetryButton = document.getElementById("prayerRetryButton");
  var prayerStatus = document.getElementById("prayerStatus");
  var prayerCountdown = document.getElementById("prayerCountdown");
  var prayerDone = document.getElementById("prayerDone");
  var prayerReward = document.getElementById("prayerReward");
  var activeChildId = "";
  var activeProfileKey = "family";
  var currentBalance = 0;
  var currentPrayer = null;
  var prayerRefreshTimer = 0;
  var prayerLocationTimer = 0;
  var prayerRequestId = 0;
  var prayerController = null;
  var prayerLocation = null;
  var prayerPending = false;
  var prayerEstimatePending = false;
  var prayerInitialized = false;
  var prayerStarted = false;
  var prayerAutomatic = false;
  var prayerEditing = false;
  var prayerLastLocated = 0;
  var prayerLastRequest = 0;
  var prayerCitySearchTimer = 0;
  var prayerCitySearchController = null;
  var prayerCitySearchId = 0;
  var prayerCityScope = "fr";
  var prayerCitySelection = null;
  var prayerCityChoices = [];
  var prayerSectionActive = !window.frameElement || window.frameElement.getAttribute("aria-hidden") !== "true";
  var prayerNames = { Fajr: "Fajr", Dhuhr: "Dhohr", Asr: "Asr", Maghrib: "Maghrib", Isha: "Icha" };

  function setDate() {
    if (!dateLabel) return;
    var formatted = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date());
    dateLabel.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function setProfile(name, avatarValue, stars) {
    var safeName = name || "Maman";
    var count = Number(stars) || 0;
    currentBalance = count;
    if (profileName) profileName.textContent = safeName;
    if (welcomeName) welcomeName.textContent = safeName;
    if (avatar) avatar.textContent = avatarValue || safeName.charAt(0).toLowerCase();
    if (starBalance) starBalance.textContent = count;
    if (starUnit) starUnit.textContent = " étoile" + (count > 1 ? "s" : "");
  }

  var latestBook = null;
  function renderRecent() {
    var panel = document.getElementById("recentSection");
    if (!panel || !window.KMActivityProgress) return;
    var recent = KMActivityProgress.recent();
    if (latestBook && (!recent || latestBook.time > recent.time)) recent = latestBook;
    panel.hidden = !recent;
    if (!recent) return;
    var link = document.getElementById("recentActivity");
    link.href = recent.href;
    link.querySelector("strong").textContent = recent.title;
  }
  async function restoreRecent(childId) {
    renderRecent();
    if (!childId || !window.KMActivityProgress) return;
    try {
      var rows = await KMAuth.listReadingProgress(childId);
      if (activeChildId !== childId) return;
      // Only built-in readers have a persistent URL derived from their database slug.
      var slugs = ['tawakkul','vers-allah','invocations-aya-ali','miracles-du-coran','aliments-dans-le-coran','animaux-du-coran','aya-armure-de-lumiere','bubble-tea-time-hijabi','hijabi-girls','exploration-espace','colorie-ecris-apprends'];
      var book = rows.find(row => row.child_profile_id === childId && slugs.includes(row.book_slug) && Number.isFinite(Date.parse(row.last_read_at)));
      latestBook = book ? {title:book.book_title || book.book_slug,href:'/books/'+book.book_slug+'.html'+(book.book_slug==='colorie-ecris-apprends'?'?from=library':''),time:Date.parse(book.last_read_at)} : null;
      renderRecent();
    } catch { /* The most recent activity on this device stays available offline. */ }
  }
  window.addEventListener('storage',renderRecent);
  window.addEventListener('pageshow',renderRecent);
  document.addEventListener('km-app-active',()=>restoreRecent(isLocalPreview() ? null : activeChildId));

  function prayerStorageKey() {
    return "km-prayer-city:" + activeProfileKey;
  }

  function prayerPreference(key, value) {
    try {
      if (value !== undefined) localStorage.setItem(key, value);
      return localStorage.getItem(key) || "";
    } catch (error) { return ""; }
  }

  function prayerMode(value) {
    var deviceMode = prayerPreference("km-prayer-location-mode:v1", value);
    var profileMode = prayerPreference("km-prayer-mode:" + activeProfileKey, value);
    return deviceMode || profileMode;
  }

  function savedPrayerPlace() {
    try {
      var place = JSON.parse(prayerPreference("km-prayer-place:v1"));
      if (!place || place.version !== 1 || place.kind !== "manual" || typeof place.label !== "string"
          || !place.label.trim() || place.label.length > 200 || typeof place.city !== "string") return null;
      if (place.latitude !== undefined || place.longitude !== undefined) {
        if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)
            || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return null;
      }
      return place;
    } catch (error) { return null; }
  }

  function savePrayerPlace(place) {
    // Only a deliberately chosen city is remembered. Device GPS is never saved.
    prayerPreference("km-prayer-place:v1", JSON.stringify(Object.assign({ version: 1 }, place)));
    prayerPreference(prayerStorageKey(), place.label);
    prayerMode("manual");
  }

  function cancelCitySearch() {
    clearTimeout(prayerCitySearchTimer);
    if (prayerCitySearchController) prayerCitySearchController.abort();
    prayerCitySearchController = null;
    prayerCitySearchId++;
    prayerCityChoices = [];
    if (prayerCitySuggestions) { prayerCitySuggestions.textContent = ""; prayerCitySuggestions.hidden = true; }
    if (prayerCitySearchStatus) prayerCitySearchStatus.textContent = "";
    if (prayerCityAttribution) prayerCityAttribution.hidden = true;
    if (prayerCityInput) prayerCityInput.setAttribute("aria-busy", "false");
  }

  function updateCityScope() {
    if (prayerCityWorld) prayerCityWorld.textContent = prayerCityScope === "fr" ? "Autres pays" : "Chercher en France";
    if (prayerCityHelp) prayerCityHelp.textContent = prayerCityScope === "fr"
      ? "Villes de France · accents et tirets facultatifs."
      : "Villes du monde · ajoute le pays si nécessaire.";
  }

  function usePrayerPlace(place) {
    // Catalogue choices are confirmed places. Free text must resolve before it
    // can replace the last saved city, including when suggestions are offline.
    if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) savePrayerPlace(place);
    prayerAutomatic = false;
    prayerEditing = false;
    prayerStarted = true;
    setCityEditor(false);
    loadPrayerTimes(place);
  }

  function choosePrayerCity(choice) {
    prayerCitySelection = {
      kind: "manual", city: choice.label, label: choice.label,
      latitude: choice.latitude, longitude: choice.longitude, cityId: choice.id
    };
    prayerCityInput.value = choice.label;
    usePrayerPlace(prayerCitySelection);
  }

  async function searchPrayerCities() {
    cancelCitySearch();
    var query = prayerCityInput.value.trim();
    if (query.length < 3) {
      if (prayerCitySearchStatus) prayerCitySearchStatus.textContent = "Écris au moins 3 lettres ou un code postal.";
      return [];
    }
    var requestId = prayerCitySearchId;
    var controller = new AbortController();
    prayerCitySearchController = controller;
    prayerCityInput.setAttribute("aria-busy", "true");
    if (prayerCitySearchStatus) prayerCitySearchStatus.textContent = "Recherche des villes…";
    var timeout = setTimeout(function () { controller.abort(); }, 8000);
    try {
      var response = await fetch("/api/prayer-cities", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, scope: prayerCityScope }), signal: controller.signal
      });
      var data = await response.json();
      if (requestId !== prayerCitySearchId || prayerCityForm.hidden || prayerCityInput.value.trim() !== query) return null;
      if (!response.ok || !data || !Array.isArray(data.results)) throw new Error("search_unavailable");
      var choices = data.results.filter(function (choice) {
        return choice && typeof choice.id === "string" && choice.id.length <= 100
          && typeof choice.label === "string" && choice.label.trim() && choice.label.length <= 200
          && Number.isFinite(choice.latitude) && Number.isFinite(choice.longitude)
          && Math.abs(choice.latitude) <= 90 && Math.abs(choice.longitude) <= 180;
      }).slice(0, 6);
      prayerCityChoices = choices;
      choices.forEach(function (choice, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "prayer-city-option";
        button.textContent = choice.label;
        button.addEventListener("click", function () { choosePrayerCity(choice); });
        button.addEventListener("keydown", function (event) {
          if (event.key === "Escape") { cancelCitySearch(); prayerCityInput.focus(); }
          else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            var next = index + (event.key === "ArrowDown" ? 1 : -1);
            if (next < 0) prayerCityInput.focus();
            else if (prayerCitySuggestions.children[next]) prayerCitySuggestions.children[next].focus();
          }
        });
        prayerCitySuggestions.appendChild(button);
      });
      prayerCitySuggestions.hidden = !choices.length;
      if (prayerCitySearchStatus) prayerCitySearchStatus.textContent = choices.length
        ? "Appuie sur ta ville pour afficher les horaires."
        : "Aucune proposition. Essaie le code postal, précise le pays ou utilise « Autres pays ».";
      if (prayerCityAttribution) prayerCityAttribution.hidden = !choices.length;
      return choices;
    } catch (error) {
      if (requestId !== prayerCitySearchId) return null;
      if (prayerCitySearchStatus) prayerCitySearchStatus.textContent = "Les suggestions ne sont pas disponibles. Tu peux saisir la ville et son pays, puis appuyer sur « Afficher ».";
      return [];
    } finally {
      clearTimeout(timeout);
      if (requestId === prayerCitySearchId) {
        prayerCitySearchController = null;
        prayerCityInput.setAttribute("aria-busy", "false");
      }
    }
  }

  function rewardStorageKey(prayer, profileKey) {
    return "km-prayer-done:" + (profileKey || activeProfileKey) + ":" + prayer.date + ":" + prayer.key;
  }

  function setCityEditor(open, focus) {
    if (!prayerCityForm) return;
    prayerCityForm.hidden = !open;
    prayerCityButton.setAttribute("aria-expanded", String(open));
    if (open) {
      var savedPlace = savedPrayerPlace();
      if (focus || !prayerCityInput.value) {
        prayerCityInput.value = savedPlace ? savedPlace.label : prayerPreference(prayerStorageKey());
        prayerCitySelection = savedPlace;
      }
      updateCityScope();
      if (focus) setTimeout(function () { prayerCityInput.focus(); }, 20);
    } else cancelCitySearch();
  }

  function setLocateBusy(busy) {
    if (!prayerLocateButton) return;
    prayerLocateButton.disabled = busy;
    prayerLocateButton.textContent = busy ? "Localisation…" : "Me localiser";
    prayerLocateButton.setAttribute("aria-busy", String(busy));
  }

  function setApproxBusy(busy) {
    if (!prayerApproxButton) return;
    prayerApproxButton.disabled = busy;
    prayerApproxButton.textContent = busy ? "Recherche de la ville…" : "Estimer ma ville";
    prayerApproxButton.setAttribute("aria-busy", String(busy));
  }

  function cancelPrayerRequest() {
    cancelCitySearch();
    clearTimeout(prayerRefreshTimer);
    clearTimeout(prayerLocationTimer);
    if (prayerController) prayerController.abort();
    prayerController = null;
    prayerPending = false;
    prayerEstimatePending = false;
    setLocateBusy(false);
    setApproxBusy(false);
    return ++prayerRequestId;
  }

  function resetPrayer(message, label) {
    currentPrayer = null;
    prayerDone.hidden = true;
    prayerReward.textContent = "";
    prayerCountdown.textContent = "";
    prayerStatus.textContent = "";
    if (prayerSource) { prayerSource.textContent = ""; prayerSource.hidden = true; }
    if (prayerCalendar) { prayerCalendar.textContent = ""; prayerCalendar.hidden = true; }
    if (prayerApproxButton) prayerApproxButton.hidden = true;
    if (prayerRetryButton) prayerRetryButton.hidden = true;
    prayerCard.classList.remove("is-rewarded");
    prayerEyebrow.textContent = "HORAIRES DE PRIÈRE";
    prayerTitle.textContent = message;
    prayerCityLabel.textContent = label || "Choisir ma ville";
  }

  function prayerVisible() {
    return prayerSectionActive && !document.hidden;
  }

  function timeParts(timeZone) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).reduce(function (values, part) {
      values[part.type] = part.value;
      return values;
    }, {});
    return {
      date: parts.year + "-" + parts.month + "-" + parts.day,
      minutes: Number(parts.hour) * 60 + Number(parts.minute)
    };
  }

  function cleanPrayerTime(value) {
    var match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? { label: match[1].padStart(2, "0") + ":" + match[2], minutes: Number(match[1]) * 60 + Number(match[2]) } : null;
  }

  function markPrayerDone(message) {
    if (!currentPrayer) return;
    prayerDone.hidden = true;
    prayerReward.textContent = message || "Prière accomplie · +2 étoiles";
    prayerCard.classList.remove("is-rewarded");
    void prayerCard.offsetWidth;
    prayerCard.classList.add("is-rewarded");
  }

  function renderPrayerSource(data) {
    if (!prayerSource) return;
    var source = data.meta && data.meta.source;
    var sourceLinks = {
      "gmp-calendar": "https://www.grandemosqueedeparis.fr/horaire-des-prieres-paris",
      "aladhan-mwl": "https://aladhan.com/calculation-methods"
    };
    prayerSource.textContent = "";
    prayerSource.hidden = !source || !sourceLinks[source.id];
    if (prayerSource.hidden) return;
    var sourceLink = document.createElement("a");
    sourceLink.textContent = source.label;
    sourceLink.href = sourceLinks[source.id];
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    prayerSource.appendChild(sourceLink);
  }

  function renderOfficialPrayerCalendar(data, place, date) {
    resetPrayer("Horaires de la mosquée", place.label);
    prayerEyebrow.textContent = "GRANDE MOSQUÉE DE PARIS";
    renderPrayerSource(data);
    var calendar = data.calendar;
    var valid = calendar && calendar.month === date.slice(0, 7)
      && typeof calendar.label === "string" && calendar.label.length <= 40
      && calendar.validFrom <= date && calendar.validUntil >= date
      && /^https:\/\/static\.wixstatic\.com\/media\/[a-zA-Z0-9_~.-]+\.(?:jpe?g|png|webp)$/.test(calendar.imageUrl || "");
    if (valid && prayerCalendar) {
      var link = document.createElement("a");
      link.href = calendar.imageUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", "Agrandir le calendrier officiel de " + calendar.label);
      var poster = document.createElement("img");
      poster.src = calendar.imageUrl;
      poster.alt = "Horaires de Paris et sa banlieue — Grande Mosquée de Paris — " + calendar.label;
      poster.loading = "lazy";
      poster.referrerPolicy = "no-referrer";
      poster.addEventListener("error", function () {
        if (!prayerCalendar.contains || prayerCalendar.contains(poster)) {
          prayerCalendar.hidden = true;
          prayerStatus.textContent = "Le calendrier ne s’affiche pas. Consulte les horaires sur le site de la mosquée ci-dessous.";
        }
      });
      link.appendChild(poster);
      prayerCalendar.appendChild(link);
      prayerCalendar.hidden = false;
      prayerStatus.textContent = "Calendrier officiel de " + calendar.label + ". Touche l’image pour l’agrandir.";
    } else {
      prayerStatus.textContent = "Le calendrier de ce mois n’est pas encore disponible dans l’application. Consulte les horaires actualisés sur le site de la mosquée.";
    }
    if (prayerSource && prayerSource.firstChild) prayerSource.firstChild.textContent = "Consulter les horaires de la Grande Mosquée de Paris ↗";
    schedulePrayerRefresh();
  }

  function renderPrayer(data, place) {
    clearTimeout(prayerRefreshTimer);
    var zone = data.meta && data.meta.timezone ? data.meta.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
    var clock = timeParts(zone);
    var schedule = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map(function (key) {
      var time = cleanPrayerTime(data.timings && data.timings[key]);
      return time && { key: key, name: prayerNames[key], label: time.label, minutes: time.minutes };
    }).filter(Boolean);
    var started = schedule.filter(function (item) { return item.minutes <= clock.minutes; });
    var next = schedule.find(function (item) { return item.minutes > clock.minutes; });
    var active = started[started.length - 1] || null;
    currentPrayer = active ? { key: active.key, name: active.name, date: clock.date } : null;

    prayerCityLabel.textContent = place.label;
    prayerStatus.textContent = "";
    renderPrayerSource(data);
    prayerReward.textContent = "";
    if (active) {
      prayerEyebrow.textContent = "PRIÈRE EN COURS";
      prayerTitle.textContent = active.name + " · " + active.label;
      prayerCountdown.textContent = next ? "Prochaine : " + next.name + " à " + next.label : "Dernière prière du jour";
      // L’aperçu doit toujours permettre de tester le bouton après un rechargement.
      var alreadyDone = !isLocalPreview() && prayerPreference(rewardStorageKey(currentPrayer)) === "1";
      prayerDone.hidden = !activeChildId || alreadyDone;
      if (alreadyDone) prayerReward.textContent = "Prière accomplie · +2 étoiles";
    } else {
      prayerEyebrow.textContent = "PROCHAINE PRIÈRE";
      prayerTitle.textContent = next ? next.name + " · " + next.label : "Horaires indisponibles";
      prayerCountdown.textContent = "";
      prayerDone.hidden = true;
    }
    schedulePrayerRefresh();
  }

  function schedulePrayerRefresh() {
    clearTimeout(prayerRefreshTimer);
    if (prayerVisible() && !prayerEditing && prayerLocation) prayerRefreshTimer = setTimeout(function () {
      if (!prayerVisible() || prayerEditing) return;
      if (prayerAutomatic && Date.now() - prayerLastLocated >= 300000) locatePrayer();
      else loadPrayerTimes(prayerLocation);
    }, Math.max(1000, 60000 - (Date.now() - prayerLastRequest)));
  }

  async function loadPrayerTimes(place) {
    var requestId = cancelPrayerRequest();
    prayerLocation = place;
    prayerPending = true;
    prayerLastRequest = Date.now();
    resetPrayer("Chargement…", place.label);
    var controller = new AbortController();
    prayerController = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 18000);
    try {
      var date = timeParts(place.timeZone).date;
      var data;
      // The selected place can have a different calendar day from the device.
      for (var attempt = 0; attempt < 2; attempt++) {
        var query = { date: date };
        if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
          query.latitude = place.latitude;
          query.longitude = place.longitude;
          if (place.kind === "manual" && /^fr:[0-9A-Z]{5}$/i.test(place.cityId || "")) query.cityId = place.cityId;
        } else query.city = place.city;
        // Keep the mobile app on its own domain. Location is never put in a URL.
        var response = await fetch("/api/prayer-times", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(query), signal: controller.signal
        });
        var payload = await response.json();
        if (requestId !== prayerRequestId) return;
        if (!response.ok || !payload || Number(payload.code) !== 200 || !payload.data) throw new Error(payload && payload.error || "timings_unavailable");
        data = payload.data;
        if (!data.date || !data.date.gregorian || data.date.gregorian.date !== date.split("-").reverse().join("-")) throw new Error("date_mismatch");
        var localDate = timeParts(data.meta && data.meta.timezone).date;
        if (localDate === date) break;
        if (attempt === 1) throw new Error("date_mismatch");
        date = localDate;
      }
      if (data.presentation === "official-calendar" && data.meta && data.meta.timezone === "Europe/Paris"
          && data.meta.source && data.meta.source.id === "gmp-calendar") {
        place.timeZone = "Europe/Paris";
        if (place.kind === "manual") savePrayerPlace(place);
        renderOfficialPrayerCalendar(data, place, date);
        return;
      }
      if (!["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].every(function (key) { return cleanPrayerTime(data.timings && data.timings[key]); })) throw new Error("invalid_timings");
      place.timeZone = data.meta && data.meta.timezone;
      if (place.kind === "manual") savePrayerPlace(place);
      renderPrayer(data, place);
    } catch (error) {
      if (requestId !== prayerRequestId) return;
      resetPrayer("Horaires indisponibles", place.label);
      prayerStatus.textContent = error.message === "location_not_found"
        ? "Cette ville n’a pas été trouvée. Précise son nom et son pays, puis appuie sur « Afficher »."
        : error.message === "location_ambiguous"
          ? "Plusieurs villes portent ce nom. Choisis la bonne commune dans la liste, avec son département."
        : controller.signal.aborted || error.message === "timings_timeout"
          ? "Le chargement des horaires a pris trop de temps. Appuie sur « Réessayer »."
          : "Le service des horaires est momentanément indisponible. Appuie sur « Réessayer » dans un instant.";
      if (prayerRetryButton) prayerRetryButton.hidden = error.message === "location_ambiguous";
      setCityEditor(true, false);
      if (error.message === "location_ambiguous") {
        prayerTitle.textContent = "Choisis ta ville";
        prayerEditing = true;
        prayerCitySelection = null;
        prayerCityScope = "fr";
        prayerCityInput.value = place.city || place.label;
        updateCityScope();
        searchPrayerCities();
      }
    } finally {
      clearTimeout(timeout);
      if (requestId === prayerRequestId) {
        prayerPending = false;
        prayerController = null;
      }
    }
  }

  function locatePrayer() {
    var requestId = cancelPrayerRequest();
    prayerEditing = false;
    setCityEditor(false);
    prayerStarted = true;
    prayerPending = true;
    prayerAutomatic = false;
    prayerLocation = null;
    prayerLastRequest = Date.now();
    resetPrayer("Recherche de ta position…", "Ma position");
    setLocateBusy(true);
    prayerStatus.textContent = "Autorise la localisation pour afficher les horaires près de toi, ou choisis ta ville.";

    function fail(error) {
      if (requestId !== prayerRequestId) return;
      cancelPrayerRequest();
      prayerMode(prayerPreference(prayerStorageKey()) ? "manual" : "off");
      resetPrayer("Choisis ta ville");
      var code = Number(error && error.code);
      var reason = error && error.reason;
      if (code === 1) {
        prayerStatus.textContent = "Localisation refusée. Autorise-la dans les réglages de l’appareil ou saisis ta ville.";
      } else {
        var message = reason === "unsupported" ? "La localisation GPS n’est pas disponible dans cet écran."
          : reason === "prompt_wait_timeout" ? "La demande de localisation n’a pas reçu de réponse. Si une autorisation apparaît, accepte-la puis réessaie."
          : code === 3 ? "Le téléphone a mis trop de temps à trouver sa position."
          : code === 2 ? "Le téléphone n’a pas pu fournir sa position."
          : "La position n’a pas pu être obtenue.";
        prayerStatus.textContent = message + " Tu peux aussi saisir ta ville ou demander une estimation par Internet.";
        if (prayerApproxButton) prayerApproxButton.hidden = false;
      }
      setCityEditor(true, false);
    }

    if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) { fail({ reason: "unsupported" }); return; }
    // Also bound time spent waiting for an ignored system permission prompt.
    prayerLocationTimer = setTimeout(function () { fail({ reason: "prompt_wait_timeout" }); }, 20000);
    try {
      navigator.geolocation.getCurrentPosition(function (position) {
        if (requestId !== prayerRequestId) return;
        var latitude = position.coords && position.coords.latitude;
        var longitude = position.coords && position.coords.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { fail({ reason: "invalid_position" }); return; }
        clearTimeout(prayerLocationTimer);
        prayerAutomatic = true;
        prayerLastLocated = Date.now();
        prayerMode("auto");
        setCityEditor(false);
        // City-level precision is sufficient; coordinates stay in memory only.
        loadPrayerTimes({ kind: "auto", label: "Ma position", latitude: Number(latitude.toFixed(3)), longitude: Number(longitude.toFixed(3)) });
      }, fail, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    } catch (error) { fail(error); }
  }

  async function estimatePrayerCity() {
    // This estimate is requested explicitly and must be confirmed before use.
    var requestId = cancelPrayerRequest();
    prayerStarted = true;
    prayerAutomatic = false;
    prayerCitySelection = null;
    prayerLocation = null;
    prayerEditing = false;
    prayerPending = true;
    prayerEstimatePending = true;
    resetPrayer("Recherche de ta ville…");
    setCityEditor(true, false);
    if (prayerApproxButton) prayerApproxButton.hidden = false;
    setApproxBusy(true);
    prayerStatus.textContent = "Ta connexion Internet permet de proposer une ville approximative. Tu pourras la vérifier avant d’afficher les horaires.";
    var controller = new AbortController();
    prayerController = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 8000);
    try {
      var response = await fetch("/api/prayer-city", { headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store", signal: controller.signal });
      var data = await response.json();
      if (requestId !== prayerRequestId) return;
      if (!response.ok || !data || data.approximate !== true || typeof data.city !== "string"
          || !data.city.trim() || data.city.length > 80 || !/^[A-Z]{2}$/.test(data.countryCode || "")) throw new Error("city_unavailable");
      var country = data.countryCode;
      try { country = new Intl.DisplayNames(["fr"], { type: "region" }).of(data.countryCode) || country; } catch (error) { /* Keep the country code on older iPhones. */ }
      var suggestion = data.city.trim() + ", " + country;
      prayerCityInput.value = suggestion;
      prayerCitySelection = null;
      prayerCityScope = data.countryCode === "FR" || data.countryCode === "RE" ? "fr" : "world";
      updateCityScope();
      prayerTitle.textContent = "Confirme ta ville";
      prayerCityLabel.textContent = "Ville à confirmer";
      prayerStatus.textContent = "Ville estimée via ta connexion : " + suggestion + ". Vérifie-la, puis appuie sur « Afficher ».";
      prayerEditing = true;
    } catch (error) {
      if (requestId !== prayerRequestId) return;
      resetPrayer("Choisis ta ville");
      if (prayerApproxButton) prayerApproxButton.hidden = false;
      prayerStatus.textContent = "L’estimation n’a pas abouti. Indique ta ville et ton pays pour afficher les horaires.";
    } finally {
      clearTimeout(timeout);
      if (requestId === prayerRequestId) {
        prayerPending = false;
        prayerEstimatePending = false;
        prayerController = null;
        setApproxBusy(false);
      }
    }
  }

  function startPrayer() {
    prayerStarted = true;
    var mode = prayerMode();
    var savedPlace = savedPrayerPlace();
    var savedCity = prayerPreference(prayerStorageKey());
    if (savedPlace && mode !== "auto") {
      prayerAutomatic = false;
      prayerCitySelection = savedPlace;
      loadPrayerTimes(savedPlace);
    } else if (savedCity && mode !== "auto") {
      prayerAutomatic = false;
      var legacyPlace = { kind: "manual", city: savedCity, label: savedCity };
      loadPrayerTimes(legacyPlace);
    } else if (mode === "off" || mode === "manual") {
      resetPrayer("Choisis ta ville");
      setCityEditor(true, false);
    } else locatePrayer();
  }

  function resumePrayer() {
    if (!prayerInitialized || !prayerVisible() || prayerPending || prayerEditing) return;
    if (!prayerStarted) { startPrayer(); return; }
    if (Date.now() - prayerLastRequest < 60000) { schedulePrayerRefresh(); return; }
    if (prayerAutomatic) locatePrayer();
    else if (prayerLocation) loadPrayerTimes(prayerLocation);
  }

  function initPrayer() {
    if (!prayerCard) return;
    prayerInitialized = true;
    if (prayerVisible()) startPrayer();
  }

  window.addEventListener("pageshow", resumePrayer);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) clearTimeout(prayerRefreshTimer);
    else resumePrayer();
  });
  document.addEventListener("km-app-active", function () { prayerSectionActive = true; resumePrayer(); });
  document.addEventListener("km-app-inactive", function () { prayerSectionActive = false; clearTimeout(prayerRefreshTimer); });

  function reveal() {
    if (loading) loading.classList.add("is-hidden");
  }

  function isLocalPreview() {
    var localHost = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    return (localHost && new URLSearchParams(location.search).get("preview") === "1")
      || new URLSearchParams(location.search).get("guest") === "1";
  }

  function enableLocalPreviewLinks() {
    if (!isLocalPreview()) return;
    document.querySelectorAll('a[href]').forEach(function (link) {
      var target = new URL(link.getAttribute('href'), location.href);
      if (target.origin !== location.origin) return;
      if(new URLSearchParams(location.search).get('guest') === '1') {
        target.searchParams.set('guest','1');
        if (/\/LivreColoriage\.dc\.html$/i.test(target.pathname)) target.searchParams.set('previewPages','4');
        if (/\/books\/tawakkul\.html$/i.test(target.pathname)) target.searchParams.set('previewPages','9');
      }
      else target.searchParams.set('preview', '1');
      link.href = target.href;
    });
  }

  async function loadProfile() {
    if (isLocalPreview()) {
      activeChildId = "preview-child";
      var guest = new URLSearchParams(location.search).get("guest") === "1";
      activeProfileKey = guest ? "guest" : "preview-child";
      setProfile(guest ? "Découverte" : "toto", guest ? "d" : "t", guest ? 0 : (Number(localStorage.getItem("km-preview-star-balance")) || 12));
      if (guest) {
        var greeting = document.getElementById("childWelcomeTitle");
        if (greeting) greeting.textContent = "Bienvenue dans ton monde";
      }
      renderRecent();
      reveal();
      initPrayer();
      return;
    }

    try {
      if (!window.KMAuth) {
        location.replace("Connexion.dc.html");
        return;
      }
      var context = await KMAuth.getContext();
      if (!context) {
        location.replace("Connexion.dc.html");
        return;
      }
      var active = KMAuth.validateActiveProfile(context);
      activeProfileKey = active.id || ("parent:" + context.user.id);
      activeChildId = active.type === "child" ? active.id : "";
      var name = active.name || (active.type === "child" ? "Mon enfant" : "Maman");
      var child = active.type === "child" ? active : context.children[0];
      var balance = 0;
      if (child) {
        var shop = await KMAuth.getStarShop(child.id).catch(function () { return { balance: 0 }; });
        balance = Number(shop && shop.balance) || 0;
      }
      setProfile(name, active.avatar || name.charAt(0).toLowerCase(), balance);
      restoreRecent(activeChildId);
      reveal();
      initPrayer();
    } catch (error) {
      location.replace("Connexion.dc.html");
    }
  }

  if (prayerCityButton) prayerCityButton.addEventListener("click", function () {
    var wasPending = prayerPending;
    cancelPrayerRequest();
    prayerEditing = true;
    if (wasPending) resetPrayer("Choisis ta ville", prayerLocation && prayerLocation.label);
    setCityEditor(true, true);
  });
  if (prayerLocateButton) prayerLocateButton.addEventListener("click", locatePrayer);
  if (prayerApproxButton) prayerApproxButton.addEventListener("click", estimatePrayerCity);
  if (prayerRetryButton) prayerRetryButton.addEventListener("click", function () {
    if (!prayerLocation) return;
    prayerEditing = false;
    setCityEditor(false);
    loadPrayerTimes(prayerLocation);
  });
  if (prayerCityCancel) prayerCityCancel.addEventListener("click", function () {
    var wasPending = prayerPending;
    cancelPrayerRequest();
    prayerEditing = false;
    setCityEditor(false);
    if (prayerLocation) loadPrayerTimes(prayerLocation);
    else if (wasPending) resetPrayer("Choisis ta ville");
  });
  if (prayerCityInput) prayerCityInput.addEventListener("input", function () {
    if (prayerEstimatePending) {
      cancelPrayerRequest();
      resetPrayer("Choisis ta ville");
    }
    prayerEditing = true;
    prayerCitySelection = null;
    clearTimeout(prayerRefreshTimer);
    cancelCitySearch();
    if (prayerCityInput.value.trim().length >= 3) prayerCitySearchTimer = setTimeout(searchPrayerCities, 350);
  });
  if (prayerCityInput) prayerCityInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") cancelCitySearch();
    else if (event.key === "ArrowDown" && prayerCitySuggestions && prayerCitySuggestions.children[0]) {
      event.preventDefault();
      prayerCitySuggestions.children[0].focus();
    }
  });
  if (prayerCityWorld) prayerCityWorld.addEventListener("click", function () {
    prayerCityScope = prayerCityScope === "fr" ? "world" : "fr";
    prayerCitySelection = null;
    updateCityScope();
    searchPrayerCities();
  });
  if (prayerCityForm) prayerCityForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var city = prayerCityInput.value.trim();
    if (!city) return;
    if (prayerCitySelection && prayerCitySelection.label === city) { usePrayerPlace(prayerCitySelection); return; }
    var matches = await searchPrayerCities();
    if (matches === null || prayerCityForm.hidden || city !== prayerCityInput.value.trim()) return;
    if (matches.length) {
      if (prayerCitySearchStatus) prayerCitySearchStatus.textContent = "Choisis ta ville dans la liste pour éviter de confondre deux communes.";
      return;
    }
    usePrayerPlace({ kind: "manual", city: city, label: city });
  });
  if (prayerDone) prayerDone.addEventListener("click", async function () {
    if (!currentPrayer || !activeChildId) return;
    var completedPrayer = currentPrayer;
    var completedProfileKey = activeProfileKey;
    function stillCurrent() {
      return currentPrayer && activeProfileKey === completedProfileKey
        && currentPrayer.date === completedPrayer.date && currentPrayer.key === completedPrayer.key;
    }
    prayerDone.disabled = true;
    prayerDone.textContent = "Validation…";
    try {
      var result;
      if (isLocalPreview()) {
        var previewAlreadyAwarded = localStorage.getItem(rewardStorageKey(completedPrayer, completedProfileKey)) === "1";
        result = { awarded: previewAlreadyAwarded ? 0 : 2, balance: currentBalance + (previewAlreadyAwarded ? 0 : 2), reason: previewAlreadyAwarded ? "already_awarded" : "earned" };
      } else {
        result = await KMAuth.awardChildStars({
          childId: activeChildId,
          eventType: "prayer_complete",
          sourceKey: "prayer:" + completedPrayer.date + ":" + completedPrayer.key,
          description: "Prière de " + completedPrayer.name + " accomplie"
        });
      }
      if (result.reason === "daily_limit") {
        if (stillCurrent()) prayerReward.textContent = "Les 5 prières sont déjà récompensées aujourd’hui.";
      } else {
        localStorage.setItem(rewardStorageKey(completedPrayer, completedProfileKey), "1");
        if (Number(result.balance) >= 0) {
          setProfile(profileName.textContent, avatar.textContent, Number(result.balance));
          if (isLocalPreview()) {
            localStorage.setItem("km-preview-star-balance", String(result.balance));
            if (Number(result.awarded) === 2) {
              var previewHistory = [];
              try { previewHistory = JSON.parse(localStorage.getItem("km-preview-star-history") || "[]"); } catch (historyError) { previewHistory = []; }
              previewHistory.unshift({ amount: 2, description: "Prière de " + completedPrayer.name + " accomplie", created_at: new Date().toISOString() });
              localStorage.setItem("km-preview-star-history", JSON.stringify(previewHistory.slice(0, 20)));
            }
          }
        }
        if (stillCurrent()) markPrayerDone(Number(result.awarded) === 2 ? "Bravo · +2 étoiles" : "Prière déjà validée");
      }
    } catch (error) {
      if (stillCurrent()) prayerReward.textContent = "Impossible de valider pour le moment.";
    } finally {
      prayerDone.disabled = false;
      prayerDone.textContent = "J’ai prié";
    }
  });

  function startMotion() {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !window.gsap) return;

    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".today-header > *", { autoAlpha: 0, y: -18, duration: .55, stagger: .08 })
      .from(".child-hero", { autoAlpha: 0, y: 24, scale: .975, duration: .72 }, "-=.25")
      .from(".child-eyebrow", { autoAlpha: 0, y: 12, duration: .38 }, "-=.38")
      .from(".child-hero h2", { autoAlpha: 0, y: 25, clipPath: "inset(0 0 100% 0)", duration: .62 }, "-=.24")
      .from(".child-hero-copy > p:not(.child-eyebrow)", { autoAlpha: 0, y: 12, duration: .4 }, "-=.27")
      .from(".child-primary", { autoAlpha: 0, y: 12, scale: .94, duration: .45 }, "-=.22")
      .from(".child-hero-art", { autoAlpha: 0, x: 58, y: 25, scale: .9, rotation: 2.5, duration: .82 }, "-=.62");

    gsap.to(".child-hero-art", {
      y: -10,
      rotation: 1.2,
      duration: 3.2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: .8
    });

    var hero = document.querySelector(".child-hero");
    var heroArt = document.querySelector(".child-hero-art");
    if (hero && heroArt && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
      var moveArt = gsap.quickTo(heroArt, "x", { duration: .7, ease: "power3.out" });
      hero.addEventListener("pointermove", function (event) {
        var rect = hero.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width;
        var y = (event.clientY - rect.top) / rect.height;
        hero.style.setProperty("--hero-mx", (x * 100).toFixed(1) + "%");
        hero.style.setProperty("--hero-my", (y * 100).toFixed(1) + "%");
        moveArt((x - .5) * 15);
      });
      hero.addEventListener("pointerleave", function () {
        hero.style.setProperty("--hero-mx", "74%");
        hero.style.setProperty("--hero-my", "22%");
        moveArt(0);
      });

      gsap.utils.toArray(".destination").forEach(function (card) {
        card.addEventListener("pointermove", function (event) {
          var rect = card.getBoundingClientRect();
          var x = (event.clientX - rect.left) / rect.width;
          var y = (event.clientY - rect.top) / rect.height;
          card.style.setProperty("--spot-x", (x * 100).toFixed(1) + "%");
          card.style.setProperty("--spot-y", (y * 100).toFixed(1) + "%");
          gsap.to(card, { rotationY: (x - .5) * 5, rotationX: (.5 - y) * 5, duration: .35, ease: "power2.out", overwrite: "auto" });
        });
        card.addEventListener("pointerleave", function () {
          gsap.to(card, { rotationY: 0, rotationX: 0, duration: .55, ease: "elastic.out(1,.5)", overwrite: "auto" });
        });
      });
    }

    var steps = gsap.utils.toArray("[data-journey-step]");
    steps.forEach(function (step) {
      var visual = step.querySelector(".journey-visual");
      var copy = step.querySelector(".journey-copy");
      var vars = {
        y: 22,
        scale: .992,
        duration: .62,
        ease: "power2.out",
        stagger: .1
      };
      if (window.ScrollTrigger) {
        vars.scrollTrigger = {
          trigger: step,
          start: "clamp(top 84%)",
          once: true
        };
      }
      gsap.from([visual, copy], vars);
    });

    if (window.ScrollTrigger) {
      ScrollTrigger.batch(".today-book", {
        start: "clamp(top 90%)",
        once: true,
        onEnter: function (books) {
          gsap.from(books, {
            y: 18,
            scale: .98,
            duration: .44,
            stagger: .07,
            ease: "power2.out"
          });
        }
      });
      window.addEventListener("load", function () { ScrollTrigger.refresh(); }, { once: true });
    }

  }

  setDate();
  enableLocalPreviewLinks();
  loadProfile();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMotion, { once: true });
  } else {
    startMotion();
  }
})();
