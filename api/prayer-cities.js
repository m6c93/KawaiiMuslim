'use strict';

const catalogue = require('../data/prayer-fr-cities.json');
const REQUEST_KEYS = new Set(['query', 'scope']);
const MAX_RESULTS = 6;
const WORLD_CACHE_LIMIT = 64;
const WORLD_CACHE_TTL = 15 * 60 * 1000;
const worldCache = new Map();
const countryCodes = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ '
  + 'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ '
  + 'EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY '
  + 'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ '
  + 'LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '
  + 'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
  + 'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ '
  + 'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' '));

function normalize(value) {
  return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte');
}

const frenchCities = catalogue.cities.map(row => {
  const name = normalize(row[1]);
  const key = name.replace(/ /g, '');
  const shortKey = name.replace(/\bsaint\b/g, 'st').replace(/\bsainte\b/g, 'ste').replace(/ /g, '');
  return { row, key, shortKey };
});
const collator = new Intl.Collator('fr', { sensitivity: 'base' });

function isSameOrigin(headers) {
  const site = headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  // Native clients may omit both Origin and Fetch Metadata.
  if (headers.origin === undefined) return true;
  if (typeof headers.origin !== 'string' || typeof headers.host !== 'string') return false;
  if (headers.origin.length > 512 || headers.host.length > 255) return false;
  try {
    const origin = new URL(headers.origin);
    const target = new URL('https://' + headers.host);
    return headers.origin === origin.origin && origin.protocol === 'https:'
      && !target.username && !target.password && target.pathname === '/' && !target.search && !target.hash
      && origin.origin === target.origin;
  } catch { return false; }
}

function readRequest(body) {
  if (typeof body === 'string') {
    if (body.length > 2048) return null;
    try { body = JSON.parse(body); } catch { return null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !REQUEST_KEYS.has(key))
    || !Object.hasOwn(body, 'query') || typeof body.query !== 'string' || body.query.length > 512
    || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(body.query)) return null;
  const query = body.query.normalize('NFC').trim();
  if ([...query].length > 120 || !/^[\p{L}\p{M}\p{N}\p{Zs}\p{Pd}.'’‘(),/&]+$/u.test(query)
    || normalize(query).replace(/ /g, '').length < 2) return null;
  const scope = body.scope === undefined ? 'fr' : body.scope;
  if (scope !== 'fr' && scope !== 'world') return null;
  return { query, scope };
}

// Bounded edit distance also accepts one adjacent letter transposition.
function editDistance(a, b, maximum) {
  if (Math.abs(a.length - b.length) > maximum) return maximum + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let beforePrevious;
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
      }
      minimum = Math.min(minimum, current[j]);
    }
    if (minimum > maximum) return maximum + 1;
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

function searchFrance(query) {
  let name = normalize(query).replace(/(?:^| )(?:france|fr)$/, '').trim();
  const postcodeMatch = name.match(/(\d{2,5})$/);
  const postcode = postcodeMatch ? postcodeMatch[1] : '';
  if (postcodeMatch) name = name.slice(0, postcodeMatch.index).trim();
  const key = name.replace(/ /g, '');
  if (!key && !postcode) return [];
  const maximum = key.length >= 9 ? 2 : key.length >= 4 ? 1 : 0;
  const matches = [];
  for (const city of frenchCities) {
    if (postcode && !city.row[6].some(value => value.startsWith(postcode))) continue;
    let quality = 0;
    let distance = 0;
    if (key && key !== city.key && key !== city.shortKey) {
      if (city.key.startsWith(key) || city.shortKey.startsWith(key)) quality = 1;
      else {
        if (!maximum) continue;
        distance = editDistance(key, city.key, maximum);
        if (city.shortKey !== city.key) distance = Math.min(distance, editDistance(key, city.shortKey, maximum));
        if (distance > maximum) continue;
        quality = 2;
      }
    }
    matches.push({ row: city.row, quality, distance });
  }
  matches.sort((a, b) => a.quality - b.quality || a.distance - b.distance
    || b.row[5] - a.row[5] || collator.compare(a.row[1], b.row[1]) || a.row[0].localeCompare(b.row[0]));
  return matches.slice(0, MAX_RESULTS).map(({ row }) => ({
    id: 'fr:' + row[0],
    label: row[1] + ' · ' + catalogue.departments[row[2]] + ' (' + row[2] + '), France',
    latitude: row[4], longitude: row[3], countryCode: 'FR', departmentCode: row[2]
  }));
}

function cleanText(value, maximum) {
  if (typeof value !== 'string' || value.length > maximum * 2
    || /[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)) return null;
  const text = value.normalize('NFC').trim();
  if (!text || [...text].length > maximum) return null;
  return text;
}

function worldResults(payload) {
  if (!payload || !Array.isArray(payload.features) || payload.features.length > 100) return null;
  const places = [];
  for (const feature of payload.features) {
    const properties = feature && feature.properties;
    const coordinates = feature && feature.geometry && feature.geometry.coordinates;
    if (!properties || properties.type !== 'city' || !feature.geometry || feature.geometry.type !== 'Point'
      || !Array.isArray(coordinates) || coordinates.length !== 2
      || !coordinates.every(value => typeof value === 'number' && Number.isFinite(value))
      || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90
      || !['N', 'W', 'R'].includes(properties.osm_type)
      || !Number.isSafeInteger(properties.osm_id) || properties.osm_id <= 0) continue;
    const name = cleanText(properties.name, 100);
    const country = cleanText(properties.country, 80);
    const countryCode = typeof properties.countrycode === 'string' ? properties.countrycode.toUpperCase() : '';
    if (!name || !country || !countryCodes.has(countryCode)) continue;
    const county = cleanText(properties.county, 100);
    const state = cleanText(properties.state, 100);
    const context = [county, state, country].filter((value, index, values) => value
      && normalize(value) !== normalize(name) && values.findIndex(other => other && normalize(other) === normalize(value)) === index);
    // Keep the country visible even when it has the same name as the city.
    if (!context.includes(country)) context.push(country);
    const result = {
      id: 'osm:' + properties.osm_type + properties.osm_id,
      label: name + ' · ' + context.join(', '),
      latitude: coordinates[1], longitude: coordinates[0], countryCode
    };
    const key = [name, countryCode, county || '', state || ''].map(normalize).join('|');
    const isPlace = properties.osm_key === 'place';
    const existing = places.find(place => {
      if (place.result.id === result.id) return true;
      if (place.key !== key) return false;
      const north = (place.result.latitude - result.latitude) * 111;
      const east = (place.result.longitude - result.longitude) * 111
        * Math.cos((place.result.latitude + result.latitude) * Math.PI / 360);
      const maximumKm = place.isPlace !== isPlace ? 25 : 1;
      return north * north + east * east <= maximumKm * maximumKm;
    });
    // Photon can return a settlement and its administrative boundary twice.
    if (!existing) places.push({ result, isPlace, key });
    else if (isPlace && !existing.isPlace) Object.assign(existing, { result, isPlace, key });
  }
  return places.slice(0, MAX_RESULTS).map(place => place.result);
}

async function searchWorld(query) {
  const key = query.toLowerCase().replace(/\s+/g, ' ');
  const cached = worldCache.get(key);
  if (cached && cached.expires > Date.now()) {
    worldCache.delete(key);
    worldCache.set(key, cached);
    return cached.results;
  }
  worldCache.delete(key);
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('layer', 'city');
  url.searchParams.set('limit', '12');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url.href, {
      headers: { Accept: 'application/json', 'User-Agent': 'KawaiiMuslimWorld/1.0 (https://www.kawaiimuslimworld.com)' },
      signal: controller.signal, redirect: 'error', cache: 'no-store'
    });
    if (!response.ok) throw new Error('cities_unavailable');
    const results = worldResults(await response.json());
    if (!results) throw new Error('cities_unavailable');
    worldCache.set(key, { results, expires: Date.now() + WORLD_CACHE_TTL });
    if (worldCache.size > WORLD_CACHE_LIMIT) worldCache.delete(worldCache.keys().next().value);
    return results;
  } catch {
    throw new Error(controller.signal.aborted ? 'cities_timeout' : 'cities_unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function prayerCities(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const fail = (status, error) => res.status(status).json({ error });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(405, 'method_not_allowed');
  }
  const headers = req.headers || {};
  if (!isSameOrigin(headers)) return fail(403, 'origin_not_allowed');
  if (typeof headers['content-type'] !== 'string'
    || !/^application\/json(?:\s*;|\s*$)/i.test(headers['content-type'])) return fail(400, 'invalid_request');
  const input = readRequest(req.body);
  if (!input) return fail(400, 'invalid_request');
  if (input.scope === 'fr') return res.status(200).json({ results: searchFrance(input.query), source: 'fr' });
  try {
    return res.status(200).json({ results: await searchWorld(input.query), source: 'world' });
  } catch (error) {
    return fail(error.message === 'cities_timeout' ? 504 : 502, error.message === 'cities_timeout' ? 'cities_timeout' : 'cities_unavailable');
  }
};
