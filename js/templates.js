/* Hazır kart şablonları: Classic, Signature, Creative ve Dağ (monokrom). */
(function (root) {
  'use strict';
  var R = root.FNXRules, L = root.FNXLib;
  var seq = 0;
  function uid() { return 'l_' + Date.now().toString(36) + (seq++).toString(36); }

  function sh(kind, x, y, w, h, p, name) {
    var so = R.STROKE_ONLY.has(kind);
    return {
      id: uid(), type: R.TEXTURE_KINDS.indexOf(kind) >= 0 ? 'texture' : 'shape', name: name || L.LABELS[kind],
      locked: false, visible: true, zIndex: 0,
      properties: Object.assign({
        kind: kind, x: x, y: y, width: w, height: h, rotation: 0, opacity: 1,
        fill: so ? 'none' : '#FFFFFF', stroke: so ? '#FFFFFF' : 'none', strokeWidth: so ? 3 : 0,
        flipX: false, flipY: false, lockRatio: false, effects: []
      }, p || {})
    };
  }
  function bg(mode, colors, angle, finish) {
    return { id: 'bg', type: 'background', name: 'Kart zemini', locked: true, visible: true, zIndex: 0,
      properties: { mode: mode, colors: colors, angle: angle, finish: finish } };
  }
  function base(id, layers, chip) {
    layers.forEach(function (l, i) { l.zIndex = i * 10; });
    return { designId: 'design_local', ownerId: 'local', template: id, canvas: { width: 856, height: 540 },
      layers: layers, userDisplayName: 'PLAYER NAME', nameStyle: { color: 'auto' }, chipStyle: chip || 'gold', version: 1 };
  }

  var BUILD = {
    classic: function () {
      return base('classic', [
        bg('gradient', ['#ECEEF5', '#C7CBD8'], 135, 'glossy'),
        sh('line', 300, 250, 760, 20, { rotation: -40, stroke: '#FFFFFF', strokeWidth: 44, opacity: 0.28 }, 'Işık bandı'),
        sh('line', 390, 300, 760, 20, { rotation: -40, stroke: '#FFFFFF', strokeWidth: 10, opacity: 0.4 }, 'İnce band'),
        sh('line', 210, 360, 760, 20, { rotation: -40, stroke: '#AEB3C2', strokeWidth: 3, opacity: 0.55 }, 'Gümüş çizgi'),
        sh('nexus', 505, 205, 300, 227, { fill: '#9097A6', opacity: 0.55, lockRatio: true })
      ]);
    },
    signature: function () {
      return base('signature', [
        bg('gradient', ['#06070A', '#17130B'], 150, 'glossy'),
        sh('line', 260, 230, 800, 20, { rotation: -38, stroke: '#D8B36A', strokeWidth: 60, opacity: 0.06 }, 'Altın parıltı'),
        sh('line', 270, 262, 800, 20, { rotation: -38, stroke: '#D8B36A', strokeWidth: 2, opacity: 0.9 }, 'Altın çizgi'),
        sh('line', 330, 300, 800, 20, { rotation: -38, stroke: '#D8B36A', strokeWidth: 1, opacity: 0.5 }, 'İnce çizgi'),
        sh('nexus', 505, 205, 300, 227, { fill: '#2A2314', opacity: 1, lockRatio: true })
      ]);
    },
    creative: function () {
      return base('creative', [
        bg('gradient', ['#070B26', '#14187A', '#5A22C4'], 140, 'glossy'),
        sh('stars', 0, 0, 856, 540, { fill: '#FFFFFF', opacity: 0.7, lockRatio: false }, 'Yıldızlar'),
        sh('nexus', 505, 205, 300, 227, { fill: '#0D1245', opacity: 0.85, lockRatio: true }),
        sh('wavelines', -20, 240, 900, 270, { stroke: '#59B4FF', strokeWidth: 3, opacity: 0.9 }, 'Mavi akış'),
        sh('wavelines', -30, 290, 900, 240, { stroke: '#A77BFF', strokeWidth: 2, opacity: 0.8, flipY: true }, 'Mor akış')
      ]);
    },
    mountain: function () {
      return base('mountain', [
        bg('gradient', ['#0A0B0F', '#2B2D35'], 160, 'matte'),
        sh('circle', 560, -90, 470, 470, { fill: '#E4E6EC', opacity: 0.16, lockRatio: true }, 'Ay'),
        sh('mountain', 120, 250, 736, 290, { fill: '#4A4D57', opacity: 0.8 }, 'Uzak dağ'),
        sh('mountain', 420, 205, 520, 335, { fill: '#1B1C22' }, 'Sağ zirve'),
        sh('mountain', -40, 300, 780, 240, { fill: '#14151A' }, 'Ön dağ')
      ]);
    }
  };
  var META = {
    classic: { n: 'Classic', d: 'Sade, açık gümüş zemin' },
    signature: { n: 'Signature', d: 'Siyah zemin, altın vurgu' },
    creative: { n: 'Creative', d: 'Gradient ve canlı akışlar' },
    mountain: { n: 'Dağ', d: 'Monokrom manzara' }
  };
  function get(id) { return (BUILD[id] || BUILD.classic)(); }
  root.FNXTemplates = { get: get, META: META, uid: uid, sh: sh };
})(typeof window !== 'undefined' ? window : globalThis);
