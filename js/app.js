/* Forevye Nexus — banka arayüzü (ana sayfa, kartım, yer tutucu bölümler) ve yönlendirme. */
(function (root) {
  'use strict';
  const R = root.FNXRules, X = root.FNXRender, T = root.FNXTemplates;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = X.esc;

  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  /* Sistem kaydı: kart numarası, güvenlik kodu, son kullanma. Bu sürümde yerel üretilir;
     sunucu aşamasında Worker atar ve istemci hiçbir koşulda değiştiremez. Gerçek ödeme verisi değildir. */
  function rnd(n) {
    const a = new Uint8Array(n); (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return Array.from(a, v => v % 10).join('');
  }
  function systemRecord() {
    let s = store.get('fnx.system', null);
    if (!s || !s.cardNumber) {
      const n = '9' + rnd(15), now = new Date();
      s = {
        cardNumber: n.replace(/(\d{4})(?=\d)/g, '$1 '), cvv: rnd(3), bankName: 'FOREVYE NEXUS', status: 'Aktif',
        expiry: ('0' + (now.getMonth() + 1)).slice(-2) + '/' + String((now.getFullYear() + 5) % 100)
      };
      store.set('fnx.system', s);
    }
    if (!s.cardToken) {   // v3: kartta kod ve QR görünsün diye yerel demo kimliği
      const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', pick = () => Array.from({ length: 4 }, () => al[Math.floor(Math.random() * al.length)]).join('');
      s.cardToken = 'NXC-' + pick() + '-' + pick(); s.last4 = s.cardToken.slice(-4); store.set('fnx.system', s);
    }
    return s;
  }
  function savedDesign() {
    const d = store.get('fnx.design', null);
    if (d) { const v = R.validateDesign(d); if (v.ok) return v.design; }
    return T.get('classic');
  }
  function draftDesign(saved) {
    const dr = store.get('fnx.draft', null);
    if (!dr || !dr.design || !Array.isArray(dr.design.layers)) return null;
    return JSON.stringify(dr.design) === JSON.stringify(saved) ? null : dr.design;
  }

  let toastTimer;
  root.FNXToast = function (msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  };

  const fmt = n => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function titleCase(s) {
    return String(s).toLocaleLowerCase('tr-TR').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('tr-TR'));
  }

  /* ---------- sayfalar ---------- */
  const W = root.FNXWallet, marketUrl = () => String((root.FNX_CONFIG || {}).MARKET_URL || '').replace(/\/+$/, '');
  // Bakiye ve hareketler market ile ortak FN cüzdanından gelir (sunucu bağlanınca Nexus'tan okunacak).
  const TX_DEMO = [
    { t: 'Mağaza — Zırh paketi', a: -450, d: 'Bugün' },
    { t: 'Görev ödülü', a: 1200, d: 'Dün' },
    { t: 'Takas — eşya satışı', a: 320, d: '18 Kasım' },
    { t: 'Mağaza — Efekt paketi', a: -180, d: '16 Kasım' }
  ];

  function cardBlock(design, sys, prefix) {
    return `<div class="tilt" data-tilt>${X.cardSvg(design, sys, { prefix })}</div>`;
  }

  function txList() {
    const l = W.ledger().slice(0, 6).map(x => ({ t: 'Mağaza — ' + x.name, a: x.amount, d: new Date(x.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) }));
    return l.length ? l : TX_DEMO;
  }
  function renderHome(ctx) {
    const name = titleCase(ctx.design.userDisplayName);
    return `<header class="page-h"><h1>Hoş geldin, ${esc(name)}</h1><p class="muted">Sanal hesabın aktif.</p></header>
    <div class="home-grid">
      <section class="hero">
        ${cardBlock(ctx.design, ctx.sys, 'd')}
        <div class="row"><a class="btn primary" href="#/editor">Kartını tasarla</a><a class="btn" href="#/card">Kart bilgileri</a></div>
      </section>
      <section class="panel balance">
        <p class="muted">Sanal bakiye</p>
        <p class="amount">${fmt(W.balance())} <span>FN</span></p>
        <p class="note">Oyun içi para birimi FN ile gösterilir; gerçek para veya banka mevduatı değildir.</p>
        <div class="row"><button class="btn" type="button" disabled>Gönder · yakında</button>${marketUrl() ? `<a class="btn" href="${esc(marketUrl())}/">Mağaza</a>` : '<button class="btn" type="button" disabled>Mağaza</button>'}</div>
      </section>
      <section class="panel tx">
        <h2 class="panel-h">Son hareketler</h2>
        <ul class="txlist">${txList().map(x => `<li><span><b>${esc(x.t)}</b><small>${x.d}</small></span><span class="${x.a < 0 ? 'neg' : 'pos'}">${x.a < 0 ? '−' : '+'}${fmt(Math.abs(x.a))} FN</span></li>`).join('')}</ul>
        <p class="note">Mağaza alışverişlerin burada görünür. Sunucu bağlanınca bakiye ve kayıtlar Nexus'tan gelecek.</p>
      </section>
    </div>`;
  }

  // Kart yüzeyleri: market'ten satın alınanlar takılır; alınmamışlar kilitli görünür ve mağazaya götürür.
  function skinsBlock() {
    const eq = W.equipped(), mk = marketUrl();
    const items = root.FNXSkins.list.map(s => {
      const own = W.owns(s.id), prev = X.cardSvg(Object.assign({}, ctx.design), { last4: 'PREV', skin: s.id, skinSerial: '001/500' }, { prefix: 'sk' + s.id, animate: false });
      const act = own ? `<button class="btn sm${eq === s.id ? '' : ' primary'}" type="button" data-skin="${eq === s.id ? '' : s.id}">${eq === s.id ? 'Çıkar' : 'Kartıma tak'}</button>`
        : (mk ? `<a class="btn sm" href="${esc(mk)}/#/p/p_card_${s.id}">🔒 ${s.price} FN · Mağazada</a>` : `<span class="note">${s.price} FN</span>`);
      return `<div class="skin${eq === s.id ? ' on' : ''}${own ? '' : ' locked'}">${prev}<b>${esc(s.n)}</b><small>${esc(s.d)}</small>${act}</div>`;
    }).join('');
    return `<section class="panel skins"><h2 class="panel-h">Kart yüzeylerim</h2><div class="skin-grid">${items}</div><p class="note">Yüzey takılıyken kart onunla çizilir; kendi tasarımın silinmez, yüzeyi çıkarınca geri gelir.</p></section>`;
  }
  function renderCardPage(ctx) {
    const s = ctx.sys;
    return `<header class="page-h"><h1>Kartım</h1><p class="muted">Görünümü sen tasarlarsın; kimlik bilgilerini sistem belirler.</p></header>
    <div class="card-page">
      <section class="hero">${cardBlock(ctx.design, s, 'd')}
        <div class="row"><a class="btn primary" href="#/editor">Kartını tasarla</a></div></section>
      <section class="panel details">
        <h2 class="panel-h">Kart bilgileri</h2>
        <dl>
          <div><dt>Kart numarası</dt><dd><span id="d-num" class="mono" data-v="${esc(s.cardNumber)}">${esc(maskNum(s.cardNumber))}</span><button class="btn sm" type="button" data-reveal="num" aria-pressed="false">Göster</button></dd></div>
          <div><dt>Son kullanma</dt><dd class="mono">${esc(s.expiry)}</dd></div>
          <div><dt>Güvenlik kodu</dt><dd><span id="d-cvv" class="mono" data-v="${esc(s.cvv)}">•••</span><button class="btn sm" type="button" data-reveal="cvv" aria-pressed="false">Göster</button></dd></div>
          <div><dt>Durum</dt><dd>${esc(s.status)}</dd></div>
          <div><dt>Banka</dt><dd>${esc(s.bankName)}</dd></div>
        </dl>
        <p class="note">Bu alanlar sistem tarafından atanır ve kart editöründen değiştirilemez. Oyun içi temsili bilgilerdir; gerçek ödemede kullanılamaz.</p>
      </section>
    </div>${skinsBlock()}`;
  }
  const maskNum = n => n.replace(/\d(?=.*\d{4}$)/g, '•');

  function renderSoon(title, text) {
    return `<header class="page-h"><h1>${title}</h1></header><section class="panel soon"><p>${text}</p><a class="btn" href="#/home">Ana sayfaya dön</a></section>`;
  }

  const PAGES = {
    home: renderHome, card: renderCardPage,
    activity: () => renderSoon('Hareketler', 'Bakiye ve satın alma hareketleri sanal ekonomi aşamasında burada listelenecek.'),
    store: () => renderSoon('Mağaza', 'Hazır kart tasarımları Nexus Market’te FN ile satılır; satın aldıkların kart editöründe Şablonlar sekmesinde açılır.').replace('<a class="btn" href="#/home">', (marketUrl() ? `<a class="btn primary" href="${esc(marketUrl())}/">Mağazaya git</a> ` : '') + '<a class="btn" href="#/home">'),
    settings: () => renderSoon('Ayarlar', 'Hesap, e-posta girişi ve güvenlik ayarları hesap aşamasında eklenecek.')
  };

  /* ---------- yönlendirme ---------- */
  const ctx = { sys: null, base: null, design: null };
  function withSkin(base) { const id = W.equipped(); return id ? Object.assign({}, base, { skin: id, skinSerial: '' }) : base; }
  function route() {
    const name = (location.hash || '#/home').replace(/^#\/?/, '').split('?')[0] || 'home';
    const app = $('#view-app'), ed = $('#view-editor');
    if (name === 'editor') {
      const saved = savedDesign();
      app.hidden = true; ed.hidden = false; document.body.classList.add('in-editor');
      root.FNXEditor.open({
        saved, draft: draftDesign(saved), system: ctx.base,
        onSave: d => { ctx.design = d; },
        onExit: () => { location.hash = '#/home'; }
      });
      return;
    }
    root.FNXEditor.close();
    ed.hidden = true; app.hidden = false; document.body.classList.remove('in-editor');
    const key = PAGES[name] ? name : 'home';
    ctx.design = savedDesign();
    ctx.sys = withSkin(ctx.base);
    $('#page').innerHTML = PAGES[key](ctx);
    document.querySelectorAll('[data-route]').forEach(a => {
      if (a.dataset.route === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = (key === 'home' ? 'Ana sayfa' : key === 'card' ? 'Kartım' : $('#page h1').textContent) + ' · Forevye Nexus';
    window.scrollTo(0, 0); bindPage();
  }

  function bindPage() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-tilt]').forEach(t => {
      if (reduce) return;
      t.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        t.style.transform = `perspective(1000px) rotateY(${(x * 9).toFixed(2)}deg) rotateX(${(-y * 9).toFixed(2)}deg)`;
      });
      t.addEventListener('pointerleave', () => { t.style.transform = ''; });
    });
    document.querySelectorAll('[data-skin]').forEach(b => b.addEventListener('click', () => { W.equip(b.dataset.skin); route(); }));
    document.querySelectorAll('[data-reveal]').forEach(b => {
      let timer;
      b.addEventListener('click', () => {
        const k = b.dataset.reveal, span = $(k === 'num' ? '#d-num' : '#d-cvv');
        const show = b.getAttribute('aria-pressed') !== 'true';
        const hide = () => { span.textContent = k === 'num' ? maskNum(span.dataset.v) : '•••'; b.setAttribute('aria-pressed', 'false'); b.textContent = 'Göster'; };
        clearTimeout(timer);
        if (show) { span.textContent = span.dataset.v; b.setAttribute('aria-pressed', 'true'); b.textContent = 'Gizle'; timer = setTimeout(hide, 10000); }
        else hide();
      });
    });
  }

  /* ---------- Nexus'a bağlı mod: yalnızca kart editörü ---------- */
  function showGate(title, text, linkText, href, retry) {
    $('#view-app').hidden = true; $('#view-editor').hidden = true;
    const g = $('#view-gate'); g.hidden = false;
    g.innerHTML = `<div class="gate-card"><span class="brand-icon">${X.iconSvg('')}</span><h1>${esc(title)}</h1><p>${esc(text)}</p>` +
      (retry ? '<button class="btn primary" id="gate-retry" type="button">Tekrar dene</button>' : '') +
      (href ? `<a class="btn${retry ? '' : ' primary'}" href="${esc(href)}">${esc(linkText)}</a>` : '') +
      `<p class="note">Giriş, Nexus'ta FOREVYE ID ile yapılır; parolan bu sayfaya hiç gelmez.</p></div>`;
    if (retry) $('#gate-retry').addEventListener('click', () => location.reload());
  }
  function openConnected(payload) {
    const C = root.FNXConnect;
    if (W) W.mergeOwned(payload.owned_skins);   // sunucu satın alınan yüzeyleri verirse Kartım'da açılır
    const isNew = !payload.card;
    const saved = isNew ? payload.base_design : payload.card.design;
    const tok = payload.card ? payload.card.card_token : '';
    const key = 'fnx.draft.' + (payload.card ? payload.card.id : 'new');
    document.body.classList.add('in-editor'); $('#view-app').hidden = true; $('#view-gate').hidden = true; $('#view-editor').hidden = false;
    let draft = null;
    const dr = store.get(key, null);
    if (dr && dr.design && Array.isArray(dr.design.layers) && JSON.stringify(dr.design) !== JSON.stringify(saved)) draft = dr.design;
    root.FNXEditor.open({
      saved, draft, isNew, system: { last4: tok ? tok.slice(-4) : '••••', cardToken: tok }, draftKey: key,
      persist: C.persist, onExit: C.exit
    });
  }
  function startConnected() {
    const C = root.FNXConnect;
    $('#side-icon').innerHTML = X.iconSvg('');
    C.boot().then(r => {
      if (r.state === 'ready') return openConnected(r.payload);
      if (r.state === 'error') return showGate('Editör açılamadı', r.message, 'Nexus\'a dön ve yeniden aç', C.launchUrl(), !!r.offline);
      showGate('Kart editörü', 'Kartını tasarlamak için önce Nexus\'ta giriş yapmalısın.', 'Nexus\'ta giriş yap', C.launchUrl());
    });
  }

  function start() {
    if (root.FNXConnect && root.FNXConnect.enabled) return startConnected();
    ctx.base = systemRecord(); ctx.sys = withSkin(ctx.base);
    $('#side-icon').innerHTML = X.iconSvg('');
    window.addEventListener('hashchange', route);
    route();
  }
  start();
})(window);
