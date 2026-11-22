/* Parça kütüphanesi: şekiller, desenler, ışıklar, zeminler, yüzeyler, dokular, çip görünümleri. */
(function (root) {
  'use strict';
  var LABELS = {
    circle: 'Daire', ring: 'Halka', line: 'Çizgi', arc: 'Yay', triangle: 'Üçgen', hexagon: 'Çokgen', diamond: 'Elmas',
    roundrect: 'Yumuşak blok', rect: 'Dikdörtgen', wave: 'Dalga', wavelines: 'Dalga çizgileri', mountain: 'Dağ silüeti',
    stars: 'Yıldızlar', grid: 'Izgara', diagonals: 'Çapraz çizgiler', nexus: 'Nexus filigranı', dots: 'Nokta deseni',
    rings: 'Eş merkezli halkalar', rays: 'Işın demeti', hexgrid: 'Petek ağı', glow: 'Işık hüzmesi (yuvarlak)', beam: 'Işık bandı'
  };
  // Yeni eklenen nesnenin başlangıç boyutu: [genişlik, yükseklik, çizgi kalınlığı?]
  var SIZES = {
    circle: [200, 200], ring: [200, 200, 4], line: [300, 20, 4], arc: [220, 220, 4], triangle: [200, 180], diamond: [180, 180],
    hexagon: [200, 180], roundrect: [240, 140], rect: [240, 140], wave: [600, 180], wavelines: [600, 200, 3],
    mountain: [520, 220], stars: [400, 300], grid: [300, 300, 1.5], diagonals: [260, 260, 2], nexus: [300, 227],
    dots: [280, 280], rings: [280, 280, 1.6], rays: [320, 320, 1.4], hexgrid: [320, 300, 1.2], glow: [360, 360], beam: [640, 90]
  };
  var LOCK_RATIO = { circle: 1, ring: 1, stars: 0, nexus: 1, rings: 1, rays: 1, glow: 0, diamond: 1 };
  var SHAPE_KINDS = ['circle', 'ring', 'line', 'arc', 'triangle', 'diamond', 'hexagon', 'roundrect', 'rect'];
  var PATTERN_KINDS = ['wave', 'wavelines', 'mountain', 'stars', 'dots', 'grid', 'diagonals', 'rings', 'rays', 'hexgrid', 'nexus'];
  var LIGHT_KINDS = ['glow', 'beam'];

  var BACKGROUNDS = [
    { n: 'Kırık beyaz', mode: 'solid', c: ['#F4F4F0'] },
    { n: 'Siyah', mode: 'solid', c: ['#0B0C10'] },
    { n: 'Lacivert', mode: 'solid', c: ['#101A33'] },
    { n: 'Antrasit', mode: 'solid', c: ['#2B2E36'] },
    { n: 'Gümüş', mode: 'gradient', c: ['#F2F3F8', '#D5D9E4', '#B9BFCF'], a: 135 },
    { n: 'Grafit', mode: 'gradient', c: ['#0B0C10', '#2A2C33'], a: 160 },
    { n: 'Altın gece', mode: 'gradient', c: ['#06070A', '#1C1710'], a: 150 },
    { n: 'Obsidyen', mode: 'gradient', c: ['#0A0B0F', '#1E2028', '#0A0B0F', '#262933'], a: 135 },
    { n: 'Nebula', mode: 'gradient', c: ['#070B26', '#14187A', '#5A22C4'], a: 140 },
    { n: 'Aurora', mode: 'gradient', c: ['#04141C', '#0A4D5C', '#1B7F6B', '#3B2A8F'], a: 120 },
    { n: 'Gün batımı', mode: 'gradient', c: ['#2B1055', '#D4507A', '#FFB36B'], a: 150 },
    { n: 'Okyanus', mode: 'gradient', c: ['#042A3B', '#0B7A8F'], a: 140 },
    { n: 'Zümrüt', mode: 'gradient', c: ['#06231C', '#0F6B4F'], a: 140 },
    { n: 'Gül', mode: 'gradient', c: ['#2A0F1E', '#A8325E'], a: 140 },
    { n: 'Kraliyet', mode: 'gradient', c: ['#1A0714', '#4A1230', '#1A0714'], a: 135 },
    { n: 'Kutup', mode: 'gradient', c: ['#DFEAF5', '#8FB2D6'], a: 135 },
    { n: 'Titanyum', mode: 'gradient', c: ['#D5D8DE', '#8E949F', '#C4C8CF', '#6D727C'], a: 125 },
    { n: 'Kor', mode: 'gradient', c: ['#1A0B05', '#8A3A12'], a: 150 },
    { n: 'Hayalet', mode: 'gradient', c: ['#050508', '#14121F', '#050508'], a: 150 },
    { n: 'Gece mavisi', mode: 'gradient', c: ['#050A18', '#0E2A5C'], a: 150 }
  ];
  var FINISHES = [
    { id: 'matte', n: 'Mat', d: 'Yansıması az, sakin yüzey' },
    { id: 'satin', n: 'Saten', d: 'Yumuşak ipeksi ışık geçişi' },
    { id: 'glossy', n: 'Parlak', d: 'Hafif yansımalı yüzey' },
    { id: 'chrome', n: 'Krom', d: 'Çok bantlı metalik yansıma' },
    { id: 'foil', n: 'Metal folyo', d: 'Gümüş/altın tonlu vurgu' },
    { id: 'holo', n: 'Holografik', d: 'Renk değiştiren geçiş' }
  ];
  var TEXTURES = [
    { id: 'none', n: 'Yok', d: 'Düz yüzey' },
    { id: 'carbon', n: 'Karbon fiber', d: 'Örgülü karbon dokusu' },
    { id: 'brushed', n: 'Fırçalı metal', d: 'İnce yatay metal çizgileri' },
    { id: 'grain', n: 'Mat tanecik', d: 'İnce film tanesi' },
    { id: 'mesh', n: 'Çapraz ağ', d: 'İnce çapraz çizgi dokusu' }
  ];
  var OBJ_EFFECTS = [{ id: 'emboss', n: 'Kabartma' }, { id: 'frost', n: 'Buzlu cam' }];
  var CHIPS = [
    { id: 'gold', n: 'Altın' }, { id: 'silver', n: 'Gümüş' }, { id: 'rose', n: 'Bakır' },
    { id: 'titanium', n: 'Titanyum' }, { id: 'onyx', n: 'Oniks' }, { id: 'emerald', n: 'Zümrüt' }
  ];
  var NAME_COLORS = ['#F2F4F8', '#14161B', '#D8B36A', '#C0C6D4', '#6FB3FF', '#FF8FA3'];
  var LIGHT_COLORS = ['#FFFFFF', '#FFE9B0', '#9EDBFF', '#C6A5FF', '#7CF0C4', '#FF9FC8'];

  root.FNXLib = {
    LABELS: LABELS, SIZES: SIZES, LOCK_RATIO: LOCK_RATIO, SHAPE_KINDS: SHAPE_KINDS, PATTERN_KINDS: PATTERN_KINDS, LIGHT_KINDS: LIGHT_KINDS,
    BACKGROUNDS: BACKGROUNDS, FINISHES: FINISHES, TEXTURES: TEXTURES, OBJ_EFFECTS: OBJ_EFFECTS, CHIPS: CHIPS,
    NAME_COLORS: NAME_COLORS, LIGHT_COLORS: LIGHT_COLORS
  };
})(typeof window !== "undefined" ? window : globalThis);
