(function () {
  "use strict";

  var localPreview = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    && new URLSearchParams(window.location.search).get("preview") === "1";
  if (!localPreview) {
    document.documentElement.style.visibility = "hidden";
    var accessGate = document.createElement("script");
    accessGate.src = "../km-access-gate.js?v=subscription-live-1";
    accessGate.onerror = function () { document.documentElement.style.visibility = "visible"; };
    document.head.appendChild(accessGate);
  }

  var multiTouchGesture = false;

  document.addEventListener("touchstart", function (event) {
    if (event.touches.length > 1) multiTouchGesture = true;
  }, { capture: true, passive: true });

  document.addEventListener("touchmove", function (event) {
    if (event.touches.length > 1) multiTouchGesture = true;
  }, { capture: true, passive: true });

  document.addEventListener("touchend", function (event) {
    if (!multiTouchGesture) return;
    event.stopImmediatePropagation();
    if (event.touches.length === 0) {
      window.setTimeout(function () { multiTouchGesture = false; }, 0);
    }
  }, { capture: true, passive: true });

  document.addEventListener("touchcancel", function () {
    multiTouchGesture = false;
  }, { capture: true, passive: true });
})();
