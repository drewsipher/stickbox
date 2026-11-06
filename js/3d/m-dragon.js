'use strict';
// m-dragon.js — 3D model of the giant dragon boss (see js/3d/r3d.js for the model kit)
// A huge ancient black-red dragon: a horned skull with a hinged jaw full of teeth and glowing slit eyes on a long
// bending neck; an armoured, scaled body with spines down the back and a belly whose seams glow with the fire
// inside (brightest as it draws breath); four muscular clawed legs that really walk; great bat wings whose
// membranes stretch between four finger bones as they flap and fold; and a long spiked tail that lashes.
// The head is placed so the fire leaves exactly where the game puts it (D.dragonMouth), turned to look along
// the stage at its prey.
(function () {
  if (!SB.M3) return;
  const T = THREE, M3 = SB.M3, PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const damp = (a, b, r, dt) => a + (b - a) * Math.min(1, r * dt);
  const sm01 = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const rng = s => { s = (Math.abs(Math.floor(s)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

  // ---------- textures (painted in the palette's own colours, cached per colour) ----------
  const TEX = new Map();
  function canvasTex(key, w, h, paint, rep, linear) {
    let t = TEX.get(key); if (t) return t;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    paint(x, w, h, rng(key.length * 7919 + key.charCodeAt(1) * 131));
    t = new T.CanvasTexture(c); t.encoding = linear ? T.LinearEncoding : T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    if (rep) t.repeat.set(rep[0], rep[1]);
    t.userData.shared = true; TEX.set(key, t);
    return t;
  }
  // overlapping armour scales: each a domed plate with a dull red rim, dark gaps between
  const scaleTex = (body, rep, bump, rim) => canvasTex('drg:sc:' + body + rep + (bump ? 'b' : '') + (rim || ''), 256, 256, (x, w, h, r) => {
    const hi = SB.mixColor(body, rim || '#c0482a', 0.42), lo = SB.shade(body, 0.55);
    x.fillStyle = bump ? '#202020' : lo; x.fillRect(0, 0, w, h);
    const sw = 22, sh = 17;
    for (let row = -1; row < h / sh + 1; row++) for (let col = -1; col < w / sw + 1; col++) {
      const cx = col * sw + (row % 2) * sw / 2 + (r() - 0.5) * 2, cy = row * sh;
      const g = x.createRadialGradient(cx, cy - 5, 1, cx, cy, sw * 0.7);
      if (bump) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#a0a0a0'); g.addColorStop(1, '#303030'); }
      else { g.addColorStop(0, SB.mixColor(body, '#fff', 0.12)); g.addColorStop(0.6, body); g.addColorStop(0.9, hi); g.addColorStop(1, lo); }
      x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, sw * 0.58, sh * 0.95, 0, 0, PI); x.fill();
    }
    if (!bump) for (let i = 0; i < 40; i++) { x.strokeStyle = rim ? 'rgba(255,255,255,0.3)' : 'rgba(200,170,150,0.12)'; x.lineWidth = 1; const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 30, py + (r() - 0.5) * 10); x.stroke(); }   // old scratches
  }, rep.split('x').map(Number), bump);
  // belly: broad transverse plates; the glow map lights only the seams between them
  const bellyTex = (col, glow) => canvasTex('drg:bl:' + col + (glow ? 'g' : ''), 64, 256, (x, w, h) => {
    x.fillStyle = glow ? '#000' : col; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const y = i * 16;
      if (glow) { const g = x.createLinearGradient(0, y - 3, 0, y + 3); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, '#ffb050'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, y - 3, w, 6); }
      else { const g = x.createLinearGradient(0, y, 0, y + 16); g.addColorStop(0, SB.shade(col, 0.6)); g.addColorStop(0.15, SB.mixColor(col, '#fff', 0.15)); g.addColorStop(0.8, col); g.addColorStop(1, SB.shade(col, 0.35)); x.fillStyle = g; x.fillRect(0, y, w, 16); }
    }
  }, null, glow);
  // the wing membrane in the wing's own plane (u: chord, v: span): veins fanning from the wrist, a darker leathery edge
  const membraneTex = (col, vein) => canvasTex('drg:mb:' + col + (vein || ''), 256, 256, (x, w, h, r) => {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; x.beginPath(); x.ellipse(r() * w, r() * h, 3 + r() * 14, 2 + r() * 6, r() * 3, 0, TAU); x.fill(); }
    // veins from the wrist (at u,v = WRIST) toward the edges
    const wx = (6 + 130) / 150 * w, wy = (74) / 150 * h;
    x.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a = PI * 0.45 + r() * PI * 1.05, L = 60 + r() * 140;
      x.strokeStyle = vein ? `rgba(${vein},${0.35 + r() * 0.25})` : `rgba(${40 + r() * 30 | 0},8,6,0.5)`; x.lineWidth = 0.8 + r() * 1.6;
      x.beginPath(); x.moveTo(wx, wy); const mx = wx + Math.cos(a) * L * 0.5 + (r() - 0.5) * 20, my = wy + Math.sin(a) * L * 0.5 + (r() - 0.5) * 20; x.quadraticCurveTo(mx, my, wx + Math.cos(a) * L, wy + Math.sin(a) * L); x.stroke();
    }
  }, [1, 1]);

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
  function spikeGeo(x0, y0, z0, x1, y1, z1, r, seg) {   // a cone from (x0,y0,z0) to its tip at (x1,y1,z1), to merge
    const c = new T.ConeGeometry(r, 1, seg || 6, 1); c.translate(0, 0.5, 0);
    _d.set(x1 - x0, y1 - y0, z1 - z0); const L = _d.length() || 1; _d.divideScalar(L);
    _m4.compose(_p.set(x0, y0, z0), _q.setFromUnitVectors(UP, _d), _s.set(1, L, 1)); return c.applyMatrix4(_m4);
  }
  // two-bone IK (as in m-bosses.js): `up` and its child `lo` hang down -y; the chain reaches (tx,ty,tz), bending toward the pole
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _q2 = new T.Quaternion();
  function ik(up, lo, a, b, tx, ty, tz, px, py, pz, end) {
    const s = up.position, dir = _a.set(tx - s.x, ty - s.y, tz - s.z); let d = dir.length() || 1e-3; dir.divideScalar(d);
    d = clamp(d, Math.abs(a - b) + 0.5, a + b - 0.05);
    const cA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sA = Math.sqrt(1 - cA * cA);
    const perp = _b.set(px, py, pz); perp.addScaledVector(dir, -perp.dot(dir)); if (perp.lengthSq() < 1e-6) perp.set(-dir.y, dir.x, 0); perp.normalize();
    const u = _c.copy(dir).multiplyScalar(cA).addScaledVector(perp, sA);
    up.quaternion.setFromUnitVectors(DOWN, u);
    const l = perp.copy(dir).multiplyScalar(d).addScaledVector(u, -a).normalize();
    _q2.setFromUnitVectors(DOWN, l); lo.quaternion.copy(up.quaternion).invert().multiply(_q2);
    if (end) end.quaternion.copy(_q2).invert();
  }
  // a bone (k.limb, hanging down -y from its pivot) stretched from a to b
  function bone(o, len, ax, ay, az, bx, by, bz) {
    o.position.set(ax, ay, az); _d.set(bx - ax, by - ay, bz - az); const L = _d.length() || 1e-3;
    o.quaternion.setFromUnitVectors(DOWN, _d.divideScalar(L)); o.scale.set(1, L / len, 1);
  }
  const qpt = (out, x0, y0, z0, cx, cy, cz, x1, y1, z1, s) => { const m = 1 - s; out[0] = m * m * x0 + 2 * m * s * cx + s * s * x1; out[1] = m * m * y0 + 2 * m * s * cy + s * s * y1; out[2] = m * m * z0 + 2 * m * s * cz + s * s * z1; return out; };
  const pts = n => { const a = []; for (let i = 0; i < n; i++) a.push([0, 0, 0]); return a; };

  // the wing's shape in its own plane (the 2D drawing's numbers): x = chord (+ forward), y = -span (up the wing)
  const WE = [-24, -36], WW = [6, -74], WF = [[-30, -134], [-80, -118], [-116, -86], [-128, -40]], WB = [-64, 6];
  // the membrane's outline, as wing-plane points: wrist -> each finger tip with a scalloped edge between -> the flank -> shoulder -> leading edge
  function wingOutline() {
    const out = [], q = (a, c, b, s) => [(1 - s) * (1 - s) * a[0] + 2 * (1 - s) * s * c[0] + s * s * b[0], (1 - s) * (1 - s) * a[1] + 2 * (1 - s) * s * c[1] + s * s * b[1]];
    out.push({ p: WF[0], f: 0 });
    const tips = WF.concat([WB]);
    for (let i = 1; i < tips.length; i++) {
      const a = tips[i - 1], b = tips[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, pull = i < WF.length ? 0.3 : 0.34, c = [mx + (WW[0] - mx) * pull, my + (WW[1] - my) * pull];
      for (let j = 1; j <= 3; j++) out.push({ p: q(a, c, b, j / 4), sag: 1 });
      out.push({ p: b, f: i < WF.length ? i : -1 });
    }
    out.push({ p: [-30, 8], sag: 0.3 }, { p: [0, 0], body: 1 }, { p: [10, -26] }, { p: [10, -52] });
    return out;
  }
  const OUTLINE = wingOutline();

  M3.named['giant dragon'] = M3.named['ice dragon'] = function (e, k) {
    const ICE = e.def.drgEl === 'ice', FX = SB.D.DRG_FX[ICE ? 'ice' : 'fire'], RIM = ICE ? FX.scale : null, RGB = i => 'rgb(' + FX.ramp[i].join(',') + ')';
    const D = SB.D, R = D.DRG, KD = e.def.drawK || 1.4, HS = D.DRG_HS;
    const BODY = k.col('body'), BELLY = k.col('belly'), WING = k.col('wing'), SPIKE = k.col('spike'), HORN = k.col('horn'), MOUTH = k.col('mouth'), TEETH = k.col('teeth'), CLAW = k.col('claw');
    const EMBER = k.col('ember') || '#ff6a10', GLOW = k.col('eyeGlow') || '#ff9a1a';
    // materials: k.mat caches by colour + options, so textured ones carry a tag to keep their own entry
    const tm = (col, o, maps) => { const m = k.mat(col, Object.assign({ tag: maps.tag }, o)); if (!m.userData.maps) { m.userData.maps = 1; for (const key in maps) if (key !== 'tag') m[key] = maps[key]; m.needsUpdate = true; } return m; };
    const scB = scaleTex(BODY, '3x2', true);
    const sRough = ICE ? 0.32 : 0.62;
    const mScale = tm('#ffffff', { rough: sRough, metal: 0 }, { tag: 'drgS' + BODY, map: scaleTex(BODY, '3x2', false, RIM), bumpMap: scB, bumpScale: 1.2 });
    const mScaleT = tm('#ffffff', { rough: sRough, metal: 0 }, { tag: 'drgT' + BODY, map: (() => { const t = scaleTex(BODY, '10x3', false, RIM).clone(); t.userData.shared = true; t.repeat.set(6, 2); t.needsUpdate = true; return t; })(), bumpMap: scB, bumpScale: 1 });
    const mBelly = tm('#ffffff', { rough: 0.55, glow: EMBER, glowK: 0.4 }, { tag: 'drgB' + BELLY, map: bellyTex(BELLY), emissiveMap: bellyTex(BELLY, true) });
    const mSkin = k.mat(BODY, { rough: 0.6 }), mDark = k.mat(SB.shade(BODY, 0.3), { rough: 0.55 });
    const mSpike = ICE ? k.mat(SPIKE, { rough: 0.08, opacity: 0.72, glow: '#8fdcff', glowK: 0.3 }) : k.mat(SPIKE, { rough: 0.45 }), mHorn = ICE ? k.mat(HORN, { rough: 0.06, opacity: 0.8, glow: '#bfefff', glowK: 0.25 }) : k.mat(SB.mixColor(HORN, BODY, 0.25), { rough: 0.45 }), mClaw = k.mat(CLAW, { rough: 0.25, metal: 0.2 }), mTooth = k.mat(TEETH, { rough: 0.3 });
    const mMouth = k.mat(MOUTH, { rough: 0.4, glow: EMBER, glowK: 0.2 }), mNost = k.mat('#0c0605', { rough: 0.5 });
    const mWing = ICE ? tm('#ffffff', { rough: 0.3, side: 'double', glow: '#3a7aa8', glowK: 0.3, opacity: 0.88 }, { tag: 'drgW' + WING, map: membraneTex(WING, '50,100,150') })
      : tm('#ffffff', { rough: 0.62, side: 'double', glow: '#5a0c04', glowK: 0.35 }, { tag: 'drgW' + WING, map: membraneTex(WING) });
    const mBone = k.mat(SB.mixColor(BODY, WING, 0.25), { rough: 0.5 });
    const fm = (c, o, tag) => { const m = k.mat(c, { basic: true, opacity: o, tag }); m.depthWrite = false; return m; };
    const mFire = fm(RGB(3), ICE ? 0.38 : 0.5, 'drgF1' + ICE), mFire2 = fm(RGB(ICE ? 8 : 1), ICE ? 0.7 : 0.85, 'drgF2' + ICE), mFire3 = fm(RGB(2), ICE ? 0.45 : 0.6, 'drgF3' + ICE), mFire4 = fm(RGB(ICE ? 7 : 5), ICE ? 0.3 : 0.45, 'drgF4' + ICE);   // fire, or freezing mist
    const g = k.group(k.root); g.scale.setScalar(KD);   // built in the 2D drawing's units, scaled up like the drawing
    // rearing up turns the body about the hind feet; the landing crouch lowers it
    const PV = D.DRG_PIVOT, rearG = k.group(g, PV[0], -PV[1], 0), bod = k.group(rearG, -PV[0], PV[1], 0);

    // ---------- body: a scaled barrel, deep in the chest, armoured belly plates underneath ----------
    const bodyR = u => 34 * Math.pow(Math.sin(clamp(u, 0, 1) * PI * 0.92 + 0.22), 0.7) + 6;
    const torso = k.tube([[-84, 2, 0], [-50, 2, 0], [-12, -4, 0], [30, -1, 0], [66, 6, 0]], bodyR, 0, mScale, bod, 18, 16); torso.scale.z = 0.86;
    const belly = k.tube([[-74, -4, 0], [-48, -8, 0], [-12, -14, 0], [28, -10, 0], [58, -2, 0]], u => bodyR(u * 0.92 + 0.04) * 0.9, 0, mBelly, bod, 14, 14); belly.scale.z = 0.8;
    k.sphere([27, 30, 25], mScale, bod, 30, 2, 0);    // the deep chest
    // spines down the back
    const backSp = M3.geo('drg:backsp', () => { const L = []; for (let i = 0; i < 9; i++) { const x = -70 + i * 15, y = 28 + Math.sin((i + 1) / 10 * PI) * 6 + (i > 6 ? 4 : 0), h = 10 + Math.sin(i / 8 * PI) * 10; L.push(spikeGeo(x + 2, y - 4, 0, x - 5, y + h, 0, 4.2 + Math.sin(i / 8 * PI) * 1.6, 6)); } return merge(L); });
    k.mesh(backSp, mSpike, bod);

    // ---------- legs: heavy haunches and shoulders, two-bone legs, clawed feet ----------
    const footGeo = M3.geo('drg:foot', () => { const L = [new T.SphereGeometry(1, 12, 8).scale(9, 5, 8)]; for (const z of [-5, 0, 5]) { const c = new T.CylinderGeometry(2, 2.8, 12, 8); c.rotateZ(-PI / 2); c.translate(10, -1.5, z * 1.1); L.push(c); } return merge(L); });
    const clawGeo = M3.geo('drg:claws', () => { const L = []; for (const z of [-5, 0, 5]) L.push(spikeGeo(15, -1, z * 1.15, 23, -5, z * 1.25, 2.2, 6)); L.push(spikeGeo(-7, 0, 0, -13, -4, 0, 1.8, 5)); return merge(L); });
    const legs = [];
    for (const [hind, s] of [[1, 1], [1, -1], [0, 1], [0, -1]]) {
      const hx = hind ? -46 : 34, hy = hind ? -12 : -14, z = s * (hind ? 22 : 20), a = hind ? 38 : 34, b = hind ? 40 : 36;
      k.sphere(hind ? [21, 25, 10] : [15, 20, 9], mScale, bod, hx + 2, hy + 4, z * 0.82).rotation.z = hind ? 0.35 : -0.3;   // haunch / shoulder muscle
      const up = k.limb(a, hind ? 14 : 11, hind ? 9 : 8, mScale, bod, hx, hy, z);
      const lo = k.limb(b, hind ? 8.5 : 7.5, 6, mSkin, up, 0, -a, 0);
      const ft = k.group(lo, 0, -b, 0);
      const fm = k.group(ft, 0, -3, 0); k.mesh(footGeo, mSkin, fm); k.mesh(clawGeo, mClaw, fm);
      legs.push({ hind, s, up, lo, ft, fm, a, b, hx, hy, z });
    }

    // ---------- tail: long, heavy, with spines and a blade of spikes at the tip ----------
    const tailP = pts(8), TAILN = 9;
    const tail = k.tube([[-76, 0, 0], [-150, -10, 0]], u => 15 * Math.pow(1 - u, 0.85) + 2, 0, mScaleT, bod, 26, 12);
    const tailSp = []; for (let i = 0; i < TAILN; i++) tailSp.push(k.cone(3.4 - i * 0.22, 11 - i * 0.6, mSpike, bod, 0, 0, 0, 6));
    const bladeGeo = M3.geo('drg:blade', () => merge([spikeGeo(0, 0, 0, 20, 0, 0, 3.2, 6), spikeGeo(-2, 0, 0, 12, 12, 0, 2.6, 6), spikeGeo(-2, 0, 0, 12, -12, 0, 2.6, 6), spikeGeo(-2, 0, 0, 10, 0, 10, 2.2, 6), spikeGeo(-2, 0, 0, 10, 0, -10, 2.2, 6)]));
    const blade = k.mesh(bladeGeo, mSpike, bod);

    // ---------- neck: a bending tube with a crest of spines and glowing throat plates ----------
    const neckP = pts(7), throatP = pts(7);
    const neck = k.tube([[48, 0, 0], [90, 60, 0]], u => 21 - 11 * u, 0, mScale, g, 16, 14);
    const throat = k.tube([[48, -6, 0], [90, 54, 0]], u => 15 - 8 * u, 0, mBelly, g, 14, 10);
    const neckSp = []; for (let i = 0; i < 6; i++) neckSp.push(k.cone(3.6 - i * 0.25, 10 - i * 0.5, mSpike, g, 0, 0, 0, 6));

    // ---------- head: horned skull, long upper jaw, hinged lower jaw, teeth, glowing slit eyes ----------
    const head = k.group(g); head.rotation.order = 'YZX';
    const hs = k.group(head); hs.scale.setScalar(HS);
    k.sphere([15, 11, 11.5], mScale, hs, -2, 6, 0);                                                       // cranium
    const snout = k.tube([[-6, 4, 0], [16, 4.5, 0], [36, 3, 0], [52, 1.5, 0], [59, 0, 0]], u => 9.5 - 5 * u, 0, mScale, hs, 12, 12); snout.scale.y = 0.75;
    k.sphere([22, 5, 7], mSkin, hs, 30, 5, 0).rotation.z = -0.06;                                          // the ridge of the nose
    const glow = GLOW;
    for (const sd of [1, -1]) {
      const br = k.sphere([10, 3.2, 3.6], mDark, hs, 12, 12, sd * 6.6); br.rotation.z = -0.28; br.rotation.y = sd * 0.15;   // heavy brow
      k.eye(3.4, hs, 14, 8.5, sd * 7.4, { dir: [0.55, 0.12, sd], glow });
      k.sphere([1.5, 1, 1.3], mNost, hs, 55, 3.2, sd * 3.2);
      k.tube([[-6, 10, sd * 5], [-22, 16, sd * 9], [-36, 24, sd * 11], [-50, 38, sd * 10]], u => 4.6 * (1 - u) + 0.4, 0, mHorn, hs, 10, 8);   // great horn
      k.tube([[-10, 0, sd * 8.5], [-24, -2, sd * 12], [-38, 2, sd * 12.5]], u => 2.9 * (1 - u) + 0.3, 0, mHorn, hs, 6, 6);                    // cheek horn
    }
    const crestG = M3.geo('drg:crest', () => { const L = []; for (let i = 0; i < 4; i++) L.push(spikeGeo(-4 - i * 5, 15 - i * 1.5, 0, -10 - i * 5, 23 - i * 2.5, 0, 2.2, 5)); for (const sd of [1, -1]) for (let i = 0; i < 3; i++) L.push(spikeGeo(-12 + i * 4, -6, sd * 8, -18 + i * 4, -14, sd * 10, 1.6, 5)); return merge(L); });
    k.mesh(crestG, mSpike, hs);
    const upperTeeth = M3.geo('drg:teethU', () => { const L = []; for (let i = 0; i < 9; i++) for (const sd of [1, -1]) { const x = 6 + i * 5.6, z = sd * (7.2 - i * 0.45), fang = i === 7; L.push(spikeGeo(x, -1, z, x + 0.6, fang ? -9.5 : -5.5, z * 0.97, fang ? 1.4 : 0.95, 5)); } return merge(L); });
    const lowerTeeth = M3.geo('drg:teethL', () => { const L = []; for (let i = 0; i < 8; i++) for (const sd of [1, -1]) { const x = 10 + i * 5.6, z = sd * (5.8 - i * 0.38), fang = i === 6; L.push(spikeGeo(x, 0, z, x + 0.5, fang ? 7 : 4, z * 0.97, fang ? 1.2 : 0.85, 5)); } return merge(L); });
    k.mesh(upperTeeth, mTooth, hs);
    const [jx, jy] = D.DRG_JAW;
    const jaw = k.group(hs, jx, -jy, 0);
    const jawM = k.tube([[-8, 1, 0], [12, -1, 0], [34, -1.5, 0], [56, -1, 0]], u => 7 - 3.4 * u, 0, mScale, jaw, 10, 10); jawM.scale.y = 0.62;
    k.mesh(lowerTeeth, mTooth, jaw, 0, 1.5, 0);
    k.sphere([24, 2.4, 5.4], mMouth, jaw, 26, 2.2, 0);                                                     // tongue and the floor of the mouth
    const chin = M3.geo('drg:chin', () => { const L = []; for (let i = 0; i < 3; i++) L.push(spikeGeo(2 + i * 9, -3, 0, -2 + i * 9, -10 + i, 0, 1.8, 5)); return merge(L); });
    k.mesh(chin, mSpike, jaw);
    const maw = k.sphere([22, 4, 6], mMouth, hs, 28, -2.5, 0);                                              // the roof of the mouth, glowing as the fire rises

    // ---------- the fire: roaring cones and billows from the mouth along the breath ----------
    const fireG = k.group(g); fireG.visible = false;
    const fcone = (m, r, pos) => { const c = k.mesh(M3.geo('drg:fcone', () => { const cg = new T.ConeGeometry(1, 1, 14, 1, true); cg.rotateZ(PI / 2); cg.translate(0.5, 0, 0); return cg; }), m, fireG); c.castShadow = false; c.userData.r = r; return c; };
    const cones = [fcone(mFire, 0.2), fcone(mFire2, 0.08)];
    const NB = 10, billows = []; for (let i = 0; i < NB; i++) { const b = k.sphere(1, [mFire2, mFire3, mFire, mFire4][Math.min(3, i * 4 / NB | 0)], fireG); b.castShadow = false; b.renderOrder = 2; billows.push(b); }

    // ---------- wings: bones posed in the wing plane, a membrane stretched between them every frame ----------
    const wings = [];
    for (const s of [1, -1]) {
      const root = k.group(bod, 20, 30, s * 16); root.rotation.order = 'XYZ';
      const bones = [k.limb(36, 6.5, 4.5, mBone, root), k.limb(38, 4.5, 3.4, mBone, root)];
      const fingers = [];
      for (let i = 0; i < 4; i++) fingers.push([k.limb(30, 2.8, 2.1, mBone, root), k.limb(40, 2.1, 0.9, mBone, root), k.cone(1.4, 5, mClaw, root, 0, 0, 0, 5)]);
      const thumb = k.cone(2, 9, mClaw, root, 0, 0, 0, 5);
      const n = OUTLINE.length, geo = new T.BufferGeometry(), P = new Float32Array((1 + 2 * n) * 3), U = new Float32Array((1 + 2 * n) * 2), idx = [];
      for (let i = 0; i < n; i++) { const a = 1 + i * 2, b = 1 + ((i + 1) % n) * 2; idx.push(0, a, b, a, a + 1, b + 1, a, b + 1, b); }
      geo.setIndex(idx); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('uv', new T.BufferAttribute(U, 2)); k.own.push(geo);
      const mem = k.mesh(geo, mWing, root); mem.castShadow = false;
      wings.push({ s, root, bones, fingers, thumb, mem, geo, P, U, done: false });
    }
    // the wing in its own plane -> the wing root's space: chord along +x (squeezed by cx), span out along s*z (squeezed by sx), cupped toward -y
    const wp = (w, x, y, sx, cx, cup, out) => { const span = -y * sx; out[0] = x * cx; out[1] = -cup * (span * span) / 9000 - (x < 0 ? -x * 0.04 : 0); out[2] = w.s * span; return out; };
    const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
    function poseWing(w, sx, cx, cup) {
      // bones
      wp(w, 0, 0, sx, cx, cup, A); wp(w, WE[0], WE[1], sx, cx, cup, B); bone(w.bones[0], 36, A[0], A[1], A[2], B[0], B[1], B[2]);
      wp(w, WW[0], WW[1], sx, cx, cup, C); bone(w.bones[1], 38, B[0], B[1], B[2], C[0], C[1], C[2]);
      w.thumb.position.set(C[0] + 3, C[1] + 2, C[2]); w.thumb.rotation.set(0, 0, -1.2);
      for (let i = 0; i < 4; i++) {
        const f = WF[i], kx = WW[0] + (f[0] - WW[0]) * 0.42 + 4, ky = WW[1] + (f[1] - WW[1]) * 0.42 - 3, F = w.fingers[i];
        wp(w, kx, ky, sx, cx, cup, A); bone(F[0], 30, C[0], C[1], C[2], A[0], A[1], A[2]);
        wp(w, f[0], f[1], sx, cx, cup, B); bone(F[1], 40, A[0], A[1], A[2], B[0], B[1], B[2]);
        F[2].position.set(B[0], B[1], B[2]); F[2].quaternion.setFromUnitVectors(UP, _d.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize());
      }
      // membrane: the wrist, then a mid ring that billows a little and the outline itself
      const P = w.P, U = w.U;
      wp(w, WW[0], WW[1], sx, cx, cup, A); P[0] = A[0]; P[1] = A[1]; P[2] = A[2];
      if (!w.done) { U[0] = (WW[0] + 130) / 150; U[1] = -WW[1] / 150; }
      for (let i = 0; i < OUTLINE.length; i++) {
        const o = OUTLINE[i], ex = o.p[0], ey = o.p[1], mx = (ex + WW[0]) / 2, my = (ey + WW[1]) / 2, j = 3 + i * 6;
        wp(w, mx, my, sx, cx, cup, A); P[j] = A[0]; P[j + 1] = A[1] - (o.body ? 0 : 3 * cup); P[j + 2] = A[2];
        wp(w, ex, ey, sx, cx, cup, B); P[j + 3] = B[0]; P[j + 4] = B[1] - (o.sag ? 5 * o.sag * cup : 0); P[j + 5] = B[2];
        if (!w.done) { const u = 2 + i * 4; U[u] = (mx + 130) / 150; U[u + 1] = -my / 150; U[u + 2] = (ex + 130) / 150; U[u + 3] = -ey / 150; }
      }
      w.geo.attributes.position.needsUpdate = true;
      if (!w.done) { w.geo.attributes.uv.needsUpdate = true; w.done = true; }
      w.geo.computeVertexNormals(); w.geo.computeBoundingSphere();
    }

    // ---------- posing ----------
    const pose = {}, v = new T.Vector3(), v2 = new T.Vector3(), fq = new T.Quaternion();
    let frame = 0, emberK = 0.2;
    const neckBase = [48, 4], nb = [0, 0, 0], ne = [0, 0, 0], Q = [0, 0, 0];
    // a point in the body's (reared, crouched) frame -> the model frame
    const bodToG = (x, y, z, out) => { const r = rearG.rotation.z, c = Math.cos(r), s = Math.sin(r), ux = x - PV[0], uy = y + PV[1]; out[0] = PV[0] + ux * c - uy * s; out[1] = rearG.position.y + ux * s + uy * c; out[2] = z; return out; };
    return function update(e, t, dt) {
      frame++;
      const P = D.dragonPose(e, t, pose), held = e.held, ko = e.ko, air = !!e.flyPh && !held && !ko, seed = e.seed || 0;
      const walking = e.moving && e.grounded && !held && !air, angry = e.mood === 'angry' || e.mode === 'hunt';
      const inh = e.breath > R.breath, firing = (e.breath > 0 && !inh) || e.rainT > 0;
      // the body: crouch and rear
      rearG.position.y = -PV[1] - P.dy; rearG.rotation.z = 0.32 * P.rear;
      bod.position.y = PV[1] + (walking ? -Math.abs(Math.sin(e.phase || 0)) * 1.5 : 0);
      // ---- legs (feet in the body's frame, like the drawing) ----
      const G = -(80 - P.dy), ph = e.phase || 0;
      for (const L of legs) {
        const far = L.s < 0, a = L.hind ? (far ? ph + PI : ph) : (far ? ph : ph + PI);
        let fx, fy, fz = L.z * 1.05, px = L.hind ? 1 : -1, py = 0;
        if (air) { if (L.hind) { fx = L.hx - 26; fy = -50; } else { fx = L.hx + 30; fy = -36; } px = L.hind ? 1 : 0.3; py = L.hind ? 0 : 1; }
        else if (held) { const sw = Math.sin(t * 9 + (far ? 1 : 0) + (L.hind ? 0 : 2)) * 6; fx = L.hx + 4 + sw; fy = -74; }
        else if (ko) { fx = L.hx + (L.hind ? -10 : 14); fy = -60; }
        else {
          const sx = walking ? Math.sin(a) * 16 : 0, lift = walking ? Math.max(0, Math.cos(a)) * 10 : 0;
          fx = (L.hind ? -40 : 46) + sx; fy = G + lift + 3;
          if (!L.hind && P.rear > 0) { fx += (80 - fx) * P.rear; fy += (-22 - fy) * P.rear; py = P.rear; }
        }
        L.up.position.y = L.hy;
        ik(L.up, L.lo, L.a, L.b, fx, fy, fz, px, py, 0, L.ft);
        L.fm.rotation.z = air ? (L.hind ? -1.1 : 0.6) : held ? 0.5 : 0;
      }
      // ---- tail ----
      if (frame % 2 === 0 || frame < 3 || e.whipT > 0) {
        const wag = Math.sin(t * 1.5 + seed) * 6, zw = Math.sin(t * 1.1 + seed) * 14;
        let cx, cy, x1, y1, cz = zw * 0.5, z1 = zw;
        if (e.whipT > 0) {
          const u = 1 - e.whipT / R.tail;
          if (u < 0.35) { const q = sm01(u / 0.35); cx = -126; cy = -6 - q * 50; x1 = -168 + q * 34; y1 = 36 - q * 136; z1 = -q * 30; }
          else if (u < 0.6) { const q = sm01((u - 0.35) / 0.25); cx = -126 - q * 20; cy = -56 + q * 50; x1 = -134 - q * 60; y1 = -100 + q * 158; z1 = -30 + q * 110; cz = q * 50; }
          else { const q = sm01((u - 0.6) / 0.4); cx = -146 + q * 20; cy = -6; x1 = -194 + q * 26; y1 = 58 - q * 22; z1 = 80 * (1 - q); cz = 40 * (1 - q); }
        }
        else if (air) { cx = -130; cy = wag * 0.5; x1 = -186; y1 = 12 + Math.sin(t * 3 + seed) * 12; }
        else if (held) { cx = -100; cy = 30; x1 = -108 + wag; y1 = 78; }
        else if (ko) { cx = -120; cy = 40; x1 = -160; y1 = 70; }
        else { cx = -128; cy = -6 + wag * 0.5; x1 = -168; y1 = 80 - P.dy - 44 + wag * 1.5; }
        for (let i = 0; i < tailP.length; i++) qpt(tailP[i], -76, 2, 0, cx, -cy, cz, x1, -y1, z1, i / (tailP.length - 1));
        tail.geometry.setPath(tailP);
        const crv = tail.geometry;   // spines along the top of the tail
        for (let i = 0; i < TAILN; i++) {
          const u = (i + 1) / (TAILN + 2); qpt(Q, -76, 2, 0, cx, -cy, cz, x1, -y1, z1, u); qpt(nb, -76, 2, 0, cx, -cy, cz, x1, -y1, z1, u + 0.02);
          const tx = nb[0] - Q[0], ty = nb[1] - Q[1], tl = Math.hypot(tx, ty) || 1, r = 15 * Math.pow(1 - u, 0.85) + 2;
          const sp = tailSp[i]; sp.position.set(Q[0] - ty / tl * r * 0.85, Q[1] + tx / tl * r * 0.85, Q[2]); sp.rotation.set(0, 0, Math.atan2(ty, tx) + PI / 2 + 0.45);
        }
        const e1 = tailP[tailP.length - 1], e0 = tailP[tailP.length - 2];
        blade.position.set(e1[0], e1[1], e1[2]); blade.quaternion.setFromUnitVectors(XA, v.set(e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]).normalize());
        void crv;
      }
      // ---- wings ----
      let lift, sweep, sx = 1, cx = 1, cup = 1;
      const fl = t * (e.flyPh === 'up' ? 9 : 5.5) + seed;
      if (held) { lift = Math.sin(t * 12) * 0.9; sweep = 0.4; }
      else if (ko) { lift = -0.5; sweep = 1.0; sx = 0.6; cx = 0.8; }
      else if (e.beatT > 0 && !air) {
        const u = 1 - e.beatT / R.beat;
        if (u < 0.5) { const q = sm01(u / 0.5); lift = 0.25 + q * 1.0; sweep = 1.25 - q * 1.45; sx = 0.42 + q * 0.58; cx = 0.55 + q * 0.45; }
        else if (u < 0.62) { const q = (u - 0.5) / 0.12; lift = 1.25 - q * 2.1; sweep = -0.2 + q * 0.5; }
        else { const q = sm01((u - 0.62) / 0.38); lift = -0.85 + q * 1.1; sweep = 0.3 + q * 0.95; sx = 1 - q * 0.58; cx = 1 - q * 0.45; }
      }
      else if (air) { lift = -0.05 + 1.05 * Math.sin(fl); sweep = 0.25 + Math.cos(fl) * 0.15; cup = 1 + Math.cos(fl) * 0.5; }
      else if (e.breath > 0) { lift = 0.75; sweep = 0.5; sx = 0.92; }
      else if (e.poundT > 0) { lift = 0.85; sweep = 0.35; }
      else if (e.whipT > 0) { lift = 0.55; sweep = 0.65; sx = 0.85; }
      else { lift = 0.3 + (angry ? 0.06 : 0) + Math.sin(t * 1.1 + seed) * 0.02; sweep = 1.25; sx = 0.42; cx = 0.55; cup = 0.4; }   // folded along the flanks
      for (const w of wings) {
        const far = w.s < 0;
        w.root.rotation.set(-w.s * lift * (far ? 0.94 : 1), -w.s * sweep, (sx < 0.6 ? 0.25 : 0.05));
        poseWing(w, sx, cx, cup);
      }
      // ---- head: the mouth goes exactly where the game breathes fire from, and the head looks along the stage ----
      const M = D.dragonMouth(e, t), f = e.facing >= 0 ? 1 : -1, ya = k.root.parent ? k.root.parent.rotation.y : -0.38;
      const ca = Math.cos(ya), sa = Math.sin(ya);
      const tx = f * M[0] * ca, tz = f * M[0] * sa, ty = -M[1];   // the mouth target, turned back by the model's yaw (in the model's own space)
      head.rotation.set(0, -Math.atan2(f * sa, f * ca), -P.ha);
      const co = Math.cos(P.open), so = Math.sin(P.open), lx = 54 - jx, ly = 7 - jy, bx = jx + lx * co - ly * so, by = jy + lx * so + ly * co;
      v.set((58 + bx) / 2 * HS, -(2 + by) / 2 * HS, 0).applyQuaternion(head.quaternion);
      head.position.set(tx - v.x, ty - v.y, tz - v.z);
      jaw.rotation.z = -P.open;
      // ---- neck: from the chest to the back of the skull ----
      bodToG(neckBase[0], neckBase[1], 0, nb);
      v.set(-12 * HS, -1 * HS, 0).applyQuaternion(head.quaternion).add(head.position); ne[0] = v.x; ne[1] = v.y; ne[2] = v.z;
      const ncx = nb[0] + (ne[0] - nb[0]) * 0.3, ncy = Math.max(nb[1], ne[1]) - 2, ncz = ne[2] * 0.35;
      for (let i = 0; i < neckP.length; i++) { const u = i / (neckP.length - 1); qpt(neckP[i], nb[0], nb[1], nb[2], ncx, ncy, ncz, ne[0], ne[1], ne[2], u); const tp = throatP[i]; tp[0] = neckP[i][0] + 3 * (1 - u) + 1; tp[1] = neckP[i][1] - 6 + 2 * u; tp[2] = neckP[i][2]; }
      neck.geometry.setPath(neckP); throat.geometry.setPath(throatP);
      for (let i = 0; i < neckSp.length; i++) {
        const u = (i + 1) / (neckSp.length + 1.5); qpt(Q, nb[0], nb[1], nb[2], ncx, ncy, ncz, ne[0], ne[1], ne[2], u); qpt(A, nb[0], nb[1], nb[2], ncx, ncy, ncz, ne[0], ne[1], ne[2], u + 0.03);
        const dx = A[0] - Q[0], dy = A[1] - Q[1], dl = Math.hypot(dx, dy) || 1, r = (21 - 11 * u) * 0.9;
        const sp = neckSp[i]; sp.position.set(Q[0] - dy / dl * r, Q[1] + dx / dl * r, Q[2]); sp.rotation.set(0, 0, Math.atan2(dy, dx) + PI / 2 + 0.5);
      }
      // ---- the fire inside: belly seams, throat and mouth glow, brightest as it draws breath ----
      const want = ko ? 0 : inh ? 0.35 + 0.65 * sm01((R.inhale + R.breath - e.breath) / R.inhale) : firing ? 1 : 0.22 + 0.08 * Math.sin(t * 2.2 + seed);
      emberK = damp(emberK, want, 8, dt);
      const fk = 0.9 + 0.1 * Math.sin(t * 13 + seed);
      mBelly.emissiveIntensity = (0.15 + emberK * 2.6) * fk; mMouth.emissiveIntensity = 0.1 + emberK * 2.4 * fk;
      maw.visible = P.open > 0.12;
      // ---- the fire itself ----
      fireG.visible = firing;
      if (firing) {
        const L = Math.max(30, e.fireLen || R.reach * KD * (e.scale || 1)) / (KD * (e.scale || 1)), dir = v2.set(f * Math.cos(M[2]), -Math.sin(M[2]), 0).applyAxisAngle(UP, -ya);
        fireG.position.set(tx, ty, tz); fireG.quaternion.copy(fq.setFromUnitVectors(XA, dir));
        for (let i = 0; i < cones.length; i++) { const c = cones[i], q = 1 + Math.sin(t * (21 + i * 6) + i * 2) * 0.12, len = L * (i === 1 ? 0.7 : 0.95); c.scale.set(len, L * c.userData.r * q, L * c.userData.r * q); }
        for (let i = 0; i < NB; i++) {   // billows roll out along the jet, growing and darkening as they go
          const u = 0.12 + ((i / NB + t * 1.9 + seed * 0.1) % 1) * 0.92, r = L * (0.05 + 0.2 * Math.pow(u, 0.8)), b = billows[i];
          b.material = [mFire2, mFire3, mFire, mFire4][Math.min(3, u * 3.6 | 0)];
          b.position.set(u * L, Math.sin(t * 9 + i * 2.1) * r * 0.35, Math.cos(t * 7 + i * 1.3) * r * 0.35); b.scale.set(r * 1.25, r, r);
        }
      }
    };
  };
})();
