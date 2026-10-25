// Shared state for the whole site: shades, current shade, bag, sound.

export const SHADES = [
  { id: 'main-character', name: 'Main Character', hex: '#8a0b14', family: 'Cherry red', finish: 'High-shine', line: 'Walks in like the soundtrack just dropped.' },
  { id: 'soft-launch', name: 'Soft Launch', hex: '#c37167', family: 'Rosewood nude', finish: 'Satin', line: 'Your lips, but they finally got eight hours of sleep.' },
  { id: 'delulu', name: 'Delulu', hex: '#cf513f', family: 'Sunset coral', finish: 'Cream', line: 'Makes every plan sound like a really good idea.' },
  { id: 'villain-era', name: 'Villain Era', hex: '#682033', family: 'Midnight plum', finish: 'Velvet matte', line: 'Unbothered. Moisturised. Thriving.' },
  { id: 'no-crumbs', name: 'No Crumbs', hex: '#6c2e22', family: 'Cocoa brown', finish: 'Soft matte', line: 'Ate. Left no crumbs. Never reapplied.' },
];
export const PRICE = 24;
export const KIT = { id: 'kit', name: 'The Wink Kit', hex: 'conic-gradient(#8a0b14 0 20%, #c37167 0 40%, #cf513f 0 60%, #682033 0 80%, #6c2e22 0)', price: 98, note: 'all five shades' };

export const state = {
  shade: 0,
  sound: false,
  bag: [],
  lenis: null,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const listeners = {};
export function on(evt, fn) { (listeners[evt] ||= []).push(fn); }
export function emit(evt, data) { (listeners[evt] || []).forEach((fn) => fn(data)); }

export function setShade(index, source) {
  if (index === state.shade) return;
  state.shade = index;
  document.documentElement.style.setProperty('--shade', SHADES[index].hex);
  emit('shade', { index, source });
}

/* ---------- sound ---------- */
let ctx = null;
let kissBuffer = null;
const beat = new Audio('assets/beat.mp3');
beat.loop = true;
beat.volume = 0.32;

async function loadKiss() {
  if (kissBuffer || !ctx) return;
  try {
    const res = await fetch('assets/mwah.mp3');
    kissBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
  } catch { /* sound is optional */ }
}

export async function toggleSound(force) {
  state.sound = force ?? !state.sound;
  if (state.sound) {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    loadKiss();
    beat.play().catch(() => {});
  } else {
    beat.pause();
  }
  emit('sound', state.sound);
}

export function playKiss(rate = 1) {
  if (!state.sound || !ctx || !kissBuffer) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = kissBuffer;
  src.playbackRate.value = rate;
  gain.gain.value = 0.9;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

/* ---------- bag ---------- */
export function addToBag(item) {
  const found = state.bag.find((b) => b.id === item.id);
  if (found) found.qty += 1;
  else state.bag.push({ ...item, qty: 1 });
  emit('bag', state.bag);
}
export function changeQty(id, delta) {
  const found = state.bag.find((b) => b.id === id);
  if (!found) return;
  found.qty += delta;
  if (found.qty <= 0) state.bag = state.bag.filter((b) => b.id !== id);
  emit('bag', state.bag);
}
export function shadeItem(index) {
  const s = SHADES[index];
  return { id: s.id, name: s.name, hex: s.hex, price: PRICE, note: `${s.family} · ${s.finish}` };
}

/* ---------- shared markup ---------- */
// A lipstick tube drawn in SVG. The mechanism (sleeve + bullet) sits behind the case
// so translating it up "twists" the bullet out.
export function tubeSVG(hex) {
  return `
  <svg viewBox="0 0 60 190" aria-hidden="true">
    <g class="tube__mech">
      <path d="M15 72V24c0-4 2-6.4 6-7.6L44 9.2c2.2-.7 4 .6 4 2.8V72z" fill="${hex}"/>
      <path d="M15 72V24c0-4 2-6.4 6-7.6L44 9.2c2.2-.7 4 .6 4 2.8V72z" fill="url(#g-bullet)"/>
      <path d="M20 66V26c0-2 1-3.4 3-4" stroke="rgba(255,255,255,.5)" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <rect x="12" y="64" width="36" height="26" rx="2" fill="url(#g-gold)"/>
    </g>
    <rect x="8" y="86" width="44" height="102" rx="6" fill="url(#g-case)"/>
    <rect x="8" y="86" width="44" height="9" fill="url(#g-gold)"/>
    <rect x="14" y="104" width="4" height="72" rx="2" fill="rgba(255,255,255,.14)"/>
  </svg>`;
}

export function lipsSVG() {
  return '<svg viewBox="0 0 200 120" aria-hidden="true"><use href="#lips"/></svg>';
}
