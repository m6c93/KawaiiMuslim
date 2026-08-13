(function () {
  "use strict";

  var transitionKey = "km-page-transition";
  var shellChild = new URLSearchParams(window.location.search).get("kmShell") === "1";
  var incomingTransition = sessionStorage.getItem(transitionKey);
  if (incomingTransition && !shellChild) {
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
    if (shellChild) {
      document.body.classList.add("km-shell-child");
      return;
    }
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
      nav.querySelectorAll("a[data-km-nav-index]").forEach(function (itemLink) {
        if (Number(itemLink.getAttribute("data-km-nav-index")) === nextIndex) itemLink.setAttribute("aria-current", "page");
        else itemLink.removeAttribute("aria-current");
      });
      sessionStorage.setItem("km-nav-index", String(nextIndex));
      var href = link.href;
      var target = new URL(href, window.location.href);
      target.searchParams.set("kmShell", "1");
      var oldFrame = document.querySelector(".km-page-frame.is-ready");
      if (oldFrame) oldFrame.classList.add("is-old");
      var frame = document.createElement("iframe");
      frame.className = "km-page-frame";
      frame.title = items[nextIndex].label;
      frame.src = target.href;
      frame.addEventListener("load", function () {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            frame.classList.add("is-ready");
            nav.classList.remove("is-moving");
            window.setTimeout(function () {
              if (oldFrame) oldFrame.remove();
            }, 280);
          });
        });
      }, { once: true });
      document.body.appendChild(frame);
      activeIndex = nextIndex;
      var cleanTarget = new URL(href, window.location.href);
      window.history.pushState({ kmSection: items[nextIndex].key }, "", cleanTarget.pathname + cleanTarget.search + cleanTarget.hash);
    });

    window.addEventListener("popstate", function () {
      window.location.reload();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
