// Card 25 (D3): the project landing page, A/B by link.
//   A = static renders + the lead form;  B = the 360 flight (flow.html in a same-origin frame) + the same lead form.
// The arm: ?v=a|b (campaign link) > the arm already registered in this tab > hash(session_id) -> 50/50.
// The arm is registered ONCE (analytics.setVariant): every later event of the tab, including the ones flow.html sends
// from inside the frame and apartment.html after the hand-off, carries `variant`.
// The pure helpers (hash32 / bucketOf / assignVariant / parseOverride / resolveVariant / fillVars) import in Node
// without a DOM (test/landing.test.mjs); the page boots only in a browser.
import { initAnalytics, capture, setVariant, variant as registeredVariant, sessionId, startDwell, setBaseProps } from './analytics.js';
import { renderLeadBlock, sheetEndpoint } from './lead.js';
import { getLang, setLang, pick, t, formatPrice } from './i18n.js';
import { loadProject, loadProjects, applyBrand } from './config.js';

// ---------------- assignment (pure) ----------------
// FNV-1a 32 over the session id, then the murmur3 finaliser (FNV's low bits alone are only the parity of the input).
export function hash32(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
export const SPLIT_A = 50; // percent of hashed sessions that see arm A (buckets 0..49)
export function bucketOf(sid) { return hash32(sid) % 100; }
export function assignVariant(sid) { return bucketOf(sid) < SPLIT_A ? 'a' : 'b'; }
export function parseOverride(search) {
  let v = null;
  try { v = new URLSearchParams(search || '').get('v'); } catch { v = null; }
  const s = v ? v.trim().toLowerCase() : '';
  return s === 'a' || s === 'b' ? s : null;
}
// -> { variant: 'a'|'b', via: 'link'|'session'|'hash' }
export function resolveVariant({ search = '', sessionId: sid = '', registered = null } = {}) {
  const o = parseOverride(search);
  if (o) return { variant: o, via: 'link' };
  if (registered === 'a' || registered === 'b') return { variant: registered, via: 'session' };
  return { variant: assignVariant(sid), via: 'hash' };
}

// ---------------- legal caption (pure) ----------------
export function fillVars(text, vars) {
  return String(text).replace(/\{([A-Z_]+)\}/g, (all, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '' ? String(vars[k]) : '—'));
}
const pickL = (o, l) => (o && typeof o === 'object' ? (o[l] || o.en || o.he || '') : (o || ''));
// Variables the fallback can know without the built apartment (the built apartment.json carries the real, filled text).
export function legalVars(meta, unit, lang) {
  const date = (/(\d{1,2}\.\d{1,2}\.\d{4})/.exec(String(unit?.note || '')) || [])[1] || null;
  return { DEVELOPER: pickL(meta?.developer, lang), PROJECT: pickL(meta?.name, lang), UNIT: unit?.id ?? null, PLAN_DATE: date, ARCHITECT: null, GEN_DATE: null, VERSION: null };
}

// ---------------- page strings (this page only; the shared ones stay in i18n.js) ----------------
const L = {
  he: {
    'gallery.title': 'הדמיות',
    'flight.full': 'פתיחה במסך מלא',
    'flight.hint': 'גררו כדי להסתכל סביב · לחצו על דירה בחזית',
    'facts.title': 'דירה {unit}',
    'facts.floor': 'קומה', 'facts.rooms': 'חדרים', 'facts.area': 'שטח', 'facts.outdoor': 'מרפסת', 'facts.price': 'מחיר', 'facts.status': 'סטטוס',
    'facts.m2': '{n} מ״ר',
    'lead.title': 'רוצים לשמוע עוד?',
    'lead.sub': 'השאירו פרטים או כתבו לנו בוואטסאפ, ונחזור אליכם.',
    'lightbox.close': 'סגירה',
    'fixture': 'תצוגת פיתוח',
    'legal.status': 'נוסח טיוטה: ממתין לחוות דעת עו״ד',
    'err': 'לא הצלחנו לטעון את הפרויקט',
    'frame.title': 'טיסת 360 סביב הפרויקט',
  },
  en: {
    'gallery.title': 'Renders',
    'flight.full': 'Open full screen',
    'flight.hint': 'Drag to look around · tap an apartment on the facade',
    'facts.title': 'Apartment {unit}',
    'facts.floor': 'Floor', 'facts.rooms': 'Rooms', 'facts.area': 'Area', 'facts.outdoor': 'Terrace', 'facts.price': 'Price', 'facts.status': 'Status',
    'facts.m2': '{n} m²',
    'lead.title': 'Want to hear more?',
    'lead.sub': 'Leave your details or message us on WhatsApp and we will get back to you.',
    'lightbox.close': 'Close',
    'fixture': 'Preview build',
    'legal.status': 'Draft wording: pending legal review',
    'err': 'Could not load the project',
    'frame.title': '360 flight around the project',
  },
};
function l(key, vars = {}) {
  const s = L[getLang()]?.[key] ?? L.he[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// ---------------- media: the built apartment (live) or the project fixture ----------------
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
// The apartment page's manifest (tools/build_zip.mjs) has the stills cut from the 360 panoramas and the filled caption.
async function loadMedia(ctx, unit) {
  const cover = ctx.meta.cover ? { id: 'cover', src: ctx.asset(ctx.meta.cover), name: ctx.meta.name } : null;
  try {
    const url = new URL(`_local/dist/${encodeURIComponent(ctx.id)}/${encodeURIComponent(unit.id)}/apartment.json`, location.href);
    const m = await getJSON(url);
    const base = new URL('.', url);
    const stills = (m.stills || []).filter((s) => s && s.src).map((s) => ({ id: s.id, name: s.name, src: new URL(s.src, base).toString() }));
    if (!stills.length || !m.legal?.full?.he) throw new Error('manifest without stills / caption');
    return { mode: 'live', cover, stills, legal: m.legal };
  } catch {
    // fixture fallback: the exterior stills / posters of the flight (each image once)
    const seen = new Set(cover ? [cover.src] : []);
    const stills = [];
    for (const s of ctx.flow.segments || []) {
      const img = s.kind === 'still' ? s.src : s.poster;
      if (!img || !/\.(png|jpe?g|webp|avif)$/i.test(img)) continue;
      const src = ctx.asset(img);
      if (seen.has(src)) continue;
      seen.add(src);
      stills.push({ id: s.id, name: s.title, src });
    }
    return { mode: 'fixture', cover, stills, legal: null };
  }
}

function legalText(media, ctx, unit, part, lang) {
  if (media.legal?.[part]?.[lang]) return media.legal[part][lang];
  const tpl = document.querySelector(`#legalTemplate`).content.querySelector(`[data-part="${part}"][data-lang="${lang}"]`);
  const raw = [...tpl.querySelectorAll('p')].map((p) => p.textContent).join('\n');
  return fillVars(raw, legalVars(ctx.meta, unit, lang));
}

// ---------------- the page ----------------
const S = { ctx: null, unit: null, media: null, arm: null, via: null, dwellStop: null };
const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v !== undefined && v !== null) e.setAttribute(k, v); }
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderText() {
  const { ctx, unit, media } = S;
  const lang = getLang();
  $('langToggle').textContent = lang === 'he' ? 'EN' : 'עב';
  document.title = `${pick(ctx.meta.name)} · Habait`;
  $('projectName').textContent = pick(ctx.meta.name);
  $('projectTagline').textContent = pick(ctx.meta.tagline);
  $('fixtureBadge').hidden = !ctx.meta.fixture;
  $('fixtureBadge').textContent = l('fixture');
  document.querySelectorAll('[data-l]').forEach((e) => { e.textContent = l(e.dataset.l); });
  const short = legalText(media, ctx, unit, 'short', lang);
  document.querySelectorAll('[data-legal-short]').forEach((e) => { e.textContent = short; });
  $('legalFull').innerHTML = '';
  legalText(media, ctx, unit, 'full', lang).split('\n').forEach((line, i) => $('legalFull').appendChild(el('p', i === 0 ? { class: 'legal-head' } : {}, line)));
  $('legalStatus').textContent = l('legal.status');
  // facts of the featured unit (same in both arms)
  $('factsTitle').textContent = l('facts.title', { unit: unit.id });
  const dl = $('factsList');
  dl.innerHTML = '';
  const row = (k, v) => { if (v === undefined || v === null || v === '') return; const d = el('div', { class: 'landing-fact' }); d.append(el('dt', {}, l(k)), el('dd', {}, String(v))); dl.appendChild(d); };
  row('facts.rooms', unit.rooms);
  row('facts.area', unit.area_m2 ? l('facts.m2', { n: unit.area_m2 }) : null);
  row('facts.outdoor', unit.outdoor_m2 ? l('facts.m2', { n: unit.outdoor_m2 }) : null);
  row('facts.floor', unit.floor);
  row('facts.price', formatPrice(unit.price, ctx.units.currency));
  row('facts.status', t(`status.${unit.status || 'unknown'}`));
  if (S.arm === 'a') renderGallery();
  renderLead();
}

function renderGallery() {
  const { media } = S;
  const hero = $('heroImg');
  const first = media.cover || media.stills[0];
  if (first) { hero.src = first.src; hero.alt = pick(first.name) || ''; }
  const g = $('gallery');
  g.innerHTML = '';
  for (const s of media.stills) {
    const b = el('button', { class: 'tile', type: 'button', 'data-room': s.id });
    const img = el('img', { src: s.src, alt: pick(s.name) || '', loading: 'lazy', decoding: 'async' });
    b.append(img, el('span', { class: 'tile-label' }, pick(s.name) || ''), el('span', { class: 'tile-legal' }, legalText(media, S.ctx, S.unit, 'short', getLang()).split('.')[0]));
    b.addEventListener('click', () => openLightbox(s));
    g.appendChild(b);
  }
}

function openLightbox(s) {
  const d = $('lightbox');
  $('lightboxImg').src = s.src;
  $('lightboxImg').alt = pick(s.name) || '';
  $('lightboxCaption').textContent = `${pick(s.name) || ''} · ${legalText(S.media, S.ctx, S.unit, 'short', getLang())}`;
  if (S.dwellStop) S.dwellStop();
  S.dwellStop = startDwell(s.id, { unit: S.unit.id, tab: 'gallery' });
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
function closeLightbox() {
  const d = $('lightbox');
  if (S.dwellStop) { S.dwellStop(); S.dwellStop = null; }
  if (typeof d.close === 'function' && d.open) d.close(); else d.removeAttribute('open');
}

function renderFlight() {
  const url = new URL('flow.html', location.href);
  url.searchParams.set('project', S.ctx.id);
  url.searchParams.set('lang', getLang());
  const frame = el('iframe', {
    src: url.toString(), title: l('frame.title'), allow: 'fullscreen; autoplay; gyroscope; accelerometer; magnetometer',
    allowfullscreen: '', loading: 'eager', referrerpolicy: 'same-origin',
  });
  frame.id = 'flightIframe';
  $('flightFrame').appendChild(frame);
  $('flightFull').href = url.toString();
}

function renderLead() {
  const { ctx, unit } = S;
  renderLeadBlock($('landingLead'), {
    project: ctx.id, projectName: pick(ctx.meta.name), unit,
    whatsappNumber: ctx.meta.leads?.whatsapp_number, webhookUrl: sheetEndpoint(ctx.meta),
  });
  // the same component as the apartment card in the flight: WhatsApp button + 'leave details' form (lead_click on open)
}

async function boot() {
  const q = new URLSearchParams(location.search);
  setLang(getLang());
  try {
    let pid = q.get('project');
    if (!pid) pid = (await loadProjects())[0]?.id;
    S.ctx = await loadProject(pid);
  } catch (e) {
    console.error(e);
    $('projectName').textContent = `${l('err')}: ${e.message}`;
    return;
  }
  const { ctx } = S;
  const units = ctx.units.units || [];
  S.unit = ctx.unitById.get(q.get('unit')) || units.find((u) => u.tour_url) || units[0];

  // 1. the arm (before anything is captured or the frame exists, so every event carries it)
  const r = resolveVariant({ search: location.search, sessionId: sessionId(), registered: registeredVariant() });
  S.arm = setVariant(r.variant);
  S.via = r.via;
  document.body.dataset.variant = S.arm;
  initAnalytics({ base: { project: ctx.id, lang: getLang(), page: 'landing' }, config: ctx.meta.analytics || {} });
  capture('project_open', { unit: S.unit.id, via: S.via });

  applyBrand(ctx.meta, ctx.dir, {}); // white-label colours only; no developer logo on the landing (D-WQ-18)
  S.media = await loadMedia(ctx, S.unit);
  $('variantA').hidden = S.arm !== 'a';
  $('variantB').hidden = S.arm !== 'b';
  if (S.arm === 'b') renderFlight();
  renderText();

  $('langToggle').addEventListener('click', () => {
    setLang(getLang() === 'he' ? 'en' : 'he');
    setBaseProps({ lang: getLang() });
    renderText();
  });
  $('lightboxClose').addEventListener('click', closeLightbox);
  $('lightbox').addEventListener('close', () => { if (S.dwellStop) { S.dwellStop(); S.dwellStop = null; } });
  $('lightbox').addEventListener('click', (ev) => { if (ev.target === $('lightbox')) closeLightbox(); });

  window.__landing = { variant: S.arm, via: S.via, session_id: sessionId(), unit: S.unit.id, media: S.media.mode, stills: S.media.stills.length };
  document.body.classList.add('ready');
}

if (typeof document !== 'undefined' && document.getElementById('legalTemplate')) boot();
