# GeoZone AI (React + Vite)

```bash
npm install
npm run dev      # chạy thử
npm run build    # build ra thư mục dist/
```

Cấu trúc:
- `src/App.jsx` – toàn bộ component React (Nav, Home, Explore, Planner, Favs, Trips, Account...).
- `src/lib/` – `overlay.js` (chỉnh sửa dữ liệu của admin), `auth.js` (đăng nhập/đăng ký), `core.js` (hằng số, hàm tiện ích, lớp bản đồ Leaflet).
- `src/data/` – dữ liệu địa điểm và ảnh nền.
- `src/styles/` – CSS giữ nguyên nội dung và thứ tự như file HTML gốc.
