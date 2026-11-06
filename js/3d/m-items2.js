'use strict';
// m-items2.js — 3D models for everyday things: boxes and treasure, tools and weapons, explosives, buildings,
// furniture, gadgets, instruments, plus the bosses' projectiles (fireball, venom, stinger, icicle, web).
// Real materials: wood with grain, brick with mortar, roof shingles, polished metal (with a reflection map),
// faceted gems, glass with liquid inside. Things that do something show it: trap jaws snap, the chest lid opens,
// fuses burn down, flames flicker, clock hands keep real time, fan blades spin, flags wave.
(function () {
  if (!SB.M3 || !window.THREE) return;
  const T = THREE, TAU = Math.PI * 2, PI = Math.PI, M3 = SB.M3, N = M3.named, geo = M3.geo;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) || 1; };
  const rng = seed => { let s = (Math.floor(Math.abs(seed)) % 2147483646) + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
  const rgbOf = c => { c = String(c || '#fff').replace('#', ''); if (c.length === 3) c = c.split('').map(ch => ch + ch).join(''); const n = parseInt(c.slice(0, 6), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const shade = (c, k, a) => { const [r, g, b] = rgbOf(c); return `rgba(${clamp(r * k | 0, 0, 255)},${clamp(g * k | 0, 0, 255)},${clamp(b * k | 0, 0, 255)},${a == null ? 1 : a})`; };
  const shadeHex = (c, k) => '#' + rgbOf(c).map(v => clamp(v * k | 0, 0, 255).toString(16).padStart(2, '0')).join('');
  const FONT = () => SB.FONT || 'sans-serif';

  // ---------- textures (painted once on a canvas, shared by every model that uses them) ----------
  // Most are near-white "detail" maps that the material colour tints, so palettes still decide the colour.
  const TEX = new Map();
  function tex(key, w, h, paint, o) {
    let t = TEX.get(key); if (t) return t;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); paint(x, w, h, rng(hash(key)));
    t = new T.Texture(c); t.encoding = T.sRGBEncoding;   // a plain Texture: the renderer only disposes CanvasTextures it owns
    if (!(o && o.clamp)) t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4; t.needsUpdate = true;
    TEX.set(key, t); return t;
  }
  const speckle = (x, w, h, r, n, a, s) => { for (let i = 0; i < n; i++) { const v = r() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${a * r()})`; x.fillRect(r() * w, r() * h, s, s); } };
  const grain = vert => tex('grain' + (vert ? 'V' : 'H'), 256, 256, (x, w, h, r) => {
    if (vert) { x.translate(w, 0); x.rotate(PI / 2); }
    x.fillStyle = '#ece4d8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const y0 = r() * h, a = 0.04 + r() * 0.13, dk = r() < 0.7, ph = r() * 6;
      x.strokeStyle = dk ? `rgba(70,40,15,${a})` : `rgba(255,248,236,${a})`; x.lineWidth = 0.5 + r() * 2.5;
      x.beginPath(); for (let s = 0; s <= w; s += 8) { const yy = y0 + Math.sin(s / w * TAU + ph) * 4 + Math.sin(s / w * TAU * 5 + ph * 3) * 1.2; s ? x.lineTo(s, yy) : x.moveTo(s, yy); } x.stroke();
    }
    for (let i = 0; i < 2; i++) { const kx = r() * w, ky = r() * h; for (let j = 5; j > 0; j--) { x.strokeStyle = `rgba(70,40,15,${0.1 + j * 0.03})`; x.lineWidth = 1; x.beginPath(); x.ellipse(kx, ky, j * 4, j * 1.6, 0, 0, TAU); x.stroke(); } }
    speckle(x, w, h, r, 1500, 0.06, 1);
  });
  const planks = (vert, n) => tex('planks' + (vert ? 'V' : 'H') + n, 256, 256, (x, w, h, r) => {
    x.drawImage(grain(vert).image, 0, 0);
    const L = vert ? w : h, s = L / n;
    for (let i = 0; i < n; i++) {
      const v = r() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${0.04 + r() * 0.08})`;
      if (vert) x.fillRect(i * s, 0, s, h); else x.fillRect(0, i * s, w, s);
      x.fillStyle = 'rgba(40,22,8,0.6)'; if (vert) x.fillRect(i * s, 0, 2, h); else x.fillRect(0, i * s, w, 2);
      x.fillStyle = 'rgba(255,255,255,0.18)'; if (vert) x.fillRect(i * s + 2, 0, 1, h); else x.fillRect(0, i * s + 2, w, 1);
    }
  });
  const siding = () => tex('siding', 128, 256, (x, w, h, r) => {
    const n = 14, s = h / n;
    for (let i = 0; i < n; i++) { const g = x.createLinearGradient(0, i * s, 0, (i + 1) * s); g.addColorStop(0, '#ffffff'); g.addColorStop(0.8, '#e6e3de'); g.addColorStop(1, '#8f8b84'); x.fillStyle = g; x.fillRect(0, i * s, w, s); }
    speckle(x, w, h, r, 900, 0.05, 1);
  });
  const fabric = () => tex('fabric', 128, 128, (x, w, h, r) => {
    x.fillStyle = '#eeeeee'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 2) { x.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; x.fillRect(i, 0, 1, h); x.fillRect(0, i, w, 1); }
    speckle(x, w, h, r, 2500, 0.08, 1);
  });
  const stone = () => tex('stone', 256, 256, (x, w, h, r) => {
    x.fillStyle = '#8f8b84'; x.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let i = 0; i < rows; i++) { let sx = -r() * 30; while (sx < w) { const bw = 28 + r() * 36, v = 180 + r() * 60 | 0; x.fillStyle = `rgb(${v},${v - 2},${v - 7})`; x.fillRect(sx + 1.5, i * rh + 1.5, bw - 3, rh - 3); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(sx + 1.5, i * rh + 1.5, bw - 3, 1.5); sx += bw; } }
    speckle(x, w, h, r, 4000, 0.12, 1.5);
  });
  const granite = () => tex('granite', 128, 128, (x, w, h, r) => {
    x.fillStyle = '#d4d4d4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = (r() < 0.5 ? 70 + r() * 60 : 225 + r() * 30) | 0; x.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  });
  const marble = () => tex('marble', 256, 256, (x, w, h, r) => {
    x.fillStyle = '#f6f4f0'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) { x.strokeStyle = `rgba(120,112,104,${0.06 + r() * 0.1})`; x.lineWidth = 0.6 + r() * 2.4; x.beginPath(); let px = r() * w, py = 0; x.moveTo(px, py); while (py < h) { px += (r() - 0.5) * 30; py += 10 + r() * 20; x.lineTo(px, py); } x.stroke(); }
    speckle(x, w, h, r, 1500, 0.04, 1);
  });
  const flutes = () => tex('flutes', 256, 32, (x, w, h) => {
    const n = 16, s = w / n;
    for (let i = 0; i < n; i++) { const g = x.createLinearGradient(i * s, 0, (i + 1) * s, 0); g.addColorStop(0, '#b4b0a9'); g.addColorStop(0.18, '#f0eee9'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.82, '#d8d4ce'); g.addColorStop(1, '#a6a29b'); x.fillStyle = g; x.fillRect(i * s, 0, s, h); }
  });
  const shingles = () => tex('shingles', 256, 256, (x, w, h, r) => {
    const rows = 12, rh = h / rows; x.fillStyle = '#444'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < rows; i++) {
      const off = (i % 2) * 11;
      for (let sx = -22 + off; sx < w; sx += 22) { const v = 165 + r() * 75 | 0, g = x.createLinearGradient(0, i * rh, 0, (i + 1) * rh); g.addColorStop(0, `rgb(${v},${v},${v})`); g.addColorStop(1, `rgb(${v * 0.78 | 0},${v * 0.78 | 0},${v * 0.78 | 0})`); x.fillStyle = g; x.fillRect(sx + 1, i * rh, 20, rh - 2.5); }
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, (i + 1) * rh - 3, w, 3);
    }
    speckle(x, w, h, r, 3000, 0.1, 1);
  });
  const bricks = (c, m) => tex('brick' + c + (m || ''), 256, 256, (x, w, h, r) => {
    x.fillStyle = m || '#cdc6ba'; x.fillRect(0, 0, w, h);
    const rows = 16, rh = h / rows, bw = 32;
    for (let i = 0; i < rows; i++) { const off = (i % 2) * bw / 2; for (let sx = -bw + off; sx < w; sx += bw) { x.fillStyle = shade(c, 0.8 + r() * 0.35); x.fillRect(sx + 1.5, i * rh + 1.5, bw - 3, rh - 3); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(sx + 1.5, (i + 1) * rh - 3.5, bw - 3, 2); } }
    speckle(x, w, h, r, 5000, 0.14, 1.2);
  });
  const clay = () => tex('clay', 128, 64, (x, w, h, r) => { x.fillStyle = '#f0e8e0'; x.fillRect(0, 0, w, h); speckle(x, w, h, r, 2500, 0.22, 1.4); });
  const snowBlocks = () => tex('snowblocks', 256, 256, (x, w, h, r) => {
    x.fillStyle = '#f7fbff'; x.fillRect(0, 0, w, h);
    const rows = 7, rh = h / rows;
    for (let i = 0; i < rows; i++) {
      const vm = (i + 0.5) / rows, n = Math.max(3, Math.round(16 * Math.sin(vm * PI / 2))), bw = w / n, off = (i % 2) * bw / 2;
      for (let j = -1; j <= n; j++) { const sx = j * bw + off, g = x.createLinearGradient(0, i * rh, 0, (i + 1) * rh); g.addColorStop(0, '#ffffff'); g.addColorStop(1, r() < 0.5 ? '#e3eef7' : '#dce9f4'); x.fillStyle = g; x.fillRect(sx + 1.5, i * rh + 1.5, bw - 3, rh - 3); }
      x.fillStyle = 'rgba(110,145,175,0.55)'; x.fillRect(0, (i + 1) * rh - 1.5, w, 3);
      for (let j = 0; j <= n; j++) x.fillRect((j * bw + off) % w - 1.5, i * rh, 3, rh);
    }
  });
  const card = () => tex('card', 128, 128, (x, w, h, r) => {
    x.fillStyle = '#f2ece2'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 4) { x.fillStyle = 'rgba(80,55,20,0.05)'; x.fillRect(i, 0, 1.5, h); }
    for (let i = 0; i < 400; i++) { x.strokeStyle = `rgba(90,60,25,${r() * 0.12})`; x.lineWidth = 0.6; const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 8, py + (r() - 0.5) * 8); x.stroke(); }
  });
  const haloTex = () => tex('halo', 64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.5)'); g.addColorStop(0.55, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }, { clamp: true });
  const starPath = (x, cx, cy, R, r, n) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -PI / 2 + i * PI / n, rr = i % 2 ? r : R; i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); };

  // a reflection map (sky above, meadow below, a bright sun) so polished metal, glass and gems look real
  let ENV = null;
  function env() {
    if (ENV !== null) return ENV;
    ENV = false;
    try {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, '#4f86c2'); g.addColorStop(0.42, '#bcd8ee'); g.addColorStop(0.5, '#f2efe4'); g.addColorStop(0.53, '#8a9466'); g.addColorStop(0.7, '#56653a'); g.addColorStop(1, '#2f3a22');
      x.fillStyle = g; x.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 9; i++) { const cg = x.createRadialGradient(20 + i * 28, 40 + (i % 3) * 6, 0, 20 + i * 28, 40 + (i % 3) * 6, 18); cg.addColorStop(0, 'rgba(255,255,255,0.7)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = cg; x.fillRect(0, 0, 256, 128); }
      const sg = x.createRadialGradient(80, 26, 0, 80, 26, 14); sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.3, '#fff6dc'); sg.addColorStop(1, 'rgba(255,246,220,0)'); x.fillStyle = sg; x.fillRect(0, 0, 256, 128);
      const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding;
      const pm = new T.PMREMGenerator(M3.renderer); ENV = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
    } catch (err) { console.warn('m-items2: no reflection map', err); ENV = false; }
    return ENV;
  }

  // ---------- material helpers ----------
  // shine: glossy and metal materials get the reflection map
  function shine(m, o) {
    if (o && !m.userData.env && (o.metal || o.env || (o.rough != null && o.rough < 0.5))) {
      const e = env(); if (e) { m.envMap = e; m.envMapIntensity = o.envK || (o.metal ? 1 : 0.6); m.needsUpdate = true; }
      m.userData.env = 1;
    }
    return m;
  }
  const mat = (k, c, o) => shine(k.mat(c, o), o);
  // a material with a texture (k.mat caches by colour+options, so the texture goes in by its id)
  function TM(k, c, t, o) {
    o = o || {};
    const m = k.mat(c, Object.assign({ tag: t.uuid }, o));
    if (m.map !== t) { m.map = t; if (o.bumpK) { m.bumpMap = t; m.bumpScale = o.bumpK; } if (o.emap) m.emissiveMap = t; if (o.alphaT) { m.alphaTest = o.alphaT; m.transparent = false; m.userData.base.transparent = false; } m.needsUpdate = true; }
    return shine(m, o);
  }
  // unlit glowing stuff (flames, screens' light, blades of light); mode 'add' adds light, 'halo' is a soft glow sprite
  function glowM(k, c, op, mode) {
    const m = k.mat(c, { basic: true, opacity: op == null ? 1 : op, tag: mode || 'g' });
    if (!m.userData.g) {
      m.userData.g = 1; m.toneMapped = false;
      if (mode) { m.blending = T.AdditiveBlending; m.depthWrite = false; }
      if (mode === 'halo') m.map = haloTex();
      m.needsUpdate = true;
    }
    return m;
  }
  const wood = (k, c, vert, o) => TM(k, c, grain(vert), Object.assign({ rough: 0.68 }, o));
  const metal = (k, c, rough, o) => mat(k, c, Object.assign({ metal: 0.95, rough: rough == null ? 0.28 : rough }, o));
  const glass = (k, c, op) => mat(k, c || '#dff3fb', { opacity: op || 0.3, rough: 0.04, env: 1, envK: 1.6, side: 'double' });

  // things that must not cast a shadow (glows, flames): their shadow pass always discards
  const NOSH = new T.MeshDepthMaterial(); NOSH.alphaTest = 2;
  const noSh = me => { me.castShadow = false; me.receiveShadow = false; me.customDepthMaterial = NOSH; return me; };

  // ---------- shared shapes ----------
  const PLANE = () => geo('i2plane', () => new T.PlaneGeometry(1, 1));
  const DISC = () => geo('i2disc', () => new T.CircleGeometry(1, 32));
  const plane = (k, w, h, m, p, x, y, z) => { const me = k.mesh(PLANE(), m, p, x, y, z); me.scale.set(w, h, 1); return me; };
  const disc = (k, r, m, p, x, y, z) => { const me = k.mesh(DISC(), m, p, x, y, z); me.scale.set(r, r, 1); return me; };
  const torus = (k, R, r, arc, m, p, x, y, z, rs, ts) => k.mesh(geo('i2tor:' + R + ':' + r + ':' + (arc || TAU).toFixed(3) + ':' + (rs || 10) + ':' + (ts || 28), () => new T.TorusGeometry(R, r, rs || 10, ts || 28, arc || TAU)), m, p, x, y, z);
  // a flat outline given thickness, built once and shared (UVs scaled so textures don't repeat every unit)
  function sext(key, pts, depth, bevel, uvs, holes) {
    return geo('i2ext:' + key, () => {
      const s = new T.Shape(); s.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]);
      for (const hp of holes || []) { const p = new T.Path(); p.moveTo(hp[0], hp[1]); for (let i = 2; i < hp.length; i += 2) p.lineTo(hp[i], hp[i + 1]); s.holes.push(p); }
      const b = bevel == null ? Math.min(depth * 0.4, 1.5) : bevel;
      const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.01, depth - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8 });
      g.translate(0, 0, -(depth - 2 * b) / 2);
      const uv = g.attributes.uv, k = uvs || 0.02; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
      g.computeVertexNormals(); return g;
    });
  }
  const slathe = (key, prof, seg) => geo('i2lat:' + key, () => new T.LatheGeometry(prof.map(p => new T.Vector2(Math.max(0, p[0]), p[1])), seg || 24));
  const circlePts = (cx, cy, r, n, a0, a1) => { const o = []; a0 = a0 || 0; a1 = a1 == null ? TAU : a1; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / (a1 - a0 >= TAU - 1e-6 ? n : n - 1); o.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } return o; };
  // a closed outline through control points, smoothed (Catmull-Rom)
  const smoothPts = (c, n) => { const v = []; for (let i = 0; i < c.length; i += 2) v.push(new T.Vector3(c[i], c[i + 1], 0)); const cu = new T.CatmullRomCurve3(v, true, 'centripetal'), o = []; for (let i = 0; i < n; i++) { const p = cu.getPoint(i / n); o.push(p.x, p.y); } return o; };
  const starPts = (R, r, n) => { const o = []; for (let i = 0; i < n * 2; i++) { const a = PI / 2 + i * PI / n, rr = i % 2 ? r : R; o.push(Math.cos(a) * rr, Math.sin(a) * rr); } return o; };

  // a flame: three nested teardrops (orange, yellow, white core) that flicker, plus a soft glow
  const flameGeo = () => geo('i2flame', () => { const p = []; for (let i = 0; i <= 14; i++) { const u = i / 14; p.push(new T.Vector2(Math.sin(PI * Math.pow(u, 0.55)) * 0.5 * (1 - 0.4 * u), u - 0.22)); } return new T.LatheGeometry(p, 12); });
  function flame(k, p, x, y, z, r, o) {
    o = o || {};
    const g = k.group(p, x, y, z), G = flameGeo(), sd = (k.e.seed || 1) * 3.7;
    const a = noSh(k.mesh(G, glowM(k, o.c1 || '#ff5a0e', 0.55), g)), b = noSh(k.mesh(G, glowM(k, o.c2 || '#ffb02e', 0.6), g)), c = noSh(k.mesh(G, glowM(k, o.c3 || '#fff2c4', 1), g));
    a.renderOrder = 2; b.renderOrder = 3;
    const hk = o.hk || 7, h = o.halo === false ? null : halo(k, g, o.hc || '#ff8a2a', r * hk, 0, r * 1.1, 0.5, o.ho || 0.5);
    g.up = (t, s) => {
      s = s == null ? 1 : s;
      const f = 1 + 0.15 * Math.sin(t * 15 + sd) + 0.09 * Math.sin(t * 37 + sd * 2), w = 1 - 0.07 * Math.sin(t * 23 + sd);
      a.scale.set(r * s * w, r * 2.6 * s * f, r * s * w); b.scale.set(r * 0.7 * s, r * 1.85 * s * f, r * 0.7 * s); c.scale.set(r * 0.4 * s, r * 1.05 * s * (0.9 + 0.1 * f), r * 0.4 * s);
      a.rotation.z = 0.12 * Math.sin(t * 6.3 + sd); b.rotation.z = a.rotation.z * 0.6;
      if (h) { const q = r * hk * s * (0.9 + 0.1 * f); h.scale.set(q, q, 1); }
    };
    g.up(0, 1);
    return g;
  }
  function halo(k, p, c, s, x, y, z, op) {
    const me = k.mesh(PLANE(), glowM(k, c, op == null ? 0.5 : op, 'halo'), p, x, y, z);
    me.scale.set(s, s, 1); me.renderOrder = 4; return noSh(me);
  }
  // a little 4-point spark that twinkles (fuses, wands, sparkle)
  function spark(k, p, x, y, z, r, c) {
    const g = k.group(p, x, y, z), m = glowM(k, c || '#fff0a0', 1);
    const core = noSh(k.sphere(r * 0.35, m, g));
    const rays = [0, 1, 2, 3].map(i => { const b = noSh(k.box(r * 0.16, r * 2.2, r * 0.16, m, g)); b.rotation.z = i * PI / 4; return b; });
    const h = halo(k, g, c || '#ffcf5a', r * 5, 0, 0, 0.3, 0.6);
    g.up = (t, on) => {
      g.visible = on !== false; if (!g.visible) return;
      const f = 0.7 + 0.5 * Math.abs(Math.sin(t * 31 + x)) + 0.3 * Math.sin(t * 57);
      for (let i = 0; i < 4; i++) { rays[i].scale.y = r * (i % 2 ? 1.4 : 2.2) * f; }
      g.rotation.z = t * 7; core.scale.setScalar(r * 0.35 * (0.8 + 0.4 * f)); h.scale.set(r * 5 * f, r * 5 * f, 1);
    };
    return g;
  }
  // a flag of cloth hanging from a pole at its left edge (x, y = its top-left corner); ripples in the wind
  const flagTex = c => tex('flag' + c, 128, 96, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.12)'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; starPath(x, w * 0.42, h * 0.5, 26, 11, 5); x.fill(); });
  function cloth(k, p, x, y, w, h, c) {
    const g = new T.PlaneGeometry(w, h, 10, 5); g.translate(w / 2, -h / 2, 0); k.own.push(g);
    const me = k.mesh(g, TM(k, '#ffffff', flagTex(c), { rough: 0.85, side: 'double' }), p, x, y, 0);
    const P = g.attributes.position, base = Float32Array.from(P.array), sd = (k.e.seed || 1) * 2.3;
    let fr = 0;
    me.wave = (t, amp) => {
      if ((fr++ % 2) && fr > 3) return;   // every other frame is plenty
      for (let i = 0; i < P.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1], u = bx / w;
        P.array[i * 3 + 2] = (Math.sin(bx * 0.25 - t * 6 + sd) + 0.35 * Math.sin(by * 0.3 + bx * 0.1 + t * 4.3)) * amp * u;
        P.array[i * 3] = bx * (1 - 0.05 * u * (1 + Math.sin(t * 6 + sd)));
        P.array[i * 3 + 1] = by - u * u * amp * 0.5;
      }
      P.needsUpdate = true; g.computeVertexNormals();
    };
    me.wave(0, h * 0.12);
    return me;
  }
  // a framed window in a wall that faces +z (turn the group for other walls)
  function windowAt(k, p, x, y, z, w, h, o) {
    const g = k.group(p, x, y, z); if (o.ry) g.rotation.y = o.ry;
    const fr = o.frame, t = 1.5;
    k.box(w - 0.5, h - 0.5, 0.5, o.glass, g, 0, 0, -0.3);
    k.box(w + t, t, 1.4, fr, g, 0, h / 2, 0.3); k.box(w + t, t, 1.4, fr, g, 0, -h / 2, 0.3);
    k.box(t, h, 1.4, fr, g, -w / 2, 0, 0.3); k.box(t, h, 1.4, fr, g, w / 2, 0, 0.3);
    if (o.cross !== false) { k.box(0.8, h, 0.8, fr, g, 0, 0, 0.1); k.box(w, 0.8, 0.8, fr, g, 0, o.crossY || 0, 0.1); }
    if (o.sill) k.box(w + 3.5, 1.2, 2.8, fr, g, 0, -h / 2 - 1, 1);
    if (o.shutter) { k.box(w * 0.34, h + 1, 0.7, o.shutter, g, -w / 2 - w * 0.17 - 1.2, 0, 0.2); k.box(w * 0.34, h + 1, 0.7, o.shutter, g, w / 2 + w * 0.17 + 1.2, 0, 0.2); }
    return g;
  }
  // a roof slab from (x0, y0) to (x1, y1) in the front view, running `d` deep, shingle rows along the ridge
  function slab(k, x0, y0, x1, y1, d, th, m, p) {
    const g = k.group(p || k.root, (x0 + x1) / 2, (y0 + y1) / 2, 0), L = Math.hypot(x1 - x0, y1 - y0);
    g.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    const b = k.box(d, th, L, m, g, 0, th / 2, 0); b.rotation.y = PI / 2;
    return g;
  }
  // an engraved/painted decal plane (transparent canvas texture)
  const decal = (k, t, w, h, p, x, y, z, o) => { const m = TM(k, '#ffffff', t, Object.assign({ opacity: 0.99, rough: 0.7 }, o)); m.polygonOffset = true; m.polygonOffsetFactor = -2; return plane(k, w, h, m, p, x, y, z); };

  // models whose front (+z) should always face the camera: when the thing faces left, turn it round instead of
  // showing its back (buildings, screens, clocks, signs); directional things mirror their depth instead
  const isLeft = e => !!(e._m3 && Math.cos(e._m3.inner.rotation.y) < 0);
  const faceCam = (e, k) => { k.root.rotation.y = isLeft(e) ? PI : 0; };
  const mirror = (e, k) => { k.root.scale.z = isLeft(e) ? -1 : 1; };
  const front = fn => (e, t, dt) => { faceCam(e, e._m3.k); if (fn) fn(e, t, dt); };
  const nearCreature = (e, R) => { const W = SB.world; for (const o of W.entities) if (o !== e && o.alive && o.creature && !o.ko && Math.abs(o.x - e.x) < R && Math.abs(o.y - e.y) < e.h) return true; return false; };

  // =====================================================================================================
  // ---------- boxes, rocks and treasure ----------
  N['box'] = (e, k) => {
    const cb = TM(k, k.col('body'), card(), { rough: 0.92 });
    k.rbox(40, 40, 38, cb, k.root, 0, 0, 0, 0.8);
    const tape = mat(k, '#b48a52', { rough: 0.35, opacity: 0.92 }), seam = k.mat('#6b4a24', { rough: 1 });
    k.box(40.3, 0.25, 0.6, seam, k.root, 0, 20, 0);
    k.box(40.4, 0.4, 7, tape, k.root, 0, 20.1, 0);
    k.box(0.4, 10, 7, tape, k.root, 20.1, 15, 0); k.box(0.4, 10, 7, tape, k.root, -20.1, 15, 0);
    if (e.label) {   // the "I don't know that word yet" box: its label is written on in marker
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
      x.fillStyle = '#fbf8f0'; x.fillRect(4, 4, 248, 120); x.strokeStyle = '#c9bfa8'; x.lineWidth = 3; x.strokeRect(4, 4, 248, 120);
      const s = e.label.length > 10 ? e.label.slice(0, 10) : e.label;
      x.fillStyle = '#1c1c28'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold ' + (s.length > 7 ? 40 : 56) + 'px ' + FONT(); x.fillText(s, 118, 66);
      x.fillStyle = '#d43a2a'; x.font = 'bold 54px ' + FONT(); x.fillText('?', 224, 40);
      const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding;
      const m = k.mat('#ffffff', { rough: 0.8, tag: 'label' }); m.map = t; m.needsUpdate = true;
      plane(k, 30, 15, m, k.root, 0, 2, 19.05);
      return front();
    }
    // printed "this way up" arrows
    const ar = tex('arrows', 128, 64, (x) => { x.fillStyle = '#3a2a18'; for (let i = 0; i < 2; i++) { const cx = 40 + i * 48; x.beginPath(); x.moveTo(cx, 8); x.lineTo(cx + 16, 28); x.lineTo(cx + 6, 28); x.lineTo(cx + 6, 56); x.lineTo(cx - 6, 56); x.lineTo(cx - 6, 28); x.lineTo(cx - 16, 28); x.closePath(); x.fill(); } }, { clamp: true });
    decal(k, ar, 12, 6, k.root, 9, 10, 19.05, { opacity: 0.85 });
    return front();
  };

  N['rock'] = (e, k) => {
    const g = new T.IcosahedronGeometry(1, 2), P = g.attributes.position, r = rng(e.seed * 977 + 3), v = new T.Vector3();
    const A = []; for (let i = 0; i < 5; i++) A.push([new T.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 2 + r() * 4, r() * 6, 0.05 + r() * 0.08]);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i); const d = v.clone().normalize();
      let s = 1; for (const [a, f, ph, amp] of A) s += Math.sin(d.dot(a) * f + ph) * amp;
      v.copy(d).multiplyScalar(s); if (v.y < -0.62) v.y = -0.62 - (v.y + 0.62) * 0.15;
      P.setXYZ(i, v.x * 20, v.y * 16 + 2, v.z * 16);
    }
    g.computeVertexNormals(); k.own.push(g);
    k.mesh(g, TM(k, k.col('body'), granite(), { rough: 0.9, flat: true }), k.root);
    return null;
  };

  N['brick'] = (e, k) => {
    const m = TM(k, k.col('body'), clay(), { rough: 0.95, bumpK: 0.6 });
    k.rbox(26, 14, 12, m, k.root, 0, 0, 0, 0.7);
    const hole = k.mat('#3a1a10', { rough: 1 });
    for (let i = -1; i <= 1; i++) { const d = disc(k, 2, hole, k.root, i * 7.5, 7.02, 0); d.rotation.x = -PI / 2; }
    return null;
  };

  N['anvil'] = (e, k) => {
    const iron = metal(k, k.col('body'), 0.45, { metal: 0.85 }), face = metal(k, '#aab3bd', 0.18);
    k.mesh(sext('anvil', [-22, 14, 10, 14, 10, 6, 7, 4, 7, -6, 15, -8, 16, -15, -16, -15, -15, -8, -8, -6, -8, 4, -20, 6], 16, 1.2), iron, k.root);
    const horn = k.cone(5.2, 15, iron, k.root, 17, 10, 0, 18); horn.rotation.z = -PI / 2; horn.scale.z = 0.8;
    k.box(31, 0.8, 15.6, face, k.root, -6, 14.1, 0);
    k.box(2.2, 0.3, 2.2, k.mat('#111', { rough: 1 }), k.root, -17, 14.6, 0);
    return null;
  };

  const wrapTex = c => tex('wrap' + c, 128, 128, (x, w, h, r) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = shade(c, 1.35, 0.9); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(i * 16 + (j % 2) * 8 + 4, j * 16 + 8, 3, 0, TAU); x.fill(); } speckle(x, w, h, r, 600, 0.05, 1); });
  N['present'] = (e, k) => {
    const paper = TM(k, '#ffffff', wrapTex(k.col('body')), { rough: 0.55, env: 1, envK: 0.3 }), rib = mat(k, (k.def.seq && k.def.seq[1]) || '#f2b632', { rough: 0.32, metal: 0.25 });
    k.box(36, 28, 34, paper, k.root, 0, -6, 0);
    k.box(6, 28.2, 34.3, rib, k.root, 0, -6, 0); k.box(36.3, 28.2, 6, rib, k.root, 0, -6, 0);
    const lid = k.group(k.root, 0, 7, 0);
    k.box(40, 7, 38, paper, lid, 0, 3.5, 0);
    k.box(6, 7.3, 38.3, rib, lid, 0, 3.5, 0); k.box(40.3, 7.3, 6, rib, lid, 0, 3.5, 0);
    for (const s of [-1, 1]) { const l = torus(k, 4.6, 1.3, TAU, rib, lid, s * 4.6, 10.5, 0, 8, 20); l.scale.set(1, 0.62, 1.35); l.rotation.set(0, s * 0.35, s * 0.5); }
    k.sphere([2.4, 2, 2.4], rib, lid, 0, 8.6, 0);
    const tl = k.box(2.5, 0.4, 7, rib, lid, -2.6, 7.2, 4); tl.rotation.set(0.4, 0.5, 0.2); const tr = k.box(2.5, 0.4, 7, rib, lid, 2.6, 7.2, 4); tr.rotation.set(0.4, -0.5, -0.2);
    return (en, t) => {   // something inside makes the lid hop now and then
      const ph = (t + en.seed * 3) % 4;
      lid.position.y = 7 + (en.opened ? 10 : ph < 0.5 ? Math.max(0, Math.sin(ph * TAU * 2)) * 1.8 : 0);
      lid.rotation.z = ph < 0.5 ? Math.sin(ph * TAU * 2) * 0.05 : 0;
    };
  };

  N['treasure chest'] = (e, k) => {
    const wd = TM(k, k.col('body'), planks(false, 4), { rough: 0.7 }), gold = metal(k, (k.def.seq && k.def.seq[1]) || '#f2b632', 0.3), dark = k.mat('#1b120a', { rough: 1 });
    k.box(48, 22, 30, wd, k.root, 0, -7, 0);
    for (const s of [-1, 1]) { k.box(3.5, 22.4, 30.4, gold, k.root, s * 17, -7, 0); for (const z of [-1, 1]) k.box(2.4, 22.4, 2.4, gold, k.root, s * 23.3, -7, z * 14.3); }
    k.box(48.4, 2, 30.4, gold, k.root, 0, -17.2, 0);
    k.box(7, 8, 1.2, gold, k.root, 0, 0, 15.3); k.box(1.4, 3, 0.4, dark, k.root, 0, -0.5, 16);
    // the treasure inside (only seen when it's open)
    const loot = k.group(k.root, 0, 4, 0);
    k.box(46, 1, 28, dark, loot, 0, -0.6, 0);
    k.sphere([20, 5, 11], gold, loot, 0, 0, 0);
    const coinG = geo('cyl:4.5:4.5:1:20', () => new T.CylinderGeometry(4.5, 4.5, 1, 20)), r = rng(e.seed * 31);
    for (let i = 0; i < 9; i++) { const c = k.mesh(coinG, gold, loot, (r() - 0.5) * 32, 3 + r() * 2.5, (r() - 0.5) * 14); c.rotation.set(r() * 1.2 - 0.6, 0, r() * 1.2 - 0.6); }
    const gem = mat(k, '#e0303f', { rough: 0.05, metal: 0.2, flat: true, glow: '#5a0010', glowK: 0.6 }), gem2 = mat(k, '#2f7fe0', { rough: 0.05, metal: 0.2, flat: true, glow: '#001a50', glowK: 0.6 });
    k.mesh(geo('i2gem', () => new T.OctahedronGeometry(3, 0)), gem, loot, -8, 5.5, 4); k.mesh(geo('i2gem', () => new T.OctahedronGeometry(3, 0)), gem2, loot, 9, 5, -2);
    const shine2 = halo(k, loot, '#ffd76a', 50, 0, 6, 6, 0.35);
    // the domed lid hinges at the back top edge
    const lid = k.group(k.root, 0, 4, -15);
    const dome = k.mesh(geo('i2chestlid', () => new T.CylinderGeometry(15, 15, 48, 20, 1, false, 0, PI)), TM(k, k.col('body'), planks(false, 4), { rough: 0.7, side: 'double' }), lid, 0, 0, 15);
    k.box(47.6, 0.8, 29.6, wood(k, '#4a2e16', false), lid, 0, 0.4, 15); dome.rotation.z = PI / 2; dome.scale.set(14 / 15, 1, 1);
    for (const s of [-1, 1]) { const b = k.mesh(geo('i2chestband', () => new T.CylinderGeometry(15.4, 15.4, 3.5, 20, 1, true, 0, PI)), gold, lid, s * 17, 0, 15); b.rotation.z = PI / 2; b.scale.set(14.4 / 15.4, 1, 1); }
    k.box(5, 5, 1.2, gold, lid, 0, 1, 30.4);
    let a = 0;
    return (en, t, dt) => {
      const want = en.opened ? -1.95 : 0; a += (want - a) * Math.min(1, dt * 7); lid.rotation.x = a;
      loot.visible = a < -0.15; shine2.visible = loot.visible;
      if (loot.visible) { const q = 40 + Math.sin(t * 3) * 6; shine2.scale.set(q, q, 1); }
    };
  };

  const coinTex = () => tex('coinface', 128, 128, (x) => {
    x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#ffffff'; x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 50, 0, TAU); x.stroke();
    x.fillStyle = '#ffffff'; x.font = 'bold 82px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 64, 68);
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; x.fillRect(64 + Math.cos(a) * 58 - 1, 64 + Math.sin(a) * 58 - 1, 2.5, 2.5); }
  }, { clamp: true });
  N['coin'] = (e, k) => {
    const gold = metal(k, k.col('body'), 0.22), face = TM(k, k.col('body'), coinTex(), { metal: 1, rough: 0.25, bumpK: 0.8 });
    const c = k.cyl(9, 9, 2.2, gold, k.root, 0, 0, 0, 32); c.rotation.x = PI / 2;
    disc(k, 8.4, face, k.root, 0, 0, 1.12); const b = disc(k, 8.4, face, k.root, 0, 0, -1.12); b.rotation.y = PI;
    torus(k, 8.6, 0.55, TAU, gold, k.root, 0, 0, 1.05, 6, 40); torus(k, 8.6, 0.55, TAU, gold, k.root, 0, 0, -1.05, 6, 40);
    return front();
  };

  // a brilliant-cut gem: faceted, glassy, with an inner set of facets for "fire" and a twinkle
  function gem(k, p, x, y, z, s, c, o) {
    const g = k.group(p, x, y, z); g.scale.setScalar(s); g.rotation.x = 0.22;
    const prof = [[0, -13], [14, 5], [14, 6.5], [8, 13], [0, 13]];
    const outer = mat(k, c, { opacity: 0.88, rough: 0.03, metal: 0.55, flat: true, env: 1, envK: 1.8, glow: c, glowK: 0.08 });
    const inner = mat(k, '#ffffff', { opacity: 0.55, rough: 0.02, metal: 0.4, flat: true, env: 1, envK: 2.5 });
    k.mesh(slathe('gem', prof, 8), outer, g).rotation.y = PI / 8;
    const inn = k.mesh(slathe('gem', prof, 8), inner, g); inn.scale.setScalar(0.62); inn.position.y = 1;
    return g;
  }
  N['diamond'] = (e, k) => {
    gem(k, k.root, 0, 0, 0, 1, k.col('body'));
    const tw = spark(k, k.root, 6, 9, 9, 2.4, '#ffffff');
    return (en, t) => { const ph = (t * 0.7 + en.seed) % 2.5; tw.up(t, ph < 0.4); if (ph < 0.4) tw.scale.setScalar(Math.sin(ph / 0.4 * PI)); };
  };
  N['ring'] = (e, k) => {
    const gold = metal(k, k.col('body'), 0.2), g = k.group(k.root, 0, -3, 0); g.rotation.y = 0.5;
    torus(k, 6.7, 1.35, TAU, gold, g, 0, 0, 0, 12, 40);
    k.cyl(2.2, 1.4, 2.6, gold, g, 0, 7.4, 0, 12);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; const pr = k.box(0.5, 3, 0.5, gold, g, Math.cos(a) * 2.3, 9.6, Math.sin(a) * 2.3); pr.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); }
    gem(k, g, 0, 11.6, 0, 0.26, '#eef8ff');
    const tw = spark(k, k.root, 2, 12, 4, 1.6, '#ffffff');
    return (en, t) => { const ph = (t * 0.8 + en.seed) % 2.2; tw.up(t, ph < 0.35); if (ph < 0.35) tw.scale.setScalar(Math.sin(ph / 0.35 * PI)); };
  };

  N['trophy'] = (e, k) => {
    const gold = metal(k, k.col('body'), 0.2);
    k.mesh(slathe('trophycup', [[0, -4], [3, -4], [6.5, -1], [9.6, 4], [11.4, 10], [12, 16.5], [12.7, 17.6], [12.2, 18.2], [11.2, 17.4], [10.6, 11], [8.6, 5.5], [5, 1.2], [0, 0.6]], 32), mat(k, k.col('body'), { metal: 0.95, rough: 0.2, side: 'double' }), k.root);
    k.cyl(1.7, 1.7, 8, gold, k.root, 0, -8, 0, 14); k.sphere([2.8, 1.8, 2.8], gold, k.root, 0, -7, 0);
    k.cyl(6.5, 7.5, 1.6, gold, k.root, 0, -11.6, 0, 28);
    for (const s of [-1, 1]) { const h = torus(k, 5, 1.1, PI, gold, k.root, s * 12, 10, 0, 8, 16); h.rotation.z = -s * PI / 2; h.scale.set(1, 1.15, 1); }
    k.rbox(20, 6.2, 14, mat(k, '#1d1d1f', { rough: 0.25, env: 1 }), k.root, 0, -15.6, 0, 0.6);
    k.box(12, 3, 0.4, metal(k, '#e8d9a8', 0.3), k.root, 0, -15.6, 7.05);
    const st = k.mesh(sext('star5', starPts(3.8, 1.6, 5), 1.2, 0.3), gold, k.root, 0, 9, 11.7); st.rotation.x = -0.18;
    return front();
  };

  N['crown'] = (e, k) => {
    const gold = metal(k, k.col('body'), 0.22), pearl = mat(k, '#fbf6ee', { rough: 0.2, env: 1 });
    k.mesh(slathe('crownband', [[12.3, -11], [13.4, -11], [13.7, -9.5], [13.4, -3], [12.3, -3], [12.3, -11]], 40), mat(k, k.col('body'), { metal: 0.95, rough: 0.22, side: 'double' }), k.root);
    k.sphere([12.2, 9, 12.2], k.mat('#7d1428', { rough: 1 }), k.root, 0, -5, 0);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + PI / 2, tall = i % 2 === 0, L = tall ? 13 : 8.5, x = Math.cos(a) * 12.9, z = Math.sin(a) * 12.9;
      const c = k.cone(3, L, gold, k.root, x, -3 + L / 2, z, 4); c.rotation.y = -a + PI / 4; c.scale.set(1, 1, 0.45);
      k.sphere(1.4, pearl, k.root, x * 1.01, -3 + L + 0.8, z * 1.01);
      const gm = k.mesh(geo('i2gem2', () => new T.OctahedronGeometry(1.8, 0)), mat(k, i % 2 ? '#1f5fd0' : '#d0202f', { rough: 0.05, metal: 0.2, flat: true, env: 1, envK: 2 }), k.root, Math.cos(a + PI / 8) * 13.7, -7, Math.sin(a + PI / 8) * 13.7);
      gm.scale.set(1, 1.2, 0.6); gm.rotation.y = -(a + PI / 8) + PI / 2;
    }
    return null;
  };

  N['key'] = (e, k) => {
    const br = metal(k, k.col('body'), 0.3);
    torus(k, 4.4, 1.6, TAU, br, k.root, -9, 0, 0, 10, 28);
    const sh = k.cyl(1.3, 1.3, 20, br, k.root, 5.5, 0, 0, 12); sh.rotation.z = PI / 2;
    const col = k.cyl(2.1, 2.1, 1.6, br, k.root, -3.6, 0, 0, 14); col.rotation.z = PI / 2;
    k.box(2, 4.6, 1.8, br, k.root, 11, -2.6, 0); k.box(2.6, 5.4, 1.8, br, k.root, 14.6, -2.9, 0); k.box(1.2, 2.4, 1.8, br, k.root, 12.8, -1.8, 0);
    return null;
  };

  const treadTex = () => tex('tread', 256, 64, (x, w, h, r) => {
    x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 32; i++) { const sx = i * 8; x.fillStyle = '#9a9a9a'; x.fillRect(sx + 1, 0, 6, 12); x.fillRect(sx + 1, h - 12, 6, 12); x.fillStyle = '#666'; x.fillRect(sx + 3, 12, 2, 6); x.fillRect(sx + 3, h - 18, 2, 6); }
    speckle(x, w, h, r, 500, 0.08, 1);
  });
  N['tire'] = (e, k) => {
    const rub = TM(k, '#3a3a3a', treadTex(), { rough: 0.85, bumpK: 1.2 });
    torus(k, 12.4, 4.7, TAU, rub, k.root, 0, 0, 0, 16, 44);
    const rim = metal(k, '#c7ccd2', 0.25), dk = metal(k, '#3c4046', 0.5);
    const d = k.cyl(8.4, 8.4, 6.4, rim, k.root, 0, 0, 0, 32); d.rotation.x = PI / 2;
    disc(k, 7.2, dk, k.root, 0, 0, 3.25); const db = disc(k, 7.2, dk, k.root, 0, 0, -3.25); db.rotation.y = PI;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const s = k.box(2.2, 7, 1.2, rim, k.root, Math.cos(a) * 4.6, Math.sin(a) * 4.6, 3.4); s.rotation.z = a - PI / 2; }
    const hub = k.cyl(2.6, 2.6, 1.6, rim, k.root, 0, 0, 3.8, 16); hub.rotation.x = PI / 2;
    return null;
  };

  const staves = () => tex('staves', 256, 128, (x, w, h, r) => {
    x.drawImage(grain(true).image, 0, 0, w, h);
    for (let i = 0; i < 16; i++) { x.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},0,0,${r() * 0.06})`; x.fillRect(i * 16, 0, 16, h); x.fillStyle = 'rgba(40,20,5,0.6)'; x.fillRect(i * 16, 0, 1.6, h); }
  });
  N['barrel'] = (e, k) => {
    const prof = []; for (let i = 0; i <= 10; i++) { const y = -20 + i * 4; prof.push([12.5 + 2.6 * Math.cos(y / 20 * PI / 2), y]); }
    k.mesh(slathe('barrel', prof, 28), TM(k, k.col('body'), staves(), { rough: 0.7 }), k.root);
    const lidW = wood(k, k.col('body'), false);
    for (const s of [-1, 1]) { const l = k.cyl(12, 12, 1, lidW, k.root, 0, s * 19.2, 0, 28); }
    const iron = metal(k, '#3e3b38', 0.55, { metal: 0.8 });
    for (const y of [-17, -8, 8, 17]) { const rr = 12.5 + 2.6 * Math.cos(y / 20 * PI / 2) + 0.1; const h = torus(k, rr, 0.6, TAU, iron, k.root, 0, y, 0, 6, 36); h.rotation.x = PI / 2; }
    return null;
  };

  // =====================================================================================================
  // ---------- weapons and tools (held diagonally like the 2D drawings: grip bottom-left, business end top-right) ----------
  const diag = k => { const g = k.group(k.root); g.rotation.z = -PI / 4; return g; };
  const leather = k => TM(k, '#4a2c18', fabric(), { rough: 0.8 });
  N['sword'] = (e, k) => {
    const g = diag(k), steel = metal(k, k.col('body'), 0.16), gold = metal(k, '#c9a227', 0.3);
    k.mesh(sext('blade', [-2.4, -12, 2.4, -12, 2.1, 19, 0, 25, -2.1, 19], 1.5, 0.6, 0.05), steel, g);
    k.box(0.7, 27, 1.56, metal(k, '#8a939c', 0.3), g, 0, 4, 0);
    k.rbox(13, 2.2, 3.2, gold, g, 0, -12.6, 0, 0.8);
    k.cyl(1.5, 1.5, 9.5, leather(k), g, 0, -18.4, 0, 12);
    for (let i = 0; i < 4; i++) torus(k, 1.5, 0.35, TAU, leather(k), g, 0, -15 - i * 2.3, 0, 5, 12).rotation.x = PI / 2;
    k.sphere(2.3, gold, g, 0, -24.2, 0);
    return null;
  };
  N['lightsaber'] = (e, k) => {
    const g = diag(k), steel = metal(k, '#c9ced4', 0.2), blk = mat(k, '#1a1a1a', { rough: 0.4, metal: 0.5 }), col = k.col('body');
    k.cyl(1.9, 1.9, 12, steel, g, 0, -19, 0, 16);
    for (let i = 0; i < 5; i++) k.cyl(2.05, 2.05, 0.9, blk, g, 0, -22 + i * 1.6, 0, 16);
    k.cyl(2.5, 1.9, 2.4, steel, g, 0, -12.2, 0, 16); k.box(1.2, 2, 0.8, mat(k, '#d02020', { glow: '#ff2020', glowK: 1 }), g, 1.9, -17, 0);
    k.cyl(0.95, 0.95, 36, glowM(k, '#ffffff', 1), g, 0, 6, 0, 10); k.sphere(0.95, glowM(k, '#ffffff', 1), g, 0, 24, 0);
    const gl = noSh(k.cyl(2.1, 2.1, 37, glowM(k, col, 0.55, 'add'), g, 0, 6, 0, 12)), gl2 = noSh(k.cyl(3.8, 3.8, 39, glowM(k, col, 0.22, 'add'), g, 0, 6, 0, 12));
    halo(k, k.root, col, 60, 0, 0, 2, 0.25);
    return (en, t) => { const f = 1 + 0.06 * Math.sin(t * 47) + 0.04 * Math.sin(t * 91); gl.scale.set(f, 1, f); gl2.scale.set(f * 1.05, 1, f * 1.05); };
  };
  const shieldPts = (() => { const o = [-15, 16, 15, 16]; for (let i = 1; i <= 8; i++) { const u = i / 8; o.push(15 - 15 * Math.pow(u, 1.8), 16 - 34 * Math.pow(u, 0.85)); } for (let i = 7; i >= 1; i--) { const u = i / 8; o.push(-(15 - 15 * Math.pow(u, 1.8)), 16 - 34 * Math.pow(u, 0.85)); } return o; })();
  N['shield'] = (e, k) => {
    const bend = g => { if (g.userData.bent) return g; const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) - P.getX(i) * P.getX(i) / 80); g.computeVertexNormals(); g.userData.bent = 1; return g; };
    const paint = mat(k, k.col('body'), { rough: 0.45, env: 1, envK: 0.4 }), steel = metal(k, '#c4ccd4', 0.28);
    k.mesh(bend(sext('shield', shieldPts, 3, 0.8)), paint, k.root, 0, 0, 0.6);
    const rim = k.mesh(bend(sext('shieldrim', shieldPts, 2.2, 0.6)), steel, k.root, 0, 0, -0.6); rim.scale.set(1.07, 1.05, 1);
    k.box(3, 33, 1, steel, k.root, 0, -0.5, 2.1);
    k.tube([[-14.5, 5, 2.1 - 14.5 * 14.5 / 80], [-7, 5, 2.4 - 49 / 80], [0, 5, 2.6], [7, 5, 2.4 - 49 / 80], [14.5, 5, 2.1 - 14.5 * 14.5 / 80]], 0.9, 0.9, steel, k.root, 16, 6);
    k.sphere([3.4, 3.4, 1.8], steel, k.root, 0, 5, 2.6);
    for (const [x, y] of [[-12, 13], [12, 13], [-9, -6], [9, -6], [0, -14]]) k.sphere(0.8, steel, k.root, x, y, 2.4 - x * x / 80);
    return null;
  };
  N['hammer'] = (e, k) => {
    const g = diag(k), steel = metal(k, k.col('body'), 0.35);
    k.cyl(1.7, 2, 32, wood(k, '#b07a45', true), g, 0, -6, 0, 12);
    k.cyl(2.2, 2.2, 8, mat(k, '#1d1d1d', { rough: 0.9 }), g, 0, -18, 0, 12);
    k.rbox(17, 8.5, 8.5, steel, g, 0, 13, 0, 1.6);
    for (const s of [-1, 1]) k.box(0.6, 7.6, 7.6, metal(k, '#d6dce2', 0.2), g, s * 8.6, 13, 0);
    return null;
  };
  N['axe'] = (e, k) => {
    const g = diag(k), steel = metal(k, k.col('body'), 0.3);
    k.cyl(1.6, 1.9, 33, wood(k, '#b07a45', true), g, 0, -4, 0, 12);
    k.box(4.2, 6.5, 3.6, steel, g, 0, 11.5, 0);
    k.mesh(sext('axehead', [1.5, 14, 5, 13.6, 9, 16.8, 12.6, 19.2, 14, 12, 12.8, 4.6, 9, 6.6, 5, 9, 1.5, 9], 1.8, 0.7, 0.05), steel, g);
    k.box(2.8, 5, 3.4, steel, g, -3.2, 11.5, 0);
    return null;
  };
  N['pickaxe'] = (e, k) => {
    const g = diag(k), steel = metal(k, k.col('body'), 0.38);
    k.cyl(1.6, 1.9, 33, wood(k, '#b07a45', true), g, 0, -5, 0, 12);
    k.tube([[-17, 6.5, 0], [-9, 12.2, 0], [0, 13.8, 0], [9, 12.2, 0], [17, 6.5, 0]], u => 0.35 + 2.1 * Math.pow(Math.sin(PI * u), 0.6), 0, steel, g, 24, 8);
    k.box(4.4, 5.6, 4.4, steel, g, 0, 12.6, 0);
    return null;
  };
  N['shovel'] = (e, k) => {
    const steel = metal(k, k.col('body'), 0.42, { metal: 0.85 });
    k.cyl(1.6, 1.6, 26, wood(k, '#b07a45', true), k.root, 0, 7, 0, 12);
    const tb = k.cyl(1.4, 1.4, 9, mat(k, '#2a2a2a', { rough: 0.6 }), k.root, 0, 20.6, 0, 10); tb.rotation.z = PI / 2;
    k.cyl(1.7, 1.7, 3, mat(k, '#2a2a2a', { rough: 0.6 }), k.root, 0, 18.8, 0, 10);
    k.cyl(1.9, 2.6, 6, steel, k.root, 0, -6.5, 0, 14);
    const bl = sext('spade', [-6.5, -8, 6.5, -8, 6.2, -17.5, 3, -21.5, 0, -23, -3, -21.5, -6.2, -17.5], 0.9, 0.35, 0.05);
    if (!bl.userData.bent) { const P = bl.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) - (P.getX(i) / 6.5) ** 2 * 1.6); bl.computeVertexNormals(); bl.userData.bent = 1; }
    k.mesh(bl, steel, k.root, 0, 0, 0.8);
    k.box(13, 1.2, 2.4, steel, k.root, 0, -8.4, 0);
    return null;
  };
  N['baseball bat'] = (e, k) => {
    k.mesh(slathe('bat', [[0, -22], [2.5, -22], [2.9, -21.2], [2.5, -20.2], [1.5, -19.4], [1.5, -10], [2.1, -4], [3.5, 4], [4.5, 12], [4.85, 18], [4.6, 21], [3.3, 22.3], [0, 22.6]], 24), TM(k, k.col('body'), grain(true), { rough: 0.45, env: 1, envK: 0.35 }), k.root);
    k.cyl(1.68, 1.68, 7, TM(k, '#1e1e1e', fabric(), { rough: 0.9 }), k.root, 0, -15.5, 0, 14);
    return null;
  };
  N['wand'] = (e, k) => {
    const g = diag(k);
    k.cyl(1, 1.15, 20, mat(k, '#1c1410', { rough: 0.3, env: 1 }), g, 0, -3, 0, 10);
    k.cyl(1.25, 1.25, 5, mat(k, '#f4f4f4', { rough: 0.3 }), g, 0, -14.5, 0, 10);
    const st = k.group(g, 0, 11.2, 0);
    k.mesh(sext('star5w', starPts(4.6, 2, 5), 1.6, 0.4), mat(k, '#f6d13b', { metal: 0.6, rough: 0.25, glow: '#f6c13b', glowK: 0.55 }), st);
    halo(k, st, '#ffe48a', 22, 0, 0, 1.2, 0.5);
    const sp = [0, 1, 2].map(i => spark(k, st, 0, 0, 0, 1.2, i ? '#fff6c0' : '#c8e8ff'));
    return (en, t) => { st.rotation.z = Math.sin(t * 1.5) * 0.2; sp.forEach((s, i) => { const a = t * 2.2 + i * TAU / 3; s.position.set(Math.cos(a) * 7, Math.sin(a) * 7, 2); s.up(t + i, true); }); };
  };
  N['stick'] = (e, k) => {
    const bark = TM(k, k.col('body'), grain(true), { rough: 0.95, bumpK: 0.4 });
    k.tube([[-20, -4, 0], [-8, -1.6, 0.6], [4, 0.8, 0], [20, 4, -0.5]], 1.9, 1.1, bark, k.root, 18, 8);
    k.tube([[3.5, 0.6, 0], [7, 4, 0.4], [11, 8, 0]], 1.1, 0.45, bark, k.root, 10, 6);
    const lf = k.mesh(sext('leaf', [0, 0, 2, 1.4, 3.6, 1.6, 5.4, 1, 7, 0, 5.4, -1, 3.6, -1.6, 2, -1.4], 0.5, 0.15), mat(k, '#5cbf60', { rough: 0.55, side: 'double' }), k.root, 11, 8, 0);
    lf.rotation.z = 0.6;
    return null;
  };

  // =====================================================================================================
  // ---------- explosives ----------
  const rope = k => TM(k, '#c9b48a', fabric(), { rough: 1 });
  // a burning fuse: the rope shortens as the timer runs down, the spark rides its end
  function fuse(k, pts, fuseMax) {
    const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2] || 0)));
    const tube = k.tube(pts, 0.85, 0.75, rope(k), k.root, 12, 6);
    const sp = spark(k, k.root, pts[pts.length - 1][0], pts[pts.length - 1][1], 0, 2.6, '#ffe070');
    const tmp = new T.Vector3(); let last = -1, fr = 0;
    return (en, t) => {
      const u = clamp(en.fuse / fuseMax, 0.04, 1), lit = en.fuse > 0;
      if (Math.abs(u - last) > 0.02 && (fr++ % 2 === 0)) { last = u; const p = []; for (let i = 0; i <= 4; i++) { curve.getPoint(u * i / 4, tmp); p.push([tmp.x, tmp.y, tmp.z]); } tube.geometry.setPath(p); }
      curve.getPoint(u, tmp); sp.position.copy(tmp); sp.up(t, lit);
    };
  }
  N['bomb'] = (e, k) => {
    const iron = mat(k, k.col('body'), { metal: 0.65, rough: 0.28 });
    k.sphere(14, iron, k.root, 0, -6, 0);
    k.cyl(4.6, 4.6, 5, metal(k, (k.def.seq && k.def.seq[1]) || '#8c8c8c', 0.4), k.root, 0, 9.5, 0, 18);
    torus(k, 4.6, 0.7, TAU, metal(k, '#8c8c8c', 0.4), k.root, 0, 12, 0, 6, 20).rotation.x = PI / 2;
    const f = fuse(k, [[0, 11.5, 0], [1.2, 15.5, 0], [4.6, 18.6, 0], [10, 18, 0]], 3);
    return (en, t) => {
      f(en, t);
      const hot = en.fuse > 0 && en.fuse < 1.2 && !(en.hitT > 0);   // glows red as it is about to blow
      iron.emissive.setRGB(hot ? 0.6 * (0.5 + 0.5 * Math.sin(t * 30)) * (1.2 - en.fuse) : 0, 0, 0); iron.emissiveIntensity = 1;
    };
  };
  const tntTex = () => tex('tnt', 128, 48, (x) => { x.fillStyle = '#f3ead6'; x.fillRect(0, 0, 128, 48); x.fillStyle = '#141414'; x.font = 'bold 36px ' + FONT(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TNT', 64, 26); x.fillStyle = '#c0392b'; x.fillRect(0, 0, 128, 4); x.fillRect(0, 44, 128, 4); }, { clamp: true });
  N['dynamite'] = (e, k) => {
    const paper = TM(k, k.col('body'), card(), { rough: 0.7 }), band = mat(k, '#1c1c1c', { rough: 0.6 }), ends = k.mat('#d8c3a0', { rough: 1 });
    for (const [y, z] of [[-3.2, 4.4], [-3.2, -4.4], [4.4, 0]]) {
      const s = k.cyl(4.4, 4.4, 34, paper, k.root, 0, y, z, 18); s.rotation.z = PI / 2;
      for (const sx of [-1, 1]) { const c = disc(k, 4.3, ends, k.root, sx * 17.02, y, z); c.rotation.y = sx * PI / 2; }
    }
    for (const sx of [-7, 7]) { const b = k.mesh(slathe('dynband', [[0, -1.3], [8.6, -1.3], [8.9, 0], [8.6, 1.3], [0, 1.3]], 6), band, k.root, sx, 0, 0); b.rotation.z = PI / 2; b.scale.set(1, 1, 1.05); b.rotation.x = 0; }
    plane(k, 14, 5.2, TM(k, '#ffffff', tntTex(), { rough: 0.8 }), k.root, 0, -3.2, 8.85);
    const f = fuse(k, [[17, 4.4, 0], [20.5, 7.6, 0], [23.6, 7, 0], [24.6, 3, 0]], 3);
    return (en, t) => { faceCam(en, k); f(en, t); };
  };
  const fwTex = c => tex('fw' + c, 128, 128, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.save(); for (let i = -4; i < 8; i++) { x.fillStyle = i % 2 ? '#f6d13b' : '#ffffff'; x.beginPath(); x.moveTo(i * 24, 0); x.lineTo(i * 24 + 10, 0); x.lineTo(i * 24 + 10 + 64, h); x.lineTo(i * 24 + 64, h); x.closePath(); x.fill(); } x.restore(); });
  N['firework'] = (e, k) => {
    k.cyl(6, 6, 26, TM(k, '#ffffff', fwTex(k.col('body')), { rough: 0.55 }), k.root, 0, 3, 0, 20);
    k.cone(6.4, 8, metal(k, '#d8b440', 0.35, { metal: 0.6 }), k.root, 0, 20, 0, 20);
    k.cyl(6.2, 6.2, 1.6, mat(k, '#ffffff', { rough: 0.6 }), k.root, 0, -10, 0, 20);
    k.cyl(0.7, 0.7, 14, wood(k, '#c9a66b', true), k.root, 0, -16, 0, 6);
    const fl = k.group(k.root, 0, -11, 0); fl.rotation.z = PI;
    const fm = flame(k, fl, 0, 0, 0, 3.4, { hk: 9, ho: 0.6 });
    const sp = spark(k, k.root, 0, -10.5, 4, 2, '#ffe070');
    return (en, t) => { const on = en.thrust > 0; fl.visible = on; if (on) fm.up(t, 1 + 0.2 * Math.sin(t * 40)); sp.up(t, !on && !en.launched); };
  };
  N['cannon'] = (e, k) => {
    const iron = metal(k, k.col('body'), 0.42, { metal: 0.8 }), wd = wood(k, '#7a4e2a', false), dark = k.mat('#0b0b0b', { rough: 1 });
    const piv = k.group(k.root, -6, -2, 0); piv.rotation.z = 0.5;
    const rec = k.group(piv), b = k.group(rec); b.rotation.z = -PI / 2;
    k.mesh(slathe('cannon', [[0, -11], [6.4, -11], [8.6, -9], [8.6, -4], [7.6, -3.2], [7.6, 0], [7.1, 1], [6.6, 14], [6.1, 25], [6.9, 26.5], [7.4, 29.5], [6.4, 31], [4.3, 31], [4.3, 12], [0, 12]], 28), iron, b);
    k.sphere(2.6, iron, b, 0, -13, 0); k.cyl(1.2, 1.2, 3, iron, b, 0, -11.6, 0, 8);
    disc(k, 4.2, dark, b, 0, 30.6, 0).rotation.x = -PI / 2;
    const tr = k.cyl(2, 2, 18, iron, piv, 0, 0, 0, 12); tr.rotation.x = PI / 2;
    for (const s of [-1, 1]) k.mesh(sext('cheek', [-24, -16, 10, -16, 10, -9, 4, -6, 0, -1, -6, 3, -12, -2, -18, -5, -24, -12], 3, 0.6, 0.03), wd, k.root, 0, 0, s * 7.5);
    k.box(30, 3, 12, wd, k.root, -8, -14, 0);
    const ax = k.cyl(1.4, 1.4, 27, iron, k.root, -6, -12, 0, 10); ax.rotation.x = PI / 2;
    for (const s of [-1, 1]) {
      const w = k.group(k.root, -6, -12, s * 11.5);
      torus(k, 7.4, 1.1, TAU, wd, w, 0, 0, 0, 8, 28); torus(k, 8.1, 0.6, TAU, iron, w, 0, 0, 0, 6, 28);
      const hb = k.cyl(1.9, 1.9, 3.2, wd, w, 0, 0, 0, 12); hb.rotation.x = PI / 2;
      for (let i = 0; i < 6; i++) { const sp = k.box(1.1, 7, 1.1, wd, w, Math.cos(i * PI / 3) * 3.7, Math.sin(i * PI / 3) * 3.7, 0); sp.rotation.z = i * PI / 3 - PI / 2; }
    }
    let kick = 0, seen = new WeakSet();
    return (en, t, dt) => {
      for (const o of SB.world.entities) if (o.def.name === 'bowling ball' && o.spawnT < 0.2 && !seen.has(o) && Math.abs(o.x - en.x) < en.w) { seen.add(o); kick = 1; }   // just fired
      kick = Math.max(0, kick - dt * 3);
      rec.position.set(-Math.sin(Math.min(1, kick * 1.3) * PI) * 4, 0, 0);
    };
  };

  N['bottle'] = (e, k) => {
    const prof = [[0, -18], [6.2, -18], [7, -17], [7, 4], [6.6, 7], [4.6, 11], [3.8, 13], [3.8, 16.8], [4.3, 17.2]];
    k.mesh(slathe('bottle', prof, 28), glass(k, k.col('body'), 0.32), k.root);
    k.mesh(slathe('bottleliq', [[0, -17.4], [6.4, -17.4], [6.4, 2.5], [0, 2.5]], 24), mat(k, '#6fb7e0', { opacity: 0.55, rough: 0.05, env: 1 }), k.root);
    k.cyl(4.5, 4.5, 3, mat(k, '#2d6fd0', { rough: 0.4 }), k.root, 0, 18.4, 0, 18);
    const lt = tex('bottlelabel', 256, 64, (x) => { x.fillStyle = '#f7fbff'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#2d6fd0'; x.fillRect(0, 44, 256, 20); x.fillStyle = '#1b4f9e'; x.font = 'bold 24px ' + FONT(); x.textAlign = 'center'; x.fillText('WATER', 128, 34); x.strokeStyle = '#7ec8e3'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 256; i += 8) x.lineTo(i, 46 + Math.sin(i / 16) * 3); x.stroke(); }, { clamp: false });
    k.mesh(geo('i2bottlelabel', () => new T.CylinderGeometry(7.08, 7.08, 13, 28, 1, true, -PI / 2, PI)), TM(k, '#ffffff', lt, { rough: 0.6, side: 'double' }), k.root, 0, -3, 0);
    return front();
  };
  // =====================================================================================================
  // ---------- buildings (their front, with the door, always faces the camera) ----------
  const glassM = k => mat(k, '#3d5568', { rough: 0.06, metal: 0.35, envK: 1.5 });
  const smoke = (k, p, x, y, z) => {   // chimney smoke: a few puffs that rise and fade in a loop
    const ms = [0, 1, 2, 3].map(i => noSh(k.sphere(3, k.mat('#d8d8d8', { opacity: 0.45 - i * 0.05, rough: 1, tag: 'smoke' + i }), p, x, y, z)));
    return t => ms.forEach((m, i) => { const u = (t * 0.35 + i / 4) % 1; m.position.set(x + u * 8 + Math.sin(t + i) * 1.5, y + u * 26, z); m.scale.setScalar(2.5 + u * 6); });
  };
  N['house'] = (e, k) => {
    const seq = k.def.seq || [], wallC = k.col('body'), roofC = seq[1] || '#c0392b', doorC = seq[2] || '#8b5a2b';
    const wall = TM(k, wallC, siding(), { rough: 0.85 }), trim = k.mat('#f7f4ee', { rough: 0.6 }), roof = TM(k, roofC, shingles(), { rough: 0.8 });
    const D = 50, Z = D / 2;
    k.box(60, 49, D, wall, k.root, 0, -14.5, 0);
    k.box(62, 4, D + 2, TM(k, '#9a948a', stone(), { rough: 0.95 }), k.root, 0, -37, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(2.2, 49, 2.2, trim, k.root, sx * 30, -14.5, sz * Z);
    // gable ends and the pitched roof (ridge runs front to back)
    for (const s of [-1, 1]) k.mesh(sext('housegable', [-30, 0, 30, 0, 0, 31], 1, 0, 0.016), wall, k.root, 0, 10, s * (Z - 0.5));
    slab(k, -38, 8.5, 0.6, 43.5, D + 8, 2.6, roof); slab(k, 38, 8.5, -0.6, 43.5, D + 8, 2.6, roof);
    k.box(3, 2.4, D + 8.4, mat(k, '#5a2a22', { rough: 0.7 }), k.root, 0, 44.2, 0);
    for (const s of [-1, 1]) for (const sx of [-1, 1]) { const f = slab(k, sx * 38.6, 8, 0, 43.6, 1.6, 2, trim); f.position.z = s * (Z + 4.2); }
    // chimney with a little smoke
    const brick = TM(k, '#ffffff', bricks('#a0442e'), { rough: 0.9 });
    k.box(8, 24, 8, brick, k.root, 19, 30, -10); k.box(9.6, 1.6, 9.6, TM(k, '#8a857c', stone(), { rough: 1 }), k.root, 19, 42.6, -10); k.box(6, 0.4, 6, k.mat('#111', { rough: 1 }), k.root, 19, 43.5, -10);
    const sm = smoke(k, k.root, 19, 46, -10);
    // front door with a frame, panels, knob and a step
    k.box(14, 22, 1.4, wood(k, doorC, true), k.root, 0, -27, Z + 0.3);
    for (const [px, py] of [[-3.3, -21.5], [3.3, -21.5], [-3.3, -31.5], [3.3, -31.5]]) k.box(4.6, 7.5, 0.6, wood(k, doorC, true), k.root, px, py, Z + 1.1);
    k.sphere(0.9, metal(k, '#d4af37', 0.25), k.root, 4.8, -27, Z + 1.6);
    k.box(1.8, 23.5, 2, trim, k.root, -7.9, -26.5, Z + 0.5); k.box(1.8, 23.5, 2, trim, k.root, 7.9, -26.5, Z + 0.5); k.box(17.6, 2, 2.2, trim, k.root, 0, -14.6, Z + 0.5);
    k.box(18, 1.6, 5, TM(k, '#a49e94', stone(), { rough: 1 }), k.root, 0, -38.2, Z + 2.5);
    const gl = glassM(k), shut = wood(k, '#2f5d3a', true, { rough: 0.6 });
    for (const x of [-17, 17]) windowAt(k, k.root, x, -4, Z + 0.3, 13, 12, { frame: trim, glass: gl, sill: true, shutter: shut });
    for (const s of [-1, 1]) windowAt(k, k.root, s * 30.3, -6, 0, 12, 12, { frame: trim, glass: gl, sill: true, ry: s * PI / 2 });
    windowAt(k, k.root, 0, 22, Z, 7, 7, { frame: trim, glass: gl, cross: true });
    return front((en, t) => sm(t));
  };

  N['castle'] = (e, k) => {
    const st = TM(k, k.col('body'), stone(), { rough: 0.92 }), dark = k.mat('#15110d', { rough: 1 }), st2 = TM(k, k.col('body'), stone(), { rough: 0.92, tag2: 1 });
    const merlons = (p, n, w, y, z0, d, tw) => { for (let i = 0; i < n; i++) k.box(tw, 6, d, st, p, -w / 2 + tw / 2 + i * (w - tw) / (n - 1), y, z0); };
    // the curtain wall with its gate
    k.box(68, 48, 24, st, k.root, 0, -24, -2);
    merlons(k.root, 7, 68, 3, 9, 3, 6); merlons(k.root, 7, 68, 3, -13, 3, 6);
    k.box(68, 1.5, 24, st2, k.root, 0, 0.2, -2);
    const gate = k.mesh(sext('gate', [-12, -48, 12, -48, 12, -30].concat(circlePts(0, -30, 12, 12, 0, PI)).concat([-12, -30]), 2, 0, 0.03), dark, k.root, 0, 0, 10.2);
    const arch = torus(k, 13.4, 1.8, PI, st, k.root, 0, -30, 10.4, 6, 16); arch.scale.z = 0.8;
    const iron = metal(k, '#2c2a28', 0.6, { metal: 0.7 }), wd = TM(k, '#6b4a2a', planks(true, 6), { rough: 0.8 });
    k.box(22, 14, 1, wd, k.root, 0, -41, 9.6);
    for (let i = -2; i <= 2; i++) k.box(1, 17, 1, iron, k.root, i * 4.6, -26.5, 11.6);
    for (let j = 0; j < 3; j++) k.box(22, 0.9, 1, iron, k.root, 0, -33 + j * 5.5, 11.8);
    for (let j = 0; j < 5; j++) k.cone(0.7, 2.4, iron, k.root, (j - 2) * 4.6, -36.2, 11.6, 6).rotation.z = PI;
    // two round towers with crenellations and arrow-slit windows
    for (const s of [-1, 1]) {
      const tw = k.group(k.root, s * 46, 0, 0);
      k.cyl(14, 14.5, 70, st, tw, 0, -13, 0, 28);
      k.cyl(15.6, 14.2, 4, st2, tw, 0, 23, 0, 28);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const m = k.box(4.6, 6, 3, st, tw, Math.cos(a) * 14, 28, Math.sin(a) * 14); m.rotation.y = -a + PI / 2; }
      k.cyl(13, 13, 1, dark, tw, 0, 25.2, 0, 24);
      for (const y of [-6, 10]) { const w = k.mesh(sext('slit', [-2.5, -5, 2.5, -5, 2.5, 3].concat(circlePts(0, 3, 2.5, 6, 0, PI)), 1.2, 0, 0.05), dark, tw, 0, y, 14.1); }
      k.cone(14.6, 0.01, st, tw, 0, -48, 0);
    }
    // the keep behind and its flag
    k.box(30, 20, 16, st, k.root, 0, 8, -6); merlons(k.root, 5, 30, 20.5, 1.2, 2.4, 5);
    k.mesh(sext('slit', [-2.5, -5, 2.5, -5, 2.5, 3].concat(circlePts(0, 3, 2.5, 6, 0, PI)), 1.2, 0, 0.05), dark, k.root, 0, 9, 2.1);
    const pole = metal(k, '#8b6b45', 0.5, { metal: 0.3 });
    k.cyl(0.8, 0.8, 26, pole, k.root, 0, 31, -6, 8); k.sphere(1.4, metal(k, '#d4af37', 0.25), k.root, 0, 44.5, -6);
    const fl = cloth(k, k.root, 0.6, 43.5, 20, 13, '#c0392b'); fl.position.z = -6;
    return front((en, t) => fl.wave(t, 1.8));
  };

  N['barn'] = (e, k) => {
    const red = TM(k, k.col('body'), planks(true, 12), { rough: 0.85 }), white = k.mat('#f4f1ea', { rough: 0.7 }), roof = TM(k, '#5d5f66', shingles(), { rough: 0.85 });
    const D = 56, Z = D / 2, out = [-36, -40, 36, -40, 36, 7, 33, 25, 13, 38, -13, 38, -33, 25, -36, 7];
    k.mesh(sext('barnbody', out, D, 0, 0.014), red, k.root);
    const R = [[-42, 5], [-35, 26], [-14, 40.5], [14, 40.5], [35, 26], [42, 5]];
    for (let i = 0; i < R.length - 1; i++) slab(k, R[i][0], R[i][1], R[i + 1][0], R[i + 1][1], D + 8, 2.4, roof);
    // white trim along the gable and the corners
    for (const s of [-1, 1]) {
      const z = s * (Z + 0.4);
      for (let i = 0; i < R.length - 1; i++) { const f = slab(k, R[i][0] * 0.93, R[i][1] - 1.2, R[i + 1][0] * 0.93, R[i + 1][1] - 1.2, 1, 2, white); f.position.z = z; }
      for (const sx of [-1, 1]) k.box(2.2, 47, 1, white, k.root, sx * 35.2, -16.5, z);
      k.box(72, 2, 1, white, k.root, 0, 6.5, z);
    }
    // the big X-braced door and the hay loft door
    const door = (cx, cy, w, h) => {
      k.box(w, h, 1.2, red, k.root, cx, cy, Z + 0.4);
      k.box(w + 2, 2, 1.6, white, k.root, cx, cy + h / 2, Z + 0.8); k.box(w + 2, 2, 1.6, white, k.root, cx, cy - h / 2 + 1, Z + 0.8);
      k.box(2, h, 1.6, white, k.root, cx - w / 2, cy, Z + 0.8); k.box(2, h, 1.6, white, k.root, cx + w / 2, cy, Z + 0.8);
      const L = Math.hypot(w, h) - 2, a = Math.atan2(h, w);
      const b1 = k.box(L, 1.8, 1.4, white, k.root, cx, cy, Z + 0.9); b1.rotation.z = a; const b2 = k.box(L, 1.8, 1.4, white, k.root, cx, cy, Z + 0.9); b2.rotation.z = -a;
    };
    door(-7.5, -25, 14, 30); door(7.5, -25, 14, 30); door(0, 20, 12, 11);
    k.box(4, 2, 8, wood(k, '#6b4a2a', false), k.root, 0, 30, Z + 3);
    for (const s of [-1, 1]) windowAt(k, k.root, s * 36.2, -10, 0, 9, 9, { frame: white, glass: glassM(k), ry: s * PI / 2 });
    // a cupola on the ridge
    k.box(8, 6, 8, white, k.root, 0, 43, 0); k.cone(7.2, 6, roof, k.root, 0, 49, 0, 4).rotation.y = PI / 4;
    return front();
  };

  N['tent'] = (e, k) => {
    const seq = k.def.seq || [], cl = TM(k, k.col('body'), fabric(), { rough: 0.9, side: 'double' }), flapC = TM(k, seq[1] || '#8b3a0f', fabric(), { rough: 0.9, side: 'double' });
    const D = 52, Z = D / 2;
    slab(k, -33, -23, 0.4, 21.4, D, 0.8, cl); slab(k, 33, -23, -0.4, 21.4, D, 0.8, cl);
    const tri = [-33, -23, 33, -23, 0, 21], door = [-8.5, -23, 8.5, -23, 0, -3];
    const fg = geo('i2tentfront', () => { const s = new T.Shape(); s.moveTo(-33, -23); s.lineTo(33, -23); s.lineTo(0, 21); s.closePath(); const h = new T.Path(); h.moveTo(-9, -23); h.lineTo(0, -2); h.lineTo(9, -23); h.closePath(); s.holes.push(h); const g = new T.ShapeGeometry(s); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.02, uv.getY(i) * 0.02); return g; });
    k.mesh(fg, cl, k.root, 0, 0, Z);
    k.mesh(sext('tentback', tri, 0.6, 0, 0.02), cl, k.root, 0, 0, -Z);
    k.mesh(sext('tentdark', [-9.5, -23, 9.5, -23, 0, -1], 0.4, 0, 0.02), k.mat('#1e120a', { rough: 1 }), k.root, 0, 0, Z - 14);
    k.box(30, 0.3, D - 2, k.mat('#2a1d12', { rough: 1 }), k.root, 0, -22.8, 0);
    // tied-back door flaps
    for (const s of [-1, 1]) { const f = k.mesh(sext('tentflap', [0, -23, s * 9, -23, 0, -2], 0.5, 0, 0.02), flapC, k.root, s * 8.5, 0, Z + 0.6); f.rotation.y = s * 0.5; }
    // poles, guy ropes and pegs
    const pole = wood(k, '#c9a66b', true), rp = rope(k), peg = metal(k, '#9aa5b1', 0.5);
    for (const s of [-1, 1]) {
      k.cyl(0.7, 0.7, 10, pole, k.root, 0, 25, s * (Z - 0.5), 8);
      const top = new T.Vector3(0, 29, s * (Z - 0.5)), gp = new T.Vector3(0, -23, s * (Z + 14)), mid = top.clone().add(gp).multiplyScalar(0.5);
      const r = k.cyl(0.25, 0.25, top.distanceTo(gp), rp, k.root, mid.x, mid.y, mid.z, 5); r.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), gp.clone().sub(top).normalize());
      k.cyl(0.4, 0.2, 4, peg, k.root, 0, -22, s * (Z + 14), 6);
    }
    return front();
  };

  N['igloo'] = (e, k) => {
    const snow = TM(k, k.col('body'), snowBlocks(), { rough: 0.55, glow: '#cfe6ff', glowK: 0.08 });
    const dome = k.mesh(geo('i2dome', () => new T.SphereGeometry(1, 32, 12, 0, TAU, 0, PI / 2)), snow, k.root, 0, -18, 0); dome.scale.set(31, 33, 27);
    const tun = k.mesh(geo('i2tunnel', () => new T.CylinderGeometry(10, 10, 16, 16, 1, true, -PI / 2, PI)), TM(k, k.col('body'), snowBlocks(), { rough: 0.55, glow: '#cfe6ff', glowK: 0.08, side: 'double' }), k.root, 9, -18, 29);
    tun.rotation.x = PI / 2; tun.rotation.y = 0; tun.rotation.z = 0;
    tun.rotation.set(-PI / 2, 0, 0);
    const hole = disc(k, 7.6, k.mat('#1a2633', { rough: 1 }), k.root, 9, -18, 37.1); hole.scale.y = 7.6; hole.geometry = geo('i2halfdisc', () => new T.CircleGeometry(1, 20, 0, PI));
    k.mesh(geo('i2halfring', () => new T.RingGeometry(7.6, 10, 20, 1, 0, PI)), snow, k.root, 9, -18, 37.05);
    const g = k.sphere([38, 2.2, 34], k.mat('#f4f9ff', { rough: 0.9 }), k.root, 0, -18.5, 2);
    return front();
  };

  const facade = c => tex('facade' + c, 256, 512, (x, w, h, r) => {
    x.fillStyle = c; x.fillRect(0, 0, w, h);
    const cols = 6, rows = 24, cw = w / cols, rh = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const g = x.createLinearGradient(i * cw, j * rh, (i + 1) * cw, (j + 1) * rh), sky = 0.5 + 0.5 * Math.sin(i * 0.9 + j * 0.15);
      g.addColorStop(0, `rgb(${70 + sky * 60 | 0},${100 + sky * 60 | 0},${125 + sky * 50 | 0})`); g.addColorStop(1, '#1f3343');
      x.fillStyle = g; x.fillRect(i * cw + 4, j * rh + 3, cw - 8, rh - 6);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i * cw + 4, j * rh + 3, cw - 8, 1.5);
    }
    for (let i = 0; i <= cols; i++) { x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(i * cw - 1, 0, 1.5, h); }
  });
  const facadeLit = () => tex('facadeLit', 256, 512, (x, w, h, r) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const cols = 6, rows = 24, cw = w / cols, rh = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() < 0.2) { x.fillStyle = `rgb(255,${200 + r() * 40 | 0},${130 + r() * 50 | 0})`; x.fillRect(i * cw + 4, j * rh + 3, cw - 8, rh - 6); }
  });
  N['skyscraper'] = (e, k) => {
    const c = k.col('body'), fm = TM(k, '#ffffff', facade(c), { rough: 0.22, metal: 0.3, envK: 1.1, glow: '#ffffff', glowK: 0.35 });
    if (!fm.emissiveMap) { fm.emissiveMap = facadeLit(); fm.needsUpdate = true; }
    const frame = mat(k, c, { rough: 0.5, metal: 0.4 }), dk = glassM(k);
    k.box(52, 146, 44, fm, k.root, 0, -5, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(2.4, 146, 2.4, frame, k.root, sx * 26, -5, sz * 22);
    k.box(56, 8, 48, frame, k.root, 0, -76, 0);
    k.box(30, 6.5, 1, dk, k.root, 0, -76.5, 24.1); k.box(0.6, 6.5, 1.2, frame, k.root, 0, -76.5, 24.3);
    k.box(40, 1.5, 6, frame, k.root, 0, -71.5, 26);
    k.box(54, 2.5, 46, frame, k.root, 0, 69, 0);
    k.box(20, 10, 18, frame, k.root, 0, 73, -4); k.box(6, 3, 6, metal(k, '#8a939c', 0.5), k.root, 16, 71.8, 10); k.box(5, 3, 5, metal(k, '#8a939c', 0.5), k.root, -15, 71.8, -12);
    k.cyl(0.7, 1, 14, metal(k, '#c0c6cc', 0.3), k.root, 0, 85, -4, 8);
    const bea = k.sphere(1.3, k.mat('#ff2a1a', { glow: '#ff2a1a', glowK: 2 }), k.root, 0, 92.5, -4), bh = halo(k, k.root, '#ff3a2a', 14, 0, 92.5, -3.5, 0.6);
    return front((en, t) => { const on = (t + en.seed) % 1.6 < 0.8; bea.visible = on; bh.visible = on; });
  };

  N['school'] = (e, k) => {
    const brick = TM(k, '#ffffff', bricks(k.col('body')), { rough: 0.9 }), white = k.mat('#f6f3ec', { rough: 0.6 }), roof = TM(k, '#6a6e76', shingles(), { rough: 0.85 });
    const D = 46, Z = D / 2;
    k.box(110, 55, D, brick, k.root, 0, -7.5, 0);
    k.box(112, 3, D + 2, TM(k, '#9a948a', stone(), { rough: 1 }), k.root, 0, -33.5, 0);
    for (const s of [-1, 1]) k.mesh(sext('schoolgable', [-55, 0, 55, 0, 0, 14], 1, 0, 0.01), white, k.root, 0, 20, s * (Z - 0.5));
    slab(k, -59, 19, 0.5, 35, D + 6, 2.2, roof); slab(k, 59, 19, -0.5, 35, D + 6, 2.2, roof);
    k.box(112, 2.5, D + 1.4, white, k.root, 0, 19.2, 0);
    const sign = tex('schoolsign', 256, 48, (x) => { x.fillStyle = '#f8f5ee'; x.fillRect(0, 0, 256, 48); x.strokeStyle = '#2c3e73'; x.lineWidth = 4; x.strokeRect(3, 3, 250, 42); x.fillStyle = '#2c3e73'; x.font = 'bold 32px ' + FONT(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SCHOOL', 128, 26); }, { clamp: true });
    k.box(44, 8.5, 1, TM(k, '#ffffff', sign, { rough: 0.6 }), k.root, 0, 10, Z + 0.5);
    const gl = glassM(k);
    for (const x of [-42, -25, 25, 42]) windowAt(k, k.root, x, -10, Z + 0.2, 12, 15, { frame: white, glass: gl, sill: true, crossY: 2 });
    for (const s of [-1, 1]) for (const z of [-11, 11]) windowAt(k, k.root, s * 55.2, -10, z, 11, 14, { frame: white, glass: gl, ry: s * PI / 2 });
    // double doors under a little porch roof, with steps
    for (const s of [-1, 1]) { k.box(7.6, 19, 1.2, mat(k, '#2c5aa0', { rough: 0.5 }), k.root, s * 3.9, -22, Z + 0.4); k.box(1.4, 7, 0.4, gl, k.root, s * 3.9, -17, Z + 1.1); k.box(0.6, 3, 0.8, metal(k, '#c9ced4', 0.3), k.root, s * 1.2, -23, Z + 1.3); }
    k.box(18, 2, 2, white, k.root, 0, -12, Z + 0.8); for (const s of [-1, 1]) k.box(2, 20, 2, white, k.root, s * 8.4, -22, Z + 0.8);
    k.box(24, 1.4, 8, white, k.root, 0, -10.2, Z + 4); for (const s of [-1, 1]) k.cyl(0.8, 0.8, 21, white, k.root, s * 10.5, -21, Z + 7, 8);
    k.box(20, 1.6, 4, TM(k, '#a8a29a', stone(), { rough: 1 }), k.root, 0, -34.2, Z + 2); k.box(16, 1.6, 3, TM(k, '#a8a29a', stone(), { rough: 1 }), k.root, 0, -32.6, Z + 1.5);
    // a bell cupola on the ridge and a flag on the roof
    k.box(11, 8, 11, white, k.root, 0, 37, 0); k.box(6, 5, 11.4, k.mat('#2a2a2a', { rough: 1 }), k.root, 0, 37.5, 0); k.sphere(1.6, metal(k, '#d4af37', 0.3), k.root, 0, 37, 4.5);
    k.cone(9, 8, roof, k.root, 0, 45, 0, 4).rotation.y = PI / 4;
    k.cyl(0.6, 0.6, 30, metal(k, '#c0c6cc', 0.3), k.root, 48, 36, 8, 8); k.sphere(1, metal(k, '#d4af37', 0.25), k.root, 48, 51.5, 8);
    const fl = cloth(k, k.root, 48.5, 50.5, 15, 10, '#3d7ee8'); fl.position.z = 8;
    return front((en, t) => fl.wave(t, 1.4));
  };

  N['temple'] = (e, k) => {
    const mb = TM(k, k.col('body'), marble(), { rough: 0.5, env: 1, envK: 0.3 }), fl = TM(k, k.col('body'), flutes(), { rough: 0.5 }), dark = TM(k, '#6e675c', marble(), { rough: 0.8 });
    k.box(124, 12, 70, mb, k.root, 0, -42, 0); k.box(114, 10, 62, mb, k.root, 0, -31, 0); k.box(106, 2, 56, mb, k.root, 0, -25, 0);
    k.box(78, 44, 30, dark, k.root, 0, -2, -6);
    k.box(18, 32, 1, k.mat('#1a1510', { rough: 1 }), k.root, 0, -8, 9.2);
    const col = (x, z) => {
      k.mesh(geo('i2column', () => new T.CylinderGeometry(4.3, 5, 42, 20, 1, true)), fl, k.root, x, -3, z);
      k.cyl(6, 6, 2.2, mb, k.root, x, -23, z, 20);
      k.cyl(6.2, 4.4, 2.4, mb, k.root, x, 19.2, z, 20);
      k.box(13, 2.4, 13, mb, k.root, x, 21.6, z);
    };
    for (let i = -2; i <= 2; i++) { col(i * 24, 22); col(i * 24, -24); }
    for (const s of [-1, 1]) col(s * 48, -1);
    k.box(122, 4, 60, mb, k.root, 0, 24.8, -1);
    const frieze = tex('frieze', 512, 32, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 32); for (let i = 0; i < 24; i++) { x.fillStyle = '#c9c4bb'; x.fillRect(i * 21.3 + 2, 3, 9, 26); x.fillStyle = '#e4e0d8'; x.fillRect(i * 21.3 + 4.5, 3, 1.5, 26); x.fillRect(i * 21.3 + 7.5, 3, 1.5, 26); } });
    k.box(122, 5, 60, TM(k, k.col('body'), frieze, { rough: 0.6 }), k.root, 0, 29, -1);
    k.box(128, 1.6, 64, mb, k.root, 0, 32.2, -1);
    k.mesh(sext('pediment', [-64, 0, 64, 0, 0, 16], 62, 0, 0.012), mb, k.root, 0, 33, -1);
    k.mesh(sext('tympanum', [-54, 0, 54, 0, 0, 11.5], 1, 0, 0.012), dark, k.root, 0, 34.6, 30.3);
    slab(k, -66, 32.6, 0.5, 49.4, 66, 1.4, mb); slab(k, 66, 32.6, -0.5, 49.4, 66, 1.4, mb);
    torus(k, 3.6, 0.8, TAU, metal(k, '#d4af37', 0.3), k.root, 0, 39, 31.2, 6, 20); disc(k, 3, metal(k, '#d4af37', 0.3), k.root, 0, 39, 31.1);
    return front();
  };
  // =====================================================================================================
  // ---------- yard things ----------
  N['trap'] = (e, k) => {
    // a bear trap: two toothed half-ring jaws hinged along x lie open on the ground; when it snaps they stand up and bite
    const steel = metal(k, k.col('body'), 0.45, { metal: 0.85 }), dark = metal(k, '#4a4643', 0.6, { metal: 0.7 });
    k.box(30, 1.6, 5, dark, k.root, 0, -12.2, 0);
    for (const s of [-1, 1]) {
      k.tube([[s * 12, -12, 1.8], [s * 22, -12, 1.8], [s * 25.5, -11, 0], [s * 22, -10, -1.8], [s * 12, -10, -1.8]], 0.9, 0.9, steel, k.root, 14, 6);
      k.box(2.4, 4, 4, dark, k.root, s * 13, -10.5, 0);
    }
    k.cyl(4.6, 4.6, 0.8, dark, k.root, 0, -10.8, 0, 18);
    k.box(1, 0.6, 9, steel, k.root, 0, -10.2, 4);
    const ring = torus(k, 2.4, 0.5, TAU, steel, k.root, -27, -11.5, 0, 6, 14); ring.rotation.y = PI / 2;
    const jaw = s => {
      const p = k.group(k.root, 0, -10, 0), pts = [];
      for (let i = 0; i <= 12; i++) { const a = PI * i / 12; pts.push([-Math.cos(a) * 13, 0, s * Math.sin(a) * 11]); }
      k.tube(pts, 1.1, 1.1, steel, p, 24, 6);
      for (let i = 1; i < 12; i++) { const a = PI * i / 12, c = k.cone(1.2, 4, steel, p, -Math.cos(a) * 13, 2, s * Math.sin(a) * 11, 6); c.rotation.x = s * -0.25; }
      return p;
    };
    const fj = jaw(1), bj = jaw(-1);
    let a = e.armed ? 0 : 1;
    return (en, t, dt) => {
      const want = en.armed ? 0 : 1; a += (want - a) * Math.min(1, dt * (want ? 40 : 3));
      fj.rotation.x = -a * (PI / 2 - 0.1); bj.rotation.x = a * (PI / 2 - 0.1);
    };
  };

  N['fence'] = (e, k) => {
    const w = wood(k, k.col('body'), true, { rough: 0.8 }), wr = wood(k, k.col('body'), false, { rough: 0.8 });
    const pk = sext('picket', [-3, -18, 3, -18, 3, 12, 0, 17, -3, 12], 1.8, 0.3, 0.03);
    for (let i = -3; i <= 3; i++) k.mesh(pk, w, k.root, i * 13, 0, 0.6);
    for (const y of [-8, 5]) k.box(84, 3, 1.6, wr, k.root, 0, y, -1);
    for (const s of [-1, 1]) k.box(3.6, 34, 3.6, w, k.root, s * 41, -1, -1.6);
    return null;
  };

  N['door'] = (e, k) => {
    const wd = wood(k, k.col('body'), true, { rough: 0.6 }), frame = wood(k, '#6b4424', true, { rough: 0.7 }), brass = metal(k, '#d4af37', 0.25);
    k.box(3, 62, 7, frame, k.root, -14.5, 0, 0); k.box(3, 62, 7, frame, k.root, 14.5, 0, 0); k.box(32, 3, 7, frame, k.root, 0, 29.5, 0);
    k.box(32, 1, 8, TM(k, '#9a948a', stone(), { rough: 1 }), k.root, 0, -30.5, 0);
    const hinge = k.group(k.root, -13, 0, 1.4), slab2 = k.group(hinge, 13, -1.5, 0);
    k.box(26, 57, 2.6, wd, slab2);
    for (const z of [1.4, -1.4]) for (const y of [13, -13]) k.rbox(19, 20, 0.8, wd, slab2, 0, y, z, 0.35);
    for (const z of [1, -1]) { k.sphere(1.3, brass, slab2, 10, -1, z * 2.4); k.box(2, 4, 0.4, brass, slab2, 10, -2, z * 1.5); }
    for (const y of [19, -19]) k.box(1.6, 5, 3, metal(k, '#3a3530', 0.5), slab2, -12.6, y, 0);
    let a = 0;
    return (en, t, dt) => {   // swings open when someone walks up to it
      faceCam(en, k);
      const want = nearCreature(en, en.w / 2 + 30) ? -1.25 : 0; a += (want - a) * Math.min(1, dt * 4); hinge.rotation.y = a;
    };
  };

  N['ladder'] = (e, k) => {
    const r = wood(k, '#a8743d', true), rung = wood(k, '#c69c6d', false);
    for (const s of [-1, 1]) k.box(4, 90, 3, r, k.root, s * 11, 0, 0);
    for (let i = 0; i < 7; i++) { const c = k.cyl(1.4, 1.4, 19, rung, k.root, 0, 38.5 - i * 13, 0, 10); c.rotation.z = PI / 2; }
    return null;
  };

  N['sign'] = (e, k) => {
    const wd = TM(k, k.col('body'), planks(false, 3), { rough: 0.8 }), post = wood(k, '#8b5a2b', true);
    k.box(4, 32, 4, post, k.root, 0, -12, -1.8);
    k.box(44, 26, 2.4, wd, k.root, 0, 15, 0);
    const txt = e.label || 'HELLO!';
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 150; const x = cv.getContext('2d');
    x.fillStyle = '#2a1a0e'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold ' + (txt.length > 8 ? 40 : 56) + 'px ' + FONT(); x.fillText(txt.length > 12 ? txt.slice(0, 12) : txt, 128, 78);
    const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding;
    const m = k.mat('#ffffff', { rough: 0.8, opacity: 0.99, tag: 'signtext' }); m.map = t; m.needsUpdate = true;
    plane(k, 42, 24.6, m, k.root, 0, 15, 1.25);
    for (const y of [5, 25]) for (const x2 of [-18, 18]) k.sphere(0.6, metal(k, '#555', 0.5), k.root, x2, y, 1.25);
    return front();
  };

  N['flag'] = (e, k) => {
    const seq = k.def.seq || [];
    k.cyl(1.1, 1.3, 70, metal(k, seq[0] || '#8c8c8c', 0.3), k.root, -16, 0, 0, 12);
    k.sphere(2.1, metal(k, '#d4af37', 0.25), k.root, -16, 36, 0);
    const fl = cloth(k, k.root, -15.2, 33.5, 34, 29, k.col('body'));
    return (en, t) => fl.wave(t, 3.2);
  };

  const ripTex = () => tex('rip', 256, 256, (x) => {
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const carve = (fn) => { x.fillStyle = 'rgba(255,255,255,0.45)'; x.save(); x.translate(0, 3); fn(); x.restore(); x.fillStyle = 'rgba(30,30,32,0.9)'; fn(); };
    carve(() => { x.fillRect(118, 30, 20, 70); x.fillRect(96, 48, 64, 16); });
    carve(() => { x.font = 'bold 64px Georgia, serif'; x.fillText('R.I.P.', 128, 150); });
    carve(() => x.fillRect(64, 196, 128, 6));
  }, { clamp: true });
  N['grave'] = (e, k) => {
    const gr = TM(k, k.col('body'), granite(), { rough: 0.75 });
    k.mesh(sext('headstone', [-15, -18, 15, -18, 15, 4].concat(circlePts(0, 4, 15, 16, 0, PI)), 7, 1.2, 0.03), gr, k.root);
    decal(k, ripTex(), 26, 26, k.root, 0, -3, 3.55);
    k.box(38, 4, 14, gr, k.root, 0, -20, 0);
    k.sphere([15, 3, 9], TM(k, '#6b4a2b', granite(), { rough: 1 }), k.root, 0, -22, 14);
    return front();
  };

  // =====================================================================================================
  // ---------- furniture ----------
  N['chair'] = (e, k) => {
    const w = wood(k, k.col('body'), false), d = wood(k, '#7a4e2a', true);
    k.box(30, 3.5, 28, w, k.root, 0, -1.8, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(3, 20, 3, d, k.root, sx * 12, -13, sz * 12);
    for (const sx of [-1, 1]) k.box(3, 24, 3, d, k.root, sx * 12, 11, -12);
    k.box(27, 4.5, 2.4, w, k.root, 0, 20.5, -12); k.box(24, 3, 2, w, k.root, 0, 12, -12); k.box(24, 3, 2, w, k.root, 0, 4, -12);
    for (const sz of [-1, 1]) k.box(22, 1.6, 1.6, d, k.root, 0, -16, sz * 12);
    k.rbox(25, 3, 23, TM(k, '#a83a3a', fabric(), { rough: 0.95 }), k.root, 0, 1.4, 1, 1.2);
    return front();
  };
  const tableLeg = () => slathe('tableleg', [[0, -15], [1.6, -15], [1.9, -13], [1.4, -10], [1.5, -2], [2.3, 0], [2.3, 4], [1.8, 6], [2.2, 8], [2.2, 14], [0, 14]], 12);
  N['table'] = (e, k) => {
    const top = wood(k, k.col('body'), false, { rough: 0.35, env: 1, envK: 0.35 }), d = wood(k, '#7a4e2a', true);
    k.rbox(64, 5, 40, top, k.root, 0, 15.5, 0, 1.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.mesh(tableLeg(), d, k.root, sx * 27, -3, sz * 15);
    for (const sz of [-1, 1]) k.box(52, 4, 1.4, d, k.root, 0, 10.8, sz * 15);
    for (const sx of [-1, 1]) k.box(1.4, 4, 28, d, k.root, sx * 27, 10.8, 0);
    return front();
  };
  // a soft pillow: a box puffed out in the middle and pinched at the seams
  const pillowGeo = () => geo('i2pillow', () => {
    const g = new T.BoxGeometry(1, 1, 1, 12, 8, 3), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) * 2, y = P.getY(i) * 2, f = (1 - x * x) * (1 - y * y);
      P.setXYZ(i, P.getX(i) * (1 - 0.07 * (1 - y * y)), P.getY(i) * (1 - 0.12 * (1 - x * x)), P.getZ(i) * (0.12 + 1.75 * f));
    }
    g.computeVertexNormals(); return g;
  });
  N['pillow'] = (e, k) => {
    const pm = k.mesh(pillowGeo(), TM(k, k.col('body'), fabric(), { rough: 0.95 }), k.root); pm.scale.set(38, 24, 13); pm.rotation.x = -0.15;
    return null;
  };
  N['bed'] = (e, k) => {
    const seq = k.def.seq || [], fw = wood(k, seq[0] || '#8b5a2b', true), fh = wood(k, seq[0] || '#8b5a2b', false);
    const cover = TM(k, seq[1] || k.col('body'), fabric(), { rough: 0.95 }), sheet = TM(k, '#f6f4ee', fabric(), { rough: 0.95 });
    k.box(3, 30, 38, fh, k.root, -33.5, 3, 0);
    for (const sz of [-1, 1]) { k.cyl(1.9, 1.9, 40, fw, k.root, -33.5, 0, sz * 19, 10); k.sphere(2.4, fw, k.root, -33.5, 20.5, sz * 19); }
    for (const sz of [-1, 1]) { k.cyl(1.6, 1.6, 18, fw, k.root, 34.5, -11, sz * 19, 10); k.sphere(2, fw, k.root, 34.5, -1.5, sz * 19); }
    k.box(3, 10, 38, fh, k.root, 34.5, -9, 0);
    for (const sz of [-1, 1]) k.box(66, 5, 2, fh, k.root, 1, -12, sz * 18.6);
    k.rbox(66, 8, 36, sheet, k.root, 1, -6.5, 0, 2.5);
    k.rbox(50, 4.5, 37.6, cover, k.root, 9.5, -1.6, 0, 1.6);
    for (const sz of [-1, 1]) k.rbox(50, 9, 1.6, cover, k.root, 9.5, -6, sz * 18.6, 0.7);
    const fold = k.cyl(2.6, 2.6, 37.8, cover, k.root, -15.5, -1.2, 0, 12); fold.rotation.x = PI / 2;
    const pg = k.group(k.root, -24, 4.2, 0); pg.rotation.set(0, PI / 2, 0.25);
    const pm = k.mesh(pillowGeo(), TM(k, seq[2] || '#ffffff', fabric(), { rough: 0.95 }), pg); pm.scale.set(30, 13, 8); pm.rotation.x = -PI / 2;
    return front();
  };
  N['couch'] = (e, k) => {
    const f = TM(k, k.col('body'), fabric(), { rough: 0.95 }), f2 = TM(k, shadeHex(k.col('body'), 0.85), fabric(), { rough: 0.95 });
    k.rbox(74, 12, 34, f2, k.root, 0, -9, 0, 2);
    for (const s of [-1, 1]) k.rbox(30, 7, 29, f, k.root, s * 15.2, -0.5, 2, 2.6);
    k.rbox(66, 18, 8, f2, k.root, 0, 7, -13, 2.5);
    for (const s of [-1, 1]) { const c = k.rbox(30, 15, 8, f, k.root, s * 15.2, 10, -8.5, 3.2); c.rotation.x = -0.12; }
    for (const s of [-1, 1]) { k.rbox(8, 20, 34, f2, k.root, s * 33, -4, 0, 3); const tp = k.cyl(4.2, 4.2, 34, f2, k.root, s * 33, 6, 0, 16); tp.rotation.x = PI / 2; }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(1.4, 1, 4, wood(k, '#3a2616', true), k.root, sx * 33, -17, sz * 14, 8);
    return front();
  };

  // =====================================================================================================
  // ---------- gadgets ----------
  // TV static, shared by every TV and redrawn a few times a second
  let staticTex = null, staticAt = -1;
  function tvStatic(t) {
    if (!staticTex) { const c = document.createElement('canvas'); c.width = 96; c.height = 64; staticTex = new T.Texture(c); staticTex.encoding = T.sRGBEncoding; staticTex.userData.ctx = c.getContext('2d'); staticTex.userData.img = staticTex.userData.ctx.createImageData(96, 64); }
    if (t - staticAt > 0.07 || t < staticAt) {
      staticAt = t; const d = staticTex.userData.img.data;
      for (let y = 0; y < 64; y++) { const band = 0.75 + 0.25 * Math.sin(y * 0.4 + t * 9); for (let x = 0; x < 96; x++) { const v = (Math.random() * 230 * band) | 0, o = (y * 96 + x) * 4; d[o] = v * 0.95; d[o + 1] = v; d[o + 2] = v * 1.08; d[o + 3] = 255; } }
      staticTex.userData.ctx.putImageData(staticTex.userData.img, 0, 0); staticTex.needsUpdate = true;
    }
    return staticTex;
  }
  N['tv'] = (e, k) => {
    const seq = k.def.seq || [], body = mat(k, seq[0] || k.col('body'), { rough: 0.4, env: 1, envK: 0.4 }), dark = k.mat('#161616', { rough: 0.6 }), chrome = metal(k, '#c9ced4', 0.25);
    k.rbox(44, 30, 30, body, k.root, 0, 3, -2, 3);
    k.rbox(37, 24, 1.6, dark, k.root, -2, 3, 13.4, 0.8);
    const scr = k.mat('#ffffff', { rough: 0.25, glow: '#ffffff', glowK: 0.85, tag: 'tvscreen' }); shine(scr, { env: 1, envK: 0.5 });
    const sm = k.mesh(geo('i2tvscreen', () => { const g = new T.PlaneGeometry(1, 1, 8, 6), P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, 0.06 * (1 - 4 * P.getX(i) ** 2) * (1 - 4 * P.getY(i) ** 2)); g.computeVertexNormals(); return g; }), scr, k.root, -2, 3, 14.3);
    sm.scale.set(33, 20, 12);
    for (let i = 0; i < 2; i++) { const kn = k.cyl(1.6, 1.6, 1.4, chrome, k.root, 19, 8 - i * 6, 13.3, 12); kn.rotation.x = PI / 2; }
    for (let i = 0; i < 4; i++) k.box(0.4, 7, 0.4, dark, k.root, 18 + (i % 2) * 2.4 - 1.2, -6, 13.4).position.y = -6 - (i > 1 ? 0 : 0);
    for (const s of [-1, 1]) { const l = k.cyl(0.9, 0.7, 11, dark, k.root, s * 12, -16.5, 0, 8); l.rotation.z = s * 0.35; }
    for (const s of [-1, 1]) { const a = k.cyl(0.35, 0.35, 13, chrome, k.root, s * 9, 23.5, -4, 6); a.rotation.z = -s * 0.55; k.sphere(0.9, chrome, k.root, s * 12.4, 29, -4); }
    k.sphere([4, 2, 3], dark, k.root, 0, 18, -4);
    const hl = halo(k, k.root, '#cfe4ff', 60, -2, 3, 16, 0.18);
    return (en, t) => { faceCam(en, k); const tx = tvStatic(t); if (scr.map !== tx) { scr.map = tx; scr.emissiveMap = tx; scr.needsUpdate = true; } };
  };
  const phoneTex = () => tex('phonescreen', 128, 256, (x, w, h, r) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#3a6fd8'); g.addColorStop(0.6, '#8e44ad'); g.addColorStop(1, '#f28cb1'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.font = 'bold 22px ' + FONT(); x.textAlign = 'center'; x.fillText('9:41', 64, 40);
    const cols = ['#4caf50', '#f4862c', '#e63946', '#26a69a', '#f6d13b', '#3d7ee8', '#b57edc', '#ffffff'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = cols[(i + j * 3) % 8]; const px = 12 + i * 28, py = 64 + j * 34; x.beginPath(); x.moveTo(px + 5, py); x.arcTo(px + 22, py, px + 22, py + 22, 6); x.arcTo(px + 22, py + 22, px, py + 22, 6); x.arcTo(px, py + 22, px, py, 6); x.arcTo(px, py, px + 22, py, 6); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(8, 212, 112, 34);
  }, { clamp: true });
  N['phone'] = (e, k) => {
    const g = k.group(k.root);
    k.rbox(20, 36, 2.4, mat(k, k.col('body'), { rough: 0.2, metal: 0.4 }), g, 0, 0, 0, 1.1);
    const scr = TM(k, '#ffffff', phoneTex(), { rough: 0.1, glow: '#ffffff', glowK: 0.75, emap: 1, env: 1, envK: 0.6 });
    plane(k, 17.6, 32.6, scr, g, 0, 0, 1.22);
    k.sphere(0.6, k.mat('#111', { rough: 0.2 }), g, 0, 16.6, 1.15);
    k.rbox(6, 6, 1, mat(k, '#333', { rough: 0.3, metal: 0.5 }), g, -5, 13, -1.4, 0.8);
    for (const y of [11.5, 14.5]) { const l = k.cyl(1.2, 1.2, 0.6, glass(k, '#223', 0.9), g, -5.5, y, -2, 12); l.rotation.x = PI / 2; }
    return (en, t) => {
      faceCam(en, k);
      const r = en.ring > 0; g.position.x = r ? Math.sin(t * 90) * 0.8 : 0; g.rotation.z = r ? Math.sin(t * 70) * 0.06 : 0; scr.emissiveIntensity = r ? 1 + 0.5 * Math.sin(t * 20) : 0.75;
    };
  };
  const deskTex = () => tex('desktop', 256, 160, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1d5fa8'); g.addColorStop(1, '#4fb0d8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#111'; x.fillRect(30, 22, 170, 100); x.fillStyle = '#3a3a3a'; x.fillRect(30, 22, 170, 12);
    for (let i = 0; i < 3; i++) { x.fillStyle = ['#e63946', '#f6d13b', '#4caf50'][i]; x.beginPath(); x.arc(38 + i * 9, 28, 3, 0, TAU); x.fill(); }
    x.fillStyle = '#5dff7a'; x.font = 'bold 20px monospace'; x.fillText('> hello world', 38, 58); x.fillText('> _', 38, 84);
    x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(0, h - 14, w, 14);
    for (let i = 0; i < 5; i++) { x.fillStyle = ['#f4862c', '#3d7ee8', '#4caf50', '#e63946', '#8e44ad'][i]; x.fillRect(8 + i * 16, h - 12, 10, 10); }
  }, { clamp: true });
  const keysTex = () => tex('keys', 256, 64, (x, w, h) => {
    x.fillStyle = '#202224'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 14; i++) { x.fillStyle = '#d9dcdf'; x.fillRect(4 + i * 17.8 + (j % 2) * 4, 4 + j * 14, 15, 11); }
    x.fillStyle = '#202224'; x.fillRect(0, 46, w, 18); x.fillStyle = '#d9dcdf'; x.fillRect(70, 48, 110, 11);
  }, { clamp: true });
  N['computer'] = (e, k) => {
    const alu = metal(k, k.col('body'), 0.35, { metal: 0.7 }), blk = mat(k, '#1a1a1a', { rough: 0.3, env: 1 });
    k.rbox(44, 28, 2.4, alu, k.root, 0, 6, -6, 1);
    k.box(41, 25, 0.3, blk, k.root, 0, 6.5, -4.7);
    plane(k, 39, 22.5, TM(k, '#ffffff', deskTex(), { rough: 0.15, glow: '#ffffff', glowK: 0.8, emap: 1, env: 1, envK: 0.4 }), k.root, 0, 6.8, -4.5);
    k.box(6, 10, 2, alu, k.root, 0, -11, -8); k.rbox(16, 1.2, 11, alu, k.root, 0, -19.4, -8, 0.5);
    const kb = k.group(k.root, 0, -18, 9); kb.rotation.x = 0.28;
    k.rbox(48, 2.4, 13, alu, kb, 0, 0, 0, 0.8);
    const kt = plane(k, 46, 11.5, TM(k, '#ffffff', keysTex(), { rough: 0.6 }), kb, 0, 1.25, 0); kt.rotation.x = -PI / 2;
    k.rbox(4.5, 2, 7, alu, k.root, 27.5, -19, 9, 1);
    return front();
  };
  const clockTex = () => tex('clockface', 256, 256, (x) => {
    x.fillStyle = '#fbfaf6'; x.beginPath(); x.arc(128, 128, 128, 0, TAU); x.fill();
    x.fillStyle = '#1b1b1b';
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, L = i % 5 ? 8 : 20, wd = i % 5 ? 2.5 : 6; x.save(); x.translate(128, 128); x.rotate(a); x.fillRect(-wd / 2, -122, wd, L); x.restore(); }
    x.font = 'bold 34px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU; x.fillText(String(i), 128 + Math.sin(a) * 82, 130 - Math.cos(a) * 82); }
  }, { clamp: true });
  N['clock'] = (e, k) => {
    const caseM = mat(k, k.col('body'), { rough: 0.3, env: 1, envK: 0.5 }), dk = mat(k, '#111', { rough: 0.3, metal: 0.4 });
    const c = k.cyl(15, 15, 5, caseM, k.root, 0, 0, -0.5, 36); c.rotation.x = PI / 2;
    torus(k, 14.2, 1.6, TAU, metal(k, '#c9a227', 0.3), k.root, 0, 0, 2, 8, 40);
    disc(k, 13, TM(k, '#ffffff', clockTex(), { rough: 0.6 }), k.root, 0, 0, 2.05);
    const hand = (L, wd, z, m) => { const p = k.group(k.root, 0, 0, z); k.box(wd, L, 0.4, m, p, 0, L / 2 - 1.5, 0); return p; };
    const hh = hand(8.5, 1.5, 2.3, dk), mh = hand(11.5, 1, 2.6, dk), sh = hand(12, 0.35, 2.9, k.mat('#c0392b', { rough: 0.4 }));
    k.sphere([1.1, 1.1, 0.6], metal(k, '#c9a227', 0.3), k.root, 0, 0, 3.1);
    disc(k, 13.4, glass(k, '#ffffff', 0.12), k.root, 0, 0, 3.4);
    for (const s of [-1, 1]) k.sphere([2, 1.4, 2], dk, k.root, s * 8, -14.2, 0);
    return (en) => {   // real time
      faceCam(en, k);
      const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
      hh.rotation.z = -h / 12 * TAU; mh.rotation.z = -m / 60 * TAU; sh.rotation.z = -Math.floor(s) / 60 * TAU;
    };
  };
  N['lamp'] = (e, k) => {
    const seq = k.def.seq || [], base = metal(k, seq[0] || '#6c7a89', 0.3, { metal: 0.8 }), shadeC = seq[1] || k.col('body');
    k.mesh(slathe('lampbase', [[0, -27], [10, -27], [10, -26], [8, -24], [3, -22.5], [1.2, -21], [0, -21]], 28), base, k.root);
    k.cyl(0.9, 0.9, 32, base, k.root, 0, -6, 0, 10);
    k.mesh(slathe('lampshade', [[15, 8], [9, 27]], 32), TM(k, shadeC, fabric(), { rough: 0.9, side: 'double', glow: '#ffcf7a', glowK: 0.45 }), k.root);
    torus(k, 15, 0.4, TAU, base, k.root, 0, 8, 0, 4, 32).rotation.x = PI / 2; torus(k, 9, 0.4, TAU, base, k.root, 0, 27, 0, 4, 32).rotation.x = PI / 2;
    noSh(k.sphere([3.4, 4.2, 3.4], glowM(k, '#fff3c8', 1), k.root, 0, 13, 0));
    halo(k, k.root, '#ffd884', 70, 0, 14, 2, 0.35);
    k.sphere(1, base, k.root, 0, 28, 0);
    return null;
  };
  N['candle'] = (e, k) => {
    const wax = mat(k, k.col('body'), { rough: 0.45, glow: '#ffb070', glowK: 0.1 });
    k.mesh(slathe('dish', [[0, -18], [7, -18], [7, -16.6], [6.4, -16.8], [2.5, -17], [0, -17]], 24), metal(k, '#c9a227', 0.3), k.root);
    k.mesh(slathe('candle', [[0, -17], [5, -17], [5, 7], [4.6, 8], [3.6, 7.2], [0, 7.4]], 24), wax, k.root);
    for (const [a, l] of [[0.4, 5], [2.3, 8], [4.1, 4]]) k.sphere([1, l / 2, 1], wax, k.root, Math.cos(a) * 4.9, 7 - l / 2, Math.sin(a) * 4.9);
    k.cyl(0.35, 0.35, 3, k.mat('#1a1a1a', { rough: 1 }), k.root, 0, 8.8, 0, 6);
    const f = flame(k, k.root, 0, 10.3, 0, 2.3, { hk: 9 });
    return (en, t) => f.up(t, 1);
  };
  N['torch'] = (e, k) => {
    k.cyl(2.2, 1.3, 25, wood(k, k.col('body'), true), k.root, 0, -7.5, 0, 12);
    k.cyl(3.8, 3.2, 7, TM(k, '#3a2a1c', fabric(), { rough: 1 }), k.root, 0, 5.5, 0, 14);
    for (const y of [2.4, 8.4]) torus(k, 3.7, 0.5, TAU, metal(k, '#3a3530', 0.5), k.root, 0, y, 0, 6, 20).rotation.x = PI / 2;
    const f = flame(k, k.root, 0, 9.5, 0, 4.4, { hk: 10, ho: 0.55 });
    const em = [0, 1, 2].map(i => noSh(k.sphere(0.5, glowM(k, '#ffb040', 1), k.root, 0, 12, 0)));
    return (en, t) => { f.up(t, 1); em.forEach((m, i) => { const u = (t * 0.9 + i / 3 + en.seed) % 1; m.position.set(Math.sin(t * 3 + i * 2) * 3 * u, 12 + u * 22, Math.cos(t * 2 + i) * 2 * u); m.scale.setScalar(0.6 * (1 - u)); }); };
  };
  // =====================================================================================================
  // ---------- instruments ----------
  const guitarPts = (() => {   // a figure-eight body: lower bout and upper bout joined at the waist
    const o = [], c1 = [-15, 0, 10], c2 = [-4, 0, 7.6], a1 = 0.734, a2 = 2.06;
    for (let i = 0; i <= 20; i++) { const a = a1 + (TAU - 2 * a1) * i / 20; o.push(c1[0] + Math.cos(a) * c1[2], Math.sin(a) * c1[2] * 0.9); }
    for (let i = 0; i <= 16; i++) { const a = -a2 + 2 * a2 * i / 16; o.push(c2[0] + Math.cos(a) * c2[2], Math.sin(a) * c2[2] * 0.9); }
    return o;
  })();
  N['guitar'] = (e, k) => {
    const top = TM(k, k.col('body'), grain(false), { rough: 0.22, env: 1, envK: 0.6 }), neck = wood(k, '#c89a62', false), fb = wood(k, '#3a2418', false), chrome = metal(k, '#d8dde2', 0.2);
    k.mesh(sext('guitar', guitarPts, 7, 1.4, 0.05), top, k.root);
    disc(k, 3.1, k.mat('#120c08', { rough: 1 }), k.root, -6.5, 0, 3.52);
    torus(k, 3.7, 0.35, TAU, k.mat('#f1e6cc', { rough: 0.4 }), k.root, -6.5, 0, 3.5, 4, 24);
    k.box(1.8, 7.5, 0.9, fb, k.root, -17, 0, 3.8);
    k.box(25, 3.6, 2.4, neck, k.root, 13, 0, 1.6);
    k.box(27, 3.8, 0.7, fb, k.root, 11, 0, 3.15);
    for (let i = 0; i < 9; i++) k.box(0.25, 3.8, 0.85, chrome, k.root, 2 + i * 2.6 * (1 - i * 0.03), 0, 3.2);
    const hd = k.group(k.root, 27.5, 0, 1.2); hd.rotation.y = 0.2;
    k.rbox(7, 5, 1.6, fb, hd, 0, 0, 0, 0.5);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const p = k.cyl(0.4, 0.4, 2.6, chrome, hd, -2 + i * 2.2, s * 3.4, 0, 6); }
    for (let i = 0; i < 6; i++) { const y = -1.4 + i * 0.56; const st = k.box(41, 0.14, 0.14, chrome, k.root, 3.5, y, 3.95); }
    return (en) => mirror(en, k);
  };
  N['drum'] = (e, k) => {
    const shell = mat(k, k.col('body'), { rough: 0.18, env: 1, envK: 0.8 }), chrome = metal(k, '#dfe3e8', 0.15), head = k.mat('#f2ede2', { rough: 0.7 });
    k.cyl(19, 19, 22, shell, k.root, 0, -1, 0, 36);
    k.cyl(18.9, 18.9, 0.5, head, k.root, 0, 10.2, 0, 36);
    for (const y of [10.4, -12.2]) torus(k, 19.3, 0.9, TAU, chrome, k.root, 0, y, 0, 6, 40).rotation.x = PI / 2;
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.cyl(0.35, 0.35, 21.5, chrome, k.root, Math.cos(a) * 19.6, -1, Math.sin(a) * 19.6, 6); k.box(1.4, 3.2, 1.6, chrome, k.root, Math.cos(a) * 19.4, -1, Math.sin(a) * 19.4).rotation.y = -a; }
    const stick = s => { const p = k.group(k.root, s * 21, 24, 6), m = wood(k, '#e0c79a', true); k.cyl(0.55, 0.85, 19, m, p, 0, -9.5, 0, 8); k.sphere(0.9, m, p, 0, -19, 0); return p; };
    const L = stick(-1), R = stick(1);
    return (en, t) => {
      const b = Math.abs(Math.sin(t * 6)) * 6, b2 = 6 - b;
      L.rotation.z = Math.atan2(13, 10 - b); R.rotation.z = Math.atan2(-13, 10 - b2);
    };
  };
  const pianoKeys = () => tex('pianokeys', 512, 32, (x, w, h) => { x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, w, h); x.fillStyle = '#9a968e'; for (let i = 0; i <= 29; i++) x.fillRect(i * w / 29 - 1, 0, 2, h); }, { clamp: true });
  const pianoBlack = () => tex('pianoblack', 512, 16, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#0d0d0f'; const kw = w / 29; for (let i = 0; i < 29; i++) { const n = i % 7; if (n === 2 || n === 6) continue; x.fillRect((i + 1) * kw - kw * 0.3, 0, kw * 0.6, h); } }, { clamp: true });
  N['piano'] = (e, k) => {
    const lac = mat(k, k.col('body'), { rough: 0.1, env: 1, envK: 0.9 }), gold = metal(k, '#c9a227', 0.3);
    k.box(70, 40, 24, lac, k.root, 0, 5, -6);
    k.box(72, 2, 26, lac, k.root, 0, 25.2, -6);
    k.box(70, 10, 18, lac, k.root, 0, -20, -8);
    k.box(66, 3, 13, lac, k.root, 0, -12.5, 9);
    k.box(62, 2.6, 10, TM(k, '#ffffff', pianoKeys(), { rough: 0.3 }), k.root, 0, -9.7, 9.5);
    k.box(62, 1.4, 6, TM(k, '#ffffff', pianoBlack(), { rough: 0.25, alphaT: 0.5 }), k.root, 0, -7.7, 7.6);
    for (const s of [-1, 1]) { k.box(3, 7, 14, lac, k.root, s * 32.5, -9, 8.6); k.cyl(1.5, 1.2, 12, lac, k.root, s * 30, -19, 13.5, 12); }
    const ms = k.box(34, 9, 1, lac, k.root, 0, 0, 6.5); ms.rotation.x = -0.18;
    const sheet = plane(k, 16, 9, TM(k, '#ffffff', tex('sheetmusic', 128, 64, (x) => { x.fillStyle = '#fbf8ef'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#333'; for (let j = 0; j < 3; j++) { for (let i = 0; i < 5; i++) x.fillRect(6, 8 + j * 18 + i * 2.4, 116, 0.8); for (let n = 0; n < 7; n++) { x.beginPath(); x.ellipse(16 + n * 15, 10 + j * 18 + (n * 5 % 9), 2.6, 2, -0.4, 0, TAU); x.fill(); } } }, { clamp: true }), { rough: 0.8 }), k.root, 0, 0.4, 7.1); sheet.rotation.x = -0.18;
    for (const x of [-4, 4]) k.box(2.4, 1, 4, gold, k.root, x, -24.3, 3);
    return front();
  };
  const grille = () => tex('grille', 64, 64, (x) => { x.fillStyle = '#2a2a2c'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#0b0b0c'; for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { x.beginPath(); x.arc(i * 4 + 2, j * 4 + 2, 1.3, 0, TAU); x.fill(); } });
  N['radio'] = (e, k) => {
    const body = mat(k, k.col('body'), { rough: 0.35, env: 1, envK: 0.4 }), chrome = metal(k, '#d8dde2', 0.2), gr = TM(k, '#ffffff', grille(), { rough: 0.8 });
    k.rbox(40, 24, 12, body, k.root, 0, -2, 0, 2);
    const cones = [];
    for (const s of [-1, 1]) {
      torus(k, 7, 0.8, TAU, chrome, k.root, s * 10.5, -2, 6, 6, 28);
      const c = k.group(k.root, s * 10.5, -2, 5.6); disc(k, 6.4, gr, c); k.sphere([2, 2, 0.8], mat(k, '#3a3a3c', { rough: 0.3, env: 1 }), c, 0, 0, 0.2); cones.push(c);
    }
    k.box(7, 3.6, 0.6, k.mat('#1a3a1a', { glow: '#5dff7a', glowK: 0.8, rough: 0.3 }), k.root, 0, 5.5, 6.1);
    for (let i = 0; i < 4; i++) k.box(2.6, 1.2, 2.2, chrome, k.root, -6 + i * 4, 10.6, 1);
    k.tube([[-14, 10, -2], [-12.5, 15, -2], [12.5, 15, -2], [14, 10, -2]], 1.1, 1.1, mat(k, '#1a1a1a', { rough: 0.5 }), k.root, 16, 6);
    const ant = k.cyl(0.35, 0.5, 16, chrome, k.root, 17.5, 16.5, -3, 6); ant.rotation.z = -0.6; k.sphere(0.8, chrome, k.root, 22, 23, -3);
    return (en, t) => { faceCam(en, k); const p = 1 + 0.12 * Math.max(0, Math.sin(t * 11)) * Math.max(0, Math.sin(t * 2.7 + 1)); cones.forEach(c => c.scale.set(p, p, 1)); };
  };
  N['camera'] = (e, k) => {
    const body = TM(k, k.col('body'), fabric(), { rough: 0.75 }), chrome = metal(k, '#c9ced4', 0.25), blk = mat(k, '#111', { rough: 0.35, env: 1 });
    k.rbox(34, 20, 13, body, k.root, 0, -2, 0, 2.5);
    k.rbox(30, 2, 12, chrome, k.root, 0, 8.6, -0.2, 0.8);
    k.rbox(10, 5, 9, blk, k.root, -1, 11, -1, 1.2);
    const fl = k.box(6, 2.6, 1, mat(k, '#e8eef2', { rough: 0.15, glow: '#ffffff', glowK: 0 }), k.root, -11, 6.6, 6.6);
    k.cyl(1.4, 1.4, 1.4, chrome, k.root, 10, 10, 1, 12);
    const lens = k.group(k.root, 2, -2, 6); lens.rotation.x = PI / 2;
    k.cyl(7, 7, 4, blk, lens, 0, 1.5, 0, 28); k.cyl(6.2, 6.6, 6, TM(k, '#1a1a1a', tex('ribs', 64, 8, (x) => { for (let i = 0; i < 64; i += 4) { x.fillStyle = '#ffffff'; x.fillRect(i, 0, 2, 8); x.fillStyle = '#555'; x.fillRect(i + 2, 0, 2, 8); } }), { rough: 0.6 }), lens, 0, 6, 0, 28);
    torus(k, 5.9, 0.5, TAU, chrome, k.root, 2, -2, 15, 6, 28);
    const gl = disc(k, 5.2, mat(k, '#1c2a4a', { rough: 0.02, metal: 0.6, envK: 2 }), k.root, 2, -2, 15.1);
    const fh = halo(k, k.root, '#ffffff', 90, -11, 6.6, 8, 0.9);
    return (en) => { faceCam(en, k); const f = Math.max(0, en.flash || 0); fh.visible = f > 0.02; fh.scale.set(30 + 90 * f, 30 + 90 * f, 1); fl.material.emissiveIntensity = f * 3; };
  };
  const coverTex = c => tex('cover' + c, 128, 160, (x, w, h, r) => {
    x.fillStyle = c; x.fillRect(0, 0, w, h); speckle(x, w, h, r, 1500, 0.08, 1);
    x.strokeStyle = '#e8c766'; x.lineWidth = 3; x.strokeRect(14, 12, w - 24, h - 24); x.lineWidth = 1.2; x.strokeRect(19, 17, w - 34, h - 34);
    x.fillStyle = '#e8c766'; x.fillRect(34, 46, 64, 7); x.fillRect(40, 62, 52, 5); x.fillRect(46, 110, 40, 4);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 8, h);
  }, { clamp: true });
  N['book'] = (e, k) => {
    const cv = TM(k, '#ffffff', coverTex(k.col('body')), { rough: 0.75 }), side = TM(k, k.col('body'), fabric(), { rough: 0.8 });
    const pg = TM(k, '#f4ecd8', tex('pages', 64, 64, (x) => { x.fillStyle = '#f7efdc'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 64; i += 2) { x.fillStyle = 'rgba(120,100,70,0.18)'; x.fillRect(0, i, 64, 0.8); x.fillRect(i, 0, 0.8, 64); } }), { rough: 0.9 });
    k.box(26.5, 30.6, 5.4, pg, k.root, 0.9, 0, 0);
    for (const s of [-1, 1]) { const c = k.box(28, 32, 0.9, s > 0 ? cv : side, k.root, 0.4, 0, s * 3.15); }
    const sp = k.mesh(geo('i2spine', () => new T.CylinderGeometry(3.6, 3.6, 32, 12, 1, true, PI, PI)), mat(k, k.col('body'), { rough: 0.75, side: 'double' }), k.root, -13.4, 0, 0); sp.scale.x = 0.6;
    for (const y of [-11, 11]) torus(k, 2.2, 0.3, PI, metal(k, '#e8c766', 0.35), k.root, -15.2, y, 0, 4, 10).rotation.set(PI / 2, PI / 2, 0);
    return front();
  };
  N['pencil'] = (e, k) => {
    const paint = mat(k, k.col('body'), { rough: 0.35, env: 1, envK: 0.4 });
    const b = k.cyl(4, 4, 30, paint, k.root, -1, 0, 0, 6); b.rotation.z = PI / 2; b.rotation.y = PI / 6;
    const f = k.cyl(4.1, 4.1, 3.5, metal(k, '#c9ced4', 0.3), k.root, -17.7, 0, 0, 18); f.rotation.z = PI / 2;
    for (const x of [-18.6, -16.8]) { const r = torus(k, 4.1, 0.35, TAU, metal(k, '#aab2ba', 0.3), k.root, x, 0, 0, 4, 20); r.rotation.y = PI / 2; }
    const er = k.cyl(3.8, 3.8, 2.8, k.mat('#f28c9a', { rough: 0.85 }), k.root, -20.8, 0, 0, 16); er.rotation.z = PI / 2;
    const cn = k.cone(4, 8, wood(k, '#e8c79a', true, { rough: 0.8 }), k.root, 18, 0, 0, 18); cn.rotation.z = -PI / 2;
    const tp = k.cone(1.3, 2.6, mat(k, '#2a2a2e', { rough: 0.4, metal: 0.5 }), k.root, 20.7, 0, 0, 10); tp.rotation.z = -PI / 2;
    return null;
  };
  const umbrellaGeo = () => geo('i2umbrella', () => {
    const g = new T.SphereGeometry(1, 48, 10, 0, TAU, 0, 1.25), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), f = Math.atan2(z, x), th = Math.acos(clamp(y, -1, 1)) / 1.25, s = 0.5 - 0.5 * Math.cos(8 * f);
      const rr = 1 - 0.045 * s * th; P.setXYZ(i, x * rr, y + s * 0.1 * th ** 4, z * rr);
    }
    g.computeVertexNormals(); return g;
  });
  N['umbrella'] = (e, k) => {
    const cl = TM(k, k.col('body'), fabric(), { rough: 0.6, side: 'double' }), dk = metal(k, '#3a3a3a', 0.4);
    const c = k.mesh(umbrellaGeo(), cl, k.root, 0, -7, 0); c.scale.set(23, 25, 23);
    k.cone(1, 4, dk, k.root, 0, 20, 0, 8);
    k.cyl(0.8, 0.8, 36, dk, k.root, 0, 1, 0, 8);
    const hk = torus(k, 3.6, 1.1, PI, wood(k, '#5a3a22', false), k.root, 3.6, -17, 0, 8, 14); hk.rotation.z = PI;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.sphere(0.7, dk, k.root, Math.cos(a) * 22, 0.9, Math.sin(a) * 22); }
    return null;
  };
  N['hat'] = (e, k) => {
    const felt = TM(k, k.col('body'), fabric(), { rough: 0.85 });
    k.mesh(slathe('tophat', [[0, 11], [8.6, 11], [9.1, 10.2], [8.4, 3], [8.7, -3], [9, -3.2]], 32), felt, k.root);
    k.mesh(slathe('tophatbrim', [[8.8, -2.6], [13.8, -3.6], [15.2, -2.2], [15.4, -3.2], [14, -4.8], [8.8, -4.4]], 40), mat(k, k.col('body'), { rough: 0.85, side: 'double' }), k.root);
    k.cyl(8.75, 8.85, 3.2, mat(k, '#1d1410', { rough: 0.45 }), k.root, 0, -1, 0, 32);
    return null;
  };
  N['boot'] = (e, k) => {
    const lea = mat(k, k.col('body'), { rough: 0.5, env: 1, envK: 0.3 }), sole = k.mat('#241810', { rough: 0.9 });
    k.mesh(sext('boot', smoothPts([-6.6, 15, 0, 15.3, 6.2, 15, 6.3, 4, 7.5, -3, 11.5, -6, 15, -9, 15.2, -12.6, 12, -13.6, 0, -13.6, -6.9, -13.4, -7.4, -6, -7, 4], 48), 10, 2.4, 0.04), lea, k.root);
    k.mesh(sext('bootsole', [-7.6, -15, 14.6, -15, 15.9, -13.6, 15.4, -12.4, -7.6, -12.6], 11, 0.6, 0.04), sole, k.root);
    k.box(5, 2.6, 10.6, sole, k.root, -4.2, -13.8, 0);
    k.sphere([5.8, 0.5, 3.6], k.mat('#1a100a', { rough: 1 }), k.root, -0.3, 15.05, 0);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const l = k.box(0.5, 0.5, 7, k.mat('#e8dcc4', { rough: 0.9 }), k.root, 6.9 + i * 0.3, 10 - i * 3.2, 0); l.rotation.set(s * 0.45, 0, -0.1); }
    k.box(13.5, 0.6, 10.6, mat(k, '#5a3416', { rough: 0.6 }), k.root, 0, 3, 0);
    return (en) => mirror(en, k);
  };
  N['glasses'] = (e, k) => {
    const fr = mat(k, k.col('body'), { rough: 0.25, env: 1, envK: 0.6 }), lensM = glass(k, '#9fc7e0', 0.3);
    for (const s of [-1, 1]) { torus(k, 6, 0.75, TAU, fr, k.root, s * 8, 0, 0, 8, 28); disc(k, 5.6, lensM, k.root, s * 8, 0, 0); k.box(1.4, 1.6, 2, fr, k.root, s * 14.2, 1, -0.6); const t = k.box(0.8, 1.1, 19, fr, k.root, s * 14.6, 1, -10.5); const tip = k.box(0.8, 1, 5, fr, k.root, s * 14.6, -0.8, -21.2); tip.rotation.x = 0.7; }
    k.tube([[-2.4, 1.4, 0], [0, 2.6, 0], [2.4, 1.4, 0]], 0.6, 0.6, fr, k.root, 8, 6);
    return front();
  };
  N['bucket'] = (e, k) => {
    const seq = k.def.seq || [], paint = mat(k, k.col('body'), { metal: 0.35, rough: 0.35, side: 'double' });
    k.mesh(slathe('bucket', [[0, -15], [10, -15], [13, 8], [13.7, 8.4], [13.4, 9.1], [12.6, 8.3], [9.5, -14.2], [0, -14.2]], 32), paint, k.root);
    for (const y of [-8, 0]) torus(k, 10 + 3 * (y + 15) / 23 + 0.15, 0.35, TAU, paint, k.root, 0, y, 0, 4, 32).rotation.x = PI / 2;
    const wat = disc(k, 12.2, mat(k, seq[1] || '#7ec8e3', { opacity: 0.8, rough: 0.04, env: 1, envK: 1.2 }), k.root, 0, 5.5, 0); wat.rotation.x = -PI / 2;
    const hp = k.group(k.root, 0, 7.5, 0); hp.rotation.x = -1.05;
    const h = torus(k, 13.3, 0.4, PI, metal(k, '#9aa5b1', 0.3), hp, 0, 0, 0, 4, 24);
    k.cyl(1.1, 1.1, 6, wood(k, '#8b5a2b', false), hp, 0, 13.3, 0).rotation.z = PI / 2;
    for (const s of [-1, 1]) k.box(1.2, 2.4, 2.2, paint, k.root, s * 13.4, 7, 0);
    return (en, t) => { wat.position.y = 5.5 + Math.sin(t * 3 + en.seed) * 0.15; };
  };
  N['toilet'] = (e, k) => {
    const por = mat(k, k.col('body'), { rough: 0.12, env: 1, envK: 0.6 }), chrome = metal(k, '#d8dde2', 0.15);
    const bowl = k.mesh(slathe('bowl', [[0, -23], [7.5, -23], [8, -21.5], [6.6, -16], [7.6, -9], [11.6, -2], [13, 1.5], [13, 3.4], [11.2, 3.8], [9.6, 0.5], [0, -2]], 32), por, k.root, 5, 0, 0); bowl.scale.set(1.3, 1, 1);
    const wat = disc(k, 8.6, mat(k, '#bfe6f8', { opacity: 0.85, rough: 0.05, env: 1 }), k.root, 5, -0.4, 0); wat.rotation.x = -PI / 2; wat.scale.set(8.6 * 1.25, 8.6, 1);
    const seat = torus(k, 11.4, 1.3, TAU, por, k.root, 5, 4.6, 0, 8, 36); seat.rotation.x = PI / 2; seat.scale.set(1.3, 1, 1);
    const lid = k.group(k.root, -6, 5.5, 0); lid.rotation.z = 1.35;
    const ld = k.cyl(12.2, 12.2, 1.4, por, lid, 11, 0, 0, 32); ld.scale.set(1.25, 1, 1);
    k.rbox(10, 18, 26, por, k.root, -11, 13.5, 0, 1.5); k.rbox(11.4, 2, 27, por, k.root, -11, 23, 0, 0.8);
    const hd = k.box(4, 1, 1, chrome, k.root, -7, 19.5, 13.6); k.cyl(0.9, 0.9, 0.8, chrome, k.root, -9, 19.5, 13.3, 10).rotation.x = PI / 2;
    return (en) => mirror(en, k);
  };
  N['bell'] = (e, k) => {
    const br = metal(k, k.col('body'), 0.28), piv = k.group(k.root, 0, 17, 0);
    k.mesh(slathe('bell', [[0, -1.5], [4, -2], [6.5, -4], [8, -7], [8.6, -12], [9.4, -20], [11.4, -25.6], [14.4, -28.4], [15, -29.4], [13.4, -29.6], [10.6, -27.4], [8.4, -22], [7, -12], [5, -5], [0, -3.8]], 36), mat(k, k.col('body'), { metal: 0.95, rough: 0.28, side: 'double' }), piv);
    torus(k, 2.6, 0.9, TAU, br, piv, 0, 1, 0, 6, 16);
    const cl = k.group(piv, 0, -4, 0);
    k.cyl(0.5, 0.5, 22, metal(k, '#555', 0.5), cl, 0, -11, 0, 6); k.sphere(2.6, metal(k, '#6b5a3a', 0.5), cl, 0, -23, 0);
    return (en, t) => { const r = en.ring > 0 ? Math.sin(t * 30) * 0.3 * Math.min(1, en.ring) : 0; piv.rotation.z = r; cl.rotation.z = -r * 0.7; };
  };
  N['fan'] = (e, k) => {
    const pm = mat(k, k.col('body'), { rough: 0.35, metal: 0.5 }), chrome = metal(k, '#d8dde2', 0.2), wire = metal(k, '#c9ced4', 0.3);
    k.mesh(slathe('fanbase', [[0, -28], [10, -28], [10, -27], [8, -25], [3, -23.5], [1.6, -22], [0, -22]], 28), pm, k.root);
    k.cyl(1.4, 1.4, 22, chrome, k.root, 0, -12, 0, 10);
    const head = k.group(k.root, 0, 7, 0); head.rotation.y = 0.9;
    k.mesh(slathe('fanmotor', [[0, -10], [3, -10], [4.6, -8], [4.6, -3], [3.4, -1], [0, -1]], 20), pm, head).rotation.x = PI / 2;
    k.sphere(2.2, pm, head, 0, 0, 2);
    const blades = k.group(head, 0, 0, 1.5), bm = mat(k, '#cfe3ee', { opacity: 0.88, rough: 0.25, side: 'double' });
    for (let i = 0; i < 3; i++) { const b = k.mesh(sext('fanblade', [0, 1.5, 6, 4.5, 13, 5.5, 16, 2, 14, -3, 6, -2.5, 0, -1.5], 0.6, 0.2, 0.05), bm, blades); b.rotation.set(0, 0, i * TAU / 3); b.rotation.x = 0; const pg = k.group(blades); pg.rotation.z = i * TAU / 3; pg.add(b); b.rotation.set(0.35, 0, 0); }
    for (const z of [4.5, -1.5]) torus(k, 17.5, 0.45, TAU, wire, head, 0, 0, z, 4, 40);
    torus(k, 11, 0.3, TAU, wire, head, 0, 0, 5.4, 4, 32); torus(k, 5, 0.3, TAU, wire, head, 0, 0, 5.8, 4, 24);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, w = k.box(0.35, 14, 0.35, wire, head, Math.cos(a) * 10.5, Math.sin(a) * 10.5, 5); w.rotation.z = a - PI / 2; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, w = k.box(0.35, 14, 0.35, wire, head, Math.cos(a) * 10.5, Math.sin(a) * 10.5, -1.5); w.rotation.z = a - PI / 2; }
    disc(k, 2.6, chrome, head, 0, 0, 5.9);
    return (en, t) => { mirror(en, k); blades.rotation.z = -t * 25; };
  };
  N['magnet'] = (e, k) => {
    const pts = [[-10.5, -8, 0]]; for (let i = 0; i <= 10; i++) { const a = PI - PI * i / 10; pts.push([Math.cos(a) * 10.5, -1 + Math.sin(a) * 10.5, 0]); } pts.push([10.5, -8, 0]);
    k.tube(pts, 4.6, 4.6, mat(k, k.col('body'), { rough: 0.3, env: 1, envK: 0.5 }), k.root, 40, 14);
    for (const s of [-1, 1]) k.cyl(4.65, 4.65, 8, metal(k, '#d0d6dc', 0.2), k.root, s * 10.5, -12, 0, 18);
    return null;
  };
  N['trampoline'] = (e, k) => {
    const steel = metal(k, '#9aa5b1', 0.35), pad = TM(k, (k.def.seq && k.def.seq[0]) || k.col('body'), fabric(), { rough: 0.7 });
    const ring = k.group(k.root, 0, 8, 0); ring.scale.z = 0.8;
    torus(k, 30, 1.3, TAU, steel, ring, 0, 0, 0, 8, 48).rotation.x = PI / 2;
    const pd = torus(k, 28.5, 3, TAU, pad, ring, 0, 0.6, 0, 10, 48); pd.rotation.x = PI / 2; pd.scale.z = 0.4;
    const mg = new T.CircleGeometry(25.5, 32, 0, TAU); mg.rotateX(-PI / 2); k.own.push(mg);
    const matM = k.mesh(mg, mat(k, '#1b1b1d', { rough: 0.85, side: 'double' }), ring, 0, 0, 0);
    const P = mg.attributes.position, base = Float32Array.from(P.array);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; k.cyl(1, 1, 25, steel, k.root, Math.cos(a) * 29, -4.5, Math.sin(a) * 29 * 0.8, 8); }
    const gr = k.group(k.root, 0, -16.4, 0); gr.scale.z = 0.8; torus(k, 29, 0.8, TAU, steel, gr, 0, 0, 0, 6, 40).rotation.x = PI / 2;
    let last = -1;
    return (en) => {
      const sq = Math.max(0, en.squash || 0); if (Math.abs(sq - last) < 0.01) return; last = sq;
      for (let i = 0; i < P.count; i++) { const x = base[i * 3], z = base[i * 3 + 2], r2 = (x * x + z * z) / (25.5 * 25.5); P.setY(i, -sq * 7 * (1 - r2)); }
      P.needsUpdate = true; mg.computeVertexNormals();
    };
  };
  N['potion'] = (e, k) => {
    const c = k.col('body');
    k.mesh(slathe('flask', [[0, -16], [9.4, -16], [10, -15.2], [10, -10], [4.4, 6.5], [3.8, 8], [3.8, 13], [4.6, 13.6], [4.6, 14.4], [3.4, 14.6]], 28), glass(k, '#e8f6ff', 0.28), k.root);
    k.mesh(slathe('flaskliq', [[0, -15.4], [9.3, -15.4], [9.3, -10], [6, -1.5], [0, -1.5]], 24), mat(k, c, { opacity: 0.82, rough: 0.08, glow: c, glowK: 0.55, env: 1 }), k.root);
    k.cyl(3.7, 3.2, 4.5, TM(k, '#c08a58', granite(), { rough: 0.9 }), k.root, 0, 15.5, 0, 14);
    const bm = glowM(k, '#ffffff', 0.6), bubs = [0, 1, 2, 3].map(() => noSh(k.sphere(0.8, bm, k.root, 0, -10, 0)));
    halo(k, k.root, c, 38, 0, -8, 4, 0.35);
    return (en, t) => bubs.forEach((b, i) => { const u = (t * 0.45 + i / 4 + en.seed) % 1, y = -14 + u * 12.5; b.position.set(Math.sin(t * 3 + i * 1.7) * (8 - u * 4) * 0.6, y, Math.cos(t * 2 + i) * 3); b.scale.setScalar(0.5 + i * 0.15 + u * 0.3); });
  };
  const netTex = () => tex('net', 64, 64, (x) => { x.clearRect(0, 0, 64, 64); x.strokeStyle = '#ffffff'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(0, 32); x.lineTo(64, 32); x.moveTo(32, 0); x.lineTo(32, 64); x.stroke(); });
  N['soccer net'] = (e, k) => {
    const post = mat(k, '#f8f8f8', { rough: 0.3, env: 1 });
    for (const s of [-1, 1]) { k.cyl(1.7, 1.7, 61, post, k.root, s * 44, 0, 0, 12); k.cyl(1, 1, 52, post, k.root, s * 44, -4, -28, 8); }
    k.cyl(1.7, 1.7, 89.5, post, k.root, 0, 30, 0, 12).rotation.z = PI / 2;
    for (const s of [-1, 1]) { const tb = k.cyl(1, 1, 29, post, k.root, s * 44, 26, -14, 8); tb.rotation.x = Math.atan2(28, 8) - PI / 2 + PI; tb.rotation.x = -(PI / 2 - Math.atan2(8, 28)); const gb = k.cyl(1, 1, 28, post, k.root, s * 44, -29.5, -14, 8); gb.rotation.x = PI / 2; }
    k.cyl(1, 1, 88, post, k.root, 0, -29.5, -28, 8).rotation.z = PI / 2;
    k.cyl(1, 1, 88, post, k.root, 0, 22, -28, 8).rotation.z = PI / 2;
    const ng = geo('i2net', () => {
      const q = [[[-44, 30, 0], [44, 30, 0], [44, 22, -28], [-44, 22, -28]], [[-44, 22, -28], [44, 22, -28], [44, -30, -28], [-44, -30, -28]], [[-44, 30, 0], [-44, 22, -28], [-44, -30, -28], [-44, -30, 0]], [[44, 30, 0], [44, -30, 0], [44, -30, -28], [44, 22, -28]]];
      const pos = [], uv = [], S = 1 / 6;
      for (const [a, b, c, d] of q) {
        const uvOf = p => { const ux = Math.abs(a[0] - b[0]) > 1 ? p[0] : p[2]; return [ux * S, (p[1] + (Math.abs(a[0] - b[0]) > 1 && a[1] === b[1] && a[1] > 20 && b[2] === 0 ? p[2] : 0)) * S]; };
        for (const p of [a, b, c, a, c, d]) { pos.push(...p); uv.push(...uvOf(p)); }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
    });
    const nm = TM(k, '#ffffff', netTex(), { rough: 0.9, side: 'double', alphaT: 0.5 });
    const net = k.mesh(ng, nm, k.root);
    return (en, t) => { const g = en.ring > 0 ? Math.min(1, en.ring) : 0; net.scale.set(1 + g * 0.02 * Math.sin(t * 20), 1, 1 + g * (0.12 + 0.05 * Math.sin(t * 14))); };
  };
  const bagGeo = () => geo('i2bag', () => {
    const g = new T.SphereGeometry(1, 28, 20), P = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i); const f = Math.atan2(v.z, v.x);
      let r = 1 + 0.05 * Math.sin(f * 7 + v.y * 5) + 0.035 * Math.sin(f * 13 - v.y * 9);
      if (v.y > 0.55) r *= 1 - (v.y - 0.55) / 0.45 * 0.8;
      v.x *= r; v.z *= r; if (v.y < -0.7) v.y = -0.7 - (v.y + 0.7) * 0.2; if (v.y > 0.55) v.y = 0.55 + (v.y - 0.55) * 1.3;
      P.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  });
  N['trash'] = (e, k) => {
    const pl = mat(k, shadeHex(k.col('body'), 0.55), { rough: 0.4, env: 1, envK: 0.45 });
    k.mesh(bagGeo(), pl, k.root, 0, -3, 0).scale.set(14, 14, 12.5);
    for (const s of [-1, 1]) { const ear = k.sphere([3.2, 1.6, 1.6], pl, k.root, s * 2.6, 13.2, 0); ear.rotation.z = s * 0.7; }
    k.cyl(1.6, 1.2, 2, k.mat('#e8c22a', { rough: 0.6 }), k.root, 0, 11.4, 0, 10);
    return null;
  };
  const batTex = c => tex('battery' + c, 256, 128, (x, w, h) => {
    x.fillStyle = '#18181a'; x.fillRect(0, 0, w, h); x.fillStyle = c; x.fillRect(0, 0, w, h * 0.38);
    x.fillStyle = '#b87333'; x.fillRect(0, h * 0.38, w, 4);
    x.fillStyle = '#18181a'; x.font = 'bold 40px ' + FONT(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+', w / 2, h * 0.19);
    x.fillStyle = '#f4f4f4'; x.font = 'bold 18px ' + FONT(); x.fillText('POWER', w / 2, h * 0.62); x.font = 'bold 14px ' + FONT(); x.fillText('AA 1.5V', w / 2, h * 0.82);
  });
  N['battery'] = (e, k) => {
    const g = geo('i2battery', () => new T.CylinderGeometry(7.8, 7.8, 25, 32, 1, true, PI, TAU));
    k.mesh(g, TM(k, '#ffffff', batTex(k.col('body')), { rough: 0.3, env: 1, envK: 0.5 }), k.root, 0, -1.5, 0);
    const m = metal(k, '#d0d6dc', 0.2);
    k.cyl(7.5, 7.8, 1, m, k.root, 0, 11.5, 0, 32); k.cyl(3, 3, 3, m, k.root, 0, 13.4, 0, 18); k.cyl(7.8, 7.5, 1, m, k.root, 0, -14.5, 0, 32);
    return front();
  };
  N['spring toy'] = (e, k) => {
    const pts = []; for (let i = 0; i <= 9 * 14; i++) { const a = i / 14 * TAU; pts.push([Math.cos(a) * 10.5, -14 + i / (9 * 14) * 27, Math.sin(a) * 10.5]); }
    const sp = k.tube(pts, 0.9, 0.9, metal(k, k.col('body'), 0.25, { metal: 0.7 }), k.root, 200, 6);
    return (en, t) => { sp.scale.y = 1 + 0.08 * Math.sin(t * 7 + en.seed) + clamp(-(en.vy || 0) / 2000, -0.3, 0.3); sp.position.y = -14 * (1 - sp.scale.y); };
  };

  // =====================================================================================================
  // ---------- the bosses' projectiles (quick to draw, easy to see) ----------
  N['fireball'] = (e, k) => {
    const g = k.group(k.root);
    noSh(k.sphere(6.5, glowM(k, '#fff1b8', 1), k.root));
    noSh(k.sphere(8.6, glowM(k, '#ff9a2a', 0.5), k.root)).renderOrder = 2;
    const fl = [flame(k, g, 0, 2, 0, 6.5, { halo: false }), flame(k, g, -3, 1, 2, 4.4, { halo: false }), flame(k, g, 3, 1, -2, 4.4, { halo: false })];
    halo(k, k.root, '#ff7a1a', 64, 0, 0, 6, 0.65);
    return (en, t) => {
      const vx = (en.vx || 0) * (en.facing || 1), vy = -(en.vy || 0), sp = Math.hypot(vx, vy);
      g.rotation.z = sp > 60 ? Math.atan2(vx, -vy) + (en.angle || 0) * (en.facing || 1) : (en.angle || 0) * (en.facing || 1);
      const s = 1 + clamp(sp / 900, 0, 0.8); fl.forEach((f, i) => f.up(t + i * 0.7, i ? s * 0.9 : s));
    };
  };
  N['venom'] = (e, k) => {
    const c = k.col('body'), gm = mat(k, shadeHex(c, 0.8), { opacity: 0.72, rough: 0.06, env: 1, envK: 0.5, glow: '#2faf3f', glowK: 0.5 });
    const b = k.sphere(7.5, gm, k.root); k.sphere(5, mat(k, '#1f7a34', { rough: 0.3 }), k.root, -0.5, -0.5, 0);
    for (const [x, y, r] of [[2.5, 2, 1.1], [-2, 3, 0.8], [1, -2.8, 0.9]]) k.sphere(r, mat(k, '#c8ffb0', { rough: 0.1, opacity: 0.7, env: 1 }), k.root, x, y, 6.4);
    const d1 = k.sphere(2.2, gm, k.root, -9, 2, 0), d2 = k.sphere(1.3, gm, k.root, -13, 3, 0);
    return (en, t) => {
      const s = en.seed * 5; b.scale.set(7.5 * (1 + 0.08 * Math.sin(t * 13 + s)), 7.5 * (1 + 0.08 * Math.sin(t * 11 + s + 2)), 7.5 * (1 + 0.06 * Math.sin(t * 9 + s)));
      const vx = (en.vx || 0) * (en.facing || 1), vy = -(en.vy || 0), sp = Math.hypot(vx, vy) || 1;
      d1.visible = d2.visible = sp > 80; if (d1.visible) { d1.position.set(-vx / sp * 9.5, -vy / sp * 9.5, 0); d2.position.set(-vx / sp * 14, -vy / sp * 14, 0); }
    };
  };
  N['stinger'] = (e, k) => {
    const ch = mat(k, k.col('body'), { rough: 0.22, env: 1, envK: 0.7 }), dk = mat(k, '#3a2210', { rough: 0.2, env: 1 });
    const s = k.mesh(slathe('stinger', [[0, -15], [2.8, -13.6], [3.8, -9], [3.5, -2], [2.5, 4], [0, 6]], 14), ch, k.root); s.rotation.z = -PI / 2; s.scale.set(1, 1, 0.85);
    const tip = k.cone(2.5, 10, dk, k.root, 10.5, 0, 0, 12); tip.rotation.z = -PI / 2;
    for (const sy of [-1, 1]) { const b = k.cone(1.4, 6, dk, k.root, -16, sy * 2.8, 0, 8); b.rotation.z = PI / 2 + sy * 0.6; }
    k.sphere(1.1, mat(k, '#7bd88f', { rough: 0.05, glow: '#5fbf6f', glowK: 0.4, env: 1 }), k.root, 15.6, -0.4, 0);
    return null;
  };
  N['icicle'] = (e, k) => {
    const ice = mat(k, k.col('body'), { opacity: 0.78, rough: 0.05, flat: true, env: 1, envK: 0.9, glow: '#5fb4ff', glowK: 0.35 });
    k.mesh(slathe('icicle', [[0, -20], [1.2, -12], [2.8, -3], [4.6, 7], [6, 15], [5, 19.5], [0, 20]], 7), ice, k.root);
    const cr = k.mesh(slathe('icicle', [[0, -20], [1.2, -12], [2.8, -3], [4.6, 7], [6, 15], [5, 19.5], [0, 20]], 7), mat(k, '#ffffff', { opacity: 0.45, rough: 0.05, flat: true }), k.root); cr.scale.set(0.55, 0.95, 0.55); cr.rotation.y = 0.4;
    const sd = k.mesh(slathe('icicle', [[0, -20], [1.2, -12], [2.8, -3], [4.6, 7], [6, 15], [5, 19.5], [0, 20]], 7), ice, k.root, 3.4, 12, 1); sd.scale.set(0.35, 0.3, 0.35);
    return null;
  };
  N['web'] = (e, k) => {
    const silk = k.mat(k.col('body'), { rough: 0.35, opacity: 0.92, glow: '#ffffff', glowK: 0.15 });
    for (let i = 0; i < 4; i++) { const c = k.cyl(0.32, 0.32, 44, silk, k.root, 0, 0, 0, 4); c.rotation.z = i * PI / 4; }
    for (const r of [7, 13.5, 20]) {
      const pts = []; for (let i = 0; i <= 16; i++) { const a = i * PI / 8 + 0.2, rr = i % 2 ? r * 0.9 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr, 0]); }
      k.tube(pts, 0.28, 0.28, silk, k.root, 48, 4);
    }
    return (en, t) => { k.root.rotation.z = Math.sin(t * 1.3 + en.seed) * 0.15; };
  };
})();
