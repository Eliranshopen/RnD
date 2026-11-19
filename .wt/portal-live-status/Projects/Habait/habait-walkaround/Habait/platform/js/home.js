// The Rainbow landing page at the site root (plan development/plans/2026-11-08-rainbow-landing.md).
// - the hero film: starts only after the page has loaded (the poster is the LCP), 720p on small screens, poster only on Save-Data,
//   pauses off-screen, a pause/play button (WCAG 2.2.2); prefers-reduced-motion = no autoplay, the button plays it;
// - the route: «לסיור בפרויקט» is computed from project.json with the same helper as the old home card (js/target.js projectHref),
//   so it keeps the route of 1a54ce0: the hold with the orbit intro → the stop → every apartment marked → pick → enter;
// - the strings: this page's own he/en table (js/i18n.js untouched: getLang/setLang only).
import { loadProjects, loadProjectMeta } from './config.js';
import { getLang, setLang, pick } from './i18n.js';
import { capture } from './analytics.js';
import { DEV } from './dev.js';
import { projectHref, extUrl } from './target.js';

const PROJECT = 'rainbow';
const STR = {
  he: {
    skip: 'דילוג לתוכן', nav: 'ניווט', 'nav.experience': 'החוויה', 'nav.place': 'המיקום',
    'hero.eyebrow': 'תל אביב · על קו הים', 'hero.promise': 'מגדל מגורים על קו הים בתל אביב. סיירו בו לפני שהוא קם.',
    'cta.tour': 'לסיור בפרויקט',
    'video.pause': 'השהיית הסרטון', 'video.play': 'הפעלת הסרטון',
    'place.eyebrow': 'המיקום', 'place.title': 'על קו הים של תל אביב', 'place.lead': 'מגדל מגורים מול הים. סביבו, כפי שמסומן בהדמיה:',
    'place.list': 'מקומות בסביבה', 'place.port': 'נמל תל אביב', 'place.reading': 'פארק רידינג', 'place.marina': 'המרינה', 'place.beach': 'חוף הים', 'place.kochav': 'כוכב הצפון',
    'arch.eyebrow': 'האדריכלות', 'arch.title': 'המגדל והבניינים שלצידו',
    'cap.the2': 'המגדל בשעת ערב', 'cap.the3': 'מהרחוב', 'cap.the6': 'מבט על הגגות',
    'badge.render': 'הדמיה', 'finish.parquet': 'פרקט', 'finish.marble': 'שיש',
    'steps.eyebrow': 'החוויה', 'steps.title': 'מהשמיים, אל הסלון', 'steps.lead': 'סיור אחד בפרויקט, ישר מהדפדפן.',
    'step1.title': 'טיסה סביב המגדל', 'step1.text': 'סרט אווירי של המגדל והסביבה, מכל הכיוונים.',
    'step2.title': 'עצירה מול החזית', 'step2.text': 'הטיסה נעצרת מול המגדל, וכל הדירות מסומנות עליו. בוחרים דירה ורואים את פרטיה.',
    'step3.title': 'כניסה לדירה', 'step3.text': 'מהחזית נכנסים פנימה: סיור 360° בחדרים, עם תכנית ותלת־ממד.',
    'step4.title': 'שינוי עיצוב', 'step4.text': 'מחליפים ריצוף וגימורים בתוך הסיור, ורואים את הדירה מתחלפת.',
    'close.title': 'הטיסה מתחילה בלחיצה.',
    'foot.dev': 'יזם:', 'legal.more': 'לפרטים', 'legal.less': 'סגירה',
    'alt.the1': 'המגדל והבניין הנמוך לצידו מול הים, עם סימון נמל תל אביב, פארק רידינג, המרינה, חוף הים וכוכב הצפון',
    'alt.the2': 'המגדל בשעת ערב, מול הים', 'alt.the3': 'הבניינים הנמוכים מהרחוב, והמגדל מאחוריהם', 'alt.the6': 'מבט על הגגות',
    title: 'Rainbow תל אביב · Habait',
  },
  en: {
    skip: 'Skip to content', nav: 'Navigation', 'nav.experience': 'Experience', 'nav.place': 'Location',
    'hero.eyebrow': 'Tel Aviv · on the seafront', 'hero.promise': 'A seafront residential tower in Tel Aviv. Tour it before it rises.',
    'cta.tour': 'Tour the project',
    'video.pause': 'Pause the film', 'video.play': 'Play the film',
    'place.eyebrow': 'Location', 'place.title': 'On the Tel Aviv seafront', 'place.lead': 'A residential tower facing the sea. Around it, as marked on the render:',
    'place.list': 'Places nearby', 'place.port': 'Tel Aviv Port', 'place.reading': 'Reading Park', 'place.marina': 'The marina', 'place.beach': 'The beach', 'place.kochav': 'Kochav HaTsafon',
    'arch.eyebrow': 'Architecture', 'arch.title': 'The tower and the buildings beside it',
    'cap.the2': 'The tower at dusk', 'cap.the3': 'From the street', 'cap.the6': 'Over the rooftops',
    'badge.render': 'Render', 'finish.parquet': 'Parquet', 'finish.marble': 'Marble',
    'steps.eyebrow': 'The experience', 'steps.title': 'From the sky to the living room', 'steps.lead': 'One tour of the project, right in the browser.',
    'step1.title': 'Fly around the tower', 'step1.text': 'An aerial film of the tower and its surroundings, from every side.',
    'step2.title': 'A stop at the facade', 'step2.text': 'The flight stops in front of the tower with every apartment marked on it. Pick one and see its details.',
    'step3.title': 'Step inside', 'step3.text': 'From the facade you go in: a 360° tour of the rooms, with the plan and a 3D view.',
    'step4.title': 'Change the design', 'step4.text': 'Swap floors and finishes inside the tour and watch the apartment change.',
    'close.title': 'The flight starts with one tap.',
    'foot.dev': 'Developer:', 'legal.more': 'Details', 'legal.less': 'Close',
    'alt.the1': 'The tower and the low building beside it facing the sea, with Tel Aviv Port, Reading Park, the marina, the beach and Kochav HaTsafon marked',
    'alt.the2': 'The tower at dusk, facing the sea', 'alt.the3': 'The low buildings from the street, the tower behind them', 'alt.the6': 'Over the rooftops',
    title: 'Rainbow Tel Aviv · Habait',
  },
};
const s = (k) => (STR[getLang()] || STR.he)[k] ?? STR.he[k] ?? k;
const $ = (id) => document.getElementById(id);

// ---------- strings ----------
let meta = null;
function render() {
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = s(el.dataset.t); });
  document.querySelectorAll('[data-t-alt]').forEach((el) => { el.alt = s(el.dataset.tAlt); });
  document.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', s(el.dataset.tAria)); });
  document.title = s('title');
  const toggle = $('langToggle');
  toggle.textContent = getLang() === 'he' ? 'EN' : 'עב';
  toggle.setAttribute('aria-label', getLang() === 'he' ? 'English' : 'עברית');
  syncToggle();
  if (meta) {
    $('devName').textContent = pick(meta.developer) || '';
    const full = pick(meta.disclaimer) || '';
    $('legalLine').textContent = full.split(/(?<=\.)\s/)[0] || full;   // its own first sentence
    $('legalFull').textContent = full;
    $('legal').hidden = !full;
  }
}

// ---------- routes (project.json → the same hrefs as the old home card) ----------
function setRoutes(p) {
  const ext = p.meta.exterior || {};
  const here = new URL('./', location.href).toString();
  const tourBase = ext.params && ext.params.tour ? new URL(ext.params.tour, location.href) : null;
  const routes = {
    'tour-project': projectHref(p),
    hold: ext.url ? extUrl(p, ext) : projectHref(p),
  };
  document.querySelectorAll('[data-route]').forEach((a) => {
    const r = a.dataset.route;
    if (routes[r]) a.href = routes[r];
    else if (r === 'tour-room' && tourBase) {
      const u = new URL(tourBase);
      u.searchParams.set('room', a.dataset.room || 'living');
      u.searchParams.delete('video');
      u.searchParams.set('return', here);
      u.searchParams.set('from', 'landing');
      a.href = u.toString();
    }
    a.addEventListener('click', () => capture('project_open', { project: p.id, from: `landing-${a.id || r}` }));
  });
}

// ---------- the hero film ----------
const hero = $('hero');
const video = $('heroVideo');
const btn = $('heroToggle');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = Boolean(navigator.connection && navigator.connection.saveData);
let userPaused = false;   // the visitor's choice wins over autoplay and the off-screen resume
let inView = true;
function syncToggle() {
  const playing = !video.paused && !video.ended && video.currentSrc;
  btn.dataset.state = playing ? 'playing' : 'paused';
  btn.setAttribute('aria-label', s(playing ? 'video.pause' : 'video.play'));
}
function pickSrc() {
  // portrait screens (phones): the 2:3 crop around the tower; small landscape screens: 720p; the rest: 1080p
  if (innerWidth / innerHeight <= 0.8) return video.getAttribute('data-src-portrait');
  const w = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio || 1, 2);
  return video.getAttribute(innerWidth <= 900 || w <= 1400 ? 'data-src-720' : 'data-src-1080');
}
function load() {
  if (video.getAttribute('src')) return;
  video.src = pickSrc();
  video.load();
}
async function play() {
  load();
  try { await video.play(); } catch (e) { /* autoplay refused: the button stays on «play» */ }
  syncToggle();
}
video.addEventListener('playing', () => { hero.classList.add('is-playing'); syncToggle(); });
video.addEventListener('pause', syncToggle);
video.addEventListener('error', () => { hero.classList.remove('is-playing'); syncToggle(); });   // the poster stays: the page never goes black
btn.addEventListener('click', () => {
  if (video.paused) { userPaused = false; play(); }
  else { userPaused = true; video.pause(); }
});
new IntersectionObserver((es) => {
  inView = es[0].isIntersecting;
  $('top').classList.toggle('is-solid', es[0].intersectionRatio < 0.12);
  if (!inView && !video.paused) video.pause();
  else if (inView && video.paused && video.getAttribute('src') && !userPaused && !reduce.matches) play();
}, { threshold: [0, 0.12] }).observe(hero);
function autostart() {
  if (reduce.matches || saveData) { syncToggle(); return; }
  play();
}
if (document.readyState === 'complete') autostart(); else addEventListener('load', autostart, { once: true });

// ---------- boot ----------
$('langToggle').addEventListener('click', () => { setLang(getLang() === 'he' ? 'en' : 'he'); render(); });
if (DEV) { $('devFoot').hidden = false; $('a11ySlot').innerHTML = '<span class="home-todo">TODO (dev only): accessibility-statement link — text and target are Eliran\'s (§6)</span>'; }
setLang(getLang());
render();
try {
  const entry = (await loadProjects()).find((x) => x.id === PROJECT);
  if (entry) { meta = await loadProjectMeta(entry.dir); setRoutes({ ...entry, meta }); render(); }
} catch (e) { console.warn('landing: project.json not loaded; the in-page fallbacks stay', e); }
window.__rl = { video, routes: () => [...document.querySelectorAll('[data-route]')].map((a) => ({ id: a.id, href: a.href })) };
