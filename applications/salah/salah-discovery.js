(function () {
  "use strict";

  // Keep old bookmarks and cached discovery pages pointing to the full, free app.
  if (window.__salahFreeRedirect) return;
  if (!/\/applications\/salah\/decouverte(?:\.html)?\/?$/.test(window.location.pathname)) return;
  window.__salahFreeRedirect = true;

  var destination = new URL("/applications/salah/", window.location.href);
  destination.search = window.location.search;
  destination.hash = window.location.hash;
  window.location.replace(destination.href);
})();
