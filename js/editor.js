/* Forevye Nexus — Card Studio (kart editörü, sözleşme sürüm 3).
 * Serbest yerleştirme: dekoratif katmanlar hiçbir şeyle çakışma engeline takılmaz, üst üste binebilir, kart dışına taşabilir.
 * Sistem öğeleri (logo, çip, ad, numara, kod, QR) katman değildir: her zaman en üstte çizilir, silinemez/gizlenemez;
 * yalnızca konum ve ölçek verilebilir ve birbirlerini kapatamazlar. Buradaki kontroller deneyim içindir;
 * asıl doğrulama sunucuda aynı rules.js ile yapılır. */
(function (root) {
  'use strict';
  const R = root.FNXRules, L = root.FNXLib, T = root.FNXTemplates, X = root.FNXRender;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = v => Math.round(v * 10) / 10;
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = X.esc;
  const toast = m => root.FNXToast && root.FNXToast(m);
  const PAD = 70;
  const SNAP_PX = 7;

  const ICON = {
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    front: '<path d="M5 4h14M12 20V8M6 14l6-6 6 6"/>', back: '<path d="M5 20h14M12 4v12M6 10l6 6 6-6"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/>'
  };
  const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  const LIB_TABS = [['tpl', 'Şablonlar'], ['bg', 'Zemin'], ['shape', 'Şekiller'], ['pattern', 'Desenler'], ['light', 'Işık'], ['fx', 'Yüzey'], ['sys', 'Sistem']];

  const E = {
    active: false, bound: false, design: null, saved: null, savedJson: '', system: null, opts: null, sel: null,
    undo: [], redo: [], drag: null, guides: [], zones: false, snap: true, preview: false, tab: 'tpl', lightColor: '#FFFFFF',
    lastKey: null, lastT: 0, draftTimer: null, errors: [], layerDrag: null, raf: 0, scale: 1
  };
  let el = {};

  const cv = () => R.canvasOf(E.design.orientation);
  const getL = id => E.design.layers.find(l => l.id === id);
  const selSys = () => (E.sel && E.sel.indexOf('sys:') === 0 ? E.sel.slice(4) : null);
  const selL = () => (E.sel && E.sel !== 'bg' && !selSys() ? getL(E.sel) : null);
  const norm = d => R.validateDesign(d).design;
  // Kimlik/sürüm alanları kayıt karşılaştırmasına girmez.
  const dirtyKey = d => JSON.stringify(Object.assign({}, d, { designId: '', ownerId: '', version: 0 }));
  const isDirty = () => dirtyKey(E.design) !== E.savedJson;

  /* ---------- modal ---------- */
  function ask(title, html, buttons) {
    return new Promise(res => {
      const m = $('#ed-modal');
      $('#ed-modal-t').textContent = title; $('#ed-modal-b').innerHTML = html;
      const acts = $('#ed-modal-a'); acts.innerHTML = '';
      const done = v => { m.hidden = true; document.removeEventListener('keydown', onEsc, true); res(v); };
      const onEsc = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
      buttons.forEach((b, i) => {
        const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn' + (b.primary ? ' primary' : '');
        bt.innerHTML = esc(b.label) + (b.sub ? `<small>${esc(b.sub)}</small>` : '');
        bt.addEventListener('click', () => done(b.id)); acts.appendChild(bt); if (i === 0) setTimeout(() => bt.focus(), 0);
      });
      document.addEventListener('keydown', onEsc, true);
      m.hidden = false;
    });
  }

  /* ---------- geçmiş ---------- */
  function snap(key) {
    const now = Date.now();
    if (key && E.lastKey === key && now - E.lastT < 900) { E.lastT = now; return; }
    E.undo.push(JSON.stringify(E.design));
    if (E.undo.length > 100) E.undo.shift();
    E.redo = []; E.lastKey = key || null; E.lastT = now;
  }
  function undo() {
    if (!E.undo.length) return;
    E.redo.push(JSON.stringify(E.design)); E.design = JSON.parse(E.undo.pop()); afterHistory();
  }
  function redo() {
    if (!E.redo.length) return;
    E.undo.push(JSON.stringify(E.design)); E.design = JSON.parse(E.redo.pop()); afterHistory();
  }
  function afterHistory() {
    E.lastKey = null;
    if (E.sel && E.sel !== 'bg' && !selSys() && !getL(E.sel)) E.sel = null;
    el.name.value = E.design.userDisplayName; syncOrient();
    fullChanged();
  }

  /* ---------- durum, taslak ---------- */
  function setStatus(kind, text) { el.status.dataset.state = kind; el.status.textContent = text; }
  const draftKey = () => (E.opts && E.opts.draftKey) || 'fnx.draft';
  function scheduleDraft() { clearTimeout(E.draftTimer); E.draftTimer = setTimeout(saveDraft, 700); }
  function saveDraft() {
    if (!E.active) return;
    try {
      localStorage.setItem(draftKey(), JSON.stringify({ design: E.design, savedAt: Date.now() }));
      const t = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setStatus('dirty', 'Kaydedilmemiş değişiklik var · taslak ' + t + (navigator.onLine ? '' : ' · çevrimdışı'));
    } catch (e) { setStatus('error', 'Taslak kaydedilemedi — tarayıcı depolaması kullanılamıyor'); }
  }
  function clearDraft() { clearTimeout(E.draftTimer); try { localStorage.removeItem(draftKey()); } catch (e) {} }

  function renderMsg() {
    const t = X.tone(E.design);
    let html = '';
    if (E.errors.length) html += '<ul class="errs">' + E.errors.map(m => `<li>${esc(m)}</li>`).join('') + '</ul>';
    else if (X.contrast(t.name, t.avg) < 3) html = '<p class="warn">Ad rengi zemine göre okunaksız olabilir. Daha belirgin bir renk seç.</p>';
    el.msg.innerHTML = html;
  }
  function syncDirtyUi() {
    const d = isDirty();
    el.dot.hidden = !d;
    document.title = (d ? '● ' : '') + 'Card Studio · Forevye Nexus';
    return d;
  }
  function stageChanged() {
    queueStage(); renderMsg();
    el.undo.disabled = !E.undo.length; el.redo.disabled = !E.redo.length;
    if (syncDirtyUi()) scheduleDraft();
    else { setStatus('saved', E.opts && E.opts.isNew ? 'Yeni kart · henüz kaydedilmedi' : 'Kaydedildi · sürüm ' + E.saved.version); clearDraft(); }
  }
  function fullChanged() { stageChanged(); renderProps(); renderLayers(); renderLib(); }
  function renderAll() { E.errors = []; fullChanged(); el.nameCount.textContent = Array.from(E.design.userDisplayName).length + '/' + R.NAME_LIMITS.max; }

  /* ---------- sahne ---------- */
  function toSvg(e) {
    const pt = el.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(el.svg.getScreenCTM().inverse());
    return { x: q.x, y: q.y };
  }
  function queueStage() { if (E.raf) return; E.raf = requestAnimationFrame(() => { E.raf = 0; renderStage(); }); }
  function fit(vw, vh) {
    const c = el.canvas, aw = c.clientWidth || 600, ah = c.clientHeight || 400, k = Math.min(aw / vw, ah / vh);
    el.svg.style.width = (vw * k) + 'px'; el.svg.style.height = (vh * k) + 'px'; E.scale = k;
  }
  function renderStage() {
    if (!E.design) return;
    const c = cv(), pad = E.preview ? 0 : PAD, vw = c.width + 2 * pad, vh = c.height + 2 * pad;
    el.svg.setAttribute('viewBox', `${-pad} ${-pad} ${vw} ${vh}`);
    fit(vw, vh);
    let m = X.renderCard(E.design, E.system, { prefix: 'ed', interactive: true, ghost: !E.preview, placeholder: true });
    if (!E.preview) m += overlay();
    el.svg.innerHTML = m; X.applyBlend(el.svg);
    el.canvas.classList.toggle('preview', E.preview);
  }
  function overlay() {
    const c = cv(), sc = E.scale || 1, hr = clamp(10 / sc, 6, 26), off = clamp(34 / sc, 20, 80), bad = false;
    let o = '<g class="ov">' + `<rect class="cardedge" x="0" y="0" width="${c.width}" height="${c.height}" rx="${R.CORNER}"/>`;
    if (E.zones || (E.drag && !E.drag.sys)) {
      R.zonesOf(E.design).forEach(z => { o += `<rect class="zone" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="8"/><text class="zlabel" x="${z.x + 4}" y="${z.y - 4}">${esc(z.label)}</text>`; });
    }
    E.guides.forEach(g => {
      if (g.t === 'v') o += `<path class="guide${g.c ? ' c' : ''}" d="M${g.v} -20V${c.height + 20}"/>`;
      else if (g.t === 'h') o += `<path class="guide${g.c ? ' c' : ''}" d="M-20 ${g.v}H${c.width + 20}"/>`;
      else if (g.t === 'gap') {
        o += `<path class="gap" d="M${g.x1} ${g.y1}L${g.x2} ${g.y2}M${g.x1 - (g.y1 === g.y2 ? 0 : 5)} ${g.y1 - (g.y1 === g.y2 ? 5 : 0)}l${g.y1 === g.y2 ? 0 : 10} ${g.y1 === g.y2 ? 10 : 0}M${g.x2 - (g.y1 === g.y2 ? 0 : 5)} ${g.y2 - (g.y1 === g.y2 ? 5 : 0)}l${g.y1 === g.y2 ? 0 : 10} ${g.y1 === g.y2 ? 10 : 0}"/>` +
          `<text class="gaplabel" x="${(g.x1 + g.x2) / 2}" y="${(g.y1 + g.y2) / 2 - 6}" text-anchor="middle">${Math.round(g.d)}</text>`;
      }
    });
    const sk = selSys(), l = selL();
    if (E.sel === 'bg') o += `<rect class="selbox" x="3" y="3" width="${c.width - 6}" height="${c.height - 6}" rx="34"/>`;
    else if (sk) {
      const b = R.sysBox(sk, E.design.sys[sk], E.design.qrStyle);
      o += `<rect class="selbox sysb" x="${b.x - 3}" y="${b.y - 3}" width="${b.w + 6}" height="${b.h + 6}" rx="6"/>`;
      [['nw', b.x - 3, b.y - 3], ['ne', b.r + 3, b.y - 3], ['se', b.r + 3, b.b + 3], ['sw', b.x - 3, b.b + 3]].forEach(h => {
        o += `<circle class="handle sys h-${h[0]}" data-h="s-${h[0]}" cx="${h[1]}" cy="${h[2]}" r="${hr}"/>`;
      });
    } else if (l && l.visible) {
      const p = l.properties, cx = p.width / 2, cy = p.height / 2;
      o += `<g transform="translate(${p.x} ${p.y}) rotate(${p.rotation} ${cx} ${cy})"><rect class="selbox${bad ? ' bad' : ''}${l.locked ? ' lockd' : ''}" width="${p.width}" height="${p.height}"/>`;
      if (!l.locked) {
        o += `<path class="selbox" d="M${cx} 0V${-off}"/>`;
        [['n', cx, 0], ['s', cx, p.height], ['e', p.width, cy], ['w', 0, cy]].forEach(h => {
          o += `<rect class="handle edge h-${h[0]}" data-h="${h[0]}" x="${h[1] - hr * 0.7}" y="${h[2] - hr * 0.7}" width="${hr * 1.4}" height="${hr * 1.4}"/>`;
        });
        [['nw', 0, 0], ['ne', p.width, 0], ['se', p.width, p.height], ['sw', 0, p.height]].forEach(h => {
          o += `<circle class="handle h-${h[0]}" data-h="${h[0]}" cx="${h[1]}" cy="${h[2]}" r="${hr}"/>`;
        });
        o += `<circle class="handle rot" data-h="rot" cx="${cx}" cy="${-off}" r="${hr}"/>`;
      }
      o += '</g>';
    }
    return o + '</g>';
  }

  function select(id) { E.sel = id; renderStage(); renderProps(); renderLayers(); }

  /* ---------- hizalama (snap) ---------- */
  // Hedef kutular: sistem öğeleri ve diğer görünür dekoratif katmanlar.
  function targetBoxes(excludeId, excludeSys) {
    const out = [];
    R.SYS_KEYS.forEach(k => { if (k !== excludeSys) { const b = R.sysBox(k, E.design.sys[k], E.design.qrStyle); out.push({ l: b.x, r: b.r, t: b.y, b: b.b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }); } });
    if (!excludeSys || true) E.design.layers.forEach(l => {
      if (l.type === 'background' || !l.visible || l.id === excludeId) return;
      const b = R.bbox(l.properties); if (b.w > cv().width * 1.2) return;
      out.push({ l: b.l, r: b.r, t: b.t, b: b.b, cx: b.cx, cy: b.cy });
    });
    return out;
  }
  function snapMove(bb, boxes) {
    const c = cv(), T_ = SNAP_PX / (E.scale || 1), M = 40;
    const xs = [{ v: 0 }, { v: c.width / 2, c: 1 }, { v: c.width }, { v: M }, { v: c.width - M }];
    const ys = [{ v: 0 }, { v: c.height / 2, c: 1 }, { v: c.height }, { v: M }, { v: c.height - M }];
    boxes.forEach(b => { xs.push({ v: b.l }, { v: b.cx }, { v: b.r }); ys.push({ v: b.t }, { v: b.cy }, { v: b.b }); });
    const best = (mine, cands) => {
      let r = null;
      mine.forEach(m => cands.forEach(cd => { const d = cd.v - m; if (Math.abs(d) < T_ && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, v: cd.v, c: !!cd.c }; }));
      return r;
    };
    const bx = best([bb.l, bb.cx, bb.r], xs), by = best([bb.t, bb.cy, bb.b], ys);
    let dx = bx ? bx.d : 0, dy = by ? by.d : 0;
    const guides = [];
    if (bx) guides.push({ t: 'v', v: bx.v, c: bx.c });
    if (by) guides.push({ t: 'h', v: by.v, c: by.c });
    // eşit mesafe: sol-sağ komşu arası boşluklar eşitse
    const m = { l: bb.l + dx, r: bb.r + dx, t: bb.t + dy, b: bb.b + dy };
    if (!bx) {
      const row = boxes.filter(b => b.t < m.b && b.b > m.t);
      const L_ = row.filter(b => b.r <= m.l).sort((a, b) => b.r - a.r)[0], R_ = row.filter(b => b.l >= m.r).sort((a, b) => a.l - b.l)[0];
      if (L_ && R_) {
        const gl = m.l - L_.r, gr = R_.l - m.r;
        if (Math.abs(gl - gr) < T_ * 1.5 && gl > 4 && gr > 4) {
          dx += (gr - gl) / 2; const g = (gl + gr) / 2, y = (m.t + m.b) / 2;
          guides.push({ t: 'gap', x1: L_.r, y1: y, x2: L_.r + g, y2: y, d: g }, { t: 'gap', x1: R_.l - g, y1: y, x2: R_.l, y2: y, d: g });
        }
      }
    }
    if (!by) {
      const col = boxes.filter(b => b.l < m.r && b.r > m.l);
      const U = col.filter(b => b.b <= m.t).sort((a, b) => b.b - a.b)[0], D = col.filter(b => b.t >= m.b).sort((a, b) => a.t - b.t)[0];
      if (U && D) {
        const gu = m.t - U.b, gd = D.t - m.b;
        if (Math.abs(gu - gd) < T_ * 1.5 && gu > 4 && gd > 4) {
          dy += (gd - gu) / 2; const g = (gu + gd) / 2, x = (m.l + m.r) / 2;
          guides.push({ t: 'gap', x1: x, y1: U.b, x2: x, y2: U.b + g, d: g }, { t: 'gap', x1: x, y1: D.t - g, x2: x, y2: D.t, d: g });
        }
      }
    }
    return { dx, dy, guides };
  }

  /* ---------- işaretçi: taşı, boyutlandır, döndür ---------- */
  function deepHit(e) {
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const n of els) { const g = n.closest && n.closest('[data-id]'); if (g && g.dataset.id !== 'bg' && el.svg.contains(g)) return g; }
    return null;
  }
  function onDown(e) {
    if (E.preview || (e.button != null && e.button > 0)) return;
    const t = e.target, hEl = t.closest && t.closest('[data-h]');
    if (hEl) {
      if (hEl.dataset.h.indexOf('s-') === 0) { beginSys('scale', hEl.dataset.h.slice(2), e); return; }
      const l = selL(); if (l && !l.locked) begin(hEl.dataset.h, e); return;
    }
    const sysEl = !e.altKey && t.closest && t.closest('[data-sk]');
    if (sysEl) { select('sys:' + sysEl.dataset.sk); beginSys('move', null, e); return; }
    let g = t.closest && t.closest('[data-id]');
    if (e.altKey) g = deepHit(e) || g;
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
    E.drag = { mode, id: l.id, start: toSvg(e), orig: clone(l.properties), moved: false, targets: targetBoxes(l.id, null) };
    try { el.svg.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  function beginSys(mode, handle, e) {
    const k = selSys(); if (!k) return;
    E.drag = { sys: true, mode, handle, key: k, start: toSvg(e), orig: clone(E.design.sys[k]), last: clone(E.design.sys[k]), moved: false, targets: targetBoxes(null, k) };
    try { el.svg.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  function trySys(key, cand) {
    const fixed = R.sysFix(key, cand, E.design.orientation, E.design.qrStyle);
    const test = clone(E.design.sys); test[key] = fixed;
    return R.sysConflicts(test, E.design.qrStyle).some(p => p.indexOf(key) >= 0) ? null : fixed;
  }
  function onMoveSys(e) {
    const d = E.drag, key = d.key, pt = toSvg(e), dx = pt.x - d.start.x, dy = pt.y - d.start.y;
    if (!d.moved) { if (Math.hypot(dx, dy) < 2) return; d.moved = true; snap(); }
    const dm = R.sysDims(key, E.design.qrStyle);
    E.guides = [];
    let cand;
    if (d.mode === 'move') {
      let nx = d.orig.x + dx, ny = d.orig.y + dy;
      if (E.snap && !e.altKey) {
        const w = dm.w * d.orig.scale, h = dm.h * d.orig.scale;
        const s = snapMove({ l: nx, r: nx + w, t: ny, b: ny + h, cx: nx + w / 2, cy: ny + h / 2, w, h }, d.targets.filter(b => b.l !== undefined));
        nx += s.dx; ny += s.dy; E.guides = s.guides;
      }
      cand = { x: nx, y: ny, scale: d.orig.scale };
    } else {
      const w0 = dm.w * d.orig.scale, h0 = dm.h * d.orig.scale, hd = d.handle;
      const ax = hd.indexOf('w') >= 0 ? d.orig.x + w0 : d.orig.x, ay = hd.indexOf('n') >= 0 ? d.orig.y + h0 : d.orig.y;
      const s = Math.max(Math.abs(pt.x - ax) / dm.w, Math.abs(pt.y - ay) / dm.h);
      const sc = clamp(s, R.SYS[key].min, R.SYS[key].max);
      cand = { x: hd.indexOf('w') >= 0 ? ax - dm.w * sc : ax, y: hd.indexOf('n') >= 0 ? ay - dm.h * sc : ay, scale: sc };
    }
    const last = d.last;
    const ok = trySys(key, cand) || trySys(key, { x: cand.x, y: last.y, scale: cand.scale }) || trySys(key, { x: last.x, y: cand.y, scale: cand.scale });
    if (ok) { d.last = ok; E.design.sys[key] = ok; }
    stageChanged(); syncInputs();
  }
  function onMove(e) {
    const d = E.drag; if (!d) return;
    if (d.sys) { onMoveSys(e); return; }
    const l = getL(d.id); if (!l) return;
    const p = l.properties, o = d.orig, pt = toSvg(e);
    const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
    if (!d.moved) { if (Math.hypot(dx, dy) < 2) return; d.moved = true; snap(); }
    E.guides = [];
    if (d.mode === 'move') {
      let nx = o.x + dx, ny = o.y + dy;
      if (E.snap && !e.altKey) {
        const bb = R.bbox({ x: nx, y: ny, width: o.width, height: o.height, rotation: o.rotation });
        const s = snapMove(bb, d.targets); nx += s.dx; ny += s.dy; E.guides = s.guides;
      }
      p.x = r1(nx); p.y = r1(ny);
    } else if (d.mode === 'rot') {
      const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
      let a = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI + 90;
      a = ((a + 540) % 360) - 180;
      const near = Math.round(a / 15) * 15;
      if (e.shiftKey || (E.snap && Math.abs(a - near) < 3)) a = near;
      p.rotation = r1(a);
    } else {
      const hd = d.mode, rad = o.rotation * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
      const cx = o.x + o.width / 2, cy = o.y + o.height / 2, vx = pt.x - cx, vy = pt.y - cy;
      const lx = vx * cos + vy * sin, ly = -vx * sin + vy * cos;   // yerel (döndürülmemiş) çerçeve
      const hw = o.width / 2, hh = o.height / 2;
      let x0 = -hw, x1 = hw, y0 = -hh, y1 = hh;
      if (hd.indexOf('e') >= 0) x1 = lx; if (hd.indexOf('w') >= 0) x0 = lx;
      if (hd.indexOf('s') >= 0) y1 = ly; if (hd.indexOf('n') >= 0) y0 = ly;
      let w = Math.max(8, Math.abs(x1 - x0)), h = Math.max(8, Math.abs(y1 - y0));
      const corner = hd.length === 2;
      if (corner && (p.lockRatio || e.shiftKey)) {
        const s = Math.max(w / o.width, h / o.height); w = o.width * s; h = o.height * s;
        if (hd.indexOf('e') >= 0) x1 = x0 + w; else x0 = x1 - w;
        if (hd.indexOf('s') >= 0) y1 = y0 + h; else y0 = y1 - h;
      } else {
        if (hd.indexOf('e') >= 0) x1 = x0 + w; else if (hd.indexOf('w') >= 0) x0 = x1 - w;
        if (hd.indexOf('s') >= 0) y1 = y0 + h; else if (hd.indexOf('n') >= 0) y0 = y1 - h;
      }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const ncx = cx + mx * cos - my * sin, ncy = cy + mx * sin + my * cos;
      p.width = r1(clamp(w, 8, 1500)); p.height = r1(clamp(h, 8, 1500));
      p.x = r1(ncx - p.width / 2); p.y = r1(ncy - p.height / 2);
    }
    stageChanged(); syncInputs();
  }
  function onUp() {
    const d = E.drag; if (!d) return;
    E.drag = null; E.guides = [];
    fullChanged();
  }

  /* ---------- parça ekleme ve uygulama ---------- */
  function addShape(kind) {
    if (E.design.layers.length - 1 >= R.MAX_LAYERS) { toast('Katman sınırına ulaştın (en fazla ' + R.MAX_LAYERS + ').'); return; }
    const sz = L.SIZES[kind], so = R.STROKE_ONLY.has(kind), c = cv(), light = R.LIGHT_KINDS.indexOf(kind) >= 0;
    const col = light ? E.lightColor : (X.tone(E.design).dark ? '#C9CFDD' : '#59607A');
    const l = T.userShape(kind, Math.round(c.width / 2 - sz[0] / 2), Math.round(c.height / 2 - sz[1] / 2), sz[0], sz[1], {
      fill: so ? 'none' : col, stroke: so ? col : 'none', strokeWidth: so ? (sz[2] || 3) : 0, lockRatio: !!L.LOCK_RATIO[kind], opacity: light ? 0.8 : 1
    });
    snap(); E.design.layers.push(l); E.sel = l.id; fullChanged();
  }
  function applyBg(i) {
    const b = L.BACKGROUNDS[i], p = X.bgLayer(E.design).properties;
    snap(); p.mode = b.mode; p.colors = b.c.slice(); if (b.a != null) p.angle = b.a;
    fullChanged();
  }
  async function applyTemplate(id) {
    const cur = E.design, fresh = T.get(id, cur.orientation);
    const deco = cur.layers.filter(l => l.type !== 'background');
    const hasUser = deco.some(l => !T.isTemplateLayer(l));
    let mode = 'replace';
    if (deco.length) {
      const btns = [];
      btns.push({ id: 'keepUser', label: 'Şablonu uygula, eklediklerimi koru', sub: 'Zemin ve şablon öğeleri yenilenir; kendi eklediğin katmanlar kalır.', primary: true });
      btns.push({ id: 'keepAll', label: 'Yalnızca zemini ve çip rengini uygula', sub: 'Tüm mevcut katmanların olduğu gibi kalır.' });
      btns.push({ id: 'replace', label: 'Her şeyi şablonla değiştir', sub: hasUser ? 'Eklediğin katmanlar silinir (geri alınabilir).' : 'Mevcut dekoratif katmanlar yenilenir (geri alınabilir).' });
      btns.push({ id: null, label: 'Vazgeç' });
      mode = await ask('“' + T.META[id].n + '” şablonuna geç', 'Mevcut tasarımın korunarak geçilebilir. Kart sahibi, sistem öğelerinin konumları ve kart kimliği değişmez.', btns);
      if (!mode) return;
    }
    snap();
    const d = clone(cur), fbg = fresh.layers[0], fdeco = fresh.layers.slice(1);
    d.template = id; d.chipStyle = fresh.chipStyle;
    const userL = deco.filter(l => !T.isTemplateLayer(l));
    d.layers = mode === 'keepAll' ? [fbg].concat(deco) : mode === 'keepUser' ? [fbg].concat(fdeco, userL) : [fbg].concat(fdeco);
    if (d.layers.length - 1 > R.MAX_LAYERS) d.layers = d.layers.slice(0, R.MAX_LAYERS + 1);
    E.design = norm(d); E.sel = null; fullChanged();
    toast('Şablon uygulandı. Geri alabilirsin (Ctrl+Z).');
  }
  function samePristine(d) {
    try {
      const f = T.get(d.template, d.orientation), sig = l => JSON.stringify([l.type, l.properties]);
      if (f.layers.length !== d.layers.length) return false;
      return f.layers.every((l, i) => sig(l) === sig(d.layers[i]));
    } catch (e) { return false; }
  }
  async function setOrientation(o) {
    const cur = E.design;
    if (cur.orientation === o) return;
    const oldC = cv(), nc = R.canvasOf(o);
    const pristine = samePristine(norm(cur));
    let mode = 'template';
    if (!pristine) {
      mode = await ask(o === 'portrait' ? 'Dikey karta geç' : 'Yatay karta geç',
        'Dikey ve yatay kartların ayrı kompozisyonları vardır. Sistem öğeleri (logo, çip, ad, kod, QR) yeni yönün varsayılan düzenine yerleşir.',
        [{ id: 'template', label: 'Şablonun ' + (o === 'portrait' ? 'dikey' : 'yatay') + ' kompozisyonunu kur', sub: 'Eklediğin katmanlar yeni tuvale oranlanarak korunur.', primary: true },
          { id: 'fit', label: 'Tüm öğelerimi yeni tuvale uyarla', sub: 'Mevcut katmanlar konumları oranlanarak taşınır.' }, { id: null, label: 'Vazgeç' }]);
      if (!mode) return;
    }
    snap();
    const kx = nc.width / oldC.width, ky = nc.height / oldC.height;
    const remap = l => { const p = l.properties, cx = (p.x + p.width / 2) * kx, cy = (p.y + p.height / 2) * ky; p.x = r1(cx - p.width / 2); p.y = r1(cy - p.height / 2); return l; };
    const d = clone(cur), fresh = T.get(d.template || 'classic', o), bgOld = X.bgLayer(d);
    const deco = d.layers.filter(l => l.type !== 'background');
    d.orientation = o; d.canvas = { width: nc.width, height: nc.height }; d.sys = R.sysDefaults(o);
    if (mode === 'template') {
      const keep = deco.filter(l => !T.isTemplateLayer(l)).map(remap);
      d.layers = [bgOld].concat(fresh.layers.slice(1), keep);
    } else d.layers = [bgOld].concat(deco.map(remap));
    E.design = norm(d); E.sel = null; syncOrient(); fullChanged();
    toast(o === 'portrait' ? 'Dikey kart düzenine geçildi.' : 'Yatay kart düzenine geçildi.');
  }
  function syncOrient() {
    el.orient.querySelectorAll('[data-orient]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.orient === E.design.orientation)));
  }

  /* ---------- katman işlemleri ---------- */
  function act(name, id, v) {
    const ls = E.design.layers, i = ls.findIndex(l => l.id === id), l = ls[i];
    if (!l || l.type === 'background') return;
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
        l.properties.rotation = r1(((((name === 'rotby' ? l.properties.rotation + v : v) + 540) % 360) - 180)); break;
      case 'del': snap(); ls.splice(i, 1); if (E.sel === id) E.sel = null; break;
      case 'dup': {
        if (ls.length - 1 >= R.MAX_LAYERS) { toast('Katman sınırına ulaştın.'); return; }
        const c = clone(l); c.id = T.uid(); c.name = (l.name + ' kopya').slice(0, 24); c.locked = false;
        c.properties.x += 24; c.properties.y += 24;
        snap(); ls.splice(i + 1, 0, c); E.sel = c.id; break;
      }
    }
    fullChanged();
  }

  /* ---------- sol panel ---------- */
  function previewSvg(kind, color) {
    const so = R.STROKE_ONLY.has(kind);
    return `<svg viewBox="-4 -4 108 108" aria-hidden="true">${X.shapeInner(kind, { fill: so ? 'none' : color, stroke: so ? color : 'none', strokeWidth: so ? 3 : 0, effects: [] })}</svg>`;
  }
  function renderLib() {
    el.tabs.innerHTML = LIB_TABS.map(t => `<button type="button" role="tab" data-ltab="${t[0]}" aria-selected="${E.tab === t[0]}">${t[1]}</button>`).join('');
    const bp = X.bgLayer(E.design).properties; let h = '';
    const dark = X.tone(E.design).dark, col = dark ? '#C9CFDD' : '#59607A';
    if (E.tab === 'tpl') {
      h = '<div class="tpl-grid">' + R.TEMPLATES.map(id => {
        const d = T.get(id, E.design.orientation); d.userDisplayName = E.design.userDisplayName;
        return `<button type="button" class="tpl${E.design.template === id ? ' on' : ''}" data-tpl="${id}">${X.cardSvg(norm(d), E.system, { prefix: 't' + id, placeholder: true })}<b>${T.META[id].n}</b><small>${T.META[id].d}</small></button>`;
      }).join('') + '</div><p class="muted pad">Her şablonun yatay ve dikey ayrı kompozisyonu vardır. Şablonlar başlangıç noktasıdır; geçişte kendi eklediklerini koruyabilirsin.</p>';
    } else if (E.tab === 'bg') {
      h = '<div class="sw-grid">' + L.BACKGROUNDS.map((b, i) => {
        const css = b.mode === 'solid' ? b.c[0] : `linear-gradient(${b.a || 135}deg,${b.c.join(',')})`;
        return `<button type="button" class="sw" data-bgp="${i}" style="background:${css}" title="${b.n}" aria-label="${b.n}"></button>`;
      }).join('') + '</div><p class="muted pad">Renk duraklarını (en fazla 5), açıyı ve dokuyu ayarlamak için sahnede kart zeminini ya da katman panelinden “Kart zemini”ni seç.</p>';
    } else if (E.tab === 'shape' || E.tab === 'pattern') {
      const kinds = E.tab === 'shape' ? L.SHAPE_KINDS : L.PATTERN_KINDS;
      h = '<div class="item-grid">' + kinds.map(k => `<button type="button" class="item" data-add="${k}">${previewSvg(k, col)}<span>${L.LABELS[k]}</span></button>`).join('') + '</div>' +
        '<p class="muted pad">Eklenen öğeler serbesttir: üst üste gelebilir, kart dışına taşabilir. Çip, logo, ad, kod ve QR her zaman üstte kalır.</p>';
    } else if (E.tab === 'light') {
      h = '<p class="muted pad" style="padding-top:0">Işık rengi</p><div class="sw-row">' + L.LIGHT_COLORS.map(c => `<button type="button" class="sw sm${E.lightColor === c ? ' on' : ''}" data-lc="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') + '</div>' +
        '<div class="item-grid">' + L.LIGHT_KINDS.map(k => `<button type="button" class="item" data-add="${k}">${previewSvg(k, E.lightColor).replace('<svg ', '<svg style="background:#12151c" ')}<span>${L.LABELS[k]}</span></button>`).join('') + '</div>' +
        '<p class="muted pad">Işıklar kartın genel görünümünü değiştirir; kart numarasının okunabilirliğini bozmaz çünkü sistem bilgileri her zaman üsttedir. Parlama için seçili öğenin özelliklerinde “Parlama”yı kullan.</p>';
    } else if (E.tab === 'fx') {
      h = '<h3 class="panel-h">Yüzey</h3><div class="list">' + L.FINISHES.map(f => `<button type="button" class="opt${bp.finish === f.id ? ' on' : ''}" data-finish="${f.id}"><b>${f.n}</b><small>${f.d}</small></button>`).join('') +
        '</div><h3 class="panel-h">Doku</h3><div class="list">' + L.TEXTURES.map(f => `<button type="button" class="opt${(bp.texture || 'none') === f.id ? ' on' : ''}" data-texture="${f.id}"><b>${f.n}</b><small>${f.d}</small></button>`).join('') + '</div>' +
        '<p class="muted pad">Doku yoğunluğunu kart zemini seçiliyken ayarlayabilirsin.</p>';
    } else if (E.tab === 'sys') {
      h = sysTabHtml();
    }
    el.lib.innerHTML = h;
    if (E.tab === 'tpl') el.lib.querySelectorAll('svg').forEach(X.applyBlend);
  }
  function sysTabHtml() {
    return '<h3 class="panel-h">EMV çip</h3><div class="chip-grid">' + L.CHIPS.map(c => `<button type="button" class="opt chip${E.design.chipStyle === c.id ? ' on' : ''}" data-chip="${c.id}">${X.chipSvg(c.id)}<b>${c.n}</b></button>`).join('') + '</div>' +
      '<h3 class="panel-h">QR kod</h3>' + seg([['tint', 'Kompakt plaka'], ['icon', 'Gizli simge']], E.design.qrStyle, 'qrstyle') +
      '<p class="muted pad">“Gizli simge” kartta yalnızca küçük bir QR simgesi gösterir; simgeye tıklayınca QR büyütülerek ayrı pencerede açılır (Kartlarım’da).</p>' +
      '<h3 class="panel-h">Sistem yazı rengi</h3>' + sysColorHtml() +
      '<p class="muted pad">Çip, logo, ad, numara, kod ve QR sistem öğeleridir: silinemez, gizlenemez, dekoratif katmanların arkasına alınamaz. Konumlarını ve boyutlarını sahnede seçerek değiştirebilirsin.</p>';
  }

  /* ---------- sağ panel ---------- */
  const numField = (label, k, v, min, max, step, dis) =>
    `<label class="f"><span>${label}</span><input type="number" data-k="${k}" value="${r1(v)}" min="${min}" max="${max}" step="${step}" inputmode="decimal"${dis}></label>`;
  const rangeField = (label, k, v, min, max, step, dis) =>
    `<label class="f"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-k="${k}" aria-label="${label}"${dis}><input type="number" class="tiny" data-k="${k}" value="${r1(v)}" min="${min}" max="${max}" step="${step}"${dis}></label>`;
  const colorField = (label, key, val, dis, noneOk) =>
    `<div class="f color"><span>${label}</span><input type="color" data-c="${key}" value="${val === 'none' || val === 'auto' ? '#ffffff' : val.toLowerCase()}" aria-label="${label}"${dis}>` +
    (noneOk ? `<label class="mini"><input type="checkbox" data-none="${key}"${val === 'none' || val === 'auto' ? ' checked' : ''}${dis}> ${noneOk === 'auto' ? 'Otomatik' : 'Yok'}</label>` : '') + '</div>';
  const seg = (items, cur, attr) => '<div class="seg" role="group">' + items.map(i => `<button type="button" data-${attr}="${i[0]}" aria-pressed="${cur === i[0]}">${i[1]}</button>`).join('') + '</div>';

  function sysColorHtml() {
    const cur = E.design.sysStyle.color, t = X.tone(E.design), ratio = X.contrast(t.brand, t.avg);
    return '<div class="sw-row">' + `<button type="button" class="chipbtn${cur === 'auto' ? ' on' : ''}" data-scolor="auto">Otomatik</button>` +
      L.NAME_COLORS.map(c => `<button type="button" class="sw sm${cur.toLowerCase() === c.toLowerCase() ? ' on' : ''}" data-scolor="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') + '</div>' +
      colorField('Özel renk', 'scustom', t.brand, '', false) + `<p class="${ratio < 3 ? 'warn' : 'muted'} pad">Logo, numara ve kod okunabilirliği: ${ratio.toFixed(1)}:1${ratio < 3 ? ' — düşük' : ''}</p>`;
  }
  function renderProps() {
    const box = el.props, l = selL(), sk = selSys();
    if (sk) { box.innerHTML = sysProps(sk); return; }
    if (!l) { box.innerHTML = '<p class="muted pad">Sahnede bir nesne seç ya da soldan parça ekle. Çip, logo, ad, kod ve QR\'ı seçerek konumunu ve boyutunu değiştirebilirsin; bunlar sistem tarafından korunur.</p>'; return; }
    box.innerHTML = l.type === 'background' ? bgProps(l) : shapeProps(l);
  }
  function sysProps(k) {
    const m = R.SYS[k], e = E.design.sys[k];
    let h = `<h3 class="panel-h">${ic('shield')} ${m.label}</h3><p class="lockinfo">${ic('lock')}<span>Sistem öğesi: silinemez, gizlenemez, dekoratif katmanların üstünde kalır ve kart dışına çıkamaz.</span></p>`;
    h += '<div class="grid2">' + `<label class="f"><span>X</span><input type="number" data-s="x" value="${r1(e.x)}" step="1"></label><label class="f"><span>Y</span><input type="number" data-s="y" value="${r1(e.y)}" step="1"></label></div>`;
    h += `<label class="f"><span>Boyut</span><input type="range" min="${Math.round(m.min * 100)}" max="${Math.round(m.max * 100)}" step="5" value="${Math.round(e.scale * 100)}" data-s="scale" aria-label="Boyut"><input type="number" class="tiny" data-s="scale" value="${Math.round(e.scale * 100)}" min="${Math.round(m.min * 100)}" max="${Math.round(m.max * 100)}"></label>`;
    h += '<div class="row"><button type="button" class="btn sm" data-sysreset="1">Varsayılan konuma dön</button></div>';
    if (k === 'name') h += nameColorHtml();
    if (k === 'brand' || k === 'code' || k === 'number') h += '<h3 class="panel-h">Yazı rengi</h3>' + sysColorHtml();
    if (k === 'chip') h += '<h3 class="panel-h">Çip görünümü</h3><div class="chip-grid">' + L.CHIPS.map(c => `<button type="button" class="opt chip${E.design.chipStyle === c.id ? ' on' : ''}" data-chip="${c.id}">${X.chipSvg(c.id)}<b>${c.n}</b></button>`).join('') + '</div>';
    if (k === 'qr') h += '<h3 class="panel-h">Görünüm</h3>' + seg([['tint', 'Kompakt plaka'], ['icon', 'Gizli simge']], E.design.qrStyle, 'qrstyle') +
      '<div class="row"><button type="button" class="btn sm" data-qrbig="1">QR\'yi büyüt</button></div><p class="muted pad">QR yalnızca sanal kart kimliğini taşır; taranabilirliği korunur.</p>';
    return h;
  }
  function nameColorHtml() {
    const cur = E.design.nameStyle.color, t = X.tone(E.design), ratio = X.contrast(t.name, t.avg);
    return '<h3 class="panel-h">Ad rengi</h3><div class="sw-row">' +
      `<button type="button" class="chipbtn${cur === 'auto' ? ' on' : ''}" data-ncolor="auto">Otomatik</button>` +
      L.NAME_COLORS.map(c => `<button type="button" class="sw sm${cur.toLowerCase() === c.toLowerCase() ? ' on' : ''}" data-ncolor="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') +
      '</div>' + colorField('Özel renk', 'ncustom', t.name, '', false) +
      `<p class="${ratio < 3 || t.nameFallback ? 'warn' : 'muted'} pad">Okunabilirlik: ${ratio.toFixed(1)}:1${ratio < 3 ? ' — düşük' : ''}</p>` +
      (t.nameFallback ? '<p class="warn pad">Seçtiğin renk zeminde okunamadığı için otomatik renk kullanılıyor. Kaydetmek için okunaklı bir renk seç.</p>' : '');
  }
  function bgProps(l) {
    const p = l.properties;
    let h = '<h3 class="panel-h">Kart zemini</h3>' + seg([['solid', 'Düz'], ['gradient', 'Gradient']], p.mode, 'bgmode');
    h += '<div class="colors">' + p.colors.map((c, i) => colorField('Renk ' + (i + 1), 'bgc' + i, c, '', false)).join('') + '</div>';
    if (p.mode === 'gradient') {
      h += '<div class="row">' + (p.colors.length < R.MAX_BG_COLORS ? '<button type="button" class="btn sm" data-bgadd="1">Renk durağı ekle</button>' : '') +
        (p.colors.length > 2 ? '<button type="button" class="btn sm" data-bgadd="-1">Son rengi çıkar</button>' : '') + '</div>';
      h += `<label class="f"><span>Açı</span><input type="range" min="0" max="360" step="5" value="${p.angle}" data-bga aria-label="Gradient açısı"><output>${Math.round(p.angle)}°</output></label>`;
    }
    h += '<h3 class="panel-h">Yüzey</h3>' + seg(L.FINISHES.map(f => [f.id, f.n]), p.finish, 'finishp');
    h += '<h3 class="panel-h">Doku</h3>' + seg(L.TEXTURES.map(f => [f.id, f.n]), p.texture || 'none', 'texp');
    if (p.texture && p.texture !== 'none') h += `<label class="f"><span>Yoğunluk</span><input type="range" min="0" max="100" value="${Math.round((p.textureOpacity == null ? 0.5 : p.textureOpacity) * 100)}" data-bgt aria-label="Doku yoğunluğu"><output>${Math.round((p.textureOpacity == null ? 0.5 : p.textureOpacity) * 100)}%</output></label>`;
    return h + '<p class="muted pad">Zemin her zaman diğer katmanların altındadır; silinemez ve taşınamaz.</p>';
  }
  function shapeProps(l) {
    const p = l.properties, dis = l.locked ? ' disabled' : '', so = R.STROKE_ONLY.has(p.kind), nex = p.kind === 'nexus', light = R.LIGHT_KINDS.indexOf(p.kind) >= 0;
    let h = `<h3 class="panel-h">${esc(l.name)}${l.locked ? ' · kilitli' : ''}</h3>`;
    h += `<label class="f wide"><span>Katman adı</span><input type="text" data-nm value="${esc(l.name)}" maxlength="24"${dis}></label>`;
    h += '<div class="grid2">' + numField('X', 'x', p.x, -1500, 2500, 1, dis) + numField('Y', 'y', p.y, -1500, 2500, 1, dis) +
      numField('Genişlik', 'width', p.width, 8, 1500, 1, dis) + numField('Yükseklik', 'height', p.height, 8, 1500, 1, dis) + '</div>';
    h += rangeField('Dönüş', 'rotation', p.rotation, -180, 180, 1, dis);
    h += `<div class="row"><button type="button" class="btn sm" data-act="rotby" data-v="-15"${dis}>−15°</button><button type="button" class="btn sm" data-act="rotby" data-v="15"${dis}>+15°</button><button type="button" class="btn sm" data-act="rotto" data-v="0"${dis}>0°</button><button type="button" class="btn sm" data-act="rotto" data-v="45"${dis}>45°</button><button type="button" class="btn sm" data-act="rotto" data-v="90"${dis}>90°</button></div>`;
    h += rangeField('Opaklık', 'opacity', Math.round(p.opacity * 100), 0, 100, 1, dis);
    if (!so) h += colorField(light ? 'Işık rengi' : 'Dolgu', 'fill', p.fill, dis, light ? false : true);
    if (!nex && !light) { h += colorField('Kenarlık', 'stroke', p.stroke, dis, !so); h += rangeField('Kenarlık kalınlığı', 'strokeWidth', p.strokeWidth, 0, 40, 0.5, dis); }
    if (R.RADIUS_KINDS.indexOf(p.kind) >= 0) h += rangeField('Köşe yuvarlaklığı', 'radius', p.radius, 0, 100, 1, dis);
    if (!light) {
      h += '<h3 class="panel-h">Efektler</h3>' + rangeField('Gölge', 'shadow', p.shadow, 0, 40, 1, dis) + rangeField('Parlama', 'glow', p.glow, 0, 40, 1, dis);
      if (p.glow > 0) h += colorField('Parlama rengi', 'glowColor', p.glowColor, dis, 'auto');
      h += '<div class="row">' + L.OBJ_EFFECTS.map(f => `<label class="check"><input type="checkbox" data-fx="${f.id}"${p.effects.indexOf(f.id) >= 0 ? ' checked' : ''}${dis}> ${f.n}</label>`).join('') + '</div>';
    }
    h += `<div class="row"><button type="button" class="btn sm" data-act="flipx"${dis}>Yatay çevir</button><button type="button" class="btn sm" data-act="flipy"${dis}>Dikey çevir</button></div>`;
    h += `<label class="check"><input type="checkbox" data-ratio${p.lockRatio ? ' checked' : ''}${dis}> Oranı koru</label>`;
    h += '<div class="row"><button type="button" class="btn sm" data-act="dup">Kopyala</button><button type="button" class="btn sm danger" data-act="del">Sil</button></div>';
    h += '<p class="muted pad">Bu öğe serbesttir; sistem bilgilerinin üstüne taşınsa bile onları kapatmaz.</p>';
    return h;
  }
  function syncInputs() {
    const l = selL(), sk = selSys();
    if (sk) {
      const e = E.design.sys[sk];
      el.props.querySelectorAll('[data-s]').forEach(i => { if (i === document.activeElement) return; const k = i.dataset.s; i.value = k === 'scale' ? Math.round(e.scale * 100) : r1(e[k]); });
      return;
    }
    if (!l || l.type === 'background') return;
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
    else if (k === 'radius') p.radius = clamp(v, 0, 100);
    else if (k === 'shadow' || k === 'glow') p[k] = clamp(v, 0, 40);
  }
  function applySysNum(k, field, raw) {
    const v = Number(raw); if (raw === '' || !isFinite(v)) return;
    const e = clone(E.design.sys[k]);
    if (field === 'scale') e.scale = v / 100; else e[field] = v;
    const ok = trySys(k, e);
    if (!ok) { toast('Bu değer başka bir sistem öğesini kapatacağı için uygulanmadı.'); return; }
    snap('s' + k + field); E.design.sys[k] = ok; stageChanged(); syncInputs();
  }

  function onPropsInput(e) {
    const t = e.target, l = selL();
    if (t.dataset.c === 'ncustom') { snap('ncol'); E.design.nameStyle.color = t.value.toUpperCase(); stageChanged(); return; }
    if (t.dataset.c === 'scustom') { snap('scol'); E.design.sysStyle.color = t.value.toUpperCase(); stageChanged(); return; }
    if (t.dataset.s) { applySysNum(selSys(), t.dataset.s, t.value); return; }
    if (E.sel === 'bg') {
      const b = X.bgLayer(E.design);
      if (t.dataset.c) { const i = Number(t.dataset.c.replace('bgc', '')); snap('bgc' + i); b.properties.colors[i] = t.value.toUpperCase(); stageChanged(); }
      else if (t.dataset.bga !== undefined) { snap('bga'); b.properties.angle = Number(t.value); const out = t.parentElement.querySelector('output'); if (out) out.textContent = Math.round(b.properties.angle) + '°'; stageChanged(); }
      else if (t.dataset.bgt !== undefined) { snap('bgt'); b.properties.textureOpacity = Number(t.value) / 100; const out = t.parentElement.querySelector('output'); if (out) out.textContent = Math.round(Number(t.value)) + '%'; stageChanged(); }
      return;
    }
    if (!l) return;
    if (t.dataset.k) { snap('k' + l.id + t.dataset.k); applyNum(l, t.dataset.k, t.value); stageChanged(); syncInputs(); }
    else if (t.dataset.c) { snap('c' + l.id + t.dataset.c); l.properties[t.dataset.c] = t.value.toUpperCase(); stageChanged(); }
    else if (t.dataset.nm !== undefined) { snap('nm' + l.id); l.name = t.value.replace(/[<>&"]/g, '').slice(0, 24) || 'Katman'; renderLayers(); scheduleDraft(); syncDirtyUi(); }
  }
  function onPropsChange(e) {
    const t = e.target, l = selL();
    if (t.dataset.k) { fullChanged(); return; }
    if (!l) return;
    if (t.dataset.fx) {
      snap(); const fx = l.properties.effects, i = fx.indexOf(t.dataset.fx);
      if (t.checked && i < 0) fx.push(t.dataset.fx); else if (!t.checked && i >= 0) fx.splice(i, 1);
      stageChanged(); return;
    }
    if (t.dataset.ratio !== undefined) { snap(); l.properties.lockRatio = t.checked; stageChanged(); return; }
    if (t.dataset.none) {
      snap(); const k = t.dataset.none, p = l.properties;
      if (k === 'glowColor') p.glowColor = t.checked ? 'auto' : (t.parentElement.parentElement.querySelector('input[type=color]').value || '#ffffff').toUpperCase();
      else if (t.checked) p[k] = 'none';
      else { p[k] = (t.parentElement.parentElement.querySelector('input[type=color]').value || '#ffffff').toUpperCase(); if (k === 'stroke' && !p.strokeWidth) p.strokeWidth = 2; }
      fullChanged();
    }
  }
  function setQrStyle(v) {
    if (E.design.qrStyle === v) return;
    snap(); E.design.qrStyle = v;
    const q = trySys('qr', E.design.sys.qr);
    if (q) E.design.sys.qr = q; else { E.design.sys.qr = R.sysFix('qr', R.sysDefaults(E.design.orientation).qr, E.design.orientation, v); toast('QR görünümü değişince çakışmayı önlemek için varsayılan konuma alındı.'); }
    fullChanged();
  }
  function onPropsClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const l = selL(), d = b.dataset;
    if (d.ncolor) { snap(); E.design.nameStyle.color = d.ncolor === 'auto' ? 'auto' : d.ncolor.toUpperCase(); fullChanged(); return; }
    if (d.scolor) { snap(); E.design.sysStyle.color = d.scolor === 'auto' ? 'auto' : d.scolor.toUpperCase(); fullChanged(); return; }
    if (d.chip) { snap(); E.design.chipStyle = d.chip; fullChanged(); return; }
    if (d.qrstyle) { setQrStyle(d.qrstyle); return; }
    if (d.qrbig) { openQr(); return; }
    if (d.sysreset) { const k = selSys(), df = R.sysDefaults(E.design.orientation)[k], ok = trySys(k, df); snap(); E.design.sys[k] = ok || R.sysFix(k, df, E.design.orientation, E.design.qrStyle); fullChanged(); return; }
    if (E.sel === 'bg') {
      const p = X.bgLayer(E.design).properties;
      if (d.bgmode) { snap(); p.mode = d.bgmode; if (p.mode === 'gradient' && p.colors.length < 2) p.colors.push('#3A3F52'); fullChanged(); }
      else if (d.bgadd) {
        snap();
        if (d.bgadd === '1' && p.colors.length < R.MAX_BG_COLORS) p.colors.push(p.colors[p.colors.length - 1]);
        else if (d.bgadd === '-1' && p.colors.length > 2) p.colors.pop();
        fullChanged();
      } else if (d.finishp) { snap(); p.finish = d.finishp; fullChanged(); }
      else if (d.texp) { snap(); p.texture = d.texp; fullChanged(); }
      return;
    }
    if (!l) return;
    if (d.act) act(d.act, l.id, d.v != null ? Number(d.v) : undefined);
  }
  function openQr() {
    const tok = (E.system && E.system.cardToken) || 'NXC-PREVIEW1';
    ask('Kart QR kodu', X.qrSvg(tok, { size: 300, cls: 'qr-big' }) + '<p>' + (E.system && E.system.cardToken ? 'Bu QR yalnızca sanal kart kimliğini taşır.' : 'Önizleme: kart kaydedildiğinde gerçek kart kodunu taşır.') + '</p>', [{ id: 'ok', label: 'Kapat', primary: true }]);
  }

  /* ---------- alt panel: katmanlar ---------- */
  function thumb(l) {
    const p = l.properties, col = p.fill !== 'none' ? p.fill : (p.stroke !== 'none' ? p.stroke : '#999999');
    return `<svg viewBox="-4 -4 108 108" aria-hidden="true">${X.shapeInner(p.kind, { fill: col, stroke: p.stroke !== 'none' ? p.stroke : col, strokeWidth: p.strokeWidth || 3, effects: [] })}</svg>`;
  }
  function renderLayers() {
    const ls = E.design.layers;
    let sysH = `<div class="lcol"><h3 class="lh">${ic('shield')} Sistem katmanı <small>her zaman en üstte · korumalı</small></h3>`;
    R.SYS_GROUPS.forEach(g => {
      sysH += `<div class="lgroup"><h4>${g.label}</h4>`;
      R.SYS_KEYS.filter(k => R.SYS[k].group === g.id).forEach(k => {
        sysH += `<div class="lrow sys${E.sel === 'sys:' + k ? ' sel' : ''}" data-sel="sys:${k}" title="Sistem tarafından korunur: silinemez, gizlenemez, sırası değişmez">${ic('lock')}<span class="lname">${R.SYS[k].label}</span><span class="tag">korumalı</span></div>`;
      });
      sysH += '</div>';
    });
    sysH += '</div>';
    let dec = '<div class="lcol"><h3 class="lh">Dekoratif öğeler <small>serbest yerleşim · sıralanabilir</small></h3><ul class="layers" id="deco-list">';
    if (ls.length < 2) dec += '<li class="empty-l">Henüz dekoratif öğe yok. Soldan şekil, desen veya ışık ekle.</li>';
    for (let i = ls.length - 1; i >= 1; i--) {
      const l = ls[i], id = l.id;
      const btn = (a, icn, label, dis) => `<button type="button" class="ib" data-lact="${a}" data-id="${id}" aria-label="${label}" title="${label}"${dis ? ' disabled' : ''}>${ic(icn)}</button>`;
      dec += `<li class="lrow dec${E.sel === id ? ' sel' : ''}${l.visible ? '' : ' hid'}" data-id="${id}" draggable="true">` +
        `<span class="grip" aria-hidden="true">${ic('grip')}</span><span class="thumb">${thumb(l)}</span><span class="lname">${esc(l.name)}</span><span class="lacts">` +
        btn('vis', l.visible ? 'eye' : 'eyeOff', l.visible ? 'Gizle' : 'Göster') + btn('lock', l.locked ? 'lock' : 'unlock', l.locked ? 'Kilidi aç' : 'Kilitle') +
        btn('front', 'front', 'En öne getir', i === ls.length - 1) + btn('fwd', 'up', 'Bir kademe öne', i === ls.length - 1) +
        btn('bwd', 'down', 'Bir kademe arkaya', i === 1) + btn('back', 'back', 'En arkaya gönder', i === 1) +
        btn('dup', 'copy', 'Kopyala') + btn('del', 'trash', 'Sil') + '</span></li>';
    }
    dec += `</ul><div class="lgroup"><h4>Arka plan</h4><div class="lrow bgrow${E.sel === 'bg' ? ' sel' : ''}" data-sel="bg">${ic('lock')}<span class="lname">Kart zemini ve dokular</span><span class="tag">en altta · kilitli</span></div></div></div>`;
    el.layers.innerHTML = '<div class="layers-wrap">' + sysH + dec + '</div>';
  }
  function onLayersClick(e) {
    const b = e.target.closest('[data-lact]');
    if (b) { act(b.dataset.lact, b.dataset.id); return; }
    const row = e.target.closest('.lrow'); if (!row) return;
    if (row.dataset.sel) select(row.dataset.sel);
    else if (row.dataset.id) select(row.dataset.id);
  }
  function dropPos(e, row) { const r = row.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 ? 'top' : 'bottom'; }
  function onLayerDragStart(e) {
    const row = e.target.closest && e.target.closest('.dec'); if (!row) return;
    E.layerDrag = row.dataset.id; e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', row.dataset.id); } catch (x) {}
  }
  function onLayerDragOver(e) {
    if (!E.layerDrag) return;
    const row = e.target.closest('.dec'); if (!row) return;
    e.preventDefault();
    el.layers.querySelectorAll('.over-top,.over-bottom').forEach(n => n.classList.remove('over-top', 'over-bottom'));
    row.classList.add('over-' + dropPos(e, row));
  }
  function onLayerDrop(e) {
    const row = e.target.closest('.dec'); if (!row || !E.layerDrag) return;
    e.preventDefault();
    const ls = E.design.layers, from = ls.findIndex(l => l.id === E.layerDrag);
    if (from > 0 && row.dataset.id !== E.layerDrag) {
      const pos = dropPos(e, row);
      snap(); const l = ls.splice(from, 1)[0], t = ls.findIndex(x => x.id === row.dataset.id);
      ls.splice(pos === 'top' ? t + 1 : t, 0, l);   // listede üstte = dizide sonra; zemin (0) hiçbir zaman değişmez
    }
    E.layerDrag = null; fullChanged();
  }

  /* ---------- kaydet, çık, sıfırla ---------- */
  let saving = false;
  async function save() {
    if (saving) return;
    const res = R.validateDesign(E.design);
    if (!res.ok) { E.errors = res.errors; renderMsg(); setStatus('error', 'Kaydedilemedi — kuralları kontrol et'); return; }
    const out = res.design;
    let final = out;
    if (E.opts && E.opts.persist) {
      saving = true; $('#ed-save').disabled = true; setStatus('draft', 'Kaydediliyor…');
      try { final = (await E.opts.persist(out)) || out; }
      catch (e) {
        E.errors = e.errors && e.errors.length ? e.errors : [e.message || 'Kaydedilemedi.']; renderMsg();
        setStatus('error', e.offline ? 'Bağlantı yok — taslak bu cihazda korunuyor' : 'Kaydedilemedi'); return;
      } finally { saving = false; $('#ed-save').disabled = false; }
      if (E.opts) E.opts.isNew = false;
    } else {
      out.version = (E.saved.version || 0) + 1;
      try { localStorage.setItem('fnx.design', JSON.stringify(out)); localStorage.removeItem(draftKey()); }
      catch (e) { setStatus('error', 'Kayıt başarısız — tarayıcı depolaması kullanılamıyor'); return; }
    }
    clearTimeout(E.draftTimer); clearDraft();
    E.design = norm(final); E.saved = clone(E.design); E.savedJson = dirtyKey(E.design); E.errors = [];
    fullChanged(); toast('Kartın kaydedildi.');
    if (E.opts && E.opts.onSave) E.opts.onSave(final);
  }
  async function exit() {
    if (isDirty()) {
      const a = await ask('Kaydedilmemiş değişiklikler var', 'Çıkarsan değişikliklerin taslak olarak bu cihazda kalır, karta işlenmez.', [{ id: 'stay', label: 'Düzenlemeye devam et', primary: true }, { id: 'leave', label: 'Kaydetmeden çık' }]);
      if (a !== 'leave') return;
    }
    E.active = false;
    if (E.opts && E.opts.onExit) E.opts.onExit();
  }
  async function reset() {
    if (!isDirty()) { toast('Kayıtlı tasarımdan farklı bir değişiklik yok.'); return; }
    const a = await ask('Son kaydedilen tasarıma dön', 'Kaydedilmemiş tüm değişikliklerin geri alınır. Bu işlemi geri alabilirsin (Ctrl+Z).', [{ id: 'go', label: 'Sıfırla', primary: true }, { id: null, label: 'Vazgeç' }]);
    if (a !== 'go') return;
    snap(); E.design = clone(E.saved); E.sel = null; el.name.value = E.design.userDisplayName; syncOrient(); renderAll();
  }

  /* ---------- klavye ---------- */
  function onKey(e) {
    if (!E.active || !$('#ed-modal').hidden) return;
    const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (typing) return;
    if (e.key === 'Escape') { select(null); return; }
    const sk = selSys(), l = selL();
    const step = e.shiftKey ? 10 : 1, ar = e.key.indexOf('Arrow') === 0;
    if (sk && ar) {
      e.preventDefault();
      const c = clone(E.design.sys[sk]);
      if (e.key === 'ArrowLeft') c.x -= step; if (e.key === 'ArrowRight') c.x += step;
      if (e.key === 'ArrowUp') c.y -= step; if (e.key === 'ArrowDown') c.y += step;
      const ok = trySys(sk, c); if (ok) { snap('nudge' + sk); E.design.sys[sk] = ok; stageChanged(); syncInputs(); }
      return;
    }
    if (!l || l.locked) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('del', l.id); }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); act('dup', l.id); }
    else if (ar) {
      e.preventDefault(); const p = l.properties; snap('nudge' + l.id);
      if (e.key === 'ArrowLeft') p.x -= step; if (e.key === 'ArrowRight') p.x += step;
      if (e.key === 'ArrowUp') p.y -= step; if (e.key === 'ArrowDown') p.y += step;
      stageChanged(); syncInputs();
    }
  }

  /* ---------- kurulum ---------- */
  function init() {
    if (E.bound) return; E.bound = true;
    el = {
      svg: $('#ed-svg'), canvas: $('#ed-canvas'), msg: $('#ed-msg'), status: $('#ed-status'), name: $('#ed-name'),
      nameErr: $('#ed-name-err'), nameCount: $('#ed-name-count'), props: $('#ed-props'), layers: $('#ed-layers'),
      lib: $('#lib-content'), tabs: $('#lib-tabs'), undo: $('#ed-undo'), redo: $('#ed-redo'), preview: $('#ed-preview'), body: $('#ed-body'),
      orient: $('#ed-orient'), dot: $('#ed-dot')
    };
    el.svg.addEventListener('pointerdown', onDown);
    el.svg.addEventListener('pointermove', onMove);
    el.svg.addEventListener('pointerup', onUp);
    el.svg.addEventListener('pointercancel', onUp);
    el.props.addEventListener('input', onPropsInput);
    el.props.addEventListener('change', onPropsChange);
    el.props.addEventListener('click', onPropsClick);
    el.layers.addEventListener('click', onLayersClick);
    el.layers.addEventListener('dragstart', onLayerDragStart);
    el.layers.addEventListener('dragover', onLayerDragOver);
    el.layers.addEventListener('drop', onLayerDrop);
    el.layers.addEventListener('dragend', () => { E.layerDrag = null; renderLayers(); });
    el.lib.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.tpl) applyTemplate(d.tpl);
      else if (d.bgp) applyBg(Number(d.bgp));
      else if (d.add) addShape(d.add);
      else if (d.lc) { E.lightColor = d.lc; renderLib(); }
      else if (d.finish) { snap(); X.bgLayer(E.design).properties.finish = d.finish; fullChanged(); }
      else if (d.texture) { snap(); X.bgLayer(E.design).properties.texture = d.texture; fullChanged(); }
      else if (d.chip) { snap(); E.design.chipStyle = d.chip; fullChanged(); }
      else if (d.qrstyle) setQrStyle(d.qrstyle);
      else if (d.scolor) { snap(); E.design.sysStyle.color = d.scolor === 'auto' ? 'auto' : d.scolor.toUpperCase(); fullChanged(); }
    });
    el.lib.addEventListener('input', e => { if (e.target.dataset.c === 'scustom') { snap('scol'); E.design.sysStyle.color = e.target.value.toUpperCase(); stageChanged(); } });
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
    el.name.addEventListener('focus', () => { if (E.sel !== 'sys:name') select('sys:name'); });
    $('#ed-zones').addEventListener('change', e => { E.zones = e.target.checked; renderStage(); });
    $('#ed-snap').addEventListener('change', e => { E.snap = e.target.checked; });
    el.orient.addEventListener('click', e => { const b = e.target.closest('[data-orient]'); if (b) setOrientation(b.dataset.orient); });
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
    if (root.ResizeObserver) new ResizeObserver(() => { if (E.active) renderStage(); }).observe(el.canvas);
    window.addEventListener('beforeunload', e => { if (E.active && E.design && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('offline', () => { if (E.active) setStatus('error', 'Bağlantı yok — taslak bu cihazda korunuyor'); });
    window.addEventListener('online', () => { if (E.active) setStatus('draft', 'Bağlantı geri geldi'); });
  }

  function open(o) {
    init();
    E.opts = o; E.system = o.system;
    E.saved = norm(o.saved); E.savedJson = dirtyKey(E.saved);
    E.design = norm(o.draft || o.saved);
    E.sel = null; E.undo = []; E.redo = []; E.errors = []; E.preview = false; E.zones = false; E.active = true; E.tab = 'tpl'; E.drag = null; E.guides = [];
    $('#ed-zones').checked = false; $('#ed-snap').checked = E.snap;
    el.preview.setAttribute('aria-pressed', 'false'); el.preview.textContent = 'Önizle';
    el.name.value = E.design.userDisplayName; el.nameErr.textContent = '';
    syncOrient(); renderAll();
    if (o.draft) { setStatus('dirty', 'Kaydedilmemiş taslak açıldı'); toast('Kaydedilmemiş taslağın açıldı.'); }
    requestAnimationFrame(renderStage);
  }

  root.FNXEditor = { open: open, close: () => { E.active = false; clearTimeout(E.draftTimer); }, isActive: () => E.active, _state: E };
})(window);
