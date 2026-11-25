/* Nexus bağlantısı. Giriş burada yapılmaz: kullanıcı Nexus'ta (FOREVYE ID ile) giriş yapar ve tek kullanımlık biletle buraya döner. */
(function (root) {
  'use strict';
  var CFG = root.FNX_CONFIG || {};
  var NEXUS = String(CFG.NEXUS_URL || '').replace(/\/+$/, '');
  var KEY = 'fnx.session';
  var PEND = 'fnx.ticket';
  var S = { token: '', payload: null, returnPath: '' };
  function ss(op, v, key) { key = key || KEY; try { if (op === 'get') return sessionStorage.getItem(key); if (op === 'set') sessionStorage.setItem(key, v); else sessionStorage.removeItem(key); } catch (e) {} return null; }
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
  var pingTimer = 0;
  function ping() { if (!S.token || document.hidden) return; call('GET', '/api/editor/card', S.token).catch(function () {}); }
  function keepAlive() {
    if (pingTimer) return;
    pingTimer = setInterval(ping, 4 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
    window.addEventListener('online', ping);
  }
  function launchUrl() {
    var id = S.payload && S.payload.card && S.payload.card.id;
    return NEXUS + '/#/editor-launch/' + (id || 'new');
  }
  function boot() {
    var m = /(?:^|[#&])t=([A-Za-z0-9_-]{20,80})/.exec(location.hash || '');
    if (m) history.replaceState(null, '', location.pathname + location.search);
    var ticket = m ? m[1] : ss('get', null, PEND);
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
  function persist(design, skinProductId) {
    return call('PUT', '/api/editor/card', S.token, { design: design, skin_product_id: skinProductId || null }).then(function (r) {
      S.payload.card = r.card; S.payload.mode = 'edit'; S.payload.equipped_skin = r.skin || null; S.returnPath = r.return_path || '';
      return r.card.design;
    });
  }
  function marketTicket(productId) {
    return call('POST', '/api/editor/shop-ticket', S.token, { product_id: productId || null }).then(function (r) { return r.url; });
  }
  function exit() {
    var id = S.payload && S.payload.card && S.payload.card.id;
    location.href = NEXUS + (S.returnPath || (id ? '/#/cards/' + id : '/#/cards'));
  }

  // Banka istekleri: zaman aşımı var; GET tekrar denenebilir, tek kullanımlık bilet POST'u asla otomatik tekrarlanmaz.
  function bankCall(method, path, token, body) {
    var headers = {};
    if (token) headers.authorization = 'Bearer ' + token;
    if (body !== undefined) headers['content-type'] = 'application/json';
    function once() {
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : 0;
      return fetch(NEXUS + path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (timer) clearTimeout(timer); return r; }, function (e) { if (timer) clearTimeout(timer); throw e; });
    }
    return once().catch(function (e) {
      if (method !== 'GET') {
        if (e && e.name === 'AbortError') throw new Error('Banka giriş bileti isteği 12 saniyede yanıt vermedi. Güvenlik için aynı bilet tekrar gönderilmedi; Nexus’tan yeni Banka bağlantısı aç.');
        throw new Error('Banka sunucusuna ulaşılamadı. Nexus bağlantısını ve ağı kontrol edip yeniden dene.');
      }
      return new Promise(function (resolve) { setTimeout(resolve, 900); }).then(once);
    }).catch(function (e) {
      if (e && e.name === 'AbortError') throw new Error('Banka sunucusu 12 saniyede yanıt vermedi. Oturum silinmedi; Tekrar dene.');
      throw e;
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (d) {
        if (!res.ok) {
          var err = (d && d.error) || {}, e = new Error(err.message || 'Banka isteği tamamlanamadı.');
          e.status = res.status; e.code = err.code; throw e;
        }
        return d;
      });
    });
  }
  function bankBoot() {
    var m = /(?:^|[#&])bank=([A-Za-z0-9_-]{20,80})/.exec(location.hash || '');
    if (!m) {
      var saved = ''; try { saved = sessionStorage.getItem('fnx.bank.session') || ''; } catch (e) {}
      if (!saved) return Promise.resolve({ state: 'gate' });
      S.bankToken = saved;
      return bankCall('GET', '/api/me', saved).then(function (me) { return { state: 'ready', token: saved, me: me }; }).catch(function (e) {
        // Yalnızca gerçekten geçersiz/sona ermiş jetonu sil. Ağ ve sunucu hatasında oturumu koru;
        // önceki sürüm her hatada token'ı siliyordu ve geçici bağlantı sorunu giriş döngüsü yaratabiliyordu.
        if (e.status === 401) {
          try { sessionStorage.removeItem('fnx.bank.session'); } catch (x) {}
          S.bankToken = '';
          return { state: 'gate' };
        }
        return { state: 'error', message: e.message || 'Banka sunucusuna ulaşılamadı.' };
      });
    }
    history.replaceState(null, '', location.pathname + location.search);
    return bankCall('POST', '/api/bank/exchange', '', { ticket: m[1] }).then(function (d) {
      S.bankToken = d.token;
      try { sessionStorage.setItem('fnx.bank.session', d.token); } catch (e) {}
      return bankCall('GET', '/api/me', d.token).then(function (me) { return { state: 'ready', token: d.token, me: me }; }).catch(function (e) {
        if (e.status === 401) { try { sessionStorage.removeItem('fnx.bank.session'); } catch (x) {} S.bankToken = ''; }
        throw e;
      });
    }).catch(function (e) {
      return { state: 'error', message: e.message || 'Banka girişi tamamlanamadı. Nexus’tan yeni bir bağlantı aç.' };
    });
  }
  function bankRequest(method, path, body) {
    var tok = S.bankToken;
    if (!tok) { try { tok = sessionStorage.getItem('fnx.bank.session') || ''; } catch (e) {} }
    if (!tok) return Promise.reject(new Error('Banka oturumu bulunamadı. Nexus hesabından yeniden açın.'));
    S.bankToken = tok; return bankCall(method, path, tok, body);
  }
  root.FNXConnect = { enabled: !!NEXUS, nexusUrl: NEXUS, boot: boot, bankBoot: bankBoot, bankRequest: bankRequest, persist: persist, marketTicket: marketTicket, exit: exit, launchUrl: launchUrl, state: S };
})(window);
