'use strict';
// m-small.js — 3D birds, bugs, sea life and snakes (see js/3d/r3d.js for the model kit).
// Every model is built in its 2D drawing's own units inside one group scaled by the template's size factor,
// so bodies, wings, legs and fins are shared geometry, cached once per species and colour: a swarm costs little.
// Most bodies are lofts (a smooth tube along a path with an oval cross-section and painted vertex colours:
// dark backs, pale bellies, stripes, spots, gill slits), feathers and insect wings are painted textures.
(function () {
  if (!SB.M3) return;
  const M3 = SB.M3, T = THREE, TAU = Math.PI * 2, PI = Math.PI;
  const geo = M3.geo;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const shade = SB.shade, mix = SB.mixColor;
  const rawPal = k => k.e.pal || k.def.pal || {};
  const own = (k, role) => { const p = rawPal(k)[role]; return p && p !== SB.ROLES[role] ? p : null; };   // a role the palette really sets
  const C3 = h => new T.Color(h);
  const camSide = e => e.facing > 0 ? 1 : -1;   // which model side (+z or -z) faces the camera
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const noise = (x, y) => {   // smooth value noise, 0..1
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  // ---------- Loft: a smooth tube along a path, oval cross-section, optional vertex colours ----------
  // ry(u)/rz(u): radius toward the frame's "up" / "side" (u = 0..1 along the path); col(u, ca, sa, out): colour
  // at angle (ca = cos: 1 is up, sa = sin: 1 is the +side). The frame's up follows `ref` (default +y) so
  // patterns stay put (bellies stay down) however the path bends. setPath([x,y,z, x,y,z, ...]) reuses its arrays.
  class Loft extends T.BufferGeometry {
    constructor(n, radial, ry, rz, col, ref) {
      super();
      this.n = n; this.radial = radial; this.ref = new T.Vector3(...(ref || [0, 1, 0])).normalize();
      const rings = n + 1, R1 = radial + 1, vc = rings * R1;
      this.pos = new Float32Array(vc * 3); this.nor = new Float32Array(vc * 3);
      this.ry = new Float32Array(rings); this.rz = new Float32Array(rings); this.F = new Float32Array(rings * 12);
      for (let i = 0; i < rings; i++) { const u = i / n; this.ry[i] = ry(u); this.rz[i] = rz ? rz(u) : this.ry[i]; }
      this.ca = new Float32Array(R1); this.sa = new Float32Array(R1);
      for (let j = 0; j <= radial; j++) { const a = j / radial * TAU; this.ca[j] = Math.cos(a); this.sa[j] = Math.sin(a); }
      const uv = new Float32Array(vc * 2), idx = [];
      for (let i = 0; i < rings; i++) for (let j = 0; j <= radial; j++) { const o = (i * R1 + j) * 2; uv[o] = j / radial; uv[o + 1] = i / n; }
      for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * R1 + j, b = a + R1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      this.setIndex(idx);
      this.setAttribute('position', new T.BufferAttribute(this.pos, 3));
      this.setAttribute('normal', new T.BufferAttribute(this.nor, 3));
      this.setAttribute('uv', new T.BufferAttribute(uv, 2));
      if (col) {
        const C = new Float32Array(vc * 3), c = new T.Color();
        for (let i = 0; i < rings; i++) for (let j = 0; j <= radial; j++) { col(i / n, this.ca[j], this.sa[j], c); const o = (i * R1 + j) * 3; C[o] = c.r; C[o + 1] = c.g; C[o + 2] = c.b; }
        this.setAttribute('color', new T.BufferAttribute(C, 3));
      }
    }
    setPath(p) {
      const n = this.n, m = p.length / 3, F = this.F, rx = this.ref.x, ry0 = this.ref.y, rz0 = this.ref.z;
      let ux = rx, uy = ry0, uz = rz0;
      for (let i = 0; i <= n; i++) {
        const s = i / n * (m - 1); let j = Math.floor(s); if (j > m - 2) j = m - 2;
        const t = s - j, t2 = t * t, t3 = t2 * t, o = i * 12;
        const i0 = Math.max(0, j - 1) * 3, i1 = j * 3, i2 = (j + 1) * 3, i3 = Math.min(m - 1, j + 2) * 3;
        for (let d = 0; d < 3; d++) {   // Catmull-Rom through the points
          const P0 = p[i0 + d], P1 = p[i1 + d], P2 = p[i2 + d], P3 = p[i3 + d];
          const a = P2 - P0, b = 2 * P0 - 5 * P1 + 4 * P2 - P3, c = -P0 + 3 * P1 - 3 * P2 + P3;
          F[o + d] = 0.5 * (2 * P1 + a * t + b * t2 + c * t3); F[o + 3 + d] = 0.5 * (a + 2 * b * t + 3 * c * t2);
        }
        let tx = F[o + 3], ty = F[o + 4], tz = F[o + 5], L = Math.hypot(tx, ty, tz) || 1; tx /= L; ty /= L; tz /= L;
        F[o + 3] = tx; F[o + 4] = ty; F[o + 5] = tz;
        let d0 = rx * tx + ry0 * ty + rz0 * tz, qx = rx - d0 * tx, qy = ry0 - d0 * ty, qz = rz0 - d0 * tz; L = Math.hypot(qx, qy, qz);
        if (L < 0.08) { d0 = ux * tx + uy * ty + uz * tz; qx = ux - d0 * tx; qy = uy - d0 * ty; qz = uz - d0 * tz; L = Math.hypot(qx, qy, qz) || 1; }
        qx /= L; qy /= L; qz /= L; ux = qx; uy = qy; uz = qz;
        F[o + 6] = qx; F[o + 7] = qy; F[o + 8] = qz;
        F[o + 9] = ty * qz - tz * qy; F[o + 10] = tz * qx - tx * qz; F[o + 11] = tx * qy - ty * qx;
      }
      const R1 = this.radial + 1, P = this.pos, N = this.nor, RY = this.ry, RZ = this.rz, CA = this.ca, SA = this.sa;
      for (let i = 0; i <= n; i++) {
        const o = i * 12, ry = RY[i], rz = RZ[i], a = Math.max(0, i - 1), b = Math.min(n, i + 1);
        const dl = Math.hypot(F[b * 12] - F[a * 12], F[b * 12 + 1] - F[a * 12 + 1], F[b * 12 + 2] - F[a * 12 + 2]) || 1;
        const sl = (RY[b] + RZ[b] - RY[a] - RZ[a]) * 0.5 / dl;
        for (let j = 0; j <= this.radial; j++) {
          const ca = CA[j], sa = SA[j], v = (i * R1 + j) * 3;
          let nx = F[o + 6] * ca * rz + F[o + 9] * sa * ry, ny = F[o + 7] * ca * rz + F[o + 10] * sa * ry, nz = F[o + 8] * ca * rz + F[o + 11] * sa * ry;
          let L = Math.hypot(nx, ny, nz);
          if (L < 1e-6) { nx = F[o + 6] * ca + F[o + 9] * sa; ny = F[o + 7] * ca + F[o + 10] * sa; nz = F[o + 8] * ca + F[o + 11] * sa; L = 1; }
          nx = nx / L - F[o + 3] * sl; ny = ny / L - F[o + 4] * sl; nz = nz / L - F[o + 5] * sl; L = Math.hypot(nx, ny, nz) || 1;
          N[v] = nx / L; N[v + 1] = ny / L; N[v + 2] = nz / L;
          P[v] = F[o] + F[o + 6] * ca * ry + F[o + 9] * sa * rz;
          P[v + 1] = F[o + 1] + F[o + 7] * ca * ry + F[o + 10] * sa * rz;
          P[v + 2] = F[o + 2] + F[o + 8] * ca * ry + F[o + 11] * sa * rz;
        }
      }
      this.attributes.position.needsUpdate = true; this.attributes.normal.needsUpdate = true;
      this.computeBoundingSphere();
      return this;
    }
    end(i, pos, tan) {   // centre and tangent of ring i (after setPath)
      const o = i * 12, F = this.F; if (pos) pos.set(F[o], F[o + 1], F[o + 2]); if (tan) tan.set(F[o + 3], F[o + 4], F[o + 5]);
    }
  }
  M3.Loft = Loft;
  const loft = (k, parent, mat, n, radial, ry, rz, colf, path, ref) => { const g = new Loft(n, radial, ry, rz, colf, ref); g.setPath(path); k.own.push(g); return k.mesh(g, mat, parent); };
  const loftG = (key, n, radial, ry, rz, colf, path, ref) => geo('loft:' + key, () => new Loft(n, radial, ry, rz, colf, ref).setPath(path));

  // ---------- shapes, textures, materials ----------
  function shapeOf(pts, smooth) {
    const s = new T.Shape();
    if (smooth) { const v = []; for (let i = 0; i < pts.length; i += 2) v.push(new T.Vector2(pts[i], pts[i + 1])); s.moveTo(v[0].x, v[0].y); s.splineThru(v.slice(1).concat([v[0]])); }
    else { s.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]); s.closePath(); }
    return s;
  }
  // a flat outline given thickness, cached (shape coords become uv, for the painted textures)
  const xg = (key, pts, depth, bevel, smooth) => geo('xs:' + key, () => {
    const b = bevel || 0, g = new T.ExtrudeGeometry(shapeOf(pts, smooth), { depth: Math.max(0.01, depth - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.85, bevelSegments: 2, curveSegments: smooth ? 3 : 1 });
    g.translate(0, 0, -(depth - 2 * b) / 2); g.computeVertexNormals(); return g;
  });
  function paintGeo(g, fn) {
    const P = g.attributes.position, C = new Float32Array(P.count * 3), c = new T.Color();
    for (let i = 0; i < P.count; i++) { fn(P.getX(i), P.getY(i), P.getZ(i), c); C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(C, 3)); return g;
  }
  const TEX = new Map();
  // a painted texture, shared by every model (a plain Texture: the renderer only disposes CanvasTextures)
  function tex(key, W, H, paint, box) {
    let t = TEX.get(key); if (t) return t;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.lineCap = 'round'; x.lineJoin = 'round';
    const map = box ? { X: v => (v - box[0]) / (box[2] - box[0]) * W, Y: v => (1 - (v - box[1]) / (box[3] - box[1])) * H, S: W / (box[2] - box[0]) } : null;
    paint(x, W, H, map);
    t = new T.Texture(c); t.name = key; t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    if (box) { t.repeat.set(1 / (box[2] - box[0]), 1 / (box[3] - box[1])); t.offset.set(-box[0] / (box[2] - box[0]), -box[1] / (box[3] - box[1])); }
    t.needsUpdate = true; TEX.set(key, t); return t;
  }
  const vmat = (k, o) => { const m = k.mat('#ffffff', Object.assign({ vc: 1 }, o)); if (!m.vertexColors) { m.vertexColors = true; m.needsUpdate = true; } return m; };
  const tmat = (k, color, t, o) => {
    const m = k.mat(color, Object.assign({ tex: t.name }, o));
    if (m.map !== t) { m.map = t; if (o && o.cut) m.alphaTest = 0.5; if (o && o.vc) m.vertexColors = true; m.needsUpdate = true; }
    return m;
  };
  // a feather / leaf from base (ax,ay) to tip (bx,by), half-width w, painted light at the tip and dark at the base
  function feather(c, ax, ay, bx, by, w, lo, hi, edge) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
    c.beginPath(); c.moveTo(ax + nx * 0.55, ay + ny * 0.55);
    c.bezierCurveTo(ax + dx * 0.55 + nx * 1.1, ay + dy * 0.55 + ny * 1.1, bx + nx * 0.75 - dx * 0.06, by + ny * 0.75 - dy * 0.06, bx, by);
    c.bezierCurveTo(bx - nx * 0.75 - dx * 0.06, by - ny * 0.75 - dy * 0.06, ax + dx * 0.55 - nx * 1.1, ay + dy * 0.55 - ny * 1.1, ax - nx * 0.55, ay - ny * 0.55);
    c.closePath();
    const g = c.createLinearGradient(ax, ay, bx, by); g.addColorStop(0, lo || '#9a9a9a'); g.addColorStop(1, hi || '#ffffff');
    c.fillStyle = g; c.fill();
    c.strokeStyle = edge || 'rgba(30,30,30,0.55)'; c.lineWidth = Math.max(1, w * 0.12); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = Math.max(0.7, w * 0.07); c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + dx * 0.9, ay + dy * 0.9); c.stroke();
  }
  // a tiled scale pattern (snakes, fish), multiplied over vertex colours
  const scaleTex = (key, rows) => {
    const t = tex('scales:' + key, 64, 64, (c, W, H) => {
      c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, W, H);
      const n = rows || 4, s = W / n;
      for (let r = -1; r <= n; r++) for (let q = -1; q <= n; q++) {
        const x = q * s + (r & 1 ? s / 2 : 0), y = r * s * 0.5;
        const g = c.createRadialGradient(x, y + s * 0.15, 1, x, y + s * 0.2, s * 0.7); g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#e4e4e4'); g.addColorStop(1, '#8a8a8a');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y + s * 0.25, s * 0.55, s * 0.5, 0, 0, TAU); c.fill();
      }
    });
    t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  };

  // ======================= BIRDS =======================
  // folded wing (body frame, unit size): leading edge on top, feather tips scalloped along the bottom
  const FOLD = (() => {
    const P = [[-4, 2.2, -18, -1.0, 1.25], [-4.6, 1.8, -17, -1.6, 1.25], [-5.2, 1.4, -15.8, -2.0, 1.25], [-5.8, 1.0, -14.6, -2.3, 1.25], [-6.4, 0.6, -13.4, -2.5, 1.25]];
    const S = [[-1.5, 2.2, -11.5, -2.8, 1.5], [-0.4, 2.2, -9.5, -3.0, 1.5], [0.6, 2.2, -7.5, -3.1, 1.5], [1.5, 2.2, -5.5, -3.0, 1.5], [2.3, 2.2, -3.5, -2.7, 1.5]];
    const top = [4.2, 0.6, 4.0, 2.4, 2.6, 4.0, 0, 4.9, -3.5, 5.0, -7, 4.3, -10.5, 3.0, -14, 1.4, -16.5, 0.2];
    const tips = P.concat(S).map(f => [f[2], f[3]]), out = top.slice();
    tips.forEach((tp, i) => { out.push(tp[0], tp[1]); const nx = tips[i + 1]; if (nx) out.push((tp[0] + nx[0]) / 2 + 0.35, (tp[1] + nx[1]) / 2 + 0.75); });
    out.push(-1.5, -2.4, 1.5, -1.6, 3.6, -0.6);
    const cov = []; for (let r = 0; r < 3; r++) for (let i = 0; i < 7 - r; i++) { const x = 3 - i * 1.9 - r * 0.6, y = 0.4 + r * 1.4; cov.push([x + 1.2, y + 1.6, x - 1.2, y - 0.6, 1.15 - r * 0.15]); }
    return { pts: out, layers: [P, S, cov], box: [-19, -4, 5, 6] };
  })();
  // spread wing: arm (secondaries) and hand (primaries), in a plane: x = chord (forward), y = span (outward)
  const ARM = (() => {
    const ys = [8.0, 6.6, 5.2, 3.8, 2.4, 1.0], xs = [-6.6, -6.9, -7.0, -7.0, -6.8, -6.4];
    const out = [3.0, -0.2, 3.4, 3, 3.2, 6, 2.6, 9.3, -6.0, 9.3];
    ys.forEach((y, i) => { out.push(xs[i], y); if (i < ys.length - 1) out.push((xs[i] + xs[i + 1]) / 2 + 1.0, y - 0.7); });
    out.push(-5.0, -0.2);
    const sec = ys.map((y, i) => [0.2, y + 0.4, xs[i], y, 0.85]);
    const cov = []; for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { const y = 0.6 + i * 1.6 + r * 0.4, x = -2.2 + r * 1.6; cov.push([x + 1.9, y + 0.3, x - 0.6, y, 0.75 - r * 0.12]); }
    return { pts: out, layers: [sec, cov], box: [-8, -1, 4, 10] };
  })();
  const HAND = (slot) => {
    const tips = [[-1.2, 12.0], [-2.9, 11.5], [-4.4, 10.6], [-5.5, 9.3], [-6.2, 7.8], [-6.6, 6.1], [-6.8, 4.3], [-6.8, 2.5], [-6.6, 0.8]];
    const hub = [-0.6, 2.4], out = [2.3, -0.3, 2.3, 3, 1.5, 6.5, 0.3, 9.6];
    tips.forEach((tp, i) => {
      out.push(tp[0], tp[1]); const nx = tips[i + 1]; if (!nx) return;
      const sl = i < 5 ? slot : 0.12, mx = (tp[0] + nx[0]) / 2, my = (tp[1] + nx[1]) / 2;
      out.push(mx + (hub[0] - mx) * sl, my + (hub[1] - my) * sl);
    });
    out.push(-6.2, -0.4);
    const prim = tips.map((tp, i) => { const u = i / 8; return [1.4 - u * 1.4, 6.5 - u * 6, tp[0], tp[1], 0.8]; }).reverse();
    const cov = []; for (let i = 0; i < 6; i++) cov.push([2.0, 0.2 + i * 1.4, -1.4, 0.6 + i * 1.5, 0.7]);
    return { pts: out, layers: [prim, cov], box: [-8, -1, 4, 13] };
  };
  const featherTex = (key, F) => tex('feath:' + key, 256, Math.round(256 * (F.box[3] - F.box[1]) / (F.box[2] - F.box[0])), (c, W, H, m) => {
    c.fillStyle = '#c4c4c4'; c.fillRect(0, 0, W, H);
    for (const L of F.layers) for (const f of L) feather(c, m.X(f[0]), m.Y(f[1]), m.X(f[2]), m.Y(f[3]), f[4] * m.S, '#8e8e8e', '#ffffff');
  }, F.box);
  // bat wing membranes: arm and hand with finger bones, scalloped between the finger tips
  const BAT_ARM = { pts: [2.5, -0.2, 2.7, 4, 2.5, 8.2, -2.2, 8.4, -6.5, 5.6, -4.8, 3.4, -7.5, 0.2, -4, -0.5], box: [-8, -1, 3, 9] };
  const BAT_HAND = { pts: [2.2, -0.2, 2.4, 4, 1.8, 8.5, 0.6, 12.6, -0.9, 9.6, -3.9, 11.2, -3.6, 7.2, -6.6, 5.2, -4.2, 2.6, -5.4, -0.3], box: [-7, -1, 3, 13], bones: [[0.5, 0, 0.6, 12.6], [0.2, 0.2, -3.9, 11.2], [0, 0.2, -6.6, 5.2]] };
  const membraneTex = (key, F, bones) => tex('memb:' + key, 128, Math.round(128 * (F.box[3] - F.box[1]) / (F.box[2] - F.box[0])), (c, W, H, m) => {
    c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1;
    for (let i = 0; i < 40; i++) { c.beginPath(); const x = Math.random() * W, y = Math.random() * H; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30); c.stroke(); }
    c.strokeStyle = 'rgba(40,30,30,0.75)'; c.lineWidth = 2.2;
    for (const b of bones || []) { c.beginPath(); c.moveTo(m.X(b[0]), m.Y(b[1])); c.lineTo(m.X(b[2]), m.Y(b[3])); c.stroke(); }
  }, F.box);

  // a bird's foot lying flat: three toes forward and one back (webbed for ducks)
  const footG = (webbed, len) => xg('foot:' + (webbed ? 1 : 0) + ':' + len, (() => {
    const toes = [[-0.5, len * 0.9], [0, len], [0.5, len * 0.9]], out = [];
    if (webbed) {
      out.push(-0.6, -0.4);
      toes.forEach((tp, i) => { const a = tp[0]; out.push(Math.cos(a) * tp[1], Math.sin(a) * tp[1]); if (i < 2) out.push(Math.cos(a + 0.25) * tp[1] * 0.72, Math.sin(a + 0.25) * tp[1] * 0.72); });
      out.push(-0.6, 0.4, -len * 0.55, 0.15, -len * 0.55, -0.15);
    } else {
      const all = [[-0.5, len * 0.9], [0, len], [0.5, len * 0.9], [PI, len * 0.6]];
      all.forEach(tp => { const a = tp[0], l = tp[1]; out.push(Math.cos(a - 0.5) * 0.45, Math.sin(a - 0.5) * 0.45, Math.cos(a - 0.07) * l * 0.55, Math.sin(a - 0.07) * l * 0.55, Math.cos(a) * l, Math.sin(a) * l, Math.cos(a + 0.07) * l * 0.55, Math.sin(a + 0.07) * l * 0.55); });
    }
    return out;
  })(), 0.65, 0.2);

  // the four tail shapes: short / long fans and the chicken's upright tail
  const TAIL = {
    short: { L: 8, pts: [0, 1.6, -5, 3.9, -5.6, 3.1, -6.5, 2.9, -7.2, 1.7, -7.5, 1.5, -8, 0, -7.5, -1.5, -7.2, -1.7, -6.5, -2.9, -5.6, -3.1, -5, -3.9, 0, -1.6] },
    long: { L: 12.5, pts: [0, 1.5, -6.5, 3.1, -7.4, 2.6, -8.9, 2.5, -9.9, 1.6, -10.9, 1.4, -12.5, 0, -10.9, -1.4, -9.9, -1.6, -8.9, -2.5, -7.4, -2.6, -6.5, -3.1, 0, -1.5] }
  };
  const tailTex = (key, Tl) => tex('tail:' + key, 128, 96, (c, W, H, m) => {
    c.fillStyle = '#c4c4c4'; c.fillRect(0, 0, W, H);
    const P = Tl.pts, tips = []; for (let i = 2; i < P.length - 2; i += 4) tips.push([P[i], P[i + 1]]);
    tips.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    for (const tp of tips) feather(c, m.X(0.5), m.Y(tp[1] * 0.35), m.X(tp[0]), m.Y(tp[1]), 1.5 * m.S, '#8a8a8a', '#ffffff');
  }, [-Tl.L - 1, -5, 1, 5]);

  M3.kinds.bird = function (e, k, tpl) {
    const o = tpl.o;
    if (o.upright) return penguin(e, k, tpl);
    if (o.wing === 'bat') return bat(e, k, tpl);
    const s = o.s, h = tpl.h / s, body = k.col('body');
    const wingC = own(k, 'wing') || shade(body, 0.18), bellyC = own(k, 'belly') || mix(body, '#fff', 0.45), beakC = k.col('beak');
    const isEagle = o.beak === 'hook' && s >= 1.5, isOwl = o.bigEyes, isFlamingo = o.longLegs && o.beak === 'hook', isOstrich = o.longLegs && !isFlamingo;
    const isHum = o.flap > 30, isTurkey = o.fan && o.wattle && !o.comb, isRooster = o.fan && o.comb, isPeacock = o.fan && o.crest, isChicken = o.comb && !o.fan;
    const isParrot = o.crest && o.beak === 'hook', isDuck = o.beak === 'flat';
    const skinC = mix(beakC, '#c99c94', 0.7);   // bare skin (ostrich neck and legs)
    const legL = o.longLegs ? 24 : o.legLen, perchY = -h / 2 + legL + 6;
    const G = k.group(k.root); G.scale.setScalar(s);
    const B = k.group(G, 0, perchY, 0);
    const fluffy = s < 0.7 ? 1 : 0.88;
    // body: a teardrop, round chest, tapering into the tail; dark back, pale belly
    const bodyG = loftG('bbody:' + body + bellyC, 18, 14, u => {
      if (u < 0.68) return 1.1 + 5.1 * Math.pow(Math.sin(u / 0.68 * PI / 2), 0.9);
      const q = (u - 0.68) / 0.32; return 6.2 * Math.sqrt(Math.max(0, 1 - q * q));
    }, u => (u < 0.68 ? 1.1 + 5.1 * Math.pow(Math.sin(u / 0.68 * PI / 2), 0.9) : 6.2 * Math.sqrt(Math.max(0, 1 - ((u - 0.68) / 0.32) ** 2))) * 0.84,
    (() => { const A = C3(body), Dk = C3(shade(body, 0.16)), Bl = C3(bellyC); return (u, ca, sa, c) => { c.copy(A).lerp(Dk, sstep(0.2, 1, ca)); c.lerp(Bl, sstep(-0.05, -0.75, ca) * sstep(0.15, 0.55, u) * 0.9); }; })(),
    [-11, 0.9, 0, -6, 0.2, 0, 0, 0, 0, 5, 0.3, 0, 9.2, 1.4, 0]);
    k.mesh(bodyG, vmat(k, { rough: fluffy }), B);
    // head (and a long neck for flamingos and ostriches)
    const hr = isOwl ? 5.6 : isOstrich ? 2.9 : isTurkey ? 3.3 : isHum ? 4.6 : 4.4;
    const hx = o.longNeck ? 9.8 : 7.6, hy = o.longNeck ? 17.5 : 4.8;
    const headC = isTurkey ? '#93a9c6' : isOstrich ? skinC : body;
    if (o.longNeck) {
      const path = isFlamingo ? [4, 2, 0, 7.8, 6, 0, 5.6, 11, 0, 7, 15, 0, hx - 1, hy - 0.4, 0] : [4, 2.5, 0, 6.5, 7, 0, 7.6, 12, 0, hx - 0.6, hy - 0.8, 0];
      const nc = isOstrich ? skinC : body;
      k.mesh(loftG('neck:' + isFlamingo + nc, 22, 10, u => 2.9 - 1.0 * u, u => 2.6 - 0.9 * u, null, path), k.mat(nc, { rough: 0.85 }), B);
    }
    const Hd = k.group(B, hx, hy, 0);
    k.sphere([hr * 1.08, hr * 0.96, hr * 0.86], k.mat(headC, { rough: fluffy }), Hd);
    // beak: upper mandible fixed, lower one opens
    const Bk = k.group(Hd, hr * 0.9, -0.3, 0), Jw = k.group(Bk, -0.2, -0.35, 0);
    const bm = k.mat(beakC, { rough: 0.42 });
    const coneX = (r, len, m, par, x, y, tilt) => { const c = k.cone(r, len, m, par, x + len / 2, y, 0, 12); c.rotation.z = -PI / 2 - (tilt || 0); c.scale.z = 0.78; return c; };
    switch (o.beak) {
      case 'long': coneX(isHum ? 0.55 : 1.25, isHum ? 13 : 10.5, bm, Bk, -0.4, 0.25, 0.04); coneX(isHum ? 0.42 : 0.9, isHum ? 12.2 : 9.6, bm, Jw, -0.4, 0, 0); break;
      case 'hook': {
        const sc = isOwl ? 0.55 : isEagle ? 0.82 : isFlamingo ? 0.9 : 1;
        const up = k.mesh(xg('hook', [-0.6, 2.0, 1.5, 2.3, 3.4, 1.8, 4.6, 0.4, 4.9, -1.6, 4.3, -3.4, 3.7, -3.1, 3.5, -1.6, 2.4, -0.9, 0.6, -1.2, -0.6, -1.0], 2.6, 0.6, true), bm, Bk, -0.6, 0, 0);
        up.scale.set(sc, sc, sc);
        const lo = k.mesh(xg('hookL', [-0.5, -0.9, 2.6, -1.0, 3.1, -1.7, 1.2, -2.3, -0.5, -2.0], 1.9, 0.45, true), bm, Jw, -0.4, 0.3, 0); lo.scale.set(sc, sc, sc);
        if (isFlamingo) { const tip = k.mesh(xg('hookT', [3.0, 1.7, 3.6, 1.4, 4.6, 0.4, 4.9, -1.6, 4.3, -3.4, 3.7, -3.1, 3.5, -1.6, 3.0, -1.0], 2.75, 0.62, true), k.mat('#1c1a18', { rough: 0.4 }), Bk, -0.6, 0, 0); tip.scale.set(sc, sc, sc); }
        break;
      }
      case 'flat': {
        const bill = [0, -1.7, 2.5, -1.8, 5.2, -2.1, 6.6, -1.6, 7.1, 0, 6.6, 1.6, 5.2, 2.1, 2.5, 1.8, 0, 1.7];
        const up = k.mesh(xg('bill', bill, 1.3, 0.45, true), bm, Bk, -1, 0.35, 0); up.rotation.x = -PI / 2;
        const lo = k.mesh(xg('billL', bill.map(v => v * 0.92), 0.9, 0.3, true), bm, Jw, -0.8, -0.2, 0); lo.rotation.x = -PI / 2;
        Bk.rotation.z = -0.12; break;
      }
      case 'tiny': coneX(0.95, 2.6, bm, Bk, -0.5, 0.2, 0.1); coneX(0.6, 2.1, bm, Jw, -0.4, 0, 0); break;
      default: coneX(1.45, 5.2, bm, Bk, -0.6, 0.3, 0.12); coneX(0.95, 4.2, bm, Jw, -0.5, 0, 0);
    }
    // eyes: dark beads on the side of the head; an owl's look forward from a pale facial disc
    const iris = isOwl ? '#f2a516' : isEagle ? '#d9a21e' : isChicken || isRooster ? '#d4801c' : '#2a1a0e';
    const white = isOwl ? '#f2a516' : isEagle ? '#c9921a' : isParrot ? '#f1ece0' : isChicken || isRooster ? '#d4801c' : '#1d140c';
    if (isOwl) {
      const discC = mix(body, '#fff', 0.35);
      k.sphere([hr * 0.42, hr * 0.88, hr * 0.8], k.mat(discC, { rough: 0.95 }), Hd, hr * 0.6, -0.2, 0);
      for (const sd of [1, -1]) k.eye(1.75, Hd, hr * 0.88, 0.4, sd * hr * 0.4, { dir: [1, 0.05, sd * 0.28], iris, white, lid: discC });
      for (const sd of [1, -1]) { const tf = k.cone(1.1, 3.4, k.mat(shade(body, 0.2), { rough: 0.95 }), Hd, -hr * 0.1, hr * 0.95, sd * hr * 0.45, 8); tf.rotation.set(sd * 0.25, 0, 0.35); }   // ear tufts
    } else {
      const er = isEagle ? 1.25 : isHum ? 0.9 : 1.1;
      for (const sd of [1, -1]) {
        k.eye(er, Hd, hr * 0.38, hr * 0.24, sd * hr * 0.7, { dir: [0.35, 0.1, sd], iris, white, lid: false });
        if (isEagle) { const br = k.sphere([er * 1.8, er * 0.55, er * 1.1], k.mat(shade(headC, 0.1), { rough: 0.9 }), Hd, hr * 0.42, hr * 0.24 + er * 0.85, sd * hr * 0.66); br.rotation.z = -0.25; }   // a fierce brow
      }
    }
    // comb, wattles, crest
    const watM = k.mat(k.col('wattle'), { rough: 0.55 });
    if (o.comb) { const cm = k.mesh(xg('comb', [-3.4, 0, -3.0, 3.2, -1.6, 1.3, -0.4, 3.8, 0.9, 1.5, 2.0, 3.2, 2.9, 0.2], 1.1, 0.35, true), watM, Hd, 0.4, hr * 0.72, 0); if (isRooster) cm.scale.set(1.15, 1.4, 1); }
    if (o.wattle) {
      const wr = isTurkey ? [1.3, 2.6, 0.9] : [1.0, 1.9, 0.75];
      for (const sd of [1, -1]) k.sphere(wr, watM, Hd, hr * 0.78, -hr * 0.78, sd * 0.55);
      if (isTurkey) { const sn = k.limb(3.4, 0.5, 0.35, watM, Hd, hr * 0.95, hr * 0.25, 0); sn.rotation.z = 0.25; }
    }
    if (o.crest && !isPeacock) {
      const cm = k.mat(shade(body, 0.1), { rough: 0.9 });
      for (let i = 0; i < 3; i++) { const f = k.mesh(xg('crestF', [0, -0.6, 3, -0.85, 6.2, 0, 3, 0.85, 0, 0.6], 0.6, 0.2, true), cm, Hd, -hr * 0.3, hr * 0.78, 0); f.rotation.z = 1.7 + i * 0.35; }
    }
    if (isPeacock) {
      const cm = k.mat(shade(body, 0.2), { rough: 0.8 }), tm = k.mat(wingC, { rough: 0.5, metal: 0.3 });
      for (let i = 0; i < 4; i++) { const a = -0.45 + i * 0.22, st = k.group(Hd, -0.5 + i * 0.25, hr * 0.85, (i - 1.5) * 0.45); st.rotation.z = a; k.cyl(0.12, 0.12, 4.2, cm, st, 0, 2.1, 0, 5); k.sphere([0.75, 0.75, 0.35], tm, st, 0, 4.3, 0); }
    }
    // tail
    const Tl = k.group(B, -9.6, 0.9, 0), tailK = o.tail === 'long' ? 'long' : 'short', TS = TAIL[tailK];
    const tailM = tmat(k, wingC, tailTex(tailK, TS), { rough: 0.85 });
    if (isChicken) { const tm = k.mesh(xg('tail:' + tailK, TS.pts, 0.8, 0.3), tailM, Tl); tm.scale.set(0.8, 0.9, 1); Tl.rotation.z = -0.95; Tl.position.x = -8.6; }
    else {
      const tm = k.mesh(xg('tail:' + tailK, TS.pts, 0.8, 0.3), tailM, Tl); tm.rotation.x = -PI / 2;
      const tc = k.mesh(xg('tail:' + tailK, TS.pts, 0.8, 0.3), k.mat(body, { rough: 0.9 }), Tl, 1.2, 0.55, 0); tc.rotation.x = -PI / 2; tc.scale.set(0.5, 0.75, 1.6);
      Tl.fanM = tm;
    }
    if (isRooster) {   // arching sickle feathers, dark and glossy
      const sm = k.mat(mix(shade(body, 0.6), '#12352a', 0.55), { rough: 0.3, metal: 0.35 });
      for (let i = 0; i < 4; i++) {
        const R = 5.5 + i * 1.3, pts = [], cx = -13 + i * 0.4, cy = 1, a0 = 0.18 * PI, a1 = (1.02 + i * 0.03) * PI;
        for (let j = 0; j <= 10; j++) { const a = a0 + (a1 - a0) * j / 10, w = 0.9 * (1 - j / 11) + 0.15; pts.push(cx + Math.cos(a) * (R + w), cy + Math.sin(a) * (R + w)); }
        for (let j = 10; j >= 0; j--) { const a = a0 + (a1 - a0) * j / 10, w = 0.9 * (1 - j / 11) + 0.15; pts.push(cx + Math.cos(a) * (R - w), cy + Math.sin(a) * (R - w)); }
        k.mesh(xg('sickle' + i, pts, 0.5, 0.18), sm, B, 3.5, -0.5, (i - 1.5) * 0.55);
      }
    }
    // display fans: peacock eyes / turkey bars, turned toward whoever is watching
    let fan = null;
    if (isPeacock || isTurkey) {
      const R = isPeacock ? 17 : 13;
      const ft = isPeacock ? tex('fanP:' + body + wingC, 512, 512, (c, W, H) => {
        const cx = W / 2, cy = H / 2, rr = W / 2, core = shade(body, 0.35), ring = wingC, outer = mix(wingC, '#c9a23a', 0.55), barb = mix(wingC, '#6b7d2a', 0.45);
        c.strokeStyle = barb; for (let i = 0; i < 900; i++) { const a = Math.random() * TAU, r0 = rr * 0.1, r1 = rr * (0.75 + Math.random() * 0.27); c.globalAlpha = 0.5; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke(); }
        c.globalAlpha = 1;
        for (const [rf, n] of [[0.9, 26], [0.72, 21], [0.55, 16], [0.38, 11]]) for (let i = 0; i < n; i++) {
          const a = (i + (n & 1) * 0.5) / n * TAU, x = cx + Math.cos(a) * rr * rf, y = cy + Math.sin(a) * rr * rf, sz = rr * 0.07 * (0.6 + rf * 0.6);
          c.save(); c.translate(x, y); c.rotate(a);
          for (const [k2, cl] of [[1.25, outer], [0.95, ring], [0.62, mix(ring, '#2a7fd0', 0.5)], [0.38, core]]) { c.fillStyle = cl; c.beginPath(); c.ellipse(0, 0, sz * k2 * 1.25, sz * k2, 0, 0, TAU); c.fill(); }
          c.restore();
        }
      }) : tex('fanT:' + body, 512, 512, (c, W, H) => {
        const cx = W / 2, cy = H / 2, rr = W / 2, n = 26;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU; c.save(); c.translate(cx, cy); c.rotate(a);
          const bands = [[1.0, '#d8c7a0'], [0.9, shade(body, 0.55)], [0.84, mix(body, '#b5651d', 0.45)], [0.7, shade(body, 0.4)], [0.62, mix(body, '#b5651d', 0.35)], [0.5, shade(body, 0.35)], [0.42, body]];
          for (const [rf, cl] of bands) { c.fillStyle = cl; c.beginPath(); c.moveTo(0, 0); c.ellipse(rr * rf * 0.5, 0, rr * rf * 0.5, rr * 0.075 * rf + 4, 0, -PI / 2, PI / 2); c.closePath(); c.fill(); }
          c.restore();
        }
      });
      const fg = geo('fan:' + R, () => {
        const g = new T.RingGeometry(1.5, R, 40, 3, -0.2 * PI, 1.4 * PI); const P = g.attributes.position;
        for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), r = Math.hypot(x, y) / R; P.setZ(i, -r * r * R * 0.28); }
        g.computeVertexNormals(); return g;
      });
      fan = k.group(B, isPeacock ? -8 : -7.5, isPeacock ? 2 : 1.5, 0);
      const fm = k.mesh(fg, tmat(k, '#ffffff', ft, { rough: 0.6, side: 'double', cut: 1 }), fan); fm.rotation.y = PI / 2;
    }
    // folded wings on the sides, and spread wings for flight
    const wingM = tmat(k, wingC, featherTex('fold', FOLD), { rough: 0.85 });
    const foldW = [1, -1].map(sd => { const m = k.mesh(xg('fold', FOLD.pts, 1.1, 0.4), wingM, B, 0.2, 0.3, sd * 4.5); m.rotation.set(-sd * 0.3, -sd * 0.08, 0.04); return m; });
    const slot = isEagle ? 0.42 : isOwl ? 0.22 : 0.1;
    const HD = HAND(slot), armM = tmat(k, wingC, featherTex('arm', ARM), { rough: 0.85, side: 'double' }), handM = tmat(k, wingC, featherTex('hand' + slot, HD), { rough: 0.85, side: 'double' });
    const wsc = isHum ? 0.75 : 1;
    const flyW = [1, -1].map(sd => {
      const J = k.group(B, 1.4, 3.1, sd * 2.6), pl = k.group(J); pl.rotation.x = sd * PI / 2; pl.scale.set(wsc, wsc, 1);
      k.mesh(xg('arm', ARM.pts, 0.7, 0.25), armM, pl);
      const hand = k.group(pl, 0.3, 8.9, 0); k.mesh(xg('hand' + slot, HD.pts, 0.6, 0.22), handM, hand);
      J.visible = false; return { J, hand, sd };
    });
    // legs: scaly shanks with toes (two-part long legs for flamingos and ostriches)
    const legC = isFlamingo ? body : isOstrich ? skinC : beakC, legM = k.mat(legC, { rough: 0.6 }), legs = [];
    for (const sd of [1, -1]) {
      const hipY = perchY - (o.longLegs ? 4 : 3.5);
      const hip = k.group(G, -0.5, hipY, sd * (o.longLegs ? 2.2 : 1.8));
      if (!o.longLegs) {
        const len = legL + 2.5 - 0.3, leg = k.limb(len, 0.55, 0.45, legM, hip);
        const ft = k.group(leg, 0, -len, 0); k.mesh(footG(isDuck, 3.8), legM, ft).rotation.x = -PI / 2;
        legs.push({ leg, ft, sd, len });
      } else {
        const a = isOstrich ? 10 : 9, b = (legL + 2 - 0.3 - a * 0.955) / 0.969;
        const thigh = isOstrich ? k.sphere([2.6, 3.6, 2], k.mat(skinC, { rough: 0.7 }), hip, 0.2, -1.5, 0) : null;
        const leg = k.limb(a, isOstrich ? 1.2 : 0.65, isOstrich ? 0.8 : 0.5, legM, hip);
        const knee = k.limb(b, isOstrich ? 0.8 : 0.5, isOstrich ? 0.65 : 0.42, legM, leg, 0, -a, 0);
        const ft = k.group(knee, 0, -b, 0); k.mesh(footG(isFlamingo, isOstrich ? 5 : 4.2), legM, ft).rotation.x = -PI / 2;
        legs.push({ leg, knee, ft, sd, thigh });
      }
    }
    const tiltPerch = isOwl ? 0.85 : o.longLegs ? 0.05 : isDuck ? 0.04 : (o.comb || o.fan) ? 0.12 : 0.3;
    const st = { fl: 0, by: perchY };
    return (e, t, dt) => {
      const fly = !e.ko && !e.sleeping && (e.flying || e.held || !e.grounded);
      const walk = e.moving && e.grounded && !e.flying && !e.held, ph = e.phase || 0, sleep = e.sleeping || e.mood === 'sleep';
      const lk = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * PI) : 0, kk = Math.min(1, dt * 10);
      st.fl += ((fly ? 1 : 0) - st.fl) * kk;
      const fp = st.fl > 0.5;
      B.position.y = perchY * (1 - st.fl);
      const tilt = fp ? (isHum ? 0.55 : clamp(-(e.vy || 0) * 0.0008, -0.3, 0.3)) : tiltPerch;
      B.rotation.z += (tilt - B.rotation.z) * kk;
      const peck = isChicken && !fp && !walk && !e.held ? Math.pow(Math.max(0, Math.sin(t * 1.4 + e.seed)), 12) : 0;
      Hd.rotation.z = -B.rotation.z * 0.8 - (sleep ? 0.45 : 0) - peck * 1.1 + (walk && !o.longNeck ? Math.sin(ph * 2) * 0.06 : 0);
      Hd.position.x = hx + (walk && !o.longNeck ? Math.sin(ph * 2) * 0.7 : 0) + peck * 1.5;
      Hd.position.y = hy - peck * 3 - (sleep ? 1 : 0);
      Jw.rotation.z = -(lk * 0.6 + (e.mood === 'happy' || e.mood === 'scared' ? 0.16 * (0.5 + 0.5 * Math.sin(t * 14)) : 0) + (e.mood === 'angry' ? 0.12 : 0));
      // wings
      for (const w of foldW) w.visible = !fp;
      const f = Math.sin(t * o.flap + e.seed), soar = isEagle && e.flying && Math.sin(t * 0.4 + e.seed) > 0.2;
      for (const w of flyW) {
        w.J.visible = fp; if (!fp) continue;
        let elev = 0.45 + 0.85 * f, sweep = -0.1 + 0.18 * f, bend = 0.35 * Math.sin(t * o.flap + e.seed - 1.2);
        if (soar) { elev = 0.18 + Math.sin(t * 1.3) * 0.04; sweep = 0.05; bend = -0.08; }
        if (isHum) { elev = 0.9 + 0.5 * f; sweep = 0.6 * f; bend = 0; }
        w.J.rotation.set(-w.sd * elev, w.sd * sweep, 0); w.hand.rotation.x = -w.sd * bend;
      }
      if (Tl.fanM) { Tl.fanM.scale.set(1, fp ? 1.3 : 0.6, fp ? 1 : 2.4); Tl.rotation.x = -camSide(e) * (fp ? 0.45 : 0.3); }
      Tl.rotation.z = isChicken ? -0.95 : fp ? 0.05 : 0.15 - (walk ? Math.sin(ph * 2) * 0.05 : 0);
      if (fan) { const want = -camSide(e) * 0.95; fan.rotation.y += (want - fan.rotation.y) * Math.min(1, dt * 4); fan.scale.setScalar(fp ? 0.3 : 1); }
      // legs
      for (const L of legs) {
        const q = ph + (L.sd > 0 ? 0 : PI);
        if (!o.longLegs) {
          let a = 0; if (fp) a = -1.2; else if (walk) a = Math.sin(q) * 0.5; else if (e.held) a = Math.sin(t * 9 + L.sd) * 0.35;
          L.leg.rotation.z = a; L.ft.rotation.z = fp ? 1.6 : -a + (walk ? Math.max(0, Math.cos(q)) * 0.35 : 0);
        } else {
          let a = -0.3, b = 0.55;
          if (fp) { a = -1.45; b = 0.05; }
          else if (walk) { a = -0.3 + Math.sin(q) * 0.38; b = 0.55 + Math.max(0, Math.cos(q)) * 0.6; }
          else if (isFlamingo && !e.held && L.sd > 0 && !sleep) { a = 0.85; b = -2.95; }   // resting on one leg
          L.leg.rotation.z = a; L.knee.rotation.z = b; L.ft.rotation.z = fp ? 1.2 : -(a + b);
        }
      }
    };
  };

  // the penguin: upright, tuxedo front, flippers, waddle
  function penguin(e, k, tpl) {
    const s = tpl.o.s, body = k.col('body'), belly = own(k, 'belly') || '#f4f4f0', beakC = k.col('beak');
    const G = k.group(k.root); G.scale.setScalar(s);
    const R = k.group(G, 0, -15, 0);   // pivot at the feet for the waddle
    const r = u => u < 0.3 ? 8.4 * Math.sqrt(Math.max(0, 1 - ((0.3 - u) / 0.31) ** 2)) : u < 0.76 ? 8.4 - 3.9 * sstep(0.3, 0.76, u) : u < 0.86 ? 4.5 + 0.5 * sstep(0.76, 0.86, u) : 5.0 * Math.pow(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2), 0.45);
    const g = loftG('peng:' + body + belly, 24, 16, r, u => r(u) * 0.84, (() => { const A = C3(body), W = C3(belly); return (u, ca, sa, c) => { c.copy(A).lerp(W, sstep(0.1, 0.5, ca) * (1 - sstep(0.74, 0.79, u)) * sstep(0.0, 0.05, u)); }; })(),
      [-0.3, 1, 0, 0, 7, 0, 0.4, 14, 0, 0.9, 20, 0, 1.6, 24.5, 0, 2.0, 28.4, 0], [1, 0, 0]);
    k.mesh(g, vmat(k, { rough: 0.55 }), R);
    const bm = k.mat(beakC, { rough: 0.45 });
    const bk = k.cone(1.25, 5.4, bm, R, 7.8, 25.2, 0, 12); bk.rotation.z = -PI / 2 - 0.12; bk.scale.z = 0.8;
    for (const sd of [1, -1]) k.eye(1.0, R, 4.7, 26.4, sd * 3.0, { dir: [0.5, 0.15, sd], iris: '#2a1a0e', white: '#24180f', lid: body });
    const flM = k.mat(body, { rough: 0.55 }), fls = [];
    for (const sd of [1, -1]) { const F = k.group(R, 0.4, 20.5, sd * 5.4); const m = k.mesh(xg('flipper', [0.8, 0, 0.3, -5, -0.9, -10, -2.2, -11.6, -2.6, -9, -2.2, -4, -1.4, 0], 1.2, 0.4, true), flM, F); m.rotation.y = sd * 0.15; fls.push({ F, sd }); }
    const fM = k.mat(beakC, { rough: 0.6 }), feet = [];
    for (const sd of [1, -1]) { const ft = k.group(R, 2, 0.35, sd * 2.7); k.mesh(footG(true, 4.2), fM, ft).rotation.x = -PI / 2; feet.push({ ft, sd }); }
    const tl = k.cone(2.2, 3.5, flM, R, -6.6, 3.2, 0, 10); tl.rotation.z = 2.3;
    return (e, t) => {
      const walk = e.moving && e.grounded && !e.held, ph = e.phase || 0, flap = e.held || (!e.grounded && !e.ko);
      R.rotation.x = walk ? Math.sin(ph) * 0.13 : 0;
      R.rotation.z = walk ? 0.06 : e.sleeping ? 0.15 : 0;
      for (const f of fls) f.F.rotation.x = -f.sd * (flap ? 0.5 + Math.sin(t * 14) * 0.5 : walk ? 0.3 + Math.sin(ph) * 0.15 * f.sd : 0.1);
      for (const f of feet) { const q = ph + (f.sd > 0 ? 0 : PI); f.ft.position.y = 0.35 + (walk ? Math.max(0, Math.sin(q)) * 1.2 : 0); f.ft.rotation.z = walk ? Math.max(0, Math.sin(q)) * 0.25 : 0; }
    };
  }

  // the bat: furry body, big ears, membrane wings with finger bones
  function bat(e, k, tpl) {
    const s = tpl.o.s, body = k.col('body'), memC = own(k, 'batwing') || shade(body, 0.08);
    const G = k.group(k.root); G.scale.setScalar(s);
    const B = k.group(G, 0, 0, 0);
    const furM = k.mat(body, { rough: 0.98 }), dk = k.mat(shade(body, 0.35), { rough: 0.8 });
    k.sphere([7.6, 5.0, 4.8], furM, B, -0.5, 0, 0);
    const Hd = k.group(B, 7.2, 1.6, 0); Hd.scale.setScalar(1.2);
    k.sphere([3.1, 2.9, 2.7], furM, Hd);
    k.sphere([1.9, 1.3, 1.3], k.mat(mix(body, '#7a4a44', 0.35), { rough: 0.7 }), Hd, 2.4, -0.7, 0);
    for (const sd of [1, -1]) {
      const ear = k.mesh(xg('batear', [-1.4, 0, 1.4, 0, 0.6, 3.2, -0.2, 5.4, -1.1, 3], 0.6, 0.2, true), k.mat(shade(body, 0.12), { rough: 0.75, side: 'double' }), Hd, -0.4, 2.0, sd * 1.4);
      ear.rotation.set(sd * 0.45, sd * 0.5, -0.15);
      k.eye(0.6, Hd, 2.0, 0.6, sd * 1.65, { dir: [0.6, 0.1, sd], iris: '#120c08', white: '#120c08', lid: body });
      const fg = k.cone(0.22, 1.1, k.mat('#f4efe6', { rough: 0.3 }), Hd, 3.3, -1.7, sd * 0.45, 6); fg.rotation.z = PI;
    }
    for (const sd of [1, -1]) { const ft = k.cone(0.5, 2.2, dk, B, -6.6, -2.2, sd * 1.2, 6); ft.rotation.z = 2.4; }
    const armM = tmat(k, memC, membraneTex('batarm', BAT_ARM, [[2.4, 0, 2.5, 8.2], [2.4, 8.2, -6.5, 5.6]]), { rough: 0.7, side: 'double' });
    const handM = tmat(k, memC, membraneTex('bathand', BAT_HAND, BAT_HAND.bones), { rough: 0.7, side: 'double' });
    const wings = [1, -1].map(sd => {
      const J = k.group(B, 1.2, 2.4, sd * 2.8), pl = k.group(J); pl.rotation.x = sd * PI / 2; pl.scale.set(1.3, 1.3, 1);
      k.mesh(xg('batarm', BAT_ARM.pts, 0.35, 0.1), armM, pl);
      const hand = k.group(pl, 0.3, 8.2, 0); k.mesh(xg('bathand', BAT_HAND.pts, 0.35, 0.1), handM, hand);
      const fold = k.mesh(xg('batfold', [3, 0.5, 1, 2.6, -4, 2.2, -8, 0.2, -4, -1.8, 1, -1.2], 0.8, 0.3, true), k.mat(memC, { rough: 0.7 }), B, 0, 0.6, sd * 3.6);
      return { J, hand, fold, sd };
    });
    return (e, t) => {
      const fly = !e.ko && !e.sleeping && (e.flying || e.held || !e.grounded), f = Math.sin(t * 11 + e.seed);
      for (const w of wings) {
        w.J.visible = fly; w.fold.visible = !fly;
        w.J.rotation.set(-w.sd * (0.35 + 0.95 * f), w.sd * (0.1 * f), 0); w.hand.rotation.x = -w.sd * 0.45 * Math.sin(t * 11 + e.seed - 1.1);
      }
      B.rotation.z = fly ? 0.1 : 0;
    };
  }

  // ======================= BUGS =======================
  // a rigid jointed leg as one bent tube from hip to foot (the hip joint swings it); far-side legs are mirrored
  function bugLeg(k, parent, mat, key, x, y, side, knee, foot, r, col) {
    const g = loftG('bleg:' + key, 12, 5, u => r * (1 - 0.6 * u), null, col || null, [0, 0, 0, knee[0] * 0.5, knee[1] * 0.5, knee[2] * 0.5, knee[0], knee[1], knee[2], (knee[0] + foot[0]) / 2, (knee[1] + foot[1]) / 2, (knee[2] + foot[2]) / 2, foot[0], foot[1], foot[2]]);
    const hip = k.group(parent, x, y, side * 0.6); const m = k.mesh(g, mat, hip); if (side < 0) m.scale.z = -1;
    hip.side = side; return hip;
  }
  // six legs, three per side; spec: [hipX, hipY, knee[x,y,z], foot[x,y,z]] for front, middle, back, in body coordinates
  function legs6(k, parent, mat, key, spec, r) {
    const out = [], loc = (L, p) => [p[0] - L[0], p[1] - L[1], p[2] - 0.6];
    spec.forEach((L, i) => { for (const sd of [1, -1]) { const h = bugLeg(k, parent, mat, key + i, L[0], L[1], sd, loc(L, L[2]), loc(L, L[3]), r); h.i = i; h.grp = (i + (sd > 0 ? 0 : 1)) & 1; out.push(h); } });
    return out;
  }
  function animLegs(legs, e, t, amp, rate) {
    const walk = e.moving && e.grounded, ph = (e.phase || 0) * (rate || 2);
    for (const h of legs) {
      let sw = 0, lift = 0;
      if (walk) { const q = ph + (h.grp ? PI : 0); sw = Math.sin(q) * (amp || 0.3); lift = Math.max(0, Math.cos(q)) * 0.25; }
      else if (e.held) { sw = Math.sin(t * 16 + h.i * 2 + h.side) * 0.35; lift = 0.2 + Math.sin(t * 13 + h.i) * 0.2; }
      else if (!e.grounded) { lift = -0.15; sw = -0.15 * (h.i - 1); }
      h.rotation.y = h.side * sw; h.rotation.x = -h.side * lift;
    }
  }
  // wing planes with painted, see-through membranes
  const WINGS = {
    clear: (c, W, H, F, ptero) => {   // clear membrane with veins
      c.save(); c.beginPath(); F.outline(c); c.clip();
      c.fillStyle = 'rgba(225,235,245,0.55)'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(40,35,30,0.95)'; c.lineWidth = 2.2;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(W * 0.02, H * (0.45 + i * 0.02)); c.quadraticCurveTo(W * 0.5, H * (0.1 + i * 0.16), W * 0.98, H * (0.05 + i * 0.17)); c.stroke(); }
      c.lineWidth = 1.2; for (let i = 0; i < 14; i++) { const x = W * (0.15 + i * 0.06); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + W * 0.03, H); c.stroke(); }
      if (ptero) { c.fillStyle = 'rgba(30,25,20,0.95)'; c.fillRect(W * 0.86, H * 0.0, W * 0.07, H * 0.3); }
      c.restore(); c.strokeStyle = 'rgba(40,35,30,0.9)'; c.lineWidth = 2.5; c.beginPath(); F.outline(c); c.stroke();
    }
  };
  // insect wing plane: chord along x, span along y from the hinge; painted with paint(ctx, W, H, outline)
  function wingPlane(key, x0, x1, span, outlineFn, paint) {
    const g = geo('wplane:' + key, () => { const p = new T.PlaneGeometry(x1 - x0, span); p.translate((x0 + x1) / 2, span / 2, 0); return p; });
    const t = tex('wing:' + key, 256, Math.max(32, Math.round(256 * span / (x1 - x0))), (c, W, H) => { const F = { outline: cc => outlineFn(cc, W, H) }; paint(c, W, H, F); });
    return { g, t };
  }
  const ovalWing = (cx, cy, rx, ry, rot) => (c, W, H) => c.ellipse(W * cx, H * cy, W * rx, H * ry, rot || 0, 0, TAU);
  function insectWing(k, parent, x, y, sd, key, W, mat) {
    const J = k.group(parent, x, y, sd * 0.5), pl = k.group(J); pl.rotation.x = sd * PI / 2;
    k.mesh(W.g, mat, pl); J.sd = sd; return J;
  }
  function animWings(ws, e, t, o) {   // o: { rest: elev, sweep, fly: [base, amp], rate }
    const fly = e.flying || e.held || (!e.grounded && !e.ko);
    for (const J of ws) {
      let elev = o.rest, sw = o.sweep || 0;
      if (fly && !e.ko) { const f = Math.sin(t * (o.rate || 40) + e.seed + (J.hind ? 0.6 : 0)); elev = o.fly[0] + o.fly[1] * f; sw = (o.flySweep != null ? o.flySweep : sw * 0.3); }
      J.rotation.set(-J.sd * elev, -J.sd * sw * (J.hind ? 1.25 : 1), 0);
    }
  }
  const dark = '#1e1a16';
  const glossy = (k, c) => k.mat(c, { rough: 0.18, metal: 0.25 });
  // an antenna: thin, elbowed or curved, mirrored on the far side
  function antenna(k, parent, mat, key, x, y, pts, r, sd) {
    const g = loftG('ant:' + key, 8, 4, u => r * (1 - 0.5 * u), null, null, [0, 0, 0].concat(pts));
    const m = k.mesh(g, mat, parent, x, y, sd * 0.6); if (sd < 0) m.scale.z = -1; return m;
  }

  M3.kinds.bug = function (e, k, tpl) {
    const kind = tpl.sub, G = k.group(k.root); G.scale.setScalar(tpl.k || 1);
    const f = BUGS[kind] || BUGS.beetle;
    return f(e, k, G, tpl);
  };
  const BUGS = {};
  // bee, fly, mosquito: head, thorax, abdomen, clear wings that buzz
  BUGS.bee = (e, k, G) => {
    const body = k.col('body'), fur = mix(body, '#8a5a1a', 0.3), gy = -8;
    const A = C3(body), Dk = C3('#231b12');
    const abd = loftG('beeabd:' + body, 16, 12, u => 0.3 + 3.9 * Math.pow(Math.sin(Math.min(1, u * 1.15) * PI * 0.92), 0.8), null, (u, ca, sa, c) => { const band = Math.sin(u * 22 + 0.6); c.copy(A).lerp(Dk, u < 0.22 ? 1 : sstep(-0.1, 0.3, band)); }, [-11, -0.8, 0, -8, 0.3, 0, -4.5, 0.6, 0, -1.4, 0.4, 0]);
    k.mesh(abd, vmat(k, { rough: 0.85 }), G);
    k.cone(0.35, 1.6, k.mat(dark, { rough: 0.4 }), G, -11.6, -0.9, 0, 6).rotation.z = PI / 2;
    k.sphere([3.3, 3.3, 3.2], k.mat(fur, { rough: 1 }), G, 0.6, 0.6, 0);
    const Hd = k.group(G, 4.6, 0.3, 0);
    k.sphere([2.0, 2.5, 2.6], k.mat(dark, { rough: 0.7 }), Hd);
    const em = glossy(k, '#2b2117');
    for (const sd of [1, -1]) { k.sphere([1.1, 1.8, 0.9], em, Hd, 0.4, 0.4, sd * 1.9); antenna(k, Hd, k.mat(dark), 'bee', 1.2, 1.6, [1.0, 2.6, 0.6, 2.8, 3.2, 1.4], 0.28, sd); }
    const lm = k.mat('#2a2018', { rough: 0.6 });
    const legs = legs6(k, G, lm, 'bee', [[2.2, -1.8, [3.2, -3.6, 2.6], [4.0, gy, 3.0]], [0.6, -2.2, [0.6, -4.2, 3.0], [0, gy, 3.6]], [-0.8, -2, [-2.8, -3.8, 2.8], [-4.6, gy, 3.2]]], 0.48);
    const W1 = wingPlane('bee1', -7, 2, 3.6, ovalWing(0.5, 0.5, 0.48, 0.42, 0.06), WINGS.clear), W2 = wingPlane('bee2', -5, 1, 2.4, ovalWing(0.5, 0.5, 0.48, 0.42), WINGS.clear);
    const wm = tmat(k, '#ffffff', W1.t, { opacity: 0.55, side: 'double', rough: 0.2 }), wm2 = tmat(k, '#ffffff', W2.t, { opacity: 0.55, side: 'double', rough: 0.2 });
    const ws = [];
    for (const sd of [1, -1]) { const a = insectWing(k, G, 0.6, 3.2, sd, 'bee1', W1, wm); a.rotation.order = 'YXZ'; const b = insectWing(k, G, -0.6, 3.0, sd, 'bee2', W2, wm2); b.hind = true; ws.push(a, b); }
    // the planes span outward (y) with the chord along x: rotate them so they lie back over the abdomen at rest
    return (e, t) => { animLegs(legs, e, t); animWings(ws, e, t, { rest: 0.35, sweep: 0, fly: [0.75, 0.6], rate: 47, flySweep: -0.5 }); };
  };
  BUGS.fly = (e, k, G) => {
    const body = k.col('body'), gy = -6, A = C3(shade(body, 0.1)), L = C3(mix(body, '#fff', 0.3)), Dk = C3(shade(body, 0.6));
    const abd = loftG('flyabd:' + body, 14, 12, u => 0.4 + 2.9 * Math.pow(Math.sin(Math.min(1, u * 1.12) * PI * 0.9), 0.7), u => (0.4 + 2.9 * Math.pow(Math.sin(Math.min(1, u * 1.12) * PI * 0.9), 0.7)) * 1.15,
      (u, ca, sa, c) => { c.copy(A).lerp(Dk, sstep(0.3, 0.9, ca) * (Math.sin(u * 18) > 0.2 ? 1 : 0.3)); c.lerp(L, sstep(0.2, 0.9, Math.abs(sa)) * 0.4); }, [-7.5, -0.6, 0, -5, 0.2, 0, -2.4, 0.4, 0, -0.6, 0.3, 0]);
    k.mesh(abd, vmat(k, { rough: 0.35, metal: 0.2 }), G);
    const thx = loftG('flythx:' + body, 10, 12, u => 3.0 * Math.sqrt(Math.max(0.02, Math.sin(u * PI))), null, (u, ca, sa, c) => { c.copy(C3(shade(body, 0.35))).lerp(C3(mix(body, '#fff', 0.15)), Math.abs(sa) < 0.35 && ca > 0 ? 0 : 0.5); }, [-1.8, 0.4, 0, 0.6, 1.0, 0, 2.8, 0.5, 0]);
    k.mesh(thx, vmat(k, { rough: 0.6 }), G);
    const Hd = k.group(G, 3.6, 0.4, 0);
    k.sphere([1.6, 2.0, 2.1], k.mat(shade(body, 0.4), { rough: 0.6 }), Hd);
    const em = glossy(k, '#7a1d12');
    for (const sd of [1, -1]) k.sphere([1.35, 1.8, 1.25], em, Hd, 0.5, 0.3, sd * 1.35);
    k.cyl(0.35, 0.5, 1.6, k.mat(shade(body, 0.5)), Hd, 1.2, -1.8, 0, 6).rotation.z = 0.4;
    const lm = k.mat(shade(body, 0.6), { rough: 0.6 });
    const legs = legs6(k, G, lm, 'fly', [[1.8, -1.2, [3.2, -2.6, 2.6], [3.8, gy, 3.6]], [0.6, -1.5, [0.4, -2.8, 3.2], [0, gy, 4.6]], [-0.6, -1.4, [-2.6, -2.4, 3], [-4.6, gy, 4]]], 0.32);
    const W1 = wingPlane('fly1', -7.5, 0.8, 3.4, ovalWing(0.52, 0.5, 0.47, 0.44, 0.08), WINGS.clear);
    const wm = tmat(k, '#ffffff', W1.t, { opacity: 0.55, side: 'double', rough: 0.2 });
    const ws = [1, -1].map(sd => insectWing(k, G, 0.2, 2.9, sd, 'fly1', W1, wm));
    return (e, t) => { animLegs(legs, e, t); animWings(ws, e, t, { rest: 0.3, fly: [0.8, 0.6], rate: 55, flySweep: -0.4 }); };
  };
  BUGS.mosquito = (e, k, G) => {
    const body = k.col('body'), gy = -6, A = C3(shade(body, 0.2)), Wt = C3(mix(body, '#fff', 0.55));
    const abd = loftG('mosabd:' + body, 14, 8, u => 0.3 + 1.3 * Math.pow(Math.sin(Math.min(1, u * 1.1) * PI * 0.9), 0.7), null, (u, ca, sa, c) => { c.copy(A).lerp(Wt, Math.sin(u * 30) > 0.6 ? 0.8 : 0); }, [-11, -1.6, 0, -7, -0.4, 0, -3.5, 0.3, 0, -0.6, 0.5, 0]);
    k.mesh(abd, vmat(k, { rough: 0.6 }), G);
    k.sphere([2.2, 2.0, 1.7], k.mat(shade(body, 0.3), { rough: 0.6 }), G, 0.8, 0.9, 0);
    const Hd = k.group(G, 3.4, 0.9, 0); k.sphere([1.1, 1.15, 1.15], k.mat(dark), Hd);
    for (const sd of [1, -1]) { k.sphere([0.7, 0.9, 0.6], glossy(k, '#1a1410'), Hd, 0.2, 0.1, sd * 0.75); antenna(k, Hd, k.mat(dark), 'mos', 0.6, 0.6, [1.6, 1.8, 0.5, 3.2, 2.6, 1.0], 0.16, sd); }
    const pr = k.cyl(0.12, 0.22, 7.5, k.mat(dark, { rough: 0.5 }), Hd, 3.9, -1.3, 0, 5); pr.rotation.z = PI / 2 + 0.3;
    const lm = k.mat(shade(body, 0.45), { rough: 0.6 });
    const legs = legs6(k, G, lm, 'mos', [[1.2, -0.4, [4, 1.5, 4], [7.5, gy, 5]], [0.6, -0.5, [0.5, 2, 5], [0, gy, 7]], [0, -0.4, [-4.5, 2.6, 4], [-9.5, gy + 4, 4.5]]], 0.18);
    const W1 = wingPlane('mos1', -9, 0.6, 1.8, ovalWing(0.5, 0.5, 0.48, 0.4, 0.04), WINGS.clear);
    const wm = tmat(k, '#ffffff', W1.t, { opacity: 0.55, side: 'double', rough: 0.2 });
    const ws = [1, -1].map(sd => insectWing(k, G, 0.4, 2.3, sd, 'mos1', W1, wm));
    return (e, t) => { animLegs(legs, e, t, 0.2); animWings(ws, e, t, { rest: 0.22, fly: [0.8, 0.55], rate: 60, flySweep: -0.3 }); };
  };
  // butterfly & moth: painted wings that close upright over the back and open to fly
  const butterflyPaint = (wc, fore) => (c, W, H, F) => {
    c.save(); c.beginPath(); F.outline(c); c.clip();
    c.fillStyle = wc; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W * 0.5, H * 0.05, 4, W * 0.5, H * 0.05, H * 0.9); g.addColorStop(0, 'rgba(90,40,10,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#151210'; c.lineWidth = 5;
    for (let i = 0; i < 7; i++) { const a = (fore ? -1.25 : -0.35) - i * (fore ? 0.18 : 0.3); c.beginPath(); c.moveTo(W * (fore ? 0.3 : 0.75), H); c.quadraticCurveTo(W * (fore ? 0.3 : 0.75) + Math.cos(a) * W * 0.3, H - Math.sin(-a) * H * 0.35, W * (fore ? 0.3 : 0.75) + Math.cos(a) * W, H - Math.sin(-a) * H * 1.1); c.stroke(); }
    c.restore();
    c.save(); c.beginPath(); F.outline(c); c.clip();
    c.lineWidth = W * 0.12; c.strokeStyle = '#151210'; c.beginPath(); F.outline(c); c.stroke();   // black margin
    c.fillStyle = '#f6f2e6'; for (let i = 0; i < 40; i++) { const p = F.edge(i / 40); c.beginPath(); c.arc(p[0], p[1], W * 0.018, 0, TAU); c.fill(); }
    if (fore) { c.fillStyle = '#151210'; c.beginPath(); c.ellipse(W * 0.82, H * 0.2, W * 0.22, H * 0.2, 0.5, 0, TAU); c.fill(); c.fillStyle = '#f6f2e6'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(W * (0.74 + i * 0.05), H * (0.12 + i * 0.07), W * 0.025, 0, TAU); c.fill(); } }
    c.restore();
  };
  const mothPaint = (wc, fore) => (c, W, H, F) => {
    c.save(); c.beginPath(); F.outline(c); c.clip();
    c.fillStyle = wc; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${40 + Math.random() * 30 | 0},20,${0.05 + Math.random() * 0.12})`; c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 0, TAU); c.fill(); }
    c.strokeStyle = shade(wc, 0.55); c.lineWidth = 5;
    for (let b = 0; b < 3; b++) { c.beginPath(); for (let x = 0; x <= W; x += 8) { const y = H * (0.3 + b * 0.22) + Math.sin(x * 0.08 + b) * 5; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    if (fore) { c.fillStyle = shade(wc, 0.6); c.beginPath(); c.arc(W * 0.55, H * 0.55, W * 0.05, 0, TAU); c.fill(); }
    else { for (const [r, cl] of [[0.17, '#2a1d12'], [0.12, '#d9a23a'], [0.06, '#1a120c']]) { c.fillStyle = cl; c.beginPath(); c.arc(W * 0.45, H * 0.55, W * r, 0, TAU); c.fill(); } }
    c.restore();
  };
  // a wing outline as a closed spline through points given in 0..1 of the canvas
  function splineWing(pts) {
    const v = []; for (let i = 0; i < pts.length; i += 2) v.push(new T.Vector2(pts[i], pts[i + 1]));
    const curve = new T.SplineCurve(v.concat([v[0]])), P = curve.getPoints(80);
    const outline = (c, W, H) => { P.forEach((p, i) => i ? c.lineTo(p.x * W, (1 - p.y) * H) : c.moveTo(p.x * W, (1 - p.y) * H)); c.closePath(); };
    return { outline, edge: (W, H, u) => { const p = curve.getPoint(u); return [p.x * W, (1 - p.y) * H]; } };
  }
  function lepWing(key, x0, x1, span, pts, paintFn) {
    const S = splineWing(pts);
    const g = geo('wplane:' + key, () => { const p = new T.PlaneGeometry(x1 - x0, span); p.translate((x0 + x1) / 2, span / 2, 0); return p; });
    const t = tex('wing:' + key, 256, Math.round(256 * span / (x1 - x0)), (c, W, H) => paintFn(c, W, H, { outline: cc => S.outline(cc, W, H), edge: u => S.edge(W, H, u) }));
    return { g, t };
  }
  const lep = moth => (e, k, G) => {
    const body = k.col('body'), wc = k.col('wing'), gy = -12;
    const B = k.group(G, 0, -7.5, 0);
    const fm = k.mat(moth ? mix(body, '#fff', 0.1) : body, { rough: 1 });
    k.mesh(loftG('lepabd' + moth, 12, 10, u => 0.3 + (moth ? 1.9 : 1.3) * Math.pow(Math.sin(Math.min(1, u * 1.1) * PI * 0.9), 0.6), null, null, [-8, -0.9, 0, -5, -0.2, 0, -2, 0.2, 0, 0, 0.3, 0]), fm, B);
    k.sphere([1.9, moth ? 2.0 : 1.6, moth ? 2.0 : 1.6], fm, B, 0.8, 0.4, 0);
    const Hd = k.group(B, 3.0, 0.5, 0); k.sphere(moth ? 1.4 : 1.2, fm, Hd);
    for (const sd of [1, -1]) {
      k.sphere([0.7, 0.8, 0.6], glossy(k, '#16120e'), Hd, 0.5, 0.1, sd * 0.85);
      if (moth) { const a = k.mesh(xg('plume', [0, 0, 1.6, 0.9, 3.6, 2.6, 5, 4.4, 4.6, 4.6, 3, 3.2, 1.2, 1.4], 0.3, 0.1, true), k.mat(shade(body, 0.2), { rough: 1, side: 'double' }), Hd, 0.4, 0.8, sd * 0.5); a.rotation.y = -sd * 0.6; }
      else { antenna(k, Hd, k.mat(dark), 'lep', 0.4, 0.9, [2.6, 3.4, 1.0, 5.4, 6.4, 2.2], 0.14, sd); k.sphere(0.4, k.mat(dark), Hd, 5.8, 7.3, sd * 2.8); }
    }
    const lm = k.mat(shade(body, 0.3), { rough: 0.7 });
    const legs = legs6(k, B, lm, 'lep', [[1.6, -1, [2.6, -2.2, 2], [3.4, gy + 7.5, 2.6]], [0.6, -1.2, [0.6, -2.4, 2.6], [0.2, gy + 7.5, 3.4]], [-0.4, -1, [-1.8, -2.2, 2.4], [-3.2, gy + 7.5, 3]]], 0.22);
    const W1 = moth ? lepWing('moth1:' + wc, -7, 4.5, 11, [0.6, 0.02, 0.85, 0.35, 1.0, 0.98, 0.65, 0.95, 0.15, 0.75, 0.0, 0.35, 0.3, 0.05], mothPaint(wc, true))
      : lepWing('bfly1:' + wc, -5, 9, 13, [0.32, 0.02, 0.55, 0.4, 0.98, 0.97, 0.72, 0.99, 0.3, 0.78, 0.0, 0.42, 0.12, 0.08], butterflyPaint(wc, true));
    const W2 = moth ? lepWing('moth2:' + wc, -8, 2, 8.5, [0.75, 0.03, 0.95, 0.4, 0.75, 0.95, 0.3, 0.98, 0.02, 0.6, 0.15, 0.15], mothPaint(shade(wc, -0.1), false))
      : lepWing('bfly2:' + wc, -9, 3, 9.5, [0.72, 0.02, 0.9, 0.45, 0.7, 0.98, 0.3, 0.96, 0.03, 0.6, 0.1, 0.25, 0.4, 0.04], butterflyPaint(wc, false));
    const m1 = tmat(k, '#ffffff', W1.t, { rough: 0.85, side: 'double', cut: 1 }), m2 = tmat(k, '#ffffff', W2.t, { rough: 0.85, side: 'double', cut: 1 });
    const ws = [];
    for (const sd of [1, -1]) { ws.push(insectWing(k, B, 0.8, 1.2, sd, '', W1, m1)); const h = insectWing(k, B, 0.2, 1.0, sd, '', W2, m2); h.hind = true; ws.push(h); }
    return (e, t) => {
      animLegs(legs, e, t, 0.2);
      const fly = e.flying || e.held || (!e.grounded && !e.ko);
      for (const J of ws) {
        let elev, sw = 0;
        if (fly) { const f = Math.sin(t * (moth ? 16 : 11) + e.seed + (J.hind ? 0.25 : 0)); elev = 0.75 + 0.75 * f; }
        else if (moth) { elev = 0.32; sw = J.hind ? 0.9 : 0.75; }
        else elev = 1.42 - Math.max(0, Math.sin(t * 0.7 + e.seed)) ** 6 * 1.0;   // closed upright, opening now and then to bask
        J.rotation.set(-J.sd * elev, -J.sd * sw, 0);
      }
      B.position.y = fly ? -6 + Math.sin(t * 11 + e.seed) * 0.6 : -7.5;
    };
  };
  BUGS.butterfly = lep(false); BUGS.moth = lep(true);
  BUGS.dragonfly = (e, k, G) => {
    const body = k.col('body'), gy = -7, A = C3(body), Dk = C3(shade(body, 0.55)), Lt = C3(mix(body, '#9fe6ff', 0.35));
    k.mesh(loftG('drgabd:' + body, 22, 8, u => 0.55 + 0.6 * (1 - u) * 0 + (u < 0.85 ? 0.75 + 0.15 * Math.sin(u * 40) * 0.2 : 0.9 + (u - 0.85) * 3), null, (u, ca, sa, c) => { c.copy(A).lerp(Lt, sstep(0.2, 0.9, ca) * 0.5); if (Math.sin(u * 50) > 0.75) c.lerp(Dk, 0.85); }, [-17, 0.4, 0, -11, 0.1, 0, -5, -0.1, 0, -0.8, 0.2, 0]), vmat(k, { rough: 0.35, metal: 0.35 }), G);
    k.sphere([2.4, 2.2, 1.9], k.mat(mix(body, '#5a3a1a', 0.35), { rough: 0.5, metal: 0.2 }), G, 0.9, 0.3, 0);
    const Hd = k.group(G, 4.0, 0.6, 0);
    k.sphere([1.2, 1.4, 1.5], k.mat(dark), Hd);
    const em = glossy(k, mix(body, '#203a50', 0.45));
    for (const sd of [1, -1]) k.sphere([1.5, 1.7, 1.45], em, Hd, 0.5, 0.4, sd * 1.05);
    const lm = k.mat(dark, { rough: 0.6 });
    const legs = legs6(k, G, lm, 'drg', [[1.8, -1.2, [3.0, -2.4, 1.8], [3.4, gy, 2.6]], [1.0, -1.4, [1.2, -2.6, 2.2], [0.6, gy, 3.2]], [0.2, -1.3, [-1, -2.4, 2], [-1.8, gy, 3]]], 0.22);
    const W1 = wingPlane('drg1', -1.8, 1.6, 14, ovalWing(0.5, 0.5, 0.46, 0.49, 0), (c, W, H, F) => WINGS.clear(c, W, H, F, true));
    const wm = tmat(k, '#ffffff', W1.t, { opacity: 0.55, side: 'double', rough: 0.2 });
    const ws = [];
    for (const sd of [1, -1]) { const a = insectWing(k, G, 1.6, 2.0, sd, '', W1, wm); a.rotation.order = 'YXZ'; const b = insectWing(k, G, 0.0, 2.0, sd, '', W1, wm); b.hind = true; ws.push(a, b); }
    return (e, t) => {
      animLegs(legs, e, t, 0.15);
      const fly = e.flying || e.held || (!e.grounded && !e.ko);
      for (const J of ws) {
        const f = fly ? Math.sin(t * 38 + e.seed + (J.hind ? 1.6 : 0)) : 0;
        J.rotation.set(-J.sd * (0.32 + f * 0.45), -J.sd * (J.hind ? -0.32 : 0.18), 0);
      }
    };
  };
  BUGS.ant = (e, k, G) => {
    const body = k.col('body'), gy = -5, m = k.mat(body, { rough: 0.32, metal: 0.12 });
    k.mesh(loftG('antgas', 12, 12, u => 3.4 * Math.sqrt(Math.max(0, Math.sin(u * PI))), u => 2.9 * Math.sqrt(Math.max(0, Math.sin(u * PI))), null, [-11.5, 0.6, 0, -9, 1.4, 0, -5.6, 1.2, 0, -3.2, 0.6, 0]), m, G);
    k.sphere([0.9, 1.1, 0.8], m, G, -2.8, 0.7, 0);
    k.mesh(loftG('antthx', 10, 10, u => 1.6 * Math.sqrt(Math.max(0, Math.sin(u * PI))) + 0.4, u => 1.4 * Math.sqrt(Math.max(0, Math.sin(u * PI))) + 0.3, null, [-2.2, 0.9, 0, 0, 1.6, 0, 2.2, 1.2, 0, 3.2, 1.6, 0]), m, G);
    const Hd = k.group(G, 5.4, 2.0, 0);
    k.sphere([2.2, 2.3, 2.0], m, Hd);
    for (const sd of [1, -1]) {
      k.sphere([0.55, 0.75, 0.5], glossy(k, '#120a06'), Hd, 0.9, 0.5, sd * 1.65);
      antenna(k, Hd, m, 'ant', 1, 1.6, [0.4, 3.2, 0.6, 3.6, 4.2, 1.6], 0.22, sd);
      const md = k.cone(0.45, 1.8, m, Hd, 2.4, -1.2, sd * 0.6, 6); md.rotation.set(0, 0, -2.2); md.rotation.y = sd * 0.5;
    }
    const legs = legs6(k, G, k.mat(shade(body, 0.1), { rough: 0.4 }), 'ant', [[1.6, 0.6, [3.2, 2.4, 3], [5.2, gy, 4]], [0.4, 0.4, [0.2, 2.4, 3.6], [-0.6, gy, 5]], [-0.8, 0.5, [-3.2, 2.2, 3.4], [-5.8, gy, 4.6]]], 0.32);
    return (e, t) => { animLegs(legs, e, t, 0.35, 3); };
  };
  // ladybug & beetle: a domed shell (spots and the seam painted on), small head, legs mostly underneath
  const domeBug = lady => (e, k, G) => {
    const body = k.col('body'), gy = -6, A = C3(body), Dk = C3('#14100c'), Hi = C3(mix(body, '#fff', 0.12));
    const spots = [[0.45, 0.35], [-0.2, 0.55], [0.05, 0.25], [-0.55, 0.3], [0.4, 0.8], [-0.45, 0.75]];   // (x, z) on the unit dome
    const dg = geo('dome:' + body + lady, () => paintGeo(new T.SphereGeometry(1, 56, 22, 0, TAU, 0, PI / 2), (x, y, z, c) => {
      c.copy(A).lerp(Hi, sstep(0.7, 1, y) * 0.25);
      if (x < 0.86) c.lerp(Dk, sstep(0.05, 0.02, Math.abs(z)));
      if (lady) for (const s of spots) for (const sz of [1, -1]) { const d = Math.hypot(x - s[0], z - sz * s[1] * 0.85); c.lerp(Dk, sstep(0.19, 0.15, d)); }
    }));
    const dm = k.mesh(dg, vmat(k, { rough: lady ? 0.22 : 0.25, metal: lady ? 0 : 0.45 }), G, -1, -3.6, 0); dm.scale.set(lady ? 7.8 : 8.6, lady ? 6.4 : 5.6, lady ? 6.6 : 5.8);
    k.sphere([7.6, 1.2, 6.2], k.mat(shade(body, 0.75), { rough: 0.6 }), G, -1, -3.8, 0);
    const pm = k.mat(lady ? '#15110d' : shade(body, 0.2), { rough: 0.3, metal: lady ? 0 : 0.4 });
    const pr = k.sphere([2.6, 3.0, 4.0], pm, G, 5.4, -3.4, 0); pr.scale.y = 2.8;
    if (lady) for (const sd of [1, -1]) k.sphere([1.2, 1.2, 1.0], k.mat('#f3efe4', { rough: 0.4 }), G, 6.2, -2.2, sd * 2.4);
    const Hd = k.group(G, 7.6, -3.6, 0); k.sphere([1.6, 1.6, 2.2], k.mat('#15110d', { rough: 0.4 }), Hd);
    for (const sd of [1, -1]) { k.sphere([0.5, 0.6, 0.45], glossy(k, '#050403'), Hd, 0.9, 0.5, sd * 1.4); antenna(k, Hd, k.mat(dark), 'lady', 1.2, 0.5, [1.2, 1.2, 0.8, 2.2, 1.8, 1.4], 0.14, sd); }
    if (!lady) for (const sd of [1, -1]) { const md = k.cone(0.4, 1.8, pm, Hd, 1.8, -0.6, sd * 0.7, 6); md.rotation.z = -1.9; }
    const legs = legs6(k, G, k.mat('#15110d', { rough: 0.5 }), 'lady', [[3.6, -4.2, [5, -3.6, 4.6], [6, gy, 5.2]], [0.8, -4.4, [1, -3.6, 5.2], [0.6, gy, 6.4]], [-2.4, -4.4, [-3.6, -3.8, 5], [-5, gy, 6]]], 0.34);
    return (e, t) => animLegs(legs, e, t, 0.25, 3);
  };
  BUGS.ladybug = domeBug(true); BUGS.beetle = domeBug(false);
  BUGS.spider = (e, k, G) => {
    const body = k.col('body'), gy = -9, A = C3(body), Lt = C3(mix(body, '#c8a070', 0.35)), Dk = C3(shade(body, 0.45));
    const hairy = k.mat(body, { rough: 1 });
    const abdG = geo('spabd:' + body, () => paintGeo(new T.SphereGeometry(1, 22, 16), (x, y, z, c) => { c.copy(A); if (y > 0.2 && Math.abs(z) < 0.18 + 0.1 * Math.sin(x * 12)) c.lerp(Lt, 0.6); if (y > 0.3 && Math.abs(Math.abs(z) - 0.45) < 0.08 && x < 0.3) c.lerp(Lt, 0.5); c.lerp(Dk, sstep(0, -0.8, y) * 0.5); }));
    const ab = k.mesh(abdG, vmat(k, { rough: 1 }), G, -4.6, -1.2, 0); ab.scale.set(6.6, 5.6, 5.4);
    const ce = k.sphere([4.0, 2.6, 3.4], hairy, G, 3.4, -2.6, 0);
    const em = glossy(k, '#0a0808');
    k.sphere(0.75, em, G, 6.9, -1.4, 0.7); k.sphere(0.75, em, G, 6.9, -1.4, -0.7);
    for (const sd of [1, -1]) { k.sphere(0.42, em, G, 6.4, -0.9, sd * 1.55); k.sphere(0.36, em, G, 5.6, -0.6, sd * 1.25); }
    for (const sd of [1, -1]) { const fg = k.sphere([1.0, 1.5, 0.75], k.mat(shade(body, 0.25), { rough: 0.6 }), G, 7.1, -3.6, sd * 0.85); fg.rotation.z = -0.3; }
    const lc = (u, ca, sa, c) => { c.copy(A).lerp(Lt, (Math.abs(u - 0.36) < 0.035 || Math.abs(u - 0.62) < 0.03) ? 0.7 : 0); };
    const lm = vmat(k, { rough: 1 }), legs = [];
    const spec = [[5.2, [5, 6, 6], [10, gy + 2.6, 9]], [4.0, [1.6, 7, 7.5], [3.6, gy + 2.6, 12]], [2.8, [-1.8, 6.6, 7.2], [-4.2, gy + 2.6, 11.6]], [1.8, [-4.4, 5.6, 6], [-10.4, gy + 2.6, 8.6]]];
    spec.forEach((L, i) => { for (const sd of [1, -1]) { const h = bugLeg(k, G, lm, 'sp' + i + body, L[0], -2.4, sd, L[1], L[2], 0.62, lc); h.i = i; h.grp = (i + (sd > 0 ? 0 : 1)) & 1; legs.push(h); } });
    // pedipalps
    for (const sd of [1, -1]) bugLeg(k, G, hairy, 'palp', 6.4, -3.2, sd, [2.2, 0.6, 1.1], [3.4, -2.2, 1.4], 0.42);
    return (e, t) => {
      animLegs(legs, e, t, 0.22, 2.4);
      const threat = e.mood === 'angry' || e.lungeT > 0;
      for (const h of legs) if (h.i === 0) { h.rotation.z = threat ? 0.7 + Math.sin(t * 9) * 0.1 : 0; }
      ab.position.y = -1.2 + Math.sin(t * 2 + e.seed) * 0.15;
    };
  };
  BUGS.scorpion = (e, k, G) => {
    const body = k.col('body'), gy = -8, A = C3(body), Dk = C3(shade(body, 0.3)), Lt = C3(mix(body, '#fff', 0.2));
    const segc = (u, ca, sa, c) => { c.copy(A).lerp(Lt, sstep(0.3, 1, ca) * 0.3); if (Math.sin(u * 40) > 0.8) c.lerp(Dk, 0.6); };
    k.mesh(loftG('scbody:' + body, 18, 12, u => 1.2 + 2.3 * Math.pow(Math.sin(u * PI), 0.5), u => 1.6 + 4.2 * Math.pow(Math.sin(u * PI), 0.6), segc, [-10, -4.8, 0, -5, -4.4, 0, 0, -4.2, 0, 4.5, -4.3, 0, 7, -4.6, 0]), vmat(k, { rough: 0.35 }), G);
    const em = glossy(k, '#0a0806');
    k.sphere(0.5, em, G, 5.4, -2.4, 0.5); k.sphere(0.5, em, G, 5.4, -2.4, -0.5);
    const tail = new Loft(30, 10, u => (u < 0.92 ? 2.3 - 0.7 * u : 1.5) * (0.82 + 0.18 * Math.abs(Math.sin(u * 5 * PI))), null, segc, [0, 0, 1]); k.own.push(tail);
    k.mesh(tail, vmat(k, { rough: 0.35 }), G);
    const tel = k.group(G); k.sphere([2.4, 1.8, 1.8], k.mat(k.col('telson'), { rough: 0.3 }), tel, 1.2, 0, 0);
    const sg = k.cone(0.7, 3.4, k.mat(k.col('stinger'), { rough: 0.3 }), tel, 3.6, -1.4, 0, 8); sg.rotation.z = -2.3;
    // pincers
    const pm = k.mat(shade(body, 0.08), { rough: 0.35 }), claws = [];
    for (const sd of [1, -1]) {
      bugLeg(k, G, pm, 'scarm', 6, -4.2, sd, [3.5, 1.6, 2.8], [7.2, 1.2, 3.4], 1.05);
      const cl = k.group(G, 15, -3.0, sd * 4.0), palm = k.sphere([3.4, 2.0, 1.8], pm, cl);
      const fx = k.cone(0.85, 4.2, pm, cl, 4.6, 0.5, 0, 8); fx.rotation.z = -PI / 2 + 0.12;
      const dj = k.group(cl, 2.4, -0.4, 0), dc = k.cone(0.7, 3.8, pm, dj, 1.9, 0, 0, 8); dc.rotation.z = -PI / 2 - 0.1;
      claws.push({ dj, sd });
    }
    const legs = [];
    for (let i = 0; i < 4; i++) for (const sd of [1, -1]) { const h = bugLeg(k, G, pm, 'scl' + i, 3 - i * 2.5, -4.6, sd, [1.8 - i * 1.2, 2.6, 4.6], [3 - i * 2.8, gy + 4.6, 7.4], 0.6); h.i = i; h.grp = (i + (sd > 0 ? 0 : 1)) & 1; legs.push(h); }
    const path = new Array(18).fill(0), tp = new T.Vector3(), tt = new T.Vector3();
    return (e, t) => {
      animLegs(legs, e, t, 0.25, 3);
      const lk = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * PI) : 0, sw = Math.sin(t * 2.2 + e.seed) * 0.6, ang = e.mood === 'angry' ? 1 : 0;
      const P = [[-9, -4.4], [-12.6, -2.4], [-14.4, 1.8], [-13.4, 6.2 + ang], [-10 + lk * 6, 8.4 + ang - lk * 1.5], [-6.4 + lk * 9 + sw, 7.4 + ang - lk * 4]];
      for (let i = 0; i < 6; i++) { path[i * 3] = P[i][0]; path[i * 3 + 1] = P[i][1]; path[i * 3 + 2] = 0; }
      tail.setPath(path); tail.end(26, tp, tt);
      tel.position.copy(tp); tel.rotation.z = Math.atan2(tt.y, tt.x);
      for (const c of claws) c.dj.rotation.z = -(e.mood === 'angry' || lk ? 0.35 + Math.sin(t * 10 + c.sd) * 0.3 : 0.08);
    };
  };
  BUGS.snail = (e, k, G) => {
    const body = k.col('body'), shell = k.col('shell'), gy = -9;
    const sk = vmat(k, { rough: 0.3 }), A = C3(body), Dk = C3(shade(body, 0.25));
    const footG = loftG('snailfoot:' + body, 20, 12, u => 0.4 + 2.6 * Math.pow(Math.sin(Math.min(1, u * 1.05) * PI * 0.95), 0.5), u => 0.6 + 3.2 * Math.pow(Math.sin(Math.min(1, u * 1.05) * PI * 0.95), 0.5),
      (u, ca, sa, c) => { c.copy(A).lerp(Dk, (noise(u * 30, sa * 4) > 0.6 ? 0.35 : 0) + sstep(0, -0.8, ca) * 0.2); }, [-11, gy + 1.0, 0, -4, gy + 1.8, 0, 3, gy + 2.2, 0, 8, gy + 3.2, 0, 10.5, gy + 5.4, 0, 11.6, gy + 7.6, 0]);
    k.mesh(footG, sk, G);
    const S = C3(shell), Sd = C3(shade(shell, 0.45)), Sl = C3(mix(shell, '#f0dcb0', 0.45));
    // the shell: a tube winding inward on a flattened spiral, growth lines and a dark band
    const turns = 2.6, sh = geo('snailshell:' + shell, () => {
      const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30, a = u * turns * TAU, r = 7.2 * Math.exp(-(1 - u) * 0 - u * 1.25) * (1 - u * 0.25); pts.push(-Math.cos(a) * r * 0.9 * (1 - u * 0.8) + 0, Math.sin(a) * r * (1 - u * 0.8), u * 1.6); }
      const L = new Loft(90, 12, u => 0.5 + 4.6 * Math.pow(1 - u, 1.4), null, (u, ca, sa, c) => { c.copy(S).lerp(Sl, 0.5 + 0.5 * Math.sin(u * 140)); if (Math.abs(ca - 0.2) < 0.25) c.lerp(Sd, 0.7); }, [0, 0, 1]);
      L.setPath(pts); return L;
    });
    const shM = k.mesh(sh, vmat(k, { rough: 0.35 }), G, 0.4, gy + 8.9, 0); shM.scale.setScalar(0.74);
    shM.rotation.y = PI;   // the opening faces the head end
    const Hd = k.group(G, 11.6, gy + 7.6, 0), stalks = [];
    for (const sd of [1, -1]) {
      const st = k.group(Hd, 0, 0.6, sd * 0.9);
      k.cyl(0.32, 0.5, 5, sk, st, 0, 2.5, 0, 6); k.sphere(0.65, glossy(k, '#1c1410'), st, 0, 5.1, 0);
      st.rotation.set(sd * 0.3, 0, -0.45); stalks.push(st);
      const lt = k.cyl(0.25, 0.4, 2.0, sk, Hd, 1.4, -0.8, sd * 1.1, 6); lt.rotation.set(sd * 0.4, 0, -1.3);
    }
    return (e, t) => {
      const sl = e.moving ? Math.sin(t * 3) * 0.04 : 0; G.scale.x = (k.tpl.k || 1) * (1 + sl);
      for (const st of stalks) st.rotation.z = -0.45 + Math.sin(t * 1.6 + st.position.z) * 0.15 - (e.held || e.mood === 'scared' ? 0.9 : 0);
    };
  };
  // a soft segmented crawler (worm, caterpillar): a loft that ripples along its length
  function crawler(e, k, G, o) {
    const g = new Loft(o.n, 10, o.ry, o.rz, o.col); k.own.push(g); k.mesh(g, vmat(k, o.mat), G);
    const m = o.pts, path = new Array(m * 3).fill(0); let tick = 0;
    const set = (e, t) => {
      const ph = (e.phase || 0) * 2 + t * (e.moving ? 3 : 0.8);
      for (let i = 0; i < m; i++) { const u = i / (m - 1); path[i * 3] = o.x0 + (o.x1 - o.x0) * u; path[i * 3 + 1] = o.y + o.wave(u, ph, e, t); path[i * 3 + 2] = Math.sin(u * 3 + t * 0.7) * o.side; }
      g.setPath(path);
    };
    set(e, 0);
    return { g, set: (e, t) => { if ((tick++ & 1) === 0) set(e, t); } };
  }
  BUGS.worm = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Dk = C3(shade(body, 0.18)), Cl = C3(mix(body, '#c0604a', 0.4));
    const c = crawler(e, k, G, { n: 40, pts: 9, x0: -12, x1: 13, y: -2.4, side: 0.8, mat: { rough: 0.25 },
      ry: u => 1.6 * Math.pow(Math.sin(clamp(u, 0.01, 0.99) * PI), 0.25), rz: u => 1.7 * Math.pow(Math.sin(clamp(u, 0.01, 0.99) * PI), 0.25),
      col: (u, ca, sa, cc) => { cc.copy(A).lerp(Dk, 0.5 + 0.5 * Math.sin(u * 120)); if (u > 0.6 && u < 0.7) cc.lerp(Cl, 0.6); cc.lerp(Dk, sstep(0.2, 1, ca) * 0.25); },
      wave: (u, ph) => Math.max(0, Math.sin(u * 5 - ph)) * 1.6 });
    return c.set;
  };
  BUGS.caterpillar = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Y = C3('#f2d23a'), Dk = C3('#15120e'), Lt = C3(mix(body, '#fff', 0.3));
    const c = crawler(e, k, G, { n: 48, pts: 9, x0: -13, x1: 9.5, y: -1.8, side: 0.5, mat: { rough: 0.55 },
      ry: u => (2.6 + 0.6 * Math.abs(Math.sin(u * 8 * PI))) * Math.pow(Math.sin(clamp(u * 0.92 + 0.04, 0, 1) * PI), 0.3), rz: u => (2.8 + 0.6 * Math.abs(Math.sin(u * 8 * PI))) * Math.pow(Math.sin(clamp(u * 0.92 + 0.04, 0, 1) * PI), 0.3),
      col: (u, ca, sa, cc) => { cc.copy(A).lerp(Lt, sstep(-0.2, -0.9, ca) * 0.6); const seg = (u * 8) % 1; if (Math.abs(seg - 0.5) < 0.08 && ca > -0.2) cc.copy(Dk); if (Math.abs(seg - 0.5) < 0.18 && Math.abs(seg - 0.5) > 0.08 && ca > 0.3) cc.lerp(Y, 0.8); },
      wave: (u, ph) => Math.max(0, Math.sin(u * 4 - ph)) * 1.4 });
    const Hd = k.group(G, 11.4, -1.2, 0); k.sphere([2.4, 2.6, 2.5], k.mat(mix(body, '#3a2a10', 0.25), { rough: 0.5 }), Hd);
    for (const sd of [1, -1]) { k.sphere(0.4, glossy(k, '#0a0806'), Hd, 1.6, 0.2, sd * 1.4); const an = k.cyl(0.15, 0.25, 2.2, k.mat(dark), Hd, 0.6, 2.6, sd * 1.0, 5); an.rotation.set(sd * 0.3, 0, -0.3); }
    const lm = k.mat(mix(body, '#2a2a1a', 0.5), { rough: 0.6 });
    for (let i = 0; i < 6; i++) for (const sd of [1, -1]) { const x = -10 + i * (i < 4 ? 3.1 : 3.4) + (i >= 4 ? 3 : 0); k.cyl(0.5, 0.7, 1.6, lm, G, x, -4.2, sd * 1.6, 6); }
    return (e, t) => { c.set(e, t); Hd.position.y = -1.2 + Math.max(0, Math.sin(4 - ((e.phase || 0) * 2 + t * (e.moving ? 3 : 0.8)))) * 0.6; };
  };
  BUGS.grasshopper = (e, k, G) => {
    const body = k.col('body'), gy = -7, A = C3(body), Dk = C3(shade(body, 0.3)), Lt = C3(mix(body, '#f0f0a0', 0.4));
    const bm = vmat(k, { rough: 0.5 });
    k.mesh(loftG('ghabd:' + body, 18, 10, u => 0.7 + 2.0 * Math.pow(Math.sin(Math.min(1, u * 1.08) * PI * 0.93), 0.6), null, (u, ca, sa, c) => { c.copy(A).lerp(Lt, sstep(-0.1, -0.9, ca) * 0.6); if (Math.sin(u * 46) > 0.7) c.lerp(Dk, 0.4); }, [-13, -1.0, 0, -8, -0.4, 0, -3, 0, 0, 1.5, 0.5, 0]), bm, G);
    const pm = k.mat(body, { rough: 0.45 });
    k.mesh(loftG('ghthx:' + body, 10, 10, u => 2.2 + 0.4 * u, u => 2.0 + 0.3 * u, null, [0.8, 0.6, 0, 3.0, 1.2, 0, 5.4, 1.8, 0]), pm, G);
    const Hd = k.group(G, 7.4, 2.4, 0);
    const hd = k.sphere([2.0, 2.8, 2.0], pm, Hd); hd.rotation.z = -0.35;
    for (const sd of [1, -1]) { k.sphere([0.9, 1.25, 0.6], glossy(k, mix(body, '#3a2a10', 0.6)), Hd, 0.6, 0.9, sd * 1.5); antenna(k, Hd, pm, 'gh', 0.8, 2.4, [3, 3, 0.6, 7, 5.4, 1.2, 11, 6.2, 1.8], 0.18, sd); }
    // folded wings (leathery tegmina) along the back
    const wg = k.mat(shade(body, 0.12), { rough: 0.6 });
    for (const sd of [1, -1]) { const w = k.mesh(xg('teg', [0, 0.6, -6, 1.2, -12, 0.4, -13.5, -0.6, -12, -1.2, -5, -0.6, 0, -0.6], 0.4, 0.15, true), wg, G, 2, 2.2, sd * 1.6); w.rotation.set(sd * 0.5, 0, -0.08); }
    const lm = k.mat(shade(body, 0.1), { rough: 0.5 });
    const legs = legs6(k, G, lm, 'gh', [[4.6, -0.8, [5.8, -2.6, 2.4], [6.6, gy, 3.4]], [2.6, -0.8, [2.6, -3, 2.8], [2.2, gy, 4]], [9, 9, [0, 0, 0], [0, 0, 0]]], 0.3).filter(h => h.i < 2);
    // hind jumping legs: a thick femur up and back, a thin tibia down to the ground
    const hind = [];
    for (const sd of [1, -1]) {
      const hip = k.group(G, 0.6, -0.2, sd * 2.2), fem = k.group(hip);
      const fg = loftG('ghfem', 10, 8, u => 1.2 * Math.sin(Math.min(1, u * 1.05 + 0.05) * PI * 0.9) + 0.3, u => 0.8 * Math.sin(Math.min(1, u * 1.05 + 0.05) * PI * 0.9) + 0.2, null, [0, 0, 0, -4.5, 2.6, 0, -9.4, 4.6, 0]);
      k.mesh(fg, pm, fem);
      const tib = k.group(fem, -9.4, 4.6, 0.3); k.mesh(loftG('ghtib', 8, 5, u => 0.35 - 0.15 * u, null, null, [0, 0, 0, -0.8, -5.5, 0, -1.5, -11, 0]), lm, tib);
      hind.push({ fem, tib, sd });
    }
    return (e, t) => {
      animLegs(legs, e, t, 0.25);
      const air = !e.grounded && !e.held;
      for (const h of hind) { h.fem.rotation.z = air ? -0.35 : 0; h.tib.rotation.z = air ? -1.3 : 0.1 + (e.held ? Math.sin(t * 12 + h.sd) * 0.4 : 0); }
    };
  };

  // ======================= SEA LIFE =======================
  M3.kinds.fish = function (e, k, tpl) {
    const G = k.group(k.root); G.scale.setScalar(tpl.k || 1);
    return (SEA[tpl.sub] || SEA.fish)(e, k, G, tpl);
  };
  const SEA = {};
  // a fish body that swims: a loft bending side to side (fish) or up and down (whales and dolphins)
  function swimmer(k, G, mat, o) {
    const g = new Loft(o.n || 22, o.radial || 14, o.ry, o.rz, o.col); k.own.push(g); k.mesh(g, mat, G);
    const xs = o.xs, m = xs.length, path = new Array(m * 3).fill(0), tp = new T.Vector3(), tt = new T.Vector3();
    const set = (e, t) => {
      const sp = e.moving || !e.grounded ? 1.4 : 1, w = t * (o.rate || 6) * sp + e.seed;
      for (let i = 0; i < m; i++) { const u = i / (m - 1), a = o.amp * Math.pow(1 - u, 1.6) * Math.sin(w - u * 2.4); path[i * 3] = xs[i]; path[i * 3 + 1] = o.ys[i] + (o.vertical ? a : 0); path[i * 3 + 2] = o.vertical ? 0 : a; }
      g.setPath(path); g.end(0, tp, tt);
      if (o.tail) { o.tail.position.copy(tp); if (o.vertical) o.tail.rotation.z = Math.atan2(tt.y, tt.x) + Math.cos(w) * 0.25; else o.tail.rotation.y = Math.atan2(-tt.z, tt.x) - Math.cos(w) * 0.35; }
    };
    return set;
  }
  const finMat = (k, c, op) => k.mat(c, { rough: 0.45, side: 'double', opacity: op || 0.88 });
  function fin(k, parent, key, pts, depth, m, x, y, z) { return k.mesh(xg('fin:' + key, pts, depth || 0.5, (depth || 0.5) * 0.3, true), m, parent, x, y, z); }
  const fishEye = (k, par, r, x, y, z, iris, lid) => { for (const sd of [1, -1]) k.eye(r, par, x, y, sd * z, { dir: [0.25, 0.05, sd], iris: iris || '#c9a23a', white: '#d8cfa8', lid: lid || false }); };
  SEA.fish = SEA.goldfish = SEA.clownfish = (e, k, G, tpl) => {
    const kind = tpl.sub, body = k.col('body'), A = C3(body);
    const back = C3(kind === 'fish' ? shade(body, 0.4) : shade(body, 0.12)), side = C3(kind === 'fish' ? mix(body, '#e6eef2', 0.55) : body), bel = C3(kind === 'fish' ? '#f4f6f2' : mix(body, '#ffe9a8', 0.55)), Wt = C3('#f7f5ee'), Bk = C3('#141210'), Gl = C3(shade(body, 0.45));
    const ry = u => u < 0.6 ? 1.4 + 5.3 * Math.pow(Math.sin(u / 0.6 * PI / 2), 1.2) : 6.7 * Math.sqrt(Math.max(0, 1 - ((u - 0.6) / 0.4) ** 2));
    const col = (u, ca, sa, c) => {
      c.copy(side).lerp(back, sstep(0.1, 0.8, ca)).lerp(bel, sstep(-0.2, -0.8, ca));
      if (kind === 'fish' && Math.abs(ca - 0.12) < 0.06 && u > 0.1 && u < 0.85) c.lerp(Gl, 0.5);
      if (kind === 'fish' && ca > 0.2 && noise(u * 26, sa * 5) > 0.72) c.lerp(Gl, 0.7);
      if (Math.abs(u - 0.76) < 0.018 && Math.abs(sa) > 0.3) c.lerp(Gl, 0.8);   // gill cover edge
      if (kind === 'clownfish') for (const b of [0.78, 0.5, 0.12]) { const d = Math.abs(u - b); if (d < 0.05) c.copy(Wt); else if (d < 0.075) c.copy(Bk); }
    };
    const fm = finMat(k, kind === 'fish' ? mix(body, '#a8b8c0', 0.4) : body, kind === 'goldfish' ? 0.78 : 0.9);
    const tail = k.group(G);
    if (kind === 'goldfish') { for (const sd of [1, -1]) { const m = fin(k, tail, 'gold', [0.5, 1.5, -4, 5, -9, 9.5, -11, 7, -9.5, 3, -7, 0.5, -9.5, -3, -11, -7, -9, -9.5, -4, -5, 0.5, -1.5], 0.4, fm); m.rotation.y = sd * 0.3; } }
    else if (kind === 'clownfish') fin(k, tail, 'clown', [0.5, 1.5, -3, 3.5, -5.5, 3.8, -6.3, 1.5, -6.3, -1.5, -5.5, -3.8, -3, -3.5, 0.5, -1.5], 0.5, fm);
    else fin(k, tail, 'fork', [0.5, 1.6, -3, 3.4, -7.2, 6.3, -6.4, 2.6, -4.6, 0, -6.4, -2.6, -7.2, -6.3, -3, -3.4, 0.5, -1.6], 0.5, fm);
    const mat = vmat(k, { rough: kind === 'goldfish' ? 0.3 : 0.35, metal: kind === 'clownfish' ? 0 : 0.25 });
    const swim = swimmer(k, G, mat, { ry, rz: u => ry(u) * (0.42 + 0.18 * u), col, xs: [-10.5, -6, -1.5, 3, 7.5, 12], ys: [0.2, 0.2, 0, 0, -0.2, -0.6], amp: 2.0, tail });
    if (kind === 'clownfish') { fin(k, G, 'cd1', [-6, 0, -4, 3.4, -1, 4, 1, 2.2, 3, 3.6, 5, 2.6, 6, 0], 0.5, fm, 0, 5.4, 0); }
    else fin(k, G, kind === 'goldfish' ? 'gd' : 'd', kind === 'goldfish' ? [-5, 0, -3, 6, 1, 7, 4.5, 3, 5.5, 0] : [-5, 0, -3.5, 3.2, 1, 4.5, 4.5, 2.5, 5.5, 0], 0.45, fm, 0, 5.4, 0);
    fin(k, G, 'an', [-4, 0, -3, -3, 0, -2.6, 1.5, 0], 0.4, fm, -3.5, -4.2, 0);
    const pecs = [1, -1].map(sd => { const p = k.group(G, 4.2, -1.8, sd * 2.4); const m = fin(k, p, 'pec', [0, 0.8, -1.5, 1.2, -4.5, -0.8, -4.2, -2.6, -1.2, -1.2, 0, -0.6], 0.3, fm); p.rotation.y = sd * 0.5; p.sd = sd; return p; });
    for (const sd of [1, -1]) { const pv = fin(k, G, 'pel', [0, 0, -1, -2.6, -2.8, -3, -2, 0], 0.3, fm, 2, -5, sd * 1.2); pv.rotation.x = sd * 0.3; }
    fishEye(k, G, 1.6, 8.3, 1.5, 2.15, kind === 'goldfish' ? '#e0a020' : '#3a2a10', false);
    return (e, t) => { swim(e, t); for (const p of pecs) p.rotation.y = p.sd * (0.5 + Math.sin(t * 7 + e.seed) * 0.3); };
  };
  SEA.shark = (e, k, G) => {
    const body = k.col('body'), back = C3(shade(body, 0.12)), Bd = C3(body), Wt = C3('#eef0ee'), Gs = C3(shade(body, 0.55));
    const ry = u => u < 0.42 ? 2.0 + 7.4 * Math.pow(Math.sin(u / 0.42 * PI / 2), 1.1) : 9.4 * Math.pow(Math.max(0, 1 - ((u - 0.42) / 0.58) ** 2.1), 0.6) + 0.15;
    const gills = [0.6, 0.625, 0.65, 0.675, 0.7];
    const col = (u, ca, sa, c) => { c.copy(Bd).lerp(back, sstep(0.3, 1, ca)); c.lerp(Wt, sstep(-0.1, -0.3, ca + 0.06 * Math.sin(u * 30))); if (Math.abs(sa) > 0.45 && ca > -0.35 && ca < 0.5 && gills.some(g => Math.abs(u - g) < 0.009)) c.lerp(Gs, 0.85); };
    const mat = vmat(k, { rough: 0.5 });
    const fm = k.mat(shade(body, 0.06), { rough: 0.55 }), tail = k.group(G);
    fin(k, tail, 'sharkC', [1, 2.5, -3, 6, -10, 14.5, -8.6, 11, -6.5, 4, -6.8, 0, -6.5, -4, -9.5, -11, -10.4, -12.5, -3, -5, 1, -2.2], 1.2, fm);
    const swim = swimmer(k, G, mat, { n: 48, radial: 16, ry, rz: u => ry(u) * 0.82, col, xs: [-25, -14, -3, 8, 19, 31], ys: [1.4, 0.4, 0, 0.4, 1.8, 3.8], amp: 3.2, rate: 3.2, tail });
    fin(k, G, 'sharkD', [-8, 0, -4, 8, 1, 15, 2.2, 14.5, 4, 8, 8, 0], 1.4, fm, -1, 7.6, 0);
    fin(k, G, 'shark2', [-2.4, 0, -1.6, 2.6, 0.4, 2.8, 1.4, 0], 0.5, fm, -15.5, 3.2, 0);
    fin(k, G, 'shark3', [-2.4, 0, -1.6, -2.6, 0.4, -2.8, 1.4, 0], 0.5, fm, -15, -3.0, 0);
    const pecs = [1, -1].map(sd => { const p = k.group(G, 7, -5.2, sd * 6.2); fin(k, p, 'sharkP', [2, 0.8, 4.5, -0.6, 1.5, -5, -4, -14, -2.4, -6.5, -1.6, 0], 0.9, fm); p.rotation.set(sd * 0.55, 0, 0); p.sd = sd; return p; });
    // jaws: a rounded lower jaw under the snout drops to show the dark mouth and rows of teeth
    const mouth = k.sphere([7.5, 2.4, 4.6], k.mat('#3a1416', { rough: 0.8 }), G, 18.5, -3.6, 0);
    const tm = k.mat('#f4f0e4', { rough: 0.3 }), zig = []; for (let i = 0; i <= 12; i++) zig.push(i * 1.1, i & 1 ? 0 : -1.5); zig.push(13.2, 0.5, 0, 0.5);
    const teeth = [];
    for (const sd of [1, -1]) { const ut = k.mesh(xg('teeth', zig, 0.5, 0), tm, G, 12.4, -3.6, sd * 4.2); ut.rotation.set(0, sd * 0.2, 0.18); teeth.push(ut); }
    const Jw = k.group(G, 10.5, -5.0, 0);
    k.mesh(loftG('sharkJaw:' + body, 14, 12, u => 2.4 * (1 - 0.55 * u), u => 6.0 * (1 - 0.7 * u * u), null, [0, -0.6, 0, 6, -0.9, 0, 12, -0.2, 0, 15, 0.8, 0]), k.mat('#e8eae8', { rough: 0.55 }), Jw);
    for (const sd of [1, -1]) { const lt = k.mesh(xg('teeth', zig, 0.5, 0), tm, Jw, 14.2, 1.2, sd * 3.8); lt.rotation.set(0, -sd * 0.25, PI - 0.05); teeth.push(lt); }
    fishEye(k, G, 1.5, 19.5, 2.8, 5.2, '#0e0c0a', shade(body, 0.1));
    return (e, t) => {
      swim(e, t);
      const lk = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * PI) : 0, open = lk * 0.6 + (e.mood === 'angry' || e.held ? 0.16 + Math.sin(t * 6) * 0.05 : 0);
      Jw.rotation.z = -open; mouth.visible = open > 0.06; for (const tt of teeth) tt.visible = open > 0.06;
      for (const p of pecs) p.rotation.z = Math.sin(t * 2 + e.seed) * 0.08;
    };
  };
  SEA.whale = (e, k, G) => {
    const body = k.col('body'), back = C3(shade(body, 0.25)), Bd = C3(body), Wt = C3('#d8e0e6'), Pl = C3('#aab6c0');
    const ry = u => u < 0.58 ? 2.6 + 14.4 * Math.pow(Math.sin(u / 0.58 * PI / 2), 1.3) : 17 * Math.pow(Math.max(0, 1 - ((u - 0.58) / 0.42) ** 2.6), 0.5);
    const col = (u, ca, sa, c) => { c.copy(Bd).lerp(back, sstep(0.2, 1, ca)); const bl = sstep(-0.25, -0.55, ca); c.lerp(Wt, bl); if (u > 0.58 && ca < -0.3) c.lerp(Pl, (0.5 + 0.5 * Math.cos(Math.atan2(sa, ca) * 16)) * 0.8); if (noise(u * 40, sa * 6 + ca * 6) > 0.82 && ca > 0) c.lerp(Pl, 0.12); };
    const mat = vmat(k, { rough: 0.45 }), fm = k.mat(shade(body, 0.1), { rough: 0.5 });
    const tail = k.group(G); const fl = fin(k, tail, 'fluke', [2, 1.8, -4, 8, -11, 17, -14, 15, -12, 6, -9, 0, -12, -6, -14, -15, -11, -17, -4, -8, 2, -1.8], 1.4, fm); fl.rotation.x = -PI / 2;
    const swim = swimmer(k, G, mat, { n: 36, radial: 32, ry, rz: u => ry(u) * (0.6 + 0.3 * Math.min(1, u * 2)), col, xs: [-50, -28, -6, 16, 36, 56], ys: [3, 1.5, 0, 0, 0.5, 1.5], amp: 4, rate: 2.2, vertical: true, tail });
    fl.scale.setScalar(1.35);
    fin(k, G, 'wdors', [-4, 0, -2.5, 2.6, 0.6, 4.4, 1.6, 0], 1.2, fm, -27, 11.6, 0);
    const flip = [1, -1].map(sd => { const p = k.group(G, 22, -9, sd * 11.5); fin(k, p, 'wflip', [2, 1.5, 4, -1, 1, -6, -6, -19, -8, -19.5, -4, -8], 1.6, fm); p.rotation.set(sd * 0.95, 0, -0.55); p.sd = sd; return p; });
    for (const sd of [1, -1]) { const ml = k.mesh(loftG('wml2', 20, 5, () => 0.45, null, null, [33, -2.5, 0, 41, -5, 0, 48, -5.6, 0, 54.5, -3.4, 0]), k.mat('#1b2024', { rough: 0.7 }), G); ml.position.z = sd * 10.6; }
    k.sphere([1.6, 0.8, 2.4], k.mat('#1b2024', { rough: 0.6 }), G, 32, 15.8, 0);
    fishEye(k, G, 1.5, 37, -1.6, 12.6, '#1a120c', body);
    return (e, t) => { swim(e, t); for (const p of flip) p.rotation.z = -0.55 + Math.sin(t * 1.5 + e.seed) * 0.12; };
  };
  SEA.dolphin = (e, k, G) => {
    const body = k.col('body'), back = C3(shade(body, 0.3)), Bd = C3(body), Wt = C3('#e8edf0');
    const ry = u => u < 0.45 ? 2 + 8 * Math.pow(Math.sin(u / 0.45 * PI / 2), 1.1) : u < 0.78 ? 10 - 3.2 * sstep(0.45, 0.78, u) : u < 0.86 ? 6.8 - 4.6 * sstep(0.78, 0.86, u) : 2.2 * Math.pow(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2), 0.5) + 0.05;
    const col = (u, ca, sa, c) => { c.copy(Bd).lerp(back, sstep(0.35, 0.85, ca + 0.1 * Math.sin(u * 9))); c.lerp(Wt, sstep(-0.2, -0.55, ca - 0.15 * Math.sin(u * 7))); };
    const mat = vmat(k, { rough: 0.3 }), fm = k.mat(shade(body, 0.25), { rough: 0.4 });
    const tail = k.group(G); const fl = fin(k, tail, 'dfluke', [1.5, 1.2, -2.5, 4.5, -7, 9, -9, 8, -7.5, 3, -6, 0, -7.5, -3, -9, -8, -7, -9, -2.5, -4.5, 1.5, -1.2], 0.9, fm); fl.rotation.x = -PI / 2;
    const swim = swimmer(k, G, mat, { n: 40, radial: 16, ry, rz: u => ry(u) * 0.82, col, xs: [-22, -11, 0, 11, 22, 34], ys: [1.5, 0.5, 0, 0.5, 0.6, -1.8], amp: 2.4, rate: 3.4, vertical: true, tail });
    fin(k, G, 'ddors', [-5, 0, -3, 5, 2, 11, 3.2, 10.6, 3, 5, 6, 0], 1.0, fm, -3, 8.6, 0);
    for (const sd of [1, -1]) { const p = k.group(G, 10, -5.5, sd * 6.2); fin(k, p, 'dflip', [0, 1.5, 3, 0, 0, -4, -6, -9.5, -3, -4], 0.8, fm); p.rotation.set(sd * 0.6, 0, 0.1); }
    for (const sd of [1, -1]) { const ml = k.mesh(loftG('dsmile', 12, 5, () => 0.28, null, null, [33.4, -1.6, 0, 30, -1.2, 0, 26.5, -0.4, 0, 24.6, -0.6, 0]), k.mat('#2a3038', { rough: 0.6 }), G); ml.position.z = sd * 1.9; ml.scale.z = 1; }
    k.sphere([0.9, 0.4, 1.2], k.mat('#2a3038'), G, 13, 10.3, 0);
    fishEye(k, G, 1.25, 20.5, 2, 6.3, '#1a120c', body);
    return (e, t) => swim(e, t);
  };
  SEA.octopus = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Dk = C3(shade(body, 0.3)), Lt = C3(mix(body, '#fff', 0.45)), Pl = C3(mix(body, '#f6e6e0', 0.6));
    const F = k.group(G);   // turned to face the watcher
    const mg = geo('octmantle:' + body, () => paintGeo(new T.SphereGeometry(1, 26, 18), (x, y, z, c) => { c.copy(A).lerp(Dk, noise(x * 4 + 9, y * 4 + z * 4) * 0.5); c.lerp(Lt, sstep(0.6, 0.98, noise(x * 9, y * 9 + z * 7)) * 0.6); }));
    const man = k.mesh(mg, vmat(k, { rough: 0.4 }), F, -3.6, 11, 0); man.scale.set(9.5, 10.5, 8.6); man.rotation.z = 0.35;
    k.sphere([7.4, 6.2, 7.2], k.mat(body, { rough: 0.45 }), F, 0.6, 1.4, 0);
    for (const sd of [1, -1]) { k.sphere([2.4, 2.2, 2.0], k.mat(body, { rough: 0.45 }), F, 4.2, 4.4, sd * 4.2); k.eye(1.7, F, 5.2, 4.6, sd * 4.6, { dir: [0.7, 0.1, sd * 0.7], iris: '#d9a43a', white: '#efe2b0', lid: body }); }
    const arms = [], am = vmat(k, { rough: 0.35 });
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) / 8 * TAU, ox = Math.cos(a), oz = Math.sin(a), ref = [ox, 1, oz];
      const g = new Loft(18, 8, u => 3.0 * Math.pow(1 - u, 0.9) + 0.2, null, (u, ca, sa, c) => { c.copy(A); if (ca < -0.3) { c.copy(Pl); if (Math.sin(u * 60) > 0.3) c.lerp(Lt, 0.4); } }, ref); k.own.push(g);
      k.mesh(g, am, F); arms.push({ g, ox, oz, i, path: new Array(18).fill(0) });
    }
    let tick = 0;
    const setArms = (e, t) => {
      for (const ar of arms) {
        const q = t * 2.6 + ar.i * 1.3 + e.seed, w = Math.sin(q), w2 = Math.cos(q * 0.8), walk = e.moving ? Math.sin((e.phase || 0) * 3 + ar.i * 2) * 1.5 : 0, held = e.held ? 4 : 0;
        const P = ar.path, R = [5, 10.5 + w * 0.5, 14 + w2 * 1.2, 17.5 + w * 1.6, 21 + w2 * 1.8, 22.5 + w * 2], Y = [-1, -7.5 + held * 0.5, -13.5 + walk * 0.5 + held, -17.8 + Math.max(0, walk) + held * 1.5, -18.2 + held * 2, -15.8 - w2 * 1.5 + held * 2];
        for (let j = 0; j < 6; j++) { const sw = j > 2 ? Math.sin(q + j) * 1.2 : 0; P[j * 3] = ar.ox * R[j] - ar.oz * sw; P[j * 3 + 1] = Y[j]; P[j * 3 + 2] = ar.oz * R[j] * 0.85 + ar.ox * sw; }
        ar.g.setPath(P);
      }
    };
    setArms(e, 0);
    return (e, t) => {
      F.rotation.y += (-camSide(e) * 0.75 - F.rotation.y) * 0.1;
      man.rotation.z = 0.35 + Math.sin(t * 1.5 + e.seed) * 0.05; man.scale.y = 10.5 * (1 + Math.sin(t * 2.2) * 0.03);
      if ((tick++ & 1) === 0) setArms(e, t);
    };
  };
  SEA.crab = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Lt = C3(mix(body, '#ffd6b0', 0.5)), Dk = C3(shade(body, 0.3));
    const F = k.group(G);   // a crab walks sideways: its face (+z) always toward the watcher
    const cg = geo('crabshell:' + body, () => paintGeo(new T.SphereGeometry(1, 28, 16), (x, y, z, c) => { c.copy(A).lerp(Dk, sstep(0.4, 1, Math.abs(x)) * 0.3); c.lerp(Lt, sstep(-0.1, -0.6, y)); if (y > 0 && noise(x * 7, z * 7) > 0.68) c.lerp(Lt, 0.35); }));
    const sh = k.mesh(cg, vmat(k, { rough: 0.38 }), F, 0, -1.5, 0); sh.scale.set(14.5, 6.4, 10);
    const lm = vmat(k, { rough: 0.4 }), legs = [];
    const lc = (u, ca, sa, c) => { c.copy(A).lerp(Lt, sstep(-0.3, -0.9, ca) * 0.6); if (Math.abs(u - 0.45) < 0.04) c.lerp(Lt, 0.4); };
    for (let i = 0; i < 4; i++) for (const sd of [1, -1]) {
      const hip = k.group(F, sd * (9 + i * 0.6), -3, 3 - i * 2.6);
      const g = loftG('crableg' + i + ':' + sd + body, 12, 6, u => 1.6 * (1 - 0.65 * u), null, lc, [0, 0, 0, sd * 4, 2.5, 0.6 - i * 0.5, sd * (7 + i * 1.0), 3.6 - i * 0.3, 1.0 - i * 0.9, sd * (9.5 + i * 1.2), -4, 1.2 - i * 1.2, sd * (10.5 + i * 1.6), -10.5, 1.2 - i * 1.5]);
      k.mesh(g, lm, hip); hip.i = i; hip.sd = sd; legs.push(hip);
    }
    const claws = [];
    for (const sd of [1, -1]) {
      const sh2 = k.group(F, sd * 9, -0.5, 6);
      k.mesh(loftG('crabarm' + sd + body, 10, 8, u => 2.2 - 0.4 * u, null, lc, [0, 0, 0, sd * 3, 3, 2, sd * 6.5, 6.5, 3]), lm, sh2);
      const cl = k.group(sh2, sd * 8.4, 8.6, 3.6); cl.rotation.z = -sd * 0.35;
      k.sphere([3.0, 4.6, 2.5], k.mat(body, { rough: 0.35 }), cl, 0, 1.6, 0);
      const fx = k.cone(1.3, 6, k.mat(shade(body, 0.15), { rough: 0.35 }), cl, -sd * 0.9, 8.6, 0, 8); fx.rotation.z = sd * 0.12;
      const dj = k.group(cl, sd * 1.4, 4.6, 0), dc = k.cone(1.1, 5.4, k.mat(shade(body, 0.3), { rough: 0.35 }), dj, 0, 2.9, 0, 8);
      k.sphere([0.5, 0.5, 0.5], k.mat('#1a1410'), cl, -sd * 0.9, 11.4, 0); k.sphere([0.45, 0.45, 0.45], k.mat('#1a1410'), dj, 0, 5.5, 0);
      claws.push({ cl, dj, sd });
    }
    for (const sd of [1, -1]) { const st = k.group(F, sd * 3.2, 3.5, 7.8); k.cyl(0.5, 0.6, 4, k.mat(body), st, 0, 2, 0, 6); k.sphere(1.05, glossy(k, '#0c0908'), st, 0, 4.3, 0); st.rotation.z = -sd * 0.2; }
    return (e, t) => {
      F.rotation.y = e.facing > 0 ? 0 : PI;
      const walk = e.moving, ph = (e.phase || 0) * 2.5, ang = e.mood === 'angry' || e.lungeT > 0;
      for (const L of legs) { const q = ph + L.i * 1.6 + (L.sd > 0 ? 0 : PI * 0.5); L.rotation.z = walk ? Math.max(0, Math.sin(q)) * 0.22 * L.sd : 0; L.rotation.y = walk ? Math.cos(q) * 0.1 : 0; }
      for (const c of claws) { c.dj.rotation.z = -c.sd * (ang ? 0.45 + Math.sin(t * 10 + c.sd) * 0.35 : 0.1); c.cl.rotation.x = ang ? Math.sin(t * 5 + c.sd) * 0.15 : 0; }
      F.position.y = walk ? Math.abs(Math.sin(ph)) * 0.5 : 0;
    };
  };
  SEA.lobster = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Lt = C3(mix(body, '#ffd0a0', 0.45)), Dk = C3(shade(body, 0.3));
    const gy = -11, segc = (u, ca, sa, c) => { c.copy(A).lerp(Lt, sstep(-0.3, -0.9, ca) * 0.6).lerp(Dk, sstep(0.5, 1, ca) * 0.3); if (u < 0.55 && Math.sin(u * 6 / 0.55 * PI) > 0.85) c.lerp(Dk, 0.5); };
    const sm = vmat(k, { rough: 0.35 });
    k.mesh(loftG('lobbody:' + body, 30, 12, u => u < 0.55 ? (1.6 + 2.3 * u / 0.55) * (0.9 + 0.1 * Math.abs(Math.cos(u * 6 / 0.55 * PI))) : 3.9 + 0.6 * Math.sin((u - 0.55) / 0.45 * PI) - (u > 0.9 ? (u - 0.9) * 30 : 0), u => u < 0.55 ? 1.8 + 2.4 * u / 0.55 : 4.2 + 0.4 * Math.sin((u - 0.55) / 0.45 * PI) - (u > 0.9 ? (u - 0.9) * 32 : 0), segc, [-18, -6.4, 0, -12, -5.4, 0, -6, -4.8, 0, 0, -4.4, 0, 6, -4.8, 0, 9.5, -5.6, 0]), sm, G);
    const fm = k.mat(body, { rough: 0.4, side: 'double' });
    const fan = k.mesh(xg('lobfan', [0, 1.4, -4, 4.5, -6.5, 3, -7, 0, -6.5, -3, -4, -4.5, 0, -1.4], 0.6, 0.2, true), fm, G, -18, -6.8, 0); fan.rotation.x = -PI / 2;
    k.cone(0.6, 3, k.mat(body), G, 11, -5.2, 0, 6).rotation.z = -PI / 2;
    for (const sd of [1, -1]) {
      const st = k.group(G, 8.4, -3.4, sd * 1.6); k.sphere(0.8, glossy(k, '#0c0908'), st, 0, 0.8, 0);
      k.mesh(loftG('lobant', 14, 4, u => 0.35 - 0.25 * u, null, null, [0, 0, 0, 4, 2, 0.8, 6, 6, 1.6, 2, 12, 2.8, -6, 15, 3.8]), k.mat(shade(body, 0.1)), G, 9.5, -4.6, sd * 1.2).scale.z = sd;
    }
    const legs = [], lm = k.mat(shade(body, 0.05), { rough: 0.4 });
    for (let i = 0; i < 4; i++) for (const sd of [1, -1]) { const h = bugLeg(k, G, lm, 'lobl' + i, 4.6 - i * 2.4, -7.4, sd, [0.5, 1.2, 3.6], [1.4 - i * 0.6, gy + 7.4 - 0, 5], 0.45); h.i = i; h.grp = (i + (sd > 0 ? 0 : 1)) & 1; legs.push(h); }
    const claws = [];
    for (const sd of [1, -1]) {
      const sh = k.group(G, 7.6, -6.4, sd * 2.6);
      k.mesh(loftG('lobarm', 10, 8, u => 1.9 + 0.3 * u, null, segc, [0, 0, 0, 3.5, 1.2, 2.6, 7.5, 2.2, 3.8]), sm, sh).scale.z = sd;
      const cl = k.group(sh, 12.4, 3.0, sd * 3.9);
      k.sphere([6.0, 3.3, 2.8], k.mat(body, { rough: 0.35 }), cl);
      const fx = k.cone(1.7, 7, k.mat(shade(body, 0.1), { rough: 0.35 }), cl, 8.2, 0.8, 0, 8); fx.rotation.z = -PI / 2;
      const dj = k.group(cl, 4.2, -1.1, 0), dc = k.cone(1.3, 6.4, k.mat(shade(body, 0.2), { rough: 0.35 }), dj, 3.3, 0, 0, 8); dc.rotation.z = -PI / 2;
      claws.push({ dj, cl, sd });
    }
    return (e, t) => {
      animLegs(legs, e, t, 0.2, 3);
      const ang = e.mood === 'angry' || e.lungeT > 0;
      for (const c of claws) { c.dj.rotation.z = -(ang ? 0.35 + Math.sin(t * 9 + c.sd) * 0.3 : 0.08); c.cl.rotation.z = Math.sin(t * 1.3 + c.sd) * 0.08; }
      fan.rotation.y = Math.sin(t * 2 + e.seed) * 0.12;
    };
  };
  SEA.jellyfish = (e, k, G) => {
    const body = k.col('body');
    const bell = geo('jbell', () => new T.LatheGeometry([[0, 14], [5, 13.3], [9, 11.2], [12.4, 7.2], [14, 2.6], [13.6, 1.1], [12, 1.8], [9, 4.4], [5, 6], [0, 6.8]].map(p => new T.Vector2(p[0], p[1])), 28));
    const B = k.group(G);
    k.mesh(bell, k.mat(body, { opacity: 0.58, side: 'double', rough: 0.15, glow: body, glowK: 0.25 }), B);
    const gon = k.sphere([5.2, 2.4, 5.2], k.mat(shade(body, 0.12), { opacity: 0.85, rough: 0.3, glow: body, glowK: 0.2 }), B, 0, 8.6, 0);
    const ten = [], tm = k.mat(mix(body, '#fff', 0.3), { opacity: 0.7, rough: 0.2 }), om = k.mat(mix(body, '#fff', 0.15), { opacity: 0.55, rough: 0.3, side: 'double' });
    for (let i = 0; i < 12; i++) {
      const oral = i < 4, a = (oral ? i / 4 : (i - 4) / 8) * TAU + 0.3, r0 = oral ? 3.2 : 12.4;
      const g = new Loft(oral ? 14 : 12, oral ? 6 : 4, oral ? (u => (1.1 - 0.6 * u) * (0.7 + 0.4 * Math.abs(Math.sin(u * 18)))) : (u => 0.32 - 0.2 * u), oral ? (u => (0.45 - 0.2 * u)) : null, null, [1, 0, 0]);
      k.own.push(g); k.mesh(g, oral ? om : tm, B);
      ten.push({ g, a, r0, oral, path: new Array(15).fill(0) });
    }
    let tick = 0;
    const set = (e, t) => {
      for (const T0 of ten) {
        const ca = Math.cos(T0.a), sa = Math.sin(T0.a), P = T0.path, L = T0.oral ? 15 : 19;
        for (let j = 0; j < 5; j++) { const u = j / 4, sw = Math.sin(t * 2.4 + T0.a * 3 + u * 3) * 2.5 * u; P[j * 3] = ca * (T0.r0 * (1 - u * 0.4)) + sw * 0.6; P[j * 3 + 1] = 2 - u * L; P[j * 3 + 2] = sa * (T0.r0 * (1 - u * 0.4)) + sw * 0.5; }
        T0.g.setPath(P);
      }
    };
    set(e, 0);
    return (e, t) => {
      const p = Math.sin(t * 2.4 + e.seed); B.scale.set(1 + p * 0.06, 1 - p * 0.08, 1 + p * 0.06);
      if ((tick++ & 1) === 0) set(e, t);
    };
  };
  SEA.starfish = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Lt = C3(mix(body, '#fff3c8', 0.55)), Dk = C3(shade(body, 0.25));
    const g = geo('star:' + body, () => {
      const pts = []; for (let i = 0; i < 100; i++) { const q = (i / 100 * 5) % 1, d = Math.min(q, 1 - q) * 2, a = i / 100 * TAU + PI / 2, r = 14.5 * (0.3 + 0.7 * Math.pow(1 - d, 1.35) - 0.06 * Math.pow(1 - d, 12)); pts.push(Math.cos(a) * r, Math.sin(a) * r); }
      const gg = new T.ExtrudeGeometry(shapeOf(pts), { depth: 2, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 1.6, bevelSegments: 4, curveSegments: 1 });
      gg.translate(0, 0, -1); const P = gg.attributes.position;
      for (let i = 0; i < P.count; i++) { const r = Math.hypot(P.getX(i), P.getY(i)) / 14; P.setZ(i, P.getZ(i) * (1 + 1.4 * Math.max(0, 1 - r))); }
      gg.computeVertexNormals();
      return paintGeo(gg, (x, y, z, c) => { const a = Math.atan2(y, x) - PI / 2, ar = Math.abs(((a / TAU * 5 % 1) + 1) % 1 - 0.5), r = Math.hypot(x, y); c.copy(A).lerp(Dk, sstep(0.2, 0.0, ar) * 0); if (Math.abs(z) > 1.2 && noise(x * 1.6, y * 1.6) > 0.66) c.lerp(Lt, 0.85); if (r < 2.5 && Math.abs(z) > 2) c.lerp(Dk, 0.5); });
    });
    const s = k.mesh(g, vmat(k, { rough: 0.65 }), G, 0, -1, 0); s.rotation.x = -0.22;
    return (e, t) => { s.rotation.z = e.held ? Math.sin(t * 5) * 0.12 : Math.sin(t * 0.5 + e.seed) * 0.03; };
  };
  SEA.seahorse = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Dk = C3(shade(body, 0.3)), Lt = C3(mix(body, '#fff', 0.35));
    const sh = vmat(k, { rough: 0.5 });
    const ry = u => (u < 0.18 ? 1.8 + 1.6 * u / 0.18 : u < 0.45 ? 3.4 + 0.6 * Math.sin((u - 0.18) / 0.27 * PI) : 3.4 * Math.pow(1 - (u - 0.45) / 0.55, 1.2) + 0.35) * (0.88 + 0.12 * Math.abs(Math.cos(u * 22 * PI)));
    const g = loftG('shorse:' + body, 60, 10, ry, u => ry(u) * 0.8, (u, ca, sa, c) => { c.copy(A).lerp(Lt, sstep(0.3, 1, sa) * 0.4); if (Math.cos(u * 22 * TAU) > 0.7) c.lerp(Dk, 0.45); },
      [1.6, 8.6, 0, 4.4, 5, 0, 5.6, 0.6, 0, 3.6, -4, 0, -0.6, -7.6, 0, -2.6, -11.4, 0, -0.6, -14.2, 0, 2.4, -14, 0, 3, -11.6, 0, 1.4, -10.6, 0], [0, 0, 1]);
    k.mesh(g, sh, G);
    const Hd = k.group(G, 2.2, 10.4, 0), hm = k.mat(body, { rough: 0.5 });
    const hh = k.sphere([3.4, 2.9, 2.4], hm, Hd); hh.rotation.z = -0.25;
    const sn = k.cyl(0.8, 1.2, 5.4, hm, Hd, 4.6, -0.6, 0, 10); sn.rotation.z = PI / 2 + 0.1;
    k.cone(1.2, 2.8, hm, Hd, -1.2, 2.8, 0, 6).rotation.z = 0.6;
    for (const sd of [1, -1]) k.eye(1.0, Hd, 1.1, 0.5, sd * 2.0, { dir: [0.3, 0.1, sd], iris: '#2a1a0e', white: '#e8d070', lid: body });
    const df = fin(k, G, 'shfin', [0, 0, -2.6, 1.2, -3.2, -1.6, -2, -4, 0, -3.4], 0.3, finMat(k, mix(body, '#fff', 0.3), 0.7), 4.2, 1.6, 0);
    df.rotation.z = -0.5;
    return (e, t) => { df.rotation.y = Math.sin(t * 22 + e.seed) * 0.35; G.rotation.z = Math.sin(t * 1.2 + e.seed) * 0.05; G.position.y = Math.sin(t * 1.6 + e.seed) * 0.6; };
  };
  SEA.pufferfish = (e, k, G) => {
    const body = k.col('body'), A = C3(body), Wt = C3('#f6f2e2'), Sp = C3(shade(body, 0.55));
    const bg = geo('puff:' + body, () => paintGeo(new T.SphereGeometry(1, 28, 20), (x, y, z, c) => { c.copy(A).lerp(Wt, sstep(-0.1, -0.6, y)); if (y > -0.1 && noise(x * 6 + 3, z * 6 + y * 4) > 0.66) c.lerp(Sp, 0.75); }));
    const P = k.group(G);
    const bd = k.mesh(bg, vmat(k, { rough: 0.45 }), P); bd.scale.set(12, 10.6, 10.6);
    const sg = geo('puffspines', () => {   // many small spines merged into one mesh
      const pos = [], N = 70;
      for (let i = 0; i < N; i++) {
        const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996, d = new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        if (d.x > 0.75) continue;
        const t1 = new T.Vector3(0, 1, 0).cross(d); if (t1.lengthSq() < 0.01) t1.set(1, 0, 0); t1.normalize(); const t2 = d.clone().cross(t1);
        const b = [0, 1, 2].map(j => { const q = j / 3 * TAU; return d.clone().multiplyScalar(0.96).addScaledVector(t1, Math.cos(q) * 0.06).addScaledVector(t2, Math.sin(q) * 0.06); }), tip = d.clone().multiplyScalar(1.32);
        for (let j = 0; j < 3; j++) { const p0 = b[j], p1 = b[(j + 1) % 3]; pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, tip.x, tip.y, tip.z); }
      }
      const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gg.computeVertexNormals(); return gg;
    });
    const sp = k.mesh(sg, k.mat(mix(body, '#d8c8a0', 0.5), { rough: 0.5 }), P); sp.scale.set(12, 10.6, 10.6);
    const fm = finMat(k, mix(body, '#fff', 0.2), 0.8);
    const tail = k.group(P, -11.6, 0, 0); fin(k, tail, 'pufft', [0.5, 1.2, -3.5, 4.5, -5.5, 3, -5, 0, -5.5, -3, -3.5, -4.5, 0.5, -1.2], 0.4, fm);
    const pecs = [1, -1].map(sd => { const p = k.group(P, 3, -1, sd * 9.6); fin(k, p, 'puffp', [0, 1, -2.6, 2.4, -3.4, 0, -2.6, -2.4, 0, -1], 0.3, fm); p.sd = sd; return p; });
    fishEye(k, P, 2.3, 7.2, 3.4, 6.6, '#2a5a2a', body);
    k.sphere([1.2, 1.4, 1.6], k.mat('#e8d8b8', { rough: 0.4 }), P, 11.8, -1.4, 0);
    const st = { p: 1 };
    return (e, t) => {
      const want = (e.mood === 'scared' || e.mood === 'angry' || e.held) ? 1.3 : 1;
      st.p += (want - st.p) * 0.12;
      P.scale.set(st.p, st.p, st.p * (st.p > 1.1 ? 1.15 : 0.82));
      sp.scale.set(12 * (0.92 + (st.p - 1) * 0.3), 10.6 * (0.92 + (st.p - 1) * 0.3), 10.6 * (0.92 + (st.p - 1) * 0.3));
      sp.visible = st.p > 1.04;
      tail.rotation.y = Math.sin(t * 6 + e.seed) * 0.4;
      for (const p of pecs) p.rotation.y = p.sd * Math.sin(t * 12 + e.seed) * 0.5;
    };
  };

  // ======================= SNAKES =======================
  M3.kinds.snake = function (e, k, tpl) {
    const o = tpl.o, len = o.len, body = k.col('body'), name = k.def.name;
    const cobra = o.hood, rattle = o.rattle, python = len >= 80;
    const G = k.group(k.root); G.scale.setScalar(o.s);
    const gy = -8, R = python ? 3.8 : 3.3, headL = 8.5;
    const A = C3(body), Dk = C3(shade(body, python ? 0.45 : 0.4)), Bl = C3(own(k, 'belly') || mix(body, '#f2ecc0', 0.6)), Lt = C3(mix(body, '#fff', 0.3)), Bk = C3('#1a1410');
    const col = (u, ca, sa, c) => {
      const a = Math.atan2(sa, ca);   // 0 along the spine
      c.copy(A).lerp(Dk, sstep(0.4, 1, ca) * 0.25);
      if (rattle) { const d = Math.abs(((u * 13) % 1) - 0.5) * 2, q = d * 0.9 + Math.abs(a) / 1.1; if (q < 0.72) c.lerp(Dk, 0.85); else if (q < 0.9) c.lerp(Lt, 0.6); if (u < 0.14) c.copy(Math.sin(u * 90) > 0 ? Bk : Lt); }
      else if (python) { const n = noise(u * 26, a * 2.2 + 5); if (n > 0.55) c.lerp(Dk, 0.9); if (n > 0.55 && n < 0.62) c.lerp(Bk, 0.5); if (n > 0.7) c.lerp(Lt, 0.25); }
      else if (cobra) { if (Math.sin(u * 40) > 0.6) c.lerp(Dk, 0.4); }
      else { if (Math.abs(a) < 0.25 || Math.abs(Math.abs(a) - 1.55) < 0.18) c.lerp(C3('#e8d870'), 0.55); }
      c.lerp(Bl, sstep(-0.35, -0.75, ca));
    };
    const ry = u => R * 0.88 * (u < 0.42 ? 0.1 + 0.9 * Math.sin(u / 0.42 * PI / 2) : 1 - 0.18 * sstep(0.85, 1, u));
    const n = 44, g = new Loft(n, 14, ry, u => ry(u) * 1.15, col); k.own.push(g);
    const sk = scaleTex('snake', 4); sk.repeat.set(7, 34);
    const bm = vmat(k, { rough: 0.35, tex: 'scales:snake' }); if (bm.map !== sk) { bm.map = sk; bm.needsUpdate = true; }
    k.mesh(g, bm, G);
    // head: a broad wedge of a skull, a hinged lower jaw, eyes with slit pupils, a flicking forked tongue
    const H = k.group(G), Hp = k.group(H);
    const headC = (u, ca, sa, c) => { c.copy(A).lerp(Dk, sstep(0.5, 1, ca) * 0.3); c.lerp(Bl, sstep(-0.3, -0.7, ca)); };
    k.mesh(loftG('shead:' + body, 14, 14, u => 1.9 * Math.pow(Math.sin(clamp(u * 0.92 + 0.1, 0, 1) * PI * 0.62 + 0.6), 1) * (1 - 0.35 * u), u => 3.2 * (1 - 0.6 * u * u) * Math.sqrt(Math.max(0.02, 1 - ((u - 0.15) / 0.86) ** 6)), headC, [-1.2, 0.5, 0, 2, 0.9, 0, 5.5, 0.6, 0, headL, -0.1, 0]), vmat(k, { rough: 0.35 }), Hp);
    const J = k.group(Hp, -0.2, -0.7, 0);
    k.mesh(loftG('sjaw:' + body, 12, 10, u => 1.0 * (1 - 0.45 * u), u => 2.8 * (1 - 0.6 * u * u), headC, [-0.5, 0, 0, 3, -0.2, 0, headL - 1, -0.1, 0]), vmat(k, { rough: 0.35 }), J);
    const mouth = k.sphere([3.6, 0.9, 2.2], k.mat('#c86a70', { rough: 0.5 }), Hp, 4, -0.7, 0);
    const fangs = [];
    if (cobra || rattle) for (const sd of [1, -1]) { const f = k.cone(0.28, 1.8, k.mat('#f6f2e4', { rough: 0.3 }), Hp, headL - 1.6, -1.2, sd * 0.9, 6); f.rotation.z = PI - 0.25; fangs.push(f); }
    const eyes = [];
    for (const sd of [1, -1]) {
      const eg = k.group(Hp, 5.0, 1.0, sd * 2.1);
      k.sphere(0.95, k.mat(python ? '#c9a066' : '#d9b02a', { rough: 0.12 }), eg);
      k.sphere([0.18, 0.75, 0.5], k.mat('#0a0806', { rough: 0.2 }), eg, 0, 0, sd * 0.62);
      const br = k.sphere([1.4, 0.45, 0.9], k.mat(shade(body, 0.1), { rough: 0.4 }), Hp, 5.0, 1.75, sd * 1.95); br.rotation.x = sd * 0.25;
      eyes.push(eg);
    }
    const tg = k.group(Hp, headL - 0.6, -0.5, 0), tgm = k.mat('#c8202a', { rough: 0.4 });
    k.cyl(0.18, 0.22, 4, tgm, tg, 2, 0, 0, 5).rotation.z = PI / 2;
    for (const sd of [1, -1]) { const p = k.cyl(0.1, 0.16, 1.6, tgm, tg, 4.6, 0, sd * 0.35, 5); p.rotation.set(0, sd * -0.5, PI / 2); }
    // cobra hood, rattle
    let hood = null;
    if (cobra) {
      const hc = own(k, 'hood') || shade(body, 0.05), HC = C3(hc), HB = C3(mix(hc, '#f4ecd0', 0.55)), HD = C3(shade(hc, 0.55));
      const hg = geo('hood:' + hc, () => paintGeo(new T.ExtrudeGeometry(shapeOf([0, -7, 3.2, -5, 6.2, 0, 5.6, 4, 2.6, 6.6, 0, 7.4, -2.6, 6.6, -5.6, 4, -6.2, 0, -3.2, -5], true), { depth: 0.4, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.5, bevelSegments: 2, curveSegments: 3 }).translate(0, 0, -0.2), (x, y, z, c) => {
        if (z > 0) { c.copy(HB); if (Math.abs(y - 2) < 0.7 || Math.abs(y + 1.4) < 0.6) c.copy(HD); } else { c.copy(HC); const d = Math.hypot(Math.abs(x) - 2.2, y - 2); if (Math.abs(d - 1.3) < 0.45) c.copy(HB); else if (d < 0.85) c.copy(HD); }
      }));
      hood = k.mesh(hg, vmat(k, { rough: 0.4, side: 'double' }), G);
    }
    let rat = null;
    if (rattle) {
      rat = k.group(G); const rm = k.mat('#d9c08a', { rough: 0.5 });
      for (let i = 0; i < 5; i++) k.sphere([1.1, 1.45 - i * 0.12, 1.0 - i * 0.07], rm, rat, -0.6 - i * 1.35, 0, 0);
    }
    const m = 12, path = new Array(m * 3).fill(0), tp = new T.Vector3(), tt = new T.Vector3(), q = new T.Quaternion(), M4 = new T.Matrix4(), X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3();
    const x0 = -len / 2, x1 = len / 2 - headL;
    return (e, t) => {
      const mv = e.moving ? 1 : 0, ph = (e.phase || 0) * 2.2 + t * (mv ? 2.4 : 0.6) + e.seed, lk = e.lungeT > 0 ? Math.sin((1 - e.lungeT / 0.24) * PI) : 0;
      const angry = e.mood === 'angry' || lk > 0, rear = cobra ? 1 : 0, coil = !mv && !e.held ? 0.35 : 0;
      for (let i = 0; i < m; i++) {
        const u = i / (m - 1);
        let x = x0 + (x1 - x0) * u, y = gy + ry(u) * 0.9, z = Math.sin(u * (len / 6.5) - ph) * (python ? 3.4 : 3.6) * sstep(0, 0.25, u) * (1 - 0.7 * sstep(0.72, 1, u)) * (1 + coil);
        if (rear) { const r = sstep(0.62, 1, u); x -= r * (x1 - x0) * 0.22; y += r * r * 15; z *= 1 - r; }
        else y += sstep(0.75, 1, u) * (angry ? 4.5 : 2.2);
        if (rattle && u < 0.12) y += (0.12 - u) * (angry ? 40 : 12);
        if (e.held) { y += Math.sin(u * 5 + t * 6) * 3; }
        path[i * 3] = x; path[i * 3 + 1] = y; path[i * 3 + 2] = z;
      }
      g.setPath(path);
      // the head sits on the end of the neck, looking along it but kept fairly level
      g.end(n, tp, tt);
      const pitch = clamp(Math.asin(clamp(tt.y, -1, 1)), -0.35, 0.35), yaw = Math.atan2(-tt.z, tt.x);
      H.position.copy(tp); H.rotation.set(0, yaw * 0.7, pitch - (rear ? 0.15 : 0));
      Hp.position.x = lk * 3;
      J.rotation.z = -(lk * 0.8 + (angry ? 0.25 + Math.sin(t * 3) * 0.05 : 0));
      mouth.visible = J.rotation.z < -0.08;
      for (const f of fangs) f.visible = mouth.visible;
      const flick = Math.sin(t * 8 + e.seed);
      tg.visible = flick > 0.3 && lk === 0; tg.scale.x = 0.4 + 0.6 * Math.min(1, (flick - 0.3) * 3); tg.rotation.z = Math.sin(t * 40) * 0.15;
      const shut = e.ko || e.sleeping; for (const ey of eyes) ey.scale.y = shut ? 0.15 : 1;
      if (hood) {   // spread toward whoever is watching
        g.end(Math.round(n * 0.9), tp, tt); Y.copy(tt).normalize();
        Z.set(0.62, 0, 0.78 * camSide(e)); Z.addScaledVector(Y, -Z.dot(Y)).normalize(); X.crossVectors(Y, Z);
        M4.makeBasis(X, Y, Z); q.setFromRotationMatrix(M4); hood.quaternion.copy(q); hood.position.copy(tp).addScaledVector(Y, -1.8);
        hood.scale.setScalar(angry ? 1.1 : 0.95);
      }
      if (rat) { g.end(0, tp, tt); rat.position.copy(tp); rat.rotation.set(0, Math.atan2(tt.z, -tt.x) + PI, Math.atan2(tt.y, tt.x) + (angry ? Math.sin(t * 70) * 0.12 : 0)); }
    };
  };
})();
