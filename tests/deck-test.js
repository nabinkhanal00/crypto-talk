/* Test suite for crypto-talk.html.
   Load the deck, then in the console:  await runDeckTests()   /  deckLayoutReport()  /  deckContrastReport()
   Every demo result is checked against an independent calculation made here, not against the deck's own helpers. */
(() => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const te = new TextEncoder(), td = new TextDecoder();
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  const sha = async s => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
  const refCaesar = (s, k) => [...s.toUpperCase()].map(c => A.includes(c) ? A[(A.indexOf(c) + k + 2600) % 26] : c).join('');
  const refVig = (s, key) => { let j = 0; return [...s.toUpperCase()].map(c => { if (!A.includes(c)) return c; const k = A.indexOf(key[j++ % key.length]); return A[(A.indexOf(c) + k) % 26]; }).join(''); };
  const bmodpow = (b, e, m) => { b %= m; let r = 1n; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
  const slideEls = () => qa('.slide');
  const cur = () => slideEls().findIndex(s => s.classList.contains('active'));
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(40); } return false; };

  window.runDeckTests = async function () {
    const R = [];
    const ok = (name, cond, detail = '') => { R.push({ name, pass: !!cond, detail: cond ? '' : String(detail).slice(0, 300) }); return !!cond; };
    const str = v => typeof v === 'bigint' ? v + 'n' : JSON.stringify(v);
    const eq = (name, a, b) => ok(name, a === b, a === b ? '' : `got ${str(a)}, want ${str(b)}`);
    const click = s => { const e = typeof s === 'string' ? q(s) : s; if (!e) throw new Error('missing element ' + s); e.click(); };
    const setVal = (s, v, ev = 'input') => { const e = typeof s === 'string' ? q(s) : s; if (!e) throw new Error('missing element ' + s); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); };
    const key = (k, o = {}, target = document) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
    const show = async id => { const i = indexOfId(id); if (i < 0) throw new Error('no slide ' + id); go(i); await sleep(25); };
    const errs = [];
    const onErr = e => errs.push(e.message || String(e.reason));
    addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
    const section = async (name, fn) => { try { await fn(); } catch (e) { ok(`${name}: threw`, false, e && (e.stack || e)); } };
    const S = slideEls(), N = S.length;

    /* ------------------------------------------------------------ structure */
    await section('structure', async () => {
      eq('31 slides', N, 31);
      eq('slide ids are unique', new Set(S.map(s => s.id)).size, N);
      ok('every slide has a title', S.every(s => s.dataset.title && s.dataset.title.trim()));
      ok('every slide is in part 1 or 2', S.every(s => ['1', '2'].includes(s.dataset.part)));
      const firstP2 = S.findIndex(s => s.dataset.part === '2');
      ok('all part 1 slides come before part 2', S.every((s, i) => (s.dataset.part === '1') === (i < firstP2)));
      eq('part 2 starts at the section slide', S[firstP2].id, 'part2');
      ok('every slide has speaker notes with a duration', S.every(s => { const n = q('.notes', s); return n && n.textContent.trim().length > 40 && parseFloat(n.dataset.min) > 0; }));
      const mins = p => S.filter(s => s.dataset.part === p).reduce((a, s) => a + parseFloat(q('.notes', s).dataset.min), 0);
      ok('part 1 notes add up to 24 min', Math.abs(mins('1') - 24) < 1e-9, mins('1'));
      ok('part 2 notes add up to 30 min', Math.abs(mins('2') - 30) < 1e-9, mins('2'));
      const reserved = ['settings', 'sidebar', 'customize', 'upgrade', 'downloads'];
      ok('no reserved or unsafe slide ids', S.every(s => /^[a-z0-9-]+$/.test(s.id) && !reserved.includes(s.id) && !s.id.startsWith('comment-')));
      const links = qa('a[href^="#"]');
      ok('every in-deck link points at a slide', links.length >= 12 && links.every(a => indexOfId(a.getAttribute('href').slice(1)) >= 0), links.filter(a => indexOfId(a.getAttribute('href').slice(1)) < 0).map(a => a.getAttribute('href')));
      const ext = qa('a[href^="http"]');
      ok('external links open in a new tab safely', ext.length === 2 && ext.every(a => a.target === '_blank' && /noopener/.test(a.rel)));
      const text = S.map(s => s.textContent).join(' ');
      const emoji = text.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}]/gu);
      ok('no emoji or pictograph glyphs in slide text', !emoji, emoji);
      const us = (text.match(/\b\w*(colors?|center|favorite|behavior|defense|standardized|popularized|recogniz|organiz|analyz|gray)\w*/gi) || []).concat(text.match(/\bmath\b/g) || []);
      ok('UK spelling in copy', us.length === 0, us);
      const ids = qa('[id]').map(e => e.id);
      eq('no duplicate element ids', new Set(ids).size, ids.length);
      eq('exactly one active slide', qa('.slide.active').length, 1);
      eq('deep slides', S.filter(s => s.classList.contains('deep')).map(s => s.id).join(','), 'part1,classical,part2,thanks');
      ok('h2 headlines end with punctuation', qa('.slide h2').every(h => /[.?!]$/.test(h.textContent.trim())), qa('.slide h2').filter(h => !/[.?!]$/.test(h.textContent.trim())).map(h => h.textContent));
    });

    /* ------------------------------------------------------------ navigation */
    await section('navigation', async () => {
      let allOk = true, detail = '';
      for (let i = 0; i < N; i++) {
        location.hash = '#' + S[i].id; await sleep(25);
        const good = cur() === i && qa('.slide.active').length === 1 && q('#barTitle').textContent === S[i].dataset.title
          && q('#barCount').textContent === `${String(i + 1).padStart(2, '0')} / ${N}`
          && S.every((s, k) => s.inert === (k !== i))
          && q('#goP1').getAttribute('aria-current') === String(S[i].dataset.part === '1')
          && q('#goP2').getAttribute('aria-current') === String(S[i].dataset.part === '2')
          && Math.abs(parseFloat(q('#progress').style.width) - (i + 1) / N * 100) < 0.01;
        if (!good) { allOk = false; detail += S[i].id + ' '; }
      }
      ok('hash routing, title, counter, progress and part marker for all 31 slides', allOk, detail);
      go(0); await sleep(20);
      ok('Previous is disabled on the first slide', q('#btnPrev').disabled && !q('#btnNext').disabled);
      key('ArrowLeft'); eq('ArrowLeft on first slide stays', cur(), 0);
      key('ArrowRight'); eq('ArrowRight', cur(), 1);
      key(' '); eq('Space', cur(), 2);
      key(' ', { shiftKey: true }); eq('Shift+Space', cur(), 1);
      key('PageDown'); eq('PageDown', cur(), 2);
      key('PageUp'); eq('PageUp', cur(), 1);
      key('End'); eq('End', cur(), N - 1);
      ok('Next is disabled on the last slide', q('#btnNext').disabled && !q('#btnPrev').disabled);
      key('ArrowRight'); eq('ArrowRight on last slide stays', cur(), N - 1);
      key('Home'); eq('Home', cur(), 0);
      key('ArrowRight', { metaKey: true }); eq('Cmd+ArrowRight is left to the browser', cur(), 0);
      click('#btnNext'); eq('Next button', cur(), 1);
      click('#btnPrev'); eq('Previous button', cur(), 0);
      click('#goP2'); eq('Part 2 button', S[cur()].id, 'part2');
      click('#goP1'); eq('Part 1 button', S[cur()].id, 'part1');
      eq('address bar hash follows the slide', location.hash, '#part1');
      // notes
      ok('notes start hidden', q('#notesPanel').hidden);
      key('n'); ok('N opens notes', !q('#notesPanel').hidden && q('#btnNotes').getAttribute('aria-pressed') === 'true');
      eq('notes show this slide\'s text', q('#notesBody').textContent.trim(), q('.notes', S[0]).textContent.trim());
      ok('notes header shows slide number and minutes', q('#notesTitle').textContent.startsWith('1. ') && /min/.test(q('#notesTime').textContent));
      key('ArrowRight'); eq('notes follow the slide', q('#notesBody').textContent.trim(), q('.notes', S[1]).textContent.trim());
      await show('kerckhoffs'); ok('optional slides are marked in notes', /optional/.test(q('#notesTitle').textContent));
      key('Escape'); ok('Escape closes notes', q('#notesPanel').hidden);
      click('#btnNotes'); ok('notes button opens', !q('#notesPanel').hidden); click('#btnNotes'); ok('notes button closes', q('#notesPanel').hidden);
      ok('timer text is mm:ss', /^\d\d:\d\d$/.test(q('#notesClock').textContent));
      // menu
      key('m'); ok('M opens the slide menu', !q('#menu').hidden);
      const items = qa('#menuInner li button');
      eq('menu lists every slide', items.length, N);
      ok('menu titles match slides', items.every((b, i) => q('.t', b).textContent === S[i].dataset.title));
      eq('menu marks optional slides', qa('#menuInner .tag').filter(t => t.textContent === 'optional').length, 2);
      const before = cur(); key('ArrowRight'); eq('arrow keys do not move slides while the menu is open', cur(), before);
      items[5].click(); await sleep(20);
      ok('menu click jumps and closes', cur() === 5 && q('#menu').hidden);
      click('#btnMenu'); ok('menu button opens', !q('#menu').hidden); key('Escape'); ok('Escape closes menu', q('#menu').hidden);
      click('#btnMenu'); click('#menuClose'); ok('Close button closes menu', q('#menu').hidden);
      // theme
      const root = document.documentElement, t0 = root.dataset.theme;
      const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
      key('t'); eq('T switches theme away from the system one', root.dataset.theme, sysDark ? 'light' : 'dark');
      await show('caesar');
      const bgNow = getComputedStyle(q('.slide.active')).backgroundColor;
      eq('content slide background follows the theme', bgNow, sysDark ? 'rgb(235, 235, 235)' : 'rgb(0, 50, 50)');
      click('#btnTheme'); eq('theme button switches back', root.dataset.theme, sysDark ? 'dark' : 'light');
      if (t0) root.dataset.theme = t0; else delete root.dataset.theme;
      // typing guard
      await show('vocab');
      const inp = q('#vPlain'); inp.focus();
      key('ArrowRight', {}, inp); key(' ', {}, inp); key('n', {}, inp);
      ok('keys typed in a text box do not navigate or open notes', S[cur()].id === 'vocab' && q('#notesPanel').hidden);
      key('Escape', {}, inp); ok('Escape leaves the text box', document.activeElement !== inp);
      const range = q('#vKa'); key('ArrowRight', {}, range); eq('arrow keys on a slider do not change slide', S[cur()].id, 'vocab');
      const btn = q('#btnNotes'); key(' ', {}, btn); eq('Space on a focused button does not change slide', S[cur()].id, 'vocab');
      // swipe
      const inner = q('.slide.active .slide-inner');
      const touch = (type, x, y) => { const e = new Event(type, { bubbles: true }); e.touches = [{ clientX: x, clientY: y }]; e.changedTouches = [{ clientX: x, clientY: y }]; inner.dispatchEvent(e); };
      const at = cur(); touch('touchstart', 300, 300); touch('touchend', 120, 310); eq('swipe left goes forward', cur(), at + 1);
      const inner2 = q('.slide.active .slide-inner');
      const touch2 = (type, x, y) => { const e = new Event(type, { bubbles: true }); e.touches = [{ clientX: x, clientY: y }]; e.changedTouches = [{ clientX: x, clientY: y }]; inner2.dispatchEvent(e); };
      touch2('touchstart', 120, 300); touch2('touchend', 300, 310); eq('swipe right goes back', cur(), at);
      touch('touchstart', 300, 300); touch('touchend', 290, 100); eq('vertical scroll gesture does not change slide', cur(), at);
      // icon fallback
      const ic = q('#btnNext .gs-icon');
      ok('icon font active (no fallback)', !root.classList.contains('no-icons') && ic.getBoundingClientRect().width <= 30);
      root.classList.add('no-icons');
      eq('offline fallback shows a plain arrow', getComputedStyle(ic, '::before').content, '"→"');
      root.classList.remove('no-icons');
    });

    /* ------------------------------------------------------------ part 1 demos */
    await section('hero', async () => {
      await show('part1');
      const out = q('#heroOut');
      const pick = async era => { click(`[data-era="${era}"]`); await sleep(1250); return out.textContent; };
      eq('Caesar era', await pick('caesar'), refCaesar('ATTACK AT DAWN', 3));
      eq('Caesar era literal', out.textContent, 'DWWDFN DW GDZQ');
      eq('Vigenère era', await pick('vigenere'), 'LXFOPV EF RNHR');
      eq('Enigma era', await pick('enigma'), 'BZHGNO CR RTCM');
      const aes = await pick('aes');
      ok('AES era shows 14 + 16 bytes of hex', /^[0-9A-F]{60}$/.test(aes), aes);
      const aes2 = await pick('aes'); ok('AES era differs each time', aes2 !== aes);
      eq('plaintext era', await pick('plain'), 'ATTACK AT DAWN');
      eq('one era selected', qa('#eraRow [aria-pressed="true"]').length, 1);
    });

    await section('cast', async () => {
      await show('cast');
      const run = async k => { click(`[data-attack="${k}"]`); await sleep(2500); return q('#castVerdict').textContent; };
      const inside = () => { const p = q('#packet').getBoundingClientRect(), w = q('#wire').getBoundingClientRect(); return p.right <= w.right + 1 && p.left >= w.left - 1; };
      ok('Eve: confidentiality', /Confidentiality is broken/.test(await run('eve')) && q('#goal-eve').classList.contains('on') && qa('.goal.on').length === 1);
      eq('Eve does not change the message', q('#pkBody').textContent, 'Pay Bob $10');
      ok('Mallory edits: integrity', /Integrity is broken/.test(await run('tamper')) && q('#goal-tamper').classList.contains('on') && qa('.goal.on').length === 1);
      eq('message was altered in transit', q('#pkBody').textContent, 'Pay Mallory $10,000');
      ok('packet stays inside the wire after it grows', inside());
      ok('Mallory spoofs: authenticity', /Authenticity is broken/.test(await run('spoof')) && q('#goal-spoof').classList.contains('on') && qa('.goal.on').length === 1);
      ok('packet stays inside the wire (spoof)', inside());
      ok('normal send resets', /All good/.test(await run('none')) && qa('.goal.on').length === 0 && q('#attacker').hidden && q('#pkBody').textContent === 'Pay Bob $10');
    });

    await section('vocabulary', async () => {
      await show('vocab');
      setVal('#vPlain', 'Deploy on Friday'); setVal('#vKa', 3); setVal('#vKb', 3);
      eq('ciphertext', q('#vCipher').textContent, 'GHSORB RQ IULGDB');
      eq('right key decrypts', q('#vBack').textContent, 'DEPLOY ON FRIDAY');
      setVal('#vKb', 5);
      eq('wrong key gives garbage', q('#vBack').textContent, refCaesar('GHSORB RQ IULGDB', -5));
      ok('wrong key is flagged', q('#vBack').style.color.includes('bad'));
      setVal('#vKb', 3); ok('matching key is flagged good', q('#vBack').style.color.includes('good'));
    });

    await section('caesar', async () => {
      await show('caesar');
      setVal('#cPlain', 'Veni vidi vici');
      let allShifts = true;
      for (let k = 0; k <= 25; k++) { setVal('#cShift', k); if (q('#cOut').textContent !== refCaesar('Veni vidi vici', k)) allShifts = false; }
      ok('all 26 shifts encrypt correctly', allShifts);
      click('#cRot13');
      eq('ROT13 output', q('#cOut').textContent, 'IRAV IVQV IVPV');
      eq('ROT13 twice is the identity', refCaesar(q('#cOut').textContent, 13), 'VENI VIDI VICI');
      eq('shift label', q('#wheelShift').textContent, '13');
      ok('ROT13 note shown', /ROT13/.test(q('#cNote').textContent));
      await sleep(420);
      const lit = qa('#wheel text.lit');
      eq('plain letter and its cipher letter are lit', lit.map(t => t.textContent).join(''), 'IV');
      const c = q('#wheel').getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
      const ang = el => { const r = el.getBoundingClientRect(); return Math.atan2(r.top + r.height / 2 - cy, r.left + r.width / 2 - cx) * 180 / Math.PI; };
      ok('lit letters line up on the wheel', Math.abs(ang(lit[0]) - ang(lit[1])) < 3, `${ang(lit[0])} vs ${ang(lit[1])}`);
      let aligned = true;
      for (const k of [1, 7, 25]) {
        setVal('#cShift', k); await sleep(420);
        for (const i of [0, 9, 20]) {
          const o = q(`#wheelOuter text[data-i="${i}"]`), n = q(`#wheelInner text[data-i="${(i + k) % 26}"]`);
          let d = Math.abs(ang(o) - ang(n)); if (d > 180) d = 360 - d;
          if (d > 3) aligned = false;
        }
      }
      ok('inner ring lines up with the outer ring for several shifts', aligned);
      eq('both markers visible', qa('#wheel .mark').filter(m => m.getAttribute('visibility') === 'visible').length, 2);
      setVal('#cPlain', '123'); eq('markers hide when there is no letter', qa('#wheel .mark').filter(m => m.getAttribute('visibility') === 'visible').length, 0);
      eq('non-letters pass through', q('#cOut').textContent, '123');
      click('#cRandom'); ok('random shift is 1..25', +q('#cShift').value >= 1 && +q('#cShift').value <= 25);
      setVal('#cPlain', 'Veni vidi vici'); setVal('#cShift', 3);
      eq('default restored', q('#cOut').textContent, 'YHQL YLGL YLFL');
    });

    await section('brute force', async () => {
      await show('bruteforce');
      const plain = 'MEET ME BY THE SERVER RACK AT NOON AND BRING THE BACKUP KEYS';
      eq('default intercept is Caesar-11', q('#bfIn').value, refCaesar(plain, 11));
      click('#bfRun'); await sleep(1500);
      eq('25 candidate rows', qa('#bfList .bf-row').length, 25);
      ok('all rows revealed', qa('#bfList .bf-row').every(r => r.classList.contains('show')));
      eq('best row is the plaintext', q('#bfList .best span').textContent, plain);
      eq('best key', q('#bfList .best b').textContent, 'k=11');
      ok('status names the key', /k = 11/.test(q('#bfStat').textContent));
      let good = true;
      for (const [txt, k] of [['The quick brown fox jumps over the lazy dog and keeps on running north', 7], ['Cryptography is the practice and study of techniques for secure communication', 19], ['It was the best of times it was the worst of times', 1]]) {
        setVal('#bfIn', refCaesar(txt, k)); click('#bfRun'); await sleep(30);
        if (q('#bfList .best b').textContent !== 'k=' + String(k).padStart(2, '0') || q('#bfList .best span').textContent !== txt.toUpperCase()) good = false;
      }
      ok('scoring picks the right key for three other texts', good);
      setVal('#bfIn', refCaesar(plain, 11));
    });

    await section('substitution', async () => {
      await show('substitution');
      const keyOf = () => qa('#subKey .k2').map(e => e.textContent).join('');
      const k1 = keyOf();
      ok('key is a permutation of the alphabet', k1.length === 26 && [...k1].sort().join('') === A, k1);
      setVal('#subIn', 'Meet me behind the data centre');
      eq('ciphertext follows the key', q('#subOut').textContent, [...'MEET ME BEHIND THE DATA CENTRE'].map(c => A.includes(c) ? k1[A.indexOf(c)] : c).join(''));
      let changed = false; for (let i = 0; i < 3 && !changed; i++) { click('#subShuffle'); changed = keyOf() !== k1; }
      ok('shuffle makes a new key', changed);
      const k2 = keyOf();
      eq('ciphertext follows the new key', q('#subOut').textContent, [...'MEET ME BEHIND THE DATA CENTRE'].map(c => A.includes(c) ? k2[A.indexOf(c)] : c).join(''));
      let f = 1n; for (let i = 2n; i <= 26n; i++) f *= i;
      eq('26! as printed', f.toLocaleString('en-US'), '403,291,461,126,605,635,584,000,000');
      ok('26! is about 2^88', f > 2n ** 88n && f < 2n ** 89n);
      const years = Number(f / 1000000000n) / (365.25 * 86400) / 1e9;
      ok('12.8 billion years at 1e9 keys/s', Math.abs(years - 12.8) < 0.05, years);
    });

    await section('frequency analysis', async () => {
      await show('frequency');
      const letters = [...FREQ_TEXT.toUpperCase()].filter(c => A.includes(c));
      const cells = qa('#fqSheet .cell');
      eq('26 worksheet cells', cells.length, 26);
      eq('counts add up to the text length', cells.reduce((a, c) => a + +q('small', c).textContent, 0), letters.length);
      const cipher = () => q('#fqText').textContent;
      const c0 = cipher();
      ok('ciphertext is not the plaintext', c0.toUpperCase() !== FREQ_TEXT.toUpperCase());
      // the displayed ciphertext must be a consistent substitution of the plaintext
      const map = {}; let consistent = true;
      [...FREQ_TEXT.toUpperCase()].forEach((p, i) => { const c = c0[i].toUpperCase(); if (!A.includes(p)) { if (c !== p) consistent = false; return; } if (map[p] && map[p] !== c) consistent = false; map[p] = c; });
      ok('ciphertext is a consistent letter-for-letter substitution', consistent && new Set(Object.values(map)).size === Object.keys(map).length);
      const present = Object.keys(map).length;
      eq('English chart has 26 bars, E first', qa('#fqEng .b').length + ':' + q('#fqEng .b span').textContent, '26:E');
      const cipBars = qa('#fqCip .b');
      ok('cipher chart sorted by frequency', cipBars.length === 26 && cipBars.every((b, i) => i === 0 || +b.title.split(': ')[1] <= +cipBars[i - 1].title.split(': ')[1]));
      eq('most common cipher symbol stands for E', cipBars[0].title.split(':')[0], map.E);
      click('#fqReveal');
      eq('reveal solves it', cipher(), FREQ_TEXT.toUpperCase());
      eq('score after reveal', q('#fqScore').textContent, `${present} of ${present} letters correct`);
      click('#fqClear'); eq('clear', q('#fqScore').textContent, `0 of ${present} letters correct`);
      eq('clear restores ciphertext', cipher(), c0);
      click('#fqHint'); click('#fqHint'); click('#fqHint');
      eq('three hints give three correct letters', q('#fqScore').textContent, `3 of ${present} letters correct`);
      ok('first hint is E', cipher().includes('E'));
      click('#fqClear'); click('#fqRank');
      const guesses = qa('#fqSheet input').filter(i => i.value).length;
      eq('rank guess fills every letter that occurs', guesses, present);
      ok('rank guess gets E right', q(`#fqSheet input[data-c="${map.E}"]`).value === 'E');
      click('#fqClear');
      const i1 = q(`#fqSheet input[data-c="${map.T}"]`), i2 = q(`#fqSheet input[data-c="${map.H}"]`);
      setVal(i1, 't'); eq('typed guess is applied in upper case', q(`#fqSheet input[data-c="${map.T}"]`).value, 'T');
      ok('typed guess shows in the text', qa('#fqText .g').length === letters.filter(c => c === 'T').length && qa('#fqText .g').every(g => g.textContent === 'T'));
      setVal(q(`#fqSheet input[data-c="${map.H}"]`), 'T');
      ok('duplicate guesses are flagged', qa('#fqSheet input.dup').length === 2);
      click('#fqClear'); click('#fqNew');
      ok('new puzzle changes the ciphertext', cipher() !== c0);
    });

    await section('vigenère', async () => {
      await show('vigenere');
      setVal('#vgKey', 'LEMON'); setVal('#vgIn', 'ATTACK AT DAWN');
      eq('textbook example', q('#vgOut').textContent, 'LXFOPV EF RNHR');
      eq('independent implementation agrees', q('#vgOut').textContent, refVig('ATTACK AT DAWN', 'LEMON'));
      eq('table columns', qa('#vgTable .p').map(e => e.textContent).join('') + '|' + qa('#vgTable .k').map(e => e.textContent).join('') + '|' + qa('#vgTable .c').map(e => e.textContent).join(''), 'ATTACKATDAWN|LEMONLEMONLE|LXFOPVEFRNHR');
      const iocOf = s => { const c = new Array(26).fill(0); let n = 0; for (const ch of s.toUpperCase()) { const i = A.indexOf(ch); if (i >= 0) { c[i]++; n++; } } return c.reduce((a, f) => a + f * (f - 1), 0) / (n * (n - 1)); };
      eq('index of coincidence for LEMON', q('#vgIoc').textContent, iocOf(refVig(FREQ_TEXT, 'LEMON')).toFixed(3));
      setVal('#vgKey', 'A');
      eq('keyword A leaves the text alone', q('#vgOut').textContent, 'ATTACK AT DAWN');
      eq('IoC of plain English text', q('#vgIoc').textContent, iocOf(FREQ_TEXT).toFixed(3));
      ok('English IoC is near 0.066', Math.abs(iocOf(FREQ_TEXT) - 0.066) < 0.008, iocOf(FREQ_TEXT));
      setVal('#vgKey', 'CRYPTOGRAPHYISFUN');
      ok('a long keyword pushes IoC towards random', +q('#vgIoc').textContent < 0.05, q('#vgIoc').textContent);
      setVal('#vgKey', ''); eq('empty keyword does not break', q('#vgOut').textContent, 'ATTACK AT DAWN');
      setVal('#vgKey', 'k3y!'); eq('non-letters in the keyword are ignored', q('#vgOut').textContent, refVig('ATTACK AT DAWN', 'KY'));
      eq('two charts of 26 bars', qa('#vgBarsC .b').length + qa('#vgBarsV .b').length, 52);
      setVal('#vgKey', 'LEMON');
    });

    await section('enigma', async () => {
      await show('enigma');
      const tape = () => q('#enOut').textContent.replace(/ /g, '');
      const wins = () => [0, 1, 2].map(r => q('#rw' + r).textContent).join('');
      const type = s => [...s].forEach(c => key(c.toLowerCase()));
      click('#enReset'); type('AAAAA');
      eq('AAAAA gives BDZGO (standard test vector)', tape(), 'BDZGO');
      eq('rotor windows after 5 presses', wins(), 'AAF');
      ok('typing letters on this slide does not open notes or the menu', q('#notesPanel').hidden && q('#menu').hidden && S[cur()].id === 'enigma');
      click('#enReset'); type('BDZGO'); eq('decrypting is the same operation', tape(), 'AAAAA');
      click('#enReset'); type('HELLOWORLD'); eq('HELLOWORLD gives ILBDAAMTAZ', tape(), 'ILBDAAMTAZ');
      ok('signal path shows 8 hops', (q('#enPath').textContent.match(/→/g) || []).length === 7);
      ok('lamp for the last output letter is lit', q('.lamp.on') && q('.lamp.on').dataset.l === tape().slice(-1));
      click('#enReset'); eq('reset', wins() + tape(), 'AAA');
      click(q('#enRotors [data-r="0"][data-d="1"]')); eq('rotor up', wins(), 'BAA');
      click(q('#enRotors [data-r="0"][data-d="-1"]')); click(q('#enRotors [data-r="0"][data-d="-1"]')); eq('rotor down wraps', wins(), 'ZAA');
      click(q('#enRotors [data-r="2"][data-d="-1"]')); eq('right rotor down wraps', wins(), 'ZAZ');
      click('#enReset'); click(q('.key[data-k="A"]')); eq('on-screen key', tape(), 'B');
      // machine properties, checked on a fresh instance
      const m = new Enigma([0, 3, 20]); m.press('A'); m.press('A'); m.press('A');
      eq('double stepping: ADU -> BFX after three presses', m.pos.map(p => A[p]).join(''), 'BFX');
      let self = false; const e2 = new Enigma([4, 11, 19]); for (let i = 0; i < 20000; i++) { const c = A[i % 26]; if (e2.press(c) === c) self = true; }
      ok('no letter ever encrypts to itself (20,000 presses)', !self);
      const rnd = Array.from({ length: 500 }, () => A[Math.random() * 26 | 0]).join('');
      eq('encrypt then decrypt returns the text', new Enigma([9, 2, 24]).encrypt(new Enigma([9, 2, 24]).encrypt(rnd)), rnd);
      const p = new Enigma([0, 0, 0]); const seen = new Set(); let period = 0;
      for (let i = 0; i < 20000; i++) { p.step(); const k = p.pos.join(','); if (seen.has(k)) { period = seen.size; break; } seen.add(k); }
      eq('rotor positions repeat after 16,900 steps', period, 16900);
      eq('daily settings figure', (60n * 17576n * 150738274937250n).toString(), '158962555217826360000');
      click('#enA5'); await sleep(1500); eq('“Press A five times” button', tape(), 'BDZGO'); click('#enReset');
    });

    await section('crib', async () => {
      await show('crib');
      const CRIB = 'WETTERVORHERSAGE';
      const ct = qa('#cribGrid .ci').map(e => e.textContent).join('');
      eq('intercept length', ct.length, 50);
      const plain = new Enigma([7, 20, 11]).encrypt(ct);
      eq('intercept decrypts to the weather message', plain, 'VONSTATIONNORDWETTERVORHERSAGEREGENWINDSTAERKEVIER');
      eq('crib really sits at position 14', plain.indexOf(CRIB), 14);
      const clashes = o => [...CRIB].filter((c, i) => ct[o + i] === c).length;
      const btns = qa('#cribStrip button');
      eq('one strip cell per position', btns.length, 35);
      ok('strip colours match an independent clash count', btns.every((b, o) => b.classList.contains('no') === (clashes(o) > 0)));
      ok('the true position survives', !btns[14].classList.contains('no'));
      const survivors = btns.filter(b => !b.classList.contains('no')).length;
      let rowsOk = true;
      for (let o = 0; o <= 34; o++) {
        setVal('#cribPos', o);
        const red = qa('#cribGrid .cr.clash').length, v = q('#cribVerdict');
        const shown = qa('#cribGrid .cr').map(e => e.textContent).join('');
        if (red !== clashes(o) || shown !== CRIB || v.classList.contains('good') !== (clashes(o) === 0) || q('#cribPosLab').textContent !== String(o)) rowsOk = false;
        const first = qa('#cribGrid .cr').findIndex(e => e.textContent);
        if (first !== o) rowsOk = false;
      }
      ok('all 35 slider positions show the right clashes and verdict', rowsOk);
      setVal('#cribPos', 14);
      ok('verdict counts survivors correctly', q('#cribVerdict').textContent.includes(`${survivors} of 35 positions survive`) && q('#cribVerdict').textContent.includes(`${35 - survivors} were eliminated`), q('#cribVerdict').textContent);
      btns[3].click(); eq('strip click moves the slider', q('#cribPos').value, '3');
      setVal('#cribPos', 0);
    });

    await section('kerckhoffs', async () => {
      await show('kerckhoffs');
      ok('answer hidden at first', q('#pollOut').hidden);
      click('[data-poll="a"]'); ok('A is flagged risky', q('#pollOut').classList.contains('bad') && !q('#pollOut').hidden);
      click('[data-poll="b"]'); ok('B is the right answer', q('#pollOut').classList.contains('good') && qa('[data-poll][aria-pressed="true"]').length === 1);
    });

    await section('xor and one-time pad', async () => {
      await show('otp');
      setVal('#xorChar', 'H');
      const rows = () => { const b = qa('#xorBits .bit').map(e => +e.textContent); return [0, 1, 2, 3, 4].map(r => parseInt(b.slice(r * 8, r * 8 + 8).join(''), 2)); };
      let [p, k, c, k2, back] = rows();
      eq('H is 0x48', p, 0x48);
      ok('cipher = plain XOR key, and XOR again restores it', c === (p ^ k) && k2 === k && back === p, rows());
      click(q('#xorBits button[data-i="0"]'));
      const r2 = rows(); ok('flipping the top key bit flips the top cipher bit', r2[1] === (k ^ 0x80) && r2[2] === (c ^ 0x80) && r2[4] === p, r2);
      click('#xorRand'); const r3 = rows(); ok('random key byte still round-trips', r3[2] === (r3[0] ^ r3[1]) && r3[4] === r3[0]);
      setVal('#xorChar', 'z'); eq('other letters work', rows()[0], 0x7a);
      setVal('#xorChar', 'H');
      const C = unhex(q('#otpC').textContent);
      eq('ciphertext is 14 bytes', C.length, 14);
      const fits = g => { const K = unhex(q('#otpK').textContent); return td.decode(C.map((b, i) => b ^ K[i])) === g; };
      setVal('#otpGuess', 'RETREAT AT TEN'); ok('a key exists for RETREAT AT TEN', fits('RETREAT AT TEN'));
      click('[data-guess="ORDER MORE TEA"]'); ok('a key exists for ORDER MORE TEA', fits('ORDER MORE TEA') && q('#otpGuess').value === 'ORDER MORE TEA');
      click('[data-guess="ATTACK AT DAWN"]'); ok('a key exists for ATTACK AT DAWN', fits('ATTACK AT DAWN'));
      setVal('#otpGuess', 'hi'); ok('short guesses are padded to 14 characters', fits('HI            '));
      ok('all three preset guesses are 14 characters', qa('[data-guess]').every(b => b.dataset.guess.length === 14));
      setVal('#otpGuess', 'RETREAT AT TEN');
    });

    await section('two-time pad', async () => {
      await show('twotime'); await sleep(60);
      const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();
      const on = [1, 3, 5].map(i => parseInt(fg.slice(i, i + 2), 16));
      const bits = id => { const d = q('#' + id).getContext('2d').getImageData(0, 0, 160, 80).data; const o = new Uint8Array(160 * 80); for (let i = 0; i < o.length; i++) o[i] = (d[i * 4] === on[0] && d[i * 4 + 1] === on[1] && d[i * 4 + 2] === on[2]) ? 1 : 0; return o; };
      const frac = b => b.reduce((a, v) => a + v, 0) / b.length;
      const same = (a, b) => a.every((v, i) => v === b[i]);
      const P1 = bits('tt1'), P2 = bits('tt2'), K = bits('ttK'), C1 = bits('ttC1'), C2 = bits('ttC2');
      ok('plaintext 1 has a picture in it', frac(P1) > 0.04 && frac(P1) < 0.6, frac(P1));
      ok('plaintext 2 has a picture in it', frac(P2) > 0.04 && frac(P2) < 0.6, frac(P2));
      ok('the two plaintexts differ', !same(P1, P2));
      ok('key is about half ones', Math.abs(frac(K) - 0.5) < 0.03, frac(K));
      ok('C1 = P1 XOR K', same(C1, P1.map((v, i) => v ^ K[i])));
      ok('C2 = P2 XOR K', same(C2, P2.map((v, i) => v ^ K[i])));
      ok('each ciphertext looks like noise', Math.abs(frac(C1) - 0.5) < 0.03 && Math.abs(frac(C2) - 0.5) < 0.03);
      ok('result is blank before the button is pressed', frac(bits('ttX')) === 0);
      click('#ttGo');
      ok('C1 XOR C2 = P1 XOR P2 exactly', same(bits('ttX'), P1.map((v, i) => v ^ P2[i])));
      ok('caption explains the result', /key cancelled/.test(q('#ttXcap').textContent));
      click('#ttHide'); ok('plaintexts and key can be hidden', frac(bits('tt1')) < 0.02 && frac(bits('ttK')) < 0.02 && same(bits('ttC1'), C1));
      click('#ttHide'); ok('and shown again', same(bits('tt1'), P1));
      click('#ttGo'); ok('XOR can be undone', frac(bits('ttX')) === 0);
    });

    /* ------------------------------------------------------------ part 2 demos */
    await section('toolbox', async () => {
      await show('toolbox');
      const seen = [];
      for (const b of qa('#tbList [data-tb]')) { b.click(); seen.push(q('#tbCard h3').textContent + '>' + q('#tbCard a').getAttribute('href')); }
      eq('five primitives, each linking to its demo', seen.join(' | '), 'Hash function>#hashing | Authenticated encryption>#aes | Message authentication code>#bitflip | Key exchange>#dh | Digital signature>#signatures');
      eq('one selected', qa('#tbList [aria-pressed="true"]').length, 1);
      click('#tbCard a'); await sleep(20); eq('demo link navigates', S[cur()].id, 'signatures');
    });

    await section('hashing', async () => {
      await show('hashing');
      setVal('#hA', 'abc'); setVal('#hB', 'abc'); await sleep(120);
      eq('SHA-256("abc") matches the NIST vector', q('#hHa').textContent, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      eq('identical inputs differ in 0 bits', q('#hCount').textContent + ':' + qa('#hGrid .d').length, '0:0');
      setVal('#hA', ''); await sleep(120);
      eq('SHA-256 of the empty string', q('#hHa').textContent, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      setVal('#hA', 'Transfer $100 to Bob'); setVal('#hB', 'Transfer $101 to Bob'); await sleep(150);
      const a = unhex(await sha('Transfer $100 to Bob')), b = unhex(await sha('Transfer $101 to Bob'));
      let n = 0; for (let i = 0; i < 32; i++) { let x = a[i] ^ b[i]; while (x) { n += x & 1; x >>= 1; } }
      eq('differing-bit count matches an independent count', q('#hCount').textContent, String(n));
      eq('grid shows the same number of red cells', qa('#hGrid .d').length, n);
      ok('roughly half of 256 bits change', n > 96 && n < 160, n);
      eq('both hashes shown', q('#hHa').textContent + q('#hHb').textContent, hex(a) + hex(b));
      eq('grid has 256 cells', qa('#hGrid i').length, 256);
    });

    await section('passwords', async () => {
      await show('passwords');
      await until(() => /^[0-9a-f]{64}$/.test(q('#pwHash').textContent));
      const target = q('#pwHash').textContent;
      click('#pwCrack');
      ok('crack finishes', await until(() => /Cracked/.test(q('#pwOut').textContent), 15000), q('#pwOut').textContent);
      const m = q('#pwOut').textContent.match(/PIN = (\d{4}), after ([\d,]+) guesses/);
      ok('cracked PIN really hashes to the leaked value', m && await sha(m[1]) === target, q('#pwOut').textContent);
      ok('guess count is PIN + 1', m && +m[2].replace(/,/g, '') === +m[1] + 1);
      let changed = false; for (let i = 0; i < 3 && !changed; i++) { click('#pwNew'); await sleep(80); changed = q('#pwHash').textContent !== target; }
      ok('new leak gives a new hash', changed);
      const rows = () => qa('#saltRows dd').map(d => d.textContent);
      await until(() => rows().length === 3);
      const h = (await sha('hunter2')).slice(0, 24) + '…';
      ok('unsalted: alice and bob share a hash, equal to SHA-256("hunter2")', rows()[0] === rows()[1] && rows()[0] === h && rows()[2] !== rows()[0], rows());
      click('#saltToggle'); await sleep(120);
      ok('salted: all three differ', new Set(rows()).size === 3 && rows()[0] !== h, rows());
      const salt = qa('#saltRows dt span')[0].textContent.replace('salt ', '');
      ok('salt is shown per user', /^[0-9a-f]{8}$/.test(salt) && new Set(qa('#saltRows dt span').map(s => s.textContent)).size === 3);
      click('#saltToggle'); await sleep(120); ok('salt can be removed again', rows()[0] === h);
      click('#kdfRun');
      ok('PBKDF2 timing completes', await until(() => /One guess: \d+ ms/.test(q('#kdfOut').textContent), 20000), q('#kdfOut').textContent);
      const ms = +q('#kdfOut').textContent.match(/One guess: (\d+) ms/)[1];
      ok('600,000 iterations take a noticeable time', ms >= 20, ms);
      ok('8-character keyspace figure (36^8 = 2.8e12)', Math.abs(36 ** 8 / 1e12 - 2.82) < 0.01);
      ok('2-3 minutes at 20 billion/s', 36 ** 8 / 2e10 / 60 > 2 && 36 ** 8 / 2e10 / 60 < 3);
    });

    await section('AES-GCM', async () => {
      await show('aes');
      await until(() => /^[0-9a-f]{64}$/.test(q('#aesKey').textContent));
      const keyHex = q('#aesKey').textContent;
      setVal('#aesIn', 'hello Bob'); click('#aesEnc'); await sleep(150);
      const iv = q('#aesIv').textContent, ct = q('#aesCt').textContent;
      ok('96-bit nonce', /^[0-9a-f]{24}$/.test(iv), iv);
      eq('ciphertext is message + 16-byte tag', ct.length, (9 + 16) * 2);
      eq('tag bytes are marked', q('#aesCt .tg').textContent.length, 32);
      const k = await crypto.subtle.importKey('raw', unhex(keyHex), 'AES-GCM', false, ['decrypt']);
      const pt = td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(iv) }, k, unhex(ct)));
      eq('an independent AES-GCM decrypt of the shown bytes recovers the text', pt, 'hello Bob');
      click('#aesDec'); await sleep(120); ok('decrypt with the right key', q('#aesOut').classList.contains('good') && q('#aesOut').textContent.includes('“hello Bob”'), q('#aesOut').textContent);
      click('#aesDecWrong'); await sleep(120); ok('a different key is rejected', q('#aesOut').classList.contains('bad') && /authentication failed/.test(q('#aesOut').textContent));
      click('#aesEnc2'); await sleep(150);
      ok('same text again gives a new nonce and ciphertext', q('#aesIv').textContent !== iv && q('#aesCt').textContent !== ct);
      setVal('#aesIn', ''); click('#aesEnc'); await sleep(120); eq('empty message is just the tag', q('#aesCt').textContent.length, 32);
      setVal('#aesIn', 'The launch code is 0000'); click('#aesEnc'); await sleep(120);
    });

    await section('ECB', async () => {
      await show('ecb');
      // known-answer test for the technique the slide uses (one-block CBC with a zero IV is ECB): FIPS-197 appendix C.1
      const kk = await crypto.subtle.importKey('raw', unhex('000102030405060708090a0b0c0d0e0f'), 'AES-CBC', false, ['encrypt']);
      const kat = hex(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, kk, unhex('00112233445566778899aabbccddeeff'))).slice(0, 32);
      eq('AES known-answer test (FIPS-197 C.1)', kat, '69c4e0d86a7b0430d8cdb78070b4c55a');
      const tiles = () => { const d = q('#ecbCanvas').getContext('2d').getImageData(0, 0, 192, 128).data; const out = []; for (let ty = 0; ty < 32; ty++) for (let tx = 0; tx < 48; tx++) { let s = ''; for (let j = 0; j < 16; j++) s += d[((ty * 4 + (j >> 2)) * 192 + tx * 4 + (j & 3)) * 4] + ','; out.push(s); } return out; };
      const pick = async m => { click(`#ecbBtns [data-mode="${m}"]`); await sleep(350); return tiles(); };
      const P = await pick('plain'), E = await pick('ecb');
      const uniqP = new Set(P).size, uniqE = new Set(E).size;
      eq('1,536 blocks', P.length, 1536);
      ok('the picture uses only a few distinct blocks', uniqP > 20 && uniqP < 400, uniqP);
      eq('ECB: as many distinct ciphertext blocks as plaintext blocks', uniqE, uniqP);
      const m = new Map(); let bij = true; P.forEach((p, i) => { if (m.has(p) && m.get(p) !== E[i]) bij = false; m.set(p, E[i]); });
      ok('ECB: equal plaintext blocks always give equal ciphertext blocks', bij);
      ok('ECB: every block is actually changed', P.every((p, i) => p !== E[i]));
      ok('caption reports the distinct block count', q('#ecbCap').textContent.includes(`Only ${uniqP} distinct blocks out of 1,536`), q('#ecbCap').textContent);
      const C = await pick('ctr');
      ok('CTR: essentially every block is different', new Set(C).size >= 1530, new Set(C).size);
      eq('one mode selected', qa('#ecbBtns [aria-pressed="true"]').length, 1);
      await pick('plain');
    });

    await section('bit flipping', async () => {
      await show('bitflip');
      await until(() => /^[0-9a-f]{32}$/.test(q('#bfC').textContent));
      const C = unhex(q('#bfC').textContent), P = te.encode('PAY $0010 TO BOB');
      const want = t => hex(P.map((b, i) => b ^ te.encode(t)[i]));
      setVal('#bfT', 'PAY $9999 TO EVE');
      eq('delta is P XOR P′', q('#bfD').textContent, want('PAY $9999 TO EVE'));
      eq('forged ciphertext is C XOR delta', q('#bfC2').textContent, hex(C.map((b, i) => b ^ unhex(want('PAY $9999 TO EVE'))[i])));
      click('#bfGo'); await sleep(250);
      ok('AES-CTR Bob reads the forged message', q('#bfCtr').classList.contains('bad') && q('#bfCtr').textContent.includes('“PAY $9999 TO EVE”'), q('#bfCtr').textContent);
      ok('AES-GCM Bob rejects it', q('#bfGcm').classList.contains('good') && /Rejected/.test(q('#bfGcm').textContent), q('#bfGcm').textContent);
      setVal('#bfT', 'SEND ALL TO MALL'); click('#bfGo'); await sleep(250);
      ok('any 16-character target works against CTR', q('#bfCtr').textContent.includes('“SEND ALL TO MALL”'));
      setVal('#bfT', 'PAY $1'); click('#bfGo'); await sleep(250);
      ok('short targets are padded', q('#bfCtr').textContent.includes('“' + 'PAY $1'.padEnd(16, ' ') + '”'), q('#bfCtr').textContent);
      setVal('#bfT', 'PAY $0010 TO BOB'); click('#bfGo'); await sleep(250);
      ok('unchanged message is accepted by GCM', /Accepted/.test(q('#bfGcm').textContent) && !q('#bfGcm').classList.contains('good'), q('#bfGcm').textContent);
      setVal('#bfT', 'PAY €9999 TO EVE'); click('#bfGo'); await sleep(200);
      ok('non-ASCII input is refused politely', /ASCII/.test(q('#bfCtr').textContent), q('#bfCtr').textContent);
      setVal('#bfT', 'PAY $9999 TO EVE'); click('#bfGo'); await sleep(250);
    });

    await section('key distribution', async () => {
      await show('keydist');
      let good = true;
      for (const n of [2, 3, 8, 25, 40]) {
        setVal('#kdN', n);
        if (qa('#kdSvg line').length !== n * (n - 1) / 2 || qa('#kdSvg circle').length !== n || q('#kdSym').textContent !== (n * (n - 1) / 2).toLocaleString('en-US') || q('#kdPub').textContent !== String(n) || q('#kdNLab').textContent !== String(n)) good = false;
      }
      ok('edges, nodes and counts are right for n = 2, 3, 8, 25, 40', good);
      eq('1,000 people need 499,500 keys', 1000 * 999 / 2, 499500);
      setVal('#kdN', 8);
    });

    await section('diffie-hellman', async () => {
      await show('dh');
      const vals = () => qa('#dhEq .v').map(v => BigInt(v.textContent));
      setVal('#dhP', '23,5', 'change'); setVal('#dhA', 6); setVal('#dhB', 15);
      eq('textbook numbers: A=8, B=19, secret=2', vals().join(','), '8,19,2,2');
      ok('shared-secret tag shown', !!q('#dhEq .tag.good'));
      click('#dhEve'); await until(() => /Eve found/.test(q('#dhEveOut').textContent), 3000);
      ok('Eve brute-forces the tiny prime', /Eve found a = 6 /.test(q('#dhEveOut').textContent), q('#dhEveOut').textContent);
      let all = true;
      for (const [p, g] of [[23, 5], [1019, 2], [2147483647, 7]]) {
        setVal('#dhP', `${p},${g}`, 'change');
        const a = BigInt(q('#dhA').value), b = BigInt(q('#dhB').value), P = BigInt(p), G = BigInt(g);
        const [Av, Bv, s1, s2] = vals();
        if (Av !== bmodpow(G, a, P) || Bv !== bmodpow(G, b, P) || s1 !== bmodpow(G, a * b, P) || s1 !== s2) all = false;
        if (a < 1n || a >= P || b < 1n || b >= P) all = false;
      }
      ok('public values and shared secret verified with independent big-integer maths for all three primes', all);
      ok('2^31 - 1 is the prime shown', 2147483647 === 2 ** 31 - 1);
      ok('large prime picks a large secret for Alice', +q('#dhA').value >= 1.2e9);
      click('#dhEve');
      ok('Eve gives up on the 31-bit prime', await until(() => /gave up/.test(q('#dhEveOut').textContent), 5000), q('#dhEveOut').textContent);
      setVal('#dhP', '1019,2', 'change'); click('#dhEve'); await until(() => /Eve found/.test(q('#dhEveOut').textContent), 3000);
      const k = BigInt(q('#dhEveOut').textContent.match(/a = ([\d,]+)/)[1].replace(/,/g, ''));
      eq('Eve\'s exponent really produces A', bmodpow(2n, k, 1019n), vals()[0]);
      setVal('#dhA', ''); ok('empty secret does not break the maths', vals().length === 4);
      // paint
      const rgb = el => getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
      let paintOk = true;
      for (const a of qa('#dhSwA .swatch').map(s => s.dataset.c)) for (const b of qa('#dhSwB .swatch').map(s => s.dataset.c)) {
        q(`#dhSwA [data-c="${a}"]`).click(); q(`#dhSwB [data-c="${b}"]`).click();
        q('#dhFinA').style.transition = q('#dhFinB').style.transition = q('#dhMixA').style.transition = q('#dhMixB').style.transition = 'none';
        const h = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
        const mix = (...cs) => [0, 1, 2].map(i => Math.round(cs.reduce((s, c) => s + h(c)[i], 0) / cs.length));
        const fa = rgb(q('#dhFinA')), fb = rgb(q('#dhFinB'));
        if (fa.join() !== fb.join() || fa.join() !== mix('#D2FF00', a, b).join() || rgb(q('#dhMixA')).join() !== mix('#D2FF00', a).join() || rgb(q('#dhMixB')).join() !== mix('#D2FF00', b).join()) paintOk = false;
        if (rgb(q('#dhWireA')).join() === rgb(q('#dhWireB')).join()) paintOk = false;
      }
      ok('paint: both sides reach the same colour for all 16 combinations, and the public mixes differ', paintOk);
      eq('one swatch selected per side', qa('.swatch[aria-pressed="true"]').length, 2);
      setVal('#dhP', '2147483647,7', 'change'); click('#dhEve'); await sleep(100); await show('rsa'); await sleep(300); const txt = q('#dhEveOut').textContent; await sleep(400);
      eq('leaving the slide stops Eve\'s search', q('#dhEveOut').textContent, txt);
      await show('dh'); setVal('#dhP', '23,5', 'change'); setVal('#dhA', 6); setVal('#dhB', 15);
      q(`#dhSwA .swatch`).click(); q(`#dhSwB .swatch`).click();
    });

    await section('RSA', async () => {
      await show('rsa');
      setVal('#rsaP', '61', 'change'); setVal('#rsaQ', '53', 'change'); setVal('#rsaMsg', 'HELLO');
      const steps = q('#rsaSteps').textContent;
      ok('textbook key: n=3233, phi=3120, e=17, d=2753', steps.includes('61 × 53 = 3233') && steps.includes('= 3120') && steps.includes('(e = 17, n = 3233)') && steps.includes('= 2753'), steps);
      const cells = () => qa('#rsaCells > div').map(d => ({ ch: q('b', d).textContent, m: BigInt(d.childNodes[1].textContent.replace('m=', '')), c: BigInt(q('span', d).textContent.replace('c=', '')), back: BigInt(q('small', d).textContent.replace('→ ', '')), rep: d.classList.contains('rep') }));
      const cs = cells();
      eq('five letters', cs.map(c => c.ch).join(''), 'HELLO');
      ok('each c = m^17 mod 3233 and decrypts back', cs.every(c => c.c === bmodpow(c.m, 17n, 3233n) && c.back === c.m && bmodpow(c.c, 2753n, 3233n) === c.m));
      eq('the repeated L is outlined', cs.map(c => +c.rep).join(''), '00110');
      ok('determinism note shown', /deterministic/.test(q('#rsaNote').textContent));
      click('#rsaFactor'); ok('Eve factors n and recovers d', /3233 = 53 × 61/.test(q('#rsaFactorOut').textContent) && /d = 2753/.test(q('#rsaFactorOut').textContent), q('#rsaFactorOut').textContent);
      // every prime pair in the pickers
      const primes = qa('#rsaP option').map(o => +o.value);
      ok('picker lists only primes', primes.every(p => { for (let i = 2; i * i <= p; i++) if (p % i === 0) return false; return p > 1; }));
      let pairs = 0, bad = [];
      for (const p of primes) for (const qq of primes) {
        if (p === qq) continue;
        setVal('#rsaP', String(p), 'change'); setVal('#rsaQ', String(qq), 'change');
        const t = q('#rsaSteps').textContent;
        const n = +t.match(/= (\d+)φ/)[1], phi = +t.match(/\(p−1\)\(q−1\) = (\d+)/)[1], e = +t.match(/e = (\d+)/)[1], d = +t.match(/mod φ = (\d+)/)[1];
        const c2 = cells();
        if (n !== p * qq || phi !== (p - 1) * (qq - 1) || (e * d) % phi !== 1 || e >= phi || c2.length !== 5 || !c2.every(c => c.back === c.m && c.c === bmodpow(c.m, BigInt(e), BigInt(n)) && c.m < BigInt(n))) bad.push(`${p},${qq}`);
        pairs++;
      }
      ok(`key generation and round-trip verified for all ${pairs} prime pairs`, bad.length === 0, bad.slice(0, 8));
      setVal('#rsaP', '61', 'change'); setVal('#rsaQ', '61', 'change');
      ok('equal primes are refused', /two different primes/.test(q('#rsaNote').textContent));
      setVal('#rsaQ', '53', 'change'); setVal('#rsaMsg', 'A b');
      eq('spaces are shown as sp', cells().map(c => c.ch).join(','), 'A,sp,b');
      setVal('#rsaMsg', 'HELLO');
      click('#rsaReal');
      ok('real RSA-2048 key is generated', await until(() => /digits/.test(q('#rsaBig').textContent), 30000), q('#rsaBig').textContent.slice(0, 80));
      const mm = q('#rsaBig').textContent.match(/n \((\d+) digits.*e = 65537\):(\d+)/);
      ok('modulus has 617 decimal digits and is 2048 bits', mm && mm[1] === '617' && mm[2].length === 617 && BigInt(mm[2]).toString(2).length === 2048, mm && mm[1]);
      ok('modulus is odd', mm && BigInt(mm[2]) % 2n === 1n);
    });

    await section('signatures', async () => {
      await show('signatures');
      await until(() => /65 bytes/.test(q('#sgPub').textContent));
      ok('public key shown', /^04[0-9a-f]{38}…[0-9a-f]{12} \(65 bytes\)$/.test(q('#sgPub').textContent), q('#sgPub').textContent);
      const msg = q('#sgMsg').value;
      click('#sgSign'); await until(() => /Valid|Invalid/.test(q('#sgOut').textContent));
      ok('Alice\'s signature verifies', q('#sgOut').classList.contains('good') && q('#sgOut').textContent.startsWith('Valid.'));
      ok('signature is 64 bytes (r || s)', /^[0-9a-f]{128} \(Alice\)$/.test(q('#sgSig').textContent), q('#sgSig').textContent);
      setVal('#sgMsg', msg + '!'); await until(() => /Invalid/.test(q('#sgOut').textContent), 2000);
      ok('one extra character breaks the signature', q('#sgOut').classList.contains('bad') && /changed after Alice signed/.test(q('#sgOut').textContent), q('#sgOut').textContent);
      setVal('#sgMsg', msg); await until(() => /^Valid/.test(q('#sgOut').textContent), 2000);
      ok('restoring the text makes it valid again', q('#sgOut').classList.contains('good'));
      setVal('#sgMsg', msg.replace('1842', '1843')); await until(() => /Invalid/.test(q('#sgOut').textContent), 2000);
      ok('changing one digit breaks it', q('#sgOut').classList.contains('bad'));
      setVal('#sgMsg', msg);
      click('#sgMal'); await until(() => /Mallory/.test(q('#sgSig').textContent), 2000); await sleep(120);
      ok('Mallory\'s signature is rejected', q('#sgOut').classList.contains('bad') && /not made with Alice/.test(q('#sgOut').textContent), q('#sgOut').textContent);
      const s1 = q('#sgSig').textContent; click('#sgSign'); await until(() => /Alice/.test(q('#sgSig').textContent), 2000); await sleep(120);
      ok('signing again gives a fresh valid signature', q('#sgSig').textContent !== s1 && q('#sgOut').classList.contains('good'));
    });

    await section('TLS', async () => {
      await show('tls');
      click('#tlsReset');
      const steps = () => qa('#tlsSteps .step'), on = () => qa('#tlsPrims .prim.on').map(p => p.dataset.p).join(',');
      eq('eight handshake steps', steps().length, 8);
      ok('nothing highlighted before starting', !q('#tlsSteps .cur') && on() === '' && q('#tlsPrev').disabled);
      const want = ['kex', 'kex', 'kex,kdf,hash', 'sig,aead', 'hash,sig,aead', 'mac,aead', 'sig,mac,aead', 'kdf,aead'];
      let seq = true;
      for (let i = 0; i < 8; i++) { click('#tlsNext'); if (steps().findIndex(s => s.classList.contains('cur')) !== i || on() !== want[i] || q('#tlsCount').textContent !== `Step ${i + 1} of 8` || steps().filter(s => s.classList.contains('done')).length !== i || q('#tlsTitle').textContent !== q('h3', steps()[i]).textContent || q('#tlsText').textContent.length < 60) seq = false; }
      ok('each step highlights the right primitives', seq, on());
      ok('Next is disabled at the end', q('#tlsNext').disabled);
      eq('order of messages', steps().map(s => q('h3', s).textContent).join(' > '), 'ClientHello > ServerHello > Diffie–Hellman, then derive keys > {Certificate} > {CertificateVerify} > {Finished} > Verify, then {Finished} > Application data');
      eq('messages after the key exchange are marked encrypted', steps().map(s => q('.enc', s) ? 1 : 0).join(''), '00011111');
      click('#tlsPrev'); eq('Back', steps().findIndex(s => s.classList.contains('cur')), 6);
      steps()[2].click(); eq('clicking a step selects it', steps().findIndex(s => s.classList.contains('cur')), 2);
      click('#tlsReset'); ok('Reset', !q('#tlsSteps .cur') && on() === '' && /Ready/.test(q('#tlsTitle').textContent));
    });

    await section('post-quantum', async () => {
      await show('pq');
      const st = () => qa('#pqBody tr').map(r => q('.tag', r).textContent).join(',');
      eq('seven rows, all secure classically', st(), 'Secure,Secure,Secure,Secure,Secure,Secure,Secure');
      click('#pqToggle');
      eq('quantum statuses', st(), 'Broken,Broken,Broken,Weakened,Fine,Fine,Fine (as far as we know)');
      eq('row order', qa('#pqBody tr td:first-child').map(t => t.textContent).join('|'), 'RSA-2048|X25519, ECDSA, Ed25519|Finite-field Diffie–Hellman|AES-128|AES-256|SHA-256 / SHA-3|ML-KEM, ML-DSA');
      click('#pqToggle'); eq('toggle back', st(), 'Secure,Secure,Secure,Secure,Secure,Secure,Secure');
    });

    await section('rules, quiz, closing', async () => {
      await show('rules');
      const d = qa('#rules details');
      eq('eight rules', d.length, 8);
      d.forEach(x => q('summary', x).click());
      ok('every rule opens and has an explanation', d.every(x => x.open && q('div', x).textContent.trim().length > 40));
      d.forEach(x => q('summary', x).click()); ok('and closes', d.every(x => !x.open));
      await show('quiz');
      const z = qa('#quiz details');
      eq('four snippets', qa('#quiz pre.code').length + ':' + z.length, '4:4');
      z.forEach(x => q('summary', x).click()); ok('answers reveal', z.every(x => x.open && q('.ans b', x)));
      z.forEach(x => q('summary', x).click());
      await show('thanks');
      click(q('#thanks a[href="#part2"]')); await sleep(20); eq('closing link to Part 2', S[cur()].id, 'part2');
      click(q('#part2 a[href="#tls"]')); await sleep(20); eq('milestone chip jumps to TLS', S[cur()].id, 'tls');
      await show('recap1'); click(q('#recap1 a[href="#part2"]')); await sleep(20); eq('“Continue to Part 2”', S[cur()].id, 'part2');
      await show('part1'); click(q('#part1 a[href="#classical"]')); await sleep(20); eq('title link to Part 1', S[cur()].id, 'classical');
    });

    /* ------------------------------------------------------------ brand */
    await section('brand', async () => {
      const fams = new Set();
      for (const s of S) for (const el of qa('*', s)) { if (el.closest('.notes')) continue; if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) fams.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim()); }
      for (const el of qa('.bar *, .menu *, .notes-panel *')) if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) fams.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());
      eq('only brand typefaces are used', [...fams].sort().join(', '), 'JetBrains Mono, Material Symbols Outlined, Montserrat');
      const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, ''));
      ok('Montserrat, JetBrains Mono and Material Symbols actually loaded', ['Montserrat', 'JetBrains Mono', 'Material Symbols Outlined'].every(f => loaded.includes(f)), loaded);
      await show('caesar');
      const logo = getComputedStyle(q('.slide.active'), '::before');
      const lw = parseFloat(logo.width), lh = parseFloat(logo.height);
      ok('logo present, at least 96px wide, correct proportions', logo.backgroundImage.includes('data:image/svg+xml') && lw >= 96 && Math.abs(lw / lh - 572.6 / 124.72) < 0.05, `${lw}x${lh}`);
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      ok('logo colourway matches the surface', logo.backgroundImage.includes(dark ? 'ebebeb' : '195050'));
      ok('watermark present on content slides', getComputedStyle(q('.slide.active')).backgroundImage.includes('data:image/svg+xml'));
      await show('part1');
      const deep = getComputedStyle(q('.slide.active'));
      ok('title slide uses the deep-green gradient and light logo', deep.backgroundImage.includes('linear-gradient') && getComputedStyle(q('.slide.active'), '::before').backgroundImage.includes('ebebeb'));
      eq('primary button is safety yellow with green-5 text', getComputedStyle(q('#recap1 .btn.primary')).backgroundColor + '/' + getComputedStyle(q('#recap1 .btn.primary')).color, 'rgb(210, 255, 0)/rgb(0, 50, 50)');
      eq('progress bar is safety yellow', getComputedStyle(q('#progress')).backgroundColor, 'rgb(210, 255, 0)');
      eq('button radius 8px, card radius 12px', getComputedStyle(q('.btn')).borderRadius + ',' + getComputedStyle(q('.panel')).borderRadius, '8px,12px');
      eq('document language is British English', document.documentElement.lang || 'en-GB', 'en-GB');
    });

    go(0); toggleNotes(false); toggleMenu(false);
    removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr);
    ok('no uncaught errors during the run', errs.length === 0, errs.join(' | '));
    const failed = R.filter(r => !r.pass);
    return { total: R.length, passed: R.length - failed.length, failed };
  };

  /* Layout: run at each viewport size. Reports sideways overflow and which slides need vertical scrolling. */
  window.deckLayoutReport = async function () {
    const S = slideEls(), out = { viewport: `${innerWidth}x${innerHeight}`, bodyOverflowX: document.documentElement.scrollWidth > innerWidth, sideways: [], needsScroll: [], clipped: [] };
    const start = cur();
    for (let i = 0; i < S.length; i++) {
      go(i); await sleep(30);
      const s = S[i], r = s.getBoundingClientRect();
      if (s.scrollWidth > s.clientWidth + 1) out.sideways.push(s.id);
      if (s.scrollHeight > s.clientHeight + 1) out.needsScroll.push(`${s.id}:+${s.scrollHeight - s.clientHeight}`);
      for (const pn of qa('.panel, .stage, .goal, details.reveal, .part-link', s)) { const b = pn.getBoundingClientRect(); if (b.width < 140 || b.height > innerHeight * 1.2) out.clipped.push(`${s.id}: odd box ${Math.round(b.width)}x${Math.round(b.height)} .${pn.className}`); }
      for (const el of qa('.slide-inner *', s)) {
        if (el.closest('.scroll-x, .crib-wrap, pre, .notes, svg, .bf-row:not(.best)')) continue;  // those clip or scroll their own content
        const b = el.getBoundingClientRect();
        if (b.width && (b.right > r.right + 1 || b.left < r.left - 1)) { out.clipped.push(`${s.id}: ${el.tagName.toLowerCase()}.${el.className && el.className.baseVal === undefined ? el.className : ''} ${Math.round(b.left)}..${Math.round(b.right)}`); break; }
      }
      const logo = getComputedStyle(s, '::before'); const first = q('.slide-inner > *', s).getBoundingClientRect();
      if (parseFloat(logo.top) + parseFloat(logo.height) > first.top - r.top + s.scrollTop - 4) out.clipped.push(`${s.id}: logo touches content`);
    }
    const bar = q('.bar').getBoundingClientRect();
    for (const el of qa('.bar > *:not(.track):not(.progress)')) { const b = el.getBoundingClientRect(); if (b.width && (b.right > bar.right + 1 || b.left < bar.left - 1)) out.clipped.push('bar: ' + el.className); }
    const kids = qa('.bar > .parts, .bar > .title, .bar > .pgno, .bar > .icons').filter(e => e.getBoundingClientRect().width).map(e => e.getBoundingClientRect());
    for (let i = 1; i < kids.length; i++) if (kids[i].left < kids[i - 1].right - 1) out.clipped.push('bar: items overlap');
    go(start);
    return out;
  };

  /* Put every demo into its "result" state so the contrast audit sees verdicts, highlights and selected states. */
  window.deckPrimeStates = async function () {
    const c = s => { const e = q(s); if (e) e.click(); };
    const set = (s, v, ev = 'input') => { const e = q(s); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); };
    c('[data-era="caesar"]'); c('[data-attack="tamper"]'); set('#vKb', 9); c('#bfRun'); c('#fqRank');
    set('#cribPos', 0); c('[data-poll="b"]'); c('#ttGo'); c('[data-tb="aead"]');
    set('#hA', 'Transfer $100 to Bob'); set('#hB', 'Transfer $101 to Bob'); c('#pwCrack'); c('#kdfRun');
    c('#aesEnc'); c('#bfGo'); c('#dhEve'); c('#rsaFactor'); c('#sgSign'); c('#pqToggle');
    c('#tlsReset'); c('#tlsNext'); c('#tlsNext'); c('#tlsNext'); c('#tlsNext');
    qa('details.reveal').forEach(d => { d.open = true; });
    await sleep(3500); c('#aesDecWrong'); set('#sgMsg', q('#sgMsg').value + '!'); await sleep(600);
    return 'primed';
  };

  /* Contrast: every piece of visible text against the colour actually behind it. */
  window.deckContrastReport = async function () {
    const parse = c => {
      let m = c.match(/^rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,/]+/).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
      m = c.match(/^color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[ /]+/).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
      return [0, 0, 0, 0];
    };
    const over = (top, base) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + base[i] * (1 - a)).concat(1); };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const bgOf = el => {
      const stack = []; let e = el;
      while (e && e.nodeType === 1) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] >= 1) break;
        if (e.classList.contains('slide')) { stack.push(e.classList.contains('deep') ? [28, 86, 83, 1] : parse(getComputedStyle(document.body).backgroundColor)); break; }
        e = e.parentElement; }
      if (!stack.length || stack[stack.length - 1][3] < 1) stack.push(parse(getComputedStyle(document.body).backgroundColor));
      let base = stack.pop(); while (stack.length) base = over(stack.pop(), base); return base;
    };
    const S = slideEls(), low = [], start = cur(); let checked = 0;
    const scan = (root, label) => {
      for (const el of qa('*', root)) {
        if (el.closest('.notes, .gs-icon, [hidden], svg, canvas') || el.disabled) continue;
        if (el.closest('.step:not(.cur)') || el.closest('.bf-row:not(.show)')) continue;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || !el.getClientRects().length) continue;
        const bg = bgOf(el); const fg = over(parse(cs.color), bg);
        const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
        const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        const r = ratio(fg, bg); checked++;
        if (r < need) low.push(`${label}: "${el.textContent.trim().slice(0, 28)}" ${r.toFixed(2)} (needs ${need}) ${Math.round(size)}px ${cs.color} on rgb(${bg.slice(0, 3).map(Math.round)})`);
      }
    };
    for (let i = 0; i < S.length; i++) { go(i); await sleep(40); scan(S[i], S[i].id); }
    scan(q('.bar'), 'bar');
    toggleNotes(true); scan(q('#notesPanel'), 'notes'); toggleNotes(false);
    toggleMenu(true); scan(q('#menu'), 'menu'); toggleMenu(false);
    go(start);
    return { theme: document.documentElement.dataset.theme || 'system', checked, low: [...new Set(low)] };
  };
})();
