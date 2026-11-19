#!/usr/bin/env node
/* Habait Tour360 — tools/make-scenes.mjs (apt846, 2026-10-28). The viewpoint graph from the camera table: apartments/<id>/cameras.json
   → apartments/<id>/scenes.json. Every door marker is placed by the plan bearing to the opening the visitor walks through (`via`),
   minus the bearing the panorama centre faces (`lookAt`): u = 0.5 + (bearing(via) − bearing(lookAt)) / 360, wrapped; v = 0.68
   (the floor line) — the apartment-37 rule (2026-10-15), never by eye. Plan x/y = crop px × planScale (the viewer's sheet).
     node Habait/tour360/tools/make-scenes.mjs <apartment>
   $0, no dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');
const id = process.argv[2];
if (!id) { console.error('usage: make-scenes.mjs <apartment>'); process.exit(2); }
const APT = path.join(ROOT, 'apartments', id);
const cams = JSON.parse(fs.readFileSync(path.join(APT, 'cameras.json'), 'utf8'));
const bearingDeg = (from, to) => ((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI + 360) % 360;
const ids = new Set(cams.scenes.map((s) => s.id));
const V_FLOOR = 0.68;
const scale = cams.plan.planScale;

const scenes = cams.scenes.map((s) => {
  const centre = bearingDeg(s.at, s.lookAt);
  const hotspots = (s.links || []).map((l) => {
    if (!ids.has(l.to)) throw new Error(`${s.id}: link to unknown scene ${l.to}`);
    const b = bearingDeg(s.at, l.via);
    let u = 0.5 + (b - centre) / 360; u = ((u % 1) + 1) % 1;
    return { to: l.to, u: Number(u.toFixed(3)), v: V_FLOOR, source: 'plan-bearing via the opening' };
  });
  return {
    id: s.id,
    name: cams.names[s.id],
    zone: cams.zones[s.zone],
    asset: s.asset,
    plan: { x: Math.round(s.at[0] * scale), y: Math.round(s.at[1] * scale) },
    heading: 0,
    northOffset: 0,
    centreBearingDeg: Number(centre.toFixed(1)),
    hotspots,
  };
});

// the exterior 360 nodes (2026-11-02, Eliran: the flyover is a chain of 360 scenes, not a clip): apartments/<id>/exterior.json
// lists them with hand-placed hotspots (u/v on the equirect) and no plan position; they go first, the bird's-eye node opens the tour.
// A node may name `backFrom`: an existing room scene that gets a reciprocal hotspot (u/v given) back out to the node.
const extPath = path.join(APT, 'exterior.json');
if (fs.existsSync(extPath)) {
  const ext = JSON.parse(fs.readFileSync(extPath, 'utf8'));
  // autoNext/autoDwellMs: the automatic passages (the intro orbit, the descent); hold: the node the buyer gets control at (2026-11-02)
  const extScenes = ext.scenes.map((s) => ({ id: s.id, name: s.name, zone: s.zone || ext.zone, asset: s.asset, exterior: true, heading: 0, northOffset: 0, centreBearingDeg: null, ...(s.autoNext ? { autoNext: s.autoNext, autoDwellMs: s.autoDwellMs, ...(Number.isFinite(s.autoYaw) ? { autoYaw: s.autoYaw } : {}) } : {}), ...(s.hold ? { hold: true } : {}), hotspots: s.hotspots.map((h) => ({ ...h, source: h.source || 'exterior.json, placed on the equirect' })) }));
  for (const s of ext.scenes) if (s.backFrom) {
    const room = scenes.find((t) => t.id === s.backFrom.scene);
    if (!room) throw new Error(`exterior.json: ${s.id}.backFrom names an unknown scene ${s.backFrom.scene}`);
    room.hotspots.push({ to: s.id, u: s.backFrom.u, v: s.backFrom.v, source: 'exterior.json backFrom' });
  }
  scenes.unshift(...extScenes);
}

// every link reciprocal, by rule
for (const s of scenes) for (const h of s.hotspots) {
  const back = scenes.find((t) => t.id === h.to);
  if (!back.hotspots.some((x) => x.to === s.id)) console.warn(`warning: ${s.id} → ${h.to} has no way back`);
}

const doc = {
  $schema: 'tour360/scenes.v1',
  apartment: id,
  coordinateNotes: {
    u_v: 'normalized position on the FULL equirectangular image: u 0→1 left→right (0.5 = image centre = yaw 0); v 0.68 on the floor line',
    plan: `x/y in the pixel space of ${cams.plan.sheet} = the plan crop (${cams.plan.width}×${cams.plan.height} px, ≈${cams.plan.pxPerCm} px/cm, rotated as the architect drew it) × ${scale}`,
    hotspots: 'u from the plan bearing to the opening the visitor walks through (cameras.json `via`), minus the bearing the panorama centre faces (`lookAt`); computed by tools/make-scenes.mjs, not calibrated by eye',
    heading: 'the start yaw of every room is 0, the panorama centre the prompt aimed (cameras.json lookAt; centreBearingDeg is that bearing in plan image space)',
  },
  scenes,
};
fs.writeFileSync(path.join(APT, 'scenes.json'), JSON.stringify(doc, null, 1) + '\n');
console.log(`scenes.json: ${scenes.length} scenes, ${scenes.reduce((n, s) => n + s.hotspots.length, 0)} links`);
for (const s of scenes) console.log(`  ${s.id.padEnd(15)} centre ${String(s.centreBearingDeg).padStart(5)}°  ` + s.hotspots.map((h) => `${h.to}@u${h.u}`).join('  '));
