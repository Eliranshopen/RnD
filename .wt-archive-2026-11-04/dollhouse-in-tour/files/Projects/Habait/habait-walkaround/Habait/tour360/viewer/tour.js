/* Habait Tour360 — tour.js (T01 the tour, T08 the prepared changes, T09 the live typed change; board habait-tour360).
   Reads #tour-data ({ id, apartment, scenes, copy, edits, panoWidth }), builds the Pannellum multi-scene tour, the room strip,
   the floor-plan sheet, the language switch and the change panel. The three disclosure elements (#tour-badge, #tour-concept,
   #tour-ai-note) are re-filled from the copy pack in the current language on every render and are never hidden (root CLAUDE.md §6).
   Geometry: a room opens at its `heading`, pitch -2 (the source tour's visit()); a hotspot sits at yaw (u - 0.5) * 360 and pitch
   -12 - min(5, (v - 0.6) * 35) (the source tour's markerDirection) — PLAN.md D-T360-16, scenes.json coordinateNotes.
   Changes (PLAN.md §9): a prepared change is a small RGBA patch in panorama pixels, made offline by tools/edit-pano.py; a live
   change (viewer/edit-live.js, behind the unlock code) is a whole edited panorama kept only in this browser session. The page
   draws the chosen patches over the room's current look on a canvas and hands Pannellum the result as one more scene,
   `<room>[~liveN][~ids]`; the base panorama is never altered and the original is one tap away. */
(() => {
  'use strict';

  const data = JSON.parse(document.getElementById('tour-data').textContent);
  const params = new URLSearchParams(location.search);
  /* 2026-11-02 (Eliran via habait-ab: "שלא יהיה בלבול"): two levels. The project level = the building and its surroundings (the
     flyover on :8899, or this tour's own exterior nodes); the apartment level = this apartment only. `?scope=apartment` keeps
     only the apartment's scenes (strip, counter, plan, doors) and shows a "back to the building" link to `return`
     (default: the flyover). Without the param the tour is as before: it opens on the aerial node and walks the whole chain. */
  const scope = params.get('scope') === 'apartment' ? 'apartment' : 'project';
  // ?ui=min (habait-ba, 2.11 evening, Eliran: the buyer flow must feel calm): only the room name, the room strip, the floor switch,
  // the way back and the language stay; the tool cluster, the look toggle, the AI note, the counter/hint and the badge are hidden.
  // ?ui=min, or any arrival from the buyer flow (?from=flight | hold | platform, 1d's flow.html and ba's hold): the quiet chrome
  if (params.get('ui') === 'min' || ['flight', 'hold', 'platform'].includes(params.get('from'))) document.documentElement.classList.add('ui-min');
  if (['flight', 'hold', 'platform'].includes(params.get('from'))) document.documentElement.classList.add('ui-enter');   // the chrome fades in after the landing (1d, M1 v2)
  const scenes = scope === 'apartment' ? data.scenes.filter((s) => !s.exterior) : data.scenes;
  const returnUrl = scope === 'apartment' ? (params.get('return') || 'http://127.0.0.1:8899/') : null;
  const copy = data.copy;
  const apt = data.apartment;
  const edits = data.edits || {};
  const byId = Object.create(null);
  scenes.forEach((s, i) => { s.index = i; byId[s.id] = s; });

  const LANGS = ['he', 'en', 'fr'];
  let lang = LANGS.includes(params.get('lang')) ? params.get('lang') : 'he';
  const firstId = byId[params.get('room')] ? params.get('room') : (byId[apt.defaultScene] ? apt.defaultScene : scenes[0].id);
  /* the landing yaw of a deep link (2026-11-02, habait-98): `?yaw=` wins; else a room reached by `?room=` (the :8899 / :8850
     hand-off lands on terraceLiving) opens with the yaw the automatic hop lands with (its predecessor's autoYaw in exterior.json,
     so the hand-off and the descent face the same way: the slider and the living room, not the blank side wall at heading 0);
     else the scene's heading. */
  const firstYaw = (() => {
    const q = parseFloat(params.get('yaw'));
    if (Number.isFinite(q)) return q;
    if (!params.get('room')) return null;
    const pred = data.scenes.find((x) => x.autoNext === firstId && Number.isFinite(x.autoYaw));
    return pred ? pred.autoYaw : null;
  })();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const $ = (id) => document.getElementById(id);
  const pick = (map) => (map && (map[lang] || map.he)) || '';
  const ui = (key) => (copy.ui[key] ? pick(copy.ui[key]) : ''); // a key the pack lacks reads as nothing (T18l: `catalogRefused` until his words)
  // board dollhouse-in-tour (2026-11-03): the 3D dollhouse over the tour. Shown when the build carried it (data.dollhouse) and the
  // tour is not already inside the apartment page (from=apartment: that page has its own 3D tab)
  const DH_UI = { title: { he: 'תלת-ממד', en: '3D view', fr: 'Vue 3D' }, close: { he: 'סגירה', en: 'Close', fr: 'Fermer' } };
  const dhOn = Boolean(data.dollhouse) && params.get('from') !== 'apartment';
  const nameOf = (s) => pick(s.name);

  /* ── changes: prepared patches per room (edits.json) and live edits per room (this session only) ── */
  const roomEdits = (room) => (Array.isArray(edits[room]) ? edits[room] : []);
  const editDef = (room, id) => roomEdits(room).find((e) => e.id === id) || null;
  const byOrder = (room) => (a, b) => editDef(room, a).order - editDef(room, b).order;
  const active = Object.create(null);    // room → [prepared edit id]
  const live = Object.create(null);      // room → [{ url, img, label, meta }]  the live stack, newest last
  const original = Object.create(null);  // room → true while the visitor looks at the original again
  const composed = Object.create(null);  // scene key → blob: URL of the composed panorama
  const roomOf = (key) => String(key).split('~')[0];
  const activeIds = (room) => active[room] || [];
  const liveStack = (room) => live[room] || [];
  const changeCount = (room) => activeIds(room).length + liveStack(room).length;
  const editedKey = (room) => room + (liveStack(room).length ? '~live' + liveStack(room).length : '') + (activeIds(room).length ? '~' + activeIds(room).join('+') : '');
  /* WALKAROUND-QUALITY-PLAN.md card Q09 (D-WQ-17; the wording is his, OQ-1): the Original/Designed switch — the plain CG render of
     the room (the build's originalSet: the model the designed picture was skinned from, so both share one yaw frame) under its
     label, the designed picture under the AI label. It exists only when the build carries that set AND the copy pack carries his
     four strings; until then the page is exactly as before. In Original the change controls rest (changes are drawn on the
     designed picture) and every door leads to the next room's original. */
  const LOOK_KEYS = ['lookDesigned', 'lookOriginal', 'lookDesignedNote', 'lookOriginalNote'];
  const hasOriginal = Boolean(data.originalSet && data.originalSet.dir) && LOOK_KEYS.every((k) => copy.ui[k] && LANGS.every((l) => copy.ui[k][l]));
  let look = hasOriginal && params.get('look') === 'original' ? 'original' : 'designed';
  const origKey = (room) => room + '~orig';
  const sceneKey = (room) => (look === 'original' ? origKey(room) : original[room] ? room : editedKey(room));
  let pending = (params.get('change') || '').split(',').filter((id) => editDef(firstId, id));

  // The test hook the smoke screenshots and the paint proof read.
  const state = {
    ready: false, scene: firstId, sceneKey: firstId, lang, visited: [], viewer: null, rotating: false, interacted: false, loads: 0,
    edits: {}, live: {}, liveMeta: {}, original: false, applying: false, unlocked: false, hooks: null,
    catalog: Array.isArray(data.catalog) ? data.catalog : null, // the catalog items of a --catalog build (T14e), read by edit-live.js
    marker: null, // the marker the visitor tapped (T16c), its id while the pick bar is open
    markers: scenes.reduce((n, s) => n + (Array.isArray(s.markers) ? s.markers.length : 0), 0), // the count a proof reads
    // T17a (TEST-PLAN.md C9): the GPU's largest texture — the one number that says whether this device can show a 7K panorama
    maxTexture: (() => { try { const c = document.createElement('canvas'); const gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (!gl) return null; const n = gl.getParameter(gl.MAX_TEXTURE_SIZE); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return n; } catch (_) { return null; } })(),
  };
  state.look = look;
  state.lookSwitch = hasOriginal ? 'on' : data.originalSet ? 'waiting for the wording (OQ-1)' : 'no original set';
  window.__tour = state;
  // T18g (D-CAT-28): the 7K set on a desktop that can hold it — a wide, tall screen that is not a narrow touch device, and a GPU texture
  // limit above the set's width — the balanced set everywhere else; chosen once at load, read through one path by the scene config
  // and the live-change compose (the patches scale by panoWidth)
  const useFull = Boolean(data.fullSet && data.fullSet.dir) && window.innerWidth >= 1000 && window.innerHeight >= 600
    && !(navigator.maxTouchPoints > 1 && window.innerWidth < 1200) && (state.maxTexture || 0) >= (data.fullSet ? data.fullSet.width : Infinity);
  // a floor finish with its own panorama set (data.floorSets[floor].dir, Habait studio 2026-11-01) replaces the balanced set
  const floorParam = params.get('floor');
  const floorDir = data.floorSets && floorParam && data.floorSets[floorParam] && data.floorSets[floorParam].dir ? data.floorSets[floorParam].dir : null;
  const panoPath = (asset) => (floorDir || (useFull ? data.fullSet.dir : 'panos')) + '/' + asset + '.webp';
  state.panoSet = useFull ? 'full' : 'balanced';
  state.fullSet = data.fullSet || null;
  /* WALKAROUND-QUALITY-PLAN.md card Q06: the scene's picture as tools/make-tiles.mjs's cube (build-tour carries it with --engine when
     the apartment has it). The engine streams it while the scene shows exactly that picture (`of`); a composed (changed) scene is a
     plain panorama as before, and Pannellum never sees tiles. The equirect set above stays what the changes are drawn on. */
  const canTile = Boolean(data.tiles && data.tiles.assets && window.pannellum && window.pannellum.tiles === true);
  const tilesOf = (s) => {
    const t = canTile ? data.tiles.assets[s.asset] : null;
    return t ? { of: panoPath(s.asset), dir: data.tiles.dir + '/' + s.asset, levels: t.levels, preview: t.preview, ext: t.ext || 'webp', noMipmapFrom: t.noMipmapFrom || null } : null;
  };
  state.tiles = canTile;
  const visited = new Set();
  let viewer = null;
  let firstLoad = true;
  let walkPill = 0; // card Q08: the loading pill during a walk-in waits 700 ms (the walk hides the swap) and shows only for a slow room
  const hsEntries = [];
  const hsByTarget = Object.create(null);
  const pscenes = {};
  /* ── the markers (T16c, CATALOG-PLAN.md §10.3): a ring on every replaceable piece of a --catalog build, a Pannellum hotspot of
     its own kind. Its direction, outline and name follow the room's live stack: a replacement moves the ring onto the product and
     names it after the item (meta.marker.after); undo, reset and the original fall back through the stack to the scan's record.
     The rings show only once the live change is unlocked (a tap is a paid turn) and hide while the view moves. ── */
  const TARGET_KEY = { sofa: 'catalogTargetSofa', armchair: 'catalogTargetArmchair', coffee_table: 'catalogTargetCoffeeTable', dining_table: 'catalogTargetDiningTable', chair: 'catalogTargetChair' };
  const mkEntries = [];
  const markerHs = Object.create(null); // room/id → the hotspot config (shared by the room's live scenes, like the door markers)
  const roomMarkers = (room) => (byId[room] && Array.isArray(byId[room].markers) ? byId[room].markers : []);
  const itemOf = (id) => (state.catalog ? state.catalog.find((i) => i.id === id) || null : null);
  const targetWords = (category) => ui(TARGET_KEY[category] || '') || String(category || '').replace('_', ' ');
  /** The marker as it stands now: the scan's record, then every live change of the room that moved it, in order; the original shows the scan's. */
  function markerState(room, id) {
    const def = roomMarkers(room).find((m) => m.id === id);
    if (!def) return null;
    let st = { id, category: def.category, yaw: def.yaw, pitch: def.pitch, span_deg: def.span_deg, outlines: def.outlines, count: def.count, cut_sides: def.cut_sides || null, piece: def.piece || null, item: null }; // cut_sides: the scan's record of the view sides the piece ran past (T18a); piece: one piece seen from several scenes (T18d)
    if (!original[room]) for (const e of liveStack(room)) if (e.meta && e.meta.marker && e.meta.marker.id === id && e.meta.marker.after) st = Object.assign({}, st, e.meta.marker.after, { id, category: def.category });
    return st;
  }
  const markerName = (st) => { const it = st.item ? itemOf(st.item) : null; return it ? (lang === 'he' && it.name_he ? it.name_he : it.name) : targetWords(st.category); };
  function makeMarker(div, args) {
    const ring = el('span', { class: 't-mk-ring', 'aria-hidden': 'true' });
    const chip = el('span', { class: 't-mk-chip', dir: 'auto' });
    chip.hidden = true;
    div.append(ring, chip);
    div.setAttribute('role', 'button');
    // T18k (F11): a ring is the page's first keyboard stop once the page is unlocked (a positive tabindex, on purpose: the chrome's
    // twenty-odd controls came before the rings, 26 Tabs to the first); a locked page's rings are invisible and take no focus at all
    div.tabIndex = state.unlocked ? 1 : -1;
    div.dataset.marker = args.id;
    div.dataset.room = args.room;
    const entry = { div, chip, room: args.room, id: args.id };
    mkEntries.push(entry);
    paintMarker(entry);
    div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); markerClick(e, args); } });
  }
  function paintMarker(entry) {
    const st = markerState(entry.room, entry.id);
    if (!st) return;
    const name = markerName(st);
    entry.div.setAttribute('aria-label', ui('catalogMarker').replace('{target}', name));
    entry.div.title = name;
    entry.chip.textContent = name;
    entry.div.classList.toggle('is-open', state.marker === entry.id && state.scene === entry.room);
    entry.chip.hidden = !(state.marker === entry.id && state.scene === entry.room);
  }
  function markerClick(e, args) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!state.unlocked || state.applying || args.room !== state.scene) return;
    document.dispatchEvent(new CustomEvent('tour:marker', { detail: { room: args.room, id: args.id } }));
  }
  /** The hotspots follow the state: a ring moves with its piece; every label is re-painted. Called from renderChange (every look change). */
  function refreshMarkers() {
    for (const k of Object.keys(markerHs)) {
      const [room, id] = k.split('/');
      const st = markerState(room, id);
      if (!st) continue;
      markerHs[k].yaw = st.yaw;
      markerHs[k].pitch = st.pitch;
    }
    for (let i = mkEntries.length - 1; i >= 0; i--) {
      if (!mkEntries[i].div.isConnected) mkEntries.splice(i, 1);
      else { mkEntries[i].div.tabIndex = state.unlocked ? 1 : -1; paintMarker(mkEntries[i]); }
    }
  }
  function setMoving(on) { $('pano').classList.toggle('is-moving', Boolean(on)); }

  /* ── geometry ───────────────────────────────────────────────────────────────── */
  const fitHfov = () => {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const v = (85 * Math.PI) / 180; // 2026-11-01 (Eliran): a wider first look — the room arrives more zoomed out
    const h = (2 * Math.atan(Math.tan(v / 2) * aspect) * 180) / Math.PI;
    return Math.max(60, Math.min(118, h));
  };
  const hsYaw = (u) => (u - 0.5) * 360;
  const hsPitch = (v) => -12 - Math.min(5, (v - 0.6) * 35);
  /* arrival-maths:begin — engine/test/run.mjs evaluates this block as written, against tools/make-scenes.mjs's bearing */
  const bearing = (a, b) => (Math.atan2(b.plan.x - a.plan.x, a.plan.y - b.plan.y) * 180) / Math.PI;
  const wrap180 = (d) => { const r = ((((d + 180) % 360) + 360) % 360) - 180; return r === -180 ? 180 : r; };
  /** WALKAROUND-QUALITY-PLAN.md card Q08: where a door leaves the visitor looking — the direction of travel (this camera → that
      camera on the plan) in the target panorama's yaw frame, whose yaw 0 looks at plan bearing centreBearingDeg (scenes.json,
      tools/make-scenes.mjs); a scene without that bearing keeps its own heading, as before */
  const arriveYaw = (s, t) => (Number.isFinite(t.centreBearingDeg) && s.plan && t.plan ? wrap180(bearing(s, t) - t.centreBearingDeg) : t.heading); // an exterior node (no plan position, 2026-11-02) keeps its heading
  /* arrival-maths:end */

  /* ── small DOM helpers ──────────────────────────────────────────────────────── */
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    if (children) n.append(...children);
    return n;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    return n;
  }
  /** Writes a "{n} / {total} …" template with the number run isolated LTR (an RTL paragraph would otherwise show 13 / 1). */
  function countInto(node, tpl, n, total) {
    node.textContent = '';
    const token = '{n} / {total}';
    const num = el('span', { class: 't-num', dir: 'ltr', text: n + ' / ' + total });
    const i = tpl.indexOf(token);
    if (i < 0) { node.append(num); return; }
    node.append(tpl.slice(0, i), num, tpl.slice(i + token.length));
  }

  /* ── the room strip and the plan sheet (built once, re-labelled per language) ─ */
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const UNDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
  const cards = [];
  const strip = $('t-strip');
  const layerIndex = (s) => scenes.filter((x) => Boolean(x.exterior) === Boolean(s.exterior)).indexOf(s); // numbering within the layer (2026-11-02)
  for (const s of scenes) {
    const num = el('span', { class: 't-card-num', text: String(layerIndex(s) + 1).padStart(2, '0') });
    const name = el('span', { class: 't-card-name' });
    const check = el('span', { class: 't-card-check', 'aria-hidden': 'true' });
    check.innerHTML = CHECK;
    check.hidden = true;
    const img = el('img', { src: 'thumbs/' + s.asset + '.webp', alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
    const btn = el('button', { type: 'button', class: 't-card' }, [img, num, name, check]);
    btn.addEventListener('click', () => go(s.id, true));
    strip.append(el('div', { role: 'listitem' }, [btn]));
    cards.push({ s, btn, name, check });
  }

  const plan = $('t-plan');
  const [vbX, vbY, vbW, vbH] = apt.plan.viewBox;
  plan.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
  plan.append(svg('image', { href: 'plan/' + apt.plan.image.split('/').pop(), x: 0, y: 0, width: apt.plan.imageSize[0], height: apt.plan.imageSize[1] }));
  const pins = [];
  for (const s of scenes) {
    if (!s.plan) continue; // an exterior 360 node (the flyover chain, 2026-11-02) has no place on the apartment plan
    const g = svg('g', { class: 't-pin', role: 'button', tabindex: '0' });
    g.append(svg('circle', { cx: s.plan.x, cy: s.plan.y, r: 30 }));
    const t = svg('text', { x: s.plan.x, y: s.plan.y + 1 });
    t.textContent = String(layerIndex(s) + 1);
    g.append(t);
    const enter = () => { closeSheet(); go(s.id, true); };
    g.addEventListener('click', enter);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } });
    plan.append(g);
    pins.push({ s, g });
  }
  /* WALKAROUND-QUALITY-PLAN.md card Q09: the view cone on the plan sheet — where the visitor looks, PSV's yaw mapped to the plan
     bearing (a panorama's yaw 0 looks at its centreBearingDeg), opening as wide as the view; under the pins. Drawn only for a scene
     that carries that bearing (no guessed direction). The compass waits for the plan's north (no north angle in the data yet). */
  const CONE_R = 150; // plan pixels: about 1.7 m on apt846's sheet (0.9 px a cm)
  const cone = svg('path', { class: 't-cone', 'aria-hidden': 'true', d: '' });
  plan.insertBefore(cone, pins.length ? pins[0].g : null);
  function renderCone() {
    const s = byId[state.scene];
    if (!viewer || !s || !Number.isFinite(s.centreBearingDeg)) { cone.setAttribute('d', ''); return; }
    const b = s.centreBearingDeg + viewer.getYaw();
    const h = Math.min(170, viewer.getHfov());
    const D = Math.PI / 180, x = s.plan.x, y = s.plan.y;
    const p = (deg) => (x + CONE_R * Math.sin(deg * D)).toFixed(1) + ' ' + (y - CONE_R * Math.cos(deg * D)).toFixed(1);
    cone.setAttribute('d', `M ${x} ${y} L ${p(b - h / 2)} A ${CONE_R} ${CONE_R} 0 0 1 ${p(b + h / 2)} Z`);
    state.cone = { bearing: wrap180(b), hfov: h, compassBearing: Number.isFinite(apt.plan.northDeg) ? ((b - apt.plan.northDeg) % 360 + 360) % 360 : null }; // what a proof reads
  }
  /* card Q09: the compass — the plan's north (apartment.json plan.northDeg, read off the sales plan's own north arrow), a needle in
     the sheet's top-left corner with the letter of the language; none when the apartment carries no north */
  let compassText = null;
  if (Number.isFinite(apt.plan.northDeg)) {
    const n = apt.plan.northDeg, DR = Math.PI / 180;
    const g = svg('g', { class: 't-compass', 'aria-hidden': 'true', transform: `translate(${vbX + 92} ${vbY + 92})` });
    g.append(svg('circle', { r: 46 }));
    g.append(svg('path', { d: 'M 0 -40 L 13 12 L 0 3 L -13 12 Z', transform: `rotate(${n})` }));
    compassText = svg('text', { x: (72 * Math.sin(n * DR)).toFixed(1), y: (-72 * Math.cos(n * DR)).toFixed(1) });
    g.append(compassText);
    plan.append(g);
  }
  const list = $('t-plan-list');
  const items = [];
  for (const s of scenes) {
    const nm = el('span');
    const b = el('button', { type: 'button', class: 't-plan-item' }, [el('span', { class: 't-plan-num', text: String(s.index + 1) }), nm]);
    b.addEventListener('click', () => { closeSheet(); go(s.id); });
    list.append(el('div', { role: 'listitem' }, [b]));
    items.push({ s, b, nm });
  }

  /* ── hotspots: Pannellum calls this for each link of the scene it is drawing ─── */
  function makeHotspot(div, args) {
    const toId = typeof args === 'string' ? args : args.to;
    const door = typeof args === 'string' ? null : args.hs;
    const ring = el('span', { class: 't-hs-ring' });
    const label = el('span', { class: 't-hs-label', dir: 'auto' });
    div.append(ring, label);
    div.setAttribute('role', 'button');
    div.tabIndex = 0;
    const entry = { div, label, toId };
    hsEntries.push(entry);
    paintHotspot(entry);
    div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterDoor(door, toId); } });
  }
  /** A door taken from the keyboard goes the way a tap does (card Q08): the engine walks in (walkTo); Pannellum swaps as its own
      click does. Both arrive facing the direction of travel (the hotspot's targetYaw). */
  function enterDoor(hs, toId) {
    if (!viewer) return;
    if (!hs) { go(toId); return; }
    if (roomOf(hs.sceneId) === roomOf(viewer.getScene())) return;
    state.interacted = true;
    if (typeof viewer.walkTo === 'function') viewer.walkTo(hs);
    else viewer.loadScene(hs.sceneId, hs.targetPitch, hs.targetYaw, hs.targetHfov);
  }
  function paintHotspot(entry) {
    const nm = nameOf(byId[entry.toId]);
    entry.label.textContent = nm;
    entry.div.setAttribute('aria-label', ui('enterRoom').replace('{room}', nm));
  }
  /** A marker's target is read by Pannellum at click time, so a room with changes is entered with them still on. */
  function retarget(room) {
    for (const hs of hsByTarget[room] || []) hs.sceneId = sceneKey(room);
  }

  /* ── render ─────────────────────────────────────────────────────────────────── */
  function renderStatic() {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = ui('title') + ' · ' + pick(apt.title);
    // the disclosure — permanent, every language, every scene
    $('tour-badge').textContent = pick(copy.badge);
    $('tour-concept').textContent = pick(copy.conceptLine);
    $('t-ai-text').textContent = pick(copy.aiNote);
    // chrome labels
    $('pano').setAttribute('aria-label', ui('panoLabel'));
    $('t-lang').setAttribute('aria-label', ui('language'));
    for (const b of document.querySelectorAll('#t-lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    const label = (id, key) => { const n = $(id); n.setAttribute('aria-label', ui(key)); n.title = ui(key); };
    label('t-plan-btn', 'floorPlan');
    { const t3 = pick(DH_UI.title); const b3 = $('t-3d-btn'); b3.setAttribute('aria-label', t3); b3.title = t3; $('t-3d-title').textContent = t3; $('t-3d-close').setAttribute('aria-label', pick(DH_UI.close)); }
    label('t-zoom-in', 'zoomIn');
    label('t-zoom-out', 'zoomOut');
    label('t-rotate', 'autoRotate');
    label('t-reset', 'resetView');
    label('t-full', 'fullscreen');
    label('t-prev', 'prev');
    label('t-next', 'next');
    if (byId[state.scene]) renderReturn(byId[state.scene]);
    label('t-sheet-close', 'close');
    label('t-change-close', 'close');
    strip.setAttribute('aria-label', ui('rooms'));
    $('t-sheet-title').textContent = ui('floorPlan');
    $('t-sheet-hint').textContent = ui('floorPlanHint');
    plan.setAttribute('aria-label', ui('floorPlan'));
    if (compassText) compassText.textContent = ui('north'); // card Q09
    list.setAttribute('aria-label', ui('rooms'));
    $('t-retry').textContent = ui('tryAgain');
    $('t-error-text').textContent = ui('error');
    // the change panel
    $('t-change-btn-text').textContent = ui('changeOpen');
    $('t-change-title').textContent = ui('changeTitle');
    $('t-change-hint').textContent = ui('changeHint');
    $('t-change-list').setAttribute('aria-label', ui('changeExamples'));
    const input = $('t-change-input');
    input.placeholder = ui(state.unlocked ? 'changeType' : 'changeSoon');
    input.setAttribute('aria-label', input.placeholder);
    $('t-change-apply').textContent = ui('changeApply');
    const bar = $('t-bar-input');
    bar.placeholder = ui('changeType');
    bar.setAttribute('aria-label', ui('changeType'));
    $('t-bar-apply').textContent = ui('changeApply');
    $('t-undo-text').textContent = ui('changeUndo');
    $('t-undo').title = ui('changeUndo');
    $('t-change-note').textContent = ui('changeScope');
    $('t-change-reset').textContent = ui('changeReset');
    for (const c of cards) {
      c.name.textContent = nameOf(c.s);
      c.btn.setAttribute('aria-label', ui('enterRoom').replace('{room}', nameOf(c.s)));
    }
    for (const p of pins) p.g.setAttribute('aria-label', (p.s.index + 1) + ' · ' + nameOf(p.s));
    for (const it of items) it.nm.textContent = nameOf(it.s);
    for (let i = hsEntries.length - 1; i >= 0; i--) {
      if (!hsEntries[i].div.isConnected) hsEntries.splice(i, 1);
      else paintHotspot(hsEntries[i]);
    }
    refreshMarkers();
    renderLook();
    if (!state.ready) $('t-loading-text').textContent = ui('loadingFirst');
  }

  /** card Q09: the switch's two buttons and the label line under it, in the current language (his words, OQ-1) */
  function renderLook() {
    const box = $('t-look');
    if (!hasOriginal || (byId[state.scene] && byId[state.scene].exterior)) { box.hidden = true; return; } // an exterior node has no "original" to show (2026-11-02)
    box.hidden = false;
    box.setAttribute('aria-label', ui('lookDesigned') + ' / ' + ui('lookOriginal'));
    for (const b of box.querySelectorAll('button')) {
      b.textContent = ui(b.dataset.look === 'original' ? 'lookOriginal' : 'lookDesigned');
      b.setAttribute('aria-pressed', String(b.dataset.look === look));
    }
    $('t-look-note').textContent = ui(look === 'original' ? 'lookOriginalNote' : 'lookDesignedNote');
  }
  /** card Q09: the same view, the other picture of the room; the doors follow; the tour's own fade (instant under reduced motion) */
  function setLook(next) {
    if (!hasOriginal || next === look || !viewer || !state.ready || state.applying || !viewer.isLoaded()) return;
    look = next;
    state.look = next;
    for (const s of scenes) retarget(s.id);
    renderLook();
    renderChange();
    syncUrl();
    viewer.loadScene(sceneKey(state.scene), viewer.getPitch(), viewer.getYaw(), viewer.getHfov());
  }

  /** The change row and the panel's list, for the room on screen. */
  function renderChange() {
    const room = state.scene;
    const defs = roomEdits(room);
    const ids = activeIds(room);
    const stack = liveStack(room);
    const n = ids.length + stack.length;
    const unlocked = state.unlocked;
    $('t-actions').hidden = (defs.length === 0 && !unlocked) || look === 'original'; // card Q09: no change controls on the original
    if (unlocked) $('t-change-bar').hidden = look === 'original';
    $('t-undo').hidden = !(unlocked && stack.length);
    const count = $('t-change-count');
    count.hidden = n === 0;
    count.textContent = String(n);
    const cmp = $('t-compare');
    cmp.hidden = n === 0;
    cmp.setAttribute('aria-pressed', String(Boolean(original[room])));
    $('t-compare-text').textContent = original[room] ? ui('changeShowChanges') : ui('changeShowOriginal');
    $('t-change-reset').hidden = n === 0;
    const box = $('t-change-list');
    box.textContent = '';
    stack.forEach((entry, i) => {
      const isLast = i === stack.length - 1;
      const mark = el('span', { class: 't-change-mark', 'aria-hidden': 'true' });
      mark.innerHTML = isLast ? UNDO : CHECK;
      const b = el('button', { type: 'button', class: 't-change-item is-live', 'aria-pressed': 'true' },
        [el('span', { class: 't-change-label', dir: 'auto' }, [el('span', { class: 't-change-tag', text: ui('changeLiveTag') }), document.createTextNode(entry.label)]), mark]);
      if (isLast) { b.title = ui('changeUndo'); b.setAttribute('aria-label', ui('changeUndo') + ': ' + entry.label); b.addEventListener('click', () => undoLive(room)); }
      else b.disabled = true;
      box.append(b);
    });
    for (const d of defs) {
      const on = ids.includes(d.id);
      const mark = el('span', { class: 't-change-mark', 'aria-hidden': 'true' });
      mark.innerHTML = on ? CHECK : PLUS;
      const b = el('button', { type: 'button', class: 't-change-item', 'aria-pressed': String(on), 'data-edit': d.id },
        [el('span', { class: 't-change-label', dir: 'auto', text: pick(d.label) }), mark]);
      b.addEventListener('click', () => toggleEdit(room, d.id));
      box.append(b);
    }
    const snap = {};
    for (const r of Object.keys(active)) if (active[r].length) snap[r] = active[r].slice();
    state.edits = snap;
    const liveSnap = {}; const metaSnap = {};
    for (const r of Object.keys(live)) if (live[r].length) { liveSnap[r] = live[r].map((e) => e.label); metaSnap[r] = live[r].map((e) => e.meta); }
    state.live = liveSnap; state.liveMeta = metaSnap;
    state.original = Boolean(original[room]);
    refreshMarkers();
    document.dispatchEvent(new CustomEvent('tour:change')); // the live script redraws the item card from liveMeta (T14e)
  }

  /* 2026-11-02 (Eliran via habait-98, 12:05): two layers that never share a strip — the project layer (the exterior 360 nodes:
     the intro orbit, the hold at the tower, the descent) and the apartment layer (its rooms). The strip, the counter and the
     arrows work inside the current layer; from the rooms a "back to the building" pill returns to the hold node. */
  const layerOf = (s) => (s.exterior ? 'project' : 'apartment');
  const layerScenes = (s) => scenes.filter((x) => layerOf(x) === layerOf(s));
  const holdId = (scenes.find((x) => x.exterior && x.hold) || scenes.find((x) => x.exterior) || {}).id || null;
  function renderRoom() {
    const s = byId[state.scene];
    $('t-zone').textContent = pick(s.zone);
    $('t-room').textContent = nameOf(s);
    $('t-apt').textContent = pick(apt.title);
    const layer = layerScenes(s);
    countInto($('t-count'), ui('viewpoints'), layer.indexOf(s) + 1, layer.length);
    const sub = $('t-hint');
    const seen = layer.filter((x) => visited.has(x.id)).length;
    if (!state.interacted && visited.size <= 1) sub.textContent = fine ? ui('dragHint') + ' · ' + ui('markerHint') : ui('dragHint');
    else countInto(sub, ui('explored'), seen, layer.length);
    for (const c of cards) {
      const cur = c.s.id === s.id;
      c.btn.parentElement.hidden = layerOf(c.s) !== layerOf(s);
      if (cur) c.btn.setAttribute('aria-current', 'true'); else c.btn.removeAttribute('aria-current');
      c.check.hidden = !visited.has(c.s.id) || cur;
    }
    $('t-plan-btn').hidden = Boolean(s.exterior); // no plan sheet outside the apartment
    $('t-3d-btn').hidden = !dhOn || Boolean(s.exterior); // board dollhouse-in-tour: the 3D view of the apartment, inside it
    renderReturn(s);
    for (const p of pins) p.g.classList.toggle('is-current', p.s.id === s.id);
    renderCone();
    for (const it of items) { if (it.s.id === s.id) it.b.setAttribute('aria-current', 'true'); else it.b.removeAttribute('aria-current'); }
    renderChange();
    if (state.ready) renderVideoBar();
    const curCard = cards[s.index].btn;
    try { curCard.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced || !state.ready ? 'auto' : 'smooth' }); } catch (_) { /* old engines */ }
  }

  function showLoading(on, text, final) {
    const box = $('t-loading');
    box.classList.toggle('is-final', Boolean(on && final)); // T18j: a final message shows no spinner
    if (on) {
      $('t-loading-text').textContent = text || (firstLoad ? ui('loadingFirst') : ui('loadingRoom').replace('{room}', nameOf(byId[state.scene])));
      box.classList.toggle('is-small', !firstLoad);
      box.classList.remove('is-hidden');
    } else {
      box.classList.add('is-hidden');
      if (firstLoad) { firstLoad = false; window.setTimeout(() => box.classList.add('is-small'), 450); }
    }
  }
  function showError() {
    state.applying = false;
    showLoading(false);
    $('t-error-text').textContent = ui('error');
    $('t-retry').textContent = ui('tryAgain');
    $('t-error').hidden = false;
  }

  function syncUrl() {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('room', state.scene);
      if (lang === 'he') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
      const ids = activeIds(state.scene);
      if (ids.length) u.searchParams.set('change', ids.join(',')); else u.searchParams.delete('change');
      if (look === 'original') u.searchParams.set('look', 'original'); else u.searchParams.delete('look'); // card Q09
      if (floor && floors.length > 1) u.searchParams.set('floor', floor); else u.searchParams.delete('floor');
      window.history.replaceState(null, '', u);
    } catch (_) { /* file:// or a sandbox: the URL is a convenience only */ }
  }

  /* the way back to the project level: in scope=apartment an outside link (`return`, the flyover); otherwise, from a room, the
     hold node of this tour's own project layer. The pack's `backToBuilding` wording when it has one; the skip pill likewise. */
  const WORDS = { backToBuilding: { he: 'חזרה לבניין', en: 'Back to the building', fr: "Retour à l'immeuble" }, skipIntro: { he: 'דלג', en: 'Skip', fr: 'Passer' } };
  const word = (k) => ui(k) || WORDS[k][lang] || WORDS[k].he;
  function renderReturn(s) {
    const r = $('t-return');
    const inRoom = !s.exterior && holdId && scope !== 'apartment';
    r.hidden = !(returnUrl || inRoom);
    // embedded (the platform's apartment page puts the tour in an iframe, card 23): the way back must replace the PAGE, not the frame
    if (returnUrl) { r.href = returnUrl; r.onclick = null; if (window.self !== window.top) r.target = '_top'; else r.removeAttribute('target'); }
    else if (inRoom) { r.href = '#'; r.onclick = (e) => { e.preventDefault(); autoOff = true; go(holdId); }; }
    r.textContent = word('backToBuilding');
    const k = $('t-skip'); k.hidden = !(auto.running && holdId); k.textContent = word('skipIntro');
  }

  /* ── the automatic passages (2026-11-02): a scene with `autoNext` moves on by itself after `autoDwellMs` — the intro orbit of the
     project (aerial → o1…o5 → the hold at the tower) and, after the tap on the apartment, the descent (45 m → 25 m → facade →
     outside the terrace → the sun terrace). The buyer looks around meanwhile: the view direction is carried from node to node.
     Choosing a card, an arrow or a pin means browsing by hand: the automatics stop until the next door tap. `?auto=0` disables. */
  const auto = { timer: 0, running: false };
  let autoOff = params.get('auto') === '0';
  function autoArm() {
    window.clearTimeout(auto.timer);
    const s = byId[state.scene];
    const next = s && s.autoNext && byId[s.autoNext];
    auto.running = Boolean(next) && !autoOff;
    if (!auto.running) { if (state.ready) renderReturn(s); return; }
    renderReturn(s);
    auto.timer = window.setTimeout(() => {
      if (autoOff || !viewer || roomOf(viewer.getScene()) !== s.id) return;
      // outside, the look direction is carried (the tower stays where the eye left it); the last hop into a room faces the room
      if (next.exterior) viewer.loadScene(sceneKey(next.id), viewer.getPitch(), viewer.getYaw(), viewer.getHfov());
      else viewer.loadScene(sceneKey(next.id), -2, Number.isFinite(s.autoYaw) ? s.autoYaw : next.heading, fitHfov()); // autoYaw: the room's view, placed by hand
    }, Number.isFinite(s.autoDwellMs) ? s.autoDwellMs : 1000);
  }
  function autoSkip() { autoOff = true; window.clearTimeout(auto.timer); auto.running = false; if (holdId) go(holdId); }

  /* ── navigation ─────────────────────────────────────────────────────────────── */
  function go(id, byHand) {
    if (!viewer || !byId[id] || id === roomOf(viewer.getScene())) return;
    state.interacted = true;
    if (byHand) { autoOff = true; window.clearTimeout(auto.timer); auto.running = false; }
    viewer.loadScene(sceneKey(id), -2, byId[id].heading, fitHfov());
  }
  function step(delta) {
    const layer = layerScenes(byId[state.scene]);
    const i = (layer.indexOf(byId[state.scene]) + delta + layer.length) % layer.length;
    go(layer[i].id, true);
  }
  function setRotating(on) {
    state.rotating = Boolean(on) && !reduced;
    if (viewer) { if (state.rotating) viewer.startAutoRotate(-2.2); else viewer.stopAutoRotate(); }
    $('t-rotate').setAttribute('aria-pressed', String(state.rotating));
    if (!state.rotating) window.setTimeout(() => { if (!state.rotating) setMoving(false); }, 500); // T18k (F11): the rings stay on through the auto-rotate; a drag hides them
  }
  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    state.lang = next;
    renderStatic();
    renderRoom();
    syncUrl();
  }

  /* ── the sheets (floor plan · change panel) ─────────────────────────────────── */
  const SHEETS = ['t-sheet', 't-change'];
  let returnFocus = null;
  function openSheet(id, focusId) {
    closeSheet();
    returnFocus = document.activeElement;
    $(id).hidden = false;
    document.documentElement.classList.add('has-dialog'); // T18m (F16, D-CAT-26): the permanent lines rise above the backdrop
    if (id === 't-sheet') renderCone(); // card Q09: the cone as the view stands now
    placeSheet();
    $(focusId).focus();
  }
  /** board habait-walkaround T15: the sheet starts below the concept line wherever it ends (two lines in he/fr, three in en);
      T19c (F-5): the plan then gives up height until all thirteen rooms are in view, as on the design link. T19d re-check: where
      even a 140 px plan cannot make them fit (a phone on its side, a small phone) the plan keeps its full size and the sheet
      scrolls, as the design link's does — a thin strip of a plan helped no one */
  function placeSheet() {
    document.documentElement.style.setProperty('--concept-bottom', Math.ceil($('tour-concept').getBoundingClientRect().bottom) + 'px');
    if ($('t-sheet').hidden) return;
    const panel = $('t-sheet').querySelector('.t-sheet-panel');
    const plan = $('t-plan');
    plan.style.maxHeight = 'none';
    const over = panel.scrollHeight - panel.clientHeight;
    const fit = Math.floor(plan.getBoundingClientRect().height - over);
    if (over > 0 && fit >= 140) plan.style.maxHeight = fit + 'px';
  }
  window.addEventListener('resize', () => { if (document.documentElement.classList.contains('has-dialog')) placeSheet(); });
  function closeSheet() {
    let was = false;
    for (const id of SHEETS) { if (!$(id).hidden) { $(id).hidden = true; was = true; } }
    document.documentElement.classList.remove('has-dialog');
    if (was && returnFocus && returnFocus.focus) returnFocus.focus();
  }
  for (const n of document.querySelectorAll('[data-close]')) n.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  /* ── the changes: compose the panorama, turn to the object, swap the scene ───── */
  const imgCache = new Map();
  function loadImage(src) {
    if (!imgCache.has(src)) {
      imgCache.set(src, new Promise((resolve, reject) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => resolve(im);
        im.onerror = () => { imgCache.delete(src); reject(new Error('image failed: ' + src)); };
        im.src = src;
      }));
    }
    return imgCache.get(src);
  }
  /** The room's current look as a canvas: the newest live edit (or the original) with the chosen patches drawn over it.
      Patch x/y/w/h are in balanced-panorama pixels; a live panorama has the same size. */
  async function composeCanvas(room, ids) {
    const s = byId[room];
    const defs = ids.map((id) => editDef(room, id)).filter(Boolean).sort((a, b) => a.order - b.order);
    const top = liveStack(room)[liveStack(room).length - 1];
    const imgs = await Promise.all([top ? Promise.resolve(top.img) : loadImage(panoPath(s.asset))].concat(defs.map((d) => loadImage('panos/patches/' + d.patch))));
    const base = imgs[0];
    const c = document.createElement('canvas');
    c.width = base.naturalWidth || base.width;
    c.height = base.naturalHeight || base.height;
    const g = c.getContext('2d');
    g.drawImage(base, 0, 0);
    const k = c.width / (data.panoWidth || c.width);
    defs.forEach((d, i) => g.drawImage(imgs[i + 1], d.x * k, d.y * k, d.w * k, d.h * k));
    return c;
  }
  const canvasToUrl = (c) => new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('encode failed'))), 'image/jpeg', 0.92));
  async function composePano(room, ids) {
    const c = await composeCanvas(room, ids);
    const url = await canvasToUrl(c);
    c.width = 0;
    c.height = 0;
    return url;
  }
  /** Where to look so the changed object is in front of the visitor: a phone may widen by 15 degrees, a desktop by 6. */
  function aim(def) {
    const fit = fitHfov();
    return {
      pitch: (0.5 - def.look.v) * 180,
      yaw: (def.look.u - 0.5) * 360,
      hfov: Math.max(fit, Math.min(fit + (fine ? 6 : 15), (def.spanDeg || 60) + 12)),
    };
  }
  const canChange = () => Boolean(viewer) && state.ready && !state.applying && viewer.isLoaded() && look !== 'original';
  let applySeq = 0;
  async function applyRoom(room, focusDef, revert, keepText) {
    const seq = ++applySeq;
    const key = sceneKey(room);
    state.applying = true;
    state.interacted = true;
    if (state.rotating) setRotating(false);
    renderChange();
    showLoading(true, keepText || ui('changeApplying'));
    const target = focusDef ? aim(focusDef) : { pitch: viewer.getPitch(), yaw: viewer.getYaw(), hfov: viewer.getHfov() };
    const turned = new Promise((resolve) => {
      if (!focusDef || reduced) { resolve(); return; }
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      viewer.lookAt(target.pitch, target.yaw, target.hfov, 700, fin);
      window.setTimeout(fin, 1200);
    });
    try {
      if (key !== room && !composed[key]) {
        const url = await composePano(room, activeIds(room));
        if (composed[key]) URL.revokeObjectURL(url);
        else {
          composed[key] = url;
          viewer.addScene(key, Object.assign({}, pscenes[room], { panorama: url }));
        }
      }
      await turned;
      if (seq !== applySeq) return;
      retarget(room);
      if (viewer.getScene() === key) {
        state.applying = false;
        showLoading(false);
        renderChange();
        syncUrl();
        return;
      }
      viewer.loadScene(key, target.pitch, target.yaw, target.hfov);
    } catch (_) {
      if (seq !== applySeq) return;
      if (revert) revert();
      state.applying = false;
      retarget(room);
      renderChange();
      showLoading(true, ui('changeFailed'));
      window.setTimeout(() => { if (!state.applying) showLoading(false); }, 2600);
    }
  }
  function toggleEdit(room, id) {
    const def = editDef(room, id);
    if (!def || !canChange()) return;
    const prev = activeIds(room).slice();
    const ids = prev.slice();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
    ids.sort(byOrder(room));
    active[room] = ids;
    const wasOriginal = Boolean(original[room]);
    original[room] = false;
    closeSheet();
    applyRoom(room, def, () => { active[room] = prev; original[room] = wasOriginal; });
  }
  function toggleOriginal() {
    const room = state.scene;
    if (!changeCount(room) || !canChange()) return;
    original[room] = !original[room];
    applyRoom(room, null, () => { original[room] = !original[room]; });
  }
  function dropLive(entries) {
    for (const e of entries) { try { URL.revokeObjectURL(e.url); } catch (_) { /* already gone */ } }
  }
  function resetEdits() {
    const room = state.scene;
    if (!changeCount(room) || !canChange()) return;
    const prev = activeIds(room).slice();
    const prevLive = liveStack(room).slice();
    const wasOriginal = Boolean(original[room]);
    active[room] = [];
    live[room] = [];
    original[room] = false;
    closeSheet();
    applyRoom(room, null, () => { active[room] = prev; live[room] = prevLive; original[room] = wasOriginal; });
  }
  /** A live change lands: the edited panorama (a canvas) becomes the room's new base for this session. */
  async function pushLive(room, canvas, label, meta) {
    const url = await canvasToUrl(canvas);
    const img = await loadImage(url);
    const entry = { url, img, label: String(label || '').slice(0, 120), meta: meta || {} };
    live[room] = liveStack(room).concat([entry]);
    original[room] = false;
    closeSheet();
    await applyRoom(room, null, () => { live[room] = liveStack(room).filter((e) => e !== entry); dropLive([entry]); }, ui('changeApplying'));
    return entry;
  }
  function undoLive(room) {
    const stack = liveStack(room);
    if (!stack.length || !canChange()) return;
    const popped = stack[stack.length - 1];
    live[room] = stack.slice(0, -1);
    closeSheet();
    // T18d: the entries this swap pushed onto OTHER rooms' stacks go with it, when they are still on top there
    for (const l of (popped.meta && Array.isArray(popped.meta.linked) ? popped.meta.linked : [])) {
      const st2 = liveStack(l.room); const top = st2[st2.length - 1];
      if (top && top.meta && top.meta.linked_to && top.meta.linked_to.room === room && l.ok !== false) { live[l.room] = st2.slice(0, -1); dropLive([top]); void ensureComposed(l.room); }
    }
    applyRoom(room, null, () => { live[room] = stack; }).then(() => { if (!liveStack(room).includes(popped)) dropLive([popped]); });
  }
  /** T18d: a room's edited scene composed and registered without loading it — the visitor stays where they are; entering the room
      finds it ready. Also the way a linked undo leaves the other room consistent. */
  async function ensureComposed(room) {
    const key = sceneKey(room);
    if (key === room || composed[key]) return;
    const url = await composePano(room, activeIds(room));
    if (composed[key]) { URL.revokeObjectURL(url); return; }
    composed[key] = url;
    viewer.addScene(key, Object.assign({}, pscenes[room], { panorama: url }));
    retarget(room);
  }
  /** T18d: a live change pushed onto a room that is NOT on screen (the follow-up of a swap seen from there). */
  async function pushLiveQuiet(room, canvas, label, meta) {
    const url = await canvasToUrl(canvas);
    const img = await loadImage(url);
    const entry = { url, img, label: String(label || '').slice(0, 120), meta: meta || {} };
    live[room] = liveStack(room).concat([entry]);
    original[room] = false;
    await ensureComposed(room);
    sweep(room);
    renderChange();
    return entry;
  }
  /** Drop the composed panoramas of this room that no state points at any more. */
  function sweep(room) {
    const keep = editedKey(room);
    const cur = viewer.getScene();
    for (const k of Object.keys(composed)) {
      if (roomOf(k) !== room || k === keep || k === cur) continue;
      viewer.removeScene(k);
      URL.revokeObjectURL(composed[k]);
      delete composed[k];
    }
  }

  /* ── wiring ─────────────────────────────────────────────────────────────────── */
  for (const b of document.querySelectorAll('#t-lang button')) b.addEventListener('click', () => setLang(b.dataset.lang));
  for (const b of document.querySelectorAll('#t-look button')) b.addEventListener('click', () => setLook(b.dataset.look)); // card Q09
  $('t-plan-btn').addEventListener('click', () => openSheet('t-sheet', 't-sheet-close'));
  $('t-change-btn').addEventListener('click', () => { if (roomEdits(state.scene).length || state.unlocked) openSheet('t-change', 't-change-close'); });
  $('t-undo').addEventListener('click', () => undoLive(state.scene));
  $('t-compare').addEventListener('click', toggleOriginal);
  $('t-change-reset').addEventListener('click', resetEdits);
  $('t-zoom-in').addEventListener('click', () => viewer && viewer.setHfov(viewer.getHfov() - 12));
  $('t-zoom-out').addEventListener('click', () => viewer && viewer.setHfov(viewer.getHfov() + 12));
  $('t-reset').addEventListener('click', () => viewer && viewer.lookAt(-2, byId[state.scene].heading, fitHfov(), reduced ? false : 800));
  $('t-rotate').addEventListener('click', () => setRotating(!state.rotating));
  $('t-skip').addEventListener('click', autoSkip);
  $('t-prev').addEventListener('click', () => step(-1));
  $('t-next').addEventListener('click', () => step(1));
  $('t-retry').addEventListener('click', () => {
    $('t-error').hidden = true;
    if (!viewer) { window.location.reload(); return; }
    try { viewer.loadScene(sceneKey(state.scene), -2, byId[state.scene].heading, fitHfov()); } catch (_) { window.location.reload(); }
  });
  if (reduced) $('t-rotate').hidden = true;
  if (!document.fullscreenEnabled) $('t-full').hidden = true;
  else $('t-full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });

  /* ── the videos (Habait studio, 2026-11-01): the flyover intro (bird's eye → the facade → in through the terrace) and a clip
     per room, each in up to three floor finishes (data.videos.sets[floor]); a floor switch in the bar and in the overlay. When
     the build also carries a panorama set per floor (data.floorSets), the switch re-opens the page in that set. ── */
  const videos = data.videos && data.videos.sets ? data.videos : null;
  const floors = videos && Array.isArray(videos.floors) && videos.floors.length ? videos.floors : [];
  let floor = (() => { const q = params.get('floor'); return floors.some((f) => f.id === q) ? q : (videos && videos.defaultFloor) || (floors[0] ? floors[0].id : null); })();
  state.floor = floor;
  const VUI = {
    videoPlay: { he: 'סרטון החדר', en: 'Room video', fr: 'Vidéo de la pièce' },
    videoSkip: { he: 'דלג', en: 'Skip', fr: 'Passer' },
    videoClose: { he: 'סגור', en: 'Close', fr: 'Fermer' },
  };
  const vui = (k) => ui(k) || pick(VUI[k]);
  const vset = () => (videos ? videos.sets[floor] || videos.sets[Object.keys(videos.sets)[0]] : null);
  const roomVideo = (room) => { const s = vset(); return s && s.rooms && s.rooms[room] ? s.rooms[room] : null; };
  let videoAfter = null;
  const videoEl = () => $('t-video-el');
  let videoFade = false;
  function playVideo(src, title, after, fade) {
    const v = videoEl();
    videoAfter = after || null;
    videoFade = Boolean(fade);
    $('t-video').classList.remove('is-fading');
    $('t-video-title').textContent = title || '';
    $('t-video-skip-text').textContent = after ? vui('videoSkip') : vui('videoClose');
    $('t-video').hidden = false;
    document.documentElement.classList.add('has-video');
    v.muted = true; v.loop = false; v.src = src;
    $('t-video-play').hidden = true;
    if (state.rotating) setRotating(false);
    const p = v.play();
    if (p && p.catch) p.catch(() => { $('t-video-play').hidden = false; }); // autoplay refused: a tap starts it, with sound
  }
  function endVideo() {
    const v = videoEl();
    const box = $('t-video');
    const after = videoAfter; videoAfter = null;
    const finish = () => {
      try { v.pause(); } catch (_) { /* nothing to pause */ }
      v.removeAttribute('src');
      try { v.load(); } catch (_) { /* old engines */ }
      box.hidden = true; box.classList.remove('is-fading');
      document.documentElement.classList.remove('has-video');
    };
    if (videoFade && after) {
      // the panorama takes the landing view UNDER the still last frame, then the frame fades away over it
      try { v.pause(); } catch (_) { /* keep the last frame */ }
      after();
      box.classList.add('is-fading');
      window.setTimeout(finish, reduced ? 0 : 900);
      return;
    }
    finish();
    if (after) after();
  }
  function renderFloorSeg(node) {
    if (!node) return;
    node.textContent = '';
    if (floors.length < 2) return;
    for (const f of floors) {
      const b = el('button', { type: 'button', 'aria-pressed': String(f.id === floor) }, [pick(f.name)]);
      b.addEventListener('click', () => setFloor(f.id));
      node.appendChild(b);
    }
  }
  function setFloor(id) {
    if (!floors.some((f) => f.id === id) || id === floor) return;
    floor = id; state.floor = id;
    if (data.floorSets && data.floorSets[id] && data.floorSets[id].dir) {
      // the panoramas change with the floor: the page re-opens in this room, in that set, without the intro
      try { const u = new URL(window.location.href); u.searchParams.set('floor', id); u.searchParams.set('room', state.scene); u.searchParams.set('video', '0'); window.location.href = String(u); } catch (_) { window.location.reload(); }
      return;
    }
    renderFloorSeg($('t-floor-seg')); renderFloorSeg($('t-video-floors'));
    const v = videoEl();
    if (!$('t-video').hidden) {
      // the clip that is playing swaps to the same clip in the chosen floor, at the same moment (the intro or a room clip)
      const src = v.dataset.room ? roomVideo(v.dataset.room) : (vset() || {}).intro;
      if (src && !String(v.currentSrc || '').endsWith(src)) {
        const at = v.currentTime;
        v.src = src;
        v.addEventListener('loadedmetadata', () => { try { v.currentTime = Math.min(at, Math.max(0, v.duration - 0.1)); } catch (_) { /* not seekable yet */ } }, { once: true });
        const p = v.play(); if (p && p.catch) p.catch(() => {});
      }
    }
    syncUrl();
  }
  function renderVideoBar() {
    if (!videos) return;
    const src = roomVideo(state.scene);
    $('t-video-bar').hidden = !src && floors.length < 2;
    $('t-video-btn').hidden = !src;
    $('t-video-btn-text').textContent = vui('videoPlay');
    renderFloorSeg($('t-floor-seg'));
  }
  function playRoomVideo() {
    const src = roomVideo(state.scene);
    if (!src) return;
    videoEl().dataset.room = state.scene;
    playVideo(src, nameOf(byId[state.scene]), null);
  }
  function maybeIntro() {
    const s = vset();
    if (!s || !s.intro || params.get('video') === '0') return;
    let seen = false;
    try { seen = sessionStorage.getItem('t-intro-seen') === '1'; sessionStorage.setItem('t-intro-seen', '1'); } catch (_) { /* private mode */ }
    if (seen && params.get('video') !== '1') return;
    videoEl().dataset.room = '';
    const land = videos.land || {};
    // one continuous visualization (Eliran 2026-11-02): the flight's last frame IS the landing view of the panorama (same point,
    // same heading, the flight's 28 mm lens = 65.5° hfov), so the overlay fades over the live panorama already set to that view,
    // then the lens eases out to the tour's own width
    document.documentElement.classList.add('is-intro');
    playVideo(s.intro, '', () => {
      document.documentElement.classList.remove('is-intro');
      if (!(land.scene && byId[land.scene] && viewer)) return;
      state.interacted = true;
      const yaw = typeof land.yaw === 'number' ? land.yaw : byId[land.scene].heading;
      const hf = typeof land.hfov === 'number' ? land.hfov : 65.5;
      if (roomOf(viewer.getScene()) === land.scene) { viewer.setYaw(yaw, false); viewer.setPitch(-2, false); viewer.setHfov(hf, false); }
      else viewer.loadScene(sceneKey(land.scene), -2, yaw, hf);
      window.setTimeout(() => { try { viewer.setHfov(fitHfov(), 1500); } catch (_) { /* old engine */ } }, 900);
    }, true);
  }
  // sound: browsers autoplay only muted; the visitor's first tap on the speaker (or the play button) turns the music on, and the
  // choice sticks for the session
  let soundOn = false;
  try { soundOn = sessionStorage.getItem('t-sound') === '1'; } catch (_) { /* private mode */ }
  function renderSound() { const b = $('t-video-sound'); if (b) b.setAttribute('aria-pressed', String(soundOn)); }
  function setSound(on) {
    soundOn = Boolean(on);
    try { sessionStorage.setItem('t-sound', soundOn ? '1' : '0'); } catch (_) { /* private mode */ }
    const v = videoEl(); v.muted = !soundOn;
    if (soundOn && v.paused && !$('t-video').hidden) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    renderSound();
  }
  if (videos) {
    $('t-video-btn').addEventListener('click', playRoomVideo);
    $('t-video-skip').addEventListener('click', endVideo);
    $('t-video-sound').addEventListener('click', () => setSound(!soundOn));
    videoEl().addEventListener('play', () => { if (soundOn) { try { videoEl().muted = false; } catch (_) { /* no gesture yet */ } } renderSound(); });
    $('t-video-play').addEventListener('click', () => { $('t-video-play').hidden = true; setSound(true); const p = videoEl().play(); if (p && p.catch) p.catch(() => {}); });
    videoEl().addEventListener('ended', endVideo);
    videoEl().addEventListener('error', endVideo);
    renderFloorSeg($('t-video-floors'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('t-video').hidden) endVideo(); });
  }
  state.videos = videos ? { floors: floors.map((f) => f.id), rooms: Object.keys((vset() || {}).rooms || {}), intro: Boolean((vset() || {}).intro) } : null;

  /* ── the viewer ─────────────────────────────────────────────────────────────── */
  function onLoad() {
    window.clearTimeout(walkPill);
    state.sceneKey = viewer.getScene();
    state.scene = roomOf(state.sceneKey);
    visited.add(state.scene);
    state.visited = Array.from(visited);
    state.loads += 1;
    state.ready = true;
    state.applying = false;
    sweep(state.scene);
    showLoading(false);
    renderRoom();
    if (state.rotating) viewer.startAutoRotate(-2.2);
    syncUrl();
    autoArm();
    if (state.loads === 1) maybeIntro(); // the flyover plays over the first room while it loads behind
    if (pending.length && state.scene === firstId && look !== 'original') {
      // a shared link: ?change=sofa,table opens the room, then the change lands in front of the visitor
      const ids = pending.slice().sort(byOrder(firstId));
      pending = [];
      active[firstId] = ids;
      applyRoom(firstId, editDef(firstId, ids[0]), () => { active[firstId] = []; });
    }
  }

  renderStatic();
  renderRoom();

  if (typeof window.pannellum === 'undefined') { showError(); return; }
  const hf = fitHfov();
  for (const s of scenes) {
    pscenes[s.id] = {
      type: 'equirectangular',
      panorama: panoPath(s.asset),
      tiles: tilesOf(s),
      yaw: s.id === firstId && Number.isFinite(firstYaw) ? firstYaw : s.heading, // the deep-link landing (see firstYaw)
      pitch: -2,
      hfov: hf,
      minHfov: 40,
      maxHfov: 130,
      hotSpots: (state.catalog ? (s.markers || []).map((m) => {
        // a replaceable piece (T16c): the ring sits on the scan's direction until a live change moves it (refreshMarkers); the rings
        // come before the door markers so the keyboard reaches them first (T18k, F11)
        const hs = { type: 'info', yaw: m.yaw, pitch: m.pitch, cssClass: 't-mk', createTooltipFunc: makeMarker, createTooltipArgs: { room: s.id, id: m.id }, clickHandlerFunc: markerClick, clickHandlerArgs: { room: s.id, id: m.id } };
        markerHs[s.id + '/' + m.id] = hs;
        return hs;
      }) : []).concat(s.hotspots.filter((h) => byId[h.to]).map((h) => {
        const t = byId[h.to];
        const hs = {
          type: 'scene',
          sceneId: t.id,
          yaw: h.u == null ? bearing(s, t) : hsYaw(h.u),
          pitch: h.v == null ? -14 : hsPitch(h.v),
          targetYaw: arriveYaw(s, t), // card Q08: arrive facing the direction of travel (Pannellum's own click reads it too)
          targetPitch: -2,
          targetHfov: hf,
          clickHandlerFunc: () => { autoOff = params.get('auto') === '0'; }, // a door tap re-arms the automatics (the descent after the tap on the apartment)
          cssClass: 't-hs',
          createTooltipFunc: makeHotspot,
          createTooltipArgs: null,
        };
        hs.createTooltipArgs = { to: t.id, hs }; // the keyboard's Enter takes the same door (enterDoor)
        (hsByTarget[t.id] = hsByTarget[t.id] || []).push(hs);
        return hs;
      })),
    };
  }
  // card Q09: each room's original picture as one more scene, sharing the room's doors (they are retargeted by the switch)
  if (hasOriginal) for (const s of scenes) pscenes[origKey(s.id)] = Object.assign({}, pscenes[s.id], { panorama: data.originalSet.dir + '/' + s.asset + '.webp', tiles: null });
  if (look === 'original') for (const s of scenes) retarget(s.id);
  try {
    viewer = window.pannellum.viewer('pano', {
      default: {
        firstScene: look === 'original' ? origKey(firstId) : firstId,
        sceneFadeDuration: reduced ? 0 : 650,
        // card Q08, D-WQ-14 tier 1: a door turns, moves forward with a blur and fades in, facing the direction of travel (the engine;
        // Pannellum ignores the key); under reduced motion the swap stays instant
        walkIn: reduced ? false : { moveMs: 650 },
        autoLoad: true,
        showControls: false,
        compass: false,
        keyboardZoom: true,
        mouseZoom: true,
        friction: 0.15,
      },
      scenes: pscenes,
    });
  } catch (_) {
    showError();
    return;
  }
  state.viewer = viewer;
  viewer.on('scenechange', (id, info) => {
    state.sceneKey = id;
    state.scene = roomOf(id);
    window.clearTimeout(walkPill);
    // a walk-in hides the swap under its moving frame: the pill shows only if the room is slow to come (card Q08)
    if (info && info.walk) walkPill = window.setTimeout(() => { if (!viewer.isLoaded()) showLoading(true, ''); }, 700);
    else showLoading(true, state.applying ? ui('changeApplying') : '');
    renderRoom();
  });
  viewer.on('load', onLoad);
  viewer.on('error', showError);
  /* ── board dollhouse-in-tour (2026-11-03, Eliran: "1 ואחריו 3"): the 3D dollhouse over the tour ──
     The 3D button opens a full-screen layer with the apartment's dollhouse (dist/<id>/3d/dollhouse.html, the same file as the
     apartment page's 3D tab), loaded on the first open. The tour tells it where the buyer stands and looks:
     {type:'habait:you-are-here', scene, bearing (plan degrees, 0 = up, clockwise = centreBearingDeg + yaw), fov} -> a dot and a
     view cone on that room's camera point; and the floor finish ({type:'habait:floor', floor}). A room's "view in 360" in the
     dollhouse posts {type:'habait:enter-room', scene} -> the tour goes there and the layer closes. Messages only to and from that
     frame (same origin). ── */
  const dh = { open: false, ready: false, last: '', back: null, inerted: [] };
  const dhFrame = () => $('t-3d-frame');
  const dhPost = (msg) => { try { const w = dhFrame().contentWindow; if (w) w.postMessage(msg, '*'); } catch (_) { /* not loaded */ } };
  function dhHere(force) {
    if (!dh.open || !dh.ready || !viewer || !viewer.isLoaded()) return;
    const s = byId[state.scene];
    if (!s || s.exterior || !Number.isFinite(s.centreBearingDeg)) return;
    const bearing = ((s.centreBearingDeg + viewer.getYaw()) % 360 + 360) % 360;
    const fov = viewer.getHfov();
    const key = state.scene + '|' + bearing.toFixed(1) + '|' + fov.toFixed(0);
    if (!force && key === dh.last) return;
    dh.last = key;
    dhPost({ type: 'habait:you-are-here', scene: state.scene, bearing, fov });
  }
  function openDh() {
    if (!dhOn) return;
    const f = dhFrame();
    if (!f.getAttribute('src')) f.setAttribute('src', data.dollhouse);
    dh.back = document.activeElement;
    $('t-3d').hidden = false;
    dh.open = true;
    // a modal layer (gate D1): the tour behind it leaves the tab order and the screen reader's reach until it closes
    // (the page lives in main#t-root together with the layer: its siblings go inert, never the layer or an ancestor of it)
    for (const n of $('t-3d').parentElement.children) if (n.id !== 't-3d' && n.tagName !== 'SCRIPT' && !n.inert) { n.inert = true; dh.inerted.push(n); }
    $('t-3d-close').focus();
    if (dh.ready) { dhPost({ type: 'habait:3d-show' }); dhHere(true); }
  }
  function closeDh() {
    if (!dh.open) return;
    $('t-3d').hidden = true;
    dh.open = false;
    for (const n of dh.inerted) n.inert = false;
    dh.inerted = [];
    if (dh.back && dh.back.focus) dh.back.focus();
  }
  $('t-3d-btn').addEventListener('click', openDh);
  $('t-3d-close').addEventListener('click', closeDh);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dh.open) closeDh(); });
  window.addEventListener('message', (e) => {
    if (!dhOn || e.source !== dhFrame().contentWindow) return;
    const m = e.data && typeof e.data === 'object' ? e.data : {};
    if (m.type === 'habait:3d-ready') {
      dh.ready = true;
      if (state.floor) dhPost({ type: 'habait:floor', floor: state.floor });
      if (dh.open) dhPost({ type: 'habait:3d-show' });
      dhHere(true);
    } else if (m.type === 'habait:escape') {
      closeDh(); // Esc pressed inside the 3D (focus was in the frame), nothing selected there
    } else if (m.type === 'habait:enter-room' && typeof m.scene === 'string' && byId[m.scene]) {
      closeDh();
      if (m.scene !== state.scene) go(m.scene, true);
    }
  });
  window.setInterval(() => dhHere(false), 120);
  viewer.on('load', () => dhHere(true));

  /* the minimap bridge (card 10, 2026-11-02): when the tour is embedded (the platform's apartment page), tell the parent where the
     visitor is: {type:'habait:view', scene, yaw, fov, pitch, floor} on load, on every scene change and ~10/s while the view turns
     (posted only when something changed); answer {type:'habait:view-request'}; honour {type:'habait:goto', scene} (a tap on a room
     in the minimap). Nothing is posted at top level. '*' because the parent may be another origin on the laptop (:8850 vs :8848). */
  if (window.self !== window.top) {
    let lastView = '';
    const postView = (force) => {
      if (!state.ready || !viewer.isLoaded()) return;
      const yaw = viewer.getYaw(), fov = viewer.getHfov(), pitch = viewer.getPitch();
      const key = [state.scene, yaw.toFixed(1), fov.toFixed(1), pitch.toFixed(1), floor].join('|');
      if (!force && key === lastView) return;
      lastView = key;
      try { window.parent.postMessage({ type: 'habait:view', scene: state.scene, yaw, fov, pitch, floor: floor || null }, '*'); } catch (_) { /* no parent */ }
    };
    window.setInterval(() => postView(false), 100);
    viewer.on('load', () => postView(true));
    window.addEventListener('message', (e) => {
      const m = e && e.data && typeof e.data === 'object' ? e.data : {};
      if (m.type === 'habait:view-request') postView(true);
      else if (m.type === 'habait:goto' && typeof m.scene === 'string' && byId[m.scene]) go(m.scene, true);
    });
  }
  const touched = () => {
    if (state.rotating) setRotating(false);
    if (!state.interacted) { state.interacted = true; if (state.ready) renderRoom(); }
  };
  viewer.on('mousedown', touched);
  viewer.on('touchstart', touched);
  // the rings hide while the view moves (a drag, its inertia, a lookAt, the auto-rotate) and show when it rests (T16c)
  viewer.on('mousedown', () => setMoving(true));
  viewer.on('touchstart', () => setMoving(true));
  viewer.on('animatefinished', () => { setMoving(false); renderCone(); });
  viewer.on('load', () => setMoving(false)); // T18k: the rings show as soon as the scene is up

  /* ── the ruler (2026-11-03, Eliran: "למדוד מרחקים של כל דבר בעצמאות … שהמידות יהיו בהתאם לתכנית מכר") ──
     data.depth = per-room equirect depth (rgb24-be centimetres, radial) rendered from the plan-true furnished scene in the panorama's
     own yaw frame (yaw 0 = u 0.5). Two taps → the straight-line distance between the two surface points. Walls, floors and openings
     are the sales plan's; the furniture is the designed picture's (the clay's proxies sit where the plan furnishes). ── */
  const measure = { on: false, cache: {}, pending: null, items: [], n: 0, downAt: null };
  const M_UI = {
    hint: { he: 'לחצו על שתי נקודות למדידת המרחק ביניהן', en: 'Tap two points to measure the distance between them', fr: 'Touchez deux points pour mesurer la distance entre eux' },
    second: { he: 'עכשיו הנקודה השנייה', en: 'Now the second point', fr: 'Maintenant le second point' },
    none: { he: 'אין מדידה בחדר הזה', en: 'No measuring in this room', fr: 'Pas de mesure dans cette pièce' },
    sky: { he: 'אין משטח בנקודה הזו', en: 'No surface at that point', fr: 'Pas de surface à cet endroit' },
    clear: { he: 'נקה', en: 'Clear', fr: 'Effacer' },
    note: { he: 'המידות לפי תכנית המכר (DBLK, 15.10.2025) · הריהוט להמחשה', en: 'Dimensions per the sales plan (DBLK, 15.10.2025) · furniture is illustrative', fr: 'Cotes selon le plan de vente (DBLK, 15.10.2025) · mobilier indicatif' },
    title: { he: 'מדידה', en: 'Measure', fr: 'Mesurer' },
  };
  const mui = (k) => pick(M_UI[k]);
  const fmtM = (m) => (m < 1 ? `${Math.round(m * 100)} ${pick({ he: 'ס״מ', en: 'cm', fr: 'cm' })}` : `${m.toFixed(2)} ${pick({ he: 'מ׳', en: 'm', fr: 'm' })}`);
  function depthFor(room) {
    const d = data.depth; if (!d || !d.scenes[room]) return Promise.resolve(null);
    if (!measure.cache[room]) measure.cache[room] = new Promise((res) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data; const v = new Uint32Array(c.width * c.height); for (let i = 0, j = 0; i < v.length; i++, j += 4) v[i] = (px[j] << 16) | (px[j + 1] << 8) | px[j + 2]; res({ w: c.width, h: c.height, v }); };
      im.onerror = () => res(null); im.src = d.dir + '/' + d.scenes[room];
    });
    return measure.cache[room];
  }
  function surfacePoint(dm, pitch, yaw) {                                   // metres in the camera frame: x right, y forward, z up
    const u = ((yaw / 360) % 1 + 1.5) % 1, vv = Math.min(0.9999, Math.max(0, 0.5 - pitch / 180));
    const col = Math.min(dm.w - 1, Math.floor(u * dm.w)), row = Math.min(dm.h - 1, Math.floor(vv * dm.h));
    const vals = [];                                                          // 3×3 median: a tap on an edge must not read the far wall
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = Math.min(dm.h - 1, Math.max(0, row + dr)), c = (col + dc + dm.w) % dm.w; const x = dm.v[r * dm.w + c]; if (x > 0 && x < 60 * data.depth.scale) vals.push(x); }
    if (!vals.length) return null; vals.sort((a, b) => a - b); const dist = vals[vals.length >> 1] / data.depth.scale;
    const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180, cp = Math.cos(p);
    return { x: Math.sin(y) * cp * dist, y: Math.cos(y) * cp * dist, z: Math.sin(p) * dist, dist, pitch, yaw };
  }
  const toAngles = (q) => { const r = Math.hypot(q.x, q.y, q.z); return { pitch: Math.asin(q.z / r) * 180 / Math.PI, yaw: Math.atan2(q.x, q.y) * 180 / Math.PI }; };
  function addMark(room, pitch, yaw, cls, text) {
    const id = 'measure-' + (++measure.n); const mk = { id, room, div: null };
    viewer.addHotSpot({ id, pitch, yaw, cssClass: cls, createTooltipFunc: (div) => { mk.div = div; if (text) { div.textContent = text; div.setAttribute('lang', lang); } }, createTooltipArgs: null }, sceneKey(room));
    return mk;
  }
  function renderMeasureBar() {
    const bar = $('t-measure-bar'); if (!bar) return;
    bar.hidden = !measure.on;
    if (!measure.on) return;
    const has = Boolean(data.depth && data.depth.scenes[state.scene]);
    $('t-measure-hint').textContent = !has ? mui('none') : measure.pending ? mui('second') : mui('hint');
    $('t-measure-clear').textContent = mui('clear'); $('t-measure-clear').hidden = !measure.items.length;
    $('t-measure-note').textContent = mui('note');
  }
  function setMeasure(on) {
    measure.on = Boolean(on); measure.pending = null;
    document.documentElement.classList.toggle('t-ruler-on', measure.on);
    const b = $('t-ruler'); if (b) { b.setAttribute('aria-pressed', String(measure.on)); b.title = mui('title'); b.setAttribute('aria-label', mui('title')); }
    if (measure.on && state.rotating) setRotating(false);
    renderMeasureBar();
  }
  function clearMeasures() {
    for (const it of measure.items) for (const mk of [it.a, it.b, it.label]) { try { viewer.removeHotSpot(mk.id, sceneKey(it.room)); } catch (_) { /* gone with the scene */ } }
    measure.items = []; measure.pending = null; renderMeasureBar();
  }
  async function measureTap(ev) {
    if (!measure.on || !viewer || !viewer.isLoaded()) return;
    const room = state.scene; const dm = await depthFor(room); if (!dm) { renderMeasureBar(); return; }
    let pitch, yaw; try { [pitch, yaw] = viewer.mouseEventToCoords(ev); } catch (_) { return; }
    const q = surfacePoint(dm, pitch, yaw);
    if (!q) { $('t-measure-hint').textContent = mui('sky'); return; }
    if (!measure.pending) { measure.pending = { room, q, mk: addMark(room, pitch, yaw, 't-mk-measure') }; renderMeasureBar(); return; }
    if (measure.pending.room !== room) { measure.pending = null; renderMeasureBar(); return; }
    const a = measure.pending; measure.pending = null;
    const b = { q, mk: addMark(room, pitch, yaw, 't-mk-measure') };
    const d = Math.hypot(a.q.x - b.q.x, a.q.y - b.q.y, a.q.z - b.q.z);
    const mid = toAngles({ x: (a.q.x + b.q.x) / 2, y: (a.q.y + b.q.y) / 2, z: (a.q.z + b.q.z) / 2 });
    measure.items.push({ room, a: a.mk, b: b.mk, label: addMark(room, mid.pitch, mid.yaw, 't-measure-label', fmtM(d)), metres: d });
    renderMeasureBar();
  }
  // a tap = a press that did not drag (6 px), on the panorama itself (not on a door or a marker)
  const panoEl = $('pano');
  const isPanoTarget = (t) => t && (t.classList.contains('pnlm-dragfix') || t.classList.contains('pnlm-render-container') || t.tagName === 'CANVAS');
  panoEl.addEventListener('pointerdown', (e) => { measure.downAt = { x: e.clientX, y: e.clientY, t: e.target }; }, true);
  panoEl.addEventListener('pointerup', (e) => { const d = measure.downAt; measure.downAt = null; if (!measure.on || !d || !isPanoTarget(d.t)) return; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return; measureTap({ clientX: e.clientX, clientY: e.clientY }); }, true);
  (function drawMeasureLines() {                                            // the dashed line between the two marks of each measurement in this room
    const svg = $('t-measure-svg');
    if (svg) {
      const root = $('t-root').getBoundingClientRect(); let html = '';
      for (const it of measure.items) {
        if (it.room !== state.scene || !it.a.div || !it.b.div) continue;
        if (it.a.div.style.visibility === 'hidden' || it.b.div.style.visibility === 'hidden') continue;
        const ra = it.a.div.getBoundingClientRect(), rb = it.b.div.getBoundingClientRect();
        html += `<line x1="${(ra.left + ra.width / 2 - root.left).toFixed(1)}" y1="${(ra.top + ra.height / 2 - root.top).toFixed(1)}" x2="${(rb.left + rb.width / 2 - root.left).toFixed(1)}" y2="${(rb.top + rb.height / 2 - root.top).toFixed(1)}"/>`;
      }
      if (svg.innerHTML !== html) svg.innerHTML = html;
    }
    window.requestAnimationFrame(drawMeasureLines);
  })();
  if (data.depth && $('t-ruler')) { $('t-ruler').hidden = false; $('t-ruler').title = mui('title'); $('t-ruler').addEventListener('click', () => setMeasure(!measure.on)); $('t-measure-clear').addEventListener('click', clearMeasures); }
  viewer.on('scenechange', () => { measure.pending = null; renderMeasureBar(); });

  /* ── "מצב סיור" (2026-11-03, Eliran: "רואים באמת דמות שעושה סיור מחדר לחדר ומסבירה על כל חדר") ──
     data.guide[lang].steps = [{scene, text, audio, seconds}] (apartments/<id>/guide, narration by edge-tts). The guide walks the rooms in
     order: go to the room, the presenter card shows the narration and plays it, the view turns slowly; when the narration ends the next
     room follows. "הבא" skips, "עצירה" ends. The presenter is a stylised figure for now (a photoreal talking presenter = a paid model). ── */
  const guide = { on: false, i: -1, audio: null, token: 0 };
  const G_UI = {
    title: { he: 'מצב סיור', en: 'Guided tour', fr: 'Visite guidée' }, stop: { he: 'עצירה', en: 'Stop', fr: 'Arrêter' }, next: { he: 'הבא', en: 'Next', fr: 'Suivant' },
    of: { he: 'מתוך', en: 'of', fr: 'sur' }, muted: { he: 'הקול כבוי בדפדפן · לחצו להפעלה', en: 'Sound is blocked · tap to enable', fr: 'Son bloqué · touchez pour activer' },
  };
  const gui = (k) => pick(G_UI[k]);
  const guideDoc = () => (data.guide && (data.guide[lang] || data.guide.he)) || null;
  const guideSteps = () => { const g = guideDoc(); return g ? g.steps.filter((s) => byId[s.scene]) : []; };
  function guideRender() {
    const card = $('t-guide-card'); if (!card) return;
    card.hidden = !guide.on;
    const b = $('t-guide'); if (b) { b.setAttribute('aria-pressed', String(guide.on)); b.title = gui('title'); b.setAttribute('aria-label', gui('title')); }
    if (!guide.on) return;
    const steps = guideSteps(), st = steps[guide.i], g = guideDoc();
    $('t-guide-name').textContent = (g && g.name) || '';
    $('t-guide-text').textContent = st ? st.text : '';
    $('t-guide-count').textContent = st ? `${guide.i + 1} ${gui('of')} ${steps.length} · ${nameOf(byId[st.scene])}` : '';
    $('t-guide-next').textContent = gui('next'); $('t-guide-stop').textContent = gui('stop');
  }
  const waitLoaded = () => new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; const t0 = Date.now(); const poll = () => { if (viewer.isLoaded() && Date.now() - t0 > 250) return fin(); if (Date.now() - t0 > 7000) return fin(); window.setTimeout(poll, 100); }; window.setTimeout(poll, 300); });
  async function guideGo(i) {
    const token = ++guide.token; const steps = guideSteps();
    if (guide.audio) { guide.audio.pause(); guide.audio = null; }
    if (i >= steps.length) { guideStop(); return; }
    guide.i = i; const st = steps[i];
    if (state.scene !== st.scene) { go(st.scene, true); await waitLoaded(); }
    if (token !== guide.token) return;
    guideRender();
    document.documentElement.classList.add('t-guide-speaking');
    const vid = $('t-guide-video'), fig = $('t-guide-figure');
    if (st.video && vid) {                                                   // the talking presenter clip carries its own voice
      fig.hidden = true; vid.hidden = false; vid.src = st.video; vid.muted = false; vid.playsInline = true; guide.audio = vid;
      vid.onended = () => { if (token !== guide.token) return; document.documentElement.classList.remove('t-guide-speaking'); window.setTimeout(() => { if (token === guide.token) guideGo(i + 1); }, 900); };
      vid.onerror = () => { if (token === guide.token) window.setTimeout(() => guideGo(i + 1), Math.max(4000, (st.seconds || 8) * 1000)); };
      const pv = vid.play(); if (pv && pv.catch) pv.catch(() => { $('t-guide-text').textContent = gui('muted') + ' — ' + st.text; });
      if (!reduced) setRotating(true);
      return;
    }
    if (vid) { vid.hidden = true; vid.removeAttribute('src'); } if (fig) fig.hidden = false;
    const a = new Audio(st.audio); guide.audio = a; a.preload = 'auto';
    a.addEventListener('ended', () => { if (token !== guide.token) return; document.documentElement.classList.remove('t-guide-speaking'); window.setTimeout(() => { if (token === guide.token) guideGo(i + 1); }, 900); });
    a.addEventListener('error', () => { if (token === guide.token) window.setTimeout(() => guideGo(i + 1), Math.max(4000, (st.seconds || 8) * 1000)); });
    const pr = a.play(); if (pr && pr.catch) pr.catch(() => { $('t-guide-text').textContent = gui('muted') + ' — ' + st.text; });
    if (!reduced) setRotating(true);                                        // a slow turn while she speaks; a drag stops it, the narration goes on
  }
  function guideStart() { if (!guideSteps().length) return; guide.on = true; if (measure.on) setMeasure(false); document.documentElement.classList.add('t-guide-on'); guideGo(0); }
  function guideStop() {
    guide.token++; guide.on = false; if (guide.audio) { guide.audio.pause(); guide.audio = null; } const vid = $('t-guide-video'); if (vid) { vid.pause(); vid.hidden = true; vid.removeAttribute('src'); }
    document.documentElement.classList.remove('t-guide-on'); document.documentElement.classList.remove('t-guide-speaking');
    if (state.rotating) setRotating(false); guideRender();
  }
  if (guideSteps().length && $('t-guide')) {
    $('t-guide').hidden = false; $('t-guide').title = gui('title');
    $('t-guide').addEventListener('click', () => (guide.on ? guideStop() : guideStart()));
    $('t-guide-stop').addEventListener('click', guideStop);
    $('t-guide-next').addEventListener('click', () => { if (guide.on) guideGo(guide.i + 1); });
    // a room chosen by hand while the guide runs: the narration of THAT room, from its start
    viewer.on('scenechange', (id) => { if (!guide.on) return; const r = roomOf(id); const k = guideSteps().findIndex((s) => s.scene === r); if (k >= 0 && k !== guide.i) guideGo(k); });
  }
  state.hooks_guide = { start: guideStart, stop: guideStop, go: guideGo, get i() { return guide.i; }, get on() { return guide.on; } };   // for the QA
  state.hooks_measure = { setMeasure, clearMeasures, surfacePoint, depthFor, tap: measureTap, get items() { return measure.items; } };   // for the QA

  // what viewer/edit-live.js needs: the viewer, the room's current look, the copy, and the way a live change lands
  state.hooks = {
    viewer: () => viewer,
    room: () => state.scene,
    lang: () => lang,
    ui,
    canChange,
    currentCanvas: (room) => composeCanvas(room, activeIds(room)),
    pushLive,
    pushLiveQuiet,
    roomName: (id) => (byId[id] ? nameOf(byId[id]) : String(id)),
    // T18d: the other scenes' markers of the same piece
    samePiece: (piece, room, id) => (piece ? scenes.flatMap((s) => roomMarkers(s.id).filter((m) => m.piece === piece && !(s.id === room && m.id === id)).map((m) => ({ room: s.id, id: m.id }))) : []),
    busy: (on, text, final) => { state.applying = Boolean(on); renderChange(); showLoading(Boolean(on), text, final); },
    /** The host carries keys and the link carries the code: the typed field comes out onto the main screen, and the rings show. */
    setUnlocked: () => {
      state.unlocked = true;
      $('t-change-bar').hidden = false;
      $('t-change-row').hidden = true;
      $('pano').classList.add('has-markers');
      renderStatic();
      renderChange();
    },
    renderStatic,
    renderChange,
    closeSheet,
    // the markers (T16c): the room's markers as they stand, the words for a category, and which ring is open
    markers: (room) => roomMarkers(room).map((m) => markerState(room, m.id)),
    markerState,
    targetWords,
    openMarker: (id) => { state.marker = id || null; refreshMarkers(); },
    reduced: () => reduced,
  };
})();
