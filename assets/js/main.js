/* ==========================================================================
   Deep N Dirty Co. — interaction + scroll choreography
   GSAP + ScrollTrigger for timelines, Lenis for momentum scrolling.
   Everything degrades: no JS → static page, reduced motion → no pins/smoothing.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Static niceties that need no animation library
  const yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const timeEl = $('[data-time]');
  if (timeEl) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hour12: false });
    const tick = () => { timeEl.textContent = fmt.format(new Date()); };
    tick(); setInterval(tick, 15000);
  }

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const loader = $('.loader');

  // Library failed to load: show the static page and keep the menu usable.
  if (!gsap || !ScrollTrigger) {
    loader && loader.remove();
    initMenuFallback();
    initFixAccordion();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'expo.out', duration: 1.2 });

  /* ------------------------------------------------------------------------
     Text splitting — keeps an aria-label on the parent, hides the fragments
     ------------------------------------------------------------------------ */
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = '';
    text.split(' ').forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.className = 'w';
      for (const ch of word) {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        w.appendChild(c);
      }
      el.appendChild(w);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return $$('.c', el);
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
    return $$('.wi', el);
  }
  // Wraps every word (including inside <em>) in .sw for scroll-scrubbed opacity
  function splitScrub(el) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'sw';
            s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return $$('.sw', el);
  }

  // Split everything up-front (layout is the same at every breakpoint)
  const heroChars = $$('.hero .split-chars').map(splitChars);
  $$('.split-words').forEach(splitWords);
  const phoneChars = splitChars($('.contact__phone .split-chars'));
  const scrubWords = splitScrub($('[data-scrub-words]'));
  const footerWord = $('.footer__word span');
  const footerLetters = (() => {
    const t = footerWord.textContent;
    footerWord.textContent = '';
    return [...t].map((ch) => {
      const s = document.createElement('span');
      s.className = 'fl';
      s.textContent = ch;
      footerWord.appendChild(s);
      return s;
    });
  })();

  /* ------------------------------------------------------------------------
     Smooth scroll
     ------------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const jumpTo = (target) => {
    const y = target === '#top' ? 0 : $(target);
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else if (y === 0) window.scrollTo(0, 0);
    else y && y.scrollIntoView();
    ScrollTrigger.update();
  };

  /* ------------------------------------------------------------------------
     Curtain "page transition" for in-page navigation
     ------------------------------------------------------------------------ */
  const curtain = $('.curtain');
  function transitionTo(hash) {
    if (reduced) { jumpTo(hash); return; }
    const words = { '#services': 'Services', '#process': 'How it works', '#coverage': 'Coverage', '#fixes': 'What we fix', '#contact': 'Ring the truck', '#top': 'Back up top' };
    $('.curtain__word', curtain).textContent = words[hash] || 'Rolling out';
    gsap.timeline()
      .set(curtain, { yPercent: 100, pointerEvents: 'auto' })
      .to(curtain, { yPercent: 0, duration: 0.7, ease: 'expo.inOut' })
      .fromTo('.curtain__word', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, '-=0.25')
      .add(() => jumpTo(hash))
      .to(curtain, { yPercent: -100, duration: 0.8, ease: 'expo.inOut', delay: 0.1 })
      .set(curtain, { pointerEvents: 'none' });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    e.preventDefault();
    const hash = a.getAttribute('href');
    if (menuOpen) closeMenu(() => transitionTo(hash));
    else transitionTo(hash);
  });

  /* ------------------------------------------------------------------------
     Menu
     ------------------------------------------------------------------------ */
  const menu = $('#menu');
  const burger = $('.burger');
  let menuOpen = false;
  function openMenu() {
    menuOpen = true;
    menu.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    lenis && lenis.stop();
    if (reduced) { $('.menu__bg', menu).style.clipPath = 'none'; $('.menu__list a', menu).focus(); return; }
    gsap.timeline()
      .fromTo('.menu__bg', { clipPath: 'circle(0% at calc(100% - 46px) 40px)' }, { clipPath: 'circle(150% at calc(100% - 46px) 40px)', duration: 1, ease: 'expo.inOut' })
      .fromTo('.menu__word, .menu__idx', { yPercent: 110 }, { yPercent: 0, stagger: 0.05, duration: 1 }, '-=0.5')
      .fromTo('.menu__foot', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, '-=0.8')
      .add(() => $('.menu__list a', menu).focus(), 0.4);
  }
  function closeMenu(done) {
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    const finish = () => { menu.hidden = true; lenis && lenis.start(); burger.focus({ preventScroll: true }); done && done(); };
    if (reduced) { finish(); return; }
    gsap.timeline({ onComplete: finish })
      .to('.menu__word, .menu__idx', { yPercent: -110, stagger: 0.03, duration: 0.5, ease: 'expo.in' })
      .to('.menu__foot', { opacity: 0, duration: 0.3 }, 0)
      .to('.menu__bg', { clipPath: 'circle(0% at calc(100% - 46px) 40px)', duration: 0.8, ease: 'expo.inOut' }, 0.2);
  }
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });

  /* ------------------------------------------------------------------------
     Fix list: tap-to-expand on touch, hover previews on desktop
     ------------------------------------------------------------------------ */
  initFixAccordion();

  /* ------------------------------------------------------------------------
     Reduced motion: stop here — content is fully visible and static.
     ------------------------------------------------------------------------ */
  if (reduced) {
    loader && loader.remove();
    return;
  }

  /* ------------------------------------------------------------------------
     Initial hidden states (loader covers the page while these apply)
     ------------------------------------------------------------------------ */
  gsap.set(heroChars.flat(), { yPercent: 115, rotate: 8 });
  gsap.set('.hero__n, .hero__co', { scale: 0, rotate: -30, transformOrigin: '0% 100%' });
  const heroFade = '.hero__kicker, .hero__lede, .hero__aside .btn, .hero__foot > *';
  gsap.set(heroFade, { opacity: 0, y: 30 });
  gsap.set('.seal', { scale: 0, rotate: -120 });
  gsap.set('.hero__bg', { opacity: 0, scale: 1.08 });

  /* ------------------------------------------------------------------------
     Preloader → hero intro
     ------------------------------------------------------------------------ */
  lenis && lenis.stop();
  const num = $('.loader__num');
  const counter = { v: 0 };
  const intro = gsap.timeline({ paused: true })
    .to('.hero__bg', { opacity: 1, scale: 1, duration: 2.2, ease: 'expo.out' }, 0)
    .to(heroChars[0], { yPercent: 0, rotate: 0, stagger: 0.06, duration: 1.4 }, 0.1)
    .to(heroChars[1], { yPercent: 0, rotate: 0, stagger: 0.06, duration: 1.4 }, 0.25)
    .to('.hero__n, .hero__co', { scale: 1, rotate: 0, duration: 1.2, ease: 'back.out(2)', stagger: 0.1 }, 0.8)
    .to('.seal', { scale: 1, rotate: 0, duration: 1.6, ease: 'elastic.out(1, .6)' }, 0.9)
    .to(heroFade, { opacity: 1, y: 0, stagger: 0.08 }, 0.9)
    .add(() => lenis && lenis.start(), 0.9);

  gsap.timeline()
    .to(counter, {
      v: 100, duration: 1.8, ease: 'power3.inOut',
      onUpdate: () => {
        num.textContent = String(Math.round(counter.v)).padStart(2, '0');
        gsap.set('.loader__bar i', { scaleX: counter.v / 100 });
      },
    })
    .to('.loader__inner', { yPercent: -30, opacity: 0, duration: 0.6, ease: 'expo.in' }, '+=0.1')
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, '-=0.2')
    .add(() => intro.play(), '-=0.6')
    .add(() => loader.remove());

  /* ------------------------------------------------------------------------
     Custom cursor (fine pointers only)
     ------------------------------------------------------------------------ */
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  let lastX = mouse.x;
  addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  if (fine) {
    root.classList.add('has-cursor');
    const cursor = $('.cursor');
    const label = $('.cursor__label');
    const dotX = gsap.quickTo('.cursor__dot', 'x', { duration: 0.12, ease: 'power3' });
    const dotY = gsap.quickTo('.cursor__dot', 'y', { duration: 0.12, ease: 'power3' });
    const ringX = gsap.quickTo('.cursor__ring', 'x', { duration: 0.5, ease: 'power3' });
    const ringY = gsap.quickTo('.cursor__ring', 'y', { duration: 0.5, ease: 'power3' });
    addEventListener('pointermove', (e) => { dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY); }, { passive: true });
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

  /* ------------------------------------------------------------------------
     Magnetic elements
     ------------------------------------------------------------------------ */
  if (fine) {
    $$('[data-magnetic]').forEach((el) => {
      const k = parseFloat(el.dataset.magnetic) || 0.3;
      const inner = el.querySelector('.btn__text, .pill__text, .orb__text, .seal__core');
      const mx = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' });
      const ix = inner && gsap.quickTo(inner, 'x', { duration: 0.8, ease: 'power3' });
      const iy = inner && gsap.quickTo(inner, 'y', { duration: 0.8, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        mx(dx * k); my(dy * k);
        if (inner) { ix(dx * k * 0.5); iy(dy * k * 0.5); }
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, .35)' });
        inner && gsap.to(inner, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, .35)' });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Global chrome: progress bar + hide-on-scroll nav
     ------------------------------------------------------------------------ */
  gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  const nav = $('.nav');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      if (menuOpen) return;
      nav.classList.toggle('is-hidden', self.scroll() > innerHeight * 0.8 && self.direction === 1);
    },
  });

  /* ------------------------------------------------------------------------
     HERO — work-light, depth parallax, mud splats, scroll exit
     ------------------------------------------------------------------------ */
  const hero = $('.hero');
  const depthEls = $$('[data-depth]', hero).map((el) => ({
    d: parseFloat(el.dataset.depth),
    sx: gsap.quickSetter(el, 'x', 'px'),
    sy: gsap.quickSetter(el, 'y', 'px'),
  }));
  let heroOn = true;
  ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (s) => { heroOn = s.isActive; } });
  if (fine) {
    const light = { x: 0.6, y: 0.45 };
    gsap.ticker.add(() => {
      if (!heroOn) return;
      const r = hero.getBoundingClientRect();
      const tx = clamp((mouse.x - r.left) / r.width, 0, 1);
      const ty = clamp((mouse.y - r.top) / r.height, 0, 1);
      light.x += (tx - light.x) * 0.12;
      light.y += (ty - light.y) * 0.12;
      hero.style.setProperty('--mx', (light.x * 100).toFixed(2) + '%');
      hero.style.setProperty('--my', (light.y * 100).toFixed(2) + '%');
      const ox = (light.x - 0.5) * 40;
      const oy = (light.y - 0.5) * 40;
      depthEls.forEach((o) => { o.sx(ox * o.d); o.sy(oy * o.d); });
    });
  }

  // Click anywhere in the hero to fling some mud
  const splats = $('.splats');
  function blobPath(r, points, wobble) {
    const pts = [];
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const rr = r * (1 - wobble / 2 + Math.random() * wobble);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let d = `M${mid(pts[points - 1], pts[0]).join(' ')}`;
    pts.forEach((p, i) => { const m = mid(p, pts[(i + 1) % points]); d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; });
    return d + 'Z';
  }
  hero.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const r = hero.getBoundingClientRect();
    const s = document.createElement('div');
    s.className = 'splat';
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top = `${e.clientY - r.top}px`;
    let drops = '';
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 34 + Math.random() * 40;
      drops += `<circle cx="${(Math.cos(a) * dist).toFixed(1)}" cy="${(Math.sin(a) * dist).toFixed(1)}" r="${(2 + Math.random() * 6).toFixed(1)}"/>`;
    }
    s.innerHTML = `<svg viewBox="-70 -70 140 140" fill="currentColor"><path d="${blobPath(26 + Math.random() * 10, 11, 0.55)}"/>${drops}</svg>`;
    splats.appendChild(s);
    while (splats.children.length > 14) splats.firstElementChild.remove();
    gsap.timeline({ onComplete: () => s.remove() })
      .fromTo(s, { scale: 0, rotate: Math.random() * 360 }, { scale: 0.7 + Math.random() * 0.7, duration: 0.6, ease: 'elastic.out(1, .5)' })
      .to(s, { opacity: 0, y: 30, scaleY: 1.3, duration: 2.4, ease: 'power2.in' }, '+=3.5');
  });

  // Scroll exit: the two words drift apart, the truck pulls away, the seal keeps turning
  // (targets differ from the intro's so the two never fight over a property)
  gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
    .to('.seal-wrap', { rotation: 220, ease: 'none' }, 0)
    .to('.hero__line--1', { xPercent: -14, ease: 'none' }, 0)
    .to('.hero__line--2', { xPercent: 12, ease: 'none' }, 0)
    .to('.hero__title', { yPercent: 30, scale: 0.92, opacity: 0.15, ease: 'none' }, 0)
    .to('.hero__bg', { yPercent: 18, ease: 'none' }, 0)
    .to('.hero__grid', { scale: 1.25, ease: 'none' }, 0)
    .to('.hero__aside, .hero__foot', { y: -80, opacity: 0, ease: 'none' }, 0);

  /* ------------------------------------------------------------------------
     Generic reveals
     ------------------------------------------------------------------------ */
  $$('.split-words').forEach((el) => {
    if (el.closest('.hero')) return;
    gsap.fromTo($$('.wi', el), { yPercent: 115 }, {
      yPercent: 0, stagger: 0.08, duration: 1.3,
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
  $$('.display .serif, .coverage__unit').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 40, rotate: -6 }, { opacity: 1, y: 0, rotate: 0, duration: 1.4, scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  const fadeEls = '.eyebrow, .services__note, .coverage__lede, .towns__note, .link, .manifesto__meta span, .footer__meta';
  gsap.set(fadeEls, { opacity: 0, y: 30 });
  ScrollTrigger.batch(fadeEls, {
    start: 'top 92%',
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 1.1, overwrite: true }),
  });
  gsap.set('.towns li', { opacity: 0, x: -20 });
  ScrollTrigger.batch('.towns li', {
    start: 'top 95%',
    onEnter: (els) => gsap.to(els, { opacity: 1, x: 0, stagger: 0.04, duration: 0.9, overwrite: true }),
  });

  /* ------------------------------------------------------------------------
     Marquee — direction and speed follow scroll velocity
     ------------------------------------------------------------------------ */
  const marquees = $$('[data-marquee]').map((track) => {
    const dir = parseFloat(track.dataset.marquee) || 1;
    const tween = dir > 0
      ? gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 })
      : gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: 46, ease: 'none', repeat: -1 });
    return tween;
  });
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => {
      const v = self.getVelocity();
      const boost = 1 + Math.min(Math.abs(v) / 250, 6);
      marquees.forEach((t) => gsap.to(t, { timeScale: boost * self.direction, duration: 0.2, overwrite: true }));
      gsap.to(marquees.map((t) => t.targets()[0]), { skewX: clamp(-v / 120, -12, 12), duration: 0.4, overwrite: 'auto' });
      clearTimeout(self._idle);
      self._idle = setTimeout(() => {
        marquees.forEach((t) => gsap.to(t, { timeScale: self.direction, duration: 1.2, ease: 'power2.out' }));
        gsap.to(marquees.map((t) => t.targets()[0]), { skewX: 0, duration: 1, ease: 'elastic.out(1, .5)' });
      }, 120);
    },
  });

  /* ------------------------------------------------------------------------
     Breakpoint-specific choreography
     ------------------------------------------------------------------------ */
  const counterEl = $('[data-panel-idx]');
  const panels = $$('.panel');
  const setCounter = (i) => { const t = String(i + 1).padStart(2, '0'); if (counterEl.textContent !== t) counterEl.textContent = t; };
  const nearestPanel = (axis) => {
    let best = 0, bestD = Infinity;
    const c = axis === 'x' ? innerWidth / 2 : innerHeight / 2;
    panels.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      const d = Math.abs((axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2) - c);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  const mm = gsap.matchMedia();

  // ----- Desktop / tablet -----
  mm.add('(min-width: 721px)', () => {
    // Manifesto: pinned, words light up as you read
    gsap.timeline({ scrollTrigger: { trigger: '.manifesto', pin: '.manifesto__pin', start: 'top top', end: '+=140%', scrub: 0.6 } })
      .to(scrubWords, { opacity: 1, stagger: 0.1, ease: 'none' })
      .to('.manifesto__text', { scale: 0.96, opacity: 0.3, duration: 0.6, ease: 'none' }, '+=0.4');

    // Services: pinned horizontal track
    const track = $('.services__track');
    const dist = () => track.scrollWidth - innerWidth;
    const horiz = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.services', pin: '.services__pin', start: 'top top', end: () => '+=' + dist(),
        scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: () => setCounter(nearestPanel('x')),
      },
    });
    panels.forEach((p) => {
      gsap.fromTo(p, { rotate: 3, scale: 0.88, opacity: 0.4 }, {
        rotate: 0, scale: 1, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: p, containerAnimation: horiz, start: 'left right', end: 'center 60%', scrub: true },
      });
      gsap.fromTo($('.panel__media img', p), { xPercent: -12 }, {
        xPercent: 12, ease: 'none',
        scrollTrigger: { trigger: p, containerAnimation: horiz, start: 'left right', end: 'right left', scrub: true },
      });
      gsap.fromTo($('.panel__num', p), { yPercent: 60 }, {
        yPercent: -30, ease: 'none',
        scrollTrigger: { trigger: p, containerAnimation: horiz, start: 'left right', end: 'right left', scrub: true },
      });
    });
    gsap.fromTo('.services__end .display', { xPercent: 40 }, {
      xPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '.services__end', containerAnimation: horiz, start: 'left right', end: 'right right', scrub: true },
    });

    // Process: pinned road — a dot drives the route as each step lights up
    const road = $('.road__line');
    const roadSvg = $('.road');
    const truckDot = $('.road__truck');
    const len = road.getTotalLength();
    gsap.set(road, { strokeDasharray: len, strokeDashoffset: len });
    const steps = $$('.step');
    gsap.set(steps, { opacity: 0.18, y: 40 });
    const placeDot = (p) => {
      const pt = road.getPointAtLength(clamp(p, 0, 1) * len);
      const r = roadSvg.getBoundingClientRect();
      const pr = roadSvg.parentElement.getBoundingClientRect();
      gsap.set(truckDot, { x: r.left - pr.left + (pt.x / 1200) * r.width, y: r.top - pr.top + (pt.y / 400) * r.height });
    };
    const proc = gsap.timeline({
      scrollTrigger: {
        trigger: '.process', pin: '.process__pin', start: 'top top', end: '+=220%', scrub: 0.8,
        onUpdate: (self) => placeDot(self.progress * 1.1 - 0.05),
        onRefresh: (self) => placeDot(self.progress * 1.1 - 0.05),
      },
    });
    proc.to(road, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0);
    steps.forEach((s, i) => {
      proc.to(s, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }, 0.08 + i * 0.3);
      if (i < steps.length - 1) proc.to(s, { opacity: 0.35, duration: 0.12, ease: 'none' }, 0.08 + (i + 1) * 0.3);
    });

    // Expand: inset frame grows to a full-screen takeover
    gsap.timeline({ scrollTrigger: { trigger: '.expand', pin: '.expand__pin', start: 'top top', end: '+=160%', scrub: 0.8 } })
      .fromTo('.expand__frame', { clipPath: 'inset(22% 30% round 32px)' }, { clipPath: 'inset(0% 0% round 0px)', ease: 'power2.inOut', duration: 1 }, 0)
      .fromTo('.expand__truck', { xPercent: 25, scale: 1.3 }, { xPercent: -15, scale: 1, ease: 'none', duration: 1.6 }, 0)
      .fromTo('.expand__line', { xPercent: (i) => (i % 2 ? 40 : -40), opacity: 0 }, { xPercent: 0, opacity: 1, stagger: 0.12, ease: 'power3.out', duration: 0.8 }, 0.2)
      .to('.expand__words', { scale: 1.06, ease: 'none', duration: 0.6 }, 1);

    // 3D tilt on service panels
    if (fine) {
      panels.forEach((p) => {
        const rx = gsap.quickTo(p, 'rotationX', { duration: 0.8, ease: 'power3' });
        const ry = gsap.quickTo(p, 'rotationY', { duration: 0.8, ease: 'power3' });
        gsap.set(p, { transformPerspective: 1400 });
        p.addEventListener('pointermove', (e) => {
          const r = p.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 8);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
        });
        p.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    }
  });

  // ----- Mobile: recomposed interactions -----
  mm.add('(max-width: 720px)', () => {
    gsap.to(scrubWords, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: 0.5 },
    });
    const track = $('.services__track');
    const onSwipe = () => setCounter(nearestPanel('x'));
    track.addEventListener('scroll', onSwipe, { passive: true });
    gsap.from(panels, { x: 80, opacity: 0, stagger: 0.12, duration: 1.2, scrollTrigger: { trigger: track, start: 'top 85%' } });
    $$('.step').forEach((s) => {
      gsap.from(s, { opacity: 0, x: 30, duration: 1, scrollTrigger: { trigger: s, start: 'top 85%' } });
    });
    gsap.timeline({ scrollTrigger: { trigger: '.expand', pin: '.expand__pin', start: 'top top', end: '+=100%', scrub: 0.6 } })
      .fromTo('.expand__frame', { clipPath: 'inset(16% 8% round 24px)' }, { clipPath: 'inset(0% 0% round 0px)', ease: 'power2.inOut' }, 0)
      .fromTo('.expand__line', { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.15, ease: 'power3.out' }, 0.1);
    return () => track.removeEventListener('scroll', onSwipe);
  });

  /* ------------------------------------------------------------------------
     Coverage — count-up, rings expand, map lifts from flat
     ------------------------------------------------------------------------ */
  const big = $('[data-count]');
  const cnt = { v: 0 };
  ScrollTrigger.create({
    trigger: big, start: 'top 85%', once: true,
    onEnter: () => gsap.to(cnt, { v: +big.dataset.count, duration: 2, ease: 'power3.out', onUpdate: () => { big.textContent = Math.round(cnt.v); } }),
  });
  big.textContent = '0';
  gsap.timeline({ scrollTrigger: { trigger: '.radar-wrap', start: 'top 90%', end: 'center 50%', scrub: 0.8 } })
    .fromTo('.radar', { rotationX: 55, scale: 0.85 }, { rotationX: 0, scale: 1, ease: 'none' }, 0)
    .fromTo('.ring', { scale: 0 }, { scale: 1, stagger: -0.15, ease: 'power2.out' }, 0)
    .fromTo('.town', { opacity: 0 }, { opacity: 1, stagger: 0.04, ease: 'none' }, 0.3);
  if (fine) {
    const radar = $('.radar');
    const ry = gsap.quickTo(radar, 'rotationY', { duration: 1, ease: 'power3' });
    const rz = gsap.quickTo(radar, 'rotationZ', { duration: 1.4, ease: 'power3' });
    $('.coverage').addEventListener('pointermove', (e) => {
      ry((e.clientX / innerWidth - 0.5) * 18);
      rz((e.clientY / innerHeight - 0.5) * -6);
    });
  }

  /* ------------------------------------------------------------------------
     Fix list hover preview (desktop) — follows the cursor and skews with speed
     ------------------------------------------------------------------------ */
  if (fine) {
    const preview = $('.preview');
    const pimg = $('img', preview);
    const px = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' });
    const py = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' });
    const prot = gsap.quickTo(preview, 'rotation', { duration: 0.6, ease: 'power3' });
    const pskew = gsap.quickTo(preview, 'skewX', { duration: 0.6, ease: 'power3' });
    const list = $('.fixlist');
    list.addEventListener('pointermove', (e) => {
      const vx = e.clientX - lastX;
      lastX = e.clientX;
      px(e.clientX + 40); py(e.clientY);
      prot(clamp(vx * 0.6, -12, 12));
      pskew(clamp(vx * -0.8, -18, 18));
    });
    $$('.fix', list).forEach((li) => {
      li.addEventListener('pointerenter', () => {
        const src = li.dataset.img;
        if (!pimg.src.endsWith(src)) {
          gsap.fromTo(pimg, { scale: 1.3, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.8 });
          pimg.src = src;
        }
      });
    });
    list.addEventListener('pointerenter', (e) => {
      gsap.set(preview, { x: e.clientX + 40, y: e.clientY });
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)', overwrite: 'auto' });
    });
    list.addEventListener('pointerleave', () => gsap.to(preview, { opacity: 0, scale: 0.6, duration: 0.4, ease: 'power3.in', overwrite: 'auto' }));
    gsap.from('.fix', { opacity: 0, y: 40, stagger: 0.06, duration: 1.1, scrollTrigger: { trigger: list, start: 'top 85%' } });
  } else {
    gsap.from('.fix', { opacity: 0, y: 30, stagger: 0.06, duration: 1, scrollTrigger: { trigger: '.fixlist', start: 'top 90%' } });
  }

  /* ------------------------------------------------------------------------
     Contact + footer
     ------------------------------------------------------------------------ */
  gsap.fromTo(phoneChars, { yPercent: 110 }, {
    yPercent: 0, stagger: 0.035, duration: 1.3,
    scrollTrigger: { trigger: '.contact__phone', start: 'top 88%' },
  });
  gsap.fromTo('.orb', { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 1.6, ease: 'elastic.out(1, .55)', scrollTrigger: { trigger: '.contact__row', start: 'top 90%' } });

  gsap.fromTo(footerLetters, { yPercent: 100 }, {
    yPercent: 0, ease: 'none', stagger: 0.05,
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
  });
  if (fine) {
    // Letters swell toward the cursor
    const centers = () => footerLetters.map((l) => { const r = l.getBoundingClientRect(); return r.left + r.width / 2; });
    let cache = null;
    const footer = $('.footer');
    footer.addEventListener('pointerenter', () => { cache = centers(); });
    footer.addEventListener('pointermove', (e) => {
      if (!cache) cache = centers();
      footerLetters.forEach((l, i) => {
        const f = Math.max(0, 1 - Math.abs(e.clientX - cache[i]) / 260);
        gsap.to(l, { scaleY: 1 + f * 0.28, duration: 0.5, ease: 'power3', overwrite: 'auto' });
      });
    });
    footer.addEventListener('pointerleave', () => {
      gsap.to(footerLetters, { scaleY: 1, duration: 1, ease: 'elastic.out(1, .4)', overwrite: 'auto' });
      cache = null;
    });
  }

  // Fonts change metrics — re-measure pins once they're in
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());

  /* ======================================================================== */
  function initFixAccordion() {
    $$('.fix').forEach((li) => {
      const btn = $('.fix__row', li);
      btn.addEventListener('click', () => {
        // Desktop: rows are previews — clicking books a call.
        if (fine && !reduced && window.gsap) { transitionTo('#contact'); return; }
        const open = !li.classList.contains('is-open');
        $$('.fix.is-open').forEach((o) => { o.classList.remove('is-open'); $('.fix__row', o).setAttribute('aria-expanded', 'false'); });
        li.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }
  function initMenuFallback() {
    const m = $('#menu');
    const b = $('.burger');
    b.addEventListener('click', () => {
      const open = m.hidden;
      m.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      $('.menu__bg', m).style.clipPath = 'none';
    });
    $$('#menu a').forEach((a) => a.addEventListener('click', () => { m.hidden = true; b.setAttribute('aria-expanded', 'false'); }));
  }
})();
