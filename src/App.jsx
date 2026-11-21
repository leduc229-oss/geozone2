import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import PLACES from './data/places';
import GZ_IMG from './data/images';
import { GZ_OV } from './lib/overlay';
import { GZA } from './lib/auth';
import { CITIES, TAGS, $, esc, norm, vnd, score, dur, toMin, isOpen, is24h, zNum, addBase } from './lib/core';

const Ctx = React.createContext({});
const buildPlaces = k => GZ_OV.apply(k, PLACES[k].map((p, i) => ({ ...p, id: i + 1 })));

function useForm(init) {
  const [v, setV] = useState(init), [e, setE] = useState({}), [fe, setFe] = useState(''), [busy, setBusy] = useState(false);
  return { v, e, fe, busy, setE, setFe, setBusy, set: (k, x) => setV(o => ({ ...o, [k]: x })), reset: () => { setV(init); setE({}); setFe(''); } };
}
function Fld({ f, name, label, type = 'text', auto, hint, ro }) {
  const [show, setShow] = useState(false), id = React.useId(), pw = type === 'password', m = f.e[name];
  return (
    <div className={'au-f' + (m ? ' bad' : '')}>
      <label htmlFor={id}>{label}</label>
      <div className="au-in">
        <input id={id} name={name} type={pw && show ? 'text' : type} autoComplete={auto} aria-invalid={!!m} aria-describedby={id + 'm'}
          readOnly={ro} value={f.v[name]} onChange={e => f.set(name, e.target.value)} />
        {pw && <button type="button" className="au-eye" aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={show} onClick={() => setShow(!show)}>👁</button>}
      </div>
      <small id={id + 'm'}>{m || hint || ''}</small>
    </div>
  );
}
const FormErr = ({ f }) => f.fe ? <p className="au-err" role="alert">{f.fe}</p> : null;
const Btn = ({ f, children, cls = '' }) => <button className={'au-btn ' + cls} type="submit" disabled={f.busy}>{f.busy ? 'Đang xử lý…' : children}</button>;

function AuthNav({ user, openAuth, logout }) {
  const [o, setO] = useState(false);
  useEffect(() => {
    const h = e => { if (!e.target.closest('.au-menu')) setO(false); };
    document.addEventListener('click', h); return () => document.removeEventListener('click', h);
  }, []);
  if (!user) return (
    <div className="gz-auth">
      <button type="button" className="au-link" onClick={() => openAuth('login')}>Đăng nhập</button>
      <button type="button" className="au-pill" onClick={() => openAuth('register')}>Đăng ký</button>
      <button type="button" className="au-ico" aria-label="Đăng nhập" onClick={() => openAuth('login')}>👤</button>
    </div>);
  const adm = user.role === 'admin';
  return (
    <div className="gz-auth"><div className="au-menu">
      <button type="button" className="au-av" aria-haspopup="menu" aria-expanded={o} onClick={() => setO(!o)}>
        <i>{GZA.ini(user.name)}</i><span>{user.name}</span>{adm && <em className="au-role">Admin</em>}
      </button>
      <div className="au-pop" role="menu" hidden={!o}>
        <div className="au-who"><b>{user.name}</b><small>{user.email}</small>{adm && <small className="au-adm">Quyền quản trị viên</small>}</div>
        <button type="button" role="menuitem" onClick={() => { setO(false); location.hash = '#' + HASH.account; }}>Tài khoản</button>
        <button type="button" role="menuitem" onClick={() => { setO(false); location.hash = '#' + HASH.trips; }}>Chuyến đi của tôi</button>
        <button type="button" role="menuitem" onClick={() => { setO(false); logout(); }}>Đăng xuất</button>
      </div>
    </div></div>
  );
}

function AuthDlg({ auth, openAuth, close, onAuth }) {
  const dlg = useRef(), lock = useRef({});
  const lf = useForm({ email: '', pw: '', remember: true }), rf = useForm({ name: '', email: '', pw: '', pw2: '' });
  useEffect(() => { const d = dlg.current; if (auth && !d.open) d.showModal(); if (!auth && d.open) d.close(); }, [auth]);
  const tab = auth?.tab || 'login';
  const go = t => { lf.reset(); rf.reset(); openAuth(t); };
  const login = async e => {
    e.preventDefault();
    const em = lf.v.email.trim().toLowerCase(), pw = lf.v.pw, er = {};
    const m = GZA.mailBad(em); if (m) er.email = m; if (!pw) er.pw = 'Hãy nhập mật khẩu.';
    lf.setE(er); lf.setFe(''); if (Object.keys(er).length) return;
    let L = lock.current[em];
    if (L && L.until > Date.now()) { lf.setFe('Thử sai quá nhiều lần. Hãy đợi ' + Math.ceil((L.until - Date.now()) / 1000) + ' giây rồi thử lại.'); return; }
    lf.setBusy(true); await GZA.seedP;
    const u = GZA.users().find(x => x.email === em); let ok = false;
    try { ok = !!u && (await GZA.hash(pw, u.salt)) === u.hash; } catch {}
    lf.setBusy(false);
    if (!ok) { L = lock.current[em] = L || { n: 0 }; if (++L.n >= 5) { L.n = 0; L.until = Date.now() + 3e4; } lf.setFe('Email hoặc mật khẩu không đúng.'); return; }
    delete lock.current[em]; GZA.begin(u, lf.v.remember); lf.reset(); onAuth(u, 'Chào mừng trở lại, ' + u.name + '!');
  };
  const reg = async e => {
    e.preventDefault();
    const { name, email, pw, pw2 } = rf.v, nm = name.trim().replace(/\s+/g, ' '), em = email.trim().toLowerCase(), er = {};
    const a = GZA.nameBad(nm); if (a) er.name = a;
    const b = GZA.mailBad(em); if (b) er.email = b;
    const c = GZA.pwBad(pw); if (c) er.pw = c;
    if (pw !== pw2) er.pw2 = 'Mật khẩu nhập lại chưa khớp.';
    if (!er.email && GZA.users().some(x => x.email === em)) er.email = 'Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.';
    rf.setE(er); rf.setFe(''); if (Object.keys(er).length) return;
    rf.setBusy(true);
    const salt = GZA.b64e(GZA.rnd(16)), u = { id: GZA.uid(), name: nm, email: em, salt, created: Date.now() };
    try { u.hash = await GZA.hash(pw, salt); } catch { rf.setBusy(false); rf.setFe('Trình duyệt này không hỗ trợ tạo tài khoản.'); return; }
    const arr = GZA.users(); arr.push(u); GZA.saveUsers(arr); rf.setBusy(false); GZA.begin(u, true); rf.reset();
    onAuth(u, 'Tạo tài khoản thành công. Xin chào, ' + nm + '!');
  };
  return (
    <dialog id="authDlg" ref={dlg} aria-labelledby="auTitle" onClose={close} onClick={e => { if (e.target === dlg.current) close(); }}>
      <button type="button" className="au-x" onClick={close} aria-label="Đóng">✕</button>
      <div className="au-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'login'} onClick={() => go('login')}>Đăng nhập</button>
        <button type="button" role="tab" aria-selected={tab === 'register'} onClick={() => go('register')}>Đăng ký</button>
      </div>
      <h2 id="auTitle">{tab === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h2>
      <p className="au-sub">{tab === 'login' ? 'Đăng nhập để xem và giữ các chuyến đi của bạn.' : 'Lưu lịch trình và xem lại chúng bất cứ lúc nào.'}</p>
      {tab === 'login' ? (
        <form noValidate onSubmit={login}>
          <Fld f={lf} name="email" label="Email" type="email" auto="email" />
          <Fld f={lf} name="pw" label="Mật khẩu" type="password" auto="current-password" />
          <FormErr f={lf} />
          <label className="au-ck"><input type="checkbox" checked={lf.v.remember} onChange={e => lf.set('remember', e.target.checked)} /> Ghi nhớ đăng nhập 30 ngày</label>
          <Btn f={lf}>Đăng nhập</Btn>
        </form>
      ) : (
        <form noValidate onSubmit={reg}>
          <Fld f={rf} name="name" label="Họ và tên" auto="name" />
          <Fld f={rf} name="email" label="Email" type="email" auto="email" />
          <Fld f={rf} name="pw" label="Mật khẩu" type="password" auto="new-password" hint="Ít nhất 8 ký tự, gồm chữ và số." />
          <Fld f={rf} name="pw2" label="Nhập lại mật khẩu" type="password" auto="new-password" />
          <FormErr f={rf} />
          <Btn f={rf}>Tạo tài khoản</Btn>
        </form>
      )}
      {tab === 'login' && <div className="au-demo"><span><b>Admin Demo</b><br /><code>admin@geozone.vn</code> / <code>admin123</code></span>
        <button type="button" onClick={() => { lf.set('email', GZA.ADMIN.email); lf.set('pw', GZA.ADMIN.pw); }}>Điền sẵn</button></div>}
      <p className="au-note">Tài khoản và chuyến đi được lưu ngay trên trình duyệt này.</p>
    </dialog>
  );
}

function Account({ user, refresh, toast, logout }) {
  const pf = useForm({ name: user.name, email: user.email }), cf = useForm({ cur: '', pw: '', pw2: '' }), df = useForm({ pw: '' });
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 4000); return () => clearTimeout(t); }, [arm]);
  const trips = GZA.json(GZA.get('gz:trips:' + user.id), []);
  const nPlaces = trips.reduce((s, x) => s + x.days.reduce((a, d) => a + d.activities.length, 0), 0);
  const saveProf = e => {
    e.preventDefault(); const nm = pf.v.name.trim().replace(/\s+/g, ' '), m = GZA.nameBad(nm);
    pf.setE(m ? { name: m } : {}); if (m) return;
    const a = GZA.users(); a.forEach(x => { if (x.id === user.id) x.name = nm; }); GZA.saveUsers(a); refresh(); toast('Đã lưu thông tin.');
  };
  const savePass = async e => {
    e.preventDefault(); const { cur, pw, pw2 } = cf.v, er = {};
    if (!cur) er.cur = 'Nhập mật khẩu hiện tại.'; const b = GZA.pwBad(pw); if (b) er.pw = b;
    if (pw !== pw2) er.pw2 = 'Mật khẩu nhập lại chưa khớp.';
    cf.setE(er); if (Object.keys(er).length) return;
    cf.setBusy(true);
    if ((await GZA.hash(cur, user.salt)) !== user.hash) { cf.setBusy(false); cf.setE({ cur: 'Mật khẩu hiện tại không đúng.' }); return; }
    const salt = GZA.b64e(GZA.rnd(16)), h = await GZA.hash(pw, salt), a = GZA.users();
    a.forEach(x => { if (x.id === user.id) { x.salt = salt; x.hash = h; } });
    GZA.saveUsers(a); cf.setBusy(false); cf.reset(); refresh(); toast('Đã đổi mật khẩu.');
  };
  const del = async e => {
    e.preventDefault(); df.setFe('');
    if (user.role === 'admin') { df.setFe('Tài khoản Admin Demo không thể bị xóa.'); return; }
    if (!df.v.pw) { df.setE({ pw: 'Nhập mật khẩu để xác nhận.' }); return; }
    df.setE({}); df.setBusy(true); const ok = (await GZA.hash(df.v.pw, user.salt)) === user.hash; df.setBusy(false);
    if (!ok) { df.setE({ pw: 'Mật khẩu không đúng.' }); return; }
    if (!arm) { setArm(true); return; }
    GZA.saveUsers(GZA.users().filter(x => x.id !== user.id)); GZA.del('gz:trips:' + user.id); GZA.del('gz:favs:' + user.id);
    df.reset(); setArm(false); logout(true); toast('Đã xóa tài khoản.');
  };
  return (
    <>
      <div className="gz-pb" data-k="ninhbinh" style={bg('ninhbinh')}><div className="gz-wrap"><h1>Tài khoản</h1><p className="gz-crumb"><A v="home">Trang chủ</A> / Tài khoản của tôi</p></div></div>
      <div className="ac-body"><div className="gz-wrap ac-grid">
        <aside className="ac-card ac-me">
          <i className="ac-av">{GZA.ini(user.name)}</i><h2>{user.name}</h2><p>{user.email}</p>
          <dl className="ac-stats">
            <div><dt>Chuyến đi</dt><dd>{trips.length}</dd></div><div><dt>Địa điểm</dt><dd>{nPlaces}</dd></div>
            <div><dt>Tham gia</dt><dd>{new Date(user.created).toLocaleDateString('vi-VN')}</dd></div>
          </dl>
          <A v="trips" className="gz-btn">Chuyến đi của tôi</A>
          <button type="button" className="ac-out" onClick={() => logout()}>Đăng xuất</button>
        </aside>
        <div className="ac-col">
          <form className="ac-card" noValidate onSubmit={saveProf}><h3>Thông tin cá nhân</h3>
            <Fld f={pf} name="name" label="Họ và tên" auto="name" />
            <Fld f={pf} name="email" label="Email" type="email" auto="email" hint="Email dùng để đăng nhập nên không thể đổi." ro />
            <Btn f={pf}>Lưu thay đổi</Btn></form>
          <form className="ac-card" noValidate onSubmit={savePass}><h3>Đổi mật khẩu</h3>
            <Fld f={cf} name="cur" label="Mật khẩu hiện tại" type="password" auto="current-password" />
            <Fld f={cf} name="pw" label="Mật khẩu mới" type="password" auto="new-password" hint="Ít nhất 8 ký tự, gồm chữ và số." />
            <Fld f={cf} name="pw2" label="Nhập lại mật khẩu mới" type="password" auto="new-password" />
            <Btn f={cf}>Cập nhật mật khẩu</Btn></form>
          <form className="ac-card ac-danger" noValidate onSubmit={del}><h3>Xóa tài khoản</h3>
            <p>Tài khoản và toàn bộ chuyến đi đã lưu sẽ bị xóa vĩnh viễn khỏi trình duyệt này.</p>
            <Fld f={df} name="pw" label="Nhập mật khẩu để xác nhận" type="password" auto="current-password" />
            <FormErr f={df} />
            <Btn f={df} cls="bad">{arm ? 'Bấm lại để xóa vĩnh viễn' : 'Xóa tài khoản'}</Btn></form>
        </div>
      </div></div>
    </>
  );
}

function AdmDlg({ ed, zones, onSave, onRevert, onDelete, onClose }) {
  const { p, isNew } = ed, ref = useRef();
  const [v, setV] = useState(() => ({ name: p.name, address: p.address, score: (p.popularity * 10).toFixed(1), cost: p.estimatedCost, duration: p.duration,
    zone: p.zoneCode, open: p.openingTime, close: p.closingTime, lat: p.latitude, lng: p.longitude, tags: [...p.tags] }));
  const [err, setErr] = useState(''), [arm, setArm] = useState(false);
  useEffect(() => { ref.current.showModal(); ref.current.querySelector('input').focus(); }, []);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 4000); return () => clearTimeout(t); }, [arm]);
  const s = k => e => setV(o => ({ ...o, [k]: e.target.value }));
  const num = x => (x === '' ? NaN : Number(x));
  const submit = e => {
    e.preventDefault();
    const n = { name: v.name.trim().replace(/\s+/g, ' '), address: v.address.trim(), score: num(v.score), cost: num(v.cost), duration: num(v.duration), lat: num(v.lat), lng: num(v.lng) };
    const T = /^([01]\d|2[0-3]):[0-5]\d$/;
    const m = n.name.length < 2 || n.name.length > 120 ? 'Tên địa điểm cần từ 2 đến 120 ký tự.'
      : n.address.length < 3 ? 'Hãy nhập địa chỉ.'
      : !(n.score >= 0 && n.score <= 10) ? 'Điểm phải nằm trong khoảng 0 đến 10.'
      : !(Number.isInteger(n.cost) && n.cost >= 0 && n.cost <= 1e8) ? 'Giá vé phải là số nguyên từ 0 đến 100.000.000.'
      : !(Number.isInteger(n.duration) && n.duration >= 5 && n.duration <= 1440) ? 'Thời gian tham quan từ 5 đến 1440 phút.'
      : !v.zone ? 'Hãy chọn khu vực.'
      : !T.test(v.open) || !T.test(v.close) ? 'Hãy nhập giờ mở và đóng cửa hợp lệ.'
      : !(n.lat >= -90 && n.lat <= 90) || !(n.lng >= -180 && n.lng <= 180) ? 'Tọa độ chưa hợp lệ.'
      : !v.tags.length ? 'Chọn ít nhất 1 loại hình.' : '';
    if (m) { setErr(m); return; }
    const z = zones.find(x => x[0] === v.zone);
    onSave({ name: n.name, address: n.address, estimatedCost: n.cost, duration: n.duration, openingTime: v.open, closingTime: v.close,
      popularity: Math.round(n.score * 10) / 100, tags: v.tags, zoneCode: v.zone, zoneName: z ? z[1] : '', latitude: +n.lat.toFixed(5), longitude: +n.lng.toFixed(5) });
  };
  const L = (t, k, extra, cls) => <label className={cls}>{t}<input value={v[k]} onChange={s(k)} {...extra} /></label>;
  return (
    <dialog id="admDlg" ref={ref} onClose={onClose} aria-labelledby="admTitle">
      <div className="dhead"><h2 id="admTitle">{isNew ? 'Thêm địa điểm mới' : 'Sửa địa điểm'}</h2><button type="button" className="ghost" onClick={() => ref.current.close()} aria-label="Đóng">Đóng</button></div>
      <form noValidate onSubmit={submit}>
        <div className="adm-grid">
          {L('Tên địa điểm', 'name', { maxLength: 120, autoComplete: 'off' }, 'full')}
          {L('Địa chỉ', 'address', { maxLength: 200, autoComplete: 'off' }, 'full')}
          {L('Điểm nổi tiếng (0–10)', 'score', { type: 'number', min: 0, max: 10, step: 0.1 })}
          {L('Giá vé (đ, 0 = miễn phí)', 'cost', { type: 'number', min: 0, max: 100000000, step: 1000 })}
          {L('Thời gian tham quan (phút)', 'duration', { type: 'number', min: 5, max: 1440, step: 5 })}
          <label>Khu vực<select value={v.zone} onChange={s('zone')}>{zones.map(z => <option key={z[0]} value={z[0]}>{z[0].replace(/\D/g, '')}. {z[1]}</option>)}</select></label>
          {L('Giờ mở cửa', 'open', { type: 'time' })}
          {L('Giờ đóng cửa', 'close', { type: 'time' })}
          {L('Vĩ độ', 'lat', { type: 'number', step: 0.00001 })}
          {L('Kinh độ', 'lng', { type: 'number', step: 0.00001 })}
          <fieldset className="full"><legend>Loại hình</legend><div>
            {Object.keys(TAGS).map(t => <label key={t} className="adm-chip">
              <input type="checkbox" checked={v.tags.includes(t)} onChange={e => setV(o => ({ ...o, tags: e.target.checked ? [...o.tags, t] : o.tags.filter(x => x !== t) }))} /><span>{TAGS[t]}</span></label>)}
          </div></fieldset>
        </div>
        {err && <p className="adm-err" role="alert">{err}</p>}
        <p className="adm-hint">Mẹo: ngoài nhập tọa độ, bạn có thể kéo thả ghim của địa điểm trực tiếp trên bản đồ để dời vị trí. Thay đổi chỉ lưu trên trình duyệt này.</p>
        <div className="adm-foot">
          <button type="submit">{isNew ? 'Thêm địa điểm' : 'Lưu thay đổi'}</button>
          {!isNew && p._ed && <button type="button" className="ghost" onClick={onRevert}>Khôi phục bản gốc</button>}
          {!isNew && <button type="button" className="danger" onClick={() => arm ? onDelete() : setArm(true)}>{arm ? 'Bấm lại để xóa' : 'Xóa địa điểm'}</button>}
        </div>
      </form>
    </dialog>
  );
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#c026d3'];
const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const fmtDate = t => { const d = new Date(t); return d.toLocaleDateString('vi-VN') + ' · ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
const countPlaces = t => t.days.reduce((s, d) => s + d.activities.length, 0);
const tripText = t => {
  const out = [t.name + ' (' + fmtDate(t.createdAt) + ')'];
  t.days.forEach(d => { out.push('', d.title); d.activities.forEach((a, i) => out.push((i + 1) + '. ' + (a.timeSlot ? a.timeSlot + ' ' : '') + a.placeName + ' (' + vnd(a.estimatedCost) + (a.address ? ') - ' + a.address : ')'))); });
  return out.join('\n');
};

/* 5 bước: lọc sở thích -> chấm điểm -> gom Zone -> chia ngày (tham lam theo ngân sách) -> xếp giờ */
function generate(key, places, { days, totalBudget, prefs }) {
  const P = new Set(prefs), sc = p => p.popularity * (1 + (P.size ? p.tags.filter(t => P.has(t)).length : 0));
  const pool = places.filter(p => !P.size || p.tags.some(t => P.has(t)));
  const zones = {};
  pool.forEach(p => (zones[p.zoneCode] ??= { code: p.zoneCode, name: p.zoneName, items: [] }).items.push(p));
  const ranked = Object.values(zones).map(z => ({ ...z, items: z.items.sort((a, b) => sc(b) - sc(a)), w: z.items.reduce((s, p) => s + sc(p), 0) })).sort((a, b) => b.w - a.w);
  let left = totalBudget; const used = new Set(), out = [];
  for (let d = 0; d < days; d++) {
    const z = ranked.slice(d % ranked.length).concat(ranked.slice(0, d % ranked.length)).find(z => z.items.some(p => !used.has(p.id)));
    if (!z) break;
    const cap = left / (days - d); let t = 480, cost = 0, prev = null; const acts = [];
    for (const p of z.items) {
      if (used.has(p.id) || cost + p.estimatedCost > cap) continue;
      const travel = prev ? 15 : 0, start = Math.max(t + travel, toMin(p.openingTime)), end = start + p.duration;
      if (end > 21 * 60 || end > toMin(p.closingTime)) continue;
      acts.push({ placeId: p.id, placeName: p.name, zoneId: z.code, zoneName: z.name, timeSlot: `${hm(start)} - ${hm(end)}`, startTime: hm(start), endTime: hm(end),
        duration: p.duration, estimatedCost: p.estimatedCost, travelTimeFromPrev: travel, latitude: p.latitude, longitude: p.longitude, address: p.address });
      used.add(p.id); cost += p.estimatedCost; t = end; prev = p;
    }
    left -= cost;
    out.push({ dayNumber: d + 1, zoneId: z.code, zoneName: z.name, title: `Ngày ${d + 1}: ${z.name}`, totalEstimatedCost: cost,
      totalDurationMin: acts.reduce((s, a) => s + a.duration + a.travelTimeFromPrev, 0), activities: acts });
  }
  return { cityKey: key, city: CITIES[key].api, totalDays: out.length, totalBudget, actualCost: totalBudget - left, strategyUsed: 'CLIENT_GREEDY_ZONE', days: out };
}

function Planner({ city, changeCity, active, places, onSave }) {
  const [days, setDays] = useState('2'), [budget, setBudget] = useState(1000000), [prefs, setPrefs] = useState([]);
  const [plan, setPlan] = useState(null), [df, setDf] = useState(0), [saved, setSaved] = useState(false);
  const el = useRef(), pm = useRef(), pl = useRef();
  useEffect(() => { setPlan(null); }, [city]);
  const go = () => { setSaved(false); setDf(0); setPlan(generate(city, places, { days: +days, totalBudget: budget, prefs })); };
  useEffect(() => {
    if (!plan || !el.current) return;
    const m = L.map(el.current).setView(CITIES[plan.cityKey].center, 11); addBase(m); pm.current = m; pl.current = L.layerGroup().addTo(m);
    const ro = window.ResizeObserver ? new ResizeObserver(() => m.invalidateSize()) : null; if (ro) ro.observe(el.current);
    return () => { if (ro) ro.disconnect(); m.remove(); pm.current = null; };
  }, [plan]);
  useEffect(() => {
    const m = pm.current; if (!plan || !m) return;
    pl.current.clearLayers(); const pts = [], ds = plan.days.filter(d => !df || d.dayNumber === df);
    ds.forEach(d => d.activities.forEach((a, i) => {
      const c = COLORS[(d.dayNumber - 1) % 4];
      L.marker([a.latitude, a.longitude], { icon: L.divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 14], html: `<div class="pin" style="background:${c}">${i + 1}</div>` }) })
        .bindPopup(`<strong>${esc(a.placeName)}</strong><br>Ngày ${d.dayNumber} · ${a.timeSlot}`).addTo(pl.current);
      pts.push([a.latitude, a.longitude]);
    }));
    ds.forEach(d => L.polyline(d.activities.map(a => [a.latitude, a.longitude]), { color: COLORS[(d.dayNumber - 1) % 4], weight: 3, dashArray: '6 6' }).addTo(pl.current));
    setTimeout(() => { m.invalidateSize(); if (pts.length) m.fitBounds(pts, { padding: [30, 30], maxZoom: 14 }); }, 120);
  }, [plan, df, active]);
  const total = plan ? plan.days.reduce((s, d) => s + d.activities.length, 0) : 0;
  const save = () => {
    const nm = CITIES[plan.cityKey].name;
    onSave({ source: 'plan', city: plan.cityKey, cityName: nm, name: `${nm} · ${plan.totalDays} ngày`, cost: plan.actualCost, budget: plan.totalBudget, days: plan.days });
    setSaved(true);
  };
  return (
    <main className="planner" hidden={!active}>
      <aside className="pform">
        <h2>Thiết lập chuyến đi</h2>
        <label>Điểm đến <select value={city} onChange={e => changeCity(e.target.value)}>{Object.entries(CITIES).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select></label>
        <label>Số ngày <select value={days} onChange={e => setDays(e.target.value)}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Ngân sách vé: <b>{vnd(budget)}</b><input type="range" min="100000" max="3000000" step="50000" value={budget} onChange={e => setBudget(+e.target.value)} /></label>
        <div className="chips" aria-label="Sở thích">
          {Object.entries(TAGS).map(([k, v]) => <button key={k} type="button" aria-pressed={prefs.includes(k)} onClick={() => setPrefs(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])}>{v}</button>)}
        </div>
        <button type="button" className="go" onClick={go}>Tạo lịch trình</button>
      </aside>
      <section className="pres">
        {!plan ? <p className="empty">Chọn điểm đến, ngân sách, sở thích rồi bấm “Tạo lịch trình”.</p> : (
          <>
            <div className="banner"><b>{CITIES[plan.cityKey].name} · {plan.totalDays} ngày</b><span>{total} điểm · {vnd(plan.actualCost)} / {vnd(plan.totalBudget)}</span>
              {total > 0 && <button type="button" className="gz-save" disabled={saved} onClick={save}>{saved ? '✓ Đã lưu vào Chuyến đi của tôi' : '🧳 Lưu vào Chuyến đi của tôi'}</button>}</div>
            {!total && <p className="empty">Ngân sách hoặc sở thích quá chặt, chưa có địa điểm phù hợp. Hãy tăng ngân sách hoặc bỏ bớt sở thích.</p>}
            <div className="pgrid">
              <div>{plan.days.map(d =>
                <article key={d.dayNumber} className="day" style={{ '--dc': COLORS[(d.dayNumber - 1) % 4] }}>
                  <h3>{d.title} <small>{vnd(d.totalEstimatedCost)}</small></h3>
                  {d.activities.map((a, i) => <div key={i} className="act"><span className="n">{i + 1}</span>
                    <div><b>{a.placeName}</b><small>{a.timeSlot} · {dur(a.duration)} · {vnd(a.estimatedCost)}{a.travelTimeFromPrev ? ` · di chuyển ~${a.travelTimeFromPrev}p` : ''}</small></div></div>)}
                  {!d.activities.length && <p className="empty">Không còn điểm phù hợp cho ngày này.</p>}
                </article>)}</div>
              <div className="zmap">
                <div className="zh"><b>BẢN ĐỒ PHÂN CỤM ZONE</b><span>{plan.days.length} cụm khu vực</span></div>
                <div id="pMap" ref={el}></div>
                <div className="zchips">
                  <button type="button" aria-pressed={df === 0} onClick={() => setDf(0)}>Tất cả ({plan.days.length} ngày)</button>
                  {plan.days.map(d => <button key={d.dayNumber} type="button" aria-pressed={df === d.dayNumber} style={{ '--dc': COLORS[(d.dayNumber - 1) % 4] }} onClick={() => setDf(d.dayNumber)}>Ngày {d.dayNumber}: {d.zoneName}</button>)}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Trips({ trips, setTrips, user, openAuth }) {
  const [open, setOpen] = useState(null), [sure, setSure] = useState(null), [copied, setCopied] = useState(null);
  const dlg = useRef(), t = trips.find(x => x.id === open);
  useEffect(() => { const d = dlg.current; if (t && !d.open) d.showModal(); if (!t && d.open) d.close(); }, [!!t]);
  useEffect(() => { if (sure == null) return; const x = setTimeout(() => setSure(null), 2500); return () => clearTimeout(x); }, [sure]);
  const copy = async (tr, key) => { try { await navigator.clipboard.writeText(tripText(tr)); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {} };
  const remove = id => setTrips(trips.filter(x => x.id !== id));
  return (
    <>
      <div className="gz-pb" data-k="danang" style={bg('danang')}>
        <div className="gz-wrap"><h1>Chuyến đi của tôi</h1><p className="gz-crumb"><A v="home">Trang chủ</A> / Lịch sử chuyến đi</p></div>
      </div>
      <div className="gz-tbody"><div className="gz-wrap">
        {!user && <div className="gz-gnote"><p>Bạn chưa đăng nhập, nên chuyến đi chỉ lưu trên trình duyệt này.</p>
          <button type="button" onClick={() => openAuth('login')}>Đăng nhập</button><button type="button" className="alt" onClick={() => openAuth('register')}>Tạo tài khoản</button></div>}
        {trips.length > 0 && <div className="gz-tbar"><p>{trips.length} chuyến đi đã lưu</p>
          <button type="button" className="gz-link" onClick={() => sure === 'all' ? (setTrips([]), setSure(null)) : setSure('all')}>{sure === 'all' ? 'Bấm lại để xóa tất cả' : 'Xóa tất cả'}</button></div>}
        <div className="gz-tgrid">
          {trips.map(tr => {
            const names = tr.days.flatMap(d => d.activities.map(x => x.placeName)), n = names.length;
            return (
              <article key={tr.id} className="tcard">
                <div className="tc-top"><span className={'tc-kind ' + (tr.source === 'plan' ? '' : 'list')}>{tr.source === 'plan' ? '✨ AI lên lịch' : '📍 Tự chọn'}</span>
                  <h3>{tr.name}</h3><div className="tc-date">Lưu lúc {fmtDate(tr.createdAt)}</div></div>
                <div className="tc-stats"><span>🗓️ {tr.days.length} ngày</span><span>📍 {n} điểm</span><span>🎫 {vnd(tr.cost || 0)}</span></div>
                <ul>{names.slice(0, 3).map((x, i) => <li key={i}>{x}</li>)}{n > 3 && <li className="tc-more">+ {n - 3} điểm khác</li>}</ul>
                <div className="tc-act">
                  <button type="button" onClick={() => setOpen(tr.id)}>Xem chi tiết</button>
                  <button type="button" className="ghost" onClick={() => copy(tr, tr.id)}>{copied === tr.id ? 'Đã sao chép' : 'Sao chép'}</button>
                  <button type="button" className={'del' + (sure === tr.id ? ' sure' : '')} onClick={() => sure === tr.id ? remove(tr.id) : setSure(tr.id)}>{sure === tr.id ? 'Bấm lại để xóa' : 'Xóa'}</button>
                </div>
              </article>);
          })}
        </div>
        {!trips.length && <div className="gz-tempty">
          <div className="ic">🧳</div><h2>Chưa có chuyến đi nào</h2>
          <p>Tạo lịch trình bằng AI hoặc tự chọn địa điểm, rồi bấm “Lưu” — chuyến đi sẽ nằm ở đây để bạn xem lại bất cứ lúc nào.</p>
          <A v="plan" className="gz-btn">Tạo lịch trình</A><A v="explore" className="gz-btn alt">Khám phá điểm đến</A></div>}
      </div></div>
      <dialog id="tripView" ref={dlg} onClose={() => setOpen(null)} onClick={e => { if (e.target === dlg.current) setOpen(null); }}>
        <div className="dhead"><h2>Chi tiết chuyến đi</h2><button type="button" className="ghost" onClick={() => setOpen(null)} aria-label="Đóng">Đóng</button></div>
        {t && <div id="tvBody">
          <input key={t.id} id="tvName" type="text" maxLength={80} aria-label="Tên chuyến đi" defaultValue={t.name}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.name) setTrips(trips.map(x => x.id === t.id ? { ...x, name: v } : x)); }} />
          <p id="tvMeta">{t.cityName} · {t.days.length} ngày · {countPlaces(t)} điểm · {vnd(t.cost || 0)} tiền vé · lưu {fmtDate(t.createdAt)}</p>
          <div id="tvDays">{t.days.map((d, i) =>
            <article key={i} className="day" style={{ '--dc': COLORS[i % 4] }}><h3>{d.title} <small>{vnd(d.totalEstimatedCost || 0)}</small></h3>
              {d.activities.map((a, j) => <div key={j} className="act"><span className="n">{j + 1}</span>
                <div><b>{a.placeName}</b><small>{a.timeSlot ? a.timeSlot + ' · ' : ''}{dur(a.duration)} · {vnd(a.estimatedCost)}</small></div></div>)}</article>)}</div>
        </div>}
        <div className="dfoot" style={{ paddingTop: 12 }}>
          <button type="button" onClick={() => t && copy(t, 'dlg')}>{copied === 'dlg' ? 'Đã sao chép' : 'Sao chép'}</button>
          <button type="button" className="ghost" style={{ color: '#a3392f', borderColor: '#dde4f0' }} onClick={() => { if (sure === 'dlg') { setSure(null); const id = t.id; setOpen(null); remove(id); } else setSure('dlg'); }}>{sure === 'dlg' ? 'Bấm lại để xóa' : 'Xóa chuyến đi'}</button>
        </div>
      </dialog>
    </>
  );
}

const IMG = GZ_IMG || {};
const bg = k => (IMG[k] ? { backgroundImage: 'url(' + IMG[k] + ')' } : {});
const HASH = { home: 'trang-chu', about: 'gioi-thieu', explore: 'kham-pha', favs: 'yeu-thich', account: 'tai-khoan', plan: 'lap-lich-trinh', trips: 'chuyen-di' };
const VIEW = Object.fromEntries(Object.entries(HASH).map(([v, h]) => [h, v]));
const getView = () => VIEW[location.hash.slice(1)] || 'home';
const newF = () => ({ q: '', tags: [], zone: 'all', cost: 1e9, open: false, sort: 'pop' });
const SORTS = {
  pop: (a, b) => b.popularity - a.popularity,
  costAsc: (a, b) => a.estimatedCost - b.estimatedCost || b.popularity - a.popularity,
  durAsc: (a, b) => a.duration - b.duration,
  name: (a, b) => a.name.localeCompare(b.name, 'vi')
};
const loadTrip = c => { try { return JSON.parse(localStorage.getItem('trip:' + c)) || []; } catch { return []; } };
const pin = (p, sel, trip) => L.divIcon({ className: '', iconSize: [24, 24], iconAnchor: [12, 12],
  html: `<div class="pin${sel === p.id ? ' sel' : ''}${trip.includes(p.id) ? ' trip' : ''}">${zNum(p)}</div>` });
const A = ({ v, children, ...r }) => <a href={'#' + HASH[v]} {...r}>{children}</a>;
const Badge = ({ n }) => <b className="gzFavBadge" data-n={n}>{n || ''}</b>;

function Nav({ view, favN, tripN, user, openAuth, logout }) {
  const on = v => (view === v ? 'on' : '');
  const TB = <b className="gzTripBadge" data-n={tripN}>{tripN || ''}</b>;
  return (
    <header className="gz-nav"><div className="gz-wrap">
      <A v="home" className="gz-logo"><i>GZ</i>GeoZone AI</A>
      <nav className="gz-links">
        <A v="home" className={on('home')}>Trang chủ</A>
        <A v="about" className={on('about')}>Giới thiệu</A>
        <A v="explore" className={on('explore')}>Khám phá</A>
        <A v="trips" className={on('trips')}>Chuyến đi của tôi{TB}</A>
        <A v="favs" className={on('favs')}>Yêu thích<Badge n={favN} /></A>
      </nav>
      <A v="trips" className="gz-mt" aria-label="Chuyến đi của tôi" title="Chuyến đi của tôi">🧳{TB}</A>
      <A v="favs" className="gz-mt gz-mt-fav" aria-label="Địa điểm yêu thích" title="Địa điểm yêu thích">♡<Badge n={favN} /></A>
      <A v="plan" className="gz-btn">Lập lịch trình</A>
      <AuthNav user={user} openAuth={openAuth} logout={logout} />
    </div></header>
  );
}

const V = ({ v, cur, cls, children, ...r }) =>
  <section className={`gz-view ${cls}${v === cur ? ' on' : ''}`} data-view={v} {...r}>{children}</section>;

function Home() {
  return (
    <>
      {[['hanoi', 'Hà Nội'], ['halong', 'Vịnh Hạ Long'], ['ninhbinh', 'Ninh Bình'], ['hue', 'Huế'], ['danang', 'Đà Nẵng']].map(([k, t]) =>
        <div key={k} className="gz-p" data-k={k} style={bg(k)}><b>{t}</b></div>)}
      <div className="gz-ht">
        <span className="gz-pill">Nền tảng lập kế hoạch du lịch ứng dụng AI</span>
        <h1>GEOZONE AI<span className="gz-sub">Your Journey, Intelligently Planned</span></h1>
        <p>Khám phá thế giới theo cách của riêng bạn.</p>
        <div className="gz-bar"></div>
        <div className="gz-cta"><A v="explore" className="gz-btn big">Khám phá điểm đến</A><A v="plan" className="gz-btn big ghost">Tạo lịch trình tối ưu</A></div>
      </div>
    </>
  );
}

function About() {
  return (
    <>
      <div className="gz-pb" data-k="halong" style={bg('halong')}>
        <div className="gz-wrap"><h1>Giới thiệu</h1><p className="gz-crumb"><A v="home">Trang chủ</A> / GeoZone AI</p></div>
      </div>
      <div className="gz-intro"><div className="gz-wrap gz-split">
        <div>
          <h2>Mỗi chuyến đi là một hành trình khám phá</h2>
          <p>Mỗi chuyến đi là một hành trình khám phá những vùng đất mới, trải nghiệm văn hóa độc đáo và lưu giữ những khoảnh khắc đáng nhớ.</p>
          <p>Thế nhưng, để biến ý tưởng thành một chuyến đi hoàn chỉnh, bạn thường phải dành hàng giờ tìm kiếm địa điểm, cân đối ngân sách, tính toán thời gian và sắp xếp lộ trình di chuyển.</p>
          <p><strong>GEOZONE AI ra đời để giúp việc lên kế hoạch du lịch trở nên đơn giản và thông minh hơn.</strong> Là nền tảng lập kế hoạch du lịch ứng dụng trí tuệ nhân tạo (AI), GEOZONE kết hợp dữ liệu địa lý, thuật toán tối ưu hóa và mô hình ngôn ngữ lớn (LLM) để xây dựng những lịch trình phù hợp với sở thích, ngân sách và thời gian của bạn.</p>
          <A v="explore" className="gz-btn" style={{ marginTop: 12 }}>Khám phá điểm đến</A>
        </div>
        <div className="gz-feats">
          {[['🗺️', 'Dữ liệu địa lý', 'Phân vùng địa điểm để lộ trình gọn, ít di chuyển.'],
            ['🧮', 'Thuật toán tối ưu hóa', 'Cân đối ngân sách, thời gian và mức độ ưu tiên.'],
            ['🤖', 'Mô hình ngôn ngữ lớn', 'Hoàn thiện nội dung lịch trình theo từng ngày.']].map(([i, t, d]) =>
            <div key={t} className="gz-f"><span>{i}</span><div><strong>{t}</strong>{d}</div></div>)}
        </div>
      </div></div>
    </>
  );
}

function Explore({ active, favs, toggleFav, focus, mode, onSaveTrip }) {
  const [city, setCity] = useState('hue');
  const [f, setF] = useState(newF);
  const [sel, setSel] = useState(null);
  const [mv, setMv] = useState('list');
  const [tdd, setTdd] = useState(false);
  const [trips, setTrips] = useState({});
  const [tripOpen, setTripOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const c = CITIES[city];
  const trip = trips[city] || loadTrip(city);
  const setTrip = a => { setTrips(t => ({ ...t, [city]: a })); try { localStorage.setItem('trip:' + city, JSON.stringify(a)); } catch {} };
  const map = useRef(), layer = useRef(), markers = useRef({}), mapEl = useRef(), dlg = useRef();

  const { isAdmin, toast } = React.useContext(Ctx);
  const [rev, setRev] = useState(0), [ed, setEd] = useState(null), [armRst, setArmRst] = useState(false);
  const skipFit = useRef(false);
  GZ_OV.setAdmin(isAdmin);
  const places = useMemo(() => buildPlaces(city), [city, rev]);
  const placesRef = useRef(places); placesRef.current = places;
  window.GZ_ADM = { edit: id => { const p = placesRef.current.find(x => x.id === id); if (p) setEd({ p, isNew: false }); } };
  const shown = useMemo(() => {
    const q = norm(f.q.trim());
    return places.filter(p => (!q || norm(p.name + ' ' + p.address).includes(q)) &&
      (!f.tags.length || p.tags.some(t => f.tags.includes(t))) &&
      (f.zone === 'all' || p.zoneCode === f.zone) && p.estimatedCost <= f.cost && (!f.open || isOpen(p))).sort(SORTS[f.sort]);
  }, [places, f]);
  const present = useMemo(() => {
    const o = Object.keys(TAGS);
    return [...new Set(places.flatMap(p => p.tags))].sort((a, b) => o.indexOf(a) - o.indexOf(b));
  }, [places]);
  const zones = useMemo(() => [...new Map(places.map(p => [p.zoneCode, p.zoneName]))].sort(), [places]);
  const upd = patch => setF(x => ({ ...x, ...patch }));

  useEffect(() => {
    map.current = L.map(mapEl.current).setView(CITIES.hue.center, 11);
    addBase(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);
  useEffect(() => { if (active) setTimeout(() => map.current.invalidateSize(), 60); }, [active]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', c.accent);
    map.current.flyTo(c.center, 11, { duration: .8 });
  }, [city]);
  useEffect(() => {
    const h = e => { if (!e.target.closest('.tagdd')) setTdd(false); };
    document.addEventListener('click', h); return () => document.removeEventListener('click', h);
  }, []);
  useEffect(() => {
    const d = dlg.current; if (tripOpen && !d.open) d.showModal(); if (!tripOpen && d.open) d.close();
  }, [tripOpen]);

  const pick = (id, fromMap) => {
    setSel(id);
    if (fromMap) { document.querySelector(`.card[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const p = placesRef.current.find(x => x.id === id);
    if (p) { setMv('map'); setTimeout(() => map.current.invalidateSize(), 50); map.current.flyTo([p.latitude, p.longitude], 14, { duration: .6 }); markers.current[id]?.openPopup(); }
  };
  useEffect(() => {
    layer.current.clearLayers(); markers.current = {};
    shown.forEach(p => {
      const m = L.marker([p.latitude, p.longitude], { icon: pin(p, null, []), title: p.name, keyboard: false, draggable: isAdmin })
        .bindPopup(`<strong>${esc(p.name)}</strong><br>★ ${score(p)} · ${vnd(p.estimatedCost)} · ${dur(p.duration)}`
          + (isAdmin ? `<br><button type="button" class="adm-pop" onclick="window.GZ_ADM&&GZ_ADM.edit(${p.id})">✎ Sửa địa điểm</button>` : ''));
      m.on('click', () => pick(p.id, true));
      if (isAdmin) m.on('dragend', () => {
        const ll = m.getLatLng();
        if (GZ_OV.edit(city, p.id, { latitude: +ll.lat.toFixed(5), longitude: +ll.lng.toFixed(5) })) { refresh(); toast(`Đã dời “${p.name}” sang vị trí mới.`); }
      });
      m.addTo(layer.current); markers.current[p.id] = m;
    });
    if (shown.length > 1 && !skipFit.current) map.current.fitBounds(L.latLngBounds(shown.map(p => [p.latitude, p.longitude])), { padding: [40, 40], maxZoom: 13 });
    skipFit.current = false;
  }, [shown, isAdmin]);
  useEffect(() => {
    shown.forEach(p => { const m = markers.current[p.id]; if (m) { m.setIcon(pin(p, sel, trip)); m.setZIndexOffset(sel === p.id ? 500 : 0); } });
  }, [shown, sel, trips, city]);
  useEffect(() => {
    if (!focus) return;
    setCity(focus.city); setF(newF()); setSel(null);
    const t = setTimeout(() => {
      const p = buildPlaces(focus.city).find(x => x.id === focus.id); if (!p) return;
      setSel(focus.id); setMv('map'); map.current.invalidateSize();
      map.current.flyTo([p.latitude, p.longitude], 14, { duration: .6 }); markers.current[focus.id]?.openPopup();
    }, 700);
    return () => clearTimeout(t);
  }, [focus]);

  useEffect(() => { if (!armRst) return; const t = setTimeout(() => setArmRst(false), 4000); return () => clearTimeout(t); }, [armRst]);
  const refresh = () => { skipFit.current = true; setRev(r => r + 1); };
  const addPlace = () => {
    const z = zones[0] || ['Z1', ''], ct = map.current.getCenter();
    setEd({ isNew: true, p: { name: '', address: '', popularity: .7, estimatedCost: 0, duration: 60, openingTime: '08:00', closingTime: '17:00',
      latitude: +ct.lat.toFixed(5), longitude: +ct.lng.toFixed(5), tags: [], zoneCode: z[0] } });
  };
  const exportJson = () => {
    const data = places.map(p => { const o = { ...p }; delete o._ed; delete o._new; return o; });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = city + '_places.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };
  const resetCity = () => {
    if (!armRst) { setArmRst(true); return; }
    setArmRst(false); GZ_OV.resetCity(city); refresh(); toast('Đã khôi phục toàn bộ dữ liệu gốc của tỉnh này.');
  };
  const saveEd = patch => {
    let id = ed.p.id;
    if (ed.isNew) { patch.city = c.api; id = GZ_OV.add(city, patch); toast(`Đã thêm “${patch.name}”.`); }
    else { GZ_OV.edit(city, id, patch); toast('Đã lưu thay đổi.'); }
    const isNew = ed.isNew; setEd(null); refresh(); if (isNew) setTimeout(() => pick(id), 80);
  };
  const revertEd = () => { GZ_OV.revert(city, ed.p.id); setEd(null); refresh(); toast('Đã khôi phục dữ liệu gốc của địa điểm.'); };
  const delEd = () => { const nm = ed.p.name; GZ_OV.remove(city, ed.p.id); setEd(null); refresh(); toast(`Đã xóa “${nm}”.`); };
  const [savedList, setSavedList] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { const m = map.current; m.invalidateSize();
      if (mode !== 'plan' && shown.length > 1) m.fitBounds(L.latLngBounds(shown.map(p => [p.latitude, p.longitude])), { padding: [40, 40], maxZoom: 13 }); }, 120);
    return () => clearTimeout(t);
  }, [mode]);
  const saveList = () => {
    const cost = tripItems.reduce((t, p) => t + p.estimatedCost, 0);
    onSaveTrip({ source: 'list', city, cityName: c.name, name: 'Danh sách ' + c.name, cost, days: [{ dayNumber: 1, title: 'Địa điểm đã chọn', totalEstimatedCost: cost,
      activities: tripItems.map(p => ({ placeName: p.name, address: p.address, duration: p.duration, estimatedCost: p.estimatedCost, timeSlot: '', latitude: p.latitude, longitude: p.longitude })) }] });
    setSavedList(true); setTimeout(() => setSavedList(false), 1800);
  };
  const changeCity = k => { setCity(k); setF(newF()); setSel(null); };
  const tripItems = places.filter(p => trip.includes(p.id)).sort((a, b) => a.zoneCode.localeCompare(b.zoneCode) || b.popularity - a.popularity);
  const toggleTrip = id => setTrip(trip.includes(id) ? trip.filter(x => x !== id) : [...trip, id]);
  const copyTrip = async () => {
    const text = `Lịch trình ${c.name}\n` + tripItems.map((p, i) => `${i + 1}. ${p.name} (${vnd(p.estimatedCost)}, ${dur(p.duration)}) - ${p.address}`).join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  const tagSum = !f.tags.length ? 'Loại hình' : f.tags.length === 1 ? (TAGS[f.tags[0]] || f.tags[0]) : f.tags.length + ' loại hình';

  return (
    <>
      <header className="top" style={{ '--hero': IMG[city] ? `url("${IMG[city]}")` : 'none' }}>
        <div className="modes">
          <button type="button" aria-pressed={mode !== 'plan'} onClick={() => { location.hash = '#' + HASH.explore; }}>Khám phá</button>
          <button type="button" aria-pressed={mode === 'plan'} onClick={() => { location.hash = '#' + HASH.plan; }}>Lập lịch trình (Zone)</button></div>
        <div className="info">
          <div className="title"><h1>{c.name}</h1><p>{c.sub}</p></div>
          <div className="infobar">
            <div className="cityfield">
              <label htmlFor="citySel">Chọn tỉnh thành <span>*</span></label>
              <select id="citySel" aria-label="Chọn tỉnh thành" value={city} onChange={e => changeCity(e.target.value)}>
                {Object.entries(CITIES).map(([k, x]) => <option key={k} value={k}>{x.name}</option>)}
              </select>
            </div>
            <button className="tripbtn" type="button" onClick={() => setTripOpen(true)}>Lịch trình <b>{trip.length}</b></button>
          </div>
        </div>
      </header>

      <main className="layout" data-view={mv} hidden={mode === 'plan'}>
        <section className="panel" aria-label="Danh sách địa điểm">
          {isAdmin && <div className="adm-bar"><b>🛠 Chế độ Admin</b>
            <button type="button" onClick={addPlace}>+ Thêm địa điểm</button>
            <button type="button" className="ghost" onClick={exportJson}>Xuất JSON</button>
            <button type="button" className="ghost" onClick={resetCity}>{armRst ? 'Bấm lại để xác nhận' : 'Khôi phục dữ liệu gốc'}</button></div>}
          <form className="filters" onSubmit={e => e.preventDefault()}>
            <input type="search" placeholder="Tìm tên hoặc địa chỉ" aria-label="Tìm kiếm" value={f.q} onChange={e => upd({ q: e.target.value })} />
            <div className="row">
              <details className={'tagdd' + (f.tags.length ? ' on' : '')} open={tdd}>
                <summary aria-label="Loại hình" onClick={e => { e.preventDefault(); setTdd(!tdd); }}><span>{tagSum}</span></summary>
                <div className="tagmenu" role="group" aria-label="Loại hình">
                  <button type="button" className="tagclear" hidden={!f.tags.length} onClick={() => upd({ tags: [] })}>Bỏ chọn tất cả</button>
                  {present.map(t =>
                    <label key={t} className="opt">
                      <input type="checkbox" checked={f.tags.includes(t)} onChange={e => upd({ tags: e.target.checked ? [...f.tags, t] : f.tags.filter(x => x !== t) })} />
                      <span>{TAGS[t] || t}</span><em>{places.filter(p => p.tags.includes(t)).length}</em>
                    </label>)}
                </div>
              </details>
              <select aria-label="Khu vực" value={f.zone} onChange={e => upd({ zone: e.target.value })}>
                <option value="all">Tất cả khu vực</option>
                {zones.map(([zc, n]) => <option key={zc} value={zc}>{zc.replace(/\D/g, '')}. {n}</option>)}
              </select>
              <select aria-label="Giá vé" value={String(f.cost)} onChange={e => upd({ cost: Number(e.target.value) })}>
                <option value="1000000000">Mọi mức giá</option><option value="0">Miễn phí</option>
                <option value="100000">Đến 100.000đ</option><option value="300000">Đến 300.000đ</option>
              </select>
            </div>
            <div className="row2">
              <select aria-label="Sắp xếp" value={f.sort} onChange={e => upd({ sort: e.target.value })}>
                <option value="pop">Nổi tiếng nhất</option><option value="costAsc">Giá thấp đến cao</option>
                <option value="durAsc">Thời gian ngắn nhất</option><option value="name">Tên A–Z</option>
              </select>
              <label className="check"><input type="checkbox" checked={f.open} onChange={e => upd({ open: e.target.checked })} /> Đang mở cửa</label>
            </div>
          </form>
          <p className="count" aria-live="polite">{shown.length} / {places.length} địa điểm</p>
          <div className="list">
            {!shown.length && <p className="empty">Không có địa điểm phù hợp. Hãy bỏ bớt bộ lọc để xem thêm.</p>}
            {shown.map(p => {
              const open = isOpen(p), inTrip = trip.includes(p.id), isFav = favs.some(x => x.k === city + ':' + p.id);
              const tl = inTrip ? 'Bỏ khỏi lịch trình' : 'Thêm vào lịch trình', fl = isFav ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích';
              return (
                <article key={p.id} className={'card' + (sel === p.id ? ' sel' : '')} data-id={p.id} tabIndex={0}
                  onClick={e => { if (!e.target.closest('button,a')) pick(p.id); }}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); pick(p.id); } }}>
                  <div className="zone" title={p.zoneName}>{zNum(p)}</div>
                  <div>
                    <h3>{p.name}{isAdmin && (p._new || p._ed) && <em className="adm-tag">{p._new ? 'mới' : 'đã sửa'}</em>}</h3>
                    <div className="meta">
                      <span className="sc" title="Điểm nổi tiếng (0–10)">★ {score(p)}</span>
                      <span className={p.estimatedCost ? '' : 'free'}>{vnd(p.estimatedCost)}</span>
                      <span>{dur(p.duration)}</span>
                      <span>{is24h(p) ? 'Mở cả ngày' : `${p.openingTime}–${p.closingTime}`}</span>
                      <span className={'st ' + (open ? 'on' : 'off')}>{open ? 'Đang mở' : 'Đã đóng'}</span>
                    </div>
                    <div className="sub">{p.zoneName} · <b>{p.tags.map(t => TAGS[t] || t).join(', ')}</b></div>
                    <p className="addr">{p.address}</p>
                  </div>
                  <div className="cact">
                    {isAdmin && <button type="button" className="adm-b" aria-label="Sửa địa điểm" title="Sửa địa điểm" onClick={() => setEd({ p, isNew: false })}>✎</button>}
                    <button type="button" className="fav-b" aria-pressed={isFav} aria-label={fl} title={fl} onClick={() => toggleFav(city, p)}>{isFav ? '♥' : '♡'}</button>
                    <button type="button" aria-pressed={inTrip} aria-label={tl} title={tl} onClick={() => toggleTrip(p.id)}>{inTrip ? '✓' : '+'}</button>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noopener" aria-label="Chỉ đường" title="Chỉ đường">↗</a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <section className="mapwrap" aria-label="Bản đồ"><div id="map" ref={mapEl}></div></section>
      </main>

      <Planner city={city} changeCity={changeCity} active={active && mode === 'plan'} places={places} onSave={onSaveTrip} />

      <div className="viewtoggle" role="group" aria-label="Chế độ xem">
        {[['list', 'Danh sách'], ['map', 'Bản đồ']].map(([v, t]) =>
          <button key={v} type="button" aria-pressed={mv === v} onClick={() => { setMv(v); setTimeout(() => map.current.invalidateSize(), 50); }}>{t}</button>)}
      </div>

      <dialog ref={dlg} onClose={() => setTripOpen(false)} onClick={e => { if (e.target === dlg.current) setTripOpen(false); }}>
        <div className="dhead"><h2>Lịch trình {c.name}</h2><button type="button" onClick={() => setTripOpen(false)} aria-label="Đóng">Đóng</button></div>
        <ol>
          {tripItems.map(p =>
            <li key={p.id}><div><strong>{p.name}</strong><small>{p.zoneName} · {vnd(p.estimatedCost)} · {dur(p.duration)}</small></div>
              <button type="button" onClick={() => toggleTrip(p.id)}>Bỏ</button></li>)}
        </ol>
        {!tripItems.length && <p className="empty">Chưa có địa điểm nào. Bấm “Thêm vào lịch trình” ở bất kỳ thẻ nào.</p>}
        <div className="totals">{tripItems.length ? `${tripItems.length} điểm · ${vnd(tripItems.reduce((s, p) => s + p.estimatedCost, 0))} tiền vé · ${dur(tripItems.reduce((s, p) => s + p.duration, 0))} tham quan` : ''}</div>
        <div className="dfoot">
          <button type="button" disabled={!tripItems.length} onClick={saveList}>{savedList ? 'Đã lưu ✓' : 'Lưu vào Chuyến đi của tôi'}</button>
          <button type="button" className="ghost" onClick={copyTrip}>{copied ? 'Đã sao chép' : 'Sao chép danh sách'}</button>
          <button type="button" className="ghost" onClick={() => setTrip([])}>Xóa tất cả</button>
        </div>
      </dialog>
      {ed && <AdmDlg ed={ed} zones={zones} onSave={saveEd} onRevert={revertEd} onDelete={delEd} onClose={() => setEd(null)} />}
    </>
  );
}

function Favs({ favs, setFavs, onMap, user, openAuth }) {
  const [flt, setFlt] = useState('all');
  const [sure, setSure] = useState(null);
  useEffect(() => { if (sure == null) return; const t = setTimeout(() => setSure(null), 2500); return () => clearTimeout(t); }, [sure]);
  const nm = k => CITIES[k]?.name || k;
  const cities = [...new Set(favs.map(x => x.city))];
  const cur = flt !== 'all' && !cities.includes(flt) ? 'all' : flt;
  const list = favs.filter(x => cur === 'all' || x.city === cur);
  return (
    <>
      <div className="gz-pb" data-k="hanoi" style={bg('hanoi')}>
        <div className="gz-wrap"><h1>Địa điểm yêu thích</h1><p className="gz-crumb"><A v="home">Trang chủ</A> / Yêu thích</p></div>
      </div>
      <div className="gz-tbody"><div className="gz-wrap">
        {!user && favs.length > 0 && <div className="gz-gnote"><p>Bạn chưa đăng nhập, nên danh sách yêu thích chỉ lưu trên trình duyệt này.</p>
          <button type="button" onClick={() => openAuth('login')}>Đăng nhập</button><button type="button" className="alt" onClick={() => openAuth('register')}>Tạo tài khoản</button></div>}
        {favs.length > 0 && <div className="gz-tbar"><p>{list.length} địa điểm yêu thích{cur !== 'all' ? ' ở ' + nm(cur) : ''}</p>
          <button type="button" className="gz-link" onClick={() => sure === 'all' ? (setFavs([]), setSure(null)) : setSure('all')}>{sure === 'all' ? 'Bấm lại để xóa tất cả' : 'Xóa tất cả'}</button></div>}
        {cities.length > 1 && <div className="fv-chips" role="group" aria-label="Lọc theo tỉnh thành">
          {['all', ...cities].map(k => <button key={k} type="button" aria-pressed={cur === k} onClick={() => setFlt(k)}>
            {k === 'all' ? 'Tất cả' : nm(k)}<em>{k === 'all' ? favs.length : favs.filter(x => x.city === k).length}</em></button>)}</div>}
        <div className="gz-tgrid">
          {list.map(x =>
            <article key={x.k} className="fcard" style={{ '--fc': CITIES[x.city]?.accent || '#2563eb' }}>
              <div className="fc-top"><span className="fc-city">{nm(x.city)}</span><h3>{x.name}</h3>
                <div className="fc-meta"><span className="sc">★ {(x.pop * 10).toFixed(1).replace('.', ',')}</span><span>{vnd(x.cost)}</span><span>{dur(x.dur)}</span></div>
                <p className="fc-sub">{x.zoneName}{x.address ? ' · ' + x.address : ''}</p>
                {x.tags?.length > 0 && <div className="fc-tags">{x.tags.map(t => <span key={t}>{TAGS[t] || t}</span>)}</div>}</div>
              <div className="fc-act">
                <button type="button" onClick={() => onMap(x)}>Xem trên bản đồ</button>
                <a className="ghost" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lng}`}>Chỉ đường</a>
                <button type="button" className={'del' + (sure === x.k ? ' sure' : '')} onClick={() => sure === x.k ? setFavs(favs.filter(y => y.k !== x.k)) : setSure(x.k)}>{sure === x.k ? 'Bấm lại để bỏ' : 'Bỏ thích'}</button>
              </div>
            </article>)}
        </div>
        {!favs.length && <div className="gz-tempty">
          <div className="ic">♡</div><h2>Chưa có địa điểm yêu thích</h2>
          <p>Bấm biểu tượng ♡ ở bất kỳ địa điểm nào trong mục Khám phá để lưu lại, rồi quay lại đây xem bất cứ lúc nào.</p>
          <A v="explore" className="gz-btn">Khám phá điểm đến</A></div>}
      </div></div>
    </>
  );
}

const readFavs = k => { try { const a = JSON.parse(localStorage.getItem(k)); return Array.isArray(a) ? a : []; } catch { return []; } };
function App() {
  const [view, setView] = useState(getView);
  const [focus, setFocus] = useState(null);
  const [user, setUser] = useState(() => GZA.user());
  const [auth, setAuth] = useState(null);
  const [tst, setTst] = useState(null);
  const fkey = user ? 'gz:favs:' + user.id : 'gz:favs';
  const [favs, setFavsRaw] = useState(() => readFavs(fkey));
  useEffect(() => { setFavsRaw(readFavs(fkey)); }, [fkey]);
  const setFavs = a => { setFavsRaw(a); try { localStorage.setItem(fkey, JSON.stringify(a)); } catch {} };
  const tkey = user ? 'gz:trips:' + user.id : 'gz:trips';
  const [trips, setTripsRaw] = useState(() => readFavs(tkey));
  useEffect(() => { setTripsRaw(readFavs(tkey)); }, [tkey]);
  const setTrips = a => { setTripsRaw(a); try { localStorage.setItem(tkey, JSON.stringify(a)); } catch {} };
  const nag = useRef(0);
  const saveTrip = t => {
    setTrips([{ ...t, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: Date.now() }, ...trips]);
    if (!user && !nag.current++) toast('Đã lưu trên trình duyệt này. Đăng nhập để giữ chuyến đi trong tài khoản.', 'Đăng nhập', () => openAuth('login'));
  };
  useEffect(() => {
    const h = () => { setView(getView()); window.scrollTo(0, 0); };
    addEventListener('hashchange', h); return () => removeEventListener('hashchange', h);
  }, []);
  const eff0 = view === 'account' && !user ? 'home' : view, eff = eff0 === 'plan' ? 'explore' : eff0, mode = eff0 === 'plan' ? 'plan' : 'explore';
  useEffect(() => { document.body.dataset.v = eff; document.body.classList.toggle('planning', mode === 'plan'); }, [eff, mode]);
  useEffect(() => { if (!tst) return; const t = setTimeout(() => setTst(null), tst.label ? 7000 : 3800); return () => clearTimeout(t); }, [tst]);
  const toast = (msg, label, fn) => setTst({ msg, label, fn, n: Date.now() });
  const openAuth = tab => setAuth({ tab });
  const refreshUser = () => setUser(GZA.user());
  const onAuth = (u, msg) => { const n = GZA.merge(u); setAuth(null); setUser(GZA.user()); toast(msg + (n ? ` Đã chuyển ${n} chuyến đi vào tài khoản.` : '')); };
  const logout = silent => {
    GZA.del(GZA.SK); GZA.del(GZA.SK, 1); setUser(null);
    if (!silent) toast('Đã đăng xuất.');
    if (view === 'account') location.hash = '#' + HASH.home;
  };
  const toggleFav = (city, p) => {
    const k = city + ':' + p.id, old = favs.find(x => x.k === k);
    if (old) { setFavs(favs.filter(x => x.k !== k)); toast(`Đã bỏ “${p.name}” khỏi yêu thích.`, 'Hoàn tác', () => setFavs([old, ...favs.filter(x => x.k !== k)])); return; }
    setFavs([{ k, city, id: p.id, name: p.name, address: p.address || '', zoneName: p.zoneName || '', cost: p.estimatedCost || 0, dur: p.duration || 0,
      lat: p.latitude, lng: p.longitude, tags: p.tags || [], pop: p.popularity || 0, t: Date.now() }, ...favs]);
    toast(`Đã thêm “${p.name}” vào yêu thích.`, 'Xem', () => { location.hash = '#' + HASH.favs; });
  };
  const onMap = x => { setFocus({ city: x.city, id: x.id, n: Date.now() }); location.hash = '#' + HASH.explore; };
  const ctx = { user, isAdmin: user?.role === 'admin', toast, openAuth };
  return (
    <Ctx.Provider value={ctx}>
      <Nav view={eff} favN={favs.length} tripN={trips.length} user={user} openAuth={openAuth} logout={logout} />
      <V v="home" cur={eff} cls="gz-hero" aria-label="GeoZone AI"><Home /></V>
      <V v="about" cur={eff} cls="gz-about"><About /></V>
      <V v="favs" cur={eff} cls="gz-favs" aria-label="Địa điểm yêu thích"><Favs favs={favs} setFavs={setFavs} onMap={onMap} user={user} openAuth={openAuth} /></V>
      <V v="trips" cur={eff} cls="gz-trips" aria-label="Chuyến đi của tôi"><Trips trips={trips} setTrips={setTrips} user={user} openAuth={openAuth} /></V>
      <V v="account" cur={eff} cls="gz-account" aria-label="Tài khoản">{user && <Account key={user.id} user={user} refresh={refreshUser} toast={toast} logout={logout} />}</V>
      <div className={'gz-view gz-explore' + (eff === 'explore' ? ' on' : '')} data-view="explore">
        <Explore active={eff === 'explore'} favs={favs} toggleFav={toggleFav} focus={focus} mode={mode} onSaveTrip={saveTrip} />
      </div>
      <AuthDlg auth={auth} openAuth={openAuth} close={() => setAuth(null)} onAuth={onAuth} />
      <div className={'gz-toast' + (tst ? ' on' : '')} role="status" aria-live="polite">
        {tst && <><span>{tst.msg}</span>{tst.label && <button type="button" onClick={() => { setTst(null); tst.fn(); }}>{tst.label}</button>}</>}
      </div>
    </Ctx.Provider>
  );
}


export default App;
