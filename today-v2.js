(function () {
  "use strict";

  var loading = document.getElementById("todayLoading");
  var profileName = document.getElementById("todayProfileName");
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
  var prayerStatus = document.getElementById("prayerStatus");
  var prayerCountdown = document.getElementById("prayerCountdown");
  var prayerDone = document.getElementById("prayerDone");
  var prayerReward = document.getElementById("prayerReward");
  var activeChildId = "";
  var activeProfileKey = "family";
  var currentBalance = 0;
  var currentPrayer = null;
  var prayerRefreshTimer = 0;
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
    if (avatar) avatar.textContent = avatarValue || safeName.charAt(0).toLowerCase();
    if (starBalance) starBalance.textContent = count;
    if (starUnit) starUnit.textContent = " étoile" + (count > 1 ? "s" : "");
  }

  function prayerStorageKey() {
    return "km-prayer-city:" + activeProfileKey;
  }

  function rewardStorageKey(prayer) {
    return "km-prayer-done:" + activeProfileKey + ":" + prayer.date + ":" + prayer.key;
  }

  function setCityEditor(open) {
    if (!prayerCityForm) return;
    prayerCityForm.hidden = !open;
    if (open) {
      prayerCityInput.value = localStorage.getItem(prayerStorageKey()) || localStorage.getItem("km-prayer-city") || "";
      setTimeout(function () { prayerCityInput.focus(); }, 20);
    }
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
    return match ? { label: match[1].padStart(2, "0") + ":" + match[2], minutes: Number(match[1]) * 60 + Number(match[2]) } : null;
  }

  function markPrayerDone(message) {
    if (!currentPrayer) return;
    prayerDone.hidden = true;
    prayerReward.textContent = message || "Prière accomplie · +2 étoiles";
    prayerCard.classList.remove("is-rewarded");
    void prayerCard.offsetWidth;
    prayerCard.classList.add("is-rewarded");
  }

  function renderPrayer(data, city) {
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

    prayerCityLabel.textContent = city;
    prayerStatus.textContent = "";
    prayerReward.textContent = "";
    if (active) {
      prayerEyebrow.textContent = "PRIÈRE EN COURS";
      prayerTitle.textContent = active.name + " · " + active.label;
      prayerCountdown.textContent = next ? "Prochaine : " + next.name + " à " + next.label : "Dernière prière du jour";
      // L’aperçu doit toujours permettre de tester le bouton après un rechargement.
      var alreadyDone = !isLocalPreview() && localStorage.getItem(rewardStorageKey(currentPrayer)) === "1";
      prayerDone.hidden = !activeChildId || alreadyDone;
      if (alreadyDone) prayerReward.textContent = "Prière accomplie · +2 étoiles";
    } else {
      prayerEyebrow.textContent = "PROCHAINE PRIÈRE";
      prayerTitle.textContent = next ? next.name + " · " + next.label : "Horaires indisponibles";
      prayerCountdown.textContent = "";
      prayerDone.hidden = true;
    }
    prayerRefreshTimer = setTimeout(function () { loadPrayerTimes(city); }, 60000);
  }

  async function loadPrayerTimes(city) {
    if (!city) {
      prayerEyebrow.textContent = "HORAIRES DE PRIÈRE";
      prayerTitle.textContent = "Choisis ta ville";
      prayerCityLabel.textContent = "Ajouter ma ville";
      prayerDone.hidden = true;
      setCityEditor(true);
      return;
    }
    prayerEyebrow.textContent = "HORAIRES DE PRIÈRE";
    prayerTitle.textContent = "Chargement…";
    prayerCityLabel.textContent = city;
    prayerDone.hidden = true;
    try {
      var url = "https://api.aladhan.com/v1/timingsByAddress?method=3&address=" + encodeURIComponent(city);
      var response = await fetch(url, { headers: { Accept: "application/json" } });
      var payload = await response.json();
      if (!response.ok || Number(payload.code) !== 200 || !payload.data) throw new Error("city_not_found");
      renderPrayer(payload.data, city);
    } catch (error) {
      prayerTitle.textContent = "Ville introuvable";
      prayerCountdown.textContent = "Vérifie le nom de la ville";
      prayerDone.hidden = true;
      setCityEditor(true);
    }
  }

  function initPrayer() {
    if (!prayerCard) return;
    var savedCity = localStorage.getItem(prayerStorageKey()) || localStorage.getItem("km-prayer-city") || (isLocalPreview() ? "Casablanca, Maroc" : "");
    loadPrayerTimes(savedCity);
  }

  function reveal() {
    if (loading) loading.classList.add("is-hidden");
  }

  function isLocalPreview() {
    var localHost = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    return localHost && new URLSearchParams(location.search).get("preview") === "1";
  }

  function enableLocalPreviewLinks() {
    if (!isLocalPreview()) return;
    document.querySelectorAll('a[href]').forEach(function (link) {
      var target = new URL(link.getAttribute('href'), location.href);
      if (target.origin !== location.origin) return;
      target.searchParams.set('preview', '1');
      link.href = target.href;
    });
  }

  async function loadProfile() {
    if (isLocalPreview()) {
      activeChildId = "preview-child";
      activeProfileKey = "preview-child";
      setProfile("toto", "t", Number(localStorage.getItem("km-preview-star-balance")) || 12);
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
      activeProfileKey = active.id || active.type || "family";
      activeChildId = active.type === "child" ? active.id : "";
      var name = active.name || (active.type === "child" ? "Mon enfant" : "Maman");
      var child = active.type === "child" ? active : context.children[0];
      var balance = 0;
      if (child) {
        var shop = await KMAuth.getStarShop(child.id).catch(function () { return { balance: 0 }; });
        balance = Number(shop && shop.balance) || 0;
      }
      setProfile(name, active.avatar || name.charAt(0).toLowerCase(), balance);
      reveal();
      initPrayer();
    } catch (error) {
      location.replace("Connexion.dc.html");
    }
  }

  if (prayerCityButton) prayerCityButton.addEventListener("click", function () { setCityEditor(true); });
  if (prayerCityCancel) prayerCityCancel.addEventListener("click", function () { setCityEditor(false); });
  if (prayerCityForm) prayerCityForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var city = prayerCityInput.value.trim();
    if (!city) return;
    localStorage.setItem(prayerStorageKey(), city);
    localStorage.setItem("km-prayer-city", city);
    setCityEditor(false);
    loadPrayerTimes(city);
  });
  if (prayerDone) prayerDone.addEventListener("click", async function () {
    if (!currentPrayer || !activeChildId) return;
    prayerDone.disabled = true;
    prayerDone.textContent = "Validation…";
    try {
      var result;
      if (isLocalPreview()) {
        var previewAlreadyAwarded = localStorage.getItem(rewardStorageKey(currentPrayer)) === "1";
        result = { awarded: previewAlreadyAwarded ? 0 : 2, balance: currentBalance + (previewAlreadyAwarded ? 0 : 2), reason: previewAlreadyAwarded ? "already_awarded" : "earned" };
      } else {
        result = await KMAuth.awardChildStars({
          childId: activeChildId,
          eventType: "prayer_complete",
          sourceKey: "prayer:" + currentPrayer.date + ":" + currentPrayer.key,
          description: "Prière de " + currentPrayer.name + " accomplie"
        });
      }
      if (result.reason === "daily_limit") {
        prayerReward.textContent = "Les 5 prières sont déjà récompensées aujourd’hui.";
      } else {
        localStorage.setItem(rewardStorageKey(currentPrayer), "1");
        if (Number(result.balance) >= 0) {
          setProfile(profileName.textContent, avatar.textContent, Number(result.balance));
          if (isLocalPreview()) {
            localStorage.setItem("km-preview-star-balance", String(result.balance));
            if (Number(result.awarded) === 2) {
              var previewHistory = [];
              try { previewHistory = JSON.parse(localStorage.getItem("km-preview-star-history") || "[]"); } catch (historyError) { previewHistory = []; }
              previewHistory.unshift({ amount: 2, description: "Prière de " + currentPrayer.name + " accomplie", created_at: new Date().toISOString() });
              localStorage.setItem("km-preview-star-history", JSON.stringify(previewHistory.slice(0, 20)));
            }
          }
        }
        markPrayerDone(Number(result.awarded) === 2 ? "Bravo · +2 étoiles" : "Prière déjà validée");
      }
    } catch (error) {
      prayerReward.textContent = "Impossible de valider pour le moment.";
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

    gsap.from(".today-header > *", {
      autoAlpha: 0,
      y: -14,
      duration: .55,
      stagger: .07,
      ease: "power2.out"
    });

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
