// Procedural 3D lipstick: lacquer case, gold collar, twist-up sleeve, slant-cut bullet, cap.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SEG = 96;
const MECH_DOWN = 0.93;
const MECH_UP = 1.6;
const CAP_SEAT = 1.555;
export const LIPSTICK_HEIGHT = 3.26;

export function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function addStudio(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
  key.position.set(-4, 6, 6);
  const rim = new THREE.DirectionalLight(0xffa090, 1.5);
  rim.position.set(5, 2, -4);
  const fill = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(key, rim, fill);
}

function lathe(points, segs = SEG) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs);
}

// Round bullet whose top is cut by a slanted plane, with a soft bevel on the cut edge.
function bulletGeometry({ r = 0.355, h = 1.05, slant = 0.5, bevel = 0.06, N = 96, M = 14 } = {}) {
  const pos = [];
  const idx = [];
  const rings = [];
  const yPlane = (x) => h - (slant * (x / r + 1)) / 2;
  const ring = (radius, yAt) => {
    const out = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const x = Math.cos(th) * radius;
      const z = Math.sin(th) * radius;
      out.push(pos.length / 3);
      pos.push(x, yAt(x), z);
    }
    rings.push(out);
  };
  for (let j = 0; j <= M; j++) ring(r, (x) => (j / M) * (yPlane(x) - bevel));
  const B = 5;
  for (let k = 1; k <= B; k++) {
    const a = (k / B) * (Math.PI / 2);
    const rr = r - bevel * (1 - Math.cos(a));
    ring(rr, (x) => yPlane(x) - bevel * (1 - Math.sin(a)));
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < N; i++) {
      const a = rings[j][i], b = rings[j + 1][i], c = rings[j][i + 1], d = rings[j + 1][i + 1];
      idx.push(a, b, c, c, b, d);
    }
  }
  const last = rings[rings.length - 1];
  const center = pos.length / 3;
  pos.push(0, yPlane(0), 0);
  for (let i = 0; i < N; i++) idx.push(center, last[i + 1], last[i]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // weld the seam normals so there's no visible line where the ring closes
  const n = geo.attributes.normal;
  const v = new THREE.Vector3();
  for (const rg of rings) {
    const a = rg[0], b = rg[N];
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  return geo;
}

function logoTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.font = '800 150px Archivo, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('mwah.', 512, 130);
  g.fillText('mwah.', 1536, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createLipstick({ shade = '#8a0b14', withCap = true } = {}) {
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x16030a, roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xe6bd84, roughness: 0.18, metalness: 1, side: THREE.DoubleSide });
  const bulletMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(shade), roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25,
    sheen: 0.18, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x7a2a2a), envMapIntensity: 0.55,
  });

  const root = new THREE.Group();   // pivot at the lipstick's centre
  const body = new THREE.Group();
  body.position.y = -LIPSTICK_HEIGHT / 2;
  root.add(body);

  const base = new THREE.Mesh(lathe([[0, 0], [0.46, 0], [0.495, 0.02], [0.5, 0.05], [0.5, 1.36], [0, 1.36]]), lacquer);
  const collar = new THREE.Mesh(lathe([[0.5, 1.36], [0.506, 1.37], [0.506, 1.53], [0.49, 1.555], [0.43, 1.555], [0.43, 1.2]]), gold);
  body.add(base, collar);

  const mech = new THREE.Group();
  mech.position.y = MECH_DOWN;
  const sleeve = new THREE.Mesh(lathe([[0, 0], [0.42, 0], [0.42, 0.6], [0.41, 0.625], [0.37, 0.625], [0.365, 0.56], [0, 0.56]]), gold);
  const bullet = new THREE.Mesh(bulletGeometry(), bulletMat);
  bullet.position.y = 0.48;
  mech.add(sleeve, bullet);
  body.add(mech);

  let cap = null;
  if (withCap) {
    cap = new THREE.Group();
    cap.position.y = CAP_SEAT;
    const shell = new THREE.Mesh(lathe([[0, 1.62], [0.47, 1.62], [0.47, 0.02], [0.48, 0], [0.505, 0], [0.515, 0.02], [0.515, 1.64], [0.505, 1.69], [0.48, 1.7], [0, 1.7]]), lacquer);
    const band = new THREE.Mesh(lathe([[0.516, 0], [0.521, 0.02], [0.521, 0.12], [0.516, 0.14]]), gold);
    const logo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5172, 0.5172, 0.42, SEG, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0xe6bd84, map: logoTexture(), transparent: true, alphaTest: 0.4, metalness: 1, roughness: 0.25 })
    );
    logo.position.y = 0.95;
    cap.add(shell, band, logo);
    body.add(cap);
  }

  const tmp = new THREE.Color();
  return {
    root, body, mech, cap, bulletMat,
    setExtend(v) {
      mech.position.y = THREE.MathUtils.lerp(MECH_DOWN, MECH_UP, v);
      mech.rotation.y = v * Math.PI * 1.25;
    },
    setShade(hex, duration = 0.7) {
      tmp.set(hex);
      if (!duration || !window.gsap) { bulletMat.color.copy(tmp); return; }
      window.gsap.to(bulletMat.color, { r: tmp.r, g: tmp.g, b: tmp.b, duration, ease: 'power2.out', overwrite: true });
    },
    capSeat: CAP_SEAT,
  };
}
