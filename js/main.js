import { Hero } from './hero.js';
import { initShades } from './shades.js';
import { initBullet } from './bullet.js';
import {
  SHADES, KIT, state, on, emit, setShade, toggleSound, playKiss, addToBag, changeQty, tubeSVG, lipsSVG,
} from './store.js';

const gsap = window.gsap;
const { ScrollTrigger, Draggable, InertiaPlugin } = window;
gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- helpers ---------- */
// Download a file with progress and hand back a blob URL (blob URLs seek reliably on any server).
async function fetchBlob(url, onProgress = () => {}) {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(res.statusText);
    const total = Number(res.headers.get('content-length')) || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (total) onProgress(got / total);
    }
    onProgress(1);
    return URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
  } catch {
    onProgress(1);
    return url;
  }
}

let toastTimer;
function toast(msg) {
  const t = $('.toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
}

function swatchButtons(wrap, source) {
  wrap.innerHTML = SHADES.map((s, i) => `<button class="swatch" type="button" role="radio" aria-checked="${i === state.shade}" aria-label="${s.name}" data-i="${i}" data-cursor="${s.name.toLowerCase()}" style="--c:${s.hex}"></button>`).join('');
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (b) setShade(+b.dataset.i, source);
  });
  on('shade', ({ index }) => [...wrap.children].forEach((b, k) => b.setAttribute('aria-checked', k === index)));
}

/* ---------- smooth scroll ---------- */
function initLenis() {
  if (state.reduced || !window.Lenis) return;
  const lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  state.lenis = lenis;
}

function scrollToTarget(target) {
  if (state.lenis) state.lenis.scrollTo(target, { duration: 1.6 });
  else (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
}

/* ---------- cursor ---------- */
function initCursor() {
  if (!finePointer) return;
  document.body.classList.add('has-cursor');
  const cur = $('.cursor');
  const ring = $('.cursor__ring');
  const dot = $('.cursor__dot');
  const label = $('.cursor__label');
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
  let last = '';
  let px = -100, py = -100;
  const refresh = (target) => {
    const el = target?.closest?.('[data-cursor]');
    const txt = el ? el.dataset.cursor : '';
    if (txt !== last) {
      last = txt;
      label.textContent = txt;
      cur.classList.toggle('is-label', !!txt);
    }
  };
  window.addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    rx(px); ry(py); dx(px); dy(py);
    refresh(e.target);
  });
  // content moves under a still pointer while scrolling
  window.addEventListener('scroll', () => refresh(document.elementFromPoint(px, py)), { passive: true });
  window.addEventListener('pointerdown', () => cur.classList.add('is-down'));
  window.addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('mouseleave', () => cur.classList.add('is-hidden'));
  document.addEventListener('mouseenter', () => cur.classList.remove('is-hidden'));
}

function initMagnetic() {
  if (!finePointer) return;
  $$('.magnetic').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------- nav, sound, bag ---------- */
function initNav() {
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    e.preventDefault();
    if (id === '#') { toast('socials dropping soon 👀'); return; }
    const t = $(id);
    if (t) scrollToTarget(t);
  }));
}

function initNavActive() {
  $$('.nav__links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });
}

function initSound() {
  const btn = $('.nav__sound');
  const label = $('.nav__sound-label');
  btn.addEventListener('click', () => toggleSound());
  on('sound', (isOn) => {
    btn.setAttribute('aria-pressed', String(isOn));
    label.textContent = isOn ? 'sound on' : 'sound off';
    if (isOn) toast('sound on — wait for the kiss 💋');
  });
}

function flyToBag(from, color) {
  const a = from.getBoundingClientRect();
  const bagBtn = $('.nav__bag');
  const b = bagBtn.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  dot.style.setProperty('--c', color);
  document.body.appendChild(dot);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  gsap.set(dot, { x: x0, y: y0, scale: 0 });
  gsap.timeline({
    onComplete: () => {
      dot.remove();
      bagBtn.classList.remove('is-bump');
      void bagBtn.offsetWidth;
      bagBtn.classList.add('is-bump');
    },
  })
    .to(dot, { scale: 1, duration: 0.2, ease: 'back.out(3)' })
    .to(dot, { x: x1, duration: 0.85, ease: 'power1.inOut' }, 0.1)
    .to(dot, { y: Math.min(y0, y1) - 180, duration: 0.42, ease: 'power2.out' }, 0.1)
    .to(dot, { y: y1, duration: 0.43, ease: 'power2.in' }, 0.52)
    .to(dot, { scale: 0.3, duration: 0.2 }, 0.78);
}

function initBag() {
  const bag = $('.bag');
  const list = $('.bag__list');
  const sum = $('.bag__sum');
  const count = $('.bag-count');
  const open = () => {
    bag.classList.add('is-open');
    bag.setAttribute('aria-hidden', 'false');
    state.lenis?.stop();
    $('.bag__close').focus();
  };
  const close = () => {
    if (!bag.classList.contains('is-open')) return;
    bag.classList.remove('is-open');
    bag.setAttribute('aria-hidden', 'true');
    state.lenis?.start();
    $('.nav__bag').focus();
  };
  $('.nav__bag').addEventListener('click', open);
  $('.bag__close').addEventListener('click', close);
  $('.bag__scrim').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (b) changeQty(b.dataset.id, +b.dataset.q);
  });
  $('.bag__checkout').addEventListener('click', () => toast('demo store — but your taste is very real 💋'));

  const render = (items) => {
    list.innerHTML = items.map((it) => `
      <li>
        <span class="dot" style="background:${it.hex}"></span>
        <div><b>${it.name}</b><small>${it.note} · $${it.price}</small></div>
        <div class="bag__qty">
          <button type="button" data-id="${it.id}" data-q="-1" aria-label="Remove one ${it.name}">−</button>
          <span>${it.qty}</span>
          <button type="button" data-id="${it.id}" data-q="1" aria-label="Add one ${it.name}">+</button>
        </div>
      </li>`).join('');
    const n = items.reduce((a, it) => a + it.qty, 0);
    count.textContent = n;
    sum.textContent = `$${items.reduce((a, it) => a + it.qty * it.price, 0)}`;
    bag.classList.toggle('is-empty', !n);
  };
  render(state.bag);
  on('bag', render);
  on('fly', ({ from, color }) => flyToBag(from, color));
}

/* ---------- tapes ---------- */
function initTapes() {
  const tapes = $$('.tape').map((tape, i) => {
    const track = $('.tape__track', tape);
    track.innerHTML = track.innerHTML.repeat(4);
    const t = { track, x: 0, dir: i ? 1 : -1, w: 1 };
    t.measure = () => { t.w = track.firstElementChild.getBoundingClientRect().width || 1; };
    t.measure();
    return t;
  });
  const remeasure = () => tapes.forEach((t) => t.measure());
  window.addEventListener('resize', remeasure);
  document.fonts.ready.then(remeasure);

  let vel = 0;
  if (state.lenis) state.lenis.on('scroll', (e) => { vel = e.velocity; });
  gsap.ticker.add((time, dt) => {
    const boost = 1 + Math.min(Math.abs(vel) * 0.18, 7);
    const sign = vel < -0.05 ? -1 : 1;
    for (const t of tapes) {
      t.x += t.dir * sign * 1.1 * boost * (dt / 16.67);
      if (t.x <= -t.w) t.x += t.w;
      if (t.x > 0) t.x -= t.w;
      t.track.style.transform = `translate3d(${t.x.toFixed(2)}px,0,0)`;
    }
    vel *= 0.92;
  });
}

/* ---------- manifesto ---------- */
function initManifesto() {
  const text = $('.manifesto__text');
  const units = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'word';
          w.textContent = part;
          frag.appendChild(w);
          units.push(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) {
        if (n.matches('.pill-media, .swatch-stack, .scribble')) {
          n.classList.add('word');
          units.push(n);
        } else {
          walk(n);
        }
      }
    });
  };
  walk(text);

  gsap.to(units, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: text, start: 'top 80%', end: 'bottom 42%', scrub: 0.6 } });
  const path = $('.scribble path');
  path.setAttribute('pathLength', '1');
  gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.scribble', start: 'top 72%', end: 'top 42%', scrub: 0.6 } });
  gsap.from('.swatch-stack i', { scale: 0, duration: 0.6, ease: 'back.out(3)', stagger: 0.06, scrollTrigger: { trigger: '.swatch-stack', start: 'top 75%' } });

  $$('.stat b').forEach((b) => {
    const n = +b.dataset.count;
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: b, start: 'top 88%', once: true,
      onEnter: () => gsap.to(o, { v: n, duration: 1.8, ease: 'power3.out', onUpdate: () => { b.textContent = Math.round(o.v); } }),
    });
  });
}

/* ---------- kiss wall ---------- */
function initKiss() {
  const sec = $('.kiss');
  const layer = $('.kiss__layer');
  const countEl = $('.kiss__count');
  swatchButtons($('.kiss__swatches'), 'kiss');

  const KEY = 'mwah-kisses';
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { saved = []; }
  let count = 1284551 + saved.length;
  const show = () => { countEl.textContent = count.toLocaleString('en-US'); };
  show();

  const stamp = (k, animate) => {
    const el = document.createElement('div');
    el.className = 'stamp';
    el.innerHTML = lipsSVG();
    el.style.color = k.c;
    el.style.left = `${k.x}%`;
    el.style.top = `${k.y}%`;
    layer.appendChild(el);
    if (animate) gsap.fromTo(el, { scale: k.s * 2.4, rotation: k.r - 25, opacity: 0 }, { scale: k.s, rotation: k.r, opacity: 0.92, duration: 0.45, ease: 'back.out(2.2)' });
    else gsap.set(el, { scale: k.s, rotation: k.r, opacity: 0.92 });
    if (layer.children.length > 140) layer.firstElementChild.remove();
  };
  saved.forEach((k) => stamp(k, false));

  sec.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    const r = sec.getBoundingClientRect();
    const k = {
      x: +(((e.clientX - r.left) / r.width) * 100).toFixed(2),
      y: +(((e.clientY - r.top) / r.height) * 100).toFixed(2),
      r: Math.round(gsap.utils.random(-30, 30)),
      s: +gsap.utils.random(0.75, 1.25).toFixed(2),
      c: SHADES[state.shade].hex,
    };
    stamp(k, true);
    saved.push(k);
    if (saved.length > 140) saved.shift();
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* storage is optional */ }
    count += 1;
    show();
    gsap.fromTo(countEl, { scale: 1.3 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
    playKiss(gsap.utils.random(0.9, 1.15));
  });

  $('.kiss__clear').addEventListener('click', () => {
    gsap.to(layer.children, { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in', stagger: { each: 0.008, from: 'random' }, onComplete: () => { layer.innerHTML = ''; } });
    saved = [];
    try { localStorage.removeItem(KEY); } catch { /* storage is optional */ }
  });

  gsap.from('.kiss__title', { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: sec, start: 'top 70%' } });
}

/* ---------- reviews ---------- */
function initReviews() {
  let z = 10;
  const cards = $$('.card');
  Draggable.create(cards, {
    type: finePointer ? 'x,y' : 'x',
    allowNativeTouchScrolling: !finePointer,
    bounds: '.reviews',
    inertia: true,
    edgeResistance: 0.75,
    onPress() {
      this.target.style.zIndex = ++z;
      this.target.classList.add('is-drag');
      gsap.to(this.target, { scale: 1.06, duration: 0.25 });
    },
    onRelease() {
      this.target.classList.remove('is-drag');
      gsap.to(this.target, { scale: 1, duration: 0.6, ease: 'back.out(2)' });
    },
  });
  if (!finePointer) $$('.card').forEach((c) => { c.style.touchAction = 'pan-y'; });
  gsap.from(cards, {
    y: 180, opacity: 0, rotation: (i) => (i % 2 ? 20 : -20), duration: 1.2, ease: 'expo.out', stagger: 0.07,
    scrollTrigger: { trigger: '.board', start: 'top 80%' },
  });
}

/* ---------- hero stickers ---------- */
function initStickers() {
  let z = 5;
  Draggable.create('.sticker', {
    type: 'x,y',
    bounds: '.hero',
    inertia: true,
    onPress() {
      this.target.style.zIndex = ++z;
      this.target.classList.add('is-drag');
      gsap.to(this.target, { scale: 1.14, duration: 0.2 });
    },
    onRelease() {
      this.target.classList.remove('is-drag');
      gsap.to(this.target, { scale: 1, duration: 0.7, ease: 'elastic.out(1, .4)' });
    },
  });
}

/* ---------- faq ---------- */
function initFaq() {
  $$('.faq details').forEach((d) => {
    const body = $('div', d);
    $('summary', d).addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { d.open = false; body.style.height = ''; ScrollTrigger.refresh(); } });
      } else {
        d.open = true;
        gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.55, ease: 'power3.out', onComplete: () => { body.style.height = ''; ScrollTrigger.refresh(); } });
      }
    });
  });
}

/* ---------- kit ---------- */
function initKit() {
  const wrap = $('.kit__tubes');
  wrap.innerHTML = SHADES.map((s, i) => `<span class="tube" style="--c:${s.hex};--tilt:${(i - 2) * 8}deg;--ty:${Math.abs(i - 2) * 16}px"><span class="tube__in">${tubeSVG(s.hex)}</span></span>`).join('');
  gsap.from($$('.tube__in', wrap), { yPercent: 70, opacity: 0, duration: 1.2, ease: 'back.out(1.6)', stagger: 0.08, scrollTrigger: { trigger: wrap, start: 'top 80%' } });
  if (finePointer) {
    $$('.tube__in', wrap).forEach((t) => {
      t.addEventListener('pointerenter', () => gsap.to(t, { y: -26, rotate: gsap.utils.random(-8, 8), duration: 0.5, ease: 'back.out(3)' }));
      t.addEventListener('pointerleave', () => gsap.to(t, { y: 0, rotate: 0, duration: 0.6, ease: 'elastic.out(1, .45)' }));
    });
  }
  $('.kit__add').addEventListener('click', (e) => {
    emit('fly', { from: e.currentTarget, color: '#d7ff3b' });
    addToBag(KIT);
    toast('the wink kit is in your bag 😉');
  });
}

/* ---------- footer ---------- */
function initFooter() {
  const mark = $('.footer__mark');
  const letters = $$('span', mark);
  let centers = [];
  const measure = () => {
    letters.forEach((l) => { l.style.fontVariationSettings = ''; });
    centers = letters.map((l) => { const r = l.getBoundingClientRect(); return r.left + r.width / 2; });
  };
  measure();
  window.addEventListener('resize', measure);
  document.fonts.ready.then(measure);
  const vals = letters.map(() => ({ w: 800, s: 100 }));
  let mx = 0;
  let inside = false;
  let visible = false;
  mark.addEventListener('pointermove', (e) => { mx = e.clientX; inside = true; });
  mark.addEventListener('pointerleave', () => { inside = false; });
  ScrollTrigger.create({ trigger: '.footer', start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });
  gsap.ticker.add(() => {
    if (!visible) return;
    letters.forEach((l, i) => {
      const k = 1 - Math.min(Math.abs(mx - centers[i]) / (window.innerWidth * 0.3), 1);
      const tw = inside ? 300 + 600 * k : 800;
      const ts = inside ? 82 + 40 * k : 100;
      vals[i].w += (tw - vals[i].w) * 0.12;
      vals[i].s += (ts - vals[i].s) * 0.12;
      l.style.fontVariationSettings = `"wght" ${vals[i].w.toFixed(0)}, "wdth" ${vals[i].s.toFixed(1)}`;
    });
  });
  gsap.from(letters, { yPercent: 100, duration: 1.2, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: mark, start: 'top 95%' } });

  const form = $('.footer__form');
  const msg = $('.footer__msg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      msg.textContent = 'that email looks a little delulu. try again?';
      gsap.fromTo('.footer__field', { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, .3)' });
      return;
    }
    msg.textContent = "you're on the list. first dibs on every drop 💋";
    form.reset();
  });
}

/* ---------- headings ---------- */
function initReveals() {
  $$('.reviews__title, .faq__title, .kit__title, .bullet__title').forEach((h) => {
    gsap.from(h, { yPercent: 30, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
  });
}

/* ---------- boot ---------- */
async function boot() {
  initLenis();
  initCursor();
  initMagnetic();
  initNav();
  initSound();
  initBag();

  const heroVideo = document.createElement('video');
  heroVideo.muted = true;
  heroVideo.loop = true;
  heroVideo.playsInline = true;
  heroVideo.preload = 'auto';
  heroVideo.setAttribute('muted', '');
  heroVideo.setAttribute('playsinline', '');
  const hero = new Hero($('.hero'), heroVideo);
  gsap.ticker.add((t) => hero.tick(t));
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onUpdate: (s) => { hero.scrollP = s.progress; } });
  ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: (s) => hero.setActive(s.isActive) });

  const shades = initShades($('.shades'));
  initBullet($('.bullet'));
  initTapes();
  initManifesto();
  initKiss();
  initReviews();
  initStickers();
  initFaq();
  initKit();
  initFooter();
  initReveals();
  initNavActive();

  // Preloader: real download progress of the hero video + fonts.
  const num = $('.loader__num');
  const tube = $('.loader__tube');
  const msg = $('.loader__msg');
  const words = ['applying', 'blotting', 'lining', 'almost iconic'];
  const prog = { video: 0, fonts: 0 };
  const shown = { p: 0 };
  const paint = () => {
    num.textContent = Math.round(shown.p * 100);
    tube.style.setProperty('--p', shown.p.toFixed(3));
    msg.firstChild.textContent = words[Math.min(words.length - 1, Math.floor(shown.p * words.length))];
  };
  const update = () => gsap.to(shown, { p: Math.min(1, prog.video * 0.85 + prog.fonts * 0.15), duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: paint });

  const fonts = document.fonts.ready.then(() => { prog.fonts = 1; update(); });
  const [url] = await Promise.all([
    fetchBlob('assets/hero-person.mp4', (p) => { prog.video = p; update(); }),
    fonts,
    wait(1300),
  ]);
  heroVideo.src = url;
  await new Promise((res) => {
    if (heroVideo.readyState >= 2) return res();
    heroVideo.addEventListener('loadeddata', res, { once: true });
    setTimeout(res, 5000);
  });
  hero.layout();
  await new Promise((res) => gsap.to(shown, { p: 1, duration: 0.45, ease: 'power2.out', overwrite: true, onUpdate: paint, onComplete: res }));

  gsap.timeline()
    .to('.loader__inner', { scale: 0.85, opacity: 0, duration: 0.45, ease: 'power3.in' })
    .to('.loader__half--l', { xPercent: -101, duration: 1.15, ease: 'expo.inOut' }, 0.2)
    .to('.loader__half--r', { xPercent: 101, duration: 1.15, ease: 'expo.inOut' }, 0.2)
    .add(() => {
      document.body.classList.remove('is-loading');
      state.lenis?.start();
      hero.intro();
    }, 0.55)
    .set('.loader', { display: 'none' });

  ScrollTrigger.refresh();

  // The shade lab video streams in after the hero is up.
  fetchBlob('assets/shades.mp4').then((u) => {
    shades.setSrc(u);
    const pill = $('.pill-media__video');
    pill.src = u;
    ScrollTrigger.create({ trigger: pill, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? pill.play()?.catch(() => {}) : pill.pause()) });
  });
}

boot();
