'use strict';
// m-wolf.js — 3D model of the giant wolf boss (see js/3d/r3d.js for the model kit)
// Built on the same skeleton as the 2D painting (D.wolfPose in js/boss-wolf.js), in the drawing's template units
// with y flipped up, on a root scaled by drawK, so the jaws are where the bites land and the paws stay planted.
// A shaggy coat (a strand-painted fur texture tinted by the palette, lumpy lofted body, tufts of fur along the
// hackles, the chest, the belly, the cheeks and the nape), long digitigrade legs with big clawed paws, a hinged jaw
// full of fangs, glowing slit eyes, ears that flatten, and a thick bushy tail that bends.
(function () {
  if (!SB.M3 || !window.THREE) return;
  const M3 = SB.M3, T = THREE, TAU = Math.PI * 2;
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

  // ---------- shared textures: fur strands tinted by the palette ----------
  // band: true paints a dark back (uv.x 0.25 on a loft) and a pale underside (0.75); tip: darker toward uv.y 1
  const TEX = new Map();
  function furTex(base, mane, belly, band, tip) {
    const key = [base, mane, belly, band, tip].join('|');
    let t = TEX.get(key); if (t) return t;
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), rnd = rng(key.length * 97 + 13);
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    if (band) {
      const g = x.createLinearGradient(0, 0, S, 0);
      g.addColorStop(0, base); g.addColorStop(0.25, mane); g.addColorStop(0.42, base); g.addColorStop(0.62, base); g.addColorStop(0.78, SB.mixColor(base, belly, 0.7)); g.addColorStop(1, base);
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    if (tip) { const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(0.85, SB.mixColor(mane, '#000000', 0.2)); g.addColorStop(1, mane); x.fillStyle = g; x.fillRect(0, 0, S, S); }
    // strands lying along the body (uv.y), some light, some dark, in clumps
    x.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const px = rnd() * S, py = rnd() * S, l = 6 + rnd() * 16, a = (rnd() - 0.5) * 0.5, lt = rnd() > 0.55;
      x.strokeStyle = lt ? 'rgba(235,230,222,' + (0.07 + rnd() * 0.12).toFixed(3) + ')' : 'rgba(0,0,0,' + (0.12 + rnd() * 0.2).toFixed(3) + ')';
      x.lineWidth = 0.8 + rnd() * 1.4;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 3, py - l * 0.5, px + Math.sin(a) * l, py - l); x.stroke();
    }
    t = new T.Texture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; t.userData.shared = true;
    TEX.set(key, t); return t;
  }
  // merged pieces -> one shared geometry (tufts of fur, teeth, toes, claws)
  function mergeGeo(key, pieces) {
    return M3.geo(key, () => {
      const P = [], N = [], U = [];
      for (const [g0, m] of pieces) {
        const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m);
        P.push(g.attributes.position.array); N.push(g.attributes.normal.array); U.push(g.attributes.uv.array); g.dispose();
      }
      const cat = A => { const out = new Float32Array(A.reduce((s, a) => s + a.length, 0)); let o = 0; for (const a of A) { out.set(a, o); o += a.length; } return out; };
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(cat(P), 3)); g.setAttribute('normal', new T.BufferAttribute(cat(N), 3)); g.setAttribute('uv', new T.BufferAttribute(cat(U), 2));
      return g;
    });
  }
  const _q = new T.Quaternion(), _up = new T.Vector3(0, 1, 0), _d = new T.Vector3(), _p = new T.Vector3(), _s = new T.Vector3(), _e = new T.Euler();
  const coneG = () => M3.geo('wolfcone6', () => new T.ConeGeometry(1, 1, 6));
  const sphG = () => M3.geo('wolfsph10', () => new T.SphereGeometry(1, 10, 8));
  // a tapering cone from base point a along direction d (r: base radius, h: length, flat: squash across)
  function cone(a, d, r, h, flat) {
    _d.set(d[0], d[1], d[2] || 0).normalize(); _q.setFromUnitVectors(_up, _d);
    _p.set(a[0] + _d.x * h / 2, a[1] + _d.y * h / 2, (a[2] || 0) + _d.z * h / 2);
    return [coneG(), new T.Matrix4().compose(_p, _q, _s.set(r, h, r * (flat || 1)))];
  }
  const ball = (x, y, z, rx, ry, rz) => [sphG(), new T.Matrix4().compose(_p.set(x, y, z), _q.identity(), _s.set(rx, ry, rz))];

  // ---------- the body's cross-sections (torso-local: x forward from the hip joint, y up) ----------
  const TORSO = [
    { x: -36, c: 3, t: 11, b: 11, w: 17 }, { x: -12, c: -4, t: 28, b: 28, w: 26 }, { x: 20, c: 6, t: 20, b: 19, w: 21 }, { x: 50, c: 1, t: 27, b: 27, w: 24 },
    { x: 86, c: -7, t: 39, b: 39, w: 28 }, { x: 118, c: -7, t: 43, b: 43, w: 29 }, { x: 146, c: 3, t: 23, b: 23, w: 23 }];
  const sect = (x, key) => { let i = 0; while (i < TORSO.length - 2 && TORSO[i + 1].x < x) i++; const a = TORSO[i], b = TORSO[i + 1], u = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x))); return a[key] + (b[key] - a[key]) * u; };
  const topAt = x => sect(x, 'c') + sect(x, 't'), botAt = x => sect(x, 'c') - sect(x, 'b'), wAt = x => sect(x, 'w');

  // the tufts (built once, shared by every giant wolf)
  function hackleGeo() {   // the crest along the neck and withers, relative to (95, 30)
    const r = rng(5), pc = [];
    for (let i = 0; i < 46; i++) {
      const x = 38 + r() * 112, zz = (r() - 0.5) * 2 * wAt(x) * 0.55, y = topAt(x) - 4 - Math.abs(zz) * 0.25;
      pc.push(cone([x - 95, y - 30, zz], [-0.6, 0.8, zz * 0.02], 3.5 + r() * 2.5, 11 + r() * 10 * (1 - Math.abs(x - 110) / 90), 0.6));
    }
    return mergeGeo('wolf:hackle', pc);
  }
  function bodyFurGeo() {   // shaggy back, haunches and the 'trousers' behind the thighs
    const r = rng(9), pc = [];
    for (let i = 0; i < 30; i++) { const x = -34 + r() * 76, zz = (r() - 0.5) * 2 * wAt(x) * 0.7, y = topAt(x) - 3 - Math.abs(zz) * 0.35; pc.push(cone([x, y, zz], [-0.8, 0.55, zz * 0.03], 3.2 + r() * 2, 8 + r() * 6, 0.6)); }
    for (const s of [1, -1]) for (let i = 0; i < 9; i++) { const y = -24 + i * 4.5 + r() * 2; pc.push(cone([-30 + r() * 6, y, s * (14 + r() * 8)], [-1, -0.45, s * 0.25], 3 + r() * 2, 9 + r() * 6, 0.6)); }
    return mergeGeo('wolf:bodyfur', pc);
  }
  function bellyFurGeo() {   // the ragged fringe under the chest and belly, and the chest ruff
    const r = rng(17), pc = [];
    for (let i = 0; i < 34; i++) { const x = 30 + r() * 112, zz = (r() - 0.5) * 2 * wAt(x) * 0.6, y = botAt(x) + 4 + Math.abs(zz) * 0.3; pc.push(cone([x, y, zz], [-0.45, -1, zz * 0.02], 3 + r() * 2, 7 + r() * 8, 0.6)); }
    for (let i = 0; i < 16; i++) { const y = -32 + r() * 34, zz = (r() - 0.5) * 34; pc.push(cone([146 + r() * 5, y, zz], [0.25, -1, zz * 0.03], 3.5 + r() * 2, 10 + r() * 8, 0.6)); }
    return mergeGeo('wolf:bellyfur', pc);
  }
  function neckFurGeo() {   // mane on top of the neck, ruff under the throat (neck-local, x along the neck)
    const r = rng(23), top = [], bot = [];
    for (let i = 0; i < 24; i++) { const x = -6 + r() * 42, zz = (r() - 0.5) * 30; top.push(cone([x, 18 - Math.abs(zz) * 0.3, zz], [-0.75, 0.65, zz * 0.02], 4 + r() * 2.5, 13 + r() * 9, 0.6)); }
    for (let i = 0; i < 14; i++) { const x = -4 + r() * 40, zz = (r() - 0.5) * 26; bot.push(cone([x, -18 + Math.abs(zz) * 0.3, zz], [-0.2, -1, zz * 0.03], 3.5 + r() * 2, 9 + r() * 8, 0.6)); }
    return [mergeGeo('wolf:neckmane', top), mergeGeo('wolf:throat', bot)];
  }
  function headFurGeo() {   // the ruff off the cheeks and the nape (head-local)
    const r = rng(31), pc = [];
    for (const s of [1, -1]) for (let i = 0; i < 12; i++) { const y = -14 + r() * 26, x = 2 + r() * 12; pc.push(cone([x, y, s * (13 + r() * 4)], [-0.9, -0.15 + (y > 0 ? 0.3 : 0), s * 0.5], 3.4 + r() * 2, 11 + r() * 7, 0.6)); }
    for (let i = 0; i < 12; i++) { const zz = (r() - 0.5) * 22; pc.push(cone([-6 + r() * 10, 9 + r() * 12, zz], [-0.85, 0.5, zz * 0.03], 4 + r() * 2, 13 + r() * 7, 0.6)); }
    return mergeGeo('wolf:headfur', pc);
  }

  // a bone: a kit limb (hangs along -y from its pivot); aim() points it from a to b and stretches it to fit
  const DOWN = new T.Vector3(0, -1, 0), _v = new T.Vector3();
  const bone = (k, len, r0, r1, m, parent) => { const p = k.limb(len, r0, r1, m, parent); p.len = len; return p; };
  function aim(p, ax, ay, az, bx, by, bz) {
    p.position.set(ax, ay, az); _v.set(bx - ax, by - ay, bz - az);
    const d = _v.length() || 1e-6; _v.multiplyScalar(1 / d);
    p.quaternion.setFromUnitVectors(DOWN, _v); p.scale.set(1, d / p.len, 1);
  }
  const haloMat = (k, color, op) => { const m = k.mat(color, { basic: true, opacity: op, halo: 1 }); m.blending = T.AdditiveBlending; m.depthWrite = false; return m; };

  M3.named['giant wolf'] = function (e, k) {
    const D = SB.D, WD = D.WOLF, HS = WD.HS;
    const R = k.group(k.root); R.scale.setScalar(e.def.drawK || 1);
    // ---- materials (palette colours: body, far, mane, belly, mouth, teeth, claw, nose, scar, eyeGlow) ----
    const body = k.col('body'), mane = k.col('mane'), belly = k.col('belly');
    const furM = k.mat('#ffffff', { map: furTex(body, mane, belly, true, false), rough: 0.96 });
    const coatM = k.mat('#ffffff', { map: furTex(body, mane, belly, false, false), rough: 0.95 });
    const tailM = k.mat('#ffffff', { map: furTex(body, mane, belly, false, true), rough: 0.97 });
    const maneM = k.mat(mane, { rough: 1 }), bodyFurM = k.mat(SB.mixColor(body, '#000000', 0.12), { rough: 1 }), bellyM = k.mat(SB.mixColor(body, belly, 0.6), { rough: 1 });
    const noseM = k.mat(k.col('nose'), { rough: 0.22 }), mouthM = k.mat(k.col('mouth'), { rough: 0.6 }), tongueM = k.mat('#a8464f', { rough: 0.4 });
    const toothM = k.mat(k.col('teeth'), { rough: 0.3 }), clawM = k.mat(k.col('claw'), { rough: 0.35 }), scarM = k.mat(k.col('scar'), { rough: 0.9 });
    const darkM = k.mat('#050405', { rough: 0.8 }), earInM = k.mat(SB.mixColor(body, '#6a4848', 0.45), { rough: 0.9 }), droolM = k.mat('#e4eef2', { rough: 0.08, opacity: 0.7 });
    const glow = k.col('eyeGlow');

    // ---- torso on the hip pivot ----
    const TG = k.group(R);
    k.mesh(M3.animalLoft(TORSO, { lump: 0.16, lumpF: 0.55, na: 30, radial: 22 }), furM, TG);
    for (const s of [1, -1]) {
      k.sphere([25, 30, 11], furM, TG, -6, -4, s * 19).rotation.z = 0.25;            // haunch
      k.sphere([18, 28, 9], furM, TG, WD.TS[0] - 4, -WD.TS[1] + 4, s * 21).rotation.z = -0.25;   // shoulder
    }
    const HK = k.group(TG, 95, 30, 0); k.mesh(hackleGeo(), maneM, HK);
    k.mesh(bodyFurGeo(), bodyFurM, TG); k.mesh(bellyFurGeo(), bellyM, TG);
    // ---- neck: a shaggy loft along a group from the neck base to the head ----
    const NG = k.group(R);
    k.mesh(M3.animalLoft([{ x: -10, c: 0, t: 27, b: 31, w: 23 }, { x: 14, c: 0, t: 23, b: 25, w: 20 }, { x: 38, c: 0, t: 19, b: 20, w: 17 }], { lump: 0.2, lumpF: 0.7, na: 12, radial: 18 }), coatM, NG);
    const [nmG, ntG] = neckFurGeo(); k.mesh(nmG, maneM, NG); k.mesh(ntG, bellyM, NG);
    const NECK0 = Math.hypot(30, 17);
    // ---- head ----
    const HG = k.group(R); HG.scale.setScalar(HS);
    k.sphere([23, 18, 17], coatM, HG, 13, 5, 0);                                              // cranium
    k.mesh(M3.animalLoft([{ x: 24, c: 4, t: 14, b: 14, w: 13 }, { x: 48, c: 2.5, t: 11.5, b: 11.5, w: 10 }, { x: 64, c: 0.5, t: 8.5, b: 8.5, w: 8 }, { x: 70, c: 0, t: 6, b: 6, w: 6.5 }], { na: 14, radial: 16, cap1: 0.5 }), coatM, HG);
    k.sphere([12, 7, 11], coatM, HG, 28, 15, 0);                                              // the stop
    for (const s of [1, -1]) {
      k.sphere([8, 3.5, 4.5], maneM, HG, 34, 15, s * 9).rotation.z = -0.2;                 // brow ridge
      k.sphere([13, 11, 8], coatM, HG, 16, -5, s * 11);                                      // cheek
      k.sphere([6.5, 5.5, 3], darkM, HG, 35, 11, s * 8.6);                                   // sunken eye socket
    }
    k.mesh(headFurGeo(), maneM, HG);
    k.sphere([5.5, 4.5, 6.2], noseM, HG, 70, 2.5, 0);
    k.sphere([26, 4, 7.5], mouthM, HG, 38, -10.5, 0);                                         // inside the mouth
    k.sphere([22, 2.2, 7.6], k.mat('#6e2328', { rough: 0.5 }), HG, 46, -8.6, 0);              // gums
    const upper = []; for (const s of [1, -1]) { for (let i = 0; i < 4; i++) upper.push(cone([34 + i * 5.5, -8.5, s * 6.4], [0, -1, 0], 1.25, 5, 1)); upper.push(cone([64.5, -7.5, s * 3], [0.1, -1, 0], 1.1, 4.5, 1)); }
    k.mesh(mergeGeo('wolf:uppert', upper), toothM, HG);
    for (const s of [1, -1]) { const f = k.cone(1.9, 11.5, toothM, HG, 57.5, -14, s * 5.2, 10); f.rotation.z = Math.PI; }   // the big fangs
    // lower jaw on its hinge
    const JG = k.group(HG, 10, -9, 0);
    k.mesh(M3.animalLoft([{ x: -5, c: -3, t: 5, b: 6, w: 11 }, { x: 24, c: -4, t: 4, b: 6, w: 8.5 }, { x: 52, c: -3, t: 3, b: 4.5, w: 6 }], { na: 10, radial: 14, cap1: 0.6 }), coatM, JG);
    const lower = []; for (const s of [1, -1]) { for (let i = 0; i < 4; i++) lower.push(cone([28 + i * 5.5, 0, s * 5.6], [0, 1, 0], 1.2, 4.6, 1)); lower.push(cone([50, 0, s * 4.6], [0.05, 1, 0], 1.7, 9.5, 1)); }
    k.mesh(mergeGeo('wolf:lowert', lower), toothM, JG);
    const tongue = k.sphere([18, 2.2, 6], tongueM, JG, 32, -0.5, 0);
    // glowing slit eyes
    for (const s of [1, -1]) {
      k.eye(4.3, HG, 35, 11, s * 10.2, { glow, dir: [0.65, 0.06, s * 0.75] });
      k.sphere([6.5, 5, 3], haloMat(k, glow, 0.32), HG, 35.5, 11, s * 11.2);
    }
    // ears that flatten
    const ears = [];
    for (const s of [1, -1]) {
      const EG = k.group(HG, 5, 19, s * 8.5); EG.side = s; ears.push(EG);
      const o = k.cone(7.5, 26, coatM, EG, 0, 12, 0, 10); o.scale.x = 0.42;
      const i = k.cone(4.6, 18, earInM, EG, 2.6, 10, 0, 8); i.scale.x = 0.3;
    }
    // old scars: claw rakes down the muzzle and one through the eye
    for (const s of [1, -1]) {
      for (let i = 0; i < 3; i++) { const x = 46 + i * 5.5, b = k.box(0.9, 12 - i * 2, 0.7, scarM, HG, x, 5, s * (11.4 - i * 0.9)); b.rotation.z = 0.6; b.rotation.y = -s * 0.25; }
      const b = k.box(1, 22, 0.7, scarM, HG, 34, 12, s * 12.6); b.rotation.z = 0.38; b.rotation.y = -s * 0.5;
    }
    const drool = [1, -1].map(s => k.sphere([1.1, 1.8, 1.1], droolM, HG, 57.5, -21, s * 5.2));

    // ---- legs: three bones and a big clawed paw each ----
    const LZ = [-19, -17, 19, 17];   // far hind, far fore, near hind, near fore
    const toes = [], claws = [];
    for (const z of [-4.6, -1.5, 1.5, 4.6]) { toes.push(ball(9.5 - Math.abs(z) * 0.3, 3.2, z, 3.4, 2.8, 2.4)); claws.push(cone([12.2 - Math.abs(z) * 0.3, 3, z], [1, -0.75, z * 0.05], 1.15, 6, 1)); }
    const toeG = mergeGeo('wolf:toes', toes), clawG = mergeGeo('wolf:claws', claws);
    const legs = WD.FL && [0, 1, 2, 3].map(i => {
      const fore = i % 2 === 1, L = { fore };
      if (fore) { L.a = bone(k, 40, 13, 9, coatM, R); L.b = bone(k, 40, 8.5, 5.5, coatM, R); L.c = bone(k, 22, 5.4, 5, coatM, R); k.sphere([7.5, 13, 6.8], coatM, L.b, 0, -11, 0); }
      else { L.a = bone(k, 46, 16, 9.5, coatM, R); L.b = bone(k, 44, 9.5, 5, coatM, R); L.c = bone(k, 30, 5, 4.8, coatM, R); k.sphere([8.5, 14, 7.5], coatM, L.b, 0, -10, 0); }
      L.paw = k.group(R);
      k.sphere([9, 4.8, 7.5], coatM, L.paw, 3, 4.5, 0); k.mesh(toeG, coatM, L.paw); k.mesh(clawG, clawM, L.paw);
      return L;
    });

    // ---- the bushy tail ----
    const tpts = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const tailR = u => 6 + 13 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.06)), 0.6) * (1 - u * u * 0.4);
    const setTail = (P) => { for (let i = 0; i < 4; i++) { tpts[i][0] = P.tail[i][0]; tpts[i][1] = -P.tail[i][1]; tpts[i][2] = P.tailZ * i / 3; } };
    setTail(D.wolfPose(e, (SB.world && SB.world.time) || 0));
    const tail = k.tube(tpts, tailR, 0, tailM, R, 18, 14);

    let frame = 0;
    return (e, t) => {
      frame++;
      const P = D.wolfPose(e, t);
      TG.position.set(P.hip[0], -P.hip[1], 0); TG.rotation.z = P.pitch;
      HK.scale.set(1, 0.55 + 0.65 * P.hackle, 1);
      // neck from the neck base to the head pivot
      const dx = P.HP[0] - P.N[0], dy = -(P.HP[1] - P.N[1]);
      NG.position.set(P.N[0], -P.N[1], 0); NG.rotation.z = Math.atan2(dy, dx); NG.scale.x = Math.hypot(dx, dy) / NECK0;
      HG.position.set(P.HP[0], -P.HP[1], 0); HG.rotation.z = -P.headRot;
      JG.rotation.z = -P.jaw * 0.72;
      tongue.position.x = 32 + P.tongue * 14; tongue.scale.x = 18 + P.tongue * 8; tongue.rotation.z = -P.tongue * 0.35;
      for (const EG of ears) EG.rotation.set(EG.side * 0.2, 0, 0.08 + P.ear * 1.15);
      const q = (t * 1.1 + (e.seed || 0) % 10 * 0.13) % 1;
      for (const d of drool) { d.position.y = -21 - q * q * 22; d.scale.set(1.1, 1.8 + q * 1.5, 1.1); }
      // legs
      for (let i = 0; i < 4; i++) {
        const L = P.legs[i], M = legs[i], z = LZ[i];
        aim(M.a, L.r[0], -L.r[1], z, L.a[0], -L.a[1], z);
        aim(M.b, L.a[0], -L.a[1], z, L.b[0], -L.b[1], z);
        aim(M.c, L.b[0], -L.b[1], z, L.p[0], -L.p[1] + 4, z);
        M.paw.position.set(L.p[0], -L.p[1], z); M.paw.rotation.z = -L.pa;
      }
      if ((frame & 1) === 0 || frame < 3) { setTail(P); tail.geometry.setPath(tpts); }
    };
  };
})();
