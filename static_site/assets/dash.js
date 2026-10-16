/* Constituency dashboard: masthead and vitals, the money summary (three bases side by side, never added), a hexagon-cartogram explorer, rank strips,
   100-resident waffle grids, age profile, council spend lollipops and a payments treemap. Plain SVG and HTML, no libraries, no network calls except the JSON the page already loads.
   Every figure comes from /api/areas/matrix (all 650 constituencies) and /api/areas/constituency/{code}. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const nf = (v, d = 0) => v == null ? '–' : Number(v).toLocaleString('en-GB', {maximumFractionDigits: d, minimumFractionDigits: d});
  const gbp = v => v == null ? '–' : (() => { const a = Math.abs(v), s = v < 0 ? '−' : '', f = x => nf(x, x >= 100 ? 0 : x >= 10 ? 1 : 2); return a >= 1e12 ? s + '£' + f(a / 1e12) + 'tn' : a >= 1e9 ? s + '£' + f(a / 1e9) + 'bn' : a >= 1e6 ? s + '£' + f(a / 1e6) + 'm' : a >= 1e3 ? s + '£' + f(a / 1e3) + 'k' : s + '£' + nf(a); })();
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
  const fv = (m, v) => v == null ? '–' : m.unit === 'percent' ? nf(v, 1) + '%' : m.unit === 'GBP' ? (Math.abs(v) >= 1e6 ? gbp(v) : '£' + nf(v)) : m.unit === 'per 1,000' ? nf(v, 1) + ' per 1,000' : m.unit === 'score' ? nf(v, 1) : nf(v);
  const fvShort = (m, v) => v == null ? '–' : m.unit === 'percent' ? nf(v, v < 10 ? 1 : 0) + '%' : m.unit === 'GBP' ? (Math.abs(v) >= 1e6 ? gbp(v) : '£' + nf(v)) : nf(v, Math.abs(v) < 10 ? 1 : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const q = (sorted, p) => { if (!sorted.length) return null; const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };
  const SQ3 = Math.sqrt(3);
  const BEN = {SP: 'dwp_spend_sp', PC: 'dwp_spend_pc', AA: 'dwp_spend_aa', PIP: 'dwp_spend_pip', DLA: 'dwp_spend_dla', ESA: 'dwp_spend_esa', CA: 'dwp_spend_ca', UCH: 'dwp_spend_uc', HB: 'dwp_spend_hb'};
  const BENNAME = {SP: 'State Pension', PC: 'Pension Credit', AA: 'Attendance Allowance', PIP: 'Personal Independence Payment', DLA: 'Disability Living Allowance', ESA: 'Employment and Support Allowance', CA: "Carer's Allowance", UCH: 'Universal Credit', HB: 'Housing Benefit'};
  const WAFFLES = {
    age: {title: 'By age', unit: 'of residents', cats: [['Under 15', ['age_0_14']], ['15 to 24', ['age_15_24']], ['25 to 44', ['age_25_44']], ['45 to 64', ['age_45_64']], ['65 and over', ['age_65_plus']]]},
    ethnic: {title: 'By ethnic group', unit: 'of residents (Census 2021)', cats: [['White British', ['white_british']], ['White other', ['white_other']], ['Asian', ['asian']], ['Black', ['black']], ['Mixed', ['mixed']], ['Other ethnic group', ['other_ethnic']]]},
    religion: {title: 'By religion', unit: 'of residents (Census 2021)', cats: [['Christian', ['christian']], ['No religion', ['no_religion']], ['Muslim', ['muslim']], ['Hindu', ['hindu']], ['Sikh', ['sikh']], ['Other or not stated', null]]},
    homes: {title: 'By home', unit: 'of households', cats: [['Owned', ['owner_occupied']], ['Social rented', ['social_rented']], ['Private rented', ['private_rented']]]},
    work: {title: 'By activity', unit: 'of people aged 16 and over', cats: [['In work', ['employed']], ['Retired', ['retired']], ['Students', ['students']], ['Long-term sick or disabled', ['long_term_sick']], ['Looking after home', ['looking_after_home']], ['Unemployed or other', null]]},
    origin: {title: 'By place of birth', unit: 'of residents (Census 2021)', cats: [['Born in the UK', 'uk'], ['Europe (EU)', ['born_eu']], ['Africa', ['born_africa']], ['Asia and Middle East', ['born_asia_me']], ['Elsewhere abroad', 'rest']]}
  };
  const VITALS = [['population', 'Residents'], ['age_65_plus', 'Aged 65 and over'], ['born_abroad', 'Born abroad'], ['dwp_uc_rate', 'On Universal Credit'], ['dwp_spend_per_head', 'Benefit spend per head, per year']];
  let tipEl = null;
  const tip = (html, e) => { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'dtip'; document.body.appendChild(tipEl); } if (html == null) { tipEl.style.display = 'none'; return; } tipEl.innerHTML = html; tipEl.style.display = 'block'; const w = tipEl.offsetWidth; tipEl.style.left = clamp(e.clientX + 14, 8, innerWidth - w - 8) + 'px'; tipEl.style.top = (e.clientY + 16) + 'px'; };

  function mount(root, d, M, opts) {
    opts = opts || {};
    const kind = opts.kind || 'constituency', single = kind === 'constituency' || kind === 'local_authority';
    const unitsName = M.level === 'local_authority' ? 'local authorities' : 'constituencies', unit1 = M.level === 'local_authority' ? 'local authority' : 'constituency';
    const A = M.areas, N = A.length, me = single ? A.find(a => a.code === d.area.code) : null, mi = me ? A.indexOf(me) : -1;
    const AN = d.area.name, aggName = single ? AN : (kind === 'region' ? AN : AN);
    const MD = Object.fromEntries(M.metrics.map(m => [m.id, m]));
    const DM = Object.fromEntries((d.metrics || []).map(m => [m.id, m]));        // this area's own figures (aggregates for regions, nations and Great Britain)
    const S = {metric: 'dwp_spend_per_head', mode: 'abs', region: null, country: null, table: false, group: 'Population and age', sortUnusual: true, waffle: 'age', council: 'level', tm: 'department', tmsrc: 'payments', kids: 'dwp_spend_per_head'};
    if (kind === 'region') S.region = d.area.name; else if (kind === 'country' && d.area.code !== 'Great Britain') S.country = d.area.name;
    const cache = {};
    const info = id => {
      if (cache[id]) return cache[id];
      const v = M.values[id] || [], nn = v.filter(x => x != null).sort((a, b) => a - b);
      return cache[id] = {v, sorted: nn, n: nn.length, p1: q(nn, .01), p99: q(nn, .99), med: q(nn, .5), q1: q(nn, .25), q3: q(nn, .75)};
    };
    const isGB = d.area.code === 'Great Britain';
    const ewVal = id => { const n = M.national[id] || {}, p = M.national.population || {}; if (n.England == null || n.Wales == null || !p.England || !p.Wales) return null; return (n.England * p.England + n.Wales * p.Wales) / (p.England + p.Wales); };   // England and Wales combined, weighted by population (the census does not cover Scotland or Northern Ireland)
    const val = id => single ? (info(id).v[mi]) : (DM[id] && DM[id].value != null ? DM[id].value : (isGB && /^(age_|sex_|lone|one_|employ|self|unemployed|unemployment|retired|long_term|looking|students|inactive|full_time|disabled|bad_health|carers|born_|recent|arrived|long_res|uk_pass|no_pass|eu_pass|white_|asian|black|mixed|other_ethnic|no_religion|christian|muslim|hindu|sikh|jewish|buddhist|other_religion|religion_|owner_|social_|private_|no_qual|degree|managerial|routine|never_worked)/.test(id) ? ewVal(id) : (id === 'council_spend_per_head' ? councilPH() : null)));
    const councilPH = () => { const t = (d.finance || []).find(f => f.service === 'Total service expenditure'); return t ? t.per_head_gbp : null; };
    // rank: among all constituencies (or authorities) for a single area; among peers of the same kind for a region or nation (the profile API already computed it)
    const rankOf = id => { if (!single) return DM[id] && DM[id].rank ? DM[id].rank : null; const x = info(id).v[mi]; if (x == null) return null; let r = 1; for (const y of info(id).v) if (y != null && y > x) r++; return r; };
    const rankOfN = id => single ? info(id).n : (DM[id] ? DM[id].of : null);
    const peers = single ? unitsName : (kind === 'region' ? 'regions' : 'nations');
    const rankText = id => { const r = rankOf(id), n = rankOfN(id); return r && n && n > 1 ? ord(r) + ' highest of ' + n + (single ? '' : ' ' + peers) : (single ? '' : 'Compare with Great Britain'); };
    const ref = id => {
      const nat = (M.national[id] || {});
      if (single) { if (nat[me.country] != null) return {v: nat[me.country], label: me.country}; if (nat['Great Britain'] != null) return {v: nat['Great Britain'], label: 'Great Britain'}; return null; }
      if (d.area.code === 'Great Britain') return null;
      const gb = nat['Great Britain'] != null ? nat['Great Britain'] : (DM[id] && DM[id].gb_value);
      return gb != null ? {v: gb, label: 'Great Britain'} : null;
    };
    const regionOf = a => a.region || a.country;
    const inScope = a => (!S.region || regionOf(a) === S.region) && (!S.country || a.country === S.country);
    const regions = [...new Set(A.map(regionOf))].sort();
    const tiles = A.filter(a => a.x != null);
    const bx0 = Math.min(...tiles.map(a => a.x)) - .7, bx1 = Math.max(...tiles.map(a => a.x)) + .7, by0 = Math.min(...tiles.map(a => a.y)) - .7, by1 = Math.max(...tiles.map(a => a.y)) + .7;
    const R = 0.5774 * 0.97, HEXP = [0, 1, 2, 3, 4, 5].map(k => [R * Math.cos((60 * k - 90) * Math.PI / 180), R * Math.sin((60 * k - 90) * Math.PI / 180)]);
    const poly = (x, y) => HEXP.map(p => (x + p[0]).toFixed(3) + ',' + (y + p[1]).toFixed(3)).join(' ');
    const kicker = {constituency: 'Westminster constituency · ' + (me ? regionOf(me) : ''), local_authority: 'Local authority · ' + (me ? regionOf(me) : ''), region: 'Region of England', country: d.area.code === 'Great Britain' ? 'The whole of Great Britain' : 'Nation'}[kind];

    // ---------- colour scales for the map
    const binsFor = id => {
      const I = info(id), m = MD[id];
      if (S.mode === 'dev') {
        const r = ref(id); if (!r) return null;
        const dev = I.sorted.map(x => Math.abs(x - r.v)).sort((a, b) => a - b), t = [q(dev, .25), q(dev, .55), q(dev, .85)];
        const cols = ['var(--dn3)', 'var(--dn2)', 'var(--dn1)', 'var(--d0)', 'var(--dp1)', 'var(--dp2)', 'var(--dp3)'];
        const cls = x => x == null ? null : x - r.v < -t[2] ? 0 : x - r.v < -t[1] ? 1 : x - r.v < -t[0] ? 2 : x - r.v <= t[0] ? 3 : x - r.v <= t[1] ? 4 : x - r.v <= t[2] ? 5 : 6;
        const lab = [r.v - t[2], r.v - t[1], r.v - t[0], r.v + t[0], r.v + t[1], r.v + t[2]];
        return {cols, cls, edges: lab, ref: r};
      }
      const cols = [0, 1, 2, 3, 4, 5, 6].map(i => 'var(--s' + i + ')'), edges = [1, 2, 3, 4, 5, 6].map(k => q(I.sorted, k / 7));
      const cls = x => { if (x == null) return null; let c = 0; while (c < 6 && x > edges[c]) c++; return c; };
      return {cols, cls, edges};
    };

    // ---------- sections
    const inKids = a => !single && inScope(a);
    const locatorSvg = () => `<svg viewBox="${bx0} ${by0} ${bx1 - bx0} ${by1 - by0}" role="img" aria-label="${single ? 'Where ' + esc(AN) + ' sits on the hexagon map' : 'The area covered on the hexagon map'}">${tiles.map(a => { const mine = single ? a.code === me.code : inKids(a), near = single && regionOf(a) === regionOf(me); return `<polygon points="${poly(a.x, a.y)}" fill="${mine ? 'var(--accent)' : near ? 'rgba(255,255,255,.34)' : (!single && !S.region && !S.country ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.12)')}" stroke="${single && mine ? '#fff' : 'none'}" stroke-width="${single && mine ? .12 : 0}"/>`; }).join('')}</svg>`;
    const vital = ([id, label]) => {
      const m = MD[id] || (DM[id] ? {unit: DM[id].unit} : null); if (!m || val(id) == null) return '';
      const r = rankOf(id), n = rankOfN(id), have = r && n && n > 1, pos = have ? 100 * (1 - (r - 1) / Math.max(1, n - 1)) : null, rf = !single ? ref(id) : null;
      return `<button class="d-vital" data-metric="${id}"><small>${esc(label)}</small><b>${fvShort(m, val(id))}</b>${pos != null ? `<div class="rk"><i style="left:${pos.toFixed(1)}%"></i></div>` : '<div class="rk"></div>'}<em>${have ? esc(rankText(id)) : (rf ? 'Great Britain: ' + fvShort(m, rf.v) : '')}</em></button>`;
    };
    const masthead = () => {
      const pop = val('population'), kids = (d.children || []).length;
      const para = single ? `${pop != null ? nf(pop) + ' residents (Census 2021). ' : ''}One of ${N} equal tiles on the hexagon map below. Everything on this page is computed from open government data and dated; tap a tile or a bar to explore.`
        : `${pop != null ? nf(pop) + ' residents (Census 2021). ' : ''}${kids ? kids + ' areas inside it, listed below. ' : ''}The map shows its ${unitsName} in colour; every figure is computed from open government data and dated.`;
      return `<div class="d-mast"><div><div class="d-kick">${esc(kicker)}</div><h2>${esc(AN)}</h2><p>${para}</p></div>
        <div class="d-loc">${locatorSvg()}</div><div class="d-vitals">${VITALS.map(vital).join('')}</div></div>`;
    };
    const SECS = [['money', 'Money here'], ['map', 'Map'], ['profile', 'Profile'], ['people', single ? '100 residents' : '100 residents'], ['council', 'Council'], [single ? 'payments' : 'inside', single ? 'Payments' : 'Areas inside'], ['tables', 'Tables']];
    const navbar = () => `<nav class="d-nav" aria-label="Sections">${SECS.filter(([k]) => k !== 'council' || (d.finance || []).length).map(([k, t]) => `<a data-jump="d-${k}">${t}</a>`).join('')}<a data-foldall="close" class="d-fold">Collapse all</a><a data-foldall="open" class="d-fold">Expand all</a></nav>`;
    const head = (num, id, title, sub) => `<section class="d-sec" id="d-${id}"><header tabindex="0" role="button" aria-expanded="true" data-fold="${id}"><span class="d-num">${num}</span><h3>${title}</h3><span class="d-chev" aria-hidden="true"></span></header><p class="d-sub">${sub}</p>`;

    // miniature distribution strip; the marker is this place, or (for a region or nation) its own overall figure
    const miniStrip = (id, color, v0) => {
      const I = info(id), v = v0 != null ? v0 : val(id); if (!I.n || v == null) return '';
      const lo = Math.min(I.p1, v), hi = Math.max(I.p99, v), W = 260, X = x => 8 + (W - 16) * clamp((x - lo) / ((hi - lo) || 1), 0, 1);
      const ticks = I.sorted.map(x => 'M' + X(x).toFixed(1) + ' 14v12').join('');
      return `<svg viewBox="0 0 ${W} 40" width="100%" role="img" aria-label="Position among ${I.n} ${unitsName}"><path d="${ticks}" stroke="var(--ink2)" stroke-opacity=".28" stroke-width="1"/><rect x="${X(I.q1)}" y="18" width="${Math.max(2, X(I.q3) - X(I.q1))}" height="4" fill="${color}" opacity=".35"/><line x1="${X(I.med)}" x2="${X(I.med)}" y1="11" y2="29" stroke="var(--ink)" stroke-width="1.5"/><circle cx="${X(v)}" cy="20" r="6.5" fill="${color}" stroke="var(--card)" stroke-width="2"/><text x="8" y="38">${esc(fvShort(MD[id], lo))}</text><text x="${W - 8}" y="38" text-anchor="end">${esc(fvShort(MD[id], hi))}</text><text x="${clamp(X(I.med), 26, W - 26)}" y="8" text-anchor="middle">median</text></svg>`;
    };
    const money = () => {
      const bens = (d.benefits || []).filter(b => b.annual_spend_gbp != null && BEN[b.source]).sort((a, b) => b.annual_spend_gbp - a.annual_spend_gbp), benTot = bens.reduce((s, b) => s + b.annual_spend_gbp, 0);
      const cT = (d.finance || []).find(f => f.service === 'Total service expenditure');
      const pay = (d.payments || []).find(p => p.source === 'payments' && /suppliers/.test(p.kind) && p.fiscal_year === '2025-26');
      const gr = (d.payments || []).filter(p => p.source === 'grants' && p.fiscal_year === '2025').reduce((s, p) => s + p.amount_gbp, 0), ct = (d.payments || []).filter(p => /contract/.test(p.source) && p.fiscal_year === '2025').reduce((s, p) => s + p.amount_gbp, 0);
      const rk = id => { const t = rankText(id); return t && val(id) != null ? `<div class="d-lab" style="margin-top:4px">${esc(t)}${single ? ` · <a style="cursor:pointer;color:inherit" data-metric="${id}">show on map</a>` : ''}</div>` : ''; };
      const col = (k, tag, big, unit, tot, text, strip, id) => `<div class="d-col" style="--k:${k}"><span class="d-tag">${tag}</span><div class="big">${big}<small> ${unit}</small></div><div class="tot">${tot}</div><p>${text}</p><div class="ctx">${strip}${id ? rk(id) : ''}</div></div>`;
      const mix = bens.slice(0, 6).concat(bens.length > 6 ? [{source: '_o', annual_spend_gbp: bens.slice(6).reduce((s, b) => s + b.annual_spend_gbp, 0)}] : []);
      const colr = (b, i) => b.source === '_o' ? 'var(--rest)' : 'var(--c' + (i + 1) + ')';
      const gbT = (M.national.dwp_spend_total || {})['Great Britain'];
      const benTotal = val('dwp_spend_total') != null ? val('dwp_spend_total') : benTot, per = val('dwp_spend_per_head');
      const cPH = cT ? cT.per_head_gbp : null;
      const payCol = single ? col('var(--c2)', 'Cash · financial year 2025-26', val('payments_per_head') != null ? '£' + nf(val('payments_per_head')) : '–', 'per resident, in 2025-26', pay ? gbp(pay.amount_gbp) + ' to suppliers and recipients here' : 'No payments placed here', 'Departments’ payments over £25,000 placed by the recipient’s postcode: head offices and hospital trusts show up where they are registered, not where care is delivered.' + (gr || ct ? ' Also placed here: ' + (gr ? gbp(gr) + ' of grants (2025)' : '') + (gr && ct ? ' and ' : '') + (ct ? gbp(ct) + ' of contract value ceilings, which are not spending' : '') + '.' : ''), miniStrip('payments_per_head', 'var(--c2)'), 'payments_per_head')
        : col('var(--c2)', 'Cash · not placed at this level', '–', '', 'Open a constituency or local authority', 'Payments over £25,000, grants and contracts are placed by the recipient’s postcode, so they are shown for constituencies and local authorities, where head offices and hospital trusts show up where they are registered. They are not added up to regions or nations here.', '', null);
      return head('01', 'money', 'What does the state spend here?', 'Three different kinds of money, side by side on purpose. Each has its own basis and date, they overlap, and they must not be added together.') + `
        <div class="d-ledger">
          ${col('var(--c1)', 'Estimate · annual rate', fvShort({unit: 'GBP'}, per), 'per resident, per year', gbp(benTotal) + ' a year on nine benefits', 'DWP cases × average award × 52, at the latest date of each benefit (March to July 2026). Not cash paid in a financial year. Every payment is an entitlement set by rules, not a local decision.', miniStrip('dwp_spend_per_head', 'var(--c1)'), 'dwp_spend_per_head')}
          ${cT && cPH != null ? col('var(--c3)', 'Estimate · council outturn', '£' + nf(cPH), 'per resident, per year', gbp(cT.estimated_k * 1000) + ' a year (' + esc(cT.years) + ')', 'Net current expenditure of the councils serving the area' + (kind === 'constituency' ? ', shared by residents' : '') + '. Includes schools run by the council, social care, roads and bins; excludes benefits. England only.', miniStrip('council_spend_per_head', 'var(--c3)', cPH), single ? 'council_spend_per_head' : null) : col('var(--c3)', 'Estimate · council outturn', '–', '', 'Not available here', 'Council finance returns are loaded for England only. Scottish, Welsh and Northern Irish councils report differently.', '', null)}
          ${payCol}
        </div>
        <div class="d-note"><b>Why these are separate.</b> Housing Benefit is a DWP benefit paid through councils, which is why the council figure excludes it. Councils are partly funded by grants that also appear in the payments figure, and NHS and defence spending is not placed by area at all. Adding the columns would double count and would look complete when it is not. Council spending is largely <i>inside</i> the national total (Total Managed Expenditure), through central grants and through locally financed spending: <a href="#questions/places">see how it fits</a>. <a href="#data/years">Data years</a></div>
        ${bens.length ? `<h4 style="margin:26px 0 6px;font-family:'Iowan Old Style',Georgia,serif;font-size:1.2rem">Where the benefit money goes</h4><div class="d-lab">Share of ${esc(AN)}’s ${gbp(benTot)} a year · colour = benefit${d.area.code === 'Great Britain' ? '' : ' · compared with Great Britain'}</div>
        <div class="d-mix" role="img" aria-label="Benefit spending by benefit">${mix.map((b, i) => `<span style="width:${(100 * b.annual_spend_gbp / benTot).toFixed(2)}%;background:${colr(b, i)}" data-dtip="${esc(b.source === '_o' ? 'Other benefits' : BENNAME[b.source])}|${gbp(b.annual_spend_gbp)} · ${nf(100 * b.annual_spend_gbp / benTot, 1)}%"></span>`).join('')}</div>
        <div class="d-mixleg">${mix.map((b, i) => { const g = b.source === '_o' || d.area.code === 'Great Britain' ? null : (M.national[BEN[b.source]] || {})['Great Britain']; return `<div><i style="background:${colr(b, i)}"></i><span>${esc(b.source === '_o' ? 'Other benefits' : BENNAME[b.source])}</span><span class="mono">${gbp(b.annual_spend_gbp)} · ${nf(100 * b.annual_spend_gbp / benTot, 0)}%</span>${g != null && gbT ? `<span class="dd">Great Britain: ${nf(100 * g / gbT, 0)}% of spending</span>` : ''}</div>`; }).join('')}</div>` : ''}</section>`;
    };

    const hexSection = () => head('02', 'map', 'Where does it sit on the map?', single ? `Every ${unit1} is one equal hexagon, placed near its real position, so a crowded city is as visible as a huge rural area. Pick any measure; filter by region; click a tile to open that ${unit1}.` : `Every constituency is one equal hexagon, placed near its real position. ${esc(AN)} is in full colour; the rest is faded. Pick any measure; click a tile to open that constituency.`) + `
      <div class="d-row d-pick"><label class="d-lab" for="d-metric">Colour the map by</label><select id="d-metric" aria-label="Measure to colour the map by"></select></div>
      <div class="d-row"><button class="chip2" data-mode="abs" aria-pressed="true">Levels</button><button class="chip2" data-mode="dev" aria-pressed="false" title="Colour by how far each ${unit1} is from the national figure">Difference from national</button>
        <button class="chip2" data-table="1" aria-pressed="false">Table view</button></div>
      <div class="d-row" id="d-regions" role="group" aria-label="Filter by region"></div>
      <div class="d-mapwrap"><div class="d-hex" id="d-hexbox"></div><div class="d-side" id="d-side"></div></div></section>`;
    const stripOK = m => (m.unit === 'percent' || m.unit === 'per 1,000' || m.unit === 'score' || ['dwp_spend_per_head', 'council_spend_per_head', 'payments_per_head'].includes(m.id)) && info(m.id).n > 100 && (single ? true : val(m.id) != null);
    const groupsAvail = () => [...new Set(M.metrics.filter(m => stripOK(m)).map(m => m.group))];
    const profile = () => head('03', 'profile', single ? 'How unusual is it?' : 'How does it compare, and how varied is it inside?', (single ? `Each line is all ${N} ${unitsName}, one tick each. The dot is this place; the black line is the median; the shaded band is the middle half. Lines are sorted by how unusual this ${unit1} is. Click a line to put it on the map.` : `Each line is all ${N} ${unitsName}, one tick each; the teal ticks are the ones inside ${esc(AN)}. The dot is ${esc(AN)} as a whole; the diamond is Great Britain. Click a line to put it on the map.`)) + `
      <div class="d-row" id="d-groups" role="group" aria-label="Topic"></div><div class="d-row"><button class="chip2" data-sortu="1" aria-pressed="true">Most unusual first</button><span class="d-lab" id="d-stripcount"></span></div><div class="d-strips" id="d-strips"></div>
      <div class="d-note">Ticks are clipped to the 1st to 99th percentile so a few extreme areas do not squash the rest. Census 2021 covers England and Wales; Scottish and Northern Irish areas have no census lines here. Rates use the 2021 population as denominator and so overstate places that have grown since.</div></section>`;
    const people = () => head('04', 'people', single ? 'If it were 100 residents…' : 'If there were 100 residents…', 'One square is one person in a hundred. Switch the lens; the small figures show how far each group is from the national share.') + `
      <div class="d-row" id="d-wtabs" role="group" aria-label="How to divide the 100 residents">${Object.entries(WAFFLES).map(([k, w]) => `<button class="chip2" data-waffle="${k}" aria-pressed="${k === S.waffle}">${w.title}</button>`).join('')}</div>
      <div class="d-waffle" id="d-waffle"></div><h4 style="margin:26px 0 6px;font-family:'Iowan Old Style',Georgia,serif;font-size:1.2rem">Age profile, five-year bands</h4><div class="d-card" id="d-age"></div></section>`;
    const council = () => head('05', 'council', 'What does the council spend, and on what?', `Net current expenditure of the council(s) serving ${esc(AN)}${kind === 'constituency' ? ', shared by residents' : ''}. The marker is the England figure.`) + `
      <div class="d-row"><button class="chip2" data-council="level" aria-pressed="true">£ per head</button><button class="chip2" data-council="diff" aria-pressed="false">Difference from England</button></div><div class="d-lolli" id="d-councilbox"></div><div id="d-councilnote"></div></section>`;
    const payments = () => head('06', 'payments', 'Who is paid, and by which department?', 'Cash payments over £25,000 and grants, placed by recipient postcode (not where the service is delivered).') + `
      <div class="d-row"><button class="chip2" data-tm="department" aria-pressed="true">By department</button><button class="chip2" data-tm="category" aria-pressed="false">By purpose</button><span style="width:14px"></span>
        <button class="chip2" data-tmsrc="payments" aria-pressed="true">Payments</button><button class="chip2" data-tmsrc="grants" aria-pressed="false">Grants</button></div>
      <div class="d-two"><div><div class="d-tm" id="d-tm"></div></div><div class="d-card" id="d-sup"></div></div></section>`;
    const KIDM = [['dwp_spend_per_head', 'Benefit spend per head'], ['dwp_uc_rate', 'On Universal Credit'], ['dwp_pip_rate', 'On PIP'], ['population', 'Residents'], ['dwp_spend_total', 'Total benefit spend']];
    const inside = () => (d.children || []).length ? head('06', 'inside', 'What is inside ' + esc(AN) + '?', 'The areas that make it up, ranked on a measure of your choice. Click one to open its own dashboard.') + `
      <div class="d-row" id="d-kidtabs" role="group" aria-label="Rank the areas by">${KIDM.map(([id, t]) => `<button class="chip2" data-kids="${id}" aria-pressed="${id === S.kids}">${t}</button>`).join('')}</div><div class="d-lolli" id="d-kids" style="--first:minmax(150px,260px)"></div></section>` : '';

    root.innerHTML = `<div class="dash">${masthead()}${navbar()}${money()}${hexSection()}${profile()}${people()}${(d.finance || []).length ? council() : ''}${single ? payments() : inside()}<div class="d-foot" id="d-tables">${opts.src || ''}</div></div>`;
    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    root.closest('main') && root.closest('main').classList.add('wide');
    const setHdr = () => { const h = document.querySelector('.topnav'); document.documentElement.style.setProperty('--hdr', (h ? h.offsetHeight : 0) + 'px'); };
    setHdr(); window.addEventListener('resize', setHdr);
    // collapsible sections: click a heading to fold it; the state is remembered
    const foldKey = id => 'dc:' + id;
    const fold = (id, collapsed) => { const sec = $('#d-' + id); if (!sec) return; sec.classList.toggle('collapsed', collapsed); const h = sec.querySelector('header'); h && h.setAttribute('aria-expanded', !collapsed); if (window.siteStore) siteStore.set(foldKey(id), collapsed ? '1' : '0'); };
    $$('.d-sec').forEach(sec => { const id = sec.id.slice(2); if (window.siteStore && siteStore.get(foldKey(id)) === '1') { sec.classList.add('collapsed'); sec.querySelector('header').setAttribute('aria-expanded', 'false'); } });

    // ---------- hex map
    const metricOptions = () => {
      const groups = {}; M.metrics.filter(m => (m.unit !== 'people' || m.id === 'population') && (single || val(m.id) != null || true)).forEach(m => (groups[m.group] = groups[m.group] || []).push(m));
      return Object.entries(groups).map(([g, ms]) => `<optgroup label="${esc(g)}">${ms.map(m => `<option value="${m.id}">${esc(m.title)}</option>`).join('')}</optgroup>`).join('');
    };
    const drawRegions = () => { $('#d-regions').innerHTML = `<button class="chip2" data-region="" aria-pressed="${!S.region && !S.country}">${single ? 'All regions' : 'Great Britain'}</button>` + (S.country ? `<button class="chip2" data-region="__country" aria-pressed="true">${esc(S.country)}</button>` : '') + regions.map(r => `<button class="chip2" data-region="${esc(r)}" aria-pressed="${S.region === r}">${esc(r)}</button>`).join(''); };
    const drawHex = () => {
      const id = S.metric, m = MD[id], I = info(id), B = binsFor(id);
      if (!B) { S.mode = 'abs'; return drawHex(); }
      $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === S.mode));
      $$('[data-table]').forEach(b => b.setAttribute('aria-pressed', S.table));
      if (S.table) {
        const list = A.map((a, i) => ({a, i, v: I.v[i]})).filter(o => inScope(o.a) && o.v != null).sort((x, y) => y.v - x.v);
        $('#d-hexbox').innerHTML = `<div class="d-scroll" style="max-height:560px"><table style="width:100%;font-size:.86rem;border-collapse:collapse"><tr><th style="text-align:left;padding:6px 10px">#</th><th style="text-align:left">${esc(unit1)}</th><th style="text-align:left">Region</th><th style="text-align:right;padding-right:10px">${esc(m.title)}</th></tr>${list.map((o, k) => `<tr data-go="${o.a.code}" style="cursor:pointer;${me && o.a.code === me.code ? 'background:var(--hair);font-weight:700' : ''}"><td style="padding:4px 10px" class="mono">${k + 1}</td><td>${esc(o.a.name)}</td><td>${esc(regionOf(o.a))}</td><td style="text-align:right;padding-right:10px" class="mono">${fv(m, o.v)}</td></tr>`).join('')}</table></div>`;
      } else {
        $('#d-hexbox').innerHTML = `<svg viewBox="${bx0} ${by0} ${bx1 - bx0} ${by1 - by0}" role="img" aria-label="Hexagon map of the ${N} ${unitsName} coloured by ${esc(m.title)}. Use the table view for the same data as a list.">${tiles.filter(a => !me || a.code !== me.code).map(a => { const i = A.indexOf(a), c = B.cls(I.v[i]); return `<polygon data-i="${i}" points="${poly(a.x, a.y)}" fill="${c == null ? 'var(--tile-off)' : B.cols[c]}" class="${inScope(a) ? '' : 'dim'}"/>`; }).join('')}${me && me.x != null ? (() => { const big = pts => pts.map(pt => { const [px, py] = pt.split(',').map(Number); return (me.x + (px - me.x) * 1.9).toFixed(3) + ',' + (me.y + (py - me.y) * 1.9).toFixed(3); }).join(' '); const lx = Math.max(bx0 + 4.5, Math.min(bx1 - 4.5, me.x)), ly = me.y > by0 + 4 ? me.y - 2.6 : me.y + 3.2; return `<polygon class="me-ring" points="${big(poly(me.x, me.y).split(' '))}"/><line class="me-lead" x1="${me.x}" y1="${me.y}" x2="${lx}" y2="${ly + (ly < me.y ? .5 : -.9)}"/><polygon data-i="${mi}" points="${poly(me.x, me.y)}" class="me"><title>${esc(AN)}</title></polygon><text class="me-label" x="${lx}" y="${ly}" text-anchor="middle">${esc(AN)}</text>`; })() : ''}</svg>
          <div class="d-legbar" aria-hidden="true">${me ? `<div class="d-lab" style="margin:0 0 8px"><span class="me-key"></span> ${esc(AN)} (shown in red)</div>` : ''}<div class="lgs">${B.cols.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="lgt">${B.edges.map((e, k) => `<span style="left:${(100 * (k + 1) / 7).toFixed(2)}%">${fvShort(m, e)}</span>`).join('')}</div>${S.mode === 'dev' && B.ref ? `<div class="d-lab" style="margin-top:2px">centre colour = near ${esc(B.ref.label)} (${fvShort(m, B.ref.v)})</div>` : ''}${I.n < N ? `<div class="d-lab" style="margin-top:2px"><i style="display:inline-block;width:12px;height:12px;background:var(--tile-off);border-radius:2px;vertical-align:-2px"></i> no figure for ${N - I.n} ${unitsName}</div>` : ''}</div>`;
      }
      const PERIOD = {dwp_spend_per_head: 'Per resident per year: an annualised rate at the latest date of each benefit (March to July 2026), divided by the 2021 census population.', council_spend_per_head: 'Per resident per year: net current expenditure for 2025-26 where the council has submitted it (otherwise its latest year).', payments_per_head: 'Per resident, for payments made in the financial year 2025-26 only.'};
      const v = val(id), rf = ref(id), scoped = A.map((a, i) => ({a, v: I.v[i]})).filter(o => inScope(o.a) && o.v != null).sort((x, y) => y.v - x.v);
      const scopeName = S.region || S.country || (single ? '' : 'Great Britain');
      $('#d-side').innerHTML = `<div><div class="d-lab">${esc(m.group)}</div><h4>${esc(m.title)} ${m.term && opts.hq ? opts.hq(m.term) : ''}</h4></div>
        <div><div class="d-lab">${esc(AN)}</div><div class="d-bigval">${fv(m, v)}</div><div style="color:var(--ink2);font-size:.88rem">${v != null ? [rankText(id), rf ? esc(rf.label) + ': ' + fv(m, rf.v) : ''].filter(Boolean).join(' · ') : 'No figure for this area'}</div>${PERIOD[id] ? `<div style="color:var(--ink2);font-size:.8rem;margin-top:6px">${PERIOD[id]}</div>` : ''}</div>
        <div class="d-lab">Highest and lowest${scopeName && (S.region || S.country) ? ' in ' + esc(scopeName) : ''}</div>
        <div class="d-rank">${scoped.slice(0, 5).map((o, k) => `<div data-go="${o.a.code}"><span class="mono">${k + 1}</span><span>${esc(o.a.name)}</span><span class="mono">${fvShort(m, o.v)}</span></div>`).join('')}${scoped.length > 10 ? `<div style="cursor:default;border:0;color:var(--muted)"><span></span><span>…</span><span></span></div>` : ''}${scoped.slice(-Math.min(5, Math.max(0, scoped.length - 5))).map((o, k, arr) => `<div data-go="${o.a.code}"><span class="mono">${scoped.length - arr.length + k + 1}</span><span>${esc(o.a.name)}</span><span class="mono">${fvShort(m, o.v)}</span></div>`).join('')}</div>
        <div style="font-size:.78rem;color:var(--muted)">Data from: ${esc(m.as_at || 'see Data years')}. ${esc((m.basis || '').slice(0, 160))}${m.note ? ' ' + esc(m.note) : ''}</div>`;
    };

    // ---------- strips
    const drawGroups = () => { const gs = groupsAvail(); if (!gs.includes(S.group)) S.group = gs[0]; $('#d-groups').innerHTML = gs.map(g => `<button class="chip2" data-group="${esc(g)}" aria-pressed="${g === S.group}">${esc(g)}</button>`).join(''); };
    const drawStrips = () => {
      const ms = M.metrics.filter(m => m.group === S.group && stripOK(m) && val(m.id) != null);
      const unusual = id => { const I = info(id), v = val(id); let below = 0; for (const x of I.sorted) if (x < v) below++; return Math.abs(below / I.n - .5); };
      if (S.sortUnusual) ms.sort((a, b) => unusual(b.id) - unusual(a.id));
      $('#d-stripcount').textContent = ms.length + ' measures' + (ms.length ? '' : ': none for this area');
      const cw = $('#d-strips').clientWidth || 900, narrow = innerWidth < 760, W = Math.max(280, narrow ? cw - 12 : cw - 230 - 90 - 40), H = 54, scopeOn = !!(S.region || S.country);
      $('#d-strips').innerHTML = ms.map(m => {
        const I = info(m.id), v = val(m.id), lo = Math.min(I.p1, v), hi = Math.max(I.p99, v), X = x => 12 + (W - 24) * clamp((x - lo) / ((hi - lo) || 1), 0, 1), rf = ref(m.id);
        const ticks = I.v.map((x, i) => x == null || (scopeOn && inScope(A[i])) ? '' : 'M' + X(x).toFixed(1) + ' 26v14').join('');
        const reg = scopeOn ? I.v.map((x, i) => x != null && inScope(A[i]) ? 'M' + X(x).toFixed(1) + ' 22v22' : '').join('') : '';
        const rt = rankText(m.id);
        return `<div class="d-strip${m.id === S.metric ? ' on' : ''}" data-metric="${m.id}" tabindex="0" role="button" aria-label="${esc(m.title)}: ${fv(m, v)}${rt ? ', ' + rt : ''}. Show on map">
          <div class="t">${esc(m.title)}<small>${esc(m.as_at || '')}</small></div>
          <svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${ticks}" stroke="var(--ink2)" stroke-opacity="${scopeOn ? .14 : .26}" stroke-width="1.2"/>${reg ? `<path d="${reg}" stroke="var(--c3)" stroke-opacity=".85" stroke-width="1.6"/>` : ''}<rect x="${X(I.q1)}" y="30" width="${Math.max(2, X(I.q3) - X(I.q1))}" height="6" fill="var(--c1)" opacity=".18"/><line x1="${X(I.med)}" x2="${X(I.med)}" y1="20" y2="46" stroke="var(--ink)" stroke-width="2"/>
            ${rf && rf.v != null ? `<path d="M${X(rf.v)} 14l5 5-5 5-5-5z" fill="var(--c4)" stroke="var(--card)" stroke-width="1.2"/>` : ''}
            <circle class="dot" cx="${X(v)}" cy="33" r="8" fill="var(--accent)" stroke="var(--card)" stroke-width="2.5"/></svg>
          <div class="v">${fvShort(m, v)}<small>${esc(rt.replace(' highest of', ' of'))}</small></div></div>`;
      }).join('') + `<div class="d-lab" style="padding:8px 6px"><span style="color:var(--accent)">●</span> ${single ? 'this ' + unit1 : esc(AN)} &nbsp; <span style="color:var(--c4)">◆</span> national figure &nbsp; | median &nbsp; shaded: middle half${scopeOn ? ' &nbsp; <span style="color:var(--c3)">|</span> ' + esc(S.region || S.country) : ''}</div>`;
    };

    // ---------- waffle
    const waffleData = key => {
      const w = WAFFLES[key], natName = single ? me.country : (kind === 'region' ? d.area.country : null), nat = id => natName ? (M.national[id] || {})[natName] : null;
      const cells = []; let used = 0, refUsed = 0, haveRef = !!natName;
      w.cats.forEach(([label, ids]) => {
        let v = null, rv = null;
        if (Array.isArray(ids)) { v = ids.reduce((s, id) => s + (val(id) || 0), 0); rv = ids.reduce((s, id) => s + (nat(id) || 0), 0); if (ids.some(id => val(id) == null)) v = null; if (ids.some(id => nat(id) == null)) rv = null; }
        else if (ids === 'uk') { const b = val('born_abroad'); v = b == null ? null : 100 - b; const nb = nat('born_abroad'); rv = nb == null ? null : 100 - nb; }
        cells.push({label, v, rv, ids});
      });
      cells.forEach(cl => { if (cl.ids == null || cl.ids === 'rest') { /* remainder */ } else if (cl.v != null) { used += cl.v; if (cl.rv != null) refUsed += cl.rv; else haveRef = false; } });
      cells.forEach(cl => { if (cl.ids == null || cl.ids === 'rest') { cl.v = used > 0 ? Math.max(0, 100 - used) : null; cl.rv = haveRef && used > 0 ? Math.max(0, 100 - refUsed) : null; } });
      return {cells, natName};
    };
    const drawWaffle = () => {
      const w = WAFFLES[S.waffle], {cells, natName} = waffleData(S.waffle);
      if (cells.some(c => c.v == null)) { $('#d-waffle').innerHTML = `<div class="d-note" style="grid-column:1/-1">No census figures for ${esc(AN)} (Scotland and Northern Ireland have separate censuses that are not loaded yet).</div>`; return; }
      const tot = cells.reduce((s, c) => s + c.v, 0), raw = cells.map(c => c.v * 100 / tot), fl = raw.map(Math.floor); let left = 100 - fl.reduce((a, b) => a + b, 0);
      raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => fl[i]++);
      const colour = i => (cells[i].ids == null || cells[i].ids === 'rest') ? 'var(--rest)' : 'var(--c' + (i + 1) + ')';
      let sq = '', k = 0;
      cells.forEach((c, ci) => { for (let j = 0; j < fl[ci]; j++, k++) { const col = Math.floor(k / 10), row = 9 - (k % 10); sq += `<rect data-cat="${ci}" x="${col * 32 + 2}" y="${row * 32 + 2}" width="28" height="28" rx="7" fill="${colour(ci)}" style="animation-delay:${(col * 40 + row * 6)}ms"/>`; } });
      $('#d-waffle').innerHTML = `<div><svg viewBox="0 0 324 324" role="img" aria-label="100 squares, one per 100 residents, coloured ${esc(w.title.toLowerCase())}">${sq}</svg><div class="d-lab" style="margin-top:6px">One square = 1 in 100 ${esc(w.unit)}${isGB ? ' · England and Wales combined: the census does not cover Scotland or Northern Ireland here' : ''}</div></div>
        <div class="d-wleg">${cells.map((c, ci) => { const dp = c.rv == null ? null : c.v - c.rv; return `<div data-cat="${ci}"><i style="background:${colour(ci)}"></i><span>${esc(c.label)}</span><b class="mono">${nf(c.v, 1)}%</b><span class="pp ${dp == null ? '' : dp > 0.5 ? 'up' : dp < -0.5 ? 'dn' : ''}">${dp == null ? '' : (dp > 0 ? '▲ +' : dp < 0 ? '▼ ' : '') + nf(dp, 1) + ' pp'}</span></div>`; }).join('')}</div>`;
      if (natName) $('#d-waffle').lastElementChild.insertAdjacentHTML('afterend', `<div class="d-lab" style="grid-column:1/-1">▲ ▼ = difference in percentage points from ${esc(natName)}</div>`);
    };
    const drawAge = () => {
      const c = (d.census && d.census.ts007a) || (isGB && opts.ewCensus && opts.ewCensus.ts007a ? {rows: opts.ewCensus.ts007a.rows.map(r => ({...r, pct: r.ew_pct}))} : null); if (!c) { $('#d-age').innerHTML = '<div class="d-lab">No census age figures for this area.</div>'; return; }
      const rows = c.rows.filter(r => r.depth === 1 && r.pct != null), n = rows.length, W = 680, H = 210, pad = 30, mx = Math.max(...rows.map(r => Math.max(r.pct, r.ew_pct || 0))) * 1.15;
      const X = i => pad + (W - pad - 8) * i / (n - 1), Y = v => H - 34 - (H - 56) * v / mx, ticks = [0, 2, 4, 6, 8, 10].filter(t => t <= mx);
      const path = k => rows.map((r, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(r[k] || 0).toFixed(1)).join('');
      const short = l => /under/.test(l) ? '0–4' : l.replace('Aged ', '').replace(' years and over', '+').replace(' years', '').replace(' to ', '–');
      $('#d-age').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Share of residents in each five-year age band, compared with England and Wales"><path d="${path('pct')}L${X(n - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z" fill="var(--c1)" opacity=".18"/><path d="${path('pct')}" fill="none" stroke="var(--c1)" stroke-width="2.6"/><path d="${path('ew_pct')}" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="5 4"/>
        ${ticks.map(t => `<line x1="${pad}" x2="${W - 8}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--rule)" stroke-width=".6"/><text x="${pad - 4}" y="${Y(t) + 3}" text-anchor="end">${t}%</text>`).join('')}
        ${rows.map((r, i) => i % 2 === 0 || n < 10 ? `<text x="${X(i)}" y="${H - 14}" text-anchor="middle">${esc(short(r.label))}</text>` : '').join('')}
        ${rows.map((r, i) => `<rect x="${X(i) - (W / n) / 2}" y="0" width="${W / n}" height="${H - 24}" fill="transparent" data-dtip="${esc(short(r.label))}|${nf(r.pct, 1)}% here · ${nf(r.ew_pct, 1)}% in England and Wales"/>`).join('')}</svg>
        <div class="legend" style="font-size:.82rem;color:var(--ink2);display:flex;gap:18px"><span><b style="color:var(--c1)">━</b> ${esc(AN)}</span><span><b>┅</b> England and Wales</span></div>`;
    };

    // ---------- council
    const drawCouncil = () => {
      if (!$('#d-councilbox')) return;
      const f = (d.finance || []).filter(x => x.service !== 'Total service expenditure' && x.per_head_gbp != null), eng = d.england_per_head || {};
      if (!f.length) { $('#d-councilbox').innerHTML = '<div class="d-note">No council spending is placed here: council finance returns are loaded for England only.</div>'; return; }
      const rows = f.map(x => ({s: x.service, v: x.per_head_gbp, e: eng[x.service] != null ? eng[x.service] : null, k: x.estimated_k})).sort((a, b) => S.council === 'diff' ? Math.abs((b.v - (b.e || 0))) - Math.abs((a.v - (a.e || 0))) : b.v - a.v);
      const mx = Math.max(...rows.map(r => S.council === 'diff' ? Math.abs(r.v - (r.e || 0)) : Math.max(r.v, r.e || 0))) * 1.05;
      $('#d-councilbox').innerHTML = rows.map(r => {
        const W = 520, diff = r.e != null ? r.v - r.e : null;
        const bar = S.council === 'diff' ? (diff == null ? '' : `<line x1="${W / 2}" x2="${W / 2}" y1="2" y2="24" stroke="var(--ink)" stroke-width="1.5"/><rect x="${diff >= 0 ? W / 2 : W / 2 - (W / 2 - 4) * Math.abs(diff) / mx}" y="7" width="${(W / 2 - 4) * Math.abs(diff) / mx}" height="12" rx="3" fill="${diff >= 0 ? 'var(--c2)' : 'var(--c1)'}"/>`)
          : `<line x1="0" x2="${W}" y1="13" y2="13" stroke="var(--rule)"/><rect x="0" y="7" width="${Math.max(2, (W - 8) * Math.max(r.v, 0) / mx)}" height="12" rx="3" fill="var(--c3)"/>${r.e != null ? `<path d="M${(W - 8) * Math.max(r.e, 0) / mx} 1v24" stroke="var(--ink)" stroke-width="3"/>` : ''}`;
        return `<div><span>${esc(r.s)}</span><svg viewBox="0 0 ${W} 26" preserveAspectRatio="none" data-dtip="${esc(r.s)}|£${nf(r.v)} a head here${r.e != null ? ' · £' + nf(r.e) + ' in England' : ''}">${bar}</svg><span class="mono">${S.council === 'diff' ? (diff == null ? '–' : (diff >= 0 ? '+£' : '−£') + nf(Math.abs(diff))) : (r.v < 0 ? '−£' + nf(-r.v) : '£' + nf(r.v))}</span></div>`;
      }).join('');
      $('#d-councilnote').innerHTML = `<div class="d-lab" style="padding:8px 4px">${S.council === 'diff' ? '<span style="color:var(--c2)">■</span> more than England &nbsp; <span style="color:var(--c1)">■</span> less than England' : '<b>▏</b> = England per head'}</div><div class="d-note">Per resident per year, for the council(s) serving this area. Services are split differently between district, county and unitary councils, so compare like with like. A negative figure means income from fees and charges is larger than spending.</div>`;
    };

    // ---------- treemap (single areas) and the list of areas inside (regions and nations)
    const squarify = (items, x, y, w, h) => {
      const out = [], tot = items.reduce((s, i) => s + i.v, 0); if (!tot) return out;
      let rest = items.map(i => ({...i, a: i.v / tot * w * h}));
      while (rest.length) {
        const short = Math.min(w, h), row = []; let area = 0, best = Infinity;
        const worst = (r, s) => { const sum = r.reduce((a, b) => a + b.a, 0), mx = Math.max(...r.map(b => b.a)), mn = Math.min(...r.map(b => b.a)); return Math.max(s * s * mx / (sum * sum), sum * sum / (s * s * mn)); };
        while (rest.length) { const t = [...row, rest[0]], wv = worst(t, short); if (row.length && wv > best) break; row.push(rest.shift()); best = wv; }
        area = row.reduce((a, b) => a + b.a, 0);
        if (w >= h) { const rw = area / h; let yy = y; row.forEach(r => { const rh = r.a / rw; out.push({...r, x, y: yy, w: rw, h: rh}); yy += rh; }); x += rw; w -= rw; }
        else { const rh = area / w; let xx = x; row.forEach(r => { const rw2 = r.a / rh; out.push({...r, x: xx, y, w: rw2, h: rh}); xx += rw2; }); y += rh; h -= rh; }
      }
      return out;
    };
    const drawTm = () => {
      if (!$('#d-tm')) return;
      $$('[data-tm]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tm === S.tm)); $$('[data-tmsrc]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tmsrc === S.tmsrc));
      const src = S.tm === 'department' ? d.payments_by_department : d.payments_by_category, agg = {};
      (src || []).filter(x => x.source === S.tmsrc).forEach(x => { const k = x[S.tm] || 'Unclassified'; agg[k] = (agg[k] || 0) + x.amount_gbp; });
      let items = Object.entries(agg).map(([k, v]) => ({k, v})).filter(i => i.v > 0).sort((a, b) => b.v - a.v);
      if (items.length > 14) { const o = items.slice(13).reduce((s, i) => s + i.v, 0); items = items.slice(0, 13).concat([{k: 'All others', v: o}]); }
      const box = $('#d-tm'), W = box.clientWidth || 520, H = 430, tot = items.reduce((s, i) => s + i.v, 0);
      if (!items.length) box.innerHTML = '<div class="d-note" style="margin:16px">Nothing of this kind is placed in this area.</div>';
      else box.innerHTML = squarify(items, 0, 0, W, H).map((r, i, a) => { const lvl = clamp(6 - Math.floor(i * 6 / Math.max(1, a.length)), 1, 6); return `<div style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:var(--s${lvl});color:var(--f${lvl})" data-dtip="${esc(r.k)}|${gbp(r.v)} · ${nf(100 * r.v / tot, 1)}%">${r.w > 70 && r.h > 34 ? `<b>${esc(r.k)}</b><span>${gbp(r.v)}</span>` : ''}</div>`; }).join('');
      const sup = d.suppliers || [], mx = Math.max(1, ...sup.map(s => s.amount_gbp));
      $('#d-sup').innerHTML = `<div class="d-lab">Largest recipients here, 2025-26 payments</div>` + (sup.length ? sup.slice(0, 10).map(s => `<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;gap:10px;font-size:.84rem"><span>${esc(s.supplier)}</span><b class="mono">${gbp(s.amount_gbp)}</b></div><div style="height:6px;border-radius:3px;background:var(--hair);margin-top:3px"><div style="height:6px;border-radius:3px;background:var(--c2);width:${(100 * s.amount_gbp / mx).toFixed(1)}%"></div></div></div>`).join('') : '<p>None placed here.</p>') + `<div class="d-note">Where a recipient is registered, not where the money is spent: a hospital trust’s head office or a shared-service centre can sit in a different area from the patients.</div>`;
    };
    const drawKids = () => {
      if (!$('#d-kids')) return;
      $$('[data-kids]').forEach(b => b.setAttribute('aria-pressed', b.dataset.kids === S.kids));
      const id = S.kids, m = MD[id] || DM[id] || {unit: id === 'population' || id === 'dwp_spend_total' ? (id === 'population' ? 'people' : 'GBP') : 'percent'}, kids = (d.children || []).filter(k => k[id] != null).sort((a, b) => b[id] - a[id]);
      if (!kids.length) { $('#d-kids').innerHTML = '<div class="d-note">No figures for the areas inside.</div>'; return; }
      const mx = Math.max(...kids.map(k => k[id])) * 1.05, W = 520;
      $('#d-kids').innerHTML = kids.map(k => `<div data-go="${esc(k.code)}" data-golevel="${esc(k.level)}" style="cursor:pointer"><span><a>${esc(k.name)}</a></span><svg viewBox="0 0 ${W} 26" preserveAspectRatio="none" data-dtip="${esc(k.name)}|${fv(m, k[id])}"><line x1="0" x2="${W}" y1="13" y2="13" stroke="var(--rule)"/><rect x="0" y="7" width="${Math.max(2, (W - 8) * k[id] / mx)}" height="12" rx="3" fill="var(--c1)"/></svg><span class="mono">${fvShort(m, k[id])}</span></div>`).join('');
    };

    // ---------- events
    $('#d-metric').innerHTML = metricOptions(); $('#d-metric').value = S.metric;
    root.addEventListener('change', e => { if (e.target.id === 'd-metric') { S.metric = e.target.value; S.mode = 'abs'; drawHex(); drawStrips(); } });
    root.addEventListener('click', e => {
      const fh = e.target.closest('[data-fold]');
      if (fh && !e.target.closest('a,button')) { const sec = fh.closest('.d-sec'); fold(fh.dataset.fold, !sec.classList.contains('collapsed')); return; }
      const t = e.target.closest('[data-metric],[data-mode],[data-table],[data-region],[data-group],[data-sortu],[data-waffle],[data-council],[data-tm],[data-tmsrc],[data-go],[data-jump],[data-foldall],[data-kids],polygon[data-i]'); if (!t) return;
      const D = t.dataset;
      if (D.foldall) { $$('.d-sec').forEach(sec => fold(sec.id.slice(2), D.foldall === 'close')); return; }
      if (D.jump) { const el = document.getElementById(D.jump); if (el) { fold(D.jump.slice(2), false); el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'}); } return; }
      if (D.go) { const lv = D.golevel || (M.level === 'local_authority' ? 'local_authority' : 'constituency'); opts.go('#areas/' + lv + '/' + encodeURIComponent(D.go)); return; }
      if (t.tagName === 'polygon') { opts.go('#areas/' + (M.level === 'local_authority' ? 'local_authority' : 'constituency') + '/' + encodeURIComponent(A[+D.i].code)); return; }
      if (D.metric) { S.metric = D.metric; $('#d-metric').value = D.metric; S.mode = 'abs'; drawHex(); drawStrips(); if (t.classList.contains('d-vital') || t.tagName === 'A') document.getElementById('d-map').scrollIntoView({behavior: 'smooth'}); return; }
      if (D.mode) { S.mode = D.mode; drawHex(); return; }
      if (D.table) { S.table = !S.table; drawHex(); return; }
      if (D.region !== undefined) { if (D.region === '__country') return; S.region = D.region || null; S.country = null; drawRegions(); drawHex(); drawStrips(); return; }
      if (D.group) { S.group = D.group; drawGroups(); drawStrips(); return; }
      if (D.sortu) { S.sortUnusual = !S.sortUnusual; t.setAttribute('aria-pressed', S.sortUnusual); drawStrips(); return; }
      if (D.waffle) { S.waffle = D.waffle; $$('[data-waffle]').forEach(b => b.setAttribute('aria-pressed', b.dataset.waffle === S.waffle)); drawWaffle(); return; }
      if (D.council) { S.council = D.council; $$('[data-council]').forEach(b => b.setAttribute('aria-pressed', b.dataset.council === S.council)); drawCouncil(); return; }
      if (D.kids) { S.kids = D.kids; drawKids(); return; }
      if (D.tm) { S.tm = D.tm; drawTm(); return; }
      if (D.tmsrc) { S.tmsrc = D.tmsrc; drawTm(); }
    });
    root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && (e.target.classList.contains('d-strip') || e.target.hasAttribute('data-fold'))) { e.preventDefault(); e.target.click(); } });
    root.addEventListener('mousemove', e => {
      const p = e.target.closest('polygon[data-i]'), t = e.target.closest('[data-dtip]'), w = e.target.closest('.d-waffle rect'), wl = e.target.closest('.d-wleg [data-cat]');
      if (p) { const i = +p.dataset.i, a = A[i], m = MD[S.metric], v = info(S.metric).v[i], rf = ref(S.metric); tip(`<b>${esc(a.name)}</b>${esc(regionOf(a))}<br>${esc(m.title)}: <b style="display:inline">${fv(m, v)}</b>${rf && v != null ? '<br>' + esc(rf.label) + ': ' + fv(m, rf.v) : ''}`, e); }
      else if (t) { const [h, b] = t.dataset.dtip.split('|'); tip(`<b>${h}</b>${b}`, e); }
      else tip(null);
      const hot = w ? w.dataset.cat : wl ? wl.dataset.cat : null;
      $$('.d-waffle rect').forEach(r => r.classList.toggle('dim', hot != null && r.dataset.cat !== hot)); $$('.d-wleg [data-cat]').forEach(r => r.classList.toggle('hot', hot != null && r.dataset.cat === hot));
    });
    root.addEventListener('mouseleave', () => tip(null));

    drawRegions(); drawHex(); drawGroups(); drawStrips(); drawWaffle(); drawAge(); drawCouncil(); drawTm(); drawKids();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.contains(root)) { drawTm(); drawStrips(); } }, 150); });
  }
  window.DASH = {mount};
})();
