'use strict';
// m-items.js — 3D models (see js/3d/r3d.js for the model kit)
// Toys and balls, food, plants and trees, weather and sky things, plus the scarab, ghost and snowman.
(function () {
  if (!SB.M3) return;
  const M3 = SB.M3, T = THREE, TAU = Math.PI * 2, geo = M3.geo, N = M3.named, YAW = 0.38;
  const V2 = (x, y) => new T.Vector2(x, y);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rng = s => { let v = (Math.floor(Math.abs(s) * 9973) % 2147483646) + 1; return () => (v = v * 16807 % 2147483647) / 2147483647; };

  // ---------- noise ----------
  const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440670441) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), xf), L(c(0, 1, 0), c(1, 1, 0), xf), yf), L(L(c(0, 0, 1), c(1, 0, 1), xf), L(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
  }
  const fbm = (x, y, z, o) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < (o || 4); i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o || 4)); };

  // ---------- colours ----------
  const rgbOf = hex => { let h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hexOf = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const shade = (hex, f) => { const c = rgbOf(hex); return f >= 1 ? hexOf(...c.map(v => v + (255 - v) * (f - 1))) : hexOf(...c.map(v => v * f)); };   // f<1 darker, f>1 lighter
  const mix = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return hexOf(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`;

  // ---------- textures (cached for every entity; plain Textures so dropping one entity never disposes them) ----------
  const TEX = new Map();
  function canvasTex(key, w, h, paint, o) {
    let t = TEX.get(key); if (t) return t;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new T.Texture(c); if (!(o && o.linear)) t.encoding = T.sRGBEncoding;
    if (o && o.wrap) t.wrapS = t.wrapT = T.RepeatWrapping;
    if (o && o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
    t.anisotropy = 4; t.needsUpdate = true; TEX.set(key, t); return t;
  }
  // a texture for a SphereGeometry, computed per pixel from the direction that pixel faces
  function sphereTex(key, w, h, fn, o) {
    return canvasTex(key, w, h, (x) => {
      const img = x.createImageData(w, h), d = img.data, out = [0, 0, 0, 255];
      for (let j = 0; j < h; j++) {
        const th = j / (h - 1) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
        for (let i = 0; i < w; i++) {
          const ph = (i + 0.5) / w * TAU; out[3] = 255;
          fn(-Math.cos(ph) * st, ct, Math.sin(ph) * st, out, i / w, j / (h - 1));
          const q = (j * w + i) * 4; d[q] = out[0]; d[q + 1] = out[1]; d[q + 2] = out[2]; d[q + 3] = out[3];
        }
      }
      x.putImageData(img, 0, 0);
    }, o);
  }
  // a per-pixel texture over (u, v) in 0..1
  function pixTex(key, w, h, fn, o) {
    return canvasTex(key, w, h, (x) => {
      const img = x.createImageData(w, h), d = img.data, out = [0, 0, 0, 255];
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        out[3] = 255; fn(i / w, 1 - j / (h - 1), out, i, j);
        const q = (j * w + i) * 4; d[q] = out[0]; d[q + 1] = out[1]; d[q + 2] = out[2]; d[q + 3] = out[3];
      }
      x.putImageData(img, 0, 0);
    }, o);
  }
  const put = (out, c, f) => { out[0] = c[0] * f; out[1] = c[1] * f; out[2] = c[2] * f; };
  const lerpC = (out, a, b, t) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; };
  // a material that carries a texture (k.mat would serialise the texture into its cache key)
  function tmat(k, color, o, map, bump, bs) {
    o = Object.assign({ tx: (map ? map.uuid : '') + (bump ? bump.uuid : '') }, o || {});
    const glowMap = o.glowMap; delete o.glowMap;
    const m = k.mat(color, o);
    if (map && m.map !== map) { m.map = map; m.needsUpdate = true; }
    if (bump && m.bumpMap !== bump) { m.bumpMap = bump; m.bumpScale = bs || 0.5; m.needsUpdate = true; }
    if (glowMap && m.emissiveMap !== glowMap) { m.emissiveMap = glowMap; m.needsUpdate = true; }
    return m;
  }
  // glowing additive material for flames, glows and sparks (unlit)
  function addMat(k, color, op, tag) {
    const m = k.mat(color, { basic: true, opacity: op || 0.5, tag: tag || '' });
    m.blending = T.AdditiveBlending; m.depthWrite = false; m.userData.base.opacity = op || 0.5;
    return m;
  }
  const noShadow = o => { o.traverse(c => { if (c.isMesh) { c.castShadow = false; c.userData.noShadow = true; } }); return o; };

  // ---------- geometry helpers ----------
  const sprof = (pts, n) => new T.SplineCurve(pts.map(p => V2(p[0], p[1]))).getPoints(n || 24).map(v => [Math.max(0, v.x), v.y]);
  const latheG = (key, prof, seg) => geo('il:' + key, () => new T.LatheGeometry(prof.map(p => V2(Math.max(0, p[0]), p[1])), seg || 28));
  const lathe = (k, key, prof, m, par, x, y, z, seg) => k.mesh(latheG(key, prof, seg), m, par, x, y, z);
  function shapeOf(pts, closed) {
    const s = new T.Shape(); if (closed) { s.setFromPoints(new T.SplineCurve([...pts, pts[0]].map(p => V2(p[0], p[1]))).getPoints(closed)); return s; }
    s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); return s;
  }
  // average normals across shared corners (ExtrudeGeometry is flat-shaded); edges sharper than `crease` stay hard
  function smoothNormals(g, crease) {
    const P = g.attributes.position, Nn = g.attributes.normal, n = P.count, ct = Math.cos(crease || 0.9), map = new Map();
    const key = i => Math.round(P.getX(i) * 100) + ',' + Math.round(P.getY(i) * 100) + ',' + Math.round(P.getZ(i) * 100);
    for (let i = 0; i < n; i++) { const kk = key(i); let l = map.get(kk); if (!l) map.set(kk, l = []); l.push(i); }
    const out = new Float32Array(n * 3);
    for (const l of map.values()) for (const i of l) {
      let x = 0, y = 0, z = 0; const ax = Nn.getX(i), ay = Nn.getY(i), az = Nn.getZ(i);
      for (const j of l) { const bx = Nn.getX(j), by = Nn.getY(j), bz = Nn.getZ(j); if (ax * bx + ay * by + az * bz >= ct) { x += bx; y += by; z += bz; } }
      const L = Math.hypot(x, y, z) || 1; out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
    }
    g.setAttribute('normal', new T.BufferAttribute(out, 3));
    return g;
  }
  // an outline (array of [x,y]) given thickness and a rounded bevel; o: { holes, smooth (spline pts), uv: [x0,y0,w,h], crease, seg, bs }
  function xgeo(key, pts, depth, bevel, o) {
    o = o || {};
    return geo('ix:' + key, () => {
      const s = shapeOf(pts, o.smooth);
      if (o.holes) for (const hl of o.holes) { const p = new T.Path(); p.absarc(hl[0], hl[1], hl[2], 0, TAU, true); s.holes.push(p); }
      const b = bevel || 0, d = Math.max(0.01, depth - 2 * b);
      const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: o.bs != null ? o.bs : b * 0.9, bevelSegments: o.seg || 3, curveSegments: 10 });
      g.translate(0, 0, -d / 2);
      if (o.uv) { const P = g.attributes.position, U = g.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, (P.getX(i) - o.uv[0]) / o.uv[2], (P.getY(i) - o.uv[1]) / o.uv[3]); }
      if (o.bend) o.bend(g.attributes.position);
      if (o.bend) g.computeVertexNormals();
      return smoothNormals(g, o.crease || 0.75);
    });
  }
  // k.rbox's bevel grows the outline by about r in x and y: measure the shared geometry and fit it to w x h x d
  function rbox(k, w, h, d, m, par, x, y, z, r) {
    const me = k.rbox(w, h, d, m, par, x, y, z, r), g = me.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox; me.scale.set(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y), d / (b.max.z - b.min.z));
    return me;
  }
  const xmesh = (k, key, pts, depth, bevel, m, par, x, y, z, o) => k.mesh(xgeo(key, pts, depth, bevel, o), m, par, x, y, z);
  // a sphere pushed about by noise (snow, rocks, leaf clumps); flat: faceted icosahedron
  function lumpG(key, amp, freq, flat, detail) {
    return geo('ilump:' + key, () => {
      const g = flat ? new T.IcosahedronGeometry(1, detail == null ? 2 : detail) : new T.SphereGeometry(1, 28, 20);
      const P = g.attributes.position, sd = (key.length * 7.13) % 50;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), f = 1 + (fbm(x * freq + sd, y * freq, z * freq, 3) - 0.5) * 2 * amp;
        P.setXYZ(i, x * f, y * f, z * f);
      }
      g.computeVertexNormals(); return g;
    });
  }
  const alignY = (o, nx, ny, nz) => { o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(nx, ny, nz).normalize()); return o; };
  const surf = (R, x, y) => Math.sqrt(Math.max(0, R * R - x * x - y * y));
  // many small copies of one shape in one draw (sesame seeds, sprinkles, spines): list of { p:[x,y,z], n:[nx,ny,nz], s:[sx,sy,sz], c }
  function inst(k, g, mat, list, par) {
    const im = new T.InstancedMesh(g, mat, list.length), mx = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), nv = new T.Vector3(), sv = new T.Vector3(), pv = new T.Vector3(), col = new T.Color();
    list.forEach((it, i) => {
      q.setFromUnitVectors(up, nv.set(...(it.n || [0, 1, 0])).normalize());
      if (it.spin) q.multiply(new T.Quaternion().setFromAxisAngle(up, it.spin));
      mx.compose(pv.set(...it.p), q, sv.set(...(it.s || [1, 1, 1]))); im.setMatrixAt(i, mx);
      if (it.c) im.setColorAt(i, col.set(it.c));
    });
    im.castShadow = false; im.receiveShadow = true; (par || k.root).add(im); return im;
  }
  // keep a front-facing thing (a face, a label) turned toward the camera whichever way it faces; tilt = a little toward its facing
  const facer = (g, tilt) => (e) => { const m = e._m3; g.rotation.y = -(m ? m.yaw : -YAW) + (tilt || 0) * (e.facing || 1); };
  // a mouth that follows the mood (smile, frown, open O, sleepy dot)
  function mouth(k, par, x, y, z, w, col) {
    const m = k.mat(col || '#3a1712', { rough: 0.55 });
    const arc = k.mesh(geo('imouth', () => new T.TorusGeometry(1, 0.15, 6, 18, Math.PI * 0.62)), m, par, x, y, z);
    const o = k.sphere([w * 0.2, w * 0.28, w * 0.12], m, par, x, y, z);
    let last = '';
    return (e) => {
      const md = e.mood === 'approach' ? 'happy' : (e.mood || 'normal'); if (md === last) return; last = md;
      o.visible = md === 'scared' || md === 'sleep' || md === 'open'; arc.visible = !o.visible;
      o.scale.set(w * (md === 'sleep' ? 0.1 : 0.2), w * (md === 'sleep' ? 0.1 : 0.3), w * 0.12);
      const s = w * (md === 'happy' ? 0.62 : 0.48); arc.scale.set(s, s * (md === 'happy' ? 1 : 0.8), s);
      if (md === 'angry' || md === 'dizzy') { arc.rotation.z = Math.PI / 2 - Math.PI * 0.31; arc.position.y = y - s * 0.85; }
      else { arc.rotation.z = -Math.PI / 2 - Math.PI * 0.31; arc.position.y = y + s * 0.8; }
    };
  }
  const melt = e => clamp((e.meltT || 0) / 3, 0, 1);

  // ======================================================================
  // ---------- balls ----------
  // ======================================================================
  function ballMesh(k, r, mat) { return k.sphere(r, mat, k.root); }
  N['ball'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = sphereTex('ball:' + c, 256, 128, (x, y, z, o) => {
      const seam = Math.min(Math.abs(y - 0.36 + 0.12 * x * x), Math.abs(y + 0.36 - 0.12 * x * x));
      const n = 0.93 + noise3(x * 40, y * 40, z * 40) * 0.07;
      put(o, c, seam < 0.025 ? 0.45 : seam < 0.05 ? 0.85 * n : n);
    });
    const bump = sphereTex('ballb', 256, 128, (x, y, z, o) => { const v = 120 + noise3(x * 60, y * 60, z * 60) * 60; o[0] = o[1] = o[2] = v; }, { linear: true });
    ballMesh(k, 14, tmat(k, '#fff', { rough: 0.38 }, tx, bump, 0.15));
    return null;
  };
  // a truncated icosahedron: 12 black pentagons, 20 white hexagons, dark stitched seams
  const PHI = (1 + Math.sqrt(5)) / 2;
  const ICO = [], DOD = [];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) { ICO.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]); }
  for (const a of [-1, 1]) for (const b of [-1, 1]) { for (const c of [-1, 1]) DOD.push([a, b, c]); DOD.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]); }
  const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const FACES = [...ICO.map(v => ({ n: nrm(v), d: 2.3274, pent: true })), ...DOD.map(v => ({ n: nrm(v), d: 2.2672, pent: false }))];
  N['soccer ball'] = (e, k) => {
    const wc = rgbOf((k.def.seq && k.def.seq[0]) || k.col('body')), bc = [24, 24, 28];
    const tx = sphereTex('soccer:' + wc, 512, 256, (x, y, z, o) => {
      let b1 = -9, b2 = -9, f1 = null;
      for (const f of FACES) { const s = (x * f.n[0] + y * f.n[1] + z * f.n[2]) / f.d; if (s > b1) { b2 = b1; b1 = s; f1 = f; } else if (s > b2) b2 = s; }
      const edge = (b1 - b2) * 60, base = f1.pent ? bc : wc;
      put(o, base, edge < 0.35 ? 0.35 : edge < 0.9 ? 0.75 + 0.25 * (edge - 0.35) / 0.55 : 1);
    });
    const sb = sphereTex('soccerb', 512, 256, (x, y, z, o) => { let b1 = -9, b2 = -9; for (const f of FACES) { const s = (x * f.n[0] + y * f.n[1] + z * f.n[2]) / f.d; if (s > b1) { b2 = b1; b1 = s; } else if (s > b2) b2 = s; } o[0] = o[1] = o[2] = clamp((b1 - b2) * 60 * 200, 0, 220); }, { linear: true });
    ballMesh(k, 14, tmat(k, '#fff', { rough: 0.35 }, tx, sb, 0.5));
    return null;
  };
  N['basketball'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = sphereTex('bball:' + c, 512, 256, (x, y, z, o) => {
      const s1 = Math.abs(y), s2 = Math.abs(x), s3 = Math.abs(Math.abs(x) - (0.5 + 0.34 * (1 - y * y)));
      const seam = Math.min(s1, s2 * 1.2, s3);
      const peb = noise3(x * 90, y * 90, z * 90);
      put(o, c, seam < 0.022 ? 0.12 : (0.82 + peb * 0.18));
    });
    ballMesh(k, 14, tmat(k, '#fff', { rough: 0.62 }, tx, tx, 0.35));
    return null;
  };
  N['tennis ball'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = sphereTex('tennis:' + c, 256, 128, (x, y, z, o) => {
      const f = Math.abs(y - 0.78 * (x * x - z * z));
      const fz = fbm(x * 30, y * 30, z * 30, 3);
      if (f < 0.045) { o[0] = o[1] = o[2] = 236 + fz * 14; } else put(o, c, 0.78 + fz * 0.3);
    });
    const fuzz = sphereTex('tennisb', 256, 128, (x, y, z, o) => { o[0] = o[1] = o[2] = 90 + noise3(x * 120, y * 120, z * 120) * 160; }, { linear: true });
    ballMesh(k, 8, tmat(k, '#fff', { rough: 1 }, tx, fuzz, 0.6));
    return null;
  };
  N['bowling ball'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = sphereTex('bowl:' + c, 256, 128, (x, y, z, o) => {
      const sw = Math.sin((x * 3 + fbm(x * 2, y * 2, z * 2, 4) * 6) * 2.2) * 0.5 + 0.5;
      put(o, [c[0] + 26, c[1] + 18, c[2] + 30], 0.7 + sw * 0.35);
    });
    ballMesh(k, 14, tmat(k, '#fff', { rough: 0.12, metal: 0.1 }, tx));
    const hole = k.mat('#050505', { rough: 1 });
    for (const [hx, hy] of [[-4, 4], [3, 5], [0, -1]]) {
      const z = surf(14, hx, hy), n = [hx / 14, hy / 14, z / 14];
      const h = k.cyl(2, 2, 4, hole, k.root, hx - n[0] * 1.9, hy - n[1] * 1.9, z - n[2] * 1.9, 14); alignY(h, ...n);
    }
    return null;
  };
  N['beach ball'] = (e, k) => {
    const cols = [k.col('body'), '#ffffff', '#3d7ee8', '#f6d13b', '#ffffff', '#3fae49'].map(rgbOf);
    const tx = sphereTex('beach:' + cols[0], 256, 128, (x, y, z, o, u) => {
      if (Math.abs(y) > 0.955) { put(o, Math.abs(y) > 0.975 ? [240, 240, 240] : [200, 200, 200], 1); return; }
      const g = Math.floor(u * 6) % 6, edge = Math.abs((u * 6) % 1 - 0.5);
      put(o, cols[g], edge > 0.485 ? 0.82 : 1);
    });
    ballMesh(k, 20, tmat(k, '#fff', { rough: 0.25 }, tx));
    return null;
  };
  N['football'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const prof = []; for (let i = 0; i <= 28; i++) { const y = -16 + i / 28 * 32; prof.push([10 * Math.pow(Math.max(0, 1 - (y / 16) * (y / 16)), 0.75), y]); }
    const tx = pixTex('foot:' + c, 64, 256, (u, v, o, i, j) => {
      const stripe = (v > 0.18 && v < 0.23) || (v > 0.77 && v < 0.82);
      const peb = noise3(i * 0.9, j * 0.5, 3);
      if (stripe) { o[0] = o[1] = o[2] = 235; } else put(o, c, 0.75 + peb * 0.3);
      if (Math.abs(u - 0.5) < 0.01 || Math.abs(u) < 0.01 || Math.abs(u - 1) < 0.01 || Math.abs(u - 0.25) < 0.008 || Math.abs(u - 0.75) < 0.008) put(o, c, 0.45);
    });
    const ball = lathe(k, 'football', prof, tmat(k, '#fff', { rough: 0.7 }, tx, tx, 0.3), k.root, 0, 0, 0, 32);
    ball.rotation.z = Math.PI / 2;
    const lace = k.group(k.root); lace.rotation.x = -0.6;
    const wm = k.mat('#f4f1ea', { rough: 0.7 });
    rbox(k, 12, 1.1, 1.2, wm, lace, 0, 0, 10.1, 0.5);
    for (let i = -2; i <= 2; i++) rbox(k, 1, 1, 3.6, wm, lace, i * 2.6, 0.2, 10.2, 0.45).rotation.x = Math.PI / 2;
    return null;
  };

  // ---------- toys ----------
  N['balloon'] = (e, k) => {
    const col = (k.def.seq && k.def.seq[0]) || k.col('body');
    const prof = []; for (let i = 0; i <= 26; i++) { const th = i / 26 * Math.PI; prof.push([13 * Math.sin(th) * (0.72 + 0.28 * (1 - Math.cos(th)) / 2), 8 - 16 * Math.cos(th)]); }
    const m = k.mat(col, { rough: 0.16, metal: 0.05 });
    lathe(k, 'balloon', prof, m, k.root, 0, 0, 0, 32);
    lathe(k, 'bknot', [[0, -11.5], [2.4, -11.4], [1.6, -10], [0.9, -8.4], [0, -8]], k.mat(shade(col, 0.8), { rough: 0.3 }), k.root, 0, 0, 0, 14);
    const sp = [[0, -11], [3, -16], [0, -21], [-2, -27]];
    const str = k.tube(sp, 0.32, 0.32, k.mat('#e8e8e8', { rough: 0.8 }), k.root, 10, 5);
    let tick = 0;
    return (en, t) => {
      if ((tick++ % 3) !== 0) return;
      const s = Math.sin(t * 3 + en.seed) * 3;
      sp[1][0] = 2 + s * 0.6; sp[2][0] = s * 0.6 - 1; sp[3][0] = -2 - s * 0.3; sp[2][2] = s * 0.4;
      str.geometry.setPath(sp);
    };
  };
  N['teddy'] = (e, k) => {
    const g = k.group(k.root), fc = k.col('body'), fur = rgbOf(fc);
    const ft = pixTex('fur:' + fc, 128, 128, (u, v, o, i, j) => { const n = noise3(i * 0.7, j * 0.18, 1) * 0.6 + noise3(i * 0.2, j * 0.2, 5) * 0.4; put(o, fur, 0.78 + n * 0.32); }, { wrap: true });
    const m = tmat(k, '#fff', { rough: 1 }, ft, ft, 0.8), light = k.mat(mix(fc, '#f5e6cc', 0.55), { rough: 1 }), dark = k.mat('#1c120c', { rough: 0.3 });
    k.sphere([13.5, 15, 11], m, g, 0, -7, 0);                           // body
    k.sphere([8.5, 9.5, 2.5], light, g, 0, -8, 9);                      // tummy patch
    k.sphere([12, 11.4, 10.5], m, g, 0, 12, 0);                         // head
    for (const s of [-1, 1]) {
      k.sphere([5, 5, 3.4], m, g, s * 11, 21, -1); k.sphere([3, 3, 1.4], light, g, s * 11, 21, 1.6);   // ears
      const a = k.limb(12, 4.6, 4, m, g, s * 11, -1, 1); a.rotation.z = s * 0.75; a.rotation.x = -0.25;   // arms
      const l = k.limb(7, 5.2, 5, m, g, s * 6, -16, 2); l.rotation.x = -1.35;   // legs sticking forward (sitting)
      k.sphere([3.6, 3.8, 1.2], light, l, 0, -7.4, 0).rotation.x = Math.PI / 2;
    }
    k.sphere([5.2, 3.8, 4], light, g, 0, 7.5, 8.5);                     // muzzle
    k.sphere([2, 1.4, 1.4], dark, g, 0, 9.2, 12.2);                     // nose
    for (const s of [-1, 1]) k.eye(1.7, g, s * 4.6, 13.5, 9.4, { dir: [s * 0.2, 0.1, 1], white: '#160e0a', iris: '#000', lid: false });
    k.box(0.4, 2, 0.4, dark, g, 0, 5.8, 12);
    return facer(g, 0.3);
  };
  N['dice'] = (e, k) => {
    const g = k.group(k.root), die = k.group(g), pip = k.mat('#161616', { rough: 0.4 });
    rbox(k, 26, 26, 26, k.mat(k.col('body'), { rough: 0.22 }), die, 0, 0, 0, 4);
    const lay = { 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]], 5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]] };
    // +z 1, -z 6, +y 2, -y 5, +x 3, -x 4 (opposites add to 7)
    const facesDef = [[1, [0, 0, 1], [1, 0, 0]], [6, [0, 0, -1], [-1, 0, 0]], [2, [0, 1, 0], [1, 0, 0]], [5, [0, -1, 0], [1, 0, 0]], [3, [1, 0, 0], [0, 0, -1]], [4, [-1, 0, 0], [0, 0, 1]]];
    for (const [v, n, a] of facesDef) {
      const b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
      for (const [pu, pv] of lay[v]) {
        const p = k.sphere(2.4, pip, die, n[0] * 12.4 + (a[0] * pu + b[0] * pv) * 7, n[1] * 12.4 + (a[1] * pu + b[1] * pv) * 7, n[2] * 12.4 + (a[2] * pu + b[2] * pv) * 7);
        p.scale.set(2.4, 2.4, 2.4); alignY(p, ...n); p.scale.y = 0.9;
      }
    }
    const rot = { 1: [0, 0], 6: [0, Math.PI], 2: [Math.PI / 2, 0], 5: [-Math.PI / 2, 0], 3: [0, -Math.PI / 2], 4: [0, Math.PI / 2] };
    const look = facer(g, 0.45);
    return (en) => { look(en); const r = rot[en.face || 1] || rot[1]; die.rotation.x += (r[0] - die.rotation.x) * 0.3; die.rotation.y += (r[1] - die.rotation.y) * 0.3; };
  };
  N['kite'] = (e, k) => {
    const g = k.group(k.root), c1 = k.col('body'), c2 = '#f6d13b';
    const sail = k.group(g, 0, 0, 0);
    const T0 = [0, 34], L = [-16, 14], B = [0, -4], R = [16, 14], C = [0, 14];
    const tri = (key, a, b, col) => xmesh(k, 'kite' + key, [a, b, C], 0.6, 0, k.mat(col, { rough: 0.55, side: 'double' }), sail);
    tri('a', T0, L, c1); tri('b', L, B, c2); tri('c', B, R, c1); tri('d', R, T0, c2);
    const wood = k.mat('#8b6a45', { rough: 0.8 });
    k.cyl(0.6, 0.6, 38, wood, sail, 0, 15, 0.7, 6);
    k.cyl(0.6, 0.6, 32, wood, sail, 0, 14, 0.7, 6).rotation.z = Math.PI / 2;
    const sp = [[0, -4], [4, -14], [-2, -24], [2, -34]];
    const tail = k.tube(sp, 0.35, 0.3, k.mat('#efefef', { rough: 0.8 }), g, 12, 5);
    const bowM = k.mat('#3d7ee8', { rough: 0.6 }), bows = [];
    for (let i = 0; i < 3; i++) { const b = k.group(g); k.cone(2.2, 3.4, bowM, b, -1.7, 0, 0, 6).rotation.z = -Math.PI / 2; k.cone(2.2, 3.4, bowM, b, 1.7, 0, 0, 6).rotation.z = Math.PI / 2; bows.push(b); }
    const look = facer(g, 0.25); let tick = 0;
    return (en, t) => {
      look(en);
      const s = Math.sin(t * 4 + en.seed) * 3;
      sail.rotation.z = Math.sin(t * 1.7 + en.seed) * 0.12; sail.rotation.x = Math.sin(t * 2.3) * 0.12;
      if ((tick++ % 2) === 0) { sp[1][0] = 4 + s; sp[2][0] = -2 + s * 1.4; sp[3][0] = 2 + s * 0.6 - 4; tail.geometry.setPath(sp); }
      for (let i = 0; i < 3; i++) { const y = -10 - i * 9, u = i / 3; bows[i].position.set(s * (0.3 + u) + Math.sin(u * 3) * 2, y, 0); bows[i].rotation.z = s * 0.1; }
    };
  };
  N['bubble'] = (e, k) => {
    const tx = sphereTex('bubble', 128, 64, (x, y, z, o) => {
      const h = (fbm(x * 2 + 3, y * 2, z * 2, 3) * 2.2 + y * 0.6) % 1, a = h * TAU;
      o[0] = 180 + 75 * Math.sin(a); o[1] = 180 + 75 * Math.sin(a + 2.1); o[2] = 195 + 60 * Math.sin(a + 4.2);
    });
    const m = tmat(k, '#ffffff', { rough: 0.04, metal: 0.3, opacity: 0.34, glow: '#b8d8ff', glowK: 0.22 }, tx);
    const b = k.sphere(11, m, k.root); b.castShadow = false;
    const hl = k.sphere([2.6, 1.6, 0.6], k.mat('#ffffff', { basic: true, opacity: 0.9 }), k.root, -4.5, 5, 9.4); hl.rotation.z = 0.7;
    k.sphere([1, 0.7, 0.3], k.mat('#ffffff', { basic: true, opacity: 0.7 }), k.root, 5.5, -5, 8.8);
    return (en, t) => { const w = Math.sin(t * 5 + en.seed) * 0.04; b.scale.set(11 * (1 + w), 11 * (1 - w), 11 * (1 + w * 0.5)); };
  };
  N['yo-yo'] = (e, k) => {
    const g = k.group(k.root), yo = k.group(g), spin = k.group(yo);
    const disc = k.mat(k.col('candy'), { rough: 0.25 }), hub = k.mat(k.col('body'), { rough: 0.35 });
    for (const s of [-1, 1]) {
      const d = lathe(k, 'yoyo', sprof([[0, 0], [5, 0.1], [7.6, 0.8], [8, 2.2], [7, 3.4], [0, 3.4]], 16), disc, spin, 0, 0, s * 0.7, 28);
      d.rotation.x = s * Math.PI / 2;
      k.cyl(3, 3, 0.4, hub, spin, 0, 0, s * 4.1, 18).rotation.x = Math.PI / 2;
    }
    k.cyl(1.1, 1.1, 1.6, k.mat('#ddd', { rough: 0.5 }), spin, 0, 0, 0, 10).rotation.x = Math.PI / 2;
    const string = k.cyl(0.3, 0.3, 1, k.mat('#f2f2f2', { rough: 0.9 }), g, 0, 0, 0, 5);
    k.mesh(geo('iyoring', () => new T.TorusGeometry(1.8, 0.35, 6, 14)), k.mat('#f2f2f2', { rough: 0.9 }), g, 0, 21.5, 0);
    return (en, t) => {
      const y = -(8 + Math.sin(t * 5) * 8);
      yo.position.y = y; spin.rotation.z -= 0.35 * Math.cos(t * 5);
      const top = 20, len = top - y - 8; string.scale.y = Math.max(0.5, len); string.position.y = y + 8 + len / 2;
    };
  };

  // ======================================================================
  // ---------- fruit and veg ----------
  // ======================================================================
  const stemM = k => k.mat('#6b4a2b', { rough: 0.85 });
  const leafShape = (L, W) => { const p = []; for (let i = 0; i <= 10; i++) { const u = i / 10; p.push([u * L, Math.sin(u * Math.PI) * W * (1 - u * 0.25)]); } for (let i = 9; i > 0; i--) { const u = i / 10; p.push([u * L, -Math.sin(u * Math.PI) * W * (1 - u * 0.25)]); } return p; };
  const veinTex = (key, col) => { const c = rgbOf(col); return pixTex('vein:' + key + c, 128, 64, (u, v, o) => {
    const mid = Math.abs(v - 0.5), side = Math.abs(((u * 7 + mid * 3) % 1) - 0.5);
    const vein = mid < 0.025 ? 0.35 : (side < 0.04 && mid < 0.42 ? 0.6 : 0);
    put(o, c, (0.92 + noise3(u * 40, v * 40, 2) * 0.12) * (1 + vein * 0.35));
  }); };
  // a gently cupped leaf lying along +x from its stalk
  const leafG = (key, L, W) => xgeo('leaf' + key, leafShape(L, W), 0.6, 0.2, { uv: [0, -W, L, W * 2], bend: P => { for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, P.getZ(i) - y * y * 0.12 + Math.sin(x / L * Math.PI) * 0.6); } } });

  N['apple'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = pixTex('apple:' + c, 128, 128, (u, v, o, i, j) => {
      const streak = noise3(i * 0.3, j * 0.04, 1) * 0.6 + noise3(i * 0.08, j * 0.05, 3) * 0.4, dots = noise3(i * 1.3, j * 1.3, 7) > 0.93;
      const top = clamp((v - 0.75) * 3, 0, 1);
      const st = Math.max(0, streak - 0.45);
      put(o, [c[0] + (250 - c[0]) * st * 0.35, c[1] + (200 - c[1]) * st * 0.4, c[2] + (90 - c[2]) * st * 0.3], (0.95 + streak * 0.08) * (1 - top * 0.22));
      if (dots) lerpC(o, [o[0], o[1], o[2]], [240, 210, 150], 0.45);
    });
    const prof = sprof([[0, -9.2], [3.5, -10.2], [7, -9], [10, -5.5], [11.2, -0.8], [10.8, 4], [8.6, 7.6], [5, 9.4], [2.2, 8.6], [0.4, 6.8], [0, 6.5]], 30);
    lathe(k, 'apple', prof, tmat(k, '#fff', { rough: 0.32 }, tx), k.root, 0, -3, 0, 32);
    const st = k.tube([[0, 3.5, 0], [0.4, 7, 0], [1.8, 10.5, 0]], 0.75, 0.55, stemM(k), k.root, 6, 6);
    const lf = k.mesh(leafG('apple', 9, 3.2), tmat(k, '#fff', { rough: 0.5, side: 'double' }, veinTex('a', '#4f9a3a')), k.root, 1.4, 8.6, 0);
    lf.rotation.set(0.4, -0.5, 0.35);
    return null;
  };
  N['banana'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = pixTex('banana:' + c, 32, 128, (u, v, o, i, j) => {
      const end = Math.min(v, 1 - v), green = clamp(1 - end * 9, 0, 1), sp = noise3(i * 1.4, j * 1.1, 3) > 0.9 ? 0.75 : 1;
      lerpC(o, c, [160, 180, 70], green * 0.5); o[0] *= sp; o[1] *= sp; o[2] *= sp;
      if (end < 0.035) put(o, [70, 50, 30], 1);
    });
    const path = []; for (let i = 0; i <= 8; i++) { const u = i / 8, x = -15 + u * 30; path.push([x, 7 - Math.pow(x / 15, 2) * 8.5, 0]); }
    const m = tmat(k, '#fff', { rough: 0.5 }, tx);
    const g = new M3.Tube(22, 6, u => 0.7 + 4.4 * Math.pow(Math.sin(Math.PI * u), 0.55), 0, true); g.setPath(path); k.own.push(g);
    k.mesh(g, m, k.root).rotation.x = 0.3;
    k.cyl(0.9, 1.3, 3.6, k.mat('#6b5a2a', { rough: 0.8 }), k.root, 16, 0.6, 0, 8).rotation.z = -0.9;
    return null;
  };
  N['orange'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = sphereTex('orange:' + c, 256, 128, (x, y, z, o) => { const d = noise3(x * 70, y * 70, z * 70); put(o, c, 0.86 + d * 0.16); });
    const s = k.sphere([11, 10.4, 11], tmat(k, '#fff', { rough: 0.48 }, tx, tx, 0.5), k.root);
    k.cyl(0.8, 1.1, 1.2, k.mat('#5a6b2a', { rough: 0.8 }), k.root, 0, 10.4, 0, 8);
    k.sphere([1.8, 0.5, 1.8], k.mat('#6b7a2a', { rough: 0.8 }), k.root, 0, 10.2, 0);
    const lf = k.mesh(leafG('orange', 7, 2.6), tmat(k, '#fff', { rough: 0.4, side: 'double' }, veinTex('o', '#3f8a35')), k.root, 0.5, 10.6, 0);
    lf.rotation.set(0.2, -0.6, 0.3);
    return null;
  };
  N['strawberry'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = pixTex('straw:' + c, 128, 128, (u, v, o, i, j) => {
      const cu = (u * 14 + (Math.floor(v * 12) % 2) * 0.5) % 1, cv = (v * 12) % 1, d = Math.hypot(cu - 0.5, (cv - 0.5) * 1.3);
      const top = clamp((v - 0.8) * 5, 0, 1);
      put(o, c, 0.9 + noise3(i * 0.3, j * 0.3, 2) * 0.12 - top * 0.15);
      if (d < 0.12 && v < 0.9) { o[0] = 242; o[1] = 214; o[2] = 120; } else if (d < 0.2 && v < 0.9) put(o, c, 0.62);
    });
    const prof = sprof([[0, -12], [2.5, -10.5], [5.6, -6], [8.4, -0.5], [9.2, 3.5], [7.6, 6], [4, 7], [0, 7]], 26);
    lathe(k, 'straw', prof, tmat(k, '#fff', { rough: 0.3 }, tx, tx, 0.6), k.root, 0, 0, 0, 30);
    const lm = k.mat('#3f8f3a', { rough: 0.6, side: 'double' });
    for (let i = 0; i < 7; i++) { const p = k.group(k.root, 0, 6.6, 0); p.rotation.y = i / 7 * TAU; const l = k.mesh(leafG('sepal', 6.5, 1.6), lm, p, 0.5, 0, 0); l.rotation.z = -0.35; }
    k.cyl(0.5, 0.7, 4, k.mat('#4f8a3a', { rough: 0.7 }), k.root, 0.3, 8.6, 0, 6).rotation.z = -0.2;
    return null;
  };
  N['watermelon'] = (e, k) => {
    const g = k.group(k.root, 0, 0, 0), R = 17, top = 6;
    const half = (r) => { const p = []; for (let i = 0; i <= 24; i++) { const a = Math.PI + i / 24 * Math.PI; p.push([Math.cos(a) * r, top + Math.sin(a) * r * 0.98]); } return p; };
    xmesh(k, 'wm-rind', half(R), 8, 1, k.mat(k.col('body'), { rough: 0.4 }), g);
    xmesh(k, 'wm-white', half(R - 1.6), 8.6, 0.6, k.mat('#eef3d0', { rough: 0.6 }), g, 0, 0.3);
    const ft = pixTex('wmflesh', 64, 64, (u, v, o, i, j) => { const n = noise3(i * 0.6, j * 0.6, 4); o[0] = 226 + n * 22; o[1] = 52 + n * 35; o[2] = 62 + n * 20; }, { wrap: true });
    xmesh(k, 'wm-flesh', half(R - 2.8), 9.2, 0.7, tmat(k, '#fff', { rough: 0.35 }, ft), g, 0, 0.5);
    const seed = k.mat('#1e140f', { rough: 0.25 });
    for (const [sx, sy] of [[-7, 0], [-2, -3], [3, -2], [8, 0.5], [-4, -7], [2, -8], [0, 2], [-11, 2.5], [11, 3]]) {
      for (const sz of [4.7, -4.7]) { const s = k.sphere([0.9, 1.5, 0.4], seed, g, sx, sy, sz); s.rotation.z = -sx * 0.06; }
    }
    return null;
  };
  N['tomato'] = (e, k) => {
    const col = k.col('body');
    const gg = geo('itomato', () => { const g = new T.SphereGeometry(1, 32, 20), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), f = 1 + 0.045 * Math.cos(a * 5) * (1 - y * y); P.setXYZ(i, x * f, y * (y > 0 ? 0.82 : 0.9) - (y > 0.85 ? (y - 0.85) * 1.2 : 0), z * f); } g.computeVertexNormals(); return g; });
    const m = k.mesh(gg, k.mat(col, { rough: 0.2 }), k.root, 0, 0, 0); m.scale.set(10.8, 10.8, 10.8);
    const lm = k.mat('#3f7f32', { rough: 0.6, side: 'double' });
    for (let i = 0; i < 6; i++) { const p = k.group(k.root, 0, 8.6, 0); p.rotation.y = i / 6 * TAU + 0.3; const l = k.mesh(leafG('tsepal', 5, 1.1), lm, p, 0.3, 0, 0); l.rotation.z = -0.25; }
    k.cyl(0.6, 0.8, 3, k.mat('#4f7f32', { rough: 0.7 }), k.root, 0, 10, 0, 6);
    return null;
  };
  N['carrot'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = pixTex('carrot:' + c, 32, 128, (u, v, o, i, j) => { const ring = Math.pow(Math.abs(Math.sin(v * 70 + noise3(i * 0.2, j * 0.1, 1) * 3)), 18); put(o, c, 0.9 + noise3(i * 0.4, j * 0.1, 3) * 0.12 - ring * 0.22); });
    const prof = sprof([[0, -19], [1.2, -16], [3.2, -6], [4.8, 3], [5.4, 6.6], [4.4, 8.2], [0, 8.6]], 24);
    lathe(k, 'carrot', prof, tmat(k, '#fff', { rough: 0.55 }, tx, tx, 0.5), k.root, 0, 0, 0, 22);
    const gm = k.mat('#4f9a3a', { rough: 0.6, side: 'double' });
    const fern = []; for (let i = 0; i <= 12; i++) { const u = i / 12; fern.push([u * 10, (i % 2 ? 1.6 : 0.5) * Math.sin(u * Math.PI)]); } for (let i = 11; i > 0; i--) { const u = i / 12; fern.push([u * 10, -(i % 2 ? 1.6 : 0.5) * Math.sin(u * Math.PI)]); }
    const fg = xgeo('carrotfern', fern, 0.4, 0, {});
    [[-0.5, 0.35, 0], [0.1, -0.1, 2], [0.6, -0.4, 4], [-0.2, 0.15, 1.2], [0.2, -0.2, 5.2]].forEach(([dx, a, ry]) => {
      const p = k.group(k.root, dx, 8.2, 0); p.rotation.set(0, ry * 0.8, a);
      k.cyl(0.35, 0.45, 5, gm, p, 0, 2.5, 0, 5).rotation.z = 0; k.mesh(fg, gm, p, 0, 4.6, 0).rotation.z = Math.PI / 2 - 0.1;
    });
    return null;
  };
  N['corn'] = (e, k) => {
    const c = rgbOf((k.def.seq && k.def.seq[0]) || k.col('body'));
    const tx = pixTex('corn:' + c, 128, 128, (u, v, o) => {
      const cu = (u * 16) % 1, cv = (v * 18 + (Math.floor(u * 16) % 2) * 0.5) % 1, d = Math.max(Math.abs(cu - 0.5), Math.abs(cv - 0.5) * 0.9);
      put(o, c, d > 0.42 ? 0.6 : 1.04 - d * 0.5);
    });
    const prof = sprof([[0, -8], [6, -7.5], [7, -2], [6.8, 6], [5, 12.5], [2, 16.5], [0, 17]], 24);
    lathe(k, 'corn', prof, tmat(k, '#fff', { rough: 0.35 }, tx, tx, 0.8), k.root, 0, 0, 0, 24);
    const hm = k.mat('#7cb342', { rough: 0.6, side: 'double' }), hm2 = k.mat('#8bc34a', { rough: 0.6, side: 'double' });
    const husk = []; for (let i = 0; i <= 10; i++) { const u = i / 10; husk.push([Math.sin(u * Math.PI) * 5.5 * (1 - u * 0.5), -18 + u * 28]); } husk.push([0, 10]); for (let i = 10; i >= 0; i--) { const u = i / 10; husk.push([-Math.sin(u * Math.PI) * 2 * (1 - u), -18 + u * 26]); }
    const hg = xgeo('cornhusk', husk, 0.5, 0.15, { bend: P => { for (let i = 0; i < P.count; i++) { const x = P.getX(i); P.setZ(i, P.getZ(i) - x * x * 0.08); } } });
    [[0, -0.5, hm], [2.1, 0.4, hm2], [-2.1, 0.5, hm2], [Math.PI, 0.3, hm]].forEach(([ry, tilt, m]) => { const p = k.group(k.root, 0, 0, 0); p.rotation.y = ry; const h = k.mesh(hg, m, p, 0, 0, 6.6); h.rotation.z = tilt; });
    return null;
  };
  N['pumpkin'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body'), c = rgbOf(col);
    const tx = pixTex('pump:' + c, 64, 64, (u, v, o, i, j) => { put(o, c, 0.86 + noise3(i * 0.15, j * 0.6, 1) * 0.2 - Math.pow(Math.abs(u - 0.5) * 2, 6) * 0.2); });
    const m = tmat(k, '#fff', { rough: 0.45 }, tx);
    k.sphere([14, 12, 14], m, g, 0, -2, 0);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, p = k.group(g, 0, -2, 0); p.rotation.y = -a; k.sphere([7.6, 12.6, 6.4], m, p, 10, 0, 0); }
    const st = k.cyl(1.6, 2.6, 7, k.mat('#5f6b33', { rough: 0.9 }), g, 0.6, 12, 0, 7); st.rotation.z = -0.25;
    // carved jack-o'-lantern face, lit from inside
    const lit = k.mat('#3a1a00', { glow: '#ffae2a', glowK: 1.4, rough: 1 }), face = k.group(g, 0, 0, 0);
    const fz = 15.2;
    const tri = xgeo('pumpeye', [[-3, -2.5], [3, -2.5], [0, 2.8]], 6, 0, {});
    k.mesh(tri, lit, face, -6, 3, fz); k.mesh(tri, lit, face, 6, 3, fz);
    k.mesh(xgeo('pumpnose', [[-1.6, 1.4], [1.6, 1.4], [0, -1.2]], 6, 0, {}), lit, face, 0, -0.4, fz + 0.8);
    const mp = []; for (let i = 0; i <= 8; i++) { const x = -9 + i * 2.25; mp.push([x, (i % 2 ? -1.6 : 0.6) - Math.pow(x / 9, 2) * -2]); } for (let i = 8; i >= 0; i--) { const x = -9 + i * 2.25; mp.push([x * 0.96, -3.8 - (i % 2 ? 0 : 1.2) + Math.pow(x / 9, 2) * 2]); }
    k.mesh(xgeo('pumpmouth', mp, 6, 0, {}), lit, face, 0, -5.4, fz - 0.6);
    const look = facer(g, 0.25);
    return (en, t) => {
      look(en); face.visible = en.age > 0;
      if (!(en._m3 && en._m3.fx)) lit.emissiveIntensity = 1.2 + Math.sin(t * 13 + en.seed) * 0.25 + Math.sin(t * 7.3) * 0.15;
    };
  };
  N['bamboo'] = (e, k) => {
    const seg = k.mat('#8fbf5a', { rough: 0.35 }), node = k.mat('#6d9a3c', { rough: 0.5 });
    for (let i = -2; i <= 2; i++) { k.cyl(3.4, 3.6, 10.6, seg, k.root, 0, -i * 11 - 1, 0, 16); k.cyl(4.1, 4.1, 1.6, node, k.root, 0, -i * 11 + 4.9 - 0.6, 0, 16); }
    k.cyl(3.6, 3.6, 0.3, k.mat('#cfe0a0', { rough: 0.8 }), k.root, 0, 26, 0, 16);
    const lm = tmat(k, '#fff', { rough: 0.5, side: 'double' }, veinTex('bam', '#5cbf60'));
    const l1 = k.mesh(leafG('bamboo', 13, 2.2), lm, k.root, 2, 17, 0); l1.rotation.set(0.3, -0.4, 0.45);
    const l2 = k.mesh(leafG('bamboo', 13, 2.2), lm, k.root, -2, 0, 0); l2.rotation.set(-0.2, Math.PI + 0.3, 0.4);
    const l3 = k.mesh(leafG('bamboo', 11, 2), lm, k.root, 0, 6, 2); l3.rotation.set(0.6, -1.4, 0.2);
    return null;
  };
  N['mushroom'] = (e, k) => {
    const seq = k.def.seq || [], stemC = seq[0] || '#e6dcc4', capC = seq[1] || k.col('body');
    lathe(k, 'mstem', sprof([[0, -13], [5.6, -13], [6.4, -10], [5, -4], [4.2, 0], [3.6, 1], [0, 1]], 18), k.mat(stemC, { rough: 0.8 }), k.root, 0, 0, 0, 22);
    const gills = pixTex('gills', 128, 8, (u, v, o) => { const s = Math.abs(((u * 70) % 1) - 0.5); o[0] = 210 - s * 70; o[1] = 196 - s * 70; o[2] = 170 - s * 60; });
    lathe(k, 'mgill', [[12.8, 0.4], [9, -0.2], [4, 0.3]], tmat(k, '#fff', { rough: 0.9, side: 'double' }, gills), k.root, 0, 0, 0, 40);
    const cc = rgbOf(capC);
    const ct = pixTex('mcap:' + cc, 64, 64, (u, v, o, i, j) => put(o, cc, 0.8 + v * 0.25 + noise3(i * 0.3, j * 0.3, 1) * 0.08));
    const prof = sprof([[12.8, 0.4], [13.4, 1.6], [12.2, 6.5], [8.6, 11], [4, 12.8], [0, 13.2]], 20);
    lathe(k, 'mcap', prof, tmat(k, '#fff', { rough: 0.35 }, ct), k.root, 0, 0, 0, 36);
    const spot = k.mat('#f7f3ea', { rough: 0.7 });
    [[0.0, 0.25], [1.2, 0.5], [2.4, 0.35], [3.5, 0.55], [4.6, 0.3], [5.5, 0.6], [0.6, 0.85], [3, 0.88]].forEach(([a, h]) => {
      const el = h * 1.25, r = 13.2 * Math.cos(el), x = Math.cos(a) * r, z = Math.sin(a) * r, y = 1 + Math.sin(el) * 12;
      const s = k.sphere([1.9, 0.5, 1.9], spot, k.root, x, y, z); alignY(s, x / 13, (y - 1) / 12 + 0.2, z / 13);
    });
    return null;
  };
  N['acorn'] = (e, k) => {
    const nut = lathe(k, 'acnut', sprof([[0, -12], [1.6, -10.6], [5, -7], [6.8, -2], [6.8, 2], [6, 3.4], [0, 3.6]], 22), k.mat(shade(k.col('body'), 1.25), { rough: 0.3 }), k.root, 0, 0, 0, 24);
    const sc = pixTex('acap', 64, 64, (u, v, o, i, j) => { const cu = (u * 12 + (Math.floor(v * 8) % 2) * 0.5) % 1, cv = (v * 8) % 1, d = Math.hypot(cu - 0.5, cv - 0.6); const f = d < 0.42 ? 1 - d : 0.4; o[0] = 110 * f + 20; o[1] = 78 * f + 14; o[2] = 44 * f + 8; });
    lathe(k, 'accap', sprof([[0, 1.6], [6.6, 1.2], [8.2, 2.4], [8, 5.2], [5.5, 8], [0, 8.8]], 18), tmat(k, '#fff', { rough: 0.95 }, sc, sc, 0.8), k.root, 0, 0, 0, 24);
    k.cyl(0.7, 1, 3.6, stemM(k), k.root, 0.4, 10, 0, 6).rotation.z = -0.3;
    return null;
  };
  N['seed'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = pixTex('seed:' + c, 64, 32, (u, v, o) => { const st = Math.abs(((u * 8) % 1) - 0.5) < 0.12; put(o, st ? [220, 210, 190] : c, st ? 1 : 0.75); });
    const s = lathe(k, 'seed', sprof([[0, -6], [2.2, -4.6], [3.8, -1], [3.6, 3], [1.8, 5.4], [0, 6]], 16), tmat(k, '#fff', { rough: 0.4 }, tx), k.root, 0, 0, 0, 16);
    s.scale.z = 0.55;
    return null;
  };
  N['grass'] = (e, k) => {
    const r = rng(e.seed), mats = [k.col('body'), '#3e8e41', '#4a9e3f', '#5f9a45'].map(c => k.mat(shade(c, 0.85), { rough: 0.7, side: 'double' }));
    const blade = (h, w) => xgeo('blade' + h + ':' + w, [[-w, 0], [w, 0], [w * 0.45, h * 0.6], [0, h], [-w * 0.4, h * 0.6]], 0.5, 0, { bend: P => { for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setZ(i, P.getZ(i) + (y / h) * (y / h) * h * 0.25); } } });
    for (let i = 0; i < 22; i++) {
      const h = 9 + Math.round(r() * 7), bm = k.mesh(blade(h, 2), mats[i % 4], k.root, (r() - 0.5) * 26, -8, (r() - 0.5) * 12);
      bm.rotation.set((r() - 0.5) * 0.3, r() * TAU, (r() - 0.5) * 0.7);
    }
    return null;
  };

  // ======================================================================
  // ---------- food ----------
  // ======================================================================
  const crumb = (key, col, dark) => { const c = rgbOf(col); return pixTex('crumb:' + key + c, 64, 64, (u, v, o, i, j) => { const n = fbm(i * 0.12, j * 0.12, 3, 3); put(o, c, (dark || 0.78) + n * 0.35); }, { wrap: true }); };
  N['pizza'] = (e, k) => {
    const g = k.group(k.root);
    const ct = pixTex('cheese:' + k.col('body'), 128, 128, (u, v, o, i, j) => {
      const c = rgbOf(k.col('body')), n = fbm(u * 6, v * 6, 1, 4), brown = noise3(u * 14, v * 14, 9) > 0.78;
      put(o, c, 0.86 + n * 0.25); if (brown) put(o, [200, 120, 40], 0.9 + n * 0.2); if (n < 0.33) put(o, [232, 120, 50], 1);
    });
    xmesh(k, 'pizdough', [[-15, 13], [15, 13], [0, -17]], 3, 0.8, k.mat('#e2b46a', { rough: 0.8 }), g);
    xmesh(k, 'pizcheese', [[-13.8, 12], [13.8, 12], [0, -15.5]], 4.2, 0.9, tmat(k, '#fff', { rough: 0.38 }, ct), g, 0, 0, 0, { uv: [-15, -17, 30, 30] });
    const crust = k.tube([[-15.5, 12.4, 0], [-5, 14, 0.4], [5, 14, 0.4], [15.5, 12.4, 0]], 2.9, 2.9, tmat(k, '#fff', { rough: 0.75 }, crumb('crust', '#c98a42', 0.72)), g, 12, 10);
    const pep = k.mat('#a8322a', { rough: 0.45 }), basil = k.mat('#2f6b2a', { rough: 0.5 });
    for (const [px, py] of [[-5, 4], [5, 5], [0, -5], [-1, 9.4], [6.5, 9.8], [-7.5, 9.5]]) for (const s of [1, -1]) {
      const p = k.cyl(2.7, 2.7, 0.7, pep, g, px, py, s * 2.3, 16); p.rotation.x = Math.PI / 2;
    }
    k.sphere([1.6, 0.9, 0.3], basil, g, 2.5, 0, 2.2).rotation.z = 0.6; k.sphere([1.5, 0.8, 0.3], basil, g, -3, 8, 2.2).rotation.z = -0.4;
    return facer(g, 0.3);
  };
  N['cake'] = (e, k) => {
    const seq = k.def.seq || [], pink = seq[0] || k.col('body'), white = seq[1] || '#fff', red = seq[2] || '#e63946';
    const g = k.group(k.root);
    lathe(k, 'cake', sprof([[0, -16], [16.6, -16], [17, -14], [17, 2], [16.4, 3.6], [0, 4]], 14), k.mat(pink, { rough: 0.55 }), g, 0, 0, 0, 40);
    const wm = k.mat(white, { rough: 0.45 });
    lathe(k, 'caketop', sprof([[0, 3.6], [15.6, 3.4], [17.4, 2.8], [17.5, 4.6], [15.8, 5.4], [0, 5.4]], 10), wm, g, 0, 0, 0, 40);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = 3 + (i * 7 % 5); k.sphere([1.7, l, 1.3], wm, g, Math.cos(a) * 17.2, 3 - l * 0.5, Math.sin(a) * 17.2); }
    const bead = geo('icakebead', () => new T.TorusGeometry(16.8, 1.6, 8, 64)); k.mesh(bead, wm, g, 0, -15.2, 0).rotation.x = Math.PI / 2;
    const cherry = k.mat(red, { rough: 0.15 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; k.sphere(1.9, cherry, g, Math.cos(a) * 12, 7, Math.sin(a) * 12); k.sphere(1.5, wm, g, Math.cos(a) * 12, 5.6, Math.sin(a) * 12); }
    // candle with a flickering flame
    const ctx = pixTex('candle', 16, 64, (u, v, o) => { const s = ((v * 6 + u) % 1) < 0.5; o[0] = s ? 230 : 250; o[1] = s ? 57 : 250; o[2] = s ? 70 : 250; });
    k.cyl(1.2, 1.2, 10, tmat(k, '#fff', { rough: 0.5 }, ctx), g, 0, 10.2, 0, 10);
    k.cyl(0.18, 0.18, 1.4, k.mat('#222'), g, 0, 15.8, 0, 4);
    const fl = flameGeo(), f1 = k.mesh(fl, addMat(k, '#ff8c1a', 0.6, 'cf1'), g, 0, 15.6, 0), f2 = k.mesh(fl, addMat(k, '#ffe28a', 0.6, 'cf2'), g, 0, 15.8, 0);
    noShadow(f1); noShadow(f2);
    return (en, t) => {
      const f = 1 + Math.sin(t * 14 + en.seed) * 0.18, s = Math.sin(t * 9 + en.seed * 2) * 0.12;
      f1.scale.set(1.6, 2.4 * f, 1.6); f1.rotation.z = s; f2.scale.set(0.9, 1.4 * f, 0.9); f2.rotation.z = s;
    };
  };
  N['cupcake'] = (e, k) => {
    const col = k.col('body');
    const liner = geo('icupliner', () => { const g = new T.CylinderGeometry(10, 7, 14, 48, 1, true), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), a = Math.atan2(z, x), f = 1 + (Math.round(a / TAU * 48) % 2 ? 0.035 : -0.02); P.setX(i, x * f); P.setZ(i, z * f); } g.computeVertexNormals(); return g; });
    k.mesh(liner, k.mat(mix(col, '#ffffff', 0.55), { rough: 0.6, flat: true, side: 'double' }), k.root, 0, -7, 0);
    k.cyl(7, 7, 0.5, k.mat('#c89060', { rough: 0.9 }), k.root, 0, -13.8, 0, 24);
    k.sphere([10, 2.4, 10], k.mat('#c48a52', { rough: 0.9 }), k.root, 0, 0, 0);
    const fm = k.mat(col, { rough: 0.4 });
    [[9.2, 2.4, 1.8], [7.4, 2.2, 5.4], [5.2, 2, 8.6], [3, 1.8, 11.2]].forEach(([R, r, y]) => k.mesh(geo('icupt' + R, () => new T.TorusGeometry(R - r, r + 0.9, 12, 32)), fm, k.root, 0, y, 0).rotation.x = Math.PI / 2);
    k.cone(2.6, 4, fm, k.root, 0, 13.6, 0, 14);
    k.sphere(2.6, k.mat('#c0182a', { rough: 0.12 }), k.root, 0.4, 16.4, 0.6);
    k.cyl(0.25, 0.3, 4, stemM(k), k.root, 1.2, 19.4, 0.6, 5).rotation.z = -0.4;
    const r = rng(e.seed), list = [], cols = ['#f6d13b', '#3d7ee8', '#ffffff', '#4caf50', '#b57edc'];
    for (let i = 0; i < 26; i++) { const a = r() * TAU, el = 0.15 + r() * 1.05, R = 9.5 * Math.cos(el) * 0.92, y = 2.4 + Math.sin(el) * 10.5; list.push({ p: [Math.cos(a) * R, y, Math.sin(a) * R], n: [r() - 0.5, r() - 0.5, r() - 0.5], s: [0.38, 1.4, 0.38], c: cols[i % 5] }); }
    inst(k, geo('ispr', () => new T.CapsuleGeometry(1, 1, 2, 6)), k.mat('#ffffff', { rough: 0.4 }), list);
    return null;
  };
  N['cookie'] = (e, k) => {
    const g = k.group(k.root), c = rgbOf(k.col('body'));
    const tx = sphereTex('cookie:' + c, 256, 128, (x, y, z, o) => { const n = fbm(x * 5, y * 5, z * 5, 4), rim = 1 - Math.abs(z); put(o, c, 0.82 + n * 0.3 - rim * rim * 0.12); if (n > 0.72) put(o, c, 0.68); });
    k.sphere([13, 13, 3.6], tmat(k, '#fff', { rough: 0.85 }, tx, tx, 0.9), g);
    const chip = k.mat('#3a2214', { rough: 0.4 });
    for (const [x, y] of [[-5, 4], [4, 5], [2, -4], [-5, -5], [7.5, -1], [-1, 0.5], [-8.5, 0], [4, 9.5], [-2, 9], [1, -9.5]]) {
      for (const s of [1, -1]) { if (s < 0 && (x + y) % 2) continue; const zz = 3.6 * Math.sqrt(Math.max(0, 1 - (x * x + y * y) / 169)); const ch = k.sphere([1.6, 1.5, 1.2], chip, g, x, y, s * (zz + 0.1)); ch.rotation.z = x; }
    }
    return facer(g, 0.2);
  };
  N['ice cream'] = (e, k) => {
    const seq = k.def.seq || [], coneC = seq[0] || '#e8b96f', scoopC = seq[1] || k.col('body'), topC = seq[2] || '#fff';
    const cc = rgbOf(coneC);
    const wt = pixTex('waffle:' + cc, 64, 64, (u, v, o) => { const a = Math.abs(((u * 10 + v * 6) % 1) - 0.5), b = Math.abs(((u * 10 - v * 6 + 10) % 1) - 0.5); const ln = Math.min(a, b) < 0.07; put(o, cc, ln ? 0.7 : 1.02 - Math.min(a, b) * 0.4); });
    const cone = lathe(k, 'iccone', [[0, -20], [8.6, 0], [9.4, 0.6], [9.4, 1.6], [0, 1.6]], tmat(k, '#fff', { rough: 0.8 }, wt, wt, 0.7), k.root, 0, 0, 0, 24);
    const scoop = k.group(k.root, 0, 0, 0), sm2 = k.mat(scoopC, { rough: 0.5 });
    k.sphere([10.2, 9, 10.2], sm2, scoop, 0, 8.4, 0);
    const rim = k.mesh(geo('icrim', () => { const g = new T.TorusGeometry(8.8, 1.9, 8, 40), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), a = Math.atan2(y, x), f = 1 + Math.sin(a * 9) * 0.07; P.setX(i, x * f); P.setY(i, y * f); } g.computeVertexNormals(); return g; }), sm2, scoop, 0, 2.8, 0);
    rim.rotation.x = Math.PI / 2;
    const drips = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4; drips.push(k.sphere([1.3, 2.4, 1.3], sm2, scoop, Math.cos(a) * 8.6, 1.2, Math.sin(a) * 8.6)); }
    k.sphere([5, 3.2, 5], k.mat(topC, { rough: 0.5 }), scoop, 0, 16.4, 0);
    k.cone(3.2, 4.4, k.mat(topC, { rough: 0.5 }), scoop, 0, 19.2, 0, 10);
    return (en) => { const m = melt(en); scoop.scale.set(1 + m * 0.12, 1 - m * 0.28, 1 + m * 0.12); for (const d of drips) d.scale.y = 2.4 + m * 5; };
  };
  N['burger'] = (e, k) => {
    const bun = k.col('body'), c = rgbOf(bun);
    const bt = sphereTex('bun:' + c, 128, 64, (x, y, z, o) => put(o, c, 0.72 + y * 0.18 + noise3(x * 12, y * 12, z * 12) * 0.12));
    const bm = tmat(k, '#fff', { rough: 0.42 }, bt);
    lathe(k, 'bunbot', sprof([[0, -14], [12, -14], [13.8, -13], [14.3, -11], [14, -9.2], [0, -9.2]], 12), k.mat(shade(bun, 0.92), { rough: 0.6 }), k.root, 0, 0, 0, 32);
    const pt = crumb('patty', '#5a3420', 0.6);
    lathe(k, 'patty', sprof([[0, -9.4], [14.4, -9.4], [15.4, -8], [15.3, -5.2], [14.4, -4], [0, -4]], 10), tmat(k, '#fff', { rough: 0.85 }, pt, pt, 1.2), k.root, 0, 0, 0, 28);
    const cheese = geo('icheeseslice', () => { const g = new T.BoxGeometry(25, 0.7, 25, 10, 1, 10), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), d = Math.hypot(x, z); if (d > 13) P.setY(i, P.getY(i) - (d - 13) * 0.55); } g.computeVertexNormals(); return g; });
    k.mesh(cheese, k.mat('#f6b92b', { rough: 0.35 }), k.root, 0, -3.6, 0).rotation.y = Math.PI / 4 + 0.2;
    const tom = k.mat('#d63a2f', { rough: 0.3 });
    k.cyl(6, 6, 1.4, tom, k.root, -6, -2.6, 4, 18); k.cyl(6, 6, 1.4, tom, k.root, 6, -2.5, -3, 18);
    const lettuce = geo('ilettuce', () => { const g = new T.CylinderGeometry(16.4, 16.4, 0.8, 64, 1), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), d = Math.hypot(x, z); if (d > 10) { const a = Math.atan2(z, x); P.setY(i, P.getY(i) + Math.sin(a * 11) * 1.1 * (d - 10) / 6.4); } } g.computeVertexNormals(); return g; });
    k.mesh(lettuce, k.mat('#6fbf3a', { rough: 0.45, side: 'double' }), k.root, 0, -1.6, 0);
    const prof = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; prof.push([15.2 * Math.cos(a) * (i === 0 ? 0.97 : 1), -1.4 + 15.6 * Math.pow(Math.sin(a), 0.85)]); } prof.unshift([0, -1.4]); prof[1] = [14.6, -1.4];
    lathe(k, 'buntop', prof, bm, k.root, 0, 0, 0, 36);
    const r = rng(e.seed + 3), list = [];
    for (let i = 0; i < 22; i++) { const a = r() * TAU, el = 0.35 + r() * 1.05, R = 15.25 * Math.cos(el), y = -1.4 + 15.65 * Math.pow(Math.sin(el), 0.85); list.push({ p: [Math.cos(a) * R, y, Math.sin(a) * R], n: [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)], s: [0.55, 0.3, 1.1], spin: r() * 3 }); }
    inst(k, geo('isesame', () => new T.SphereGeometry(1, 8, 6)), k.mat('#f6ecd0', { rough: 0.5 }), list);
    return null;
  };
  N['hot dog'] = (e, k) => {
    const bun = k.col('body');
    const bt = crumb('hdbun', bun, 0.85), bm = tmat(k, '#fff', { rough: 0.6 }, bt);
    for (const s of [-1, 1]) { const h = k.sphere([16, 5.2, 4], bm, k.root, 0, -3.4, s * 4.4); h.rotation.x = -s * 0.3; }
    k.sphere([15.4, 2.8, 6.4], k.mat(shade(bun, 1.1), { rough: 0.7 }), k.root, 0, -5.4, 0);
    const sau = k.tube([[-17, 2.4, 0], [0, 1.6, 0], [17, 2.4, 0]], u => 3.8 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.02 - 0.01))), 0.18), 0, k.mat('#a3442a', { rough: 0.25 }), k.root, 14, 12);
    const zz = []; for (let i = 0; i <= 12; i++) zz.push([-12 + i * 2, 5.2 + Math.sin(i * Math.PI / 2) * 0.3, (i % 2 ? 2 : -2) + 1]);
    k.tube(zz, 0.75, 0.75, k.mat('#f2c21b', { rough: 0.3 }), k.root, 40, 6);
    return null;
  };
  N['donut'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body');
    const dt = crumb('dough', '#cf9152', 0.85);
    k.mesh(geo('idonut', () => new T.TorusGeometry(8.4, 4.9, 20, 40)), tmat(k, '#fff', { rough: 0.75 }, dt), g);
    const icing = geo('iicing', () => {
      const R = 8.4, r = 5.25, g2 = new T.TorusGeometry(R, r, 20, 40), P = g2.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(y, x), cx = Math.cos(a) * R, cy = Math.sin(a) * R;
        const nz = z / r, thr = -0.05 + 0.28 * Math.sin(a * 7) * Math.cos(a * 3 + 1);
        if (nz < thr) { const f = 4.3 / r; P.setXYZ(i, cx + (x - cx) * f, cy + (y - cy) * f, z * f); }
      }
      g2.computeVertexNormals(); return g2;
    });
    k.mesh(icing, k.mat(col, { rough: 0.28 }), g, 0, 0, 0.15);
    const r = rng(e.seed + 7), list = [], cols = ['#f6d13b', '#3d7ee8', '#ffffff', '#4caf50', '#e63946', '#b57edc'];
    for (let i = 0; i < 32; i++) { const a = r() * TAU, b = (r() - 0.5) * 2.2, cx = Math.cos(a) * (8.4 + Math.sin(b) * 5.3), cy = Math.sin(a) * (8.4 + Math.sin(b) * 5.3), z = Math.cos(b) * 5.3 + 0.1; list.push({ p: [cx, cy, z], n: [r() - 0.5, r() - 0.5, (r() - 0.5) * 0.3], s: [0.36, 1.1, 0.36], c: cols[i % 6] }); }
    inst(k, geo('ispr', () => new T.CapsuleGeometry(1, 1, 2, 6)), k.mat('#ffffff', { rough: 0.4 }), list, g);
    return facer(g, 0.25);
  };
  N['candy'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = sphereTex('candy:' + c, 128, 64, (x, y, z, o) => { const s = ((Math.atan2(z, y) / TAU + x * 0.6 + 1) * 4) % 1; put(o, s < 0.5 ? c : [250, 248, 244], 1); });
    k.sphere([8.4, 6, 6], tmat(k, '#fff', { rough: 0.15 }, tx), k.root);
    const wm = k.mat(shade(k.col('body'), 1.15), { rough: 0.2, opacity: 0.88, flat: true });
    for (const s of [-1, 1]) {
      k.sphere([1.4, 1.6, 1.6], wm, k.root, s * 8.4, 0, 0);
      const w = k.cone(5.4, 6.2, wm, k.root, s * 11.6, 0, 0, 9); w.rotation.z = s * Math.PI / 2;
    }
    return null;
  };
  N['lollipop'] = (e, k) => {
    const g = k.group(k.root), c = rgbOf(k.col('body'));
    const tx = sphereTex('lolly:' + c, 256, 128, (x, y, z, o) => { const a = Math.atan2(y, x), r = Math.hypot(x, y); const s = ((a / TAU + r * 2.4 + 1) * 3) % 1; put(o, s < 0.5 ? c : [252, 250, 246], s < 0.5 ? 1 : 1); });
    k.cyl(0.9, 0.9, 22, k.mat('#f4f1ea', { rough: 0.6 }), g, 0, -7, 0, 8);
    k.sphere([8, 8, 2.6], tmat(k, '#fff', { rough: 0.1 }, tx), g, 0, 10, 0);
    return facer(g, 0.2);
  };
  N['cheese'] = (e, k) => {
    const col = k.col('body'), c = rgbOf(col);
    const tx = pixTex('cheesew:' + c, 64, 64, (u, v, o, i, j) => put(o, c, 0.92 + noise3(i * 0.3, j * 0.3, 2) * 0.1), { wrap: true });
    xmesh(k, 'cheesewedge', [[-15, -10], [15, -10], [15, 8]], 18, 0.8, tmat(k, '#fff', { rough: 0.5 }, tx), k.root, 0, 0, 0, { holes: [[4, -5, 2.6], [10, -0.5, 1.9], [9.5, -7, 1.4], [-6, -7.4, 1.5]], crease: 0.6 });
    return null;
  };
  N['bone'] = (e, k) => {
    const m = k.mat(k.col('body'), { rough: 0.6 });
    const sh = lathe(k, 'boneshaft', sprof([[3.6, -12], [2.7, -8], [2.4, 0], [2.7, 8], [3.6, 12]], 14), m, k.root, 0, 0, 0, 16); sh.rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) k.sphere([4.3, 4.1, 4.2], m, k.root, sx * 12.4, sy * 3, 0);
    return null;
  };
  N['egg'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const tx = sphereTex('egg:' + c, 64, 64, (x, y, z, o) => put(o, c, noise3(x * 30, y * 30, z * 30) > 0.8 ? 0.9 : 0.97));
    const prof = []; for (let i = 0; i <= 26; i++) { const th = i / 26 * Math.PI; prof.push([Math.sin(th) * (10 - 1.6 * (1 - Math.cos(th)) / 2), -13 * Math.cos(th)]); }
    const ln = geo('iegglathe', () => new T.LatheGeometry(prof.map(p => V2(p[0], p[1])), 28));
    k.mesh(ln, tmat(k, '#fff', { rough: 0.42 }, tx), k.root);
    const zz = []; for (let i = 0; i <= 6; i++) zz.push([-5 + i * 1.8, 2 + (i % 2 ? 2 : -1.4), 0]);
    zz.forEach(p => { p[2] = Math.sqrt(Math.max(0, 1 - (p[1] / 13) ** 2)) * 9.6 + 0.1; });
    const crack = k.tube(zz, 0.32, 0.32, k.mat('#3a2a1a', { rough: 0.9 }), k.root, 16, 4);
    crack.visible = false;
    return (en) => { crack.visible = en.age > 4; };
  };
  N['bread'] = (e, k) => {
    const c = rgbOf(k.col('body'));
    const loaf = geo('iloaf', () => { const g = new T.SphereGeometry(1, 36, 24), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const sg = v => Math.sign(v) * Math.pow(Math.abs(v), 0.7); let x = sg(P.getX(i)), y = P.getY(i), z = sg(P.getZ(i)); y = y < 0 ? Math.max(-0.5, sg(y)) : y; P.setXYZ(i, x, y, z); } g.computeVertexNormals(); return g; });
    const tx = sphereTex('loaf:' + c, 128, 64, (x, y, z, o) => { const top = clamp(y * 1.6, 0, 1); put(o, [c[0] - top * 40, c[1] - top * 50, c[2] - top * 45], 0.9 + noise3(x * 14, y * 14, z * 14) * 0.12); });
    const m = k.mesh(loaf, tmat(k, '#fff', { rough: 0.55 }, tx), k.root, 0, -3.6, 0); m.scale.set(15, 14.4, 10.5);
    const slash = k.mat(mix(k.col('body'), '#f6e7c4', 0.6), { rough: 0.9 });
    for (const x of [-7.5, 0, 7.5]) { const s = k.sphere([1.4, 0.7, 5.4], slash, k.root, x, 10.3 - Math.abs(x) * 0.12, 0); s.rotation.set(0, 0.55, x * -0.03); }
    return null;
  };
  N['pie'] = (e, k) => {
    const crust = k.col('body'), cm = tmat(k, '#fff', { rough: 0.7 }, crumb('pie', crust, 0.85));
    const g = k.group(k.root); g.rotation.x = 0.28;
    lathe(k, 'piedish', [[0, -8], [12.6, -8], [16, 1], [16.6, 1.6], [0, 1.6]], k.mat('#d8dde2', { rough: 0.3, metal: 0.4 }), g, 0, 0, 0, 36);
    k.cyl(14.6, 14.6, 0.6, k.mat('#8f1f2a', { rough: 0.3 }), g, 0, 1.9, 0, 32);
    const rim = geo('ipierim', () => { const t = new T.TorusGeometry(15, 1.8, 8, 72), P = t.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), a = Math.atan2(y, x), f = 1 + Math.abs(Math.sin(a * 14)) * 0.03; P.setX(i, x * f); P.setY(i, y * f); P.setZ(i, P.getZ(i) * (0.8 + Math.abs(Math.sin(a * 14)) * 0.5)); } t.computeVertexNormals(); return t; });
    k.mesh(rim, cm, g, 0, 2.2, 0).rotation.x = Math.PI / 2;
    for (let i = -2; i <= 2; i++) {
      const L = 2 * Math.sqrt(14.6 * 14.6 - (i * 5.2) ** 2);
      rbox(k, 2.4, 0.9, L, cm, g, i * 5.2, 2.6, 0, 0.4); rbox(k, L, 0.9, 2.4, cm, g, 0, 2.9, i * 5.2, 0.4);
    }
    return null;
  };
  N['sandwich'] = (e, k) => {
    const g0 = k.group(k.root, 0, -4, 0), g = k.group(g0), bread = k.col('body');
    g0.rotation.y = 2.56 + 0.35; g.rotation.x = -Math.PI / 2;   // lying flat with the cut side toward us
    const tri = [[-15, -10], [15, -10], [15, 10]], inc = [8.03, -3.03];
    const grow = d => tri.map(p => [inc[0] + (p[0] - inc[0]) * (1 + d / 6.97), inc[1] + (p[1] - inc[1]) * (1 + d / 6.97)]);
    const crumbM = tmat(k, '#fff', { rough: 0.9 }, crumb('sandw', '#f2e3bd', 0.88)), crustM = k.mat(shade(bread, 0.85), { rough: 0.8 });
    for (const s of [-1, 1]) { xmesh(k, 'sw-crumb2', [[-13.3, -8.8], [13.8, -8.8], [13.8, 9.35]], 4.4, 1, crumbM, g, 0, 0, s * 4.6); xmesh(k, 'sw-crust', grow(0), 3.4, 0.8, crustM, g, 0, 0, s * 4.6); }
    const wavy = []; { const p = grow(1.6); for (let e2 = 0; e2 < 3; e2++) { const a = p[e2], b = p[(e2 + 1) % 3]; for (let i = 0; i < 10; i++) { const u = i / 10, nx = a[0] + (b[0] - a[0]) * u, ny = a[1] + (b[1] - a[1]) * u, w = Math.sin(i * 1.7) * 0.9; wavy.push([inc[0] + (nx - inc[0]) * (1 + w / 9), inc[1] + (ny - inc[1]) * (1 + w / 9)]); } } }
    xmesh(k, 'sw-lettuce', wavy, 1.2, 0.3, k.mat('#6fbf3a', { rough: 0.45 }), g, 0, 0, 1.6);
    xmesh(k, 'sw-ham', grow(0.7), 1.6, 0.4, k.mat('#e7949a', { rough: 0.5 }), g, 0, -0.3, -0.1);
    xmesh(k, 'sw-cheese', grow(0.9), 0.9, 0.2, k.mat('#f6c23b', { rough: 0.4 }), g, 0.4, 0.4, -1.6);
    xmesh(k, 'sw-tom', grow(0.2), 1.0, 0.2, k.mat('#d63a2f', { rough: 0.3 }), g, 0, 0, 0.6);
    return null;
  };
  N['taco'] = (e, k) => {
    const shell = geo('itaco', () => {
      const nx = 28, nv = 16, pos = [], uv = [], idx = [], R = 14.5, yb = -9;
      for (let i = 0; i <= nx; i++) { const x = -R + i / nx * 2 * R, H = Math.sqrt(Math.max(0, R * R - x * x)) * 1.18; for (let j = 0; j <= nv; j++) { const v = j / nv * 2 - 1; pos.push(x, yb + H * Math.pow(Math.abs(v), 1.4), 7 * v * (0.35 + 0.65 * Math.abs(v))); uv.push(i / nx, j / nv); } }
      for (let i = 0; i < nx; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    });
    const c = rgbOf(k.col('body'));
    const tx = pixTex('taco:' + c, 64, 64, (u, v, o, i, j) => { const n = noise3(i * 0.25, j * 0.25, 1); put(o, c, 0.92 + n * 0.12); if (noise3(i * 0.4, j * 0.4, 5) > 0.8) put(o, [170, 110, 40], 1); });
    k.mesh(shell, tmat(k, '#fff', { rough: 0.6, side: 'double' }, tx), k.root);
    // filling peeking out along the top
    const arc = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.08 + i / 10 * 0.84), x = -Math.cos(a) * 12.4; arc.push([x, -9 + Math.sin(a) * 12.4 * 1.1, 0]); }
    k.tube(arc, 4, 4, tmat(k, '#fff', { rough: 0.9 }, crumb('meat', '#6b3a22', 0.6)), k.root, 16, 10);
    const r = rng(e.seed), bits = [['#6fbf3a', 1.6, 12], ['#d63a2f', 1.1, 5], ['#f6b92b', 0.7, 7]];
    for (const [col, s, n] of bits) { const m = k.mat(col, { rough: 0.5, flat: true }); for (let i = 0; i < n; i++) { const a = Math.PI * (0.12 + r() * 0.76), x = -Math.cos(a) * 12.6; k.mesh(geo('icobit', () => new T.IcosahedronGeometry(1, 0)), m, k.root, x, -9 + Math.sin(a) * 13.9 + r() * 1.5, (r() - 0.5) * 6).scale.set(s * (1 + r()), s * (0.6 + r() * 0.5), s * (1 + r())); } }
    return null;
  };
  N['milk'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body');
    xmesh(k, 'milkbox', [[-9, -16], [9, -16], [9, 8], [5, 15], [-5, 15], [-9, 8]], 17, 0.7, k.mat(col, { rough: 0.55 }), g);
    k.box(10, 2.6, 17.6, k.mat(col, { rough: 0.55 }), g, 0, 15.6, 0);
    const lt = canvasTex('milklabel', 128, 160, (x) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 160);
      x.fillStyle = '#2f6fd0'; x.fillRect(0, 0, 128, 30); x.fillRect(0, 138, 128, 22);
      x.fillStyle = '#2f6fd0'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('MILK', 64, 78);
      x.fillStyle = '#222'; for (const [a, b, r] of [[30, 112, 10], [58, 120, 7], [92, 108, 12], [104, 128, 6]]) { x.beginPath(); x.ellipse(a, b, r, r * 0.7, 0.4, 0, TAU); x.fill(); }
      x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.fillText('FRESH', 64, 22);
    });
    const lab = k.mesh(geo('iplane', () => new T.PlaneGeometry(1, 1)), tmat(k, '#fff', { rough: 0.6 }, lt), g, 0, -4, 8.56); lab.scale.set(17.4, 22, 1);
    return facer(g, 0.55);
  };
  N['honey'] = (e, k) => {
    const g = k.group(k.root), hc = k.col('body');
    lathe(k, 'honeyjar', sprof([[0, -12], [11.4, -12], [12.4, -10], [12.6, -2], [11.2, 4], [9.6, 6], [9.6, 7], [0, 7]], 20), k.mat(hc, { rough: 0.12, glow: shade(hc, 0.5), glowK: 0.45, opacity: 0.94 }), g, 0, 0, 0, 32);
    const lid = k.mat('#c8a060', { rough: 0.45, metal: 0.5 });
    lathe(k, 'honeylid', sprof([[0, 6.4], [10.6, 6.4], [11.2, 7.4], [11.2, 10.6], [10.4, 11.4], [0, 11.6]], 12), lid, g, 0, 0, 0, 32);
    const lt = canvasTex('honeylabel', 128, 64, (x) => {
      x.fillStyle = '#f7ecd0'; x.fillRect(0, 0, 128, 64); x.strokeStyle = '#8b5a2b'; x.lineWidth = 4; x.strokeRect(4, 4, 120, 56);
      x.fillStyle = '#7a4a1a'; x.font = 'bold 26px serif'; x.textAlign = 'center'; x.fillText('HONEY', 64, 42);
    });
    const label = k.mesh(geo('ihonlab', () => new T.CylinderGeometry(12.75, 12.6, 9, 20, 1, true, -0.75, 1.5)), tmat(k, '#fff', { rough: 0.7 }, lt), g, 0, -5.5, 0);
    k.tube([[3, 6.6, 9.3], [3.4, 4, 10.6], [3.2, 1, 11.6], [3.4, -0.4, 11.8]], 1.1, 0.7, k.mat(hc, { rough: 0.1, glow: shade(hc, 0.5), glowK: 0.4 }), g, 10, 8);
    k.sphere(1.4, k.mat(hc, { rough: 0.1, glow: shade(hc, 0.5), glowK: 0.4 }), g, 3.4, -1, 11.8);
    return facer(g, 0.35);
  };
  N['coffee'] = (e, k) => {
    const col = k.col('body');
    lathe(k, 'mug', sprof([[0, -10], [7.6, -10], [8.4, -9], [9.4, 2], [10, 6], [9.2, 6.2], [8.4, 2], [7.4, -8.4], [0, -8.4]], 30), k.mat(col, { rough: 0.22, side: 'double' }), k.root, 0, 0, 0, 32);
    k.cyl(8.6, 8.6, 0.3, k.mat('#3b2414', { rough: 0.08 }), k.root, 0, 4.2, 0, 28);
    k.mesh(geo('icrema', () => new T.RingGeometry(5.5, 8.4, 28)), k.mat('#a8754a', { rough: 0.3 }), k.root, 0, 4.4, 0).rotation.x = -Math.PI / 2;
    const h = k.mesh(geo('imughandle', () => new T.TorusGeometry(4.2, 1.3, 10, 18, Math.PI * 1.2)), k.mat(col, { rough: 0.22 }), k.root, 9.6, -1.4, 0); h.rotation.z = -Math.PI * 0.6;
    const steam = [];
    for (let i = 0; i < 3; i++) {
      const pts = []; for (let j = 0; j <= 5; j++) pts.push([Math.sin(j * 1.3 + i) * 1.6, j * 2.6, (i - 1) * 2.4]);
      const m = k.mat('#ffffff', { basic: true, opacity: 0.3, tag: 'st' + i }); m.depthWrite = false;
      const s = k.tube(pts, 0.9, 0.2, m, k.root, 12, 6); s.castShadow = false; s.userData.m = m; steam.push(s);
    }
    return (en, t) => {
      for (let i = 0; i < 3; i++) { const u = ((t * 0.5 + i / 3) % 1), s = steam[i]; s.position.set((i - 1) * 3.4, 5 + u * 6, 0); s.rotation.y = t + i; if (!(en._m3 && en._m3.fx)) s.userData.m.opacity = 0.35 * Math.sin(u * Math.PI); }
    };
  };

  // ======================================================================
  // ---------- plants ----------
  // ======================================================================
  const barkTex = (col) => { const c = rgbOf(col); return pixTex('bark:' + c, 64, 128, (u, v, o, i, j) => { const w = noise3(i * 0.2, j * 0.04, 1), fur = Math.pow(Math.abs(Math.sin(u * TAU * 7 + w * 5)), 0.35), g2 = noise3(i * 0.9, j * 0.3, 4); put(o, c, 0.6 + fur * 0.38 + g2 * 0.12); }, { wrap: true }); };
  const leafyTex = pixTex('leafy', 128, 128, (u, v, o, i, j) => { const n = noise3(i * 0.35, j * 0.35, 1), m = noise3(i * 0.12, j * 0.12, 6); const w = 200 + (n - 0.5) * 90 + (m - 0.5) * 50; o[0] = clamp(w * 0.96, 0, 255); o[1] = clamp(w, 0, 255); o[2] = clamp(w * 0.9, 0, 255); }, { wrap: true });
  const clump = (k, v, col, par, x, y, z, s) => { const m = tmat(k, '#fff', { rough: 0.9, flat: true, tag: col }, leafyTex); m.color.set(col); const me = k.mesh(lumpG('clump' + v, 0.3, 1.9, true, 3), m, par, x, y, z); if (Array.isArray(s)) me.scale.set(...s); else me.scale.setScalar(s); me.rotation.set(v * 1.3, v * 2.1, v * 0.7); return me; };
  const vary = (hex, r, amt) => { const c = new T.Color(hex); c.offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * amt); return '#' + c.getHexString(); };

  N['flower'] = (e, k) => {
    const seq = k.def.seq || [], stemC = seq[0] || '#4caf50', petC = seq[2] || k.col('body'), midC = seq[8] || '#f6d13b';
    const g = k.group(k.root), sm2 = k.mat(stemC, { rough: 0.6 });
    k.tube([[0, -23, 0], [0.8, -8, 0], [-0.4, 5, 0], [0, 12, 0.6]], 0.9, 0.7, sm2, g, 12, 7);
    const lm = tmat(k, '#fff', { rough: 0.5, side: 'double' }, veinTex('fl', stemC));
    const l1 = k.mesh(leafG('flower', 10, 2.6), lm, g, 0.3, -12, 0); l1.rotation.set(0.3, 0.3, 0.55);
    const l2 = k.mesh(leafG('flower', 9, 2.4), lm, g, -0.2, -6, 0); l2.rotation.set(-0.2, Math.PI - 0.3, 0.5);
    const head = k.group(g, 0, 13, 1); head.rotation.x = -0.25;
    const pm = k.mat(petC, { rough: 0.55, side: 'double' }), pm2 = k.mat(shade(petC, 0.88), { rough: 0.55, side: 'double' });
    const pet = lumpG('petal', 0.05, 2, false);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, p = k.group(head); p.rotation.z = a; const m = k.mesh(pet, i % 2 ? pm : pm2, p, 6.2, 0, i % 2 ? 0.4 : -0.2); m.scale.set(4.6, 2.2, 0.7); m.rotation.y = -0.25; }
    const mt = pixTex('fmid:' + midC, 64, 32, (u, v, o, i, j) => { const c = rgbOf(midC); put(o, c, noise3(i * 0.8, j * 0.8, 1) > 0.55 ? 0.7 : 1); });
    k.sphere([3.6, 3.6, 2], tmat(k, '#fff', { rough: 0.8 }, mt, mt, 0.8), head, 0, 0, 0.9);
    const look = facer(g, 0.3);
    return (en, t) => { look(en); head.rotation.z = Math.sin(t * 1.5 + en.seed) * 0.06; g.rotation.z = Math.sin(t * 1.1 + en.seed) * 0.025; };
  };
  N['tree'] = (e, k) => {
    const r = rng(e.seed + 1), bm = tmat(k, '#fff', { rough: 0.95 }, barkTex('#7a4e2a'), barkTex('#7a4e2a'), 1.2);
    k.tube([[0, -58, 0], [-1, -40, 0], [0, -24, 0], [0, -14, 0]], 7, 4.4, bm, k.root, 12, 14);
    lathe(k, 'treeroot', [[11, -58], [7.6, -56], [6.6, -52], [6, -46], [0, -46]], bm, k.root, 0, 0, 0, 16);
    const br = [[[-1, -22, 0], [-9, -8, 2], [-16, 4, 0]], [[1, -20, 0], [7, -6, -2], [12, 8, 0]], [[0, -16, 0], [1, 0, -3], [-1, 18, -2]], [[0, -18, 0], [-3, -4, 9], [-6, 8, 14]], [[0, -18, 0], [4, -6, -9], [6, 6, -14]]];
    for (const p of br) k.tube(p, 3.6, 1.4, bm, k.root, 8, 8);
    const crown = k.group(k.root);
    const spots = [[-20, 4, 0, 17], [20, 2, 0, 17], [0, 24, 0, 21], [-15, 38, 0, 15], [15, 35, 0, 15], [0, 8, 13, 17], [0, 6, -13, 17], [-12, 20, 14, 15], [12, 20, -14, 15], [12, 16, 13, 14], [-12, 16, -13, 14], [0, 44, 4, 12], [-28, 14, 4, 12], [28, 12, -4, 12], [5, 32, 15, 13], [-5, 32, -15, 13]];
    const greens = ['#4a9a45', '#5cb456', '#6cc464', '#3f8a40'];
    spots.forEach(([x, y, z, s], i) => clump(k, i % 4, vary(greens[i % 4], r, 0.06), crown, x, y, z, [s * 1.1, s * 0.9, s]));
    return (en, t) => { crown.rotation.z = Math.sin(t * 0.9 + en.seed) * 0.012; crown.rotation.x = Math.sin(t * 0.7 + en.seed) * 0.008; };
  };
  N['pine tree'] = (e, k) => {
    const bm = tmat(k, '#fff', { rough: 0.95 }, barkTex('#6b4226'));
    k.cyl(3, 5, 40, bm, k.root, 0, -36, 0, 12);
    const tier = geo('ipinetier', () => {
      const g = new T.ConeGeometry(1, 1, 18, 5, true), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), u = 0.5 - y; const jag = u > 0.98 ? (Math.round(a / TAU * 18) % 2 ? 0.86 : 1.06) : 1 + Math.sin(a * 9 + y * 8) * 0.04 * u; P.setXYZ(i, x * jag, y - (u > 0.98 ? (jag > 1 ? 0.07 : -0.03) : 0) + Math.pow(u, 3) * -0.08, z * jag); }
      g.computeVertexNormals(); return g;
    });
    const nt = pixTex('needles', 64, 64, (u, v, o, i, j) => { const s = noise3(i * 1.2, j * 0.15, 3); o[0] = o[1] = o[2] = 120 + s * 135; }, { wrap: true });
    const tiers = [[-38, 32, 34, '#2e6b34'], [-22, 28, 32, '#33733a'], [-6, 24, 30, '#357a3b'], [10, 19, 28, '#3a843f'], [26, 13, 24, '#3e8c45'], [40, 7, 16, '#43944a']];
    const grp = k.group(k.root);
    tiers.forEach(([y, w, h, c], i) => { const m = tmat(k, c, { rough: 0.9, flat: true, side: 'double' }, nt, nt, 1); const me = k.mesh(tier, m, grp, 0, y + h / 2, 0); me.scale.set(w, h, w); me.rotation.y = i * 0.7; });
    return (en, t) => { grp.rotation.z = Math.sin(t * 0.9 + en.seed) * 0.01; };
  };
  N['palm tree'] = (e, k) => {
    const rt = pixTex('palmbark', 32, 64, (u, v, o, i, j) => { const ring = (v * 18) % 1, n = noise3(i * 0.5, j * 0.5, 1); const c = ring < 0.18 ? [88, 62, 38] : [168, 128, 84]; put(o, c, 0.85 + n * 0.25 - ring * 0.12); }, { wrap: true });
    const trunk = new M3.Tube(14, 12, u => 7.5 - u * 3, 0, true); trunk.setPath([[-2, -58, 0], [6, -14, 0], [10, 28, 0]]); k.own.push(trunk);
    k.mesh(trunk, tmat(k, '#fff', { rough: 0.9 }, rt, rt, 1), k.root);
    k.sphere([5.5, 4.5, 5.5], k.mat('#5a4228', { rough: 1 }), k.root, 10, 29, 0);
    const L = 48, fr = []; const nn = 18;
    for (let i = 0; i <= nn; i++) { const u = i / nn, x = u * L, w = Math.sin(Math.min(1, u * 1.1) * Math.PI) * 9 + 0.4; fr.push([x, i % 2 ? w : w * 0.35]); }
    for (let i = nn; i >= 0; i--) { const u = i / nn, x = u * L, w = Math.sin(Math.min(1, u * 1.1) * Math.PI) * 9 + 0.4; fr.push([x, -(i % 2 ? w : w * 0.35)]); }
    const fg = xgeo('frond', fr, 0.5, 0, { bend: P => { for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); P.setXYZ(i, x, 0.5 * x - 0.017 * x * x - Math.abs(y) * 0.3 + z, y); } } });
    const fronds = [], base = k.col('body');
    for (let i = 0; i < 8; i++) {
      const p = k.group(k.root, 10, 30, 0); p.rotation.y = i / 8 * TAU + 0.2; const tilt = (i % 2 ? -0.15 : 0.1);
      const f = k.mesh(fg, k.mat(shade(base, i % 2 ? 0.8 : 0.92), { rough: 0.6, side: 'double' }), p); f.rotation.z = tilt; fronds.push(f);
    }
    const nut = k.mat('#5a3820', { rough: 0.6 });
    k.sphere(3.6, nut, k.root, 7, 25.5, 2.5); k.sphere(3.6, nut, k.root, 13, 26, 1.5); k.sphere(3.4, nut, k.root, 10, 25, -3);
    return (en, t) => { for (let i = 0; i < fronds.length; i++) fronds[i].rotation.z = (i % 2 ? -0.15 : 0.1) + Math.sin(t * 2 + en.seed + i) * 0.04; };
  };
  N['bush'] = (e, k) => {
    const r = rng(e.seed + 5), base = k.col('body');
    const spots = [[0, -2, 0, 14], [-15, -6, 2, 11], [15, -6, -2, 11], [-8, 4, 6, 11], [9, 4, -5, 11], [0, 6, -6, 10], [-20, -10, -4, 8], [20, -10, 4, 8], [4, -4, 10, 10], [-5, -4, -11, 10]];
    spots.forEach(([x, y, z, s], i) => clump(k, i % 4, vary(i % 3 ? base : shade(base, 0.82), r, 0.07), k.root, x, y, z, [s * 1.15, s * 0.85, s]));
    return null;
  };
  N['cactus'] = (e, k) => {
    const col = shade(k.col('body'), 0.78), m = k.mat(col, { rough: 0.55 });
    const rib = geo('icactrib', () => {
      const prof = []; for (let i = 0; i <= 18; i++) { const u = i / 18; const y = u < 0.85 ? u : 0.85 + Math.sin((u - 0.85) / 0.15 * Math.PI / 2) * 0.15; const r = u < 0.85 ? 1 : Math.cos((u - 0.85) / 0.15 * Math.PI / 2); prof.push(V2(Math.max(0.001, r), y)); }
      const g = new T.LatheGeometry(prof, 48), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), a = Math.atan2(x, z), f = 1 + Math.pow(Math.abs(Math.cos(a * 6)), 3) * 0.12 - 0.06; P.setX(i, x * f); P.setZ(i, z * f); }
      g.computeVertexNormals(); return g;
    });
    const col1 = k.mesh(rib, m, k.root, 0, -30, 0); col1.scale.set(7.5, 60, 7.5);
    const ribT = pixTex('cactrib', 64, 8, (u, v, o) => { const s = Math.pow(Math.abs(Math.cos(u * Math.PI * 8)), 3); o[0] = o[1] = o[2] = 90 + s * 150; }, { linear: true });
    const am = tmat(k, col, { rough: 0.55 }, null, ribT, 1.5);
    const arm = (pts, r) => { k.tube(pts, r, r * 0.92, am, k.root, 14, 16); const e2 = pts[pts.length - 1]; k.sphere([r * 0.92, r * 0.8, r * 0.92], am, k.root, e2[0], e2[1], e2[2]); };
    arm([[-4, -2, 0], [-13, -2, 0], [-18, 3, 0], [-18.5, 16, 0]], 4.2);
    arm([[4, 6, 0], [13, 6, 0], [17.5, 11, 0], [18, 24, 0]], 3.8);
    const list = [], r = rng(e.seed);
    for (let row = 0; row < 12; row++) for (let j = 0; j < 12; j++) { const a = j / 12 * TAU + (row % 2) * 0.26, y = -26 + row * 4.6, rr = 8.3; list.push({ p: [Math.sin(a) * rr, y, Math.cos(a) * rr], n: [Math.sin(a), 0.3 + r() * 0.4, Math.cos(a)], s: [0.3, 2.4, 0.3] }); }
    inst(k, geo('ispine', () => new T.ConeGeometry(1, 1, 4)), k.mat('#f2ecd8', { rough: 0.6 }), list);
    const fl = k.mat('#e84393', { rough: 0.5 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const p = k.sphere([1.6, 0.6, 2.8], fl, k.root, Math.sin(a) * 2, 31, Math.cos(a) * 2); p.rotation.y = a; p.rotation.x = 0.5; }
    k.sphere(1.2, k.mat('#f6d13b'), k.root, 0, 31.4, 0);
    return null;
  };
  N['log'] = (e, k) => {
    const bark = tmat(k, '#fff', { rough: 0.95 }, barkTex('#6b4a2b'), barkTex('#6b4a2b'), 1.4);
    const rings = pixTex('rings', 128, 128, (u, v, o) => { const d = Math.hypot(u - 0.5, v - 0.5) * 2, w = d + noise3(u * 6, v * 6, 2) * 0.08; const ring = Math.pow(Math.abs(Math.sin(w * 40)), 4); if (d > 0.9) { o[0] = 90; o[1] = 60; o[2] = 36; } else { o[0] = 214 - ring * 50 - d * 20; o[1] = 172 - ring * 50 - d * 20; o[2] = 118 - ring * 40 - d * 10; } });
    const ends = tmat(k, '#fff', { rough: 0.8 }, rings);
    const lg = k.cyl(11, 11, 40, bark, k.root, 0, 0, 0, 24); lg.rotation.z = Math.PI / 2; lg.material = [bark, ends, ends];
    const stub = k.cyl(2.2, 3, 5, bark, k.root, -6, 11.5, 2, 10); stub.rotation.z = 0.35; stub.material = [bark, ends, ends];
    k.sphere([7, 1.4, 5], k.mat('#5f8a3a', { rough: 1 }), k.root, 8, 10.4, -1);
    return null;
  };
  N['leaf'] = (e, k) => {
    const col = k.col('body');
    const pts = [[0, -13], [5.5, -6], [7, 1], [4.5, 8], [0, 13], [-4.5, 8], [-7, 1], [-5.5, -6]];
    const lg = xgeo('leafitem', pts, 0.7, 0.25, { smooth: 40, uv: [-7, -13, 14, 26], bend: P => { for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, P.getZ(i) - x * x * 0.05 + (y / 13) * (y / 13) * 1.6); } } });
    const vt = pixTex('leafv:' + col, 64, 128, (u, v, o, i, j) => {
      const c = rgbOf(col), mid = Math.abs(u - 0.5), side = Math.abs(((v * 6 - mid * 3) % 1) - 0.5);
      put(o, c, (0.9 + noise3(i * 0.3, j * 0.3, 1) * 0.14) * (mid < 0.02 ? 1.25 : side < 0.05 ? 1.12 : 1));
    });
    k.mesh(lg, tmat(k, '#fff', { rough: 0.5, side: 'double' }, vt), k.root);
    k.tube([[0, -16, 0.6], [0, -12, 0.3], [0, -6, 0]], 0.5, 0.35, k.mat(shade(col, 0.75), { rough: 0.6 }), k.root, 4, 5);
    return null;
  };
  N['feather'] = (e, k) => {
    const col = k.col('body');
    const vane = [[4, 17], [7.5, 11], [8, 2], [5, -9], [2, -12], [-3, -6], [-5.8, 4], [-2.5, 12]];
    const ft = pixTex('barbs:' + col, 64, 128, (u, v, o, i, j) => { const c = rgbOf(col), b = Math.abs(((v * 30 + Math.abs(u - 0.45) * 6) % 1) - 0.5); put(o, c, 0.84 + b * 0.3 + noise3(i * 0.5, j * 0.2, 1) * 0.06); });
    const g = xgeo('feather', vane, 0.4, 0.1, { smooth: 40, uv: [-6, -12, 14, 29], bend: P => { for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, P.getZ(i) + Math.sin(y / 12) * 2 - (x - 1.5) * (x - 1.5) * 0.04); } } });
    k.mesh(g, tmat(k, '#fff', { rough: 0.95, side: 'double', opacity: 0.97 }, ft), k.root);
    k.tube([[0, -17, 0.4], [1.4, -6, 0.2], [2.4, 4, 1], [4, 17, 1.8]], 0.55, 0.15, k.mat(shade(col, 0.9), { rough: 0.5 }), k.root, 12, 6);
    for (const [y, x] of [[-12, 0.6], [-10, -1.2], [-11, 2.2]]) k.sphere([1.6, 2.4, 0.6], k.mat(col, { rough: 1, opacity: 0.7 }), k.root, x, y, 0.4);
    return null;
  };

  // ======================================================================
  // ---------- snow and ice ----------
  // ======================================================================
  const snowTex = pixTex('snowb', 64, 64, (u, v, o, i, j) => { o[0] = o[1] = o[2] = 110 + noise3(i * 0.6, j * 0.6, 3) * 140; }, { linear: true, wrap: true });
  const snowMat = (k, col) => tmat(k, col || '#f6f9ff', { rough: 0.92, glow: '#c8d8ff', glowK: 0.08 }, null, snowTex, 0.4);
  N['snowball'] = (e, k) => {
    const b = k.mesh(lumpG('snowball', 0.09, 2.2, false), snowMat(k, k.col('body')), k.root); b.scale.setScalar(11);
    return (en) => { const m = melt(en); b.scale.set(11 * (1 - m * 0.3), 11 * (1 - m * 0.5), 11 * (1 - m * 0.3)); b.position.y = -m * 5.5 * 0.9; };
  };
  N['ice'] = (e, k) => {
    const col = k.col('body'), g = k.group(k.root);
    rbox(k, 30, 30, 30, k.mat(col, { rough: 0.06, metal: 0.15, opacity: 0.62, glow: '#9fdcff', glowK: 0.12 }), g, 0, 0, 0, 3.2);
    rbox(k, 20, 20, 20, k.mat('#ffffff', { rough: 0.6, opacity: 0.38 }), g, 0, 0, 0, 4);
    const crack = k.mat('#ffffff', { rough: 0.3, opacity: 0.55, side: 'double' });
    for (const [x, y, rz, ry, l] of [[-6, 6, 0.8, 0.3, 16], [6, -6, 0.8, -0.4, 14], [-6, -6, -0.5, 1, 9]]) { const c = k.box(l, 0.15, 8, crack, g, x, y, 2); c.rotation.set(0.2, ry, rz); }
    return (en) => { const m = melt(en); g.scale.set(1 - m * 0.2, 1 - m * 0.45, 1 - m * 0.2); g.position.y = -m * 15 * 0.45; };
  };

  // ======================================================================
  // ---------- sky and weather ----------
  // ======================================================================
  function puffs(k, par, list, mat) { return list.map(([x, y, z, r, sy]) => k.sphere([r * 1.15, r * (sy || 0.92), r], mat, par, x, y, z)); }
  N['cloud'] = (e, k) => {
    const g = k.group(k.root), m = k.mat(k.col('body'), { rough: 1, glow: '#ffffff', glowK: 0.28 });
    const p = puffs(k, g, [[-22, -4, 0, 12, 0.75], [22, -4, 0, 12, 0.75], [0, -5, 2, 15, 0.7], [-11, 4, 2, 13], [11, 5, -2, 13], [1, 9, 0, 12], [-27, -6, -2, 8], [28, -7, 3, 8], [0, -2, -9, 12], [6, 0, 9, 11]], m);
    return (en, t) => { for (let i = 0; i < p.length; i++) p[i].position.y += Math.sin(t * 0.8 + i * 1.7 + en.seed) * 0.02; };
  };
  N['rain cloud'] = (e, k) => {
    const col = (k.def.seq && k.def.seq[0]) || k.col('body');
    const g = k.group(k.root), m = k.mat(shade(col, 0.8), { rough: 1, glow: '#30363e', glowK: 0.15 }), m2 = k.mat(shade(col, 0.55), { rough: 1 });
    puffs(k, g, [[-24, -2, 0, 12, 0.75], [24, -2, 0, 12, 0.75], [-12, 6, 2, 13], [12, 7, -2, 13], [1, 11, 0, 13], [0, 0, -9, 12], [6, 2, 9, 11], [-29, -3, -2, 8], [30, -4, 3, 8]], m);
    k.sphere([33, 5.5, 13], m2, g, 0, -6, 0);
    const dm = k.mat('#8fb8e8', { rough: 0.2, opacity: 0.75, glow: '#5a8ac0', glowK: 0.3 }), drops = [], r = rng(e.seed);
    for (let i = 0; i < 14; i++) { const d = k.cyl(0.6, 0.6, 7, dm, g, (r() - 0.5) * 56, -10, (r() - 0.5) * 18, 5); d.castShadow = false; d.rotation.z = 0.12; d.userData.o = r(); drops.push(d); }
    return (en, t) => { for (const d of drops) { const u = (t * 1.6 + d.userData.o) % 1; d.position.y = -12 - u * 38; d.visible = u < 0.95; } };
  };
  N['sun'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body'), c = rgbOf(col);
    const gt = sphereTex('sun:' + c, 256, 128, (x, y, z, o) => { const n = fbm(x * 9, y * 9, z * 9, 3); lerpC(o, [255, 150 + n * 40, 20], [c[0], c[1], c[2] * 0.4], n); });
    k.sphere(21, tmat(k, '#ffc850', { rough: 0.8, glow: '#ffa62a', glowK: 0.95, glowMap: gt }, gt), g);
    const h1 = noShadow(k.sphere(26, addMat(k, '#ff9a1a', 0.32, 'h1'), g)); h1.material.side = T.BackSide;
    const h2 = k.sphere(32, addMat(k, '#ff7a0a', 0.14, 'h2'), g); h2.material.side = T.BackSide; noShadow(h2);
    const rays = k.group(g), rm = k.mat('#ffd23f', { glow: '#ffb01a', glowK: 1.1, rough: 0.6 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, p = k.group(rays); p.rotation.z = a; const cn = k.cone(3, 9, rm, p, 0, 27.5, 0, 8); cn.scale.z = 0.55; noShadow(cn); }
    const lid = '#f2a51a';
    for (const s of [-1, 1]) k.eye(2.7, g, s * 7, 4, surf(21, 7, 4) - 0.6, { dir: [s * 0.15, 0.05, 1], lid: false, iris: '#4a2a10' });
    const mu = mouth(k, g, 0, -6.5, surf(21, 0, 6.5) + 0.2, 10, '#8a3a10');
    const look = facer(g, 0.2);
    return (en, t) => { look(en); mu(en); rays.rotation.z = t * 0.25; const p = 1 + Math.sin(t * 5) * 0.06; rays.scale.set(p, p, 1); };
  };
  N['moon'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body'), c = rgbOf(col);
    const outer = []; for (let i = 0; i <= 28; i++) { const a = 0.92 + i * (4.0 / 28); outer.push([Math.cos(a) * 22.5, -Math.sin(a) * 22.5]); }
    for (let i = 28; i >= 0; i--) { const a = 1.85 + i * (2.3 / 28); outer.push([11 + Math.cos(a) * 18.5, 5.5 - Math.sin(a) * 18.5]); }
    const tx = pixTex('moonc:' + c, 128, 128, (u, v, o, i, j) => {
      let f = 0.88 + fbm(u * 5, v * 5, 1, 4) * 0.2;
      for (const [cx, cy, r] of [[0.25, 0.6, 0.07], [0.32, 0.28, 0.05], [0.2, 0.4, 0.035], [0.42, 0.15, 0.04], [0.15, 0.72, 0.03], [0.38, 0.82, 0.05]]) { const d = Math.hypot(u - cx, v - cy) / r; if (d < 1) f *= 0.86 + d * 0.1; else if (d < 1.25) f *= 1.06; }
      put(o, c, f);
    });
    xmesh(k, 'moon', outer, 16, 6.5, tmat(k, '#fff', { rough: 0.9, glow: shade(col, 0.6), glowK: 0.25 }, tx, tx, 0.6), g, 0, 0, 0, { smooth: 0, uv: [-25, -25, 50, 50], seg: 5, bs: 4.5, crease: 1.2 });
    for (const [x, y] of [[-12, 4], [-6, -1]]) k.eye(2.2, g, x, y, 8.4, { dir: [0.1, 0, 1], lid: false, iris: '#3a3a5a' });
    const mu = mouth(k, g, -11, -8.5, 8.2, 7, '#7a6a3a');
    const look = facer(g, 0.15);
    return (en, t) => { look(en); mu(en); g.rotation.z = Math.sin(t * 0.6 + en.seed) * 0.05; };
  };
  N['star'] = (e, k) => {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5.6 : 13; pts.push([Math.cos(a) * r, -Math.sin(a) * r]); }
    const m = k.mat(k.col('body'), { rough: 0.28, metal: 0.55, glow: '#ffc93a', glowK: 0.35 });
    const s = xmesh(k, 'star', pts, 7, 3, m, k.root, 0, 0, 0, { seg: 4, bs: 1.6, crease: 1.1 });
    return (en, t) => { s.rotation.y = Math.sin(t * 1.4 + en.seed) * 0.5; if (!(en._m3 && en._m3.fx)) m.emissiveIntensity = 0.3 + Math.max(0, Math.sin(t * 3 + en.seed)) * 0.4; };
  };
  N['heart'] = (e, k) => {
    const pts = []; for (let i = 0; i < 40; i++) { const t = i / 40 * TAU, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); pts.push([x * 0.78, y * 0.78 + 1]); }
    const s = xmesh(k, 'heart', pts, 10, 4.2, k.mat(k.col('body'), { rough: 0.22, glow: shade(k.col('body'), 0.4), glowK: 0.3 }), k.root, 0, 0, 0, { seg: 5, bs: 3, crease: 1.2 });
    return (en, t) => { const b = Math.pow(Math.max(0, Math.sin(t * 6 + en.seed)), 8) * 0.08; s.scale.set(1 + b, 1 + b, 1 + b); s.rotation.y = Math.sin(t * 0.9) * 0.3; };
  };
  N['rainbow'] = (e, k) => {
    const g = k.group(k.root), cols = ['#e63946', '#f4862c', '#f6d13b', '#4caf50', '#3d7ee8', '#3f4fb5', '#8e44ad'];
    cols.forEach((c, i) => { const R = 65.5 - i * 4.6; k.mesh(geo('irain' + i, () => new T.TorusGeometry(R, 2.5, 8, 72, Math.PI)), k.mat(c, { rough: 0.6, glow: c, glowK: 0.55, opacity: 0.88 }), g, 0, -34, 0).castShadow = false; });
    const cm = k.mat('#ffffff', { rough: 1, glow: '#ffffff', glowK: 0.3 });
    for (const s of [-1, 1]) puffs(k, g, [[s * 50, -32, 4, 9, 0.8], [s * 62, -31, 2, 8, 0.8], [s * 40, -33, 3, 6, 0.8], [s * 55, -25, 0, 7], [s * 51, -32, -6, 7]], cm);
    const look = facer(g, 0);
    return (en) => look(en);
  };
  N['lightning'] = (e, k) => {
    const pts = [[-4, 30], [8, 30], [0, 6], [10, 6], [-8, -30], [-2, -2], [-12, -2]];
    const core = k.mat('#fff4a0', { glow: '#ffd23a', glowK: 1.1, rough: 0.5 });
    const b = xmesh(k, 'bolt', pts, 4, 1.2, core, k.root, 0, 0, 0, { crease: 0.6 });
    const halo = noShadow(xmesh(k, 'bolt', pts, 4, 1.2, addMat(k, '#ffc830', 0.4, 'bh'), k.root));
    halo.scale.set(1.25, 1.12, 2.5);
    const halo2 = noShadow(xmesh(k, 'bolt', pts, 4, 1.2, addMat(k, '#9a7aff', 0.2, 'bh2'), k.root)); halo2.scale.set(1.6, 1.25, 4);
    return (en, t) => { const f = Math.random(); halo.visible = f > 0.15; halo2.material.opacity = 0.12 + f * 0.2; if (!(en._m3 && en._m3.fx)) core.emissiveIntensity = 0.9 + f * 0.8; };
  };
  // a teardrop flame (unit: base radius 1, height ~2.2)
  const flameGeo = () => latheG('flame', sprof([[0, 0], [0.8, 0.18], [1, 0.55], [0.82, 1.05], [0.45, 1.6], [0, 2.3]], 20), 16);
  function flames(k, par, list) {   // list: [x, y, z, r]; returns update(t, seed)
    const fl = flameGeo(), o = k.mat('#ff5a0a', { basic: true, opacity: 0.6, tag: 'fo' }), m = addMat(k, '#ff8a1a', 0.45, 'fm'), c = addMat(k, '#ffd870', 0.4, 'fc');
    o.depthWrite = false; o.userData.base.opacity = 0.6;
    const parts = list.map(([x, y, z, r], i) => {
      const p = k.group(par, x, y, z); const a = k.mesh(fl, o, p), b = k.mesh(fl, m, p, 0, 0.1 * r, 0.2), cc = k.mesh(fl, c, p, 0, 0.05 * r, 0.4);
      noShadow(p); return { p, a, b, cc, r, i };
    });
    return (t, seed) => {
      for (const q of parts) {
        const f = 1 + Math.sin(t * 14 + seed + q.i * 2.1) * 0.16 + Math.sin(t * 23 + q.i) * 0.07, g2 = 1 + Math.sin(t * 11 + seed * 2 + q.i) * 0.18, r = q.r;
        q.a.scale.set(r * 0.95, r * f * 0.95, r * 0.8); q.b.scale.set(r * 0.65, r * g2 * 0.7, r * 0.55); q.cc.scale.set(r * 0.35, r * f * 0.4, r * 0.3);
        q.p.rotation.z = Math.sin(t * 7 + q.i * 1.3 + seed) * 0.12; q.p.rotation.y = t * 0.5 + q.i;
      }
    };
  }
  N['fire'] = (e, k) => {
    const charM = tmat(k, '#fff', { rough: 0.95 }, barkTex('#4a3020')), emb = k.mat('#2a1a10', { glow: '#ff4a0a', glowK: 0.6, rough: 1 });
    const l1 = k.cyl(3, 3, 36, charM, k.root, 0, -18, 3, 10); l1.rotation.set(0, 0.45, Math.PI / 2 + 0.06);
    const l2 = k.cyl(3, 3, 34, charM, k.root, 0, -17, -3, 10); l2.rotation.set(0, -0.45, Math.PI / 2 - 0.08);
    k.sphere([8, 1.6, 6], emb, k.root, 0, -20.2, 0);
    const stone = k.mat('#8c8c8c', { rough: 0.9, flat: true });
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; k.mesh(lumpG('rock', 0.25, 1.2, true, 1), stone, k.root, Math.cos(a) * 17, -20, Math.sin(a) * 9).scale.set(4, 2.6, 3.2); }
    const up = flames(k, k.root, [[0, -18, 0, 15], [-9, -18, 2, 10], [9, -18, -1, 9], [-3, -18, -4, 10], [4, -18, 4, 8]]);
    const sparks = [], sm2 = addMat(k, '#ffd060', 0.6, 'sp');
    for (let i = 0; i < 5; i++) { const s = noShadow(k.sphere(0.7, sm2, k.root)); s.userData.o = i / 5; sparks.push(s); }
    return (en, t) => {
      up(t, en.seed);
      for (let i = 0; i < 5; i++) { const s = sparks[i], u = (t * 0.7 + s.userData.o) % 1; s.position.set(Math.sin(i * 2.3 + t * 2) * 6 * u + (i - 2) * 3, -10 + u * 40, Math.cos(i * 1.7) * 5); s.scale.setScalar(0.9 * (1 - u)); }
    };
  };
  const TWIST = {};   // the two swirling layers of every tornado share two scrolling textures
  N['tornado'] = (e, k) => {
    const g = k.group(k.root), col = rgbOf(k.col('body'));
    const st2 = TWIST[col] || (TWIST[col] = {});
    const st = pixTex('twister:' + col, 128, 128, (u, v, o, i, j) => { const s = fbm(u * 8 + v * 5, v * 30, 1, 3); put(o, col, 0.65 + s * 0.5); o[3] = clamp(120 + (s - 0.4) * 400, 30, 255); }, { wrap: true });
    const prof = []; for (let i = 0; i <= 24; i++) { const u = i / 24; prof.push([2.5 + 31 * Math.pow(u, 1.7) + Math.sin(u * 20) * 0.8, -60 + u * 118]); }
    const mk = (key, s) => {
      const gg = new T.LatheGeometry(prof.map(p => V2(p[0] * s, p[1])), 28); k.own.push(gg);
      const base = Float32Array.from(gg.attributes.position.array);
      const mt = k.mat(s < 1 ? '#c8ccd2' : '#ffffff', { rough: 1, opacity: s < 1 ? 0.92 : 0.78, side: 'double', tag: key });
      mt.map = st2[key]; mt.depthWrite = false;
      const me = k.mesh(gg, mt, g); me.castShadow = s < 1; return { gg, base, me, mt };
    };
    for (const key of ['to', 'ti']) if (!st2[key]) { st2[key] = st.clone(); st2[key].repeat.set(2, 1); st2[key].needsUpdate = true; }
    const outer = mk('to', 1), inner = mk('ti', 0.72);
    const dm = k.mat('#8b6a45', { rough: 1, flat: true }), dm2 = k.mat('#6b8a3a', { rough: 1, flat: true }), debris = [];
    for (let i = 0; i < 7; i++) { const d = k.mesh(geo('icobit', () => new T.IcosahedronGeometry(1, 0)), i % 2 ? dm : dm2, g); d.scale.setScalar(1.4 + (i % 3)); d.userData.o = i; debris.push(d); }
    const dust = k.mat('#b8ad98', { rough: 1, opacity: 0.55 }), dusts = [];
    for (let i = 0; i < 4; i++) { const d = k.sphere([10, 5, 8], dust, g, (i - 1.5) * 8, -57, (i % 2 - 0.5) * 8); d.castShadow = false; dusts.push(d); }
    let tick = 0;
    return (en, t) => {
      outer.mt.map.offset.x = (t * 0.9) % 1; inner.mt.map.offset.x = (t * 1.6) % 1; outer.mt.map.offset.y = (t * 0.3) % 1;
      if ((tick++ & 1) === 0) for (const L of [outer, inner]) {
        const P = L.gg.attributes.position.array, B = L.base;
        for (let i = 0; i < P.length; i += 3) { const y = B[i + 1], u = (y + 60) / 118; P[i] = B[i] + Math.sin(t * 3.2 + u * 4 + en.seed) * 7 * u * u + Math.sin(t * 7 + u * 9) * 1.5; P[i + 2] = B[i + 2] + Math.cos(t * 2.6 + u * 3) * 3 * u; }
        L.gg.attributes.position.needsUpdate = true;
      }
      for (const d of debris) { const o = d.userData.o, a = t * (4 + o * 0.3) + o * 1.9, h = -50 + ((o * 13 + t * 12) % 80), R = 6 + (h + 60) * 0.25; d.position.set(Math.cos(a) * R, h, Math.sin(a) * R); d.rotation.set(t * 5 + o, t * 4, o); }
      for (let i = 0; i < 4; i++) { const s = 1 + Math.sin(t * 4 + i * 1.6) * 0.15; dusts[i].scale.set(10 * s, 5 * s, 8 * s); }
    };
  };
  N['black hole'] = (e, k) => {
    const g = k.group(k.root);
    k.sphere(12, k.mat('#000000', { basic: true }), g);
    const disc = pixTex('accretion', 256, 256, (u, v, o) => {
      const x = u * 2 - 1, y = v * 2 - 1, r = Math.hypot(x, y), a = Math.atan2(y, x);
      const rr = (r - 0.44) / 0.56; if (rr < 0 || rr > 1) { o[0] = o[1] = o[2] = 0; return; }
      const sw = 0.55 + 0.45 * Math.sin(a * 3 + Math.log(r) * 14) * (0.6 + noise3(Math.cos(a) * 4, Math.sin(a) * 4, r * 8) * 0.8);
      const heat = Math.pow(1 - rr, 1.6), f = sw * Math.pow(Math.sin(rr * Math.PI), 0.6) * (0.35 + heat);
      o[0] = 255 * Math.min(1, f * 1.6); o[1] = 255 * Math.min(1, f * (0.5 + heat * 0.9)); o[2] = 255 * Math.min(1, f * heat * 0.8);
    });
    const tilt = k.group(g); tilt.rotation.x = -1.2;
    const dm = addMat(k, '#ffffff', 0.6, 'disc'); dm.map = disc; dm.side = T.DoubleSide; dm.needsUpdate = true;
    const d1 = noShadow(k.mesh(geo('iaccr', () => new T.RingGeometry(12.5, 32, 64, 1)), dm, tilt));
    const halo = k.group(g);
    const hm = addMat(k, '#ffffff', 0.55, 'halo'); hm.map = disc; hm.needsUpdate = true;
    const d2 = noShadow(k.mesh(geo('ihalo', () => new T.RingGeometry(12.2, 21, 64, 1)), hm, halo));
    noShadow(k.mesh(geo('iphoton', () => new T.TorusGeometry(12.6, 0.55, 8, 48)), addMat(k, '#ffcf7a', 0.6, 'ph'), g));
    const look = facer(g, 0);
    return (en, t) => { look(en); d1.rotation.z = -t * 1.6; d2.rotation.z = t * 0.9; };
  };
  N['planet'] = (e, k) => {
    const g = k.group(k.root), c = rgbOf(k.col('body'));
    const tx = sphereTex('planet:' + c, 512, 256, (x, y, z, o) => {
      const land = fbm(x * 2.2 + 5, y * 2.2, z * 2.2, 5), cl = fbm(x * 4 + 11, y * 7, z * 4, 4);
      if (land > 0.56) { const h = (land - 0.56) * 4; lerpC(o, [76, 140, 60], [150, 120, 70], clamp(h * 1.4, 0, 1)); } else put(o, c, 0.7 + land * 0.4);
      if (Math.abs(y) > 0.88) { o[0] = o[1] = o[2] = 240; }
      if (cl > 0.62) lerpC(o, [o[0], o[1], o[2]], [250, 250, 252], clamp((cl - 0.62) * 5, 0, 0.9));
    });
    const ball = k.sphere(24, tmat(k, '#fff', { rough: 0.7 }, tx), g);
    const atm = noShadow(k.sphere(25.6, addMat(k, '#8fc6ff', 0.3, 'atm'), g)); atm.material.side = T.BackSide;
    const rt = pixTex('rings', 256, 4, (u, v, o) => { const b = 0.5 + 0.5 * Math.sin(u * 60) * Math.sin(u * 17 + 1); o[0] = 220 * b + 20; o[1] = 196 * b + 20; o[2] = 150 * b + 20; o[3] = clamp((0.45 + b * 0.55) * 255 * Math.pow(Math.sin(u * Math.PI), 0.4), 0, 255); });
    const ringG = geo('iplring', () => { const r = new T.RingGeometry(29, 41, 72, 1), P = r.attributes.position, U = r.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, (Math.hypot(P.getX(i), P.getY(i)) - 29) / 12, 0.5); return r; });
    const rm = k.mat('#ffffff', { rough: 0.6, opacity: 0.95, side: 'double', tag: 'ring', glow: '#3a3020', glowK: 0.5 }); rm.map = rt; rm.needsUpdate = true;
    const tilt = k.group(g); tilt.rotation.set(-1.18, 0, 0.3);
    k.mesh(ringG, rm, tilt);
    return (en, t, dt) => { ball.rotation.y += (dt || 0.016) * 0.25; };
  };
  N['meteor'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body');
    const rock = k.mesh(lumpG('meteor', 0.3, 1.4, true, 2), k.mat(shade(col, 0.7), { rough: 0.95, flat: true, glow: '#ff2a00', glowK: 0.08 }), g); rock.scale.set(15, 13, 13);
    const crater = k.mat(shade(col, 0.7), { rough: 1 });
    for (const [x, y, z, r] of [[3, 2, 12, 3.4], [-6, -3, 11, 2.4], [8, -6, 9, 2]]) k.sphere([r, r, r * 0.4], crater, g, x, y, z).lookAt(x * 3, y * 3, z * 3);
    const trail = k.group(g);
    const up = flames(k, trail, [[0, 0, 0, 12], [0, 0, 3, 9], [0, 0, -3, 9]]);
    const glow = noShadow(k.sphere(17, addMat(k, '#ff3a0a', 0.25, 'mg'), g)); glow.material.side = T.BackSide;
    return (en, t) => {
      up(t, en.seed);
      const f = en.facing || 1, vx = (en.vx || 0) * f, vy = en.vy || 0, sp = Math.hypot(vx, vy);
      const a = sp > 5 ? Math.atan2(vy, -vx) : Math.PI / 2 - 0.6;   // the tail streams away from where it flies (model y is up)
      trail.rotation.z = a - Math.PI / 2; trail.scale.set(1, 1.6 + Math.min(1.4, sp / 400), 1);
      rock.rotation.x += 0.03; rock.rotation.y += 0.05;
    };
  };

  // ======================================================================
  // ---------- odd things ----------
  // ======================================================================
  N['poop'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body');
    const pt = crumb('poop', col, 0.62), m = tmat(k, '#fff', { rough: 0.36 }, pt, pt, 0.8);
    // three soft coils stacked smaller and smaller, with a curled tip
    k.mesh(geo('ipoop1', () => new T.TorusGeometry(8, 5.4, 14, 32)), m, g, 0, -7.4, 0).rotation.x = Math.PI / 2;
    k.sphere([8.5, 4.6, 8.5], m, g, 0, -7, 0);
    const t2 = k.mesh(geo('ipoop2', () => new T.TorusGeometry(4.8, 4.3, 14, 28)), m, g, 0.5, 0.4, -0.4); t2.rotation.x = Math.PI / 2 - 0.08;
    k.sphere([5, 4, 5], m, g, 0.5, 0.6, -0.4);
    k.sphere([3.6, 3.3, 3.6], m, g, 0.8, 6.4, -0.6);
    k.tube([[0.8, 7.4, -0.6], [1.6, 10.4, -0.4], [3.6, 12, 0]], 2.8, 0.5, m, g, 8, 10);
    for (const s of [-1, 1]) k.eye(1.8, g, s * 4, 1.2, 8.1, { dir: [s * 0.15, 0.1, 1], lid: false, iris: '#2a1a0a' });
    const mu = mouth(k, g, 0, -4.6, 12.4, 6, '#2a1208');
    const fly = [], fm = k.mat('#151515', { rough: 0.4 }), wm = k.mat('#e8f0f8', { opacity: 0.5, rough: 0.3 });
    for (let i = 0; i < 2; i++) { const f = k.group(k.root); k.sphere([0.9, 0.7, 0.7], fm, f); k.sphere([0.9, 0.2, 0.5], wm, f, -0.2, 0.7, 0.5); k.sphere([0.9, 0.2, 0.5], wm, f, -0.2, 0.7, -0.5); fly.push(f); }
    const look = facer(g, 0.3);
    return (en, t) => { look(en); mu(en); for (let i = 0; i < 2; i++) { const a = t * (3 + i) + i * 3; fly[i].position.set(Math.cos(a) * 14, 16 + Math.sin(t * 7 + i) * 3, Math.sin(a) * 10); fly[i].rotation.y = -a; } };
  };
  N['skull'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body');
    const bt = crumb('bone', col, 0.9), m = tmat(k, '#fff', { rough: 0.6 }, bt, bt, 0.3), dark = k.mat('#120a06', { rough: 1 });
    k.sphere([11.6, 11.4, 12.6], m, g, 0, 3.6, -1);                       // cranium
    k.sphere([4.6, 3.4, 4], m, g, -6.5, -2.6, 5.4); k.sphere([4.6, 3.4, 4], m, g, 6.5, -2.6, 5.4);  // cheekbones
    rbox(k, 13, 7, 11, m, g, 0, -5.6, 4, 3);                                // upper jaw
    for (const s of [-1, 1]) { const so = k.sphere([3.5, 3.6, 2.4], dark, g, s * 4.8, 1.2, 9.6); so.rotation.z = s * 0.3; }
    k.mesh(xgeo('skullnose', [[0, -3], [1.8, 0.4], [0.4, 1.4], [0, 0.8], [-0.4, 1.4], [-1.8, 0.4]], 2, 0.3, {}), dark, g, 0, -2.4, 10.6);
    const jaw = k.group(g, 0, -6, 0); rbox(k, 12, 4.4, 9.6, m, jaw, 0, -4.6, 4.2, 1.8);
    const tm = k.mat(shade(col, 1.05), { rough: 0.4 });
    for (let i = -3; i <= 3; i++) { rbox(k, 1.5, 2.4, 1.4, tm, g, i * 1.65, -8.8, 9.3 - Math.abs(i) * 0.35, 0.4); rbox(k, 1.5, 2.2, 1.4, tm, jaw, i * 1.65, -1.9, 8.6 - Math.abs(i) * 0.35, 0.4); }
    const look = facer(g, 0.35);
    return (en, t) => { look(en); jaw.rotation.x = en.mood === 'angry' || en.held ? Math.max(0, Math.sin(t * 12)) * 0.25 : 0.03; };
  };

  // ======================================================================
  // ---------- creatures: scarab, ghost, snowman ----------
  // ======================================================================
  N['scarab'] = (e, k) => {
    const col = k.col('body'), m = k.mat(col, { rough: 0.2, metal: 0.45 }), dark = k.mat(shade(col, 0.45), { rough: 0.3, metal: 0.4 }), legM = k.mat(shade(col, 0.35), { rough: 0.4, metal: 0.3 });
    const body = k.group(k.root, 0, 0, 0);
    for (const s of [-1, 1]) { const el = k.sphere([10, 6.4, 4.4], m, body, -2.5, 0.6, s * 3.8); el.rotation.x = s * 0.22; }
    k.sphere([4.6, 4.6, 7.6], m, body, 6.6, 0.6, 0);                       // pronotum
    k.sphere([3.4, 2.4, 5.6], dark, body, 11, -0.6, 0);                     // head shield
    for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.5, c = k.cone(0.9, 2.6, dark, body, 13.8 + Math.cos(a) * 0.8, -0.8, Math.sin(a) * 4.4, 4); c.rotation.z = -Math.PI / 2; c.rotation.y = -a * 0.7; }
    for (const s of [-1, 1]) { k.eye(0.9, body, 11.6, 0.6, s * 3.6, { dir: [0.6, 0.2, s], white: '#0c0c0c', iris: '#000', lid: shade(col, 0.5) }); const an = k.tube([[11.5, 0.8, s * 2.4], [14, 2.6, s * 3.6], [15.6, 2.8, s * 4]], 0.3, 0.25, legM, body, 5, 4); k.sphere([0.9, 0.6, 0.6], legM, body, 15.8, 2.8, s * 4.1); }
    const legs = [];
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const fem = k.limb(5, 0.9, 0.7, legM, body, 4 - i * 5.2, -2.2, s * 3.8); fem.rotation.x = -s * 1.1;
      const tib = k.limb(6.2, 0.7, 0.5, legM, fem.limb ? fem : fem, 0, -5, 0); tib.rotation.x = s * 0.85;
      legs.push({ fem, tib, s, i });
    }
    return (en) => {
      const walking = en.moving && en.grounded, ph = en.phase || 0;
      for (const L of legs) { const a = walking ? Math.sin(ph + L.i * 2 + (L.s > 0 ? 0 : Math.PI)) : 0; L.fem.rotation.z = (L.i - 1) * 0.45 + a * 0.5; L.fem.rotation.x = -L.s * (1.1 + (walking ? Math.max(0, -Math.cos(ph + L.i * 2)) * 0.2 : 0)); }
      body.position.y = walking ? Math.abs(Math.sin(ph * 2)) * 0.4 : 0;
    };
  };
  N['ghost'] = (e, k) => {
    const g = k.group(k.root), col = k.col('body');
    const prof = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; prof.push([16 * Math.sin(a) + 0.001, 7 + 16 * Math.cos(a)]); }
    prof.reverse(); const skirt = []; for (let i = 1; i <= 10; i++) { const u = i / 10; skirt.push([16 + u * u * 2.2, 7 - u * 21]); }
    const pr = [...skirt.reverse(), ...prof.slice(0)].sort((a, b) => a[1] - b[1]);
    const gg = new T.LatheGeometry(pr.map(p => V2(p[0], p[1])), 40); k.own.push(gg);
    const base = Float32Array.from(gg.attributes.position.array);
    const m = k.mat(col, { rough: 0.6, opacity: 0.8, glow: '#cfd8ff', glowK: 0.28, side: 'double' });
    k.mesh(gg, m, g);
    const arms = [];
    for (const s of [-1, 1]) { const p = k.group(g, s * 14.5, 2, 2); k.tube([[0, 0, 0], [s * 6, -2, 1], [s * 10, 2, 1.5]], 3.2, 1.6, m, p, 8, 10); arms.push(p); }
    for (const s of [-1, 1]) { const ey = k.eye(3, g, s * 5.2, 12, 14.2, { dir: [s * 0.1, 0, 1], white: '#141420', iris: '#000', lid: false }); k.sphere(0.8, k.mat('#ffffff', { glow: '#ffffff', glowK: 0.6 }), ey, -0.9, 1, 2.6); ey.scale.z = 0.7; }
    const mu = mouth(k, g, 0, 2.5, 16.3, 8, '#1a1a26');
    const look = facer(g, 0.35); let tick = 0;
    return (en, t) => {
      look(en);
      const md = en.mood === 'happy' || en.mode === 'approach' ? 'open' : en.mood; mu({ mood: md });
      g.position.y = Math.sin(t * 3 + en.seed) * 2; g.rotation.z = clamp(-(en.vx || 0) / 900, -0.25, 0.25) * (en.facing || 1);
      for (let i = 0; i < 2; i++) arms[i].rotation.z = (i ? 1 : -1) * (Math.sin(t * 3 + en.seed + i) * 0.3 + (en.mood === 'angry' ? 0.6 : 0));
      if ((tick++ & 1) === 0) {
        const P = gg.attributes.position.array;
        for (let i = 0; i < P.length; i += 3) { const y = base[i + 1]; if (y > -1) continue; const w = (-1 - y) / 13, a = Math.atan2(base[i + 2], base[i]); const wave = Math.sin(a * 6 + t * 4) * 3 * w; P[i + 1] = y + wave + (Math.cos(a * 6 + t * 4) > 0.6 ? 0 : 0); const fl = 1 + Math.sin(a * 6 + t * 4 + 1) * 0.06 * w; P[i] = base[i] * fl; P[i + 2] = base[i + 2] * fl; }
        gg.attributes.position.needsUpdate = true;
      }
    };
  };
  N['snowman'] = (e, k) => {
    const g = k.group(k.root), body = k.group(g), sm2 = snowMat(k, k.col('body')), coal = k.mat('#1b1b1e', { rough: 0.8, flat: true });
    const ball = (r, y, v) => { const b = k.mesh(lumpG('snowman' + v, 0.04, 1.6, false), sm2, body, 0, y, 0); b.scale.setScalar(r); return b; };
    ball(17, -20, 1); ball(13, 4, 2); const head = k.group(body, 0, 25, 0); k.mesh(lumpG('snowman3', 0.035, 1.6, false), sm2, head).scale.setScalar(10);
    for (const [y, z] of [[2, 12.8], [-5, 9.6], [-12, 15]]) k.mesh(lumpG('coal', 0.25, 2, true, 1), coal, body, 0, y, z).scale.setScalar(1.6);
    for (const s of [-1, 1]) k.eye(1.6, head, s * 3.5, 2, 8.9, { dir: [s * 0.1, 0.05, 1], white: '#141414', iris: '#000', lid: false });
    for (let i = 0; i < 5; i++) { const a = 0.55 + i / 4 * (Math.PI - 1.1), x = Math.cos(a) * 5.4, y = -Math.sin(a) * 5.4 + 0.4; k.mesh(lumpG('coal', 0.25, 2, true, 1), coal, head, x, y, surf(10, x, y) - 0.2).scale.setScalar(0.85); }
    const nose = k.cone(1.5, 8, k.mat('#f4862c', { rough: 0.6 }), head, 0, 0, 12.6, 10); nose.rotation.x = Math.PI / 2;
    // top hat (palette hat colour) with a band
    const hat = k.mat(k.col('hat'), { rough: 0.5 });
    k.cyl(12, 12, 1.2, hat, head, 0, 8.6, 0, 28); k.cyl(7.4, 7.8, 11, hat, head, 0, 14.6, 0, 24); k.cyl(7.9, 7.9, 2.2, k.mat('#c0392b', { rough: 0.6 }), head, 0, 10.4, 0, 24);
    const scarf = k.mat('#c9402b', { rough: 0.9 });
    k.mesh(geo('iscarf', () => new T.TorusGeometry(8.6, 2.4, 10, 28)), scarf, body, 0, 15.6, 0).rotation.x = Math.PI / 2 - 0.1;
    const tail = rbox(k, 4.6, 11, 1.8, scarf, body, -5, 9.4, 9.6, 0.8); tail.rotation.z = -0.25; tail.rotation.x = -0.35;
    const wood = k.mat('#5a3a1e', { rough: 0.9 }), arms = [];
    for (const s of [-1, 1]) {
      const p = k.group(body, s * 11, 6, 0);
      k.tube([[0, 0, 0], [s * 8, 5, 0.5], [s * 16, 11, 0]], 0.9, 0.5, wood, p, 6, 6);
      k.tube([[s * 12.5, 8.5, 0], [s * 14.5, 13.5, 0.5]], 0.45, 0.3, wood, p, 2, 5);
      k.tube([[s * 14, 10, 0], [s * 18.5, 11, -0.5]], 0.45, 0.3, wood, p, 2, 5);
      arms.push(p);
    }
    const look = facer(g, 0.35);
    return (en, t) => {
      look(en);
      const m = melt(en); body.scale.set(1 + m * 0.25, 1 - m * 0.4, 1 + m * 0.25); body.position.y = -m * 38 * 0.4;
      for (let i = 0; i < 2; i++) arms[i].rotation.z = (i ? 1 : -1) * (en.mood === 'happy' || en.held ? Math.sin(t * 8) * 0.25 : Math.sin(t * 1.3 + en.seed + i) * 0.05);
      head.rotation.z = Math.sin(t * 0.9 + en.seed) * 0.05;
    };
  };
})();
