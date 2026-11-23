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

  // fetch hiç yanıt alamadığında nedeni ayırır (üç ayrı yoklama):
  //  1) CORS'lu GET /api/editor/card (jetonsuz → 401 beklenir): yanıt gelirse Nexus ayakta ve CORS izni TAMAM.
  //  2) no-cors GET /api/market: yanıt "çözülürse" Nexus ayakta ama tarayıcı yanıtı (CORS) engelliyor.
  //  3) ikisi de olmazsa gerçekten ulaşılamıyor (adres/ağ/engelleyici eklenti).
  function probe(url, opts) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : 0;
    opts.signal = ctl ? ctl.signal : undefined; opts.cache = 'no-store'; opts.credentials = 'omit';
    return fetch(url, opts).then(function (r) { return { ok: true, status: r.status }; }, function (er) { return { ok: false, err: String((er && er.name === 'AbortError') ? 'zaman aşımı (8 sn)' : (er && er.message) || er) }; })
      .then(function (x) { if (timer) clearTimeout(timer); return x; });
  }
  function unreachable(origErr) {
    return probe(NEXUS + '/api/editor/card', { method: 'GET' }).then(function (cors) {
      if (cors.ok) return { reason: 'retry', detail: 'HTTP ' + cors.status };
      return probe(NEXUS + '/api/market', { method: 'GET', mode: 'no-cors' }).then(function (raw) { return { reason: raw.ok ? 'cors' : 'down', detail: raw.ok ? '' : raw.err }; });
    }).then(function (r) {
      var msg;
      if (r.reason === 'retry') msg = 'Nexus’a ulaşıldı ve CORS izni var, ama istek bu sefer tamamlanamadı (geçici ağ hatası ya da Worker hatası). “Tekrar dene”ye bas; sürerse Nexus’ta Cloudflare → Workers → Logs’a bak.';
      else if (r.reason === 'cors') msg = 'Nexus’a ulaşıldı ama tarayıcı yanıtı engelledi (CORS). Nexus’taki EDITOR_URL (wrangler.toml) şu kaynağı içermeli: ' + location.origin + ' — ve Worker’ın güncel sürümü yayında olmalı (npm run deploy).';
      else if (location.protocol === 'https:' && /^http:/i.test(NEXUS)) msg = 'Bu site https, Nexus adresi ise http (' + NEXUS + '): tarayıcı karışık içeriği engeller. config.js içindeki NEXUS_URL https olmalı.';
      else msg = 'Nexus sunucusuna bağlanılamadı (' + NEXUS + '). Ayrıntı: ' + (r.detail || (origErr && origErr.message) || 'bilinmiyor') + '. Reklam/gizlilik eklentilerini kapatıp dene; sürerse config.js içindeki NEXUS_URL ve Worker’ın yayında olduğunu kontrol et.';
      var e = new Error(msg); e.offline = true; e.reason = r.reason; return e;
    });
  }

  // İstek: 20 sn zaman aşımı (asılı kalmasın); yalnızca GET'te ağ hatasında bir kez daha dener (PUT/POST tekrarlanmaz).
  function call(method, path, token, body) {
    var h = {}; if (body !== undefined) h['content-type'] = 'application/json'; if (token) h.authorization = 'Bearer ' + token;
    function once() {
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : 0;
      return fetch(NEXUS + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (timer) clearTimeout(timer); return r; }, function (er) { if (timer) clearTimeout(timer); throw er; });
    }
    return once()
      .catch(function (oe) { return method === 'GET' ? new Promise(function (r) { setTimeout(r, 1200); }).then(once) : Promise.reject(oe); })
      .catch(function (oe) { return unreachable(oe).then(function (e) { throw e; }); })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (d) {
          if (!res.ok) {
            var er = (d && d.error) || {}; var e = new Error(er.message || 'İşlem tamamlanamadı.'); e.status = res.status; e.code = er.code; e.errors = er.errors;
            if (res.status === 401 && S.token) { e.expired = true; e.message = 'Editör oturumu doldu. Taslağın bu cihazda korunuyor; Nexus’ta “Kartını tasarla”ya basıp yeniden aç, kaldığın yerden devam edersin.'; }
            throw e;
          }
          return d;
        });
      });
  }

  // Editör açıkken jetonun boşta kalıp düşmemesi için arada sunucuya "buradayım" der (sunucu jetonu kaydırır).
  var pingTimer = 0;
  function ping() { if (!S.token || document.hidden) return; call('GET', '/api/editor/card', S.token).catch(function () { /* kaydetme anında hata gösterilir */ }); }
  function keepAlive() {
    if (pingTimer) return;
    pingTimer = setInterval(ping, 4 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
    window.addEventListener('online', ping);
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
      S.payload = d; keepAlive(); return { state: 'ready', payload: d };
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
