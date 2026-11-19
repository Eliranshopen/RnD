# card 14: landing.js — media first, availability, legal summary, real stills only. One-shot; anchors must be unique.
p = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform\js\landing.js"
s = open(p, encoding="utf-8").read()


def r(old, new):
    global s
    assert s.count(old) == 1, (old[:80], s.count(old))
    s = s.replace(old, new)


r("import { DEV } from './dev.js';", "import { DEV } from './dev.js';\nimport { projectHref } from './target.js';")
# strings
r("""    'frame.title': 'טיסת 360 סביב הפרויקט',
  },""", """    'frame.title': 'טיסת 360 סביב הפרויקט',
    // platform-ui-ux card 14 (drafts for Eliran)
    'hero.play': 'לטיסה סביב הפרויקט',
    'avail.title': 'הדירות בפרויקט',
    'avail.summary': '{total} דירות · {free} למכירה',
    'avail.floor': 'קומה {n}',
    'avail.rooms': '{n} חדרים',
    'avail.area': '{n} מ״ר',
    'legal.more': 'לנוסח המלא',
    'legal.less': 'סגירה',
  },""")
r("""    'frame.title': '360 flight around the project',
  },""", """    'frame.title': '360 flight around the project',
    'hero.play': 'Fly around the project',
    'avail.title': 'Apartments in the project',
    'avail.summary': '{total} apartments · {free} for sale',
    'avail.floor': 'Floor {n}',
    'avail.rooms': '{n} rooms',
    'avail.area': '{n} m²',
    'legal.more': 'Full wording',
    'legal.less': 'Close',
  },""")
# real stills only: the fixture fallback (the flight's exterior posters, clay) is gone — no stills means no gallery
r("""  } catch {
    // fixture fallback: the exterior stills / posters of the flight (each image once)
    const seen = new Set(cover ? [cover.src] : []);
    const stills = [];
    for (const s of ctx.flow.segments || []) {
      const img = s.kind === 'still' ? s.src : s.poster;
      if (!img || !/\\.(png|jpe?g|webp|avif)$/i.test(img)) continue;
      const src = ctx.asset(img);
      if (seen.has(src)) continue;
      seen.add(src);
      stills.push({ id: s.id, name: s.title, src });
    }
    return { mode: 'fixture', cover, stills, legal: null };
  }""", """  } catch {
    // platform-ui-ux card 14: no built apartment = no gallery. The old fallback showed the flight's exterior posters (clay) to
    // buyers; clay is never shown. The cover still (the project's own) stays as the hero.
    return { mode: 'fixture', cover, stills: [], legal: null };
  }""")
# render: legal summary, dev footer, play link, availability
r("""  $('legalStatus').textContent = l('legal.status');""", """  $('legalStatus').textContent = l('legal.status');
  // the summary line is the full text's own first sentence (no new wording, §6); the full text opens in place below it
  $('legalSummary').textContent = $('legalFull').firstChild ? $('legalFull').firstChild.textContent : '';
  $('devFoot').hidden = !DEV;
  $('heroPlay').href = projectHref({ id: ctx.id, dir: ctx.dir, meta: ctx.meta });
  $('langToggle').setAttribute('aria-label', lang === 'he' ? 'English' : 'עברית');
  renderAvailability();""")
r("""function renderGallery() {
  const { media } = S;
  const hero = $('heroImg');
  const first = media.cover || media.stills[0];
  if (first) { hero.src = first.src; hero.alt = pick(first.name) || ''; }
  const g = $('gallery');
  g.innerHTML = '';""", """// availability: the non-visual alternative to the picker. Every unit, status in words + colour, rooms, area, floor; a link each.
const STATUS_CHIP = { 'for-sale': 'hb-chip--available', reserved: 'hb-chip--reserved', sold: 'hb-chip--sold' };
function renderAvailability() {
  const { ctx } = S;
  const units = [...(ctx.units.units || [])].sort((a, b) => (b.floor - a.floor) || String(a.id).localeCompare(String(b.id)));
  $('availability').hidden = !units.length;
  if (!units.length) return;
  $('availSummary').textContent = l('avail.summary', { total: units.length, free: units.filter((u) => u.status === 'for-sale').length });
  const list = $('availList');
  list.innerHTML = '';
  for (const u of units) {
    const li = el('li');
    const a = el('a', { class: 'avail-row', href: `apartment.html?project=${encodeURIComponent(ctx.id)}&unit=${encodeURIComponent(u.id)}` });
    const num = el('span', { class: 'avail-row__unit' }); num.append(el('bdi', {}, String(u.id)));
    const chip = el('span', { class: `hb-chip ${STATUS_CHIP[u.status] || ''}` }, t(`status.${u.status || 'unknown'}`));
    const meta = el('span', { class: 'avail-row__meta' });
    const part = (key, n) => { if (n === undefined || n === null || n === '') return; const s = el('span'); const [pre, post] = l(key, { n: '\\u0000' }).split('\\u0000'); s.append(pre, el('bdi', {}, String(n)), post); meta.append(s); };
    part('avail.rooms', u.rooms); part('avail.area', u.area_m2); part('avail.floor', u.floor);
    a.append(num, chip, meta, el('span', { class: 'avail-row__go', 'aria-hidden': 'true' }, getLang() === 'he' ? '‹' : '›'));
    li.append(a); list.append(li);
  }
}

function renderGallery() {
  const { media } = S;
  const hero = $('heroImg');
  const first = media.cover || media.stills[0];
  if (first) { hero.src = first.src; hero.alt = pick(first.name) || ''; }
  $('gallerySection').hidden = !media.stills.length;
  const g = $('gallery');
  g.innerHTML = '';""")
r("""    b.append(img, el('span', { class: 'tile-label' }, pick(s.name) || ''), el('span', { class: 'tile-legal' }, legalText(media, S.ctx, S.unit, 'short', getLang()).split('.')[0]));""",
  """    const badge = el('span', { class: 'hb-ai-badge tile-badge' }, 'הדמיה · '); badge.append(el('bdi', {}, 'AI-generated'));
    b.append(img, badge, el('span', { class: 'tile-label' }, pick(s.name) || ''), el('span', { class: 'tile-legal' }, legalText(media, S.ctx, S.unit, 'short', getLang()).split('.')[0]));""")
open(p, "w", encoding="utf-8", newline="").write(s)
print("landing.js patched")
