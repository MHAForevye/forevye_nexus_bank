/* Parça kütüphanesi: şekiller, desenler, zeminler, efektler, çip görünümleri. */
(function (root) {
  'use strict';
  var LABELS = {
    circle: 'Daire', ring: 'Halka', line: 'Çizgi', arc: 'Yay', triangle: 'Üçgen', hexagon: 'Çokgen',
    roundrect: 'Yumuşak blok', wave: 'Dalga', wavelines: 'Dalga çizgileri', mountain: 'Dağ silüeti',
    stars: 'Yıldızlar', grid: 'Izgara', diagonals: 'Çapraz çizgiler', nexus: 'Nexus filigranı'
  };
  // Yeni eklenen nesnenin başlangıç boyutu.
  var SIZES = {
    circle: [200, 200], ring: [200, 200, 4], line: [300, 20, 4], arc: [220, 220, 4], triangle: [200, 180],
    hexagon: [200, 180], roundrect: [240, 140], wave: [600, 180], wavelines: [600, 200, 3],
    mountain: [520, 220], stars: [400, 300], grid: [300, 300, 1.5], diagonals: [260, 260, 2], nexus: [300, 227]
  };
  var LOCK_RATIO = { circle: 1, ring: 1, stars: 1, nexus: 1, hexagon: 0 };
  var SHAPE_KINDS = ['circle', 'ring', 'line', 'arc', 'triangle', 'hexagon', 'roundrect'];
  var PATTERN_KINDS = ['wave', 'wavelines', 'mountain', 'stars', 'grid', 'diagonals', 'nexus'];

  var BACKGROUNDS = [
    { n: 'Kırık beyaz', mode: 'solid', c: ['#F4F4F0'] },
    { n: 'Siyah', mode: 'solid', c: ['#0B0C10'] },
    { n: 'Lacivert', mode: 'solid', c: ['#101A33'] },
    { n: 'Antrasit', mode: 'solid', c: ['#2B2E36'] },
    { n: 'Gümüş', mode: 'gradient', c: ['#ECEEF5', '#C7CBD8'], a: 135 },
    { n: 'Grafit', mode: 'gradient', c: ['#0B0C10', '#2A2C33'], a: 160 },
    { n: 'Altın gece', mode: 'gradient', c: ['#06070A', '#1C1710'], a: 150 },
    { n: 'Nebula', mode: 'gradient', c: ['#070B26', '#14187A', '#5A22C4'], a: 140 },
    { n: 'Gün batımı', mode: 'gradient', c: ['#2B1055', '#D4507A', '#FFB36B'], a: 150 },
    { n: 'Okyanus', mode: 'gradient', c: ['#042A3B', '#0B7A8F'], a: 140 },
    { n: 'Zümrüt', mode: 'gradient', c: ['#06231C', '#0F6B4F'], a: 140 },
    { n: 'Gül', mode: 'gradient', c: ['#2A0F1E', '#A8325E'], a: 140 },
    { n: 'Kutup', mode: 'gradient', c: ['#DFEAF5', '#8FB2D6'], a: 135 },
    { n: 'Kor', mode: 'gradient', c: ['#1A0B05', '#8A3A12'], a: 150 }
  ];
  var FINISHES = [
    { id: 'matte', n: 'Mat', d: 'Yansıması az, sakin yüzey' },
    { id: 'glossy', n: 'Parlak', d: 'Hafif yansımalı yüzey' },
    { id: 'foil', n: 'Metal folyo', d: 'Gümüş/altın tonlu vurgu' },
    { id: 'holo', n: 'Holografik', d: 'Renk değiştiren geçiş' }
  ];
  var OBJ_EFFECTS = [
    { id: 'shadow', n: 'Gölge' }, { id: 'emboss', n: 'Kabartma' }, { id: 'frost', n: 'Buzlu cam' }
  ];
  var CHIPS = [
    { id: 'gold', n: 'Altın' }, { id: 'silver', n: 'Gümüş' }, { id: 'rose', n: 'Bakır' }
  ];
  var NAME_COLORS = ['#F2F4F8', '#14161B', '#D8B36A', '#C0C6D4', '#6FB3FF', '#FF8FA3'];

  root.FNXLib = {
    LABELS: LABELS, SIZES: SIZES, LOCK_RATIO: LOCK_RATIO, SHAPE_KINDS: SHAPE_KINDS, PATTERN_KINDS: PATTERN_KINDS,
    BACKGROUNDS: BACKGROUNDS, FINISHES: FINISHES, OBJ_EFFECTS: OBJ_EFFECTS, CHIPS: CHIPS, NAME_COLORS: NAME_COLORS
  };
})(typeof window !== "undefined" ? window : globalThis);
