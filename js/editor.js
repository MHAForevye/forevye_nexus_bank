/* Forevye Nexus — kart editörü.
 * Kilitli alanlar (çip, banka adı/logosu, sistem bilgileri) editörde düzenlenebilir değildir.
 * Burada uygulanan her kontrol yalnızca deneyim içindir; asıl doğrulama sunucuda
 * (FNXRules.validateDesign) yapılmalıdır. */
(function (root) {
  'use strict';
  const R = root.FNXRules, L = root.FNXLib, T = root.FNXTemplates, X = root.FNXRender;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = v => Math.round(v * 10) / 10;
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = X.esc;
  const toast = m => root.FNXToast && root.FNXToast(m);

  const ICON = {
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'
  };
  const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  const LIB_TABS = [['tpl', 'Şablonlar'], ['bg', 'Zemin'], ['shape', 'Şekiller'], ['pattern', 'Desenler'], ['fx', 'Efekt'], ['chip', 'Çip']];

  const E = {
    active: false, bound: false, design: null, saved: null, savedJson: '', system: null, sel: null,
    undo: [], redo: [], drag: null, guides: [], zones: false, preview: false, tab: 'tpl',
    lastKey: null, lastT: 0, draftTimer: null, errors: [], before: null, opts: null, layerDrag: null
  };
  let el = {};

  const getL = id => E.design.layers.find(l => l.id === id);
  const selL = () => (E.sel && E.sel !== 'name' ? getL(E.sel) : null);
  const isDirty = () => JSON.stringify(E.design) !== E.savedJson;

  /* ---------- geçmiş (geri al / yinele) ---------- */
  function snap(key) {
    const now = Date.now();
    if (key && E.lastKey === key && now - E.lastT < 900) { E.lastT = now; return; }
    E.undo.push(JSON.stringify(E.design));
    if (E.undo.length > 100) E.undo.shift();
    E.redo = []; E.lastKey = key || null; E.lastT = now;
  }
  function undo() {
    if (!E.undo.length) return;
    E.redo.push(JSON.stringify(E.design)); E.design = JSON.parse(E.undo.pop());
    afterHistory();
  }
  function redo() {
    if (!E.redo.length) return;
    E.undo.push(JSON.stringify(E.design)); E.design = JSON.parse(E.redo.pop());
    afterHistory();
  }
  function afterHistory() {
    E.lastKey = null;
    if (E.sel && E.sel !== 'name' && !getL(E.sel)) E.sel = null;
    el.name.value = E.design.userDisplayName;
    fullChanged();
  }

  /* ---------- durum, taslak ---------- */
  function setStatus(kind, text) { el.status.dataset.state = kind; el.status.textContent = text; }
  function scheduleDraft() { clearTimeout(E.draftTimer); E.draftTimer = setTimeout(saveDraft, 700); }
  function saveDraft() {
    if (!E.active) return;
    try {
      localStorage.setItem('fnx.draft', JSON.stringify({ design: E.design, savedAt: Date.now() }));
      const t = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setStatus('draft', 'Taslak kaydedildi ' + t + (navigator.onLine ? '' : ' · çevrimdışı'));
    } catch (e) { setStatus('error', 'Taslak kaydedilemedi — tarayıcı depolaması kullanılamıyor'); }
  }
  function clearDraft() { clearTimeout(E.draftTimer); try { localStorage.removeItem('fnx.draft'); } catch (e) {} }

  function renderMsg() {
    const t = X.tone(E.design);
    let html = '';
    if (E.errors.length) html += '<ul class="errs">' + E.errors.map(m => `<li>${esc(m)}</li>`).join('') + '</ul>';
    else if (X.contrast(t.name, t.avg) < 3) html = '<p class="warn">Ad rengi zemine göre okunaksız olabilir. Daha belirgin bir renk seç.</p>';
    el.msg.innerHTML = html;
  }
  function stageChanged() {
    renderStage(); renderMsg();
    el.undo.disabled = !E.undo.length; el.redo.disabled = !E.redo.length;
    if (isDirty()) { setStatus('dirty', 'Kaydedilmemiş değişiklik var'); scheduleDraft(); }
    else { setStatus('saved', 'Kaydedildi · sürüm ' + E.saved.version); clearDraft(); }
  }
  function fullChanged() { stageChanged(); renderProps(); renderLayers(); renderLib(); }
  function renderAll() { E.errors = []; fullChanged(); el.nameCount.textContent = Array.from(E.design.userDisplayName).length + '/' + R.NAME_LIMITS.max; }

  /* ---------- sahne ---------- */
  function toSvg(e) {
    const pt = el.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(el.svg.getScreenCTM().inverse());
    return { x: q.x, y: q.y };
  }
  function renderStage() {
    let m = X.renderCard(E.design, E.system, { prefix: 'ed', interactive: true });
    if (!E.preview) m += overlay();
    el.svg.innerHTML = m;
    el.canvas.classList.toggle('preview', E.preview);
  }
  function overlay() {
    const sc = (el.svg.getBoundingClientRect().width || 856) / 856;
    const hr = clamp(11 / sc, 8, 30), off = clamp(36 / sc, 26, 90);
    let o = '<g class="ov">';
    if (E.zones || E.drag) {
      R.ZONES.forEach(z => { o += `<rect class="zone" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10"/>`; });
    }
    E.guides.forEach(g => { o += g.x != null ? `<path class="guide" d="M${g.x} 0V540"/>` : `<path class="guide" d="M0 ${g.y}H856"/>`; });
    const l = selL();
    if (E.sel === 'bg') o += '<rect class="selbox" x="3" y="3" width="850" height="534" rx="34"/>';
    else if (E.sel === 'name') { const a = R.NAME_AREA; o += `<rect class="selbox" x="${a.x - 10}" y="${a.y}" width="${a.w}" height="${a.h}" rx="10"/>`; }
    else if (l && l.visible) {
      const p = l.properties, cx = p.width / 2, cy = p.height / 2, bad = E.drag && E.drag.invalid;
      o += `<g transform="translate(${p.x} ${p.y}) rotate(${p.rotation} ${cx} ${cy})">` +
        `<rect class="selbox${bad ? ' bad' : ''}${l.locked ? ' lockd' : ''}" width="${p.width}" height="${p.height}"/>`;
      if (!l.locked) {
        o += `<path class="selbox" d="M${cx} 0V${-off}"/>`;
        [['nw', 0, 0], ['ne', p.width, 0], ['se', p.width, p.height], ['sw', 0, p.height]].forEach(h => {
          o += `<circle class="handle h-${h[0]}" data-h="${h[0]}" cx="${h[1]}" cy="${h[2]}" r="${hr}"/>`;
        });
        o += `<circle class="handle rot" data-h="rot" cx="${cx}" cy="${-off}" r="${hr}"/>`;
      }
      o += '</g>';
    }
    return o + '</g>';
  }

  function select(id) {
    E.sel = id;
    renderStage(); renderProps(); renderLayers();
  }

  /* ---------- işaretçi: taşı, boyutlandır, döndür ---------- */
  function onDown(e) {
    if (E.preview || (e.button != null && e.button > 0)) return;
    const hEl = e.target.closest && e.target.closest('[data-h]');
    const l = selL();
    if (hEl && l && !l.locked) { begin(hEl.dataset.h, e); return; }
    if (e.target.closest && e.target.closest('[data-sys]')) { toast('Bu alan sistem tarafından korunuyor ve değiştirilemez.'); return; }
    const g = e.target.closest && e.target.closest('[data-id]');
    if (!g) { select(null); return; }
    const id = g.dataset.id;
    select(id);
    const nl = getL(id);
    if (nl && nl.type !== 'background') {
      if (nl.locked) { toast('Bu katman kilitli. Katman panelinden kilidi açabilirsin.'); return; }
      begin('move', e);
    }
  }
  function begin(mode, e) {
    const l = selL(); if (!l) return;
    E.drag = { mode, id: l.id, start: toSvg(e), orig: clone(l.properties), moved: false, pushed: false, invalid: false };
    try { el.svg.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  function onMove(e) {
    const d = E.drag; if (!d) return;
    const l = getL(d.id); if (!l) return;
    const p = l.properties, o = d.orig, pt = toSvg(e);
    const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 2) return;
      d.moved = true; snap(); d.pushed = true;
    }
    E.guides = [];
    if (d.mode === 'move') {
      let nx = o.x + dx, ny = o.y + dy;
      const bb = R.bbox({ x: nx, y: ny, width: o.width, height: o.height, rotation: o.rotation });
      if (Math.abs(bb.cx - 428) < 6) { nx += 428 - bb.cx; E.guides.push({ x: 428 }); }
      else if (Math.abs(bb.l - 40) < 6) { nx += 40 - bb.l; E.guides.push({ x: 40 }); }
      else if (Math.abs(bb.r - 816) < 6) { nx += 816 - bb.r; E.guides.push({ x: 816 }); }
      if (Math.abs(bb.cy - 270) < 6) { ny += 270 - bb.cy; E.guides.push({ y: 270 }); }
      else if (Math.abs(bb.t - 40) < 6) { ny += 40 - bb.t; E.guides.push({ y: 40 }); }
      else if (Math.abs(bb.b - 500) < 6) { ny += 500 - bb.b; E.guides.push({ y: 500 }); }
      p.x = r1(nx); p.y = r1(ny);
    } else if (d.mode === 'rot') {
      const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
      let a = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI + 90;
      a = ((a + 540) % 360) - 180;
      const near = Math.round(a / 15) * 15;
      if (e.shiftKey || Math.abs(a - near) < 3) a = near;
      p.rotation = r1(a);
    } else {
      const cx = o.x + o.width / 2, cy = o.y + o.height / 2, ang = -o.rotation * Math.PI / 180;
      const vx = pt.x - cx, vy = pt.y - cy;
      const lx = vx * Math.cos(ang) - vy * Math.sin(ang), ly = vx * Math.sin(ang) + vy * Math.cos(ang);
      let w = Math.max(8, Math.abs(lx) * 2), h = Math.max(8, Math.abs(ly) * 2);
      if (p.lockRatio) { const s = Math.max(w / o.width, h / o.height); w = o.width * s; h = o.height * s; }
      p.width = r1(clamp(w, 8, 1500)); p.height = r1(clamp(h, 8, 1500));
      p.x = r1(cx - p.width / 2); p.y = r1(cy - p.height / 2);
    }
    d.invalid = !!R.violation(l);
    stageChanged(); syncInputs();
  }
  function onUp() {
    const d = E.drag; if (!d) return;
    E.drag = null; E.guides = [];
    const l = getL(d.id);
    if (l && d.moved && R.violation(l)) {
      if (R.pushOut(l)) { toast('Korumalı alana denk geldiği için nesne güvenli konuma alındı.'); }
      else {
        l.properties = d.orig; if (d.pushed) E.undo.pop();
        toast('Bu alanın üstüne yerleştirilemez. Nesne eski yerine döndü.');
      }
    }
    fullChanged();
  }

  /* ---------- parça ekleme ve uygulama ---------- */
  function addShape(kind) {
    if (E.design.layers.length - 1 >= R.MAX_LAYERS) { toast('Katman sınırına ulaştın (en fazla ' + R.MAX_LAYERS + ').'); return; }
    const sz = L.SIZES[kind], so = R.STROKE_ONLY.has(kind);
    const col = X.tone(E.design).dark ? '#C9CFDD' : '#59607A';
    const l = T.sh(kind, 428 - sz[0] / 2, 270 - sz[1] / 2, sz[0], sz[1], {
      fill: so ? 'none' : col, stroke: so ? col : 'none', strokeWidth: so ? (sz[2] || 3) : 0, lockRatio: !!L.LOCK_RATIO[kind]
    });
    if (R.violation(l) && !R.pushOut(l)) { toast('Bu parça için güvenli boş alan bulunamadı.'); return; }
    snap(); E.design.layers.push(l); E.sel = l.id; fullChanged();
  }
  function applyBg(i) {
    const b = L.BACKGROUNDS[i], p = X.bgLayer(E.design).properties;
    snap(); p.mode = b.mode; p.colors = b.c.slice(); if (b.a != null) p.angle = b.a;
    fullChanged();
  }
  function applyTemplate(id) {
    if (E.design.layers.length > 1 && !confirm('Şablonu uygulayınca şu anki dekorasyonların değişir. Geri alabilirsin. Devam edilsin mi?')) return;
    const d = T.get(id), c = E.design;
    d.designId = c.designId; d.ownerId = c.ownerId; d.version = c.version;
    d.userDisplayName = c.userDisplayName; d.nameStyle = clone(c.nameStyle); d.chipStyle = c.chipStyle;
    snap(); E.design = d; E.sel = null; fullChanged();
  }

  function commitCheck(l, before) {
    if (!R.violation(l)) return;
    if (R.pushOut(l)) toast('Korumalı alana denk geldiği için nesne güvenli konuma alındı.');
    else { l.properties = before; toast('Bu değişiklik korumalı alanı kapatacağı için geri alındı.'); }
  }

  /* ---------- katman işlemleri ---------- */
  function act(name, id, v) {
    const ls = E.design.layers, i = ls.findIndex(l => l.id === id), l = ls[i];
    if (!l || l.type === 'background') return;
    const before = clone(l.properties);
    switch (name) {
      case 'front': if (i === ls.length - 1) return; snap(); ls.splice(i, 1); ls.push(l); break;
      case 'fwd': if (i >= ls.length - 1) return; snap(); [ls[i], ls[i + 1]] = [ls[i + 1], ls[i]]; break;
      case 'bwd': if (i <= 1) return; snap(); [ls[i], ls[i - 1]] = [ls[i - 1], ls[i]]; break;
      case 'back': if (i <= 1) return; snap(); ls.splice(i, 1); ls.splice(1, 0, l); break;
      case 'vis': snap(); l.visible = !l.visible; break;
      case 'lock': snap(); l.locked = !l.locked; break;
      case 'flipx': if (l.locked) return; snap(); l.properties.flipX = !l.properties.flipX; break;
      case 'flipy': if (l.locked) return; snap(); l.properties.flipY = !l.properties.flipY; break;
      case 'rotby': case 'rotto':
        if (l.locked) return; snap();
        l.properties.rotation = r1(((((name === 'rotby' ? l.properties.rotation + v : v) + 540) % 360) - 180));
        commitCheck(l, before); break;
      case 'del': snap(); ls.splice(i, 1); if (E.sel === id) E.sel = null; break;
      case 'dup': {
        if (ls.length - 1 >= R.MAX_LAYERS) { toast('Katman sınırına ulaştın.'); return; }
        const c = clone(l); c.id = T.uid(); c.name = (l.name + ' kopya').slice(0, 24); c.locked = false;
        c.properties.x += 24; c.properties.y += 24;
        if (R.violation(c) && !R.pushOut(c)) { c.properties.x -= 24; c.properties.y -= 24; }
        snap(); ls.splice(i + 1, 0, c); E.sel = c.id; break;
      }
    }
    fullChanged();
  }

  /* ---------- sol panel: kütüphane ---------- */
  function previewSvg(kind, color) {
    const so = R.STROKE_ONLY.has(kind);
    return `<svg viewBox="-4 -4 108 108" aria-hidden="true">${X.shapeInner(kind, { fill: so ? 'none' : color, stroke: so ? color : 'none', strokeWidth: so ? 3 : 0, effects: [] })}</svg>`;
  }
  function renderLib() {
    el.tabs.innerHTML = LIB_TABS.map(t => `<button type="button" role="tab" data-ltab="${t[0]}" aria-selected="${E.tab === t[0]}">${t[1]}</button>`).join('');
    const bp = X.bgLayer(E.design).properties; let h = '';
    if (E.tab === 'tpl') {
      h = '<div class="tpl-grid">' + R.TEMPLATES.map(id => {
        const d = T.get(id); d.userDisplayName = E.design.userDisplayName; d.chipStyle = E.design.chipStyle;
        const m = T.META[id];
        return `<button type="button" class="tpl${E.design.template === id ? ' on' : ''}" data-tpl="${id}">${X.cardSvg(d, E.system, { prefix: 't' + id })}<b>${m.n}</b><small>${m.d}</small></button>`;
      }).join('') + '</div><p class="muted pad">Şablonlar başlangıç noktasıdır. Banka kimliği, çip ve sistem bilgileri her şablonda kilitlidir.</p>';
    } else if (E.tab === 'bg') {
      h = '<div class="sw-grid">' + L.BACKGROUNDS.map((b, i) => {
        const css = b.mode === 'solid' ? b.c[0] : `linear-gradient(${b.a || 135}deg,${b.c.join(',')})`;
        return `<button type="button" class="sw" data-bgp="${i}" style="background:${css}" title="${b.n}" aria-label="${b.n}"></button>`;
      }).join('') + '</div><p class="muted pad">Renkleri ince ayarlamak için kart zeminini sahnede seç.</p>';
    } else if (E.tab === 'shape' || E.tab === 'pattern') {
      const kinds = E.tab === 'shape' ? L.SHAPE_KINDS : L.PATTERN_KINDS;
      const col = X.tone(E.design).dark ? '#C9CFDD' : '#59607A';
      h = '<div class="item-grid">' + kinds.map(k => `<button type="button" class="item" data-add="${k}">${previewSvg(k, col)}<span>${L.LABELS[k]}</span></button>`).join('') + '</div>';
    } else if (E.tab === 'fx') {
      h = '<div class="list">' + L.FINISHES.map(f => `<button type="button" class="opt${bp.finish === f.id ? ' on' : ''}" data-finish="${f.id}"><b>${f.n}</b><small>${f.d}</small></button>`).join('') +
        '</div><p class="muted pad">Gölge, kabartma ve buzlu cam efektleri seçili nesnenin özelliklerinde. Efektler okunabilirliği bozamaz: logo, ad ve kart bilgileri her zaman üstte kalır.</p>';
    } else if (E.tab === 'chip') {
      h = '<div class="list">' + L.CHIPS.map(c => {
        const d = clone(E.design); d.chipStyle = c.id;
        return `<button type="button" class="opt chip${E.design.chipStyle === c.id ? ' on' : ''}" data-chip="${c.id}"><svg viewBox="0 0 130 100" aria-hidden="true"><defs></defs>${X.renderCard ? chipSvg(c.id) : ''}</svg><b>${c.n}</b></button>`;
      }).join('') + '</div><p class="muted pad">Çipin konumu ve koruma alanı sabittir. Yalnızca sistemin sunduğu görünümlerden biri seçilebilir.</p>';
    }
    el.lib.innerHTML = h;
  }
  function chipSvg(style) {
    const id = 'cp' + style;
    const st = { gold: ['#F6DC95', '#C9993F', '#EBCB78'], silver: ['#F1F3F8', '#A5ABBA', '#DDE1EA'], rose: ['#F3C9A7', '#B5744B', '#E7B28A'] }[style];
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${st[0]}"/><stop offset=".5" stop-color="${st[1]}"/><stop offset="1" stop-color="${st[2]}"/></linearGradient>` +
      `<rect x="9" y="6" width="112" height="88" rx="15" fill="url(#${id})" stroke="rgba(0,0,0,.55)" stroke-width="2.5"/>` +
      '<g stroke="rgba(0,0,0,.42)" stroke-width="2" fill="none"><rect x="45" y="32" width="40" height="36" rx="9"/><path d="M9 36H45M85 36H121M9 64H45M85 64H121M65 6V32M65 68V94"/></g>';
  }

  /* ---------- sağ panel: özellikler ---------- */
  const numField = (label, k, v, min, max, step, dis) =>
    `<label class="f"><span>${label}</span><input type="number" data-k="${k}" value="${r1(v)}" min="${min}" max="${max}" step="${step}" inputmode="decimal"${dis}></label>`;
  const colorField = (label, key, val, dis, noneOk) =>
    `<div class="f color"><span>${label}</span><input type="color" data-c="${key}" value="${val === 'none' ? '#ffffff' : val.toLowerCase()}" aria-label="${label}"${dis}>` +
    (noneOk ? `<label class="mini"><input type="checkbox" data-none="${key}"${val === 'none' ? ' checked' : ''}${dis}> Yok</label>` : '') + '</div>';
  const seg = (items, cur, attr) => '<div class="seg" role="group">' + items.map(i => `<button type="button" data-${attr}="${i[0]}" aria-pressed="${cur === i[0]}">${i[1]}</button>`).join('') + '</div>';

  function renderProps() {
    const box = el.props, l = selL();
    if (E.sel === 'name') { box.innerHTML = nameProps(); return; }
    if (!l) { box.innerHTML = '<p class="muted pad">Sahnede bir nesne seç ya da soldan parça ekle. Kartın adı, çipi, logosu ve kart bilgileri sistem tarafından korunur.</p>'; return; }
    box.innerHTML = l.type === 'background' ? bgProps(l) : shapeProps(l);
  }
  function nameProps() {
    const cur = E.design.nameStyle.color, t = X.tone(E.design), ratio = X.contrast(t.name, t.avg);
    return '<h3 class="panel-h">Ad rengi</h3><div class="sw-row">' +
      `<button type="button" class="chipbtn${cur === 'auto' ? ' on' : ''}" data-ncolor="auto">Otomatik</button>` +
      L.NAME_COLORS.map(c => `<button type="button" class="sw sm${cur.toLowerCase() === c.toLowerCase() ? ' on' : ''}" data-ncolor="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') +
      '</div>' + colorField('Özel renk', 'ncustom', t.name, '', false) +
      `<p class="${ratio < 3 || t.nameFallback ? 'warn' : 'muted'} pad">Okunabilirlik: ${ratio.toFixed(1)}:1${ratio < 3 ? ' — düşük' : ''}</p>` +
      (t.nameFallback ? '<p class="warn pad">Seçtiğin renk zeminde okunamadığı için otomatik renk kullanılıyor. Kaydetmek için okunaklı bir renk seç.</p>' : '') +
      '<p class="muted pad">Adın konumu ve güvenli alanı sistem tarafından sabitlenir; uzun adlar otomatik küçülür.</p>';
  }
  function bgProps(l) {
    const p = l.properties;
    let h = '<h3 class="panel-h">Kart zemini</h3>' + seg([['solid', 'Düz'], ['gradient', 'Gradient']], p.mode, 'bgmode');
    h += '<div class="colors">' + p.colors.map((c, i) => colorField('Renk ' + (i + 1), 'bgc' + i, c, '', false)).join('') + '</div>';
    if (p.mode === 'gradient') {
      h += '<div class="row">' + (p.colors.length < 3 ? '<button type="button" class="btn sm" data-bgadd="1">Renk ekle</button>' : '') +
        (p.colors.length > 2 ? '<button type="button" class="btn sm" data-bgadd="-1">Rengi çıkar</button>' : '') + '</div>';
      h += `<label class="f"><span>Açı</span><input type="range" min="0" max="360" step="5" value="${p.angle}" data-bga aria-label="Gradient açısı"><output>${Math.round(p.angle)}°</output></label>`;
    }
    h += '<h3 class="panel-h">Yüzey</h3>' + seg(L.FINISHES.map(f => [f.id, f.n]), p.finish, 'finishp');
    return h + '<p class="muted pad">Zemin kilitlidir: silinemez ve taşınamaz; yalnızca rengi ve yüzeyi değişir.</p>';
  }
  function shapeProps(l) {
    const p = l.properties, dis = l.locked ? ' disabled' : '', so = R.STROKE_ONLY.has(p.kind), nex = p.kind === 'nexus';
    let h = `<h3 class="panel-h">${esc(l.name)}${l.locked ? ' · kilitli' : ''}</h3>`;
    h += `<label class="f wide"><span>Katman adı</span><input type="text" data-nm value="${esc(l.name)}" maxlength="24"${dis}></label>`;
    h += '<div class="grid2">' + numField('X', 'x', p.x, -1500, 2500, 1, dis) + numField('Y', 'y', p.y, -1500, 2500, 1, dis) +
      numField('Genişlik', 'width', p.width, 8, 1500, 1, dis) + numField('Yükseklik', 'height', p.height, 8, 1500, 1, dis) + '</div>';
    h += `<label class="f"><span>Dönüş</span><input type="range" min="-180" max="180" step="1" value="${p.rotation}" data-k="rotation" aria-label="Dönüş"${dis}><input type="number" class="tiny" data-k="rotation" value="${r1(p.rotation)}" min="-180" max="180"${dis}></label>`;
    h += `<div class="row"><button type="button" class="btn sm" data-act="rotby" data-v="-15"${dis}>−15°</button><button type="button" class="btn sm" data-act="rotby" data-v="15"${dis}>+15°</button><button type="button" class="btn sm" data-act="rotto" data-v="0"${dis}>0°</button><button type="button" class="btn sm" data-act="rotto" data-v="45"${dis}>45°</button><button type="button" class="btn sm" data-act="rotto" data-v="90"${dis}>90°</button></div>`;
    h += `<label class="f"><span>Opaklık</span><input type="range" min="0" max="100" value="${Math.round(p.opacity * 100)}" data-k="opacity" aria-label="Opaklık"${dis}><output>${Math.round(p.opacity * 100)}%</output></label>`;
    if (!so) h += colorField('Dolgu', 'fill', p.fill, dis, true);
    if (!nex) h += colorField('Çizgi', 'stroke', p.stroke, dis, !so);
    if (!nex) h += numField('Çizgi kalınlığı', 'strokeWidth', p.strokeWidth, 0, 40, 0.5, dis);
    h += `<div class="row"><button type="button" class="btn sm" data-act="flipx"${dis}>Yatay çevir</button><button type="button" class="btn sm" data-act="flipy"${dis}>Dikey çevir</button></div>`;
    h += `<label class="check"><input type="checkbox" data-ratio${p.lockRatio ? ' checked' : ''}${dis}> Oranı koru</label>`;
    h += '<h3 class="panel-h">Efektler</h3><div class="row">' + L.OBJ_EFFECTS.map(f => `<label class="check"><input type="checkbox" data-fx="${f.id}"${p.effects.indexOf(f.id) >= 0 ? ' checked' : ''}${dis}> ${f.n}</label>`).join('') + '</div>';
    h += '<h3 class="panel-h">Sıralama</h3><div class="row"><button type="button" class="btn sm" data-act="front">En öne</button><button type="button" class="btn sm" data-act="fwd">Bir öne</button><button type="button" class="btn sm" data-act="bwd">Bir arkaya</button><button type="button" class="btn sm" data-act="back">En arkaya</button></div>';
    h += `<div class="row"><button type="button" class="btn sm" data-act="dup">Kopyala</button><button type="button" class="btn sm danger" data-act="del">Sil</button></div>`;
    return h;
  }
  function syncInputs() {
    const l = selL(); if (!l || l.type === 'background') return;
    const p = l.properties;
    el.props.querySelectorAll('[data-k]').forEach(i => {
      if (i === document.activeElement) return;
      const k = i.dataset.k; i.value = k === 'opacity' ? Math.round(p.opacity * 100) : r1(p[k]);
    });
  }

  function applyNum(l, k, raw) {
    const v = Number(raw); if (raw === '' || !isFinite(v)) return;
    const p = l.properties;
    if (k === 'x' || k === 'y') p[k] = clamp(v, -1500, 2500);
    else if (k === 'width' || k === 'height') {
      const val = clamp(v, 8, 1500);
      if (p.lockRatio) { const r = p.width / p.height; if (k === 'width') { p.width = val; p.height = val / r; } else { p.height = val; p.width = val * r; } }
      else p[k] = val;
    } else if (k === 'rotation') p.rotation = clamp(v, -180, 180);
    else if (k === 'opacity') p.opacity = clamp(v / 100, 0, 1);
    else if (k === 'strokeWidth') p.strokeWidth = clamp(v, 0, 40);
  }

  function onPropsInput(e) {
    const t = e.target, l = selL();
    if (t.dataset.ncustom !== undefined || t.dataset.c === 'ncustom') {
      snap('ncol'); E.design.nameStyle.color = t.value.toUpperCase(); stageChanged(); return;
    }
    if (!l) return;
    if (t.dataset.k) {
      snap('k' + l.id + t.dataset.k); applyNum(l, t.dataset.k, t.value); stageChanged(); syncInputs();
      const out = t.parentElement.querySelector('output'); if (out) out.textContent = Math.round(l.properties.opacity * 100) + '%';
    } else if (t.dataset.c) {
      const key = t.dataset.c;
      if (l.type === 'background') {
        const i = Number(key.replace('bgc', '')); snap('bgc' + i); l.properties.colors[i] = t.value.toUpperCase();
      } else { snap('c' + l.id + key); l.properties[key] = t.value.toUpperCase(); }
      stageChanged();
    } else if (t.dataset.nm !== undefined) {
      snap('nm' + l.id); l.name = t.value.replace(/[<>&"]/g, '').slice(0, 24) || 'Katman'; renderLayers();
      scheduleDraft();
    } else if (t.dataset.bga !== undefined) {
      snap('bga'); l.properties.angle = Number(t.value); const out = t.parentElement.querySelector('output'); if (out) out.textContent = Math.round(l.properties.angle) + '°';
      stageChanged();
    }
  }
  function onPropsFocus(e) {
    const l = selL(); if (l && e.target.dataset && e.target.dataset.k) E.before = clone(l.properties);
  }
  function onPropsChange(e) {
    const t = e.target, l = selL();
    if (!l) return;
    if (t.dataset.k && E.before) { commitCheck(l, E.before); E.before = null; fullChanged(); return; }
    if (t.dataset.fx) {
      snap(); const fx = l.properties.effects, i = fx.indexOf(t.dataset.fx);
      if (t.checked && i < 0) fx.push(t.dataset.fx); else if (!t.checked && i >= 0) fx.splice(i, 1);
      stageChanged(); return;
    }
    if (t.dataset.ratio !== undefined) { snap(); l.properties.lockRatio = t.checked; stageChanged(); return; }
    if (t.dataset.none) {
      snap(); const k = t.dataset.none, p = l.properties;
      if (t.checked) p[k] = 'none';
      else { p[k] = (t.parentElement.parentElement.querySelector('input[type=color]').value || '#ffffff').toUpperCase(); if (k === 'stroke' && !p.strokeWidth) p.strokeWidth = 2; }
      fullChanged();
    }
  }
  function onPropsClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const l = selL();
    if (b.dataset.ncolor) { snap(); E.design.nameStyle.color = b.dataset.ncolor === 'auto' ? 'auto' : b.dataset.ncolor.toUpperCase(); fullChanged(); return; }
    if (!l) return;
    if (b.dataset.act) { act(b.dataset.act, l.id, b.dataset.v != null ? Number(b.dataset.v) : undefined); return; }
    if (b.dataset.bgmode) { snap(); const p = l.properties; p.mode = b.dataset.bgmode; if (p.mode === 'gradient' && p.colors.length < 2) p.colors.push('#3A3F52'); fullChanged(); return; }
    if (b.dataset.bgadd) {
      snap(); const p = l.properties;
      if (b.dataset.bgadd === '1' && p.colors.length < 3) p.colors.push(p.colors[p.colors.length - 1]);
      else if (b.dataset.bgadd === '-1' && p.colors.length > 2) p.colors.pop();
      fullChanged(); return;
    }
    if (b.dataset.finishp) { snap(); l.properties.finish = b.dataset.finishp; fullChanged(); }
  }

  /* ---------- alt panel: katmanlar ---------- */
  function thumb(l) {
    const p = l.properties, col = p.fill !== 'none' ? p.fill : (p.stroke !== 'none' ? p.stroke : '#999999');
    return `<svg viewBox="-4 -4 108 108" aria-hidden="true">${X.shapeInner(p.kind, { fill: col, stroke: p.stroke !== 'none' ? p.stroke : col, strokeWidth: p.strokeWidth || 3, effects: [] })}</svg>`;
  }
  function renderLayers() {
    const ls = E.design.layers;
    let h = '<ul class="layers">';
    h += `<li class="lrow user${E.sel === 'name' ? ' sel' : ''}" data-select="name"><span class="grip off"></span><span class="lname">Kullanıcı adı</span><span class="tag">ad alanı</span></li>`;
    h += `<li class="lrow sys" aria-disabled="true"><span class="grip off"></span><span class="lname">Sistem alanları: çip, banka adı ve logosu, kart bilgileri</span><span class="tag">${ic('lock')} sistem</span></li>`;
    for (let i = ls.length - 1; i >= 1; i--) {
      const l = ls[i];
      h += `<li class="lrow dec${E.sel === l.id ? ' sel' : ''}${l.visible ? '' : ' hid'}" data-id="${l.id}" draggable="true">` +
        `<span class="grip" aria-hidden="true">${ic('grip')}</span><span class="thumb">${thumb(l)}</span><span class="lname">${esc(l.name)}</span>` +
        `<button type="button" class="ib" data-lact="vis" data-id="${l.id}" aria-label="${l.visible ? 'Gizle' : 'Göster'}" title="${l.visible ? 'Gizle' : 'Göster'}">${ic(l.visible ? 'eye' : 'eyeOff')}</button>` +
        `<button type="button" class="ib" data-lact="lock" data-id="${l.id}" aria-label="${l.locked ? 'Kilidi aç' : 'Kilitle'}" title="${l.locked ? 'Kilidi aç' : 'Kilitle'}">${ic(l.locked ? 'lock' : 'unlock')}</button>` +
        `<button type="button" class="ib" data-lact="dup" data-id="${l.id}" aria-label="Kopyala" title="Kopyala">${ic('copy')}</button>` +
        `<button type="button" class="ib" data-lact="del" data-id="${l.id}" aria-label="Sil" title="Sil">${ic('trash')}</button></li>`;
    }
    h += `<li class="lrow bgrow${E.sel === 'bg' ? ' sel' : ''}" data-id="bg" data-drop="1"><span class="grip off"></span><span class="lname">Kart zemini</span><span class="tag">${ic('lock')} kilitli</span></li>`;
    el.layers.innerHTML = h + '</ul>';
  }
  function onLayersClick(e) {
    const b = e.target.closest('[data-lact]');
    if (b) { act(b.dataset.lact, b.dataset.id); return; }
    const row = e.target.closest('.lrow'); if (!row) return;
    if (row.dataset.select) select(row.dataset.select);
    else if (row.dataset.id) select(row.dataset.id);
    else if (row.classList.contains('sys')) toast('Bu katman sistem tarafından korunuyor ve değiştirilemez.');
  }
  function onLayerDragStart(e) {
    const row = e.target.closest && e.target.closest('.dec'); if (!row) return;
    E.layerDrag = row.dataset.id; e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', row.dataset.id); } catch (x) {}
  }
  function onLayerDragOver(e) {
    if (!E.layerDrag) return;
    const row = e.target.closest('.dec,.bgrow'); if (!row) return;
    e.preventDefault();
    el.layers.querySelectorAll('.over').forEach(n => n.classList.remove('over')); row.classList.add('over');
  }
  function onLayerDrop(e) {
    const row = e.target.closest('.dec,.bgrow'); if (!row || !E.layerDrag) return;
    e.preventDefault();
    const ls = E.design.layers, from = ls.findIndex(l => l.id === E.layerDrag);
    if (from > 0 && row.dataset.id !== E.layerDrag) {
      snap(); const l = ls.splice(from, 1)[0], t = ls.findIndex(x => x.id === row.dataset.id);
      ls.splice(t + 1, 0, l); // hedefin üstüne yerleştir; zemin her zaman en altta kalır
    }
    E.layerDrag = null; fullChanged();
  }

  /* ---------- kaydet, çık, sıfırla ---------- */
  function save() {
    const res = R.validateDesign(E.design);
    if (!res.ok) { E.errors = res.errors; renderMsg(); setStatus('error', 'Kaydedilemedi — kuralları kontrol et'); return; }
    // Sunucu bağlandığında burada POST /api/card-designs çağrılır. Worker aynı validateDesign
    // kodunu çalıştırır ve yeni sürüm numarasını döner; istemcinin gönderdiği sürüme güvenilmez.
    const out = res.design; out.version = (E.saved.version || 0) + 1;
    try { localStorage.setItem('fnx.design', JSON.stringify(out)); localStorage.removeItem('fnx.draft'); }
    catch (e) { setStatus('error', 'Kayıt başarısız — tarayıcı depolaması kullanılamıyor'); return; }
    clearTimeout(E.draftTimer);
    E.design = out; E.saved = clone(out); E.savedJson = JSON.stringify(out); E.errors = [];
    fullChanged(); toast('Kartın kaydedildi.');
    if (E.opts && E.opts.onSave) E.opts.onSave(out);
  }
  function exit() {
    if (isDirty() && !confirm('Kaydedilmemiş değişikliklerin taslak olarak bu cihazda kalır. Çıkılsın mı?')) return;
    E.active = false;
    if (E.opts && E.opts.onExit) E.opts.onExit();
  }
  function reset() {
    if (!isDirty()) { toast('Kayıtlı tasarımdan farklı bir değişiklik yok.'); return; }
    if (!confirm('Son kaydedilen tasarıma dönülsün mü? Geri alabilirsin.')) return;
    snap(); E.design = clone(E.saved); E.sel = null; el.name.value = E.design.userDisplayName; renderAll();
  }

  /* ---------- klavye ---------- */
  function onKey(e) {
    if (!E.active) return;
    const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (typing) return;
    const l = selL();
    if (e.key === 'Escape') { select(null); return; }
    if (!l || l.type === 'background' || l.locked) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('del', l.id); }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); act('dup', l.id); }
    else if (e.key.indexOf('Arrow') === 0) {
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1, p = l.properties, before = clone(p);
      snap('nudge' + l.id);
      if (e.key === 'ArrowLeft') p.x -= s; if (e.key === 'ArrowRight') p.x += s;
      if (e.key === 'ArrowUp') p.y -= s; if (e.key === 'ArrowDown') p.y += s;
      if (R.violation(l)) { l.properties = before; toast('Korumalı alana taşınamaz.'); }
      stageChanged(); syncInputs();
    }
  }

  /* ---------- kurulum ---------- */
  function init() {
    if (E.bound) return; E.bound = true;
    el = {
      svg: $('#ed-svg'), canvas: $('#ed-canvas'), msg: $('#ed-msg'), status: $('#ed-status'), name: $('#ed-name'),
      nameErr: $('#ed-name-err'), nameCount: $('#ed-name-count'), props: $('#ed-props'), layers: $('#ed-layers'),
      lib: $('#lib-content'), tabs: $('#lib-tabs'), undo: $('#ed-undo'), redo: $('#ed-redo'), preview: $('#ed-preview'), body: $('#ed-body')
    };
    el.svg.addEventListener('pointerdown', onDown);
    el.svg.addEventListener('pointermove', onMove);
    el.svg.addEventListener('pointerup', onUp);
    el.svg.addEventListener('pointercancel', onUp);
    el.props.addEventListener('input', onPropsInput);
    el.props.addEventListener('change', onPropsChange);
    el.props.addEventListener('click', onPropsClick);
    el.props.addEventListener('focusin', onPropsFocus);
    el.layers.addEventListener('click', onLayersClick);
    el.layers.addEventListener('dragstart', onLayerDragStart);
    el.layers.addEventListener('dragover', onLayerDragOver);
    el.layers.addEventListener('drop', onLayerDrop);
    el.layers.addEventListener('dragend', () => { E.layerDrag = null; renderLayers(); });
    el.lib.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tpl) applyTemplate(b.dataset.tpl);
      else if (b.dataset.bgp) applyBg(Number(b.dataset.bgp));
      else if (b.dataset.add) addShape(b.dataset.add);
      else if (b.dataset.finish) { snap(); X.bgLayer(E.design).properties.finish = b.dataset.finish; fullChanged(); }
      else if (b.dataset.chip) { snap(); E.design.chipStyle = b.dataset.chip; fullChanged(); }
    });
    el.tabs.addEventListener('click', e => { const b = e.target.closest('[data-ltab]'); if (b) { E.tab = b.dataset.ltab; renderLib(); } });
    el.name.addEventListener('input', () => {
      const raw = el.name.value, v = R.sanitizeName(raw, true);
      if (v !== raw) el.name.value = v;
      el.nameCount.textContent = Array.from(v).length + '/' + R.NAME_LIMITS.max;
      const res = R.validateName(v);
      if (!res.ok) { el.nameErr.textContent = res.error; return; }
      el.nameErr.textContent = '';
      snap('name'); E.design.userDisplayName = res.value; stageChanged();
    });
    el.name.addEventListener('blur', () => { el.name.value = E.design.userDisplayName; el.nameErr.textContent = ''; el.nameCount.textContent = Array.from(E.design.userDisplayName).length + '/' + R.NAME_LIMITS.max; });
    el.name.addEventListener('focus', () => { if (E.sel !== 'name') select('name'); });
    $('#ed-zones').addEventListener('change', e => { E.zones = e.target.checked; renderStage(); });
    el.undo.addEventListener('click', undo);
    el.redo.addEventListener('click', redo);
    el.preview.addEventListener('click', () => {
      E.preview = !E.preview; el.preview.setAttribute('aria-pressed', String(E.preview));
      el.preview.textContent = E.preview ? 'Düzenle' : 'Önizle'; renderStage();
    });
    $('#ed-reset').addEventListener('click', reset);
    $('#ed-save').addEventListener('click', save);
    $('#ed-exit').addEventListener('click', exit);
    $('.ed-mtabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      el.body.dataset.active = b.dataset.tab;
      $('.ed-mtabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => { if (E.active) renderStage(); });
    window.addEventListener('offline', () => { if (E.active) setStatus('error', 'Bağlantı yok — taslak bu cihazda korunuyor'); });
    window.addEventListener('online', () => { if (E.active) setStatus('draft', 'Bağlantı geri geldi'); });
  }

  function open(o) {
    init();
    E.opts = o; E.system = o.system; E.saved = clone(o.saved); E.savedJson = JSON.stringify(E.saved);
    E.design = clone(o.draft || o.saved);
    E.sel = null; E.undo = []; E.redo = []; E.errors = []; E.preview = false; E.zones = false; E.active = true; E.tab = 'tpl'; E.drag = null;
    $('#ed-zones').checked = false;
    el.preview.setAttribute('aria-pressed', 'false'); el.preview.textContent = 'Önizle';
    el.name.value = E.design.userDisplayName; el.nameErr.textContent = '';
    renderAll();
    if (o.draft) { setStatus('draft', 'Kaydedilmemiş taslak açıldı'); toast('Kaydedilmemiş taslağın açıldı.'); }
    requestAnimationFrame(renderStage);
  }

  root.FNXEditor = { open: open, close: () => { E.active = false; clearTimeout(E.draftTimer); }, isActive: () => E.active };
})(window);
