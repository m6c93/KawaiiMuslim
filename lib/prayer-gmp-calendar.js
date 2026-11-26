'use strict';

const SOURCE_URL = 'https://www.grandemosqueedeparis.fr/horaire-des-prieres-paris';
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const plain = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const MONTH_PATTERN = new RegExp('\\b(' + MONTHS.map(plain).join('|') + ')\\s+(20\\d{2})\\b');
const MAX_BYTES = 2 * 1024 * 1024;
let cached = { items: [], expires: 0 };
let pending = null;

function parseImages(html) {
  const items = [];
  // Only actual image tags count; embedded script strings and comments do not.
  html = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const [tag] of html.matchAll(/<img\b[^>]{0,12000}>/gi)) {
    const attrs = {};
    let duplicate = false;
    // Consume every attribute so apparent src/alt text inside another value
    // cannot be mistaken for an attribute. Only quoted src/alt are accepted.
    for (const match of tag.matchAll(/\s+([^\s=<>/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = match[1].toLowerCase();
      if (key !== 'alt' && key !== 'src') continue;
      if (Object.hasOwn(attrs, key)) duplicate = true;
      attrs[key] = match[2] ?? match[3] ?? '';
    }
    if (duplicate || !attrs.alt || !attrs.src) continue;
    const alt = plain(attrs.alt);
    if (!/\bprieres?\b/.test(alt) || !/\bparis\b/.test(alt) || !/\bgmp\b/.test(alt)) continue;
    const date = alt.match(MONTH_PATTERN);
    if (!date) continue;
    let url;
    try { url = new URL(attrs.src); } catch { continue; }
    if (url.origin !== 'https://static.wixstatic.com' || url.username || url.password || url.search || url.hash) continue;
    const media = url.pathname.match(/^\/media\/([a-zA-Z0-9_~-]+\.(?:jpg|jpeg|png|webp))(?:\/v1\/[^<>]*)?$/i);
    if (!media) continue;
    const monthIndex = MONTHS.findIndex(month => plain(month) === date[1]);
    const month = date[2] + '-' + String(monthIndex + 1).padStart(2, '0');
    const lastDay = new Date(Date.UTC(Number(date[2]), monthIndex + 1, 0)).getUTCDate();
    items.push({ imageUrl: url.origin + '/media/' + media[1], month,
      label: MONTHS[monthIndex] + ' ' + date[2], validFrom: month + '-01', validUntil: month + '-' + lastDay });
  }
  return items;
}

async function download(signal) {
  // This fixed public page receives no visitor location, identifiers or headers.
  const response = await fetch(SOURCE_URL, { headers: { Accept: 'text/html' },
    signal, redirect: 'error', credentials: 'omit', cache: 'no-store' });
  if (!response.ok || !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') || '')
    || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) throw new Error('unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) throw new Error('too_large');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return parseImages(Buffer.concat(chunks, length).toString('utf8'));
}

async function refresh() {
  const controller = new AbortController();
  let timer;
  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 6000);
    });
    const items = await Promise.race([download(controller.signal), deadline]);
    cached = { items, expires: Date.now() + 15 * 60 * 1000 };
  } catch {
    // A brief negative cache prevents repeated requests during an upstream outage.
    cached = { items: [], expires: Date.now() + 60 * 1000 };
  } finally { clearTimeout(timer); controller.abort(); }
  return cached.items;
}

module.exports = async function officialCalendar(isoDate) {
  if (typeof isoDate !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const date = new Date(isoDate + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) return null;
  if (Date.now() >= cached.expires) {
    if (!pending) pending = refresh().finally(() => { pending = null; });
    await pending;
  }
  const item = cached.items.find(entry => entry.month === isoDate.slice(0, 7));
  return item ? { ...item } : null;
};
