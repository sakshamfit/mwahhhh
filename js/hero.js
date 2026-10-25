// Hero: cut-out model video (stacked colour/alpha), split backdrop that flips when she winks,
// AR-style eye tracking, kiss-print bursts and a 3D lipstick rising behind her.
import * as THREE from 'three';
import { HERO_TRACK } from './data.js';
import { createLipstick, makeRenderer, addStudio, LIPSTICK_HEIGHT } from './lipstick.js';
import { SHADES, playKiss, lipsSVG } from './store.js';

const gsap = window.gsap;

// Geometry of assets/hero-person.mp4: a 1440px-wide crop (from x=240) of the 1920x1080 source,
// colour on top and alpha matte underneath. The backdrop split in the source sits at x=953.
const SRC = { h: 1080, cropX: 240, cropW: 1440, split: 953, fps: 24 };

// Moments in the 8s loop, found frame-by-frame in the source video.
const EVENTS = [
  { t: 0.05, type: 'wink', eye: 'L' }, // screen-left eye closes  -> classic (cream | wine)
  { t: 0.84, type: 'wink', eye: 'R' }, // screen-right eye closes -> flipped (wine | cream)
  { t: 4.93, type: 'kiss' },           // lip "pop" heard in the audio
];

const STAMP_ON_CREAM = '#a3101d';
const STAMP_ON_WINE = '#f6efdf';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Top half of the texture is premultiplied colour, bottom half is alpha.
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uGlitch;
  uniform float uTime;
  varying vec2 vUv;

  vec4 person(vec2 uv) {
    uv = clamp(uv, vec2(0.001), vec2(0.999));
    vec3 c = texture2D(uMap, vec2(uv.x, 0.5 + uv.y * 0.5)).rgb;
    float a = texture2D(uMap, vec2(uv.x, uv.y * 0.5)).g;
    return vec4(c, a);
  }

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    float band = floor(uv.y * 36.0 + floor(uTime * 24.0) * 7.0);
    uv.x += (hash(band) - 0.5) * 0.035 * uGlitch * step(0.55, hash(band + 3.0));
    vec4 p = person(uv);
    float off = 0.007 * uGlitch;
    float r = person(uv + vec2(off, 0.0)).r;
    float b = person(uv - vec2(off, 0.0)).b;
    vec3 col = vec3(r, p.g, b);
    float a = smoothstep(0.03, 0.97, p.a);
    col *= a / max(p.a, 0.001);
    col = min(col, vec3(a));
    gl_FragColor = vec4(col, a) * uOpacity;
  }
`;

export class Hero {
  constructor(el, video) {
    this.el = el;
    this.video = video;
    this.base = el.querySelector('[data-layer="base"]');
    this.next = el.querySelector('[data-layer="next"]');
    this.fx = el.querySelector('.hero__fx');
    this.poster = el.querySelector('.hero__poster');

    this.mode = 'classic';
    this.lastT = 0;
    this.active = true;
    this.started = false;
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    this.scrollP = 0;
    this.anim = { person: 0, lip: 0, cap: 0, spin: 0, glitch: 0 };
    this.pts = { L: [0, 0], R: [0, 0], M: [0, 0] };

    this.cloneContent();
    this.initGL();
    this.layout();
    this.bind();
  }

  // The giant word + copy live in each of the four half-layers so each half can colour them.
  cloneContent() {
    const src = this.base.querySelector('.hero__half--l .hero__content');
    src.querySelectorAll('.ch').forEach((c, i) => { c.dataset.i = i; });
    const halves = [this.base.querySelector('.hero__half--r'), ...this.next.querySelectorAll('.hero__half')];
    halves.forEach((half) => {
      const copy = src.cloneNode(true);
      const h1 = copy.querySelector('h1');
      const div = document.createElement('div');
      div.className = h1.className;
      div.innerHTML = h1.innerHTML;
      h1.replaceWith(div);
      half.appendChild(copy);
    });
    this.contents = [...this.el.querySelectorAll('.hero__content')];
    this.words = [...this.el.querySelectorAll('.hero__word')];
    this.chars = [...this.el.querySelectorAll('.hero__word .ch')];
  }

  initGL() {
    const canvas = this.el.querySelector('.hero__gl');
    try {
      this.renderer = makeRenderer(canvas);
    } catch {
      this.renderer = null;
      this.el.classList.add('no-gl');
      return;
    }
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    addStudio(this.renderer, this.scene);
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    this.cam.position.set(0, 0, 14);

    this.lip = createLipstick({ shade: SHADES[0].hex, withCap: true });
    this.lip.setExtend(1);
    // The cap floats on its own on the other side of her head.
    const cap = this.lip.cap;
    cap.parent.remove(cap);
    cap.position.set(0, -0.85, 0);
    this.capPivot = new THREE.Group();
    this.capPivot.add(cap);
    this.scene.add(this.lip.root, this.capPivot);

    this.overlay = new THREE.Scene();
    this.ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    this.tex = new THREE.VideoTexture(this.video);
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.tex }, uOpacity: { value: 0 }, uGlitch: { value: 0 }, uTime: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.overlay.add(this.quad);
  }

  layout() {
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    const mobile = W < 760;
    this.W = W; this.H = H; this.mobile = mobile;

    let s = (H * 0.9) / SRC.h;
    s = mobile ? Math.min(s, (W * 1.6) / SRC.cropW) : Math.min(s, (W * 1.02) / SRC.cropW);
    this.s = s;
    this.splitX = Math.round(W / 2);
    this.qw = SRC.cropW * s;
    this.qh = SRC.h * s;
    this.qLeft = this.splitX - (SRC.split - SRC.cropX) * s;
    this.qTop = H - this.qh;
    this.el.style.setProperty('--split', `${this.splitX}px`);

    // Fit LIPSTICK edge to edge, and sit it at eye level so her head covers the middle letters.
    this.el.style.setProperty('--word-size', '100px');
    const parts = [...this.words[0].querySelectorAll('.w')].map((w) => w.getBoundingClientRect().width);
    const textW = mobile ? Math.max(...parts) : parts.reduce((a, b) => a + b, 0);
    const gutter = Math.min(36, Math.max(16, W * 0.022));
    const size = (100 * (W - gutter * (mobile ? 2 : 1.2))) / Math.max(textW, 1);
    this.el.style.setProperty('--word-size', `${size.toFixed(2)}px`);
    // Desktop: eye level, like the reference. Mobile: stacked above her head, tucked behind the hair.
    const wordCenter = mobile ? this.qTop + 90 * s - size * 0.8 * 2 * 0.36 : this.qTop + 460 * s;
    this.el.style.setProperty('--word-top', `${wordCenter.toFixed(1)}px`);

    if (this.poster) {
      Object.assign(this.poster.style, { width: `${this.qw}px`, height: `${this.qh}px`, transform: `translate(${this.qLeft}px, ${this.qTop}px)` });
    }

    if (!this.renderer) return;
    this.renderer.setSize(W, H, false);
    this.cam.aspect = W / H;
    this.cam.updateProjectionMatrix();
    Object.assign(this.ortho, { left: 0, right: W, top: H, bottom: 0 });
    this.ortho.updateProjectionMatrix();
    this.quad.scale.set(this.qw, this.qh, 1);

    this.wpp = (2 * this.cam.position.z * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2))) / H;
    const lipPx = mobile ? H * 0.3 : Math.min(H * 0.52, 600 * s);
    this.lip.root.scale.setScalar((lipPx * this.wpp) / LIPSTICK_HEIGHT);
    this.capPivot.scale.setScalar((lipPx * 0.85 * this.wpp) / LIPSTICK_HEIGHT);
    this.lipHome = this.toWorld(mobile ? W * 0.84 : this.splitX + 540 * s, mobile ? this.qTop + 320 * s : this.qTop + 640 * s);
    this.capHome = this.toWorld(mobile ? W * 0.15 : this.splitX - 580 * s, mobile ? this.qTop + 60 * s : this.qTop + 230 * s);
  }

  toWorld(x, y) {
    return new THREE.Vector3((x - this.W / 2) * this.wpp, (this.H / 2 - y) * this.wpp, 0);
  }

  bind() {
    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.layout());
    });
    this.el.addEventListener('pointermove', (e) => {
      const r = this.el.getBoundingClientRect();
      const x = e.clientX - r.left;
      this.mouse.x = (x / r.width) * 2 - 1;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.el.dataset.cursor = x < this.splitX ? '← classic' : 'flipped →';
    });
    this.el.addEventListener('pointerleave', () => { this.mouse.x = 0; this.mouse.y = 0; });
    // Tap a side to "wink back": left = classic, right = flipped.
    this.el.addEventListener('click', (e) => {
      if (!this.started || e.target.closest('a, button, .sticker')) return;
      const r = this.el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      this.glitch();
      this.setMode(x < this.splitX ? 'classic' : 'flipped', x, y);
    });
  }

  intro() {
    this.started = true;
    this.lastT = 0;
    this.video.currentTime = 0;
    this.video.play()?.catch(() => {});
    const ui = this.el.querySelectorAll('.hero__cta, .hero__note, .spin-badge, .sticker');
    gsap.timeline()
      .fromTo(this.chars, { yPercent: 80, opacity: 0, rotate: 8 },
        { yPercent: 0, opacity: 1, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: (i, el) => +el.dataset.i * 0.055 }, 0)
      .to(this.anim, { person: 1, duration: 1.2, ease: 'power2.out' }, 0.1)
      .to(this.anim, { lip: 1, duration: 2, ease: 'expo.out' }, 0.5)
      .to(this.anim, { cap: 1, duration: 2, ease: 'expo.out' }, 0.75)
      .from(this.el.querySelectorAll('.hero__copy'), { y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06 }, 0.7)
      .from(ui, { y: 30, opacity: 0, scale: 0.7, duration: 0.9, ease: 'back.out(2)', stagger: 0.07 }, 0.9);
  }

  setActive(on) {
    this.active = on;
    if (!this.started) return;
    if (on) this.video.play()?.catch(() => {});
    else this.video.pause();
  }

  tick(time) {
    if (!this.active) return;
    const t = this.video.currentTime || 0;
    if (this.started) this.checkEvents(t);

    const m = this.mouse;
    m.sx += (m.x - m.sx) * 0.06;
    m.sy += (m.y - m.sy) * 0.06;
    const px = m.sx * -10;
    const py = m.sy * -6 + this.scrollP * this.H * 0.12;

    const f = Math.min(HERO_TRACK.length - 1, Math.max(0, Math.round(t * SRC.fps)));
    this.track(f, px, py);

    const cx = m.sx * 14;
    const cy = m.sy * 9 - this.scrollP * this.H * 0.3;
    for (const c of this.contents) c.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;

    if (!this.renderer) return;
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uGlitch.value = this.anim.glitch;
    u.uOpacity.value = this.anim.person;
    this.quad.position.set(this.qLeft + this.qw / 2 + px, this.qh / 2 - py - (1 - this.anim.person) * 40, 0);

    const k = this.anim.lip;
    const L = this.lip.root;
    L.position.set(
      this.lipHome.x + m.sx * 0.25,
      this.lipHome.y - (1 - k) * 8 + this.scrollP * 5 + Math.sin(time * 1.1) * 0.06,
      -0.5
    );
    L.rotation.set(0.08 + m.sy * 0.15, time * 0.45 + this.anim.spin + m.sx * 0.4, -0.28 + m.sx * 0.06 - this.scrollP * 0.8);

    const kc = this.anim.cap;
    const C = this.capPivot;
    C.position.set(
      this.capHome.x - (1 - kc) * 7 + m.sx * 0.35,
      this.capHome.y + (1 - kc) * 3 + this.scrollP * 6 + Math.sin(time * 1.3 + 1) * 0.1,
      -1
    );
    C.rotation.set(0.4 + m.sy * 0.2, -time * 0.5 - this.anim.spin * 0.6, 0.5 + Math.sin(time * 0.8) * 0.08);

    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.cam);
    r.clearDepth();
    r.render(this.overlay, this.ortho);
  }

  // Screen positions of her eyes and lips this frame: where the flip wipe and kiss burst start.
  track(f, px, py) {
    const tr = HERO_TRACK[f];
    const s = this.s;
    const map = (x, y) => [this.qLeft + (x - SRC.cropX) * s + px, this.qTop + y * s + py];
    this.pts.L = map(tr[0], tr[1]);
    this.pts.R = map(tr[2], tr[3]);
    this.pts.M = map(tr[4], tr[5]);
  }

  checkEvents(t) {
    const last = this.lastT;
    if (t !== last) {
      for (const e of EVENTS) {
        const crossed = t >= last ? e.t > last && e.t <= t : e.t > last || e.t <= t;
        if (crossed) this.fire(e);
      }
    }
    this.lastT = t;
  }

  fire(e) {
    if (e.type === 'wink') this.wink(e.eye);
    else this.kiss();
  }

  glitch() {
    gsap.fromTo(this.anim, { glitch: 1 }, { glitch: 0, duration: 0.55, ease: 'power2.out', overwrite: 'auto' });
  }

  wink(eye) {
    const [x, y] = this.pts[eye];
    this.glitch();
    gsap.to(this.anim, { spin: `+=${Math.PI * 2}`, duration: 1.6, ease: 'expo.out' });
    this.setMode(eye === 'L' ? 'classic' : 'flipped', x, y);
  }

  setMode(mode, x, y) {
    this.ring(x, y);
    if (mode === this.mode) return;
    this.mode = mode;
    this.flip?.progress(1);
    this.next.dataset.mode = mode;
    this.next.style.setProperty('--cx', `${x}px`);
    this.next.style.setProperty('--cy', `${y}px`);
    const R = Math.hypot(Math.max(x, this.W - x), Math.max(y, this.H - y)) + 30;
    this.flip = gsap.fromTo(this.next, { '--r': '0px' }, {
      '--r': `${R}px`, duration: 0.95, ease: 'power3.inOut',
      onComplete: () => {
        this.base.dataset.mode = mode;
        gsap.set(this.next, { '--r': '0px' });
        this.flip = null;
      },
    });
    this.el.dataset.mode = mode;
  }

  ring(x, y) {
    const ring = document.createElement('div');
    ring.className = 'wipe-ring';
    this.fx.appendChild(ring);
    gsap.fromTo(ring, { x, y, scale: 0.4, opacity: 1 }, { scale: 9, opacity: 0, duration: 0.9, ease: 'expo.out', onComplete: () => ring.remove() });
  }

  kiss() {
    const [x, y] = this.pts.M;
    playKiss();
    const n = this.mobile ? 5 : 8;
    const reach = Math.min(this.W, this.H * 1.3);
    for (let i = 0; i < n; i++) {
      const ang = ((-90 + gsap.utils.random(-80, 80)) * Math.PI) / 180;
      const d = gsap.utils.random(0.2, 0.46) * reach;
      const tx = x + Math.cos(ang) * d * 1.5;
      const ty = y + Math.sin(ang) * d;
      const leftSide = tx < this.splitX;
      const onCream = (this.mode === 'classic') === leftSide;
      const st = document.createElement('div');
      st.className = 'stamp';
      st.innerHTML = lipsSVG();
      st.style.color = onCream ? STAMP_ON_CREAM : STAMP_ON_WINE;
      this.fx.appendChild(st);
      const sc = gsap.utils.random(0.55, 1.15) * (this.mobile ? 0.6 : 1);
      gsap.timeline({ onComplete: () => st.remove() })
        .fromTo(st, { x, y, scale: 0.1, rotation: gsap.utils.random(-40, 40), opacity: 0 },
          { x: tx, y: ty, scale: sc, rotation: gsap.utils.random(-25, 25), opacity: 1, duration: 0.9, ease: 'expo.out', delay: i * 0.035 })
        .to(st, { opacity: 0, y: '+=40', duration: 0.7, ease: 'power2.in' }, '+=1.5');
    }
    const pop = document.createElement('div');
    pop.className = 'mwah-pop';
    pop.textContent = 'mwah!';
    this.fx.appendChild(pop);
    gsap.timeline({ onComplete: () => pop.remove() })
      .fromTo(pop, { x: x + 90 * this.s, y: y - 40 * this.s, yPercent: -100, scale: 0, rotation: -14, transformOrigin: '0% 100%' },
        { scale: this.mobile ? 0.7 : 1, rotation: -5, duration: 0.6, ease: 'back.out(2.6)' })
      .to(pop, { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in' }, '+=1.2');
  }
}
