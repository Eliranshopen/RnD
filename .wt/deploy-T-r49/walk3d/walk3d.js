// walk3d.js — free walking through apt846 in a true 3D model (2026-11-12, Eliran: «אני רוצה תחושה אמיתית של הליכה בדירה לפי החיצים
// שאני אזיז»). The plan-exact Blender model with its daylight baked into texture atlases (360walkaround/pipeline/walk3d_bake.py), so
// every step is drawn from where the visitor stands: no picture is warped. Desktop: ↑ walk, ↓ back, ← → turn, mouse drag looks.
// Phone (no on-screen arrows, Eliran 2026-11-11): one finger drag — sideways turns, up walks forward, down walks back.
// The visitor stays on the plan's free floor (walk3d-grid.png: walls, glass and furniture kept clear) and slides along walls.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const EYE = 1.6, WALK = 1.25, BACK = 0.8, TURN = 75, STEP = 0.68, BOB = 0.022;   // m, m/s, m/s, deg/s, m per step, m
const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const ROOMS = { 'r-entrance': 'כניסה', 'r-kitchen': 'מטבח', 'r-dining': 'פינת אוכל', 'r-living': 'סלון', 'r-terrace-living': 'מרפסת שמש', 'r-terrace-bedroom': 'מרפסת · קצה החדרים', 'r-bedroom-main': 'חדר שינה הורים', 'r-wardrobe': 'פינת ארונות', 'r-bath-main': 'חדר רחצה הורים', 'r-bedroom-2': 'חדר שינה', 'r-bath-guest': 'חדר רחצה כללי' };
const $ = (id) => document.getElementById(id);
$('hint').innerHTML = phone ? 'גררו אצבע למעלה כדי ללכת · לצדדים כדי לפנות<small>הדמיה ממודל תלת־ממדי לפי תכנית המכר</small>'
  : 'חיצים במקלדת: ↑ הליכה · ↓ אחורה · ← → פנייה · גרירה בעכבר: הסתכלות<small>הדמיה ממודל תלת־ממדי לפי תכנית המכר</small>';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.75 : 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
// the sky beyond the glass: a soft vertical gradient (the scene's daylight came from a clear noon sky)
{ const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#9fbbd6'); gr.addColorStop(0.5, '#dfe7ee'); gr.addColorStop(0.52, '#c9c6bd'); gr.addColorStop(1, '#a9a597'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t; }
// the city outside: ONE tour picture's skyline at infinity (walk3d-sky.py); the gradient above stays until it loads
new THREE.TextureLoader().load('./model/sky.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t; });
scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x8a8174, 1.6)); const sun = new THREE.DirectionalLight(0xfff4e0, 1.4); sun.position.set(-3, 8, 4); scene.add(sun);
const camera = new THREE.PerspectiveCamera(phone ? 72 : 68, innerWidth / innerHeight, 0.05, 4000); camera.rotation.order = 'YXZ';

// ---- the free floor
const grid = await (await fetch('./walk3d-grid.json')).json();
const free = await new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = grid.w; c.height = grid.h;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, grid.w, grid.h).data; const a = new Uint8Array(grid.w * grid.h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4] > 127 ? 1 : 0; res(a); }; im.src = './walk3d-grid.png'; });
const ok = (xm, zm) => { const c = Math.round((xm * 100 - grid.x0) / grid.cell), r = Math.round((zm * 100 - grid.y0) / grid.cell); return r >= 0 && c >= 0 && r < grid.h && c < grid.w && free[r * grid.w + c] === 1; };
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const roomAt = (xm, zm) => { const r = grid.rooms.find((q) => inPoly(xm * 100, zm * 100, q.loop)); return r ? ROOMS[r.id] || '' : ''; };

// ---- the apartment
const loader = new GLTFLoader(new THREE.LoadingManager());
if (phone) loader.manager.setURLModifier((u) => u.replace(/(bake_\d+)\.jpg$/, '$1_2k.jpg'));   // phones: the 2048 atlases
const gltf = await loader.loadAsync('./model/walk3d.gltf', (e) => { if (e.total) $('prog').style.width = Math.round((100 * e.loaded) / e.total) + '%'; });
gltf.scene.traverse((o) => {
  if (!o.isMesh) return; const m = o.material;
  if (m && m.name.startsWith('WALK3D_baked')) { o.material = new THREE.MeshBasicMaterial({ map: m.map }); m.dispose(); }
  else if (m && m.name === 'WALK3D_glass') { o.material = new THREE.MeshBasicMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.1, depthWrite: false }); o.renderOrder = 2; }
});
scene.add(gltf.scene);

// ---- the visitor
const me = { x: grid.start.x / 100, z: grid.start.y / 100, yaw: -THREE.MathUtils.degToRad(grid.start.yaw_deg), pitch: phone ? -0.04 : -0.02, dist: 0 };
const keys = new Set();
addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow') || 'wasd'.includes(e.key)) { keys.add(e.key); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.key)); addEventListener('blur', () => keys.clear());
let drag = null, walkIn = 0, turnIn = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse' }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.touch) {   // an invisible stick: how far the finger is from where it went down
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    walkIn = Math.abs(dy) < 14 ? 0 : THREE.MathUtils.clamp(-dy / 110, -1, 1);
    turnIn = Math.abs(dx) < 14 ? 0 : THREE.MathUtils.clamp(dx / 140, -1, 1);
  } else {   // the mouse looks around
    me.yaw -= (e.clientX - drag.lx) * 0.0042; me.pitch = THREE.MathUtils.clamp(me.pitch - (e.clientY - drag.ly) * 0.0035, -1.1, 0.9);
  }
  drag.lx = e.clientX; drag.ly = e.clientY;
});
const up = (e) => { if (drag && e.pointerId === drag.id) { drag = null; walkIn = 0; turnIn = 0; } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function step(dt) {
  const fwd = (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) + walkIn;
  const turn = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0) + turnIn;
  me.yaw -= THREE.MathUtils.degToRad(TURN) * THREE.MathUtils.clamp(turn, -1, 1) * dt;
  const f = THREE.MathUtils.clamp(fwd, -1, 1), v = (f >= 0 ? WALK : BACK) * f * dt;
  if (v) {
    const dx = -Math.sin(me.yaw) * v, dz = -Math.cos(me.yaw) * v; let nx = me.x, nz = me.z;
    if (ok(me.x + dx, me.z + dz)) { nx += dx; nz += dz; } else if (ok(me.x + dx, me.z)) nx += dx; else if (ok(me.x, me.z + dz)) nz += dz;   // slide along a wall
    me.dist += Math.hypot(nx - me.x, nz - me.z); me.x = nx; me.z = nz;
  }
  const ph = (me.dist / STEP) * Math.PI;   // one bob per step, a sway every two
  camera.position.set(me.x + Math.cos(me.yaw) * Math.sin(ph) * 0.012, EYE + Math.abs(Math.sin(ph)) * BOB - BOB / 2, me.z - Math.sin(me.yaw) * Math.sin(ph) * 0.012);
  camera.rotation.set(me.pitch, me.yaw, Math.sin(ph) * 0.004);
}
let last = performance.now(), roomShown = '';
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; step(dt); renderer.render(scene, camera);
  const r = roomAt(me.x, me.z); if (r && r !== roomShown) { roomShown = r; $('room').textContent = r; }
});
window.__walk3d = { me, ok, scene, renderer, camera, ready: true, info: () => renderer.info.render };
$('load').classList.add('hidden');
