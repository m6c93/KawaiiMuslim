(function () {
  "use strict";

  var intro = document.getElementById("kmLaunchIntro");
  var video = document.getElementById("kmLaunchVideo");
  var videoWrap = document.getElementById("kmLaunchVideoWrap");
  if (!intro || !video || !videoWrap) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tabletMode = window.matchMedia("(max-width: 1400px), (hover: none), (pointer: coarse)").matches;
  var leaving = false;
  var safetyTimer = 0;

  document.body.classList.add("km-launch-playing");

  function revealSite() {
    if (leaving) return;
    leaving = true;
    window.clearTimeout(safetyTimer);
    intro.classList.add("is-leaving");
    window.setTimeout(function () {
      intro.remove();
      document.body.classList.remove("km-launch-playing");
    }, reducedMotion ? 0 : 430);
  }

  video.addEventListener("loadedmetadata", function () {
    video.classList.toggle("is-transparent", /\.webm(?:$|\?)/i.test(video.currentSrc));
  });
  video.addEventListener("ended", revealSite);
  video.addEventListener("playing", function () {
    window.clearTimeout(safetyTimer);
    safetyTimer = window.setTimeout(revealSite, 11000);
  });
  video.addEventListener("error", function () {
    if (!tabletMode) videoWrap.classList.add("is-failed");
    safetyTimer = window.setTimeout(revealSite, 2100);
  });

  if (reducedMotion) {
    safetyTimer = window.setTimeout(revealSite, 350);
    return;
  }

  video.muted = false;
  var playback = video.play();
  if (playback && typeof playback.catch === "function") {
    playback.catch(function () {
      video.muted = true;
      video.play().catch(function () {
        if (!tabletMode) videoWrap.classList.add("is-failed");
        safetyTimer = window.setTimeout(revealSite, 2100);
      });
    });
  }
  safetyTimer = window.setTimeout(revealSite, 11000);
})();

