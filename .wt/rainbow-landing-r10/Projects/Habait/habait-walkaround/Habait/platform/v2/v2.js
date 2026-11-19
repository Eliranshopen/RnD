// Rainbow v2 test page (plan development/plans/2026-11-09-rainbow-v2.md). Own module: no production script is imported or changed.
// - facts and routes from fixtures/rainbow/project.json + units.json (the stage rewrites their local hosts to /tour and /hold);
// - the hero film: poster first (LCP), film after load, pause off-screen, a pause/play button (WCAG 2.2.2), none on reduced motion / Save-Data;
// - the scroll story (html.is-motion only): GSAP 3.13 ScrollTrigger scrubs sticky stages, Lenis smooths the wheel on fine pointers.
//   Reduced motion, no JS, or GSAP missing = the static page in v2.css (every stage visible, nothing moves).
// Timing learnt from the reference recording (4 fps sheets, plan §2): title fades as the camera rises; the floor number steps up to the
// chosen floor beside the tower; the floor is isolated; the cutaway arrives, its title and the room chips ~1 s later; a dive into a
// room; rooms change by a ~0.5 s crossfade with a slow push-in, the caption and the filmstrip appear after the picture settles.
const ROOT = new URL('../', location.href);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const html = document.documentElement;

// ---------------- data: facts, developer, legal line, routes ----------------
async function getJson(rel) { const r = await fetch(new URL(rel, ROOT), { cache: 'no-cache' }); if (!r.ok) throw new Error(rel + ' ' + r.status); return r.json(); }
const pick = (o) => (o && (o.he || o.en)) || '';
async function loadData() {
  const [proj, units] = await Promise.all([getJson('fixtures/rainbow/project.json'), getJson('fixtures/rainbow/units.json')]);
  const dev = pick(proj.developer);
  if (dev) { $('#devName').textContent = dev; $('#devFoot').textContent = dev; }
  const full = pick(proj.disclaimer);
  if (full) { $('#legalLine').textContent = full.split(/(?<=\.)\s/)[0] || full; $('#legalFull').textContent = full; $('#legal').hidden = false; }
  const u = (units.units || []).find((x) => String(x.id) === '846');
  if (u) {
    const set = (k, v) => { const el = $(`[data-fact="${k}"]`); if (el && v != null) el.textContent = String(v); };
    set('rooms', u.rooms); set('area', u.area_m2); set('outdoor', u.outdoor_m2);   // prices are never shown (project.json prices_public=false)
  }
  const ext = proj.exterior || {};
  const here = location.href.split('#')[0];
  if (ext.params && ext.params.tour) {
    const tour = (room) => { const t = new URL(ext.params.tour, location.href); t.searchParams.set('room', room); t.searchParams.set('from', 'v2'); t.searchParams.set('return', here); return t.toString(); };
    $('#ctaTour').href = tour('living');
    $$('[data-route="tour-room"]').forEach((a) => { a.href = tour(a.dataset.room); });
  }
  if (ext.url) {   // the same route as the production CTA «לסיור בפרויקט»: the hold with its inline orbit intro (js/target.js projectHref)
    const h = new URL(ext.url, location.href);
    for (const [k, v] of Object.entries(ext.params || {})) h.searchParams.set(k, v);
    h.searchParams.set('project', proj.id || 'rainbow');
    if (ext.intro && ext.intro.clip && ext.intro.mode === 'inline') h.searchParams.set('orbit', new URL(`fixtures/rainbow/${ext.intro.clip}`, ROOT).toString());
    $('#ctaHold').href = h.toString();
  }
}

// ---------------- the hero film ----------------
const hero = $('#hero'), video = $('#heroVideo'), btn = $('#heroToggle');
const saveData = Boolean(navigator.connection && navigator.connection.saveData);
let userPaused = false;
function syncToggle() {
  const playing = !video.paused && !video.ended && video.currentSrc;
  btn.dataset.state = playing ? 'playing' : 'paused';
  btn.setAttribute('aria-label', playing ? 'השהיית הסרטון' : 'הפעלת הסרטון');
}
function pickSrc() {
  if (innerWidth / innerHeight <= 0.8) return video.getAttribute('data-src-portrait');
  const w = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio || 1, 2);
  return video.getAttribute(innerWidth <= 900 || w <= 1400 ? 'data-src-720' : 'data-src-1080');
}
async function play() {
  if (!video.getAttribute('src')) { video.src = pickSrc(); video.load(); }
  try { await video.play(); } catch (e) { /* autoplay refused: the button stays on «play» */ }
  syncToggle();
}
video.addEventListener('playing', () => { hero.classList.add('is-playing'); syncToggle(); });
video.addEventListener('pause', syncToggle);
video.addEventListener('error', () => { hero.classList.remove('is-playing'); syncToggle(); });
btn.addEventListener('click', () => { if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); } });
new IntersectionObserver((es) => {
  const inView = es[0].isIntersecting;
  if (!inView && !video.paused) video.pause();
  else if (inView && video.paused && video.getAttribute('src') && !userPaused && !reduce.matches) play();
}, { threshold: 0 }).observe(hero);
const autostart = () => { if (reduce.matches || saveData) { syncToggle(); return; } play(); };
if (document.readyState === 'complete') autostart(); else addEventListener('load', autostart, { once: true });

// ---------------- the live dollhouse (on request) ----------------
const dlg = $('#dialog3d');
let lenis = null;
$('#open3d').addEventListener('click', () => {
  const body = $('#dialog3dBody');
  if (!body.querySelector('iframe')) {
    const f = document.createElement('iframe');
    f.src = new URL('tour/3d/dollhouse.html#preset=3d', ROOT).toString();
    f.title = 'דירה 846 בתלת־ממד'; f.loading = 'eager'; f.allow = 'fullscreen';
    body.append(f);
  }
  if (lenis) lenis.stop();
  dlg.showModal();
});
$('#close3d').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => { if (lenis) lenis.start(); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // a click on the backdrop

// ---------------- rooms: the active one (strip + chips) ----------------
const rooms = $$('.v2-room');
const strip = $$('.v2-strip__item');
const stripNav = $('[data-strip]');
document.documentElement.style.setProperty('--rooms', String(rooms.length));
let active = -1;
function setActive(i) {
  if (i === active) return;
  active = i;
  rooms.forEach((r, k) => r.classList.toggle('is-on', k === i));
  strip.forEach((a, k) => { a.classList.toggle('is-on', k === i); if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  const a = strip[i];
  if (a && stripNav.scrollWidth > stripNav.clientWidth + 1) {   // keep the active thumb in view inside the strip, never scroll the page
    const nr = stripNav.getBoundingClientRect(), ar = a.getBoundingClientRect();
    stripNav.scrollBy({ left: (ar.left + ar.width / 2) - (nr.left + nr.width / 2), behavior: reduce.matches ? 'auto' : 'smooth' });
  }
}

// ---------------- the scroll story ----------------
function staticMode() { html.classList.remove('is-motion'); }
function motion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reduce.matches) { staticMode(); return; }
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  if (window.Lenis && matchMedia('(pointer: fine)').matches) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const portrait = () => innerWidth / innerHeight <= 0.8;

  // 1. hero: the title leaves as the camera rises (reference 0.25-3.0 s: a crane up, title gone in ~0.5 s)
  gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.8 } })
    .to('[data-hero-media]', { scale: 1.12, yPercent: 10, ease: 'none' }, 0)
    .to('[data-hero-body]', { autoAlpha: 0, y: -48, ease: 'power1.in', duration: 0.45 }, 0)
    .to('.v2-cue', { autoAlpha: 0, duration: 0.2 }, 0);
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  if (window.SplitText) {   // split after the display font is in (SplitText measures the words)
    gsap.set('#heroTitle', { autoAlpha: 0 });
    fontsReady.then(() => {
      const st = new window.SplitText('#heroTitle', { type: 'words', wordsClass: 'v2-w' });
      gsap.set('#heroTitle', { autoAlpha: 1 });
      gsap.from(st.words, { yPercent: 60, autoAlpha: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 });
    });
  }
  gsap.from(['.v2-hero__body .v2-eyebrow', '.v2-hero__lead'], { y: 20, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.35 });

  // 2+3. the floor: the number steps up to 16 beside the tower, floor 16 lights, the camera closes in and the rest goes dark
  const frame = $('[data-floor-frame]'), band = $('[data-band]'), num = $('[data-floor-num]'), stage = $('[data-floor-stage]');
  const counter = { n: 1 };
  const zoom = () => (portrait() ? 1.55 : 1.7);
  const anchor = () => {   // the move that brings apartment 846's terrace point toward the target, clamped so the picture still covers the stage
    const W0 = frame.offsetWidth, H0 = frame.offsetHeight, SW = stage.clientWidth, SH = stage.clientHeight, s = zoom();
    const cs = getComputedStyle(document.body), ax = parseFloat(cs.getPropertyValue('--ax')) / 100, ay = parseFloat(cs.getPropertyValue('--ay')) / 100;
    const restL = (SW - W0) / 2, restT = (SH - H0) / 2, axp = restL + ax * W0, ayp = restT + ay * H0;   // stage px; the scale origin = the anchor
    const L = axp - ax * W0 * s, R = axp + (1 - ax) * W0 * s, T = ayp - ay * H0 * s, B = ayp + (1 - ay) * H0 * s;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    return { dx: clamp(SW * (portrait() ? 0.56 : 0.4) - axp, SW - R, -L), dy: clamp(SH * (portrait() ? 0.62 : 0.56) - ayp, SH - B, -T) };
  };
  gsap.set(band, { autoAlpha: 0, '--dim': 0 });
  gsap.set('[data-pin]', { autoAlpha: 0, scale: 0.4 });
  gsap.set(['[data-floor-unit]', '[data-floor-facts]'], { autoAlpha: 0, y: 24 });
  gsap.timeline({ scrollTrigger: { trigger: '#floor', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true } })
    .from('[data-floor-copy]', { autoAlpha: 0, x: () => (portrait() ? 0 : -40), y: () => (portrait() ? 30 : 0), duration: 0.08, ease: 'power2.out' }, 0)
    .to(counter, { n: 16, duration: 0.4, ease: 'power1.inOut', onUpdate: () => { num.textContent = String(Math.round(counter.n)); } }, 0)
    .fromTo(frame, { scale: 1 }, { scale: 1.08, duration: 0.4, ease: 'none' }, 0)
    .to(band, { autoAlpha: 1, '--dim': 0.5, duration: 0.1, ease: 'power2.out' }, 0.4)
    .to('[data-pin]', { autoAlpha: 1, scale: 1, duration: 0.08, ease: 'back.out(2)' }, 0.42)
    .to(['[data-floor-unit]', '[data-floor-facts]'], { autoAlpha: 1, y: 0, duration: 0.1, stagger: 0.04, ease: 'power3.out' }, 0.44)
    // the isolated floor: closer, and everything but floor 16 goes dark (light and crop only; the picture is not altered)
    .to(frame, { scale: zoom, x: () => anchor().dx, y: () => anchor().dy, duration: 0.3, ease: 'power2.inOut' }, 0.56)
    .to(band, { '--dim': 0.9, duration: 0.3, ease: 'power1.inOut' }, 0.56)
    .to('[data-floor-eyebrow]', { autoAlpha: 0, duration: 0.06 }, 0.56)
    // hand-off to the cutaway: the frame falls away into the dark (reference 6.75-7.25 s)
    .to([frame, '[data-floor-copy]', '.v2-floor .v2-badge', '.v2-scrim--floor'], { autoAlpha: 0, duration: 0.1, ease: 'power1.in' }, 0.9);

  // 4. the cutaway: it rises out of the dark, its title and the room chips follow; then the camera dives in at the entrance
  gsap.set(['[data-cut-head]', '[data-cut-foot]'], { autoAlpha: 0, y: 18 });
  gsap.timeline({ scrollTrigger: { trigger: '#cutaway', start: 'top top', end: 'bottom bottom', scrub: 1 } })
    .fromTo('.v2-cut__img', { scale: 0.78, autoAlpha: 0, rotate: -2, y: 50 }, { scale: 1, autoAlpha: 1, rotate: 0, y: 0, duration: 0.24, ease: 'power3.out' }, 0)
    .to('[data-cut-head]', { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.16)
    .to('[data-cut-foot]', { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.22)
    .to({}, { duration: 0.24 })   // a hold: time to read it
    .to(['[data-cut-head]', '[data-cut-foot]', '.v2-cut .v2-badge'], { autoAlpha: 0, duration: 0.08 }, 0.62)
    .to('.v2-cut__img', { scale: 4.2, duration: 0.34, ease: 'power2.in' }, 0.62)
    .to('.v2-cut__img', { autoAlpha: 0, duration: 0.1, ease: 'power1.in' }, 0.86);

  // 5. the rooms: one sticky screen; each room arrives by a crossfade with a push-in, then holds with a slow drift (Ken Burns)
  const N = rooms.length;
  const media = rooms.map((r) => $('[data-room-media]', r));
  const caps = rooms.map((r) => $('[data-room-cap]', r));
  gsap.set(rooms, { autoAlpha: 0 });
  gsap.set(stripNav, { autoAlpha: 0, y: 30 });
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  const at = [];   // the timeline time at which room i is fully in
  tl.fromTo(rooms[0], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0)
    .fromTo(media[0], { scale: 1.3 }, { scale: 1, duration: 0.9, ease: 'power2.out' }, 0)
    .fromTo(caps[0], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0.55)
    .to(stripNav, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.6);
  let t = 0.9;
  for (let i = 0; i < N; i++) {
    at.push(t);
    tl.to(media[i], { scale: 1.06, duration: 1 }, t);                     // hold: the slow push-in
    if (i === N - 1) { t += 1; break; }
    const x = t + 1;                                                    // crossfade to the next room
    tl.to(rooms[i], { autoAlpha: 0, duration: 0.45 }, x)
      .to(media[i], { scale: 1.12, duration: 0.45, ease: 'power1.in' }, x)
      .fromTo(rooms[i + 1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45 }, x)
      .fromTo(media[i + 1], { scale: 1.14 }, { scale: 1, duration: 0.55, ease: 'power2.out' }, x)
      .fromTo(caps[i + 1], { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, x + 0.3);
    t = x + 0.55;
  }
  const total = tl.duration();
  const roomsST = ScrollTrigger.create({
    trigger: '#rooms', start: 'top top', end: 'bottom bottom', scrub: 0.6, animation: tl,
    onUpdate: (self) => { const now = self.progress * total; let k = 0; for (let i = 0; i < N; i++) if (now >= at[i] - 0.3) k = i; setActive(k); },
  });
  const goTo = (i) => {
    const y = roomsST.start + (roomsST.end - roomsST.start) * Math.min(1, (at[i] + 0.35) / total);
    if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' });
  };
  $$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(Number(a.dataset.goto)); }));

  // 6. the way on
  if (window.SplitText) fontsReady.then(() => {
    const st = new window.SplitText('#goTitle', { type: 'words', wordsClass: 'v2-w' });
    gsap.from(st.words, { yPercent: 50, autoAlpha: 0, stagger: 0.06, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '#go', start: 'top 70%' } });
  });
  gsap.fromTo('.v2-go__media', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#go', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.from('.v2-go__ctas > *', { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: '#go', start: 'top 60%' } });

  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.__v2 = { lenis, tl, roomsST, at, total, goTo };
}

// static mode: the strip is hidden; chips jump to the room blocks with a plain anchor (no JS needed); the first room is "on"
setActive(0);
reduce.addEventListener?.('change', () => location.reload());
if (html.classList.contains('is-motion')) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', motion, { once: true }); else motion();
}
loadData().catch((e) => console.warn('v2: project data not loaded; the in-page facts and links stay', e));
