'use strict';

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const REQUEST_KEYS = new Set(['date', 'city', 'latitude', 'longitude']);

function isSameOrigin(headers) {
  const site = headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  // A native request may omit Origin and Fetch Metadata.
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
    || Object.keys(body).some(key => !REQUEST_KEYS.has(key))) return null;
  if (typeof body.date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(body.date)) return null;
  const parsed = new Date(body.date + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.date) return null;

  const hasCity = Object.hasOwn(body, 'city');
  const hasLatitude = Object.hasOwn(body, 'latitude');
  const hasLongitude = Object.hasOwn(body, 'longitude');
  const date = body.date.split('-').reverse().join('-');
  if (hasCity) {
    if (hasLatitude || hasLongitude || typeof body.city !== 'string' || body.city.length > 1024) return null;
    const city = body.city.normalize('NFC').trim();
    if (!city || [...city].length > 160 || /[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(city)) return null;
    return { date, city };
  }
  if (!hasLatitude || !hasLongitude || typeof body.latitude !== 'number' || typeof body.longitude !== 'number'
    || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)
    || Math.abs(body.latitude) > 90 || Math.abs(body.longitude) > 180) return null;
  return { date, latitude: body.latitude, longitude: body.longitude };
}

function validatedData(payload, date) {
  const data = payload && Number(payload.code) === 200 && payload.data;
  if (!data || data.date?.gregorian?.date !== date) return null;
  const timezone = data.meta?.timezone;
  if (typeof timezone !== 'string' || !timezone || timezone.length > 80) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { return null; }
  const timings = {};
  for (const key of PRAYERS) {
    const value = data.timings?.[key];
    if (typeof value !== 'string') return null;
    const match = value.match(/^(\d{1,2}):(\d{2})(?:\s+\([A-Za-z0-9+:\- ]{1,16}\))?$/);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    timings[key] = match[1].padStart(2, '0') + ':' + match[2];
  }
  // Do not expose the provider's coordinates, address or additional metadata.
  return { timings, meta: { timezone }, date: { gregorian: { date } } };
}

function addressNotFound(payload) {
  if (Number(payload?.code) !== 400) return false;
  const message = typeof payload.data === 'string' ? payload.data.trim().toLowerCase().replace(/\.$/, '') : '';
  // Geocoding outages or exhausted provider quotas are not invalid cities.
  return ['address not found', 'invalid address', 'please specify a valid address'].includes(message);
}

module.exports = async function prayerTimes(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const fail = (code, error) => res.status(code).json({ code, error });
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

  const manual = input.city !== undefined;
  const url = new URL('https://api.aladhan.com/v1/' + (manual ? 'timingsByAddress/' : 'timings/') + input.date);
  url.searchParams.set('method', '3');
  if (manual) url.searchParams.set('address', input.city);
  else {
    url.searchParams.set('latitude', String(input.latitude));
    url.searchParams.set('longitude', String(input.longitude));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    // Only the confirmed location and date are sent to the existing provider.
    // No request headers, cookies, credentials or visitor IP are forwarded.
    const response = await fetch(url.href, {
      headers: { Accept: 'application/json' },
      signal: controller.signal, redirect: 'error', cache: 'no-store'
    });
    const payload = await response.json();
    if (manual && addressNotFound(payload)) return fail(422, 'location_not_found');
    if (!response.ok) return fail(502, 'timings_unavailable');
    const data = validatedData(payload, input.date);
    if (!data) return fail(502, 'timings_unavailable');
    return res.status(200).json({ code: 200, data });
  } catch {
    return fail(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'timings_timeout' : 'timings_unavailable');
  } finally {
    clearTimeout(timeout);
  }
};
