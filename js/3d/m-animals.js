'use strict';
// m-animals.js — 3D models for four-legged animals (quad), dinosaurs and the kangaroo (biped) and the frog.
// The 2D drawings (D.drawQuad / D.drawBiped in draw.js, D.frog in draw2.js) are the source of truth for the
// template options; here they become real anatomy: a deep ribcage and haunches lofted along the spine,
// jointed legs (hocks bend back, hooves / paws / pads), a skull with a hinged jaw, bending tails.
(function () {
  if (!SB.M3) return;
  const M3 = SB.M3, T = THREE, TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const shade = (c, k) => SB.shade(c, k), mix = (a, b, k) => SB.mixColor(a, b, k);
  const r2 = v => Math.round(v * 100) / 100;
  const rgba = (c, a) => { const q = SB.hexRGB(c); return 'rgba(' + (q[0] | 0) + ',' + (q[1] | 0) + ',' + (q[2] | 0) + ',' + a + ')'; };

  // ---------- loft: a smooth closed body along +x from cross-sections ----------
  // ctrl: [{x, c, t, b, w}] (centre height, top / bottom half-heights, half width); sampled with Catmull-Rom and
  // closed with rounded caps. uv.x goes round (0 near side, .25 top, .5 far side, .75 underneath), uv.y along.
  // o: { na, radial, cap0, cap1 (cap length factors), lump (wool / fur bumps), lumpF }
  function loftGeo(ctrl, o) {
    o = o || {};
    const key = 'loft:' + JSON.stringify(ctrl.map(s => [r2(s.x), r2(s.c), r2(s.t), r2(s.b), r2(s.w)])) + JSON.stringify(o);
    return M3.geo(key, () => {
      const NA = o.na || 20, RAD = o.radial || 18, n = ctrl.length, keys = ['x', 'c', 't', 'b', 'w'];
      const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      const S = [];
      for (let i = 0; i <= NA; i++) {
        const f = i / NA * (n - 1), s = Math.min(n - 2, Math.floor(f)), u = f - s, q = {};
        for (const kk of keys) q[kk] = cr(ctrl[Math.max(0, s - 1)][kk], ctrl[s][kk], ctrl[s + 1][kk], ctrl[Math.min(n - 1, s + 2)][kk], u);
        q.t = Math.max(0.01, q.t); q.b = Math.max(0.01, q.b); q.w = Math.max(0.01, q.w);
        S.push(q);
      }
      const capN = 6, A = S[0], B = S[S.length - 1], pre = [], post = [];
      const cl0 = (o.cap0 == null ? 0.9 : o.cap0) * Math.min((A.t + A.b) / 2, A.w), cl1 = (o.cap1 == null ? 0.9 : o.cap1) * Math.min((B.t + B.b) / 2, B.w);
      for (let i = capN; i >= 1; i--) { const th = i / capN * Math.PI / 2, cs = Math.max(0.001, Math.cos(th)); pre.push({ x: A.x - cl0 * Math.sin(th), c: A.c, t: A.t * cs, b: A.b * cs, w: A.w * cs }); }
      for (let i = 1; i <= capN; i++) { const th = i / capN * Math.PI / 2, cs = Math.max(0.001, Math.cos(th)); post.push({ x: B.x + cl1 * Math.sin(th), c: B.c, t: B.t * cs, b: B.b * cs, w: B.w * cs }); }
      const rows = pre.concat(S, post), NR = rows.length, x0 = rows[0].x, x1 = rows[NR - 1].x;
      const pos = new Float32Array(NR * (RAD + 1) * 3), uv = new Float32Array(NR * (RAD + 1) * 2), idx = [];
      const lump = o.lump || 0, lf = o.lumpF || 0.5;
      for (let i = 0; i < NR; i++) {
        const s = rows[i];
        for (let j = 0; j <= RAD; j++) {
          const a = j / RAD * TAU, ca = Math.cos(a), sa = Math.sin(a), p = (i * (RAD + 1) + j);
          let y = (sa > 0 ? s.t : s.b) * sa, z = s.w * ca;
          if (lump) { const nz = 0.5 + 0.3 * Math.sin(s.x * lf + 1.3) * Math.sin(a * 7 + s.x * 0.3) + 0.2 * Math.sin(s.x * lf * 1.7 + 2) * Math.sin(a * 11 - s.x * lf * 0.5); const f = 1 + lump * (nz - 0.5) * Math.min(1, (s.t + s.b) / 4); y *= f; z *= f; }
          pos[p * 3] = s.x; pos[p * 3 + 1] = s.c + y; pos[p * 3 + 2] = z;
          uv[p * 2] = j / RAD; uv[p * 2 + 1] = (s.x - x0) / (x1 - x0 || 1);
        }
      }
      for (let i = 0; i < NR - 1; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, b = a + RAD + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new T.BufferGeometry();
      g.setIndex(idx); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const N = g.attributes.normal;
      for (let i = 0; i < NR; i++) {   // weld the seam, point the cap tips along the axis
        const a = i * (RAD + 1), b = a + RAD;
        if (i === 0 || i === NR - 1) { for (let j = 0; j <= RAD; j++) N.setXYZ(a + j, i ? 1 : -1, 0, 0); continue; }
        const nx = N.getX(a) + N.getX(b), ny = N.getY(a) + N.getY(b), nz = N.getZ(a) + N.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
        N.setXYZ(a, nx / l, ny / l, nz / l); N.setXYZ(b, nx / l, ny / l, nz / l);
      }
      return g;
    });
  }

  // ---------- coat textures (shared between every animal of the same look) ----------
  // Plain THREE.Texture (not CanvasTexture) so dropping one entity does not dispose a texture others use.
  const TEX = new Map();
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function coatTex(key, base, paint) {
    let t = TEX.get(key); if (t) return t;
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    const rnd = rng(7 + key.length * 13);
    // fur / skin mottling so a coat is never flat plastic
    for (let i = 0; i < 900; i++) { x.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 3 + rnd() * 6); }
    paint(x, S, rnd);
    t = new T.Texture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true;
    TEX.set(key, t); return t;
  }
  // a wobbly band across the "along" axis at v, round from x=a to x=b (texture coordinates 0..1)
  function band(x, S, v, a, b, wid, rnd, col) {
    x.fillStyle = col; x.beginPath();
    const N = 14, ph = rnd() * 6, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, xx = a + (b - a) * u, taper = Math.sin(u * Math.PI) ** 0.5, w = wid * (0.35 + 0.65 * taper);
      const yy = v + Math.sin(u * 5 + ph) * 0.02;
      top.push([xx * S, (yy - w / 2) * S]); bot.push([xx * S, (yy + w / 2) * S]);
    }
    top.concat(bot.reverse()).forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.fill();
  }
  function blob(x, S, cx, cy, r, rnd, col, ax) {
    x.fillStyle = col;
    for (const ox of [-1, 0, 1]) {   // wrap round the seam
      x.beginPath();
      for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, rr = r * (0.7 + rnd() * 0.5); const px = (cx + ox + Math.cos(a) * rr * (ax || 1)) * S, py = (cy + Math.sin(a) * rr) * S; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.fill();
    }
  }
  // pattern painter for a template: stripes, spots, blotches, giraffe patches, scales, skunk stripe...
  function patternFor(name, o, base) {
    const dk = shade(base, 0.62);
    if (o.stripes) return (x, S, rnd) => { const n = Math.round(o.stripes * (name === 'zebra' ? 3 : 2.4)); for (let i = 0; i < n; i++) { const v = (i + 0.5) / n; band(x, S, v, name === 'zebra' ? -0.02 : 0.02, name === 'zebra' ? 1.02 : 0.52, (name === 'zebra' ? 0.42 : 0.3) / n, rnd, name === 'zebra' ? '#1d1b1a' : '#211612'); if (name !== 'zebra') band(x, S, v + 0.5 / n * 0.4, 0.52, 0.98, 0.22 / n, rnd, '#211612'); } };
    if (name === 'giraffe') return (x, S, rnd) => { x.fillStyle = '#f3e4c2'; x.fillRect(0, 0, S, S); for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const cx = (i + 0.5 + (j % 2) * 0.5 + (rnd() - 0.5) * 0.2) / 7, cy = (j + 0.5 + (rnd() - 0.5) * 0.2) / 7; x.fillStyle = shade(o.giraffeCol || '#c77a2a', rnd() * 0.15); x.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rnd() * 0.3, rr = 0.058 + rnd() * 0.012; x.lineTo((cx + Math.cos(a) * rr) * S, (cy + Math.sin(a) * rr) * S); } x.fill(); } };
    if (o.spots && o.spotsDark) return (x, S, rnd) => { for (let i = 0; i < 7; i++) blob(x, S, rnd(), rnd(), 0.08 + rnd() * 0.07, rnd, '#1e1a18', 1.2); };
    if (o.spots) return (x, S, rnd) => { for (let i = 0; i < 70; i++) { const cx = rnd(), cy = rnd(), r = 0.012 + rnd() * 0.01; x.fillStyle = '#231a12'; x.beginPath(); x.ellipse(cx * S, cy * S, r * S, r * S * 0.85, 0, 0, TAU); x.fill(); } };
    if (name === 'skunk') return (x, S) => { x.fillStyle = '#f4f2ee'; x.fillRect(0.17 * S, 0, 0.07 * S, S); x.fillRect(0.26 * S, 0, 0.07 * S, S); };
    if (o.scales) return (x, S, rnd) => { x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1.2; for (let j = 0; j < 22; j++) for (let i = 0; i < 22; i++) { x.beginPath(); x.arc((i + (j % 2) * 0.5) / 22 * S, j / 22 * S, S / 44, 0, Math.PI); x.stroke(); } for (let i = 0; i < 40; i++) { x.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,230,0.08)'; x.beginPath(); x.arc(rnd() * S, rnd() * S, 3 + rnd() * 8, 0, TAU); x.fill(); } };
    if (o.wrinkles) return (x, S, rnd) => { x.strokeStyle = 'rgba(0,0,0,0.13)'; x.lineWidth = 1; for (let i = 0; i < 120; i++) { const px = rnd() * S, py = rnd() * S; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 5, py + (rnd() - 0.5) * 4, px + 10 + rnd() * 8, py + (rnd() - 0.5) * 3); x.stroke(); } };
    return null;
  }

  // shared helpers for parts
  const V = (x, y, z) => new T.Vector3(x, y, z || 0);
  const aim = (obj, from, to) => {   // orient obj's +y from `from` towards `to` (for cones / cylinders)
    const d = V(to[0] - from[0], to[1] - from[1], (to[2] || 0) - (from[2] || 0)); const L = d.length();
    obj.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); obj.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, ((from[2] || 0) + (to[2] || 0)) / 2); return L;
  };
  // a jointed leg: a chain of pivots, each with a rounded tapered limb hanging down
  function legChain(k, parent, x, y, z, segs, mat, matLow) {
    const joints = []; let p = parent, px = x, py = y, pz = z;
    segs.forEach((s, i) => {
      const j = k.limb(s.len, s.r0, s.r1, i >= 1 && matLow ? matLow : mat, p, px, py, pz);
      j.rest = s.a; joints.push(j); p = j; px = 0; py = -s.len; pz = 0;
    });
    return { joints, tip: k.group(p, 0, py, 0) };
  }
  // pose a chain from absolute angles (+ = far end forward): joint rotation is relative to its parent
  function poseChain(ch, abs) { let prev = 0; for (let i = 0; i < ch.joints.length; i++) { ch.joints[i].rotation.z = abs[i] - prev; prev = abs[i]; } return prev; }
  M3.animalLoft = loftGeo;
  // the half width of a loft at x, height y (linear between control sections): to sit eyes / ears on the skin
  function zAt(ctrl, x, y) {
    let i = 0; while (i < ctrl.length - 2 && ctrl[i + 1].x < x) i++;
    const a = ctrl[i], b = ctrl[i + 1], u = clamp((x - a.x) / (b.x - a.x || 1), 0, 1), p0 = ctrl[Math.max(0, i - 1)], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const L = (p) => 0.5 * (2 * a[p] + (-p0[p] + b[p]) * u + (2 * p0[p] - 5 * a[p] + 4 * b[p] - p3[p]) * u * u + (-p0[p] + 3 * a[p] - 3 * b[p] + p3[p]) * u * u * u);   // same spline as loftGeo
    const c = L('c'), hh = y > c ? L('t') : L('b'), q = clamp((y - c) / hh, -1, 1);
    return L('w') * Math.sqrt(1 - q * q);
  }

  // merge several (geometry, matrix) pieces into one shared geometry (spines, scutes, plates, teeth)
  function mergeGeo(key, pieces) {
    return M3.geo(key, () => {
      const P = [], N = [];
      for (const [g0, m] of pieces) {
        const g = (g0.index ? g0.toNonIndexed() : g0.clone()); g.applyMatrix4(m);
        P.push(g.attributes.position.array); N.push(g.attributes.normal.array); g.dispose();
      }
      const len = P.reduce((s, a) => s + a.length, 0), pos = new Float32Array(len), nor = new Float32Array(len);
      let o = 0; for (let i = 0; i < P.length; i++) { pos.set(P[i], o); nor.set(N[i], o); o += P[i].length; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
      return g;
    });
  }
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _up = new T.Vector3(0, 1, 0), _d = new T.Vector3();
  // a cone piece from base point a towards direction d (unit-ish), radius r, length h
  const conePiece = (a, d, r, h, flat) => { _d.set(d[0], d[1], d[2] || 0).normalize(); _q.setFromUnitVectors(_up, _d); _p.set(a[0] + _d.x * h / 2, a[1] + _d.y * h / 2, (a[2] || 0) + _d.z * h / 2); return [M3.geo('acone6', () => new T.ConeGeometry(1, 1, 6)), new T.Matrix4().compose(_p, _q, _s.set(r, h, r * (flat || 1)))]; };

  // ---------- head ----------
  // HG: head group at the head centre (+x forward). Returns parts the update poses.
  function buildHead(k, HG, o, A) {
    const hr = o.headR, ss = (o.snout ? o.snoutSize : 0.55) * (A.muzzleL || 1), H = {};
    const long = o.head === 'long', croc = o.head === 'croc';
    const inner = H.inner = k.group(HG);
    if (long) inner.rotation.z = -A.headRot;
    if (A.headK) inner.scale.setScalar(A.headK);
    const lr = 1.35 * hr;
    let ctrl, jawC, tipX, mouthY, eyeP, earP, noseP;
    if (croc) {
      ctrl = [{ x: -hr, c: 0.05 * hr, t: 0.55 * hr, b: 0.45 * hr, w: 0.8 * hr }, { x: 0, c: 0, t: 0.42 * hr, b: 0.35 * hr, w: 0.68 * hr }, { x: 1.2 * hr, c: -0.05 * hr, t: 0.24 * hr, b: 0.22 * hr, w: 0.42 * hr }, { x: 2.05 * hr, c: -0.04 * hr, t: 0.24 * hr, b: 0.2 * hr, w: 0.5 * hr }];
      jawC = [{ x: 0.1 * hr, c: 0, t: 0.1 * hr, b: 0.22 * hr, w: 0.66 * hr }, { x: 1.7 * hr, c: 0, t: 0.08 * hr, b: 0.14 * hr, w: 0.4 * hr }, { x: 2.6 * hr, c: 0, t: 0.08 * hr, b: 0.13 * hr, w: 0.46 * hr }];
      tipX = 2.3 * hr; mouthY = -0.2 * hr; eyeP = [-0.35 * hr, 0.5 * hr, 0.42 * hr]; earP = null; noseP = [2.1 * hr, 0.16 * hr];
    } else if (long) {
      const rep = A.reptile;
      ctrl = [{ x: -0.8 * hr, c: 0.05 * hr, t: 0.62 * hr, b: 0.66 * hr, w: 0.6 * hr * (rep ? 1.15 : 1) }, { x: -0.2 * hr, c: -0.06 * hr, t: 0.66 * hr, b: 0.8 * hr, w: 0.62 * hr * (rep ? 1.1 : 1) },
        { x: 0.5 * lr, c: 0.04 * hr, t: 0.5 * hr, b: 0.44 * hr * (rep ? 0.8 : 1), w: 0.44 * hr * (rep ? 1.15 : 1) }, { x: 0.95 * lr, c: 0, t: 0.44 * hr * (rep ? 0.85 : 1), b: 0.42 * hr * (rep ? 0.75 : 1), w: 0.43 * hr * (rep ? 1.1 : 1) }];
      jawC = [{ x: 0, c: 0, t: 0.15 * hr, b: 0.35 * hr, w: 0.5 * hr }, { x: 0.6 * lr, c: 0.02 * hr, t: 0.12 * hr, b: 0.2 * hr, w: 0.36 * hr }, { x: 1.05 * lr, c: 0.04 * hr, t: 0.1 * hr, b: 0.16 * hr, w: 0.32 * hr }];
      tipX = 1.32 * lr; mouthY = -0.36 * hr; eyeP = [0.02 * hr, 0.3 * hr, 0.56 * hr]; earP = [-0.66 * hr, 0.5 * hr, 0.3 * hr]; noseP = [1.25 * lr, 0.02 * hr];
    } else {
      const mL = hr * (o.nostrils && ss >= 1.3 ? (A.hippo ? 0.5 : 0.55) : 0.95) * ss, mw = A.muzzleW || 1, ms = Math.sqrt(clamp(ss, 0.6, 1.6));
      const x2 = 0.45 * hr;
      ctrl = [{ x: -0.85 * hr, c: 0.06 * hr, t: 0.78 * hr, b: 0.72 * hr, w: 0.76 * hr }, { x: -0.2 * hr, c: 0.06 * hr, t: 0.92 * hr, b: 0.86 * hr, w: 0.9 * hr }, { x: x2, c: -0.04 * hr, t: 0.7 * hr, b: 0.72 * hr, w: 0.7 * hr },
        { x: x2 + mL * 0.55, c: -0.24 * hr, t: 0.42 * hr * ms, b: 0.38 * hr * ms, w: 0.42 * hr * mw * ms }, { x: x2 + mL, c: -0.26 * hr, t: 0.35 * hr * ms, b: 0.3 * hr * ms, w: 0.34 * hr * mw * ms }];
      jawC = [{ x: 0, c: 0, t: 0.18 * hr, b: 0.25 * hr, w: 0.5 * hr }, { x: x2 + 0.1 * hr, c: 0, t: 0.15 * hr, b: 0.22 * hr, w: 0.38 * hr * mw }, { x: x2 + mL + 0.15 * hr, c: 0.02 * hr, t: 0.12 * hr, b: 0.16 * hr, w: 0.28 * hr * mw * ms }];
      tipX = x2 + mL + 0.3 * hr * ms; mouthY = -0.52 * hr; eyeP = [0.3 * hr, 0.22 * hr, 0.58 * hr]; earP = [-0.38 * hr, 0.72 * hr, 0.48 * hr]; noseP = [tipX - 0.05 * hr, -0.02 * hr - 0.1 * hr * ms];
    }
    const head = k.mesh(loftGeo(ctrl, { na: 16, radial: 16, cap1: 0.8 }), A.headMat, inner);
    // lower jaw on a hinge below the ear
    const hingeX = croc ? -0.6 * hr : -0.3 * hr, hingeY = croc ? -0.2 * hr : long ? -0.42 * hr : -0.38 * hr;
    H.jaw = k.group(inner, hingeX, hingeY, 0);
    k.mesh(loftGeo(jawC, { na: 10, radial: 14 }), A.headMat, H.jaw);
    const mouthM = k.mat('#4a1c1c', { rough: 0.6 });
    const mLen = tipX - hingeX;
    k.sphere([mLen * 0.42, hr * 0.16, (croc ? 0.5 : 0.32) * hr], mouthM, inner, hingeX + mLen * 0.5, hingeY + 0.12 * hr, 0);
    if (!croc) k.sphere([mLen * 0.3, hr * 0.06, 0.22 * hr], k.mat('#c96a72', { rough: 0.5 }), H.jaw, mLen * 0.5, 0.16 * hr, 0);   // tongue
    // teeth: a white zigzag along each side of the jaws (crocs show them shut, others when they open)
    if (o.teeth || croc) {
      const tm = k.mat('#f3ecd8', { rough: 0.35 }), n = croc ? 9 : 5, L = mLen * (croc ? 0.85 : 0.5), th = hr * (croc ? 0.14 : 0.12), x0 = tipX - L - 0.1 * hr;
      const pts = []; for (let i = 0; i <= n * 2; i++) pts.push(x0 + i / (n * 2) * L, i % 2 ? -th : 0); pts.push(x0 + L, 0.05, x0, 0.05);
      const zw = croc ? 0.4 * hr : 0.26 * hr;
      for (const s of [1, -1]) k.extrude(pts, 0.5, tm, inner, 0, hingeY + 0.22 * hr, s * zw, 0.1);
      if (!croc) for (const s of [1, -1]) { const f = k.cone(hr * 0.07, hr * 0.32, tm, inner, tipX - 0.35 * hr, hingeY + 0.08 * hr, s * 0.2 * hr, 8); f.rotation.z = Math.PI; }
    }
    // eyes, looking out of the sides of the head (predators' a little more forward)
    const er = (A.eyeR || 1) * clamp(Math.pow(hr / 7, 0.62), 0.55, 3) * 1.02;
    const fwd = A.predator ? 0.55 : 0.2;
    H.eyes = [];
    for (const s of [1, -1]) {
      if (A.mask) { const mk = k.sphere([er * 1.9, er * 1.4, er * 1.1], k.mat('#1c1a1a', { rough: 0.8 }), inner, eyeP[0] - er * 0.2, eyeP[1] - er * 0.3, s * (zAt(ctrl, eyeP[0] - er * 0.2, eyeP[1] - er * 0.3) - er * 0.35)); mk.scale.z = er * 0.7; mk.rotation.z = A.maskTilt || -0.4; }
      if (croc) k.sphere([er * 1.5, er * 1.2, er * 1.3], A.headMat, inner, eyeP[0], eyeP[1] - er * 0.4, s * eyeP[2]);
      H.eyes.push(k.eye(er, inner, eyeP[0], eyeP[1], s * (zAt(ctrl, eyeP[0], eyeP[1]) + (croc ? er * 0.2 : -er * 0.3)), { dir: [fwd, 0.15, s], iris: A.iris, white: A.eyeWhite, lid: A.lid }));
    }
    // nose
    if (A.disc) {   // pig / hippo: a flat snout disc with two nostrils
      const d = k.cyl(hr * 0.4 * ss, hr * 0.42 * ss, hr * 0.2, A.snoutMat, inner, noseP[0] - 0.05 * hr, noseP[1] - 0.12 * hr, 0, 20); d.rotation.z = Math.PI / 2; d.scale.z = A.hippo ? 1.5 : 0.85;
      for (const s of [1, -1]) k.sphere([hr * 0.04, hr * 0.12, hr * 0.07], k.mat('#3a1c1c'), inner, noseP[0] + 0.06 * hr, noseP[1] - 0.08 * hr, s * hr * 0.16 * ss * (A.hippo ? 1.4 : 1));
    } else if (!long && !croc && o.snout) {
      const nr = hr * 0.17 * Math.sqrt(ss) * (A.bigNose || 1);
      k.sphere([nr * 0.9, nr * 0.75, nr * 1.25], k.mat(A.noseCol, { rough: 0.3 }), inner, noseP[0], noseP[1], 0);
    } else if (long || croc || o.nostrils) {
      for (const s of [1, -1]) k.sphere([hr * 0.08, hr * 0.12, hr * 0.06], k.mat('#1e1412', { rough: 0.5 }), inner, noseP[0] - (croc ? 0 : 0.12 * hr), noseP[1] + (croc ? 0.05 * hr : -0.05 * hr), s * hr * (croc ? 0.14 : 0.24));
    }
    if (o.whiskers) {
      const wm = k.mat('#f2efe8', { rough: 0.4 });
      for (const s of [1, -1]) for (let i = 0; i < 3; i++) { const w = k.cyl(0.08, 0.04, hr * 1.1, wm, inner, noseP[0] - 0.25 * hr, noseP[1] - 0.15 * hr - i * 0.06 * hr, s * hr * 0.55, 4); w.rotation.set(s * 1.2, 0, 0.15 - i * 0.18); }
    }
    if (o.beard) { const b = k.cone(hr * 0.22, hr * 0.9, A.headMat, H.jaw, mLen * 0.55, -0.45 * hr, 0, 8); b.rotation.z = Math.PI + 0.25; }
    H.earP = earP; H.ctrl = ctrl; H.zAt = (x, y) => zAt(ctrl, x, y); H.tipX = tipX; H.mLen = mLen; H.hingeX = hingeX; H.hingeY = hingeY;
    return H;
  }

  // ears: returns pivots the update can flick / fold back
  function buildEars(k, H, o, A) {
    const s = o.earSize, kind = o.ears, P = H.earP, hr = o.headR, out = [];
    if (!P || kind === 'none') return out;
    const pink = k.mat(A.earInner || '#d79a9a', { rough: 0.8 }), m = A.earMat;
    for (const sd of [1, -1]) {
      const pv = k.group(H.inner, P[0], P[1], sd * Math.max(P[2], H.zAt(P[0], P[1]) * 0.85)); pv.side = sd; out.push(pv);
      if (kind === 'point') {
        const e1 = k.cone(2.6 * s, 6.5 * s, m, pv, 0, 3 * s, 0, 10); e1.scale.z = 0.42;
        const e2 = k.cone(1.6 * s, 4.6 * s, pink, pv, 0.55 * s, 2.5 * s, 0, 10); e2.scale.z = 0.3;
        pv.rotation.set(sd * 0.32, sd * -0.35, -0.15); pv.base = [sd * 0.32, sd * -0.35, -0.15];
      } else if (kind === 'floppy') {
        pv.position.set(P[0] - 0.05 * hr, P[1] - 0.15 * hr, sd * (H.zAt(P[0] - 0.05 * hr, P[1] - 0.15 * hr) + 0.25));
        k.sphere([2.6 * s, 5.6 * s, 0.9], m, pv, 0, -4.4 * s, 0.4 * sd); pv.rotation.set(sd * 0.18, sd * -0.2, -0.18); pv.base = [sd * 0.18, sd * -0.2, -0.18];
      } else if (kind === 'round') {
        k.sphere([3.2 * s, 3.2 * s, 1.1 * s], m, pv, 0, 2.2 * s, 0); k.sphere([2.2 * s, 2.2 * s, 0.6 * s], A.koala ? k.mat('#eeeeee') : pink, pv, 0.7 * s, 2.2 * s, 0);
        pv.rotation.set(sd * 0.25, sd * -0.6, 0); pv.base = [sd * 0.25, sd * -0.6, 0];
      } else if (kind === 'long') {
        k.sphere([2.3 * s, 8.5 * s, 1.1 * s], m, pv, 0, 7.6 * s, 0); k.sphere([1.4 * s, 6.8 * s, 0.6 * s], pink, pv, 0.75 * s, 7.6 * s, 0);
        pv.rotation.set(sd * 0.22, sd * -0.5, -0.32); pv.base = [sd * 0.22, sd * -0.5, -0.32];
      } else if (kind === 'big') {
        pv.position.set(P[0] - 0.1 * hr, P[1] - 0.62 * hr, sd * 0.72 * hr);
        const R = hr;
        const pts = []; for (let i = 0; i <= 14; i++) { const a = -1.6 + i / 14 * 3.6; pts.push(-Math.sin(a) * R * 0.75 - R * 0.55, Math.cos(a) * R * 0.95 * (a > 1.2 ? 0.85 : 1)); }
        k.extrude(pts, 1.4, m, pv, 0, 0, 0, 0.5);
        pv.rotation.set(0, sd * 0.5, 0); pv.base = [0, sd * 0.5, 0];
      } else if (kind === 'tuft') {
        const e1 = k.cone(1.5 * s, 4.5 * s, m, pv, 0, 2 * s, 0, 8); e1.scale.z = 0.5; k.cone(0.6, 2, k.mat('#2a2420'), pv, 0, 4.8 * s, 0, 5);
        pv.rotation.set(sd * 0.4, sd * -0.5, -0.2); pv.base = [sd * 0.4, sd * -0.5, -0.2];
      } else if (kind === 'small') {
        pv.position.set(P[0], P[1] - 0.18 * hr, sd * H.zAt(P[0], P[1] - 0.18 * hr));
        k.sphere([1.6 * s, 1.1 * s, 2.8 * s], m, pv, 0, 0, sd * 2 * s); pv.rotation.set(sd * 0.4, 0, 0); pv.base = [sd * 0.4, 0, 0];
      }
    }
    return out;
  }

  // horns and antlers
  function buildHorns(k, H, o, A) {
    const hr = o.headR, m = A.hornMat, I = H.inner, long = o.head === 'long', top = long ? 0.55 * hr : 0.82 * hr;
    const tube = (pts, r0, r1, mm) => k.tube(pts, r0, r1, mm || m, I, 10, 8);
    switch (o.horns) {
      case 'cow': for (const s of [1, -1]) tube([[-0.3 * hr, top, s * 0.4 * hr], [-0.25 * hr, top + 0.12 * hr, s * 0.95 * hr], [0.05 * hr, top + 0.55 * hr, s * 1.2 * hr], [0.25 * hr, top + 0.85 * hr, s * 1.05 * hr]], 0.18 * hr, 0.03 * hr); break;
      case 'goat': for (const s of [1, -1]) tube([[-0.25 * hr, top, s * 0.24 * hr], [-0.45 * hr, top + 0.7 * hr, s * 0.3 * hr], [-1.0 * hr, top + 1.05 * hr, s * 0.36 * hr], [-1.45 * hr, top + 0.75 * hr, s * 0.42 * hr]], 0.17 * hr, 0.03 * hr); break;
      case 'ram': for (const s of [1, -1]) { const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * 4.8, r = hr * (0.75 - i * 0.04); pts.push([-0.4 * hr - Math.sin(a) * r * 0.9, top - 0.3 * hr + Math.cos(a) * r, s * (0.55 * hr + i * 0.05 * hr)]); } tube(pts, 0.28 * hr, 0.06 * hr); } break;
      case 'unicorn': {
        const g = k.group(I, 0.32 * lrOf(o), top + 0.1 * hr, 0); g.rotation.z = -0.62 - A.headRot * 0 + 0.0;
        k.cone(1.15, 12, m, g, 0, 6, 0, 14);
        const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, a = u * 6 * TAU; pts.push([Math.cos(a) * 1.15 * (1 - u), u * 11.5, Math.sin(a) * 1.15 * (1 - u)]); }
        k.tube(pts, 0.32, 0.06, k.mat(shade(A.hornCol, 0.18), { rough: 0.3, metal: 0.3 }), g, 60, 5);
        break;
      }
      case 'antlers': {
        const big = A.moose, am = m;
        for (const s of [1, -1]) {
          if (big) {   // moose: a beam out to the side and a broad palm with points
            tube([[-0.5 * hr, top, s * 0.3 * hr], [-0.6 * hr, top + 0.2 * hr, s * 1.0 * hr], [-0.7 * hr, top + 0.4 * hr, s * 1.5 * hr]], 0.22 * hr, 0.16 * hr, am);
            const pts = [0, 0]; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; pts.push(-Math.cos(a) * hr * 0.9 + hr * 0.1, Math.sin(a) * hr * 0.75 + (i % 2 ? hr * 0.25 : 0)); } pts.push(hr * 1.0, 0);
            const p = k.extrude(pts, 0.9, am, I, -0.7 * hr, top + 0.35 * hr, s * 1.45 * hr, 0.3); p.rotation.set(s * 1.05, 0, 0.1);
          } else {
            const b0 = [-0.4 * hr, top - 0.05 * hr, s * 0.3 * hr], b1 = [-0.7 * hr, top + 0.9 * hr, s * 0.8 * hr], b2 = [-0.6 * hr, top + 1.9 * hr, s * 0.95 * hr], b3 = [-0.1 * hr, top + 2.6 * hr, s * 0.8 * hr];
            tube([b0, b1, b2, b3], 0.13 * hr, 0.05 * hr);
            tube([b1, [0.0 * hr, top + 1.3 * hr, s * 0.75 * hr], [0.35 * hr, top + 1.6 * hr, s * 0.65 * hr]], 0.09 * hr, 0.03 * hr);
            tube([b2, [-0.15 * hr, top + 2.3 * hr, s * 1.2 * hr], [0.05 * hr, top + 2.8 * hr, s * 1.35 * hr]], 0.08 * hr, 0.03 * hr);
          }
        }
        break;
      }
      case 'rhino': {
        const tx = H.tipX;
        const c1 = k.cone(0.32 * hr, 1.25 * hr, m, I, tx - 0.42 * hr, 0.42 * hr + 0.5 * hr, 0, 12); c1.rotation.z = 0.35;
        const c2 = k.cone(0.24 * hr, 0.6 * hr, m, I, tx - 1.0 * hr, 0.5 * hr + 0.3 * hr, 0, 10); c2.rotation.z = 0.15;
        break;
      }
      case 'dragon': for (const s of [1, -1]) { tube([[-0.5 * hr, top - 0.1 * hr, s * 0.35 * hr], [-1.1 * hr, top + 0.35 * hr, s * 0.48 * hr], [-1.9 * hr, top + 0.45 * hr, s * 0.5 * hr], [-2.5 * hr, top + 0.9 * hr, s * 0.45 * hr]], 0.2 * hr, 0.02 * hr); tube([[-0.1 * hr, top - 0.25 * hr, s * 0.5 * hr], [-0.7 * hr, top - 0.05 * hr, s * 0.75 * hr], [-1.2 * hr, top + 0.15 * hr, s * 0.85 * hr]], 0.12 * hr, 0.02 * hr); } break;
      case 'ossicone': for (const s of [1, -1]) { const c = k.cyl(0.13 * hr, 0.17 * hr, 0.85 * hr, m, I, -0.45 * hr, top + 0.38 * hr, s * 0.22 * hr, 10); c.rotation.set(s * 0.18, 0, 0.2); k.sphere(0.2 * hr, k.mat('#3a2a1e'), c, 0, 0.45 * hr, 0); } break;
    }
  }
  const lrOf = o => 1.35 * o.headR;

  // material with a shared coat texture (k.mat caches by key; `tex` only makes the key unique)
  function texMat(k, key, tex, rough, extra) { const m = k.mat('#ffffff', Object.assign({ rough, tex: key }, extra || {})); if (m.map !== tex) { m.map = tex; m.needsUpdate = true; } return m; }

  // leg layouts: [fraction of length, rest angle (+ = far end forward), r0, r1 (x leg radius)]
  const LEGS = {
    hoofF: [[0.33, -0.18, 1.8, 1.05], [0.32, 0.04, 1.0, 0.66], [0.27, 0, 0.6, 0.56], [0.08, 0.5, 0.6, 0.64]],
    hoofH: [[0.34, 0.45, 2.1, 1.15], [0.32, -0.52, 1.05, 0.62], [0.26, 0.05, 0.6, 0.56], [0.08, 0.5, 0.6, 0.64]],
    pawF: [[0.42, -0.24, 1.8, 1.05], [0.42, 0.06, 1.0, 0.72], [0.16, 0.38, 0.72, 0.7]],
    pawH: [[0.36, 0.52, 2.1, 1.15], [0.36, -0.58, 1.05, 0.7], [0.28, 0.14, 0.7, 0.65]],
    hopH: [[0.4, 0.9, 2.4, 1.3], [0.35, -1.0, 1.0, 0.7], [0.25, 1.2, 0.7, 0.62]],
    pillarF: [[0.52, -0.06, 1.6, 1.15], [0.48, 0.03, 1.12, 1.05]],
    pillarH: [[0.52, 0.2, 1.8, 1.2], [0.48, -0.12, 1.15, 1.05]]
  };

  function quadBuild(e, k, tpl) {
    const o = tpl.o, g = tpl.g, SC = tpl.k || 1, name = e.def.name;
    const pal = e.pal || e.def.pal || {}, own = r => pal[r];
    const bw = o.bodyW, bh = o.bodyH, h = bh / 2, hr = o.headR;
    const croc = o.head === 'croc', shelly = o.shell, sprawl = croc || shelly || o.legSpread >= 0.38;
    const reptile = croc || shelly || (o.ears === 'none' && o.head === 'long' && (o.tail === 'thick' || o.tail === 'thin'));
    const hoofed = !reptile && !o.thickLegs && (o.head === 'long' || (o.nostrils && o.snoutSize >= 1.3) || ['cow', 'goat', 'antlers', 'ossicone'].includes(o.horns) || o.hump > 0 || o.saddle || o.wool);
    const pillar = o.thickLegs || (!hoofed && !reptile && o.ears === 'round' && hr >= 8.5 && !o.mane);
    const thickSkin = o.thickLegs || /hippo|rhino|elephant/.test(name);
    // colours
    const body = k.col('body');
    const belly = own('belly') || (reptile ? mix(body, '#e9e2b8', 0.5) : /fox|deer|tiger|cheetah|goat|raccoon/.test(name) ? mix(body, '#fbf8f0', 0.8) : mix(body, '#f7f1e3', 0.45));
    const maneCol = own('mane') || shade(body, 0.45);
    const tagsK = name + '|' + body;
    // coat textures: body (with belly), coat (legs, neck, ears), head (lighter muzzle)
    const pat = patternFor(name, Object.assign({}, o, { scales: reptile && !shelly, wrinkles: thickSkin, giraffeCol: own('horn') ? shade(own('horn'), -0.1) : null }), body);
    const noBelly = croc || o.patches || /zebra|giraffe/.test(name) || (o.spots && o.spotsDark);
    const bodyTex = coatTex('qb|' + tagsK + belly, body, (x, S, rnd) => {
      if (pat) pat(x, S, rnd);
      if (o.patches) { x.fillStyle = '#1e1c1c'; x.fillRect(0, 0.08 * S, S, 0.26 * S); }   // panda: black shoulders
      if (!noBelly || reptile) { const gr = x.createLinearGradient(0.5 * S, 0, S, 0); gr.addColorStop(0, rgba(belly, 0)); gr.addColorStop(0.5, rgba(belly, 0.9)); gr.addColorStop(1, rgba(belly, 0)); x.fillStyle = gr; x.fillRect(0.5 * S, 0, 0.5 * S, S); }
    });
    const coat = coatTex('qc|' + tagsK, body, (x, S, rnd) => { if (pat && name !== 'skunk') pat(x, S, rnd); });
    const snoutC = own('snout') || (o.head === 'long' ? shade(body, 0.15) : o.nostrils ? mix(body, '#d9a9a0', 0.55) : mix(body, '#fff', 0.3));
    const headTex = coatTex('qh|' + tagsK + snoutC, body, (x, S, rnd) => {
      if (pat && !(o.spots && o.spotsDark) && name !== 'skunk') pat(x, S, rnd);
      if (!croc && !reptile) { const gr = x.createLinearGradient(0, 0, 0, 0.45 * S); gr.addColorStop(0, snoutC); gr.addColorStop(0.55, rgba(snoutC, 0.8)); gr.addColorStop(1, rgba(snoutC, 0)); x.fillStyle = gr; x.fillRect(0, 0, S, 0.45 * S); }
      if (/tiger|lion|cheetah|wolf|fox/.test(name)) { x.fillStyle = 'rgba(255,252,245,0.55)'; x.fillRect(0.6 * S, 0, 0.3 * S, 0.5 * S); }
    });
    const rough = reptile ? 0.55 : thickSkin ? 0.82 : 0.9;
    const bodyMat = o.wool ? k.mat(k.col('wool'), { rough: 1 }) : texMat(k, 'qb', bodyTex, rough);
    const coatMat = texMat(k, 'qc', coat, rough), headMat = texMat(k, 'qh', headTex, rough);
    const darkLegs = o.patches ? '#1e1c1c' : name === 'fox' ? '#2c201a' : name === 'horse' ? shade(body, 0.55) : null;
    const lowMat = darkLegs ? k.mat(darkLegs, { rough: 0.9 }) : null;
    const hoofMat = k.mat(k.col('hoof'), { rough: 0.45 });

    // ---- skeleton of groups ----
    const R = k.group(k.root, tpl.ox * SC, -tpl.oy * SC, 0); R.scale.setScalar(SC);
    const B = k.group(R);   // the whole animal above the feet: bobs, crouches, lies down
    const W = bh * (croc ? 0.72 : shelly ? 0.62 : o.wool ? 0.5 : thickSkin ? 0.46 : bh / bw > 0.6 ? 0.52 : 0.42);
    // ---- torso: haunch, tucked flank, deep ribcage, chest ----
    const tuck = (pillar || o.wool || o.udder || shelly || croc || hr >= 12 || o.snoutSize >= 1.3 || bh / bw > 0.55) ? 0.95 : 0.74;
    const flat = croc || reptile ? 0.75 : 1, deep = hoofed ? 1.1 : 1;
    const ctrl = [
      { x: -bw / 2 + 0.7 * h, c: 0.06 * h, t: 0.8 * h * flat, b: 0.72 * h, w: 0.8 * W },
      { x: -bw * 0.28, c: 0.06 * h, t: 0.98 * h * flat, b: 0.88 * h * deep, w: W },
      { x: -bw * 0.04, c: 0.08 * h * (1 - tuck), t: 0.92 * h * flat, b: 0.84 * h * tuck, w: 0.94 * W },
      { x: bw * 0.18, c: -0.02 * h, t: 0.95 * h * flat, b: 1.0 * h * deep, w: W },
      { x: bw * 0.34, c: 0.02 * h, t: 0.94 * h * flat, b: 0.95 * h * deep, w: 0.92 * W },
      { x: bw / 2 - 0.65 * h, c: 0.08 * h, t: 0.74 * h * flat, b: 0.68 * h, w: 0.74 * W }];
    const torso = k.mesh(loftGeo(ctrl, o.wool ? { lump: 0.3, lumpF: 1.1, na: 30, radial: 26 } : {}), bodyMat, B);
    if (o.wool) torso.scale.set(1.06, 1.08, 1.04);
    // ---- legs ----
    const lw = Math.max(2.6, Math.min(bh * 0.3, o.legLen * 0.38)) * (o.thickLegs ? 1.55 : 1) * (shelly ? 1.7 : sprawl ? 1.25 : 1), lr = lw / 2;
    const hipY = sprawl ? -0.55 * h : 0.05 * h, L = o.legLen + h + hipY;
    const legs = [];
    for (const front of [true, false]) for (const near of [true, false]) {
      const lx = (front ? 1 : -1) * bw * o.legSpread, lz = (near ? 1 : -1) * W * (sprawl ? 0.8 : 0.48);
      const hip = k.group(B, lx, hipY, lz);
      let ch, segs;
      if (sprawl) {
        const up = Math.max(lr * 2.2, o.legLen * 0.75), lo = (L - up * Math.cos(1.3)) / Math.cos(0.3);
        segs = [{ len: up, r0: lr * 1.5, r1: lr * 1.05, a: 0 }, { len: lo, r0: lr * 1.0, r1: lr * 0.8, a: 0 }];
        ch = legChain(k, hip, 0, 0, 0, segs, coatMat, lowMat);
        ch.joints[0].rotation.x = (near ? -1 : 1) * 1.3; ch.joints[1].rotation.x = (near ? 1 : -1) * 1.0;
      } else {
        const lay = !front && e.def.move === 'hop' ? LEGS.hopH : LEGS[(hoofed ? 'hoof' : pillar ? 'pillar' : 'paw') + (front ? 'F' : 'H')];
        const unit = L / lay.reduce((s, q) => s + q[0] * Math.cos(q[1]), 0);
        segs = lay.map(q => ({ len: q[0] * unit, a: q[1], r0: lr * q[2] * (front ? 1 : 1), r1: lr * q[3] }));
        ch = legChain(k, hip, 0, 0, 0, segs, coatMat, lowMat);
      }
      const foot = k.group(ch.tip);
      if (hoofed) { const hf = k.cyl(lr * 0.66, lr * 0.84, lr * 1.0, hoofMat, foot, lr * 0.12, lr * 0.32, 0, 12); hf.rotation.z = 0.12; }
      else if (pillar) { k.cyl(lr * 1.1, lr * 1.18, lr * 0.9, lowMat || coatMat, foot, 0, lr * 0.3, 0, 16); if (o.thickLegs) for (let i = -1; i <= 1; i++) k.sphere([lr * 0.24, lr * 0.2, lr * 0.26], k.mat('#e8e0cc', { rough: 0.5 }), foot, lr * 1.0, lr * 0.05, i * lr * 0.5); }
      else if (sprawl) { k.sphere([lr * 1.4, lr * 0.45, lr * 1.1], lowMat || coatMat, foot, lr * 0.6, lr * 0.2, 0); }
      else { k.sphere([lr * 1.25, lr * 0.62, lr * 0.98], lowMat || coatMat, foot, lr * 0.5, lr * 0.4, 0); }
      if (!sprawl && !shelly) k.sphere([bw * (front ? 0.12 : 0.15), h * (front ? 0.72 : 0.82), W * 0.42], o.wool ? bodyMat : coatMat, B, lx + (front ? 0 : 0.5), hipY + h * (front ? 0.05 : 0.12), lz * 0.82);
      legs.push({ ch, segs, foot, hip, front, near, rest: segs.map(s => s.a), off: (front === near) ? 0 : Math.PI });
    }
    // ---- neck and head ----
    const hx = g.hx, hy = -g.hy, nbx = g.neckX - 3, nby = h * 0.3;
    const NG = k.group(B, nbx, nby, 0);
    const cosN = g.cosN, sinN = g.sinN;
    const neX = hx - cosN * hr * 0.55 - nbx, neY = hy - sinN * hr * 0.5 - nby;
    const woolNeck = o.wool && o.neckLen > 10 ? 1.45 : 1, nr0 = Math.min(bh * 0.62, bw * 0.4) * (o.thickNeck ? 1.25 : 1) * 0.6 * woolNeck, nr1 = hr * (o.thickNeck ? 1.4 : 1.1) * (hoofed ? 0.62 : 0.52) * woolNeck;
    const nmid = [neX * 0.5 - neY * 0.08, neY * 0.5 + Math.abs(neX) * 0.08];
    const neck = k.tube([[-2, -2, 0], nmid, [neX, neY, 0]], u => nr1 + (nr0 - nr1) * Math.pow(1 - u, o.neckLen > 30 ? 2.6 : 1.1), 0, o.wool && o.neckLen > 10 ? bodyMat : coatMat, NG, 12, 14);
    if (hoofed) neck.scale.z = 0.8;
    if (o.hairMane) {   // a crest of mane along the top of the neck, onto the poll
      const dx = neX, dy = neY, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, pts = [];
      for (let i = 0; i <= 4; i++) { const u = i / 4, r = nr1 + (nr0 - nr1) * Math.pow(1 - u, o.neckLen > 30 ? 2.6 : 1.1); pts.push([dx * u + nx * r * 0.85 - 1, dy * u + ny * r * 0.85 + (i === 0 ? -1 : 0), 0]); }
      pts.push([neX + hr * 0.5, neY + hr * 0.8, 0]);
      const mn = k.tube(pts, u => (name === 'zebra' ? 1.5 : 1.9) * (1 - u * 0.4), 0, k.mat(maneCol, { rough: 0.95 }), NG, 12, 8); mn.scale.z = 0.45;
    }
    if (o.collar) {
      // a point on the neck curve (a quadratic through its three path points) and the direction there
      const u = 0.42, cx = 2 * nmid[0] - (neX - 2) / 2, cy = 2 * nmid[1] - (neY - 2) / 2, q = (a, c, b) => (1 - u) * (1 - u) * a + 2 * u * (1 - u) * c + u * u * b;
      const cp = [q(-2, cx, neX), q(-2, cy, neY)], dx = 2 * (1 - u) * (cx + 2) + 2 * u * (neX - cx), dy = 2 * (1 - u) * (cy + 2) + 2 * u * (neY - cy);
      const rr = (nr1 + (nr0 - nr1) * Math.pow(1 - u, 1.1)) * 1.0;
      const col = k.mesh(M3.geo('torus:' + Math.round(rr * 4), () => new T.TorusGeometry(rr, 0.75, 8, 22)), k.mat('#c62828', { rough: 0.5 }), NG, cp[0], cp[1], 0);
      col.quaternion.setFromUnitVectors(V(0, 0, 1), V(dx, dy, 0).normalize());
      k.sphere([1.1, 1.3, 0.5], k.mat('#f2b632', { rough: 0.3, metal: 0.7 }), NG, cp[0] + rr * 0.4, cp[1] - rr * 1.05, 0);
    }
    const HG = k.group(NG, hx - nbx, hy - nby, 0);
    const A = {
      headMat, reptile, eyeR: o.eyeR / 1.5, mask: o.mask, maskTilt: name === 'panda' ? -0.6 : -0.15,
      headRot: croc ? 0 : reptile ? 0.12 : /giraffe|camel|llama/.test(name) ? 0.3 : /rhino|stegosaurus/.test(name) ? 0.25 : name === 'deer' ? 0.45 : 0.55,
      predator: !hoofed && !reptile && o.ears !== 'long' && !o.nostrils,
      iris: /cat|kitten/.test(name) ? '#9fb83a' : /lion|tiger|cheetah|wolf|fox|goat|dragon|crocodile|lizard/.test(name) ? '#c8901e' : hoofed ? '#2a1a10' : '#4a2a14',
      headK: o.head === 'long' && !reptile ? 1.18 : 1, lid: body, disc: o.nostrils && o.snoutSize >= 1.3 && name !== 'hippo', hippo: name === 'hippo', snoutMat: k.mat(own('snout') || (name === 'pig' ? shade(body, 0.08) : mix(body, '#c9a0a0', 0.3)), { rough: 0.6 }),
      noseCol: name === 'koala' ? '#24201e' : o.whiskers && !/wolf/.test(name) ? (name === 'lion' ? '#9a5a4a' : '#c27a7a') : '#1a1412', bigNose: name === 'koala' ? 2.3 : 1,
      muzzleW: name === 'hippo' ? 1.7 : /bear|panda|cow|bull/.test(name) ? 1.2 : name === 'fox' ? 0.8 : 1,
      muzzleL: /cat|kitten|lion|tiger|cheetah/.test(name) ? 0.7 : /bear/.test(name) ? 0.75 : name === 'panda' ? 0.55 : 1,
      earMat: o.patches ? k.mat('#1e1c1c', { rough: 0.9 }) : coatMat, koala: name === 'koala',
      hornCol: k.col('horn'), hornMat: k.mat(name === 'rhino' && !own('horn') ? mix(body, '#5a4a3a', 0.5) : k.col('horn'), o.horns === 'unicorn' ? { rough: 0.25, metal: 0.55 } : { rough: 0.5 }), moose: name === 'moose'
    };
    A.eyeWhite = shade(A.iris, 0.5);
    if (o.mane) {   // lion's ruff, behind and around the face
      const mc = [{ x: -1.5 * hr, c: -0.3 * hr, t: 1.0 * hr, b: 1.3 * hr, w: 1.05 * hr }, { x: -0.6 * hr, c: -0.2 * hr, t: 1.55 * hr, b: 1.75 * hr, w: 1.5 * hr }, { x: 0.05 * hr, c: -0.15 * hr, t: 1.4 * hr, b: 1.5 * hr, w: 1.35 * hr }];
      k.mesh(loftGeo(mc, { lump: 0.45, lumpF: 1.6 / hr * 7, cap1: 0.25 }), k.mat(k.col('mane'), { rough: 1 }), HG, -0.1 * hr, 0, 0);
    }
    const H = buildHead(k, HG, o, A);
    const ears = buildEars(k, H, o, A);
    buildHorns(k, H, o, A);
    if (o.hairMane) k.sphere([hr * 0.35, hr * 0.5, hr * 0.3], k.mat(maneCol, { rough: 0.95 }), H.inner, -0.35 * hr, 0.6 * hr, 0);   // forelock
    let trunk = null, tuskTubes = null;
    if (o.trunk) trunk = k.tube(trunkPath(hr, H.tipX, 0, 0), u => hr * (0.4 - 0.26 * u), 0, headMat, H.inner, 16, 12);
    if (o.tusks) for (const s of [1, -1]) k.tube([[H.tipX - 0.5 * hr, -0.45 * hr, s * 0.32 * hr], [H.tipX + 0.1 * hr, -1.0 * hr, s * 0.42 * hr], [H.tipX + 0.75 * hr, -1.05 * hr, s * 0.38 * hr], [H.tipX + 1.1 * hr, -0.6 * hr, s * 0.3 * hr]], 0.13 * hr, 0.04 * hr, k.mat('#f2ead6', { rough: 0.35 }), H.inner, 10, 8);
    // ---- body extras ----
    const topY = x => h * (0.92 - 0.3 * (2 * x / bw) ** 2);
    if (o.hump) for (let i = 0; i < o.hump; i++) { const cx = o.hump === 1 ? bw * 0.22 : (i ? 8 : -8); k.sphere([o.hump === 1 ? 10 : 8.5, 7, W * 0.62], bodyMat, B, cx, h * 0.72, 0); }
    if (o.udder) { const um = k.mat('#eeaab4', { rough: 0.6 }); k.sphere([4.2, 3.2, 3.6], um, B, -bw * 0.18, -h * 0.82, 0); for (const [dx, dz] of [[-1.6, 1.4], [1.6, 1.4], [-1.6, -1.4], [1.6, -1.4]]) k.cyl(0.45, 0.35, 2, um, B, -bw * 0.18 + dx, -h * 0.82 - 3.4, dz, 6); }
    if (o.saddle) { k.rbox(12, 2.4, W * 2.1, k.mat(k.col('saddle') || '#7a4a24', { rough: 0.6 }), B, 0, topY(0) - 0.4, 0, 1); }
    if (o.spikes) {
      const pieces = [], stego = name === 'stegosaurus', n = stego ? 9 : croc ? 14 : 7;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), x = -bw * 0.45 + u * bw * 0.85, y = topY(x) - 0.6, big = Math.sin(u * Math.PI);
        if (stego) { for (const s of [1, -1]) pieces.push(conePiece([x + s * 2, y, s * 1.2], [0, 1, s * 0.15], 3.5 + big * 4, 5 + big * 9, 0.14)); }
        else if (croc) { for (const s of [1, -1]) pieces.push(conePiece([x, y - 0.5, s * W * 0.25], [0, 1, s * 0.3], 1.3, 2.4)); }
        else pieces.push(conePiece([x, y, 0], [-0.25, 1, 0], 2.2 + big * 1.6, 5 + big * 4, 0.45));
      }
      k.mesh(mergeGeo('spk:' + name + bw + ':' + bh, pieces), k.mat(k.col('spike'), { rough: 0.55 }), B);
    }
    if (o.hedgehog) {
      const pieces = [], rnd = rng(31);
      for (let i = 0; i < 150; i++) {
        const u = rnd(), a = 0.15 + rnd() * (Math.PI - 0.3), x = -bw * 0.5 + u * bw * 0.85;
        const ry = Math.sin(a) * h * 0.95, rz = Math.cos(a) * W * 0.98, sc = Math.sqrt(Math.max(0.1, 1 - (2 * x / bw) ** 2));
        pieces.push(conePiece([x, ry * sc + 0.08 * h, rz * sc], [-0.9, Math.sin(a) * 0.8 + 0.2, Math.cos(a) * 0.8], 0.45, 5 + rnd() * 2));
      }
      k.mesh(mergeGeo('hedge:' + bw, pieces), k.mat(mix(shade(body, 0.35), '#d8c8a8', 0.15), { rough: 0.7 }), B);
    }
    if (shelly) {
      const shellTex = coatTex('shell|' + k.col('shell'), k.col('shell'), (x, S, rnd) => {
        x.strokeStyle = 'rgba(30,20,10,0.75)'; x.lineWidth = 3;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) { const cx = (i + 0.5 + (j % 2) * 0.5) / 5 * S, cy = (j + 0.5) / 3 * S, r = S * 0.11; x.fillStyle = mix(k.col('shell'), '#e8c870', 0.25 + rnd() * 0.15); x.beginPath(); for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.3); } x.closePath(); x.fill(); if (o.shellPattern) x.stroke(); }
      });
      const sc = [{ x: -bw * 0.46, c: 0, t: h * 0.9, b: h * 0.25, w: W * 1.1 }, { x: -bw * 0.12, c: 0, t: h * 1.4, b: h * 0.3, w: W * 1.38 }, { x: bw * 0.2, c: 0, t: h * 1.3, b: h * 0.3, w: W * 1.32 }, { x: bw * 0.44, c: 0, t: h * 0.85, b: h * 0.25, w: W * 1.05 }];
      k.mesh(loftGeo(sc, { cap0: 0.4, cap1: 0.4 }), texMat(k, 'shell', shellTex, 0.45), B, 0, 0.1 * h, 0);
      torso.scale.set(0.9, 0.7, 0.85);
    }
    // ---- wings (dragon: leathery; pegasus: feathered) ----
    const wings = o.wings ? buildWings(k, B, o, bw, h, W, name === 'pegasus' || !reptile, coatMat) : null;
    // ---- tail ----
    const tail = buildTail(k, B, o, name, bw, h, W, { coatMat, bodyMat, maneCol, body, reptile, hoofed });
    // ---- pose every frame ----
    return quadUpdate(e, k, { o, B, legs, NG, H, ears, tail, wings, trunk, hr, h, L, sprawl, hoofed, pillar, torso, name, SC });
  }
  function trunkPath(hr, tx, sway, curl) {
    const x = tx - 0.25 * hr, y = -0.2 * hr;
    return [[x, y, 0], [x + 0.55 * hr, y - 0.55 * hr, 0], [x + 0.6 * hr + sway * 0.4, y - 1.4 * hr, sway * 0.3], [x + 0.45 * hr + sway + curl, y - 2.2 * hr + curl * 0.8, sway * 0.6]];
  }

  // ---- tails: a bending tube (or a fluffy ball) that wags, sways, tucks ----
  function buildTail(k, B, o, name, bw, h, W, C) {
    const L = o.tailLen, kind = o.tail;
    if (kind === 'none') return null;
    const thickT = kind === 'thick' || (C.reptile && kind === 'thin');
    const rx = -bw / 2 + (thickT ? 0.9 * h : 1.6), ry = thickT ? 0.05 * h : 0.5 * h, T0 = { kind, L, rx, ry };
    if (kind === 'fluff') {
      const r = Math.max(2.4, h * 0.32) * (name === 'rabbit' ? 1.15 : 1);
      const m = k.mesh(loftGeo([{ x: -r * 0.5, c: 0, t: r, b: r, w: r }, { x: r * 0.3, c: 0, t: r, b: r, w: r }], { lump: 0.35, lumpF: 2.2 / r * 2, na: 8, radial: 12 }), /rabbit|deer|sheep|lamb/.test(name) ? k.mat(name === 'deer' ? '#f4f0e8' : k.col('wool'), { rough: 1 }) : C.coatMat, B, rx - r * 0.2, ry - 0.1 * h, 0);
      T0.ball = m; return T0;
    }
    const s = Math.max(0.6, h / 8);
    let rf, mat = C.coatMat;
    switch (kind) {
      case 'up': rf = u => s * (1.05 - 0.7 * u); break;
      case 'down': rf = u => s * (0.75 - 0.45 * u); break;
      case 'fan': rf = u => 1.0 + 1.9 * Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.62) * (1 - u * 0.3); mat = k.mat(C.maneCol, { rough: 0.95 }); break;
      case 'curl': rf = u => s * (0.55 - 0.3 * u); break;
      case 'long': rf = u => s * (0.85 - 0.45 * u); break;
      case 'thick': rf = u => h * 0.62 * Math.pow(1 - u, 0.9) + 0.4; mat = C.bodyMat; break;
      case 'bushy': { const R = L * 0.17 + 1; rf = u => R * (0.3 + 0.8 * Math.pow(Math.sin(u * Math.PI), 0.7)) * (1 - u * u * 0.6) + 0.2; if (name === 'raccoon') mat = texMat(k, 'rings', coatTex('rings|' + C.body, C.body, (x, S) => { x.fillStyle = '#26201c'; for (let i = 0; i < 5; i++) x.fillRect(0, (i * 0.2 + 0.05) * S, S, 0.09 * S); }), 0.95); break; }
      default: rf = thickT ? (u => h * 0.5 * Math.pow(1 - u, 1.1) + 0.25) : (u => s * (0.5 - 0.35 * u));
    }
    if (thickT) mat = C.bodyMat;
    T0.pts = [];
    T0.path = st => tailPath(T0, name, st, o);
    T0.mesh = k.tube(T0.path({ wz: 0, tuck: 0, t: 0 }), rf, 0, mat, B, 14, kind === 'bushy' || kind === 'fan' || thickT ? 12 : 8);
    if (kind === 'fan') T0.mesh.scale.z = 0.6;
    if (o.tuftTail) T0.tuft = k.sphere([1.6 * s, 2.6 * s, 1.6 * s], k.mat(kind === 'long' ? k.col('mane') : shade(C.body, 0.6), { rough: 1 }), B);
    if (name === 'fox') T0.tuft = k.sphere(L * 0.11, k.mat('#f6f2ea', { rough: 1 }), B);
    if (name === 'stegosaurus') { T0.tuft = k.group(B); const sm = k.mat(k.col('spike'), { rough: 0.5 }); for (const [a, b] of [[0.5, 1], [-0.5, 1], [0.5, -1], [-0.5, -1]]) { const c = k.cone(1.3, 9, sm, T0.tuft, 0, 0, 0, 8); c.rotation.set(b * 0.9, 0, a); c.position.set(a * 4, 3, b * 2); } }
    if (/dragon/.test(name) && thickT) { T0.tuft = k.group(B); const sp = k.extrude([0, 0, -4, 5, -11, 0, -4, -5], 1, k.mat(k.col('spike'), { rough: 0.5, side: 'double' }), T0.tuft, -3, 0, 0, 0.3); sp.rotation.x = Math.PI / 2; }
    return T0;
  }
  function tailPath(T0, name, st, o) {
    const { kind, L, rx, ry } = T0, wz = st.wz, tk = st.tuck, P = [];
    const add = (x, y, z) => { P.push([rx + x, ry + y, z || 0]); };
    add(0, 0, 0);
    switch (kind) {
      case 'up': add(-2.5, L * 0.35 * (1 - tk) - L * 0.2 * tk); add(-4.5, L * 0.75 * (1 - tk) - L * 0.6 * tk, wz * 0.5); add(-3.5 + tk * 2, L * (1 - 2 * tk), wz); break;
      case 'down': add(-2.5, -L * 0.3); add(-3 + tk * 2, -L * 0.7, wz * 0.3); add(-2.5 + tk * 3, -L, wz * 0.5); break;
      case 'fan': add(-3, 0.5); add(-5.5 + tk * 2, -L * 0.35, wz * 0.15); add(-6 + tk * 3, -L * 0.72, wz * 0.3); add(-5 + tk * 4, -L, wz * 0.45); break;
      case 'curl': for (let i = 1; i <= 9; i++) { const a = i / 9 * 2.3 * Math.PI + st.t * 0.5, r = 2.2 * (1 - i / 14); P.push([rx - 1.2 - i * 0.3, ry + 1 + Math.sin(a) * r, Math.cos(a) * r - r + wz * 0.05]); } break;
      case 'long': add(-L * 0.35, -L * 0.3); add(-L * 0.7, -L * (0.45 + 0.2 * tk), wz * 0.3); add(-L * (0.95 - tk * 0.4), -L * (0.25 + 0.5 * tk), wz * 0.6); add(-L * (1.02 - tk * 0.6), L * (0.12 - 0.8 * tk), wz); break;
      case 'thick': add(-L * 0.35, -0.12 * L * 0.2, wz * 0.3); add(-L * 0.7, -0.3 * L * 0.2, wz * 0.7); add(-L, -0.45 * L * 0.2, wz); break;
      case 'bushy':
        if (name === 'squirrel') { add(-L * 0.3, L * 0.15); add(-L * 0.42, L * 0.65, wz * 0.3); add(-L * 0.15, L * 1.0, wz * 0.5); add(L * 0.12, L * 0.92, wz * 0.6); }
        else if (name === 'wolf') { add(-L * 0.3, -L * 0.35); add(-L * 0.45, -L * 0.75, wz * 0.4); add(-L * 0.45 + tk * 3, -L, wz * 0.6); }
        else { add(-L * 0.3, -L * 0.22); add(-L * 0.65, -L * (0.36 + tk * 0.3), wz * 0.4); add(-L * (1 - tk * 0.3), -L * (0.3 + tk * 0.4), wz); }
        break;
      default:   // thin
        if (o.thickLegs || /hippo|rhino/.test(name)) { add(-1.5, -L * 0.45); add(-1, -L, wz * 0.4); }
        else if (T0.L > 12) { add(-L * 0.4, -L * 0.12); add(-L * 0.75, -L * 0.16, wz * 0.5); add(-L, -L * 0.05, wz); }
        else { add(-L * 0.5, -L * 0.3); add(-L, -L * 0.45, wz); }
    }
    return P;
  }

  // ---- wings: leathery (dragon) or feathered (pegasus); outer pivot per side ----
  function buildWings(k, B, o, bw, h, W, feather, boneMat) {
    const Sp = bw * (feather ? 0.7 : 1.05), out = [];
    const wm = k.mat(k.col('wing'), { rough: feather ? 0.85 : 0.7, side: 'double' });
    for (const s of [1, -1]) {
      const pv = k.group(B, bw * 0.12, h * 0.8, s * W * 0.5); pv.side = s; out.push(pv);
      const inr = k.group(pv); inr.scale.z = s;   // build the near wing; the far one is its mirror
      if (feather) {
        const pts = [0, 0, Sp * 0.18, Sp * 0.32, Sp * 0.12, Sp * 0.68, -Sp * 0.12, Sp * 1.02];
        for (let i = 0; i <= 7; i++) { const u = i / 7, x = -Sp * 0.12 - u * Sp * 0.6, y = Sp * (1.02 - u * 0.95); pts.push(x + Sp * 0.04, y - Sp * 0.05, x - Sp * 0.05, y - Sp * 0.07); }
        pts.push(-Sp * 0.5, 0);
        const f = k.extrude(pts, 1.1, wm, inr, 0, 0, 0, 0.4); f.rotation.x = Math.PI / 2;
        const cpts = [0, 0, Sp * 0.17, Sp * 0.3, Sp * 0.1, Sp * 0.6]; for (let i = 0; i <= 5; i++) { const u = i / 5; cpts.push(Sp * (0.05 - u * 0.4), Sp * (0.6 - u * 0.5) - Sp * 0.04 * (i % 2)); } cpts.push(-Sp * 0.32, 0);
        const c = k.extrude(cpts, 1.2, k.mat(mix(k.col('wing'), '#d8dde2', 0.35), { rough: 0.85, side: 'double' }), inr, 0, 0.9, 0, 0.4); c.rotation.x = Math.PI / 2;
      } else {
        const sh = [0, 0, 0], wr = [Sp * 0.12, 0.05 * Sp, Sp * 0.5], tips = [[-Sp * 0.15, 0, Sp * 1.0], [-Sp * 0.55, -0.03 * Sp, Sp * 0.88], [-Sp * 0.85, -0.05 * Sp, Sp * 0.55]], att = [-Sp * 0.6, 0, Sp * 0.05];
        const poly = [sh, wr, tips[0]], mid = (a, b) => [(a[0] + b[0]) / 2 * 0.86 + wr[0] * 0.14, (a[1] + b[1]) / 2 - 0.06 * Sp, (a[2] + b[2]) / 2 * 0.86 + wr[2] * 0.14];
        poly.push(mid(tips[0], tips[1]), tips[1], mid(tips[1], tips[2]), tips[2], mid(tips[2], att), att);
        const g = M3.geo('dwing:' + Math.round(Sp), () => {
          const P = []; for (let i = 2; i < poly.length - 1; i++) P.push(...wr, ...poly[i], ...poly[i + 1]);
          P.push(...wr, ...poly[poly.length - 1], ...sh);
          const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); gg.computeVertexNormals(); return gg;
        });
        k.mesh(g, wm, inr);
        const bm = boneMat, rb = Math.max(0.6, Sp * 0.025);
        k.tube([sh, [Sp * 0.05, 0.1 * Sp, Sp * 0.25], wr], rb * 1.6, rb * 1.1, bm, inr, 6, 6);
        for (const tp of tips) k.tube([wr, tp], rb, rb * 0.3, bm, inr, 4, 5);
        k.cone(rb * 0.9, rb * 4, k.mat('#2a2420'), inr, wr[0] + rb * 2, wr[1], wr[2]).rotation.z = -1.3;
      }
    }
    return out;
  }

  // ---- the quad's pose every frame ----
  function quadUpdate(e0, k, Q) {
    const { o, B, legs, NG, H, ears, tail, wings, trunk, hr, h, L, sprawl, hoofed } = Q;
    const abs = [0, 0, 0, 0], st = { wz: 0, tuck: 0, t: 0 };
    let frame = 0, open = 0, lie = 0, crouch = 0, tuckS = 0;
    const baseNeck = NG.rotation.z;
    return (e, t, dt) => {
      frame++;
      const held = e.held, flying = e.flying, inAir = !e.grounded && !held && !flying;
      const walking = e.moving && e.grounded && !flying && !held;
      const sleep = (e.sleeping || e.mood === 'sleep') && !held && e.grounded, scared = e.mood === 'scared', angry = e.mood === 'angry' || e.lungeT > 0;
      const ph = e.phase || 0, spd = Math.abs(e.vx || 0);
      const A = walking ? clamp(0.22 + spd / 700, 0.25, 0.62) : 0;
      const kd = Math.min(1, dt * 8);
      lie += ((sleep ? 1 : 0) - lie) * Math.min(1, dt * 3);
      crouch += ((scared && !held ? 1 : 0) - crouch) * kd;
      tuckS += ((scared ? 1 : 0) - tuckS) * kd;
      // body height: walking bob, scared crouch, lying down; breathing
      B.position.y = -(lie * (o.legLen * 0.9 + h * 0.08) + crouch * o.legLen * 0.18) + (walking ? Math.abs(Math.cos(ph)) * A * 0.9 : 0);
      const br = 1 + Math.sin(t * (sleep ? 1.6 : 2.6) + e.seed) * (sleep ? 0.022 : 0.012);
      Q.torso.scale.y = (o.shell ? 0.7 : 1) * br * (o.wool ? 1.08 : 1);
      B.rotation.z = walking ? Math.sin(ph * 2) * 0.012 : inAir ? clamp(-(e.vy || 0) / 2500, -0.15, 0.15) : 0;
      // legs
      for (const lg of legs) {
        const p = ph + lg.off, sw = Math.sin(p) * A, lift = Math.max(0, Math.cos(p)) * A * 1.7, r = lg.rest, n = r.length;
        if (sprawl) {
          lg.hip.rotation.y = walking ? Math.sin(p) * 0.5 * (lg.near ? 1 : -1) : held ? Math.sin(t * 9 + lg.off) * 0.3 : 0;
          lg.hip.rotation.z = walking ? lift * 0.3 : 0;
          lg.ch.joints[0].rotation.x = (lg.near ? -1 : 1) * (held ? 0.6 : 1.3 + lie * 0.25);
          continue;
        }
        let a0, a1, a2, a3;
        if (held) { const d = Math.sin(t * 9 + lg.off) * 0.25; a0 = r[0] * 0.3 + d; a1 = r[1] * 0.3 + d; a2 = (r[2] || 0) * 0.3 + d; a3 = d; }
        else if (lie > 0.5) { if (lg.front) { a0 = 1.2; a1 = 1.45; a2 = 1.5; a3 = 1.5; } else { a0 = 1.15; a1 = -1.45; a2 = 1.35; a3 = 1.4; } }
        else if (flying) { if (lg.front) { a0 = 0.7; a1 = -0.9; a2 = 0.1; a3 = 0.2; } else { a0 = -0.5; a1 = -0.8; a2 = -0.6; a3 = -0.5; } }
        else if (inAir) { const s = lg.front ? 0.45 : -0.45; a0 = r[0] + s; a1 = r[1] + s * 0.6 - (lg.front ? 0.4 : 0); a2 = (r[2] || 0) + s * 0.5; a3 = (r[3] || 0) + s * 0.3; }
        else if (e.ko) { a0 = r[0] * 0.4; a1 = r[1] * 0.4; a2 = (r[2] || 0) * 0.4; a3 = 0; }
        else {
          const cr = crouch * 0.35;
          if (lg.front) { a0 = r[0] + sw - cr * 0.5; a1 = r[1] + sw - lift * 0.9 + cr; a2 = (r[2] || 0) + sw - lift * 0.5 + cr * 0.4; a3 = (r[3] || 0) + sw * 0.5; }
          else { a0 = r[0] + sw + cr * 1.2; a1 = r[1] + sw - lift * 0.5 - cr * 1.4; a2 = (r[2] || 0) + sw + lift * 0.7 + cr * 0.6; a3 = (r[3] || 0) + sw * 0.5; }
        }
        abs[0] = a0; abs[1] = a1; abs[2] = a2; abs[3] = a3;
        if (n === 2) abs[1] = lie > 0.5 ? abs[1] : (abs[1] + abs[2]) / 2;
        const last = poseChain(lg.ch, abs);
        lg.foot.rotation.z = -last + (lie > 0.5 || flying || held ? last * 0.6 : 0);
      }
      // neck / head: bob with the stride, low when angry or scared, resting when asleep, looking about when held
      let nz = baseNeck + (walking ? Math.sin(ph * 2) * (hoofed ? 0.05 : 0.03) : Math.sin(t * 0.7 + e.seed) * 0.03);
      if (angry) nz -= 0.12; if (scared) nz -= 0.1; if (held) nz += Math.sin(t * 3) * 0.12;
      if (e.dizzy > 0) nz += Math.sin(t * 6) * 0.12;
      nz -= lie * (o.neckLen > 14 ? 0.35 : 0.22);
      NG.rotation.z = nz;
      NG.rotation.y = e.dizzy > 0 ? Math.sin(t * 5) * 0.2 : held ? Math.sin(t * 2.2) * 0.25 : 0;
      H.inner.rotation.x = e.dizzy > 0 ? Math.sin(t * 6 + 1) * 0.15 : 0;
      // mouth: wide in an attack, a snarl when angry, panting when happy
      const lunge = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * Math.PI) : 0;
      const want = Math.max(lunge * (hoofed ? 0.4 : 1), angry ? (hoofed ? 0.1 : 0.35) : 0, e.mood === 'happy' && !hoofed ? 0.2 + Math.sin(t * 9) * 0.06 : 0, scared ? 0.15 : 0, e.special === 'firebreath' && e.breath > 0 ? 0.8 : 0);
      open += (want - open) * Math.min(1, dt * 14);
      H.jaw.rotation.z = -open * (o.head === 'croc' ? 0.6 : 0.5);
      // ears: twitch now and then, back when angry or scared, flap for elephants
      const back = (angry || scared) ? 1 : 0, tw = Math.sin(t * 1.3 + e.seed * 3) > 0.97 ? 0.3 : 0;
      for (const ep of ears) { const b = ep.base; if (!b) continue; if (o.ears === 'big') { ep.rotation.y = b[1] + ep.side * (Math.sin(t * 2.2 + e.seed) * 0.18 + back * 0.3); continue; } ep.rotation.x = b[0] + ep.side * tw * 0.4; ep.rotation.z = b[2] - back * 0.55; }
      if (trunk && (frame & 1) === 0) trunk.geometry.setPath(trunkPath(hr, H.tipX, Math.sin(t * 1.8 + e.seed) * hr * 0.25, angry ? hr * 0.9 : (held ? hr * 0.5 : 0)));
      // tail: wag when happy, sway, tucked when scared, curled when asleep
      if (tail) {
        const wag = (o.wag && (e.mood === 'happy' || e.mode === 'approach')) ? Math.sin(t * 14) * tail.L * 0.35 : Math.sin(t * 2 + e.seed) * tail.L * 0.08 + (walking && o.tail === 'thick' ? Math.sin(ph) * tail.L * 0.12 : 0);
        st.wz = wag + lie * tail.L * 0.6; st.tuck = tuckS; st.t = t;
        if (tail.mesh && ((frame & 1) === 0 || frame < 3)) {
          const P = tail.path(st); tail.mesh.geometry.setPath(P);
          if (tail.tuft) { const a = P[P.length - 1], b = P[P.length - 2]; tail.tuft.position.set(a[0], a[1], a[2]); tail.tuft.rotation.z = Math.atan2(a[1] - b[1], a[0] - b[0]) + Math.PI / 2; }
        }
        if (tail.ball) tail.ball.rotation.y = Math.sin(t * 6) * 0.2;
      }
      // wings: flap in flight, folded at rest
      if (wings) for (const w of wings) {
        const s = w.side, fl = flying ? Math.sin(t * 7) * 0.85 + 0.1 : 0;
        const th = flying ? -fl : (o.head === 'long' && /dragon/.test(Q.name) ? -0.95 : -0.15), phi = flying ? -0.12 : -1.25;
        w.rotation.set(s * th, s * phi, 0);
      }
    };
  }

  M3.kinds.quad = quadBuild;

  // ---------- bipeds: T. rex, raptor, godzilla, kangaroo ----------
  function bipedBuild(e, k, tpl) {
    const o = tpl.o, g = tpl.g, SC = tpl.k || 1, name = e.def.name;
    const pal = e.pal || e.def.pal || {};
    const bw = o.bodyW, bh = o.bodyH, h = bh / 2, hr = o.headR, kanga = o.arms === 'kangaroo';
    const body = k.col('body'), belly = (pal.belly) || mix(body, kanga ? '#f4ead8' : '#e9e2b8', kanga ? 0.6 : 0.45);
    const pat = kanga ? null : patternFor(name, { scales: true }, body);
    const bodyTex = coatTex('bb|' + name + body, body, (x, S, rnd) => { if (pat) pat(x, S, rnd); const gr = x.createLinearGradient(0.5 * S, 0, S, 0); gr.addColorStop(0, rgba(belly, 0)); gr.addColorStop(0.5, rgba(belly, 0.9)); gr.addColorStop(1, rgba(belly, 0)); x.fillStyle = gr; x.fillRect(0.5 * S, 0, 0.5 * S, S); });
    const coat = coatTex('bc|' + name + body, body, (x, S, rnd) => { if (pat) pat(x, S, rnd); });
    const rough = kanga ? 0.9 : 0.6;
    const bodyMat = texMat(k, 'bb', bodyTex, rough), coatMat = texMat(k, 'bc', coat, rough), clawM = k.mat('#2b2622', { rough: 0.4 });
    const R = k.group(k.root, tpl.ox * SC, -tpl.oy * SC, 0); R.scale.setScalar(SC);
    const B = k.group(R), tilt = kanga ? 0.75 : 0.28, BB = k.group(B); BB.rotation.z = tilt;
    const W = bh * (kanga ? 0.4 : 0.44);
    const ctrl = kanga
      ? [{ x: -bw / 2 + 0.7 * h, c: -0.1 * h, t: 0.8 * h, b: 0.85 * h, w: 0.85 * W }, { x: -bw * 0.18, c: -0.05 * h, t: 1.0 * h, b: 1.05 * h, w: W }, { x: bw * 0.2, c: 0.05 * h, t: 0.78 * h, b: 0.82 * h, w: 0.8 * W }, { x: bw / 2 - 0.45 * h, c: 0.1 * h, t: 0.5 * h, b: 0.55 * h, w: 0.55 * W }]
      : [{ x: -bw / 2 + 0.7 * h, c: 0, t: 0.78 * h, b: 0.72 * h, w: 0.8 * W }, { x: -bw * 0.2, c: 0, t: 0.98 * h, b: 0.95 * h, w: W }, { x: bw * 0.15, c: -0.03 * h, t: 0.9 * h, b: 1.0 * h, w: 0.92 * W }, { x: bw / 2 - 0.6 * h, c: 0.05 * h, t: 0.65 * h, b: 0.72 * h, w: 0.7 * W }];
    const torso = k.mesh(loftGeo(ctrl), bodyMat, BB);
    if (o.pouch) k.sphere([bw * 0.2, h * 0.5, W * 0.6], k.mat(mix(belly, body, 0.25), { rough: 0.9 }), BB, bw * 0.08, -h * 0.5, 0);
    // legs: big thigh, shin, a long foot bone and toes (kangaroo: a long flat foot)
    const lr = bh * (kanga ? 0.13 : 0.17), hipY = -0.15 * h, L = o.legLen + h + hipY;
    const lay = kanga ? [[0.42, 1.0, 2.4, 1.3], [0.48, -0.9, 1.1, 0.6], [0.1, 0, 0.6, 0.55]] : [[0.38, 0.55, 2.3, 1.3], [0.36, -0.55, 1.2, 0.72], [0.26, 0.22, 0.72, 0.6]];
    const unit = L / lay.reduce((s, q) => s + q[0] * Math.cos(q[1]), 0);
    const legs = [];
    for (const near of [true, false]) {
      const hip = k.group(B, bw * 0.02 - (kanga ? bw * 0.12 : 0), hipY, (near ? 1 : -1) * W * 0.62);
      const segs = lay.map(q => ({ len: q[0] * unit, a: q[1], r0: lr * q[2], r1: lr * q[3] }));
      const ch = legChain(k, hip, 0, 0, 0, segs, coatMat);
      const foot = k.group(ch.tip);
      if (kanga) k.sphere([o.legLen * 0.42, lr * 0.5, lr * 0.75], coatMat, foot, o.legLen * 0.3, lr * 0.4, 0);
      else for (const a of [-0.45, 0, 0.45]) { const tg = k.group(foot, 0, lr * 0.3, 0); tg.rotation.y = a; k.limb(lr * 3, lr * 0.55, lr * 0.32, coatMat, tg, 0, 0, 0).rotation.z = 1.45; const cl = k.cone(lr * 0.3, lr * 1.1, clawM, tg, lr * 3.3, -lr * 0.1, 0, 6); cl.rotation.z = -1.9; }
      legs.push({ ch, foot, rest: segs.map(s => s.a), off: near ? 0 : Math.PI });
    }
    // thigh muscle
    for (const s of [1, -1]) k.sphere([bw * (kanga ? 0.2 : 0.24), h * (kanga ? 0.75 : 0.9), W * 0.42], coatMat, B, bw * 0.0 - (kanga ? bw * 0.12 : 0), hipY + h * 0.1, s * W * 0.55);
    // arms
    const arms = [];
    if (o.arms !== 'none') for (const s of [1, -1]) {
      const sh = k.group(BB, bw * 0.3, -0.25 * h, s * W * 0.62), al = kanga ? bh * 0.42 : bh * 0.28;
      const up = k.limb(al * 0.55, lr * 0.55, lr * 0.4, coatMat, sh, 0, 0, 0); up.rotation.z = 0.6 - tilt;
      const lo = k.limb(al * 0.5, lr * 0.4, lr * 0.3, coatMat, up, 0, -al * 0.55, 0); lo.rotation.z = 0.9;
      for (const a of [-0.3, 0.3]) { const c = k.cone(lr * 0.15, lr * 0.8, clawM, lo, lr * 0.2, -al * 0.5, a * lr, 6); c.rotation.z = Math.PI - 0.6; }
      arms.push({ up, lo, s });
    }
    // neck and head
    const nbx = g.nx - 2, nby = -g.ny - 1, NG = k.group(B, nbx, nby, 0);
    const hx = g.hx - nbx, hy = -g.hy - nby;
    const nr0 = (o.longNeck ? bh * 0.35 : bh * 0.5) * 0.55, nr1 = hr * 0.55;
    k.tube([[-3, -3, 0], [hx * 0.45, hy * 0.6, 0], [hx - hr * 0.5, hy - hr * 0.1, 0]], u => nr1 + (nr0 - nr1) * Math.pow(1 - u, 1.2), 0, coatMat, NG, 10, 14);
    const HG = k.group(NG, hx, hy, 0);
    const ho = { headR: hr, head: 'long', snout: false, snoutSize: 1, teeth: o.teeth, ears: o.ears, earSize: kanga ? 0.95 : 1, eyeR: o.eyeR, whiskers: false, nostrils: false, horns: 'none', beard: false };
    const H = buildHead(k, HG, ho, { headMat: coatMat, reptile: !kanga, eyeR: o.eyeR / 1.5 * (kanga ? 1.1 : 0.9), headRot: kanga ? 0.3 : 0.08, iris: kanga ? '#2a1a10' : '#c8901e', eyeWhite: kanga ? '#1a100a' : '#6a4a10', lid: body, noseCol: '#1a1412', predator: !kanga });
    H.inner.scale.x = clamp(o.headLen / 1.35, 0.9, 1.4);
    buildEars(k, H, ho, { earMat: coatMat });
    if (!kanga) { const br = k.sphere([hr * 0.45, hr * 0.16, hr * 0.3], coatMat, H.inner, 0.05 * hr, 0.48 * hr, 0.42 * hr); br.rotation.z = -0.15; const br2 = k.sphere([hr * 0.45, hr * 0.16, hr * 0.3], coatMat, H.inner, 0.05 * hr, 0.48 * hr, -0.42 * hr); br2.rotation.z = -0.15; }   // heavy brows
    if (kanga) k.sphere([hr * 0.14, hr * 0.1, hr * 0.2], k.mat('#1a1412', { rough: 0.3 }), H.inner, H.tipX - 0.08 * hr, 0.08 * hr, 0);
    if (o.crest) { const c = k.cone(hr * 0.35, hr * 1.4, k.mat(k.col('spike'), { rough: 0.5 }), H.inner, -0.3 * hr, 0.9 * hr, 0, 8); c.rotation.z = 0.9; c.scale.z = 0.3; }
    // back spikes / plates down the spine and the tail
    if (o.spikes || o.plates) {
      const pieces = [], n = 7;
      for (let i = 0; i < n; i++) { const u = i / (n - 1), x = -bw * 0.42 + u * bw * 0.8, big = 0.5 + 0.5 * Math.sin(u * Math.PI); pieces.push(conePiece([x, h * (0.92 - 0.2 * (2 * x / bw) ** 2), 0], [-0.3, 1, 0], (o.plates ? 4 : 2.6) * big + 1, (o.plates ? 9 : 7) * big + 2, o.plates ? 0.18 : 0.4)); }
      k.mesh(mergeGeo('bspk:' + name + bw, pieces), k.mat(k.col('spike'), { rough: 0.5 }), BB);
    }
    const wings = o.wings ? buildWings(k, BB, o, bw, h, W, false, coatMat) : null;
    // tail: thick at the hips, tapering; the kangaroo props itself on it
    const tl = o.tailLen, tx = -bw / 2 + 2, ty = kanga ? -h * 0.9 : 0.05 * h;
    const tailPts = (sw, tk) => kanga
      ? [[tx, ty, 0], [tx - tl * 0.35, ty - h * 0.6, sw * 0.2], [tx - tl * 0.7, -h - o.legLen + 2.5 + tk, sw * 0.5], [tx - tl, -h - o.legLen + 1.5 + tk * 1.5, sw]]
      : [[tx, ty, 0], [tx - tl * 0.35, ty - h * 0.15, sw * 0.25], [tx - tl * 0.7, ty - h * 0.35, sw * 0.6], [tx - tl, ty - h * 0.45 + tk, sw]];
    const tail = k.tube(tailPts(0, 0), u => h * (kanga ? 0.42 : 0.62) * Math.pow(1 - u, 0.9) + 0.4, 0, bodyMat, B, 14, 12);
    let frame = 0, open = 0, lie = 0;
    const abs = [0, 0, 0];
    return (e, t, dt) => {
      frame++;
      const held = e.held, inAir = !e.grounded && !held && !e.flying, walking = e.moving && e.grounded && !held;
      const sleep = (e.sleeping || e.mood === 'sleep') && !held && e.grounded, angry = e.mood === 'angry' || e.lungeT > 0;
      const ph = e.phase || 0, A = walking ? clamp(0.25 + Math.abs(e.vx || 0) / 800, 0.3, 0.6) : 0;
      lie += ((sleep ? 1 : 0) - lie) * Math.min(1, dt * 3);
      B.position.y = -lie * (o.legLen * 0.85) + (walking && !kanga ? Math.abs(Math.cos(ph)) * A * 1.2 : 0);
      torso.scale.y = 1 + Math.sin(t * 2.2 + e.seed) * 0.015;
      B.rotation.z = walking && !kanga ? Math.sin(ph * 2) * 0.02 : lie * -0.15;
      for (const lg of legs) {
        const r = lg.rest, p = ph + (kanga ? 0 : lg.off), sw = Math.sin(p) * A, lift = Math.max(0, Math.cos(p)) * A * 1.6;
        if (held) { const d = Math.sin(t * 9 + lg.off) * 0.3; abs[0] = r[0] * 0.3 + d; abs[1] = r[1] * 0.3 + d; abs[2] = d; }
        else if (lie > 0.5) { abs[0] = 1.3; abs[1] = -1.5; abs[2] = 1.4; }
        else if (inAir) { abs[0] = kanga ? -0.3 : r[0] + 0.3; abs[1] = kanga ? -0.6 : r[1] - 0.2; abs[2] = kanga ? -1.2 : 0.2; }
        else { abs[0] = r[0] + sw; abs[1] = r[1] + sw - lift * 0.6; abs[2] = r[2] + sw + lift * 0.6; }
        const last = poseChain(lg.ch, abs); lg.foot.rotation.z = -last + (held ? last * 0.6 : 0);
      }
      const lunge = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * Math.PI) : 0;
      open += (Math.max(lunge, angry && !kanga ? 0.45 + Math.sin(t * 5) * 0.08 : 0, e.mood === 'scared' ? 0.2 : 0) - open) * Math.min(1, dt * 12);
      H.jaw.rotation.z = -open * 0.6;
      NG.rotation.z = (walking ? Math.sin(ph * 2) * 0.05 : Math.sin(t * 0.8 + e.seed) * 0.04) - (angry ? 0.1 : 0) - lie * 0.25 + (held ? Math.sin(t * 3) * 0.12 : 0);
      for (const a of arms) { a.up.rotation.x = held ? Math.sin(t * 15 + a.s) * 0.4 : 0; a.lo.rotation.z = 0.9 + (kanga && angry ? Math.sin(t * 12 + a.s * 2) * 0.6 : 0) + (held ? 0.4 : 0); }
      if ((frame & 1) === 0 || frame < 3) tail.geometry.setPath(tailPts(Math.sin(t * 1.8 + e.seed) * tl * 0.12 + (walking ? Math.sin(ph) * tl * 0.08 : 0) + lie * tl * 0.4, inAir ? h * 0.8 : 0));
      if (wings) for (const w of wings) { const fl = e.flying ? Math.sin(t * 7) * 0.85 : 0; w.rotation.set(w.side * (e.flying ? -fl : -0.9), w.side * (e.flying ? -0.1 : -1.1), 0); }
    };
  }
  M3.kinds.biped = bipedBuild;

  // ---------- frog: crouched, folded hind legs, bulging eyes ----------
  M3.kinds.frog = function (e, k, tpl) {
    const SC = tpl.k || 1, body = k.col('body'), belly = mix(body, '#f4f0c8', 0.6);
    const tex = coatTex('frog|' + body, body, (x, S, rnd) => { for (let i = 0; i < 26; i++) { const r = (0.02 + rnd() * 0.03) * S; x.fillStyle = rgba(shade(body, 0.45), 0.8); x.beginPath(); x.ellipse(rnd() * S, rnd() * S, r, r * 0.8, 0, 0, TAU); x.fill(); } const gr = x.createLinearGradient(0.5 * S, 0, S, 0); gr.addColorStop(0, rgba(belly, 0)); gr.addColorStop(0.5, rgba(belly, 1)); gr.addColorStop(1, rgba(belly, 0)); x.fillStyle = gr; x.fillRect(0.5 * S, 0, 0.5 * S, S); });
    const skin = texMat(k, 'frog', tex, 0.35), plain = k.mat(shade(body, 0.08), { rough: 0.4 });
    const R = k.group(k.root); R.scale.setScalar(SC);
    const B = k.group(R);
    const ctrl = [{ x: -10, c: -2, t: 5, b: 5, w: 6.5 }, { x: -3, c: -0.5, t: 7, b: 6.5, w: 8.5 }, { x: 5, c: 1, t: 5.8, b: 5.5, w: 7.8 }, { x: 10.5, c: 0.5, t: 3.2, b: 3.4, w: 5.5 }];
    const torso = k.mesh(loftGeo(ctrl, { cap1: 0.8 }), skin, B); torso.rotation.z = 0.12;
    const throat = k.sphere([4.5, 2.4, 4.4], k.mat(belly, { rough: 0.5 }), B, 7, -3.2, 0);
    for (const s of [1, -1]) { k.sphere(2.7, skin, B, 5, 5.8, s * 3.6); k.eye(2.2, B, 5.3, 6.4, s * 4.0, { dir: [0.3, 0.25, s], iris: '#c9a227', white: '#8a6a10', lid: body }); }
    k.tube([[1, -0.8, 6.6], [8, 0.2, 5.2], [12.2, 0.8, 0], [8, 0.2, -5.2], [1, -0.8, -6.6]], 0.3, 0.3, k.mat('#2c2418', { rough: 0.6 }), B, 18, 5);
    for (const s of [1, -1]) k.sphere(0.35, k.mat('#1a1410'), B, 11.6, 2.6, s * 1.2);
    // hind legs: thigh, shin, long webbed foot
    const legs = [];
    for (const s of [1, -1]) {
      const hip = k.group(B, -7, -2.5, s * 6.2);
      const ch = legChain(k, hip, 0, 0, 0, [{ len: 9, r0: 3.2, r1: 2.2, a: 1.3 }, { len: 9, r0: 2.1, r1: 1.3, a: -1.5 }, { len: 4.5, r0: 1.2, r1: 0.9, a: 1.2 }], plain);
      const foot = k.group(ch.tip);
      for (const a of [-0.4, 0, 0.4]) { const tg = k.group(foot, 0, 0.3, 0); tg.rotation.y = a; k.limb(5, 0.55, 0.45, plain, tg).rotation.z = 1.5; k.sphere(0.6, plain, tg, 5.2, 0.1, 0); }
      const web = k.extrude([0, 0, 5, 2.4, 5.4, 0, 5, -2.4], 0.3, k.mat(mix(body, '#e8d890', 0.3), { rough: 0.5, side: 'double' }), foot, 0, 0.2, 0, 0); web.rotation.x = Math.PI / 2;
      legs.push({ ch, foot, s });
    }
    // front legs with splayed fingers
    const arms = [];
    for (const s of [1, -1]) {
      const sh = k.group(B, 6, -3, s * 4.6);
      const ch = legChain(k, sh, 0, 0, 0, [{ len: 4, r0: 1.5, r1: 1.1, a: -0.3 }, { len: 3.8, r0: 1.1, r1: 0.8, a: 0.25 }], plain);
      const hand = k.group(ch.tip); for (const a of [-0.6, 0, 0.6]) { const tg = k.group(hand); tg.rotation.y = a + s * 0.3; k.limb(2.4, 0.35, 0.3, plain, tg).rotation.z = 1.5; k.sphere(0.5, plain, tg, 2.6, 0, 0); }
      arms.push({ ch, hand });
    }
    const abs = [0, 0, 0];
    let open = 0;
    return (e, t, dt) => {
      const inAir = !e.grounded && !e.held, held = e.held;
      throat.scale.y = 2.4 * (1 + Math.max(0, Math.sin(t * 4 + e.seed)) * 0.35);
      B.rotation.z = inAir ? clamp(-(e.vy || 0) / 1500, -0.4, 0.4) : 0;
      for (const lg of legs) {
        if (inAir || held) { const d = held ? Math.sin(t * 8 + lg.s) * 0.3 : 0; abs[0] = -1.2 + d; abs[1] = -1.5 + d; abs[2] = -1.6; }
        else { abs[0] = 1.3; abs[1] = -1.5; abs[2] = 1.2; }
        const last = poseChain(lg.ch, abs); lg.foot.rotation.z = -last + (inAir || held ? -0.3 : 0);
      }
      for (const a of arms) { const l = poseChain(a.ch, inAir ? [0.9, 1.1] : held ? [Math.sin(t * 9) * 0.3, 0.2] : [-0.3, 0.25]); a.hand.rotation.z = -l; }
      open += ((e.mood === 'scared' || e.lungeT > 0 ? 1 : 0) - open) * Math.min(1, dt * 10);
      torso.rotation.z = 0.12 - open * 0.05;
    };
  };
  // FROG_BUILD
})();
