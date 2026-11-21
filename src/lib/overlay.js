/* Dữ liệu địa điểm do Admin chỉnh sửa: lưu ở localStorage, chồng lên dữ liệu gốc (window.__DATA). */
window.GZ_OV = (function () {
  var K = 'gz:ov', mem = null, on = false;
  function rd() { if (mem) return mem; try { var v = JSON.parse(localStorage.getItem(K)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function wr(o) { try { localStorage.setItem(K, JSON.stringify(o)); mem = null; } catch (e) { mem = o; } }
  function cfg(o, k) { return o[k] || (o[k] = { e: {}, d: [], a: [], n: 10000 }); }
  return {
    isAdmin: function () { return on; },
    setAdmin: function (v) { on = !!v; },
    apply: function (key, arr) {
      var c = rd()[key]; if (!c) return arr;
      var gone = {}; (c.d || []).forEach(function (i) { gone[i] = 1; });
      var out = arr.filter(function (p) { return !gone[p.id]; }).map(function (p) {
        var e = c.e && c.e[p.id]; return e ? Object.assign({}, p, e, { _ed: 1 }) : p;
      });
      (c.a || []).forEach(function (p) { out.push(Object.assign({}, p, { _new: 1 })); });
      return out;
    },
    edit: function (key, id, patch) {
      if (!on) return false; var o = rd(), c = cfg(o, key);
      if (id >= 10000) c.a.forEach(function (p) { if (p.id === id) Object.assign(p, patch); });
      else c.e[id] = Object.assign(c.e[id] || {}, patch);
      wr(o); return true;
    },
    add: function (key, place) {
      if (!on) return null; var o = rd(), c = cfg(o, key);
      place.id = c.n++; c.a.push(place); wr(o); return place.id;
    },
    remove: function (key, id) {
      if (!on) return false; var o = rd(), c = cfg(o, key);
      if (id >= 10000) c.a = c.a.filter(function (p) { return p.id !== id; });
      else { delete c.e[id]; if (c.d.indexOf(id) < 0) c.d.push(id); }
      wr(o); return true;
    },
    revert: function (key, id) {
      if (!on) return false; var o = rd(), c = cfg(o, key);
      delete c.e[id]; c.d = c.d.filter(function (x) { return x !== id; }); wr(o); return true;
    },
    resetCity: function (key) { if (!on) return false; var o = rd(); delete o[key]; wr(o); return true; }
  };
})();

export const GZ_OV = window.GZ_OV;
export default GZ_OV;
