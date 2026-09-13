(function () {
  "use strict";

  var profileKey = "km-active-profile-v2";
  var params = new URLSearchParams(window.location.search);
  var previewTheme = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    ? params.get("theme")
    : "";

  function activeGender() {
    if (previewTheme === "boy" || previewTheme === "girl") return previewTheme;
    try {
      var profile = JSON.parse(localStorage.getItem(profileKey));
      if (profile && profile.type === "child") {
        if (profile.gender === "boy" || profile.avatar === "👦") return "boy";
      }
    } catch (error) {}
    return "girl";
  }

  function apply() {
    var gender = activeGender();
    document.documentElement.dataset.kmGender = gender;
    if (!document.body) return;
    document.body.dataset.kmGender = gender;

    document.querySelectorAll("img[data-boy-src]").forEach(function (image) {
      if (!image.dataset.girlSrc) image.dataset.girlSrc = image.getAttribute("src");
      if (!image.dataset.girlAlt) image.dataset.girlAlt = image.getAttribute("alt") || "";
      image.src = gender === "boy" ? image.dataset.boySrc : image.dataset.girlSrc;
      image.alt = gender === "boy" ? (image.dataset.boyAlt || image.dataset.girlAlt) : image.dataset.girlAlt;
    });

    document.querySelectorAll("[data-boy-text]").forEach(function (element) {
      if (!element.dataset.girlText) element.dataset.girlText = element.textContent;
      element.textContent = gender === "boy" ? element.dataset.boyText : element.dataset.girlText;
    });
  }

  document.documentElement.dataset.kmGender = activeGender();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
  if ("MutationObserver" in window) {
    var pending = false;
    new MutationObserver(function (changes) {
      if (pending || !changes.some(function (change) { return change.addedNodes.length; })) return;
      pending = true;
      window.setTimeout(function () { pending = false; apply(); }, 0);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  window.addEventListener("storage", function (event) { if (event.key === profileKey) apply(); });
  window.KMChildTheme = { apply: apply, gender: activeGender };
})();
