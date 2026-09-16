const header = document.querySelector('[data-header]');
const planSelect = document.querySelector('#plan');
const status = document.querySelector('#formStatus');

addEventListener('scroll', () => header?.classList.toggle('scrolled', scrollY > 12), { passive: true });

const reveal = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      reveal.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(element => reveal.observe(element));

document.querySelector('#licenceForm').addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const prepared = { ...data, createdAt: new Date().toISOString() };
  localStorage.setItem('km-coran-licence-request-v1', JSON.stringify(prepared));
  status.className = 'form-status success';
  status.textContent = `Votre demande pour la licence ${data.plan} est prête. L’envoi sera activé avec l’espace commercial sécurisé.`;
  event.currentTarget.querySelector('button[type="submit"]').textContent = 'Demande préparée ✓';
});
