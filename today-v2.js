(function () {
  "use strict";

  var loading = document.getElementById("todayLoading");
  var profileName = document.getElementById("todayProfileName");
  var avatar = document.getElementById("todayAvatar");
  var starBalance = document.getElementById("todayStarBalance");
  var dateLabel = document.getElementById("todayDate");

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
    if (profileName) profileName.textContent = safeName;
    if (avatar) avatar.textContent = avatarValue || safeName.charAt(0).toLowerCase();
    if (starBalance) starBalance.textContent = count + " étoile" + (count > 1 ? "s" : "");
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
      setProfile("toto", "t", 12);
      reveal();
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
      var name = active.name || (active.type === "child" ? "Mon enfant" : "Maman");
      var child = active.type === "child" ? active : context.children[0];
      var balance = 0;
      if (child) {
        var shop = await KMAuth.getStarShop(child.id).catch(function () { return { balance: 0 }; });
        balance = Number(shop && shop.balance) || 0;
      }
      setProfile(name, active.avatar || name.charAt(0).toLowerCase(), balance);
      reveal();
    } catch (error) {
      location.replace("Connexion.dc.html");
    }
  }

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
