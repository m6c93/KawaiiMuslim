const header = document.querySelector('[data-header]');
const planSelect = document.querySelector('#plan');
const status = document.querySelector('#formStatus');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const parallaxZones = [...document.querySelectorAll('.hero, .intro')];
const root = document.documentElement;

const updateScroll = () => {
  header?.classList.toggle('scrolled', scrollY > 12);
  const pageHeight = document.documentElement.scrollHeight - innerHeight;
  header?.style.setProperty('--scroll-progress', `${pageHeight > 0 ? (scrollY / pageHeight) * 100 : 0}%`);
  if (!reducedMotion) {
    const scenicScroll = Math.min(scrollY, 2400);
    root.style.setProperty('--world-far', `${scenicScroll * -.022}px`);
    root.style.setProperty('--world-mid', `${scenicScroll * -.052}px`);
    root.style.setProperty('--world-near', `${scenicScroll * -.105}px`);
    parallaxZones.forEach(zone => {
      const bounds = zone.getBoundingClientRect();
      const offset = (bounds.top + bounds.height / 2 - innerHeight / 2) * -.11;
      zone.style.setProperty('--parallax-y', `${offset}px`);
      zone.style.setProperty('--parallax-y-inverse', `${offset * -.62}px`);
      zone.style.setProperty('--parallax-near', `${offset * 1.45}px`);
      zone.style.setProperty('--parallax-mid', `${offset * -.82}px`);
      zone.style.setProperty('--parallax-far', `${offset * .42}px`);
    });
  }
};
addEventListener('scroll', updateScroll, { passive: true });
updateScroll();

const reveal = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      reveal.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(element => reveal.observe(element));

document.querySelector('#licenceForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const prepared = { ...data, createdAt: new Date().toISOString() };
  localStorage.setItem('km-coran-licence-request-v1', JSON.stringify(prepared));
  status.className = 'form-status success';
  status.textContent = `Votre demande pour la licence ${data.plan} est prête. L’envoi sera activé avec l’espace commercial sécurisé.`;
  event.currentTarget.querySelector('button[type="submit"]').textContent = 'Demande préparée ✓';
});

const flowSteps = [...document.querySelectorAll('.learning-flow .flow-step')];
flowSteps.forEach((step, index) => step.style.setProperty('--delay', `${index * 80}ms`));

if (!reducedMotion && flowSteps.length) {
  let activeStep = 0;
  let flowTimer;
  const showStep = index => {
    flowSteps.forEach((step, stepIndex) => step.classList.toggle('is-active', stepIndex === index));
  };
  const flowObserver = new IntersectionObserver(([entry]) => {
    clearInterval(flowTimer);
    if (!entry.isIntersecting) return;
    showStep(activeStep);
    flowTimer = setInterval(() => {
      activeStep = (activeStep + 1) % flowSteps.length;
      showStep(activeStep);
    }, 1900);
  }, { threshold: 0.25 });
  flowObserver.observe(document.querySelector('.learning-flow'));

  if (matchMedia('(pointer:fine)').matches) {
    flowSteps.forEach(card => {
      card.addEventListener('pointermove', event => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        card.style.setProperty('--ry', `${(x - .5) * 5}deg`);
        card.style.setProperty('--rx', `${(.5 - y) * 5}deg`);
        card.style.setProperty('--glow-x', `${x * 100}%`);
        card.style.setProperty('--glow-y', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });

    const heroVisual = document.querySelector('.hero-visual');
    heroVisual?.classList.add('motion');
    heroVisual?.addEventListener('pointermove', event => {
      const bounds = heroVisual.getBoundingClientRect();
      heroVisual.style.setProperty('--hero-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 12}px`);
      heroVisual.style.setProperty('--hero-y', `${((event.clientY - bounds.top) / bounds.height - .5) * 10}px`);
    });
    heroVisual?.addEventListener('pointerleave', () => {
      heroVisual.style.setProperty('--hero-x', '0px');
      heroVisual.style.setProperty('--hero-y', '0px');
    });
  }
}

if (!reducedMotion && matchMedia('(pointer:fine)').matches) {
  addEventListener('pointermove', event => {
    const x = (event.clientX / innerWidth - .5) * 18;
    const y = (event.clientY / innerHeight - .5) * 14;
    root.style.setProperty('--world-pointer-x', `${x * .85}px`);
    root.style.setProperty('--world-pointer-y', `${y * .65}px`);
    root.style.setProperty('--world-pointer-x-far', `${x * .16}px`);
    root.style.setProperty('--world-pointer-y-far', `${y * .12}px`);
    root.style.setProperty('--world-pointer-x-mid', `${x * -.34}px`);
    root.style.setProperty('--world-pointer-y-mid', `${y * -.2}px`);
    root.style.setProperty('--world-pointer-x-near', `${x * 1.05}px`);
    root.style.setProperty('--world-pointer-x-near-inverse', `${x * -1.05}px`);
    root.style.setProperty('--world-pointer-y-near', `${y * .72}px`);
    parallaxZones.forEach(zone => {
      zone.style.setProperty('--parallax-x', `${x}px`);
      zone.style.setProperty('--parallax-x-inverse', `${x * -.65}px`);
      zone.style.setProperty('--pointer-y', `${y}px`);
      zone.style.setProperty('--pointer-y-inverse', `${y * -.55}px`);
    });
  }, { passive: true });
}
