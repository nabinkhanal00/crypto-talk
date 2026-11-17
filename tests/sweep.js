/* One-shot sweep for the current viewport: fit (default + every demo showing its result),
   click/build stability, input stability, and the route slide in every mode.
   Needs p1-test.js and input-stability.js loaded first. Result lands in window.__sweep. */
window.runSweep = async function ({ suite = false, contrast = false } = {}) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = { viewport: innerWidth + 'x' + innerHeight };
  if (suite) { const t = await runP1Tests(); out.suite = { total: t.total, passed: t.passed, failed: t.failed }; }
  out.layoutDefault = await deckLayoutReport();
  out.clicks = await deckStabilityReport({ threshold: 1 });
  out.inputs = (await inputStabilityReport()).issues;
  // route slide: every mode x every stop must fit
  location.hash = '#e2e-route'; await sleep(200);
  const s = document.querySelector('.slide.active'); let worst = 0;
  for (const m of s.querySelectorAll('#rtModes button')) { m.click(); await sleep(60); for (const n of s.querySelectorAll('.rt-node')) { n.click(); await sleep(30); worst = Math.max(worst, s.scrollHeight - s.clientHeight); } }
  s.querySelector('#rtModes button').click(); s.querySelectorAll('.rt-node')[3].click();
  out.routeWorstOverflow = worst;
  await p1PrimeStates();
  out.layoutPrimed = await deckLayoutReport();
  if (contrast) {
    const root = document.documentElement, orig = root.dataset.theme;
    root.dataset.theme = 'light'; await sleep(100); out.contrastLight = await deckContrastReport();
    root.dataset.theme = 'dark'; await sleep(100); out.contrastDark = await deckContrastReport();
    if (orig) root.dataset.theme = orig; else delete root.dataset.theme;
  }
  location.hash = '#start';
  return out;
};
