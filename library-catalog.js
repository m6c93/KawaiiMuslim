(() => {
  'use strict';

  const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘ʼ]/g, "'").toLocaleLowerCase('fr');
  const storageKey = scope => 'km-library-return:' + scope;

  function highlight(value, term) {
    const text = String(value || '');
    if (!term) return [{text, style: ''}];
    const letters = Array.from(text);
    const offsets = [];
    let folded = '';
    for (let i = 0; i < letters.length; i++) {
      const part = normalize(letters[i]);
      for (let j = 0; j < part.length; j++) offsets.push(i);
      folded += part;
    }
    const parts = [];
    let offset = 0;
    for (let match = folded.indexOf(term); match >= 0; match = folded.indexOf(term, match + term.length)) {
      const start = offsets[match];
      let end = offsets[match + term.length - 1] + 1;
      while (end < letters.length && /^\p{M}$/u.test(letters[end])) end++;
      if (start > offset) parts.push({text: letters.slice(offset, start).join(''), style: ''});
      parts.push({text: letters.slice(start, end).join(''), style: 'km-library-match'});
      offset = end;
    }
    if (offset < letters.length || !parts.length) parts.push({text: letters.slice(offset).join(''), style: ''});
    return parts;
  }

  function search(books, query) {
    const term = normalize(query.trim());
    const results = [];
    for (const book of books) {
      const titleParts = highlight(book.title, term);
      const subParts = highlight(book.sub, term);
      if (!term || titleParts.some(part => part.style) || subParts.some(part => part.style)) {
        results.push({...book, titleParts, subParts});
      }
    }
    const count = results.length;
    const status = count ? count + (count === 1 ? ' livre trouvé' : ' livres trouvés') : 'Aucun livre trouvé';
    return {books: results, searching: Boolean(term), status: term ? status : ''};
  }

  function remember(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[data-library-target]');
    const scope = link?.closest('[data-library-scope]')?.dataset.libraryScope;
    if (!scope || link.target === '_blank') return;
    const state = {
      query: document.getElementById('librarySearch')?.value || '',
      target: link.dataset.libraryTarget,
      scroll: window.scrollY,
      shelfScroll: document.querySelector('.km-library-scroll')?.scrollTop || 0
    };
    try { sessionStorage.setItem(storageKey(scope), JSON.stringify(state)); } catch {}
  }

  function takeReturn(scope) {
    try {
      const key = storageKey(scope);
      const saved = JSON.parse(sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
      if (typeof saved?.query === 'string' && typeof saved.target === 'string') return saved;
    } catch {}
    return null;
  }

  function whenVisible(callback) {
    const frame = window.frameElement;
    if (frame?.classList.contains('km-app-view') && !frame.classList.contains('is-active')) {
      document.addEventListener('km-app-active', () => requestAnimationFrame(callback), {once: true});
    } else {
      requestAnimationFrame(callback);
    }
  }

  function restoreView(saved) {
    whenVisible(() => {
      const links = document.querySelectorAll('#dc-root a[data-library-target]');
      const link = Array.from(links).find(item => item.dataset.libraryTarget === saved.target);
      if (link) link.focus({preventScroll: true});
      const shelf = document.querySelector('#dc-root .km-library-scroll');
      if (shelf) shelf.scrollTop = saved.shelfScroll || 0;
      window.scrollTo(0, saved.scroll || 0);
    });
  }

  function focusAnchor() {
    whenVisible(() => {
      let anchor = window.location.hash.slice(1);
      if (!anchor && window.frameElement?.classList.contains('km-app-view')) {
        anchor = new URLSearchParams(window.parent.location.search).get('anchor') || '';
      }
      if (!anchor.startsWith('livre-')) return;
      const card = document.getElementById(anchor);
      if (!card?.classList.contains('km-book-item')) return;
      card.scrollIntoView({block: 'center'});
      card.querySelector('a, button')?.focus({preventScroll: true});
    });
  }

  // Capture before guest routing and the shell can intercept the book link.
  window.addEventListener('click', remember, true);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    const scope = document.querySelector('#dc-root [data-library-scope]')?.dataset.libraryScope;
    const saved = scope && takeReturn(scope);
    if (saved) restoreView(saved);
  });
  window.KMLibraryCatalog = {search, takeReturn, restoreView, focusAnchor};
})();
