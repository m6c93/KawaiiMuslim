(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  const prophets = path.startsWith('/prophetes');
  const game = path.startsWith('/applications/mimi');
  const params = new URLSearchParams(location.search);
  let referrer;
  try {
    const url = new URL(document.referrer);
    if (url.origin === location.origin) referrer = url;
  } catch {}
  function section(url) {
    if (!url) return null;
    const p = decodeURIComponent(url.pathname).toLowerCase();
    if (/^\/applications\.dc(?:\.html)?$/.test(p)) return 'apps';
    if (/^\/aujourd(?:'|-)hui\.dc(?:\.html)?$/.test(p)) return 'today';
    if (/^\/application\.dc(?:\.html)?$/.test(p)) return url.searchParams.get('section');
    return null;
  }
  let shellUrl;
  try {
    if (parent !== window && parent.KMAppShell) shellUrl = new URL(parent.location.href);
  } catch {}
  // The landing page embeds a small playable sample with its own navigation.
  if (game && parent !== window && !shellUrl &&
      (window.frameElement?.hasAttribute('data-mimi-arabic') || referrer?.pathname === '/presentation.html')) return;
  const origin = [params.get('from'), section(referrer), section(shellUrl)]
    .find(value => value === 'apps' || value === 'today') || 'apps';
  let guest = [params, referrer?.searchParams, shellUrl?.searchParams].some(p => p?.get('guest') === '1');
  const preview = [params, referrer?.searchParams, shellUrl?.searchParams].some(p => p?.get('preview') === '1');
  try {
    guest ||= sessionStorage.getItem('km-guest-mode') === '1';
    // A first visit through a public shared link should return to the discovery
    // catalogue. Never read credentials or use this routing hint to grant access.
    if (!guest && !preview && !section(referrer) && !shellUrl && !window.webkit?.messageHandlers?.kmShell) {
      const hasAccount = Object.keys(localStorage).some(k => /^sb-[\w-]+-auth-token$/.test(k) || k === 'km-active-profile-v2');
      guest = !hasAccount;
    }
  } catch {}
  function withMode(url) {
    if (guest) url.searchParams.set('guest', '1');
    if (preview) url.searchParams.set('preview', '1');
    const theme = params.get('theme') || referrer?.searchParams.get('theme') || shellUrl?.searchParams.get('theme');
    if (theme === 'boy' || theme === 'girl') url.searchParams.set('theme', theme);
    return url;
  }
  const home = withMode(new URL(origin === 'today' ? '/Aujourd%27hui.dc.html' : '/Applications.dc.html', location.origin));
  home.hash = origin === 'today' ? (prophets ? 'weeklyProphet' : game ? '' : 'newSalat')
    : prophets ? 'app-prophets' : game ? 'app-mimi' : 'app-salah';
  const label = origin === 'today' ? 'Aujourd’hui' : 'Applications';
  if (prophets) {
    const collection = withMode(new URL('/prophetes/', location.origin));
    collection.searchParams.set('from', origin);
    document.getElementById('back').href = collection.href;
  }
  if (game) {
    const exit = document.createElement('a');
    exit.id = 'kmGameExit';
    exit.setAttribute('aria-label', 'Quitter le jeu et revenir à ' + label);
    exit.textContent = '← Quitter';
    exit.href = home.href;
    document.body.append(exit);
    const root = document.documentElement;
    const native = Boolean(window.webkit?.messageHandlers?.kmShell);
    root.classList.add('km-mimi-layout');
    root.classList.toggle('km-mimi-native', native);
    const compact = matchMedia('(max-width: 700px), (orientation: landscape) and (max-height: 600px)');
    function adapt() {
      root.classList.toggle('km-mimi', native || compact.matches);
    }
    adapt();
    compact.addEventListener('change', adapt);
    return;
  }
  document.querySelectorAll('a[data-activity-return]').forEach(link => {
    link.href = home.href;
    const text = link.querySelector('[data-return-label]');
    if (text) text.textContent = label;
  });
})();
