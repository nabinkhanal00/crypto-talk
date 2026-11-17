/* Input stability probe: change every slider, dropdown and text box (with realistic values)
   and report any heading, panel, row, figure or verdict that moves by more than 1px,
   plus any slide that starts to scroll. Run in the page: await inputStabilityReport() */
window.inputStabilityReport = async function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const noAnim = document.createElement('style');
  noAnim.textContent = '*{transition:none!important;animation:none!important}';
  document.head.appendChild(noAnim);
  const issues = [];
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  try {
    for (const s of document.querySelectorAll('.slide')) {
      location.hash = '#' + s.id; await sleep(60);
      // stable anchors: headings, panels, rows, figures, verdicts, labelled fields (not the cells of tables that re-render)
      const anchors = () => [...s.querySelectorAll('h1,h2,h3,.panel,.cols,figure,.verdict,label.field,.callout')]
        .filter(e => e.getClientRects().length)
        .map(e => Math.round(e.getBoundingClientRect().top));
      const moved = (a, b) => a.length !== b.length ? 999 : Math.max(0, ...a.map((v, i) => Math.abs(b[i] - v)));
      const overflow = () => s.scrollHeight - s.clientHeight > 1;
      if (s.dataset.keys === 'letters') { // slides that take letter keys (the Enigma machine): type a long message
        const a = anchors();
        for (const ch of 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOGTHEQUICKBROWNFOX') { document.dispatchEvent(new KeyboardEvent('keydown', { key: ch.toLowerCase(), bubbles: true })); await sleep(8); }
        await sleep(150);
        const d = moved(a, anchors()); if (d > 1) issues.push(`${s.id} typing 50 letters: moved ${d}px`); if (overflow()) issues.push(`${s.id} typing: slide scrolls`);
        for (const b of s.querySelectorAll('button[id]')) { if (!/Real|Reset/i.test(b.id)) continue; b.click(); await sleep(b.id.includes('Real') ? 5000 : 150); const d2 = moved(a, anchors()); if (d2 > 1) issues.push(`${s.id} #${b.id} after typing: moved ${d2}px`); if (overflow()) issues.push(`${s.id} #${b.id}: slide scrolls`); }
      }
      for (const inp of s.querySelectorAll('input,select,textarea')) {
        if (!inp.getClientRects().length || ['checkbox', 'radio', 'button'].includes(inp.type) || (inp.maxLength > 0 && inp.maxLength < 4)) continue;
        const a = anchors(), tag = s.id + ' ' + (inp.id ? '#' + inp.id : inp.tagName.toLowerCase());
        const orig = inp.tagName === 'SELECT' ? inp.selectedIndex : inp.value;
        const tryVal = async (lab, setter) => { setter(); await sleep(70); const d = moved(a, anchors()); if (d > 1) issues.push(`${tag} ${lab}: moved ${d}px`); if (overflow()) issues.push(`${tag} ${lab}: slide scrolls`); };
        if (inp.type === 'range') {
          for (let v = +inp.min; v <= +inp.max; v += Math.max(+inp.step || 1, Math.ceil((inp.max - inp.min) / 8))) await tryVal('=' + v, () => { inp.value = v; fire(inp, 'input'); fire(inp, 'change'); });
          await tryVal('=max', () => { inp.value = inp.max; fire(inp, 'input'); fire(inp, 'change'); });
          inp.value = orig; fire(inp, 'input'); fire(inp, 'change');
        } else if (inp.tagName === 'SELECT') {
          for (let k = 0; k < inp.options.length; k++) await tryVal('opt' + k, () => { inp.selectedIndex = k; fire(inp, 'change'); });
          inp.selectedIndex = orig; fire(inp, 'change');
        } else {
          const max = inp.maxLength > 0 ? inp.maxLength : 30;
          for (const t of ['HI', 'MEET ME AT THE CAFE AT NOON', 'W'.repeat(max)]) await tryVal(JSON.stringify(t.slice(0, max).slice(0, 8)) + '…' + Math.min(t.length, max), () => { inp.value = t.slice(0, max); fire(inp, 'input'); });
          inp.value = orig; fire(inp, 'input');
        }
        await sleep(40);
      }
    }
  } finally { noAnim.remove(); location.hash = '#start'; }
  return { viewport: innerWidth + 'x' + innerHeight, issues };
};
