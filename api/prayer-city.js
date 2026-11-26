'use strict';

// Only suggest a city. The visitor must confirm it before prayer times are used.
// ISO 3166-1 assigned alpha-2 codes; reserved/unknown codes are not locations.
const COUNTRIES = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ '
  + 'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ '
  + 'EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY '
  + 'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ '
  + 'LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '
  + 'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
  + 'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ '
  + 'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));

function decodeHeader(value, limit) {
  if (typeof value !== 'string' || !value || value.length > limit) return null;
  try {
    const decoded = decodeURIComponent(value).normalize('NFC');
    if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(decoded)) return null;
    return decoded.trim();
  } catch { return null; }
}

function isSameOrigin(headers) {
  const site = headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  // Native clients may omit Origin and Fetch Metadata entirely.
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

module.exports = function prayerCity(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const reply = (status, body) => res.status(status).json(body);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return reply(405, { error: 'method_not_allowed' });
  }
  const headers = req.headers || {};
  if (!isSameOrigin(headers)) return reply(403, { error: 'origin_not_allowed' });

  // Vercel provides these values. No lookup, address, coordinates or logs here.
  const city = decodeHeader(headers['x-vercel-ip-city'], 720);
  const country = decodeHeader(headers['x-vercel-ip-country'], 16);
  const countryCode = country && country.toUpperCase();
  if (!city || [...city].length > 80 || !/\p{L}/u.test(city)
    || !/^[\p{L}\p{M}\p{N}\p{Zs}.,'’()&/\-]+$/u.test(city)
    || !COUNTRIES.has(countryCode)) return reply(404, { error: 'city_unavailable' });

  return reply(200, { city, countryCode, approximate: true });
};
