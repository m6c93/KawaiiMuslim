(function () {
  "use strict";

  var transitionKey = "km-page-transition";
  var incomingTransition = sessionStorage.getItem(transitionKey);
  if (incomingTransition) {
    document.documentElement.classList.add("km-page-entering");
    sessionStorage.removeItem(transitionKey);
  }

  var items = [
    { key: "today", label: "Aujourd’hui", icon: "home", href: "Aujourd%27hui.dc.html" },
    { key: "library", label: "Bibliothèque", icon: "menu_book", href: "Bibliotheque%20Kawaii%20Muslim.dc.html" },
    { key: "workshop", label: "Atelier", icon: "brush", href: "Atelier.dc.html" },
    { key: "invocations", label: "Invocations", icon: "prayer_times", href: "Safe%20Place.dc.html" },
    { key: "shop", label: "Boutique", icon: "shopping_bag", href: "Boutique.dc.html" }
  ];

  function mount() {
    var currentKey = document.body.getAttribute("data-km-section") || "today";
    var activeIndex = Math.max(0, items.findIndex(function (item) { return item.key === currentKey; }));
    var previousIndex = Number(sessionStorage.getItem("km-nav-index"));
    if (!Number.isFinite(previousIndex) || previousIndex < 0 || previousIndex >= items.length) previousIndex = activeIndex;

    document.body.classList.add("km-has-app-nav");
    document.querySelectorAll(".bottom-nav, .km-app-nav").forEach(function (oldNav) { oldNav.remove(); });

    var nav = document.createElement("nav");
    nav.className = "km-app-nav";
    nav.setAttribute("aria-label", "Navigation principale");
    nav.style.setProperty("--km-nav-index", previousIndex);
    nav.innerHTML = '<span class="km-nav-indicator" aria-hidden="true"></span>' + items.map(function (item, index) {
      var current = index === activeIndex ? ' aria-current="page"' : "";
      return '<a href="' + item.href + '" data-km-nav-index="' + index + '"' + current + '><span class="material-symbols-rounded" aria-hidden="true">' + item.icon + '</span><span>' + item.label + '</span></a>';
    }).join("");
    document.body.appendChild(nav);

    window.setTimeout(function () {
      document.documentElement.classList.remove("km-page-entering");
    }, 620);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        nav.style.setProperty("--km-nav-index", activeIndex);
        sessionStorage.setItem("km-nav-index", String(activeIndex));
      });
    });

    nav.addEventListener("click", function (event) {
      var link = event.target.closest("a[data-km-nav-index]");
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var nextIndex = Number(link.getAttribute("data-km-nav-index"));
      if (nextIndex === activeIndex) return;
      event.preventDefault();
      nav.classList.add("is-moving");
      nav.style.setProperty("--km-nav-index", nextIndex);
      sessionStorage.setItem("km-nav-index", String(nextIndex));
      sessionStorage.setItem(transitionKey, "1");
      document.documentElement.classList.add("km-page-leaving");
      document.body.classList.add("km-nav-leaving");
      var href = link.href;
      var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 390;
      window.setTimeout(function () { window.location.href = href; }, delay);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
