(function () {
  "use strict";

  var shellChild = new URLSearchParams(window.location.search).get("kmShell") === "1";
  var localPreview = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    && new URLSearchParams(window.location.search).get("preview") === "1";
  var guestMode = new URLSearchParams(window.location.search).get("guest") === "1"
    || sessionStorage.getItem("km-guest-mode") === "1";
  var guestPaths = new Set([
    "/Aujourd'hui.dc.html",
    "/Bibliotheque Kawaii Muslim.dc.html",
    "/Atelier.dc.html",
    "/Safe Place.dc.html",
    "/Applications.dc.html",
    "/LivreColoriage.dc.html",
    "/Coloriage.dc.html"
  ]);
  function preserveDiscoveryMode(href) {
    var target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) return href;
    if (guestMode && guestPaths.has(decodeURIComponent(target.pathname))) target.searchParams.set("guest", "1");
    if (localPreview && (guestPaths.has(decodeURIComponent(target.pathname)) || target.pathname === "/applications/coran/")) target.searchParams.set("preview", "1");
    var previewTheme = new URLSearchParams(window.location.search).get("theme");
    if (localPreview && (previewTheme === "boy" || previewTheme === "girl") && guestPaths.has(decodeURIComponent(target.pathname))) target.searchParams.set("theme", previewTheme);
    return target.href;
  }
  var items = [
    { key: "today", label: "Aujourd’hui", icon: "home", href: "Aujourd%27hui.dc.html" },
    { key: "library", label: "Bibliothèque", icon: "menu_book", href: "Bibliotheque%20Kawaii%20Muslim.dc.html" },
    { key: "workshop", label: "Atelier", icon: "brush", href: "Atelier.dc.html" },
    { key: "invocations", label: "Safe Place", icon: "prayer_times", href: "Safe%20Place.dc.html" },
    { key: "apps", label: "Applications", icon: "apps", href: "Applications.dc.html" }
  ];

  function mount() {
    if (shellChild) {
      document.body.classList.add("km-shell-child");
      return;
    }
    var currentKey = document.body.getAttribute("data-km-section") || "today";
    var activeIndex = Math.max(0, items.findIndex(function (item) { return item.key === currentKey; }));
    document.body.classList.add("km-has-app-nav");
    document.querySelectorAll(".bottom-nav, .km-app-nav").forEach(function (oldNav) { oldNav.remove(); });

    var nav = document.createElement("nav");
    nav.className = "km-app-nav";
    nav.setAttribute("aria-label", "Navigation principale");
    nav.style.setProperty("--km-nav-index", activeIndex);
    nav.innerHTML = '<span class="km-nav-indicator" aria-hidden="true"></span>' + items.map(function (item, index) {
      var current = index === activeIndex ? ' aria-current="page"' : "";
      return '<a href="' + preserveDiscoveryMode(item.href) + '" data-km-nav-index="' + index + '"' + current + '><span class="material-symbols-rounded" aria-hidden="true">' + item.icon + '</span><span>' + item.label + '</span></a>';
    }).join("");
    document.body.appendChild(nav);
    if (guestMode || localPreview) {
      document.querySelectorAll('a[href]').forEach(function (link) {
        link.href = preserveDiscoveryMode(link.getAttribute('href'));
      });
    }
    if (guestMode) {
      var guestPill = document.createElement("a");
      guestPill.className = "km-guest-pill";
      guestPill.href = "index.html#tarifs";
      guestPill.innerHTML = '<b>Mode découverte</b><span>Débloquer tout</span>';
      document.body.appendChild(guestPill);
    }

    items.forEach(function (item, index) {
      if (index === activeIndex) return;
      var preload = document.createElement("link");
      preload.rel = "prefetch";
      preload.as = "document";
      var preloadTarget = new URL(item.href, window.location.href);
      if (localPreview) preloadTarget.searchParams.set("preview", "1");
      if (guestMode) preloadTarget.searchParams.set("guest", "1");
      preload.href = preloadTarget.href;
      document.head.appendChild(preload);
    });

    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin || !event.data || event.data.type !== "km-reader-mode") return;
      var active = Boolean(event.data.active);
      document.body.classList.toggle("km-immersive-reader", active);
      nav.setAttribute("aria-hidden", active ? "true" : "false");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
