/* Nexus bağlantısı. Giriş burada yapılmaz: kullanıcı Nexus'ta (FOREVYE ID ile) giriş yapar, Nexus tek kullanımlık bir bilet verir ve
   buraya `#t=<bilet>` ile gönderir. Bilet jetona çevrilir (sunucuya yalnızca bu istek gider; adres çubuğundan hemen silinir).
   Jeton yalnızca bu sekmenin sessionStorage'ında durur ve yalnızca kart editörü uçlarında geçerlidir. */
(function (root) {
  'use strict';
  var CFG = root.FNX_CONFIG || {};
  var NEXUS = String(CFG.NEXUS_URL || '').replace(/\/+$/, '');
  var KEY = 'fnx.session';
  var S = { token: '', payload: null, returnPath: '' };

  function ss(op, v) { try { if (op === 'get') return sessionStorage.getItem(KEY); if (op === 'set') sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {} return null; }

  function call(method, path, token, body) {
    var h = {}; if (body !== undefined) h['content-type'] = 'application/json'; if (token) h.authorization = 'Bearer ' + token;
    return fetch(NEXUS + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit' })
      .catch(function () { var e = new Error('Sunucuya ulaşılamadı.'); e.offline = true; throw e; })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (d) {
          if (!res.ok) { var er = (d && d.error) || {}; var e = new Error(er.message || 'İşlem tamamlanamadı.'); e.status = res.status; e.code = er.code; e.errors = er.errors; throw e; }
          return d;
        });
      });
  }

  // Nexus'ta giriş + bilet için gidilecek adres (kart varsa o kartın editörü, yoksa yeni kart).
  function launchUrl() {
    var id = S.payload && S.payload.card && S.payload.card.id;
    return NEXUS + '/#/editor-launch/' + (id || 'new');
  }

  // Sonuç: { state: 'ready', payload } | { state: 'gate' } | { state: 'error', message }
  function boot() {
    var m = /(?:^|[#&])t=([A-Za-z0-9_-]{20,80})/.exec(location.hash || '');
    if (m) history.replaceState(null, '', location.pathname + location.search);   // bilet adres çubuğunda/geçmişte kalmasın
    var start = m
      ? call('POST', '/api/editor/exchange', '', { ticket: m[1] }).then(function (d) { S.token = d.token; ss('set', d.token); return d; })
      : (function () {
        var t = ss('get'); if (!t) return Promise.resolve(null);
        S.token = t; return call('GET', '/api/editor/card', t).catch(function (e) { if (e.status === 401) { ss('del'); S.token = ''; return null; } throw e; });
      })();
    return start.then(function (d) {
      if (!d) return { state: 'gate' };
      S.payload = d; return { state: 'ready', payload: d };
    }).catch(function (e) { return { state: 'error', message: e.message, offline: !!e.offline }; });
  }

  // Tasarımı Nexus'a kaydeder. Sunucunun doğrulayıp yeniden kurduğu tasarımı döner (sürümü sunucu yazar).
  function persist(design) {
    return call('PUT', '/api/editor/card', S.token, { design: design }).then(function (r) {
      S.payload.card = r.card; S.payload.mode = 'edit'; S.returnPath = r.return_path || '';
      return r.card.design;
    });
  }

  function exit() {
    var id = S.payload && S.payload.card && S.payload.card.id;
    location.href = NEXUS + (S.returnPath || (id ? '/#/cards/' + id : '/#/cards'));
  }

  root.FNXConnect = { enabled: !!NEXUS, nexusUrl: NEXUS, boot: boot, persist: persist, exit: exit, launchUrl: launchUrl, state: S };
})(window);
