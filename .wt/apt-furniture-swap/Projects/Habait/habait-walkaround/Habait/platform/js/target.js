// Where "open the project" goes (board platform-ui-ux, card 14): one definition for the home card and the landing's play button.
// Unchanged from the v0 index.html: the external flight (the hold, with its inline intro clip as ?orbit=), the intro page, or flow.html.
// p = { id, dir, meta } as loaded by js/config.js (loadProjects + loadProjectMeta).
export function extUrl(p, e) {
  const u = new URL(e.url, location.href);
  for (const [k, v] of Object.entries(e.params || {})) u.searchParams.set(k, v);
  u.searchParams.set('project', p.id);
  return u.toString();
}
export function projectHref(p) {
  const ext = p.meta.exterior;
  if (ext && ext.mode === 'external' && ext.url) {
    if (ext.intro && ext.intro.clip && ext.intro.mode === 'inline') {
      const u = new URL(extUrl(p, ext));
      u.searchParams.set('orbit', new URL(`${p.dir}/${ext.intro.clip}`, location.href).toString());
      return u.toString();
    }
    return ext.intro && ext.intro.clip ? `intro.html?project=${encodeURIComponent(p.id)}&next=${encodeURIComponent(extUrl(p, ext))}` : extUrl(p, ext);
  }
  return `flow.html?project=${encodeURIComponent(p.id)}`;
}
