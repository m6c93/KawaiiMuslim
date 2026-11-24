const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch {}

test('the family home keeps activity links and the prayer card visible before the first scroll', { skip: !JSDOM }, async () => {
  const page = new JSDOM(readFileSync("Aujourd'hui.dc.html", 'utf8'), {
    url: 'https://example.test/home?guest=1',
    runScripts: 'outside-only'
  });
  const { window } = page;
  const { document } = window;
  const elements = targets => Array.from([targets].flat(), target =>
    typeof target === 'string' ? Array.from(document.querySelectorAll(target)) : target
  ).flat();
  window.matchMedia = () => ({ matches: false });
  window.ScrollTrigger = { batch() {}, refresh() {} };
  window.gsap = {
    utils: { toArray: elements },
    registerPlugin() {},
    timeline: () => ({ from() { return this; } }),
    to() {},
    from(targets, options) {
      if (options.scrollTrigger && options.autoAlpha === 0) {
        for (const element of elements(targets)) element.style.visibility = 'hidden';
      }
    }
  };
  try {
    window.eval(readFileSync('today-v2.js', 'utf8'));
    await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
    const links = document.querySelectorAll('#worldDestinations a');
    assert.equal(links.length, 4);
    for (const element of [...links, document.querySelector('#prayerCard')]) {
      assert.equal(window.getComputedStyle(element).visibility, 'visible', element.textContent.trim());
    }
  } finally {
    window.close();
  }
});
