/* Static edition: answers the page's /api requests from the JSON snapshot in ./data (made by scripts/export_static.py). Place search is by name; there is no postcode lookup. */
(function () {
  const orig = window.fetch.bind(window), cache = {}, safe = s => String(s).replace(/[^A-Za-z0-9._-]+/g, '_');
  const fname = (path, qs) => { let f = path.split('/').map(p => safe(decodeURIComponent(p))).join('/'); if (qs) { const pairs = [...new URLSearchParams(qs)].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0); if (pairs.length) f += '__' + pairs.map(([k, v]) => safe(k) + '-' + safe(v)).join('__'); } return f + '.json'; };
  const load = rel => cache[rel] || (cache[rel] = orig('data/' + rel).then(r => { if (!r.ok) throw new Error('missing ' + rel); return r.json(); }));
  const resp = (obj, status) => new Response(JSON.stringify(obj), {status: status || 200, headers: {'Content-Type': 'application/json'}});
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  async function search(q, limit) {
    q = norm(q.trim()); if (q.length < 2) return [];
    const [c, l, idx] = await Promise.all([load('areas/matrix__level-constituency.json'), load('areas/matrix__level-local_authority.json'), load('areas/index.json')]);
    const hits = [];
    const add = (level, a) => { const n = norm(a.name); const i = n.indexOf(q); if (i >= 0) hits.push({s: (i === 0 ? 0 : 1) + (level === 'country' || level === 'region' ? -0.5 : 0), r: {geo_level: level, geo_code: a.code || a.geo_code, name: a.name, detail: a.detail || [a.region, a.country].filter(Boolean).join(', ')}}); };
    idx.forEach(a => add(a.geo_level, a)); l.areas.forEach(a => add('local_authority', a)); c.areas.forEach(a => add('constituency', a));
    return hits.sort((a, b) => a.s - b.s || a.r.name.length - b.r.name.length).slice(0, limit || 12).map(h => h.r);
  }
  async function profile(path, qs) {      // put back the definitions the exporter left out of the slim profiles
    const d = await load(fname(path, qs)), m = path.match(/^areas\/(constituency|local_authority|region|country)\//); if (!m || d._ready) return d;
    const defs = (await load('areas/metrics.json')).metrics, byId = Object.fromEntries(defs.map(x => [x.id, x]));
    const mx = (m[1] === 'constituency' || m[1] === 'local_authority') ? await load('areas/matrix__level-' + m[1] + '.json') : null, basis = mx ? Object.fromEntries(mx.metrics.map(x => [x.id, x.basis])) : {};
    d.metrics = d.metrics.map(x => ({...byId[x.id], ...x, basis: x.basis != null ? x.basis : (basis[x.id] || null)})).filter(x => x.title);
    d._ready = true; return d;
  }
  window.fetch = async function (url, opts) {
    const u = String(url);
    if (!u.startsWith('/api/')) return orig(url, opts);
    const [p, qs] = u.slice(5).split('?');
    try {
      if (p === 'areas/search') { const q = new URLSearchParams(qs); return resp({results: await search(q.get('q') || '', +q.get('limit') || 12)}); }
      if (/^areas\/(constituency|local_authority|region|country)\//.test(p)) return resp(await profile(p, qs));
      if (p === 'claims') { const d = await load('claims.json'), t = new URLSearchParams(qs || '').get('topic'); return resp(t ? {...d, claims: d.claims.filter(c => c.topic === t)} : d); }
      return resp(await load(fname(p, qs)));
    } catch (e) { return resp({detail: 'Not part of the static edition'}, 404); }
  };
})();
