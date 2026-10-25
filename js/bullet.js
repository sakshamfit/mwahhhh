// The bullet: a 3D lipstick that uncaps and twists up as you scroll. Drag to spin, tap a swatch to recolour.
import * as THREE from 'three';
import { createLipstick, makeRenderer, addStudio } from './lipstick.js';
import { SHADES, state, on, emit, setShade, addToBag, shadeItem } from './store.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

export function initBullet(section) {
  const stage = section.querySelector('.bullet__stage');
  const canvas = section.querySelector('.bullet__gl');
  const feats = [...section.querySelectorAll('.bullet__feats li')];
  const swWrap = section.querySelector('.bullet__swatches');
  const picked = section.querySelector('.bullet__picked');
  const addBtn = section.querySelector('.bullet__add');

  swWrap.innerHTML = SHADES.map((s, i) => `<button class="swatch" type="button" role="radio" aria-checked="${i === state.shade}" aria-label="${s.name}" data-i="${i}" data-cursor="${s.name.toLowerCase()}" style="--c:${s.hex}"></button>`).join('');
  const swatches = [...swWrap.children];
  feats[0].classList.add('is-on');

  let renderer;
  try {
    renderer = makeRenderer(canvas);
  } catch {
    return;
  }
  const scene = new THREE.Scene();
  addStudio(renderer, scene);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const lip = createLipstick({ shade: SHADES[state.shade].hex, withCap: true });
  scene.add(lip.root);

  let W = 1, H = 1, mobile = false, baseScale = 1;
  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    mobile = W < 760;
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    baseScale = mobile ? 0.78 : Math.min(1, (W / H) * 0.62);
    lip.root.scale.setScalar(baseScale);
  }
  layout();
  window.addEventListener('resize', layout);

  // Scroll choreography
  const P = { cap: 0, extend: 0, tilt: 0, zoom: 0 };
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut', duration: 1 } })
    .to(P, { cap: 1 }, 0.25)
    .to(P, { extend: 1 }, 1.25)
    .to(P, { tilt: 1, zoom: 1 }, 2.25)
    .to({}, { duration: 0.5 });

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${Math.round(window.innerHeight * 2.6)}`,
    pin: stage,
    anticipatePin: 1,
    animation: tl,
    scrub: 0.8,
    onUpdate: (self) => {
      const k = Math.min(feats.length - 1, Math.floor(self.progress * feats.length));
      feats.forEach((f, i) => f.classList.toggle('is-on', i === k));
    },
  });

  let active = false;
  ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: (s) => { active = s.isActive; } });

  // Drag to spin, with inertia
  let spin = -0.5, vel = 0, dragging = false, lastX = 0;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / W) * 2 - 1;
    mouse.y = (e.clientY / H) * 2 - 1;
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    vel = dx * 0.011;
    spin += vel;
  });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  gsap.ticker.add((time) => {
    if (!active) return;
    if (!dragging) {
      vel *= 0.95;
      spin += vel + 0.005;
    }
    mouse.sx += (mouse.x - mouse.sx) * 0.05;
    mouse.sy += (mouse.y - mouse.sy) * 0.05;
    lip.setExtend(P.extend);
    const cap = lip.cap;
    cap.position.set(P.cap * 1.15, lip.capSeat + P.cap * 1.2, P.cap * 0.4);
    cap.rotation.set(P.cap * 0.25, 0, -P.cap * 0.7);
    lip.root.rotation.set(P.tilt * 0.4 + mouse.sy * 0.12, spin + mouse.sx * 0.3, -P.tilt * 0.15);
    lip.root.position.set(-P.cap * 0.3, (mobile ? 0.55 : 0) - P.zoom * 0.35 + Math.sin(time * 1.2) * 0.05, 0);
    cam.position.set(0, 0, 11 - P.zoom * 1.5);
    renderer.render(scene, cam);
  });

  // Shade picking
  function show(i) {
    const s = SHADES[i];
    lip.setShade(s.hex);
    swatches.forEach((b, k) => b.setAttribute('aria-checked', k === i));
    gsap.to(picked, {
      opacity: 0, y: -8, duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        picked.textContent = s.name;
        gsap.to(picked, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
      },
    });
  }
  picked.textContent = SHADES[state.shade].name;
  swWrap.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    const i = +b.dataset.i;
    setShade(i, 'bullet');
    show(i);
    gsap.fromTo(lip.root.scale, { x: baseScale * 0.92, y: baseScale * 1.08 }, { x: baseScale, y: baseScale, duration: 0.9, ease: 'elastic.out(1, .35)', overwrite: true });
    vel += 0.18;
  });
  on('shade', ({ index, source }) => { if (source !== 'bullet') show(index); });

  addBtn.addEventListener('click', () => {
    emit('fly', { from: addBtn, color: SHADES[state.shade].hex });
    addToBag(shadeItem(state.shade));
  });
}
