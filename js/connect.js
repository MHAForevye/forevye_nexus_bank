/* Nexus bağlantısı. Giriş burada yapılmaz: kullanıcı Nexus'ta (FOREVYE ID ile) giriş yapar, Nexus tek kullanımlık bir bilet verir ve
   buraya `#t=<bilet>` ile gönderir. Bilet jetona çevrilir (sunucuya yalnızca bu istek gider; adres çubuğundan hemen silinir).
   Jeton yalnızca bu sekmenin sessionStorage'ında durur ve yalnızca kart editörü uçlarında geçerlidir. */
(function (root) {
  'use strict';
  var CFG = root.FNX_CONFIG || {};
  var NEXUS = String(CFG.NEXUS_URL || '').replace(/\/+$/, '');
  var KEY = 'fnx.session';
  var PEND = 'fnx.ticket';   // sunucuya hiç ulaşılamadıysa bilet (5 dk, tek kullanımlık) yalnızca bu sekmede "Tekrar dene" için saklanır
  var S = { token: '', payload: null, returnPath: '' };

  function ss(op, v, key) { key = key || KEY; try { if (op === 'get') return sessionStorage.getItem(key); if (op === 'set') sessionStorage.setItem(key, v); else sessionStorage.removeItem(key); } catch (e) {} return null; }

  // fetch hiç yanıt alamadığında nedeni ayırır. no-cors: yanıt okunamaz ama sunucuya ulaşılırsa istek "çözülür"; CORS'tan etkilenmeyen statik bir dosya kullanılır.
  // true  → Nexus ayakta, yanıtı tarayıcı engelledi (neredeyse her zaman CORS: Nexus'taki EDITOR_URL bu sitenin adresiyle uyuşmuyor).
  // false → Nexus'a hiç bağlanılamadı (adres yanlış, Worker yayında değil, ağ yok ya da https sayfadan http adrese istek).
  function reachable() {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 7000) : 0;
    return fetch(NEXUS + '/assets/logo-icon.svg', { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function () { return true; }, function () { return false; })
      .then(function (ok) { if (timer) clearTimeout(timer); return ok; });
  }
  function unreachable() {
    return reachable().then(function (up) {
      var msg = up
        ? 'Nexus’a ulaşıldı ama tarayıcı yanıtı engelledi (CORS). Nexus’taki EDITOR_URL (wrangler.toml) şu kaynağı içermeli: ' + location.origin
        : (location.protocol === 'https:' && /^http:/i.test(NEXUS)
          ? 'Bu site https, Nexus adresi ise http (' + NEXUS + '): tarayıcı karışık içeriği engeller. config.js içindeki NEXUS_URL https olmalı.'
          : 'Nexus sunucusuna bağlanılamadı (' + NEXUS + '). config.js içindeki NEXUS_URL doğru mu ve Nexus Worker’ı yayında mı kontrol et.');
      var e = new Error(msg); e.offline = true; e.reason = up ? 'cors' : 'down'; return e;
    });
  }

  function call(method, path, token, body) {
    var h = {}; if (body !== undefined) h['content-type'] = 'application/json'; if (token) h.authorization = 'Bearer ' + token;
    return fetch(NEXUS + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit' })
      .catch(function () { return unreachable().then(function (e) { throw e; }); })
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
    var ticket = m ? m[1] : ss('get', null, PEND);   // adres çubuğundaki bilet, yoksa daha önce ulaşılamadığı için saklanan bilet
    var start = ticket
      ? call('POST', '/api/editor/exchange', '', { ticket: ticket }).then(function (d) { ss('del', null, PEND); S.token = d.token; ss('set', d.token); return d; },
        function (e) { if (e.offline) ss('set', ticket, PEND); else ss('del', null, PEND); throw e; })
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
