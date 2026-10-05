/* ==========================================================================
   Young Mobile Mechanic · Deep N Dirty Co. — interaction & scroll choreography
   GSAP + ScrollTrigger drive the timelines, Lenis adds momentum scrolling.
   Every feature is isolated with safe() so one failure can't take the page
   down. No JS and reduced motion both get a complete, static page.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const safe = (name, fn) => { try { return fn(); } catch (err) { console.warn(`[ymm] ${name}:`, err); return undefined; } };
  const PHONE = '+16134494659';

  // Shared state (declared up-front so every code path can read it)
  let lenis = null;
  let menuApi = null;

  if (reduced) root.classList.add('is-static');

  /* ------------------------------------------------------------------------
     Works with or without the animation libraries
     ------------------------------------------------------------------------ */
  safe('clock', initClock);
  safe('builder', initBuilder);
  safe('callbar', initCallbar);

  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const loader = $('.loader');

  if (!gsap || !ST) {
    if (loader) loader.remove();
    safe('menu', () => { menuApi = initMenu(null); });
    safe('catalogue', () => initCatalogue(null));
    return;
  }

  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: 'expo.out', duration: 1.1 });
  const mm = gsap.matchMedia();

  /* ------------------------------------------------------------------------
     Text splitting + layout fitting
     ------------------------------------------------------------------------ */
  const lockLines = $$('.lockup__line');
  const heroChars = lockLines.map((l) => splitChars($('.split', l)));
  $$('.split-words').forEach(splitWords);
  const dialChars = splitChars($('.dial__num'));
  const footLetters = splitLetters($('.footer__letters'));

  ST.addEventListener('refreshInit', () => safe('relayout', relayout));
  safe('relayout', relayout);

  /* ------------------------------------------------------------------------
     Smooth scroll
     ------------------------------------------------------------------------ */
  if (!reduced && typeof window.Lenis === 'function') {
    safe('lenis', () => {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.2 });
      lenis.on('scroll', ST.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    });
  }

  const wipe = safe('wipe', initWipe) || { cover: () => gsap.timeline(), reveal: () => gsap.timeline() };
  safe('menu', () => { menuApi = initMenu(gsap); });
  safe('goto', initGoto);
  safe('cursor', initCursor);
  safe('magnetic', initMagnetic);
  safe('nav', initNav);
  const intro = safe('hero', initHero);
  safe('reveals', initReveals);
  safe('deal', initDeal);
  safe('ticker', initTicker);
  safe('catalogue', () => initCatalogue(gsap));
  safe('trail', initTrail);
  safe('gauge', initGauge);
  safe('reach', initReach);
  safe('promise', initPromise);
  safe('book', initBook);
  safe('footer', initFooter);

  safe('loader', () => runLoader(() => {
    if (intro) intro.play();
    jumpToHash();
  }));
  addEventListener('load', () => ST.refresh());

  /* ========================================================================
     Utilities
     ======================================================================== */
  function splitChars(el) {
    if (!el) return [];
    const text = el.textContent;
    const out = [];
    el.textContent = '';
    text.split(' ').forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.className = 'w';
      for (const ch of word) {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        w.appendChild(c);
        out.push(c);
      }
      el.appendChild(w);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return out;
  }

  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const w = document.createElement('span');
      w.className = 'w';
      const inner = document.createElement('span');
      inner.className = 'wi';
      inner.textContent = word;
      w.appendChild(inner);
      el.appendChild(w);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  function splitLetters(el) {
    if (!el) return [];
    const words = el.textContent.split(' ');
    const out = [];
    el.textContent = '';
    words.forEach((word, i) => {
      for (const ch of word) {
        const s = document.createElement('span');
        s.className = word === 'N' ? 'fl fl--n' : 'fl';
        s.textContent = ch;
        el.appendChild(s);
        out.push(s);
      }
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return out;
  }

  // Deterministic PRNG so generated textures look the same on every load
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function svgUri(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

  // A wide mask: transparent | ragged brush stroke | transparent, with spray drops
  function raggedMask(seed) {
    const r = rng(seed);
    const L = [];
    const R = [];
    for (let y = 0; y <= 100; y += 2.5) {
      L.push([100 - (3 + 7 * Math.abs(Math.sin(y * 0.11 + 1.3)) + 5 * r()), y]);
      R.push([200 + (3 + 7 * Math.abs(Math.sin(y * 0.09 + 4.1)) + 5 * r()), y]);
    }
    const pts = [...L, ...R.reverse()].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    let drops = '';
    for (let i = 0; i < 28; i++) {
      const x = i % 2 ? 216 + r() * 16 : 84 - r() * 16;
      const rad = 0.3 + r() * 0.9;
      drops += `<ellipse cx='${x.toFixed(1)}' cy='${(r() * 100).toFixed(1)}' rx='${rad.toFixed(2)}' ry='${(rad * 1.5).toFixed(2)}'/>`;
    }
    return svgUri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 100' preserveAspectRatio='none'><path d='M${pts} Z'/>${drops}</svg>`);
  }

  // A horizontal paint band with ragged top and bottom edges
  function bandMask(seed) {
    const r = rng(seed);
    const top = [];
    const bot = [];
    for (let x = 0; x <= 100; x += 0.8) {
      top.push([x, 15 - (3 + 3.5 * Math.sin(x * 0.11 + 0.5) + 2 * Math.sin(x * 0.53 + 1.7) + 1.6 * r())]);
      bot.push([x, 85 + (3 + 3.5 * Math.sin(x * 0.09 + 2.2) + 2 * Math.sin(x * 0.47 + 0.4) + 1.6 * r())]);
    }
    const pts = [...top, ...bot.reverse()].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    return svgUri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M${pts} Z'/></svg>`);
  }

  function blobPath(rad, points, wobble) {
    const pts = [];
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const rr = rad * (1 - wobble / 2 + Math.random() * wobble);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const start = mid(pts[points - 1], pts[0]);
    let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
    pts.forEach((p, i) => {
      const m = mid(p, pts[(i + 1) % points]);
      d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
    });
    return d + 'Z';
  }

  function buildTicks(g, cx, cy, r, count, every, len, majorLen) {
    if (!g) return;
    let d = '';
    let dm = '';
    for (let i = 0; i <= count; i++) {
      const a = Math.PI + (Math.PI * i) / count;
      const major = i % every === 0;
      const r1 = r - (major ? majorLen : len);
      const seg = `M${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}L${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}`;
      if (major) dm += seg; else d += seg;
    }
    g.innerHTML = `<path class="tick" d="${d}"/><path class="tick tick--major" d="${dm}"/>`;
  }

  // Chrome sheen: a highlight band positioned across a whole line of split letters
  function setSheen(line, frac) {
    const lw = line._lw || line.offsetWidth;
    line.style.setProperty('--sx', (frac * lw - lw / 2).toFixed(1) + 'px');
  }
  function sweep(lines, opts = {}) {
    const p = { f: -0.4 };
    return gsap.to(p, {
      f: 1.4, duration: opts.duration || 1.6, ease: 'power2.inOut', delay: opts.delay || 0,
      onUpdate: () => lines.forEach((l) => l && setSheen(l, p.f)),
    });
  }

  // Technical drawings draw themselves in, stroke by stroke
  function prepDraw(svg) {
    if (!svg || reduced) return;
    $$('[pathLength]', svg).forEach((el) => { el.style.strokeDasharray = '1'; el.style.strokeDashoffset = '1'; });
    $$('text, .dot, .dash, .gd, .spark', svg).forEach((el) => { el.style.opacity = '0'; });
  }
  function drawIn(svg) {
    if (!svg || reduced) return;
    const strokes = $$('[pathLength]', svg);
    const fades = $$('text, .dot, .dash, .gd, .spark', svg);
    strokes.forEach((el) => { el.style.strokeDasharray = '1'; });
    gsap.fromTo(strokes, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.022, overwrite: true });
    gsap.fromTo(fades, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.45, stagger: 0.03, overwrite: true });
  }

  /* ========================================================================
     Layout fitting (runs before every ScrollTrigger refresh)
     ======================================================================== */
  function relayout() {
    fitLockup();
    fitPromise();
    fitFooter();
    fitDial();
    measureChrome();
    setFooterSpace();
    sizeWiper();
  }

  // Each line of the hero lockup is sized to the same width, like a stamped badge
  function fitLockup() {
    const lock = $('.lockup');
    if (!lock) return;
    const lines = $$('.lockup__line', lock);
    lock.style.width = '';
    lines.forEach((l) => { l.style.fontSize = '100px'; });
    const natural = lines.map((l) => l.offsetWidth || 1);
    let target = lock.clientWidth;
    const apply = () => lines.forEach((l, i) => { l.style.fontSize = (100 * target / natural[i]).toFixed(2) + 'px'; });
    apply();
    const maxH = innerHeight * (innerWidth > 1024 ? (innerHeight < 800 ? 0.5 : 0.58) : innerWidth > 720 ? 0.4 : 0.5);
    const h = lock.offsetHeight;
    if (h > maxH) {
      target *= maxH / h;
      apply();
      lock.style.width = target.toFixed(1) + 'px';
    }
  }

  function fitPromise() {
    const lines = $$('.promise__line');
    const pin = $('.promise__pin');
    if (!lines.length || !pin) return;
    const prev = lines.map((l) => l.style.getPropertyValue('--wd'));
    lines.forEach((l) => { l.style.setProperty('--wd', '125'); l.style.fontSize = '100px'; });
    const natural = lines.map((l) => l.offsetWidth || 1);
    const cs = getComputedStyle(pin);
    const avail = pin.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let sizes = natural.map((w) => 100 * avail / w);
    const total = sizes.reduce((a, s) => a + s * 0.88, 0);
    const maxH = innerHeight * 0.6;
    if (total > maxH) sizes = sizes.map((s) => s * maxH / total);
    lines.forEach((l, i) => {
      l.style.fontSize = sizes[i].toFixed(2) + 'px';
      if (prev[i]) l.style.setProperty('--wd', prev[i]); else l.style.removeProperty('--wd');
    });
  }

  function fitFooter() {
    const word = $('.footer__letters');
    const box = $('.footer__word');
    if (!word || !box) return;
    word.style.fontSize = '100px';
    const natural = word.offsetWidth || 1;
    word.style.fontSize = (100 * box.clientWidth / natural * 0.985).toFixed(2) + 'px';
  }

  // The phone number spans the full measure at any width
  function fitDial() {
    const dial = $('.dial');
    const box = $('.book__call');
    if (!dial || !box) return;
    dial.style.fontSize = '100px';
    const natural = dial.offsetWidth || 1;
    dial.style.fontSize = Math.min(100 * box.clientWidth / natural * 0.99, innerHeight * 0.34).toFixed(2) + 'px';
  }

  function measureChrome() {
    $$('.chrome, .spray').forEach((line) => {
      const lw = line.offsetWidth;
      line._lw = lw;
      line.style.setProperty('--lw', lw + 'px');
      $$('.c, .fl', line).forEach((c) => c.style.setProperty('--cx', c.offsetLeft + 'px'));
    });
  }

  function setFooterSpace() {
    const f = $('.footer');
    const m = $('main');
    if (f && m) m.style.setProperty('--footer-h', f.offsetHeight + 'px');
  }

  function sizeWiper() {
    const s = $('.shield');
    if (s) s.style.setProperty('--arm', Math.round(Math.hypot(s.offsetWidth / 2, s.offsetHeight) * 1.03) + 'px');
  }

  /* ========================================================================
     Navigation: brush-stroke wipe between sections
     ======================================================================== */
  function scrollToTarget(hash) {
    const target = hash === '#top' ? 0 : $(hash);
    if (target === null || target === undefined) return;
    if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
    else if (target === 0) window.scrollTo(0, 0);
    else target.scrollIntoView();
    ST.update();
  }

  function jumpToHash() {
    const h = location.hash;
    if (h && /^#[\w-]+$/.test(h) && $(h)) scrollToTarget(h);
  }

  function initWipe() {
    const el = $('.wipe');
    const label = $('.wipe__label', el);
    const masked = CSS.supports('mask-image', 'linear-gradient(#000, #000)') || CSS.supports('-webkit-mask-image', 'linear-gradient(#000, #000)');
    if (masked) el.style.setProperty('--wipe-mask', `url("${raggedMask(7)}")`);
    let guard = 0;
    // The wipe only ever moves through a CSS variable and opacity, so no
    // leftover transform can keep it parked over the page.
    const hide = () => { clearTimeout(guard); gsap.set(el, { visibility: 'hidden', pointerEvents: 'none', opacity: 1, '--mp': '120%' }); };
    hide();
    return {
      cover(text = '') {
        clearTimeout(guard);
        guard = setTimeout(hide, 5000); // never leave the page covered
        label.textContent = text;
        const tl = gsap.timeline();
        tl.set(el, { visibility: 'visible', pointerEvents: 'auto', opacity: 1 });
        if (masked) tl.fromTo(el, { '--mp': '120%' }, { '--mp': '50%', duration: 0.85, ease: 'power3.inOut' });
        else tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
        if (text) tl.fromTo(label, { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, duration: 0.55, ease: 'expo.out' }, '-=0.4');
        return tl;
      },
      reveal() {
        const tl = gsap.timeline({ onComplete: hide });
        tl.to(label, { opacity: 0, yPercent: -40, duration: 0.35, ease: 'power2.in' });
        if (masked) tl.to(el, { '--mp': '-20%', duration: 0.9, ease: 'power3.inOut' }, '-=0.1');
        else tl.to(el, { opacity: 0, duration: 0.45, ease: 'power2.in' });
        return tl;
      },
    };
  }

  function initGoto() {
    const LABELS = { '#top': 'Back up top', '#fix': 'What I fix', '#trail': 'Off-road & yard', '#route': 'How it works', '#reach': 'Coverage', '#book': 'Book a visit' };
    let busy = false;
    const go = (hash) => {
      if (hash !== '#top' && !$(hash)) return;
      if (reduced) { scrollToTarget(hash); return; }
      if (busy) return;
      busy = true;
      const release = setTimeout(() => { busy = false; }, 4000);
      gsap.timeline({ onComplete: () => { clearTimeout(release); busy = false; } })
        .add(wipe.cover(LABELS[hash] || ''))
        .add(() => scrollToTarget(hash))
        .add(wipe.reveal(), '+=0.15');
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-goto]');
      if (!a) return;
      const hash = a.getAttribute('href');
      if (!hash || hash.charAt(0) !== '#') return;
      e.preventDefault();
      if (menuApi && menuApi.isOpen()) menuApi.close(() => go(hash));
      else go(hash);
    });
  }

  /* ========================================================================
     Loader: ignition needle sweep, then the paint wipe reveals the hero
     ======================================================================== */
  function runLoader(done) {
    if (!loader) { done(); return; }
    if (reduced) { loader.remove(); done(); return; }
    let seen = false;
    try { seen = sessionStorage.getItem('ymm-seen') === '1'; sessionStorage.setItem('ymm-seen', '1'); } catch (err) { /* storage unavailable */ }
    if (lenis) lenis.stop();
    buildTicks($('.loader__ticks'), 150, 150, 134, 40, 5, 8, 16);
    const needle = $('.loader__needle');
    const fill = $('.loader__fill');
    const num = $('.loader__num');
    const g = { v: 0 };
    const render = () => {
      needle.setAttribute('transform', `rotate(${(-90 + 180 * g.v).toFixed(2)} 150 150)`);
      fill.style.strokeDashoffset = (1 - g.v).toFixed(4);
    };
    render();
    const k = seen ? 0.45 : 1;
    const needleSweep = gsap.timeline({ onUpdate: render })
      .to(g, { v: 1, duration: 1.05 * k, ease: 'power2.inOut' })
      .to(g, { v: 0.14, duration: 0.8 * k, ease: 'power3.out' });
    const count = { n: 0 };
    gsap.to(count, { n: 100, duration: 1.85 * k, ease: 'power2.inOut', onUpdate: () => { num.textContent = pad(Math.round(count.n), 3); } });
    const fontsReady = Promise.race([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      new Promise((r) => setTimeout(r, 2600)),
    ]);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      safe('relayout', relayout);
      ST.refresh();
      gsap.timeline()
        .add(wipe.cover(''))
        .add(() => { loader.remove(); if (lenis) lenis.start(); })
        .add(wipe.reveal(), '+=0.05')
        .add(() => done(), '-=0.6');
    };
    Promise.all([fontsReady, needleSweep.then()]).then(finish, finish);
    setTimeout(finish, 6000); // never trap a visitor behind the loader
  }

  /* ========================================================================
     Menu
     ======================================================================== */
  function initMenu(g) {
    const menu = $('#menu');
    const burger = $('.burger');
    if (!menu || !burger) return null;
    const bg = $('.menu__bg', menu);
    const words = $$('.menu__word, .menu__idx', menu);
    const foot = $('.menu__foot', menu);
    const main = $('main');
    const anim = Boolean(g) && !reduced;
    let open = false;
    const origin = () => {
      const r = burger.getBoundingClientRect();
      return `${(r.left + r.width / 2).toFixed(0)}px ${(r.top + r.height / 2).toFixed(0)}px`;
    };
    const firstLink = () => $('.menu__list a', menu);

    function show() {
      open = true;
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      if (main) main.inert = true;
      if (lenis) lenis.stop();
      if (!anim) { bg.style.clipPath = 'none'; firstLink().focus(); return; }
      const at = origin();
      g.timeline()
        .fromTo(bg, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 1, ease: 'expo.inOut' })
        .fromTo(words, { yPercent: 110 }, { yPercent: 0, stagger: 0.045, duration: 1 }, '-=0.5')
        .fromTo(foot, { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, '-=0.8')
        .add(() => firstLink().focus({ preventScroll: true }), 0.35);
    }
    function hide(done) {
      open = false;
      burger.setAttribute('aria-expanded', 'false');
      const finish = () => {
        menu.hidden = true;
        if (main) main.inert = false;
        if (lenis) lenis.start();
        burger.focus({ preventScroll: true });
        if (done) done();
      };
      if (!anim) { finish(); return; }
      g.to('.mpreview', { opacity: 0, duration: 0.2, overwrite: 'auto' });
      g.timeline({ onComplete: finish })
        .to(words, { yPercent: -110, stagger: 0.03, duration: 0.5, ease: 'expo.in' })
        .to(foot, { opacity: 0, duration: 0.3 }, 0)
        .to(bg, { clipPath: `circle(0% at ${origin()})`, duration: 0.8, ease: 'expo.inOut' }, 0.2);
    }
    burger.addEventListener('click', () => (open ? hide() : show()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });

    if (anim && fine) {
      const prev = $('.mpreview');
      const img = $('img', prev);
      g.set(prev, { scale: 0.8 });
      const px = g.quickTo(prev, 'x', { duration: 0.6, ease: 'power3' });
      const py = g.quickTo(prev, 'y', { duration: 0.6, ease: 'power3' });
      menu.addEventListener('pointermove', (e) => { px(e.clientX + 60); py(e.clientY); });
      $$('.menu__list a', menu).forEach((a) => {
        a.addEventListener('pointerenter', () => {
          const src = a.dataset.preview;
          if (src && !img.src.endsWith(src)) img.src = src;
          g.to(prev, { opacity: 1, scale: 1, rotation: -4 + Math.random() * 8, duration: 0.5, ease: 'back.out(1.6)', overwrite: 'auto' });
        });
        a.addEventListener('pointerleave', () => g.to(prev, { opacity: 0, scale: 0.8, duration: 0.3, overwrite: 'auto' }));
      });
    }
    return { isOpen: () => open, close: hide };
  }

  /* ========================================================================
     Cursor + magnetic elements
     ======================================================================== */
  function initCursor() {
    if (!fine || reduced) return;
    root.classList.add('has-cursor');
    const cursor = $('.cursor');
    const label = $('.cursor__label');
    const dx = gsap.quickTo('.cursor__dot', 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo('.cursor__dot', 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo('.cursor__ring', 'x', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo('.cursor__ring', 'y', { duration: 0.5, ease: 'power3' });
    addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor]');
      if (t) { label.textContent = t.dataset.cursor; cursor.classList.add('is-label'); }
    });
    document.addEventListener('pointerout', (e) => {
      const t = e.target.closest('[data-cursor]');
      if (t && !t.contains(e.relatedTarget)) cursor.classList.remove('is-label');
    });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => gsap.to(cursor, { opacity: 0, duration: 0.3 }));
    document.addEventListener('mouseenter', () => gsap.to(cursor, { opacity: 1, duration: 0.3 }));
  }

  function initMagnetic() {
    if (!fine || reduced) return;
    $$('[data-magnetic]').forEach((el) => {
      const k = parseFloat(el.dataset.magnetic) || 0.3;
      const inner = el.querySelector('.btn__text, .pill__text, .orb__text, .seal__core, .brand__y');
      const mx = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' });
      const ix = inner && gsap.quickTo(inner, 'x', { duration: 0.8, ease: 'power3' });
      const iy = inner && gsap.quickTo(inner, 'y', { duration: 0.8, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const ox = e.clientX - (r.left + r.width / 2);
        const oy = e.clientY - (r.top + r.height / 2);
        mx(ox * k); my(oy * k);
        if (inner) { ix(ox * k * 0.5); iy(oy * k * 0.5); }
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, .35)' });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, .35)' });
      });
    });
  }

  function initNav() {
    const nav = $('.nav');
    gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    ST.create({
      start: 0, end: 'max',
      onUpdate: (s) => {
        const y = s.scroll();
        nav.classList.toggle('is-scrolled', y > 40);
        if (menuApi && menuApi.isOpen()) return;
        nav.classList.toggle('is-hidden', y > innerHeight * 0.8 && s.direction === 1);
      },
    });
  }

  /* ========================================================================
     HERO — intro, chrome sheen, parallax, spray canvas, paint splats
     ======================================================================== */
  function initHero() {
    const hero = $('.hero');
    if (!hero) return null;
    const art = $('.hero__art');
    const artImg = $('.hero__art img');
    const lock = $('.lockup');
    const sealWrap = $('.seal-wrap');
    const seal = $('.seal');
    const fade = $$('.hero__kicker > *, .hero__lede, .hero__ctas, .hero__foot > *');
    const wrStroke = $$('.wr-stroke > *');
    const wrFill = $('.wr-fill');
    let heroOn = true;
    ST.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (s) => { heroOn = s.isActive; } });

    if (!fine) { const hint = $('.hero__hint'); if (hint) hint.textContent = 'Tap to get dirty'; }
    const spray = safe('spray', () => initSpray(hero, () => heroOn));
    const splats = $('.splats');
    hero.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      const r = hero.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (!reduced) safe('splat', () => splat(splats, x, y));
      if (spray) spray.burst(x, y);
    });

    if (reduced) return null;

    gsap.set(heroChars.flat(), { yPercent: 118 });
    gsap.set(artImg, { opacity: 0, scale: 1.08 });
    gsap.set(fade, { opacity: 0, y: 26 });
    gsap.set(seal, { scale: 0, rotation: -140 });
    wrStroke.forEach((p) => { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });

    const intro = gsap.timeline({ paused: true })
      .to(artImg, { opacity: 1, scale: 1, duration: 2.2, ease: 'expo.out' }, 0)
      .to(heroChars[0] || [], { yPercent: 0, stagger: 0.055, duration: 1.3 }, 0.08)
      .to(heroChars[1] || [], { yPercent: 0, stagger: 0.05, duration: 1.3 }, 0.22)
      .to(heroChars[2] || [], { yPercent: 0, stagger: 0.04, duration: 1.3 }, 0.34)
      .to(wrStroke, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut', stagger: 0.08 }, 0.55)
      .to(wrFill, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 1.35)
      .add(() => sweep(lockLines, { duration: 1.7 }), 0.95)
      .to(seal, { scale: 1, rotation: 0, duration: 1.6, ease: 'elastic.out(1, .6)' }, 0.9)
      .to(fade, { opacity: 1, y: 0, stagger: 0.06, duration: 1 }, 0.75);

    if (fine) {
      gsap.set(art, { transformPerspective: 1200 });
      const ax = gsap.quickTo(art, 'x', { duration: 1.4, ease: 'power3' });
      const ay = gsap.quickTo(art, 'y', { duration: 1.4, ease: 'power3' });
      const ar = gsap.quickTo(art, 'rotationY', { duration: 1.4, ease: 'power3' });
      const lx = gsap.quickTo(lock, 'x', { duration: 1.2, ease: 'power3' });
      const ly = gsap.quickTo(lock, 'y', { duration: 1.2, ease: 'power3' });
      const sx = gsap.quickTo(sealWrap, 'x', { duration: 1.2, ease: 'power3' });
      const sy = gsap.quickTo(sealWrap, 'y', { duration: 1.2, ease: 'power3' });
      const glow = { x: 0.34, y: 0.55, tx: 0.34, ty: 0.55 };
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width;
        const ny = (e.clientY - r.top) / r.height;
        glow.tx = nx; glow.ty = ny;
        ax((nx - 0.5) * -28); ay((ny - 0.5) * -16); ar((nx - 0.5) * 7);
        lx((nx - 0.5) * 18); ly((ny - 0.5) * 10);
        sx((nx - 0.5) * 44); sy((ny - 0.5) * 30);
        lockLines.forEach((l) => { const lr = l.getBoundingClientRect(); setSheen(l, (e.clientX - lr.left) / lr.width); });
      });
      gsap.ticker.add(() => {
        if (!heroOn) return;
        glow.x += (glow.tx - glow.x) * 0.08;
        glow.y += (glow.ty - glow.y) * 0.08;
        hero.style.setProperty('--mx', (glow.x * 100).toFixed(2) + '%');
        hero.style.setProperty('--my', (glow.y * 100).toFixed(2) + '%');
      });
    } else {
      // No hover: the chrome catches the light on its own every few seconds
      const loop = () => { if (heroOn) sweep(lockLines, { duration: 1.8 }); gsap.delayedCall(5.5, loop); };
      gsap.delayedCall(5, loop);
    }

    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
      .to(lockLines[0] || {}, { xPercent: -8, ease: 'none' }, 0)
      .to(lockLines[1] || {}, { xPercent: 7, ease: 'none' }, 0)
      .to(lockLines[2] || {}, { xPercent: -5, ease: 'none' }, 0)
      .to(lock, { yPercent: 16, opacity: 0.2, ease: 'none' }, 0)
      .to(art, { yPercent: 14, scale: 0.94, opacity: 0.3, ease: 'none' }, 0)
      .to(sealWrap, { rotation: 200, ease: 'none' }, 0)
      .to('.hero__aside, .hero__foot, .hero__kicker', { y: -60, opacity: 0, ease: 'none' }, 0);

    return intro;
  }

  // Blue spray dust: drifts upward on its own and sprays off the pointer
  function initSpray(hero, isOn) {
    const cvs = $('.hero__spray');
    if (!cvs || !cvs.getContext || reduced) return null;
    const ctx = cvs.getContext('2d');
    const parts = [];
    const MAX = fine ? 360 : 150;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = hero.clientWidth; h = hero.clientHeight;
      cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', debounce(resize, 200));
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const sg = sprite.getContext('2d');
    const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(210,238,255,1)');
    grad.addColorStop(0.25, 'rgba(79,184,255,.85)');
    grad.addColorStop(0.6, 'rgba(26,108,240,.3)');
    grad.addColorStop(1, 'rgba(26,108,240,0)');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 64, 64);

    const add = (p) => { if (parts.length >= MAX) parts.shift(); parts.push(p); };
    const dust = () => ({ x: Math.random() * w, y: h * (0.3 + Math.random() * 0.75), vx: (Math.random() - 0.5) * 8, vy: -(6 + Math.random() * 14), r: 1 + Math.random() * 2.4, life: 5 + Math.random() * 7, age: Math.random() * 5, kind: 1, ph: Math.random() * 6.28 });
    for (let i = 0; i < (fine ? 46 : 22); i++) add(dust());
    const emit = (x, y, dx, dy, n, power) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (20 + Math.random() * 110) * power;
        add({ x: x - dx * Math.random(), y: y - dy * Math.random(), vx: Math.cos(a) * v + dx * 3, vy: Math.sin(a) * v + dy * 3, r: 0.6 + Math.random() * 2.2, life: 0.5 + Math.random() * 0.9, age: 0, kind: 0 });
      }
    };
    let last = null;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const sp = Math.hypot(dx, dy);
        if (sp > 2) emit(x, y, dx, dy, Math.min(9, Math.ceil(sp / 7)), 1);
      }
      last = { x, y };
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { last = null; });

    const draw = (p, a) => {
      if (a <= 0.01) return;
      ctx.globalAlpha = a;
      const s = p.r * 4;
      ctx.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
    };
    let prev = performance.now();
    gsap.ticker.add(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!isOn() || document.hidden) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.kind) {
          if (p.age > p.life || p.y < -20) Object.assign(p, dust(), { age: 0, y: h + 10 });
          p.ph += dt;
          p.x += (p.vx + Math.sin(p.ph) * 6) * dt;
          p.y += p.vy * dt;
          draw(p, Math.sin(Math.PI * clamp(p.age / p.life, 0, 1)) * 0.32);
        } else {
          if (p.age > p.life) { parts.splice(i, 1); continue; }
          p.vx *= 1 - 2.4 * dt;
          p.vy = p.vy * (1 - 2.4 * dt) + 60 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          draw(p, (1 - p.age / p.life) * 0.9);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
    return { burst: (x, y) => emit(x, y, 0, 0, 46, 1.8) };
  }

  // Click in the hero: an electric-blue paint splat that drips, then dries off
  let splatCount = 0;
  function splat(container, x, y) {
    const n = ++splatCount;
    const el = document.createElement('div');
    el.className = 'splat';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    const R = 26 + Math.random() * 12;
    let drops = '';
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = R + 10 + Math.random() * 46;
      drops += `<circle cx="${(Math.cos(a) * d).toFixed(1)}" cy="${(Math.sin(a) * d).toFixed(1)}" r="${(1.5 + Math.random() * 5).toFixed(1)}"/>`;
    }
    let drips = '';
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const dx = (Math.random() - 0.5) * R * 1.3;
      const wd = 3 + Math.random() * 5;
      const len = 30 + Math.random() * 90;
      drips += `<rect x="${(dx - wd / 2).toFixed(1)}" y="${(R * 0.35).toFixed(1)}" width="${wd.toFixed(1)}" height="${len.toFixed(1)}" rx="${(wd / 2).toFixed(1)}"/>`;
    }
    el.innerHTML = `<svg viewBox="-90 -90 180 260"><defs><radialGradient id="spg${n}" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#a6dbff"/><stop offset=".35" stop-color="#2f86ff"/><stop offset="1" stop-color="#0a3fb0"/></radialGradient></defs><g fill="url(#spg${n})"><g class="splat__drips">${drips}</g><g class="splat__blob" transform="rotate(${Math.round(Math.random() * 360)})"><path d="${blobPath(R, 12, 0.55)}"/>${drops}</g></g></svg>`;
    container.appendChild(el);
    while (container.children.length > 12) container.firstElementChild.remove();
    const blob = el.querySelector('.splat__blob');
    const dripEls = el.querySelectorAll('.splat__drips rect');
    gsap.timeline({ onComplete: () => el.remove() })
      .fromTo(blob, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.55, ease: 'elastic.out(1, .5)' })
      .fromTo(dripEls, { scaleY: 0, transformOrigin: '50% 0%' }, { scaleY: 1, duration: 2.6, ease: 'power2.out', stagger: 0.15 }, 0.15)
      .to(el, { opacity: 0, duration: 1.4, ease: 'power1.in' }, '+=2.4');
  }

  /* ========================================================================
     Generic reveals
     ======================================================================== */
  function initReveals() {
    if (reduced) return;
    $$('.split-words').forEach((el) => {
      gsap.fromTo($$('.wi', el), { yPercent: 115 }, { yPercent: 0, stagger: 0.08, duration: 1.25, scrollTrigger: { trigger: el, start: 'top 90%' } });
    });
    const fades = $$('.eyebrow, .fix__sub, .trail__note, .reach__lede, .towns__note, .book__sub');
    gsap.set(fades, { opacity: 0, y: 26 });
    ST.batch(fades, { start: 'top 92%', onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 1.1, overwrite: true }) });
    gsap.set('.towns li', { opacity: 0, x: -18 });
    ST.batch('.towns li', { start: 'top 95%', onEnter: (els) => gsap.to(els, { opacity: 1, x: 0, stagger: 0.04, duration: 0.9, overwrite: true }) });
    gsap.set('.link', { opacity: 0, y: 20 });
    ST.batch('.link', { start: 'top 95%', onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 1, overwrite: true }) });
  }

  /* ========================================================================
     THE DEAL — a wiper clears the grime off the windshield
     ======================================================================== */
  function initDeal() {
    const shield = $('.shield');
    if (!shield || reduced) return;
    const facts = $$('.deal__facts li');
    const answer = $('.shield__a');
    const glint = $('.shield__glint');
    mm.add({ desk: '(min-width: 721px)', mob: '(max-width: 720px)' }, (ctx) => {
      gsap.set(shield, { '--wipe': '0deg' });
      gsap.set(facts, { opacity: 0, y: 16 });
      gsap.timeline({ scrollTrigger: { trigger: '.deal', pin: '.deal__pin', start: 'top top', end: ctx.conditions.desk ? '+=170%' : '+=130%', scrub: 0.6 } })
        .to(shield, { '--wipe': '186deg', ease: 'power1.inOut', duration: 1 }, 0)
        .fromTo(glint, { xPercent: -60, opacity: 0 }, { xPercent: 60, opacity: 1, duration: 0.45, ease: 'none' }, 0.82)
        .to(glint, { opacity: 0, duration: 0.1 }, 1.22)
        .fromTo(answer, { '--glow': 0 }, { '--glow': 1, duration: 0.3 }, 0.9)
        .to(facts, { opacity: 1, y: 0, stagger: 0.06, duration: 0.3 }, 0.95);
    });
  }

  /* ========================================================================
     Ticker — speed and direction follow the scroll
     ======================================================================== */
  function initTicker() {
    const rows = $$('[data-marquee]');
    if (!rows.length || reduced) return;
    const loops = rows.map((row) => {
      const dir = parseFloat(row.dataset.marquee) || 1;
      return dir > 0
        ? gsap.to(row, { xPercent: -50, duration: 46, ease: 'none', repeat: -1 })
        : gsap.fromTo(row, { xPercent: -50 }, { xPercent: 0, duration: 54, ease: 'none', repeat: -1 });
    });
    let idle = 0;
    ST.create({
      trigger: '.ticker', start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => {
        const v = self.getVelocity();
        const boost = 1 + Math.min(Math.abs(v) / 260, 6);
        loops.forEach((t) => gsap.to(t, { timeScale: boost * self.direction, duration: 0.2, overwrite: true }));
        gsap.to(rows, { skewX: clamp(-v / 130, -10, 10), duration: 0.4, overwrite: 'auto' });
        clearTimeout(idle);
        idle = setTimeout(() => {
          loops.forEach((t) => gsap.to(t, { timeScale: self.direction, duration: 1.2, ease: 'power2.out' }));
          gsap.to(rows, { skewX: 0, duration: 1, ease: 'elastic.out(1, .5)' });
        }, 120);
      },
    });
  }

  /* ========================================================================
     WHAT I FIX — the parts plate follows the list
     ======================================================================== */
  function initCatalogue(g) {
    const rows = $$('.part');
    const figs = $$('.plate__figs .fig');
    if (!rows.length || !figs.length) return;
    const code = $('[data-plate-code]');
    const name = $('[data-plate-name]');
    const idx = $('[data-plate-idx]');
    const animate = Boolean(g) && !reduced;
    let current = 0;
    let scrollIdx = 0;
    let hovering = false;
    const show = (i) => {
      if (i === current || i < 0) return;
      current = i;
      rows.forEach((r, k) => r.classList.toggle('is-active', k === i));
      figs.forEach((f, k) => f.classList.toggle('is-active', k === i));
      code.textContent = 'Fig. ' + pad(i + 1);
      name.textContent = rows[i].dataset.name;
      idx.textContent = pad(i + 1);
      if (animate) drawIn(figs[i]);
    };

    if (!g) {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) show(rows.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
        rows.forEach((r) => io.observe(r));
      }
      return;
    }

    if (animate) {
      figs.forEach(prepDraw);
      ST.create({ trigger: '.plate', start: 'top 85%', once: true, onEnter: () => drawIn(figs[current]) });
    }
    // One trigger for the whole list: whichever row crosses the 62% line is active
    const pick = () => {
      const line = innerHeight * 0.62;
      let best = 0;
      for (let k = 0; k < rows.length; k++) { if (rows[k].getBoundingClientRect().top <= line) best = k; }
      scrollIdx = best;
      if (!hovering) show(best);
    };
    ST.create({ trigger: '.parts', start: 'top 62%', end: 'bottom 62%', onUpdate: pick, onToggle: pick, onRefresh: pick });

    if (fine && animate) {
      rows.forEach((row, i) => row.addEventListener('pointerenter', () => { hovering = true; show(i); }));
      $('.parts').addEventListener('pointerleave', () => { hovering = false; show(scrollIdx); });
      const frame = $('.plate__frame');
      g.set(frame, { transformPerspective: 1000 });
      const rx = g.quickTo(frame, 'rotationX', { duration: 0.9, ease: 'power3' });
      const ry = g.quickTo(frame, 'rotationY', { duration: 0.9, ease: 'power3' });
      const fix = $('.fix');
      fix.addEventListener('pointermove', (e) => {
        const r = frame.getBoundingClientRect();
        ry(clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1) * 8);
        rx(clamp(-(e.clientY - (r.top + r.height / 2)) / r.height, -1, 1) * 6);
      });
      fix.addEventListener('pointerleave', () => { rx(0); ry(0); });
    }
  }

  /* ========================================================================
     OFF-ROAD & YARD — pinned horizontal track (swipe carousel on phones)
     ======================================================================== */
  function initTrail() {
    const track = $('.trail__track');
    const rigs = $$('.rig');
    if (!track || !rigs.length || reduced) return;
    const idxEl = $('[data-rig-idx]');
    const bar = $('.trail__bar b');
    const figs = rigs.map((r) => $('.fig', r));
    figs.forEach(prepDraw);
    const setIdx = (i) => { const t = pad(i + 1); if (idxEl && idxEl.textContent !== t) idxEl.textContent = t; };
    const nearest = () => {
      let best = 0;
      let bd = Infinity;
      const c = innerWidth / 2;
      rigs.forEach((r, i) => { const b = r.getBoundingClientRect(); const d = Math.abs(b.left + b.width / 2 - c); if (d < bd) { bd = d; best = i; } });
      return best;
    };

    mm.add('(min-width: 721px)', () => {
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      // HUD follows the eased track itself, so it never lags behind what's on screen
      const horiz = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        onUpdate() { gsap.set(bar, { scaleX: this.progress() }); setIdx(nearest()); },
        scrollTrigger: { trigger: '.trail', pin: '.trail__pin', start: 'top top', end: () => '+=' + dist(), scrub: 1, invalidateOnRefresh: true },
      });
      rigs.forEach((rig, i) => {
        gsap.fromTo(rig, { rotation: 2.5, scale: 0.9, opacity: 0.35 }, { rotation: 0, scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: rig, containerAnimation: horiz, start: 'left right', end: 'center 60%', scrub: true } });
        gsap.fromTo(figs[i], { xPercent: -9 }, { xPercent: 9, ease: 'none', scrollTrigger: { trigger: rig, containerAnimation: horiz, start: 'left right', end: 'right left', scrub: true } });
        gsap.fromTo($('.rig__num', rig), { yPercent: 40 }, { yPercent: -15, ease: 'none', scrollTrigger: { trigger: rig, containerAnimation: horiz, start: 'left right', end: 'right left', scrub: true } });
        ST.create({ trigger: rig, containerAnimation: horiz, start: 'left 80%', once: true, onEnter: () => drawIn(figs[i]) });
      });
      const words = $('.trail__words');
      if (words) gsap.fromTo(words, { xPercent: 30 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.trail__end', containerAnimation: horiz, start: 'left right', end: 'right right', scrub: true } });
      if (fine) rigs.forEach(tiltAndWarp);
    });

    mm.add('(max-width: 720px)', () => {
      const onScroll = () => {
        setIdx(nearest());
        const max = track.scrollWidth - track.clientWidth;
        gsap.set(bar, { scaleX: max > 0 ? track.scrollLeft / max : 0 });
      };
      track.addEventListener('scroll', onScroll, { passive: true });
      ST.create({ trigger: track, start: 'top 80%', once: true, onEnter: () => figs.forEach((f, i) => gsap.delayedCall(i * 0.15, () => drawIn(f))) });
      gsap.from(rigs, { x: 70, opacity: 0, stagger: 0.12, duration: 1.2, scrollTrigger: { trigger: track, start: 'top 85%' } });
      return () => track.removeEventListener('scroll', onScroll);
    });
  }

  // Hover: a 3D tilt, plus a heat-haze ripple that settles
  function tiltAndWarp(rig) {
    gsap.set(rig, { transformPerspective: 1400 });
    const rx = gsap.quickTo(rig, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(rig, 'rotationY', { duration: 0.8, ease: 'power3' });
    const disp = $('#warp feDisplacementMap');
    rig.addEventListener('pointerenter', () => {
      if (!disp) return;
      rig.classList.add('is-warp');
      gsap.fromTo(disp, { attr: { scale: 34 } }, { attr: { scale: 0 }, duration: 1.1, ease: 'power3.out', overwrite: true, onComplete: () => rig.classList.remove('is-warp') });
    });
    rig.addEventListener('pointermove', (e) => {
      const r = rig.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 7);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 7);
    });
    rig.addEventListener('pointerleave', () => { rx(0); ry(0); rig.classList.remove('is-warp'); });
  }

  /* ========================================================================
     HOW IT WORKS — the needle sweeps through three stops, the odometer rolls
     ======================================================================== */
  function initGauge() {
    if (!$('.gauge__svg')) return;
    buildTicks($('.gauge__ticks'), 300, 300, 274, 60, 5, 12, 26);
    const needle = $('.gauge__needle');
    const fill = $('.gauge__fill');
    const marks = $$('.mark');
    const stages = $$('.stage');
    const odo = initOdo($('[data-odo]'));
    const STOPS = [0.12, 0.5, 0.88];
    let lastActive = -1;
    const render = (p) => {
      const t = clamp(p, 0, 1) * 2;
      const i = Math.min(1, Math.floor(t));
      const pos = i + smooth((t - i - 0.22) / 0.56);
      const v = STOPS[0] + (STOPS[2] - STOPS[0]) * (pos / 2);
      needle.setAttribute('transform', `rotate(${(-90 + 180 * v).toFixed(2)} 300 300)`);
      fill.style.strokeDashoffset = (1 - v).toFixed(4);
      const active = Math.round(pos);
      if (active !== lastActive) {
        lastActive = active;
        stages.forEach((s, k) => s.classList.toggle('is-active', k === active));
        marks.forEach((m, k) => m.classList.toggle('is-on', k <= active));
      }
      odo.set(Math.round(60 * (1 - clamp(pos - 0.5, 0, 1))));
    };
    if (reduced) { render(1); stages.forEach((s) => s.classList.add('is-active')); return; }
    render(0);
    const state = { p: 0 };
    mm.add({ desk: '(min-width: 721px)', mob: '(max-width: 720px)' }, (ctx) => {
      ST.create({
        trigger: '.route', pin: '.route__pin', start: 'top top', end: ctx.conditions.desk ? '+=220%' : '+=170%',
        onUpdate: (s) => gsap.to(state, { p: s.progress, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: () => render(state.p) }),
      });
    });
  }

  function initOdo(el) {
    if (!el) return { set() {} };
    el.textContent = '';
    const strips = [0, 1, 2].map(() => {
      const col = document.createElement('span');
      col.className = 'odo__col';
      const strip = document.createElement('span');
      strip.className = 'odo__strip';
      strip.innerHTML = '0123456789'.split('').map((d) => `<span>${d}</span>`).join('');
      col.appendChild(strip);
      el.appendChild(col);
      return strip;
    });
    let last = -1;
    const api = {
      set(n) {
        if (n === last) return;
        last = n;
        const s = pad(n, 3);
        strips.forEach((st, k) => { st.style.transform = `translateY(${-Number(s[k])}em)`; });
      },
    };
    api.set(60);
    return api;
  }

  /* ========================================================================
     COVERAGE — radar lifts off the table, rings expand, the 60 counts up
     ======================================================================== */
  function initReach() {
    const big = $('[data-count]');
    if (reduced) return;
    if (big) {
      const n = { v: 0 };
      big.textContent = '0';
      ST.create({ trigger: big, start: 'top 85%', once: true, onEnter: () => gsap.to(n, { v: +big.dataset.count, duration: 2, ease: 'power3.out', onUpdate: () => { big.textContent = String(Math.round(n.v)); } }) });
    }
    gsap.timeline({ scrollTrigger: { trigger: '.radar-wrap', start: 'top 90%', end: 'center 55%', scrub: 0.8 } })
      .fromTo('.radar', { rotationX: 55, scale: 0.86 }, { rotationX: 0, scale: 1, ease: 'none' }, 0)
      .fromTo('.ring', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, stagger: -0.12, ease: 'power2.out' }, 0)
      .fromTo('.town', { opacity: 0 }, { opacity: 1, stagger: 0.03, ease: 'none' }, 0.3);
    if (fine) {
      const radar = $('.radar');
      const ry = gsap.quickTo(radar, 'rotationY', { duration: 1, ease: 'power3' });
      const rz = gsap.quickTo(radar, 'rotationZ', { duration: 1.4, ease: 'power3' });
      $('.reach').addEventListener('pointermove', (e) => { ry((e.clientX / innerWidth - 0.5) * 18); rz((e.clientY / innerHeight - 0.5) * -6); });
    }
  }

  /* ========================================================================
     PROMISE — a brush stroke opens to full screen, the words stretch wide
     ======================================================================== */
  function initPromise() {
    const paint = $('.promise__paint');
    if (!paint) return;
    paint.style.setProperty('--band-mask', `url("${bandMask(9)}")`);
    if (reduced) return;
    const lines = $$('.promise__line');
    const sub = $('.promise__sub');
    mm.add({ desk: '(min-width: 721px)', mob: '(max-width: 720px)' }, (ctx) => {
      gsap.set(lines, { '--wd': 62, opacity: 0, yPercent: 30 });
      gsap.set(sub, { opacity: 0, y: 20 });
      gsap.timeline({ scrollTrigger: { trigger: '.promise', pin: '.promise__pin', start: 'top top', end: ctx.conditions.desk ? '+=190%' : '+=150%', scrub: 0.7 } })
        .fromTo(paint, { '--band': '4%', '--tilt': '-8deg' }, { '--band': '260%', '--tilt': '0deg', ease: 'power2.in', duration: 1 }, 0)
        .to(lines, { '--wd': 125, opacity: 1, yPercent: 0, stagger: 0.22, duration: 0.7, ease: 'power2.out' }, 0.42)
        .to(sub, { opacity: 1, y: 0, duration: 0.3 }, 1.35);
    });
  }

  /* ========================================================================
     BOOK — message builder (works without GSAP) + entrances
     ======================================================================== */
  function initBuilder() {
    const form = $('#builder');
    if (!form) return null;
    const bubble = $('[data-msg]');
    const sms = $('[data-sms]');
    const copyBtn = $('[data-copy]');
    const town = $('#b-town');
    const model = $('#b-model');
    const compose = () => {
      const vehicle = $('.chips[data-group="vehicle"] .chip[aria-pressed="true"]', form);
      const issues = $$('.chips[data-group="issue"] .chip[aria-pressed="true"]', form).map((c) => c.dataset.value);
      const m = model.value.trim().replace(/\s+/g, ' ');
      const what = m ? (/^(a|an|my|the)\s/i.test(m) ? m : `a ${m}`) : (vehicle ? vehicle.dataset.phrase : 'a vehicle');
      const where = town.value === 'other' ? 'a bit outside the 60 km area' : `in ${town.value}`;
      return `Hi! I’ve got ${what} ${where}.\nIssue: ${issues.length ? issues.join(', ') : 'Not sure yet'}.\nWhen could you come take a look?`;
    };
    const update = (animate) => {
      const msg = compose();
      bubble.textContent = msg;
      sms.setAttribute('href', `sms:${PHONE}?&body=${encodeURIComponent(msg)}`);
      if (animate && window.gsap && !reduced) {
        window.gsap.fromTo(bubble, { y: 8, opacity: 0.55, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out', transformOrigin: '100% 100%', overwrite: true });
      }
    };
    $$('.chips', form).forEach((group) => {
      const single = group.dataset.mode === 'single';
      group.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        if (single) $$('.chip', group).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        else chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
        update(true);
      });
    });
    town.addEventListener('change', () => update(true));
    model.addEventListener('input', () => update(false));
    form.addEventListener('submit', (e) => e.preventDefault());
    const label = $('.btn__text', copyBtn);
    let reset = 0;
    const flash = (text) => {
      label.textContent = text;
      clearTimeout(reset);
      reset = setTimeout(() => { label.textContent = 'Copy message'; }, 1800);
    };
    const selectBubble = () => {
      const range = document.createRange();
      range.selectNodeContents(bubble);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      flash('Selected, copy it');
    };
    copyBtn.addEventListener('click', () => {
      const msg = compose();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(() => flash('Copied'), selectBubble);
      else selectBubble();
    });
    update(false);
    return { compose };
  }

  function initBook() {
    if (reduced) return;
    const dialNum = $('.dial__num');
    gsap.fromTo(dialChars, { yPercent: 115 }, { yPercent: 0, stagger: 0.035, duration: 1.3, scrollTrigger: { trigger: '.dial', start: 'top 88%' } });
    if (dialNum) ST.create({ trigger: '.dial', start: 'top 70%', once: true, onEnter: () => sweep([dialNum], { duration: 1.6, delay: 0.4 }) });
    gsap.fromTo('.orb', { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 1.6, ease: 'elastic.out(1, .55)', scrollTrigger: { trigger: '.book__row', start: 'top 90%' } });
    gsap.from('.chip', { opacity: 0, y: 18, stagger: 0.025, duration: 0.8, scrollTrigger: { trigger: '.builder', start: 'top 85%' } });
    gsap.from('.phone', { y: 60, opacity: 0, duration: 1.2, scrollTrigger: { trigger: '.builder', start: 'top 80%' } });
    gsap.fromTo('.book__logo', { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 1.4, scrollTrigger: { trigger: '.book__top', start: 'top 80%' } });
    if (fine) {
      const logo = $('.book__logo');
      gsap.set(logo, { transformPerspective: 1000 });
      const rx = gsap.quickTo(logo, 'rotationX', { duration: 1, ease: 'power3' });
      const ry = gsap.quickTo(logo, 'rotationY', { duration: 1, ease: 'power3' });
      logo.addEventListener('pointermove', (e) => {
        const r = logo.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 12);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
      });
      logo.addEventListener('pointerleave', () => { rx(0); ry(0); });
      const dial = $('.dial');
      if (dial && dialNum) dial.addEventListener('pointermove', (e) => { const r = dialNum.getBoundingClientRect(); setSheen(dialNum, (e.clientX - r.left) / r.width); });
    }
  }

  /* ========================================================================
     FOOTER — the page lifts away; letters swell toward the pointer
     ======================================================================== */
  function initFooter() {
    const footer = $('.footer');
    if (!footer) return;
    if (!reduced) {
      const end = () => `bottom ${Math.max(0, innerHeight - footer.offsetHeight)}px`;
      gsap.fromTo(footLetters, { yPercent: 70 }, { yPercent: 0, stagger: 0.035, ease: 'none', scrollTrigger: { trigger: 'main', start: 'bottom bottom', end, scrub: 0.6, invalidateOnRefresh: true } });
      gsap.fromTo('.footer__inner', { yPercent: -25 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: 'main', start: 'bottom bottom', end, scrub: true, invalidateOnRefresh: true } });
    }
    if (fine && !reduced) {
      const word = $('.footer__letters');
      footer.addEventListener('pointermove', (e) => {
        const r = word.getBoundingClientRect();
        setSheen(word, (e.clientX - r.left) / r.width);
        footLetters.forEach((l) => {
          const b = l.getBoundingClientRect();
          const f = Math.max(0, 1 - Math.abs(e.clientX - (b.left + b.width / 2)) / 260);
          gsap.to(l, { scaleY: 1 + f * 0.26, duration: 0.5, ease: 'power3', overwrite: 'auto' });
        });
      });
      footer.addEventListener('pointerleave', () => gsap.to(footLetters, { scaleY: 1, duration: 1.1, ease: 'elastic.out(1, .4)', overwrite: 'auto' }));
    }
  }

  /* ========================================================================
     Small things that need no animation library
     ======================================================================== */
  function initClock() {
    const year = $('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
    const el = $('[data-time]');
    if (!el) return;
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hour12: false });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 15000);
  }

  // Phones: a call bar slides up once the hero is gone, and steps aside at the booking form
  function initCallbar() {
    const bar = $('.callbar');
    const hero = $('.hero');
    const book = $('#book');
    if (!bar || !hero || !book || !('IntersectionObserver' in window)) return;
    let heroVisible = true;
    let bookVisible = false;
    const update = () => {
      const on = !heroVisible && !bookVisible;
      bar.classList.toggle('is-on', on);
      bar.inert = !on;
    };
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }, { threshold: 0.12 }).observe(hero);
    new IntersectionObserver(([e]) => { bookVisible = e.isIntersecting; update(); }, { threshold: 0.02 }).observe(book);
    update();
  }
})();
