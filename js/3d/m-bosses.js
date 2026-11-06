'use strict';
// m-bosses.js — 3D models (see js/3d/r3d.js for the model kit) for the first seven bosses: the kraken, the mega
// robot, king kong, the hydra, the lava golem, the giant spider and the giant moth.
// Each boss is built at the size of its 2D drawing (the def's template before drawK) and its root is scaled by
// drawK, so model units are the same numbers bosses.js uses (y flipped: +y is up). Mouths, visors, fangs and
// antennae sit where the game spawns that boss's fire, lasers, webs and beams (D.hydraMouths, D.spiderMouth...).
(function () {
  if (!SB.M3 || !window.THREE) return;
  const T = THREE, M3 = SB.M3, D = SB.D, TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, s) => a + (b - a) * s;
  const damp = (a, b, r, dt) => a + (b - a) * Math.min(1, r * dt);
  const mix = (a, b, s) => SB.mixColor(a, b, s);
  const rng = s => { s = (Math.abs(Math.floor(s)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const palOf = e => e.pal || e.def.pal || {};
  const glowOf = (e, d) => { const p = palOf(e); return p.eyeGlow || p.eye || d; };
  const named = M3.named;

  // the boss's own drawing scale: build at the 2D drawing's size, scale the whole model by drawK
  function rootOf(e, k) { const g = k.group(k.root); g.scale.setScalar(e.def.drawK || 1); return g; }
  const angryOf = e => e.mood === 'angry' || e.mode === 'hunt';

  // ---------- detail textures: mostly light grey, multiplied by the palette colour (so every palette still works) ----------
  const TEX = {};
  function canvasTex(key, w, h, paint, rep) {
    if (TEX[key]) return TEX[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    paint(x, w, h, rng(key.length * 7919 + key.charCodeAt(0) * 131));
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    if (rep) t.repeat.set(rep[0], rep[1]);
    return (TEX[key] = t);
  }
  const strokes = (x, w, h, r, n, len, ang, spread, lo, hi, a, lw) => {
    x.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const px = r() * w, py = r() * h, l = len * (0.5 + r()), an = ang + (r() - 0.5) * spread, v = lo + r() * (hi - lo) | 0;
      x.strokeStyle = `rgba(${v},${v},${v},${a})`; x.lineWidth = lw * (0.6 + r() * 0.8);
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(an) * l * 0.5 + (r() - 0.5) * 2, py + Math.sin(an) * l * 0.5, px + Math.cos(an) * l, py + Math.sin(an) * l); x.stroke();
    }
  };
  const blots = (x, w, h, r, n, r0, r1, lo, hi, a) => { for (let i = 0; i < n; i++) { const v = lo + r() * (hi - lo) | 0; x.fillStyle = `rgba(${v},${v},${v},${a})`; x.beginPath(); x.ellipse(r() * w, r() * h, r0 + r() * (r1 - r0), r0 + r() * (r1 - r0), r() * 3, 0, TAU); x.fill(); } };
  const TX = {
    fur: () => canvasTex('fur', 256, 256, (x, w, h, r) => { x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, w, h); blots(x, w, h, r, 60, 8, 26, 150, 230, 0.25); strokes(x, w, h, r, 5200, 9, Math.PI / 2, 0.7, 70, 255, 0.55, 1.3); }, [3, 3]),
    hair: () => canvasTex('hair', 256, 256, (x, w, h, r) => { x.fillStyle = '#bdbdbd'; x.fillRect(0, 0, w, h); strokes(x, w, h, r, 4200, 6, Math.PI / 2, 1.6, 40, 255, 0.6, 1); strokes(x, w, h, r, 160, 18, Math.PI / 2, 0.5, 200, 255, 0.5, 0.9); }, [2, 2]),
    mottle: () => canvasTex('mottle', 256, 256, (x, w, h, r) => {
      x.fillStyle = '#dcdcdc'; x.fillRect(0, 0, w, h); blots(x, w, h, r, 90, 6, 22, 150, 255, 0.18);
      blots(x, w, h, r, 900, 0.8, 3.2, 40, 90, 0.5); blots(x, w, h, r, 300, 0.6, 1.6, 255, 255, 0.35);
      strokes(x, w, h, r, 120, 30, 0, 0.3, 90, 140, 0.25, 1.4);   // skin folds
    }, [2, 2]),
    rock: () => canvasTex('rock', 256, 256, (x, w, h, r) => { x.fillStyle = '#c4c0bc'; x.fillRect(0, 0, w, h); blots(x, w, h, r, 260, 3, 22, 70, 230, 0.22); blots(x, w, h, r, 1800, 0.5, 1.8, 30, 255, 0.45); strokes(x, w, h, r, 90, 26, 0, 6, 30, 70, 0.5, 1.4); }, [1, 1]),
    cracks: () => canvasTex('cracks', 256, 256, (x, w, h, r) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.lineCap = x.lineJoin = 'round';
      const crack = (px, py, an, len, wd, depth) => {
        const pts = [[px, py]]; let cx = px, cy = py;
        for (let i = 0; i < 6; i++) { an += (r() - 0.5) * 1.2; cx += Math.cos(an) * len / 6; cy += Math.sin(an) * len / 6; pts.push([cx, cy]); }
        for (const [col, lw, blur] of [['#ff4a00', wd * 2.4, 10], ['#ff8a1a', wd * 1.3, 4], ['#ffe08a', wd * 0.5, 0]]) {
          x.strokeStyle = col; x.lineWidth = lw; x.shadowColor = '#ff3a00'; x.shadowBlur = blur; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke();
        }
        if (depth < 2) for (let i = 0; i < 2; i++) { const p = pts[2 + (r() * 4 | 0)]; crack(p[0], p[1], an + (r() - 0.5) * 2.4, len * 0.5, wd * 0.6, depth + 1); }
      };
      for (let i = 0; i < 9; i++) crack(r() * w, r() * h, r() * TAU, 70 + r() * 70, 2.2 + r() * 1.5, 0);
      x.shadowBlur = 0;
    }, [1, 1]),
    grime: () => canvasTex('grime', 256, 256, (x, w, h, r) => {
      x.fillStyle = '#d6d6d6'; x.fillRect(0, 0, w, h); blots(x, w, h, r, 120, 4, 20, 150, 240, 0.2);
      x.strokeStyle = 'rgba(30,30,30,0.55)'; x.lineWidth = 1.6;                                   // panel seams and rivets
      for (let i = 0; i < 7; i++) { const y = r() * h; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); const xx = r() * w; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, h); x.stroke(); }
      for (let i = 0; i < 140; i++) { x.fillStyle = i % 2 ? 'rgba(40,40,40,0.6)' : 'rgba(250,250,250,0.5)'; x.beginPath(); x.arc(r() * w, r() * h, 1.3, 0, TAU); x.fill(); }
      for (let i = 0; i < 26; i++) {                                                               // rust running down from the seams
        const px = r() * w, py = r() * h, L = 20 + r() * 60, g = x.createLinearGradient(px, py, px, py + L);
        g.addColorStop(0, 'rgba(150,72,30,0.75)'); g.addColorStop(1, 'rgba(150,72,30,0)'); x.fillStyle = g; x.fillRect(px - 2 - r() * 4, py, 3 + r() * 7, L);
      }
      strokes(x, w, h, r, 70, 16, 0.4, 1.5, 235, 255, 0.55, 0.8);                                // scratches
    }, [1, 1]),
    scales: () => canvasTex('scales', 256, 256, (x, w, h) => {
      x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, w, h);
      const sw = 16, sh = 12;
      for (let row = -1; row < h / sh + 1; row++) for (let col = -1; col < w / sw + 1; col++) {
        const cx = col * sw + (row % 2) * sw / 2, cy = row * sh, g = x.createRadialGradient(cx, cy - 3, 1, cx, cy, sw * 0.62);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#d0d0d0'); g.addColorStop(1, '#6a6a6a');
        x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, sw * 0.56, sh * 0.85, 0, 0, Math.PI); x.fill();
      }
    }, [5, 3]),
  };
  // a material with detail maps (made through k.mat so it follows hit flash / invisibility; the tag keeps its cache key apart)
  function tmat(k, col, o, maps) {
    const m = k.mat(col, Object.assign({ tag: maps.tag }, o));
    if (!m.userData.maps) { m.userData.maps = 1; for (const key in maps) if (key !== 'tag') m[key] = maps[key]; m.needsUpdate = true; }
    return m;
  }

  // ---------- geometry helpers ----------
  function merge(list) {
    const gs = list.map(g => g.index ? g.toNonIndexed() : g); let n = 0;
    for (const g of gs) { if (!g.attributes.normal) g.computeVertexNormals(); n += g.attributes.position.count; }
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const g of gs) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); out.setAttribute('uv', new T.BufferAttribute(U, 2));
    out.computeBoundingSphere(); return out;
  }
  const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _d = new T.Vector3();
  const UP = new T.Vector3(0, 1, 0), DOWN = new T.Vector3(0, -1, 0), XA = new T.Vector3(1, 0, 0);
  // a cone from (x0,y0,z0) to the tip (x1,y1,z1), as a geometry to merge
  function spikeGeo(x0, y0, z0, x1, y1, z1, r, seg) {
    const c = new T.ConeGeometry(r, 1, seg || 5, 1); c.translate(0, 0.5, 0);
    _d.set(x1 - x0, y1 - y0, z1 - z0); const L = _d.length() || 1; _d.divideScalar(L);
    _m4.compose(_p.set(x0, y0, z0), _q.setFromUnitVectors(UP, _d), _s.set(1, L, 1)); return c.applyMatrix4(_m4);
  }
  // a limb like k.limb (hangs down from its joint) covered in stiff bristles: spider legs
  function hairyLimb(len, r0, r1, n, hl) {
    return M3.geo('bhairy:' + [len, r0, r1, n, hl].join(':'), () => {
      const prof = [], N = 5, parts = [];
      for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + i / N * Math.PI / 2; prof.push(new T.Vector2(Math.max(0, Math.cos(a) * r1), -len + Math.sin(a) * r1)); }
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI / 2; prof.push(new T.Vector2(Math.max(0, Math.cos(a) * r0), Math.sin(a) * r0)); }
      parts.push(new T.LatheGeometry(prof, 9));
      const r = rng(len * 13 + r0 * 7 + n);
      for (let i = 0; i < n; i++) {
        const u = 0.06 + r() * 0.9, a = r() * TAU, rr = (r0 + (r1 - r0) * u) * 0.92, L = hl * (0.55 + r() * 0.8);
        const x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr, y0 = -len * u, dx = Math.cos(a), dz = Math.sin(a), dy = -0.7 - r() * 0.8, dl = Math.hypot(dx, dy, dz);
        parts.push(spikeGeo(x0, y0, z0, x0 + dx / dl * L, y0 + dy / dl * L, z0 + dz / dl * L, Math.max(0.22, rr * 0.12), 3));
      }
      return merge(parts);
    });
  }
  // a craggy boulder: an icosahedron pushed in and out by a few smooth waves (shared per seed)
  function rockGeo(seed) {
    return M3.geo('brock:' + seed, () => {
      const g = new T.IcosahedronGeometry(1, 1), P = g.attributes.position, v = new T.Vector3(), r = rng(seed * 7919 + 3), A = [];
      for (let i = 0; i < 5; i++) A.push([new T.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 2 + r() * 4, r() * 6, 0.05 + r() * 0.08]);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).normalize(); let s = 1;
        for (const [d, f, ph, amp] of A) s += Math.sin(v.dot(d) * f + ph) * amp;
        P.setXYZ(i, v.x * s, v.y * s, v.z * s);
      }
      g.computeVertexNormals(); return g;
    });
  }
  // two-bone IK in the parent's space: `up` (at the root) and `lo` (its child at (0,-a,0)) are joints whose bones hang
  // down -y; they turn so the chain ends at (tx,ty,tz) with the middle joint bending toward the pole direction.
  // If `end` is given it is turned to stay level with the parent (feet, fists).
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _q2 = new T.Quaternion();
  function ik(up, lo, a, b, tx, ty, tz, px, py, pz, end) {
    const s = up.position, dir = _a.set(tx - s.x, ty - s.y, tz - s.z); let d = dir.length() || 1e-3; dir.divideScalar(d);
    d = clamp(d, Math.abs(a - b) + 0.5, a + b - 0.05);
    const cA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sA = Math.sqrt(1 - cA * cA);
    const perp = _b.set(px, py, pz); perp.addScaledVector(dir, -perp.dot(dir)); if (perp.lengthSq() < 1e-6) perp.set(-dir.y, dir.x, 0); perp.normalize();
    const u = _c.copy(dir).multiplyScalar(cA).addScaledVector(perp, sA);            // the upper bone
    up.quaternion.setFromUnitVectors(DOWN, u);
    const l = perp.copy(dir).multiplyScalar(d).addScaledVector(u, -a).normalize();   // the lower bone
    _q2.setFromUnitVectors(DOWN, l); lo.quaternion.copy(up.quaternion).invert().multiply(_q2);
    if (end) end.quaternion.copy(_q2).invert();
  }
  // point a joint whose bone hangs down -y along a direction
  const aimDown = (o, dx, dy, dz) => { _d.set(dx, dy, dz).normalize(); o.quaternion.setFromUnitVectors(DOWN, _d); };
  // points on a quadratic curve into an array of [x,y,z] (reused every frame)
  function qcurve(out, x0, y0, z0, cx, cy, cz, x1, y1, z1) {
    const n = out.length - 1;
    for (let i = 0; i <= n; i++) { const s = i / n, m = 1 - s, p = out[i]; p[0] = m * m * x0 + 2 * m * s * cx + s * s * x1; p[1] = m * m * y0 + 2 * m * s * cy + s * s * y1; p[2] = m * m * z0 + 2 * m * s * cz + s * s * z1; }
    return out;
  }
  const pts = n => { const a = []; for (let i = 0; i < n; i++) a.push([0, 0, 0]); return a; };
  // a flickering flame: an outer and an inner glowing cone
  function flame(k, parent, x, y, z, s) {
    const f = k.group(parent, x, y, z);
    const om = k.mat('#ff3000', { glow: '#ff2a00', glowK: 1.5, opacity: 0.86, tag: 'fl' }), im = k.mat('#ffb030', { glow: '#ff9010', glowK: 1.6, opacity: 0.92, tag: 'fl2' });
    const tongues = [];
    for (let j = 0; j < 3; j++) {   // a few licking tongues round a hot core
      const a = j / 3 * TAU, tg = k.group(f, Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28);
      const c = k.cone(0.42, 1, om, tg, 0, 0.5, 0, 7); c.castShadow = false; tongues.push(tg);
    }
    const i = k.cone(0.4, 0.75, im, f, 0, 0.36, 0, 8); i.castShadow = false;
    const b = k.sphere([0.45, 0.3, 0.45], im, f, 0, 0.1, 0); b.castShadow = false;
    f.scale.setScalar(s); f.s = s; f.seed = x * 0.37 + y * 0.11 + z * 0.7;
    f.tick = t => {
      const q = 1 + Math.sin(t * 17 + f.seed * 9) * 0.15;
      f.scale.set(f.s, f.s * 1.25 * q, f.s); f.rotation.z = Math.sin(t * 9 + f.seed) * 0.1;
      tongues.forEach((tg, j) => { const w = Math.sin(t * (19 + j * 5) + f.seed * 3 + j * 2); tg.scale.set(1, 0.8 + w * 0.35 + j * 0.1, 1); tg.rotation.z = w * 0.25; });
    };
    return f;
  }

  // =====================================================================================================
  // THE KRAKEN: a giant squid reared up on its arms. Tall mottled mantle with fins, huge lateral slit eyes, a
  // parrot beak, eight suckered arms splayed over the ground and two long club tentacles; the near one whips.
  // =====================================================================================================
  named['kraken'] = function (e, k) {
    const g = rootOf(e, k), BODY = k.col('body');
    const skin = tmat(k, BODY, { rough: 0.38 }, { tag: 'krk', map: TX.mottle(), bumpMap: TX.mottle(), bumpScale: 0.6 });
    const finM = tmat(k, k.col('fin'), { rough: 0.4, side: 'double' }, { tag: 'krkf', map: TX.mottle() });
    const suck = k.mat(mix(BODY, '#f4d2c6', 0.62), { rough: 0.3 }), pale = k.mat(mix(BODY, '#e9b9ae', 0.5), { rough: 0.35 });
    const beakM = k.mat(k.col('beak'), { rough: 0.22, metal: 0.1 }), dark = k.mat(mix(BODY, '#000', 0.6), { rough: 0.5 });
    const scarM = k.mat(mix(BODY, '#f2cfc6', 0.55), { rough: 0.55 }), gum = k.mat('#2a0608', { rough: 0.6 });
    const drool = k.mat('#c4e0b0', { rough: 0.1, opacity: 0.72 }), toothM = k.mat('#efe6d2', { rough: 0.3 });
    const glow = glowOf(e, '#ffd23f');
    const bod = k.group(g, 0, 0, 0);
    // head: a muscular collar the arms grow from
    k.sphere([31, 24, 31], skin, bod, 4, 0, 0);
    k.sphere([24, 10, 24], pale, bod, 2, -15, 0);
    // mantle, leaning back a little, breathing
    const mant = k.group(bod, -2, 6, 0); mant.rotation.z = 0.13;
    const prof = [[0, -12], [26, -10], [31, 6], [34, 28], [33, 50], [27, 70], [18, 86], [8, 95], [0, 97]];
    k.lathe(prof, skin, mant, 0, 0, 0, 28);
    const mR = y => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const a = prof[i - 1], b = prof[i]; return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])); } return 0; };
    // old scars raked across the mantle
    for (const [h, a, tilt, L] of [[44, 0.6, 0.7, 13], [56, 0.95, 0.5, 9], [30, 1.35, -0.4, 10], [50, -0.8, 0.6, 12], [38, 2.4, -0.5, 10]]) {
      const r = mR(h), s = k.sphere([0.9, L, 1.5], scarM, mant, Math.cos(a) * r * 0.98, h, Math.sin(a) * r * 0.98);
      s.rotation.order = 'YXZ'; s.rotation.y = -a; s.rotation.x = tilt;
    }
    // fins at the mantle tip, one each side
    const fins = [];
    for (const sd of [1, -1]) {
      const piv = k.group(mant, -mR(66) * 0.3, 50, sd * mR(66) * 0.8); piv.rotation.y = sd * 0.75;
      const f = k.extrude([0, -2, 14, 6, 30, 22, 34, 32, 24, 40, 8, 46, 0, 44], 2.6, finM, piv, 0, 0, 0, 1);
      f.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; fins.push(piv);
    }
    // eyes: huge, glowing, slit, set in dark sockets under a heavy fold
    for (const sd of [1, -1]) {
      k.sphere([10, 11, 6], dark, bod, 15, 4, sd * 24);
      k.eye(9.5, bod, 15, 4, sd * 25.5, { dir: [0.55, 0.05, sd], glow });
      const lid = k.sphere([13, 4.2, 7], skin, bod, 14, 13.5, sd * 24.5); lid.rotation.z = -0.28; lid.rotation.x = sd * 0.25;
    }
    // beak: a hooked upper mandible and a lower jaw that gapes when angry
    const beak = k.group(bod, 26, -12, 0);
    const ub = k.cone(5.2, 15, beakM, beak, 4, -4, 0); ub.rotation.z = -2.25;
    const jaw = k.group(beak, -2, -2, 0);
    const lb = k.cone(4.2, 11, beakM, jaw, 2, -6, 0); lb.rotation.z = -2.75;
    k.sphere([6, 4, 6], gum, beak, 1, -5, 0);
    for (const z of [-2.5, 0, 2.5]) { const tt = k.cone(0.9, 3.2, toothM, jaw, 4.5, -3, z); tt.rotation.z = -0.4; }
    const drop = k.sphere([1.6, 2.4, 1.6], drool, beak, 7, -14, 0); drop.castShadow = false;

    // arms: tapered suckered tubes, splayed all round and curling at the tips
    const rad = u => 1.3 + 9.6 * Math.pow(1 - u, 1.15);
    const arms = [];
    for (let i = 0; i < 8; i++) {
      const P = pts(7), a = (i + 0.5) / 8 * TAU + 0.12;
      const m = k.tube([[0, 0, 0], [1, -1, 0]], rad, 0, skin, bod, 18, 9);
      const su = []; for (let j = 2; j <= 6; j++) su.push(k.sphere(1, suck, bod, 0, 0, 0));
      arms.push({ P, a, m, su, ph: i * 0.8 });
    }
    // the two long feeding tentacles with spade clubs; the near one (+z) is the whip
    const tents = [];
    for (const sd of [1, -1]) {
      const P = pts(8), m = k.tube([[0, 0, 0], [1, 1, 1]], u => 3.6 - u * 1.4, 0, skin, bod, 20, 8);
      const club = k.group(bod, 0, 0, 0);
      k.sphere([13, 4.6, 6.5], skin, club, 6, 0, 0);
      for (let j = 0; j < 4; j++) k.sphere([1.7, 1.2, 1.7], suck, club, -1 + j * 4.2, -3.6, (j % 2 ? 1.5 : -1.5));
      for (let j = 0; j < 3; j++) { const h = k.cone(0.8, 3, toothM, club, 1 + j * 4.5, -4.4, 0); h.rotation.z = Math.PI; }
      tents.push({ sd, P, m, club });
    }
    const tv = new T.Vector3();
    let whip = 0;
    return (e, t, dt) => {
      const held = e.held, angry = angryOf(e) || e.whipT > 0, sleep = e.sleeping || e.mood === 'sleep';
      const wob = t * (angry ? 3.2 : sleep ? 0.8 : 2) + (e.moving && e.grounded ? e.phase : 0) + e.seed;
      bod.position.y = Math.sin(t * 2 + e.seed) * 2 + (held ? -6 : 0);
      bod.rotation.z = damp(bod.rotation.z, e.moving && e.grounded ? -0.08 : 0, 4, dt);
      const br = Math.sin(t * (angry ? 3.4 : 1.6) + e.seed);
      mant.scale.set(1 + br * 0.035, 1 - br * 0.01, 1 + br * 0.035);
      mant.rotation.z = 0.13 + Math.sin(t * 1.1 + e.seed) * 0.04 + (held ? 0.2 : 0);
      fins[0].rotation.y = 0.75 + Math.sin(t * 4 + e.seed) * 0.25; fins[1].rotation.y = -0.75 - Math.sin(t * 4 + e.seed + 0.6) * 0.25;
      jaw.rotation.z = damp(jaw.rotation.z, angry || e.mood === 'scared' ? -0.55 - Math.sin(t * 9) * 0.12 : -0.05, 8, dt);
      const dr = (t * 0.9) % 1; drop.visible = !held && Math.sin(t * 1.3 + e.seed) > -0.3;
      drop.position.y = -14 - dr * 16; drop.scale.set(1.6 + dr, 2.4 + dr * 2, 1.6 + dr);
      // arms
      for (const A of arms) {
        const ph = wob + A.ph, w1 = Math.sin(ph) * 6, w2 = Math.cos(ph * 0.8) * 5, P = A.P, lift = angry ? 14 : 0;
        for (let j = 0; j < 7; j++) {
          const u = j / 6, sway = Math.sin(ph * 0.9 + u * 2.4) * 0.16 * u, an = A.a + sway;
          let r, y;
          if (held) { r = 14 + u * 22 + Math.sin(t * 6 + A.ph + u * 3) * 6 * u; y = -14 - u * 98 + Math.abs(w1) * u; }
          else {
            r = 18 + u * 70 + w2 * u + (u > 0.82 ? -(u - 0.82) * 40 : 0);
            y = u < 0.5 ? -14 - Math.sqrt(u / 0.5) * 66 + w1 * u * 0.5 : -80 - (u - 0.5) * 6;
            if (u > 0.72) y += Math.pow((u - 0.72) / 0.28, 1.5) * (18 + lift + w1 * 1.4);
          }
          P[j][0] = Math.cos(an) * r; P[j][1] = y; P[j][2] = Math.sin(an) * r;
        }
        A.m.geometry.setPath(P);
        for (let j = 2; j <= 6; j++) { const u = j / 6, s = A.su[j - 2], rr = rad(u); s.position.set(P[j][0] * 0.98, P[j][1] - rr * 0.78, P[j][2] * 0.98); s.scale.set(rr * 0.5, rr * 0.3, rr * 0.5); }
      }
      // tentacles
      whip = e.whipT > 0 ? Math.sin(clamp(e.whipT / 0.5, 0, 1) * Math.PI) : damp(whip, 0, 6, dt);
      for (const Tn of tents) {
        const sd = Tn.sd, ph = wob * 0.7 + sd * 2, w1 = Math.sin(ph) * 8, up = sd > 0 ? whip : 0, lunge = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * Math.PI) : 0;
        let bx = 12, by = -10, bz = sd * 10, cx, cy, cz, tx, ty, tz;
        if (held) { cx = 18; cy = -60; cz = sd * 20; tx = 22 + w1; ty = -100; tz = sd * 28; }
        else {
          cx = 54 + w1 + lunge * 30; cy = -64; cz = sd * 44; tx = 92 + lunge * 50; ty = -26 + w1 + (angry ? 18 : 0); tz = sd * (54 - lunge * 20);
          if (up > 0) { cx = lerp(cx, 70, up); cy = lerp(cy, 50, up); cz = lerp(cz, 26, up); tx = lerp(tx, 100, up); ty = lerp(ty, 150, up); tz = lerp(tz, 20, up); }
        }
        qcurve(Tn.P, bx, by, bz, cx, cy, cz, tx, ty, tz);
        Tn.m.geometry.setPath(Tn.P);
        const a = Tn.P[6], b = Tn.P[7]; Tn.club.position.set(b[0], b[1], b[2]);
        tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); Tn.club.quaternion.setFromUnitVectors(XA, tv);
      }
    };
  };

  // =====================================================================================================
  // THE MEGA ROBOT: a heavy battle mech. Rusted armour plates, pistons, a glowing red visor (the laser comes out of
  // it, at template (24, 84)) and chest core, an arm cannon that glows while it charges, a claw, a missile pod.
  // =====================================================================================================
  named['mega robot'] = function (e, k) {
    const g = rootOf(e, k), gr = TX.grime();
    const armor = tmat(k, mix(k.col('armor'), '#fff', 0.22), { metal: 0.3, rough: 0.5 }, { tag: 'mra', map: gr, bumpMap: gr, bumpScale: 0.6 });
    const frame = tmat(k, mix(k.col('body'), '#fff', 0.08), { metal: 0.35, rough: 0.45 }, { tag: 'mrb', map: gr, bumpMap: gr, bumpScale: 0.4 });
    const steel = k.mat(mix(k.col('metal'), '#fff', 0.2), { metal: 0.45, rough: 0.32 }), dark = k.mat('#16181b', { metal: 0.2, rough: 0.5 });
    const rust = k.mat('#7a3e1c', { rough: 0.9 });
    const R = '#ff2a14';
    const visorM = k.mat(R, { glow: R, glowK: 2.5, tag: 'visor' }), coreM = k.mat(R, { glow: R, glowK: 2.5, tag: 'core' });
    const hotM = k.mat('#ffe2d0', { glow: '#ffd0b0', glowK: 2.5, tag: 'hot' }), muzM = k.mat(R, { glow: R, glowK: 0.2, tag: 'muz' }), tipM = k.mat(R, { glow: R, glowK: 2, tag: 'tip' });
    const hip = k.group(g, 0, -30, 0);
    k.rbox(36, 18, 56, armor, hip, 0, 0, 0, 4);
    for (const sd of [1, -1]) { const j = k.cyl(8, 8, 10, steel, hip, 0, -4, sd * 24); j.rotation.x = Math.PI / 2; }
    // legs
    const legs = [];
    for (const sd of [1, -1]) {
      const up = k.group(g, 0, -36, sd * 25);
      k.rbox(20, 36, 22, frame, up, 0, -17, 0, 4); k.rbox(8, 26, 24, armor, up, 9, -15, 0, 3);
      k.cyl(2.4, 2.4, 26, steel, up, -11, -17, 0); k.cyl(3.6, 3.6, 10, dark, up, -11, -8, 0);
      const kn = k.cyl(8.5, 8.5, 24, steel, up, 0, -34, 0); kn.rotation.x = Math.PI / 2;
      const lo = k.group(up, 0, -34, 0);
      k.rbox(14, 16, 26, armor, lo, 8, -2, 0, 3); k.rbox(24, 32, 26, armor, lo, 1, -18, 0, 4);
      k.cyl(2.2, 2.2, 24, steel, lo, -13, -16, 0); k.box(1, 20, 27, rust, lo, 13.2, -20, 0);
      k.sphere(6, steel, lo, 0, -34, 0);
      const ft = k.group(lo, 0, -34, 0);
      k.rbox(42, 10, 30, armor, ft, 7, -5, 0, 3); k.rbox(10, 7, 28, frame, ft, 29, -6, 0, 2); k.rbox(10, 8, 22, frame, ft, -14, -5, 0, 2);
      legs.push({ up, lo, ft, sd });
    }
    // torso
    const tor = k.group(hip, 0, 14, 0);
    for (let i = 0; i < 3; i++) k.rbox(34 + i * 4, 7, 44 + i * 4, frame, tor, 0, 3 + i * 8, 0, 2);
    k.rbox(64, 60, 86, armor, tor, 0, 52, 0, 7);
    const plate = k.rbox(10, 46, 62, armor, tor, 33, 50, 0, 3); plate.rotation.z = -0.08;
    k.rbox(50, 14, 72, frame, tor, 0, 84, 0, 4);
    for (const sd of [1, -1]) { const p = k.rbox(8, 30, 20, frame, tor, 34, 44, sd * 34, 2); p.rotation.y = sd * 0.5; }
    const core = k.cyl(10, 11, 6, dark, tor, 38, 52, 0); core.rotation.z = Math.PI / 2;
    const coreG = k.sphere([3, 6.5, 6.5], coreM, tor, 41, 52, 0); k.sphere([1.4, 2.4, 2.4], hotM, tor, 43.5, 52, 0);
    for (const sd of [1, -1]) for (let i = 0; i < 3; i++) { k.box(22, 2.2, 1, coreM, tor, 6, 40 + i * 7, sd * 43.4); k.box(24, 1.2, 1.2, dark, tor, 6, 43.5 + i * 7, sd * 43.4); }   // core-lit side vents
    k.rbox(18, 46, 52, frame, tor, -38, 52, 0, 4);
    for (const z of [-14, 14]) { const ex = k.cyl(4, 5, 18, dark, tor, -44, 80, z); ex.rotation.z = 0.35; }
    for (let i = 0; i < 4; i++) k.box(1.2, 3, 40, dark, tor, -47.5, 36 + i * 7, 0);
    k.box(1.2, 44, 1.4, rust, tor, 37.7, 40, 18); k.box(1.2, 30, 1.6, rust, tor, 37.7, 34, -22);
    // head: armoured helm, jutting brow, black visor with two slanted red slits
    k.cyl(9, 11, 12, steel, tor, 2, 92, 0);
    const head = k.group(tor, 6, 106, 0); head.scale.setScalar(1.18);
    k.rbox(36, 30, 34, armor, head, 0, 0, 0, 5);
    const brow = k.rbox(12, 7, 38, armor, head, 15, 12, 0, 2); brow.rotation.z = -0.3;
    k.box(2, 11, 28, dark, head, 18.4, 1, 0);
    const eyes = [];
    for (const sd of [1, -1]) {
      const b = k.box(1.4, 2.6, 10.5, visorM, head, 19.4, 2, sd * 7.5); eyes.push(b);
      k.box(16, 9, 2, dark, head, 10, 1, sd * 17.4);                                          // the visor wraps round the side
      const sl = k.box(14, 3, 1.2, visorM, head, 10.5, 1.5, sd * 18.6); sl.rotation.z = 0.12; eyes.push(sl);
    }
    k.rbox(12, 8, 22, frame, head, 14, -12, 0, 2);
    for (let i = 0; i < 3; i++) k.box(1, 1.4, 16, dark, head, 20.2, -10 - i * 2.4 + 2, 0);
    for (const sd of [1, -1]) { const p = k.cyl(6.5, 6.5, 7, frame, head, -2, 4, sd * 19); p.rotation.x = Math.PI / 2; }
    k.cyl(0.9, 0.9, 18, steel, head, -8, 24, -10); const tip = k.sphere(2.6, tipM, head, -8, 34, -10);
    // shoulders and arms
    const arms = [];
    for (const sd of [1, -1]) {
      const sh = k.group(tor, 0, 72, sd * 50);
      const pad = k.rbox(42, 22, 34, armor, sh, 0, 9, sd * 4, 5); pad.rotation.x = sd * 0.22;
      for (const x of [-10, 6]) { const sp = k.cone(4, 12, steel, sh, x, 22, sd * 8, 6); sp.rotation.x = sd * 0.35; }
      k.sphere(10, steel, sh, 0, 0, 0);
      const up = k.group(sh, 0, 0, 0);
      k.rbox(17, 38, 18, frame, up, 0, -20, 0, 3); k.cyl(2.2, 2.2, 28, steel, up, -11, -20, 0);
      const el = k.cyl(7.5, 7.5, 20, steel, up, 0, -40, 0); el.rotation.x = Math.PI / 2;
      const lo = k.group(up, 0, -40, 0);
      k.rbox(26, 38, 26, armor, lo, 0, -20, 0, 4); k.box(1, 24, 27, rust, lo, 13.3, -22, 0);
      const hand = k.group(lo, 0, -40, 0);
      const A = { sh, up, lo, hand, sd };
      if (sd > 0) {   // the near arm ends in a twin cannon
        k.rbox(18, 10, 20, frame, hand, 0, -3, 0, 2);
        A.muz = [];
        for (const z of [-5, 5]) { k.cyl(3.4, 3.4, 18, dark, hand, 0, -15, z); A.muz.push(k.sphere(2.6, muzM, hand, 0, -24.5, z)); }
      } else {        // the far arm ends in a three-fingered claw
        k.rbox(16, 12, 18, frame, hand, 0, -5, 0, 2);
        for (const z of [-6, 0, 6]) { const f = k.cone(2.6, 14, steel, hand, z === 0 ? 5 : -2, -17, z, 6); f.rotation.z = Math.PI + (z === 0 ? 0.3 : -0.2); f.rotation.x = z * 0.04; }
      }
      arms.push(A);
    }
    // missile pod on the far shoulder
    k.rbox(26, 18, 22, frame, arms[1].sh, -4, 30, -6, 3);
    for (let i = 0; i < 4; i++) { const m = k.cone(2.6, 6, k.mat('#c0281a', { rough: 0.5 }), arms[1].sh, 10, 26 + (i % 2) * 8, -12 + (i >> 1) * 11, 8); m.rotation.z = -Math.PI / 2; }
    return (e, t, dt) => {
      const held = e.held, walking = e.moving && e.grounded && !held, inAir = !e.grounded && !held;
      const charging = e.charge > 0, firing = e.laserT > 0, angry = angryOf(e) || charging || firing;
      const sleep = e.sleeping || e.mood === 'sleep', dizzy = e.mood === 'dizzy' || e.dizzy > 0;
      const ph = e.phase || 0;
      hip.position.y = -30 - (walking ? Math.abs(Math.sin(ph)) * 3 : 0) + (inAir ? 4 : 0);
      tor.rotation.z = damp(tor.rotation.z, firing ? 0.12 : charging ? 0.06 : walking ? -0.05 : sleep ? -0.12 : 0, 8, dt);
      tor.rotation.y = walking ? Math.sin(ph) * 0.06 : 0;
      head.rotation.z = sleep ? -0.25 : dizzy ? Math.sin(t * 6) * 0.15 : (e.lookY || 0) * -0.2;
      head.rotation.x = dizzy ? Math.cos(t * 6) * 0.12 : 0;
      // legs: planted stomps, foot kept level
      for (const L of legs) {
        const p2 = ph + (L.sd > 0 ? 0 : Math.PI);
        let fx = walking ? Math.sin(p2) * 17 : L.sd * 2, lift = walking ? Math.max(0, Math.cos(p2)) * 9 : 0;
        if (inAir) lift = 12; if (held) { lift = 6; fx = 8 + Math.sin(t * 9 + L.sd) * 6; }
        L.up.position.y = hip.position.y - 6;
        ik(L.up, L.lo, 34, 34, fx, -96 + lift, L.up.position.z, 1, 0, 0, L.ft);
      }
      // arms (targets in torso space)
      for (const A of arms) {
        const f = A.sd > 0, sw = walking ? Math.sin(ph + (f ? Math.PI : 0)) : 0;   // targets relative to the shoulder
        let tx = sw * 16 + 4, ty = -78, tz = A.sd * 4, px = -1, py = 0;
        if (held) { tx = 10 + Math.sin(t * 12 + A.sd) * 6; ty = 70; px = 1; }
        else if (f && angry && !inAir) { tx = 74; ty = -6 + (e.lookY || 0) * 20; tz = -12; px = 0; py = -1; }
        else if (dizzy) { tx = 14; ty = -80; }
        else if (inAir) { tx = 22; ty = -50; }
        ik(A.up, A.lo, 40, 42, tx, ty, tz, px, py, A.sd * 0.3);
      }
      // glows: idle pulse, flicker while charging, flare when firing
      const fl = Math.floor(t * 24) % 2, base = sleep ? 0.25 : 2.2 + Math.sin(t * 3 + e.seed) * 0.4;
      visorM.emissiveIntensity = firing ? 9 : charging ? (fl ? 6 : 3) : base;
      coreM.emissiveIntensity = firing ? 7 : charging ? 3 + (1 - e.charge / 0.6) * 5 : base;
      hotM.emissiveIntensity = charging || firing ? 5 : 2;
      muzM.emissiveIntensity = charging ? (fl ? 6 : 2) : firing ? 4 : 0.15;
      tipM.emissiveIntensity = Math.floor(t * 4) % 2 ? 0.2 : 3;
      const sl = sleep ? 0 : angry ? 0.42 : 0.12, sq = sleep ? 0.35 : 1;
      eyes[0].rotation.x = -sl; eyes[2].rotation.x = sl; eyes[1].rotation.z = eyes[3].rotation.z = 0.12 + sl * 0.4; for (const b of eyes) b.scale.y = (b.scale.x > 2 ? 3 : 2.6) * sq;
    };
  };

  // =====================================================================================================
  // KING KONG: a huge black silverback with a crown. Knuckle-walks on long arms, beats its chest (beatT), leaps and
  // ground-pounds with both fists (poundT), swats flyers (swatT). Fur is a strand texture with a bump map.
  // =====================================================================================================
  named['king kong'] = function (e, k) {
    const g = rootOf(e, k), fur = TX.fur(), BODY = k.col('body');
    const furM = tmat(k, mix(BODY, '#fff', 0.08), { rough: 0.95 }, { tag: 'kkf', map: fur, bumpMap: fur, bumpScale: 1.6 });
    const silver = tmat(k, mix(BODY, '#c9c9c9', 0.5), { rough: 0.95 }, { tag: 'kks', map: fur, bumpMap: fur, bumpScale: 1.6 });
    const skinM = tmat(k, k.col('skin'), { rough: 0.6 }, { tag: 'kksk', bumpMap: TX.mottle(), bumpScale: 0.5 });
    const mouthM = k.mat(k.col('mouth'), { rough: 0.5 }), teeth = k.mat('#e8dcc0', { rough: 0.3 }), gold = k.mat(k.col('gold'), { metal: 0.9, rough: 0.25 });
    const scarM = k.mat(mix(k.col('skin'), '#d8b0a4', 0.6), { rough: 0.6 }), gem = k.mat('#c0281a', { rough: 0.15, glow: '#5a0000', glowK: 0.6 });
    const glow = glowOf(e, '#ff3b14');
    // pelvis and torso (the torso pivots at the waist: leans forward on its knuckles, rears up to beat its chest)
    const pel = k.group(g, -8, -26, 0);
    k.sphere([30, 24, 32], furM, pel, 0, 0, 0);
    const tor = k.group(pel, 0, 6, 0);
    k.sphere([36, 34, 38], furM, tor, 12, 18, 0);              // belly
    k.sphere([46, 44, 47], furM, tor, 14, 48, 0);              // ribcage
    k.sphere([34, 26, 40], silver, tor, -14, 34, 0);           // the silver saddle
    k.sphere([40, 30, 50], furM, tor, 4, 66, 0);               // shoulder mass
    k.sphere([24, 22, 32], furM, tor, 22, 80, 0);              // the hump behind the head
    for (const sd of [1, -1]) k.sphere([12, 15, 13], skinM, tor, 50, 50, sd * 15);   // bare chest
    k.sphere([14, 12, 22], skinM, tor, 44, 24, 0);
    // head: sagittal crest, heavy brow over glowing eyes, wide muzzle, fangs, a crown
    const head = k.group(tor, 46, 80, 0); head.scale.setScalar(1.18);
    k.sphere([20, 19, 19], furM, head, 0, 0, 0);
    k.sphere([13, 13, 6], furM, head, -5, 14, 0);
    const brow = k.sphere([8, 5, 20], skinM, head, 16, 8.5, 0); brow.rotation.z = -0.25;
    for (const sd of [1, -1]) {
      k.sphere([4.6, 4, 4.8], k.mat('#050303'), head, 18, 2.4, sd * 7.5);
      k.eye(3.5, head, 19.6, 2.4, sd * 7.5, { dir: [1, 0, sd * 0.45], glow });
      k.sphere([3.8, 4.5, 2], skinM, head, 2, 2, sd * 18.5);                     // ears
    }
    k.sphere([15, 11, 16], skinM, head, 15, -8, 0);                          // muzzle
    for (const sd of [1, -1]) k.sphere([3, 2.4, 3], k.mat('#120806'), head, 28, -2, sd * 4);
    k.sphere([8, 3.6, 12], skinM, head, 22, 1, 0);                           // nose ridge
    const jaw = k.group(head, 4, -12, 0);
    k.sphere([15, 6, 14], skinM, jaw, 12, -3, 0);
    k.sphere([12, 4, 11], mouthM, head, 16, -12, 0);
    for (const sd of [1, -1]) {
      const f = k.cone(1.8, 7, teeth, head, 25, -15, sd * 6); f.rotation.z = Math.PI;
      k.cone(1.5, 5, teeth, jaw, 21, 1, sd * 7);
      for (const z of [-2.5, 2.5]) { const ti = k.cone(1.2, 3, teeth, head, 27.5, -13.5, z * 0.9); ti.rotation.z = Math.PI; }
    }
    for (const [x, y, z, a] of [[8, 4, 13, 1.0], [10, 1, 15, 1.0], [24, -10, 10, 0.7]]) { const s = k.sphere([0.8, 7, 1.2], scarM, head, x, y, z); s.rotation.z = a; }
    const crown = k.group(head, -4, 19, 0); crown.rotation.z = 0.12;
    k.cyl(11, 12, 6, gold, crown, 0, 0, 0, 20);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; k.cone(2.4, 8, gold, crown, Math.cos(a) * 11, 6.5, Math.sin(a) * 11, 6); }
    k.sphere(2, gem, crown, 11.5, 0.5, 0);
    // arms: long and heavy, knuckles on the ground at rest
    const arms = [];
    for (const sd of [1, -1]) {
      const up = k.limb(68, 15, 12, furM, g, 0, 0, 0);
      k.sphere([13, 22, 13], furM, up, 3, -22, 0);                           // biceps / deltoid
      const lo = k.limb(64, 13, 9, furM, up, 0, -68, 0);
      k.sphere([12, 20, 12], furM, lo, -2, -16, 0);                          // forearm
      const fist = k.group(lo, 0, -64, 0);
      k.sphere([12, 11, 12], skinM, fist, 2, -6, 0);
      for (let i = 0; i < 4; i++) k.sphere([4.2, 4.6, 3.6], skinM, fist, 9, -14, (i - 1.5) * 5.4);
      k.sphere([3.8, 3.4, 3.4], skinM, fist, 4, -11, sd * -10);              // thumb
      arms.push({ up, lo, fist, sd, ox: 18, oy: 56, oz: sd * 42 });
    }
    // legs: short, bent, big flat feet
    const legs = [];
    for (const sd of [1, -1]) {
      const up = k.limb(38, 17, 13, furM, g, -8, -28, sd * 22);
      const lo = k.limb(36, 12, 9, furM, up, 0, -38, 0);
      const ft = k.group(lo, 0, -36, 0);
      k.sphere([19, 6.5, 11], skinM, ft, 8, -3, 0);
      for (let i = 0; i < 3; i++) k.sphere([3.2, 2.6, 3.4], skinM, ft, 24, -5, (i - 1) * 5);
      legs.push({ up, lo, ft, sd });
    }
    let lean = -0.32;
    return (e, t, dt) => {
      const held = e.held, walking = e.moving && e.grounded && !held, inAir = !e.grounded && !held;
      const angry = angryOf(e), beat = e.beatT > 0, pound = e.poundT > 0, poundUp = pound && e.poundT > 0.25, swat = e.swatT > 0;
      const dizzy = e.mood === 'dizzy' || e.dizzy > 0, sleep = e.sleeping || e.mood === 'sleep';
      const ph = e.phase || 0;
      const want = beat ? 0.1 : poundUp ? 0.06 : pound ? -0.55 : held ? 0.2 : swat ? -0.05 : sleep ? -0.45 : angry && !walking ? -0.12 : -0.32;
      lean = damp(lean, want, 9, dt); tor.rotation.z = lean;
      pel.position.y = -26 - (walking ? Math.abs(Math.cos(ph)) * 3 : 0) + (beat ? 4 : 0);
      tor.rotation.x = walking ? Math.sin(ph) * 0.05 : beat ? Math.sin(t * 22) * 0.04 : 0;
      head.rotation.z = damp(head.rotation.z, beat || poundUp ? 0.35 : sleep ? -0.3 : angry ? 0.12 : 0, 8, dt);
      head.rotation.y = dizzy ? Math.sin(t * 5) * 0.3 : 0;
      jaw.rotation.z = damp(jaw.rotation.z, sleep ? 0 : beat || poundUp || swat ? -0.6 : angry ? -0.35 : -0.14, 10, dt);
      // where the torso puts the shoulders (in model space)
      const c = Math.cos(lean), s = Math.sin(lean), ox = pel.position.x, oy = pel.position.y + 6;
      for (const A of arms) {
        A.up.position.set(ox + A.ox * c - A.oy * s, oy + A.ox * s + A.oy * c, A.oz);
        const sh = A.up.position, f = A.sd > 0, k2 = Math.sin(t * 22) * (f ? 1 : -1);
        const sw = walking ? Math.sin(ph + (f ? 0 : Math.PI)) : 0;
        let tx = 46 + sw * 22, ty = -82 + (walking ? Math.max(0, Math.cos(ph + (f ? 0 : Math.PI))) * 12 : 0), tz = A.sd * 40, px = -1, py = 0;
        if (held) { tx = sh.x + 22 + Math.sin(t * 12 + A.sd) * 6; ty = sh.y + 80; px = 0.3; py = -1; }
        else if (poundUp) { tx = sh.x + 18; ty = sh.y + 104; tz = A.sd * 26; px = -0.4; py = -1; }
        else if (pound) { tx = 74; ty = -84; tz = A.sd * 30; }
        else if (beat) { const cx = ox + 62 * c - 50 * s, cy = oy + 62 * s + 50 * c; tx = cx + 4 + k2 * 7; ty = cy - 2 + k2 * 6; tz = A.sd * 14; px = -0.3; py = -1; }
        else if (swat && f) { tx = sh.x + 60; ty = sh.y + 90; tz = A.sd * 36; px = 0; py = -1; }
        else if (dizzy) { tx = sh.x + 22; ty = -84; }
        else if (angry && f && !walking) { tx = sh.x + 40; ty = sh.y + 70; tz = A.sd * 38; px = 0; py = -1; }
        else if (inAir) { tx = sh.x + 40; ty = sh.y - 70; }
        ik(A.up, A.lo, 68, 64, tx, ty, tz, px, py, A.sd * 0.6, null);
        A.fist.rotation.set(0, 0, 0);
      }
      for (const L of legs) {
        const p2 = ph + (L.sd > 0 ? Math.PI : 0);
        L.up.position.y = pel.position.y - 2;
        const fx = (walking ? Math.sin(p2) * 18 : 0) - 2, lift = walking ? Math.max(0, Math.cos(p2)) * 8 : inAir ? 12 : held ? 6 : 0;
        ik(L.up, L.lo, 38, 36, fx, -92 + lift, L.sd * 24, 1, 0.1, 0, L.ft);
      }
    };
  };

  // =====================================================================================================
  // THE HYDRA: a heavy scaled dragon body with spines and a tail, four clawed legs, and three long swaying necks
  // with horned dragon heads. Fire comes out of D.hydraMouths (template coords), so the snouts end there when breathing.
  // =====================================================================================================
  named['hydra'] = function (e, k) {
    const g = rootOf(e, k), sc = TX.scales(), BODY = k.col('body');
    const scale = tmat(k, mix(BODY, '#fff', 0.12), { rough: 0.5 }, { tag: 'hyd', map: sc, bumpMap: sc, bumpScale: 0.9 });
    const belly = tmat(k, mix(BODY, '#cfc596', 0.45), { rough: 0.55 }, { tag: 'hydb', bumpMap: sc, bumpScale: 0.6 });
    const spikeM = k.mat(k.col('spike'), { rough: 0.4 }), hornM = k.mat(k.col('horn'), { rough: 0.35 }), mouthM = k.mat(k.col('mouth'), { rough: 0.45 });
    const toothM = k.mat('#efe6cf', { rough: 0.3 }), clawM = k.mat('#1c1a16', { rough: 0.3 }), drool = k.mat('#c8e1aa', { rough: 0.1, opacity: 0.72 });
    const fireM = k.mat('#ff5a00', { glow: '#ff4000', glowK: 1.6, opacity: 0.7, tag: 'hfire' }), fireM2 = k.mat('#ffc040', { glow: '#ffa020', glowK: 1.8, opacity: 0.85, tag: 'hfire2' });
    const glow = glowOf(e, '#ffde33');
    const X = -8;   // the 2D drawing is shifted 8 left
    const bod = k.group(g, 0, 0, 0);
    k.sphere([72, 36, 42], scale, bod, X - 14, -24, 0);
    k.sphere([36, 36, 38], scale, bod, X + 30, -12, 0);           // chest
    k.sphere([60, 22, 34], belly, bod, X - 8, -40, 0);
    for (const sd of [1, -1]) { k.sphere([30, 30, 16], scale, bod, X - 46, -30, sd * 32); k.sphere([18, 22, 13], scale, bod, X + 28, -26, sd * 30); }
    // the spine ridge
    const spines = [];
    for (let i = 0; i < 7; i++) {
      const x = X - 70 + i * 16, y = -24 + 36 * Math.sqrt(Math.max(0, 1 - Math.pow((x - X + 14) / 76, 2))) + 1, h = 12 + (i === 3 || i === 4 ? 6 : 0) - Math.abs(i - 3.5) * 1.2;
      const s = k.cone(4.5, h, spikeM, bod, x, y + h * 0.4, 0, 6); s.rotation.z = 0.35; spines.push(s);
    }
    // tail
    const tailP = pts(7), tail = k.tube([[0, 0, 0], [1, 0, 0]], u => 20 * Math.pow(1 - u, 0.9) + 1.5, 0, scale, bod, 22, 12);
    const tailSp = []; for (let i = 0; i < 4; i++) tailSp.push(k.cone(3.2, 9, spikeM, bod, 0, 0, 0, 5));
    // legs
    const legs = [];
    for (const [hx, hy, sd, hind] of [[X - 46, -36, 1, 1], [X - 46, -36, -1, 1], [X + 28, -30, 1, 0], [X + 28, -30, -1, 0]]) {
      const a = hind ? 32 : 30, b = hind ? 32 : 28;
      const up = k.limb(a, hind ? 17 : 13, hind ? 11 : 9, scale, g, hx, hy, sd * (hind ? 36 : 32));
      const lo = k.limb(b, hind ? 10 : 9, 7, scale, up, 0, -a, 0);
      const ft = k.group(lo, 0, -b, 0);
      k.sphere([12, 5.5, 10], scale, ft, 4, -2, 0);
      for (const z of [-6, 0, 6]) { const c = k.cone(2.2, 10, clawM, ft, 15, -4, z, 6); c.rotation.z = -1.9; }
      legs.push({ up, lo, ft, sd, hind, a, b, hx, hy });
    }
    // necks and heads
    const necks = [];
    const upperTeeth = M3.geo('hydTeethU', () => { const p = []; for (let i = 0; i < 5; i++) for (const sd of [1, -1]) { const x = 12 + i * 5, z = sd * (6 - i * 0.6); p.push(spikeGeo(x, 0, z, x + 0.8, -3.6 - (i === 0 ? 2.2 : 0), z * 0.96, i === 0 ? 1.3 : 0.9, 5)); } return merge(p); });
    const lowerTeeth = M3.geo('hydTeethL', () => { const p = []; for (let i = 0; i < 4; i++) for (const sd of [1, -1]) { const x = 14 + i * 5, z = sd * (5.4 - i * 0.6); p.push(spikeGeo(x, 0, z, x + 0.6, 3.2, z * 0.96, 0.9, 5)); } return merge(p); });
    for (let i = 0; i < 3; i++) {
      const P = pts(7), z0 = (i - 1) * 16;
      const m = k.tube([[0, 0, 0], [1, 0, 0]], u => 14.5 - u * 5.5, 0, scale, bod, 18, 12);
      const sp = []; for (let j = 0; j < 3; j++) sp.push(k.cone(3.2, 10, spikeM, bod, 0, 0, 0, 5));
      const head = k.group(bod, 0, 0, z0);
      const hs = k.group(head, 0, 0, 0); hs.scale.setScalar(1.3);
      k.sphere([13, 10, 11], scale, hs, 0, 3, 0);                          // skull
      k.sphere([17, 6.5, 8.5], scale, hs, 18, 1.5, 0);                     // upper jaw
      k.sphere([6, 4, 9], scale, hs, 30, 2.5, 0);                          // nose
      for (const sd of [1, -1]) {
        k.sphere([1.2, 1, 1.2], k.mat('#100a08'), hs, 34, 4.5, sd * 3);
        const br = k.sphere([7, 2.6, 4], scale, hs, 9, 9.5, sd * 6.5); br.rotation.z = -0.35;
        k.eye(3.4, hs, 8, 6, sd * 8, { dir: [0.7, 0.1, sd], glow });
        k.tube([[-4, 8, sd * 6], [-12, 14, sd * 8], [-22, 15, sd * 9], [-30, 10, sd * 9]], u => 3.6 * (1 - u) + 0.25, 0, hornM, hs, 8, 8);
        k.tube([[-8, 3, sd * 9], [-16, 2, sd * 12], [-22, -2, sd * 12]], u => 2 * (1 - u) + 0.2, 0, hornM, hs, 6, 6);
      }
      k.mesh(upperTeeth, toothM, hs, 0, -2.6, 0);
      const jaw = k.group(hs, -4, -2.5, 0);
      k.sphere([17, 4.2, 7.6], scale, jaw, 18, -3, 0);
      k.sphere([14, 2.6, 6], mouthM, jaw, 18, -0.5, 0);
      k.mesh(lowerTeeth, toothM, jaw, 0, -1.6, 0);
      const fire = k.group(hs, 34, -1, 0); fire.rotation.z = -Math.PI / 2;
      const f1 = k.cone(5, 22, fireM, fire, 0, 11, 0, 10); f1.rotation.z = Math.PI; f1.castShadow = false;
      const f2 = k.cone(2.6, 14, fireM2, fire, 0, 7, 0, 8); f2.rotation.z = Math.PI; f2.castShadow = false;
      const dr = k.sphere([1.2, 2, 1.2], drool, hs, 20, -8, 0); dr.castShadow = false;
      necks.push({ i, P, m, sp, head, hs, jaw, fire, dr, z0, x: 0, y: 0, ang: 0 });
    }
    const heads0 = [[22, 76], [54, 60], [76, 32]], base0 = [0.45, 0.1, -0.3], HL = 45;
    return (e, t, dt) => {
      const held = e.held, walking = e.moving && e.grounded && !held, inAir = !e.grounded && !held;
      const angry = angryOf(e), breathing = e.breath > 0, sleep = e.sleeping || e.mood === 'sleep';
      const ph = e.phase || 0, lunge = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * Math.PI) : 0;
      bod.position.y = walking ? -Math.abs(Math.sin(ph)) * 2 : 0;
      bod.rotation.z = walking ? Math.sin(ph * 2) * 0.015 : 0;
      // tail sways
      const wag = Math.sin(t * 1.6 + e.seed) * 5;
      qcurve(tailP, X - 62, -28, 0, X - 150, -64 + wag * 0.5, wag * 3, X - 150, 4 + wag * 2, wag * 6);
      tail.geometry.setPath(tailP);
      for (let i = 0; i < 4; i++) { const p = tailP[i + 1], q = tailP[i + 2]; const tx = q[0] - p[0], ty = q[1] - p[1], tl = Math.hypot(tx, ty) || 1, r = 20 * Math.pow(1 - (i + 1) / 6, 0.9) + 1; tailSp[i].position.set(p[0] + ty / tl * r, p[1] - tx / tl * r, p[2]); tailSp[i].rotation.z = Math.atan2(-ty, -tx) - 0.4; tailSp[i].scale.setScalar(1 - i * 0.15); }
      // legs
      for (const L of legs) {
        const p2 = ph + (L.hind ? 0 : Math.PI) + (L.sd > 0 ? 0 : Math.PI);
        const fx = L.hx + (L.hind ? 10 : 6) + (walking ? Math.sin(p2) * 14 : 0), lift = walking ? Math.max(0, Math.cos(p2)) * 7 : inAir ? 10 : held ? 8 : 0;
        L.up.position.y = L.hy + bod.position.y;
        ik(L.up, L.lo, L.a, L.b, fx, -89 + lift, L.up.position.z * 1.15, L.hind ? -1 : 1, 0, 0, L.ft);
      }
      // necks and heads
      for (const N of necks) {
        const i = N.i, sway = held ? Math.sin(t * 10 + i * 2) * 8 : Math.sin(t * 1.6 + i * 2.1 + e.seed) * 4;
        let mx, my, ang;
        if (breathing) { const M = D.hydraMouths[i]; mx = M[0]; my = -M[1]; ang = -M[2]; }
        else if (sleep) { mx = 50 + i * 14; my = -60 + i * 6; ang = -0.5; }
        else {
          const h = heads0[i]; ang = base0[i] + Math.sin(t * 1.3 + i) * 0.08 + (angry ? -0.15 : 0);
          mx = h[0] + X + 38 * Math.cos(ang) + sway * 0.4 + lunge * 26 + (angry ? 6 : 0); my = h[1] + 35 * Math.sin(ang) + sway - (angry ? 6 : 0);
        }
        N.x = damp(N.x || mx, mx, 9, dt); N.y = damp(N.y || my, my, 9, dt); N.ang = damp(N.ang, ang, 9, dt);
        const ca = Math.cos(N.ang), sa = Math.sin(N.ang), hx = N.x - HL * ca, hy = N.y - HL * sa;
        N.head.position.set(hx, hy, N.z0); N.head.rotation.z = N.ang;
        const bx = X + 18 + i * 8, by = 8 - i * 4, ex = hx - 10 * ca, ey = hy - 10 * sa;
        qcurve(N.P, bx, by, N.z0 * 0.6, (bx + ex) * 0.5 - 12 + i * 4, (by + ey) * 0.5 + 18 - i * 6, N.z0 * 0.9, ex, ey, N.z0);
        N.m.geometry.setPath(N.P);
        for (let j = 0; j < 3; j++) {
          const p = N.P[1 + j * 2], q = N.P[2 + j * 2], tx = q[0] - p[0], ty = q[1] - p[1], tl = Math.hypot(tx, ty) || 1, r = 14.5 - (1 + j * 2) / 6 * 5.5;
          N.sp[j].position.set(p[0] - ty / tl * r, p[1] + tx / tl * r, p[2]); N.sp[j].rotation.z = Math.atan2(ty, tx) + 0.4;
        }
        const open = sleep ? 0.02 : breathing ? 0.62 : angry ? 0.38 + Math.sin(t * 7 + i) * 0.1 : 0.12 + Math.sin(t * 1.7 + i) * 0.05;
        N.jaw.rotation.z = damp(N.jaw.rotation.z, -open, 10, dt);
        N.fire.visible = breathing;
        if (breathing) { const q = 1 + Math.sin(t * 31 + i * 2) * 0.2; N.fire.scale.set(q, 1.2 + Math.sin(t * 23 + i) * 0.3, q); }
        const dr = (t * 1.1 + i * 0.4) % 1; N.dr.visible = !breathing && !sleep; N.dr.position.y = -8 - dr * 12; N.dr.scale.set(1.2, 2 + dr, 1.2);
      }
    };
  };

  // =====================================================================================================
  // THE LAVA GOLEM: craggy boulders held together by a molten core. Glowing cracks pulse in the rock; flames burn
  // on its head and shoulders; it winds up and lobs a fireball (throwT) from its near fist at template (46, 60).
  // =====================================================================================================
  named['lava golem'] = function (e, k) {
    const g = rootOf(e, k), BODY = k.col('body');
    const rock = tmat(k, BODY, { rough: 0.92, flat: true, glow: '#ffffff', glowK: 1.6, tag: 'lgr' }, { tag: 'lgr', map: TX.rock(), bumpMap: TX.rock(), bumpScale: 1.2, emissiveMap: TX.cracks() });
    const rock2 = tmat(k, mix(BODY, '#5a4a40', 0.25), { rough: 0.95, flat: true, glow: '#ffffff', glowK: 1.2, tag: 'lgr2' }, { tag: 'lgr2', map: TX.rock(), bumpMap: TX.rock(), bumpScale: 1.2, emissiveMap: TX.cracks() });
    const lava = k.mat('#d83000', { glow: '#ff3a00', glowK: 1.2, rough: 0.6, tag: 'lava' }), hot = k.mat('#ff9a30', { glow: '#ff7a10', glowK: 1.5, tag: 'lhot' });
    const glow = '#ff7a10';
    let seed = 1;
    const boulder = (parent, r, x, y, z, m) => { const b = k.mesh(rockGeo(seed++ % 9), m || rock, parent, x, y, z); b.scale.set(r[0], r[1], r[2]); b.rotation.set(seed * 1.3, seed * 0.7, seed * 2.1); return b; };
    const bod = k.group(g, 0, 0, 0);
    // the molten core shows through the gaps between the plates
    k.sphere([34, 42, 29], lava, bod, 0, 16, 0);
    boulder(bod, [31, 28, 25], 10, 40, 16); boulder(bod, [31, 28, 25], 10, 40, -16);
    boulder(bod, [34, 32, 38], -18, 44, 0, rock2);
    boulder(bod, [30, 22, 22], 10, 8, 14); boulder(bod, [30, 22, 22], 10, 8, -14);
    boulder(bod, [26, 30, 24], -20, 14, 16, rock2); boulder(bod, [26, 30, 24], -20, 14, -16, rock2);
    boulder(bod, [38, 20, 38], 0, -22, 0, rock2);
    // head
    const head = k.group(bod, 6, 82, 0);
    boulder(head, [22, 23, 22], 0, 2, 0);
    const brow = boulder(head, [10, 5, 21], 14, 9, 0, rock2); brow.rotation.set(0, 0, -0.3);
    const jaw = k.group(head, 4, -12, 0);
    boulder(jaw, [17, 7, 18], 4, -2, 0, rock2);
    const mouth = k.sphere([9, 2.5, 11], hot, head, 12, -10, 0);
    for (const sd of [1, -1]) { k.sphere([4.6, 3.8, 4], k.mat('#120806'), head, 17, 4, sd * 7.5); k.eye(3.4, head, 18.5, 4, sd * 7.5, { dir: [1, 0, sd * 0.4], glow }); }
    const flames = [flame(k, head, 0, 16, 0, 17), flame(k, head, -9, 12, 8, 10), flame(k, head, -7, 13, -8, 9)];
    // arms: shoulder boulders, rock bones joined by glowing lava joints, huge fists
    const arms = [];
    for (const sd of [1, -1]) {
      const sh = k.group(bod, 0, 50, sd * 46);
      boulder(sh, [22, 18, 22], -2, 8, sd * 2);
      flames.push(flame(k, sh, -6, 18, 0, 9));
      const up = k.group(sh, 0, 0, 0);
      k.sphere(7, lava, up, 0, 0, 0);
      boulder(up, [14, 23, 14], 0, -20, 0);
      k.sphere(6.5, lava, up, 0, -42, 0);
      const lo = k.group(up, 0, -42, 0);
      boulder(lo, [15, 21, 15], 0, -18, 0, rock2);
      const fist = k.group(lo, 0, -40, 0);
      k.sphere(6.5, lava, fist, 0, 2, 0);
      boulder(fist, [20, 19, 20], 0, -6, 0);
      const ball = sd > 0 ? k.group(fist, 0, -6, 18) : null;
      if (ball) { k.sphere(11, lava, ball, 0, 0, 0); k.sphere(7, hot, ball, 3, 2, 3); flames.push(flame(k, ball, 0, 2, 0, 13)); }
      const drip = k.sphere([2, 3, 2], lava, fist, 6, -24, 0); drip.castShadow = false;
      arms.push({ sh, up, lo, fist, sd, ball, drip });
    }
    // legs
    const legs = [];
    for (const sd of [1, -1]) {
      const up = k.group(g, 0, -30, sd * 22);
      boulder(up, [16, 20, 16], 0, -15, 0, rock2);
      k.sphere(6.5, lava, up, 0, -32, 0);
      const lo = k.group(up, 0, -32, 0);
      boulder(lo, [16, 18, 17], 0, -14, 0);
      const ft = k.group(lo, 0, -32, 0);
      boulder(ft, [24, 8, 20], 6, -3, 0, rock2);
      legs.push({ up, lo, ft, sd });
    }
    const crackMats = [rock, rock2];
    return (e, t, dt) => {
      const held = e.held, walking = e.moving && e.grounded && !held, inAir = !e.grounded && !held;
      const angry = angryOf(e), throwing = e.throwT > 0, windup = e.throwT > 0.25, dizzy = e.mood === 'dizzy' || e.dizzy > 0, sleep = e.sleeping || e.mood === 'sleep';
      const ph = e.phase || 0;
      // the lava breathes
      const pulse = 0.78 + Math.sin(t * 3.4 + e.seed) * 0.22 + (angry || throwing ? 0.3 : 0) - (sleep ? 0.4 : 0);
      lava.emissiveIntensity = 1.2 * pulse; hot.emissiveIntensity = 1.6 * pulse;
      crackMats[0].emissiveIntensity = 1.7 * pulse; crackMats[1].emissiveIntensity = 1.3 * pulse;
      for (const f of flames) f.tick(t);
      bod.position.y = walking ? -Math.abs(Math.sin(ph)) * 3 : 0;
      bod.rotation.x = walking ? Math.sin(ph) * 0.04 : 0;
      bod.rotation.z = damp(bod.rotation.z, windup ? 0.12 : throwing ? -0.14 : walking ? -0.05 : 0, 8, dt);
      head.rotation.y = dizzy ? Math.sin(t * 5) * 0.3 : 0;
      jaw.rotation.z = damp(jaw.rotation.z, angry || throwing || e.mood === 'scared' ? -0.45 : -0.08, 10, dt);
      mouth.scale.y = 2.5 + (angry || throwing ? 2.5 : 0);
      for (const A of arms) {
        const f = A.sd > 0, sw = walking ? Math.sin(ph + (f ? Math.PI : 0)) : 0;   // targets relative to the shoulder
        let tx = 12 + sw * 14, ty = -76, tz = A.sd * 4, px = -1, py = 0;
        if (held) { tx = 16 + Math.sin(t * 11 + A.sd) * 6; ty = 74; px = 0; py = -1; }
        else if (f && windup) { tx = -6; ty = 74; px = 0.5; py = -1; }
        else if (f && throwing) { tx = 72; ty = 12; px = 0; py = -1; }
        else if (dizzy) { tx = 18; ty = -78; }
        else if (angry && !walking) { tx = 26; ty = 40; tz = -A.sd * 8; px = 0; py = -1; }
        ik(A.up, A.lo, 42, 40, tx, ty, tz, px, py, A.sd * 0.4);
        if (A.ball) A.ball.visible = windup;
        const dr = (t * 1.2 + A.sd) % 1; A.drip.position.y = -24 - dr * 30; A.drip.visible = !held && dr < 0.8;
      }
      for (const L of legs) {
        const p2 = ph + (L.sd > 0 ? 0 : Math.PI);
        L.up.position.y = -30 + bod.position.y;
        const fx = (walking ? Math.sin(p2) * 15 : 0) + 2, lift = walking ? Math.max(0, Math.cos(p2)) * 8 : inAir ? 10 : held ? 6 : 0;
        ik(L.up, L.lo, 32, 32, fx, -92 + lift, L.sd * 22, 1, 0, 0, L.ft);
      }
    };
  };

  // =====================================================================================================
  // THE GIANT SPIDER: a tarantula the size of a truck. Hairy eight-jointed legs (femur, tibia, metatarsus) that walk
  // in alternating sets, a pulsing hairy abdomen with pale chevrons and a red hourglass, a cluster of glowing red eyes,
  // and fangs that spread and drip when angry. Webs are spat from D.spiderMouth (template (72, 22)).
  // =====================================================================================================
  function abdomenTex(BODY, BAND) {
    return canvasTex('spab:' + BODY + BAND, 512, 256, (x, w, h, r) => {
      x.fillStyle = BODY; x.fillRect(0, 0, w, h);
      const dk = SB.shade(BODY, 0.4), lt = mix(BODY, '#d8c8b0', 0.25);
      for (let i = 0; i < 5000; i++) { x.strokeStyle = r() < 0.6 ? dk : lt; x.globalAlpha = 0.5; x.lineWidth = 1; const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 3, py + 3 + r() * 5); x.stroke(); }
      x.globalAlpha = 1;
      // dorsal chevrons along u = 0.5 (canvas top = rear, bottom = front)
      for (let i = 0; i < 5; i++) {
        const cy = h * (0.22 + i * 0.13), wd = w * (0.07 - i * 0.008), cx = w * 0.5;
        x.fillStyle = BAND; x.beginPath(); x.moveTo(cx - wd * 1.3, cy - 9); x.lineTo(cx, cy + 6); x.lineTo(cx + wd * 1.3, cy - 9); x.lineTo(cx + wd, cy - 14); x.lineTo(cx, cy - 3); x.lineTo(cx - wd, cy - 14); x.fill();
        x.fillStyle = '#c9bfa6'; x.beginPath(); x.moveTo(cx - wd, cy - 9); x.lineTo(cx, cy + 2); x.lineTo(cx + wd, cy - 9); x.lineTo(cx + wd * 0.7, cy - 12); x.lineTo(cx, cy - 4); x.lineTo(cx - wd * 0.7, cy - 12); x.fill();
      }
      // a red hourglass low on each flank (u = 0.2 and 0.8)
      for (const u of [0.17, 0.83]) { const cx = w * u, cy = h * 0.5; x.fillStyle = '#c0281a'; x.beginPath(); x.moveTo(cx - 12, cy - 22); x.lineTo(cx + 12, cy - 22); x.lineTo(cx + 3, cy); x.lineTo(cx + 12, cy + 22); x.lineTo(cx - 12, cy + 22); x.lineTo(cx - 3, cy); x.fill(); }
      // banded flank stripes
      x.globalAlpha = 0.5; x.fillStyle = BAND; for (const u of [0.32, 0.68]) x.fillRect(w * u - 4, h * 0.15, 8, h * 0.7); x.globalAlpha = 1;
    });
  }
  named['giant spider'] = function (e, k) {
    const g = rootOf(e, k), pal = palOf(e), hair = TX.hair();
    const BODY = pal.body || '#1c1512', LEG = pal.leg || '#21170f', BAND = pal.band || '#7a2416', EYE = pal.eye || '#ff2a14';
    const bodyM = tmat(k, BODY, { rough: 0.85 }, { tag: 'spb', map: hair, bumpMap: hair, bumpScale: 1.4 });
    const legM = tmat(k, mix(LEG, '#fff', 0.06), { rough: 0.85 }, { tag: 'spl', map: hair, bumpMap: hair, bumpScale: 1.2 });
    const bandM = k.mat(BAND, { rough: 0.8 }), fangM = k.mat('#0b0b0b', { rough: 0.15, metal: 0.2 }), clawM = k.mat('#0d0907', { rough: 0.3 });
    const abM = tmat(k, '#ffffff', { rough: 0.8 }, { tag: 'spab', map: abdomenTex(BODY, BAND), bumpMap: hair, bumpScale: 1.4 });
    const eyeM = k.mat(EYE, { glow: EYE, glowK: 2, rough: 0.08, tag: 'speye' }), venom = k.mat('#7ddc6a', { glow: '#2a6a20', glowK: 0.5, rough: 0.1, opacity: 0.85 });
    const X = -10;
    const bod = k.group(g, 0, 0, 0);
    // abdomen (its sphere is turned so the texture's poles are front/back), pedicel, spinnerets
    const abG = k.group(bod, X - 50, 6, 0); abG.rotation.z = 0.12;
    const ab = k.sphere([48, 64, 52], abM, abG, 0, 0, 0); ab.rotation.z = Math.PI / 2;
    for (const z of [-5, 5]) { const s = k.cone(4, 12, bodyM, abG, -64, -6, z, 6); s.rotation.z = Math.PI / 2 + 0.4; }
    k.cyl(7, 9, 14, bodyM, bod, X + 8, 2, 0).rotation.z = Math.PI / 2;
    // cephalothorax with its eye mound
    k.sphere([38, 22, 31], bodyM, bod, X + 36, 4, 0);
    k.sphere([14, 9, 14], bodyM, bod, X + 56, 16, 0);
    const eyes = [];
    for (const [x, y, z, r] of [[67, 19, 5.5, 6.4], [62, 17, 13, 4], [61, 27, 6, 3.5], [54, 25, 13.5, 3.8]]) for (const sd of [1, -1]) eyes.push(k.sphere(r, eyeM, bod, X + x, y, sd * z));
    // chelicerae and fangs
    const fangs = [];
    for (const sd of [1, -1]) {
      const ch = k.sphere([9, 13, 7], bodyM, bod, X + 74, -6, sd * 6.5); ch.rotation.z = -0.35;
      const fg = k.group(bod, X + 78, -16, sd * 6.5);
      k.tube([[0, 0, 0], [3, -6, 0], [3, -12, -sd * 1.5], [-1, -16, -sd * 3]], u => 2.8 * (1 - u) + 0.15, 0, fangM, fg, 8, 7);
      const drop = k.sphere([1.6, 2.6, 1.6], venom, fg, -1, -18, -sd * 3); drop.castShadow = false;
      fangs.push({ fg, sd, drop });
    }
    // pedipalps
    const palps = [];
    for (const sd of [1, -1]) {
      const up = k.group(bod, X + 70, -2, sd * 13);
      k.mesh(hairyLimb(20, 4.2, 3.4, 14, 4), legM, up);
      const lo = k.group(up, 0, -20, 0); k.mesh(hairyLimb(18, 3.4, 2.4, 12, 4), legM, lo);
      palps.push({ up, lo, sd });
    }
    // legs: attachment, rest foot (x, z), segment lengths
    const LEGS = [[X + 58, 14, 150 + X + 10, 58, 1.0], [X + 46, 21, 96 + X + 10, 96, 0.93], [X + 32, 22, -70 + X + 10, 96, 0.9], [X + 20, 16, -146 + X + 10, 62, 1.0]];
    const legs = [];
    for (let i = 0; i < 4; i++) for (const sd of [1, -1]) {
      const [ax, az, fx, fz, s] = LEGS[i], L1 = 76 * s, L2 = 76 * s, L3 = 88 * s;
      const fem = k.group(bod, ax, 0, sd * az);
      k.mesh(hairyLimb(L1, 9.5, 7.5, 34, 8), legM, fem);
      k.sphere([7.5, 6.5, 7.5], bandM, fem, 0, -L1 * 0.12, 0);
      const tib = k.group(fem, 0, -L1, 0);
      k.sphere(8.5, bandM, tib, 0, 0, 0);
      k.mesh(hairyLimb(L2, 7.5, 5.5, 30, 7), legM, tib);
      const met = k.group(tib, 0, -L2, 0);
      k.sphere(6, bandM, met, 0, 0, 0);
      k.mesh(hairyLimb(L3, 5.5, 2.4, 28, 6), legM, met);
      const claw = k.cone(1.8, 6, clawM, met, 0, -L3 - 2, 0, 6); claw.rotation.z = Math.PI;
      legs.push({ i, sd, fem, tib, met, L1, L2, L3, fx, fz: sd * fz, s, ph0: (i % 2 ? Math.PI : 0) + (sd < 0 ? Math.PI : 0) });
    }
    const hd = new T.Vector3();
    let rear = 0;
    return (e, t, dt) => {
      const held = e.held, walking = e.moving && e.grounded && !held, inAir = !e.grounded && !held;
      const spit = e.spitT > 0, angry = angryOf(e) || spit, sleep = e.sleeping || e.mood === 'sleep', dizzy = e.mood === 'dizzy' || e.dizzy > 0;
      const ph = (e.phase || 0) * 1.4;
      const pulse = Math.sin(t * 2.2 + e.seed);
      abG.scale.set(1 + pulse * 0.025, 1 + pulse * 0.035, 1 + pulse * 0.03);
      abG.rotation.z = 0.12 + (angry ? Math.sin(t * 5) * 0.03 : 0);
      rear = damp(rear, spit ? 1 : angry && !walking ? 0.5 : 0, 7, dt);
      bod.rotation.z = rear * 0.1; bod.position.y = (walking ? Math.sin(ph * 2) * 1.5 : 0) + rear * 6 - (sleep ? 10 : 0);
      // eyes glow brighter when it is angry, dim when asleep
      eyeM.emissiveIntensity = sleep ? 0.05 : angry ? 1.3 + Math.sin(t * 12) * 0.25 : 0.8 + Math.sin(t * 3 + e.seed) * 0.15;
      for (const ey of eyes) ey.scale.y = dizzy ? ey.scale.x * 0.4 : ey.scale.x;
      // fangs spread and drip
      const spread = angry ? 0.45 + Math.sin(t * 7) * 0.15 : 0.08;
      for (const F of fangs) { F.fg.rotation.x = -F.sd * spread; F.fg.rotation.z = angry ? 0.25 : 0; const d = (t * 1.5 + F.sd) % 1; F.drop.visible = angry; F.drop.position.y = -18 - d * 14; }
      for (const P of palps) {
        const w = Math.sin(t * 6 + P.sd * 2) * (angry ? 6 : 2);
        ik(P.up, P.lo, 20, 18, X + 88 + w, -20 + (angry ? 10 : 0), P.sd * 17, 0, 1, 0);
      }
      for (const L of legs) {
        const p2 = ph + L.ph0, tw = Math.sin(t * 9 + L.i * 1.7 + L.sd) * (angry ? 2.6 : 1.1);
        let fx = L.fx + (walking ? Math.sin(p2) * 22 : 0) + tw, fy = -98 + (walking ? Math.max(0, Math.cos(p2)) * 18 : 0), fz = L.fz;
        let elev = 0.98 + (walking ? Math.max(0, Math.cos(p2)) * 0.12 : 0);
        if (inAir) { fy += 34; fx = fx * 0.75; fz *= 0.8; }
        if (held) { fx = fx * 0.4 + Math.sin(t * 13 + L.i * 2 + L.sd) * 10; fy = -50 + Math.cos(t * 12 + L.i) * 12; fz *= 0.6; elev = 1.1; }
        if (L.i === 0 && rear > 0.01 && !held) { fx = lerp(fx, 168 + X, rear); fy = lerp(fy, 40 + Math.sin(t * 16 + L.sd) * 5, rear); fz = lerp(fz, L.sd * 40, rear); elev = lerp(elev, 1.15, rear); }
        if (sleep && !held) { fx = L.fx * 0.7; fz = L.fz * 0.75; fy = -98; elev = 0.6; }
        // the foot target is in model space; the legs hang off the body, which rears and bobs
        const cz = Math.cos(bod.rotation.z), sz = Math.sin(bod.rotation.z), dx0 = fx - bod.position.x, dy0 = fy - bod.position.y;
        fx = dx0 * cz + dy0 * sz; fy = -dx0 * sz + dy0 * cz;
        // femur rises from the body toward the foot's side, then the tibia and metatarsus reach down to the foot
        const a = L.fem.position;
        hd.set(fx - a.x, 0, fz - a.z); hd.divideScalar(hd.length() || 1);
        const ce = Math.cos(elev), se = Math.sin(elev);
        aimDown(L.fem, hd.x * ce, se, hd.z * ce);
        // tibia + metatarsus: two-bone IK in the femur's frame, the middle joint bowing outward and up
        _q.copy(L.fem.quaternion).invert();
        const loc = _p.set(fx, fy, fz).sub(a).applyQuaternion(_q), pole = _s.set(hd.x * 1.6, 0.5, hd.z * 1.6).applyQuaternion(_q);
        ik(L.tib, L.met, L.L2, L.L3, loc.x, loc.y, loc.z, pole.x, pole.y, pole.z);
      }
    };
  };

  // =====================================================================================================
  // THE GIANT MOTH: a death's-head hawkmoth the size of a bus. Huge mottled forewings with staring eyespots, amber
  // hindwings with black bands, a furry thorax with the pale skull, a banded abdomen, glowing compound eyes and
  // feathered antennae whose tips flare when it fires its prism beam (from template (60, 0)).
  // The body banks toward the camera in flight so you see its back and wings, not just their edges.
  // =====================================================================================================
  function wingTex(kind, col) {
    const fore = kind === 'F', W = 512, H = fore ? 420 : 300;
    return canvasTex('mw' + kind + col, W, H, (x, w, h, r) => {
      const dk = SB.shade(col, 0.55), lt = mix(col, '#e8dcc4', 0.35);
      if (fore) {
        x.fillStyle = SB.shade(col, 0.35); x.fillRect(0, 0, w, h);
        blots(x, w, h, r, 260, 4, 22, 0, 0, 0.18); blots(x, w, h, r, 120, 4, 14, 255, 255, 0.06);
        for (let i = 0; i < 3500; i++) { x.fillStyle = r() < 0.5 ? dk : lt; x.globalAlpha = 0.25; x.fillRect(r() * w, r() * h, 2, 1.2); }
        x.globalAlpha = 1;
        // wavy dark cross-lines and a pale band
        x.lineWidth = 3; x.strokeStyle = SB.shade(col, 0.7);
        for (let i = 0; i < 4; i++) { x.beginPath(); for (let j = 0; j <= 20; j++) { const u = j / 20, px = w * (0.15 + i * 0.17) + Math.sin(u * 18 + i) * 6 + u * 40, py = h * (1 - u); j ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
        x.globalAlpha = 0.3; x.fillStyle = lt; x.beginPath(); x.ellipse(w * 0.45, h * 0.45, w * 0.06, h * 0.42, 0.5, 0, TAU); x.fill(); x.globalAlpha = 1;
        // the eyespot that stares back, and a small blue one
        const ex = w * 0.55, ey = h * 0.38;
        x.fillStyle = '#ded6c0'; x.beginPath(); x.arc(ex, ey, 62, 0, TAU); x.fill();
        x.fillStyle = '#1a0a06'; x.beginPath(); x.arc(ex, ey, 50, 0, TAU); x.fill();
        x.fillStyle = '#8a1a10'; x.beginPath(); x.ellipse(ex, ey, 38, 44, 0, 0, TAU); x.fill();
        x.fillStyle = '#0a0302'; x.beginPath(); x.ellipse(ex, ey, 9, 32, 0, 0, TAU); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(ex - 13, ey - 15, 8, 0, TAU); x.fill();
        x.fillStyle = '#2b6cb0'; x.beginPath(); x.arc(w * 0.24, h * 0.62, 12, 0, TAU); x.fill();
        // veins
        x.strokeStyle = SB.shade(col, 0.6); x.lineWidth = 2.2; x.globalAlpha = 0.7;
        for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(w * 0.36, h); x.quadraticCurveTo(w * (0.3 + i * 0.07), h * 0.5, w * (0.2 + i * 0.14), 0); x.stroke(); }
        x.globalAlpha = 1;
      } else {
        const am = mix(col, '#e0a030', 0.62);
        x.fillStyle = am; x.fillRect(0, 0, w, h);
        blots(x, w, h, r, 140, 4, 18, 0, 0, 0.1);
        x.fillStyle = '#140c08';
        for (const [v, th] of [[0.42, 0.1], [0.78, 0.14]]) { x.beginPath(); for (let j = 0; j <= 24; j++) { const u = j / 24; x.lineTo(w * u, h * (1 - v) + Math.sin(u * 22) * 6); } for (let j = 24; j >= 0; j--) { const u = j / 24; x.lineTo(w * u, h * (1 - v - th) + Math.sin(u * 22 + 1) * 6); } x.fill(); }
        const gr = x.createLinearGradient(0, h, 0, h * 0.7); gr.addColorStop(0, SB.shade(col, 0.3)); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, h * 0.7, w, h * 0.3);
      }
    });
  }
  // a wing outline (x along the body, y = span), smoothed through the midpoints of the 2D polygon
  function wingGeo(key, P) {
    return M3.geo(key, () => {
      const s = new T.Shape(), n = P.length / 2, mx = i => (P[(i % n) * 2] + P[((i + 1) % n) * 2]) / 2, my = i => (P[(i % n) * 2 + 1] + P[((i + 1) % n) * 2 + 1]) / 2;
      s.moveTo(mx(0), my(0));
      for (let i = 1; i <= n; i++) s.quadraticCurveTo(P[(i % n) * 2], P[(i % n) * 2 + 1], mx(i), my(i));
      const g = new T.ShapeGeometry(s, 10); g.computeBoundingBox(); return g;
    });
  }
  function fitTex(tex, g) { const b = g.boundingBox, w = b.max.x - b.min.x, h = b.max.y - b.min.y; tex.repeat.set(1 / w, 1 / h); tex.offset.set(-b.min.x / w, -b.min.y / h); tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; }
  const FORE = [-2, 6, 30, 32, 68, 62, 66, 74, 50, 82, 30, 86, 0, 80, -26, 64, -38, 40, -28, 14];
  const HIND = [-6, 4, -30, 24, -54, 44, -68, 42, -78, 22, -64, 6, -36, 0];
  named['giant moth'] = function (e, k) {
    const g = rootOf(e, k), fur = TX.fur(), BODY = k.col('body'), WING = k.col('wing');
    const furM = tmat(k, mix(BODY, '#fff', 0.06), { rough: 0.95 }, { tag: 'mof', map: fur, bumpMap: fur, bumpScale: 1.4 });
    const bandM = tmat(k, mix(BODY, '#d8b04a', 0.42), { rough: 0.95 }, { tag: 'mob', map: fur, bumpMap: fur, bumpScale: 1.4 });
    const bone = k.mat('#e6dcc0', { rough: 0.7 }), black = k.mat('#140e0b', { rough: 0.8 });
    const gF = wingGeo('mothFore', FORE), gH = wingGeo('mothHind', HIND);
    const tF = wingTex('F', WING), tH = wingTex('H', WING); fitTex(tF, gF); fitTex(tH, gH);
    const foreM = tmat(k, '#ffffff', { rough: 0.8, side: 'double' }, { tag: 'mwf', map: tF });
    const hindM = tmat(k, '#ffffff', { rough: 0.8, side: 'double' }, { tag: 'mwh', map: tH });
    const beamM = k.mat('#ffffff', { glow: '#ffe0ff', glowK: 0.0, opacity: 0.9, tag: 'beam' });
    const glow = glowOf(e, '#ff5a1f');
    const fly = k.group(g, 0, 0, 0), bod = k.group(fly, 0, 0, 0);
    // thorax: a ball of fur with the pale skull on its back
    k.sphere([18, 14, 15], furM, bod, 4, 0, 0);
    k.sphere([9, 12, 13], furM, bod, 15, 0, 0);
    const skull = k.group(bod, 3, 12.6, 0);
    k.sphere([9, 2.4, 7.6], bone, skull, 0, 0, 0); k.sphere([4.4, 2, 4.8], bone, skull, 7, -0.8, 0);
    for (const z of [-3.2, 3.2]) k.sphere([2.4, 1.2, 2.3], black, skull, -0.5, 1.4, z);
    k.box(3.6, 1.2, 2.2, black, skull, 6.5, 0.6, 0);
    // abdomen: banded segments ending in a tuft
    for (let i = 0; i < 6; i++) { const r = 10.5 - i * 1.1; k.sphere([7.2, r, r * 1.05], i % 2 ? bandM : furM, bod, -14 - i * 8, -1 - i * 0.4, 0); }
    const tuft = k.cone(5, 12, furM, bod, -66, -3, 0, 8); tuft.rotation.z = Math.PI / 2;
    // head, glowing compound eyes, palps, coiled proboscis
    k.sphere(8, furM, bod, 26, 0, 0);
    for (const sd of [1, -1]) { k.eye(4.4, bod, 29, 2, sd * 5.5, { dir: [0.6, 0.15, sd], glow }); k.sphere([3, 3.6, 2.4], furM, bod, 33, -3, sd * 2.4); }
    k.tube([[31, -6, 0], [34, -10, 0], [31, -13, 0], [28, -10, 0], [30, -8, 0]], 1, 0.6, black, bod, 10, 6);
    // feathered antennae
    const antG = M3.geo('mothAnt', () => {
      const p = [new T.CylinderGeometry(0.6, 1, 40, 6).translate(0, 20, 0).rotateZ(-Math.PI / 2)];
      for (let i = 0; i < 16; i++) { const x = 4 + i * 2.25, L = 5.5 * Math.sin((i + 1) / 17 * Math.PI) + 1; for (const sd of [1, -1]) p.push(spikeGeo(x, 0, 0, x + L * 0.6, sd * L * 0.6, L * 0.5, 0.35, 3)); }
      return merge(p);
    });
    const ants = [];
    for (const sd of [1, -1]) {
      const a = k.group(bod, 30, 5, sd * 3);
      const m = k.mesh(antG, furM, a); m.rotation.x = sd > 0 ? 0 : Math.PI;
      const tip = k.sphere(3.4, beamM, a, 40, 0, 0); tip.castShadow = false;
      ants.push({ a, sd, tip });
    }
    // legs (tucked in flight)
    const legs = [];
    for (let i = 0; i < 3; i++) for (const sd of [1, -1]) {
      const up = k.group(bod, 12 - i * 8, -10, sd * 6);
      k.cyl(1.4, 1.1, 18, black, up, 0, -9, 0, 6);
      const lo = k.group(up, 0, -18, 0); k.cyl(1.1, 0.6, 20, black, lo, 0, -10, 0, 6);
      legs.push({ up, lo, i, sd });
    }
    // wings: near (+z) and far; forewing over hindwing, each a membrane on a pivot at the thorax
    const wings = [];
    for (const sd of [1, -1]) {
      const piv = k.group(bod, 4, 7, sd * 8);
      const hp = k.group(piv, -4, -1, 0);
      const h = k.mesh(gH, hindM, hp); h.rotation.x = sd * Math.PI / 2;
      const f = k.mesh(gF, foreM, piv); f.rotation.x = sd * Math.PI / 2; f.position.y = 0.6;
      wings.push({ piv, hp, sd });
    }
    let roll = 0, flapS = 0;
    return (e, t, dt) => {
      const held = e.held, flying = e.flying && !held, grounded = e.grounded && !held, angry = angryOf(e), gust = e.gustT > 0, beam = e.laserT > 0;
      const sleep = e.sleeping || e.mood === 'sleep';
      // bank toward the camera (the model's +z is the near side when facing right)
      const bank = (flying ? 0.62 : grounded ? 0.3 : 0.5) * (e.facing >= 0 ? 1 : -1);
      roll = damp(roll, bank, 5, dt); bod.rotation.x = roll;
      bod.rotation.z = damp(bod.rotation.z, gust ? -0.25 : flying ? 0.12 : 0, 5, dt);
      fly.position.y = flying ? Math.sin(t * 11 + e.seed) * 3 : grounded ? -58 : 0;
      // flapping
      let ang;
      if (held) ang = 0.5 + Math.sin(t * 30) * 0.25;
      else if (flying) { const rate = gust ? 24 : 11; flapS += dt * rate; ang = 0.35 + Math.sin(flapS) * (gust ? 1.05 : 0.8); }
      else if (grounded) ang = sleep ? 1.3 : 0.95 + Math.sin(t * 2 + e.seed) * 0.08 + (angry ? Math.sin(t * 14) * 0.15 : 0);
      else ang = 0.6 + Math.sin(t * 16) * 0.5;
      for (const W of wings) { W.piv.rotation.x = -W.sd * ang; W.hp.rotation.x = W.sd * 0.12; W.piv.rotation.y = W.sd * (flying ? Math.cos(flapS) * 0.12 : 0); }
      // antennae (vibrate when angry, flare on the beam)
      beamM.emissiveIntensity = beam ? (Math.floor(t * 30) % 2 ? 5 : 3) : angry ? 0.3 : 0;
      for (const A of ants) {
        const vib = angry ? Math.sin(t * 30 + A.sd) * 0.05 : 0;
        A.a.rotation.set(0, -A.sd * 0.55 + vib, 0.15 + vib);
        A.tip.visible = beam || angry; A.tip.scale.setScalar(beam ? 3.4 + Math.sin(t * 40) : 1.4);
      }
      for (const L of legs) {
        if (flying || held) { L.up.rotation.set(L.sd * 0.25, 0, 1.0 - L.i * 0.3 + (held ? Math.sin(t * 14 + L.i) * 0.4 : 0)); L.lo.rotation.set(0, 0, -1.9); }
        else { L.up.rotation.set(L.sd * 0.55, 0, (1 - L.i) * 0.5); L.lo.rotation.set(-L.sd * 0.5, 0, (1 - L.i) * -0.3); }
      }
    };
  };
})();
