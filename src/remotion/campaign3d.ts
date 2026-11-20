// @ts-nocheck
/**
 * Slotolog Bonus Emojileri — gerçek 3D (three.js) kampanya emojileri ve yazılı başlık şeritleri.
 * Tek bir paylaşılan WebGL renderer ile kare kare çizilir; Remotion katmanı sonucu kendi 2D tuvaline kopyalar.
 * p = döngü konumu 0..1 (ilk kare = son kare → kesintisiz döngü). Slot makarası / aşağı kayma yok.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';
import interBlackUrl from '../assets/Inter-Black.ttf?url';

const ORANGE = 0xff8e16, DARK = 0x1e1e1e, WHITE = 0xffffff;
const TAU = Math.PI * 2;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeOutBack = (t) => { t = Math.min(1, Math.max(0, t)); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

let renderer = null;
let envTex = null;
function gl() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}
let SHINE = 1;

const mat = {
  orange: () => new THREE.MeshPhysicalMaterial({ color: 0xf47c00, roughness: 0.34, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.55 }),
  orangeLight: () => new THREE.MeshPhysicalMaterial({ color: 0xff9a2a, roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.55 }),
  dark: () => new THREE.MeshPhysicalMaterial({ color: 0x232323, roughness: 0.25, metalness: 0.65, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }),
  white: () => new THREE.MeshPhysicalMaterial({ color: 0xf6f6f6, roughness: 0.3, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.12, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.6 }),
  gold: () => new THREE.MeshPhysicalMaterial({ color: 0xffb04a, roughness: 0.22, metalness: 0.85, clearcoat: 0.6, envMapIntensity: 1.4 }),
  glow: (c = 0xffffff, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending }),
};

function baseScene(camZ = 6.2, fov = 30) {
  const scene = new THREE.Scene();
  gl(); scene.environment = envTex;
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 50);
  cam.position.set(0, 1.6, camZ);
  cam.lookAt(0, 0.25, 0);
  const key = new THREE.DirectionalLight(0xfff3e6, 1.5);
  key.position.set(-2, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9a30, 1.3);
  rim.position.set(3, 2, -4);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return { scene, cam, key, rim, ground };
}
function glowSprite(color = 0xffb35a) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,220,170,.8)'); g.addColorStop(1, 'rgba(255,142,22,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
/** premium glint: thin 4-point flare with a white core and orange rays (normal blending → visible on light and dark themes) */
function sparkleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.translate(128, 128);
  const ray = (len, w, rot) => { x.save(); x.rotate(rot); const g = x.createLinearGradient(0, 0, len, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,190,110,.95)'); g.addColorStop(1, 'rgba(255,142,22,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, -w); x.lineTo(len, 0); x.lineTo(0, w); x.closePath(); x.fill(); x.restore(); };
  for (let i = 0; i < 4; i++) ray(124, 9, (i * Math.PI) / 2);
  for (let i = 0; i < 4; i++) ray(58, 5, (i * Math.PI) / 2 + Math.PI / 4);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 40); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,214,160,.9)'); g.addColorStop(1, 'rgba(255,142,22,0)');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 40, 0, TAU); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let _spTex = null;
function sparkleSprite() { _spTex ??= sparkleTexture(); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _spTex, transparent: true, depthWrite: false, depthTest: false })); s.renderOrder = 10; return s; }
function starShape(R = 1, r = 0.45, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n + Math.PI / 2; const rr = i % 2 ? r : R; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
}
function star3D(R, material, n = 5, inner = 0.45) {
  const g = new THREE.ExtrudeGeometry(starShape(R, R * inner, n), { depth: R * 0.18, bevelEnabled: true, bevelThickness: R * 0.18, bevelSize: R * 0.1, bevelSegments: 4 });
  g.center(); const m = new THREE.Mesh(g, material); m.castShadow = true; return m;
}
function coinTexture(sym) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(100, 90, 10, 128, 128, 128); g.addColorStop(0, '#FFD39A'); g.addColorStop(0.6, '#FF9A2A'); g.addColorStop(1, '#D96E00');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(30,30,30,.55)'; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, 104, 0, TAU); x.stroke();
  x.font = '900 150px InterB'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = 16; x.strokeStyle = '#1E1E1E'; x.strokeText(sym, 128, 136); x.fillStyle = '#FFFFFF'; x.fillText(sym, 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function coin3D(sym, r = 0.36) {
  if (interFont) {
    const grp = new THREE.Group();
    const side = new THREE.MeshPhysicalMaterial({ color: 0xe57a06, roughness: 0.25, metalness: 0.55, clearcoat: 1 });
    const face = new THREE.MeshPhysicalMaterial({ color: 0xf47c00, roughness: 0.28, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.26, 64), [side, face, face]); body.rotation.x = Math.PI / 2; body.castShadow = true; grp.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.82, r * 0.05, 12, 64), mat.dark()); ring.position.z = r * 0.13; grp.add(ring);
    const tg = new TextGeometry(sym, { font: interFont, size: r * 0.95, depth: r * 0.12, bevelEnabled: true, bevelThickness: r * 0.04, bevelSize: r * 0.02, bevelSegments: 3, curveSegments: 8 }); tg.center();
    const t = new THREE.Mesh(tg, mat.white()); t.position.z = r * 0.17; grp.add(t);
    return grp;
  }
  const face = new THREE.MeshPhysicalMaterial({ map: coinTexture(sym), roughness: 0.25, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
  const side = new THREE.MeshPhysicalMaterial({ color: 0xe57a06, roughness: 0.25, metalness: 0.6, clearcoat: 1 });
  const g = new THREE.CylinderGeometry(r, r, r * 0.22, 48);
  const m = new THREE.Mesh(g, [side, face, face]); m.rotation.x = Math.PI / 2; m.castShadow = true;
  const grp = new THREE.Group(); grp.add(m); return grp;
}

// ================= HOŞ GELDİN — 3D hediye kutusu =================
function buildGift() {
  const S = baseScene(6.6, 30);
  const root = new THREE.Group(); S.scene.add(root);
  const box = new THREE.Group(); root.add(box);
  const W = 1.7, H = 1.25;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, W, 6, 0.1), mat.orange()); body.position.y = H / 2; body.castShadow = true; box.add(body);
  // dark grey base trim
  const trim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.06, 0.16, W + 0.06, 4, 0.06), mat.dark()); trim.position.y = 0.08; box.add(trim);
  // white ribbons on the body
  const rib1 = new THREE.Mesh(new RoundedBoxGeometry(0.34, H + 0.02, W + 0.04, 4, 0.05), mat.white()); rib1.position.y = H / 2; box.add(rib1);
  const rib2 = new THREE.Mesh(new RoundedBoxGeometry(W + 0.04, H + 0.02, 0.34, 4, 0.05), mat.white()); rib2.position.y = H / 2; box.add(rib2);
  // inner glow (visible when the lid is up)
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, W * 0.92), mat.glow(0xffc27a, 0)); inner.rotation.x = -Math.PI / 2; inner.position.y = H + 0.012; box.add(inner);
  // lid, hinged at the back edge
  const hinge = new THREE.Group(); hinge.position.set(0, H, -W / 2 - 0.05); box.add(hinge);
  const lid = new THREE.Group(); lid.position.set(0, 0, W / 2 + 0.05); hinge.add(lid);
  const LW = W + 0.16, LH = 0.36;
  const lidM = new THREE.Mesh(new RoundedBoxGeometry(LW, LH, LW, 6, 0.1), mat.orangeLight()); lidM.position.y = LH / 2; lidM.castShadow = true; lid.add(lidM);
  const lidTrim = new THREE.Mesh(new RoundedBoxGeometry(LW + 0.04, 0.08, LW + 0.04, 3, 0.03), mat.dark()); lidTrim.position.y = 0.04; lid.add(lidTrim);
  const lr1 = new THREE.Mesh(new RoundedBoxGeometry(0.36, LH + 0.03, LW + 0.03, 4, 0.05), mat.white()); lr1.position.y = LH / 2; lid.add(lr1);
  const lr2 = new THREE.Mesh(new RoundedBoxGeometry(LW + 0.03, LH + 0.03, 0.36, 4, 0.05), mat.white()); lr2.position.y = LH / 2; lid.add(lr2);
  // bow: two puffy loops + knot
  const bow = new THREE.Group(); bow.position.y = LH + 0.02; bow.rotation.y = 0.55; lid.add(bow);
  for (const d of [-1, 1]) {
    // solid ribbon lobes (read clearly at 100 px — no holes)
    const loop = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 28), mat.white());
    loop.scale.set(1.3, 0.78, 0.62); loop.position.set(d * 0.32, 0.3, 0); loop.rotation.set(0, 0, d * -0.62); loop.castShadow = true; bow.add(loop);

    const tail = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.06, 0.55, 3, 0.03), mat.white()); tail.position.set(d * 0.22, 0.04, 0.3); tail.rotation.y = d * 0.5; bow.add(tail);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 24), mat.white()); knot.scale.set(1, 0.95, 1); knot.position.set(0, 0.2, 0.08); bow.add(knot);
  // rising bonus symbols
  const fx = new THREE.Group(); root.add(fx);
  const coin = coin3D('₺', 0.36); fx.add(coin);
  // a few refined glints instead of chunky stars
  const glints = [[-0.62, 0.95, 0.5, 0.0, 0.62], [0.7, 0.75, 0.55, 0.12, 0.5], [0.15, 1.6, 0.5, 0.24, 0.44]].map(([gx, gy, gz, ph, sz]) => { const g = sparkleSprite(); fx.add(g); return { g, gx, gy, gz, ph, sz }; });
  const flash = glowSprite(); flash.scale.set(0.1, 0.1, 1); fx.add(flash);
  const rays = new THREE.Group(); root.add(rays);
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.4), mat.glow(0xffd29a, 0)); r.geometry.translate(0, 1.2, 0);
    r.rotation.z = (i - 4) * 0.2; r.position.set(0, H + 0.05, 0.2); rays.add(r);
  }
  root.rotation.y = -0.55;
  S.cam.position.set(0, 2.5, 7.0); S.cam.lookAt(0, 1.4, 0);
  const update = (p) => {
    // timeline (3 s): idle sway · anticipation squash · lid pops open + burst + symbols rise · lid settles back
    const sway = Math.sin(p * TAU) * 0.07;
    root.rotation.y = -0.55 + sway;
    const anti = p > 0.14 && p < 0.24 ? Math.sin(((p - 0.14) / 0.1) * Math.PI) : 0;
    box.scale.set(1 + 0.04 * anti, 1 - 0.06 * anti, 1 + 0.04 * anti);
    const open = p < 0.22 ? 0 : p < 0.34 ? easeOutBack((p - 0.22) / 0.12) : p < 0.62 ? 1 : p < 0.78 ? 1 - ease((p - 0.62) / 0.16) : 0;
    const settle = p > 0.78 && p < 0.88 ? Math.sin(((p - 0.78) / 0.1) * Math.PI) * 0.05 : 0;
    // lid pops up and tips backwards (away from the camera) so the rising symbols stay in view
    hinge.rotation.x = 0.42 * open - settle;
    hinge.rotation.z = 0.1 * open;
    hinge.position.y = H + 0.75 * Math.max(0, open);
    hinge.position.z = -W / 2 - 0.05 - 0.55 * Math.max(0, open);
    inner.material.opacity = 0.9 * Math.min(1, Math.max(0, open));
    const burst = p > 0.24 && p < 0.5 ? Math.sin(((p - 0.24) / 0.26) * Math.PI) : 0;
    flash.position.set(0, H + 0.4, 0.2); const fs = 0.4 + 3.0 * burst; flash.scale.set(fs, fs, 1); flash.material.opacity = burst;
    rays.children.forEach((r, i) => { r.material.opacity = 0.12 * Math.min(1, Math.max(0, open)) * (0.6 + 0.4 * Math.sin(p * TAU * 3 + i)); r.scale.y = 0.6 + 0.6 * Math.min(1, Math.max(0, open)); });
    // symbols: rise out of the box, hover, sink back before the lid closes
    const rise = p < 0.26 ? 0 : p < 0.42 ? easeOutBack((p - 0.26) / 0.16) : p < 0.6 ? 1 : p < 0.7 ? 1 - ease((p - 0.6) / 0.1) : 0;
    const vis = rise > 0.02;
    coin.visible = vis;
    coin.position.set(0.1, H + 0.25 + 0.95 * rise, 0.6); coin.rotation.y = 0.55 + 0.35 * Math.sin(((p - 0.26) / 0.44) * Math.PI); coin.scale.setScalar(0.5 + 0.5 * rise);
    glints.forEach(({ g, gx, gy, gz, ph, sz }) => { const t = (p - 0.3 - ph * 0.5) / 0.3; const k = t > 0 && t < 1 ? Math.sin(t * Math.PI) : 0; g.position.set(gx, H + gy, gz); g.scale.set(sz * 2.2 * k, sz * 2.2 * k, 1); g.material.opacity = k; g.material.rotation = t * 0.6; });
  };
  return { ...S, update };
}

// ================= %50 GECE — 3D hilal =================
let interFont = null;
function crescentShape(R = 1) {
  const c2x = R * 0.62, c2y = R * 0.32, r2 = R * 0.86; // cut-out circle (y up)
  const dx = c2x, dy = c2y, d = Math.hypot(dx, dy), a = (R * R - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const mx = (a * dx) / d, my = (a * dy) / d;
  const P1 = [mx + (h * dy) / d, my - (h * dx) / d], P2 = [mx - (h * dy) / d, my + (h * dx) / d];
  const ang = (ox, oy, [px, py]) => Math.atan2(py - oy, px - ox);
  const s = new THREE.Shape();
  s.absarc(0, 0, R, ang(0, 0, P2), ang(0, 0, P1), false);
  s.absarc(c2x, c2y, r2, ang(c2x, c2y, P1), ang(c2x, c2y, P2), true);
  return s;
}
function roundRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function buildNight() {
  const S = baseScene(6.4, 30);
  S.ground.visible = false;
  const root = new THREE.Group(); S.scene.add(root);
  const moonG = new THREE.Group(); root.add(moonG);
  // puffy 3D crescent: a tube that follows an arc and tapers to rounded tips
  const a0 = THREE.MathUtils.degToRad(70), a1 = THREE.MathUtils.degToRad(290), Rp = 0.92, rMax = 0.5;
  const geo = new ParametricGeometry((u, v, target) => {
    const th = a0 + (a1 - a0) * u;
    const r = rMax * Math.pow(Math.sin(Math.PI * u), 0.75) + 0.035;
    const ph = v * TAU;
    const nx = Math.cos(th), ny = Math.sin(th);
    const off = 0.18 * Math.sin(Math.PI * u); // push the belly outward so the inner edge curves more
    target.set((Rp + off) * nx + r * Math.cos(ph) * nx, (Rp + off) * ny + r * Math.cos(ph) * ny, r * Math.sin(ph) * 0.78);
  }, 160, 48);
  geo.computeVertexNormals();
  const moonMat = new THREE.MeshPhysicalMaterial({ color: 0xf27a00, roughness: 0.3, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6 });
  const moon = new THREE.Mesh(geo, moonMat); moon.castShadow = true; moonG.add(moon);
  moonG.position.set(-0.05, 0.5, 0); moonG.rotation.z = 0.15;
  // soft craters (embedded flattened spheres)
  [].forEach(([x, y, r]) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xd96e00, roughness: 0.5, clearcoat: 0.6 }));
    c.scale.z = 0.25; c.position.set(x, y, 0.42); moonG.add(c);
  });
  // "%50" plate: dark glossy plate, orange bevel rim, white extruded text
  const plate = new THREE.Group(); moonG.add(plate); plate.position.set(0.22, -0.82, 0.48); plate.rotation.set(-0.05, -0.1, -0.15); plate.scale.setScalar(0.92); plate.traverse((o) => (o.castShadow = true));
  const pg = new THREE.ExtrudeGeometry(roundRect(1.7, 0.78, 0.26), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 6 }); pg.center();
  plate.add(new THREE.Mesh(pg, mat.dark()));
  const rimG = new THREE.ExtrudeGeometry(roundRect(1.82, 0.9, 0.3), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 4 }); rimG.center();
  const rimM = new THREE.Mesh(rimG, mat.orange()); rimM.position.z = -0.06; plate.add(rimM);
  const tg = new TextGeometry('%50', { font: interFont, size: 0.5, depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.018, bevelSegments: 4, curveSegments: 10 }); tg.center();
  const txt = new THREE.Mesh(tg, mat.white()); txt.position.z = 0.16; plate.add(txt);
  // stars
  const starMat = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffa040, emissiveIntensity: 0.4, roughness: 0.15, clearcoat: 1 });
  const stars = [
    { pos: [1.15, 1.25, 0.3], ph: 0.0, sz: 0.95 },
    { pos: [1.45, 0.35, 0.2], ph: 0.33, sz: 0.7 },
    { pos: [-1.2, 1.45, 0.1], ph: 0.66, sz: 0.6 },
    { pos: [0.45, 1.8, 0.1], ph: 0.5, sz: 0.5 },
  ];
  stars.forEach((s) => { s.g = sparkleSprite(); s.g.position.set(...s.pos); root.add(s.g); });
  // moving light that glides across the moon surface
  const sweep = new THREE.PointLight(0xfff0dd, 0, 3.2, 1.6); root.add(sweep);
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 30, 128, 128, 128); g.addColorStop(0, 'rgba(255,142,22,.55)'); g.addColorStop(0.55, 'rgba(255,142,22,.18)'); g.addColorStop(1, 'rgba(255,142,22,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false })); halo.position.set(-0.1, 0.45, -1.2); halo.scale.set(4.3, 4.3, 1); halo.renderOrder = -1; root.add(halo);
  S.cam.position.set(0, 0.4, 7.6); S.cam.lookAt(0.1, 0.4, 0);
  S.key.position.set(-3, 3, 5);
  const update = (p) => {
    // moon rocks gently in 3D (shows its volume), light sweeps over its surface, stars twinkle one after another, plate tips
    moonG.rotation.y = Math.sin(p * TAU) * 0.32;
    moonG.rotation.x = Math.sin(p * TAU + 1) * 0.06;
    const sp = p * 1.0;
    const ang = sp * TAU;
    sweep.position.set(-0.2 + Math.cos(ang) * 1.1, 0.55 + Math.sin(ang) * 1.1, 1.0);
    sweep.intensity = 6;
    halo.material.opacity = 0.75 + 0.25 * Math.sin(p * TAU);
    stars.forEach((s) => {
      const k = Math.pow(Math.max(0, Math.sin((p + s.ph) * TAU)), 2);
      const gs = s.sz * (0.45 + 0.75 * k); s.g.scale.set(gs, gs, 1); s.g.material.opacity = 0.35 + 0.65 * k; s.g.material.rotation = Math.sin((p + s.ph) * TAU) * 0.25;
    });
    plate.rotation.z = -0.15 + Math.sin(p * TAU * 2) * 0.03;
  };
  return { ...S, update };
}


// ================= ortak yardımcılar (yeni sahneler) =================
function text3D(str, size, material, depth = 0.12) {
  const g = new TextGeometry(str, { font: interFont, size, depth: size * depth * 4, bevelEnabled: true, bevelThickness: size * 0.06, bevelSize: size * 0.03, bevelSegments: 4, curveSegments: 10 });
  g.center(); const m = new THREE.Mesh(g, material); m.castShadow = true; return m;
}
function plate3D(w, h, r, material, depth = 0.1) {
  const g = new THREE.ExtrudeGeometry(roundRect(w, h, r), { depth, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 6 }); g.center();
  const m = new THREE.Mesh(g, material); m.castShadow = true; return m;
}
function haloSprite(size = 4, op = 0.7) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 30, 128, 128, 128); g.addColorStop(0, 'rgba(255,142,22,.55)'); g.addColorStop(0.55, 'rgba(255,142,22,.18)'); g.addColorStop(1, 'rgba(255,142,22,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: op })); s.scale.set(size, size, 1); s.renderOrder = -1; s.userData.halo = op; return s;
}
function glints(root, list) { return list.map(([x, y, z, ph, sz]) => { const g = sparkleSprite(); g.position.set(x, y, z); root.add(g); return { g, ph, sz }; }); }
function tickGlints(G, p) { G.forEach(({ g, ph, sz }) => { const k = Math.pow(Math.max(0, Math.sin((p + ph) * TAU)), 2); const s = sz * (0.4 + 0.8 * k); g.scale.set(s, s, 1); g.material.opacity = Math.min(1, (0.25 + 0.75 * k) * SHINE); g.material.rotation = Math.sin((p + ph) * TAU) * 0.25; }); }
function frontCam(S, z = 7.2, y = 0.4, look = 0.35) { S.cam.position.set(0, y, z); S.cam.lookAt(0, look, 0); S.ground.visible = false; S.key.position.set(-3, 4, 5); }

// ================= HAFTA SONU — 3D takvim, hafta sonu günleri ışıldar =================
function buildWeekend() {
  const S = baseScene(); frontCam(S, 7.4, 0.5, 0.3);
  const root = new THREE.Group(); S.scene.add(root); root.add(haloSprite(4.4, 0.6)); root.children[0].position.set(0, 0.3, -1.2);
  const cal = new THREE.Group(); root.add(cal); cal.position.y = 0.25;
  const back = plate3D(2.5, 2.6, 0.32, mat.dark(), 0.12); back.position.z = -0.12; cal.add(back);
  const page = plate3D(2.3, 2.05, 0.22, mat.white(), 0.06); page.position.set(0, -0.22, 0.06); cal.add(page);
  const head = plate3D(2.5, 0.72, 0.3, mat.orange(), 0.14); head.position.set(0, 0.98, 0.1); cal.add(head);
  for (const x of [-0.65, 0.65]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 16, 32), mat.dark()); ring.position.set(x, 1.38, 0.2); cal.add(ring); }
  // 3×2 day grid: last two columns = weekend (orange, glowing)
  const days = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const we = c >= 2;
    const m = new THREE.MeshPhysicalMaterial({ color: we ? 0xf47c00 : 0xcfcfcf, roughness: 0.3, clearcoat: 1, emissive: we ? 0xff8e16 : 0x000000, emissiveIntensity: 0 });
    const d = plate3D(0.42, 0.42, 0.1, m, 0.05); d.position.set(-0.78 + c * 0.52, 0.0 - r * 0.6, 0.2); cal.add(d); days.push({ d, m, we, c, r });
  }
    const G = glints(root, [[1.25, 1.5, 0.6, 0, 0.7], [-1.3, -0.6, 0.6, 0.4, 0.5], [1.35, -0.75, 0.6, 0.7, 0.45]]);
  const update = (p) => {
    cal.rotation.y = Math.sin(p * TAU) * 0.22; cal.rotation.x = -0.05 + Math.sin(p * TAU + 1) * 0.04;
    days.forEach(({ m, we, c, r }) => { if (!we) return; const k = Math.pow(Math.max(0, Math.sin((p - (c - 2) * 0.08 - r * 0.04) * TAU)), 2); m.emissiveIntensity = 0.08 + 0.4 * k; });
    tickGlints(G, p);
  };
  return { ...S, update };
}

// ================= TELAFİ — dönüş oku coin etrafında =================
function buildRefund() {
  const S = baseScene(); frontCam(S, 7.2, 0.4, 0.3);
  const root = new THREE.Group(); S.scene.add(root); const h = haloSprite(4.2, 0.6); h.position.set(0, 0.3, -1.2); root.add(h);
  const c = coin3D('₺', 0.78); c.position.y = 0.3; root.add(c);
  const arrow = new THREE.Group(); arrow.position.y = 0.3; root.add(arrow);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.13, 24, 120, Math.PI * 1.55), mat.orange()); arc.castShadow = true; arrow.add(arc);
  const headG = new THREE.ConeGeometry(0.32, 0.55, 32); const head = new THREE.Mesh(headG, mat.orange());
  const a = Math.PI * 1.55; head.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0); head.rotation.z = a; arrow.add(head);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), mat.orange()); tail.position.set(1.35, 0, 0); arrow.add(tail);
  const G = glints(root, [[1.2, 1.55, 0.7, 0.1, 0.6], [-1.4, -0.9, 0.7, 0.55, 0.45]]);
  const update = (p) => {
    // arrow turns one full circle per loop (seamless), coin answers with a small tilt and pop
    arrow.rotation.z = -p * TAU;
    arrow.rotation.x = 0.35; arrow.rotation.y = Math.sin(p * TAU) * 0.15;
    const pop = Math.pow(Math.max(0, Math.sin(p * TAU * 2)), 6);
    c.scale.setScalar(1 + 0.06 * pop); c.rotation.y = Math.sin(p * TAU) * 0.35;
    tickGlints(G, p);
  };
  return { ...S, update };
}

// ================= YATIRIM SPİN — coin kulesi + FS =================
function buildSpin() {
  const S = baseScene(); frontCam(S, 7.0, 0.9, 0.35);
  const root = new THREE.Group(); S.scene.add(root); const h = haloSprite(4.2, 0.55); h.position.set(0, 0.3, -1.2); root.add(h);
  const coins = [];
  for (let i = 0; i < 3; i++) { const c = coin3D('₺', 0.62); c.rotation.x = -Math.PI / 2 + 0.0; c.position.set(-0.55, -0.55 + i * 0.2, 0); root.add(c); coins.push(c); }
  const top = coin3D('₺', 0.66); top.position.set(-0.55, 0.55, 0.1); root.add(top);
  const plate = new THREE.Group(); plate.position.set(0.72, 0.15, 0.4); root.add(plate);
  plate.add(plate3D(1.05, 0.72, 0.24, mat.dark(), 0.1));
  const fs = text3D('FS', 0.42, mat.white()); fs.position.z = 0.14; plate.add(fs);
  const rim = plate3D(1.15, 0.82, 0.28, mat.orange(), 0.06); rim.position.z = -0.08; plate.add(rim);
  const G = glints(root, [[-0.1, 1.45, 0.6, 0, 0.6], [1.45, 0.95, 0.6, 0.45, 0.45]]);
  const update = (p) => {
    // top coin turns slowly on its axis (one full turn per loop), stack and plate stay calm
    top.rotation.y = Math.sin(p * TAU) * 0.85; top.position.y = 0.55 + 0.08 * Math.sin(p * TAU * 2);
    plate.rotation.y = -0.2 + Math.sin(p * TAU) * 0.12; plate.rotation.z = Math.sin(p * TAU + 1) * 0.03;
    tickGlints(G, p);
  };
  return { ...S, update };
}

// ================= 3X YAP 6X ÇEK — çarpan dönüşür =================
function buildMulti() {
  const S = baseScene(); frontCam(S, 6.6, 0.3, 0.3);
  const root = new THREE.Group(); S.scene.add(root); const h = haloSprite(4.2, 0.6); h.position.set(0, 0.3, -1.2); root.add(h);
  const plate = new THREE.Group(); plate.position.y = 0.3; root.add(plate);
  plate.add(plate3D(2.5, 1.7, 0.42, mat.dark(), 0.14));
  const rim = plate3D(2.66, 1.86, 0.48, mat.orange(), 0.06); rim.position.z = -0.1; plate.add(rim);
  const flip = new THREE.Group(); flip.position.z = 0.2; plate.add(flip);
  const t3 = text3D('3X', 0.95, mat.orange()); t3.position.z = 0.1; flip.add(t3);
  const t6 = text3D('6X', 0.95, mat.white()); t6.rotation.x = Math.PI; t6.position.z = -0.1; flip.add(t6);
  const G = glints(root, [[1.3, 1.25, 0.7, 0.25, 0.6], [-1.35, -0.55, 0.7, 0.75, 0.5]]);
  const update = (p) => {
    // 3X holds, flips over to 6X, holds, flips on to 3X (two half turns = seamless loop)
    const k = p < 0.3 ? 0 : p < 0.45 ? ease((p - 0.3) / 0.15) : p < 0.8 ? 1 : p < 0.95 ? 1 + ease((p - 0.8) / 0.15) : 2;
    flip.rotation.x = k * Math.PI;
    const face = Math.cos(flip.rotation.x); t3.visible = face > -0.05; t6.visible = face < 0.05;
    plate.rotation.y = Math.sin(p * TAU) * 0.18;
    const pop = (p > 0.44 && p < 0.52) || (p > 0.94 || p < 0.02) ? 1 : 0;
    plate.scale.setScalar(1 + 0.03 * Math.sin(Math.min(1, Math.max(0, (p - 0.44) / 0.08)) * Math.PI));
    tickGlints(G, p);
  };
  return { ...S, update };
}

// ================= DOĞUM GÜNÜ — pasta + mum + konfeti =================
function buildBirthday() {
  const S = baseScene(); S.cam.position.set(0, 2.2, 6.9); S.cam.lookAt(0, 1.0, 0);
  const root = new THREE.Group(); S.scene.add(root); root.rotation.y = -0.4;
  const cake = new THREE.Group(); root.add(cake);
  const plateM = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.38, 0.1, 64), mat.dark()); plateM.position.y = 0.05; cake.add(plateM);
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.7, 64), mat.orange()); l1.position.y = 0.45; l1.castShadow = true; cake.add(l1);
  const cream1 = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.1, 16, 64), mat.white()); cream1.rotation.x = Math.PI / 2; cream1.position.y = 0.8; cake.add(cream1);
  const l2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.55, 64), mat.orange()); l2.position.y = 1.08; l2.castShadow = true; cake.add(l2);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.08, 64), mat.white()); top.position.y = 1.37; cake.add(top);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const drip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat.white()); drip.scale.set(1, 1.6, 1); drip.position.set(Math.cos(a) * 0.8, 1.27, Math.sin(a) * 0.8); cake.add(drip); }
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 24), mat.white()); candle.position.y = 1.68; cake.add(candle);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 8, 24), mat.orange()); stripe.rotation.x = Math.PI / 2; stripe.position.y = 1.7; cake.add(stripe);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffc061 })); flame.scale.set(0.8, 1.6, 0.8); flame.position.y = 2.08; cake.add(flame);
  const fglow = glowSprite(); fglow.position.y = 2.08; cake.add(fglow);
  // confetti: small orange / white / dark ribbons falling on a closed path (seamless)
  const conf = [];
  const cols = [mat.orange(), mat.white(), mat.dark(), mat.orange()];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), cols[i % 4]); root.add(m); conf.push({ m, x: (Math.random() - 0.5) * 3.2, z: (Math.random() - 0.5) * 1.4 + 0.6, ph: i / 14, sp: 0.7 + Math.random() * 0.6, r: Math.random() * TAU }); }
  const update = (p) => {
    root.rotation.y = -0.4 + Math.sin(p * TAU) * 0.12;
    const fl = 1 + 0.12 * Math.sin(p * TAU * 6) + 0.06 * Math.sin(p * TAU * 11);
    flame.scale.set(0.8 / fl, 1.6 * fl, 0.8 / fl); fglow.scale.setScalar(0.9 + 0.25 * fl); fglow.material.opacity = 0.7;
    conf.forEach((c) => { const t = (p + c.ph) % 1; c.m.position.set(c.x + 0.15 * Math.sin(t * TAU * 2 + c.r), 3.3 - t * 3.0, c.z); c.m.rotation.set(t * TAU * 2 + c.r, t * TAU + c.r, c.r); c.m.visible = true; const fade = Math.min(1, t * 6, (1 - t) * 6); c.m.scale.setScalar(fade); });
  };
  return { ...S, update };
}

// ================= ARKADAŞINI GETİR — iki simge birleşir =================
function person(material, headMat) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 28), headMat); head.position.y = 0.95; head.castShadow = true; g.add(head);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 32, 0, TAU, 0, Math.PI / 2), material); body.scale.set(1, 0.95, 0.8); body.position.y = -0.05; body.castShadow = true; g.add(body);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 48), material); base.scale.z = 0.8; base.position.y = -0.11; g.add(base);
  return g;
}
function buildFriend() {
  const S = baseScene(); frontCam(S, 7.4, 0.5, 0.3);
  const root = new THREE.Group(); S.scene.add(root); const h = haloSprite(4.4, 0.6); h.position.set(0, 0.3, -1.3); root.add(h);
  const A = person(mat.orange(), mat.orange()); const B = person(mat.dark(), mat.white());
  A.position.set(-0.75, -0.25, 0.1); B.position.set(0.75, -0.25, -0.1); root.add(A, B);
  const badge = new THREE.Group(); badge.position.set(0, 1.25, 0.6); root.add(badge);
  badge.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.16, 48).rotateX(Math.PI / 2), mat.orange()));
  const plus = text3D('+', 0.55, mat.white()); plus.position.z = 0.12; badge.add(plus);
  const G = glints(root, [[1.45, 1.2, 0.6, 0.35, 0.5], [-1.5, 1.0, 0.6, 0.85, 0.45]]);
  const update = (p) => {
    // the two step towards each other, a "+" badge pops between them, then they ease back
    const k = p < 0.2 ? 0 : p < 0.4 ? ease((p - 0.2) / 0.2) : p < 0.7 ? 1 : p < 0.9 ? 1 - ease((p - 0.7) / 0.2) : 0;
    A.position.x = -0.95 + 0.3 * k; B.position.x = 0.95 - 0.3 * k;
    A.rotation.y = 0.25 * k; B.rotation.y = -0.25 * k;
    const pop = p < 0.36 ? 0 : p < 0.48 ? easeOutBack((p - 0.36) / 0.12) : p < 0.72 ? 1 : p < 0.82 ? 1 - ease((p - 0.72) / 0.1) : 0;
    badge.scale.setScalar(Math.max(0.0001, pop)); badge.rotation.y = Math.sin(p * TAU * 2) * 0.3;
    tickGlints(G, p);
  };
  return { ...S, update };
}

// ================= GÜNLÜK CASINO — 777 parlar =================
function buildDaily() {
  const S = baseScene(); frontCam(S, 6.8, 0.3, 0.3);
  const root = new THREE.Group(); S.scene.add(root); const h = haloSprite(4.4, 0.6); h.position.set(0, 0.3, -1.3); root.add(h);
  const plate = new THREE.Group(); plate.position.y = 0.3; root.add(plate);
  plate.add(plate3D(2.9, 1.55, 0.4, mat.dark(), 0.14));
  const rim = plate3D(3.06, 1.71, 0.46, mat.orange(), 0.06); rim.position.z = -0.1; plate.add(rim);
  const sevens = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshPhysicalMaterial({ color: 0xf47c00, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0xff8e16, emissiveIntensity: 0.1 });
    const t = text3D('7', 0.95, m); t.position.set(-0.86 + i * 0.86, 0, 0.22); plate.add(t); sevens.push({ t, m });
  }
  const G = glints(root, [[1.45, 1.15, 0.7, 0.2, 0.6], [-1.5, -0.55, 0.7, 0.6, 0.5]]);
  const update = (p) => {
    // the three 7s light up one after another, then all together; plate tips gently
    sevens.forEach(({ t, m }, i) => { const k = Math.pow(Math.max(0, Math.sin((p - i * 0.12) * TAU)), 4); m.emissiveIntensity = 0.05 + 0.42 * k; t.scale.setScalar(1 + 0.06 * k); });
    plate.rotation.y = Math.sin(p * TAU) * 0.16; plate.rotation.x = Math.sin(p * TAU + 1) * 0.05;
    tickGlints(G, p);
  };
  return { ...S, update };
}

// ================= YAZILI BAŞLIK ŞERİDİ (n parça × 100 px) =================
function buildStrip(text, n) {
  const S = baseScene(); S.ground.visible = false;
  S.cam = new THREE.PerspectiveCamera(16, n, 0.1, 80); S.cam.position.set(0, 0, 8.3); S.cam.lookAt(0, 0, 0);
  S.key.position.set(-4, 5, 8);
  const root = new THREE.Group(); S.scene.add(root);
  const W = n * 2.33 * 0.93, H = 2.33 * 0.8;
  const plate = plate3D(W, H, 0.42, mat.dark(), 0.12); root.add(plate);
  const rim = plate3D(W + 0.16, H + 0.16, 0.48, mat.orange(), 0.05); rim.position.z = -0.1; root.add(rim);
  const tm = new THREE.MeshPhysicalMaterial({ color: 0xf47c00, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0xff8e16, emissiveIntensity: 0.05 });
  const t = text3D(text, 0.82, tm); t.position.z = 0.22;
  t.geometry.computeBoundingBox(); const bb = t.geometry.boundingBox; const tw = bb.max.x - bb.min.x, th = bb.max.y - bb.min.y;
  const sc = Math.min((W - 0.8) / tw, (H - 0.5) / th); t.scale.set(sc, sc, sc); root.add(t);
  const sweep = new THREE.PointLight(0xffffff, 0, 3.5, 1.4); sweep.position.z = 1.4; root.add(sweep);
  const G = glints(root, [[W / 2 - 0.2, H / 2 - 0.05, 0.6, 0.15, 0.55], [-W / 2 + 0.25, -H / 2 + 0.1, 0.6, 0.65, 0.42]]);
  const update = (p) => {
    // light glides along the title once per loop; letters glow softly; plate breathes very slightly in depth
    const x = -W / 2 - 1 + ((p * 1.0) % 1) * (W + 2);
    sweep.position.x = x; sweep.position.y = 0.2; sweep.intensity = 5 * Math.sin(Math.PI * ((p * 1.0) % 1));
    tm.emissiveIntensity = 0.05 + 0.18 * Math.pow(Math.sin(p * Math.PI), 2);
    root.rotation.x = Math.sin(p * TAU) * 0.05; root.rotation.y = Math.sin(p * TAU + 0.8) * 0.04;
    tickGlints(G, p);
  };
  return { ...S, update };
}
const builders = { welcome: buildGift, night: buildNight, weekend: buildWeekend, refund: buildRefund, spin: buildSpin, multi: buildMulti, birthday: buildBirthday, friend: buildFriend, daily: buildDaily };

let fontPromise = null;
/** loads Inter Black for the 3D lettering (TextGeometry) — call before the first frame */
export function ensureCampaignFont() {
  fontPromise ??= new Promise((res, rej) => new TTFLoader().load(interBlackUrl, (json) => { interFont = new Font(json); res(); }, undefined, rej));
  return fontPromise;
}
export const campaignFontReady = () => !!interFont;

export type CampaignKind = 'welcome' | 'night' | 'weekend' | 'refund' | 'spin' | 'multi' | 'birthday' | 'friend' | 'daily';
const cache = new Map();
let out2d = null;

/**
 * Renders one frame. kind = single emoji, or strip (text + tile count) for the written-title variant.
 * Returns a canvas of size×size (single) or (size·tiles)×size (strip). brightness = exposure, shine = glints/halo.
 */
export function renderCampaign(opts) {
  const { kind, text, tiles = 1, p, size = 512, brightness = 1, shine = 1 } = opts;
  const r = gl();
  const key = kind === 'strip' ? `strip|${text}|${tiles}` : kind;
  let s = cache.get(key);
  if (!s) {
    s = kind === 'strip' ? buildStrip(text || '', tiles) : builders[kind]();
    cache.set(key, s);
  }
  SHINE = shine;
  s.scene.traverse((o) => { if (o.userData && o.userData.halo !== undefined) o.material.opacity = Math.min(1, o.userData.halo * shine); });
  const w = Math.round(size * (kind === 'strip' ? tiles : 1)), h = Math.round(size);
  if (r.domElement.width !== w || r.domElement.height !== h) r.setSize(w, h, false);
  r.toneMappingExposure = brightness;
  s.update(((p % 1) + 1) % 1);
  r.render(s.scene, s.cam);
  return r.domElement;
}
