'use strict';
// m-vehicles.js — 3D models for every vehicle (tpl.kind 'vehicle', tpl.sub = car, bus, plane, ship...).
// Same layout as the 2D drawings in draw2.js (D.drawVehicle): positions below are written in the 2D numbers with
// y as height above the ground (the 2D y negated), and converted to model space by V.Y / V.pts.
// Wheels roll with the distance travelled (e.wheel), rotors and propellers spin, police/ambulance lights flash.
(function () {
  if (!SB.M3 || !window.THREE) return;
  const T = THREE, M3 = SB.M3, PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mix = (a, b, t) => SB.mixColor(a, b, t);
  const rq = v => Math.round(v * 4) / 4;
  const UP = new T.Vector3(0, 1, 0), tv = new T.Vector3();

  // ---------- shared geometry ----------
  // a tyre: a turned rubber profile, axis along z; lug > 0 gives chunky tread blocks (tractor, monster truck)
  const tyreGeo = (r, w, lug) => M3.geo('vtyre:' + rq(r) + ':' + rq(w) + ':' + lug, () => {
    // the profile closes into a dark disc in the middle: the hub well seen through the rim's spokes
    const ri = r * 0.6, p = [[0, -w * 0.12], [ri, -w * 0.12], [ri, -w / 2], [r * 0.88, -w / 2], [r * 0.97, -w * 0.42], [r, -w * 0.28], [r, w * 0.28], [r * 0.97, w * 0.42], [r * 0.88, w / 2], [ri, w / 2], [ri, w * 0.12], [0, w * 0.12]];
    const g = new T.LatheGeometry(p.map(q => new T.Vector2(q[0], q[1])), lug ? 64 : 30);
    if (lug) {
      const P = g.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), z = P.getZ(i), y = P.getY(i), rad = Math.hypot(x, z);
        if (rad < r * 0.9) continue;
        const a = Math.atan2(x, z), chev = a * 9 + Math.abs(y / w) * 2.2;   // chevron tread
        const bump = Math.cos(chev) > 0 ? lug : 0, s = (rad + bump) / rad;
        P.setX(i, x * s); P.setZ(i, z * s);
      }
      g.computeVertexNormals();
    }
    g.rotateX(PI / 2); return g;
  });
  // a cast wheel rim: a disc with n windows between the spokes, extruded along z
  const rimGeo = (r, w, n) => M3.geo('vrim:' + rq(r) + ':' + rq(w) + ':' + n, () => {
    const s = new T.Shape(); s.absarc(0, 0, r, 0, TAU, false);
    const gap = n > 6 ? 0.12 : 0.2;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU + gap, a1 = (i + 1) / n * TAU - gap, hp = new T.Path();
      hp.absarc(0, 0, r * 0.8, a0, a1, false); hp.absarc(0, 0, r * 0.34, a1, a0 + 0.0, true); s.holes.push(hp);
    }
    const b = Math.min(r * 0.06, w * 0.2);
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, w - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.7, bevelSegments: 1, curveSegments: 8 });
    g.translate(0, 0, -(w - 2 * b) / 2); return g;
  });
  const torusGeo = (R, r) => M3.geo('vtorus:' + rq(R) + ':' + rq(r), () => new T.TorusGeometry(R, r, 8, 36));
  const planeGeo = () => M3.geo('vplane', () => new T.PlaneGeometry(1, 1));
  // a sail: square (billowing cloth) or a triangle with the luff at x = 0; billow along +z
  const sailGeo = (w, h, bil, tri) => M3.geo('vsail:' + rq(w) + ':' + rq(h) + ':' + rq(bil) + ':' + (tri ? 1 : 0), () => {
    const g = new T.PlaneGeometry(1, 1, 8, 8), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const u = P.getX(i) + 0.5, v = P.getY(i) + 0.5;
      if (tri) P.setXYZ(i, u * w * (1 - v), v * h, bil * Math.sin(PI * u) * Math.sqrt(1 - v));
      else P.setXYZ(i, (u - 0.5) * w, (v - 0.5) * h, bil * Math.sin(PI * u) * (0.35 + 0.65 * Math.sin(PI * (0.15 + v * 0.85))));
    }
    g.computeVertexNormals(); return g;
  });
  // a lofted boat hull: sections from stern (u=0) to bow (u=1); sheer, keel (heights) and half-beam as functions of u
  const hullZ = (s, kk, b, y) => { const q = clamp((s - y) / Math.max(0.01, s - kk), 0, 1); return b * Math.cos(Math.asin(Math.pow(q, 1 / 0.55))); };
  function hullGeo(key, x0, x1, G, sheer, keel, beam) {
    return M3.geo(key, () => {
      const N = 22, Mn = 12, pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, x = x0 + (x1 - x0) * u, s = sheer(u), kk = keel(u), b = beam(u);
        for (let j = 0; j <= Mn; j++) { const f = j / Mn * PI; pos.push(x, G + s - (s - kk) * Math.pow(Math.sin(f), 0.55), b * Math.cos(f)); }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < Mn; j++) { const a = i * (Mn + 1) + j, c = a + Mn + 1; idx.push(a, c, a + 1, c, c + 1, a + 1); }
      const c0 = pos.length / 3; pos.push(x0, G + (sheer(0) + keel(0)) / 2, 0);   // the flat transom
      for (let j = 0; j < Mn; j++) idx.push(c0, j + 1, j);
      const g = new T.BufferGeometry(); g.setIndex(idx); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return g;
    });
  }
  function deckGeo(key, x0, x1, y, beam) {
    return M3.geo(key, () => {
      const s = new T.Shape(), N = 22;
      for (let i = 0; i <= N; i++) { const u = i / N; s[i ? 'lineTo' : 'moveTo'](x0 + (x1 - x0) * u, beam(u) * 0.96); }
      for (let i = N; i >= 0; i--) { const u = i / N; s.lineTo(x0 + (x1 - x0) * u, -beam(u) * 0.96); }
      const g = new T.ShapeGeometry(s); g.rotateX(-PI / 2); g.translate(0, y, 0); return g;
    });
  }
  // a closed outline that runs along the bottom with wheel arches cut out, then back over the given top profile
  function outline(xr, xf, yb, arches, top) {
    const p = [xr, yb];
    for (const a of arches.slice().sort((u, v) => u.x - v.x)) {
      const d = Math.asin(clamp((a.cy - yb) / a.r, -0.99, 0.99));
      for (let i = 0; i <= 10; i++) { const ang = PI + d - i / 10 * (PI + 2 * d); p.push(a.x + Math.cos(ang) * a.r, a.cy + Math.sin(ang) * a.r); }
    }
    p.push(xf, yb); for (const v of top) p.push(v);
    return p;
  }
  // a tank / digger track: a ring (stadium with a stadium hole) with a scrolling tread texture
  function trackGeo(x0, x1, yc, r, th, d) {
    const s = new T.Shape(); s.absarc(x1, yc, r, -PI / 2, PI / 2, false); s.absarc(x0, yc, r, PI / 2, PI * 1.5, false);
    const hp = new T.Path(); hp.absarc(x1, yc, r - th, -PI / 2, PI / 2, false); hp.absarc(x0, yc, r - th, PI / 2, PI * 1.5, false); s.holes.push(hp);
    const g = new T.ExtrudeGeometry(s, { depth: d - 1, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.4, bevelSegments: 1, curveSegments: 10 });
    g.translate(0, 0, -(d - 1) / 2); return g;
  }
  function treadTexture() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 8; const x = c.getContext('2d');
    x.fillStyle = '#3a3b3d'; x.fillRect(0, 0, 32, 8); x.fillStyle = '#18191b'; x.fillRect(0, 0, 9, 8); x.fillStyle = '#5b5d60'; x.fillRect(9, 0, 3, 8);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(0.25, 0.25); t.encoding = T.sRGBEncoding; return t;
  }
  const words = (text, color, o) => (c, W, H) => {
    o = o || {};
    if (o.bg) { c.fillStyle = o.bg; c.fillRect(0, 0, W, H); }
    c.font = 'bold ' + Math.round(H * (o.size || 0.72)) + 'px Arial, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.lineWidth = H * 0.1; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(text, W / 2, H * 0.54); }
    c.fillStyle = color; c.fillText(text, W / 2, H * 0.54);
  };

  // ---------- per-vehicle helpers (materials, wheels, panes, riders...) ----------
  function helpers(e, k, G) {
    const V = { k, G, wheels: [], spins: [], flash: [], riders: [], anims: [], dist: 0, lastW: e.wheel || 0 };
    const Y = V.Y = v => G + v;
    V.pts = a => a.map((v, i) => i % 2 ? G + v : v);
    const body = V.body = k.col('body');
    V.paint = k.mat(body, { metal: 0.3, rough: 0.32 });
    V.paintOf = (c, o) => k.mat(c, Object.assign({ metal: 0.3, rough: 0.32 }, o));
    V.glass = k.mat(mix(k.col('window'), '#0a1a2c', 0.66), { rough: 0.05, metal: 0.4, opacity: 0.74 });
    V.glassL = k.mat(mix(k.col('window'), '#0b2236', 0.35), { rough: 0.04, metal: 0.3, opacity: 0.42 });
    V.chrome = k.mat('#e8ecf0', { metal: 0.85, rough: 0.16 });
    V.steel = k.mat(k.col('metal'), { metal: 0.55, rough: 0.35 });
    V.rubber = k.mat(k.col('wheel'), { rough: 0.9, side: 'double' });
    V.alloy = k.mat('#d0d5da', { metal: 0.55, rough: 0.3 });
    V.trim = k.mat('#1d1f22', { rough: 0.55 });
    V.dark = k.mat('#0c0d0f', { rough: 0.9 });
    V.lampF = k.mat('#fff8e0', { glow: '#ffefb8', glowK: 1.2, rough: 0.15 });
    V.lampR = k.mat('#b3121c', { glow: '#ff2232', glowK: 0.8, rough: 0.2 });
    V.amber = k.mat('#e88a12', { glow: '#ff9a1a', glowK: 0.6, rough: 0.2 });
    V.both = fn => { fn(1); fn(-1); };
    // flat panels / bodies from 2D outlines (x, height pairs)
    V.slab = (pts, d, m, z, bev, par) => k.extrude(V.pts(pts), d, m || V.paint, par || k.root, 0, 0, z || 0, bev);
    V.rb = (x0, h0, x1, h1, d, m, z, r) => k.rbox(x1 - x0, h1 - h0, d, m || V.paint, k.root, (x0 + x1) / 2, Y((h0 + h1) / 2), z || 0, r);
    V.win = (pts, z, m) => V.both(s => k.extrude(V.pts(pts), 0.6, m || V.glass, k.root, 0, 0, s * z, 0));
    // a pane of glass lying along the segment [x0,h0,x1,h1], pushed `off` outward (away from the point cx,ch)
    V.pane = (seg, off, d, m, cx, ch) => {
      const [x0, h0, x1, h1] = seg, mx = (x0 + x1) / 2, my = (h0 + h1) / 2, dx = x1 - x0, dy = h1 - h0, L = Math.hypot(dx, dy);
      let nx = dy / L, ny = -dx / L; if ((mx - cx) * nx + (my - ch) * ny < 0) { nx = -nx; ny = -ny; }
      const me = k.box(L * 0.9, 0.7, d, m || V.glass, k.root, mx + nx * off, Y(my + ny * off), 0); me.rotation.z = Math.atan2(ny, nx) - PI / 2; return me;
    };
    // a round bar between two model-space points
    V.rod = (a, b, r, m, par, seg) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = (b[2] || 0) - (a[2] || 0), L = Math.hypot(dx, dy, dz) || 0.01;
      const me = k.cyl(r, r, L, m, par || k.root, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] || 0) + (b[2] || 0)) / 2, seg || 8);
      me.quaternion.setFromUnitVectors(UP, tv.set(dx / L, dy / L, dz / L)); return me;
    };
    V.rodH = (a, b, r, m, seg) => V.rod([a[0], Y(a[1]), a[2] || 0], [b[0], Y(b[1]), b[2] || 0], r, m, null, seg);
    V.lamp = (x, hh, z, sz, m) => V.both(s => k.sphere(sz, m, k.root, x, Y(hh), s * z));
    // a road wheel at (x, height) on the side z; its spinning part is driven by the distance travelled
    V.wheel = (x, hh, z, r, wd, o) => {
      o = o || {};
      const g = k.group(k.root, x, Y(hh), z), sp = k.group(g);
      k.mesh(tyreGeo(r, wd, o.lug || 0), o.tyre || V.rubber, sp);
      const rr = r * (o.rim || 0.64);
      k.mesh(rimGeo(rr, wd * 0.72, o.spokes || 5), o.rimM || V.alloy, sp);
      k.cyl(rr * 0.22, rr * 0.26, wd * 0.8, o.hubM || V.chrome, sp, 0, 0, 0, 10).rotation.x = PI / 2;
      V.wheels.push({ g: sp, r });
      return g;
    };
    V.wheels4 = (xs, hh, z, r, wd, o) => { for (const x of xs) V.both(s => V.wheel(x, hh, s * z, r, wd, o)); };
    // a thin spoked bicycle wheel
    V.spoked = (x, hh, z, r, o) => {
      o = o || {};
      const g = k.group(k.root, x, Y(hh), z), sp = k.group(g);
      k.mesh(torusGeo(r - (o.t || 1.1), o.t || 1.1), V.rubber, sp);
      k.mesh(torusGeo(r - (o.t || 1.1) * 2 - 0.3, 0.45), V.chrome, sp);
      const n = o.n || 6;
      for (let i = 0; i < n; i++) { const s = k.cyl(0.18, 0.18, (r - 2.5) * 2, V.chrome, sp, 0, 0, 0, 4); s.rotation.z = i / n * PI; s.rotation.y = (i % 2 ? 0.06 : -0.06); }
      k.cyl(1.1, 1.1, 3.4, V.steel, sp, 0, 0, 0, 10).rotation.x = PI / 2;
      V.wheels.push({ g: sp, r });
      return g;
    };
    // a painted label (canvas texture) on both sides of the vehicle at |z|
    let dn = 0;
    V.decal = (paint, cw, ch, x, hh, z, w, hgt, par, one) => {
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; paint(cv.getContext('2d'), cw, ch);
      const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
      const m = k.mat('#ffffff', { rough: 0.38, opacity: 0.999, decal: ++dn }); m.map = tex; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.needsUpdate = true;
      const out = [];
      for (const s of one ? [1] : [1, -1]) {
        const me = k.mesh(planeGeo(), m, par || k.root, x, par ? hh : Y(hh), s * z); me.scale.set(w, hgt, 1);
        if (s < 0) me.rotation.y = PI; me.castShadow = false; out.push(me);
      }
      return out;
    };
    // a light that blinks between two materials
    V.blink = (mesh, on, off, rate, ph) => { V.flash.push({ m: mesh, on, off, rate, ph: ph || 0 }); return mesh; };
    V.spin = (g, ax, f) => V.spins.push({ g, ax, f });

    // ---- people ----
    const skinM = () => k.mat(k.col('skin'), { rough: 0.62 }), hairM = () => k.mat(k.col('hair'), { rough: 0.9 });
    // a head with hair (and eyes when `eyes`), local to `par`, facing +x
    V.headAt = (par, x, y, z, r, o) => {
      o = o || {};
      const hd = k.group(par, x, y, z);
      k.sphere([r * 0.95, r, r * 0.9], skinM(), hd);
      k.sphere(r * 0.2, skinM(), hd, r * 0.95, -r * 0.1, 0);   // nose
      if (o.helmet) {
        k.sphere([r * 1.18, r * 1.16, r * 1.12], o.helmet, hd, -r * 0.05, r * 0.08, 0);
        k.sphere([r * 0.5, r * 0.45, r * 0.95], V.glass, hd, r * 0.78, r * 0.08, 0);
      } else {
        k.sphere([r * 1.0, r * 0.92, r * 0.96], hairM(), hd, -r * 0.2, r * 0.22, 0);
        if (o.eyes !== false) for (const s of [1, -1]) k.eye(r * 0.17, hd, r * 0.8, r * 0.08, s * r * 0.36, { dir: [1, 0.05, s * 0.3] });
      }
      return hd;
    };
    // a seated driver seen through the side windows: head and shoulders
    V.driver = (x, hh, z, s) => {
      s = s || 1;
      k.sphere([3.6 * s, 4.2 * s, 5.2 * s], k.mat(k.col('cloth'), { rough: 0.8 }), k.root, x - 1 * s, Y(hh - 6.5 * s), z);
      return V.headAt(k.root, x, Y(hh), z, 3.6 * s, { eyes: false });
    };
    // a full rider (bikes, scooters, skateboards, the tractor): o.hip / o.hand / o.feet in 2D heights;
    // o.pedal { x, h, r } makes the feet go round with the cranks; o.lean tips the shoulders forward
    V.rider = (o) => {
      const s = o.s || 1, g = k.group(k.root, 0, 0, 0);
      const cloth = k.mat(k.col('cloth'), { rough: 0.82 }), pants = k.mat(k.col('pants'), { rough: 0.85 }), shoe = k.mat(k.col('shoe'), { rough: 0.6 }), skin = skinM();
      const hx = o.hip[0], hy = Y(o.hip[1]), shx = hx + (2 + (o.lean || 0) * 7) * s, shy = hy + 15 * s;
      const torso = k.limb(15 * s, 4.7 * s, 4.1 * s, cloth, g, shx, shy, 0); torso.limb.scale.z = 1.25;
      torso.rotation.z = Math.atan2(hx - shx, -(hy - shy));
      k.sphere([4.3 * s, 3.6 * s, 5.2 * s], pants, g, hx, hy, 0);
      k.cyl(1.5 * s, 1.7 * s, 3 * s, skin, g, shx + 0.6 * s, shy + 1.8 * s, 0);
      V.headAt(g, shx + 1.2 * s, shy + 6.6 * s, 0, 4.4 * s, { helmet: o.helmet });
      const arm = [], leg = [];
      for (const sd of [1, -1]) {
        const up = k.limb(8 * s, 1.9 * s, 1.6 * s, cloth, g, shx, shy - 0.5 * s, sd * 5 * s), lo = k.limb(7.6 * s, 1.6 * s, 1.3 * s, cloth, g, 0, 0, sd * 5 * s);
        k.sphere(1.5 * s, skin, lo, 0, -7.8 * s, 0); arm.push([up, lo]);
        const th = k.limb(10.5 * s, 2.7 * s, 2.2 * s, pants, g, hx, hy, sd * 2.6 * s), sh = k.limb(10 * s, 2.2 * s, 1.7 * s, pants, g, 0, 0, sd * 2.6 * s);
        k.rbox(6 * s, 2.4 * s, 3.2 * s, shoe, sh, 1.7 * s, -10.4 * s, 0, 1 * s); leg.push([th, sh]);
      }
      const ik = (p0, p1, jx, jy, tx, ty, a, b, bend) => {
        const dx = tx - jx, dy = ty - jy, d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01);
        const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), a1 = Math.atan2(dy, dx) + bend * al;
        const kx = jx + Math.cos(a1) * a, ky = jy + Math.sin(a1) * a;
        p0.position.x = jx; p0.position.y = jy; p0.rotation.z = Math.atan2(kx - jx, -(ky - jy));
        p1.position.x = kx; p1.position.y = ky; p1.rotation.z = Math.atan2(tx - kx, -(ty - ky));
      };
      V.riders.push((en, t) => {
        for (let i = 0; i < 2; i++) {
          let tx, ty;
          if (en.held) { tx = shx + (i ? -6 : 8) * s; ty = shy + 11 * s + Math.sin(t * 14 + i * 2) * 2; }   // arms up, flailing
          else { tx = o.hand[0]; ty = Y(o.hand[1]); }
          ik(arm[i][0], arm[i][1], shx, shy - 0.5 * s, tx, ty, 8 * s, 7.8 * s, -1);
          let fx, fy;
          if (o.pedal) { const a = -(V.dist / 13) * 1.0 + i * PI; fx = o.pedal.x + Math.cos(a) * o.pedal.r; fy = Y(o.pedal.h) + Math.sin(a) * o.pedal.r; }
          else { const f = o.feet[i] || o.feet[0]; fx = f[0]; fy = Y(f[1]) + 1.2 * s; }
          ik(leg[i][0], leg[i][1], hx, hy, fx, fy, 10.5 * s, 10 * s, 1);
        }
      });
      return g;
    };
    return V;
  }

  // ---------- cars ----------
  // s: { L, F (rear/front x), lift, D, top (body top profile, front to rear), cab, wins, ws (windscreen), rw (rear window), wx, wr, wcy, ar }
  function carLike(V, s) {
    const k = V.k, lift = s.lift || 0, D = s.D || 38, cd = s.cabD || D * 0.8, up = a => a.map((v, i) => i % 2 ? v + lift : v);
    const wcy = s.wcy || s.wr, ar = s.ar || s.wr + 3.5;
    V.slab(outline(s.L, s.F, lift + 4, s.wx.map(x => ({ x, cy: wcy, r: ar })), up(s.top)), D, V.paint, 0, 2.5);
    V.slab(up(s.cab), cd, V.paint, 0, 2);
    for (const w of s.wins) V.win(up(w), cd / 2 + 0.3);
    const cx = (s.ws[0] + s.rw[0]) / 2, ch = 30 + lift;
    V.pane(up(s.ws), 2.3, cd - 4.5, V.glass, cx, ch); V.pane(up(s.rw), 2.3, cd - 4.5, V.glass, cx, ch);
    const F = s.F, L = s.L;
    // lights, grille, bumpers, mirrors, handles
    V.both(z => {
      k.sphere([1.4, 2.3, 4.2], V.lampF, k.root, F + 2.6, V.Y(17 + lift), z * D * 0.3);
      k.box(1.6, 3.2, 6.5, V.lampR, k.root, L - 3.6, V.Y(18 + lift), z * D * 0.31);
      k.rbox(3.2, 2, 1.6, V.paint, k.root, s.ws[0] - 4, V.Y(s.ws[1] + 2), z * (cd / 2 + 2.4), 0.6);
      for (const hx of s.handles || [6, -14]) k.box(4, 0.9, 0.8, V.chrome, k.root, hx, V.Y(21 + lift), z * (D / 2 + 0.2));
    });
    k.rbox(2, 5, D * 0.42, V.trim, k.root, F + 2.9, V.Y(11.5 + lift), 0, 0.6);
    k.rbox(1.6, 0.8, D * 0.44, V.chrome, k.root, F + 3.4, V.Y(14.3 + lift), 0, 0.3);
    k.rbox(5, 4, D + 1.5, V.chrome, k.root, F + 1, V.Y(6.5 + lift), 0, 1.6);
    k.rbox(5, 4, D + 1.5, V.chrome, k.root, L - 1, V.Y(6.5 + lift), 0, 1.6);
    k.box(Math.abs(F - L) * 0.8, 3, D * 0.7, V.dark, k.root, (F + L) / 2, V.Y(lift + 4), 0);   // underbody shadow
    if (!s.noDriver) V.driver(s.drvX != null ? s.drvX : (s.ws[2] - 9), 30 + lift, D * 0.17);
    if (s.wheels !== false) V.wheels4(s.wx, wcy, D / 2 - 4.2, s.wr, s.ww || 7, s.wo);
    return { D, cd, top: 39 + lift };
  }
  const CAR = { L: -44, F: 44, top: [45, 13, 43, 21, 26, 24, -30, 24, -45, 21, -45, 9], cab: [-30, 23, -20, 39, 14, 39, 26, 23],
    wins: [[-17, 37, -25, 25, -3, 25, -3, 37], [0, 37, 0, 25, 22, 25, 11, 37]], ws: [26, 23, 14, 39], rw: [-30, 23, -20, 39], wx: [-26, 26], wr: 9, ar: 12.5 };

  const B = {};
  B.car = (V) => { carLike(V, CAR); };
  B.police = (V) => {
    const k = V.k, c = carLike(V, CAR), D = c.D;
    // black lower doors and the word POLICE, like a real black-and-white
    V.decal((x, W, H) => { x.fillStyle = '#16181c'; x.fillRect(0, H * 0.55, W, H * 0.45); words('POLICE', '#1d3f8f', { size: 0.42 })(x, W, H * 0.55); }, 256, 96, 0, 15.5, D / 2 + 0.12, 27, 15);
    // the light bar flashes red and blue
    k.rbox(22, 2.2, 13, V.trim, k.root, -3, V.Y(40.8), 0, 0.8);
    const red = k.mat('#e00000', { glow: '#ff0000', glowK: 0.9, rough: 0.2 }), redO = k.mat('#6a1416', { rough: 0.25, glow: '#3a0000', glowK: 0.2 });
    const blu = k.mat('#2a5bff', { glow: '#0030ff', glowK: 1.6, rough: 0.2 }), bluO = k.mat('#14265a', { rough: 0.25, glow: '#00052a', glowK: 0.2 });
    V.blink(k.rbox(9, 3.4, 11, redO, k.root, -8, V.Y(43.4), 0, 1.2), red, redO, 4, 0);
    V.blink(k.rbox(9, 3.4, 11, bluO, k.root, 2, V.Y(43.4), 0, 1.2), blu, bluO, 4, 1);
  };
  B.taxi = (V) => {
    const k = V.k, c = carLike(V, CAR), D = c.D;
    V.decal((x, W, H) => { const n = 16; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(i * W / n, j * H * 0.14, W / n, H * 0.14); } words('TAXI', '#111', { size: 0.5 })(x, W, H * 1.2); }, 256, 96, -2, 15, D / 2 + 0.12, 44, 15);
    k.rbox(18, 6, 8, k.mat('#fbfbf2', { glow: '#fff3c8', glowK: 0.35, rough: 0.3 }), k.root, -3, V.Y(42), 0, 1.5);
    V.decal(words('TAXI', '#111', { size: 0.8 }), 128, 48, -3, 42, 4.05, 15, 5.5);
  };
  B.limo = (V) => {
    carLike(V, { L: -74, F: 74, D: 40, top: [75, 13, 73, 21, 26, 24, -60, 24, -75, 21, -75, 9], cab: [-60, 23, -50, 39, 14, 39, 26, 23],
      wins: [0, 1, 2, 3].map(i => { const x = -47 + i * 16; return [x, 37, x, 26, x + 12, 26, x + 12, 37]; }).concat([[17, 37, 17, 25, 22.5, 25, 14, 37]]),
      ws: [26, 23, 14, 39], rw: [-60, 23, -50, 39], wx: [-52, 52], wr: 9, ar: 12.5, handles: [6, -26, -54], drvX: 10 });
    V.k.box(130, 1, 0.6, V.chrome, V.k.root, 0, V.Y(23.6), 20.2); V.k.box(130, 1, 0.6, V.chrome, V.k.root, 0, V.Y(23.6), -20.2);
  };
  B.monstertruck = (V) => {
    const k = V.k, lift = 22;
    const c = carLike(V, Object.assign({}, CAR, { lift, wcy: 18, wr: 18, ar: 21, wheels: false, D: 40 }));
    V.wheels4([-30, 30], 18, 25, 18, 16, { lug: 1.8, rim: 0.55, spokes: 6, rimM: V.chrome });
    V.both(z => {
      for (const x of [-30, 30]) {
        V.rodH([x + 4, 30, z * 14], [x, 18, z * 17], 1.3, V.chrome);                                        // shocks
        k.cyl(2.2, 2.2, 6, V.paintOf(k.col('cloth2')), k.root, x + 3, V.Y(26), z * 14.6, 10).rotation.z = 0.3;   // springs
      }
    });
    for (const x of [-30, 30]) k.cyl(1.8, 1.8, 50, V.trim, k.root, x, V.Y(18), 0, 10).rotation.x = PI / 2;   // axles
    k.box(80, 4, 10, V.trim, k.root, 0, V.Y(24), 0);
    return c;
  };
  B.racecar = (V) => {
    const k = V.k, wing = V.paintOf(k.col('cloth2')), carbon = k.mat('#202226', { rough: 0.4, metal: 0.3 });
    // monocoque: nose, cockpit, airbox, engine cover
    V.slab([54, 5, 54, 8.5, 30, 12, 12, 16, 4, 17, -6, 24, -12, 27, -18, 26, -40, 15, -47, 13, -47, 4, 40, 4], 15, V.paint, 0, 3);
    V.rb(-34, 4, 4, 14, 30, V.paint, 0, 4);                                               // sidepods
    V.rb(-38, 2, 52, 4, 26, carbon, 0, 0.8);                                              // floor
    V.rb(44, 2, 58, 3.6, 46, wing, 0, 0.6); V.both(z => V.rb(44, 2, 56, 8, 1.2, carbon, z * 23, 0.4));   // front wing
    V.rb(-55, 30, -40, 33.4, 36, wing, 0, 0.8); V.rb(-54, 26.5, -43, 28.5, 34, wing, 0, 0.6);           // rear wing
    V.both(z => { V.rb(-56, 23, -39, 35, 1.4, V.paint, z * 18.5, 0.5); V.rodH([-46, 16, z * 4], [-47, 30, z * 4], 0.9, carbon); });
    // driver in a helmet in the cockpit, halo over it
    k.rbox(12, 2, 9, V.dark, k.root, 2, V.Y(16.6), 0, 0.8);
    V.headAt(k.root, 1, V.Y(19.5), 0, 3.6, { helmet: V.paintOf(k.col('hat')) });
    V.rodH([10, 18, 0], [3, 23, 0], 0.8, carbon); V.rodH([3, 23, 4], [-5, 23, 4], 0.8, carbon); V.rodH([3, 23, -4], [-5, 23, -4], 0.8, carbon);
    V.decal((x, W, H) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(W / 2, H / 2, H * 0.46, 0, TAU); x.fill(); words('1', '#111', { size: 0.75 })(x, W, H); }, 64, 64, -20, 20, 6.9, 9, 9);
    V.both(z => {
      for (const x of [-30, 30]) { V.rodH([x * 0.6, 12, z * 5], [x, 9, z * 19], 0.6, carbon); V.rodH([x * 0.6, 7, z * 5], [x, 8, z * 19], 0.6, carbon); }
      k.sphere([1.2, 1.6, 3], V.lampF, k.root, 53, V.Y(7), z * 4);
    });
    V.wheels4([-30], 9.5, 20.5, 9.5, 11, { rim: 0.62, spokes: 7 }); V.wheels4([31], 9, 19.5, 9, 9, { rim: 0.62, spokes: 7 });
  };

  // ---------- trucks, vans, buses ----------
  function cab(V, x0, x1, D, o) {   // a truck cab facing +x with a near-vertical windscreen
    const k = V.k, top = o.top || 55;
    V.slab(outline(x0, x1, 8, (o.wx || []).map(x => ({ x, cy: 10, r: 13.2 })), [x1 + 1, 28, x1 - 2, top - 3, x1 - 6, top, x0 + 6, top, x0, top - 6]), D, V.paint, 0, 2.5);
    V.win([x0 + 14, top - 4, x0 + 14, 34, x1 - 3.5, 34, x1 - 5.5, top - 4], D / 2 + 0.3);
    V.pane([x1 + 1, 30, x1 - 2, top - 4], 2.3, D - 5, V.glass, x0 + 10, 30);
    k.rbox(2, 11, D * 0.5, V.trim, k.root, x1 + 2.8, V.Y(19), 0, 0.6);
    for (let i = 0; i < 4; i++) k.box(1, 0.7, D * 0.48, V.chrome, k.root, x1 + 3.8, V.Y(15 + i * 2.6), 0);
    V.lamp(x1 + 3.4, 21, D * 0.36, [1.4, 2.6, 3.4], V.lampF);
    k.rbox(6, 5, D + 2, V.chrome, k.root, x1 + 0.5, V.Y(8.5), 0, 1.8);
    V.both(z => { V.rodH([x1 - 4, 46, z * (D / 2)], [x1 - 1, 47, z * (D / 2 + 4)], 0.5, V.trim); k.rbox(1.5, 6, 3, V.trim, k.root, x1 - 1, V.Y(46), z * (D / 2 + 4.6), 0.5); });
    V.driver(x1 - 12, 42, D * 0.2);
  }
  B.truck = (V, o, kind) => {
    const k = V.k, D = 42, ice = kind === 'icecreamtruck';
    const boxM = ice ? k.mat(mix(V.body, '#fff', 0.2), { rough: 0.4, metal: 0.15 }) : V.paintOf(mix(V.body, '#fff', 0.08), { rough: 0.42, metal: 0.25 });
    V.rb(-63, 18, 17, 60, D + 1, boxM, 0, 1.6);
    if (!ice) for (let i = 1; i < 4; i++) V.both(z => k.box(0.8, 40, 0.5, V.trim, k.root, -63 + i * 20, V.Y(39), z * (D / 2 + 0.75)));   // panel ribs
    V.rb(-63, 8, 52, 15, 24, V.trim, 0, 0.5);
    cab(V, 19, 62, D - 2, { wx: [42] });
    V.both(z => { k.box(1.4, 3.8, 5, V.lampR, k.root, -63.6, V.Y(20.5), z * 16); k.cyl(4.6, 4.6, 14, V.chrome, k.root, 2, V.Y(13), z * 14, 16).rotation.z = PI / 2; k.rbox(1, 8, 9, V.dark, k.root, -36, V.Y(9), z * 17, 0.3); });
    V.rodH([18, 22, 13], [18, 68, 13], 1.6, V.chrome); k.cyl(1.9, 1.6, 3, V.chrome, k.root, 18, V.Y(68), 13);
    V.wheels4([-44, -20], 10, D / 2 - 5, 10, 10); V.wheels4([42], 10, D / 2 - 6, 10, 8);
    if (ice) {
      const c2 = k.col('cloth2');
      V.win([-52, 52, -52, 36, -14, 36, -14, 52], D / 2 + 0.6, V.glassL);
      const awM = [k.mat(c2, { rough: 0.7 }), k.mat('#fbfbf6', { rough: 0.7 })];
      V.both(z => { for (let i = 0; i < 6; i++) { const aw = k.box(7, 0.8, 8, awM[i % 2], k.root, -50.5 + i * 7, V.Y(54.5), z * (D / 2 + 3.4)); aw.rotation.x = z * 0.4; } });
      V.decal(words('ICE CREAM', '#e0457b', { size: 0.8, stroke: '#fff' }), 512, 72, -22, 27, D / 2 + 0.62, 60, 8.5);
      const wafer = k.mat('#d9a35b', { rough: 0.85 });
      k.cyl(1.5, 1.5, 4, V.steel, k.root, -24, V.Y(61), 0);
      const cone = k.cone(7, 16, wafer, k.root, -24, V.Y(70), 0, 14); cone.rotation.z = PI;
      k.sphere([8, 7, 8], k.mat('#ffd6e0', { rough: 0.55 }), k.root, -24, V.Y(80), 0);
      k.sphere(2, k.mat('#d0102a', { rough: 0.3 }), k.root, -24, V.Y(88), 0);
    }
  };
  B.icecreamtruck = (V, o) => B.truck(V, o, 'icecreamtruck');
  B.firetruck = (V) => {
    const k = V.k, D = 42;
    V.slab(outline(-68, 22, 9, [{ x: -48, cy: 10, r: 13.2 }, { x: -20, cy: 10, r: 13.2 }], [22, 54, -68, 54]), D, V.paint, 0, 2.5);
    const shut = k.mat('#c9ced3', { metal: 0.7, rough: 0.35 });
    for (const [x0, x1] of [[-65, -45], [-43, -23], [-21, 0]]) V.both(z => k.rbox(x1 - x0, 15, 1.2, shut, k.root, (x0 + x1) / 2, V.Y(44), z * (D / 2 + 0.5), 0.5));
    V.decal(words('FIRE', '#ffd23f', { size: 0.85, stroke: '#3a0a0a' }), 256, 64, -32, 29, D / 2 + 0.12, 26, 6.5);
    V.both(z => k.box(88, 1.6, 0.5, k.mat('#f2c94c', { metal: 0.6, rough: 0.3 }), k.root, -23, V.Y(24.5), z * (D / 2 + 0.3)));
    cab(V, 22, 66, D - 2, { wx: [46], top: 57 });
    // the ladder lies on the roof
    V.both(z => { k.box(80, 1.6, 1.4, V.steel, k.root, -26, V.Y(59.5), z * 7); V.rodH([-6, 54, z * 7], [-6, 58.7, z * 7], 0.8, V.steel); V.rodH([-56, 54, z * 7], [-56, 58.7, z * 7], 0.8, V.steel); });
    for (let i = 0; i < 7; i++) k.cyl(0.55, 0.55, 14, V.steel, k.root, -63 + i * 12.6, V.Y(59.5), 0, 6).rotation.x = PI / 2;
    k.cyl(5, 5, 9, k.mat('#d8d0c0', { rough: 0.6 }), k.root, 8, V.Y(57), 0, 14).rotation.x = PI / 2;   // hose reel
    const red = k.mat('#e00000', { glow: '#ff0000', glowK: 0.9, rough: 0.2 }), redO = k.mat('#6a1416', { rough: 0.25, glow: '#3a0000', glowK: 0.2 });
    k.rbox(18, 2, 12, V.trim, k.root, 46, V.Y(58), 0, 0.6);
    V.blink(k.rbox(7.5, 3.2, 10, redO, k.root, 41.5, V.Y(60.4), 0, 1.1), red, redO, 5, 0); V.blink(k.rbox(7.5, 3.2, 10, redO, k.root, 50.5, V.Y(60.4), 0, 1.1), red, redO, 5, 1);
    V.both(z => k.box(1.6, 3.8, 5, V.lampR, k.root, -70.6, V.Y(18), z * 16));
    V.rb(-69, 7, -66, 11, D + 1, V.chrome, 0, 1);
    V.wheels4([-48, -20], 10, D / 2 - 5, 10, 9); V.wheels4([46], 10, D / 2 - 6, 10, 8);
  };
  B.ambulance = (V) => {
    const k = V.k, D = 40, red = '#d81e2c';
    V.slab(outline(-58, 24, 9, [{ x: -40, cy: 10, r: 13.2 }], [24, 56, -58, 56]), D, V.paint, 0, 2.5);
    V.slab(outline(24, 60, 9, [{ x: 40, cy: 10, r: 13.2 }], [61, 22, 56, 30, 44, 52, 24, 54]), D - 2, V.paint, 0, 2.5);
    V.win([30, 50, 30, 33, 53, 33, 44.5, 50], (D - 2) / 2 + 0.3);
    V.pane([56, 30, 44, 52], 2.3, D - 7, V.glass, 34, 34);
    V.decal((x, W, H) => { x.fillStyle = red; x.fillRect(0, H * 0.62, W, H * 0.07); x.fillRect(W * 0.45, H * 0.04, W * 0.1, H * 0.4); x.fillRect(W * 0.385, H * 0.15, W * 0.23, H * 0.16); words('AMBULANCE', red, { size: 0.1 })(x, W, H * 1.04); }, 256, 160, -17, 33, D / 2 + 0.12, 80, 50);
    V.lamp(63.4, 20, 13, [1.3, 2.4, 3.6], V.lampF);
    k.rbox(2, 7, 18, V.trim, k.root, 63.2, V.Y(15), 0, 0.6);
    V.rb(58, 6.5, 64, 11, D + 1, V.chrome, 0, 1.6); V.rb(-60, 6.5, -55, 11, D + 1, V.chrome, 0, 1.6);
    V.both(z => k.box(1.6, 3.8, 5, V.lampR, k.root, -60.6, V.Y(20), z * 15));
    const r1 = k.mat('#e00000', { glow: '#ff0000', glowK: 0.9, rough: 0.2 }), r0 = k.mat('#6a1416', { rough: 0.25, glow: '#3a0000', glowK: 0.2 }), w1 = k.mat('#ffffff', { glow: '#fff6e0', glowK: 2, rough: 0.2 }), w0 = k.mat('#9aa0a6', { rough: 0.25 });
    k.rbox(16, 2, 12, V.trim, k.root, 32, V.Y(55.6), 0, 0.6);
    V.blink(k.rbox(7, 3.2, 10, r0, k.root, 28, V.Y(58), 0, 1.1), r1, r0, 4, 0); V.blink(k.rbox(7, 3.2, 10, w0, k.root, 36, V.Y(58), 0, 1.1), w1, w0, 4, 1);
    V.driver(48, 40, D * 0.2);
    V.wheels4([-40, 40], 10, D / 2 - 4.6, 10, 8);
  };
  B.bus = (V, o) => {
    const k = V.k, D = 46, school = o.school;
    V.slab(outline(-78, 78, 9, [{ x: -50, cy: 10, r: 13.2 }, { x: 50, cy: 10, r: 13.2 }], [79, 51, 72, 58, -71, 58, -79, 51]), D, V.paint, 0, 3);
    for (let i = 0; i < 6; i++) { const x = -68 + i * 22; V.win([x, 52, x, 36, x + 16, 36, x + 16, 52], D / 2 + 0.3); }
    V.win([64, 52, 64, 13, 74, 13, 74, 52], D / 2 + 0.3);
    V.pane([79.6, 30, 79.6, 52], 2.2, D - 7, V.glass, 0, 30); V.pane([-79.6, 34, -79.6, 52], 2.2, D - 9, V.glass, 0, 30);
    V.lamp(82.2, 19, 17, [1.3, 2.6, 3.4], V.lampF);
    V.both(z => { k.box(1.6, 5, 4, V.lampR, k.root, -82.2, V.Y(19), z * 18); });
    V.rb(77, 6.5, 83, 11, D + 1, school ? V.trim : V.chrome, 0, 1.6); V.rb(-83, 6.5, -77, 11, D + 1, school ? V.trim : V.chrome, 0, 1.6);
    k.rbox(2, 7, 22, V.trim, k.root, 82, V.Y(14), 0, 0.6);
    if (school) {
      V.both(z => { for (const hh of [21, 33]) k.box(140, 1.4, 0.6, V.trim, k.root, -6, V.Y(hh), z * (D / 2 + 0.3)); });
      V.decal(words('SCHOOL BUS', '#111', { size: 0.8 }), 512, 64, -6, 27, D / 2 + 0.25, 52, 6.5);
      for (const x of [-70, 70]) V.both(z => k.sphere([1.4, 1.6, 2.4], x > 0 ? V.amber : V.lampR, k.root, x > 0 ? 79 : -79, V.Y(55), z * 14));
      const stop = k.extrude([0, -3, 2.1, -2.1, 3, 0, 2.1, 2.1, 0, 3, -2.1, 2.1, -3, 0, -2.1, -2.1], 0.5, k.mat('#d8202c', { rough: 0.4 }), k.root, 60, V.Y(38), D / 2 + 1.2, 0); stop.scale.setScalar(1.6);
    } else {
      V.both(z => k.box(150, 3, 0.5, V.paintOf('#f4f4f4'), k.root, -2, V.Y(29), z * (D / 2 + 0.3)));
    }
    V.driver(70, 40, D * 0.25);
    V.wheels4([-50, 50], 10, D / 2 - 4.6, 10, 8);
  };

  // ---------- farm and building ----------
  B.tractor = (V) => {
    const k = V.k, frame = k.mat('#1b1c1e', { rough: 0.5, metal: 0.3 });
    V.slab([-4, 14, -4, 32, 20, 32, 41, 25, 42, 14], 16, V.paint, 0, 2.5);                 // hood
    V.rb(-38, 18, -2, 40, 20, V.paint, 0, 2.5);                                           // body under the seat
    V.rb(-34, 36, -18, 41, 14, V.trim, 0, 1);                                             // seat platform
    k.rbox(7, 2.5, 8, k.mat('#2a2a2a', { rough: 0.7 }), k.root, -16, V.Y(43), 0, 1); k.rbox(2.5, 8, 8, k.mat('#2a2a2a', { rough: 0.7 }), k.root, -20, V.Y(47), 0, 1);
    k.rbox(2.2, 12, 13, V.trim, k.root, 42.2, V.Y(21), 0, 0.6);
    for (let i = 0; i < 4; i++) k.box(0.8, 0.6, 12, V.steel, k.root, 43.4, V.Y(16.5 + i * 3), 0);
    V.lamp(40, 29, 5, [1.2, 1.8, 1.8], V.lampF);
    // fenders over the big rear wheels
    V.both(z => {
      const s = new T.Shape(); s.absarc(0, 0, 25, 0.15, PI - 0.15, false); s.absarc(0, 0, 22, PI - 0.15, 0.15, true);
      const g = new T.ExtrudeGeometry(s, { depth: 12, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, -6); k.own.push(g);
      k.mesh(g, V.paint, k.root, -20, V.Y(20), z * 19);
    });
    // roll frame and canopy, exhaust, steering wheel
    V.both(z => { V.rodH([-27, 40, z * 11], [-26, 70, z * 11], 1.1, frame); V.rodH([3, 32, z * 9], [2, 70, z * 9], 1.1, frame); });
    k.rbox(34, 2, 26, V.paintOf('#f2f2ee'), k.root, -12, V.Y(71), 0, 0.8);
    V.rodH([16, 31, 5], [16, 56, 5], 1.4, V.trim); k.cyl(1.9, 1.5, 3, V.chrome, k.root, 16, V.Y(57), 5, 10);
    V.rodH([-2, 36, 0], [2, 48, 0], 0.7, frame);
    const sw = k.mesh(torusGeo(3.4, 0.5), frame, k.root, 2, V.Y(48.5), 0); sw.rotation.y = PI / 2; sw.rotation.x = 0.6;
    V.rider({ hip: [-15, 46], hand: [1, 48.5], feet: [[-2, 39], [-2, 39]] });
    V.both(z => V.wheel(-20, 20, z * 18.5, 20, 12, { lug: 2.2, rim: 0.56, spokes: 8, rimM: k.mat('#f0d23a', { metal: 0.3, rough: 0.4 }) }));
    V.both(z => V.wheel(30, 10, z * 12, 10, 7, { lug: 1, rim: 0.56, spokes: 6, rimM: k.mat('#f0d23a', { metal: 0.3, rough: 0.4 }) }));
  };
  B.digger = (V) => {
    const k = V.k, tread = treadTexture(), tm = k.mat('#ffffff', { rough: 0.85, metal: 0.3, tread: 1 }); tm.map = tread; tm.needsUpdate = true;
    const g = trackGeo(-48, 2, 8, 7, 2.2, 10); k.own.push(g);
    V.both(z => k.mesh(g, tm, k.root, 0, V.Y(0), z * 12));
    V.wheels4([-42, -23, -4], 8, 12, 4.6, 6, { rim: 0.7, spokes: 5, tyre: V.steel, rimM: V.trim });
    V.rb(-46, 6, 0, 12, 18, V.trim, 0, 1);
    k.cyl(10, 10, 4, V.trim, k.root, -22, V.Y(14), 0, 20);                                // slew ring
    V.rb(-52, 16, -2, 32, 30, V.paint, 0, 3);                                             // house
    V.rb(-55, 16, -44, 30, 30, V.paintOf(mix(V.body, '#000', 0.25)), 0, 3);                // counterweight
    // the cab sits on the near-left of the house: a frame with glass all round
    V.slab([-44, 32, -44, 52, -24, 52, -18, 32], 14, V.paint, 7, 1.2);
    for (const z of [14.4, -0.4]) k.extrude(V.pts([-41, 49, -41, 34, -22, 34, -25.5, 49]), 0.6, V.glass, k.root, 0, 0, z, 0);
    const ws = V.pane([-18, 33, -24, 51], 1.3, 11, V.glass, -32, 40); ws.position.z = 7;
    V.rodH([-48, 30, -8], [-48, 44, -8], 1.2, V.trim);
    // the arm: boom, stick and bucket, digging slowly
    const ym = k.mat(V.body, { metal: 0.3, rough: 0.4 });
    const boom = k.group(k.root, -4, V.Y(28), 0);
    const L1 = 36, L2 = 34;
    k.rbox(L1 + 4, 5, 6, ym, boom, L1 / 2, 0, 0, 2);
    const stick = k.group(boom, L1, 0, 0);
    k.rbox(L2 + 3, 4, 5, ym, stick, L2 / 2, 0, 0, 1.6);
    const buck = k.group(stick, L2, 0, 0);
    const bm = k.mat(k.col('metal'), { metal: 0.6, rough: 0.45 });
    k.extrude([0, 2, 6, 4, 11, -2, 11, -9, 4, -13, -3, -10, -1, -4], 10, bm, buck, 0, 0, 0, 0.8);
    for (let i = 0; i < 4; i++) k.cone(0.8, 3, V.steel, buck, -3.6, -11.5, -3.6 + i * 2.4, 6).rotation.z = 2.4;
    const cyl1 = V.rod([0, 0, 0], [1, 0, 0], 1.4, V.chrome), cyl2 = V.rod([0, 0, 0], [1, 0, 0], 1.1, V.chrome);
    const pA = new T.Vector3(), pB = new T.Vector3();
    const place = (rod, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; rod.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0); rod.scale.y = L; rod.rotation.set(0, 0, Math.atan2(dx, -dy) + PI); };
    cyl1.geometry = M3.geo('vram:1.4', () => new T.CylinderGeometry(1.4, 1.4, 1, 8)); cyl2.geometry = M3.geo('vram:1.1', () => new T.CylinderGeometry(1.1, 1.1, 1, 8));
    cyl1.quaternion.identity(); cyl2.quaternion.identity();
    V.anims.push((en, t) => {
      const w = en.held ? 0 : t * 1.1 + en.seed;
      boom.rotation.z = 0.55 + Math.sin(w) * 0.14;
      stick.rotation.z = -1.75 + Math.sin(w + 1.2) * 0.3;
      buck.rotation.z = -0.5 + Math.sin(w + 2) * 0.45;
      // hydraulic rams follow the arm
      pA.set(-2, V.Y(22), 0); pB.set(L1 * 0.45, -2.5, 0); boom.localToWorld(pB); k.root.worldToLocal(pB);
      place(cyl1, pA, pB);
      pA.set(L1 * 0.6, 3, 0); boom.localToWorld(pA); k.root.worldToLocal(pA); pB.set(4, 2.5, 0); stick.localToWorld(pB); k.root.worldToLocal(pB);
      place(cyl2, pA, pB);
      tread.offset.x = -V.dist * 0.25;
    });
  };
  B.tank = (V) => {
    const k = V.k, tread = treadTexture(), tm = k.mat('#ffffff', { rough: 0.85, metal: 0.35, tread: 1 }); tm.map = tread; tm.needsUpdate = true;
    const D = 48, paint = k.mat(V.body, { metal: 0.15, rough: 0.7 });
    const g = trackGeo(-45, 45, 13, 10, 2.6, 12); k.own.push(g);
    V.both(z => k.mesh(g, tm, k.root, 0, V.Y(0), z * (D / 2 - 6)));
    V.wheels4([-40, -20, 0, 20, 40], 12, D / 2 - 6, 6.4, 7, { rim: 0.72, spokes: 6, tyre: V.trim, rimM: paint });
    V.rb(-44, 7, 44, 22, D - 24, paint, 0, 1);
    V.slab([-47, 22, -40, 32, 38, 32, 47, 22, 50, 20, -50, 20], D, paint, 0, 2);            // hull and fenders
    // turret on a bearing, barrel with a muzzle brake, hatch
    const tur = k.group(k.root, -6, V.Y(32), 0);
    k.lathe([[0, 0], [18, 0], [18.5, 2], [16.5, 8], [12, 11.5], [0, 12.5]], paint, tur, 0, 0, 0, 22);
    k.cyl(4, 4.4, 2, paint, tur, -4, 13, 6, 14);
    const gun = k.group(tur, 14, 6.5, 0);
    k.rbox(6, 7, 9, paint, gun, 0, 0, 0, 2);
    const brl = k.group(gun, 0, 0, 0);
    k.cyl(1.9, 2.3, 44, paint, brl, 24, 0, 0, 12).rotation.z = PI / 2;
    k.cyl(2.9, 2.9, 5, paint, brl, 45, 0, 0, 12).rotation.z = PI / 2;
    gun.rotation.z = 0.08;
    V.rodH([-14, 44, 6], [-14, 50, 6], 0.5, V.trim);
    let lastVx = 0, recoil = 0;
    V.anims.push((en, t, dt) => {
      tread.offset.x = -V.dist * 0.25;
      if ((en.vx - lastVx) * en.facing < -90) recoil = 1;   // fireCannon kicks the tank back
      lastVx = en.vx; recoil = Math.max(0, recoil - dt * 4);
      brl.position.x = -recoil * 8; tur.rotation.z = Math.sin(t * 0.7 + en.seed) * 0.0;
    });
  };
  B.train = (V) => {
    const k = V.k, D = 34, iron = k.mat('#222427', { metal: 0.6, rough: 0.45 }), brass = k.mat('#c9a04a', { metal: 0.85, rough: 0.25 });
    V.rb(-60, 8, 56, 13, D + 2, iron, 0, 0.8);                                            // footplate
    V.rb(-58, 13, -14, 50, D, V.paint, 0, 1.6);                                           // cab
    V.rb(-61, 50, -11, 54, D + 4, iron, 0, 1.4);                                          // cab roof
    V.win([-50, 47, -50, 32, -22, 32, -22, 47], D / 2 + 0.3);
    const boiler = k.cyl(16, 16, 62, V.paint, k.root, 18, V.Y(28), 0, 28); boiler.rotation.z = PI / 2;
    for (const x of [0, 20, 40]) k.cyl(16.4, 16.4, 1.6, brass, k.root, x, V.Y(28), 0, 28).rotation.z = PI / 2;
    k.cyl(16.6, 16.6, 8, iron, k.root, 50, V.Y(28), 0, 28).rotation.z = PI / 2;          // smokebox
    k.cyl(12, 12, 1.4, iron, k.root, 54.5, V.Y(28), 0, 24).rotation.z = PI / 2;
    k.lathe([[5, 0], [5.4, 10], [7.4, 16], [7.8, 18], [6.6, 18.4], [0, 18.4]], iron, k.root, 34, V.Y(42), 0, 18);    // chimney
    k.lathe([[6, 0], [5.6, 3], [4, 6], [0, 7]], brass, k.root, 10, V.Y(42), 0, 18);       // steam dome
    k.cyl(3.4, 3.4, 4, iron, k.root, 51, V.Y(44), 0, 14).rotation.z = PI / 2;
    k.sphere([1.2, 2.6, 2.6], V.lampF, k.root, 53, V.Y(44), 0);
    V.slab([52, 13, 66, 1.5, 52, 1.5], D - 6, k.mat(k.col('metal'), { metal: 0.6, rough: 0.4 }), 0, 1);   // cowcatcher
    V.both(z => V.rb(24, 9, 36, 19, 5, iron, z * (D / 2 - 1), 1.4));                        // cylinders
    const ww = { rim: 0.86, spokes: 10, tyre: k.mat('#7a7f86', { metal: 0.8, rough: 0.35 }), rimM: V.paintOf(mix(V.body, '#000', 0.15)) };
    V.wheels4([-42, -16], 10, D / 2 - 3.5, 10, 4, ww); V.wheels4([14, 36], 8, D / 2 - 3.5, 8, 4, ww);
    // coupling rods follow the crank pins of the driving wheels
    const rods = [], R = 6;
    V.both(z => { const r = k.rbox(28, 1.6, 1.2, V.steel, k.root, 0, 0, z * (D / 2 + 0.6), 0.5); const p = k.rbox(26, 1.2, 1, V.chrome, k.root, 0, 0, z * (D / 2 + 1.4), 0.4); rods.push([r, p]); });
    V.anims.push(() => {
      const a = -V.dist / 10;
      for (const [r, p] of rods) {
        r.position.x = -29 + Math.cos(a) * R; r.position.y = V.Y(10) + Math.sin(a) * R;
        const cx = -16 + Math.cos(a) * R, cy = V.Y(10) + Math.sin(a) * R, ex = 27, ey = V.Y(14);
        p.position.set((cx + ex) / 2, (cy + ey) / 2, p.position.z); p.rotation.z = Math.atan2(ey - cy, ex - cx);
      }
    });
  };

  // ---------- two wheels and boards ----------
  B.bike = (V) => {
    const k = V.k, fm = V.paint, Y = V.Y;
    V.spoked(-20, 13, 0, 13); V.spoked(20, 13, 0, 13);
    const A = [-20, Y(13)], BB = [0, Y(13)], S = [-6, Y(36)], H = [14, Y(38)], F = [20, Y(13)];
    for (const z of [2.2, -2.2]) { V.rod([A[0], A[1], z], [S[0], S[1], z * 0.4], 0.75, fm); V.rod([A[0], A[1], z], [BB[0], BB[1], z * 0.5], 0.8, fm); V.rod([H[0], H[1], z * 0.5], [F[0], F[1], z], 0.8, V.chrome); }
    V.rod([...BB, 0], [S[0] - 1, S[1] + 2, 0], 1.1, fm); V.rod([...S, 0], [...H, 0], 1.1, fm); V.rod([...BB, 0], [...H, 0], 1.3, fm);
    V.rod([...H, 0], [16, Y(43), 0], 0.9, V.chrome);
    k.cyl(0.8, 0.8, 18, V.trim, k.root, 17, Y(43.5), 0, 8).rotation.x = PI / 2;
    V.both(z => k.cyl(1.1, 1.1, 4, V.trim, k.root, 17, Y(43.5), z * 7.5, 8).rotation.x = PI / 2);
    k.sphere([5.2, 1.4, 2.8], k.mat('#1e1e1e', { rough: 0.6 }), k.root, -7.5, Y(38.2), 0);
    k.cyl(4.2, 4.2, 0.8, V.chrome, k.root, 0, Y(13), 2.6, 18).rotation.x = PI / 2;
    // cranks and pedals turn with the wheels
    const crank = k.group(k.root, 0, Y(13), 0);
    for (const s of [1, -1]) { k.box(1.2, 6, 1, V.chrome, crank, 0, -3 * s, s * 4); k.rbox(3.4, 0.8, 2.6, V.trim, crank, 0, -6 * s, s * 5.6, 0.3); }
    V.anims.push(() => { crank.rotation.z = -(V.dist / 13); });
    V.rider({ hip: [-7, 40], hand: [17, 43.5], pedal: { x: 0, h: 13, r: 6 }, lean: 0.8 });
  };
  B.motorcycle = (V) => {
    const k = V.k, Y = V.Y;
    V.wheel(-22, 11, 0, 11, 6, { rim: 0.66, spokes: 6, rimM: V.trim, hubM: V.chrome }); V.wheel(22, 11, 0, 11, 5, { rim: 0.66, spokes: 6, rimM: V.trim, hubM: V.chrome });
    k.sphere([10, 5, 6.4], V.paint, k.root, 3, Y(31), 0);                                 // tank
    V.slab([-28, 26, -22, 30, -4, 31, -4, 27, -20, 24], 8, V.paint, 0, 2);                  // tail
    k.rbox(18, 3.2, 9, k.mat('#1a1a1a', { rough: 0.65 }), k.root, -12, Y(30.5), 0, 1.4);   // seat
    k.rbox(14, 11, 10, k.mat('#a9b0b7', { metal: 0.8, rough: 0.35 }), k.root, 0, Y(19), 0, 2);   // engine
    for (let i = 0; i < 4; i++) k.box(12, 0.6, 11, V.chrome, k.root, 4, Y(21 + i * 2.2), 0);
    V.rodH([-4, 14, 5], [-30, 12, 6], 1.3, V.chrome); k.cyl(2, 2.2, 10, V.chrome, k.root, -27, Y(13), 6, 12).rotation.z = PI / 2 - 0.08;
    V.rodH([-22, 11, 3.4], [-6, 22, 3.4], 1, V.trim); V.rodH([-22, 11, -3.4], [-6, 22, -3.4], 1, V.trim);
    V.both(z => V.rodH([22, 11, z * 3.2], [15, 37, z * 3.2], 1.1, V.chrome));
    k.extrude([-6, 0, 0, 3, 8, 2, 10, 0], 5, V.paint, k.root, 22, Y(12.5), 0, 0.8);          // front fender
    k.cyl(0.8, 0.8, 18, V.trim, k.root, 16, Y(40), 0, 8).rotation.x = PI / 2;
    k.sphere([2.4, 3, 3], V.chrome, k.root, 18.5, Y(35), 0); k.sphere([1, 2.2, 2.2], V.lampF, k.root, 20.6, Y(35), 0);
    V.both(z => k.box(1.4, 2, 2.4, V.lampR, k.root, -28.5, Y(27), z * 2.2));
    V.rider({ hip: [-12, 32], hand: [16, 40], feet: [[-3, 16]], lean: 1.1, helmet: V.paintOf(V.body === '#222' ? '#c0392b' : V.body) });
  };
  B.scooter = (V) => {
    const k = V.k, Y = V.Y;
    const wm = { rim: 0.6, spokes: 5, tyre: k.mat(k.col('wheel'), { rough: 0.6 }), rimM: V.chrome };
    V.wheel(-16, 6, 0, 6, 3.2, wm); V.wheel(16, 6, 0, 6, 3.2, wm);
    V.rb(-20, 9.5, 12, 12.5, 10, V.paint, 0, 1.2);
    k.rbox(28, 0.5, 8, V.dark, k.root, -4, Y(12.7), 0, 0.2);
    V.rodH([12, 11, 0], [16, 8, 0], 1, V.chrome); V.both(z => V.rodH([16, 6, z * 2], [15, 11, z * 2], 0.7, V.chrome));
    V.rodH([15, 11, 0], [20, 54, 0], 1.1, V.chrome);
    k.cyl(0.8, 0.8, 16, V.chrome, k.root, 20, Y(54), 0, 8).rotation.x = PI / 2;
    V.both(z => k.cyl(1.1, 1.1, 4, V.trim, k.root, 20, Y(54), z * 7, 8).rotation.x = PI / 2);
    k.extrude([-6, 0, -4, 2.5, 4, 2.5, 4, 0], 4, V.paint, k.root, -16, Y(11), 0, 0.5);
    V.rider({ hip: [-4, 34], hand: [20, 54], feet: [[-8, 13], [2, 13]], lean: 0.4 });
  };
  B.skateboard = (V) => {
    const k = V.k, Y = V.Y;
    V.slab([-24, 11.5, -19, 8, 19, 8, 24, 11.5, 23.4, 12.6, 18.6, 9.4, -18.6, 9.4, -23.4, 12.6], 11, V.paintOf(V.body, { metal: 0.1, rough: 0.5 }), 0, 0.5);
    k.rbox(37, 0.3, 10.4, k.mat('#1c1c1c', { rough: 1 }), k.root, 0, Y(9.6), 0, 0.1);
    for (const x of [-12, 12]) { k.rbox(4, 2, 7, V.steel, k.root, x, Y(6.6), 0, 0.6); k.cyl(0.6, 0.6, 12, V.steel, k.root, x, Y(4), 0, 6).rotation.x = PI / 2; }
    const wm = { rim: 0.55, spokes: 5, tyre: k.mat('#f1ead2', { rough: 0.5 }), rimM: V.steel };
    V.wheels4([-12, 12], 4, 5, 4, 3, wm);
    V.rider({ hip: [-2, 30], hand: [6, 24], feet: [[-9, 9.6], [8, 9.6]], lean: 0.3 });
  };

  // ---------- aircraft ----------
  // a long lathe body along +x: profile [[r, x]...] turned about the x axis, centred at height hh
  const along = (V, prof, m, hh, seg) => { const me = V.k.lathe(prof.map(p => [p[0], p[1]]), m, V.k.root, 0, V.Y(hh), 0, seg || 28); me.rotation.z = -PI / 2; return me; };
  // a flat planform (x, z) given thickness, lying in the x-z plane at height hh
  const plan = (V, pts, th, m, hh, x, bev) => { const me = V.k.extrude(pts, th, m, V.k.root, x || 0, V.Y(hh), 0, bev); me.rotation.x = PI / 2; return me; };
  const gear = (V, pos, len, r) => {   // landing gear legs with little wheels, shown only on the ground
    const g = V.k.group(V.k.root, 0, 0, 0);
    for (const [x, z] of pos) { V.rod([x, V.Y(r), z], [x, V.Y(r + len), z], 0.7, V.steel, g); const w = V.k.mesh(tyreGeo(r, 2.4, 0), V.rubber, g, x, V.Y(r), z); V.k.cyl(r * 0.5, r * 0.5, 2.6, V.alloy, w, 0, 0, 0, 10).rotation.x = PI / 2; }
    return g;
  };
  B.plane = (V) => {
    const k = V.k, c2 = V.paintOf(k.col('cloth2'));
    along(V, [[0, -51], [2.5, -50], [6, -36], [9.5, -18], [10, 0], [10, 22], [8.6, 36], [6.2, 46], [5.5, 47]], V.paint, 22);
    const spin = k.lathe([[5.5, 0], [4.6, 2], [2.6, 4], [0, 5]], c2, k.root, 47, V.Y(22), 0, 18); spin.rotation.z = -PI / 2;
    plan(V, [12, 7, 5, 50, -5, 50, -8, 7, -8, -7, -5, -50, 5, -50, 12, -7], 2.4, V.paint, 16, 0, 0.9);
    V.both(z => k.rbox(10, 2.6, 4, c2, k.root, 0, V.Y(16), z * 49, 1));
    plan(V, [-38, 4, -42, 18, -49, 18, -50, 4, -50, -4, -49, -18, -42, -18, -38, -4], 1.4, V.paint, 23, 0, 0.5);
    V.slab([-30, 26, -46, 45, -51, 45, -50, 26], 2, V.paint, 0, 0.8);
    V.slab([-46, 45, -51, 45, -50.6, 39, -44.3, 40], 2.3, c2, 0, 0.8);
    for (let i = 0; i < 7; i++) V.both(z => k.sphere([1.4, 1.8, 0.6], V.glass, k.root, -26 + i * 8, V.Y(24.5), z * 9.6));
    k.sphere([7, 4.2, 6.6], V.glass, k.root, 30, V.Y(28.5), 0);
    V.both(z => k.box(80, 1, 0.5, c2, k.root, -4, V.Y(19.5), z * 9.95));
    const prop = k.group(k.root, 52, V.Y(22), 0);
    for (const s of [1, -1]) { const b = k.rbox(0.8, 13, 2.6, V.trim, prop, 0, s * 7, 0, 0.4); b.rotation.y = s * 0.35; }
    const blur = k.cyl(14, 14, 0.2, k.mat('#cfd6dc', { opacity: 0.18, rough: 0.5 }), k.root, 52.4, V.Y(22), 0, 28); blur.rotation.z = PI / 2;
    const gr = gear(V, [[4, 10], [4, -10], [30, 0]], 8, 3.6);
    V.spin(prop, 'x', (en, t) => en.flying ? t * 47 : V.dist / 4);
    V.anims.push(en => { gr.visible = !en.flying; blur.visible = !!en.flying; });
  };
  B.jet = (V) => {
    const k = V.k, paint = k.mat(V.body, { metal: 0.5, rough: 0.38 }), dk = k.mat(mix(V.body, '#000', 0.35), { metal: 0.5, rough: 0.4 });
    along(V, [[4.6, -52], [5.6, -48], [7, -36], [7.4, -10], [7, 12], [5.6, 30], [3.2, 44], [1, 53], [0, 55]], paint, 18);
    k.lathe([[5.2, 0], [5.6, 4], [4.6, 6], [4.4, 1]], dk, k.root, -52, V.Y(18), 0, 18).rotation.z = PI / 2;
    k.sphere([11, 4.6, 4.2], V.glassL, k.root, 22, V.Y(23.5), 0);
    V.headAt(k.root, 20, V.Y(24.5), 0, 2.6, { helmet: k.mat('#e8e8e0', { rough: 0.4 }) });
    plan(V, [12, 6, -26, 36, -36, 36, -38, 6, -38, -6, -36, -36, -26, -36, 12, -6], 2, paint, 16, 0, 0.8);
    plan(V, [-34, 4, -46, 15, -52, 15, -52, -15, -46, -15, -34, -4], 1.4, paint, 18, 0, 0.5);
    V.slab([-14, 23, -32, 42, -40, 42, -42, 23], 2, paint, 0, 0.8);
    V.both(z => { V.rb(-2, 13, 16, 21, 4.5, dk, z * 7, 1.2); k.rbox(1, 6, 3, V.dark, k.root, 16.2, V.Y(17), z * 7, 0.3); });
    V.both(z => { const ms = k.cyl(1.1, 1.1, 16, k.mat('#f0f0f0', { rough: 0.4 }), k.root, -20, V.Y(13.5), z * 22, 8); ms.rotation.z = PI / 2; k.cone(1.1, 3, V.lampR, k.root, -11, V.Y(13.5), z * 22, 8).rotation.z = -PI / 2; });
    const ab = k.mat('#ffb060', { glow: '#ff7a1a', glowK: 2.4, opacity: 0.85 }), core = k.mat('#ffffff', { glow: '#fff0c0', glowK: 3, opacity: 0.9 });
    const fl = k.group(k.root, -53, V.Y(18), 0); k.cone(4.2, 16, ab, fl, -8, 0, 0, 14).rotation.z = PI / 2;
    const fc = k.cone(2.4, 9, core, fl, -4.5, 0, 0, 10); fc.rotation.z = PI / 2;
    const gr = gear(V, [[8, 5], [8, -5], [-26, 0]], 6, 3);
    V.anims.push((en, t) => { gr.visible = !en.flying; fl.visible = !!en.flying; if (en.flying) fl.scale.x = 0.8 + Math.random() * 0.4; });
  };
  B.helicopter = (V) => {
    const k = V.k;
    k.sphere([24, 14, 12.5], V.paint, k.root, 0, V.Y(28), 0);
    k.sphere([14, 10.5, 11], V.glassL, k.root, 11, V.Y(31), 0);
    V.headAt(k.root, 8, V.Y(31), 4, 3.4, { helmet: k.mat('#e8e8e0', { rough: 0.4 }) });
    k.tube([[-18, V.Y(28), 0], [-34, V.Y(31), 0], [-50, V.Y(35), 0]], 6, 2, V.paint, k.root, 8, 12);
    V.slab([-45, 34, -48, 50, -53, 50, -52, 34], 2, V.paint, 0, 0.8);
    V.slab([-38, 32, -41, 37, -46, 37, -45, 32], 14, V.paint, 0, 0.5);
    V.both(z => { k.cyl(0.9, 0.9, 40, V.trim, k.root, 0, V.Y(8), z * 11, 8).rotation.z = PI / 2; V.rodH([-9, 8, z * 11], [-8, 17, z * 7], 0.7, V.trim); V.rodH([10, 8, z * 11], [9, 17, z * 7], 0.7, V.trim); });
    k.rbox(14, 4, 8, V.paint, k.root, -2, V.Y(42), 0, 2);
    k.cyl(1.2, 1.4, 8, V.steel, k.root, 0, V.Y(46), 0, 10);
    const rot = k.group(k.root, 0, V.Y(50.5), 0), bl = k.mat('#2a2c30', { rough: 0.5, metal: 0.3 });
    k.cyl(2.2, 2.2, 1.6, V.steel, rot, 0, 0, 0, 12);
    for (let i = 0; i < 4; i++) { const b = k.rbox(46, 0.6, 3.4, bl, rot, 0, 0, 0, 0.25); b.position.set(Math.cos(i * PI / 2) * 24, 0, -Math.sin(i * PI / 2) * 24); b.rotation.y = i * PI / 2; }
    const disc = k.cyl(48, 48, 0.2, k.mat('#2a2c30', { opacity: 0.16, rough: 0.6 }), k.root, 0, V.Y(50.5), 0, 36);
    const tr = k.group(k.root, -50, V.Y(45), 3.2);
    for (let i = 0; i < 2; i++) { const b = k.rbox(1.6, 15, 0.6, bl, tr, 0, 0, 0, 0.2); b.rotation.z = i * PI / 2; }
    k.cyl(1, 1, 2, V.steel, tr, 0, 0, -1, 8).rotation.x = PI / 2;
    V.lamp(-50, 33, 1.6, 0.8, V.lampR);
    V.spin(rot, 'y', (en, t) => en.flying ? t * 26 : V.dist / 6);
    V.spin(tr, 'z', (en, t) => en.flying ? t * 40 : V.dist / 3);
    V.anims.push(en => { disc.visible = !!en.flying; });
  };
  B.rocket = (V) => {
    const k = V.k, c2 = V.paintOf(k.col('cloth2')), white = V.paintOf(V.body, { metal: 0.25, rough: 0.35 });
    k.lathe([[0, 12], [10, 12], [10, 72], [9.8, 78], [9, 84]], white, k.root, 0, V.Y(0), 0, 32);
    k.lathe([[9, 84], [7.6, 90], [5.4, 96], [2.8, 101], [0.8, 103.5], [0, 104]], c2, k.root, 0, V.Y(0), 0, 32);
    k.lathe([[10.15, 64], [10.15, 69]], c2, k.root, 0, V.Y(0), 0, 32);
    k.lathe([[5.5, 12], [5.2, 10], [6.5, 6], [8.6, 2.5], [8.2, 2.3], [6, 5.8], [4.5, 10]], k.mat('#3a3d42', { metal: 0.8, rough: 0.35, side: 'double' }), k.root, 0, V.Y(0), 0, 24);
    // four fins
    for (let i = 0; i < 4; i++) { const f = k.extrude([0, 30, 11, 8, 11, 2, 0, 12], 1.6, c2, k.root, 0, 0, 0, 0.5); const g = k.group(k.root, 0, V.Y(0), 0); g.add(f); f.position.set(9.5, 0, 0); g.rotation.y = PI / 4 + i * PI / 2; }
    // portholes on both sides
    V.both(z => { const r = k.mesh(torusGeo(4.6, 0.9), V.chrome, k.root, 0, V.Y(58), z * 9.4); k.sphere([4.2, 4.2, 1.2], V.glass, k.root, 0, V.Y(58), z * 9.2); r.rotation.y = 0; });
    V.both(z => k.box(0.6, 20, 0.4, V.trim, k.root, z * 4, V.Y(30), 9.9));
    // the flame while it flies
    const fl = k.group(k.root, 0, V.Y(3), 0);
    const outer = k.cone(7, 30, k.mat('#ff9a3a', { glow: '#ff6a10', glowK: 2.6, opacity: 0.8 }), fl, 0, -15, 0, 16); outer.rotation.z = PI;
    const inner = k.cone(4, 16, k.mat('#ffffff', { glow: '#fff2c0', glowK: 3.2, opacity: 0.95 }), fl, 0, -8, 0, 12); inner.rotation.z = PI;
    V.anims.push((en, t) => { const on = en.thrust > 0; fl.visible = on; if (on) { const f = 0.8 + Math.random() * 0.45; fl.scale.set(1 + Math.sin(t * 40) * 0.08, f, 1 + Math.sin(t * 40) * 0.08); } });
  };
  B.ufo = (V, o, kind, e) => {
    const k = V.k, hull = k.mat(mix(V.body, '#fff', 0.15), { metal: 0.5, rough: 0.26 }), dk = k.mat(mix(V.body, '#000', 0.4), { metal: 0.5, rough: 0.3 });
    const sp = k.group(k.root, 0, V.Y(0), 0);
    k.lathe([[0, 5], [10, 5.5], [24, 8], [38, 12], [45, 15.5], [46.5, 18], [45, 20], [32, 22.5], [18, 24.5], [0, 25]], hull, sp, 0, 0, 0, 40);
    k.lathe([[0, 4.6], [12, 5.2], [12.5, 7.5]], dk, sp, 0, 0, 0, 24);
    const glowB = k.mat('#9ff8ff', { glow: '#6ff0ff', glowK: 1.4, rough: 0.2 });
    k.cyl(8, 8, 0.6, glowB, sp, 0, 4.5, 0, 24);
    k.lathe([[15, 24], [14.6, 28.5], [12.2, 32.5], [7.4, 35.4], [0, 36.4]], V.glassL, k.root, 0, V.Y(0), 0, 28);
    // the pilot under the dome
    const green = k.mat('#86c95a', { rough: 0.5 });
    const hd = k.group(k.root, 0, V.Y(29), 0);
    k.sphere([6.2, 5.6, 5.8], green, hd); k.cyl(2, 3, 4, green, hd, 0, -5, 0, 10);
    for (const s of [1, -1]) k.eye(1.9, hd, 4.6, 0.8, s * 2.4, { dir: [1, 0.05, s * 0.45], iris: '#111', lid: '#86c95a' });
    // rim lights chase round
    const on = k.mat('#fff3a0', { glow: '#ffe066', glowK: 2.4, rough: 0.2 }), off = k.mat('#7a7f86', { metal: 0.6, rough: 0.3 });
    const lights = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; lights.push(k.sphere([2.2, 1.6, 2.2], off, sp, Math.cos(a) * 45.6, 18, Math.sin(a) * 45.6)); }
    V.anims.push((en, t) => {
      sp.rotation.y = t * 0.9;
      for (let i = 0; i < lights.length; i++) lights[i].material = (Math.floor(t * 3) + i) % 2 ? on : off;
      glowB.emissiveIntensity = 1.4 + (en.beam || 0) * 3;
      k.root.position.y = Math.sin(t * 2 + en.seed) * 1.2;
    });
  };

  // ---------- boats ----------
  B.boat = (V) => {
    const k = V.k, G = V.G;
    const sheer = u => 22 + u * u * 3, keel = u => 2 + (u < 0.18 ? Math.pow(1 - u / 0.18, 2) * 9 : 0) + (u > 0.62 ? Math.pow((u - 0.62) / 0.38, 2) * 21 : 0);
    const beam = u => 15 * (u < 0.65 ? 0.78 + 0.22 * Math.sin(u / 0.65 * PI / 2) : Math.pow(Math.cos((u - 0.65) / 0.35 * PI / 2), 0.75));
    const hm = k.mat(V.body, { rough: 0.5, metal: 0.05, side: 'double' });
    k.mesh(hullGeo('vhull:boat', -40, 46, G, sheer, keel, beam), hm, k.root);
    k.mesh(deckGeo('vdeck:boat', -39.5, 45, G + 20.5, beam), k.mat(mix(k.col('wood'), '#fff', 0.15), { rough: 0.8 }), k.root);
    // a coloured rub rail and portholes
    const c2 = k.mat(k.col('cloth2'), { rough: 0.5 });
    for (const s of [1, -1]) { const p = []; for (let i = 0; i <= 16; i++) { const u = 0.02 + i / 16 * 0.9; p.push([-40 + 86 * u, G + 15.5, s * (hullZ(sheer(u), keel(u), beam(u), 15.5) + 0.3)]); } k.tube(p, 0.8, 0.8, c2, k.root, 24, 6); }
    for (const x of [-14, 6]) { const u = (x + 40) / 86, z = hullZ(sheer(u), keel(u), beam(u), 9) + 0.2; V.both(s => { const r = k.mesh(torusGeo(2.2, 0.55), V.chrome, k.root, x, V.Y(9), s * z); k.sphere([1.9, 1.9, 0.5], V.glass, k.root, x, V.Y(9), s * z); }); }
    // mast, boom, sail and pennant
    const wood = k.mat(k.col('wood'), { rough: 0.6 });
    k.cyl(1.1, 1.3, 50, wood, k.root, 0, V.Y(45), 0, 10);
    V.rodH([0, 26, 0], [28, 26, 0], 0.8, wood);
    const sail = k.mesh(sailGeo(30, 40, 3.2, true), k.mat(k.col('sail'), { rough: 0.85, side: 'double' }), k.root, 1.4, V.Y(26.5), 0);
    const flag = k.mesh(sailGeo(8, 4, 0.8, false), k.mat(k.col('cloth2'), { rough: 0.8, side: 'double' }), k.root, 4.4, V.Y(73), 0);
    V.rodH([0, 68, 0], [30, 26.5, 0], 0.15, V.trim); V.rodH([0, 68, 0], [-38, 23, 0], 0.15, V.trim);
    V.anims.push((en, t) => {
      sail.rotation.y = 0.2 * en.facing + Math.sin(t * 0.9) * 0.05; sail.scale.z = 1 + Math.sin(t * 1.7) * 0.2;
      flag.rotation.y = Math.sin(t * 5) * 0.3; flag.scale.z = 1 + Math.sin(t * 7) * 0.6;
      if (en.grounded && !en.held) k.root.rotation.z = Math.sin(t * 1.3 + en.seed) * 0.02;
    });
  };
  B.ship = (V, o, kind, e) => {
    const k = V.k, G = V.G;
    const sheer = u => 34 + (u < 0.3 ? Math.pow(1 - u / 0.3, 2) * 12 : 0) + (u > 0.7 ? Math.pow((u - 0.7) / 0.3, 2) * 14 : 0);
    const keel = u => 4 + (u < 0.1 ? (1 - u / 0.1) * 14 : 0) + (u > 0.7 ? Math.pow((u - 0.7) / 0.3, 2) * 40 : 0);
    const beam = u => 25 * (u < 0.6 ? 0.78 + 0.22 * Math.sin(u / 0.6 * PI / 2) : Math.pow(Math.cos((u - 0.6) / 0.4 * PI / 2), 0.7));
    const hm = k.mat(V.body, { rough: 0.62, metal: 0.05, side: 'double' }), wood = k.mat(k.col('wood'), { rough: 0.7 }), gold = k.mat('#c9a04a', { metal: 0.8, rough: 0.3 });
    k.mesh(hullGeo('vhull:ship', -64, 68, G, sheer, keel, beam), hm, k.root);
    k.mesh(deckGeo('vdeck:ship', -63, 67, G + 32, beam), wood, k.root);
    for (const [hh, m] of [[30, gold], [40, gold]]) for (const s of [1, -1]) {
      const p = []; for (let i = 0; i <= 18; i++) { const u = 0.03 + i / 18 * 0.88; if (sheer(u) < hh + 1) continue; p.push([-64 + 132 * u, G + hh, s * (hullZ(sheer(u), keel(u), beam(u), hh) + 0.3)]); }
      if (p.length > 2) k.tube(p, 0.7, 0.7, m, k.root, 24, 6);
    }
    // stern castle with lit windows
    V.rb(-63, 32, -38, 50, 40, hm, 0, 2);
    V.rb(-64, 50, -36, 52, 42, wood, 0, 0.8);
    const lit = k.mat('#ffd27a', { glow: '#ffb84a', glowK: 1.2, rough: 0.3 });
    for (let i = 0; i < 3; i++) V.both(z => k.rbox(4, 5, 0.6, lit, k.root, -58 + i * 8, V.Y(42), z * 20.2, 0.3));
    k.sphere([2, 3, 2], lit, k.root, -64, V.Y(56), 0); V.rodH([-64, 52, 0], [-64, 54, 0], 0.4, V.trim);
    // gun ports with cannons
    const iron = k.mat('#25272a', { metal: 0.7, rough: 0.4 });
    for (let i = 0; i < 4; i++) {
      const x = -26 + i * 20, u = (x + 64) / 132, z = hullZ(sheer(u), keel(u), beam(u), 20);
      V.both(s => { k.rbox(5, 5, 1, V.dark, k.root, x, V.Y(20), s * z, 0.4); k.cyl(1.2, 1.5, 6, iron, k.root, x, V.Y(20), s * (z + 2), 10).rotation.x = PI / 2; });
    }
    // masts, yards and billowing square sails braced to the wind
    const sailM = k.mat(k.col('sail'), { rough: 0.9, side: 'double' });
    const rigs = [];
    for (const [mx, top, sails] of [[-30, 98, [[60, 92, 26], [32, 58, 22]]], [20, 88, [[54, 82, 24], [36, 52, 20]]]]) {
      k.cyl(1.5, 2, top - 32, wood, k.root, mx, V.Y((top + 32) / 2), 0, 10);
      k.cyl(4.6, 4, 3, wood, k.root, mx, V.Y(top - 10), 0, 12);
      for (const [h0, h1, wd] of sails) {
        const g = k.group(k.root, mx, V.Y(h1), 0);
        k.cyl(0.8, 0.8, wd + 6, wood, g, 0, 0.5, 0, 6).rotation.z = PI / 2;
        k.mesh(sailGeo(wd, h1 - h0, 4, false), sailM, g, 0, -(h1 - h0) / 2, 1.4);
        rigs.push(g);
      }
      V.both(z => { V.rodH([mx, top - 10, 0], [mx - 8, 33, z * 22], 0.2, V.trim); V.rodH([mx, top - 10, 0], [mx + 8, 33, z * 22], 0.2, V.trim); });
    }
    V.rodH([60, 46, 0], [86, 58, 0], 1.2, wood);
    V.rodH([86, 58, 0], [20, 86, 0], 0.2, V.trim);
    // the jolly roger
    const fg = k.group(k.root, -30, V.Y(102), 0);
    V.rod([0, -6, 0], [0, 2, 0], 0.4, wood, fg);
    const fl = V.decal((x, W, H) => { x.fillStyle = '#151515'; x.fillRect(0, 0, W, H); x.fillStyle = '#f4f4f0'; x.beginPath(); x.arc(W / 2, H * 0.42, H * 0.22, 0, TAU); x.fill(); x.fillRect(W * 0.42, H * 0.5, W * 0.16, H * 0.16); x.fillStyle = '#151515'; x.beginPath(); x.arc(W * 0.43, H * 0.4, H * 0.06, 0, TAU); x.arc(W * 0.57, H * 0.4, H * 0.06, 0, TAU); x.fill(); x.strokeStyle = '#f4f4f0'; x.lineWidth = H * 0.07; x.beginPath(); x.moveTo(W * 0.25, H * 0.65); x.lineTo(W * 0.75, H * 0.9); x.moveTo(W * 0.75, H * 0.65); x.lineTo(W * 0.25, H * 0.9); x.stroke(); }, 96, 64, -7.5, -2, 0, 15, 10, fg, true);
    for (const f of fl) f.material.side = T.DoubleSide;
    let brace = 0.87;
    V.anims.push((en, t, dt) => {
      const want = 0.87 * (en.facing || 1); brace += (want - brace) * Math.min(1, dt * 3);
      for (const g of rigs) { g.rotation.y = brace; g.scale.z = (brace >= 0 ? 1 : -1) * (1 + Math.sin(t * 1.4) * 0.12); }
      fg.rotation.y = Math.sin(t * 3) * 0.25;
      if (en.grounded && !en.held) k.root.rotation.z = Math.sin(t * 0.9 + en.seed) * 0.015;
    });
  };
  B.submarine = (V) => {
    const k = V.k, paint = k.mat(V.body, { metal: 0.35, rough: 0.35 });
    along(V, [[0, -50], [3, -48.5], [8, -40], [12, -28], [14, -12], [14, 20], [12.6, 32], [9, 41], [4, 46.5], [0, 48]], paint, 18, 32);
    V.slab([-13, 28, -10, 44, 9, 44, 12, 28], 10, paint, 0, 2.5);
    V.rodH([4, 44, 0], [4, 57, 0], 0.9, V.steel); V.rodH([4, 56.5, 0], [11, 56.5, 0], 0.9, V.steel); k.sphere([0.4, 0.9, 0.9], V.glass, k.root, 11.4, V.Y(56.5), 0);
    for (const x of [-20, -4, 12]) V.both(z => { k.mesh(torusGeo(3.8, 0.9), V.chrome, k.root, x, V.Y(18), z * 13.7); k.sphere([3.4, 3.4, 0.6], V.glassL, k.root, x, V.Y(18), z * 13.5); });
    V.both(z => k.mesh(torusGeo(3, 0.7), V.chrome, k.root, 0, V.Y(36), z * 5.2));
    V.slab([-38, 18, -46, 31, -50, 31, -48, 18], 2, paint, 0, 0.6); V.slab([-38, 18, -46, 5, -50, 5, -48, 18], 2, paint, 0, 0.6);
    plan(V, [-38, 2, -46, 13, -50, 13, -50, -13, -46, -13, -38, -2], 1.6, paint, 18, 0, 0.5);
    plan(V, [6, 5, 0, 12, -3, 12, -3, -12, 0, -12, 6, -5], 1.2, paint, 39, 0, 0.4);
    const prop = k.group(k.root, -52, V.Y(18), 0), brass = k.mat('#c9a04a', { metal: 0.85, rough: 0.3 });
    k.cone(2, 4, brass, prop, -1.5, 0, 0, 10).rotation.z = PI / 2;
    for (let i = 0; i < 4; i++) { const g = k.group(prop); const b = k.rbox(1, 7.5, 3.2, brass, g, 0, 4, 0, 0.4); b.rotation.y = 0.45; g.rotation.x = i * PI / 2; }
    V.spin(prop, 'x', (en, t) => t * 4 + V.dist / 3);
  };

  // ---------- lighter than air ----------
  B.hotairballoon = (V) => {
    const k = V.k, bal = k.col('balloon'), alt = mix(bal, '#fff8e8', 0.78);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 4; const x = cv.getContext('2d');
    for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? alt : bal; x.fillRect(i * 256 / 12, 0, 256 / 12, 4); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i * 256 / 12, 0, 1.5, 4); }
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding;
    const em = k.mat('#ffffff', { rough: 0.7, env: 1 }); em.map = tex; em.needsUpdate = true;
    k.lathe([[9, 58], [10, 60], [15, 64], [24, 71], [31, 80], [34, 90], [33.4, 100], [29.5, 109], [22, 117], [12, 122.6], [0, 124.5]], em, k.root, 0, V.Y(0), 0, 36);
    k.lathe([[8, 53], [9.2, 58.5]], k.mat(mix(bal, '#000', 0.25), { rough: 0.8, side: 'double' }), k.root, 0, V.Y(0), 0, 18);
    const rope = k.mat('#6b5235', { rough: 0.9 });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) V.rodH([sx * 6.5, 54, sz * 6.5], [sx * 12, 22, sz * 10], 0.3, rope, 4);
    // burner with a flame that roars now and then
    k.rbox(7, 3, 7, V.steel, k.root, 0, V.Y(34), 0, 0.8);
    V.both(z => V.rodH([z * 4, 33, 4], [z * 11, 22, 9], 0.4, V.steel, 4));
    const fl = k.cone(3, 14, k.mat('#ffb050', { glow: '#ff8a20', glowK: 2.6, opacity: 0.85 }), k.root, 0, V.Y(43), 0, 12);
    // the basket and its passenger
    const wicker = k.mat(k.col('wood'), { rough: 0.95 });
    V.rb(-13, 2, 13, 22, 24, wicker, 0, 2);
    V.rb(-14, 20.5, 14, 23.5, 26, k.mat('#5a3a1e', { rough: 0.7 }), 0, 1);
    for (let i = 1; i < 4; i++) V.both(z => k.box(25, 0.5, 0.4, k.mat(mix(k.col('wood'), '#000', 0.3), { rough: 1 }), k.root, 0, V.Y(2 + i * 5), z * 12.1));
    k.sphere([4.2, 5, 5.4], k.mat(k.col('cloth'), { rough: 0.8 }), k.root, 1, V.Y(23.5), 3);
    V.headAt(k.root, 1.5, V.Y(30.5), 3, 4.2);
    V.anims.push((en, t) => { fl.visible = ((t + en.seed) % 3.2) < 0.9; fl.scale.y = 0.85 + Math.random() * 0.3; k.root.rotation.z = Math.sin(t * 0.8 + en.seed) * 0.03; });
  };
  B.blimp = (V) => {
    const k = V.k, env = k.mat(V.body, { metal: 0.35, rough: 0.4 }), c2 = V.paintOf(k.col('cloth2'));
    along(V, [[0, -62], [6, -58], [13, -48], [18, -31], [20, -8], [19.5, 14], [17, 34], [12, 48], [5, 56], [0, 58]], env, 32, 32);
    for (let i = 0; i < 4; i++) {
      const g = k.group(k.root, 0, V.Y(32), 0); g.rotation.x = PI / 4 + i * PI / 2;
      k.extrude([-38, 9, -50, 9, -62, 22, -66, 22, -64, 4], 1.8, i % 2 ? c2 : env, g, 0, 0, 0, 0.6);
    }
    V.rb(-13, 4, 13, 13, 10, k.mat(k.col('metal'), { metal: 0.7, rough: 0.35 }), 0, 3);
    k.rbox(22, 3.4, 10.4, V.glass, k.root, 0, V.Y(9.6), 0, 1);
    V.rodH([-10, 12, 0], [-8, 14.5, 0], 0.4, V.trim); V.rodH([10, 12, 0], [8, 14.5, 0], 0.4, V.trim);
    const props = [];
    V.both(z => {
      V.rodH([-4, 9, z * 4], [-6, 11, z * 11], 0.6, V.steel);
      k.cyl(2, 2.4, 9, V.steel, k.root, -6, V.Y(11), z * 12, 12).rotation.z = PI / 2;
      const p = k.group(k.root, -11, V.Y(11), z * 12);
      for (const s of [1, -1]) k.rbox(0.6, 6, 1.6, V.trim, p, 0, s * 3, 0, 0.2);
      props.push(p);
    });
    V.decal(words('SKY', '#ffffff', { size: 0.9, stroke: 'rgba(0,0,0,0.35)' }), 256, 96, 6, 34, 19.6, 26, 10);
    for (const p of props) V.spin(p, 'x', (en, t) => t * 30);
    V.anims.push((en, t) => { k.root.rotation.z = Math.sin(t * 0.6 + en.seed) * 0.02; });
  };

  SB.M3.kinds.vehicle = function (e, k, tpl) {
    const kind = tpl.sub, G = -tpl.h / 2;
    const V = helpers(e, k, G);
    (B[kind] || B.car)(V, tpl.o || {}, kind, e);
    return (en, t, dt) => {
      const dw = (en.wheel || 0) - V.lastW; V.lastW = en.wheel || 0;
      if (Math.abs(dw) < 40) V.dist += dw * 10 * (en.facing || 1) / (en.scale || 1);
      for (const w of V.wheels) w.g.rotation.z = -V.dist / w.r;
      for (const s of V.spins) s.g.rotation[s.ax] = s.f(en, t);
      for (const f of V.flash) f.m.material = Math.floor(t * f.rate + f.ph) % 2 ? f.off : f.on;
      for (const r of V.riders) r(en, t);
      for (const a of V.anims) a(en, t, dt);
    };
  };
})();
