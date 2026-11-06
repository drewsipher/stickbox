'use strict';
// r3d.js — the 3D world. The game still simulates on a flat stage (x across, y down, like a side-view
// fighting game); this file draws that stage as a real 3D scene with Three.js: lit 3D models, a meadow that
// runs to the horizon with hills, trees and mountains, drifting clouds and soft shadows.
//
// Model builders live in js/3d/m-*.js and register with SB.M3:
//   SB.M3.kinds[tpl.kind] = (e, k, tpl) => update   // every def whose template is of that kind (humanoid, quad...)
//   SB.M3.named[def.name] = (e, k, tpl) => update   // one def by name (wins over kinds)
// A builder adds meshes to k.root (see the kit below) and may return update(e, t, dt), called every frame.
// Model space: template units (the same numbers the 2D drawings use), origin at the template centre,
// +x = the way it faces, +y = UP (2D drawings use y down), +z = its near side. Fit the def's w x h box.
// Anything without a builder becomes a solid shape cut from its own painting (M3.paper).
(function () {
  if (!window.THREE) return;
  const T = THREE, TAU = Math.PI * 2;
  T.ColorManagement.legacyMode = false;   // hex colours are sRGB, as in the 2D game
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const M3 = SB.M3 = { kinds: {}, named: {}, ok: false };
  let W = SB.world;   // game.js fills this in later (init picks it up)

  // ---------- shared geometry ----------
  const GEO = new Map();
  const geo = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); g.userData.shared = true; GEO.set(key, g); } return g; };
  const rq = v => Math.round(v * 4) / 4;
  M3.geo = geo;

  // a tube along a 3D path with a radius that tapers from r0 to r1 (tails, necks, tentacles, snakes);
  // call .setPath(points) every frame to bend it
  class Tube extends T.BufferGeometry {
    constructor(n, radial, r0, r1, capEnds) {
      super();
      this.n = n; this.radial = radial; this.r0 = r0; this.r1 = r1; this.radius = typeof r0 === 'function' ? r0 : (u => r0 + (r1 - r0) * u);
      const rings = n + 1, vc = rings * (radial + 1) + (capEnds ? 2 : 0);
      this.pos = new Float32Array(vc * 3); this.nor = new Float32Array(vc * 3);
      const uv = new Float32Array(vc * 2), idx = [];
      for (let i = 0; i < rings; i++) for (let j = 0; j <= radial; j++) { uv[(i * (radial + 1) + j) * 2] = j / radial; uv[(i * (radial + 1) + j) * 2 + 1] = i / n; }
      for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      if (capEnds) {
        const c0 = rings * (radial + 1), c1 = c0 + 1, last = n * (radial + 1);
        for (let j = 0; j < radial; j++) { idx.push(c0, j + 1, j); idx.push(c1, last + j, last + j + 1); }
      }
      this.capEnds = capEnds;
      this.setIndex(idx);
      this.setAttribute('position', new T.BufferAttribute(this.pos, 3));
      this.setAttribute('normal', new T.BufferAttribute(this.nor, 3));
      this.setAttribute('uv', new T.BufferAttribute(uv, 2));
    }
    // points: array of [x,y,z] (any count >= 2); resampled to n segments along a smooth curve
    setPath(points) {
      const n = this.n, radial = this.radial, P = this.pos, N = this.nor;
      const pts = points.map(p => new T.Vector3(p[0], p[1], p[2] || 0));
      const curve = pts.length > 2 ? new T.CatmullRomCurve3(pts, false, 'centripetal') : new T.LineCurve3(pts[0], pts[1]);
      const frames = curve.computeFrenetFrames(n, false), c = new T.Vector3();
      for (let i = 0; i <= n; i++) {
        const u = i / n; curve.getPointAt(u, c);
        const r = Math.max(0.01, this.radius(u)), nn = frames.normals[i], bb = frames.binormals[i];
        for (let j = 0; j <= radial; j++) {
          const a = j / radial * TAU, ca = Math.cos(a), sa = Math.sin(a), o = (i * (radial + 1) + j) * 3;
          const nx = ca * nn.x + sa * bb.x, ny = ca * nn.y + sa * bb.y, nz = ca * nn.z + sa * bb.z;
          N[o] = nx; N[o + 1] = ny; N[o + 2] = nz; P[o] = c.x + nx * r; P[o + 1] = c.y + ny * r; P[o + 2] = c.z + nz * r;
        }
      }
      if (this.capEnds) {
        const c0 = (n + 1) * (radial + 1) * 3, t0 = frames.tangents[0], t1 = frames.tangents[n];
        curve.getPointAt(0, c); P[c0] = c.x; P[c0 + 1] = c.y; P[c0 + 2] = c.z; N[c0] = -t0.x; N[c0 + 1] = -t0.y; N[c0 + 2] = -t0.z;
        curve.getPointAt(1, c); P[c0 + 3] = c.x; P[c0 + 4] = c.y; P[c0 + 5] = c.z; N[c0 + 3] = t1.x; N[c0 + 4] = t1.y; N[c0 + 5] = t1.z;
      }
      this.attributes.position.needsUpdate = true; this.attributes.normal.needsUpdate = true;
      this.computeBoundingSphere();
      return this;
    }
  }
  M3.Tube = Tube;

  // ---------- the model kit: what a builder gets as `k` ----------
  // k.col(role)                     palette colour, exactly like pen.use(role) in the 2D drawings
  // k.mat(color, o)                 a material; o: { rough, metal, glow (emissive colour), glowK, opacity, side, flat, map }
  // k.group(parent, x, y, z)        an empty group (a joint you can rotate)
  // k.sphere(r | [rx,ry,rz], mat, parent, x, y, z)
  // k.box(w, h, d, mat, parent, x, y, z)          k.rbox(...) same with rounded edges (radius = 6th arg after z... see below)
  // k.cyl(rTop, rBottom, len, mat, parent, x, y, z) along +y, centred
  // k.cone(r, len, mat, parent, x, y, z)           point up (+y)
  // k.limb(len, r0, r1, mat, parent, x, y, z)      a rounded tapered limb hanging down from a pivot (rotate the pivot)
  // k.tube(points, r0, r1, mat, parent, n)         a bending tube; returns the mesh, mesh.geometry.setPath(points) to animate
  // k.lathe(profile [[r, y]...], mat, parent, x, y, z)   a turned shape around +y (bottles, bodies, pots)
  // k.extrude(pts [x0,y0,x1,y1...], depth, mat, parent, x, y, z, bevel)  a flat outline given thickness (blades, wings, ears)
  // k.eye(r, parent, x, y, z, o)    a realistic eye; o: { dir: [x,y,z] where it looks out, iris: colour, glow: colour (bosses), lid }
  // k.mesh(geometry, mat, parent)   any geometry
  // k.root                          add everything to this (it is the entity)
  // k.world                         a group in game coordinates (for swarms/projectiles); use k.wp(x, y) for a point there
  // k.e, k.def, k.tpl               the entity, definition, template
  // Shapes get shadows automatically. Every material made by k.mat follows the entity's hit-flash, poison and invisibility.
  const GMATS = new Map();
  function kit(e, tpl) {
    const k = { e, def: e.def, tpl, mats: [], own: [], root: new T.Group(), world: new T.Group() };
    const pal = e.pal || e.def.pal || {};
    k.col = role => pal[role] || (SB.ROLES && SB.ROLES[role]) || pal.body || '#fff';
    // materials are shared by every thing of the same kind (far fewer state changes when drawing); one made with
    // its own private texture stays private. Hit flash, poison and invisibility work on private copies (fxMats).
    const mcache = new Map();
    k.mat = (color, o) => {
      o = o || {};
      const priv = o.map && !o.map.userData.shared;
      const key = color + '|' + JSON.stringify(o, (kk, v) => v && v.isTexture ? v.uuid : v);   // textures key by id
      const cache = priv ? mcache : GMATS, gkey = priv ? key : e.def.name + '|' + key;
      let m = cache.get(gkey); if (m) { if (!priv && !k.mats.includes(m)) k.mats.push(m); return m; }
      const P = { color: new T.Color(color || '#fff'), roughness: o.rough != null ? o.rough : 0.72, metalness: o.metal || 0, flatShading: !!o.flat };
      if (o.glow) { P.emissive = new T.Color(o.glow); P.emissiveIntensity = o.glowK != null ? o.glowK : 1; }
      if (o.opacity != null && o.opacity < 1) { P.transparent = true; P.opacity = o.opacity; P.depthWrite = o.opacity > 0.6; }
      if (o.side === 'double') P.side = T.DoubleSide;
      if (o.map) P.map = o.map;
      m = o.basic ? new T.MeshBasicMaterial({ color: P.color, transparent: P.transparent, opacity: P.opacity, side: P.side, map: P.map }) : new T.MeshStandardMaterial(P);
      m.userData.base = { emissive: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent };
      m.userData.shared = !priv;
      cache.set(gkey, m); k.mats.push(m);
      return m;
    };
    const place = (o, parent, x, y, z) => { o.position.set(x || 0, y || 0, z || 0); (parent || k.root).add(o); return o; };
    k.mesh = (g, m, parent, x, y, z) => { const me = new T.Mesh(g, typeof m === 'string' ? k.mat(m) : m); me.castShadow = false; me.receiveShadow = true; return place(me, parent, x, y, z); };
    k.group = (parent, x, y, z) => place(new T.Group(), parent, x, y, z);
    k.sphere = (r, m, parent, x, y, z) => {
      const me = k.mesh(geo('sphere', () => new T.SphereGeometry(1, 20, 14)), m, parent, x, y, z);
      if (Array.isArray(r)) me.scale.set(r[0], r[1], r[2]); else me.scale.setScalar(r);
      return me;
    };
    k.box = (w, h, d, m, parent, x, y, z) => { const me = k.mesh(geo('box', () => new T.BoxGeometry(1, 1, 1)), m, parent, x, y, z); me.scale.set(w, h, d); return me; };
    k.rbox = (w, h, d, m, parent, x, y, z, r) => {
      r = Math.min(r == null ? Math.min(w, h, d) * 0.18 : r, Math.min(w, h, d) * 0.49);
      const g = geo('rbox:' + rq(w) + ':' + rq(h) + ':' + rq(d) + ':' + rq(r), () => {
        const s = new T.Shape(), hw = Math.max(0.01, w / 2 - r), hh = Math.max(0.01, h / 2 - r);   // the bevel adds r all round
        s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
        const gg = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: 3, curveSegments: 4 });
        gg.translate(0, 0, -(d - 2 * r) / 2); gg.computeVertexNormals(); return gg;
      });
      return k.mesh(g, m, parent, x, y, z);
    };
    k.cyl = (r0, r1, len, m, parent, x, y, z, seg) => k.mesh(geo('cyl:' + rq(r0) + ':' + rq(r1) + ':' + rq(len) + ':' + (seg || 18), () => new T.CylinderGeometry(r0, r1, len, seg || 18)), m, parent, x, y, z);
    k.cone = (r, len, m, parent, x, y, z, seg) => k.mesh(geo('cone:' + rq(r) + ':' + rq(len) + ':' + (seg || 16), () => new T.ConeGeometry(r, len, seg || 16)), m, parent, x, y, z);
    k.limb = (len, r0, r1, m, parent, x, y, z) => {
      const piv = k.group(parent, x, y, z);
      const g = geo('limb:' + rq(len) + ':' + rq(r0) + ':' + rq(r1), () => {
        const prof = [], N = 6;
        for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + i / N * Math.PI / 2; prof.push(new T.Vector2(Math.max(0, Math.cos(a) * r1), -len + Math.sin(a) * r1)); }   // rounded far end
        for (let i = 0; i <= N; i++) { const a = i / N * Math.PI / 2; prof.push(new T.Vector2(Math.max(0, Math.cos(a) * r0), Math.sin(a) * r0)); }                     // rounded joint end
        return new T.LatheGeometry(prof, 14);
      });
      piv.limb = k.mesh(g, m, piv);
      return piv;
    };
    k.tube = (points, r0, r1, m, parent, n, radial) => {
      const g = new Tube(n || 16, radial || 10, r0, r1, true); g.setPath(points); k.own.push(g);
      return k.mesh(g, m, parent);
    };
    k.lathe = (profile, m, parent, x, y, z, seg) => {
      const g = new T.LatheGeometry(profile.map(p => new T.Vector2(Math.max(0, p[0]), p[1])), seg || 24); k.own.push(g);
      return k.mesh(g, m, parent, x, y, z);
    };
    k.extrude = (pts, depth, m, parent, x, y, z, bevel) => {
      const s = new T.Shape(); s.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]);
      const b = bevel == null ? Math.min(depth * 0.4, 1.5) : bevel;
      const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, depth - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
      g.translate(0, 0, -(depth - 2 * b) / 2); k.own.push(g);
      return k.mesh(g, m, parent, x, y, z);
    };
    k.eye = (r, parent, x, y, z, o) => {
      o = o || {};
      const ball = k.group(parent, x, y, z), dir = new T.Vector3(...(o.dir || [1, 0, 0.35])).normalize();
      const glow = o.glow;
      k.sphere(r, glow ? k.mat(glow, { glow, glowK: 1.4, rough: 0.2 }) : k.mat(o.white || '#f4efe6', { rough: 0.25 }), ball);
      const irisG = k.group(ball);
      const iris = k.mesh(geo('iris', () => new T.CircleGeometry(1, 20)), glow ? k.mat('#fff4c0', { glow: '#fff4c0', glowK: 1.2 }) : k.mat(o.iris || '#5a3a1a', { rough: 0.3 }), irisG, 0, 0, 1.002);
      iris.scale.setScalar(glow ? 0.0001 : 0.62);
      const pup = k.mesh(geo('iris', () => new T.CircleGeometry(1, 20)), k.mat('#0b0806', { rough: 0.2 }), irisG, 0, 0, 1.006);
      if (glow) pup.scale.set(0.16, 0.7, 1); else pup.scale.setScalar(0.3);
      irisG.scale.setScalar(r);
      const q0 = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), dir);
      irisG.quaternion.copy(q0);
      if (o.lid !== false && !glow) { const lid = k.sphere([r * 1.06, r * 1.06, r * 1.06], k.mat(o.lid || k.col('skin')), ball); lid.scale.y = r * 0.55; lid.position.y = r * 0.62; ball.lid = lid; }
      const tmp = new T.Quaternion(), eu = new T.Euler();
      ball.update = (en) => {   // look toward lookX/lookY a little, blink, squint when angry
        eu.set(-(en.lookY || 0) * 0.45, 0, 0); tmp.setFromEuler(eu); irisG.quaternion.copy(q0).premultiply(tmp);
        const shut = en.sleeping || en.ko || en.mood === 'sleep' ? 1 : ((en.seed * 7 + (W.time || 0)) % 4 < 0.12 ? 1 : 0);
        ball.scale.y = shut ? 0.12 : en.mood === 'angry' ? 0.72 : 1;
      };
      k.eyes = k.eyes || []; k.eyes.push(ball);
      return ball;
    };
    k.wp = (x, y, z) => new T.Vector3(x, -y, z || 0);
    return k;
  }
  M3.kit = kit;

  // ---------- fallback: a solid shape cut from the thing's own painting ----------
  // The 2D drawing is painted to a texture, its outline traced and extruded with a rounded bevel.
  const paperCanvas = document.createElement('canvas');
  function paintTo(cv, e, def, tpl, S, mx, my) {
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(S, 0, 0, S, cv.width / 2, cv.height / 2);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#3b322b'; c.lineWidth = 1.5;
    const pen = M3.pen || (M3.pen = new SB.Pen(c)); pen.ctx = c;
    pen.begin(e.seed, 0); pen.setPalette(e.pal || def.pal, def.seq); pen.shading = true; SB.realistic(pen, def);
    const f = e.facing; e.facing = 1;
    try { tpl.draw(pen, e, W.time || 0); } catch (err) { /* a drawing that needs live state can fail here: leave it blank */ }
    e.facing = f;
    pen.setPalette(null); pen.shading = false; pen.wobble = 1.1; pen.smooth = 0; pen.round = false; pen.inkK = 0.72;
  }
  function trace(alpha, gw, gh) {   // outlines of the solid regions of a gw x gh mask (marching squares, joined into loops)
    const at = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && alpha[y * gw + x];
    const segs = new Map(), key = (x, y) => x * 4096 + y;
    const add = (ax, ay, bx, by) => { const kk = key(ax, ay), l = segs.get(kk); if (l) l.push([bx, by]); else segs.set(kk, [[bx, by]]); };
    // each solid pixel's exposed edges, oriented so the solid side is on the same hand all the way round
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) add(x, y, x + 1, y);
      if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!at(x - 1, y)) add(x, y + 1, x, y);
    }
    const take = kk => { const l = segs.get(kk); if (!l) return null; const v = l.pop(); if (!l.length) segs.delete(kk); return v; };
    const loops = [];
    while (segs.size) {
      const k0 = segs.keys().next().value, sx = Math.floor(k0 / 4096), sy = k0 % 4096, loop = [sx, sy];
      let cur = take(k0), guard = 0;
      while (cur && guard++ < 200000) {
        if (cur[0] === sx && cur[1] === sy) break;
        loop.push(cur[0], cur[1]);
        cur = take(key(cur[0], cur[1]));
      }
      if (loop.length >= 8) loops.push(loop);
    }
    return loops;
  }
  function simplify(pts, eps) {   // Ramer-Douglas-Peucker on a closed loop [x0,y0,x1,y1,...]
    const n = pts.length / 2; if (n < 8) return pts;
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let best = -1, bd = eps;
      const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i * 2 + 1]) - (ax - pts[i * 2]) * (by - ay)) / L; if (d > bd) { bd = d; best = i; } }
      if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
    return out;
  }
  const area = p => { let s = 0; for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; s += p[i] * p[j + 1] - p[j] * p[i + 1]; } return s / 2; };
  M3.paper = function (e, k, tpl) {
    const def = e.def, w = tpl.w, h = tpl.h, M = 1.6;   // paint with a margin: drawings spill past their box
    const S = clamp(300 / Math.max(w, h), 0.5, 4);
    const cw = Math.min(1024, Math.ceil(w * M * S)), ch = Math.min(1024, Math.ceil(h * M * S));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    paintTo(cv, e, def, tpl, S);
    // silhouette at a coarse grid
    const G = 2.5, gw = Math.ceil(cw / G), gh = Math.ceil(ch / G);
    const small = paperCanvas; small.width = gw; small.height = gh;
    const sc = small.getContext('2d'); sc.clearRect(0, 0, gw, gh); sc.drawImage(cv, 0, 0, gw, gh);
    const px = sc.getImageData(0, 0, gw, gh).data, alpha = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) alpha[i] = px[i * 4 + 3] > 40 ? 1 : 0;
    let loops = trace(alpha, gw, gh).map(l => simplify(l, 0.7)).filter(l => Math.abs(area(l)) > 6);
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
    const mat = k.mat('#ffffff', { map: tex, rough: def.creature ? 0.75 : 0.55 });
    // grid -> model units (y up, centred)
    const toM = (gx, gy) => [(gx * G - cw / 2) / S, -(gy * G - ch / 2) / S];
    const outer = loops.filter(l => area(l) > 0), holes = loops.filter(l => area(l) < 0);
    const shapes = outer.map(l => { const s = new T.Shape(); for (let i = 0; i < l.length; i += 2) { const [x, y] = toM(l[i], l[i + 1]); i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath(); s.loop = l; return s; });
    // holes go into whichever shape contains them
    for (const hl of holes) {
      const [hx, hy] = toM(hl[0], hl[1]);
      const host = shapes.find(s => { const l = s.loop; let inside = false; for (let i = 0, j = l.length - 2; i < l.length; j = i, i += 2) { const [xi, yi] = toM(l[i], l[i + 1]), [xj, yj] = toM(l[j], l[j + 1]); if ((yi > hy) !== (yj > hy) && hx < (xj - xi) * (hy - yi) / (yj - yi) + xi) inside = !inside; } return inside; });
      if (host) { const p = new T.Path(); for (let i = 0; i < hl.length; i += 2) { const [x, y] = toM(hl[i], hl[i + 1]); i ? p.lineTo(x, y) : p.moveTo(x, y); } host.holes.push(p); }
    }
    const depth = clamp(Math.min(w, h) * 0.5, 3, 70), bev = clamp(Math.min(w, h) * 0.07, 0.6, 9);
    for (const s of shapes) {
      const g = new T.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 3, curveSegments: 1 });
      g.translate(0, 0, -depth / 2);
      const P = g.attributes.position, uv = g.attributes.uv;
      // caps show the painting; the sides take the colour from a little inside the outline (not the dark ink line)
      const side = g.groups[1] || { start: P.count, count: 0 };
      let mx = 0, my = 0; for (let i = 0; i < P.count; i++) { mx += P.getX(i); my += P.getY(i); } mx /= P.count || 1; my /= P.count || 1;
      for (let i = 0; i < P.count; i++) {
        let x = P.getX(i), y = P.getY(i);
        if (i >= side.start && i < side.start + side.count) { const dx = mx - x, dy = my - y, d = Math.hypot(dx, dy) || 1, ins = Math.min(d * 0.5, 5 / S); x += dx / d * ins; y += dy / d * ins; }
        uv.setXY(i, (x * S + cw / 2) / cw, (y * S + ch / 2) / ch);
      }
      g.computeVertexNormals(); k.own.push(g);
      k.mesh(g, mat, k.root);
    }
    k.root.userData.paper = true;
    // living or flickering things repaint a few times a second so they still blink and flicker
    const live = def.creature || /fire|flame|torch|candle|tornado|black hole|sun|lightning|rainbow|firework|bomb|dynamite/.test(def.name);
    let tick = 0;
    return live ? (en) => { if ((tick++ & 3) === 0) { paintTo(cv, en, def, tpl, S); tex.needsUpdate = true; } } : null;
  };

  // ---------- scene ----------
  let R = null, scene, cam, sun, hemi, sky, ground, scenery = null, bin3 = null, stage = { w: 0, h: 0, g: 0 };
  const ents = new Set();
  M3.init = function (cv) {
    W = SB.world;
    try { R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, preserveDrawingBuffer: !!window.__keep3d, powerPreference: 'high-performance' }); }
    catch (err) { console.warn('3D unavailable', err); return false; }
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(28, 1, 20, 60000);
    hemi = new T.HemisphereLight(0xd6ebff, 0x6b7a4a, 0.85); scene.add(hemi);
    sun = new T.DirectionalLight(0xfff0d8, 2.1); sun.castShadow = true;
    sun.shadow.autoUpdate = false;   // only the scenery casts into the shadow map: redrawn when it is rebuilt
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6; sun.shadow.radius = 4;
    scene.add(sun, sun.target);
    scene.fog = new T.Fog(0xdde9f1, 3500, 26000);
    // a soft sky-over-meadow reflection for every material, so metal, glass and gems look polished
    try {
      const es = new T.Scene(), sg = new T.SphereGeometry(10, 32, 16), cols = [], c = new T.Color();
      for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / 10; c.set(y > 0.02 ? 0x9ccbef : y > -0.08 ? 0xeef3ef : 0x5f8a45); if (y > 0.5) c.lerp(new T.Color(0x4f8fd0), (y - 0.5) * 2); cols.push(c.r, c.g, c.b); }
      sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      es.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      const sunB = new T.Mesh(new T.SphereGeometry(0.8, 12, 8), new T.MeshBasicMaterial({ color: 0xfff4d8 })); sunB.material.color.multiplyScalar(6); sunB.position.set(-5, 7, 4); es.add(sunB);
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose();
    } catch (err) { /* no reflections, still fine */ }
    M3.scene = scene; M3.camera = cam; M3.renderer = R;
    M3.ok = true;
    return true;
  };

  function skyTexture() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#4f8fd0'); g.addColorStop(0.5, '#9cc8ee'); g.addColorStop(0.82, '#dfecf5'); g.addColorStop(1, '#f3ecdc');
    x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  function grassTexture() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = '#5f9a42'; x.fillRect(0, 0, S, S);
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 2600; i++) { const px = rnd() * S, py = rnd() * S, r = 2 + rnd() * 9; x.fillStyle = `rgba(${60 + rnd() * 60 | 0},${120 + rnd() * 60 | 0},${30 + rnd() * 30 | 0},0.35)`; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
    x.lineCap = 'round';
    for (let i = 0; i < 9000; i++) { const px = rnd() * S, py = rnd() * S, l = 3 + rnd() * 7; x.strokeStyle = rnd() > 0.5 ? 'rgba(40,95,30,0.55)' : 'rgba(140,195,90,0.5)'; x.lineWidth = 0.8 + rnd(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 3, py - l); x.stroke(); }
    for (let i = 0; i < 160; i++) { x.fillStyle = ['#fff', '#ffd23f', '#f28cb1', '#b57edc'][i % 4]; x.beginPath(); x.arc(rnd() * S, rnd() * S, 1.6, 0, TAU); x.fill(); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
  }
  function buildScenery() {
    if (scenery) { scene.remove(scenery); scenery.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
    scenery = new T.Group(); scene.add(scenery);
    const Wd = stage.w, gy = -stage.g, rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    if (!scene.background) scene.background = skyTexture();
    // the meadow
    const gt = grassTexture(); gt.repeat.set(70, 30);
    ground = new T.Mesh(new T.PlaneGeometry(60000, 26000), new T.MeshStandardMaterial({ map: gt, roughness: 1, color: 0xffffff }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(Wd / 2, gy, -8000); ground.receiveShadow = true; scenery.add(ground);
    // a worn dirt strip along the stage (where everything walks)
    const dirt = new T.Mesh(new T.PlaneGeometry(Wd + 3000, 120), new T.MeshStandardMaterial({ color: 0x8a7a52, roughness: 1, transparent: true, opacity: 0.35 }));
    dirt.rotation.x = -Math.PI / 2; dirt.position.set(Wd / 2, gy + 0.5, 0); dirt.receiveShadow = true; scenery.add(dirt);
    // rolling hills and far blue mountains
    const hillM = new T.MeshStandardMaterial({ color: 0x6f9f58, roughness: 1 }), hillM2 = new T.MeshStandardMaterial({ color: 0x7fae69, roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const hm = new T.Mesh(geo('sphere', () => new T.SphereGeometry(1, 20, 14)), i % 2 ? hillM : hillM2);
      const r = 1800 + rnd() * 2400; hm.scale.set(r * (1.4 + rnd()), r * (0.05 + rnd() * 0.06), r);
      hm.position.set(Wd / 2 + (i - 4) * 2600 + rnd() * 900, gy, -3200 - rnd() * 4000); hm.receiveShadow = true; scenery.add(hm);
    }
    const mtM = new T.MeshStandardMaterial({ color: 0x8fa9c4, roughness: 1, flatShading: true }), snowM = new T.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 1, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const hgt = 3500 + rnd() * 4500, r = hgt * (0.9 + rnd() * 0.5), x = Wd / 2 + (i - 6) * 4200 + rnd() * 2000, z = -15000 - rnd() * 5000;
      const m = new T.Mesh(geo('mt', () => new T.ConeGeometry(1, 1, 7, 1)), mtM); m.scale.set(r, hgt, r * 0.8); m.position.set(x, gy + hgt / 2 - 200, z); m.rotation.y = rnd() * 3; scenery.add(m);
      const cap = new T.Mesh(geo('mt', () => new T.ConeGeometry(1, 1, 7, 1)), snowM); cap.scale.set(r * 0.32, hgt * 0.32, r * 0.26); cap.position.set(x, gy + hgt - 200 - hgt * 0.16 + 2, z); cap.rotation.y = m.rotation.y; scenery.add(cap);
    }
    // trees: a few groves behind the stage and on the hills
    const trunkG = new T.CylinderGeometry(0.12, 0.18, 1, 7), leafG = new T.IcosahedronGeometry(1, 1), pineG = new T.ConeGeometry(1, 1, 8);
    const trunkM = new T.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }), leafM = new T.MeshStandardMaterial({ color: 0x4e8a3a, roughness: 0.95, flatShading: true }), pineM = new T.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.95, flatShading: true });
    const N = 260, trunks = new T.InstancedMesh(trunkG, trunkM, N), leaves = new T.InstancedMesh(leafG, leafM, N), pines = new T.InstancedMesh(pineG, pineM, N);
    const mtx = new T.Matrix4(), q = new T.Quaternion(), sv = new T.Vector3(), pv = new T.Vector3(), col = new T.Color();
    let nl = 0, np = 0;
    for (let i = 0; i < N; i++) {
      const far = rnd(), z = -600 - far * far * 9000, x = Wd / 2 + (rnd() - 0.5) * (Wd + 4000 + -z * 2.2), s = 70 + rnd() * 110, pine = rnd() < 0.4;
      mtx.compose(pv.set(x, gy + s * 0.5, z), q.identity(), sv.set(s, s, s)); trunks.setMatrixAt(i, mtx);
      if (pine) { mtx.compose(pv.set(x, gy + s * 1.35, z), q, sv.set(s * 0.42, s * 1.7, s * 0.42)); pines.setMatrixAt(np, mtx); pines.setColorAt(np++, col.setHSL(0.33 + rnd() * 0.05, 0.4, 0.22 + rnd() * 0.08)); }
      else { mtx.compose(pv.set(x, gy + s * 1.25, z), q.setFromAxisAngle(sv.set(0, 1, 0), rnd() * 6), sv.set(s * 0.6, s * 0.55, s * 0.6)); leaves.setMatrixAt(nl, mtx); leaves.setColorAt(nl++, col.setHSL(0.26 + rnd() * 0.07, 0.42, 0.3 + rnd() * 0.1)); }
    }
    leaves.count = nl; pines.count = np;
    for (const m of [trunks, leaves, pines]) { m.castShadow = true; m.receiveShadow = true; scenery.add(m); }
    // grass tufts and flowers along the front of the stage
    const tuftG = new T.ConeGeometry(1, 1, 3), tuftM = new T.MeshStandardMaterial({ color: 0x4f8f35, roughness: 1, flatShading: true });
    const NT = 700, tufts = new T.InstancedMesh(tuftG, tuftM, NT);
    for (let i = 0; i < NT; i++) {
      const z = 40 + rnd() * 900, x = Wd / 2 + (rnd() - 0.5) * (Wd + z * 1.6), s = 4 + rnd() * 7;
      mtx.compose(pv.set(x, gy + s * 0.5, z), q.setFromAxisAngle(sv.set(0, 1, 0), rnd() * 6), sv.set(s * 0.35, s, s * 0.35)); tufts.setMatrixAt(i, mtx);
      tufts.setColorAt(i, col.setHSL(0.25 + rnd() * 0.08, 0.5, 0.28 + rnd() * 0.15));
    }
    tufts.receiveShadow = true; scenery.add(tufts);
    // puffy clouds
    const cloudM = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, flatShading: false });
    M3.clouds = [];
    for (let i = 0; i < 9; i++) {
      const cg = new T.Group(), s = 120 + rnd() * 160;
      for (let j = 0; j < 6; j++) { const m = new T.Mesh(geo('sphere', () => new T.SphereGeometry(1, 20, 14)), cloudM); const r = s * (0.45 + rnd() * 0.4); m.scale.set(r * 1.3, r, r); m.position.set((j - 2.5) * s * 0.42, (rnd() - 0.3) * s * 0.3, (rnd() - 0.5) * s * 0.4); cg.add(m); }
      cg.position.set(Wd / 2 + (rnd() - 0.5) * 9000, -stage.g + stage.g * 0.7 + 900 + rnd() * 1800, -6000 - rnd() * 6000);
      cg.userData.sp = 20 + rnd() * 30; scenery.add(cg); M3.clouds.push(cg);
    }
  }

  // the trash can in the corner
  function buildBin() {
    if (bin3) scene.remove(bin3);
    const b = W.bin, k = kit({ def: { name: 'bin', pal: { body: '#b7c0c8' } }, pal: { body: '#b7c0c8' } }, null);
    const metal = k.mat('#aeb8c2', { metal: 0.65, rough: 0.35 }), dark = k.mat('#5d6874', { metal: 0.5, rough: 0.5 });
    const w = b.w, h = b.h;
    k.lathe([[0, 0], [w * 0.38, 0], [w * 0.46, h - 14], [w * 0.5, h - 12], [w * 0.5, h - 10], [w * 0.44, h - 10], [w * 0.36, 3], [0, 3]], metal, k.root, 0, 0, 0, 28);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const r = k.box(2, h - 22, 2, dark, k.root, Math.cos(a) * w * 0.43, (h - 10) / 2, Math.sin(a) * w * 0.43); r.rotation.y = -a; r.rotation.z = Math.cos(a) * 0.04; r.rotation.x = -Math.sin(a) * 0.04; }
    const lidP = k.group(k.root, -w * 0.5, h - 10, 0);
    k.cyl(w * 0.53, w * 0.53, 6, metal, lidP, w * 0.5, 3, 0, 28);
    k.rbox(18, 6, 6, dark, lidP, w * 0.5, 9, 0, 2);
    const lc = document.createElement('canvas'); lc.width = 128; lc.height = 40; const lx = lc.getContext('2d');
    lx.fillStyle = '#2b3138'; lx.font = 'bold 26px ' + (SB.FONT || 'sans-serif'); lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText('TRASH', 64, 21);
    const lt = new T.CanvasTexture(lc); lt.encoding = T.sRGBEncoding;
    const label = new T.Mesh(new T.PlaneGeometry(w * 0.7, w * 0.22), new T.MeshStandardMaterial({ map: lt, transparent: true, roughness: 0.6 })); label.position.set(0, h * 0.55, w * 0.47); k.root.add(label);
    k.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    bin3 = k.root; bin3.userData.lid = lidP; scene.add(bin3);
  }

  // ---------- camera: the flat stage fills the screen, seen from a little above ----------
  const PITCH = 0.115;
  const v3 = new T.Vector3();
  function fitCamera() {
    const Wd = stage.w, H = stage.h;
    cam.aspect = Wd / H; cam.updateProjectionMatrix();
    let ty = -H / 2, D = (H / 2) / Math.tan(cam.fov * Math.PI / 360);
    const place = () => { cam.position.set(Wd / 2, ty + Math.sin(PITCH) * D, Math.cos(PITCH) * D); cam.lookAt(Wd / 2, ty, 0); cam.updateMatrixWorld(); };
    for (let it = 0; it < 8; it++) {
      place();
      const top = v3.set(0, 0, 0).project(cam).y, bot = v3.set(0, -H, 0).project(cam).y;
      ty += (top + bot) / 2 * (H / 2) * 0.9;             // centre the stage vertically
      place();
      let m = 0; for (const [x, y] of [[0, 0], [Wd, 0], [0, -H], [Wd, -H]]) { v3.set(x, y, 0).project(cam); m = Math.max(m, Math.abs(v3.x), Math.abs(v3.y)); }
      D *= m;                                                 // just fit the widest corner
    }
    place();
    M3.base = cam.position.clone(); M3.look = new T.Vector3(Wd / 2, ty, 0);
    // the sun's shadow box covers the stage
    const sc = sun.shadow.camera, span = Math.max(Wd, H) * 0.75 + 300;
    sun.position.set(Wd / 2 - 900, -stage.g + 2400, 1300); sun.target.position.set(Wd / 2, -stage.g + H * 0.3, 0);
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 100; sc.far = 6000; sc.updateProjectionMatrix();
  }

  M3.resize = function (Wd, H, dpr, groundY) {
    if (!R) return;
    R.setPixelRatio(dpr); R.setSize(Wd, H, false);
    R.domElement.style.width = Wd + 'px'; R.domElement.style.height = H + 'px';
    const changed = stage.w !== Wd || stage.h !== H || stage.g !== groundY;
    stage = { w: Wd, h: H, g: groundY };
    fitCamera();
    if (changed) { buildScenery(); buildBin(); }
    R.shadowMap.needsUpdate = true;
  };

  // game point -> screen point (CSS px) and the size of one game unit there
  const pa = new T.Vector3(), pb = new T.Vector3(), pc = new T.Vector3();
  M3.project = function (x, y, z) {
    pa.set(x, -y, z || 0).project(cam);
    return { x: (pa.x + 1) / 2 * stage.w, y: (1 - pa.y) / 2 * stage.h };
  };
  // set ctx so that game coordinates near (x, y) draw where that spot appears in 3D (for particles, bubbles, bars)
  M3.at = function (ctx, x, y, dpr) {
    const d = 12;
    pa.set(x, -y, 0).project(cam); pb.set(x + d, -y, 0).project(cam); pc.set(x, -(y + d), 0).project(cam);
    const sx = (pa.x + 1) / 2 * stage.w, sy = (1 - pa.y) / 2 * stage.h;
    const ax = ((pb.x + 1) / 2 * stage.w - sx) / d, ay = ((1 - pb.y) / 2 * stage.h - sy) / d;
    const bx = ((pc.x + 1) / 2 * stage.w - sx) / d, by = ((1 - pc.y) / 2 * stage.h - sy) / d;
    ctx.setTransform(dpr * ax, dpr * ay, dpr * bx, dpr * by, dpr * (sx - ax * x - bx * y), dpr * (sy - ay * x - by * y));
  };
  // screen point (CSS px) -> game point on the stage
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0), hit = new T.Vector3();
  M3.unproject = function (sx, sy) {
    ndc.set(sx / stage.w * 2 - 1, -(sy / stage.h * 2 - 1)); ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(plane, hit)) return { x: sx, y: sy };
    return { x: hit.x, y: -hit.y };
  };

  // ---------- entities ----------
  const tplOf = def => def.t || { w: def.w, h: def.h, draw: def.draw };
  function build(e) {
    drop(e);
    const def = e.def, tpl = tplOf(def), k = kit(e, tpl);
    let update = null;
    const fn = M3.named[def.name] || (tpl.kind && M3.kinds[tpl.kind]);
    try { update = fn ? fn(e, k, tpl) : M3.paper(e, k, tpl); }
    catch (err) { console.error('3D model for ' + def.name + ' failed:', err); k.root.clear(); update = M3.paper(e, k, tpl); }
    const outer = new T.Group(), inner = new T.Group();
    outer.add(inner); inner.add(k.root); scene.add(outer); if (k.world.children.length || fn) scene.add(k.world);
    k.root.traverse(o => { o.castShadow = false; });   // (contact shadows instead; the shadow map is for the scenery)
    e._m3 = { def, pal: e.pal, outer, inner, k, update: update || null, yaw: e.facing > 0 ? -YAW : Math.PI + YAW, fx: '', z: zLane(e) };
    if (typeof update === 'object' && update) e._m3.update = update.update, e._m3.ownsWorld = !!update.ownsWorld;
    if (k.ownsWorld) e._m3.ownsWorld = true;
    ents.add(e);
  }
  function drop(e) {
    const m = e._m3; if (!m) return;
    scene.remove(m.outer); scene.remove(m.k.world);
    for (const g of m.k.own) g.dispose();
    for (const mt of m.k.mats) { if (mt.userData.shared) continue; if (mt.map && mt.map.isCanvasTexture && !mt.map.userData.shared) mt.map.dispose(); mt.dispose(); }
    if (m.priv) for (const c of m.priv.values()) c.dispose();   // a shared texture (userData.shared) outlives its users
    if (m.ice) { m.ice.geometry.dispose(); }
    e._m3 = null; ents.delete(e);
  }
  M3.drop = drop;
  const YAW = 0.38;   // turn things a little toward the camera so you see their faces and their depth
  const zLane = e => e.def.boss ? 0 : ((e.seed * 7.31) % 1 - 0.5) * Math.min(60, 20 + e.w * 0.2);

  function effects(e, m, hk) {
    const fx = (e.invisible ? 'i' : '') + (hk > 0 && Math.floor(hk * 9) % 2 === 0 ? 'h' : '') + (e.poisonT > 0 ? 'p' : '') + (e.dying ? 'd' : '');
    if (fx === m.fx) return; m.fx = fx;
    fxMats(m, !!fx);
    for (const mt of m.k.mats.filter(x => !x.userData.shared).concat(m.priv ? [...m.priv.values()] : [])) {
      const b = mt.userData.base;
      if (mt.emissive) {
        if (fx.includes('h')) { mt.emissive.set('#ff2a1a'); mt.emissiveIntensity = 0.55; }
        else if (fx.includes('p')) { mt.emissive.set('#3fbf4f'); mt.emissiveIntensity = 0.35; }
        else { if (b.emissive) mt.emissive.copy(b.emissive); mt.emissiveIntensity = b.ei; }
      }
      const op = fx.includes('i') ? 0.28 * (b.opacity || 1) : b.opacity;
      mt.transparent = b.transparent || op < 1; mt.opacity = op; mt.depthWrite = !mt.transparent || op > 0.6; mt.needsUpdate = true;
    }
  }
  // while an effect is on a thing, its shared materials are swapped for private copies (and back afterwards)
  function fxMats(m, on) {
    const root = m.k.root;
    if (on && !m.priv) {
      m.priv = new Map();
      root.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.userData || !o.material.userData.shared) return;
        let c = m.priv.get(o.material);
        if (!c) { const src = o.material; c = src.clone(); c.userData = { base: src.userData.base, of: src }; m.priv.set(src, c); }
        o.material = c;
      });
    } else if (!on && m.priv) {
      root.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.of && m.priv.get(o.material.userData.of) === o.material) o.material = o.material.userData.of; });
      for (const c of m.priv.values()) c.dispose();
      m.priv = null;
    }
  }
  function encase(e, m, kind, on) {   // ice block / silk cocoon around something
    let o = m[kind];
    if (!on) { if (o) o.visible = false; return; }
    if (!o) {
      const w = e.def.w, h = e.def.h, d = Math.max(20, Math.min(w, h) * 0.8);
      if (kind === 'ice') o = new T.Mesh(new T.BoxGeometry(w * 1.2, h * 1.18, d * 1.25, 1, 1, 1), new T.MeshPhysicalMaterial({ color: 0xcfeeff, roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: 0.5, clearcoat: 1 }));
      else o = new T.Mesh(geo('sphere', () => new T.SphereGeometry(1, 20, 14)), new T.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.9, transparent: true, opacity: 0.82 }));
      if (kind === 'web') o.scale.set(w * 0.6, h * 0.58, Math.max(14, Math.min(w, h) * 0.45));
      m[kind] = o; m.outer.add(o);
    }
    o.visible = true;
  }
  // wings for anything made to fly ("flying pig")
  function modWings(e, m, t) {
    if (!m.wings) {
      const k = m.k, wm = k.mat('#f4f6f8', { side: 'double', rough: 0.6 }), mk = s => { const p = k.group(k.root, -e.def.w * 0.05, e.def.h * 0.2, s * e.def.w * 0.1); const u = Math.max(0.6, e.def.h / 50); const f = k.extrude([0, 0, -10 * u, 6 * u, -26 * u, 4 * u, -34 * u, -4 * u, -22 * u, -6 * u, -12 * u, -4 * u], 1.2, wm, p, 0, 0, 0, 0.3); f.rotation.y = s * -0.3; return p; };
      m.wings = [mk(1), mk(-1)];
    }
    const fl = Math.sin(t * (e.flying ? 22 : 4)) * (e.flying ? 0.7 : 0.15);
    m.wings[0].rotation.x = -0.5 - fl; m.wings[1].rotation.x = 0.5 + fl;
  }


  // soft contact shadows under everything, in one draw call
  let blobs = null, blobCap = 0;
  function contactShadows() {
    const L = W.entities;
    if (!blobs || blobCap < L.length) {
      if (blobs) { scene.remove(blobs); blobs.dispose(); }
      blobCap = Math.max(64, Math.ceil(L.length * 1.5));
      if (!M3.blobTex) {
        const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(18,26,8,0.62)'); g.addColorStop(0.55, 'rgba(18,26,8,0.32)'); g.addColorStop(1, 'rgba(18,26,8,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        M3.blobTex = new T.CanvasTexture(c);
      }
      const geo2 = new T.PlaneGeometry(1, 1); geo2.rotateX(-Math.PI / 2);
      blobs = new T.InstancedMesh(geo2, new T.MeshBasicMaterial({ map: M3.blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), blobCap);
      blobs.frustumCulled = false; blobs.renderOrder = -1; scene.add(blobs);
    }
    const mx = new T.Matrix4(), q = new T.Quaternion(), pv = new T.Vector3(), sv = new T.Vector3();
    let n = 0;
    for (const e of L) {
      if (!e.alive || e.def.noShadow || e.invisible || !e._m3) continue;
      const hgt = W.groundY - e.bottom; if (hgt > 320 || hgt < -10) continue;
      const k = 1 - Math.max(0, hgt) / 320, rw = e.w * (0.38 + 0.12 * k) * k * (e.dying ? Math.max(0, 1 - e.dying / 0.35) : 1);
      if (rw < 1) continue;
      mx.compose(pv.set(e.x, -W.groundY + 1, e._m3.zc || 0), q, sv.set(rw * 2.1, 1, Math.min(rw * 1.2, Math.max(30, e.h * e.scale * 0.5)))); blobs.setMatrixAt(n++, mx);
    }
    blobs.count = n; blobs.instanceMatrix.needsUpdate = true;
  }

  M3.sync = function (t, dt) {
    if (!R) return;
    const seen = new Set();
    for (const e of W.entities) {
      if (!e.alive) continue;
      seen.add(e);
      if (!e._m3 || e._m3.def !== e.def || e._m3.pal !== e.pal) build(e);
      const m = e._m3, o = m.outer;
      const lk = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * Math.PI) : 0, ldir = e.lungeDir || e.facing;
      const hk = e.hitT > 0 ? Math.min(1, e.hitT / 0.24) : 0;
      const st = e.spawnT < 1 ? (1 + Math.sin(e.spawnT * Math.PI) * 0.25) * Math.min(1, e.spawnT * 4) : 1;
      const ds = e.dying ? Math.max(0.001, 1 - e.dying / 0.35) : 1;
      const hv = (e.hover && !e.held && !e.dying) ? 1.04 : 1, s = e.scale * st * ds * hv;
      const zt = e.held ? 60 : m.z; m.zc = m.zc == null ? zt : m.zc + (zt - m.zc) * Math.min(1, dt * 8);
      o.position.set(e.x + lk * ldir * clamp(e.w * 0.18, 6, 28) + (hk ? (Math.random() - 0.5) * 7 * hk : 0), -e.y, m.zc);
      o.rotation.z = -(e.angle + e.tilt + lk * ldir * 0.14 + (e.held ? clamp(W.cursor.vx / 4000, -0.3, 0.3) : 0));
      o.scale.set(s * (1 + 0.16 * hk), s * (1 - 0.12 * hk), s * (1 + 0.1 * hk));
      // turn smoothly to face the way it is going
      const want = e.facing > 0 ? -YAW : Math.PI + YAW;
      m.yaw += (want - m.yaw) * Math.min(1, dt * 12); m.inner.rotation.y = m.yaw;
      effects(e, m, hk);
      if (m.update) { try { m.update(e, t, dt); } catch (err) { if (!m.err) { m.err = 1; console.error('3D update ' + e.def.name, err); } } }
      if (m.k.eyes) for (const ey of m.k.eyes) ey.update(e);
      encase(e, m, 'ice', e.frozenT > 0); encase(e, m, 'web', e.webT > 0);
      if (e.wingsMod) modWings(e, m, t);
    }
    for (const e of [...ents]) if (!seen.has(e)) drop(e);
    contactShadows();
    // the bin
    if (bin3) {
      const b = W.bin; bin3.position.set(b.x, -b.y, 0); bin3.rotation.z = b.wob > 0 ? Math.sin(t * 40) * b.wob * 0.08 : 0;
      bin3.userData.lid.rotation.z = b.open * 1.1;
    }
    for (const c of M3.clouds || []) { c.position.x += c.userData.sp * dt; if (c.position.x > stage.w / 2 + 6000) c.position.x -= 12000; }
  };

  M3.render = function (force) {
    if (!R || (window.__keep3d && !force)) return;   // headless tests only draw when they take a picture
    cam.position.copy(M3.base);
    if (W.shakeT > 0) { const a = W.shakeA * (W.shakeT / 0.25); cam.position.x += (Math.random() - 0.5) * a * 2; cam.position.y += (Math.random() - 0.5) * a * 2; }
    cam.lookAt(M3.look); cam.updateMatrixWorld();
    R.render(scene, cam);
  };
  M3.clear = function () { for (const e of [...ents]) drop(e); };
})();
