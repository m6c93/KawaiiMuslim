(() => {
  const tabs = [...document.querySelectorAll("[data-panel]")];
  const panels = [...document.querySelectorAll("[data-panel-content]")];
  const showPanel = name => {
    tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.panel === name));
    panels.forEach(panel => {
      const active = panel.dataset.panelContent === name;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    document.querySelector(`[data-panel-content="${name}"]`)?.scrollIntoView({behavior:"smooth",block:"start"});
  };
  tabs.forEach(tab => tab.addEventListener("click", () => showPanel(tab.dataset.panel)));

  const pageSources = [1,2,3,4].map(number => `brand/books/miracles-du-coran/page-${String(number).padStart(2,"0")}.jpg`);
  const pageImage = document.getElementById("bookPage");
  const pageCounter = document.getElementById("bookCounter");
  const progress = document.getElementById("bookProgress");
  const previous = document.getElementById("bookPrev");
  const next = document.getElementById("bookNext");
  let pageIndex = 0;
  const renderPage = () => {
    pageImage.parentElement.classList.add("changing");
    setTimeout(() => {
      pageImage.src = pageSources[pageIndex];
      pageImage.alt = `Page ${pageIndex + 1} du livre Les Miracles du Coran`;
      pageCounter.textContent = `Page ${pageIndex + 1} sur 4`;
      progress.style.width = `${(pageIndex + 1) * 25}%`;
      previous.disabled = pageIndex === 0;
      pageImage.parentElement.classList.remove("changing");
    }, 130);
  };
  previous.addEventListener("click", () => { if(pageIndex > 0){ pageIndex -= 1; renderPage(); } });
  next.addEventListener("click", () => {
    if(pageIndex < pageSources.length - 1){ pageIndex += 1; renderPage(); }
    else document.getElementById("plansModal").showModal();
  });
  let touchStart = 0;
  pageImage.addEventListener("touchstart", event => { if(event.touches.length === 1) touchStart = event.touches[0].clientX; }, {passive:true});
  pageImage.addEventListener("touchend", event => {
    const distance = event.changedTouches[0].clientX - touchStart;
    if(Math.abs(distance) < 55) return;
    (distance < 0 ? next : previous).click();
  }, {passive:true});
  renderPage();

  const canvas = document.getElementById("demoCanvas");
  const context = canvas.getContext("2d");
  const canvasImage = new Image();
  canvasImage.src = "brand/assets/coloring-armure-lumiere.png";
  let drawColor = "#ef6fa9";
  let drawing = false;
  const resetCanvas = () => {
    context.clearRect(0,0,canvas.width,canvas.height);
    context.save();
    context.filter = "grayscale(1) contrast(.82) brightness(1.15)";
    context.globalAlpha = .45;
    context.drawImage(canvasImage,0,0,canvas.width,canvas.height);
    context.restore();
  };
  canvasImage.addEventListener("load", resetCanvas);
  const point = event => {
    const rectangle = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return {x:(source.clientX - rectangle.left) * canvas.width / rectangle.width,y:(source.clientY - rectangle.top) * canvas.height / rectangle.height};
  };
  const begin = event => { drawing = true; const p = point(event); context.beginPath(); context.moveTo(p.x,p.y); event.preventDefault(); };
  const draw = event => {
    if(!drawing) return;
    const p = point(event);
    context.lineTo(p.x,p.y);
    context.strokeStyle = drawColor;
    context.lineWidth = 34;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalAlpha = .78;
    context.stroke();
    context.globalAlpha = 1;
    event.preventDefault();
  };
  const end = () => { drawing = false; context.closePath(); };
  canvas.addEventListener("pointerdown", begin);
  canvas.addEventListener("pointermove", draw);
  window.addEventListener("pointerup", end);
  document.querySelectorAll(".swatch").forEach(swatch => swatch.addEventListener("click", () => {
    drawColor = swatch.dataset.color;
    document.querySelectorAll(".swatch").forEach(item => item.classList.toggle("active", item === swatch));
  }));
  document.getElementById("clearCanvas").addEventListener("click", resetCanvas);

  const duas = {
    yunus:{context:"Quand tout devient trop lourd",arabic:"لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",phonetic:"Lâ ilâha illâ Anta, subhânaka innî kuntu mina-dh-dhâlimîn.",translation:"Il n’est de divinité que Toi. Gloire à Toi ! J’ai vraiment été du nombre des injustes.",audio:"audio/safe-place/yunus.mp3",source:"https://quran.com/21/87"},
    children:{context:"Pour protéger mes enfants",arabic:"أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ",phonetic:"A‘ûdhu bi-kalimâti-llâhi-t-tâmmah, min kulli shaytânin wa hâmmah, wa min kulli ‘aynin lâmmah.",translation:"Je cherche protection par les paroles parfaites d’Allah contre tout démon, toute créature nuisible et tout mauvais œil.",audio:"audio/safe-place/children.mp3",source:"https://sunnah.com/bukhari:3371"}
  };
  let activeDua = "yunus";
  let audio = new Audio();
  const renderDua = () => {
    const dua = duas[activeDua];
    document.getElementById("duaContext").textContent = dua.context;
    document.getElementById("duaArabic").textContent = dua.arabic;
    document.getElementById("duaPhonetic").textContent = dua.phonetic;
    document.getElementById("duaTranslation").textContent = dua.translation;
    document.getElementById("duaSource").href = dua.source;
    audio.pause(); audio = new Audio(dua.audio);
    audio.addEventListener("ended", () => { document.getElementById("playDua").querySelector("span").textContent = "▶"; });
    document.getElementById("playDua").querySelector("span").textContent = "▶";
  };
  document.querySelectorAll(".dua-choice").forEach(choice => choice.addEventListener("click", () => {
    activeDua = choice.dataset.dua;
    document.querySelectorAll(".dua-choice").forEach(item => item.classList.toggle("active", item === choice));
    renderDua();
  }));
  document.getElementById("playDua").addEventListener("click", () => {
    if(audio.paused){ audio.play(); document.getElementById("playDua").querySelector("span").textContent = "Ⅱ"; }
    else { audio.pause(); document.getElementById("playDua").querySelector("span").textContent = "▶"; }
  });
  renderDua();

  const modal = document.getElementById("plansModal");
  document.querySelectorAll("[data-open-plans]").forEach(button => button.addEventListener("click", () => modal.showModal()));
  document.getElementById("closePlans").addEventListener("click", () => modal.close());
  modal.addEventListener("click", event => { if(event.target === modal) modal.close(); });
})();
