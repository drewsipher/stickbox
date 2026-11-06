'use strict';
// m-phoenix.js — 3D models (see js/3d/r3d.js for the model kit)
// The phoenix boss: a giant bird of living fire. Layered flame-feathered wings that really flap and fold,
// long flowing tail plumes, glowing feather tips and embers, a hooked beak and taloned feet; dives nose-down
// with its talons thrown forward, rears back on raised wings to throw fireballs, and during its rebirth it
// burns away to a heap of ash with a glowing egg that hatches it again.
(function () {
  if (!SB.M3) return;
  const T = THREE, M3 = SB.M3, PI = Math.PI;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const K = 1.4;   // the def's drawK: the model is authored in the 2D drawing's units and scaled up like the drawing

  // ---------- shared geometry ----------
  // a flame-shaped feather, 1 long (+x) and 1 wide (y), thin in z, curling a little toward -z along its length
  const featherGeo = () => M3.geo('phx:feather', () => {
    const P = [0, -0.2, 0.3, -0.52, 0.62, -0.47, 0.84, -0.3, 1.08, -0.1, 0.9, 0.06, 1.02, 0.26, 0.8, 0.44, 0.45, 0.52, 0.12, 0.32];
    const n = P.length / 2, s = new T.Shape(), X = i => P[(i % n) * 2], Y = i => P[(i % n) * 2 + 1];
    s.moveTo((X(n - 1) + X(0)) / 2, (Y(n - 1) + Y(0)) / 2);
    for (let i = 0; i < n; i++) s.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    const g = new T.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.015, bevelSegments: 1, curveSegments: 3 });
    g.translate(0, 0, -0.3);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) - 0.22 * x * x); }   // the vane curls
    g.computeVertexNormals();
    return g;
  });
  // a tongue of flame standing on its base (+y up), 1 wide and 2 tall
  const flameGeo = () => M3.geo('phx:flame', () => new T.LatheGeometry([[0, -0.1], [0.42, 0.05], [0.55, 0.35], [0.48, 0.75], [0.32, 1.2], [0.14, 1.65], [0, 2]].map(p => new T.Vector2(p[0], p[1])), 12));

  // colour ramps along a feather (u: root -> tip) for the diffuse map, and a glow ramp for the emissive map
  const RAMPS = new Map();
  function ramp(col, vertical, glow) {
    const key = col + (vertical ? 'v' : 'h') + (glow ? 'g' : '');
    let tx = RAMPS.get(key); if (tx) return tx;
    const cv = document.createElement('canvas'); cv.width = vertical ? 1 : 64; cv.height = vertical ? 64 : 1;
    const c = cv.getContext('2d'), g = vertical ? c.createLinearGradient(0, 64, 0, 0) : c.createLinearGradient(0, 0, 64, 0);
    if (glow) { g.addColorStop(0, '#000'); g.addColorStop(0.45, '#000'); g.addColorStop(0.78, '#7a7a7a'); g.addColorStop(1, '#fff'); }
    else { g.addColorStop(0, SB.shade(col, 0.4)); g.addColorStop(0.45, col); g.addColorStop(0.8, SB.mixColor(col, '#ffc93c', 0.6)); g.addColorStop(1, SB.mixColor(col, '#fff3c4', 0.8)); }
    c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
    tx = new T.CanvasTexture(cv); tx.encoding = glow ? T.LinearEncoding : T.sRGBEncoding; RAMPS.set(key, tx);
    return tx;
  }

  M3.named['phoenix'] = function (e, k) {
    const body = k.col('body'), wingC = k.col('wing'), tailC = k.col('tail'), beakC = k.col('beak'), legC = k.col('leg');
    const glowC = SB.mixColor(wingC, '#ffc93c', 0.55), eyeC = k.col('eyeGlow') || '#fff07a';
    const emis = [];   // [material, base glow] for the flicker
    const lit = (m, gk) => { emis.push([m, gk]); return m; };
    // feather material: a ramp from a dark root to a burning gold tip, the tip glowing
    const fmat = (col, vertical) => {
      const m = k.mat('#ffffff', { glow: glowC, glowK: 1.2, side: 'double', rough: 0.55, tag: 'phx' + col + (vertical ? 'v' : '') });
      if (!m.map) { m.map = ramp(col, vertical); m.emissiveMap = ramp(col, vertical, true); m.needsUpdate = true; lit(m, 1.2); }
      return m;
    };
    const mBody = lit(k.mat(body, { glow: SB.mixColor(body, '#ff5a10', 0.5), glowK: 0.28, rough: 0.7 }), 0.28);
    const mBreast = lit(k.mat(SB.mixColor(body, tailC, 0.3), { glow: '#ff6a10', glowK: 0.22, rough: 0.75 }), 0.22);
    const fWing = fmat(wingC), fSec = fmat(SB.shade(tailC, 0.06)), fCov = fmat(SB.mixColor(wingC, body, 0.35)), fTail = fmat(tailC), fBody = fmat(SB.mixColor(body, tailC, 0.3)), fDark = fmat(SB.shade(body, -0.05));
    const mPlume = k.mat('#ffffff', { glow: glowC, glowK: 1.1, rough: 0.6, tag: 'phxplume' + tailC });
    if (!mPlume.map) { mPlume.map = ramp(tailC, true); mPlume.emissiveMap = ramp(tailC, true, true); mPlume.needsUpdate = true; lit(mPlume, 1.1); }
    const mBeak = k.mat(beakC, { rough: 0.35, metal: 0.1 }), mCere = k.mat(SB.shade(beakC, 0.35), { rough: 0.5 }), mLeg = k.mat(legC, { rough: 0.55 }), mTalon = k.mat('#15100c', { rough: 0.25 });
    const mMask = k.mat(SB.shade(body, 0.45), { rough: 0.6 }), mEye = k.mat(eyeC, { glow: eyeC, glowK: 1.6, rough: 0.2 }), mPupil = k.mat('#0a0503', { rough: 0.2 });
    const mHot = lit(k.mat('#fff0b8', { glow: '#ffd36a', glowK: 2.2, rough: 1 }), 2.2), mEmber = lit(k.mat('#ffcf4a', { glow: '#ffb02e', glowK: 1.8, rough: 1 }), 1.8);
    const mFlame = lit(k.mat('#ff9a2a', { glow: '#ff7a10', glowK: 1.7, opacity: 0.8, rough: 1 }), 1.7), mCore = lit(k.mat('#fff2b0', { glow: '#ffd36a', glowK: 2.3, opacity: 0.9, rough: 1 }), 2.3);
    const FG = featherGeo(), FL = flameGeo();
    // a feather: lying in its parent's xy plane pointing along angle a (radians from +x), len x wid, its plane turned by yaw about the length
    const feather = (parent, x, y, z, a, len, wid, mat, yaw, roll) => {
      const m = k.mesh(FG, mat, parent, x, y, z); m.castShadow = false;
      m.rotation.set(roll || 0, yaw || 0, a, 'XYZ'); m.scale.set(len, wid, Math.max(1, wid * 0.12));
      return m;
    };
    // a feather lying in a wing (the parent's xz plane), pointing back (-x) and swung out by b toward the wing tip (side s)
    const wfeather = (parent, x, z, s, b, len, wid, mat, droop, lift) => {
      const m = k.mesh(FG, mat, parent, x, lift || 0, z); m.castShadow = false;
      m.rotation.set(PI / 2 * s, PI + s * b, droop || -0.08, 'YZX'); m.scale.set(len, wid, Math.max(1, wid * 0.1));
      return m;
    };
    const flame = (parent, x, y, z, r) => {
      const o = k.group(parent, x, y, z);
      const a = k.mesh(FL, mFlame, o); a.castShadow = false; const b = k.mesh(FL, mCore, o, 0, 0, 0); b.castShadow = false; b.scale.setScalar(0.55);
      o.r = r; o.scale.setScalar(r); flames.push(o); return o;
    };
    const flames = [];

    const root = k.root;
    const g = k.group(root); g.scale.setScalar(K);   // the bird, in drawing units, pitched for dives
    const rb = k.group(root); rb.scale.setScalar(K); rb.visible = false;   // the rebirth: ash, egg and a pillar of fire

    // ---- body: a deep keel of ember-red plumage ----
    const torso = k.group(g, 8, 0, 0); torso.rotation.z = 0.08;
    k.sphere([38, 22, 21], mBody, torso, 0, 0, 0);
    k.sphere([18, 17, 17], mBreast, torso, 22, -1, 0);
    k.sphere([18, 14, 15], mBody, torso, -26, 2, 0);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) for (const zs of [1, -1]) feather(torso, 34 - i * 14 - j * 4, 8 - j * 9, zs * (13 + j * 2 - (i === 0 ? 3 : 0)), PI + 0.35 - j * 0.15, 24 - j * 2, 13, j === 1 ? fDark : fBody, zs * (0.45 + j * 0.1));   // breast and flank feathers
    const embers = [];
    for (let i = 0; i < 6; i++) { const a = i * 2.1, m = k.sphere(1.6, mEmber, torso, -20 + i * 9, 6 + Math.sin(a) * 9, Math.cos(a) * 19); m.castShadow = false; embers.push(m); }

    // ---- neck under a ruff of flame hackles, and the head ----
    k.tube([[24, 8, 0], [40, 18, 0], [52, 27, 0], [60, 34, 0]], 14, 9, mBody, g, 10, 12);
    for (let i = 0; i < 8; i++) { const f = i / 7, zs = i % 2 ? 1 : -1; feather(g, 56 - f * 30, 36 - f * 24, zs * 7, PI + 0.55 - f * 0.15, 28 - f * 4, 14, i % 3 ? fWing : fCov, zs * 0.5); }
    const head = k.group(g, 62, 37, 0), eyes = [];
    k.sphere([14, 11, 10.5], mBody, head).rotation.z = 0.25;
    for (const zs of [1, -1]) {
      k.sphere([8.5, 5.5, 3], mMask, head, 3, 1, zs * 7.6).rotation.y = zs * 0.3;
      const eye = k.group(head, 4, 2, zs * 8.2); eye.rotation.y = zs * 0.35;
      k.sphere([3.6, 3.2, 2.2], mEye, eye);
      k.sphere([0.7, 2.8, 0.8], mPupil, eye, 0.6, 0, zs * 1.9);
      const brow = k.box(10, 2.4, 2.6, mMask, head, 3, 6, zs * 7.4); brow.rotation.z = -0.25; brow.rotation.y = zs * 0.3;
      eyes.push(eye);
      feather(head, -2, -6, zs * 7, PI - 0.4, 18, 10, fDark, zs * 0.4);   // cheek
    }
    // crest of fire feathers sweeping back from the crown
    const crest = [];
    for (let i = 0; i < 6; i++) crest.push(feather(head, -4 + i * 2.4, 7, (i % 3 - 1) * 3, 2.4 + i * 0.12, 34 - i * 3, 11, i % 2 ? fWing : fTail, (i % 3 - 1) * 0.35));
    // hooked beak: upper mandible over a hinged lower jaw
    const upper = [68, 44, 78, 42, 86, 37, 90, 31, 89, 24, 86, 28, 81, 31, 70, 31].map((v, i) => i % 2 ? v - 37 : v - 62);
    k.extrude(upper, 8, mBeak, head, 0, 0, 0, 2.2);
    k.sphere([4, 6, 4.6], mCere, head, 7, 1.5, 0);
    const jaw = k.group(head, 9, -6, 0);
    k.extrude([-1, -1, 10, -2, 14, -4, 1, -6], 6.4, k.mat(SB.shade(beakC, 0.25), { rough: 0.4 }), jaw, 0, 0, 0, 1.6);
    const maw = k.sphere([7, 2.6, 3.4], mHot, head, 16, -6, 0); maw.visible = false;

    // ---- wings: shoulder -> elbow -> wrist, each joint posable; feathers ride on the bones ----
    const wings = [];
    const buildWing = s => {   // s = +1 near (toward the camera), -1 far
      const S = k.group(g, 10, 18, s * 13);
      const arm = k.limb(30, 7, 5, mBody, S); arm.rotation.x = -s * PI / 2;
      const E = k.group(S, -4, 0, s * 30);
      const fore = k.limb(32, 5, 4, mBody, E); fore.rotation.x = -s * PI / 2;
      const Wr = k.group(E, 4, 0, s * 32);
      const hand = k.limb(28, 4, 2.5, mBody, Wr); hand.rotation.x = -s * PI / 2;
      // secondaries hang back from the forearm, primaries fan out from the hand, coverts lie over the bones
      for (let i = 0; i < 7; i++) { const f = i / 6; wfeather(E, -2, s * (2 + f * 29), s, 0.05 + f * 0.22, 44 + f * 6, 18, fSec, -0.1, -0.5 - i * 0.05); }
      for (let i = 0; i < 7; i++) { const f = i / 6; wfeather(Wr, 0, s * (1 + f * 26), s, 0.35 + f * 1.0, 48 + Math.sin(f * 2.6) * 14, 16, fWing, -0.06 - f * 0.05, -0.3 - i * 0.05); }
      for (let i = 0; i < 6; i++) { const f = (i + 0.5) / 6; wfeather(i < 3 ? S : E, 1, s * (i < 3 ? 6 + i * 9 : (i - 3) * 10 + 4), s, 0.12, 28, 14, fCov, -0.05, 1.2); }
      for (let i = 0; i < 4; i++) wfeather(Wr, 2, s * (3 + i * 7), s, 0.45 + i * 0.12, 26, 12, fWing, -0.05, 1.0);
      for (let i = 0; i < 5; i++) wfeather(i < 3 ? S : E, 4, s * (i < 3 ? 4 + i * 9 : (i - 3) * 12 + 6), s, 0.1, 16, 10, fBody, -0.03, 2.2);
      const w = { s, S, E, Wr };
      wings.push(w);
    };
    buildWing(1); buildWing(-1);

    // ---- tail: long plumes of fire streaming behind, each ending in a burning eye-feather ----
    const NP = 7, plumes = [];
    for (let i = 0; i < 6; i++) feather(g, -22, -2 + (i % 2) * 2, (i - 2.5) * 4, PI - 0.25 + i * 0.1, 40, 17, fTail, (i - 2.5) * 0.18);   // tail coverts
    for (let i = 0; i < NP; i++) {
      const pts = []; for (let j = 0; j < 6; j++) pts.push([0, 0, 0]);
      const tube = k.tube([[-20, 0, 0], [-60, -10, 0], [-110, -20, 0]], 6, 1.8, mPlume, g, 14, 7); tube.castShadow = false;
      const end = feather(g, 0, 0, 0, 0, 40, 16, fTail);
      const barbs = [feather(g, 0, 0, 0, 0, 22, 8, fTail), feather(g, 0, 0, 0, 0, 18, 7, fSec)];
      const eyeD = i % 2 ? null : k.sphere([6, 4.2, 1.6], mHot, g);
      if (eyeD) { eyeD.castShadow = false; k.sphere([3, 2.2, 1], mBody, eyeD, 0, 0, 0.7).scale.set(0.5, 0.52, 0.8); }
      plumes.push({ i, f: i / (NP - 1), zs: (i - (NP - 1) / 2) * 5, pts, tube, end, barbs, eyeD });
    }

    // ---- legs: feathered thighs, scaly shanks, taloned toes ----
    const legs = [];
    for (const s of [1, -1]) {
      const hip = k.group(g, 2 + (s < 0 ? 6 : 0), -14, s * 9);
      for (let i = 0; i < 3; i++) feather(hip, -6 + i * 6, 2, 0, -PI / 2 - 0.4 + i * 0.3, 22, 12, fDark, s * 0.3);
      const shank = k.limb(24, 3.6, 2.8, mLeg, g, 0, 0, s * 9);
      const foot = k.group(g, 0, 0, s * 9), toes = [];
      for (const [yaw, L] of [[-0.45, 12], [0, 14], [0.45, 11], [PI, 8]]) {
        const tp = k.limb(L, 2.2, 1.6, mLeg, foot); tp.yaw = yaw;
        const cl = k.cone(1.7, 7, mTalon, tp, 0, -L - 1, 0, 8); cl.rotation.z = PI + 1.0;
        toes.push(tp);
      }
      legs.push({ s, hip, shank, foot, toes });
    }

    // ---- fire on the back, crown and shoulders ----
    flame(g, -6, 21, 0, 6.5); flame(g, 14, 25, 3, 5.5); flame(g, 30, 20, -3, 4.5); flame(head, -6, 10, 0, 6);

    // ---- the rebirth: a heap of ash, an egg, a pillar of fire ----
    const pile = k.group(rb, 0, -75, 0);
    k.sphere([46, 11, 32], k.mat('#55504c', { rough: 0.95 }), pile, 0, 0, 0);
    k.sphere([30, 13, 22], k.mat('#3a3432', { rough: 0.95 }), pile, 4, 1, 2);
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4; k.sphere([10 + (i % 3) * 3, 6 + (i % 2) * 3, 9], k.mat(i % 2 ? '#4a4442' : '#625b56', { rough: 0.95 }), pile, Math.cos(a) * 30, 3, Math.sin(a) * 18); }
    const ashEmbers = [];
    for (let i = 0; i < 6; i++) { const a = i * 1.7, m = k.sphere(1.8, mEmber, pile, Math.cos(a) * 30, 6 + (i % 3) * 2, Math.sin(a) * 18); m.castShadow = false; ashEmbers.push(m); }
    const egg = k.group(rb, 0, -75 + 8, 0);
    const mEgg = lit(k.mat('#c8431a', { glow: '#ff5a10', glowK: 0.5, rough: 0.3 }), 0.5);
    k.sphere([16, 21, 16], mEgg, egg, 0, 21, 0);
    const cracks = [];
    for (let i = 0; i < 4; i++) { const c = k.box(1.4, 11 - i, 1.2, mHot, egg, -8 + i * 5.5, 24 + (i % 2) * 5, 14.6 - Math.abs(i - 1.5) * 1.6); c.rotation.z = (i % 2 ? 0.7 : -0.7); c.castShadow = false; cracks.push(c); }
    const pillar = k.group(rb, 0, -75, 0), pfl = [];
    const mPillar = lit(k.mat('#ff9a2a', { glow: '#ff7a10', glowK: 2.2, opacity: 0.74, rough: 1 }), 2.2);
    const col = k.mesh(FL, mPillar, pillar); col.castShadow = false; col.scale.set(40, 60, 34);
    for (let i = 0; i < 4; i++) { const o = k.group(pillar, (i - 1.5) * 14, 0, (i % 2 ? 8 : -8)); const a = k.mesh(FL, mFlame, o); a.castShadow = false; const b = k.mesh(FL, mCore, o); b.castShadow = false; b.scale.setScalar(0.55); o.r = 13 + (i % 2) * 5; pfl.push(o); }

    // ---- posing ----
    const v3 = [0, 0, 0];
    const bez = (a, b, c, d, u, o) => { const m = 1 - u; for (let j = 0; j < 3; j++) o[j] = m * m * m * a[j] + 3 * m * m * u * b[j] + 3 * m * u * u * c[j] + u * u * u * d[j]; return o; };
    const P0 = [0, 0, 0], P1 = [0, 0, 0], P2 = [0, 0, 0], P3 = [0, 0, 0];
    let frame = 0, burntK = 0;
    const baseCol = new Map(), ASH = new T.Color('#3a3230');
    for (const m of k.mats) baseCol.set(m, m.color.clone());
    const poseLeg = (L, s, far) => {
      const o = far ? 1 : 0, hx = L[0] + o * 6, hy = -(L[1] - o * 2), kx = L[2] + o * 6, ky = -(L[3] - o * 2), fx = L[4] + o * 7, fy = -(L[5] - o * 2);
      const lg = legs[far ? 1 : 0];
      lg.hip.position.set(hx, hy, s * 9); lg.hip.rotation.z = Math.atan2(ky - hy, kx - hx) + PI / 2;
      const dx = fx - kx, dy = fy - ky, d = Math.hypot(dx, dy) || 1;
      lg.shank.position.set(kx, ky, s * 9); lg.shank.rotation.z = Math.atan2(dx, -dy); lg.shank.scale.y = d / 24;
      lg.foot.position.set(fx, fy, s * 9); lg.foot.rotation.z = -L[6];
      const curl = 0.9 - L[7] * 0.8;
      for (const tp of lg.toes) tp.rotation.set(0, tp.yaw, PI / 2 - curl * (tp.yaw === PI ? 0.4 : 1), 'YZX');
    };

    return function update(e, t, dt) {
      frame++;
      const R = SB.D.PHX_REBIRTH || 3.6;
      const reb = e.rebirthT > 0 ? 1 - e.rebirthT / R : -1;
      const held = e.held, ko = e.ko && reb < 0, flying = e.flying && !held, diving = e.diveT > 0, up = diving && e.divePh === 'up';
      const flapping = e.throwT > 0, windup = e.throwT > 0.32;
      const angry = e.mood === 'angry' || e.mode === 'hunt' || diving || flapping;
      const burnt = ko && e.reborn;
      // the rebirth stages
      let birdS = 1, birdY = 0;
      if (reb >= 0) {
        rb.visible = true;
        const pileOn = reb >= 0.22, eggOn = reb >= 0.22 && reb < 0.8;
        pile.visible = pileOn; egg.visible = eggOn;
        let colH = 0;
        if (reb < 0.22) { colH = 70 + reb / 0.22 * 130; birdS = 1 - reb / 0.22 * 0.6; birdY = -reb / 0.22 * 40; }
        else if (reb < 0.78) { const q = (reb - 0.22) / 0.56; colH = q < 0.35 ? 200 * (1 - q / 0.35) + 20 : 0; birdS = 0; const cr = Math.max(0, (q - 0.3) / 0.7); cracks.forEach((c, i) => { c.visible = cr > i * 0.22; }); egg.rotation.z = Math.sin(t * 18) * (q > 0.7 ? 0.12 : 0.03); mEgg.emissiveIntensity = 0.4 + cr * 1.4 + Math.sin(t * 6) * 0.15; }
        else { const v = (reb - 0.78) / 0.22; colH = 210 * Math.min(1, v * 2) * (1 - v * 0.4); birdS = 0.45 + 0.55 * v; birdY = -(1 - v) * 50; }
        pillar.visible = colH > 2; col.scale.set(30 + colH * 0.08, colH / 2, 26 + colH * 0.06);
        for (let i = 0; i < pfl.length; i++) { const o = pfl[i], f = 1 + Math.sin(t * 13 + i * 2.1) * 0.18; o.scale.set(o.r, o.r * f * (0.6 + colH / 260), o.r); }
        for (let i = 0; i < ashEmbers.length; i++) ashEmbers[i].scale.setScalar(1.2 + Math.sin(t * 5 + i * 1.9) * 0.7);
      } else rb.visible = false;
      g.visible = birdS > 0.01;
      if (!g.visible) return;
      g.scale.setScalar(K * birdS); g.position.y = birdY * K;
      g.rotation.z = -(e.pitch || 0) + (reb >= 0.78 ? 0.3 * (1 - (reb - 0.78) / 0.22) : 0);
      // wing pose: lift (up +), sweep back, elbow and wrist folds
      let lift, sweep, f1, f2, hx = 0;
      const ph = t * 6.5 + e.seed;
      if (held) { lift = Math.sin(t * 16) * 0.9; sweep = 0.1; f1 = 0.2; f2 = 0.2; }
      else if (ko) { lift = -0.35; sweep = 0.7; f1 = 0.6; f2 = 0.5; }
      else if (diving && !up) { lift = 0.4 + Math.sin(t * 30) * 0.02; sweep = 1.0; f1 = 0.35; f2 = 0.3; }
      else if (up) { lift = Math.sin(t * 15) * 0.8 + 0.1; sweep = 0.15; f1 = 0.1; f2 = 0.15; hx = -Math.sin(t * 15 - 0.8) * 0.3; }
      else if (flapping) { lift = windup ? 1.25 : -0.85; sweep = windup ? -0.1 : 0.2; f1 = 0.1; f2 = windup ? 0.25 : 0.05; }
      else if (flying || reb >= 0.78) { lift = 0.2 + 0.8 * Math.sin(ph); sweep = 0.12 - Math.cos(ph) * 0.12; f1 = 0.15; f2 = 0.2 + (1 - Math.sin(ph)) * 0.15; hx = -Math.sin(ph - 0.8) * 0.35; }
      else { lift = -0.15; sweep = 1.3; f1 = 0.45; f2 = 0.55; }   // folded along the flanks on the ground
      const fold = !held && !flying && !ko && !diving && !flapping && reb < 0.78 ? 0.6 : 1;   // folded wings tuck in shorter
      for (const w of wings) {
        const s = w.s, far = s < 0 ? 0.92 : 1;
        w.S.rotation.set(-s * lift * far, -s * sweep, 0); w.S.scale.z = fold;
        w.E.rotation.y = -s * f1; w.Wr.rotation.y = -s * f2; w.Wr.rotation.x = -s * hx;
      }
      // legs
      let L;
      if (held) { const sw = Math.sin(t * 14) * 4; L = [2, 14, 2 + sw, 34, 4 - sw, 54, PI / 2, 0.9]; }
      else if (diving && !up) L = [6, 14, 20, 30, 38, 42, 0.5, 1];
      else if (flying || up || reb >= 0.78) L = [2, 14, -8, 26, -26, 30, PI - 0.5, 0.15];
      else if (ko) L = [2, 14, -4, 34, -2, 52, PI / 2, 0.3];
      else L = [2, 14, -6, 46, 4, 70, 0, 0.55];
      poseLeg(L, 1, false); poseLeg(L, -1, true);
      // head: the jaw opens to spit fire; the crest rises when angry
      const j = flapping && !windup ? 0.5 : diving && !up ? 0.3 : angry && Math.sin(t * 2.3 + e.seed) > 0.6 ? 0.25 : 0;
      jaw.rotation.z += (-j - jaw.rotation.z) * Math.min(1, dt * 14); maw.visible = j > 0.2 && !burnt;
      head.rotation.z = flapping ? 0 : diving && !up ? -0.2 : Math.sin(t * 1.7 + e.seed) * 0.05;   // still while spitting: the fireballs leave the beak tip
      for (let i = 0; i < crest.length; i++) crest[i].rotation.z = 2.4 + i * 0.12 + Math.sin(t * 4 + i) * 0.05 - (angry ? 0.15 : 0);
      const blink = (e.seed * 7 + t) % 4 < 0.12 || e.sleeping || e.mood === 'sleep' || ko;
      for (const ey of eyes) ey.scale.y = blink ? 0.15 : angry ? 0.75 : 1;
      // tail plumes stream and ripple (bent every other frame: cheap enough for a boss)
      if (frame % 2 === 0 || frame < 3) {
        const droop = !flying && !held && !ko && e.grounded && reb < 0 ? -26 : diving ? 6 : 0, ripple = diving ? 0.35 : 1;
        for (const pl of plumes) {
          const f = pl.f, zs = pl.zs, sw = Math.sin(t * 3 + pl.i * 0.8 + e.seed) * 8 * ripple, sw2 = Math.sin(t * 2.4 + pl.i * 1.1 + e.seed) * 13 * ripple;
          P0[0] = -20; P0[1] = -2 - f * 6; P0[2] = zs * 0.4;
          P1[0] = -50; P1[1] = -4 - f * 12 - sw + droop * 0.3; P1[2] = zs;
          P2[0] = -82; P2[1] = -4 - f * 22 - (sw + sw2) * 0.5 + droop * 0.7; P2[2] = zs * 1.6 + Math.sin(t * 2 + pl.i) * 3;
          P3[0] = -110 + f * 12; P3[1] = -2 - f * 34 - sw2 + droop; P3[2] = zs * 2.3;
          for (let q = 0; q < 6; q++) bez(P0, P1, P2, P3, q / 5, pl.pts[q]);
          pl.tube.geometry.setPath(pl.pts);
          const a = pl.pts[4], b = pl.pts[5], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          pl.end.position.set(b[0] - Math.cos(ang) * 6, b[1] - Math.sin(ang) * 6, b[2]); pl.end.rotation.set(0, 0, ang);
          if (pl.eyeD) { pl.eyeD.position.set(b[0] + Math.cos(ang) * 12, b[1] + Math.sin(ang) * 12, b[2]); pl.eyeD.rotation.z = ang; }
          for (let q = 0; q < 2; q++) {
            const u = 0.4 + q * 0.25; bez(P0, P1, P2, P3, u, v3); const n = bez(P0, P1, P2, P3, u + 0.04, [0, 0, 0]);
            const ba = Math.atan2(n[1] - v3[1], n[0] - v3[0]);
            pl.barbs[q].position.set(v3[0], v3[1], v3[2]); pl.barbs[q].rotation.set(0, (q ? 0.4 : -0.4), ba + (q ? 0.3 : -0.3));
          }
        }
      }
      // fire: flames flicker, feather tips and embers pulse; burnt out after the final knock-out
      for (let i = 0; i < flames.length; i++) { const o = flames[i], f = 1 + Math.sin(t * 13 + i * 2.3) * 0.18 + Math.sin(t * 21 + i) * 0.08; o.visible = !burnt; o.scale.set(o.r * (1 + Math.sin(t * 17 + i) * 0.08), o.r * f, o.r); }
      for (let i = 0; i < embers.length; i++) embers[i].scale.setScalar(burnt ? 0.001 : 1.2 + Math.sin(t * 7 + i * 2.1 + e.seed) * 0.6);
      const pulse = 0.88 + 0.12 * Math.sin(t * 9 + e.seed) + 0.05 * Math.sin(t * 23);
      burntK += ((burnt ? 1 : 0) - burntK) * Math.min(1, dt * 3);
      for (const [m, gk] of emis) m.emissiveIntensity = gk * pulse * (1 - burntK * 0.97);
      if (burntK > 0.01 || frame === 1) for (const [m, c0] of baseCol) m.color.copy(c0).lerp(ASH, burntK * 0.75);
    };
  };
})();
