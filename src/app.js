(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var IMG_ORIGIN = 'data:image/jpeg;base64,@@ORIGIN@@';
  var IMG_PROFUEL = 'data:image/jpeg;base64,@@PROFUEL@@';

  /* ---------- Bedingungen ---------- */
  var CONDS = {
    'null':   { label: 'Nullrunde (kein Koffein)', short: 'Null', mg: 0, group: 'null' },
    'kaffee': { label: 'Filterkaffee, 1 große Tasse (ca. 250 ml)', short: 'Kaffee', mg: 100, group: 'kaffee', prod: 'kaffee' },
    'energy': { label: 'Energy Drink: Monster 500 ml oder 2× Red Bull 250 ml', short: 'Energy', mg: 160, group: 'energy', prod: 'energy' },
    't200':   { label: 'ProFuel-Tablette, 1 Stück', short: 'Tab 200', mg: 200, group: 'tablette', prod: 'profuel' },
    't300':   { label: 'ProFuel-Tabletten, 1,5 Stück', short: 'Tab 300', mg: 300, group: 'tablette', prod: 'profuel' },
    'o150':   { label: 'Origin Pre-Workout, ½ Portion', short: 'Origin ½', mg: 150, group: 'booster', prod: 'origin' },
    'o300':   { label: 'Origin Pre-Workout, 1 Portion', short: 'Origin 1', mg: 300, group: 'booster', prod: 'origin' },
    'sonst':  { label: 'Sonstiges (in Notiz erklären)', short: 'Sonst.', mg: null, group: 'sonst' }
  };
  var GROUP_LABEL = { 'null': 'Nullrunde', kaffee: 'Kaffee', energy: 'Energy Drink', tablette: 'Tablette', booster: 'Booster (Origin)', sonst: 'Sonstiges' };
  var COND_ORDER = ['kaffee', 'energy', 't200', 'o150', 't300', 'o300'];
  var PLAN_DATES = ['2026-11-06', '2026-11-10', '2026-11-13', '2026-11-17', '2026-11-20', '2026-11-24', '2026-11-27', '2026-11-29'];
  var DEF_HYP = {
    h1: 'Mit mehr Koffein steigen die Wiederholungen zuerst um etwa 1 bis 3 gegenüber der Nullrunde und flachen dann ab. Bei Malte (64 kg) erwarten wir den Höhepunkt früher, weil dieselbe Menge bei ihm mehr mg pro kg ausmacht (200 mg sind 3,1 mg/kg). Paul (91 kg) braucht mehr, 200 mg sind nur 2,2 mg/kg.',
    h2: 'Pro Milligramm wirkt Koffein aus Kaffee, Energy Drink und Tablette ähnlich. Energy könnte durch Zucker und Taurin minimal mehr bringen, das ist bei zwei Personen aber kaum vom Rauschen zu trennen. Die Tablette liefert die sauberste Dosis.',
    h3: 'Origin (1 Portion, 300 mg Koffein) gegen die Tablette mit 300 mg: höchstens 0 bis 1 Wiederholung mehr, denn die weiteren Inhaltsstoffe (Citrullin, Beta-Alanin) wirken eher über mehrere Sätze. Mehr Pre-Workout bringt oberhalb von etwa 3 bis 4 mg/kg kaum noch etwas, eher Zittern und Unruhe.',
    deutung: 'Stand nach Sitzung 3: Paul 10, 12, 13 Wiederholungen, Malte 10, 11, 12. Beide steigen mit der Dosis um 2 bis 3. Mögliche Erklärung: Koffein senkt die gefühlte Anstrengung und hält die Muskelansteuerung länger hoch. Gegenerklärungen: Wir wissen, wann wir Koffein nehmen (kein Placebo, Erwartung wirkt mit), Lerneffekt durch dritte Messung in kurzer Zeit, Tagesform, feste Reihenfolge. Erst die zweite Nullrunde in Sitzung 8 zeigt, wie viel davon Lerneffekt ist.'
  };

  var METRICS = {
    reps:   { label: 'Wiederholungen bis Versagen', unit: 'Wdh.', get: function (s) { return s.reps; } },
    pct:    { label: 'Veränderung zur Nullrunde (%)', unit: '%', get: function (s) { var b = baseline(s.person); return (s.reps != null && b) ? (s.reps / b - 1) * 100 : null; } },
    dreps:  { label: 'Wiederholungen minus Nullrunde', unit: 'Wdh.', get: function (s) { var b = baseline(s.person); return (s.reps != null && b != null) ? s.reps - b : null; } },
    rpe:    { label: 'Anstrengung (RPE)', unit: 'RPE', get: function (s) { return s.rpe; } },
    hrmax:  { label: 'Puls maximal im Satz', unit: 'bpm', get: function (s) { return s.hrmax; } },
    hrrec:  { label: 'Puls-Abfall in 1 Minute', unit: 'bpm', get: function (s) { return s.hrrec; } },
    rmssd:  { label: 'Ruhe-HRV (RMSSD)', unit: 'ms', get: function (s) { return s.rmssd; } },
    dsys60: { label: 'Blutdruck oben, Änderung nach 60 min', unit: 'mmHg', get: function (s) { return diff(s.sys60, s.sys0); } }
  };
  var XAXES = {
    mgkg:  { label: 'Koffein (mg pro kg Körpergewicht)', unit: 'mg/kg', get: function (s) { return mgkg(s); } },
    mg:    { label: 'Koffein (mg)', unit: 'mg', get: function (s) { return s.mg; } },
    mgffm: { label: 'Koffein (mg pro kg fettfreie Masse, braucht Waagen-Daten)', unit: 'mg/kg', get: function (s) { var b = bodyFor(s.person, s.date), kg = kgOf(s); return (s.mg != null && b && b.fat != null && kg) ? s.mg / (kg * (1 - b.fat / 100)) : null; } },
    sleep: { label: 'Schlaf, Mittel der letzten 3 Nächte (h)', unit: 'h', get: function (s) { return sleepAvg(s); } }
  };

  /* ---------- Zustand ---------- */
  var cfg = { names: ['Malte', 'Paul'], kg: [null, null], rm1: [null, null], u18: [false, false], order: COND_ORDER.slice(), hyp: DEF_HYP, prep: {} };
  var sessions = [], bodies = [], imgs = {};
  var ui = { bm: 'kg', bdelArm: null, sess: null, tab: 'start', ws: 'produkte', person: 'both', y: 'reps', x: 'mgkg', step: 0, editId: null, loaded: false, clean: false, delArm: null, pres: false };
  var dbApi = null, downloadsApi = null, memMode = false, standalone = false, cfgTimer = null, hypTimer = null, warned = false;

  /* ---------- Hilfen ---------- */
  function num(v) { return (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v); }
  function fmt(v, d) { if (v === null || v === undefined || isNaN(v)) return '–'; return Number(v).toLocaleString('de-DE', { maximumFractionDigits: d === undefined ? 1 : d }); }
  function diff(a, b) { return (a == null || b == null) ? null : a - b; }
  function mean(a) { a = a.filter(function (v) { return v != null && !isNaN(v); }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function name(i) { return cfg.names[i] || (i === 0 ? 'Malte' : 'Paul'); }
  function pcolor(i) { return i === 0 ? 'var(--p1)' : 'var(--p2)'; }
  function mgkg(s) { var kg = kgOf(s); return (s.mg != null && kg) ? s.mg / kg : null; }
  function bodyFor(p, iso) {
    var t0 = new Date((iso || '') + 'T12:00:00').getTime(); if (isNaN(t0)) return null;
    var best = null, bd = Infinity;
    bodies.forEach(function (b) { if (b.person !== p || !b.date || b.kg == null) return; var dd = Math.abs(new Date(b.date + 'T12:00:00').getTime() - t0); if (dd < bd) { bd = dd; best = b; } });
    return best && bd <= 14 * 86400000 ? best : null;
  }
  function kgOf(s) { var b = bodyFor(s.person, s.date); return (b && b.kg) || s.kg || cfg.kg[s.person] || null; }
  function imgFor(key) { return imgs[key] || (key === 'origin' ? IMG_ORIGIN : key === 'profuel' ? IMG_PROFUEL : null); }
  function sleepAvg(s) { var v = [s.s1, s.s2, s.s3].filter(function (x) { return x != null; }); return v.length === 3 ? mean(v) : null; }
  function dateDE(iso) { if (!iso) return '–'; var p = iso.split('-'); return p[2] + '.' + p[1] + '.'; }
  function dayDE(iso) { var d = new Date(iso + 'T12:00:00'); return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()] + ' ' + dateDE(iso); }
  function use(s) { return !ui.clean || !(s.flags && s.flags.length); }
  function usable() { return sessions.filter(use); }
  function baseline(p) { return mean(usable().filter(function (s) { return s.person === p && s.cond === 'null' && s.reps != null; }).map(function (s) { return s.reps; })); }
  function noise(p) { var r = usable().filter(function (s) { return s.person === p && s.cond === 'null' && s.reps != null; }).map(function (s) { return s.reps; }); return r.length >= 2 ? Math.max.apply(null, r) - Math.min.apply(null, r) : null; }
  function condMean(p, c) { return mean(usable().filter(function (s) { return s.person === p && s.cond === c && s.reps != null; }).map(function (s) { return s.reps; })); }
  function limitMg(p, kg) { var k = kg || cfg.kg[p]; if (cfg.u18[p]) return k ? Math.min(400, 3 * k) : null; return 400; }
  function safety(p, mg, extra, kg) {
    var lim = limitMg(p, kg), tot = (mg || 0) + (extra || 0), kk = kg || cfg.kg[p];
    if (lim == null) return { st: 'warn', txt: 'Körpergewicht fehlt: die Grenze für unter 18 kann nicht berechnet werden.' };
    var per = kk ? ' (' + fmt(tot / kk, 1) + ' mg/kg)' : '';
    if (tot <= lim) return { st: 'ok', txt: 'Tagesgesamt ' + fmt(tot, 0) + ' mg' + per + ', Grenze ' + fmt(lim, 0) + ' mg. Im Rahmen.' };
    return { st: 'bad', txt: 'Tagesgesamt ' + fmt(tot, 0) + ' mg' + per + ' liegt über der Grenze von ' + fmt(lim, 0) + ' mg. Dosis senken oder Sitzung verschieben.' };
  }
  function pill(st, t) { return '<span class="pill ' + st + '">' + t + '</span>'; }
  function banner(cls, txt, btn) { return '<div class="banner ' + cls + '"><span>' + txt + '</span>' + (btn || '') + '</div>'; }
  function planConds() { return ['null'].concat(cfg.order && cfg.order.length === 6 ? cfg.order : COND_ORDER).concat(['null']); }
  function flagsOf(d) {
    var f = [];
    var sl = sleepAvg(d); if (sl != null && sl < 7) f.push('Schlaf unter 7 h');
    if (d.extra) f.push('Zusatzkoffein');
    if (d.cond !== 'null' && d.wait != null && d.wait !== 60) f.push('Wartezeit nicht 60 min');
    if (!d.meal) f.push('Mahlzeit fehlt');
    return f;
  }

  /* ---------- Speicher ---------- */
  var LS = 'koffein-kurve-v2';
  function lsRead() { try { var o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o) { sessions = o.sessions || []; bodies = o.bodies || []; if (o.cfg) cfg = Object.assign({ prep: {} }, o.cfg); } } catch (e) { }
    try { imgs = JSON.parse(localStorage.getItem(LS + '-img') || '{}') || {}; } catch (e) { } }
  function lsWrite() { try { localStorage.setItem(LS, JSON.stringify({ sessions: sessions, bodies: bodies, cfg: cfg })); } catch (e) { }
    try { localStorage.setItem(LS + '-img', JSON.stringify(imgs)); } catch (e) { } }
  var store = {
    save: function (id, data) {
      if (memMode) { data.id = id; var i = sessions.findIndex(function (s) { return s.id === id; }); if (i >= 0) sessions[i] = data; else sessions.push(data); lsWrite(); renderAll(); return Promise.resolve(); }
      return dbApi.doc('sessions/' + id).set(data);
    },
    del: function (id) {
      if (memMode) { sessions = sessions.filter(function (s) { return s.id !== id; }); lsWrite(); renderAll(); return Promise.resolve(); }
      return dbApi.doc('sessions/' + id).delete();
    },
    newId: function () { return memMode ? 's' + Date.now().toString(36) + Math.floor(Math.random() * 1000) : dbApi.collection('sessions').doc().id; },
    saveBody: function (id, data) {
      if (memMode) { data.id = id; var i = bodies.findIndex(function (b) { return b.id === id; }); if (i >= 0) bodies[i] = data; else bodies.push(data); lsWrite(); renderAll(true); return Promise.resolve(); }
      return dbApi.doc('body/' + id).set(data);
    },
    delBody: function (id) {
      if (memMode) { bodies = bodies.filter(function (b) { return b.id !== id; }); lsWrite(); renderAll(true); return Promise.resolve(); }
      return dbApi.doc('body/' + id).delete();
    },
    saveImg: function (key, data) {
      if (memMode) { if (data) imgs[key] = data; else delete imgs[key]; lsWrite(); renderAll(true); return Promise.resolve(); }
      return data ? dbApi.doc('images/' + key).set({ data: data }) : dbApi.doc('images/' + key).delete();
    },
    saveCfg: function () {
      if (memMode) { lsWrite(); return Promise.resolve(); }
      return dbApi.doc('config/main').set({ names: cfg.names, kg: cfg.kg, rm1: cfg.rm1, u18: cfg.u18, order: cfg.order, hyp: cfg.hyp, prep: cfg.prep || {} });
    }
  };
  function clean(d) { var o = {}; Object.keys(d).forEach(function (k) { if (d[k] !== undefined && k !== 'id') o[k] = d[k]; }); return o; }
  function seq(list, fn) { return list.reduce(function (p, x) { return p.then(function () { return fn(x); }); }, Promise.resolve()); }

  /* ---------- SVG-Marker ---------- */
  function niceScale(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
    for (var v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v / step) * step);
    return { lo: lo, hi: hi, ticks: t };
  }
  function marker(group, cx, cy, color, ex, idx) {
    var o = ex ? ' opacity=".55"' : '', a = ' data-i="' + idx + '" tabindex="0" style="cursor:pointer"' + o, r = 7;
    if (group === 'null') return '<circle' + a + ' cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--surface)" stroke="' + color + '" stroke-width="2.6"/>';
    if (group === 'kaffee') return '<rect' + a + ' x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" rx="1.5" fill="' + color + '"/>';
    if (group === 'energy') return '<polygon' + a + ' points="' + cx + ',' + (cy - r - 2) + ' ' + (cx + r + 2) + ',' + (cy + r) + ' ' + (cx - r - 2) + ',' + (cy + r) + '" fill="' + color + '"/>';
    if (group === 'booster') return '<polygon' + a + ' points="' + cx + ',' + (cy - r - 2) + ' ' + (cx + r + 2) + ',' + cy + ' ' + cx + ',' + (cy + r + 2) + ' ' + (cx - r - 2) + ',' + cy + '" fill="' + color + '"/>';
    if (group === 'sonst') return '<path' + a + ' d="M' + (cx - r) + ' ' + (cy - r) + 'L' + (cx + r) + ' ' + (cy + r) + 'M' + (cx + r) + ' ' + (cy - r) + 'L' + (cx - r) + ' ' + (cy + r) + '" stroke="' + color + '" stroke-width="3" fill="none"/>';
    return '<circle' + a + ' cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
  }
  function legendShape(group) {
    var c = 'var(--ink2)', s = '<svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">';
    if (group === 'null') s += '<circle r="5.5" fill="var(--surface)" stroke="' + c + '" stroke-width="2"/>';
    else if (group === 'kaffee') s += '<rect x="-5.5" y="-5.5" width="11" height="11" rx="1" fill="' + c + '"/>';
    else if (group === 'energy') s += '<polygon points="0,-7 7,5.5 -7,5.5" fill="' + c + '"/>';
    else if (group === 'booster') s += '<polygon points="0,-8 8,0 0,8 -8,0" fill="' + c + '"/>';
    else if (group === 'sonst') s += '<path d="M-5 -5L5 5M5 -5L-5 5" stroke="' + c + '" stroke-width="2.5"/>';
    else s += '<circle r="5.5" fill="' + c + '"/>';
    return s + '</svg>';
  }

  /* ---------- Ergebnisse ---------- */
  var scatterPts = [];
  function renderScatter() {
    var Y = METRICS[ui.y], X = XAXES[ui.x], pts = [];
    usable().forEach(function (s) {
      if (ui.person !== 'both' && s.person !== ui.person) return;
      var x = X.get(s), y = Y.get(s);
      if (x == null || y == null) return;
      pts.push({ s: s, x: x, y: y });
    });
    scatterPts = pts;
    var box = $('scatter');
    if (!pts.length) { box.innerHTML = '<div class="empty">Dafür gibt es noch keine Werte. Trage unter „Messen“ die erste Messung ein.</div>'; $('legend').innerHTML = ''; return; }
    var W = 640, H = 340, L = 54, R = 16, T = 14, B = 46;
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; }), bl = [];
    if (ui.y === 'reps') [0, 1].forEach(function (p) { if (ui.person !== 'both' && ui.person !== p) return; var b = baseline(p); if (b != null) { var n = noise(p); bl.push({ p: p, b: b, n: n }); ys.push(b); if (n != null) { ys.push(b - n / 2); ys.push(b + n / 2); } } });
    if (ui.y === 'pct' || ui.y === 'dreps' || ui.y === 'dsys60') ys.push(0);
    var sx = niceScale(Math.min.apply(null, xs.concat([0])), Math.max.apply(null, xs), 6), sy = niceScale(Math.min.apply(null, ys), Math.max.apply(null, ys), 5);
    var fx = function (v) { return L + (v - sx.lo) / (sx.hi - sx.lo) * (W - L - R); };
    var fy = function (v) { return H - B - (v - sy.lo) / (sy.hi - sy.lo) * (H - B - T); };
    var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Streudiagramm ' + esc(Y.label) + ' gegen ' + esc(X.label) + '">';
    sy.ticks.forEach(function (t) { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + fy(t) + '" y2="' + fy(t) + '"/><text x="' + (L - 8) + '" y="' + (fy(t) + 4) + '" text-anchor="end">' + fmt(t, 1) + '</text>'; });
    sx.ticks.forEach(function (t) { g += '<line class="axis" x1="' + fx(t) + '" x2="' + fx(t) + '" y1="' + (H - B) + '" y2="' + (H - B + 5) + '"/><text x="' + fx(t) + '" y="' + (H - B + 19) + '" text-anchor="middle">' + fmt(t, 1) + '</text>'; });
    g += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/><line class="axis" x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (H - B) + '"/>';
    if (ui.y === 'pct' || ui.y === 'dreps' || ui.y === 'dsys60') g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + fy(0) + '" y2="' + fy(0) + '" stroke="var(--ink2)" stroke-width="1.2"/>';
    bl.forEach(function (o) {
      if (o.n != null && o.n > 0) g += '<rect x="' + L + '" y="' + fy(o.b + o.n / 2) + '" width="' + (W - L - R) + '" height="' + Math.max(1, fy(o.b - o.n / 2) - fy(o.b + o.n / 2)) + '" fill="' + pcolor(o.p) + '" opacity=".13"/>';
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + fy(o.b) + '" y2="' + fy(o.b) + '" stroke="' + pcolor(o.p) + '" stroke-width="1.5" stroke-dasharray="6 5"/>';
    });
    [0, 1].forEach(function (p) {
      var line = pts.filter(function (q) { return q.s.person === p && ['kaffee', 'energy', 't200', 't300'].indexOf(q.s.cond) >= 0; }).sort(function (a, b) { return a.x - b.x; });
      if (ui.x !== 'sleep' && line.length > 1) g += '<polyline fill="none" stroke="' + pcolor(p) + '" stroke-width="2" opacity=".5" points="' + line.map(function (q) { return fx(q.x) + ',' + fy(q.y); }).join(' ') + '"/>';
    });
    pts.forEach(function (q, i) { g += marker(CONDS[q.s.cond] ? CONDS[q.s.cond].group : 'sonst', fx(q.x), fy(q.y), pcolor(q.s.person), false, i); });
    g += '<text class="ttl" x="' + (L + (W - L - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(X.label) + '</text>';
    g += '<text class="ttl" transform="translate(13 ' + (T + (H - B - T) / 2) + ') rotate(-90)" text-anchor="middle">' + esc(Y.label) + '</text></svg>';
    box.innerHTML = g;
    Array.prototype.forEach.call(box.querySelectorAll('[data-i]'), function (n) {
      var show = function () { var q = scatterPts[Number(n.getAttribute('data-i'))], s = q.s; $('pointInfo').innerHTML = '<b style="color:' + pcolor(s.person) + '">' + esc(name(s.person)) + '</b> · ' + dateDE(s.date) + ' · ' + esc(CONDS[s.cond] ? CONDS[s.cond].label : s.cond) + '' + '<br><span class="mono">' + fmt(q.y, 1) + ' ' + Y.unit + ' bei ' + fmt(q.x, 2) + ' ' + X.unit + '</span> · Wdh. ' + fmt(s.reps, 0) + (s.notes ? '<br>' + esc(s.notes) : '') + (s.flags && s.flags.length ? '<br>' + pill('warn', 'Abweichung: ' + esc(s.flags.join(', '))) : ''); };
      n.addEventListener('mouseenter', show); n.addEventListener('click', show); n.addEventListener('focus', show);
    });
    var gs = {}; pts.forEach(function (q) { gs[CONDS[q.s.cond] ? CONDS[q.s.cond].group : 'sonst'] = true; });
    var lg = Object.keys(GROUP_LABEL).filter(function (k) { return gs[k]; }).map(function (k) { return '<span>' + legendShape(k) + GROUP_LABEL[k] + '</span>'; }).join('');
    lg += [0, 1].map(function (p) { return (ui.person === 'both' || ui.person === p) ? '<span><i class="dot" style="background:' + pcolor(p) + '"></i>' + esc(name(p)) + '</span>' : ''; }).join('');
    if (bl.length) lg += '<span>gestrichelt: Nullrunde, Band: Rauschen</span>';
    $('legend').innerHTML = lg;
  }
  function barChart(rows, aria) {
    var vals = []; rows.forEach(function (r) { r.v.forEach(function (v) { if (v != null) vals.push(v); }); });
    if (!vals.length) return '<div class="empty">Noch zu wenig Daten (je Person eine Nullrunde und die Bedingung).</div>';
    var nz = [noise(0), noise(1)].filter(function (v) { return v != null; }), nmax = nz.length ? Math.max.apply(null, nz) : 0;
    var W = 640, H = 270, L = 44, R = 12, T = 22, B = 44;
    var sy = niceScale(Math.min.apply(null, vals.concat([0, -nmax])), Math.max.apply(null, vals.concat([0, nmax])), 5);
    var fy = function (v) { return H - B - (v - sy.lo) / (sy.hi - sy.lo) * (H - B - T); };
    var gw = (W - L - R) / rows.length, bw = Math.min(30, gw / 3);
    var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + aria + '">';
    sy.ticks.forEach(function (t) { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + fy(t) + '" y2="' + fy(t) + '"/><text x="' + (L - 8) + '" y="' + (fy(t) + 4) + '" text-anchor="end">' + fmt(t, 1) + '</text>'; });
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + fy(0) + '" y2="' + fy(0) + '" stroke="var(--ink2)" stroke-width="1.2"/>';
    if (nmax > 0) [nmax / 2, -nmax / 2].forEach(function (v) { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + fy(v) + '" y2="' + fy(v) + '" stroke="var(--ink2)" stroke-dasharray="6 5" opacity=".7"/>'; });
    rows.forEach(function (r, i) {
      var cx = L + gw * (i + .5);
      [0, 1].forEach(function (p) {
        var v = r.v[p]; if (v == null) return;
        var x = cx + (p === 0 ? -bw - 2 : 2), y0 = fy(0), y1 = fy(v);
        g += '<rect class="bar' + (v < 0 ? ' bn' : '') + '" style="--i:' + (i * 2 + p) + '" x="' + x + '" y="' + Math.min(y0, y1) + '" width="' + bw + '" height="' + Math.max(1.5, Math.abs(y1 - y0)) + '" rx="2" fill="' + pcolor(p) + '"/>';
        g += '<text x="' + (x + bw / 2) + '" y="' + (v >= 0 ? y1 - 5 : y1 + 13) + '" text-anchor="middle">' + (v > 0 ? '+' : '') + fmt(v, 1) + '</text>';
      });
      g += '<text x="' + cx + '" y="' + (H - 20) + '" text-anchor="middle" class="ttl">' + esc(r.label) + '</text>';
    });
    return g + '</svg><div class="legend">' + [0, 1].map(function (p) { return '<span><i class="dot" style="background:' + pcolor(p) + '"></i>' + esc(name(p)) + '</span>'; }).join('') + (nmax > 0 ? '<span>gestrichelt: Rauschen ± halber Abstand der Nullrunden</span>' : '') + '</div>';
  }
  function renderBars() {
    var rows = ['kaffee', 'energy', 't200', 't300', 'o150', 'o300'].map(function (c) {
      var o = { label: CONDS[c].short, v: [null, null] };
      [0, 1].forEach(function (p) { var b = baseline(p), m = condMean(p, c); o.v[p] = (m != null && b != null) ? m - b : null; });
      return o;
    });
    $('bars').innerHTML = barChart(rows, 'Unterschied der Wiederholungen zur Nullrunde nach Bedingung');
  }
  function renderVs() {
    var h = '<div class="stack">';
    var any = false;
    [0, 1].forEach(function (p) {
      var o = condMean(p, 'o300'), t = condMean(p, 't300'), n = noise(p);
      var line;
      if (o == null || t == null) line = '<span class="hint">Es fehlt Origin 1 Portion oder die Tablette 300 mg.</span>';
      else { any = true; var d = o - t; line = '<span class="mono big">' + (d > 0 ? '+' : '') + fmt(d, 1) + ' Wdh.</span> ' + (n != null ? (Math.abs(d) <= n / 2 ? pill('ex', 'im Rauschen') : d > 0 ? pill('ok', 'Booster vorn') : pill('warn', 'Tablette vorn')) : pill('ex', 'Rauschmaß fehlt')); }
      h += '<div><b style="color:' + pcolor(p) + '">' + esc(name(p)) + '</b>: Origin 1 Portion minus Tablette 300 mg<br>' + line + '</div>';
    });
    $('vsBox').innerHTML = h + '</div>' + (any ? '' : '');
  }
  function slope(p) {
    var pts = usable().filter(function (s) { return s.person === p && ['kaffee', 'energy', 't200', 't300'].indexOf(s.cond) >= 0 && s.reps != null && mgkg(s) != null; }).map(function (s) { return [mgkg(s), s.reps]; });
    if (pts.length < 3) return null;
    var mx = mean(pts.map(function (a) { return a[0]; })), my = mean(pts.map(function (a) { return a[1]; })), sxx = 0, sxy = 0;
    pts.forEach(function (a) { sxx += (a[0] - mx) * (a[0] - mx); sxy += (a[0] - mx) * (a[1] - my); });
    return sxx ? sxy / sxx : null;
  }
  function hrStats(s) {
    var h = s.hrs, n = h.length, st = mean(h.slice(0, 3)), pk = Math.max.apply(null, h), tp = h.indexOf(pk), av = s.hravg != null ? s.hravg : mean(h);
    return { n: n, start: st, peak: pk, tPeak: tp, avg: av, rise: pk - st, beats: Math.round(av * n / 60), end: mean(h.slice(-3)) };
  }
  function lineSVG(list, lo, hi, n, opt) {
    var W = 320, H = opt.h || 130, L = 32, B = 18, T = 8, R = 8;
    function X(i) { return L + i / Math.max(1, n - 1) * (W - L - R); } function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var g = '', step = (hi - lo) > 60 ? 20 : 10, v; for (v = Math.ceil(lo / step) * step; v <= hi; v += step) g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text x="' + (L - 3) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
    var body = list.map(function (o) {
      var pts = o.hrs.map(function (q, i) { return X(i).toFixed(1) + ',' + Y(q).toFixed(1); }).join(' ');
      var extra = '';
      if (opt.detail) { var S = hrStats(o.s); extra = '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(S.start).toFixed(1) + '" y2="' + Y(S.start).toFixed(1) + '" stroke="var(--ink2)" stroke-dasharray="3 4" opacity=".6"/><polygon fill="' + o.color + '" opacity=".12" points="' + L + ',' + Y(lo).toFixed(1) + ' ' + pts + ' ' + X(o.hrs.length - 1).toFixed(1) + ',' + Y(lo).toFixed(1) + '"/><circle cx="' + X(S.tPeak).toFixed(1) + '" cy="' + Y(S.peak).toFixed(1) + '" r="4.5" fill="' + o.color + '"/><text x="' + Math.min(W - R - 2, X(S.tPeak) + 7).toFixed(1) + '" y="' + (Y(S.peak) - 6).toFixed(1) + '" text-anchor="' + (X(S.tPeak) > W - 60 ? 'end' : 'start') + '" style="font-weight:600">' + S.peak + '</text>'; }
      return extra + '<polyline fill="none" stroke="' + o.color + '" stroke-width="' + (opt.detail ? 2.6 : 2) + '" stroke-linejoin="round" stroke-linecap="round" opacity="' + (o.op || 1) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + ' points="' + pts + '"/>';
    }).join('');
    var xt = ''; for (v = 0; v <= n - 1; v += (n > 90 ? 30 : 15)) xt += '<text x="' + X(v).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle">' + v + ' s</text>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.label) + '">' + g + xt + body + '</svg>';
  }
  function barSVG(items, unit) {
    var mx = Math.max.apply(null, items.map(function (o) { return o.v; })) || 1, row = 22, W = 320, L = 128, h = items.length * row + 6;
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="Balkendiagramm">' + items.map(function (o, i) {
      var y = 3 + i * row, w = Math.max(2, o.v / mx * (W - L - 70));
      return '<text x="' + (L - 6) + '" y="' + (y + 14) + '" text-anchor="end">' + esc(o.label) + '</text><rect class="bar bh" style="--i:' + i + '" x="' + L + '" y="' + (y + 3) + '" width="' + w.toFixed(1) + '" height="14" rx="3" fill="' + o.color + '"/><text x="' + (L + w + 5).toFixed(1) + '" y="' + (y + 14) + '" style="font-weight:600">' + fmt(o.v, 0) + (unit ? ' ' + unit : '') + '</text>';
    }).join('') + '</svg>';
  }
  function renderHr() {
    var list = usable().filter(function (s) { return s.hrs && s.hrs.length > 1 && (ui.person === 'both' || s.person === ui.person); }).sort(function (a, b) { return (a.date + (a.uhr || '') + a.saved) < (b.date + (b.uhr || '') + b.saved) ? -1 : 1; }), box = $('hrBox');
    if (!list.length) { box.innerHTML = '<div class="empty" style="grid-column:1/-1">Noch keine Pulsverläufe. Sie erscheinen hier, sobald eine Messung mit Gurt gespeichert ist.</div>'; return; }
    var lo = 1e9, hi = 0, n = 0; list.forEach(function (s) { s.hrs.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); n = Math.max(n, s.hrs.length); });
    lo = Math.floor(lo / 10) * 10 - 5; hi = Math.ceil(hi / 10) * 10 + 5;
    function lab(s) { var c = CONDS[s.cond]; return name(s.person) + ' ' + dateDE(s.date).slice(0, 6) + ' ' + (c ? c.short : s.cond); }
    var html = '';
    if (list.length > 1) {
      html += '<div class="stat" style="padding:12px;grid-column:1/-1"><b style="font:600 15px var(--f-body);letter-spacing:0">Alle Sätze übereinander</b><span style="display:block;margin-bottom:4px">Gleiche Skala. Ein Satz pro Linie, Farbe gleich Person.</span>' +
        lineSVG(list.map(function (s, i) { return { hrs: s.hrs, s: s, color: pcolor(s.person), op: .5 + .5 * (i + 1) / list.length, dash: (list.filter(function (q, k) { return k < i && q.person === s.person; }).length % 2) ? '5 3' : '' }; }), lo, hi, n, { h: 170, label: 'Pulsverläufe aller Sätze im Vergleich' }) +
        '<div class="mono" style="font-size:12px;color:var(--ink2);line-height:1.7;margin-top:4px">' + list.map(function (s) { return '<span style="color:' + pcolor(s.person) + '">●</span> ' + esc(lab(s)); }).join(' &nbsp; ') + '</div></div>';
      var metrics = [['Höchster Puls im Satz', 'bpm', function (S) { return S.peak; }], ['Durchschnittspuls im Satz', 'bpm', function (S) { return S.avg; }], ['Anstieg Start bis Spitze', 'bpm', function (S) { return S.rise; }], ['Satzdauer', 's', function (S, s) { return s.setsec || S.n; }]];
      metrics.forEach(function (m) {
        html += '<div class="stat" style="padding:12px"><b style="font:600 15px var(--f-body);letter-spacing:0">' + m[0] + '</b>' + barSVG(list.map(function (s) { return { label: lab(s), v: m[2](hrStats(s), s), color: pcolor(s.person) }; }), m[1]) + '</div>';
      });
    }
    html += list.map(function (s) {
      var S = hrStats(s), c = CONDS[s.cond];
      return '<div class="stat" style="padding:12px;grid-column:1/-1"><b style="font:600 15px var(--f-body);letter-spacing:0;color:' + pcolor(s.person) + '">' + esc(name(s.person)) + ' · ' + dayDE(s.date) + (s.uhr ? ' · ' + s.uhr : '') + '</b><span style="display:block;margin-bottom:4px">' + esc(c ? c.short : s.cond) + (s.mg != null ? ' · ' + fmt(s.mg, 0) + ' mg' : '') + ' · ' + (s.reps != null ? '<b class="mono">' + s.reps + '</b> Wdh.' : 'Wdh. fehlen') + (s.load ? ' · ' + fmt(s.load, 1) + ' kg Stange' : '') + '</span>' +
        lineSVG([{ hrs: s.hrs, s: s, color: pcolor(s.person) }], lo, hi, n, { detail: true, h: 150, label: 'Pulsverlauf ' + esc(name(s.person)) + ' ' + dateDE(s.date) + ', Spitze ' + S.peak + ' bpm' }) +
        '<div class="hrdet"><div><b>' + fmt(S.start, 0) + '</b>Start (gestrichelt)</div><div><b>' + S.peak + '</b>Spitze</div><div><b>+' + fmt(S.rise, 0) + '</b>Anstieg</div><div><b>' + S.tPeak + ' s</b>bis zur Spitze</div><div><b>' + fmt(S.avg, 0) + '</b>Durchschnitt</div><div><b>' + fmt(S.end, 0) + '</b>Puls am Ende</div><div><b>' + (s.setsec || S.n) + ' s</b>Dauer</div><div><b>≈ ' + S.beats + '</b>Herzschläge im Satz</div><div><b>' + (s.hrrec != null ? fmt(s.hrrec, 0) : '–') + '</b>Abfall 1 min</div><div><b>' + (s.hr0 != null ? fmt(s.hr0, 0) : '–') + '</b>Ruhepuls</div><div><b>' + (s.rmssd != null ? fmt(s.rmssd, 0) + ' ms' : '–') + '</b>HRV</div><div><b>' + (s.sys0 != null ? s.sys0 + '/' + s.dia0 : '–') + '</b>Blutdruck</div></div>' +
        (s.hrsrc ? '<p class="hint" style="margin:6px 0 0">Quelle: ' + esc(s.hrsrc) + '. Werte pro Sekunde aus der Kurve abgelesen, daher ±1 bpm.</p>' : '') + '</div>';
    }).join('');
    box.innerHTML = html;
  }
  function renderFazit() {
    var box = $('fazit'), html = '', any = false, order = ['null'].concat(cfg.order && cfg.order.length === 6 ? cfg.order : COND_ORDER), notes = [];
    [0, 1].forEach(function (p) {
      var b = baseline(p), n = noise(p), items = [], deltas = [];
      if (b == null) return;
      items.push({ label: 'Ohne Koffein', v: b, color: 'var(--ink2)' });
      order.slice(1).forEach(function (c) { var m = condMean(p, c); if (m != null) { items.push({ label: CONDS[c].short + ' ' + CONDS[c].mg + ' mg', v: m, color: pcolor(p) }); deltas.push({ c: c, d: m - b, m: m }); } });
      if (items.length < 2) { html += '<div><b style="color:' + pcolor(p) + '">' + esc(name(p)) + '</b>: Nullrunde ' + fmt(b, 1) + ' Wdh. Die erste Dosis fehlt noch.</div>'; any = true; return; }
      any = true;
      html += '<div class="stat" style="padding:12px"><b style="font:600 16px var(--f-body);letter-spacing:0;color:' + pcolor(p) + '">' + esc(name(p)) + '</b>' + barSVG(items, 'Wdh.') + '<div class="big3" style="margin-top:8px">' + deltas.map(function (x) {
        var pct = b ? x.d / b * 100 : 0; return '<div><b style="color:' + (x.d > 0 ? 'var(--ok)' : x.d < 0 ? 'var(--bad)' : 'var(--ink)') + '">' + (x.d > 0 ? '+' : '') + fmt(x.d, 0) + ' Wdh.</b><span>' + esc(CONDS[x.c].short) + ' gegen Nullrunde (' + (pct > 0 ? '+' : '') + fmt(pct, 0) + ' %)</span></div>'; }).join('') + '</div></div>';
      deltas.forEach(function (x) {
        var who = '<b style="color:' + pcolor(p) + '">' + esc(name(p)) + '</b>', cn = esc(CONDS[x.c].short + ' ' + CONDS[x.c].mg + ' mg'), s;
        if (x.d === 0) s = who + ' schaffte mit ' + cn + ' genauso viele Wiederholungen wie ohne Koffein.';
        else s = who + ' schaffte mit ' + cn + ' <b>' + fmt(x.m, 0) + '</b> statt ' + fmt(b, 0) + ' Wiederholungen (' + (x.d > 0 ? '+' : '') + fmt(x.d, 0) + ').';
        if (n != null) s += Math.abs(x.d) <= n / 2 ? ' Das liegt im normalen Schwanken zwischen zwei gleichen Messungen, ist also noch kein Beleg.' : ' Das ist mehr als das normale Schwanken der Nullrunden, ein erster Hinweis auf eine echte Wirkung.';
        else s += Math.abs(x.d) >= 3 ? ' Ein Unterschied dieser Größe wäre auffällig, braucht aber die zweite Nullrunde zur Absicherung.' : ' Ein so kleiner Unterschied kann auch Zufall oder Tagesform sein. Das lässt sich erst mit der zweiten Nullrunde und weiteren Dosen sagen.';
        notes.push(s);
      });
    });
    if (!any) { box.innerHTML = '<div class="empty">Sobald die Nullrunde und eine Dosis gemessen sind, steht hier das Ergebnis.</div>'; return; }
    var withHr = usable().filter(function (s) { return s.hrs && s.hrs.length > 1; }).length, all = usable().length;
    html += '<div><h3 style="margin-bottom:4px">Was das heißt</h3><ul class="read">' + notes.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
      '<li>Bisher je Person nur eine Messung pro Stufe. Erst mit mehr Dosen und der zweiten Nullrunde lässt sich sagen, ob Koffein wirklich hilft.</li>' +
      (withHr < all ? '<li>Pulsdaten gibt es für ' + withHr + ' von ' + all + ' Messungen. Ohne Pulskurve fehlt der Vergleich, wie stark Koffein das Herz antreibt.</li>' : '') + '</ul><p class="hint">Es gibt kein Placebo. Wer weiß, dass er Koffein genommen hat, strengt sich vielleicht mehr an. Auch Uhrzeit, Schlaf und Tagesform spielen mit.</p></div>';
    box.innerHTML = html;
  }
  function renderEval() {
    var u = usable(), per = [0, 1].map(function (p) { return u.filter(function (s) { return s.person === p; }).length; });
    var mgs = u.map(function (s) { return s.mg; }).filter(function (v) { return v != null; });
    $('statsRow').innerHTML = '<div class="stat"><b>' + u.length + '</b><span>Messungen</span></div>' +
      '<div class="stat"><b>' + per[0] + ' / ' + per[1] + '</b><span>' + esc(name(0)) + ' / ' + esc(name(1)) + ' (Ziel je 8)</span></div>' +
      '<div class="stat"><b>' + (mgs.length ? fmt(Math.max.apply(null, mgs), 0) + ' mg' : '–') + '</b><span>höchste Testdosis</span></div>' +
      '<div class="stat"><b>' + fmt(mean([baseline(0), baseline(1)]), 1) + '</b><span>Ø Wdh. in der Nullrunde</span></div>';
    var h = '<div class="scroll"><table><thead><tr><th></th><th class="num">Basis</th><th class="num">Rauschen</th><th class="num">Steigung</th></tr></thead><tbody>';
    [0, 1].forEach(function (p) {
      var n = noise(p), sl = slope(p);
      h += '<tr><td><i class="dot" style="background:' + pcolor(p) + '"></i> ' + esc(name(p)) + '</td><td class="num">' + fmt(baseline(p), 1) + '</td><td class="num">' + (n != null ? '±' + fmt(n / 2, 1) : '–') + '</td><td class="num">' + (sl != null ? fmt(sl, 1) : '–') + '</td></tr>';
    });
    $('evalBox').innerHTML = h + '</tbody></table></div><p class="hint">Basis: Mittel der Nullrunden in Wiederholungen. Rauschen: halber Abstand der Nullrunden. Steigung: zusätzliche Wiederholungen pro mg/kg Koffein, aus Kaffee, Energy und Tablette.</p>';
  }
  function renderDeutung() {
    var li = [];
    [0, 1].forEach(function (p) {
      var b = baseline(p), n = noise(p), sl = slope(p), who = '<b style="color:' + pcolor(p) + '">' + esc(name(p)) + '</b>';
      if (b == null) { li.push(who + ': Die Nullrunde fehlt noch. Ohne sie gibt es keinen Vergleich.'); return; }
      if (n == null) li.push(who + ': Die zweite Nullrunde (Sitzung 8) liefert das Rauschmaß. Bis dahin lässt sich kein Unterschied einordnen.');
      if (sl != null) li.push(who + ': Mit mehr Koffein ' + (Math.abs(sl) < 0.5 ? 'ändern sich die Wiederholungen kaum' : (sl > 0 ? 'steigen die Wiederholungen' : 'sinken die Wiederholungen')) + ' (' + (sl > 0 ? '+' : '') + fmt(sl, 1) + ' pro mg/kg).');
      var t2 = condMean(p, 't200'), t3 = condMean(p, 't300');
      if (t2 != null && t3 != null && n != null) li.push(who + ': Von 200 auf 300 mg ' + (Math.abs(t3 - t2) <= n / 2 ? 'liegt der Unterschied (' + fmt(t3 - t2, 1) + ') im Rauschen. Kein Beleg für mehr.' : (t3 > t2 ? 'steigen die Wiederholungen weiter.' : 'sinken die Wiederholungen: ein möglicher Umkehr-Effekt.')));
      var o1 = condMean(p, 'o150'), o3 = condMean(p, 'o300');
      if (o1 != null && o3 != null && n != null) li.push(who + ': Origin ½ gegen 1 Portion ' + (Math.abs(o3 - o1) <= n / 2 ? 'liegt im Rauschen. Mehr Booster brachte hier nichts.' : (o3 > o1 ? 'mehr Booster, mehr Wiederholungen.' : 'mehr Booster, weniger Wiederholungen.')));
    });
    if (!li.length) li.push('Sobald Messungen da sind, erscheinen hier Lesehilfen für die Deutung.');
    $('deutung').innerHTML = '<ul class="read">' + li.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul><p class="hint">Mit zwei Personen und je einer Messung pro Stufe sind das Hinweise, keine Beweise. Ohne Placebo kann auch Erwartung mitspielen. Schreibt jede Deutung mit mindestens einer Gegenerklärung auf.</p>';
  }
  function renderStudyCompare() {
    var li = [];
    [0, 1].forEach(function (p) {
      var b = baseline(p), best = null, bc = null;
      ['kaffee', 'energy', 't200', 't300'].forEach(function (c) { var m = condMean(p, c); if (m != null && (best == null || m > best)) { best = m; bc = c; } });
      if (b && best != null) li.push('<b style="color:' + pcolor(p) + '">' + esc(name(p)) + '</b>: bester Wert mit reinem Koffein (' + esc(CONDS[bc].short) + ') ' + (best / b - 1 >= 0 ? '+' : '') + fmt((best / b - 1) * 100, 0) + ' % gegenüber der Nullrunde.');
      var o = condMean(p, 'o300'), t = condMean(p, 't300');
      if (o != null && t != null) li.push('<b style="color:' + pcolor(p) + '">' + esc(name(p)) + '</b>: Origin ' + (o > t ? 'vor' : o < t ? 'hinter' : 'gleich mit') + ' der Tablette (' + fmt(o, 1) + ' gegen ' + fmt(t, 1) + ' Wdh.). Kruszewski 2022 fand in der Studie: mehr Wiederholungen nach reinem Koffein als nach dem Booster.');
    });
    li.push('Vergleichswerte aus der Literatur: Eine Zusammenfassung vieler Studien fand für Oberkörperkraft einen kleinen Effekt (Grgic 2018, SMD 0,21). Eine Studie mit 3, 6 und 9 mg/kg fand beim Bankdrücken bei Koffein-Gewöhnten keinen signifikanten Effekt (Nutrients 2019). Erwartet also: ein kleiner, schwankender Effekt, kein großer Sprung.');
    $('vsStudies').innerHTML = '<ul class="read">' + li.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul><p class="hint">Details und Zitate unter Wissen, Studien.</p>';
  }
  /* Körpergewicht einbeziehen: mg/kg, Satzvolumen, geschätztes 1RM (Epley) und Verhältnis zum Körpergewicht */
  function renderRel() {
    var rows = usable().filter(function (s) { return s.reps != null && s.load && (ui.person === 'both' || s.person === ui.person); })
      .sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || a.person - b.person; });
    if (!rows.length) { $('relBox').innerHTML = '<div class="empty">Sobald Messungen mit Gewicht und Wiederholungen da sind, steht hier die Rechnung.</div>'; return; }
    var h = '<table><thead><tr><th>Wer</th><th>Bedingung</th><th class="num">mg/kg</th><th class="num">Wdh.</th><th class="num">Volumen</th><th class="num">1RM ca.</th><th class="num">1RM / KG</th></tr></thead><tbody>';
    rows.forEach(function (s) {
      var kg = kgOf(s), rm = s.load * (1 + s.reps / 30), c = CONDS[s.cond];
      h += '<tr><td><i class="dot" style="background:' + pcolor(s.person) + '"></i> ' + esc(name(s.person)) + '</td><td>' + esc(c ? c.short : s.cond) + (s.mg ? ' ' + s.mg + ' mg' : '') + '</td><td class="num">' + (mgkg(s) != null ? fmt(mgkg(s), 2) : '–') + '</td><td class="num">' + s.reps + '</td><td class="num">' + fmt(s.load * s.reps, 0) + ' kg</td><td class="num">' + fmt(rm, 0) + ' kg</td><td class="num">' + (kg ? fmt(rm / kg, 2) + '×' : '–') + '</td></tr>';
    });
    $('relBox').innerHTML = h + '</tbody></table><p class="hint">Volumen = Gewicht mal Wiederholungen. 1RM ca. = geschätztes Maximum aus diesem Satz (Epley: Gewicht mal 1 plus Wdh. durch 30). Ein Schätzwert, kein Test. 1RM / KG zeigt, das Wievielfache des Körpergewichts gedrückt werden könnte.</p>';
  }
  function renderTable() {
    var rows = sessions.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || (a.saved || 0) - (b.saved || 0); }).filter(function (s) { return ui.person === 'both' || s.person === ui.person; });
    if (!rows.length) { $('tableBox').innerHTML = '<div class="empty">Noch keine Messungen. Unter „Messen“ geht es los.</div>'; return; }
    var h = '<table><thead><tr><th>Datum</th><th>Wer</th><th>Bedingung</th><th class="num">mg</th><th class="num">mg/kg</th><th class="num">Wdh.</th><th class="num">RPE</th><th class="num">Puls max</th><th>Hinweis</th><th></th></tr></thead><tbody>';
    rows.forEach(function (s) {
      var armed = ui.delArm === s.id;
      h += '<tr><td class="mono">' + dateDE(s.date) + '</td><td><i class="dot" style="background:' + pcolor(s.person) + '"></i> ' + esc(name(s.person)) + '</td><td>' + esc(CONDS[s.cond] ? CONDS[s.cond].short : s.cond) + '' + '</td><td class="num">' + fmt(s.mg, 0) + '</td><td class="num">' + fmt(mgkg(s), 2) + '</td><td class="num"><b>' + fmt(s.reps, 0) + '</b></td><td class="num">' + fmt(s.rpe, 1) + '</td><td class="num">' + fmt(s.hrmax, 0) + '</td><td>' + (s.flags && s.flags.length ? pill('warn', esc(s.flags.join(', '))) + ' ' : '') + esc(s.notes || '') + '</td><td style="white-space:nowrap"><button class="btn small" data-edit="' + s.id + '" type="button">Ändern</button> <button class="btn small danger" data-del="' + s.id + '" type="button">' + (armed ? 'Wirklich löschen?' : 'Löschen') + '</button></td></tr>';
    });
    $('tableBox').innerHTML = h + '</tbody></table>';
  }
  function csv() {
    var head = ['Datum', 'Uhrzeit', 'Proband', 'Bedingung', 'Koffein_mg', 'Koerpergewicht_kg', 'mg_pro_kg', 'Wartezeit_min', 'Wiederholungen', 'Last_kg', 'RPE', 'Schlaf_3Naechte_h', 'Schlaf_2Naechte_h', 'Schlaf_letzte_Nacht_h', 'Mahlzeit', 'Anderes_Koffein_mg', 'Puls_Ruhe', 'HRV_RMSSD', 'Puls_max', 'Puls_Mittel_Satz', 'Puls_Abfall_1min', 'RR_sys_vor', 'RR_dia_vor', 'RR_sys_nach_Satz', 'RR_dia_nach_Satz', 'RR_sys_60', 'RR_dia_60', 'Abweichungen', 'Notiz', 'Demo'];
    var f = function (v) { if (v == null) return ''; if (typeof v === 'number') return String(v).replace('.', ','); return '"' + String(v).replace(/"/g, '""') + '"'; };
    var lines = [head.join(';')];
    sessions.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); }).forEach(function (s) {
      lines.push([s.date, s.uhr, name(s.person), CONDS[s.cond] ? CONDS[s.cond].label : s.cond, s.mg, kgOf(s), mgkg(s) != null ? Math.round(mgkg(s) * 100) / 100 : null, s.wait, s.reps, s.load, s.rpe, s.s3, s.s2, s.s1, s.meal, s.extra, s.hr0, s.rmssd, s.hrmax, s.hravg, s.hrrec, s.sys0, s.dia0, s.sys1, s.dia1, s.sys60, s.dia60, (s.flags || []).join(' | '), s.notes, s.beispiel ? 'ja' : 'nein'].map(f).join(';'));
    });
    return '﻿' + lines.join('\r\n');
  }

  /* ---------- Sitzungen und Meilensteine ---------- */
  var MILES = [['Fr 06.11. bis So 29.11.', 'Messphase: 8 Sitzungen je Person'], ['Mo 30.11. bis Fr 04.12.', 'Puffer: ausgefallene Sitzungen nachholen. Danach wird nicht mehr gemessen.'], ['Sa 05.12. bis So 06.12.', 'Auswertung fertig, Deutungshypothese mit Gegenerklärung'], ['Mo 07.12. bis Fr 11.12.', 'Folien bauen, Generalprobe, Feedback einholen'], ['Mo 14.12.', 'Abschlusspräsentation']];
  function nextFor(p) { var n = planConds().length; for (var i = 0; i < n; i++) { if (!done(p, i)) return i; } return -1; }
  function renderSessPick() {
    var pc = planConds(), h = '';
    pc.forEach(function (c, i) {
      var C = CONDS[c], img = C.prod ? imgFor(C.prod) : null;
      h += '<button type="button" class="sessrow' + (ui.sess === i ? ' sel' : '') + '" data-sess="' + i + '" aria-pressed="' + (ui.sess === i) + '">' + (img ? '<img alt="" src="' + img + '">' : '') + '<span class="sn">' + (i + 1) + '</span><span class="sm"><b>' + esc(C.label) + '</b><span>' + dayDE(PLAN_DATES[i]) + ' · <span class="mono" style="display:inline">' + C.mg + ' mg</span></span></span><span class="st">' +
        [0, 1].map(function (p) { return '<span class="pill ' + (done(p, i) ? 'ok' : 'ex') + '">' + esc(name(p)) + (done(p, i) ? ' ✓' : '') + '</span>'; }).join('') + '</span></button>';
    });
    $('sessPick').innerHTML = h;
  }
  /* Stangengewicht und Körpergewicht aus der letzten Messung derselben Person vorbelegen: gleiches Gewicht in jeder Sitzung. */
  function prefillLast() {
    var pn = Number($('f-person').value) || 0, last = sessions.filter(function (s) { return s.person === pn && s.load; }).sort(function (a, b) { return (b.saved || 0) - (a.saved || 0); })[0];
    if (last && !$('f-load').value) $('f-load').value = last.load;
    var lk = sessions.filter(function (s) { return s.person === pn && s.kg; }).sort(function (a, b) { return (b.saved || 0) - (a.saved || 0); })[0];
    if (lk && $('f-kg') && !$('f-kg').value) $('f-kg').value = lk.kg;
  }
  function pickSession(i) {
    ui.sess = i; setTimeout(prefillLast, 0); var c = planConds()[i]; $('sessBox').open = false; $('sessSum').textContent = 'Sitzung ' + (i + 1) + ': ' + (CONDS[c] ? CONDS[c].short + ' · ' + (CONDS[c].mg == null ? '' : CONDS[c].mg + ' mg') : c) + ' (ändern)'; $('f-cond').value = c; mgTouched = false; $('f-mg').value = ''; onCondChange(); $('formMsg').textContent = ''; renderSessPick();
  }
  function renderMiles() {
    var days = Math.ceil((new Date('2026-12-14T00:00:00') - new Date()) / 86400000);
    var dd = {}; sessions.forEach(function (s) { if (s.date) dd[s.date] = 1; }); var nd = Object.keys(dd).length; $('cdNum').textContent = nd + ' / 8'; $('cdLbl').textContent = 'Trainingstage geschafft. Ziel: 8 pro Person (Nullrunde, 6 Dosen, Nullrunde)'; $('heroSub').textContent = name(0) + ' und ' + name(1) + ' · 70 % vom Maximum · ohne Placebo';
    $('cdPill').textContent = days > 0 ? 'noch ' + days + ' Tage' : days === 0 ? 'heute' : 'vorbei';
    $('miles').innerHTML = MILES.map(function (m) { return '<div><b>' + m[0] + '</b><span>' + m[1] + '</span></div>'; }).join('');
  }

  /* ---------- Start ---------- */
  function done(p, i) {
    var c = planConds()[i];
    var n = sessions.filter(function (s) { return s.person === p && s.cond === c; }).length;
    if (c !== 'null') return n >= 1;
    return i === 0 ? n >= 1 : n >= 2;
  }
  function grow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
  function renderStart() {
    var pc = planConds(), tot = pc.length * 2, d = 0;
    [0, 1].forEach(function (p) { pc.forEach(function (c, i) { if (done(p, i)) d++; }); });
    $('progress').innerHTML = '<div class="timer" style="font-size:36px;text-align:left">' + d + ' / ' + tot + '</div><div style="height:10px;background:var(--surface2);border-radius:6px;overflow:hidden"><div style="height:100%;width:' + Math.round(d / tot * 100) + '%;background:var(--accent)"></div></div><p class="hint">Messungen von euch beiden. Vorgesehen: 8 Sitzungen je Person.</p>';
    var next = -1; for (var i = 0; i < pc.length; i++) { if (!done(0, i) || !done(1, i)) { next = i; break; } }
    $('nextSess').innerHTML = next < 0 ? '<p>Alle Sitzungen sind erledigt. Weiter mit der Auswertung unter Ergebnisse.</p>' :
      '<p class="big"><b>Sitzung ' + (next + 1) + '</b> · ' + dayDE(PLAN_DATES[next]) + '</p><p>' + esc(CONDS[pc[next]].label) + (CONDS[pc[next]].mg != null ? ' <span class="mono">(' + CONDS[pc[next]].mg + ' mg)</span>' : '') + '</p><button class="btn primary" type="button" data-go="messen" data-pick="' + next + '">Messung starten</button>';
    ['h1', 'h2', 'h3', 'deutung'].forEach(function (k) { var el = $('hyp-' + k); if (el && document.activeElement !== el) el.value = (cfg.hyp && cfg.hyp[k]) || DEF_HYP[k] || ''; grow(el); });
  }
  function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function renderPlanStart() {
    var box = $('planNext'); if (!box) return;
    var pc = planConds(), doneIdx = [], open = [];
    pc.forEach(function (c, i) { (done(0, i) && done(1, i) ? doneIdx : open).push(i); });
    if (!open.length) { box.innerHTML = '<p class="big">Alle 8 Sitzungen sind gemessen.</p>'; return; }
    var t = new Date(); t.setHours(12, 0, 0, 0);
    var h = '<div class="pn-done">' + (doneIdx.length ? doneIdx.map(function (i) { return '<span class="pn-chip"><i></i>' + (i + 1) + ' ' + esc(CONDS[pc[i]].short || CONDS[pc[i]].label) + '</span>'; }).join('') : '<span class="pn-chip off">noch nichts gemessen</span>') + '</div><div class="pn-list">';
    open.forEach(function (i, k) {
      var when = isoLocal(new Date(t.getTime() + k * 2 * 86400000));
      var puffer = when > '2026-11-29';
      var mg = CONDS[pc[i]].mg;
      h += '<button type="button" class="pn-row' + (k === 0 ? ' now' : '') + '" data-go="messen" data-pick="' + i + '" style="--i:' + k + '">' +
        '<span class="pn-nr">' + (i + 1) + '</span>' +
        '<span class="pn-main"><b>' + esc(CONDS[pc[i]].short || CONDS[pc[i]].label) + '</b><span class="pn-sub">' + (mg ? mg + ' mg Koffein' : 'kein Koffein') + (i === 7 ? ' · Wiederholung' : '') + '</span></span>' +
        '<span class="pn-when">' + (k === 0 ? 'als Nächstes' : dayDE(when)) + '<small>' + (k === 0 ? dayDE(when) : puffer ? 'Puffer' : 'geplant') + '</small></span></button>';
    });
    box.innerHTML = h + '</div><p class="hint">Je Sitzung messen wir ' + esc(name(1)) + ' und ' + esc(name(0)) + ', 60 Minuten nach der Einnahme. Dazwischen ein freier Tag. Ziel ist der 29.11., bis 04.12. ist Puffer. Die Termine rutschen mit, wenn eine Sitzung ausfällt.</p>';
  }
  function renderCfg() {
    var h = '';
    [0, 1].forEach(function (p) {
      h += '<div class="panel" style="padding:12px"><h3 style="color:' + pcolor(p) + '">' + esc(name(p)) + '</h3>' +
        '<label class="f" style="margin-top:8px">Name<input type="text" data-cfg="names" data-p="' + p + '" value="' + esc(cfg.names[p]) + '"></label>' +
        '<label class="f" style="margin-top:8px">Körpergewicht (kg)<input type="number" inputmode="decimal" step="any" data-cfg="kg" data-p="' + p + '" value="' + (cfg.kg[p] == null ? '' : cfg.kg[p]) + '"></label>' +
        '<label class="f" style="margin-top:8px">Maximum 1RM Bankdrücken (kg)<input type="number" inputmode="decimal" step="any" data-cfg="rm1" data-p="' + p + '" value="' + (cfg.rm1[p] == null ? '' : cfg.rm1[p]) + '"></label>' +
        '<label class="check"><input type="checkbox" data-cfg="u18" data-p="' + p + '"' + (cfg.u18[p] ? ' checked' : '') + '><span>unter 18 Jahre (Grenze 3 mg/kg pro Tag)</span></label></div>';
    });
    var box = $('cfgBox'); if (box.getAttribute('data-sig') !== JSON.stringify([cfg.names, cfg.kg, cfg.rm1, cfg.u18]) && !box.contains(document.activeElement)) { box.innerHTML = h; box.setAttribute('data-sig', JSON.stringify([cfg.names, cfg.kg, cfg.rm1, cfg.u18])); }
  }
  function onCfg(e) {
    var t = e.target, k = t.getAttribute('data-cfg'); if (!k) return;
    var p = Number(t.getAttribute('data-p')); cfg[k] = cfg[k].slice();
    cfg[k][p] = k === 'names' ? (t.value.trim() || (p === 0 ? 'Malte' : 'Paul')) : k === 'u18' ? t.checked : num(t.value);
    $('cfgBox').setAttribute('data-sig', JSON.stringify([cfg.names, cfg.kg, cfg.rm1, cfg.u18]));
    clearTimeout(cfgTimer); cfgTimer = setTimeout(function () { store.saveCfg().catch(function () { }); }, 600);
    renderAll(true);
  }

  /* ---------- Messen ---------- */
  var STEPS = ['Vorher', 'Einnahme', 'Satz', 'Speichern'];
  var FN = ['kg', 's3', 's2', 's1', 'extra', 'hr0', 'rmssd', 'sys0', 'dia0', 'mg', 'wait', 'load', 'rpe', 'hrmax', 'hravg', 'hrrec', 'reps', 'sys1', 'dia1', 'sys60', 'dia60'];
  var mgTouched = false, timerId = null, timerEnd = 0;
  function fillSelects() {
    $('f-person').innerHTML = '<option value="0">' + esc(name(0)) + '</option><option value="1">' + esc(name(1)) + '</option>';
    $('f-cond').innerHTML = Object.keys(CONDS).filter(function (k) { return k !== 'null'; }).concat(['null']).map(function (k) { return '<option value="' + k + '">' + esc(CONDS[k].label) + '</option>'; }).join('');
    $('selY').innerHTML = Object.keys(METRICS).map(function (k) { return '<option value="' + k + '">' + esc(METRICS[k].label) + '</option>'; }).join('');
    $('selX').innerHTML = Object.keys(XAXES).map(function (k) { return '<option value="' + k + '">' + esc(XAXES[k].label) + '</option>'; }).join('');
    $('selY').value = ui.y; $('selX').value = ui.x;
  }
  function renderSteps() {
    $('stepper').innerHTML = STEPS.map(function (s, i) { return '<div class="' + (i === ui.step ? 'on' : i < ui.step ? 'done' : '') + '">' + (i + 1) + ' ' + s + '</div>'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#form fieldset'), function (f) { f.hidden = Number(f.getAttribute('data-step')) !== ui.step; });
    $('backBtn').style.visibility = ui.step === 0 ? 'hidden' : 'visible';
    $('nextBtn').hidden = ui.step === 3; $('saveBtn').hidden = ui.step !== 3;
    if (ui.step === 3) renderSummary();
  }
  function curData() {
    var p = Number($('f-person').value);
    var d = { person: p, cond: $('f-cond').value, date: $('f-date').value, uhr: $('f-uhr').value || null, meal: $('f-meal').value || null, notes: $('f-notes').value.trim() || null };
    FN.forEach(function (k) { d[k] = num($('f-' + k).value); });
    if (d.cond === 'null' && d.mg == null) d.mg = 0;
    return d;
  }
  function updateDose() {
    xSync();
    var d = curData(), kg = d.kg || cfg.kg[d.person], s = safety(d.person, d.mg, d.extra, kg);
    $('doseCheck').innerHTML = pill(s.st, s.st === 'ok' ? 'im Rahmen' : s.st === 'bad' ? 'zu hoch' : 'prüfen') + ' ' + esc(s.txt) + (d.mg != null && kg ? ' Testdosis allein: <span class="mono">' + fmt(d.mg / kg, 2) + ' mg/kg</span>.' : '');
    var c = CONDS[d.cond], hint = '';
    if (c && c.prod === 'profuel' && d.cond === 't300') hint = 'Achtung: Auf der ProFuel-Packung steht „Täglich eine Tablette“. 1,5 Tabletten (300 mg) liegen über dieser Herstellerangabe, aber unter der EFSA-Grenze von 400 mg pro Tag. Sprecht das vorher mit Eltern oder Lehrkraft ab.';
    if (c && c.prod === 'origin') hint = 'Origin: Portion mit der Waage abmessen, immer dieselbe Menge. Kribbeln im Gesicht ist normal (Beta-Alanin).';
    if (c && c.prod === 'kaffee') hint = 'Kaffee schwankt stark im Koffeingehalt. 100 mg sind eine Schätzung. Immer dieselbe Sorte und Menge nehmen.';
    $('prodHint').textContent = hint;
    var rm = cfg.rm1[d.person]; $('loadHint').textContent = rm ? '70 % von ' + fmt(rm, 1) + ' kg Maximum sind ' + fmt(rm * 0.7, 1) + ' kg.' : 'Trage unter Start, Probanden das Maximum (1RM) ein, dann wird das Gewicht vorgeschlagen.';
  }
  function onCondChange() { var isNull = $('f-cond').value === 'null'; $('takeBox').hidden = isNull; $('nullNote').hidden = !isNull; if (isNull) { stopTimer(); $('f-wait').value = 0; } else if (num($('f-wait').value) === 0) { $('f-wait').value = 60; } if (ui.sess != null && planConds()[ui.sess] !== $('f-cond').value) { ui.sess = null; renderSessPick(); } var c = CONDS[$('f-cond').value]; if (c && c.mg != null && (!mgTouched || $('f-mg').value === '')) { $('f-mg').value = c.mg; mgTouched = false; } updateDose(); }
  function lastVal(p, k) { var s = sessions.filter(function (x) { return x.person === p && x[k]; }).sort(function (a, b) { return (b.saved || 0) - (a.saved || 0); })[0]; return s ? s[k] : null; }
  function onPersonChange() {
    var p = Number($('f-person').value), kgEl = $('f-kg'), ld = $('f-load');
    if (!kgEl.value || kgEl.dataset.auto === '1') { kgEl.value = cfg.kg[p] || lastVal(p, 'kg') || ''; kgEl.dataset.auto = '1'; }
    if (!ld.value || ld.dataset.auto === '1') { var l0 = cfg.rm1[p] ? Math.round(cfg.rm1[p] * 0.7 * 2) / 2 : lastVal(p, 'load'); if (l0) { ld.value = l0; ld.dataset.auto = '1'; } }
    updateDose();
  }
  function resetForm() {
    ui.editId = null; mgTouched = false; ui.step = 0; ui.sess = null; ui.sessManual = false; stopTimer(); ui.hrs = null; ui.setsec = null; ui.hrsrc = null; xReset(); $('setChart').innerHTML = ''; $('setClock').textContent = '00:00'; $('setMsg').textContent = 'Tippe „Satz starten“, sobald die Stange abgehoben wird. Danach „Satz beendet“ und unten die Wiederholungen eintragen.';
    FN.forEach(function (k) { var e = $('f-' + k); e.value = ''; delete e.dataset.auto; });
    $('f-wait').value = 60; ['f-uhr', 'f-notes'].forEach(function (k) { $(k).value = ''; }); $('f-meal').value = '';
    $('f-date').value = new Date().toISOString().slice(0, 10); $('formMsg').textContent = ''; $('saveBtn').textContent = 'Messung speichern';
    onCondChange(); onPersonChange(); renderSteps(); renderSessPick();
  }
  function loadIntoForm(s) {
    resetForm(); ui.editId = s.id; mgTouched = true; ui.hrs = s.hrs || null; ui.setsec = s.setsec || null; ui.hrsrc = s.hrsrc || null; ui.sess = s.sess == null ? null : s.sess; ui.sessManual = true;
    $('f-person').value = String(s.person); $('f-cond').value = s.cond; $('f-date').value = s.date || ''; $('f-uhr').value = s.uhr || ''; $('f-meal').value = s.meal || ''; $('f-notes').value = s.notes || '';
    FN.forEach(function (k) { $('f-' + k).value = s[k] == null ? '' : s[k]; });
    $('saveBtn').textContent = 'Änderung speichern'; $('formMsg').textContent = 'Du bearbeitest eine vorhandene Messung.'; updateDose(); setTab('messen');
  }
  function renderSummary() {
    var d = curData(), f = flagsOf(d), s = safety(d.person, d.mg, d.extra, d.kg || cfg.kg[d.person]);
    var h = '<div class="panel" style="background:var(--surface2)"><b style="color:' + pcolor(d.person) + '">' + esc(name(d.person)) + '</b> · ' + dateDE(d.date) + ' · ' + esc(CONDS[d.cond].label) + '<br><span class="mono big">' + fmt(d.reps, 0) + ' Wiederholungen</span> bei ' + fmt(d.load, 1) + ' kg</div>';
    h += '<p>' + pill(s.st, s.st === 'ok' ? 'Sicherheit ok' : s.st === 'bad' ? 'Dosis zu hoch' : 'prüfen') + '</p>';
    h += f.length ? '<p>' + pill('warn', 'Abweichung vom Standard') + ' ' + esc(f.join(', ')) + '. Die Messung wird gespeichert und kann in den Ergebnissen mit „nur saubere Sitzungen“ ausgeblendet werden.</p>' : '<p>' + pill('ok', 'Standard eingehalten') + '</p>';
    $('summary').innerHTML = h;
  }
  function validStep() {
    var d = curData(), m = '';
    if (ui.step === 0 && !d.date) m = 'Das Datum wird gebraucht.';
    if (ui.step === 1 && d.mg == null) m = 'Wie viel Koffein? Bitte eintragen.';
    if (ui.step === 2 && d.reps == null) m = 'Wie viele Wiederholungen? Bitte eintragen.';
    $('formMsg').textContent = m; return !m;
  }
  function saveForm(ev) {
    ev.preventDefault();
    var d = curData(); if (!d.date || d.mg == null || d.reps == null) { $('formMsg').textContent = 'Datum, Koffein und Wiederholungen werden gebraucht.'; return; }
    d.kg = d.kg || null;
    var sf = safety(d.person, d.mg, d.extra, d.kg);
    if (sf.st === 'bad' && !warned) { warned = true; $('formMsg').textContent = 'Dosis über der Tagesgrenze. Prüfe die Werte. Wenn sie stimmen, noch einmal auf Speichern tippen.'; return; }
    warned = false; if (ui.hrs) d.hrs = ui.hrs; if (ui.setsec) d.setsec = ui.setsec; if (ui.hrsrc) d.hrsrc = ui.hrsrc; d.flags = flagsOf(d); d.sess = ui.sess; d.saved = Date.now();
    var id = ui.editId || store.newId(); $('saveBtn').disabled = true;
    store.save(id, clean(d)).then(function () { resetForm(); setTab('ergebnisse'); }, function (e) { $('formMsg').textContent = 'Speichern nicht möglich (' + (e && e.code ? e.code : 'Fehler') + '). Du brauchst Schreibrechte auf dieser Seite.'; }).then(function () { $('saveBtn').disabled = false; });
  }
  function startTimer() {
    var w = num($('f-wait').value); if (w == null) w = 60; timerEnd = Date.now() + w * 60000;
    var now = new Date(); $('f-uhr').value = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    clearInterval(timerId); tick(); timerId = setInterval(tick, 500);
  }
  function tick() {
    var left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    $('timerOut').textContent = ('0' + Math.floor(left / 60)).slice(-2) + ':' + ('0' + left % 60).slice(-2);
    var tot = (num($('f-wait').value) == null ? 60 : num($('f-wait').value)) * 60; $('ring').style.setProperty('--p', tot ? Math.round((1 - left / tot) * 1000) / 10 : 0);
    if (left === 0) { clearInterval(timerId); timerId = null; $('timerOut').textContent = 'Los: jetzt der Satz!'; $('timerOut').style.fontSize = '28px'; }
    else $('timerOut').style.fontSize = '';
  }
  function stopTimer() { clearInterval(timerId); timerId = null; var w = num($('f-wait').value); if (w == null) w = 60; $('timerOut').textContent = ('0' + w).slice(-2) + ':00'; $('timerOut').style.fontSize = ''; $('ring').style.setProperty('--p', 0); }

  /* ---------- Puls (Web Bluetooth, nur wo erlaubt, plus Demo) ---------- */
  var P = { dev: null, on: false, demo: false, sim: null, samples: [], rr: [], mode: null, t0: 0, tStop: 0, timer: null, max: 0 };
  var X = { phase: 'connect', timer: null, end: 0, nostrap: false };
  function diag(x) { return ' [Technik: ' + (navigator.bluetooth ? 'Bluetooth-Schnittstelle vorhanden' : 'Bluetooth-Schnittstelle fehlt') + ', ' + (window.top !== window ? 'eingebettetes Fenster' : 'eigenes Fenster') + (x ? ', ' + x : '') + ']'; }
  function pMsg(t) { $('pMsg').textContent = t; if (X.phase === 'connect') xInfo(t); }
  function pStatus(t, st) { $('pStatus').className = 'pill ' + (st || 'ex'); $('pStatus').textContent = t; }
  function parseHR(dv) {
    var f = dv.getUint8(0), i = 1, hr;
    if (f & 1) { hr = dv.getUint16(i, true); i += 2; } else { hr = dv.getUint8(i); i += 1; }
    if (f & 8) i += 2;
    var rr = []; if (f & 16) { while (i + 1 < dv.byteLength) { rr.push(dv.getUint16(i, true) / 1024 * 1000); i += 2; } }
    return { hr: hr, rr: rr, contact: (f & 4) ? !!(f & 2) : null };
  }
  function rmssd(rr) {
    var a = rr.filter(function (v) { return v > 300 && v < 2000; }), s = 0, n = 0;
    for (var i = 1; i < a.length; i++) { var d = a[i] - a[i - 1]; if (Math.abs(d) < 250) { s += d * d; n++; } }
    return n > 5 ? Math.sqrt(s / n) : null;
  }
  function onHR(hr, rr, contact) {
    var t = Date.now(); P.contact = contact === undefined ? null : contact; P.lastT = t; P.lastHr = hr; P.samples.push({ t: t, hr: hr }); if (P.samples.length > 900) P.samples.shift();
    if (P.mode) { (rr || []).forEach(function (v) { P.rr.push(v); }); }
    $('bpmNow').textContent = hr; drawLive(); renderLamp(); lampUpdate();
  }
  function drawLive() {
    var s = P.samples.filter(function (q) { return q.t > Date.now() - 120000; });
    if (s.length < 2) { $('pLive').innerHTML = ''; return; }
    var W = 300, H = 60, lo = Math.min.apply(null, s.map(function (q) { return q.hr; })) - 3, hi = Math.max.apply(null, s.map(function (q) { return q.hr; })) + 3, t0 = Date.now() - 120000;
    var pts = s.map(function (q) { return ((q.t - t0) / 120000 * W).toFixed(1) + ',' + (H - (q.hr - lo) / (hi - lo) * H).toFixed(1); }).join(' ');
    $('pLive').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="60" role="img" aria-label="Pulsverlauf der letzten 2 Minuten"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="' + pts + '"/></svg>';
  }
  function pReady() { setPill(); }
  function setPill() { var e = $('setPill'); if (!e) return; e.className = 'pill ' + (P.on ? 'ok' : 'ex'); e.textContent = P.on ? (P.demo ? 'Probelauf' : 'Gurt verbunden') : 'Kein Gurt: nur Stoppuhr'; }
  function connectBT() {
    if (!navigator.bluetooth) { pStatus('nicht möglich', 'warn'); pMsg('Bluetooth ist in dieser Ansicht nicht verfügbar. Öffne die Seite im Browser Bluefy oder trage die Pulswerte von Hand ein. Zum Zeigen geht der Demo-Puls.' + diag()); return; }
    pStatus('suche …'); pMsg('Wähle deinen Polar H10 in der Liste. Schließe vorher die Polar-Apps.');
    navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }], optionalServices: ['battery_service'] }).then(function (d) {
      P.dev = d; d.addEventListener('gattserverdisconnected', function () { P.on = false; pStatus('getrennt', 'warn'); pReady(); }); return d.gatt.connect();
    }).then(function (srv) { P.srv = srv; return srv.getPrimaryService('heart_rate'); }).then(function (svc) { return svc.getCharacteristic('heart_rate_measurement'); }).then(function (ch) {
      ch.addEventListener('characteristicvaluechanged', function (e) { var r = parseHR(e.target.value); onHR(r.hr, r.rr, r.contact); }); return ch.startNotifications();
    }).then(function () { P.on = true; P.demo = false; pStatus('verbunden', 'ok'); pMsg('Verbunden.'); pReady(); readBattery(); renderLamp(); if (X.phase === 'connect') xPhase('ready'); }).catch(function (e) {
      var n = e && e.name; pStatus('nicht verbunden', 'warn'); renderLamp(); showDiag('Fehler: ' + (e && e.name ? e.name : '?') + (e && e.message ? ' – ' + e.message : ''));
      pMsg((n === 'NotFoundError' ? 'Kein Gerät gewählt. Gurt anfeuchten, anlegen und noch einmal versuchen.' : (n === 'SecurityError' || n === 'NotAllowedError') ? 'Bluetooth ist in dieser Ansicht gesperrt. Öffne die Seite in Bluefy oder nutze den Probelauf.' : 'Verbindung fehlgeschlagen: ' + (e && e.message ? e.message : 'unbekannt') + '. Gurt anfeuchten, Polar-Apps schließen, noch einmal versuchen.') + diag((n || 'Fehler') + (e && e.message ? ': ' + e.message : '')));
    });
  }
  function readBattery() {
    P.batt = null; if (!P.srv) return;
    P.srv.getPrimaryService('battery_service').then(function (s) { return s.getCharacteristic('battery_level'); }).then(function (c) { return c.readValue(); }).then(function (v) { P.batt = v.getUint8(0); renderLamp(); }).catch(function () { });
  }
  function renderLamp() { lampUpdate(); }
  function showDiag(extra) {
    var emb = false; try { emb = window.self !== window.top; } catch (e) { emb = true; }
    var pol = 'unbekannt'; try { var pp = document.permissionsPolicy || document.featurePolicy; if (pp && pp.allowsFeature) pol = pp.allowsFeature('bluetooth') ? 'ja' : 'nein'; } catch (e) { }
    var lines = ['Web-Bluetooth im Browser vorhanden: ' + (navigator.bluetooth ? 'ja' : 'nein'), 'Seite liegt in einem Rahmen (eingebettet): ' + (emb ? 'ja' : 'nein'), 'Bluetooth für diesen Rahmen erlaubt: ' + pol];
    var box = $('btDiag'); box.hidden = false;
    function out(more) { var r = lines.slice(); if (more) r.push(more); if (extra) r.push(extra); r.push(!navigator.bluetooth ? 'Ergebnis: Dieser Browser kann kein Web-Bluetooth. Bluefy nutzen.' : pol === 'nein' ? (emb ? 'Ergebnis: Der Rahmen sperrt Bluetooth. Die Seite muss ohne Rahmen geöffnet werden.' : 'Ergebnis: Der Browser sperrt Bluetooth für diese Seite.') : 'Ergebnis: Keine Sperre erkennbar. Gurt-Verbindung versuchen.'); box.textContent = r.join('\n'); }
    out(); if (navigator.bluetooth && navigator.bluetooth.getAvailability) navigator.bluetooth.getAvailability().then(function (v) { out('Bluetooth am Gerät verfügbar: ' + (v ? 'ja' : 'nein')); }).catch(function () { });
  }
  function toggleDemo() {
    if (P.demo) { clearInterval(P.sim); P.demo = false; P.on = false; pStatus('nicht verbunden'); pMsg('Probelauf beendet.'); $('pDemo').textContent = 'Probelauf'; pReady(); return; }
    P.demo = true; P.on = true; $('pDemo').textContent = 'Probelauf stoppen'; pStatus('Probelauf', 'ok'); pMsg('Probelauf: erfundene Pulswerte zum Üben. Es wird nichts in die Messung übernommen.'); pReady(); renderLamp(); if (X.phase === 'connect') xPhase('ready');
    var base = 68, tgt = 68;
    P.sim = setInterval(function () {
      tgt = P.mode === 'set' ? 158 : (P.tStop && Date.now() - P.tStop < 60000 ? 100 : 68);
      base += (tgt - base) * 0.18 + (Math.random() - 0.5) * 2;
      var hr = Math.round(base), rr = 60000 / hr + (Math.random() - 0.5) * 60;
      onHR(hr, [rr]);
    }, 1000);
  }
  function lastMean(sec) { var s = P.samples.filter(function (q) { return q.t > Date.now() - sec * 1000; }); return mean(s.map(function (q) { return q.hr; })); }
  var setClockT = null;
  /* ---------- Geführte Messung ---------- */
  function xInfo(s) { $('xInfo').textContent = s; }
  function xClock(sec, tot) { $('xClock').textContent = mmss(sec); $('xRing').style.setProperty('--p', tot ? Math.round((1 - sec / tot) * 1000) / 10 : 0); }
  function xSync() {
    [['x-kg', 'f-kg'], ['x-load', 'f-load']].forEach(function (q) { if (document.activeElement !== $(q[0])) $(q[0]).value = $(q[1]).value; });
    var cur = Number($('f-person').value) || 0;
    $('xPerson').innerHTML = [0, 1].map(function (i) { return '<button class="chip" type="button" data-xp="' + i + '" aria-pressed="' + (cur === i) + '">' + esc(name(i)) + '</button>'; }).join('');
  }
  function xPhase(ph) {
    X.phase = ph; var main = $('xMain'), skip = $('xSkip'), nullc = $('f-cond').value === 'null';
    main.disabled = false; skip.hidden = true; $('xRingBox').hidden = !(ph === 'rest' || ph === 'wait');
    $('setBox').hidden = !(ph === 'set' || ph === 'rec' || ph === 'reps'); $('xReps').hidden = !(ph === 'rec' || ph === 'reps');
    if (ph === 'connect') { main.textContent = 'Gurt verbinden'; xInfo('Gurt anfeuchten und anlegen, Polar-Apps schließen. Danach tippen.'); skip.hidden = false; skip.textContent = 'Ohne Gurt messen (nur Stoppuhr)'; }
    else if (ph === 'ready') { main.textContent = 'Messung starten'; xInfo(P.on ? 'Gurt verbunden. 5 Minuten ruhig sitzen, dann starten: Die App misst 2 Minuten Ruhepuls.' : 'Ohne Gurt: Die App zählt die Zeit, den Puls trägst du von Hand ein (Bereich unten).'); if (P.on) { skip.hidden = false; skip.textContent = 'Ruhemessung überspringen'; } }
    else if (ph === 'rest') { main.textContent = 'Ruhemessung läuft …'; main.disabled = true; }
    else if (ph === 'intake') { main.textContent = 'Jetzt eingenommen: Timer starten'; var drink = ['kaffee', 'energy'].indexOf($('f-cond').value) >= 0; xInfo(drink ? 'Getränk innerhalb von 10 Minuten trinken, immer dieselbe Sorte (Monster: Original oder Zero, nicht wechseln). Danach nur Wasser. Die App zählt 60 Minuten.' : 'Einnahme mit 250 ml Wasser. Danach zählt die App 60 Minuten.'); skip.hidden = false; skip.textContent = 'Ohne Timer weiter zum Satz'; }
    else if (ph === 'wait') { main.textContent = 'Weiter zum Satz'; xInfo('Warten, nur Wasser. In den letzten 20 Minuten aufwärmen.'); }
    else if (ph === 'setready') { main.textContent = 'Satz starten'; xInfo(nullc ? 'Nullrunde: nichts eingenommen. Aufgewärmt und Sicherungsperson bereit? Dann starten.' : 'Aufgewärmt und Sicherungsperson bereit? Dann starten.'); }
    else if (ph === 'set') { main.textContent = 'Satz beendet'; xInfo(''); }
    else if (ph === 'rec') { main.textContent = 'Erholung wird gemessen …'; main.disabled = true; }
    else if (ph === 'reps') { main.textContent = 'Jetzt speichern'; xInfo(!(ui.hrs && ui.hrs.length > 1) ? 'Ohne Pulskurve: Polar Beat laufen lassen und danach oben unter „Polar-Datei einlesen“ nachladen, sonst bleibt diese Messung ohne Puls.' : ''); xAuto(); }
    if (ph === 'setready') lampUpdate();
  }
  function lampOk() { return P.on && P.lastT && Date.now() - P.lastT < 5000; }
  function lampUpdate() {
    var d = $('lampDot'); if (!d) return;
    var fresh = lampOk(), s, a, b;
    if (!P.on) { s = 'off'; a = X.nostrap ? 'Ohne Gurt: nur Stoppuhr' : 'Gurt nicht verbunden'; b = X.nostrap ? 'Den Puls trägst du von Hand ein.' : 'Zuerst „Gurt verbinden“ tippen.'; }
    else if (P.demo && fresh) { s = 'ok'; a = 'Probelauf aktiv'; b = 'Erfundene Pulswerte zum Üben, keine echte Messung.'; }
    else if (!fresh) { s = 'warn'; a = 'Verbunden, aber kein Pulssignal'; b = 'Gurt anfeuchten und fest unter der Brust anlegen.'; }
    else if (P.contact === false) { s = 'warn'; a = 'Kein Hautkontakt'; b = 'Elektroflächen anfeuchten, Gurt enger stellen.'; }
    else { s = 'ok'; a = 'Gurt verbunden, Puls kommt an'; b = 'Bereit: Du kannst den Satz starten.' + (P.batt != null ? ' Akku ' + P.batt + ' %.' : ''); }
    if (d.getAttribute('data-s') !== s) d.setAttribute('data-s', s);
    if ($('lampTxt').textContent !== a) $('lampTxt').textContent = a; if ($('lampSub').textContent !== b) $('lampSub').textContent = b;
    var bpm = (P.on && fresh) ? String(P.lastHr) : '–'; if ($('lampBpm').textContent !== bpm) $('lampBpm').textContent = bpm;
    if (X.phase === 'setready') { var ok = (P.on && fresh && P.contact !== false) || X.nostrap; $('xMain').disabled = !ok; $('xMain').textContent = ok ? 'Satz starten' : 'Warte auf Pulssignal …'; $('xSkip').hidden = ok; $('xSkip').textContent = 'Ohne Gurt weiter'; }
  }
  function xMissing() { var m = []; if (num($('f-kg').value) == null) m.push('Körpergewicht'); if (num($('f-load').value) == null) m.push('Gewicht auf der Stange'); if (num($('f-reps').value) == null) m.push('Wiederholungen'); return m; }
  var autoT = null;
  function xAuto() {
    clearTimeout(autoT); if (X.phase !== 'reps') return; var m = xMissing();
    if (m.length) { xInfo('Speichert automatisch, sobald alles ausgefüllt ist. Es fehlt noch: ' + m.join(', ') + '.'); return; }
    xInfo('Alles ausgefüllt. Wird gleich automatisch gespeichert …'); autoT = setTimeout(function () { if (X.phase === 'reps' && !xMissing().length) xSave(); }, 2200);
  }
  function xAfterRest() { xPhase($('f-cond').value === 'null' ? 'setready' : 'intake'); }
  function xRest() {
    if (!P.on) { xAfterRest(); return; }
    P.mode = 'rest'; P.samples = []; P.rr = []; var left = 120; xPhase('rest'); xClock(left, 120); xInfo('Ruhig sitzen, normal atmen. Ruhepuls und HRV werden gemessen.');
    clearInterval(X.timer); X.timer = setInterval(function () {
      left--; xClock(left, 120);
      if (left <= 0) {
        clearInterval(X.timer); P.mode = null; var s = P.samples.length ? P.samples.filter(function (q) { return q.t > P.samples[0].t + 15000; }) : [], hr = mean(s.map(function (q) { return q.hr; })), rm = rmssd(P.rr);
        if (!P.demo) { if (hr != null) $('f-hr0').value = Math.round(hr); if (rm != null) $('f-rmssd').value = Math.round(rm); }
        var txt = hr != null ? 'Ruhe: ' + Math.round(hr) + ' bpm' + (rm != null ? ', HRV ' + Math.round(rm) + ' ms. ' : '. ') : 'Keine Pulsdaten empfangen. ';
        xAfterRest(); xInfo(txt + $('xInfo').textContent);
      }
    }, 1000);
  }
  function xIntake() {
    var w = 60, now = new Date(); $('f-wait').value = w; $('f-uhr').value = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    X.end = Date.now() + w * 60000; xPhase('wait'); xClock(w * 60, w * 60); clearInterval(X.timer);
    X.timer = setInterval(function () { var left = Math.max(0, Math.round((X.end - Date.now()) / 1000)); xClock(left, w * 60); if (left === 0) { clearInterval(X.timer); xPhase('setready'); xInfo('60 Minuten um. Aufwärmen, dann Satz starten.'); } }, 500);
  }
  function xMainClick() {
    var ph = X.phase;
    if (ph === 'connect') connectBT();
    else if (ph === 'ready') xRest();
    else if (ph === 'intake') xIntake();
    else if (ph === 'wait') { clearInterval(X.timer); xPhase('setready'); }
    else if (ph === 'setready') { toggleSet(); xPhase('set'); }
    else if (ph === 'set') endSet();
    else if (ph === 'reps') xSave();
  }
  function xSkipClick() {
    var ph = X.phase;
    if (ph === 'connect') { X.nostrap = true; xPhase('ready'); } else if (ph === 'setready') { X.nostrap = true; lampUpdate(); } else if (ph === 'ready') xAfterRest(); else if (ph === 'intake') { $('f-wait').value = ''; xPhase('setready'); }
  }
  function xSave() {
    if (num($('f-reps').value) == null) { xInfo('Bitte die Wiederholungen eintragen.'); return; }
    if (!$('f-meal').value) $('f-meal').value = 'leicht'; if ($('f-extra').value === '') $('f-extra').value = 0;
    $('saveBtn').click(); setTimeout(function () { if ($('formMsg').textContent) xInfo($('formMsg').textContent); }, 400);
  }
  function xReset() {
    clearInterval(X.timer); clearInterval(setClockT); if (P.mode === 'set' || P.mode === 'rest') P.mode = null;
    if (!P.mode) xPhase(P.on ? 'ready' : 'connect');
  }

  function mmss(s) { return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }
  function drawSetChart(s, dur, live) {
    var box = $('setChart');
    if (s.length < 2 && live) { box.innerHTML = '<div class="info">Warte auf Pulswerte vom Gurt …</div>'; return; }
    if (s.length < 2) { box.innerHTML = '<div class="info">Satzdauer ' + mmss(dur) + '. Kein Pulsverlauf, weil kein Gurt verbunden war.</div>'; return; }
    var W = 320, H = 150, L = 34, B = 20, T = 10, R = 8, hs = s.map(function (q) { return q.hr; }), lo = Math.floor(Math.min.apply(null, hs) / 5) * 5 - 5, hi = Math.ceil(Math.max.apply(null, hs) / 5) * 5 + 5, t0 = s[0].t, span = Math.max(live ? 60000 : 0, dur * 1000, s[s.length - 1].t - t0, 1000);
    function X(q) { return L + (q.t - t0) / span * (W - L - R); } function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var pts = s.map(function (q) { return X(q).toFixed(1) + ',' + Y(q.hr).toFixed(1); }), mx = s.reduce(function (a, q) { return q.hr > a.hr ? q : a; }, s[0]);
    box.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pulsverlauf im Satz, maximal ' + mx.hr + ' bpm">' +
      '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(hi).toFixed(1) + '" y2="' + Y(hi).toFixed(1) + '"/><line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(lo).toFixed(1) + '" y2="' + Y(lo).toFixed(1) + '"/>' +
      '<text x="' + (L - 4) + '" y="' + (Y(hi) + 4).toFixed(1) + '" text-anchor="end">' + hi + '</text><text x="' + (L - 4) + '" y="' + (Y(lo) + 4).toFixed(1) + '" text-anchor="end">' + lo + '</text>' +
      '<text x="' + L + '" y="' + (H - 4) + '">0 s</text><text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">' + Math.round(span / 1000) + ' s</text>' +
      '<polygon fill="var(--accent)" opacity=".14" points="' + L + ',' + Y(lo).toFixed(1) + ' ' + pts.join(' ') + ' ' + X(s[s.length - 1]).toFixed(1) + ',' + Y(lo).toFixed(1) + '"/>' +
      '<polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(' ') + '"/>' +
      '<circle cx="' + X(mx).toFixed(1) + '" cy="' + Y(mx.hr).toFixed(1) + '" r="4.5" fill="var(--p2)"/></svg>' +
      '<div class="row mono" style="gap:16px;font-size:14px">' + (live ? '<span>jetzt <b>' + hs[hs.length - 1] + '</b> bpm</span>' : '') + '<span>max <b>' + mx.hr + '</b> bpm</span><span>Ø <b>' + Math.round(mean(hs)) + '</b> bpm</span><span>Satz <b>' + mmss(dur) + '</b></span></div>';
  }
  function liveSet() {
    if (P.mode !== 'set') return;
    var el = Math.floor((Date.now() - P.t0) / 1000), s = P.samples.filter(function (q) { return q.t >= P.t0; }), bar = $('recBar'), age = P.lastT ? (Date.now() - P.lastT) / 1000 : 99;
    $('setClock').textContent = mmss(el); bar.hidden = false;
    if (!P.on) { bar.dataset.s = 'warn'; $('recTxt').textContent = 'Nur Stoppuhr, kein Gurt'; $('setChart').innerHTML = ''; return; }
    bar.dataset.s = age <= 5 ? 'ok' : 'warn';
    $('recTxt').textContent = age <= 5 ? 'Aufnahme läuft · ' + s.length + ' Pulswerte' : 'Gurt sendet gerade nichts (' + Math.round(age) + ' s). Gurt anfeuchten, Sitz prüfen.';
    drawSetChart(s, el, true);
  }
  /* Polar-Export (Flow CSV oder TCX) einlesen: Pulswerte pro Sekunde, Datum, Uhrzeit */
  function parsePolar(txt) {
    var hr = [], date = null, uhr = null, i, m;
    if (/<TrainingCenterDatabase|<Trackpoint/i.test(txt)) {
      var doc = new DOMParser().parseFromString(txt, 'text/xml'), tp = doc.getElementsByTagName('Trackpoint'), pts = [];
      for (i = 0; i < tp.length; i++) {
        var tm = tp[i].getElementsByTagName('Time')[0], v = tp[i].getElementsByTagName('Value')[0]; if (!tm || !v) continue;
        pts.push({ t: new Date(tm.textContent).getTime(), hr: Number(v.textContent) });
      }
      pts = pts.filter(function (q) { return isFinite(q.t) && q.hr > 25 && q.hr < 240; });
      if (pts.length) {
        var t0 = pts[0].t, n = Math.round((pts[pts.length - 1].t - t0) / 1000), k = 0;
        for (i = 0; i <= n; i++) { while (k < pts.length - 1 && Math.abs(pts[k + 1].t - (t0 + i * 1000)) <= Math.abs(pts[k].t - (t0 + i * 1000))) k++; hr.push(pts[k].hr); }
        var d0 = new Date(t0); date = d0.getFullYear() + '-' + ('0' + (d0.getMonth() + 1)).slice(-2) + '-' + ('0' + d0.getDate()).slice(-2); uhr = ('0' + d0.getHours()).slice(-2) + ':' + ('0' + d0.getMinutes()).slice(-2);
      }
    } else {
      var lines = txt.replace(/^﻿/, '').split(/\r?\n/), hi = -1, col = -1, sep = ',';
      for (i = 0; i < lines.length; i++) { if (/HR \(bpm\)/i.test(lines[i]) || /^Sample rate/i.test(lines[i])) { hi = i; sep = lines[i].indexOf(';') >= 0 && lines[i].indexOf(',') < 0 ? ';' : ','; col = lines[i].split(sep).map(function (c) { return c.trim().toLowerCase(); }).indexOf('hr (bpm)'); break; } }
      if (hi > 0 && col >= 0) {
        for (i = hi + 1; i < lines.length; i++) { var c = lines[i].split(sep); if (c.length <= col) continue; var v2 = Number(c[col]); if (v2 > 25 && v2 < 240) hr.push(v2); }
        var head = lines[0].split(sep).map(function (c) { return c.trim().toLowerCase(); }), vals = lines[1] ? lines[1].split(sep) : [];
        var di = head.indexOf('date'), si = head.indexOf('start time');
        if (di >= 0 && vals[di] && (m = vals[di].match(/(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})/))) date = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
        if (si >= 0 && vals[si] && (m = vals[si].match(/(\d{1,2}):(\d{2})/))) uhr = ('0' + m[1]).slice(-2) + ':' + m[2];
      }
    }
    return hr.length > 5 ? { hrs: hr, date: date, uhr: uhr } : null;
  }
  function importPolar(file) {
    if (!file) return; var fr = new FileReader();
    fr.onload = function () {
      var r; try { r = parsePolar(String(fr.result)); } catch (e) { r = null; }
      if (!r) { $('pFileMsg').textContent = 'Datei nicht lesbar. Gebraucht wird der Export aus Polar Flow als CSV oder TCX mit Pulswerten.'; return; }
      var hs = r.hrs, dur = hs.length - 1 > 0 ? hs.length : hs.length;
      ui.hrs = hs; ui.setsec = dur; $('f-hrmax').value = Math.max.apply(null, hs); $('f-hravg').value = Math.round(mean(hs));
      if (r.date) $('f-date').value = r.date; if (r.uhr) $('f-uhr').value = r.uhr;
      $('setBox').hidden = false; $('recBar').hidden = true; $('setClock').textContent = mmss(dur);
      drawSetChart(hs.map(function (q, i) { return { t: i * 1000, hr: q }; }), dur);
      $('setMsg').textContent = 'Aus Polar-Datei: ' + hs.length + ' Pulswerte' + (r.date ? ', ' + dateDE(r.date) + (r.uhr ? ' ' + r.uhr : '') : '') + '. Trage jetzt Wiederholungen und Stangengewicht ein.';
      $('pFileMsg').textContent = 'Eingelesen: ' + hs.length + ' s, max ' + Math.max.apply(null, hs) + ', Ø ' + Math.round(mean(hs)) + ' bpm.';
      P.mode = null; clearInterval(setClockT); clearInterval(X.timer); xPhase('reps'); $('f-reps').focus();
    };
    fr.readAsText(file);
  }
  function toggleSet() {
    if (P.mode === 'set') { endSet(); return; }
    if (P.mode) return;
    P.mode = 'set'; P.t0 = Date.now(); P.rr = []; ui.hrs = null; $('setChart').innerHTML = '';
    $('setBox').hidden = false; $('setClock').textContent = '00:00';
    $('setMsg').textContent = P.on ? 'Satz läuft. Tippe „Satz beendet“, sobald die Stange abgelegt ist.' : 'Satz läuft (nur Stoppuhr, ohne Puls). Tippe „Satz beendet“, sobald die Stange abgelegt ist.';
    clearInterval(setClockT); liveSet(); setClockT = setInterval(liveSet, 1000);
  }
  function endSet() {
    clearInterval(setClockT); P.tStop = Date.now(); var dur = Math.round((P.tStop - P.t0) / 1000), s = P.samples.filter(function (q) { return q.t >= P.t0 && q.t <= P.tStop; }), hs = s.map(function (q) { return q.hr; });
    var stopHr = lastMean(3); $('setClock').textContent = mmss(dur); ui.setsec = dur; $('recBar').hidden = true;
    drawSetChart(s, dur);
    if (hs.length && !P.demo) { $('f-hrmax').value = Math.max.apply(null, hs); $('f-hravg').value = Math.round(mean(hs)); ui.hrs = hs; }
    if (!P.on) { P.mode = null; $('setMsg').textContent = 'Gestoppt. Trage jetzt die Wiederholungen ein.'; xPhase('reps'); return; }
    P.mode = 'rec'; xPhase('rec'); var left = 60;
    $('setMsg').textContent = 'Satz beendet. Trage die Wiederholungen ein. Die Erholung wird noch gemessen (' + left + ' s).';
    P.timer = setInterval(function () {
      left--; $('setMsg').textContent = 'Satz beendet. Trage die Wiederholungen ein. Die Erholung wird noch gemessen (' + left + ' s).';
      if (left <= 0) { clearInterval(P.timer); var after = lastMean(3); P.mode = null; xPhase('reps'); if (stopHr != null && after != null && !P.demo) $('f-hrrec').value = Math.round(stopHr - after); $('setMsg').textContent = 'Fertig. Puls fällt in 1 Minute um ' + (stopHr != null && after != null ? Math.round(stopHr - after) : '–') + ' bpm.'; }
    }, 1000);
  }

  /* ---------- Wissen: Inhalte ---------- */
  function canSVG(c1, c2, label) { return '<svg viewBox="0 0 120 160" role="img" aria-label="' + label + '"><rect x="30" y="22" width="60" height="120" rx="12" fill="' + c1 + '"/><rect x="30" y="22" width="60" height="26" rx="8" fill="' + c2 + '"/><rect x="36" y="14" width="48" height="10" rx="4" fill="' + c2 + '"/><rect x="40" y="62" width="40" height="40" rx="8" fill="rgba(255,255,255,.88)"/><text x="60" y="88" text-anchor="middle" font-family="Barlow Semi Condensed, sans-serif" font-weight="700" font-size="19" fill="#0d2236">' + label + '</text><rect x="36" y="112" width="48" height="4" rx="2" fill="rgba(255,255,255,.5)"/></svg>'; }
  function cupSVG() { return '<svg viewBox="0 0 120 160" role="img" aria-label="Kaffeetasse"><path d="M28 62h58v38a30 30 0 01-30 30h-0a28 28 0 01-28-28z" fill="#8a5a3c"/><path d="M86 74h8a14 14 0 010 28h-10" fill="none" stroke="#8a5a3c" stroke-width="8" stroke-linecap="round"/><ellipse cx="57" cy="62" rx="29" ry="7" fill="#4a2c1a"/><rect x="22" y="134" width="70" height="7" rx="3.5" fill="#c9b8a6"/><path d="M45 44c-5-8 5-12 0-20M62 44c-5-8 5-12 0-20" fill="none" stroke="#9bb1c5" stroke-width="3" stroke-linecap="round"/></svg>'; }
  function renderProdukte() {
    var kgs = [cfg.kg[0], cfg.kg[1]];
    function perKg(mg) { var o = []; [0, 1].forEach(function (p) { if (kgs[p]) o.push(esc(name(p)) + ' ' + fmt(mg / kgs[p], 1)); }); return o.length ? o.join(' · ') + ' mg/kg' : 'Gewicht unter Start eintragen'; }
    function card(o) {
      var photo = '<div class="photo"><label class="btn small">' + (imgs[o.key] ? 'Foto ersetzen' : 'Eigenes Foto einfügen') + '<input type="file" accept="image/*" data-photo="' + o.key + '" hidden></label>' + (imgs[o.key] ? '<button type="button" class="btn small" data-photo-reset="' + o.key + '">Zurücksetzen</button>' : '') + '</div>';
      return '<div class="panel"><div class="pcard"><div><div class="pimg">' + (imgs[o.key] ? '<img alt="' + esc(o.name) + '" src="' + imgs[o.key] + '">' : o.img) + '</div>' + photo + '</div><div><div class="eyebrow">' + o.role + '</div><h3>' + o.name + '</h3><p class="hint" style="margin-top:2px">' + o.size + '</p>' +
        '<div class="facts"><div><b>' + o.mg + ' mg</b>Koffein pro Dosis im Test</div><div><b style="font-size:13px">' + perKg(o.mgNum) + '</b>pro kg Körpergewicht</div></div>' +
        '<p><b>Inhaltsstoffe</b><br>' + o.ingr + '</p><p class="hint">' + o.note + '</p></div></div></div>';
    }
    $('ws-produkte').innerHTML =
      '<div class="panel"><h2>Genau diese Produkte</h2><p>Beide kaufen und nehmen <b>dasselbe Produkt in derselben Menge</b>. So bleiben die Dosen gleich. Die Bedingung steht in der App immer dabei.</p></div>' +
      card({ key: 'profuel', role: 'Koffein pur · Tablette', name: 'ProFuel Koffein-Tabletten 200 mg', size: '365 Tabletten, 100 % vegan, mit Kerbe', img: '<img alt="Dose ProFuel Koffein-Tabletten" src="' + IMG_PROFUEL + '">', mg: '200 und 300', mgNum: 200,
        ingr: 'Koffein (200 mg pro Tablette), Füllstoff mikrokristalline Cellulose, Trennmittel (Magnesiumsalze der Speisefettsäuren). Mehr ist nicht drin.', note: 'Test: 1 Tablette (200 mg) und 1,5 Tabletten (300 mg). Auf der Packung steht „Täglich eine Tablette“. 1,5 Tabletten liegen darüber, aber unter der EFSA-Grenze von 400 mg pro Tag. Vorher mit Eltern oder Lehrkraft absprechen.' }) +
      card({ key: 'origin', role: 'Booster', name: 'MyProtein Origin Pre-Workout, Strawberry Laces', size: 'Pulver, 1 Portion = 300 mg Koffein', img: '<img alt="Dose MyProtein Origin Pre-Workout" src="' + IMG_ORIGIN + '">', mg: '150 und 300', mgNum: 300,
        ingr: '300 mg Koffein, 8,0 g L-Citrullin-DL-Malat, 3,5 g Beta-Alanin, dazu laut Herstellerseite u. a. rund 4 g Arginin (AAKG) und rund 250 mg L-Theanin.', note: 'Test: ½ Portion (150 mg) und 1 Portion (300 mg). Zahlen stammen von der Produktseite der EU-Variante. Prüft sie auf eurem Etikett. Beta-Alanin macht Kribbeln im Gesicht, das ist harmlos. Mehr als 1 Portion ist tabu: 450 mg wären über der Tagesgrenze.' }) +
      card({ key: 'energy', role: 'Energy Drink', name: 'Monster Energy 500 ml, oder 2× Red Bull 250 ml', size: 'Beide 32 mg Koffein pro 100 ml', img: canSVG('#1f6f5a', '#0d2236', '500 ml'), mg: '160', mgNum: 160,
        ingr: 'Wasser, Zucker, Kohlensäure, Taurin, Koffein und weitere Zusätze. Red Bull: 80 mg pro 250-ml-Dose, Monster: 160 mg pro 500-ml-Dose (Hersteller- und Verbraucherzentrale-Angaben).', note: 'Entscheidet euch für EIN Produkt und bleibt dabei. Tippe links auf „Eigenes Foto einfügen“ für das Originalbild. Der Zucker kann den Test beeinflussen: vorher gleich essen.' }) +
      card({ key: 'kaffee', role: 'Kaffee', name: 'Filterkaffee, große Tasse', size: 'ca. 250 ml, immer dieselbe Sorte und Stärke', img: cupSVG(), mg: '100', mgNum: 100,
        ingr: 'Kaffee und Wasser. Der Koffeingehalt schwankt je nach Sorte und Zubereitung.', note: '100 mg sind eine Schätzung. Zählt im Bericht als „ca.“. Bei Unsicherheit bleibt der Wert in der Auswertung eine Annäherung.' });
  }
  var STUDIES = [
    { t: 'Kruszewski et al. 2022', j: 'Nutrients 2022 · Single-blind Cross-over, 15 Männer mit Krafttraining', url: 'https://pubmed.ncbi.nlm.nih.gov/35565718/', role: 'Grundstudie für unsere Frage 2',
      q: [['Bench press repetition volume was greater after anhydrous caffeine than MIPS supplementation', 'Beim Bankdrücken schafften die Männer nach reinem Koffein mehr Wiederholungen als nach dem Multi-Zutaten-Booster.'], ['These results indicate that MIPS supplementation is less ergogenic and cost effective than caffeine alone.', 'Der Booster ist weniger leistungsfördernd und weniger preiswert als Koffein allein.']],
      so: 'Genau unsere Frage: Booster gegen Koffein. Wir prüfen, ob es bei uns auch so ausfällt (Origin 1 Portion gegen Tablette 300 mg).' },
    { t: 'Grgic et al. 2018', j: 'J Int Soc Sports Nutr 15:11 · Auswertung vieler Studien', url: 'https://pubmed.ncbi.nlm.nih.gov/29527137/', role: 'Was ist im Mittel zu erwarten?',
      q: [['Caffeine ingestion improved both strength (SMD = 0.20; 95% confidence interval [CI]: 0.03, 0.36; p = 0.023)', 'Koffein verbesserte die Kraft, ein kleiner Effekt (0,20).'], ['significant ergogenic effects of caffeine ingestion on maximal muscle strength of upper body and muscle power', 'Deutliche Wirkung auf die maximale Kraft des Oberkörpers und auf die Schnellkraft.']],
      so: 'Der erwartete Effekt ist klein. Bei zwei Personen kann er im Rauschen untergehen. Das ist kein Fehler im Versuch.' },
    { t: 'Guest et al. 2021 (ISSN)', j: 'J Int Soc Sports Nutr · Positionspapier der Sporternährungs-Gesellschaft', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7777221/', role: 'Dosis, Zeitpunkt, Nebenwirkungen',
      q: [['Caffeine has consistently been shown to improve exercise performance when consumed in doses of 3–6 mg/kg body mass.', 'Koffein verbessert die Leistung zuverlässig bei 3 bis 6 mg pro kg Körpergewicht.'], ['The most commonly used timing of caffeine supplementation is 60 min pre-exercise.', 'Üblich ist die Einnahme 60 Minuten vor dem Training.'], ['Very high doses of caffeine (e.g. 9 mg/kg) are associated with a high incidence of side-effects', 'Sehr hohe Dosen (9 mg/kg) führen oft zu Nebenwirkungen.'], ['Other factors such as habitual caffeine intake also may play a role in between-individual response variation.', 'Auch die Gewohnheit (wie viel Koffein man sonst trinkt) kann erklären, warum Menschen verschieden reagieren.']],
      so: 'Unsere Stufen (bis ca. 300 mg) liegen bei etwa 3 bis 4 mg/kg, also im üblichen Bereich. Notiert, wie viel Koffein ihr sonst trinkt.' },
    { t: 'Pallarés et al. 2013', j: 'Med Sci Sports Exerc 45(11):2184–2192 · 13 Männer, Placebo und 3, 6, 9 mg/kg', url: 'https://pubmed.ncbi.nlm.nih.gov/23669879', role: 'Mehr Koffein, mehr Wirkung? Auch beim Bankdrücken',
      q: [['The capsules were ingested 60 min before the trial to allow peak blood caffeine concentration', 'Die Kapseln wurden 60 Minuten vorher genommen, damit das Koffein im Blut den Höchstwert erreicht.'], ['Mean propulsive velocity at light loads (25%–50% 1RM) increased significantly above PLAC for all caffeine doses', 'Bei leichten Gewichten wurde die Stange mit allen Koffeindosen schneller als mit Placebo.']],
      so: 'Die Wirkung hängt vom Gewicht ab: Nach den Autoren reichen 3 mg/kg bei leichten Lasten, bei schweren Lasten brauchte es 9 mg/kg, mit mehr Nebenwirkungen. Wir testen mit 70 % und bis zum Versagen, das ist eine andere Aufgabe. Die Studienlage dazu ist uneinheitlich †.' },
    { t: 'Nutrients 2019 (Bankdrücken, 3/6/9 mg/kg)', j: 'Nutrients 2019 · 15 Männer mit Krafttraining, die regelmäßig Koffein nehmen', url: 'https://read.qxmd.com/read/31252655/the-acute-effect-of-various-doses-of-caffeine-on-power-output-and-velocity-during-the-bench-press-exercise-among-athletes-habitually-using-caffeine', role: 'Plateau: Hört es auf?',
      q: [], so: 'Ergebnis (zusammengefasst, nicht zitiert): Kein statistisch bedeutsamer Unterschied bei Leistung und Geschwindigkeit zwischen Placebo, 3, 6 und 9 mg/kg. Einige große Effektstärken bei 9 mg/kg. Passt zu unserer Frage „Hört es irgendwann auf?“.' },
    { t: 'Liguori et al. 1997', j: 'Pharmacol Biochem Behav · Aufnahme von Koffein aus Kaffee, Cola und Kapseln', url: '', role: 'Wann wirkt es? (Zeitpunkt)',
      q: [['Saliva caffeine levels peaked at similar times for coffee (42 +/- 5 min) and cola (39 +/- 5 min)', 'Das Koffein im Speichel erreichte bei Kaffee nach rund 42 und bei Cola nach rund 39 Minuten den Höchstwert.'], ['later for capsule (67 +/- 7 min; p = 0.004)', 'Bei der Kapsel erst nach rund 67 Minuten.']],
      so: 'Flüssigkeiten wirken früher als Tabletten. Zu 20 bis 30 Minuten: Dann ist das Koffein noch im Anstieg. Bei der Tablette ist es noch gar nicht oben. Wir bleiben bei 60 Minuten für alle (siehe unten).' }
  ];
  function renderStudien() {
    var h = '<div class="panel"><h2>Studien zum Vergleichen</h2><p>Das sind die Studien, an denen wir unsere Ergebnisse messen. Die englischen Zitate sind wörtlich aus den Zusammenfassungen. Die deutsche Zeile ist unsere Übersetzung. Mit † markiert: nicht vollständig geprüft.</p></div>';
    STUDIES.forEach(function (s, i) {
      h += '<details class="card"' + (i === 0 ? ' open' : '') + '><summary>' + esc(s.t) + '</summary><p class="sci">' + esc(s.j) + (s.url ? ' · <a href="' + s.url + '" target="_blank" rel="noopener">Quelle öffnen</a>' : '') + '</p><p><b>' + esc(s.role) + '</b></p>' +
        s.q.map(function (q) { return '<div class="quote"><q>' + esc(q[0]) + '</q><span class="de">' + esc(q[1]) + '</span></div>'; }).join('') + '<p>' + esc(s.so) + '</p></details>';
    });
    h += '<div class="panel"><h3>Warum 60 Minuten Wartezeit?</h3><p>Die Vermutung „20 bis 30 Minuten reichen“ ist gut, aber die Studien sprechen für etwa 60:</p><ul class="read"><li>Im Positionspapier der Fachgesellschaft ist 60 Minuten der übliche Zeitpunkt. Der Höchstwert im Blut liegt je nach Person zwischen 30 und 120 Minuten („Tmax ranging from 30 to 120 min“).</li><li>Bei Kaffee und Cola liegt der Höchstwert bei etwa 40 Minuten, bei der Kapsel erst bei etwa 67 (Liguori 1997).</li><li>Trinken wirkt also früher als Schlucken. Weil bei uns Tablette, Booster-Getränk und Kaffee verglichen werden, wäre eine kürzere Zeit ungleich: Das Getränk wäre schon oben, die Tablette nicht.</li><li>Koffein bleibt mehrere Stunden im Blut. 60 Minuten sind darum für alle Produkte sicher im Plateau.</li></ul><p class="hint">Eure Erfahrung mit dem frühen Spüren ist echt: Das Koffein steigt schon nach 15 bis 30 Minuten an. Der Höchstwert kommt später. Ihr könnt die Wartezeit in der App ändern. Sie wird gespeichert, und die Sitzung gilt dann als „Abweichung“ (Wartezeit nicht 60 min).</p></div>';
    $('ws-studien').innerHTML = h;
  }
  function renderPulsInfo() {
    $('ws-puls').innerHTML =
      '<div class="panel"><h2>Der Polar H10</h2><p>Der Brustgurt misst die elektrischen Signale deines Herzens und schickt sie per Bluetooth (BLE) ans Handy. Er schickt zwei Dinge: den <b>Puls</b> (Schläge pro Minute) und die <b>Abstände zwischen den Herzschlägen</b> (RR-Intervalle, in Millisekunden). Aus den Abständen rechnet man die Herzratenvariabilität (HRV).</p></div>' +
      '<div class="panel"><h3>Was wir damit auslesen</h3><div class="scroll"><table><thead><tr><th>Wert</th><th>Was ist das?</th><th>Was sagt es bei uns?</th></tr></thead><tbody>' +
      '<tr><td><b>Ruhepuls</b></td><td>Puls im Sitzen, entspannt</td><td>Zeigt, ob jemand müde, krank oder aufgeregt ist. Kommt wieder auf den Normalwert?</td></tr>' +
      '<tr><td><b>HRV (RMSSD)</b></td><td>Wie unterschiedlich die Abstände zwischen Schlägen sind</td><td>Hoch heißt meist ausgeruht, niedrig meist gestresst oder müde. Gut als Erklärung, falls ein Tag schlecht lief.</td></tr>' +
      '<tr><td><b>Puls maximal im Satz</b></td><td>Höchster Wert während des Satzes</td><td>Zeigt, wie sehr der Kreislauf gefordert war. Steigt er mit mehr Koffein?</td></tr>' +
      '<tr><td><b>Puls-Abfall in 1 Min</b></td><td>Wie schnell sich der Puls nach dem Satz beruhigt</td><td>Schneller Abfall deutet auf gute Erholung.</td></tr></tbody></table></div><p class="hint">Was Studien messen: Meist Leistung (Wiederholungen, Kraft, Stangengeschwindigkeit), dazu Ruhepuls, Blutdruck und Nebenwirkungen per Fragebogen. Zur Wirkung von Koffein auf Puls und HRV ist die Studienlage gemischt †. Wir erheben es als Zusatzbeobachtung, nicht als Hauptergebnis.</p></div>' +
      '<div class="panel"><h3>Alles, was der Polar H10 messen kann</h3><div class="scroll"><table><thead><tr><th>Messwert</th><th>Wie</th><th>Nutzen wir?</th></tr></thead><tbody>' +
      '<tr><td><b>Herzfrequenz</b></td><td>EKG-genau aus den elektrischen Herzsignalen, 1 Wert pro Sekunde über Standard-Bluetooth</td><td>Ja: Ruhe, Satz, Maximum, Mittel, Erholung</td></tr>' +
      '<tr><td><b>Herzschlag-Abstände (RR)</b></td><td>Zeit zwischen zwei Schlägen in Millisekunden</td><td>Ja: daraus HRV (RMSSD). Möglich wären auch SDNN und pNN50.</td></tr>' +
      '<tr><td><b>Hautkontakt</b></td><td>Der Sensor meldet, ob die Elektroflächen Kontakt haben</td><td>Ja: Die Lampe wird gelb, wenn er fehlt</td></tr>' +
      '<tr><td><b>Akkustand</b></td><td>Batterie-Dienst des Sensors (Knopfzelle)</td><td>Ja: steht unter der Lampe</td></tr>' +
      '<tr><td><b>Roh-EKG</b></td><td>Echte EKG-Kurve, 130 Messungen pro Sekunde, nur über Polars eigenes Protokoll (SDK)</td><td>Nein, im Browser nicht zugänglich</td></tr>' +
      '<tr><td><b>Beschleunigung</b></td><td>3-Achsen-Sensor, bis 200 Messungen pro Sekunde, nur über Polars eigenes Protokoll (SDK)</td><td>Nein. Damit ließen sich Wiederholungen zählen und die Stangenbewegung schätzen.</td></tr>' +
      '<tr><td><b>Speicher im Sensor</b></td><td>Kann Trainings selbst aufzeichnen, ausgelesen über Polar Beat oder Flow</td><td>Nein</td></tr>' +
      '<tr><td><b>Abgeleitetes</b></td><td>Atemfrequenz, Belastung, Kalorien: schätzen die Polar-Apps aus Puls und HRV</td><td>Nein</td></tr></tbody></table></div><p class="hint">Der Gurt misst nicht: Blutdruck, Sauerstoff im Blut, Temperatur, Laktat, Muskelaktivität oder die Geschwindigkeit der Stange.</p></div>' +
      '<div class="panel"><h3>So verbindest du den Gurt</h3><ol class="read"><li>Gurt unter der Brust an den Elektroflächen anfeuchten. Das ist wichtig für ein sauberes Signal.</li><li>Sensor in den Gurt klicken, Gurt eng unter der Brust anlegen. Der Sensor leuchtet kurz.</li><li>Polar Beat, Polar Flow und andere Pulsapps schließen. Der Gurt verbindet sich oft nur mit einer App.</li><li>Diese Seite im Browser <b>Bluefy</b> öffnen. Der normale Safari kann kein Bluetooth im Browser.</li><li>Unter Messen auf „Gurt verbinden“ tippen und den Polar H10 wählen.</li><li>Ruhe messen (2 Minuten), dann beim Satz auf „Satz starten“ und danach „Satz beendet“ tippen.</li></ol>' +
      '<p class="hint">Ehrlicher Hinweis: Ob Bluetooth in genau dieser Seite funktioniert, hängt davon ab, wie sie geöffnet wird. Klappt es nicht, trage die Werte von Hand ein oder nutze den Probelauf. Die Seite funktioniert in beiden Fällen.</p></div>';
  }
  var bankRAF = null, bankPlaying = true, bankT0 = 0;
  function renderBank() {
    $('ws-bank').innerHTML =
      '<div class="panel"><h2>Bankdrücken</h2><p>Du liegst auf einer Bank und drückst eine Stange mit Gewichten von der Brust nach oben, bis die Arme gestreckt sind. Das ist unser Test: <b>So viele saubere Wiederholungen wie möglich, bis es nicht mehr geht.</b></p>' +
      '<svg id="bankSvg" viewBox="0 0 340 190" role="img" aria-label="Animation: Bankdrücken von der Seite" style="width:100%;max-width:520px;display:block;margin:6px auto;background:var(--surface2);border-radius:12px">' +
      '<rect x="40" y="136" width="230" height="10" rx="4" fill="var(--ink2)"/><rect x="60" y="146" width="8" height="30" fill="var(--ink2)"/><rect x="240" y="146" width="8" height="30" fill="var(--ink2)"/>' +
      '<line x1="40" y1="124" x2="220" y2="124" stroke="var(--ink)" stroke-width="12" stroke-linecap="round"/><circle cx="28" cy="116" r="13" fill="none" stroke="var(--ink)" stroke-width="6"/>' +
      '<polyline points="220,124 252,102 280,152" fill="none" stroke="var(--ink)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<line id="bUp" x1="70" y1="122" x2="90" y2="140" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"/><line id="bFo" x1="90" y1="140" x2="100" y2="100" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"/>' +
      '<circle id="bPlate" cx="100" cy="100" r="24" fill="none" stroke="var(--p2)" stroke-width="7"/><circle id="bBar" cx="100" cy="100" r="5" fill="var(--p2)"/></svg>' +
      '<div class="row" style="justify-content:space-between"><b id="bankPhase" class="big" role="status">Start</b><button class="btn small" id="bankPlay" type="button">Pause</button></div></div>' +
      '<div class="cols"><div class="panel"><h3>So geht es</h3><ol class="read"><li><b>Liegen:</b> Füße fest am Boden, Gesäß, Schultern und Kopf bleiben auf der Bank.</li><li><b>Griff:</b> etwas breiter als die Schultern, Daumen um die Stange.</li><li><b>Schulterblätter</b> zusammenziehen und nach unten, leichtes Hohlkreuz ist normal.</li><li><b>Absenken</b> in etwa 2 Sekunden, bis die Stange die Brust leicht berührt. Unterarme stehen senkrecht.</li><li><b>Drücken</b> zügig nach oben, bis die Arme gestreckt sind.</li><li><b>Atmen:</b> unten einatmen, beim Drücken ausatmen.</li></ol></div>' +
      '<div class="panel"><h3>Häufige Fehler</h3><ul class="read"><li>Po hebt von der Bank ab.</li><li>Stange federt auf der Brust.</li><li>Ellbogen weit ausgestellt (Schulter!).</li><li>Handgelenke geknickt.</li><li>Arme nicht ganz gestreckt: Diese Wiederholung zählt bei uns nicht.</li><li>Zu schnell absenken.</li></ul></div></div>' +
      '<div class="cols"><div class="panel"><h3>Sicherheit</h3><ul class="read"><li>Immer mit Sicherungsperson, die hinter dem Kopf steht.</li><li>Möglichst im Ständer mit Fangarmen.</li><li>Klemmen an den Stangenenden anbringen.</li><li>Aufwärmen mit leichten Sätzen.</li><li>Wenn nichts mehr geht: nicht kämpfen, die Sicherung hilft sofort.</li></ul></div>' +
      '<div class="panel"><h3>Warum „Königsdisziplin“?</h3><ul class="read"><li>Es ist die bekannteste Übung für die Kraft des Oberkörpers. Die Frage „Wie viel drückst du?“ kennt jeder im Studio.</li><li>Eine Zahl sagt alles: das Gewicht oder die Wiederholungen. Das ist leicht zu vergleichen.</li><li>Sie ist eine der drei Wettkampfübungen im Kraftdreikampf (mit Kniebeuge und Kreuzheben).</li><li>Für uns: leicht zu standardisieren, die Wiederholungen sind zählbar, mit Sicherung ist sie gut kontrollierbar.</li></ul><p class="hint">„Königsdisziplin“ ist Szenesprache, keine Wissenschaft. Das gehört auch in die Präsentation.</p></div></div>' +
      '<div class="panel"><h3>Unser Test</h3><p>Gewicht: <b>70 % vom Maximum</b> (1RM), jedes Mal gleich. Sätze: einer, bis zum Muskelversagen. Gezählt wird nur, wenn die Stange die Brust berührt und die Arme ganz gestreckt sind. Pause vorher: gleich lang. Nicht aufhören, weil es unangenehm wird, sondern erst, wenn keine saubere Wiederholung mehr geht.</p></div>';
    var play = $('bankPlay'); play.addEventListener('click', function () { bankPlaying = !bankPlaying; play.textContent = bankPlaying ? 'Pause' : 'Abspielen'; if (bankPlaying) { bankT0 = performance.now() - bankT0Offset; } });
    bankStart();
  }
  var bankT0Offset = 0;
  function bankFrame(ts) {
    if (!$('bankSvg') || ui.tab !== 'wissen' || ui.ws !== 'bank') { bankRAF = null; return; }
    if (bankPlaying) {
      if (!bankT0) bankT0 = ts; var T = 5200, t = (ts - bankT0) % T; bankT0Offset = t;
      var p, ph;
      if (t < 2000) { p = t / 2000; p = p * p * (3 - 2 * p); ph = 'Absenken (2 Sekunden)'; } else if (t < 2400) { p = 1; ph = 'Brust berühren, nicht abfedern'; } else if (t < 3800) { var u = (t - 2400) / 1400; p = 1 - u * u * (3 - 2 * u); ph = 'Zügig drücken'; } else { p = 0; ph = 'Arme strecken, kurz halten'; }
      var Sx = 70, Sy = 122, Wx = 100, y = 52 + p * 60, L1 = 42, L2 = 38;
      var dx = Wx - Sx, dy = y - Sy, d = Math.sqrt(dx * dx + dy * dy), a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      var ux = dx / d, uy = dy / d, ex1 = Sx + a * ux - h * uy, ey1 = Sy + a * uy + h * ux, ex2 = Sx + a * ux + h * uy, ey2 = Sy + a * uy - h * ux, ex = ey1 > ey2 ? ex1 : ex2, ey = ey1 > ey2 ? ey1 : ey2;
      $('bUp').setAttribute('x2', ex); $('bUp').setAttribute('y2', ey); $('bFo').setAttribute('x1', ex); $('bFo').setAttribute('y1', ey); $('bFo').setAttribute('x2', Wx); $('bFo').setAttribute('y2', y);
      $('bPlate').setAttribute('cx', Wx); $('bPlate').setAttribute('cy', y); $('bBar').setAttribute('cx', Wx); $('bBar').setAttribute('cy', y); $('bankPhase').textContent = ph;
    } else { bankT0 = 0; }
    bankRAF = requestAnimationFrame(bankFrame);
  }
  function bankStart() { if (!bankRAF) { bankT0 = 0; bankRAF = requestAnimationFrame(bankFrame); } }

  /* ---------- Regeln ---------- */
  var RULES = [
    ['Schlaf', 'Drei Nächte vor dem Test jeweils 7 bis 9 Stunden. Zeiten in der App eintragen.'],
    ['Essen', 'Gleiche leichte Mahlzeit mindestens 2 Stunden vorher, jedes Mal. Oder jedes Mal nüchtern. Nie mischen.'],
    ['Anderes Koffein', 'Am Testtag und möglichst 24 Stunden vorher kein weiteres Koffein (Cola, Tee, Kaffee, Energy). Wenn doch: in der App eintragen.'],
    ['Uhrzeit', 'Immer zur gleichen Tageszeit, derselbe Wochentag-Rhythmus, mindestens 48 Stunden Pause.'],
    ['Wartezeit', '60 Minuten zwischen Einnahme und Satz (Timer in der App).'],
    ['Gewicht', '70 % vom Maximum, immer dasselbe Gewicht, dieselbe Bankhöhe, derselbe Griff.'],
    ['Aufwärmen', 'Jedes Mal gleich: z. B. 2 leichte Sätze mit der leeren Stange und 40 % vom Maximum.'],
    ['Zählregel', 'Eine Wiederholung zählt nur mit Brustkontakt und gestreckten Armen.'],
    ['Kein Alkohol, kein harter Sport', 'Am Tag vorher kein Alkohol und kein anstrengendes Oberkörpertraining.']
  ];
  function renderRegeln() {
    $('checklist').innerHTML = RULES.map(function (r, i) { return '<label class="check"><input type="checkbox"><span><b>' + r[0] + ':</b> ' + r[1] + '</span></label>'; }).join('') + '<p class="hint">Die Zahlen sind übliche Richtwerte aus Studienprotokollen, nicht alle einzeln nachgeprüft †. Wichtiger als die genaue Zahl: bei beiden und jedes Mal gleich.</p>';
    $('safetyList').innerHTML = '<ul class="read"><li>Tagesgrenze <b>400 mg Koffein</b> insgesamt, also Testdosis plus alles andere an dem Tag.</li><li>Wer <b>unter 18</b> ist: höchstens ca. <b>3 mg/kg</b> pro Tag. Dann passen 300 mg meist nicht. Häkchen unter Start, Probanden setzen, dann rechnet die App mit der Grenze.</li><li>Kein loses Koffeinpulver, nur Tabletten und Fertigprodukte. Packungen sicher verwahren.</li><li><b>Abbruch</b> und kein weiteres Koffein bei Herzrasen, Schwindel, Übelkeit, Zittern oder Brustschmerz. Im Zweifel ärztlich abklären.</li><li>Nie allein trainieren. Immer eine Sicherungsperson.</li><li>Wer Herz-Kreislauf-Beschwerden hat oder Medikamente nimmt: nicht ohne Rücksprache mit Arzt oder Ärztin.</li></ul>';
    renderPlan();
    var sh = '<table><tbody>';
    [['Koffein pro Dosis', 'mg und mg pro kg Körpergewicht'], ['Quelle', 'Kaffee, Energy, Tablette, Booster'], ['Wartezeit', '60 min'], ['Gewicht', '70 % vom 1RM'], ['Messgröße', 'Wiederholungen bis Versagen, in % zur eigenen Nullrunde'], ['Nullrunde', 'zweimal, Abstand als Rauschen'], ['Schlaf', 'Mittel der 3 Nächte vorher in Stunden'], ['Essen', 'nüchtern, leicht oder voll'], ['Zusatzkoffein', 'mg am Testtag']].forEach(function (r) { sh += '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>'; });
    $('sheetBox').innerHTML = sh + '</tbody></table>';
  }
  function renderPlan() {
    var pc = planConds();
    var h = '<table><thead><tr><th>Nr.</th><th>Termin</th><th>Bedingung</th><th class="num">mg</th><th>' + esc(name(0)) + '</th><th>' + esc(name(1)) + '</th></tr></thead><tbody>';
    pc.forEach(function (c, i) {
      h += '<tr><td>' + (i + 1) + '</td><td class="mono">' + dayDE(PLAN_DATES[i]) + '</td><td>' + esc(CONDS[c].label) + (i === 0 ? ' · Basis' : i === 7 ? ' · Wiederholung' : '') + '</td><td class="num">' + CONDS[c].mg + '</td><td>' + (done(0, i) ? pill('ok', 'erledigt') : pill('ex', 'offen')) + '</td><td>' + (done(1, i) ? pill('ok', 'erledigt') : pill('ex', 'offen')) + '</td></tr>';
    });
    $('planBox').innerHTML = h + '</tbody></table><p class="hint">Sitzung 0 (Einführung, Maximum testen) war am 04.11. Sitzung 8 liegt auf Sonntag, 29.11. Bis 04.12. ist Puffer zum Nachholen. Die Abschlusspräsentation ist am 14.12.</p>';
  }
  function sheetText() {
    var t = 'Koffein am Limit, Kennzahlen\n';
    [0, 1].forEach(function (p) {
      var b = baseline(p); t += '\n' + name(p) + ': Nullrunde ' + fmt(b, 1) + ' Wdh., Rauschen ' + (noise(p) != null ? '±' + fmt(noise(p) / 2, 1) : '–') + '\n';
      Object.keys(CONDS).filter(function (c) { return c !== 'null' && c !== 'sonst'; }).forEach(function (c) { var m = condMean(p, c); if (m != null && b) t += '  ' + CONDS[c].short + ' (' + CONDS[c].mg + ' mg): ' + fmt(m, 1) + ' Wdh., ' + (m / b - 1 >= 0 ? '+' : '') + fmt((m / b - 1) * 100, 0) + ' %\n'; });
    });
    return t + '\nProtokoll: 60 min Wartezeit, 70 % 1RM, bis Versagen, nur Messungen ohne Abweichung zählen, wenn „nur saubere Sitzungen“ aktiv ist.';
  }

  /* ---------- Vorbereitung (Start) ---------- */
  var PREP = [
    ['rm1', 'Maximalgewicht (1RM) festlegen', 'Mit dem Rechner unten aus einem guten Satz der letzten Wochen. Danach bleibt das Gewicht für alle 8 Sitzungen gleich (70 %).'],
    ['kg', 'Körpergewicht notieren', 'Morgens nach der Toilette, vor dem Essen, leichte Kleidung. Wer die Smart-Waage schon hat, wiegt sich dort und trägt es später im Tab Körper nach. Ohne Waage: Gewicht unter „Probanden und Grenzwerte“ eintragen.'],
    ['rest', 'Ruhepuls und HRV testen', 'Gurt anfeuchten, anlegen, in Bluefy verbinden (Messen, „Gurt verbinden“). Einmal „Ruhe messen“ üben: 5 Minuten sitzen, dann 2 Minuten messen. Am Messtag passiert das 75 Minuten vor dem Satz.'],
    ['bp', 'Blutdruck (nur wenn ein Gerät da ist)', 'Sitzend, Arm auf Herzhöhe, 2 Messungen im Abstand von 1 Minute, Mittelwert eintragen. Ohne Gerät: Felder leer lassen.'],
    ['sleep', 'Schlaf: 3 Nächte mit mindestens 7 Stunden', 'Die App fragt die Stunden der letzten 3 Nächte ab. Unter 7 Stunden im Mittel bekommt die Messung eine Markierung.'],
    ['caf', 'Seit 24 Stunden kein Koffein', 'Gilt für die Nullrunde besonders: kein Kaffee, Tee, Cola, Energy, Schokolade, Booster. Sonst ist die Null keine Null.'],
    ['meal', 'Standardmahlzeit festlegen', 'Immer dieselbe leichte Mahlzeit, spätestens 3 Stunden vor dem Satz (zum Beispiel Haferflocken mit Banane). Danach nur Wasser.'],
    ['gear', 'Bank, Griff und Sicherung', 'Bankhöhe und Griffbreite markieren (Klebeband an der Stange), Sicherungsperson fest einplanen, Aufwärmplan gemeinsam durchgehen.'],
    ['ok', 'Einverständnis geklärt', 'Eltern oder Lehrkraft wissen Bescheid. Wer unter 18 ist: Obergrenze 3 mg/kg beachten (Häkchen unter „Probanden und Grenzwerte“).']
  ];
  var TIMELINE = [
    ['−3 h', 'Letzte Mahlzeit (immer dieselbe). Danach nur Wasser.'],
    ['−75 min', '5 Minuten ruhig sitzen. Dann Ruhepuls und HRV messen (2 Minuten). Danach Blutdruck, falls vorhanden. Gewicht notieren.'],
    ['−60 min', 'Einnahme mit 250 ml Wasser. Nullrunde: nur 250 ml Wasser, ohne alles. Uhrzeit festhalten, in der App den Timer starten. Ab jetzt kein weiteres Koffein.'],
    ['−60 bis −20', 'Ruhig bleiben, nichts essen, Wasser ist erlaubt. Notieren, wenn etwas auffällt (Kribbeln, Herzklopfen).'],
    ['−20 min', 'Aufwärmen, immer gleich: 10 Wiederholungen mit leerer Stange, 8 mit 40 % vom Maximum, 3 mit 60 %. Danach 3 Minuten Pause.'],
    ['−2 min', 'Gurt sitzt, „Satz starten“ in der App tippen. Sicherungsperson steht bereit.'],
    ['0', 'Satz bis Muskelversagen mit 70 % vom Maximum. Zählen nur mit Brustkontakt und gestreckten Armen. Direkt danach RPE (1 bis 10) einschätzen.'],
    ['+1 min', '„Satz beendet“ tippen, ruhig stehen. Die App misst den Pulsabfall 60 Sekunden lang. Danach Blutdruck, falls vorhanden.'],
    ['+60 min', 'Blutdruck noch einmal, Auffälligkeiten aufschreiben, Messung speichern. Zusatzkoffein des Tages eintragen.']
  ];
  function renderPrep() {
    var pr = cfg.prep || {}, tot = PREP.length * 2, n = 0, h = '';
    PREP.forEach(function (it) {
      h += '<div class="it"><div><b>' + it[1] + '</b><span class="d">' + it[2] + '</span></div><div class="row" style="gap:0;flex-wrap:nowrap">' + [0, 1].map(function (p) {
        var on = !!pr[it[0] + '-' + p]; if (on) n++;
        return '<label class="pk"><input type="checkbox" data-prep="' + it[0] + '-' + p + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(it[1]) + ', ' + esc(name(p)) + '">' + esc(name(p).charAt(0)) + '</label>';
      }).join('') + '</div></div>';
    });
    var box = $('prepList'); if (!box.contains(document.activeElement)) box.innerHTML = h; else { n = 0; Object.keys(pr).forEach(function (k) { if (pr[k]) n++; }); }
    $('prepCount').textContent = n + ' / ' + tot; $('prepCount').className = 'pill ' + (n === tot ? 'ok' : 'ex'); $('prepBar').style.width = Math.round(n / tot * 100) + '%';
    $('tlBox').innerHTML = TIMELINE.map(function (r) { return '<div><b>' + r[0] + '</b><span>' + r[1] + '</span></div>'; }).join('');
    var sel = $('rc-p'); if (!sel.options.length) { sel.innerHTML = '<option value="0"></option><option value="1"></option>'; }
    sel.options[0].textContent = name(0); sel.options[1].textContent = name(1);
  }
  function calcRM() {
    var w = num($('rc-w').value), r = num($('rc-r').value), out = $('rc-out'), btn = $('rc-apply');
    if (!w || !r) { out.textContent = 'Gewicht und Wiederholungen eintragen.'; btn.disabled = true; return null; }
    var rm = w * (1 + r / 30), load = rm * 0.7, plate = Math.round(load / 2.5) * 2.5;
    out.innerHTML = '1RM ungefähr <b class="mono">' + fmt(rm, 1) + ' kg</b>. 70 % davon sind <b class="mono">' + fmt(load, 1) + ' kg</b>, mit Scheiben gelegt meist <b class="mono">' + fmt(plate, 1) + ' kg</b>.' + (r > 8 ? ' Mit über 8 Wiederholungen wird die Schätzung ungenau.' : '');
    btn.disabled = false; return rm;
  }
  function applyRM() {
    var rm = calcRM(); if (rm == null) return; var p = Number($('rc-p').value);
    cfg.rm1 = cfg.rm1.slice(); cfg.rm1[p] = Math.round(rm * 2) / 2; $('cfgBox').removeAttribute('data-sig');
    store.saveCfg().then(function () { $('rc-out').insertAdjacentHTML('beforeend', ' <b>Für ' + esc(name(p)) + ' übernommen.</b>'); }, function () { $('rc-out').insertAdjacentHTML('beforeend', ' <b>Nicht gespeichert (keine Schreibrechte).</b>'); });
    renderAll();
  }

  /* ---------- Körper (Smart-Waage) ---------- */
  var BM = [['kg', 'Gewicht', 'kg', 1], ['fat', 'Körperfett', '%', 1], ['muscle', 'Muskelmasse', 'kg', 1], ['water', 'Körperwasser', '%', 1], ['bone', 'Knochenmasse', 'kg', 2], ['visceral', 'Viszeralfett', 'Stufe', 0], ['bmr', 'Grundumsatz', 'kcal', 0], ['bmi', 'BMI', '', 1]];
  function bodyList(p) { return bodies.filter(function (b) { return b.person === p; }).sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; }); }
  /* Körperbild: Silhouette, gefüllt mit der Zusammensetzung (Fett, Muskeln, Knochen, Rest) */
  var BODY_PATH = 'M60 40 Q82 38 96 46 Q110 50 112 66 L116 128 Q117 136 109 136 Q101 136 100 128 L97 84 L94 84 L94 150 L92 244 Q92 252 84 252 L70 252 Q63 252 63 244 L60 176 L57 244 Q57 252 50 252 L36 252 Q28 252 28 244 L26 150 L26 84 L23 84 L20 128 Q19 136 11 136 Q3 136 4 128 L8 66 Q10 50 24 46 Q38 38 60 40 Z';
  function bodyViz(p, last, first) {
    var kg = last.kg, h = '', col = pcolor(p);
    var fat = (kg && last.fat != null) ? kg * last.fat / 100 : null, mus = last.muscle, bone = last.bone;
    if (kg && fat != null && mus != null && bone != null) {
      var rest = Math.max(0, kg - fat - mus - bone), parts = [['Fett', fat, '#f2d24b'], ['Muskeln', mus, col], ['Knochen', bone, 'var(--ink2)'], ['Rest', rest, 'var(--surface2)']], y = 258, id = 'cl' + p, svg = '', leg = '';
      parts.forEach(function (q, i) {
        var hh = 254 * q[1] / kg; y -= hh;
        svg += '<rect class="bar" style="--i:' + i + '" x="0" y="' + y.toFixed(1) + '" width="120" height="' + hh.toFixed(1) + '" fill="' + q[2] + '"/>';
        leg += '<div class="lg"><i style="background:' + q[2] + '"></i><span>' + q[0] + '</span><b>' + fmt(q[1], 1) + ' kg</b><small>' + fmt(100 * q[1] / kg, 0) + ' %</small></div>';
      });
      h += '<div class="bodyviz"><svg class="chart bodysvg" viewBox="0 0 120 260" role="img" aria-label="Körperzusammensetzung von ' + esc(name(p)) + '"><defs><clipPath id="' + id + '"><circle cx="60" cy="20" r="17"/><path d="' + BODY_PATH + '"/></clipPath></defs><g clip-path="url(#' + id + ')">' + svg + '</g></svg><div class="bodyleg">' + leg + '<p class="hint" style="margin:8px 0 0">Schätzung der Waage (Bioimpedanz), eher für den Verlauf einer Person geeignet als für den Vergleich zwischen Personen.</p></div></div>';
    }
    h += '<div class="bgrid">';
    [['kg', 'Gewicht', 'kg', 1], ['bmi', 'BMI', '', 1], ['water', 'Körperwasser', '%', 1], ['visceral', 'Viszeralfett', 'Stufe', 0], ['bmr', 'Grundumsatz', 'kcal', 0]].forEach(function (m) {
      var v = last[m[0]]; if (v == null) return; var d0 = (first !== last && first[m[0]] != null) ? v - first[m[0]] : null;
      h += '<div class="stat"><b>' + fmt(v, m[3]) + '</b><span>' + m[1] + (m[2] ? ' (' + m[2] + ')' : '') + '</span>' + (d0 != null ? '<small>' + (d0 > 0 ? '+' : '') + fmt(d0, m[3] || 1) + ' seit Beginn</small>' : '') + '</div>';
    });
    return h + '</div>';
  }
  function renderKoerper() {
    var h = '';
    [0, 1].forEach(function (p) {
      var l = bodyList(p), last = l[l.length - 1], first = l[0];
      h += '<div class="panel"><div class="row" style="justify-content:space-between"><h3 style="color:' + pcolor(p) + '">' + esc(name(p)) + '</h3><span class="hint" style="margin:0">' + (last ? 'zuletzt ' + dayDE(last.date) + (last.time ? ' ' + last.time : '') : '') + '</span></div>';
      if (!last) h += '<p class="hint">Noch keine Waagen-Daten. Bis dahin gilt das Gewicht aus „Probanden und Grenzwerte“' + (cfg.kg[p] ? ' (' + fmt(cfg.kg[p], 1) + ' kg)' : '') + '.</p>';
      else h += bodyViz(p, last, first);
      h += '</div>';
    });
    $('bodyNow').innerHTML = h;
    var sel = $('bmSel'); if (!sel.options.length) { sel.innerHTML = BM.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + (m[2] ? ' (' + m[2] + ')' : '') + '</option>'; }).join(''); sel.value = ui.bm; }
    ['imp-person', 'bf-person'].forEach(function (id) { var s = $(id); if (!s.options.length) s.innerHTML = '<option value="0"></option><option value="1"></option>'; s.options[0].textContent = name(0); s.options[1].textContent = name(1); });
    if (!$('bf-date').value) $('bf-date').value = new Date().toISOString().slice(0, 10);
    var cp = $('bodyChart').closest('.panel'); if (cp) cp.hidden = !(bodyList(0).length > 1 || bodyList(1).length > 1);
    drawBodyChart(); drawBodyTable();
  }
  function drawBodyChart() {
    var m = BM.filter(function (x) { return x[0] === ui.bm; })[0], series = [0, 1].map(function (p) { return bodyList(p).filter(function (b) { return b[ui.bm] != null; }); }), all = series[0].concat(series[1]);
    if (!all.length) { $('bodyChart').innerHTML = '<div class="empty">Für diesen Wert gibt es noch keine Einträge.</div>'; $('bodyLegend').innerHTML = ''; return; }
    var W = 600, H = 220, L = 44, R = 14, T = 12, B = 26, ts = all.map(function (b) { return new Date(b.date + 'T12:00:00').getTime(); }), tmin = Math.min.apply(null, ts), tmax = Math.max.apply(null, ts);
    if (tmin === tmax) { tmin -= 86400000 * 3; tmax += 86400000 * 3; }
    var vs = all.map(function (b) { return b[ui.bm]; }), sc = niceScale(Math.min.apply(null, vs), Math.max.apply(null, vs), 4);
    var fx = function (tt) { return L + (tt - tmin) / (tmax - tmin) * (W - L - R); }, fy = function (v) { return T + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (H - T - B); };
    var g = '';
    sc.ticks.forEach(function (v) { g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + fy(v) + '" y2="' + fy(v) + '"/><text x="' + (L - 6) + '" y="' + (fy(v) + 4) + '" text-anchor="end">' + fmt(v, 1) + '</text>'; });
    [tmin, tmax].forEach(function (tt, i) { var d = new Date(tt); g += '<text x="' + fx(tt) + '" y="' + (H - 6) + '" text-anchor="' + (i ? 'end' : 'start') + '">' + ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.</text>'; });
    series.forEach(function (s, p) {
      if (!s.length) return; var pts = s.map(function (b) { return fx(new Date(b.date + 'T12:00:00').getTime()).toFixed(1) + ',' + fy(b[ui.bm]).toFixed(1); });
      g += '<polyline fill="none" stroke="' + pcolor(p) + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts.join(' ') + '"/>';
      s.forEach(function (b) { g += '<circle cx="' + fx(new Date(b.date + 'T12:00:00').getTime()) + '" cy="' + fy(b[ui.bm]) + '" r="4" fill="' + pcolor(p) + '"/>'; });
    });
    $('bodyChart').innerHTML = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Verlauf ' + esc(m[1]) + '">' + g + '</svg>';
    $('bodyLegend').innerHTML = [0, 1].map(function (p) { return '<span><i class="dot" style="background:' + pcolor(p) + '"></i>' + esc(name(p)) + '</span>'; }).join('');
  }
  function drawBodyTable() {
    var all = bodies.slice().sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? 1 : -1; });
    if (!all.length) { $('bodyTable').innerHTML = '<div class="empty">Noch keine Einträge.</div>'; return; }
    var h = '<table><thead><tr><th>Datum</th><th>Wer</th>' + BM.map(function (m) { return '<th class="num">' + m[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>';
    all.forEach(function (b) {
      h += '<tr><td class="mono">' + dateDE(b.date) + (b.time ? ' ' + b.time : '') + '</td><td>' + esc(name(b.person)) + '</td>' + BM.map(function (m) { return '<td class="num">' + (b[m[0]] == null ? '–' : fmt(b[m[0]], m[3])) + '</td>'; }).join('') + '<td><button type="button" class="btn small danger" data-bdel="' + b.id + '">' + (ui.bdelArm === b.id ? 'Sicher?' : 'Löschen') + '</button></td></tr>';
    });
    $('bodyTable').innerHTML = h + '</tbody></table>';
  }
  function bodyId(p, date, time) { return 'b' + p + '-' + date.replace(/-/g, '') + (time ? time.replace(':', '') : ''); }
  function saveBodyForm() {
    var d = { person: Number($('bf-person').value), date: $('bf-date').value, time: $('bf-time').value || null, src: 'manuell', saved: Date.now() }, any = false;
    [['kg', 'bf-kg'], ['fat', 'bf-fat'], ['muscle', 'bf-muscle'], ['water', 'bf-water'], ['bone', 'bf-bone'], ['visceral', 'bf-visceral'], ['bmr', 'bf-bmr'], ['bmi', 'bf-bmi']].forEach(function (m) { d[m[0]] = num($(m[1]).value); if (d[m[0]] != null) any = true; });
    if (!d.date || !any) { $('bfMsg').textContent = 'Datum und mindestens ein Wert werden gebraucht.'; return; }
    store.saveBody(bodyId(d.person, d.date, d.time), d).then(function () { $('bfMsg').textContent = 'Gespeichert.'; ['bf-kg', 'bf-fat', 'bf-muscle', 'bf-water', 'bf-bone', 'bf-visceral', 'bf-bmr', 'bf-bmi', 'bf-time'].forEach(function (k) { $(k).value = ''; }); }, function () { $('bfMsg').textContent = 'Nicht gespeichert (keine Schreibrechte).'; });
  }
  /* CSV import: tolerant to German/English headers, ; , or tab */
  function splitLine(line, sep) { var o = [], c = '', q = false; for (var i = 0; i < line.length; i++) { var ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === sep && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
  function normH(s) { return String(s).toLowerCase().replace(/[ä]/g, 'a').replace(/[ö]/g, 'o').replace(/[ü]/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z]/g, ''); }
  var HMAP = [['visceral', ['viszeral', 'visceral']], ['bmr', ['grundumsatz', 'bmr', 'basal']], ['bmi', ['bmi']], ['bone', ['knochen', 'bone']], ['muscle', ['muskel', 'muscle']], ['water', ['wasser', 'water']], ['fat', ['fett', 'fat']], ['kg', ['gewicht', 'weight']], ['date', ['datum', 'date', 'zeit', 'time']]];
  function parseDate(v) {
    v = String(v).trim(); var m;
    if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/))) return { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] ? ('0' + m[4]).slice(-2) + ':' + m[5] : null };
    if ((m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/))) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; return { date: y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2), time: m[4] ? ('0' + m[4]).slice(-2) + ':' + m[5] : null }; }
    if ((m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/))) { var y2 = m[3].length === 2 ? '20' + m[3] : m[3]; return { date: y2 + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2), time: m[4] ? ('0' + m[4]).slice(-2) + ':' + m[5] : null }; }
    return null;
  }
  var impRows = [];
  function parseImport(text) {
    text = String(text || '').replace(/^﻿/, ''); var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return { rows: [], cols: [], err: 'Zu wenig Zeilen. Es braucht eine Kopfzeile und mindestens eine Messung.' };
    var sep = [';', '\t', ','].reduce(function (a, c) { return lines[0].split(c).length > lines[0].split(a).length ? c : a; }, ';');
    var heads = splitLine(lines[0], sep).map(normH), map = {};
    heads.forEach(function (h, i) { for (var k = 0; k < HMAP.length; k++) { if (map[HMAP[k][0]] === undefined && HMAP[k][1].some(function (a) { return h.indexOf(a) >= 0; })) { map[HMAP[k][0]] = i; break; } } });
    if (map.date === undefined) return { rows: [], cols: [], err: 'Keine Datumsspalte gefunden (erwartet: Datum, Date oder Zeit).' };
    var rows = [];
    lines.slice(1).forEach(function (ln) {
      var c = splitLine(ln, sep), dt = parseDate(c[map.date] || ''); if (!dt) return; var r = { date: dt.date, time: dt.time }, any = false;
      ['kg', 'fat', 'muscle', 'water', 'bone', 'visceral', 'bmr', 'bmi'].forEach(function (k) { if (map[k] !== undefined) { var v = parseFloat(String(c[map[k]] || '').replace(',', '.').replace(/[^0-9.\-]/g, '')); r[k] = isNaN(v) ? null : v; if (r[k] != null) any = true; } });
      if (any) rows.push(r);
    });
    return { rows: rows, cols: Object.keys(map).filter(function (k) { return k !== 'date'; }), err: rows.length ? '' : 'Keine auswertbaren Zeilen gefunden.' };
  }
  function checkImport() {
    var r = parseImport($('imp-text').value); impRows = r.rows;
    var names = { kg: 'Gewicht', fat: 'Körperfett', muscle: 'Muskelmasse', water: 'Wasser', bone: 'Knochen', visceral: 'Viszeralfett', bmr: 'Grundumsatz', bmi: 'BMI' };
    $('impMsg').textContent = r.err || (r.rows.length + ' Messungen erkannt. Spalten: ' + r.cols.map(function (k) { return names[k]; }).join(', ') + '.');
    $('impGo').disabled = !r.rows.length;
  }
  function runImport() {
    var p = Number($('imp-person').value), rows = impRows.slice(); $('impGo').disabled = true;
    seq(rows, function (r) { var d = Object.assign({ person: p, src: 'import', saved: Date.now() }, r); return store.saveBody(bodyId(p, r.date, r.time), d); }).then(function () { $('impMsg').textContent = rows.length + ' Einträge importiert.'; impRows = []; $('imp-text').value = ''; }, function () { $('impMsg').textContent = 'Import nicht möglich (keine Schreibrechte).'; });
  }

  /* ---------- Produktfotos ---------- */
  function readPhoto(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onerror = rej;
      fr.onload = function () {
        var im = new Image(); im.onerror = rej;
        im.onload = function () {
          var s = Math.min(1, 640 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          var x = c.getContext('2d'), out = '';
          if (file.type === 'image/png') { x.drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/png'); }
          if (!out || out.length > 420000) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', 0.85); }
          res(out);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function onPhoto(inp) {
    var f = inp.files && inp.files[0]; if (!f) return; var key = inp.getAttribute('data-photo');
    readPhoto(f).then(function (d) { return store.saveImg(key, d); }).catch(function () { banner_msg('Foto konnte nicht gespeichert werden.'); });
  }
  function banner_msg(txt) { $('banners').innerHTML = banner('bad', txt); setTimeout(renderBanners, 4000); }

  /* ---------- Rendering ---------- */
  var TABS = ['start', 'messen', 'koerper', 'ergebnisse', 'wissen'];
  function setTab(t) {
    if (t === 'regeln') { ui.ws = 'regeln'; t = 'wissen'; }
    ui.tab = t; document.body.setAttribute('data-tab', t);
    TABS.forEach(function (k) { $('v-' + k).hidden = k !== t; });
    $('bnav').style.setProperty('--i', TABS.indexOf(t));
    var vv = $('v-' + t); vv.classList.remove('vin'); void vv.offsetWidth; vv.classList.add('vin');
    Array.prototype.forEach.call(document.querySelectorAll('#bnav button'), function (b) { if (b.getAttribute('data-tab') === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    try { history.replaceState(null, '', '#' + t); } catch (e) { }
    window.scrollTo(0, 0);
    if (t === 'koerper') renderKoerper();
    if (t === 'messen' && !ui.editId) { onPersonChange(); if (ui.sess == null) { var nx = nextFor(Number($('f-person').value)); if (nx >= 0) pickSession(nx); } }
    if (t === 'wissen') setWs(ui.ws);
  }
  function setWs(w) {
    ui.ws = w;
    ['produkte', 'studien', 'puls', 'bank', 'regeln'].forEach(function (k) { $('ws-' + k).hidden = k !== w; });
    Array.prototype.forEach.call(document.querySelectorAll('#wsSeg button'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-ws') === w)); });
    if (w === 'bank') bankStart();
  }
  function renderBanners() {
    var h = '';
    if (memMode) h += banner(standalone ? '' : 'bad', standalone ? 'Die Daten liegen nur auf diesem Gerät. Unter Start › „Verbindung zum Datenspeicher“ lässt sich das gemeinsame Daten-Repo eintragen.' : 'Gemeinsames Speichern ist in dieser Ansicht nicht verfügbar. Deine Eingaben bleiben nur in diesem Browser auf diesem Gerät.');
    else if (!ui.loaded) h += banner('', 'Daten werden geladen …');
    $('banners').innerHTML = h;
  }
  function chipsHTML() {
    return [['both', 'Beide'], ['0', name(0)], ['1', name(1)]].map(function (it) { var v = it[0] === 'both' ? 'both' : Number(it[0]); return '<button type="button" class="chip" data-chip="1" data-v="' + it[0] + '" aria-pressed="' + (ui.person === v) + '">' + esc(it[1]) + '</button>'; }).join('');
  }
  function renderAll(skipCfg) {
    if (!skipCfg) renderCfg();
    var cur = $('f-person').value, o = $('f-person').options; if (o[0]) o[0].textContent = name(0); if (o[1]) o[1].textContent = name(1); $('f-person').value = cur || '0';
    $('personChips').innerHTML = chipsHTML();
    renderBanners(); renderStart(); renderPlanStart(); renderMiles(); renderSessPick(); renderEval(); renderFazit(); renderHr(); renderScatter(); renderBars(); renderVs(); renderDeutung(); renderStudyCompare(); renderTable(); renderRel(); renderPlan(); applyVisibility(); renderProdukte(); renderPrep(); if (ui.tab === 'koerper') renderKoerper();
    if (ui.tab === 'messen') updateDose();
    autoSess();
  }
  /* Leere Auswertungen weglassen: Grafiken erscheinen erst, wenn es etwas zu zeigen gibt. */
  function applyVisibility() {
    var u = usable(), seen = {}; u.forEach(function (x) { seen[x.cond] = 1; });
    var nC = Object.keys(seen).length, hr = u.some(function (x) { return x.hrs && x.hrs.length > 1; });
    var vs = [0, 1].some(function (p) { return condMean(p, 'o300') != null && condMean(p, 't300') != null; });
    function vis(id, on) { var el = $(id), pn = el && el.closest('.panel'); if (pn) pn.hidden = !on; }
    vis('scatter', nC >= 3); vis('bars', nC >= 2); vis('vsBox', vs); vis('hrBox', hr);
    vis('evalBox', nC >= 3); vis('deutung', nC >= 3); vis('vsStudies', nC >= 3);
  }
  /* Sitzung folgt den Daten: kommen die Messungen erst nach dem Laden an, springt die Auswahl von der erledigten auf die nächste. */
  function autoSess() {
    if (ui.editId || P.mode || (X.phase !== 'connect' && X.phase !== 'ready')) return;
    var pn = Number($('f-person').value) || 0, nx = nextFor(pn);
    if (nx < 0) return;
    if (ui.sess == null) { if (ui.tab === 'messen') pickSession(nx); }
    else if (!ui.sessManual && done(pn, ui.sess)) pickSession(nx);
  }
  function renderGh() {
    var emb = !!(window.claude && window.claude.use), c = window.GHDB && GHDB.getCfg();
    $('ghCard').hidden = emb; if (emb) return;
    $('ghRepo').value = c ? c.repo : ''; $('ghTok').value = c ? '••••••••' : '';
    $('ghOff').hidden = !c; $('ghMsg').textContent = c ? 'Verbunden mit ' + c.repo : 'Noch nicht verbunden. Die Daten bleiben bis dahin nur auf diesem Gerät.';
  }
  function wire() {
    renderGh();
    $('ghOn').addEventListener('click', function () {
      var repo = $('ghRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), tok = $('ghTok').value.trim(), old = GHDB.getCfg();
      if (tok.indexOf('•') === 0 && old) tok = old.token;
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !tok) { $('ghMsg').textContent = 'Bitte Repo (Name/Repo) und Token eintragen.'; return; }
      $('ghMsg').textContent = 'Prüfe …';
      var t = GHDB.create({ repo: repo, token: tok }); t.check().then(function (r) {
        if (!r.private) { $('ghMsg').textContent = 'Dieses Repo ist öffentlich. Gesundheitsdaten gehören in ein privates Repo.'; return; }
        GHDB.setCfg({ repo: repo, token: tok }); location.reload();
      }, function (e) { $('ghMsg').textContent = e.status === 401 ? 'Token ungültig.' : e.status === 404 ? 'Repo nicht gefunden oder Token ohne Zugriff.' : 'Fehler: ' + e.message; });
    });
    $('ghOff').addEventListener('click', function () { GHDB.setCfg(null); location.reload(); });
    fillSelects(); renderStudien(); renderPulsInfo(); renderBank(); renderRegeln();
    Array.prototype.forEach.call(document.querySelectorAll('#bnav button'), function (b) { b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); }); });
    Array.prototype.forEach.call(document.querySelectorAll('#wsSeg button'), function (b) { b.addEventListener('click', function () { setWs(b.getAttribute('data-ws')); }); });
    $('selY').addEventListener('change', function () { ui.y = this.value; renderScatter(); });
    $('selX').addEventListener('change', function () { ui.x = this.value; renderScatter(); });
    $('cleanOnly').addEventListener('change', function () { ui.clean = this.checked; renderAll(true); });
    document.body.addEventListener('click', function (e) {
      var c = e.target.closest('[data-chip]'); if (c) { var v = c.getAttribute('data-v'); ui.person = v === 'both' ? 'both' : Number(v); renderAll(true); return; }
      var sr = e.target.closest('[data-sess]'); if (sr) { ui.sessManual = true; pickSession(Number(sr.getAttribute('data-sess'))); return; }
      var g = e.target.closest('[data-go]'); if (g) { setTab(g.getAttribute('data-go')); var pk = g.getAttribute('data-pick'); if (pk != null && !ui.editId) pickSession(Number(pk)); return; }
      var ed = e.target.closest('[data-edit]'); if (ed) { var s = sessions.filter(function (x) { return x.id === ed.getAttribute('data-edit'); })[0]; if (s) loadIntoForm(s); return; }
      var pr = e.target.closest('[data-photo-reset]'); if (pr) { store.saveImg(pr.getAttribute('data-photo-reset'), null).catch(function () { }); return; }
      var bd = e.target.closest('[data-bdel]'); if (bd) { var bid = bd.getAttribute('data-bdel'); if (ui.bdelArm === bid) { ui.bdelArm = null; store.delBody(bid).catch(function () { }); } else { ui.bdelArm = bid; drawBodyTable(); } return; }
      var dl = e.target.closest('[data-del]'); if (dl) { var id = dl.getAttribute('data-del'); if (ui.delArm === id) { ui.delArm = null; store.del(id).catch(function () { }); } else { ui.delArm = id; renderTable(); } }
    });
    $('prepList').addEventListener('change', function (e) { var k = e.target.getAttribute('data-prep'); if (!k) return; cfg.prep = Object.assign({}, cfg.prep || {}); cfg.prep[k] = e.target.checked; renderPrep(); clearTimeout(cfgTimer); cfgTimer = setTimeout(function () { store.saveCfg().catch(function () { }); }, 600); });
    ['rc-w', 'rc-r'].forEach(function (k) { $(k).addEventListener('input', calcRM); }); $('rc-apply').addEventListener('click', applyRM);
    $('bmSel').addEventListener('change', function () { ui.bm = this.value; drawBodyChart(); });
    $('bfSave').addEventListener('click', saveBodyForm); $('impCheck').addEventListener('click', checkImport); $('impGo').addEventListener('click', runImport);
    $('imp-file').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { $('imp-text').value = fr.result; checkImport(); }; fr.readAsText(f); });
    document.body.addEventListener('change', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-photo')) onPhoto(e.target); });
    $('cfgBox').addEventListener('input', onCfg); $('cfgBox').addEventListener('change', onCfg);
    Array.prototype.forEach.call(document.querySelectorAll('[data-hyp]'), function (el) {
      el.addEventListener('input', function () { grow(el); cfg.hyp = Object.assign({}, cfg.hyp || DEF_HYP); cfg.hyp[el.getAttribute('data-hyp')] = el.value; clearTimeout(hypTimer); hypTimer = setTimeout(function () { store.saveCfg().then(function () { $('hypMsg').textContent = 'Gespeichert.'; }, function () { $('hypMsg').textContent = 'Nicht gespeichert (keine Schreibrechte).'; }); }, 900); });
    });
    $('f-cond').addEventListener('change', onCondChange);
    $('f-person').addEventListener('change', function () { $('f-kg').dataset.auto = '1'; $('f-load').dataset.auto = '1'; $('f-kg').value = ''; $('f-load').value = ''; onPersonChange(); var pn = Number($('f-person').value), nx2 = nextFor(pn); if (nx2 >= 0 && (ui.sess == null || done(pn, ui.sess))) pickSession(nx2); else renderSessPick(); });
    $('f-mg').addEventListener('input', function () { mgTouched = true; updateDose(); });
    ['f-extra', 'f-kg'].forEach(function (k) { $(k).addEventListener('input', function () { delete $(k).dataset.auto; updateDose(); }); });
    $('f-load').addEventListener('input', function () { delete $('f-load').dataset.auto; });
    $('f-wait').addEventListener('input', function () { if (!timerId) stopTimer(); });
    $('takeBtn').addEventListener('click', startTimer); $('timerStop').addEventListener('click', stopTimer);
    $('repMinus').addEventListener('click', function () { var v = num($('f-reps').value) || 0; $('f-reps').value = Math.max(0, v - 1); });
    $('repPlus').addEventListener('click', function () { var v = num($('f-reps').value) || 0; $('f-reps').value = v + 1; });
    $('nextBtn').addEventListener('click', function () { if (validStep()) { ui.step = Math.min(3, ui.step + 1); renderSteps(); window.scrollTo(0, 0); } });
    $('backBtn').addEventListener('click', function () { ui.step = Math.max(0, ui.step - 1); $('formMsg').textContent = ''; renderSteps(); });
    $('form').addEventListener('submit', saveForm);
    $('pFile').addEventListener('change', function (e) { importPolar(e.target.files && e.target.files[0]); e.target.value = ''; }); $('pDemo').addEventListener('click', toggleDemo); $('pDiag').addEventListener('click', function () { showDiag(''); }); setInterval(lampUpdate, 1000); ['x-kg', 'x-load', 'f-reps'].forEach(function (id) { $(id).addEventListener('input', function () { setTimeout(xAuto, 0); }); }); $('repMinus').addEventListener('click', xAuto); $('repPlus').addEventListener('click', xAuto);
    $('xMain').addEventListener('click', xMainClick); $('xSkip').addEventListener('click', xSkipClick);
    $('xPerson').addEventListener('click', function (e) { var b = e.target.closest('[data-xp]'); if (!b) return; $('f-person').value = b.getAttribute('data-xp'); onPersonChange(); });
    [['x-kg', 'f-kg'], ['x-load', 'f-load']].forEach(function (q) { $(q[0]).addEventListener('input', function () { $(q[1]).value = this.value; $(q[1]).dataset.auto = ''; updateDose(); }); });
    $('shuffleBtn').addEventListener('click', function () {
      var a = COND_ORDER.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
      cfg.order = a; store.saveCfg().then(function () { $('shuffleMsg').textContent = 'Neue Reihenfolge gespeichert.'; }, function () { $('shuffleMsg').textContent = 'Nicht gespeichert (keine Schreibrechte).'; }); renderAll(true); renderPlan();
    });
    $('csvBtn').addEventListener('click', function () {
      if (!downloadsApi) { $('csvMsg').textContent = 'Speichern als Datei ist in dieser Ansicht nicht verfügbar.'; return; }
      downloadsApi.save({ filename: 'koffein-am-limit-messdaten.csv', data: csv() }).then(function () { $('csvMsg').textContent = 'Gespeichert.'; }, function (e) { $('csvMsg').textContent = e && e.code === 'declined' ? 'Abgebrochen.' : 'Speichern nicht möglich.'; });
    });
    $('copySheet').addEventListener('click', function () {
      var t = sheetText(), ok = function () { $('copyMsg').textContent = 'Kopiert.'; }, no = function () { $('copyMsg').textContent = 'Kopieren nicht möglich. Text unten markieren.'; $('copyMsg').insertAdjacentHTML('afterend', ''); };
      try { navigator.clipboard.writeText(t).then(ok, no); } catch (e) { no(); }
    });
    var h = (location.hash || '').replace('#', ''); if (TABS.indexOf(h) >= 0 || h === 'regeln') setTab(h); else $('bnav').style.setProperty('--i', 0);
    window.addEventListener('hashchange', function () { var k = (location.hash || '').replace('#', ''); if ((TABS.indexOf(k) >= 0 && k !== ui.tab) || (k === 'regeln' && ui.ws !== 'regeln')) setTab(k); });
    resetForm(); renderAll();
  }
  function attach() {
    var timer = setTimeout(function () { if (!ui.loaded) { $('banners').innerHTML = banner('bad', 'Die Daten sind gerade nicht erreichbar. Neu laden oder später versuchen.'); } }, 10000);
    dbApi.doc('config/main').onSnapshot(function (snap) {
      if (snap.exists) { var d = snap.data(); cfg = { names: d.names || cfg.names, kg: d.kg || cfg.kg, rm1: d.rm1 || cfg.rm1, u18: d.u18 || cfg.u18, order: d.order && d.order.length === 6 ? d.order : COND_ORDER.slice(), hyp: d.hyp || DEF_HYP, prep: d.prep || {} }; }
      renderAll(); if (ui.tab === 'messen') onPersonChange();
    }, function () { });
    dbApi.collection('body').onSnapshot(function (snap) { bodies = snap.docs.map(function (dc) { var d = Object.assign({}, dc.data()); d.id = dc.id; return d; }); renderAll(true); }, function () { });
    dbApi.collection('images').onSnapshot(function (snap) { imgs = {}; snap.docs.forEach(function (dc) { var d = dc.data(); if (d && d.data) imgs[dc.id] = d.data; }); renderAll(true); }, function () { });
    dbApi.collection('sessions').onSnapshot(function (snap) {
      sessions = snap.docs.map(function (dc) { var d = Object.assign({}, dc.data()); d.id = dc.id; return d; }).filter(function (s) { return !s.beispiel; });
      if (!snap.metadata.fromCache) { ui.loaded = true; clearTimeout(timer); }
      renderAll(true);
    }, function () { ui.loaded = true; renderAll(true); });
  }
  function connect() {
    if (!window.claude || !window.claude.use) {
      var g = window.GHDB && GHDB.getCfg();
      if (g) { dbApi = GHDB.create(g, function (st, msg) { var el = $('ghMsg'); if (el) el.textContent = msg; ui.sync = st; }); attach(); dbApi.start(); return; }
      memMode = true; standalone = true; lsRead(); ui.loaded = true; renderAll(); return;
    }
    Promise.all([window.claude.use('db'), window.claude.use('downloads'), window.claude.use('user')]).then(function (r) {
      dbApi = r[0]; downloadsApi = r[1];
      if (!dbApi) { memMode = true; lsRead(); ui.loaded = true; renderAll(); return; }
      attach();
    }, function () { memMode = true; lsRead(); ui.loaded = true; renderAll(); });
  }
  wire();
  connect();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !(window.claude && window.claude.use)) { try { navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { } }
})();
