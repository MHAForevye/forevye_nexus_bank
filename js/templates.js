/* Hazır kart şablonları: 10 aile + eski "Dağ". Her şablonun YATAY ve DİKEY ayrı kompozisyonu vardır
 * (dikey, yatayın döndürülmüşü değildir). Şablon katmanlarının kimliği "tp_" ile başlar; böylece şablon değişiminde
 * kullanıcının eklediği katmanlar (l_...) korunabilir. */
(function (root) {
  'use strict';
  var R = root.FNXRules, L = root.FNXLib;
  var seq = 0;
  function uid() { return 'l_' + Date.now().toString(36) + (seq++).toString(36); }
  function tid() { return 'tp_' + (seq++).toString(36); }

  function sh(kind, x, y, w, h, p, name) {
    var so = R.STROKE_ONLY.has(kind);
    return {
      id: tid(), type: R.TEXTURE_KINDS.indexOf(kind) >= 0 ? 'texture' : R.LIGHT_KINDS.indexOf(kind) >= 0 ? 'light' : 'shape',
      name: name || L.LABELS[kind], locked: false, visible: true, zIndex: 0,
      properties: Object.assign({
        kind: kind, x: x, y: y, width: w, height: h, rotation: 0, opacity: 1,
        fill: so ? 'none' : '#FFFFFF', stroke: so ? '#FFFFFF' : 'none', strokeWidth: so ? 3 : 0,
        radius: kind === 'roundrect' ? 44 : 0, shadow: 0, glow: 0, glowColor: 'auto',
        flipX: false, flipY: false, lockRatio: false, effects: []
      }, p || {})
    };
  }
  // Kullanıcının eklediği katman: kimlik "l_" ile başlar (şablon değişiminde korunur).
  function userShape(kind, x, y, w, h, p, name) { var l = sh(kind, x, y, w, h, p, name); l.id = uid(); return l; }
  function bg(mode, colors, angle, finish, texture, tOp) {
    return { id: 'bg', type: 'background', name: 'Kart zemini', locked: true, visible: true, zIndex: 0,
      properties: { mode: mode, colors: colors, angle: angle, finish: finish, texture: texture || 'none', textureOpacity: tOp == null ? 0.5 : tOp } };
  }
  function base(id, o, layers, ex) {
    ex = ex || {};
    layers.forEach(function (l, i) { l.zIndex = i * 10; });
    var cv = R.canvasOf(o);
    return { designId: 'design_local', ownerId: 'local', template: id, orientation: o, canvas: { width: cv.width, height: cv.height },
      layers: layers, userDisplayName: 'PLAYER NAME', nameStyle: { color: 'auto' }, sysStyle: { color: ex.sysColor || 'auto' }, chipStyle: ex.chip || 'gold',
      qrStyle: ex.qr || 'tint', sys: R.sysDefaults(o), version: 1 };
  }

  var BUILD = {
    /* Classic — minimal, açık, sade: gümüş zemin, yumuşak ışık bantları */
    classic: function (o) {
      var P = o === 'portrait';
      return base('classic', o, [
        bg('gradient', ['#F2F3F8', '#D8DBE6', '#B9BFCF'], 135, 'satin'),
        sh('glow', P ? 160 : 420, P ? -120 : -170, P ? 520 : 600, P ? 520 : 600, { fill: '#FFFFFF', opacity: 0.75 }, 'Işık'),
        sh('beam', P ? -160 : 180, P ? 420 : 250, P ? 900 : 900, P ? 120 : 110, { rotation: P ? -52 : -34, fill: '#FFFFFF', opacity: 0.6 }, 'Işık bandı'),
        sh('beam', P ? -80 : 320, P ? 500 : 330, P ? 800 : 760, 36, { rotation: P ? -52 : -34, fill: '#FFFFFF', opacity: 0.7 }, 'İnce band'),
        sh('line', P ? -120 : 130, P ? 520 : 400, 900, 10, { rotation: P ? -52 : -34, stroke: '#9AA1B3', strokeWidth: 1.2, opacity: 0.7 }, 'Gümüş çizgi'),
        sh('nexus', P ? 190 : 520, P ? 300 : 190, P ? 320 : 290, P ? 242 : 220, { fill: '#8D95A8', opacity: 0.32, lockRatio: true }, 'Nexus filigranı')
      ], { chip: 'silver' });
    },
    /* Signature — siyah zemin, altın vurgular */
    signature: function (o) {
      var P = o === 'portrait', G = '#D8B36A';
      return base('signature', o, [
        bg('gradient', ['#050608', '#15110A', '#080808'], 150, 'glossy'),
        sh('glow', P ? 120 : 470, P ? 150 : 40, P ? 480 : 520, P ? 480 : 520, { fill: G, opacity: 0.16 }, 'Altın ışık'),
        sh('arc', P ? 120 : 430, P ? 250 : 80, P ? 520 : 520, P ? 520 : 520, { stroke: G, strokeWidth: 1.4, opacity: 0.85, rotation: P ? 20 : 0 }, 'Altın yay'),
        sh('arc', P ? 160 : 470, P ? 290 : 120, P ? 440 : 440, P ? 440 : 440, { stroke: G, strokeWidth: 0.8, opacity: 0.55, rotation: P ? 20 : 0 }, 'İnce yay'),
        sh('line', P ? -100 : 220, P ? 470 : 360, 900, 10, { rotation: P ? -55 : -36, stroke: G, strokeWidth: 1.6, opacity: 0.75 }, 'Altın çizgi'),
        sh('line', P ? -60 : 300, P ? 520 : 410, 900, 10, { rotation: P ? -55 : -36, stroke: G, strokeWidth: 0.8, opacity: 0.4 }, 'İnce çizgi'),
        sh('nexus', P ? 200 : 520, P ? 330 : 200, P ? 300 : 280, P ? 227 : 212, { fill: '#2A2314', opacity: 1, lockRatio: true, stroke: G, strokeWidth: 0 }, 'Nexus filigranı')
      ], { chip: 'gold' });
    },
    /* Creative — gradient, ışık ve dinamik akışlar */
    creative: function (o) {
      var P = o === 'portrait';
      return base('creative', o, [
        bg('gradient', ['#070B26', '#14187A', '#5A22C4', '#C0398F'], 140, 'glossy'),
        sh('stars', 0, 0, P ? 540 : 856, P ? 856 : 540, { fill: '#FFFFFF', opacity: 0.6 }, 'Yıldızlar'),
        sh('glow', P ? 200 : 520, P ? 80 : -60, P ? 520 : 560, P ? 520 : 560, { fill: '#7C5CFF', opacity: 0.55 }, 'Mor ışık'),
        sh('glow', P ? -140 : 120, P ? 420 : 240, P ? 560 : 620, P ? 560 : 620, { fill: '#2EA8FF', opacity: 0.4 }, 'Mavi ışık'),
        sh('wavelines', -20, P ? 380 : 250, P ? 580 : 900, P ? 260 : 270, { stroke: '#59B4FF', strokeWidth: 2.5, opacity: 0.9 }, 'Mavi akış'),
        sh('wavelines', -30, P ? 430 : 300, P ? 600 : 900, P ? 240 : 240, { stroke: '#FF7AD9', strokeWidth: 1.8, opacity: 0.8, flipY: true }, 'Pembe akış'),
        sh('beam', P ? -60 : 260, P ? 560 : 120, P ? 800 : 700, 60, { rotation: P ? -60 : -28, fill: '#BFA8FF', opacity: 0.5 }, 'Işık bandı')
      ], { chip: 'silver' });
    },
    /* Obsidian — koyu metalik, premium */
    obsidian: function (o) {
      var P = o === 'portrait';
      return base('obsidian', o, [
        bg('gradient', ['#08090C', '#1F222B', '#0A0B0E', '#2A2E39'], 135, 'chrome', 'brushed', 0.55),
        sh('beam', P ? -200 : 120, P ? 360 : 200, P ? 1000 : 980, P ? 150 : 140, { rotation: P ? -58 : -36, fill: '#C8D0E6', opacity: 0.2 }, 'Yansıma'),
        sh('ring', P ? 150 : 480, P ? 290 : 120, P ? 520 : 420, P ? 520 : 420, { stroke: '#8E97AD', strokeWidth: 1, opacity: 0.55 }, 'Halka'),
        sh('ring', P ? 190 : 520, P ? 330 : 160, P ? 440 : 340, P ? 440 : 340, { stroke: '#8E97AD', strokeWidth: 0.7, opacity: 0.35 }, 'İç halka'),
        sh('line', P ? -100 : 200, P ? 600 : 420, 1000, 10, { rotation: P ? -58 : -36, stroke: '#AEB6CB', strokeWidth: 1, opacity: 0.55 }, 'Metal çizgi'),
        sh('nexus', P ? 220 : 560, P ? 380 : 220, P ? 260 : 230, P ? 197 : 174, { fill: '#171920', opacity: 1, lockRatio: true, glow: 6, glowColor: '#6C7690' }, 'Nexus filigranı')
      ], { chip: 'titanium' });
    },
    /* Carbon — karbon fiber dokusu */
    carbon: function (o) {
      var P = o === 'portrait', A = '#FF4D3D';
      return base('carbon', o, [
        bg('gradient', ['#0C0C0E', '#18191D'], 150, 'glossy', 'carbon', 0.95),
        sh('beam', P ? -200 : 160, P ? 380 : 240, P ? 1000 : 940, P ? 120 : 100, { rotation: P ? -58 : -36, fill: '#FFFFFF', opacity: 0.12 }, 'Yansıma'),
        sh('rect', P ? -40 : 360, P ? 560 : -40, P ? 40 : 14, P ? 14 : 640, { fill: A, radius: 0, rotation: P ? 0 : 0, opacity: 0.95, glow: 8 }, 'Vurgu şeridi'),
        sh('line', P ? 0 : 300, P ? 548 : 20, P ? 540 : 600, 10, { rotation: P ? 0 : 90, stroke: '#FFFFFF', strokeWidth: 0.8, opacity: 0.3 }, 'İnce çizgi'),
        sh('nexus', P ? 240 : 560, P ? 360 : 220, P ? 240 : 230, P ? 182 : 174, { fill: '#2A2B31', opacity: 0.9, lockRatio: true }, 'Nexus filigranı')
      ], { chip: 'onyx', sysColor: 'auto' });
    },
    /* Aurora — renkli ışık geçişleri ve yansımalar */
    aurora: function (o) {
      var P = o === 'portrait';
      return base('aurora', o, [
        bg('gradient', ['#04141C', '#0A4D5C', '#1B7F6B', '#3B2A8F'], 120, 'holo'),
        sh('glow', P ? -120 : 380, P ? 100 : -140, P ? 560 : 620, P ? 560 : 620, { fill: '#46FFC8', opacity: 0.45 }, 'Yeşil ışık'),
        sh('glow', P ? 200 : 600, P ? 380 : 120, P ? 460 : 520, P ? 460 : 520, { fill: '#8F6BFF', opacity: 0.55 }, 'Mor ışık'),
        sh('glow', P ? -80 : 200, P ? 600 : 300, P ? 500 : 560, P ? 500 : 560, { fill: '#31B6FF', opacity: 0.4 }, 'Mavi ışık'),
        sh('wavelines', -20, P ? 300 : 180, P ? 600 : 900, P ? 320 : 340, { stroke: '#B8FFE9', strokeWidth: 1.6, opacity: 0.6 }, 'Işık dalgası'),
        sh('wavelines', -40, P ? 380 : 260, P ? 620 : 920, P ? 280 : 280, { stroke: '#CDB8FF', strokeWidth: 1.2, opacity: 0.5, flipY: true }, 'İkinci dalga'),
        sh('beam', P ? -80 : 220, P ? 520 : 150, P ? 800 : 760, 70, { rotation: P ? -62 : -30, fill: '#FFFFFF', opacity: 0.22 }, 'Yansıma')
      ], { chip: 'silver' });
    },
    /* Minimal — az öğeli, temiz */
    minimal: function (o) {
      var P = o === 'portrait';
      return base('minimal', o, [
        bg('solid', ['#F3F2EE'], 135, 'matte', 'grain', 0.35),
        sh('ring', P ? 230 : 560, P ? 330 : 170, P ? 360 : 300, P ? 360 : 300, { stroke: '#14161B', strokeWidth: 1, opacity: 0.55 }, 'Halka'),
        sh('circle', P ? 350 : 690, P ? 450 : 290, 26, 26, { fill: '#14161B', opacity: 0.9 }, 'Nokta')
      ], { chip: 'silver' });
    },
    /* Royal — lüks, metalik, zarif */
    royal: function (o) {
      var P = o === 'portrait', G = '#D8B36A';
      return base('royal', o, [
        bg('gradient', ['#14060F', '#4A1230', '#1A0714'], 135, 'foil', 'brushed', 0.35),
        sh('rays', P ? 40 : 400, P ? 220 : 40, P ? 560 : 520, P ? 560 : 520, { stroke: G, strokeWidth: 0.7, opacity: 0.32 }, 'Işınlar'),
        sh('rings', P ? 120 : 480, P ? 300 : 120, P ? 400 : 360, P ? 400 : 360, { stroke: G, strokeWidth: 0.9, opacity: 0.6 }, 'Halkalar'),
        sh('glow', P ? 160 : 520, P ? 340 : 160, P ? 320 : 280, P ? 320 : 280, { fill: G, opacity: 0.22 }, 'Altın ışık'),
        sh('diamond', P ? 275 : 625, P ? 415 : 255, 70, 70, { fill: 'none', stroke: G, strokeWidth: 1.4, opacity: 0.9, glow: 6 }, 'Elmas'),
        sh('line', P ? -80 : 160, P ? 640 : 440, 900, 10, { rotation: P ? -58 : -34, stroke: G, strokeWidth: 1.2, opacity: 0.55 }, 'Altın çizgi')
      ], { chip: 'gold' });
    },
    /* Titanium — gümüş ve titanyum yüzeyler */
    titanium: function (o) {
      var P = o === 'portrait';
      return base('titanium', o, [
        bg('gradient', ['#D5D8DE', '#8E949F', '#C4C8CF', '#6D727C'], 125, 'chrome', 'brushed', 0.7),
        sh('hexgrid', P ? 150 : 480, P ? 280 : 90, P ? 420 : 420, P ? 400 : 390, { stroke: '#FFFFFF', strokeWidth: 1, opacity: 0.4 }, 'Petek ağı'),
        sh('beam', P ? -200 : 160, P ? 420 : 250, P ? 1000 : 940, 110, { rotation: P ? -58 : -34, fill: '#FFFFFF', opacity: 0.5 }, 'Yansıma'),
        sh('line', P ? -100 : 200, P ? 600 : 420, 1000, 10, { rotation: P ? -58 : -34, stroke: '#4C515B', strokeWidth: 1, opacity: 0.5 }, 'Koyu çizgi'),
        sh('nexus', P ? 220 : 560, P ? 400 : 240, P ? 250 : 230, P ? 189 : 174, { fill: '#5B616C', opacity: 0.4, lockRatio: true }, 'Nexus filigranı')
      ], { chip: 'titanium' });
    },
    /* Phantom — koyu, gizemli, modern */
    phantom: function (o) {
      var P = o === 'portrait';
      return base('phantom', o, [
        bg('gradient', ['#050508', '#14121F', '#050508'], 150, 'satin', 'grain', 0.4),
        sh('glow', P ? 60 : 420, P ? 280 : 60, P ? 560 : 640, P ? 560 : 640, { fill: '#6D4BFF', opacity: 0.2 }, 'Mor sis'),
        sh('rings', P ? 100 : 460, P ? 300 : 100, P ? 440 : 400, P ? 440 : 400, { stroke: '#9B86FF', strokeWidth: 0.8, opacity: 0.4 }, 'Hayalet halkalar'),
        sh('nexus', P ? 190 : 530, P ? 380 : 210, P ? 320 : 290, P ? 242 : 220, { fill: 'none', stroke: '#9B86FF', strokeWidth: 0, opacity: 0.0, lockRatio: true }, 'Gizli filigran'),
        sh('beam', P ? -200 : 100, P ? 600 : 400, P ? 1000 : 900, 40, { rotation: P ? -58 : -34, fill: '#9B86FF', opacity: 0.35 }, 'Neon bant')
      ], { chip: 'onyx' });
    },
    /* Dağ — eski şablon (geriye dönük) */
    mountain: function (o) {
      var P = o === 'portrait';
      return base('mountain', o, [
        bg('gradient', ['#0A0B0F', '#2B2D35'], 160, 'matte'),
        sh('circle', P ? 250 : 560, P ? 60 : -90, P ? 380 : 470, P ? 380 : 470, { fill: '#E4E6EC', opacity: 0.16, lockRatio: true }, 'Ay'),
        sh('mountain', P ? -60 : 120, P ? 420 : 250, P ? 700 : 736, P ? 300 : 290, { fill: '#4A4D57', opacity: 0.8 }, 'Uzak dağ'),
        sh('mountain', P ? 180 : 420, P ? 380 : 205, P ? 420 : 520, P ? 340 : 335, { fill: '#1B1C22' }, 'Sağ zirve'),
        sh('mountain', P ? -80 : -40, P ? 500 : 300, P ? 640 : 780, P ? 356 : 240, { fill: '#14151A' }, 'Ön dağ')
      ], { chip: 'gold' });
    }
  };
  var META = {
    classic: { n: 'Classic', d: 'Minimal, açık ve sade' },
    signature: { n: 'Signature', d: 'Siyah zemin, altın vurgu' },
    creative: { n: 'Creative', d: 'Gradient, ışık, dinamik akış' },
    obsidian: { n: 'Obsidian', d: 'Koyu metalik, premium' },
    carbon: { n: 'Carbon', d: 'Karbon fiber dokusu' },
    aurora: { n: 'Aurora', d: 'Renkli ışık geçişleri' },
    minimal: { n: 'Minimal', d: 'Az öğeli, temiz' },
    royal: { n: 'Royal', d: 'Lüks, metalik, zarif' },
    titanium: { n: 'Titanium', d: 'Gümüş ve titanyum yüzey' },
    phantom: { n: 'Phantom', d: 'Koyu, gizemli, modern' },
    mountain: { n: 'Dağ', d: 'Monokrom manzara' }
  };
  function get(id, orientation) { return (BUILD[id] || BUILD.classic)(orientation === 'portrait' ? 'portrait' : 'landscape'); }
  function isTemplateLayer(l) { return typeof l.id === 'string' && l.id.indexOf('tp_') === 0; }
  root.FNXTemplates = { get: get, META: META, uid: uid, sh: sh, userShape: userShape, isTemplateLayer: isTemplateLayer };
})(typeof window !== 'undefined' ? window : globalThis);
