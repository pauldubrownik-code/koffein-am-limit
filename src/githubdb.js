/* GitHub als Datenspeicher (nur für die eigenständige App / PWA).
   Ein privates Repo, pro Dokument eine Datei: data/<sammlung>/<id>.json.
   Schnittstelle wie die Artifact-Datenbank (doc/collection, set/delete/onSnapshot), damit app.js nichts davon merkt.
   Lokal zuerst: Änderungen sind sofort sichtbar und werden im Hintergrund hochgeladen (auch nach Offline-Phasen). */
(function () {
  var API = 'https://api.github.com', CFG = 'kal-gh', CACHE = 'kal-gh-cache';
  function b64enc(s) { var b = new TextEncoder().encode(s), r = ''; for (var i = 0; i < b.length; i += 0x8000) r += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(r); }
  function b64dec(s) { var r = atob(s.replace(/\s/g, '')), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return new TextDecoder().decode(b); }
  function getCfg() { try { var c = JSON.parse(localStorage.getItem(CFG) || 'null'); return c && c.repo && c.token ? c : null; } catch (e) { return null; } }
  function setCfg(c) { try { if (c) localStorage.setItem(CFG, JSON.stringify(c)); else { localStorage.removeItem(CFG); localStorage.removeItem(CACHE); } } catch (e) { } }
  function newId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function create(cfg, onStatus) {
    var repo = cfg.repo, token = cfg.token, docs = {}, shas = {}, dirty = {}, subs = [], firstPull = false, flushing = false, timer = null;
    onStatus = onStatus || function () { };
    try { var c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && c.repo === repo) { docs = c.docs || {}; shas = c.shas || {}; } } catch (e) { }
    function saveCache() { try { localStorage.setItem(CACHE, JSON.stringify({ repo: repo, docs: docs, shas: shas })); } catch (e) { } }
    function gh(method, path, body) {
      return fetch(API + '/repos/' + repo + path, {
        method: method, cache: 'no-store', body: body ? JSON.stringify(body) : undefined,
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
          return j;
        });
      });
    }
    function snapDocs(col) {
      var pre = col + '/';
      return Object.keys(docs).filter(function (k) { return k.indexOf(pre) === 0; }).map(function (k) { return { id: k.slice(pre.length), data: function () { return docs[k]; } }; });
    }
    function emit() {
      subs.forEach(function (s) {
        if (s.col) s.cb({ docs: snapDocs(s.col), metadata: { fromCache: !firstPull } });
        else s.cb({ exists: Object.prototype.hasOwnProperty.call(docs, s.path), id: s.path.split('/')[1], data: function () { return docs[s.path]; }, metadata: { fromCache: !firstPull } });
      });
    }
    function sub(s) { subs.push(s); setTimeout(function () { if (subs.indexOf(s) >= 0) { if (s.col) s.cb({ docs: snapDocs(s.col), metadata: { fromCache: !firstPull } }); else s.cb({ exists: Object.prototype.hasOwnProperty.call(docs, s.path), id: s.path.split('/')[1], data: function () { return docs[s.path]; }, metadata: { fromCache: !firstPull } }); } }, 0); return function () { subs = subs.filter(function (x) { return x !== s; }); }; }

    function pull() {
      return gh('GET', '/git/trees/HEAD?recursive=1').catch(function (e) { if (e.status === 409) return { tree: [] }; throw e; }).then(function (t) {
        var files = (t.tree || []).filter(function (f) { return f.type === 'blob' && /^data\/[^/]+\/[^/]+\.json$/.test(f.path); });
        var seen = {}, jobs = [], changed = false;
        files.forEach(function (f) {
          var key = f.path.slice(5, -5); seen[key] = 1;
          if (dirty[key] || shas[key] === f.sha) return;
          jobs.push(gh('GET', '/git/blobs/' + f.sha).then(function (b) { docs[key] = JSON.parse(b64dec(b.content)); shas[key] = f.sha; changed = true; }));
        });
        Object.keys(docs).forEach(function (k) { if (!seen[k] && !dirty[k]) { delete docs[k]; delete shas[k]; changed = true; } });
        return Promise.all(jobs).then(function () { var first = !firstPull; firstPull = true; saveCache(); if (changed || first) emit(); });
      });
    }
    function putFile(key, data) {
      var path = '/contents/data/' + key + '.json', body = { message: 'update ' + key, content: b64enc(JSON.stringify(data)) };
      if (shas[key]) body.sha = shas[key];
      return gh('PUT', path, body).catch(function (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
        return gh('GET', path).then(function (cur) { body.sha = cur.sha; return gh('PUT', path, body); }, function (e2) { if (e2.status === 404) { delete body.sha; return gh('PUT', path, body); } throw e2; });
      }).then(function (r) { shas[key] = r.content.sha; });
    }
    function delFile(key) {
      var path = '/contents/data/' + key + '.json';
      function go(sha) { return gh('DELETE', path, { message: 'delete ' + key, sha: sha }); }
      var p = shas[key] ? go(shas[key]) : Promise.resolve();
      return p.catch(function (e) { if (e.status === 404) return; if (e.status === 409 || e.status === 422) return gh('GET', path).then(function (cur) { return go(cur.sha); }); throw e; }).then(function () { delete shas[key]; });
    }
    function flush() {
      if (flushing) return Promise.resolve();
      var keys = Object.keys(dirty); if (!keys.length) return Promise.resolve();
      flushing = true; onStatus('sync', 'Speichere …');
      return keys.reduce(function (p, k) {
        return p.then(function () {
          var d = dirty[k]; if (!d) return;
          return (d.op === 'del' ? delFile(k) : putFile(k, d.data)).then(function () { if (dirty[k] === d) delete dirty[k]; saveCache(); });
        });
      }, Promise.resolve()).then(function () { flushing = false; onStatus('ok', 'Gespeichert'); }, function (e) { flushing = false; onStatus('error', 'Hochladen fehlgeschlagen: ' + e.message + '. Wird später erneut versucht.'); });
    }
    function tick() {
      if (typeof document !== 'undefined' && document.hidden) return;
      flush().then(function () { return pull(); }).then(function () { if (!Object.keys(dirty).length) onStatus('ok', 'Verbunden mit ' + repo); }, function (e) {
        onStatus('error', e.status === 401 ? 'Token ungültig oder abgelaufen.' : e.status === 404 ? 'Repo nicht gefunden oder Token ohne Zugriff.' : 'Keine Verbindung: ' + e.message);
        if (!firstPull) { firstPull = true; emit(); }
      });
    }
    function write(key, data) { if (data === null) { delete docs[key]; dirty[key] = { op: 'del' }; } else { docs[key] = data; dirty[key] = { op: 'set', data: data }; } saveCache(); emit(); flush(); return Promise.resolve(); }
    function docRef(path) { return { id: path.split('/')[1], set: function (d) { return write(path, JSON.parse(JSON.stringify(d))); }, delete: function () { return write(path, null); }, onSnapshot: function (cb) { return sub({ path: path, cb: cb }); } }; }
    var api = {
      doc: docRef,
      collection: function (col) { return { doc: function (id) { return docRef(col + '/' + (id || newId())); }, onSnapshot: function (cb) { return sub({ col: col, cb: cb }); } }; },
      start: function () { tick(); timer = setInterval(tick, 20000); if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); }); },
      stop: function () { clearInterval(timer); },
      check: function () { return gh('GET', ''); }
    };
    return api;
  }
  window.GHDB = { create: create, getCfg: getCfg, setCfg: setCfg };
})();
