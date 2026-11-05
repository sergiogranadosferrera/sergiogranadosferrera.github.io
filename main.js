(() => {
  'use strict';

  const A = window.anime;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || !A;
  if (!reduced) root.classList.add('motion');

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const lang = () => root.dataset.lang;
  const play = (targets, params) => new Promise((resolve) => {
    A.animate(targets, { ...params, onComplete: () => resolve() });
  });

  /* ============================================================
     Idioma
     ============================================================ */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  function setLang(l) {
    root.dataset.lang = l;
    root.lang = l;
    store.set('cv-lang', l);
    $('.fan').setAttribute('aria-label', l === 'es' ? 'Secciones del CV' : 'CV sections');
    $('#lightbox').setAttribute('aria-label', l === 'es' ? 'Vídeo' : 'Video');
    $$('[data-aria-es]').forEach((el) => el.setAttribute('aria-label', el.dataset['aria' + (l === 'es' ? 'Es' : 'En')]));
    setEcho(false);
    if (cal.year) setYear(cal.year);
    requestAnimationFrame(layoutFan);
  }

  /* ============================================================
     Letras: títulos de nota de rescate y opciones desiguales
     ============================================================ */
  function rng(seed) {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 10000) / 10000;
    };
  }
  const KINDS = ['a', 'b', 'c', 'd', 'e'];

  function ransomHTML(text) {
    const rand = rng(text);
    let prev = '';
    const words = text.split(' ').map((word) => {
      const letters = [...word].map((ch) => {
        let k;
        do { k = KINDS[Math.floor(rand() * KINDS.length)]; } while (k === prev);
        prev = k;
        const r = (rand() * 16 - 8).toFixed(1);
        const s = (0.86 + rand() * 0.3).toFixed(2);
        const y = (rand() * 0.16 - 0.08).toFixed(2);
        return `<span class="rl rl--${k}" style="--r:${r}deg;--s:${s};--y:${y}em">${ch}</span>`;
      }).join('');
      return `<span class="rw">${letters}</span>`;
    }).join(' ');
    return `<span aria-hidden="true">${words}</span><span class="sr">${text}</span>`;
  }

  function optHTML(text) {
    const rand = rng('opt' + text);
    const chars = [...text];
    const inv = new Set();
    chars.forEach((ch, i) => { if (i > 0 && ch !== ' ' && rand() < 0.2) inv.add(i); });
    if (!inv.size) inv.add(Math.min(2, chars.length - 1));
    const letters = chars.map((ch, i) => {
      if (ch === ' ') return '<span class="ol-gap"></span>';
      const s = i === 0 ? 1.3 : 0.84 + rand() * 0.26;
      const y = (rand() * 0.12 - 0.06).toFixed(2);
      const r = (rand() * 8 - 4).toFixed(1);
      return `<span class="ol${inv.has(i) ? ' ol--inv' : ''}" style="--s:${s.toFixed(2)};--y:${y}em;--r:${r}deg">${ch}</span>`;
    }).join('');
    return `<span aria-hidden="true">${letters}</span><span class="sr">${text}</span>`;
  }

  function buildLetters() {
    $$('[data-ransom]').forEach((el) => { el.innerHTML = ransomHTML(el.textContent.trim()); });
    $$('[data-ransom-es]').forEach((el) => {
      el.innerHTML = ['es', 'en']
        .map((l) => `<span data-l="${l}">${ransomHTML(el.dataset['ransom' + l[0].toUpperCase() + l[1]])}</span>`)
        .join('');
    });
    $$('.opt__word').forEach((w) => { w.innerHTML = optHTML(w.textContent.trim()); });
  }

  // Anime.js escribe `transform` completo: guardamos la inclinación de CSS en su caché.
  const SKEWED = '.menu__tag, .back, .reels__title, .lang, .skill, .mis__label';
  function keepSkew() {
    if (reduced) return;
    $$(SKEWED).forEach((el) => {
      const cs = getComputedStyle(el);
      const sk = cs.getPropertyValue('--sk').trim();
      if (sk) A.utils.set(el, { skewX: sk, rotate: cs.getPropertyValue('--rot').trim() || '0deg' });
    });
  }

  /* ============================================================
     Fondo: una sola banda de texto en bucle
     ============================================================ */
  function buildBands() {
    $$('.band__track').forEach((t) => { t.innerHTML = `<span>${t.dataset.text.repeat(3)}</span>`.repeat(4); });
  }
  function startBands() {
    if (reduced) return;
    $$('.band__track').forEach((t) => A.animate(t, { translateX: ['0%', '-50%'], duration: 70000, ease: 'linear', loop: true }));
  }

  /* ============================================================
     "A saltos": bordes y sombras redibujados a 12 fps
     ============================================================ */
  const BOIL_SEL = '.card, .opt__block, .skill, .lang, .back, .photo, .chart-card, .conf__head, .conf__inner, .cal__item, .cal__sheet, .sheet__bio, .sstat, .inv__tile, .cdet__body';
  const desk = matchMedia('(min-width: 1101px)');
  const boil = { list: [], frame: 0, timer: null };

  function parsePoly(str) {
    const m = /polygon\((.*)\)/.exec(str || '');
    return m ? m[1].split(',').map((p) => p.trim().split(/\s+/)) : null;
  }
  function jit(v, amt) {
    const n = parseFloat(v);
    const unit = v.replace(/^-?[\d.]+/, '') || '%';
    const d = unit === '%' ? amt : amt * 2;
    return (n + (Math.random() * 2 - 1) * d).toFixed(2) + unit;
  }
  const polyFrames = (poly, amt = 0.9) => [0, 1, 2].map(() => 'polygon(' + poly.map(([x, y]) => `${jit(x, amt)} ${jit(y, amt)}`).join(', ') + ')');

  function prep(el, make) {
    if (!el.__frames) { el.__frames = make(); el.__phase = Math.floor(Math.random() * 3); }
    return el.__frames && el.__frames.length;
  }

  function refreshBoil(screen) {
    if (reduced) return;
    const items = [];
    [...$$(BOIL_SEL, screen), ...$$('.chip')].forEach((el) => {
      if (prep(el, () => { const p = parsePoly(getComputedStyle(el).clipPath); return p ? polyFrames(p) : []; })) items.push({ el, kind: 'clip' });
    });
    if (screen.id === 'menu') {
      const slash = parsePoly(getComputedStyle(root).getPropertyValue('--cut-slash'));
      opts.forEach((o) => { if (prep(o, () => polyFrames(slash, 3))) items.push({ el: o, kind: 'shadow' }); });
    }
    $$('.star').forEach((s) => {
      prep(s, () => [0, 1, 2].map(() => `translate(${(Math.random() * 4 - 2).toFixed(1)}px, ${(Math.random() * 4 - 2).toFixed(1)}px) rotate(${(Math.random() * 10 - 5).toFixed(1)}deg) scale(${(0.94 + Math.random() * 0.12).toFixed(2)})`));
      items.push({ el: s, kind: 'transform' });
    });
    boil.list = items;
  }

  function boilTick() {
    boil.frame = (boil.frame + 1) % 3;
    for (const { el, kind } of boil.list) {
      const f = el.__frames[(boil.frame + el.__phase) % 3];
      if (kind === 'clip') el.style.clipPath = f;
      else if (kind === 'shadow') el.style.setProperty('--sh', f);
      else el.style.transform = f;
    }
  }
  function startBoil() {
    if (reduced) return;
    const run = () => { clearInterval(boil.timer); boil.timer = setInterval(boilTick, 1000 / 12); };
    run();
    document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(boil.timer) : run()));
  }

  /* ============================================================
     Menú: abanico radial, selección y eco
     ============================================================ */
  const menu = $('#menu');
  const fan = $('.fan');
  const orbitEl = $('#orbit');
  const opts = $$('.opt');
  const items = opts.map((o) => o.parentElement);
  const echo = $('#echo');
  const JIT = [10, -6, 22, 0, 26, -4, 16, 4]; // radios desiguales, como el menú de combate
  let sel = 0;

  items.forEach((li, i) => li.style.setProperty('--i', i));
  const optLabel = (o) => $(`.opt__word[data-l="${lang()}"] .sr`, o).textContent;

  function layoutFan() {
    if (!menu.classList.contains('is-active')) return;
    const radial = innerWidth > 900 && innerHeight >= 540;
    menu.classList.toggle('is-radial', radial);
    if (!radial) {
      orbitEl.removeAttribute('style');
      echoWrap.removeAttribute('style');
      echoBox = null;
      items.forEach((li) => { li.style.left = li.style.top = li.style.rotate = ''; });
      return;
    }
    const W = menu.clientWidth, H = menu.clientHeight;
    const mr = menu.getBoundingClientRect();
    const rel = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - mr.left, r: r.right - mr.left, t: r.top - mr.top, b: r.bottom - mr.top }; };
    const head = rel($('.menu__head', menu));
    const tag = rel($('.menu__tag', menu));
    const gutter = head.l;

    // Abanico: de debajo de la barra superior hasta encima de la frase, sin tocarla
    const n = items.length;
    const itemH = Math.max(...items.map((li) => li.offsetHeight));
    const yTop = 78 + itemH / 2;
    const yBot = tag.t - 28 - itemH / 2;
    // en ventanas muy altas no se estira: separación máxima entre opciones de ~1,7 veces su alto
    const cy = (yTop + yBot) / 2;
    const span = Math.min((yBot - yTop) / 2, (itemH * 1.7 * (n - 1)) / 2);
    const cx = W * 0.25;
    const R = Math.min(H * 0.32, W * 0.18);
    const arc = span * 1.12;
    const boxes = [];
    items.forEach((li, i) => {
      const dy = -span + (2 * span * i) / (n - 1);
      const dx = Math.sqrt(Math.max(0, arc * arc - dy * dy));
      const deg = Math.asin(dy / arc) * 180 / Math.PI;
      const x = cx + dx * (R / arc) + JIT[i % JIT.length];
      const top = cy + dy - li.offsetHeight / 2;
      li.style.left = x.toFixed(1) + 'px';
      li.style.top = top.toFixed(1) + 'px';
      li.style.rotate = (deg * 0.24).toFixed(1) + 'deg';
      boxes.push({ l: x, t: top - 12, b: top + li.offsetHeight + 12 });
    });

    // Eco: en la franja libre bajo el título, a la izquierda de las opciones
    const eTop = head.b + 12;
    const eH = Math.max(70, H * 0.12);
    const eRight = Math.min(...boxes.filter((b) => b.b > eTop && b.t < eTop + eH).map((b) => b.l), W * 0.5) - 28;
    echoBox = { l: gutter, t: eTop, w: Math.max(120, eRight - gutter), h: eH };

    // Planeta: más pequeño, bajo el eco y por encima de la frase
    const size = R * 1.12;
    let oy = Math.max(cy, eTop + eH + size * 0.3);
    oy = Math.min(oy, tag.t - 14 - size * 0.5);
    orbitEl.style.left = (cx - size / 2) + 'px';
    orbitEl.style.top = (oy - size / 2) + 'px';
    orbitEl.style.width = size + 'px';
    fitEcho();
  }

  // Ajusta el tamaño de letra del eco para que quepa entero en su caja
  const echoWrap = $('.echo');
  let echoBox = null;
  const SIN = Math.sin(3 * Math.PI / 180), COS = Math.cos(3 * Math.PI / 180), TAN = Math.tan(12 * Math.PI / 180);
  function fitEcho() {
    if (!echoBox) return;
    Object.assign(echoWrap.style, { left: echoBox.l + 'px', top: echoBox.t + 'px', width: echoBox.w + 'px', height: echoBox.h + 'px' });
    echo.style.fontSize = '100px';
    const a = echo.scrollWidth / 100, b = echo.offsetHeight / 100;
    // inclinación (skew) y giro de -3°: ancho y alto efectivos por cada px de letra
    const wPer = a * COS + b * SIN + b * TAN, hPer = a * SIN + b * COS;
    const f = Math.max(24, Math.min(echoBox.w / wPer, echoBox.h / hPer) * 0.96);
    echo.style.fontSize = f.toFixed(1) + 'px';
  }

  function setEcho(animateIt) {
    if (!opts[sel]) return;
    echo.textContent = optLabel(opts[sel]);
    fitEcho();
    if (reduced || !animateIt) { echo.style.opacity = 0.9; return; }
    // entra desde dentro de su caja (escala < 1) para no pisar nada mientras se anima
    A.animate(echo, { opacity: [0, 0.9], translateX: ['-8%', '0%'], scale: [0.82, 1], duration: 260, ease: 'outBack(1.6)' });
  }

  function select(i, o = {}) {
    i = (i + opts.length) % opts.length;
    if (i === sel && !o.force) return;
    const old = opts[sel];
    sel = i;
    opts.forEach((op, k) => op.classList.toggle('is-sel', k === sel));
    if (o.focus) opts[sel].focus({ preventScroll: true });
    setEcho(!o.quiet);
    if (!reduced) {
      if (old && old !== opts[sel]) A.animate($('.opt__block', old), { scale: 1, duration: 120, ease: 'out(3)' });
      A.animate($('.opt__block', opts[sel]), {
        scale: [{ to: 1.16, duration: 70, ease: 'out(3)' }, { to: 1.07, duration: 380, ease: 'outElastic(1, .45)' }],
      });
      A.animate($('.opt__pill', opts[sel]), { rotate: [{ to: -30, duration: 60 }, { to: -8, duration: 300, ease: 'outElastic(1, .5)' }] });
    }
  }

  opts.forEach((o, i) => {
    o.addEventListener('mouseenter', () => select(i));
    o.addEventListener('focus', () => select(i));
  });

  /* ============================================================
     Panel diagonal de la portada: patrón de cómic propio
     ============================================================ */
  // Patrón de cómic propio (portada y panel de Herramientas). Cada copia lleva sus propios ids.
  function buildComic(svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const p = svg.dataset.comic;
    const add = (parent, tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      parent.append(el);
      return el;
    };
    svg.innerHTML =
      `<defs><pattern id="${p}-dots" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="8" cy="8" r="5"/></pattern>` +
      `<linearGradient id="${p}-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<mask id="${p}-mask"><rect width="600" height="1000" fill="url(#${p}-fade)"/></mask></defs>` +
      `<rect width="600" height="1000" fill="#fff"/><g class="c-speed"></g><g class="c-stripes" mask="url(#${p}-mask)"></g><g class="c-stars"></g>`;
    // líneas de velocidad: cuñas negras desde un foco detrás del objeto
    const sp = $('.c-speed', svg);
    const [fx, fy] = (svg.dataset.focus || '410,470').split(',').map(Number);
    const r0 = 150, r1 = 1300;
    for (let a = 0; a < 360; a += 9) {
      const w = 1.4 + ((a * 7) % 5) * 0.55;
      const p = (deg, r) => { const t = deg * Math.PI / 180; return `${(fx + r * Math.cos(t)).toFixed(1)},${(fy + r * Math.sin(t)).toFixed(1)}`; };
      add(sp, 'polygon', { points: `${p(a, r0 + (a % 4) * 30)} ${p(a - w, r1)} ${p(a + w, r1)}` });
    }
    // semitono a rayas: bandas diagonales de puntos que se desvanecen hacia la derecha
    const st = $('.c-stripes', svg);
    [[-80, 120], [-80, 360], [-80, 760]].forEach(([x, y], i) => {
      add(st, 'rect', { x, y, width: 760, height: 70 + i * 16, transform: `rotate(-24 ${x} ${y})`, fill: `url(#${p}-dots)` });
    });
    // estrellas
    const stars = $('.c-stars', svg);
    [[120, 130, 70, 'w', 12], [470, 120, 44, 'k', -18], [520, 820, 86, 'w', 20], [250, 880, 34, 'k', 8], [80, 560, 40, 'w', -10]].forEach(([x, y, s, k, r]) => {
      add(stars, 'use', { href: '#star', x: x - s / 2, y: y - s / 2, width: s, height: s, class: k, transform: `rotate(${r} ${x} ${y})` });
    });
  }

  function enterLanding() {
    const L = $('#landing');
    if (!L || !L.offsetParent) return;
    // barrido diagonal: el panel entra desde la derecha y un filo blanco lo cruza
    A.animate($$('.landing__bg', L), { translateX: ['70%', '0%'], skewX: [-18, 0], duration: 300, delay: 60, ease: 'out(4)' });
    A.animate($('.sat-main', L), { translateY: [-900, 0], rotate: [-30, 0], duration: 760, delay: 380, ease: 'outBounce' });
    A.animate($('.sat-shadow', L), { translateY: [-900, 0], translateX: [18, 18], duration: 760, delay: 470, ease: 'outBounce' });
    A.animate($('.landing__tag', L), { scale: [2.6, 1], opacity: [0, 1], duration: 200, delay: 900, ease: 'in(3)' });
  }

  /* ============================================================
     Paralaje suave con el ratón
     ============================================================ */
  function startParallax() {
    if (reduced || !matchMedia('(pointer: fine)').matches) return;
    const p = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
    const step = () => {
      p.x += (p.tx - p.x) * 0.08;
      p.y += (p.ty - p.y) * 0.08;
      root.style.setProperty('--px', p.x.toFixed(4));
      root.style.setProperty('--py', p.y.toFixed(4));
      p.raf = Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) > 0.0008 ? requestAnimationFrame(step) : 0;
    };
    addEventListener('pointermove', (e) => {
      p.tx = e.clientX / innerWidth - 0.5;
      p.ty = e.clientY / innerHeight - 0.5;
      if (!p.raf) p.raf = requestAnimationFrame(step);
    }, { passive: true });
  }

  /* ============================================================
     Órbita VLEO
     ============================================================ */
  const sat = $('#sat');
  const alt = $('#alt');
  const TILT = -22 * Math.PI / 180;
  function placeSat(t) {
    const th = t * 7 * Math.PI * 2;
    const k = 1 - 0.24 * t;
    const ex = 180 * k * Math.cos(th), ey = 62 * k * Math.sin(th);
    const x = 200 + ex * Math.cos(TILT) - ey * Math.sin(TILT);
    const y = 200 + ex * Math.sin(TILT) + ey * Math.cos(TILT);
    const behind = Math.sin(th) < 0 && Math.hypot(x - 200, y - 200) < 120;
    sat.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(th * 57.3 % 360).toFixed(0)})`);
    sat.style.opacity = behind ? 0 : 1;
    alt.textContent = Math.round(300 - 150 * t);
  }
  function startOrbit() {
    if (reduced) { placeSat(0.08); return; }
    const o = { t: 0 };
    A.animate(o, { t: 1, duration: 42000, ease: 'linear', loop: true, onUpdate: () => placeSat(o.t) });
  }

  /* ============================================================
     PERFIL
     ============================================================ */
  function enterPerfil(panel) {
    A.animate($('.photo', panel), { translateX: ['-70vw', '0vw'], rotate: [-14, 0], duration: 460, delay: 120, ease: 'outBack(1.3)' });
    A.animate($$('.ptag', panel), { scale: [0, 1], rotate: () => [A.utils.random(-30, 30), 0], duration: 260, delay: A.stagger(110, { start: 520 }), ease: 'outBack(2.6)' });
    A.animate($$('.sheet__info > *', panel), { translateX: ['60vw', '0vw'], duration: 400, delay: A.stagger(80, { start: 200 }), ease: 'outBack(1.4)' });
    A.animate($$('.sstat', panel), { scale: [2.4, 1], opacity: [0, 1], duration: 200, delay: A.stagger(140, { start: 700 }), ease: 'in(3)' });
  }

  /* ============================================================
     FORMACIÓN · calendario
     ============================================================ */
  const Y0 = 2022, Y1 = 2028;
  const cal = { year: null, flipping: false };
  const thisYear = () => new Date().getFullYear();
  const clampYear = (y) => Math.min(Y1, Math.max(Y0, y));

  function setYear(y) {
    cal.year = y;
    $('#cal-year').textContent = y;
    $('#cal-note').textContent = y === thisYear() ? (lang() === 'es' ? 'Año actual' : 'This year') : '';
    $$('.cal__item').forEach((b) => b.classList.toggle('is-on', +b.dataset.from <= y && y <= +b.dataset.to));
    $('.cal').style.setProperty('--now', ((y - Y0) / (Y1 - Y0) * 100).toFixed(2) + '%');
  }

  function initCal() {
    $$('.cal__item').forEach((b) => {
      const f = +b.dataset.from, t = +b.dataset.to;
      const bar = $('.cal__bar i', b);
      bar.style.left = ((f - Y0) / (Y1 - Y0) * 100) + '%';
      bar.style.width = ((t - f) / (Y1 - Y0) * 100) + '%';
      b.addEventListener('click', () => flipTo(f));
    });
    setYear(clampYear(thisYear()));
  }

  // Arranca una hoja: cae la de arriba y debajo aparece el año siguiente
  function tearSheet(nextYear) {
    const sheet = $('#cal-sheet');
    const ghost = sheet.cloneNode(true);
    ghost.removeAttribute('id');
    $$('[id]', ghost).forEach((n) => n.removeAttribute('id'));
    sheet.after(ghost);
    setYear(nextYear);
    return play(ghost, {
      rotateX: [0, -75], translateY: ['0%', '60%'], rotate: [0, A.utils.random(-18, 18)], opacity: [1, 0],
      duration: 260, ease: 'in(2)',
    }).then(() => ghost.remove());
  }

  async function flipTo(target, gap = 70) {
    target = clampYear(target);
    if (reduced) { setYear(target); return; }
    if (cal.flipping || target === cal.year) return;
    cal.flipping = true;
    const dir = target > cal.year ? 1 : -1;
    while (cal.year !== target) {
      tearSheet(cal.year + dir);
      await wait(gap);
    }
    A.animate('#cal-year', { scale: [1.25, 1], duration: 300, ease: 'outElastic(1, .5)' });
    cal.flipping = false;
  }

  function enterFormacion(panel) {
    setYear(Y0);
    A.animate($('.cal__pad', panel), { translateY: ['-80vh', '0vh'], rotate: [12, 0], duration: 460, delay: 100, ease: 'outBack(1.3)' });
    A.animate($$('.cal__list li', panel), { translateX: ['60vw', '0vw'], duration: 380, delay: A.stagger(90, { start: 200 }), ease: 'outBack(1.4)' });
    A.animate($$('.cal__bar i', panel), { scaleX: [0, 1], duration: 360, delay: A.stagger(90, { start: 520 }), ease: 'out(3)' });
    setTimeout(() => flipTo(thisYear(), 170), 700);
  }

  /* ============================================================
     INVESTIGACIÓN · misión
     ============================================================ */
  const CH = { x0: 58, x1: 520, y0: 34, y1: 262 };
  const chartY = (h) => CH.y0 + (300 - h) / 150 * (CH.y1 - CH.y0);
  function curve(T) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const tau = i / 48;
      pts.push([CH.x0 + (CH.x1 - CH.x0) * T * tau, chartY(300 - 150 * Math.pow(tau, 3))]);
    }
    return pts;
  }
  const toD = (pts) => 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L');

  function buildChart() {
    const svg = $('#chart');
    let g = '';
    [300, 250, 200, 150].forEach((h) => {
      const y = chartY(h).toFixed(1);
      g += `<line x1="${CH.x0}" x2="${CH.x1}" y1="${y}" y2="${y}"/><text x="${CH.x0 - 10}" y="${+y + 4}" text-anchor="end">${h}</text>`;
    });
    g += `<line x1="${CH.x0}" x2="${CH.x0}" y1="${CH.y0 - 8}" y2="${CH.y1}" style="stroke:#fff"/><line x1="${CH.x0}" x2="${CH.x1}" y1="${CH.y1}" y2="${CH.y1}" style="stroke:#fff"/>`;
    $('.chart__grid', svg).innerHTML = g;
    const early = curve(0.66), mean = curve(0.82), late = curve(1);
    $('#chart-early').setAttribute('d', toD(early));
    $('#chart-late').setAttribute('d', toD(late));
    $('#chart-mean').setAttribute('d', toD(mean));
    $('#chart-band').setAttribute('d', toD([...early, ...late.slice().reverse()]) + ' Z');
    const end = mean[mean.length - 1];
    $('#chart-sat').setAttribute('transform', `translate(${end[0].toFixed(1)} ${end[1].toFixed(1)})`);
  }

  function animateChart(delay) {
    const mean = $('#chart-mean'), satEl = $('#chart-sat'), rect = $('#band-rect');
    const len = mean.getTotalLength();
    mean.style.strokeDasharray = len;
    mean.style.strokeDashoffset = len;
    rect.setAttribute('width', 0);
    $$('.chart__edge').forEach((e) => { e.style.opacity = 0; });
    const prog = { p: 0 };
    A.animate(prog, {
      p: 1, duration: 1400, delay, ease: 'in(2)',
      onUpdate: () => {
        mean.style.strokeDashoffset = len * (1 - prog.p);
        const pt = mean.getPointAtLength(len * prog.p);
        satEl.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${(prog.p * 540).toFixed(0)})`);
        rect.setAttribute('width', (CH.x0 + (CH.x1 - CH.x0) * prog.p).toFixed(1));
      },
      onComplete: () => {
        rect.setAttribute('width', 540);
        A.animate('.chart__edge', { opacity: [0, 1], duration: 160, delay: A.stagger(80), ease: 'linear' });
      },
    });
  }

  function enterInvestigacion(panel) {
    A.animate($('.mis__target', panel), { translateX: ['-70vw', '0vw'], rotate: [-8, 0], duration: 440, delay: 120, ease: 'outBack(1.3)' });
    A.animate($('.mis__report', panel), { translateX: ['70vw', '0vw'], duration: 440, delay: 220, ease: 'outBack(1.2)' });
    A.animate($$('.mis__label', panel), { translateY: [-90, 0], opacity: [0, 1], duration: 280, delay: A.stagger(120, { start: 420 }), ease: 'outBack(2.4)' });
    A.animate($$('.mis__inputs li', panel), { scale: [0, 1], duration: 240, delay: A.stagger(80, { start: 640 }), ease: 'outBack(2.6)' });
    A.animate($('.mis__done', panel), { translateY: ['40vh', '0vh'], duration: 400, delay: 360, ease: 'outBack(1.4)' });
    A.animate($('.mis__stamp', panel), { scale: [3.4, 1], opacity: [0, 1], rotate: [30, 10], duration: 200, delay: 1300, ease: 'in(3)' });
    animateChart(900);
  }

  /* ============================================================
     EXPERIENCIA · confidentes
     ============================================================ */
  const rows = $$('.conf__row');

  function toggleConf(row, open, animateIt = true) {
    if (open === row.classList.contains('is-open')) return;
    const head = $('.conf__head', row), body = $('.conf__body', row);
    row.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', String(open));
    if (open) {
      body.hidden = false;
      if (!reduced && animateIt) {
        A.animate(body, { height: [0, body.scrollHeight], duration: 280, ease: 'outBack(1.3)', onComplete: () => { body.style.height = ''; } });
        A.animate($('.conf__inner', body), { translateX: ['-40%', '0%'], opacity: [0, 1], duration: 260, ease: 'out(3)' });
        A.animate($('.conf__card', row), { rotate: [{ to: 18, duration: 80 }, { to: -6, duration: 320, ease: 'outElastic(1, .5)' }] });
      }
    } else if (!reduced && animateIt) {
      A.animate(body, { height: [body.scrollHeight, 0], duration: 180, ease: 'in(2)', onComplete: () => { body.hidden = true; body.style.height = ''; } });
    } else {
      body.hidden = true;
    }
  }

  // Escritorio: la lista no se despliega; la fila elegida rellena el panel de la derecha
  let confCur = -1;
  function selectConf(i, animateIt = true) {
    i = (i + rows.length) % rows.length;
    const row = rows[i], det = $('#cdet');
    confCur = i;
    rows.forEach((r, k) => {
      r.classList.toggle('is-cur', k === i);
      const h = $('.conf__head', r);
      if (k === i) h.setAttribute('aria-current', 'true'); else h.removeAttribute('aria-current');
    });
    $('.cdet__emblem use', det).setAttribute('href', $('.conf__card use', row).getAttribute('href'));
    $('.cdet__role', det).innerHTML = $('.conf__role', row).innerHTML;
    $('.cdet__name', det).textContent = $('.conf__name', row).textContent;
    const t = $('.conf__time', row);
    $('.cdet__time', det).innerHTML = t ? t.innerHTML : '';
    $('.cdet__body', det).innerHTML = $('.conf__inner', row).innerHTML;
    if (reduced || !animateIt) return;
    // como en la lista de confidentes: la silueta cruza, cae la placa y entran los detalles
    A.animate($('.cdet__emblem', det), { translateX: ['-70vw', '0vw'], rotate: [-40, 0], duration: 460, ease: 'outBack(1.2)' });
    A.animate($('.cdet__plate', det), { translateY: [-70, 0], rotate: [-14, 0], scale: [1.3, 1], opacity: [0, 1], duration: 300, delay: 120, ease: 'outBack(2)' });
    A.animate($('.cdet__body', det), { translateX: [120, 0], opacity: [0, 1], duration: 280, delay: 200, ease: 'outBack(1.6)' });
    A.animate($$('.cdet__body li, .cdet__body p', det), { translateX: [60, 0], opacity: [0, 1], duration: 220, delay: A.stagger(45, { start: 260 }), ease: 'out(3)' });
  }

  function applyConfMode() {
    rows.forEach((r) => {
      const h = $('.conf__head', r);
      if (desk.matches) {
        h.removeAttribute('aria-expanded');
        h.setAttribute('aria-controls', 'cdet');
      } else {
        h.setAttribute('aria-expanded', String(r.classList.contains('is-open')));
        h.setAttribute('aria-controls', $('.conf__body', r).id);
        h.removeAttribute('aria-current');
      }
    });
    if (desk.matches) selectConf(Math.max(0, confCur), false);
  }

  function initConf() {
    rows.forEach((r, i) => {
      $('.conf__body', r).hidden = true;
      const head = $('.conf__head', r);
      head.addEventListener('click', () => {
        if (desk.matches) { if (i !== confCur) selectConf(i); return; }
        const open = !r.classList.contains('is-open');
        rows.forEach((o) => { if (o !== r) toggleConf(o, false); });
        toggleConf(r, open);
      });
      head.addEventListener('focus', () => { if (desk.matches && i !== confCur) selectConf(i); });
    });
    if (reduced) toggleConf(rows[0], true, false);
    applyConfMode();
  }

  function enterExperiencia(panel) {
    A.animate(rows, { translateX: (el, i) => [i % 2 ? '70vw' : '-70vw', '0vw'], duration: 400, delay: A.stagger(90, { start: 140 }), ease: 'outBack(1.4)' });
    A.animate($$('.conf__card', panel), { scale: [0, 1], duration: 260, delay: A.stagger(90, { start: 360 }), ease: 'outBack(3)' });
    if (desk.matches) { setTimeout(() => selectConf(0), 420); return; }
    rows.forEach((r) => toggleConf(r, false, false));
    setTimeout(() => toggleConf(rows[0], true), 820);
  }

  /* ============================================================
     HERRAMIENTAS · habilidades
     ============================================================ */
  // Escritorio: inventario por categoría construido desde la lista (un solo origen de datos)
  const GROUPS = {
    calc: { es: 'Cálculo y programación', en: 'Computing and code' },
    cad: { es: 'Diseño y simulación', en: 'Design and simulation' },
    doc: { es: 'Documentación y divulgación', en: 'Writing and outreach' },
  };
  const both = (o) => `<span data-l="es">${o.es}</span><span data-l="en">${o.en}</span>`;
  let tiles = [], invCur = -1;

  function buildInventory() {
    const wrap = $('#inv .inv__groups');
    const skills = $$('.skill');
    const order = [...new Set(skills.map((s) => s.dataset.group))];
    wrap.innerHTML = order.map((g) => `<section class="inv__block"><h3 class="inv__label">${both(GROUPS[g])}</h3><div class="inv__grid">` +
      skills.filter((s) => s.dataset.group === g).map((s) => {
        const k = skills.indexOf(s);
        return `<button class="inv__tile" type="button" data-k="${k}">${$('.skill__ic', s).innerHTML}<span>${$('.skill__name', s).textContent}</span></button>`;
      }).join('') + '</div></section>').join('');
    tiles = $$('.inv__tile', wrap).sort((a, b) => a.dataset.k - b.dataset.k);
    tiles.forEach((t, i) => {
      t.addEventListener('click', () => selectTile(i));
      t.addEventListener('focus', () => selectTile(i));
    });
    selectTile(0, false);
  }

  function selectTile(i, animateIt = true) {
    i = (i + tiles.length) % tiles.length;
    if (i === invCur && animateIt) return;
    invCur = i;
    const s = $$('.skill')[i], side = $('#inv .inv__side');
    tiles.forEach((t, k) => { t.classList.toggle('is-cur', k === i); t.setAttribute('aria-pressed', String(k === i)); });
    const href = $('.skill__ic use', s).getAttribute('href');
    const big = $('.inv__big', side);
    const name = $('.skill__name', s).textContent;
    const fill = () => {
      $$('use', big).forEach((u) => u.setAttribute('href', href));
      $('.inv__group', side).innerHTML = both(GROUPS[s.dataset.group]);
      $('.inv__name', side).innerHTML = optHTML(name);
      $('.inv__cat', side).innerHTML = $('.skill__cat', s).innerHTML;
      $('.inv__note', side).innerHTML = s.dataset.noteEs ? both({ es: s.dataset.noteEs, en: s.dataset.noteEn }) : '';
    };
    if (reduced || !animateIt) { fill(); return; }
    A.animate(tiles[i], { scale: [{ to: 1.12, duration: 60 }, { to: 1, duration: 300, ease: 'outElastic(1, .5)' }] });
    // el icono anterior sale barrido hacia la derecha; el nuevo entra desde la izquierda con rebote
    A.animate(big, {
      translateX: ['0%', '110%'], skewX: [0, -24], opacity: [1, 0], duration: 110, ease: 'in(3)',
      onComplete: () => {
        fill();
        A.animate(big, { translateX: ['-110%', '0%'], skewX: [24, 0], opacity: [0, 1], duration: 420, ease: 'outBack(1.9)' });
        A.animate($('.inv__tag', side), { scale: [1.35, 1], rotate: [-12, -5], opacity: [0, 1], duration: 220, delay: 90, ease: 'outBack(2.2)' });
      },
    });
  }

  function enterHerramientas(panel) {
    if (desk.matches) {
      // como el menú de equipo: el panel entra por la derecha y las filas caen de arriba abajo
      // el panel entra con un barrido diagonal, como en la portada
      A.animate($('.inv__bg', panel), { translateX: ['70%', '0%'], skewX: [-18, 0], duration: 300, delay: 60, ease: 'out(4)' });
      A.animate($$('.inv__label', panel), { translateX: [-120, 0], opacity: [0, 1], duration: 260, delay: A.stagger(120, { start: 200 }), ease: 'outBack(2)' });
      A.animate(tiles, { translateY: [-40, 0], scale: [0.6, 1], opacity: [0, 1], duration: 240, delay: A.stagger(45, { start: 300 }), ease: 'outBack(2.2)' });
      setTimeout(() => { invCur = -1; selectTile(0); }, 640);
      return;
    }
    const list = $$('.skill', panel);
    A.animate($('.skills__head', panel), { opacity: [0, 1], translateY: [-20, 0], duration: 200, delay: 120, ease: 'out(3)' });
    A.animate(list, { translateX: ['-80vw', '0vw'], duration: 340, delay: A.stagger(70, { start: 180 }), ease: 'outBack(1.5)' });
    A.animate($$('.skill__ic', panel), { scale: [2.8, 1], opacity: [0, 1], rotate: [45, 0], duration: 180, delay: A.stagger(70, { start: 420 }), ease: 'in(3)' });
  }

  /* ============================================================
     IDIOMAS · escala MCER
     ============================================================ */
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  function setScale(langEl, v) {
    const idx = LEVELS.indexOf(langEl.dataset.lv);
    $$('.lang__scale i', langEl).forEach((seg, k) => {
      seg.classList.toggle('on', k < Math.min(v, idx));
      seg.classList.toggle('here', k === idx && v > idx);
    });
  }
  function initLangs() { $$('.lang[data-lv]').forEach((l) => setScale(l, 6)); }
  function enterIdiomas(panel) {
    if (desk.matches) {
      // barras de estado del grupo: las columnas suben desde abajo con rebote
      A.animate($$('.lang', panel), { translateY: ['70vh', '0vh'], duration: 460, delay: A.stagger(110, { start: 120 }), ease: 'outBack(1.4)' });
      A.animate($$('.lang__code', panel), { scale: [2.4, 1], rotate: [30, -6], opacity: [0, 1], duration: 220, delay: A.stagger(110, { start: 480 }), ease: 'in(3)' });
      A.animate($('.lang__nbar i', panel), { scaleY: [0, 1], duration: 520, delay: 520, ease: 'outBack(1.6)' });
      A.animate($('.note', panel), { opacity: [0, 1], translateX: [-60, 0], duration: 300, delay: 700, ease: 'out(3)' });
    } else {
      A.animate($$('.lang, .note', panel), { translateX: (el, i) => [i % 2 ? '60vw' : '-60vw', '0vw'], duration: 400, delay: A.stagger(80, { start: 120 }), ease: 'outBack(1.5)' });
    }
    $$('.lang[data-lv]', panel).forEach((l, i) => {
      const idx = LEVELS.indexOf(l.dataset.lv);
      const m = { v: 0 };
      setScale(l, 0);
      A.animate(m, {
        v: [{ to: 6, duration: 480, ease: 'out(2)' }, { to: idx + 1, duration: 260, ease: 'inOut(2)' }],
        delay: 480 + i * 160,
        onUpdate: () => setScale(l, Math.round(m.v)),
        onComplete: () => setScale(l, 6),
      });
    });
  }

  /* ============================================================
     CONTACTO · tarjeta de aviso
     ============================================================ */
  function enterContacto(panel) {
    A.animate($('.notice', panel), { scale: [0.3, 1], rotate: [-28, 0], opacity: [0, 1], duration: 460, delay: 120, ease: 'outBack(1.6)' });
    A.animate($('.notice__star', panel), { rotate: [-180, 0], scale: [0, 1], duration: 520, delay: 360, ease: 'outBack(2)' });
    A.animate($$('.notice__data li', panel), { translateX: ['-50vw', '0vw'], duration: 340, delay: A.stagger(90, { start: 520 }), ease: 'outBack(1.5)' });
  }

  /* ============================================================
     MÁS ALLÁ
     ============================================================ */
  // Nube de cómic: contorno de lóbulos (arcos hacia fuera), rizos interiores y sombra roja desplazada
  function cloudPath(cx, cy, rx, ry, lobes) {
    const pts = [];
    for (let k = 0; k < lobes; k++) {
      const t = (k / lobes) * Math.PI * 2 + A.utils.random(-0.14, 0.14, 3);
      const j = A.utils.random(0.84, 1.1, 3);
      pts.push([cx + rx * j * Math.cos(t), cy + ry * j * Math.sin(t)]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    pts.forEach((_, k) => {
      const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % lobes];
      const r = (Math.hypot(x1 - x0, y1 - y0) / 2) * A.utils.random(1.02, 1.3, 3);
      d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    });
    return d + 'Z';
  }

  function makeCloud() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 100');
    svg.setAttribute('class', 'puff');
    const lobes = Math.round(A.utils.random(7, 10));
    const body = cloudPath(60, 52, 42, 32, lobes);
    // rizos: dos o tres arcos cortos dentro de la nube
    let curls = '';
    for (let c = 0; c < Math.round(A.utils.random(2, 3)); c++) {
      const x = A.utils.random(36, 80), y = A.utils.random(36, 64), r = A.utils.random(7, 12);
      curls += `M${x - r} ${y} A${r} ${r} 0 0 1 ${x + r * 0.6} ${y - r * 0.8} `;
    }
    svg.innerHTML =
      `<path class="puff__shadow" d="${body}" transform="translate(7 8)"/>` +
      `<path class="puff__body" d="${body}"/>` +
      `<path class="puff__curl" d="${curls}"/>`;
    return svg;
  }

  // Pantalla de resultados: flechas rojas, nubes que revientan y números que asoman
  function burstFx(panel, targets, start) {
    let fx = $('.fx', panel);
    if (!fx) { fx = document.createElement('div'); fx.className = 'fx'; fx.setAttribute('aria-hidden', 'true'); panel.append(fx); }
    fx.innerHTML = '';
    // cada estallido mide su símbolo justo cuando sale: antes la tarjeta aún está encogida hacia la izquierda
    targets.forEach((el, n) => setTimeout(() => {
      if (!panel.classList.contains('is-active')) return;
      const pr = panel.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cx = r.left - pr.left + r.width / 2, cy = r.top - pr.top + r.height / 2;
      for (let k = 0; k < 7; k++) {
        const p = makeCloud();
        const s = A.utils.random(60, 130);
        Object.assign(p.style, { width: s + 'px', height: s + 'px', left: (cx + A.utils.random(-80, 80) - s / 2) + 'px', top: (cy + A.utils.random(-50, 50) - s / 2) + 'px' });
        fx.append(p);
        A.animate(p, {
          scale: [{ from: 0, to: 1.15, duration: 140, ease: 'out(3)' }, { to: 1, duration: 200, ease: 'inOut(2)' }, { to: 0, duration: 180, ease: 'in(3)' }],
          rotate: [A.utils.random(-25, 25), A.utils.random(-25, 25)],
          delay: k * 18,
        });
      }
      for (let k = 0; k < 10; k++) {
        const b = document.createElement('div');
        b.className = 'bit';
        Object.assign(b.style, { left: cx + 'px', top: cy + 'px', opacity: 0 });
        fx.append(b);
        A.animate(b, {
          translateX: [0, A.utils.random(-220, 260)], translateY: [0, A.utils.random(-160, 220)],
          rotate: [0, A.utils.random(-540, 540)], opacity: [{ from: 1, to: 1, duration: 700 }, { to: 0, duration: 400 }],
          duration: 1100, delay: 120, ease: 'out(3)',
        });
      }
    }, start + n * 140));
    setTimeout(() => { fx.innerHTML = ''; }, start + targets.length * 140 + 1400);
  }

  function enterMas(panel) {
    if (desk.matches) {
      const cards = $$('.card', panel);
      const vals = cards.map((c) => $('.res__val, .big', c));
      A.animate(cards, { scaleX: [0, 1], opacity: [0, 1], duration: 160, delay: A.stagger(90, { start: 120 }), ease: 'out(4)' });
      A.animate($$('.card h3, .card p:not(.big)', panel), { translateX: [80, 0], opacity: [0, 1], duration: 260, delay: A.stagger(50, { start: 520 }), ease: 'outBack(1.8)' });
      A.animate(vals, { scale: [{ from: 0, to: 0, duration: 1 }, { to: 1.35, duration: 120, ease: 'out(3)' }, { to: 1, duration: 360, ease: 'outElastic(1, .45)' }], rotate: [-25, 0], delay: A.stagger(140, { start: 420 }) });
      burstFx(panel, vals, 320);
      A.animate($('.reels__title', panel), { translateY: [-60, 0], opacity: [0, 1], duration: 260, delay: 300, ease: 'outBack(2)' });
      // la pared de pantallas se enciende como un tubo: primero una línea, luego la imagen
      A.animate($$('.reel', panel), {
        scaleX: [{ from: 0, to: 1, duration: 120, ease: 'out(3)' }], scaleY: [{ from: 0.03, to: 0.03, duration: 120 }, { to: 1, duration: 200, ease: 'outBack(1.5)' }],
        delay: A.stagger(120, { start: 600 }),
      });
      return;
    }
    A.animate($$('.card, .reels__title', panel), { translateX: (el, i) => [i % 2 ? '60vw' : '-60vw', '0vw'], scale: [1.15, 1], duration: 420, delay: A.stagger(70, { start: 120 }), ease: 'outBack(1.5)' });
    A.animate($$('.reel', panel), { translateY: ['-110vh', '0vh'], rotate: () => [A.utils.random(-30, 30), 0], duration: 520, delay: A.stagger(110, { start: 360 }), ease: 'outBack(1.4)' });
  }

  const ENTRANCES = {
    perfil: enterPerfil,
    formacion: enterFormacion,
    investigacion: enterInvestigacion,
    experiencia: enterExperiencia,
    herramientas: enterHerramientas,
    idiomas: enterIdiomas,
    mas: enterMas,
    contacto: enterContacto,
  };

  /* ============================================================
     Vídeos y visor
     ============================================================ */
  const lb = $('#lightbox');
  const lbVideo = $('#lb-video');
  let lbReturn = null;

  function initMedia() {
    const autos = $$('video[data-auto]');
    autos.forEach((v) => {
      if (v.error) v.parentNode.classList.add('is-empty');
      v.addEventListener('error', () => v.parentNode.classList.add('is-empty'));
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(({ target: v, isIntersecting }) => {
          if (isIntersecting && !reduced && !v.parentNode.classList.contains('is-empty')) v.play().catch(() => {});
          else v.pause();
        });
      }, { threshold: 0.4 });
      autos.forEach((v) => io.observe(v));
    }
    const tc = $('#mission-tc'), sim = $('.mission video');
    sim.addEventListener('timeupdate', () => {
      const s = Math.floor(sim.currentTime);
      tc.textContent = `T+ ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    });
    $$('.media').forEach((btn) => btn.addEventListener('click', () => {
      if (!btn.classList.contains('is-empty')) openLightbox(btn.dataset.src, btn);
    }));
    $('#lb-close').addEventListener('click', closeLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !lb.hidden) closeLightbox(); });
  }

  function openLightbox(src, from) {
    lbReturn = from;
    lb.hidden = false;
    lbVideo.src = src;
    lbVideo.muted = false;
    lbVideo.play().catch(() => {});
    if (lb.requestFullscreen) lb.requestFullscreen().catch(() => {});
    $('#lb-close').focus({ preventScroll: true });
    if (!reduced) A.animate('.lightbox__frame', { scale: [0.55, 1], rotate: [-12, -1.5], opacity: [0, 1], duration: 360, ease: 'outBack(1.6)' });
  }

  function closeLightbox() {
    if (lb.hidden) return;
    lbVideo.pause();
    lbVideo.removeAttribute('src');
    lbVideo.load();
    lb.hidden = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (lbReturn) lbReturn.focus({ preventScroll: true });
  }

  /* ============================================================
     Cut-in, barrido y rutas
     ============================================================ */
  const wipe = $('#wipe');
  const strips = $$('.wipe__strip', wipe);
  const cutin = $('#cutin');
  const screens = new Map($$('.screen').map((s) => [s.id, s]));
  let current = null, busy = false, pending = null;

  if (!reduced) A.utils.set(strips, { translateX: '-160%', skewX: -22 });

  function routeFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    return screens.has(id) ? id : 'menu';
  }

  function show(id) {
    screens.forEach((s, k) => s.classList.toggle('is-active', k === id));
    current = id;
    root.dataset.screen = id;
    window.scrollTo(0, 0);
    if (id === 'menu') layoutFan();
    refreshBoil(screens.get(id));
  }

  async function cutIn(id) {
    const o = opts.find((op) => op.hash === '#' + id);
    const word = $('#cutin-word');
    word.textContent = o ? optLabel(o) : '';
    // la franja empieza 20vw fuera de pantalla y está girada: el margen va en vw
    // la franja mide 140vw y está centrada en la pantalla: centrando la palabra en ella, queda en el medio
    const mobile = innerWidth <= 900;
    const pad = mobile ? 3 : 10;
    const fs = Math.min(mobile ? 22 : 13, (100 - 2 * pad) / (word.textContent.length * 0.7));
    word.style.paddingLeft = '0';
    word.style.fontSize = fs.toFixed(2) + 'vw';
    // en móvil la franja se ajusta al alto de las letras, no al de la pantalla
    cutin.style.setProperty('--fs', fs.toFixed(2) + 'vw');
    cutin.classList.add('is-on');
    A.animate('.cutin__slash', { scaleY: [0, 1], translateX: ['40%', '0%'], duration: 140, ease: 'out(4)' });
    A.animate('.cutin__band', { scaleY: [0, 1], translateX: ['-40%', '0%'], duration: 150, delay: 30, ease: 'out(4)' });
    A.animate('#cutin-word', { translateX: ['70vw', '0vw'], scale: [1.7, 1], duration: 190, delay: 110, ease: 'outBack(1.4)' });
    await wait(110 + 190 + 360); // congelado un instante
  }

  const cover = () => play(strips, { translateX: ['-160%', '0%'], duration: 230, delay: A.stagger(45), ease: 'out(4)' });
  const uncover = () => play(strips, { translateX: ['0%', '160%'], duration: 260, delay: A.stagger(45, { from: 'last' }), ease: 'in(3)' });

  function enterMenu(first) {
    A.animate($$('#menu-title .rl'), {
      scale: [2.4, 1], opacity: [0, 1], rotate: () => [A.utils.random(-40, 40), 0],
      duration: 420, delay: A.stagger(22), ease: 'outBack(2.2)',
    });
    A.animate('.orbit', { scale: [0.4, 1], rotate: [-40, 0], opacity: [0, 1], duration: 560, delay: 80, ease: 'outElastic(1, .6)' });
    // las opciones salen disparadas desde el centro del abanico
    A.animate(items, {
      translateX: [-160, 0],
      scale: [0.2, 1], opacity: [0, 1],
      duration: 380, delay: A.stagger(40, { start: first ? 200 : 60 }), ease: 'outBack(1.5)',
    });
    A.animate('.menu__tag', { translateX: [-60, 0], opacity: [0, 1], duration: 300, delay: 300, ease: 'out(4)' });
    A.animate('.band', { opacity: [0, 1], duration: 400, delay: 200, ease: 'linear' });
    enterLanding();
  }

  function enterPanel(panel) {
    A.animate($('.back', panel), { translateX: [-120, 0], duration: 260, ease: 'out(4)' });
    A.animate($$(`.ransom > [data-l="${lang()}"] .rl`, panel), {
      scale: [0, 1], rotate: () => [A.utils.random(-60, 60), 0],
      duration: 380, delay: A.stagger(28), ease: 'outBack(2.6)',
    });
    const decor = $('.decor', panel);
    if (decor && desk.matches) {
      A.animate(decor, { translateX: ['18vw', '0vw'], scale: [1.25, 1], opacity: [0, 1], duration: 620, delay: 60, ease: 'outBack(1.2)' });
    }
    if (ENTRANCES[panel.id]) ENTRANCES[panel.id](panel);
  }

  function afterShow(id, first) {
    if (id === 'menu') {
      if (!reduced) enterMenu(first);
      requestAnimationFrame(() => {
        select(sel, { force: true, quiet: true });
        if (!first) opts[sel].focus({ preventScroll: true });
      });
    } else {
      const panel = screens.get(id);
      if (!reduced) enterPanel(panel);
      $('.ransom', panel).focus({ preventScroll: true });
    }
  }

  async function go(id, first = false) {
    if (id === current) return;
    if (busy) { pending = id; return; }
    closeLightbox();
    if (current === 'menu' && id !== 'menu') {
      const idx = opts.findIndex((o) => o.hash === '#' + id);
      if (idx >= 0) sel = idx;
    }
    if (reduced) { show(id); afterShow(id, first); return; }

    busy = true;
    wipe.classList.add('is-busy');
    if (first) A.utils.set(strips, { translateX: '0%' });
    else {
      if (current === 'menu' && id !== 'menu') await cutIn(id);
      await cover();
    }
    cutin.classList.remove('is-on');
    show(id);
    afterShow(id, first);
    await uncover();
    busy = false;
    wipe.classList.remove('is-busy');
    const p = pending;
    pending = null;
    if (p && p !== current) go(p);
  }

  window.addEventListener('hashchange', () => go(routeFromHash()));

  /* ============================================================
     Teclado
     ============================================================ */
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!lb.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      return;
    }
    if (current === 'menu') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select(sel + 1, { focus: true }); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select(sel - 1, { focus: true }); }
      else if (e.key === 'Enter' && document.activeElement === document.body) { location.hash = opts[sel].hash; }
    } else if (current === 'formacion' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      flipTo(cal.year + (e.key === 'ArrowRight' ? 1 : -1), 0);
    } else if (desk.matches && current === 'experiencia' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      selectConf(confCur + (e.key === 'ArrowDown' ? 1 : -1));
      $('.conf__head', rows[confCur]).focus({ preventScroll: true });
    } else if (desk.matches && current === 'herramientas' && /^Arrow/.test(e.key)) {
      e.preventDefault();
      selectTile(invCur + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1));
      tiles[invCur].focus({ preventScroll: true });
    } else if (e.key === 'Escape' || (e.key === 'Backspace' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName))) {
      e.preventDefault();
      location.hash = '#menu';
    }
  });

  let rz = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => { keepSkew(); layoutFan(); });
  });

  /* ============================================================
     Arranque
     ============================================================ */
  buildLetters();
  buildBands();
  $$('svg.comic').forEach(buildComic);
  buildChart();
  initCal();
  buildInventory();
  initConf();
  initLangs();
  // al cruzar los 1100 px cambian los bordes y el comportamiento de Experiencia
  desk.addEventListener('change', () => {
    $$('*').forEach((el) => { if (el.__frames) { delete el.__frames; el.style.clipPath = ''; } });
    applyConfMode();
    keepSkew();
    if (current) refreshBoil(screens.get(current));
  });
  initMedia();
  keepSkew();
  $('#lang-toggle').addEventListener('click', () => setLang(lang() === 'es' ? 'en' : 'es'));
  const saved = store.get('cv-lang');
  setLang(saved === 'en' || saved === 'es' ? saved : (navigator.language || 'es').startsWith('es') ? 'es' : 'en');
  opts[sel].classList.add('is-sel');

  const start = () => {
    startOrbit();
    startBands();
    startBoil();
    startParallax();
    go(routeFromHash(), true);
  };
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(start);
  } else start();
})();
