// Shade lab: the lip-swap video is scrubbed by scroll; tapping a lipstick scrolls to its shade.
// The backdrop colour around the video follows the colour sampled from each frame.
import { SHADE_BG } from './data.js';
import { SHADES, state, setShade, addToBag, shadeItem, emit, tubeSVG } from './store.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

// Time windows (seconds) where each shade is fully on the lips in assets/shades.mp4.
const HOLDS = [[0.3, 1.3], [2.25, 3.0], [3.78, 4.28], [5.1, 5.95], [6.72, 7.85]];
const SEGS = [];
HOLDS.forEach((h, i) => {
  SEGS.push({ hold: true, i, t0: h[0], t1: h[1] });
  if (i < HOLDS.length - 1) SEGS.push({ hold: false, i, t0: h[1], t1: HOLDS[i + 1][0] });
});

function timeAt(p) {
  const x = Math.min(0.99999, Math.max(0, p)) * SEGS.length;
  const k = Math.floor(x);
  const s = SEGS[k];
  return s.t0 + (s.t1 - s.t0) * (x - k);
}
// Which shade is on the lips at video time t (switches halfway through each morph).
function shadeAt(t) {
  for (let i = 0; i < HOLDS.length - 1; i++) {
    if (t < (HOLDS[i][1] + HOLDS[i + 1][0]) / 2) return i;
  }
  return HOLDS.length - 1;
}
const holdCenter = (i) => (2 * i + 0.5) / SEGS.length;

const luminance = (hex) => {
  const n = parseInt(hex, 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};
const splitChars = (text) => [...text].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');

export function initShades(section) {
  const stage = section.querySelector('.shades__stage');
  const video = section.querySelector('.shades__video');
  const rail = section.querySelector('.rail');
  const nameInner = section.querySelector('.shades__name-inner');
  const numEl = section.querySelector('.shades__num');
  const famEl = section.querySelector('.shades__family');
  const lineEl = section.querySelector('.shades__line');
  const hexEl = section.querySelector('.shades__hex');
  const progEl = section.querySelector('.shades__progress');
  const addBtn = section.querySelector('.shades__add');

  rail.innerHTML = SHADES.map((s, i) => `
    <button class="tube${i === 0 ? ' is-active' : ''}" type="button" role="tab" aria-selected="${i === 0}" aria-label="${s.name}"
      data-i="${i}" data-cursor="${s.name.toLowerCase()}" style="--c:${s.hex}">
      <span class="tube__in">${tubeSVG(s.hex)}</span><span class="tube__name">${s.name}</span>
    </button>`).join('');
  const tubes = [...rail.children];
  gsap.set(rail.querySelectorAll('.tube__in'), { yPercent: 140 });

  let target = HOLDS[0][0];
  let cur = target;
  let idx = 0;
  let lastFrame = -1;
  let ready = false;
  let nameTl = null;

  nameInner.innerHTML = splitChars(SHADES[0].name);

  function paint(code) {
    const L = code.slice(0, 6);
    const R = code.slice(6);
    stage.style.setProperty('--bgL', `#${L}`);
    stage.style.setProperty('--bgR', `#${R}`);
    const light = luminance(L) > 140;
    stage.style.setProperty('--sh-ink', light ? '#2a0a0e' : '#f6efdf');
    stage.style.setProperty('--sh-sub', light ? 'rgba(42,10,14,.62)' : 'rgba(246,239,223,.72)');
  }

  function setIdx(i) {
    if (i === idx) return;
    const dir = i > idx ? 1 : -1;
    idx = i;
    const s = SHADES[i];
    nameTl?.kill();
    const old = nameInner.querySelectorAll('.ch');
    gsap.killTweensOf(old);
    nameTl = gsap.timeline()
      .to(old, { yPercent: -115 * dir, opacity: 0, duration: 0.3, ease: 'power3.in', stagger: 0.012 })
      .add(() => {
        nameInner.innerHTML = splitChars(s.name);
        gsap.fromTo(nameInner.querySelectorAll('.ch'), { yPercent: 115 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out', stagger: 0.022 });
      });
    numEl.textContent = String(i + 1).padStart(2, '0');
    famEl.textContent = `${s.family} · ${s.finish}`;
    hexEl.textContent = s.hex.toUpperCase();
    lineEl.textContent = s.line;
    gsap.fromTo([lineEl, famEl], { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.05, overwrite: true });
    tubes.forEach((t, k) => {
      t.classList.toggle('is-active', k === i);
      t.setAttribute('aria-selected', k === i);
    });
    setShade(i, 'lab');
  }

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${Math.round(window.innerHeight * SEGS.length * 0.6)}`,
    pin: stage,
    anticipatePin: 1,
    onUpdate: (self) => {
      target = timeAt(self.progress);
      progEl.style.setProperty('--p', self.progress.toFixed(4));
    },
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => gsap.fromTo(rail.querySelectorAll('.tube__in'),
      { rotate: (k) => (k % 2 ? 12 : -12) },
      { yPercent: 0, rotate: 0, duration: 1.3, ease: 'back.out(1.4)', stagger: 0.09 }),
  });

  gsap.ticker.add(() => {
    if (!st.isActive && Math.abs(target - cur) < 0.002) return;
    cur += (target - cur) * 0.14;
    if (ready && !video.seeking && Math.abs(video.currentTime - cur) > 0.02) video.currentTime = cur;
    setIdx(shadeAt(cur));
    const f = Math.min(SHADE_BG.length - 1, Math.max(0, Math.round(cur * 24)));
    if (f !== lastFrame) {
      lastFrame = f;
      paint(SHADE_BG[f]);
    }
  });

  rail.addEventListener('click', (e) => {
    const b = e.target.closest('.tube');
    if (!b) return;
    const y = st.start + (st.end - st.start) * holdCenter(+b.dataset.i);
    if (state.lenis) state.lenis.scrollTo(y, { duration: 1.5 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  });

  addBtn.addEventListener('click', () => {
    emit('fly', { from: addBtn, color: SHADES[idx].hex });
    addToBag(shadeItem(idx));
  });

  paint(SHADE_BG[Math.round(cur * 24)]);

  return {
    setSrc(url) {
      video.addEventListener('loadeddata', () => {
        ready = true;
        // iOS only paints seeked frames after the video has played once
        video.play()?.then(() => { video.pause(); video.currentTime = cur; }).catch(() => { video.currentTime = cur; });
      }, { once: true });
      video.src = url;
    },
  };
}
