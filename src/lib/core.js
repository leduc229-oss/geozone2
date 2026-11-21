import L from 'leaflet';
import './overlay';

const CITIES = {
  hue:      { hero: ["Gate of Noon, Imperial City, Huế (8104939291).jpg","Imperial City, Hue, Vietnam (7073506027).jpg","Ngomon2.jpg"], api: 'Hue', name: 'Huế',       file: 'data/hue_places.json',      accent: '#6a4a9c', center: [16.4637, 107.5909], sub: 'Cố đô, sông Hương, lăng tẩm và đầm phá' },
  danang:   { hero: [], api: 'Da Nang', name: 'Đà Nẵng',   file: 'data/danang_places.json',   accent: '#0d6f9c', center: [16.0544, 108.2022], sub: 'Biển Mỹ Khê, Sơn Trà, Ngũ Hành Sơn và Bà Nà' },
  hanoi:    { hero: ["Turtle Tower, Hoan Kiem Lake, Hanoi (3531374428).jpg","Hoan kiem hanoi 1999.jpg"], name: 'Hà Nội',    file: 'data/hanoi_places.json',    accent: '#b3472f', center: [21.0285, 105.8542], api: 'Ha Noi',  sub: 'Phố cổ, Hồ Gươm, Văn Miếu, Sơn Tây và Ba Vì' },
  halong:   { hero: ["Ha Long Bay with boats.jpg","Ha Long Bay, Vietnam, Rock formations.jpg","Boats in Ha Long bay.jpg"], name: 'Hạ Long',   file: 'data/halong_places.json',   accent: '#0a7f8c', center: [20.9500, 107.0700], api: 'Ha Long', sub: 'Vịnh Hạ Long, Bãi Cháy, Hòn Gai và đảo Tuần Châu' },
  ninhbinh: { hero: ["Vietnam, Ninh Binh, Limestone peaks.jpg","Vietnam, Ninh Binh, Limestone mountains, panoramic view from above.jpg","Tam Coc by Tuan Mai \"007\" (8888350545).jpg"], api: 'NinhBinh', name: 'Ninh Bình', file: 'data/ninhbinh_places.json', accent: '#2c7a58', center: [20.2506, 105.9745], sub: 'Tràng An, Tam Cốc, Cố đô Hoa Lư và Cúc Phương' }
};
const TAGS = { food: 'Ẩm thực', culture: 'Văn hóa', nature: 'Thiên nhiên', sightseeing: 'Tham quan', nightlife: 'Về đêm', adventure: 'Phiêu lưu', beach: 'Biển', history: 'Lịch sử', shopping: 'Mua sắm' };

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
const vnd = n => n ? n.toLocaleString('vi-VN') + 'đ' : 'Miễn phí';
const score = p => (p.popularity * 10).toFixed(1).replace('.', ',');
const isAdm = () => !!(window.GZ_OV && window.GZ_OV.isAdmin());
const dur = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} giờ ${r} phút` : `${h} giờ`) : `${r} phút`; };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const nowMin = () => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).split(':').map(Number);
  return (h % 24) * 60 + m;
};
const isOpen = p => { const n = nowMin(), a = toMin(p.openingTime), b = toMin(p.closingTime); return a <= b ? n >= a && n <= b : n >= a || n <= b; };
const is24h = p => p.openingTime === '00:00' && p.closingTime >= '23:59';
const zNum = p => p.zoneCode.replace(/\D/g, '');
const SEA_BOX = [[[15.3, 110.8], [17.6, 113.6]], [[7.2, 111.0], [12.7, 117.0]]]; // [[nam, tây], [bắc, đông]]
const NoLabelClip = L.GridLayer.extend({
  createTile(coords, done) {
    const size = this.getTileSize(), dpr = L.Browser.retina ? 2 : 1, z = coords.z, map = this._map;
    const tile = document.createElement('canvas'); tile.width = size.x * dpr; tile.height = size.y * dpr;
    const o = coords.scaleBy(size);
    const rects = SEA_BOX.map(([sw, ne]) => {
      const a = map.project(L.latLng(ne[0], sw[1]), z).subtract(o), b = map.project(L.latLng(sw[0], ne[1]), z).subtract(o);
      return [a.x, a.y, b.x - a.x, b.y - a.y];
    }).filter(r => r[0] < size.x && r[1] < size.y && r[0] + r[2] > 0 && r[1] + r[3] > 0);
    if (!rects.length) { setTimeout(() => done(null, tile)); return tile; }
    const img = new Image();
    img.onload = () => {
      const c = tile.getContext('2d'); c.scale(dpr, dpr); c.beginPath(); rects.forEach(r => c.rect(...r)); c.clip();
      c.drawImage(img, 0, 0, size.x, size.y); done(null, tile);
    };
    img.onerror = () => done(null, tile);
    img.src = `https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/${z}/${coords.x}/${coords.y}${dpr > 1 ? '@2x' : ''}.png`;
    return tile;
  }
});

// Tên đảo (tên tiếng Việt đối chiếu AMTI/CSIS và các nguồn Wikipedia; tọa độ gần đúng)
const ISLANDS = [
  ['Đảo Hoàng Sa', 16.533, 111.617], ['Đảo Phú Lâm', 16.833, 112.333], ['Đảo Linh Côn', 16.667, 112.733],
  ['Đảo Tri Tôn', 15.783, 111.200], ['Đá Bắc', 17.100, 111.500],
  ['Đảo Song Tử Tây', 11.423, 114.332], ['Đảo Sinh Tồn', 9.879, 114.324], ['Đảo Sinh Tồn Đông', 9.902, 114.563],
  ['Đảo Nam Yết', 10.176, 114.366], ['Đảo Sơn Ca', 10.382, 114.483], ['Đảo Trường Sa', 8.638, 111.924],
  ['Đảo An Bang', 7.883, 112.917], ['Đảo Phan Vinh', 8.967, 113.683], ['Bãi Thuyền Chài', 8.183, 113.300],
  ['Đá Tây', 8.867, 112.217], ['Đá Đông', 8.817, 112.533], ['Đá Lớn', 10.033, 113.850], ['Đá Lát', 8.660, 111.680]
];

export const addBase = window.addBase = function (m) {
  // Carto nay bắt buộc API key (hiện chữ "API KEY REQUIRED") nên dùng thẳng OpenStreetMap
  const SRC = [
    ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; OpenStreetMap contributors', {}],
    ['https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', '&copy; OpenStreetMap France &amp; contributors', { subdomains: 'abc' }],
    ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', 'Tiles &copy; Esri', {}]
  ];
  let i = 0, errs = 0, base = null;
  const put = () => {
    if (base) m.removeLayer(base);
    const [url, attr, extra] = SRC[i];
    base = L.tileLayer(url, Object.assign({ maxZoom: 19, attribution: attr, crossOrigin: true }, extra)).addTo(m);
    base.on('tileerror', () => { if (++errs >= 3 && i < SRC.length - 1) { i++; errs = 0; put(); } });
    base.once('load', () => { errs = 0; });
  };
  put();
  seaLabels(m);
};

const seaLabels = window.seaLabels = function (m) {
  const mk = (ll, t, sub) => L.marker(ll, { interactive: false, keyboard: false, zIndexOffset: 1000,
    icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="sea-lbl big">${t}<small>${sub}</small></div>` }) });
  const big = L.layerGroup([
    mk([16.5, 112.0], 'Quần đảo Hoàng Sa', '(Đà Nẵng, Việt Nam)'),
    mk([9.5, 114.0], 'Quần đảo Trường Sa', '(Khánh Hòa, Việt Nam)')
  ]);
  const small = L.layerGroup(ISLANDS.map(([n, la, lo]) => L.marker([la, lo], { interactive: false, keyboard: false, zIndexOffset: 900,
    icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="isl"><i></i><b>${n}</b></div>` }) })));
  const upd = () => {
    const z = m.getZoom(), a = z <= 8, b = z >= 9;
    if (a && !m.hasLayer(big)) big.addTo(m); if (!a && m.hasLayer(big)) m.removeLayer(big);
    if (b && !m.hasLayer(small)) small.addTo(m); if (!b && m.hasLayer(small)) m.removeLayer(small);
  };
  m.on('zoomend', upd); upd();
};

Object.assign(window,{CITIES,TAGS,norm,vnd,score,dur,isOpen,is24h,zNum,toMin});

export { CITIES, TAGS, $, esc, norm, vnd, score, isAdm, dur, toMin, nowMin, isOpen, is24h, zNum, SEA_BOX, NoLabelClip, ISLANDS };
