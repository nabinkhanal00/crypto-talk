/* Test suite for the Part 1 session ("From Scytale to Signal").
   Load the deck, then in the console:  await runP1Tests()  ·  await deckLayoutReport()  ·  await p1PrimeStates(); await deckContrastReport()
   Demo results are checked against independent calculations written here, not against the deck's own helpers. */
(() => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const te = new TextEncoder(), td = new TextDecoder();
  const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  const refCaesar = (s, k) => [...s.toUpperCase()].map(c => A.includes(c) ? A[(A.indexOf(c) + k + 2600) % 26] : c).join('');
  const refVig = (s, key) => { let j = 0; return [...s.toUpperCase()].map(c => { if (!A.includes(c)) return c; const k = A.indexOf(key[j++ % key.length]); return A[(A.indexOf(c) + k) % 26]; }).join(''); };
  const only = s => s.toUpperCase().replace(/[^A-Z]/g, '');
  const refScytale = (text, n) => { const t = only(text), cols = Math.ceil(t.length / n); let o = ''; for (let c = 0; c < cols; c++) for (let r = 0; r < n; r++) o += t[r * cols + c] || '·'; return o; };
  const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
  const slideEls = () => qa('.slide');
  const cur_ = () => slideEls().findIndex(s => s.classList.contains('active'));
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(40); } return false; };
  const visible = el => !!el && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0 && +getComputedStyle(el).opacity > 0.05;

  window.runP1Tests = async function () {
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
    const noAnim = document.createElement('style'); noAnim.textContent = '*{transition:none!important}'; document.head.appendChild(noAnim);
    const section = async (name, fn) => { try { await fn(); } catch (e) { ok(`${name}: threw`, false, e && (e.stack || e)); } };
    const S = slideEls(), N = S.length;
    const minsOf_ = s => parseFloat(q('.notes', s).dataset.min);

    /* ------------------------------------------------------------ structure */
    await section('structure', async () => {
      eq('31 slides', N, 31);
      eq('page title', document.title, 'From Scytale to Signal');
      eq('slide ids are unique', new Set(S.map(s => s.id)).size, N);
      ok('every slide has a title and a chapter', S.every(s => s.dataset.title && s.dataset.chapter));
      const chs = [...new Set(S.map(s => s.dataset.chapter))];
      eq('five chapters in order', chs.join(','), 'intro,ancient,enigma,secrecy,e2e');
      eq('slides per chapter', chs.map(c => S.filter(s => s.dataset.chapter === c).length).join(','), '6,9,7,4,5');
      ok('chapters are contiguous', S.every((s, i) => i === 0 || chs.indexOf(s.dataset.chapter) >= chs.indexOf(S[i - 1].dataset.chapter)));
      ok('every slide has speaker notes with a duration', S.every(s => { const n = q('.notes', s); return n && n.textContent.trim().length > 60 && parseFloat(n.dataset.min) > 0; }));
      const total = S.reduce((a, s) => a + minsOf_(s), 0), core = S.reduce((a, s) => a + (s.dataset.optional ? 0 : minsOf_(s)), 0);
      ok('about 50.5 minutes core, 55 with optional slides', Math.abs(core - 50.5) < 1e-9 && Math.abs(total - 55) < 1e-9, `${core} / ${total}`);
      eq('optional slides', S.filter(s => s.dataset.optional).map(s => s.id).join(','), 'enigma-history,kerckhoffs,random');
      ok('no Part 2 slides in this deck (key sharing is set aside for Part 2)', !['ratchet', 'keydist', 'padlock', 'paint', 'safety', 'toolbox', 'hashing', 'passwords', 'aes', 'ecb', 'bitflip', 'rsa', 'signatures', 'tls', 'pq', 'rules', 'quiz', 'part2', 'dh'].some(id => indexOfId(id) >= 0));
      const reserved = ['settings', 'sidebar', 'customize', 'upgrade', 'downloads'];
      ok('no reserved or unsafe slide ids', S.every(s => /^[a-z0-9-]+$/.test(s.id) && !reserved.includes(s.id) && !s.id.startsWith('comment-')));
      const links = qa('a[href^="#"]');
      ok('every in-deck link points at a slide', links.length >= 2 && links.every(a => indexOfId(a.getAttribute('href').slice(1)) >= 0), links.filter(a => indexOfId(a.getAttribute('href').slice(1)) < 0).map(a => a.getAttribute('href')));
      ok('agenda buttons point at slides', qa('#agendaList [data-go]').length === 5 && qa('#agendaList [data-go]').every(b => indexOfId(b.dataset.go) >= 0));
      const ext = qa('a[href^="http"]');
      ok('external links open in a new tab safely', ext.length >= 1 && ext.every(a => a.target === '_blank' && /noopener/.test(a.rel)));
      const text = S.map(s => s.textContent).join(' ');
      const emoji = text.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}]/gu);
      ok('no emoji or pictograph glyphs in slide text', !emoji, emoji);
      const us = (text.match(/\b\w*(colors?|center|favorite|behavior|defense|standardized|popularized|recogniz|organiz|analyz|gray|neighbor)\w*/gi) || []).concat(text.match(/\bmath\b/g) || []);
      ok('UK spelling in copy', us.length === 0, us);
      const kp = (S.map(s => s.textContent + ' ' + (q('.notes', s)?.textContent || '')).join(' ').match(/public key|private key|key pair|padlock trick|safety number|Diffie/gi) || []);
      ok('no public/private keys or key-exchange talk in Part 1', kp.length === 0, kp);
      const ids = qa('[id]').map(e => e.id);
      eq('no duplicate element ids', new Set(ids).size, ids.length);
      eq('deep slides', S.filter(s => s.classList.contains('deep')).map(s => s.id).join(','), 'start,agenda,thanks');
      ok('h2 headlines end with punctuation', qa('.slide h2').every(h => /[.?!”]$/.test(h.textContent.trim())), qa('.slide h2').filter(h => !/[.?!”]$/.test(h.textContent.trim())).map(h => h.textContent));
      ok('build counts', S.filter(s => s.dataset.builds).map(s => s.id + ':' + s.dataset.builds).join(',') === 'enigma-wiring:6,e2e-route:2,e2e-app:5', S.filter(s => s.dataset.builds).map(s => s.id + ':' + s.dataset.builds).join(','));
    });

    /* ------------------------------------------------------------ navigation, builds, chapters */
    await section('navigation', async () => {
      let allOk = true, detail = '';
      for (let i = 0; i < N; i++) {
        location.hash = '#' + S[i].id; await sleep(20);
        const pills = qa('#chapterPills button');
        const good = cur_() === i && qa('.slide.active').length === 1 && q('#barTitle').textContent === S[i].dataset.title
          && q('#barCount').textContent === `${String(i + 1).padStart(2, '0')} / ${N}`
          && S.every((s, k) => s.inert === (k !== i))
          && pills.filter(b => b.getAttribute('aria-current') === 'true').map(b => b.dataset.ch).join() === S[i].dataset.chapter
          && Math.abs(parseFloat(q('#progress').style.width) - (i + 1) / N * 100) < 0.01
          && (S[i]._build || 0) === 0
          && q('#barStep').hidden === !S[i].dataset.builds;
        if (!good) { allOk = false; detail += S[i].id + ' '; }
      }
      ok('hash routing, title, counter, progress, chapter pill and step indicator for all 31 slides', allOk, detail);
      // builds: → walks every step, then leaves; ← from the next slide lands on the last step
      let buildsOk = true, bd = '';
      for (const s of S.filter(x => x.dataset.builds)) {
        const i = indexOfId(s.id), n = +s.dataset.builds;
        go(i); await sleep(10);
        for (let b = 1; b <= n; b++) { key('ArrowRight'); if (cur_() !== i || s._build !== b || q('#barStep').textContent !== `step ${b} of ${n}`) { buildsOk = false; bd += `${s.id}@${b} `; } }
        key('ArrowRight'); if (cur_() !== i + 1) { buildsOk = false; bd += `${s.id} did not advance `; }
        key('ArrowLeft'); if (cur_() !== i || s._build !== n) { buildsOk = false; bd += `${s.id} back did not land on last step `; }
        key('ArrowLeft'); if (s._build !== n - 1) { buildsOk = false; bd += `${s.id} back-step `; }
        click('#btnPrev'); if (s._build !== Math.max(0, n - 2)) { buildsOk = false; bd += `${s.id} prev button `; }
        click('#btnNext'); if (s._build !== Math.max(1, n - 1)) { buildsOk = false; bd += `${s.id} next button `; }
      }
      ok('builds step forward and back on all four step-through slides', buildsOk, bd);
      go(indexOfId('vocab')); await sleep(10); go(indexOfId('e2e-app')); await sleep(10);
      eq('jumping to a build slide starts at step 0', slides[indexOfId('e2e-app')]._build, 0);
      go(0); await sleep(20);
      ok('Back is disabled on the first slide', q('#btnPrev').disabled && !q('#btnNext').disabled);
      key('ArrowLeft'); eq('ArrowLeft on first slide stays', cur_(), 0);
      key('ArrowRight'); eq('ArrowRight', cur_(), 1);
      key(' '); eq('Space', cur_(), 2);
      key(' ', { shiftKey: true }); eq('Shift+Space', cur_(), 1);
      key('PageDown'); eq('PageDown', cur_(), 2);
      key('PageUp'); eq('PageUp', cur_(), 1);
      key('End'); eq('End', cur_(), N - 1);
      ok('Next is disabled on the last slide', q('#btnNext').disabled && !q('#btnPrev').disabled);
      key('ArrowRight'); eq('ArrowRight on last slide stays', cur_(), N - 1);
      key('Home'); eq('Home', cur_(), 0);
      key('ArrowRight', { metaKey: true }); eq('Cmd+ArrowRight is left to the browser', cur_(), 0);
      // chapter pills
      const pills = qa('#chapterPills button');
      eq('five chapter pills', pills.length, 5);
      let pillOk = true; for (const b of pills) { b.click(); await sleep(5); if (S[cur_()].dataset.chapter !== b.dataset.ch || cur_() !== S.findIndex(s => s.dataset.chapter === b.dataset.ch)) pillOk = false; }
      ok('each chapter pill jumps to the first slide of its chapter', pillOk);
      eq('pill labels', pills.map(b => b.textContent.trim()).join('|'), '1 · Intro|2 · Ancient|3 · Enigma|4 · Secrecy|5 · End-to-end');
      // agenda
      let agOk = true; for (const b of qa('#agendaList [data-go]')) { go(indexOfId('agenda')); await sleep(5); b.click(); await sleep(5); if (S[cur_()].id !== b.dataset.go) agOk = false; }
      ok('agenda items jump to their chapter', agOk);
      // notes
      go(0); await sleep(10);
      key('n'); ok('N opens notes', !q('#notesPanel').hidden && q('#btnNotes').getAttribute('aria-pressed') === 'true');
      eq('notes show this slide\'s text', q('#notesBody').textContent.trim(), q('.notes', S[0]).textContent.trim());
      key('ArrowRight'); eq('notes follow the slide', q('#notesBody').textContent.trim(), q('.notes', S[1]).textContent.trim());
      await show('random'); ok('optional slides are marked in notes', /optional/.test(q('#notesTitle').textContent));
      key('Escape'); ok('Escape closes notes', q('#notesPanel').hidden);
      // menu
      key('m'); ok('M opens the slide menu', !q('#menu').hidden);
      const items = qa('#menuInner li button');
      eq('menu lists every slide', items.length, N);
      ok('menu titles match slides', items.every((b, i) => q('.t', b).textContent === S[i].dataset.title));
      eq('menu has five chapter groups', qa('#menuInner > div').length, 5);
      ok('menu summary gives the timing', /31 slides · about 51 minutes, or 55 with the optional slides/.test(q('#menuSummary').textContent), q('#menuSummary').textContent);
      eq('menu marks optional slides', qa('#menuInner .tag').filter(t => t.textContent === 'optional').length, 3);
      const before = cur_(); key('ArrowRight'); eq('arrow keys do not move slides while the menu is open', cur_(), before);
      items[7].click(); await sleep(20);
      ok('menu click jumps and closes', cur_() === 7 && q('#menu').hidden);
      // theme
      const root = document.documentElement, t0 = root.dataset.theme;
      const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
      key('t'); eq('T switches theme', root.dataset.theme, sysDark ? 'light' : 'dark');
      if (t0) root.dataset.theme = t0; else delete root.dataset.theme;
      // typing guard and letter capture
      await show('vocab');
      const inp = q('#vPlain'); inp.focus();
      key('ArrowRight', {}, inp); key('n', {}, inp);
      ok('keys typed in a text box do not navigate or open notes', S[cur_()].id === 'vocab' && q('#notesPanel').hidden);
      key('Escape', {}, inp); ok('Escape leaves the text box', document.activeElement !== inp);
      await show('enigma-wiring'); key('n'); ok('letter keys on the wiring slide go to the machine, not shortcuts', q('#notesPanel').hidden && window.__wiring.trace && A[window.__wiring.trace.k] === 'N');
      // swipe
      await show('caesar');
      const inner = q('.slide.active .slide-inner');
      const touch = (type, x, y) => { const e = new Event(type, { bubbles: true }); e.touches = [{ clientX: x, clientY: y }]; e.changedTouches = [{ clientX: x, clientY: y }]; inner.dispatchEvent(e); };
      const at = cur_(); touch('touchstart', 300, 300); touch('touchend', 120, 310); eq('swipe left goes forward', cur_(), at + 1);
      // icons
      ok('icon font active (no fallback)', !root.classList.contains('no-icons') && q('#btnNext .gs-icon').getBoundingClientRect().width <= 30);
    });

    /* ------------------------------------------------------------ light and dark title slides */
    await section('theme of deep slides', async () => {
      const root = document.documentElement, t0 = root.dataset.theme;
      for (const th of ['light', 'dark']) {
        root.dataset.theme = th; await show('start'); await sleep(30);
        const st = getComputedStyle(q('#start')), logo = getComputedStyle(q('#start'), '::before').backgroundImage, h1 = getComputedStyle(q('#start h1')).color;
        if (th === 'light') ok('light mode: title slide uses the soft-yellow gradient, green logo, dark green text', st.backgroundImage.includes('radial-gradient') && logo.includes('195050') && h1 === 'rgb(0, 50, 50)', `${st.backgroundImage.slice(0, 60)} | ${h1}`);
        else ok('dark mode: title slide uses the deep-green gradient, light logo, light text', st.backgroundImage.includes('linear-gradient(90deg') && !st.backgroundImage.includes('radial-gradient') && logo.includes('ebebeb') && h1 === 'rgb(235, 235, 235)', `${st.backgroundImage.slice(0, 60)} | ${h1}`);
        await show('agenda'); await sleep(30);
        const ag = getComputedStyle(q('#agenda'));
        ok(`${th} mode: agenda slide follows the theme`, th === 'light' ? ag.backgroundImage.includes('radial-gradient') : !ag.backgroundImage.includes('radial-gradient'));
      }
      if (t0) root.dataset.theme = t0; else delete root.dataset.theme;
    });

    /* ------------------------------------------------------------ introduction */
    await section('hero', async () => {
      await show('start');
      const out = q('#heroOut');
      const pick = async era => { click(`[data-era="${era}"]`); await sleep(1250); return out.textContent; };
      eq('scytale era', await pick('scytale'), refScytale('ATTACK AT DAWN', 3));
      eq('scytale era literal', out.textContent, 'ACDTKATAWATN');
      eq('Caesar era', await pick('caesar'), 'DWWDFN DW GDZQ');
      eq('Vigenère era', await pick('vigenere'), 'LXFOPV EF RNHR');
      eq('Enigma era', await pick('enigma'), 'BZHGNO CR RTCM');
      const aes = await pick('aes'); ok('AES era shows 14 + 16 bytes of hex', /^[0-9A-F]{60}$/.test(aes), aes);
      eq('plaintext era', await pick('plain'), 'ATTACK AT DAWN');
      eq('six eras, one selected', qa('#eraRow .era').length + ':' + qa('#eraRow [aria-pressed="true"]').length, '6:1');
    });

    await section('everyday', async () => {
      await show('everyday');
      const tiles = qa('#dayTiles .tile');
      eq('eight everyday tiles', tiles.length, 8);
      let good = true; for (const t of tiles) { t.click(); if (!q('#dayCard h3').textContent || qa('#dayCard dd').length !== 3 || qa('#dayTiles [aria-pressed="true"]').length !== 1 || t.getAttribute('aria-pressed') !== 'true') good = false; }
      ok('each tile shows what, from whom and how', good);
      tiles[1].click(); ok('WhatsApp tile points to chapter 5', /Chapter 5/.test(q('#dayCard').textContent));
      tiles[0].click();
    });

    await section('cast', async () => {
      await show('cast');
      const run = async k => { click(`[data-attack="${k}"]`); await sleep(2500); return q('#castVerdict').textContent; };
      const inside = () => { const p = q('#packet').getBoundingClientRect(), w = q('#wire').getBoundingClientRect(); return p.right <= w.right + 1 && p.left >= w.left - 1; };
      ok('Eve: confidentiality', /Confidentiality is broken/.test(await run('eve')) && q('#goal-eve').classList.contains('on'));
      ok('Mallory changes it: integrity', /Integrity is broken/.test(await run('tamper')) && q('#pkBody').textContent === 'Pay Mallory $10,000' && inside());
      ok('Mallory spoofs: authenticity', /Authenticity is broken/.test(await run('spoof')) && inside());
      ok('normal send resets', /All good/.test(await run('none')) && qa('.goal.on').length === 0 && q('#attacker').hidden);
    });

    await section('hiding', async () => {
      await show('hiding');
      const panes = () => qa('#hiding .hide-pane').filter(visible).map(p => p.dataset.pane).join();
      eq('only the first tab is visible at first', panes(), 'stego');
      for (const t of ['encode', 'encrypt', 'stego']) { click(`#hideTabs [data-tab="${t}"]`); eq(`tab ${t} shows only its pane`, panes(), t); }
      click('#stegoReveal');
      eq('hidden message: first letters', qa('#stegoText mark').map(m => m.textContent).join('').toUpperCase(), 'MEETATNOON');
      click('#stegoReveal'); eq('hide again', qa('#stegoText mark').length, 0);
      setVal('#encIn', 'SOS'); eq('Morse for SOS', q('#encMorse').textContent, '... --- ...');
      setVal('#encIn', 'Hello team'); eq('Base64 matches the browser\'s own', q('#encB64').textContent, btoa('Hello team'));
      setVal('#encIn', 'A'); eq('binary of A', q('#encBin').textContent.trim(), '01000001');
      setVal('#encIn', 'Hello team');
      setVal('#cryIn', 'Meet at noon');
      eq('three keys give three ciphertexts', [q('#cryK3').textContent, q('#cryK11').textContent, q('#cryK20').textContent].join('|'), [3, 11, 20].map(k => refCaesar('Meet at noon', k)).join('|'));
    });

    await section('vocabulary', async () => {
      await show('vocab');
      setVal('#vPlain', 'Deploy on Friday'); setVal('#vKa', 3); setVal('#vKb', 3);
      eq('ciphertext', q('#vCipher').textContent, 'GHSORB RQ IULGDB');
      eq('right key decrypts', q('#vBack').textContent, 'DEPLOY ON FRIDAY');
      setVal('#vKb', 5); eq('wrong key gives garbage', q('#vBack').textContent, refCaesar('GHSORB RQ IULGDB', -5));
      setVal('#vKb', 3);
    });

    /* ------------------------------------------------------------ ancient ciphers */
    await section('scytale', async () => {
      await show('scytale');
      const msg = 'SEND MORE SHIPS TO THE HARBOUR';
      setVal('#scyIn', msg);
      let good = true;
      for (let n = 2; n <= 8; n++) {
        setVal('#scyN', n); setVal('#scyR', n);
        const strip = qa('#scyStrip span').map(s => s.textContent).join('');
        if (strip !== refScytale(msg, n) || q('#scyOut').textContent !== only(msg) || !q('#scyVerdict').classList.contains('good')) good = false;
        if ([...strip.replace(/·/g, '')].sort().join('') !== [...only(msg)].sort().join('')) good = false;
        if (qa('#scyRod span').length !== n * Math.ceil(only(msg).length / n)) good = false;
      }
      ok('strip matches an independent scytale for rods 2–8, the receiver recovers it, and letter counts are unchanged', good);
      // the illustration: one band per turn of the strip, the front row reads along the rod, thicker rods are drawn thicker
      let art = true, ad = '', lastH = 0;
      for (let n = 2; n <= 8; n++) {
        setVal('#scyN', n);
        const cols = Math.ceil(only(msg).length / n), front = refScytale(msg, n).split('').filter((_, i) => i % n === 0).join('');
        const rodRect = qa('#scyArt > rect')[0], h = +rodRect.getAttribute('height'), x = +rodRect.getAttribute('x'), w = +rodRect.getAttribute('width');
        const rows = new Set(qa('#scyArt .scy-letter').map(t => +t.dataset.r));
        const expectRows = Array.from({ length: n }, (_, r) => r).filter(r => Math.cos(r * 2 * Math.PI / n) >= 0.2);
        if (qa('#scyArt .scy-band').length !== cols) { art = false; ad += `n${n} bands `; }
        if (qa('#scyArt .scy-letter.front').map(t => t.textContent).join('') !== front) { art = false; ad += `n${n} front `; }
        if (!(h > lastH)) { art = false; ad += `n${n} thickness `; } lastH = h;
        if (Math.abs(x + w / 2 - 264) > 6 || x < 0 || x + w > 520) { art = false; ad += `n${n} centring `; }
        if ([...rows].sort().join() !== expectRows.join()) { art = false; ad += `n${n} rows ${[...rows]} `; }
        if (!q('#scyCap').textContent.includes(front.replace(/·/g, ''))) { art = false; ad += `n${n} caption `; }
      }
      ok('illustration: one band per turn, front row reads the message, thicker rods drawn thicker, centred, only the visible rows shown', art, ad);
      setVal('#scyN', 4); setVal('#scyR', 5);
      ok('wrong rod thickness leaves it jumbled', q('#scyVerdict').classList.contains('bad') && q('#scyOut').textContent !== only(msg));
      setVal('#scyR', 4);
    });

    await section('caesar', async () => {
      await show('caesar');
      setVal('#cPlain', 'Veni vidi vici');
      let allShifts = true;
      for (let k = 0; k <= 25; k++) { setVal('#cShift', k); if (q('#cOut').textContent !== refCaesar('Veni vidi vici', k)) allShifts = false; }
      ok('all 26 shifts encrypt correctly', allShifts);
      click('#cRot13'); eq('ROT13', q('#cOut').textContent, 'IRAV IVQV IVPV');
      await sleep(420);
      const c = q('#wheel').getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
      const ang = el => { const r = el.getBoundingClientRect(); return Math.atan2(r.top + r.height / 2 - cy, r.left + r.width / 2 - cx) * 180 / Math.PI; };
      let aligned = true;
      for (const k of [1, 7, 25]) { setVal('#cShift', k); await sleep(420); for (const i of [0, 9, 20]) { const o = q(`#wheelOuter text[data-i="${i}"]`), n = q(`#wheelInner text[data-i="${(i + k) % 26}"]`); let d = Math.abs(ang(o) - ang(n)); if (d > 180) d = 360 - d; if (d > 3) aligned = false; } }
      ok('inner ring lines up with the outer ring', aligned);
      setVal('#cShift', 3); eq('default restored', q('#cOut').textContent, 'YHQL YLGL YLFL');
    });

    await section('brute force', async () => {
      await show('bruteforce');
      const plain = 'MEET ME BY THE SERVER RACK AT NOON AND BRING THE BACKUP KEYS';
      eq('default intercept is Caesar-11', q('#bfIn').value, refCaesar(plain, 11));
      click('#bfRun'); await sleep(1500);
      eq('25 candidate rows', qa('#bfList .bf-row').length, 25);
      eq('best row is the plaintext', q('#bfList .best span').textContent, plain);
      ok('status names the key', /key 11/.test(q('#bfStat').textContent));
    });

    await section('key space', async () => {
      await show('keyspace');
      const pick = k => { click(`#ksPresets [data-ks="${k}"]`); return [q('#ksCount').textContent, q('#ksTime').textContent]; };
      eq('PIN', pick('pin').join('|'), '10,000|instant');
      eq('Caesar', pick('caesar').join('|'), '25|instant');
      eq('bike lock', pick('bike').join('|'), '1,000|instant');
      eq('8 lower-case letters', pick('pw8').join('|'), '208,827,064,576|3 minutes');
      ok('26^8 is 208,827,064,576', 26n ** 8n === 208827064576n);
      const sub = pick('sub'); ok('shuffled alphabet: 4.03 × 10^26 keys, 12.8 billion years', sub[0] === '4.03 × 1026' && sub[1] === '13 billion years', sub.join(' | '));
      ok('26! check', fact(26) === 403291461126605635584000000n);
      const aes = pick('aes'); ok('AES-128: 3.40 × 10^38 keys, ~7.8 × 10^11 universe ages', aes[0] === '3.40 × 1038' && aes[1] === '7.8 × 10^11 × the age of the universe', aes.join(' | '));
      ok('2^128 / 1e9 per second in universe ages', Math.abs(2 ** 128 / 1e9 / (365.25 * 86400) / 13.8e9 / 7.8e11 - 1) < 0.01);
      const pw12 = pick('pw12'); ok('12 keyboard characters: millions of years', /million years/.test(pw12[1]), pw12[1]);
      setVal('#ksAlpha', '26', 'change'); setVal('#ksLen', 8);
      eq('custom 26 letters × 8 matches the preset', q('#ksCount').textContent, '208,827,064,576');
      eq('no preset selected for custom', qa('#ksPresets [aria-pressed="true"]').length, 0);
      const w1 = parseFloat(q('#ksFill').style.width); pick('aes'); const w2 = parseFloat(q('#ksFill').style.width);
      ok('scale bar grows with the key space', w2 > w1 && w2 <= 100);
      pick('pin');
    });

    await section('substitution', async () => {
      await show('substitution');
      const k1 = qa('#subKey .k2').map(e => e.textContent).join('');
      ok('key is a permutation', k1.length === 26 && [...k1].sort().join('') === A);
      setVal('#subIn', 'Meet me behind the data centre');
      eq('ciphertext follows the key', q('#subOut').textContent, [...'MEET ME BEHIND THE DATA CENTRE'].map(c => A.includes(c) ? k1[A.indexOf(c)] : c).join(''));
    });

    await section('fingerprint', async () => {
      await show('fingerprint');
      setVal('#fpK', 0);
      eq('26 paired bars', qa('#fpBars .pb').length, 26);
      const s0 = parseInt(q('#fpScore').textContent);
      ok('English text matches the fingerprint well', s0 >= 85 && q('#fpVerdict').classList.contains('good'), s0);
      setVal('#fpK', 7);
      const s7 = parseInt(q('#fpScore').textContent);
      ok('shifted text matches much worse, and the verdict recovers shift 7', s7 < s0 - 20 && /slid 7 places/.test(q('#fpVerdict').textContent), `${s7} ${q('#fpVerdict').textContent}`);
      // independent cosine check
      const txt = refCaesar(q('#fpIn').value, 7), c = new Array(26).fill(0); for (const ch of txt) { const i = A.indexOf(ch); if (i >= 0) c[i]++; }
      const E = [8.17, 1.29, 2.78, 4.25, 12.7, 2.23, 2.02, 6.09, 6.97, .15, .77, 4.03, 2.41, 6.75, 7.51, 1.93, .1, 5.99, 6.33, 9.06, 2.76, .98, 2.36, .15, 1.97, .07];
      const cos = c.reduce((a, v, i) => a + v * E[i], 0) / (Math.hypot(...c) * Math.hypot(...E));
      eq('match score agrees with an independent calculation', s7, Math.round(cos * 100));
      setVal('#fpK', 0);
    });

    await section('frequency analysis', async () => {
      await show('frequency');
      const cipher = () => q('#fqText').textContent;
      const c0 = cipher();
      const map = {}; let consistent = true;
      [...FREQ_TEXT.toUpperCase()].forEach((p, i) => { const c = c0[i].toUpperCase(); if (!A.includes(p)) { if (c !== p) consistent = false; return; } if (map[p] && map[p] !== c) consistent = false; map[p] = c; });
      ok('ciphertext is a consistent substitution', consistent);
      const present = Object.keys(map).length;
      click('#fqReveal'); eq('reveal solves it', cipher(), FREQ_TEXT.toUpperCase());
      click('#fqClear');
      click('#fqThe');
      const words = FREQ_TEXT.toUpperCase().split(/[^A-Z]+/).filter(w => w.length === 3); const tally = {}; words.forEach(w => { tally[w] = (tally[w] || 0) + 1; });
      eq('the most common 3-letter word in the plaintext is THE', Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0], 'THE');
      eq('Spot THE fills three correct letters', q('#fqScore').textContent, `3 of ${present} letters correct`);
      ok('Spot THE highlights the word', qa('#fqText mark').length === tally.THE && qa('#fqText mark').every(m => m.textContent === 'THE'));
      click('#fqHint'); eq('a hint adds one more correct letter', q('#fqScore').textContent, `4 of ${present} letters correct`);
      click('#fqClear'); click('#fqRank');
      eq('rank guess fills every letter present', qa('#fqSheet input').filter(i => i.value).length, present);
      click('#fqClear');
    });

    await section('vigenère', async () => {
      await show('vigenere');
      setVal('#vgKey', 'LEMON'); setVal('#vgIn', 'ATTACK AT DAWN');
      eq('textbook example', q('#vgOut').textContent, 'LXFOPV EF RNHR');
      eq('independent implementation agrees', q('#vgOut').textContent, refVig('ATTACK AT DAWN', 'LEMON'));
      let sqOk = true;
      for (let j = 0; j < 12; j++) {
        if (j) click('#vgNext');
        const hit = q('#vgSquare .hit'), p = 'ATTACKATDAWN'[j], k = 'LEMON'[j % 5], c = 'LXFOPVEFRNHR'[j];
        if (!hit || hit.textContent !== c || hit.dataset.rc !== k + p || qa('#vgSquare .row').length !== 27 || qa('#vgSquare .col').length !== 27) sqOk = false;
      }
      ok('the square highlights key row, plain column and the right cipher letter for all 12 letters', sqOk);
      click('#vgNext'); ok('“Next letter” wraps to the start', q('#vgSquare .hit').dataset.rc === 'LA');
      ok('square cells are (row + column) mod 26', ['AA', 'LA', 'ZZ', 'MQ'].every(rc => q(`#vgSquare [data-rc="${rc}"]`).textContent === A[(A.indexOf(rc[0]) + A.indexOf(rc[1])) % 26]));
      click(qa('#vgTable [data-j="3"]')[0]); eq('clicking a column selects it', q('#vgSquare .hit').dataset.rc, 'OA');
    });

    await section('breaking vigenère', async () => {
      await show('vigbreak');
      const bars = qa('#vbBars button');
      eq('12 length bars', bars.length, 12);
      const h = bars.map(b => parseFloat(q('i', b).style.height));
      const top = h.slice(0, 11).indexOf(Math.max(...h.slice(0, 11))) + 1;
      eq('the tallest bar (lengths 1–11) is 6', top, 6);
      ok('length 12, a multiple of 6, also stands out', h[11] > Math.max(...h.filter((_, i) => i !== 5 && i !== 11)));
      bars[4].click(); click('#vbSolve'); await sleep(1400);
      const wrong = qa('#vbKey span').map(s => s.textContent).join('');
      ok('wrong length gives a wrong key and nonsense', wrong.length === 5 && wrong !== 'ORACL' && !/^THETRAVELLER/.test(only(q('#vbText').textContent)), wrong);
      bars[5].click(); click('#vbSolve'); await sleep(1500);
      eq('length 6 recovers the keyword', qa('#vbKey span').map(s => s.textContent).join(''), 'ORACLE');
      ok('and the text decrypts', /^THE TRAVELLER REACHED THE HARBOUR/.test(q('#vbText').textContent), q('#vbText').textContent.slice(0, 40));
    });

    /* ------------------------------------------------------------ Enigma */
    await section('enigma wiring', async () => {
      await show('enigma-wiring');
      click('#wvReset');
      const ref = new Enigma([0, 0, 0], ['I', 'II', 'III'], 'AT BL MP'); const o = ref.press('A');
      const t = window.__wiring.trace;
      eq('default letter A with cables AT BL MP lights the same lamp as an independent machine', A[t.out], o);
      eq('plugboard swaps A with T', A[t.p], 'T');
      const counts = []; const s = slides[indexOfId('enigma-wiring')];
      for (let b = 0; b <= 6; b++) { setBuild(s, b); counts.push(qa('#wvSvg polyline').length + '/' + qa('#wvStages li.on').length); }
      eq('path segments and step cards appear one step at a time', counts.join(' '), '0/0 1/1 2/2 3/3 4/4 5/5 5/6');
      setBuild(s, 6);
      ok('lamp for the output is lit', qa('#wvSvg .wv-lamp.lit').length === 1);
      click('#wvCheck'); await sleep(20);
      ok('pressing the lamp letter at the same position gives the original back', /the original letter/.test(q('#wvStages li.cur').textContent) && qa('#wvSvg .wv-path.check').length === 5);
      const p0 = window.__wiring.machine.pos.slice();
      hooks['enigma-wiring'].key('Q');
      ok('typing a letter steps the rotors and shows the full path', A[window.__wiring.trace.k] === 'Q' && s._build === 6 && window.__wiring.machine.pos[2] === (p0[2] + 1) % 26);
      q('#wvStep').checked = false; const p1 = window.__wiring.machine.pos.slice(); hooks['enigma-wiring'].key('Q');
      ok('with stepping off, the rotors stay put', window.__wiring.machine.pos.join() === p1.join()); q('#wvStep').checked = true;
      let neverSelf = true; const m2 = new Enigma([0, 0, 0], ['I', 'II', 'III'], 'AT BL MP'); for (let i = 0; i < 2000; i++) { const c = A[i % 26]; if (m2.press(c) === c) neverSelf = false; }
      ok('with the plugboard too, no letter ever encrypts to itself', neverSelf);
      click('#wvReset');
    });

    await section('stepping', async () => {
      await show('stepping');
      click('#odoReset'); click('#odoStep');
      eq('one press moves only the right rotor', qa('#odo .drum b').map(b => b.textContent).join(''), 'AAB');
      click('#odoTen'); eq('ten more presses', q('#odoCount').textContent, '11');
      click('#odoNotch'); await sleep(2400);
      eq('the quirk: ADU → BFX after three presses', qa('#odo .drum b').map(b => b.textContent).join(''), 'BFX');
      const log = qa('#odoLog li').map(l => l.textContent);
      ok('log explains each step, including the double step', log.some(l => /ADU → ADV/.test(l)) && log.some(l => /ADV → AEW.*pushed the middle/.test(l)) && log.some(l => /AEW → BFX.*double step/.test(l)), log.join(' | '));
      const m = new Enigma([0, 0, 0]); const seen = new Set(); let period = 0; for (let i = 0; i < 20000; i++) { m.step(); const k = m.pos.join(); if (seen.has(k)) { period = seen.size; break; } seen.add(k); }
      eq('positions repeat after 16,900 presses', period, 16900);
    });

    await section('enigma simulator', async () => {
      await show('enigma');
      const tape = () => q('#enOut').textContent.replace(/ /g, '');
      const type = s => [...s].forEach(c => key(c.toLowerCase()));
      click('#enPlugClear'); ['I', 'II', 'III'].forEach((n, i) => setVal('#enSel' + i, n, 'change')); click('#enReset');
      type('AAAAA'); eq('AAAAA gives BDZGO (standard test)', tape(), 'BDZGO');
      click('#enReset'); type('BDZGO'); eq('decrypting is the same operation', tape(), 'AAAAA');
      ok('letter keys do not trigger shortcuts here', q('#notesPanel').hidden && q('#menu').hidden && S[cur_()].id === 'enigma');
      click('#enReset');
      click('#enPlug [data-p="A"]'); click('#enPlug [data-p="B"]');
      eq('two clicks connect a cable', q('#enPairs').textContent, 'AB');
      type('HELLO'); eq('output matches an independent machine with cable AB', tape(), new Enigma([0, 0, 0], ['I', 'II', 'III'], 'AB').encrypt('HELLO'));
      click('#enPlug [data-p="B"]'); eq('clicking a plugged letter removes the cable', q('#enPairs').textContent, 'none');
      'CDEFGHIJKLMNOPQRSTUVWX'.match(/../g).forEach(p => { click(`#enPlug [data-p="${p[0]}"]`); click(`#enPlug [data-p="${p[1]}"]`); });
      eq('ten cables at most', q('#enPairs').textContent.split(' (')[0].split(' ').length, 10);
      click('#enPlugClear');
      setVal('#enSel0', 'IV', 'change'); eq('choosing rotor IV', window.__sim.order.join(), 'IV,II,III');
      setVal('#enSel1', 'IV', 'change'); eq('choosing a rotor already in use swaps them', window.__sim.order.join(), 'II,IV,III');
      click('#enReset'); type('AAAAA'); eq('output matches an independent machine with rotors II IV III', tape(), new Enigma([0, 0, 0], ['II', 'IV', 'III']).encrypt('AAAAA'));
      click('#enReal');
      ok('the real 1941 message decrypts', await until(() => window.__sim.out.length === REAL_1941.ct.replace(/ /g, '').length, 8000));
      const truth = 'AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAXNORDWESTLXSEBEZXSEBEZXUAFFLIEGERSTRASZERIQTUNGXDUBROWKIXDUBROWKIXOPOTSCHKAXOPOTSCHKAXUMXEINSAQTDREINULLXUHRANGETRETENXANGRIFFXINFXRGTX';
      eq('decrypted text matches the published plaintext exactly', window.__sim.out, truth);
      ok('the key sheet and message key are shown', /II IV V/.test(q('#enPath').textContent) && /BLA/.test(q('#enPath').textContent));
      click('#enPlugClear'); ['I', 'II', 'III'].forEach((n, i) => setVal('#enSel' + i, n, 'change')); click('#enReset');
    });

    await section('counting enigma settings', async () => {
      await show('enigma-keys');
      ['ekRotors', 'ekStart', 'ekPlug'].forEach(id => { q('#' + id).checked = true; }); setVal('#ekCables', 10);
      eq('default total', q('#ekTotal').textContent, '158,962,555,217,826,360,000');
      eq('independent product', (60n * 17576n * 150738274937250n).toLocaleString('en-US'), '158,962,555,217,826,360,000');
      ok('words and time', /159 quintillion/.test(q('#ekWords').textContent) && /thousand years/.test(q('#ekTime').textContent), q('#ekWords').textContent + ' ' + q('#ekTime').textContent);
      const plugRef = p => fact(26) / (fact(26 - 2 * p) * fact(p) * 2n ** BigInt(p));
      let pOk = true; for (let p = 0; p <= 13; p++) { setVal('#ekCables', p); if (q('#ekPlugN').textContent !== plugRef(p).toLocaleString('en-US')) pOk = false; }
      ok('plugboard count matches an independent formula for 0–13 cables', pOk);
      const counts = Array.from({ length: 14 }, (_, p) => plugRef(p)); eq('11 cables give the most', counts.indexOf(counts.reduce((a, b) => (b > a ? b : a))), 11);
      setVal('#ekCables', 11); eq('11 cables', q('#ekPlugN').textContent, '205,552,193,096,250');
      ok('the bar for 11 is marked as the maximum', q('#ekCableBars .cb.max').dataset.p === '11' && q('#ekCableBars .cb.sel').dataset.p === '11');
      setVal('#ekCables', 10);
      q('#ekPlug').checked = false; q('#ekPlug').dispatchEvent(new Event('input')); eq('without the plugboard', q('#ekTotal').textContent, (60 * 17576).toLocaleString('en-US'));
      q('#ekRotors').checked = false; q('#ekRotors').dispatchEvent(new Event('input')); eq('start positions only', q('#ekTotal').textContent, '17,576');
      ['ekRotors', 'ekPlug'].forEach(id => { q('#' + id).checked = true; q('#' + id).dispatchEvent(new Event('input')); });
    });

    await section('enigma history', async () => {
      await show('enigma-history');
      const nodes = qa('#tlNodes .tl-node'); eq('eight timeline points', nodes.length, 8);
      let good = true; for (const n of nodes) { n.click(); if (q('#tlCard h3').textContent !== q('span', n).textContent || q('#tlCard p:last-child').textContent.length < 80) good = false; }
      ok('each point shows its story', good);
      ok('facts as checked: 9,000 staff, three-quarters women, bombe in March 1940', /about 9,000 people/.test(q('#tlNodes').parentElement.textContent + q('#tlCard').textContent) || (() => { nodes[7].click(); return /about 9,000/.test(q('#tlCard').textContent) && /three-quarters/.test(q('#tlCard').textContent); })());
      nodes[5].click(); ok('1940 card', /March 1940/.test(q('#tlCard').textContent) && /May 1940/.test(q('#tlCard').textContent));
      nodes[0].click();
    });

    await section('crib', async () => {
      await show('crib');
      const CRIB = 'WETTERVORHERSAGE';
      const ct = qa('#cribGrid .ci').map(e => e.textContent).join('');
      eq('intercept decrypts to the weather message', new Enigma([7, 20, 11]).encrypt(ct), 'VONSTATIONNORDWETTERVORHERSAGEREGENWINDSTAERKEVIER');
      const clashes = o => [...CRIB].filter((c, i) => ct[o + i] === c).length;
      const btns = qa('#cribStrip button');
      ok('strip colours match an independent clash count', btns.length === 35 && btns.every((b, o) => b.classList.contains('no') === (clashes(o) > 0)));
      ok('the true position survives', !btns[14].classList.contains('no'));
    });

    await section('kerckhoffs', async () => {
      await show('kerckhoffs');
      click('[data-poll="a"]'); ok('A is flagged risky', q('#pollOut').classList.contains('bad'));
      click('[data-poll="b"]'); ok('B is right', q('#pollOut').classList.contains('good'));
    });

    /* ------------------------------------------------------------ perfect secrecy */
    await section('bits', async () => {
      await show('bits');
      setVal('#bitWord', 'HI');
      const row = i => qa('#bitRows .bitrow')[i];
      eq('two letter rows', qa('#bitRows .bitrow').length, 2);
      eq('H is 72', q('.num', row(0)).textContent, '72');
      eq('H has the 64 and 8 switches on', qa('.tog.on', row(0)).map(b => b.dataset.v).join(), '64,8');
      click(qa('.tog', row(0)).find(b => b.dataset.v === '32'));
      ok('turning on 32 makes it lower case', q('#bitWord').value === 'hI' && q('.letter', row(0)).textContent === 'h' && q('.num', row(0)).textContent === '104');
      click(qa('.tog', row(0)).find(b => b.dataset.v === '128')); eq('switches that would leave printable text are refused', q('#bitWord').value, 'hI');
      setVal('#bitWord', 'HI');
      const xo = () => [q('#xMsg b').textContent, q('#xKey b').textContent, q('#xOut b').textContent].join('');
      eq('0 XOR 1 = 1', xo(), '011');
      click('#xMsg'); eq('1 XOR 1 = 0', xo(), '110');
      click('#xKey'); eq('1 XOR 0 = 1', xo(), '101');
      click('#xMsg'); eq('0 XOR 0 = 0', xo(), '000');
      click('#xKey');
    });

    await section('one-time pad', async () => {
      await show('otp');
      setVal('#xorChar', 'H');
      const rows = () => { const b = qa('#xorBits .bit').map(e => +e.textContent); return [0, 1, 2, 3, 4].map(r => parseInt(b.slice(r * 8, r * 8 + 8).join(''), 2)); };
      const [p, k, c, k2, back] = rows();
      ok('sent = message XOR key, and XOR again restores it', p === 72 && c === (p ^ k) && k2 === k && back === p);
      const C = unhex(q('#otpC').textContent);
      const fits = g => { const K = unhex(q('#otpK').textContent); return td.decode(C.map((b, i) => b ^ K[i])) === g; };
      for (const g of ['RETREAT AT TEN', 'ORDER MORE TEA', 'ATTACK AT DAWN']) { click(`[data-guess="${g}"]`); ok(`a key exists for ${g}`, fits(g)); }
    });

    await section('two-time pad', async () => {
      await show('twotime'); await sleep(60);
      const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim();
      const on = [1, 3, 5].map(i => parseInt(fg.slice(i, i + 2), 16));
      const bits = id => { const d = q('#' + id).getContext('2d').getImageData(0, 0, 160, 80).data; const o = new Uint8Array(160 * 80); for (let i = 0; i < o.length; i++) o[i] = (d[i * 4] === on[0] && d[i * 4 + 1] === on[1] && d[i * 4 + 2] === on[2]) ? 1 : 0; return o; };
      const same = (a, b) => a.every((v, i) => v === b[i]);
      const P1 = bits('tt1'), P2 = bits('tt2'), K = bits('ttK');
      ok('C1 = P1 XOR K and C2 = P2 XOR K', same(bits('ttC1'), P1.map((v, i) => v ^ K[i])) && same(bits('ttC2'), P2.map((v, i) => v ^ K[i])));
      click('#ttGo'); ok('combining gives P1 XOR P2 exactly', same(bits('ttX'), P1.map((v, i) => v ^ P2[i])));
      click('#ttGo');
    });

    await section('random', async () => {
      await show('random');
      click('#rnClear');
      'HTHTTHTHHTHTHTHTTHTHHTHTHTHTHT'.split('').forEach(x => click(x === 'H' ? '#rnH' : '#rnT'));
      const st = qa('#rnHumanStats dd').map(d => d.textContent);
      eq('human stats: 30 flips, 15 heads, longest streak 2', st.slice(0, 3).join('|'), '30|15 (50%)|2');
      click('#rnUndo'); eq('undo', qa('#rnHuman .flip').length, 29);
      click('#rnGen'); eq('machine makes 30 flips', qa('#rnMachine .flip').length, 30);
      let hits = 0; const T = 20000; for (let t = 0; t < T; t++) { let run = 1, best = 1, prev = Math.random() < .5; for (let i = 1; i < 30; i++) { const x = Math.random() < .5; run = x === prev ? run + 1 : 1; best = Math.max(best, run); prev = x; } if (best >= 4) hits++; }
      const shown = parseInt(q('#rnP4').textContent);
      ok('“streak of 4 in 30 flips” figure agrees with a 20,000-run simulation', Math.abs(shown - hits / T * 100) < 2, `${shown}% vs ${(hits / T * 100).toFixed(1)}%`);
      click('#rnClear');
    });

    /* ------------------------------------------------------------ end-to-end */
    await section('route', async () => {
      await show('e2e-route');
      const s = slides[indexOfId('e2e-route')], res = [];
      for (let b = 0; b <= 2; b++) { setBuild(s, b); res.push(qa('#rtRoute .rt-sees.plain').length + (q('#rtRoute .meta') ? 'm' : '')); }
      eq('stops that can read the message per mode (5, 3, then only the 2 phones; metadata in end-to-end)', res.join(' '), '5 3 2m');
      setBuild(s, 1); qa('#rtRoute .rt-node')[3].click();
      ok('server detail in transit mode: can read', q('#rtDetail .tag.bad')?.textContent === 'Yes' && /court order/.test(q('#rtDetail').textContent));
      click('#rtModes [data-mode="2"]'); eq('mode buttons drive the build', s._build, 2);
      ok('server detail in end-to-end mode: cannot read, but sees metadata', q('#rtDetail .tag.good')?.textContent === 'No' && /To: Bob/.test(q('#rtDetail').textContent));
      setBuild(s, 0);
    });

    await section('secure messenger', async () => {
      await show('e2e-app');
      ok('real encryption ready', await until(() => window.__app, 8000));
      const a = window.__app;
      ok('a 256-bit shared key is shown on both phones, identically', /^[0-9a-f]{64}$/.test(a.keyHex) && qa('#e2e-app .ap-item.secret .mono').length === 2 && qa('#e2e-app .ap-item.secret .mono').every(m => m.textContent === a.keyHex.slice(0, 20) + '…'));
      eq('Bob decrypts the default message', a.pt, 'Meet at 7');
      ok('ciphertext is message + 16-byte tag, the same at every hop', atob(a.ct).length === 9 + 16 && ['#apCtA', '#apCtS', '#apCtB'].every(id => q(id).textContent === q('#apCtA').textContent));
      // independent decryption of the shown ciphertext with the shown key
      const k = await crypto.subtle.importKey('raw', unhex(a.keyHex), 'AES-GCM', false, ['decrypt']);
      const raw = Uint8Array.from(atob(a.ct), c => c.charCodeAt(0));
      const indep = td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(a.iv) }, k, raw));
      eq('the shown key decrypts the shown ciphertext independently', indep, 'Meet at 7');
      setVal('#apMsg', 'Lunch at noon?'); await until(() => window.__app.pt === 'Lunch at noon?', 3000);
      ok('typing a new message re-encrypts it and Bob reads it', q('#apPt').textContent === '“Lunch at noon?”' && atob(window.__app.ct).length === 14 + 16);
      const s = slides[indexOfId('e2e-app')], vis = [];
      for (let b = 0; b <= 5; b++) { setBuild(s, b); vis.push(qa('#e2e-app .ap-item.built').length + (qa('#e2e-app .ap-item:not(.built)').every(el => getComputedStyle(el).visibility === 'hidden') ? '' : '!')); }
      eq('items appear step by step (3 key cards, message, gibberish, 3 hand-offs, decrypted)', vis.join(' '), '0 3 4 5 8 9');
      ok('the server never shows the key or the message', !q('#apS').textContent.includes(a.keyHex.slice(0, 20)) && !q('#apS').textContent.includes('Lunch at noon') && /doesn't have it/.test(q('#apS').textContent));
      ok('the slide says key sharing is a Part 2 topic', /Part 2/.test(q('#e2e-app .lede').textContent));
      setVal('#apMsg', 'Meet at 7'); setBuild(s, 0);
    });

    await section('limits', async () => {
      await show('e2e-limits');
      const cards = qa('#lmCards .lm-card'); eq('eight cards', cards.length, 8);
      click('#lmHide'); ok('all hidden', cards.every(c => !visible(q('.lm-back', c))));
      cards[3].click(); ok('one card reveals', visible(q('.lm-back', cards[3])) && /Not protected/.test(cards[3].textContent));
      click('#lmAll'); ok('reveal all', cards.every(c => visible(q('.lm-back', c))));
      eq('verdicts', cards.map(c => q('.tag', c).textContent).join('|'), 'Protected|Protected|Protected|Not protected|Not protected|Depends|Not protected|Not protected');
      click('#lmHide');
      ok('adoption facts', /April 2016/.test(q('#e2e-limits .adopt').textContent) && /December 2023/.test(q('#e2e-limits .adopt').textContent) && /since 2021/.test(q('#e2e-limits .adopt').textContent));
    });

    await section('recap and close', async () => {
      await show('recap'); eq('nine recap cards', qa('#recap .recap .panel').length, 9);
      await show('thanks'); click(q('#thanks a[href="#start"]')); await sleep(20); eq('back to start', S[cur_()].id, 'start');
    });

    /* ------------------------------------------------------------ brand */
    await section('brand', async () => {
      const fams = new Set();
      for (const s of S) for (const el of qa('*', s)) { if (el.closest('.notes, svg')) continue; if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) fams.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim()); }
      eq('only brand typefaces are used', [...fams].sort().join(', '), 'JetBrains Mono, Material Symbols Outlined, Montserrat');
      await show('caesar');
      const logo = getComputedStyle(q('.slide.active'), '::before');
      ok('logo present and at least 96px wide', logo.backgroundImage.includes('data:image/svg+xml') && parseFloat(logo.width) >= 96);
      eq('progress bar is safety yellow', getComputedStyle(q('#progress')).backgroundColor, 'rgb(210, 255, 0)');
    });

    noAnim.remove();
    go(0); toggleNotes(false); toggleMenu(false);
    removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr);
    ok('no uncaught errors during the run', errs.length === 0, errs.join(' | '));
    const failed = R.filter(r => !r.pass);
    return { total: R.length, passed: R.length - failed.length, failed };
  };

  /* Layout stability: click every control and step every build; report how far the heading and the slide's main blocks move.
     A good result: headings never move, and blocks move only when something above them really changed size. */
  window.deckStabilityReport = async function ({ threshold = 2 } = {}) {
    const noAnim = document.createElement('style'); noAnim.textContent = '*{transition:none!important;animation:none!important}'; document.head.appendChild(noAnim);
    const S = slideEls(), out = [];
    const anchors = s => { const h = q('h1, h2', s), kids = qa('.slide-inner > *', s).filter(e => e.getClientRects().length); return { h: h ? h.getBoundingClientRect().top : 0, kids: kids.map(e => [e, e.getBoundingClientRect().top, e.getBoundingClientRect().height]) }; };
    const diff = (s, before, label) => {
      const after = anchors(s), hs = Math.abs(after.h - before.h);
      const moved = before.kids.map(([e, t]) => { const r = e.getBoundingClientRect(); return [e, Math.round(r.top - t)]; }).filter(([, d]) => Math.abs(d) > threshold);
      if (hs > threshold || moved.length) out.push({ slide: s.id, action: label, heading: Math.round(hs), moved: moved.map(([e, d]) => `${(e.className || e.tagName).toString().split(' ')[0]}:${d > 0 ? '+' : ''}${d}`).join(' ') });
    };
    const label = el => (el.id ? '#' + el.id : '') + (el.dataset.attack ? `[${el.dataset.attack}]` : el.dataset.era ? `[${el.dataset.era}]` : el.dataset.tab ? `[${el.dataset.tab}]` : el.dataset.ks ? `[${el.dataset.ks}]` : el.dataset.mode ? `[mode ${el.dataset.mode}]` : '') || (el.textContent || el.tagName).trim().slice(0, 24);
    const waitFor = el => el.matches('[data-attack]') ? 2400 : el.matches('[data-era], #bfRun, #vbSolve, #odoNotch, #enA5') ? 1400 : 40;
    for (let i = 0; i < S.length; i++) {
      const s = S[i]; go(i); await sleep(40);
      if (s.dataset.builds) for (let b = 1; b <= +s.dataset.builds; b++) { const before = anchors(s); setBuild(s, b); await sleep(30); diff(s, before, `build step ${b}`); }
      const controls = qa('button, input[type="range"], select', s).filter(el => el.getClientRects().length && !el.closest('#agendaList, .tl-node') && !el.matches('#enReal, a, [data-go], .key, .sock, .swatch, .lm-card, .tile, .strip button, #rnH, #rnT, #rnUndo, .tog, .bit, #cribStrip button, [data-j], .lenbars button, .rotor button'));
      // a sample of the repeated small buttons too
      [qa('.tile', s)[3], qa('.lm-card', s)[0], qa('.lenbars button', s)[5], qa('.key', s)[0], qa('.tog', s)[2], qa('#vgTable [data-j]', s)[5], qa('.tl-node', s)[4], qa('#rnH', s)[0]].filter(Boolean).forEach(el => controls.push(el));
      for (const el of controls) {
        if (!el.isConnected || !el.getClientRects().length) continue;
        const before = anchors(s);
        if (el.matches('input[type="range"]')) { const v = el.value; el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); await sleep(30); diff(s, before, label(el) + ' → max'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); continue; }
        if (el.matches('select')) { const v = el.value; el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(30); diff(s, before, label(el) + ' changed'); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); continue; }
        el.click(); await sleep(waitFor(el));
        if (cur_() !== i) { go(i); await sleep(30); continue; }
        diff(s, before, label(el));
      }
    }
    noAnim.remove(); go(0);
    return out;
  };

  /* Put every demo into its "result" state so the contrast audit sees verdicts, highlights and selected states. */
  window.p1PrimeStates = async function () {
    const c = s => { const e = document.querySelector(s); if (e) e.click(); };
    const set = (s, v, ev = 'input') => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); };
    c('[data-era="caesar"]'); c('[data-attack="tamper"]'); set('#vKb', 9); c('#stegoReveal'); c('#bfRun'); c('#fqThe'); c('#vbSolve');
    set('#cribPos', 0); c('[data-poll="b"]'); c('#ttGo'); c('#odoNotch'); c('#rnGen'); c('#rnH'); c('#rnT');
    c('#enPlug [data-p="A"]'); c('#enPlug [data-p="B"]'); c('#lmAll'); set('#fpK', 5);
    qa('.slide[data-builds]').forEach(s => setBuild(s, +s.dataset.builds));
    await sleep(2600);
    return 'primed';
  };
})();

/* ---- layout and contrast audits (adapted from the full-deck suite) ---- */
(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const slideEls = () => qa('.slide');
  const cur = () => slideEls().findIndex(s => s.classList.contains('active'));
  /* Layout: run at each viewport size. Reports sideways overflow and which slides need vertical scrolling. */
  window.deckLayoutReport = async function () {
    const S = slideEls(), out = { viewport: `${innerWidth}x${innerHeight}`, bodyOverflowX: document.documentElement.scrollWidth > innerWidth, sideways: [], needsScroll: [], clipped: [] };
    const start = cur();
    for (let i = 0; i < S.length; i++) {
      go(i); await sleep(30);
      const s = S[i], r = s.getBoundingClientRect();
      if (s.scrollWidth > s.clientWidth + 1) out.sideways.push(s.id);
      if (s.scrollHeight > s.clientHeight + 1) out.needsScroll.push(`${s.id}:+${s.scrollHeight - s.clientHeight}`);
      for (const pn of qa('.panel, .stage, .goal, details.reveal, .part-link', s)) { if (!pn.getClientRects().length) continue; const b = pn.getBoundingClientRect(); if (b.width < 140 || b.height > innerHeight * 1.2) out.clipped.push(`${s.id}: odd box ${Math.round(b.width)}x${Math.round(b.height)} .${pn.className}`); }
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
        if (e.classList.contains('slide')) { stack.push(e.classList.contains('deep') ? (getComputedStyle(document.documentElement).colorScheme.includes('dark') ? [28, 86, 83, 1] : [220, 226, 226, 1]) : parse(getComputedStyle(document.body).backgroundColor)); break; }
        e = e.parentElement; }
      if (!stack.length || stack[stack.length - 1][3] < 1) stack.push(parse(getComputedStyle(document.body).backgroundColor));
      let base = stack.pop(); while (stack.length) base = over(stack.pop(), base); return base;
    };
    const S = slideEls(), low = [], start = cur(); let checked = 0;
    const noAnim = document.createElement('style'); noAnim.textContent = '*{transition:none!important;animation:none!important}'; document.head.appendChild(noAnim);
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
    go(start); noAnim.remove();
    return { theme: document.documentElement.dataset.theme || 'system', checked, low: [...new Set(low)] };
  };
})();
