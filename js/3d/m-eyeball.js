'use strict';
// m-eyeball.js — 3D model of the demon eyeball boss (see js/3d/r3d.js for the model kit)
// A wet, veiny eyeball that really turns in its fleshy socket to look at its prey: a glowing fibred iris with a
// slit pupil that dilates, heavy lids (partial spheres) that blink, narrow when angry and roll shut on a K.O.,
// little horns, leathery bat wings that flap, and tendrils (bending tubes) with small eyes on their tips.
// Its minions, eye-bolts and the death ray are drawn in world space (k.world); the ray leaves from the pupil mesh.
// Positions come from the same template numbers the 2D drawing uses (SB.D.EYEBALL, SB.D.eyeTendril).
(function () {
  if (!SB.M3) return;
  const T = THREE, M3 = SB.M3, PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------- textures (shared per colour) ----------
  const TEX = new Map();
  // the white of the eye as an equirectangular map: veins creep in from the back toward the iris (the front is +z)
  function scleraTex(white, vein) {
    const key = 'scl' + white + vein; let tx = TEX.get(key); if (tx) return tx;
    const Wd = 512, Hd = 256, cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const c = cv.getContext('2d');
    // the angle from the front (u = 0.25, v = 0.5 on a three.js sphere) for a texel
    const toUV = (dx, dy, dz) => { const th = Math.acos(clamp(dy, -1, 1)), ph = Math.atan2(dz, -dx); return [((ph / TAU) + 1) % 1 * Wd, th / PI * Hd]; };
    const base = SB.hexRGB(white), edge = SB.hexRGB(SB.mixColor(white, '#7a2a2a', 0.55));
    const img = c.createImageData(Wd, Hd);
    for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      const th = y / Hd * PI, ph = x / Wd * TAU, dz = Math.sin(ph) * Math.sin(th);   // dz: how much this texel faces front
      const k = clamp((0.35 - dz) / 1.1, 0, 1), o = (y * Wd + x) * 4;
      for (let j = 0; j < 3; j++) img.data[o + j] = base[j] + (edge[j] - base[j]) * k;
      img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    c.strokeStyle = vein; c.lineCap = 'round';
    const dirAt = (psi, del) => { const sd = Math.sin(del); return [Math.cos(psi) * sd, Math.sin(psi) * sd, Math.cos(del)]; };   // x, y, z (front = +z)
    const vein1 = (psi, del, n, w) => {
      let [px, py] = toUV(...dirAt(psi, del));
      for (let i = 0; i < n; i++) {
        psi += (rnd() - 0.5) * 0.3; del -= 0.07 + rnd() * 0.06; w *= 0.8;
        const [qx, qy] = toUV(...dirAt(psi, del));
        if (Math.abs(qx - px) < Wd / 2) { c.lineWidth = w; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.stroke(); }
        px = qx; py = qy;
        if (i === 2 && rnd() < 0.6) vein1(psi + (rnd() < 0.5 ? 0.3 : -0.3), del, 3, w);
      }
    };
    for (let i = 0; i < 26; i++) vein1(i / 26 * TAU + rnd() * 0.2, 1.75 + rnd() * 0.3, 8, 3.6);
    c.globalAlpha = 1;
    tx = new T.CanvasTexture(cv); tx.encoding = T.sRGBEncoding; tx.userData.shared = true; TEX.set(key, tx);
    return tx;
  }
  // the iris: hot gold round the pupil, the palette colour, a dark limbal ring; fibres
  function irisTex(col) {
    const key = 'iris' + col; let tx = TEX.get(key); if (tx) return tx;
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), r = S / 2;
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.28, SB.mixColor(col, '#ffd23f', 0.6)); g.addColorStop(0.6, col); g.addColorStop(0.88, SB.shade(col, 0.55)); g.addColorStop(0.96, '#2a0404'); g.addColorStop(1, '#1a0202');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.lineWidth = 1.4;
    for (let k = 0; k < 60; k++) {
      const a = k / 60 * TAU, r0 = r * 0.3, r1 = r * (0.78 + 0.14 * Math.sin(k * 3.1));
      c.strokeStyle = k % 2 ? 'rgba(255,215,120,0.4)' : 'rgba(80,0,0,0.42)'; c.beginPath(); c.moveTo(r + Math.cos(a) * r0, r + Math.sin(a) * r0); c.lineTo(r + Math.cos(a) * r1, r + Math.sin(a) * r1); c.stroke();
    }
    tx = new T.CanvasTexture(cv); tx.encoding = T.sRGBEncoding; tx.userData.shared = true; TEX.set(key, tx);
    return tx;
  }
  // a quadratic curve sampled into n+1 points (2D template coords, y down) -> flat array for k.extrude (y up)
  const quadPts = (out, x0, y0, cx, cy, x1, y1, n, skipFirst) => { for (let i = skipFirst ? 1 : 0; i <= n; i++) { const u = i / n, m = 1 - u; out.push(m * m * x0 + 2 * m * u * cx + u * u * x1, -(m * m * y0 + 2 * m * u * cy + u * u * y1)); } };

  M3.named['demon eyeball'] = function (e, k) {
    const EY = SB.D.EYEBALL, R = EY.R, CY = -EY.cy, K = EY.K, rI = EY.rI;   // CY: the ball's centre height (y up)
    const flesh = k.col('body'), wingC = k.col('wing'), hornC = k.col('horn'), white = k.col('eye'), irisC = k.col('iris'), veinC = k.col('vein'), tentC = k.col('tentacle'), glowC = k.col('eyeGlow') || '#ff3010';
    const mFlesh = k.mat(flesh, { rough: 0.62 }), mSocket = k.mat(SB.shade(flesh, 0.35), { rough: 0.6 }), mLid = k.mat(flesh, { rough: 0.62 });
    const mRim = k.mat(SB.shade(flesh, 0.3), { rough: 0.35 }), mLash = k.mat('#140808', { rough: 0.5 });
    const mWing = k.mat(wingC, { side: 'double', rough: 0.72 }), mBone = k.mat(SB.shade(SB.mixColor(wingC, flesh, 0.4), 0.1), { rough: 0.55 }), mClaw = k.mat('#140c0a', { rough: 0.3 });
    const mHorn = k.mat(hornC, { rough: 0.38 }), mTent = k.mat(tentC, { rough: 0.45 });
    const mSclera = k.mat('#ffffff', { map: scleraTex(white, veinC), rough: 0.1 });
    const iTex = irisTex(irisC), mIris = k.mat('#ffffff', { map: iTex, glow: '#ffffff', glowK: 1.1, rough: 0.15 });
    if (!mIris.emissiveMap) { mIris.emissiveMap = iTex; mIris.needsUpdate = true; }
    const mPupil = k.mat('#050203', { rough: 0.1 }), mCornea = k.mat('#ffffff', { opacity: 0.1, rough: 0.02 });
    const mSmallWhite = k.mat(white, { rough: 0.15 }), mSmallIris = k.mat(irisC, { glow: glowC, glowK: 0.9, rough: 0.2 });
    const mTear = k.mat('#cfe8ff', { opacity: 0.75, rough: 0.05 });
    const mGlow = k.mat(glowC, { basic: true, opacity: 0.05 });
    const root = k.root, g = k.group(root); g.scale.setScalar(K);
    
    // ---- a red haze behind it ----
    const haze = k.sphere(R * 1.7, mGlow, g, 0, CY, -30); haze.castShadow = false; haze.renderOrder = -1; haze.material.depthWrite = false;

    // ---- the fleshy socket and the knot the tendrils grow from ----
    k.sphere([R + 5, R + 5, R + 2], mSocket, g, 0, CY, -6);
    k.sphere([27, 15, 24], mFlesh, g, 0, CY - R * 0.76, -2);

    // ---- the ball: turns as a whole to look; the iris, pupil and a clear cornea ride on it ----
    const ball = k.group(g, 0, CY, 0);
    k.mesh(M3.geo('eye:ball', () => new T.SphereGeometry(1, 40, 24)), mSclera, ball).scale.setScalar(R);
    // the iris is a cap of the ball's own surface (its map laid on flat), the slit pupil a dark lens on it
    const irisGeo = M3.geo('eye:iriscap:' + R + ':' + rI, () => {
      const gg = new T.SphereGeometry(R * 1.004, 32, 8, 0, TAU, 0, Math.asin(rI / R)); gg.rotateX(PI / 2);
      const P = gg.attributes.position, uv = gg.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, 0.5 + P.getX(i) / (2 * rI), 0.5 + P.getY(i) / (2 * rI));
      return gg;
    });
    const iris = k.mesh(irisGeo, mIris, ball);
    const pupil = k.sphere([4, rI * 0.82, 1.6], mPupil, ball, 0, 0, R * 0.985);
    const cornea = k.sphere([rI * 1.08, rI * 1.08, rI * 0.42], mCornea, ball, 0, 0, R * 0.88); cornea.castShadow = false;

    // ---- heavy lids: half-shells hinged at the ball's centre, with a thick rim and spiky lashes ----
    const lidR = R + 2.5;
    const shell = upper => M3.geo('eye:lid' + (upper ? 'u' : 'l'), () => new T.SphereGeometry(1, 40, 12, 0, TAU, upper ? 0 : PI / 2, PI / 2));
    const rimG = M3.geo('eye:rim', () => { const t = new T.TorusGeometry(1, 0.05, 8, 56); t.rotateX(PI / 2); return t; });
    const lids = [true, false].map(upper => {
      const L = k.group(g, 0, CY, 0);
      k.mesh(shell(upper), mLid, L).scale.setScalar(lidR);
      const rim = k.mesh(rimG, mRim, L); rim.scale.setScalar(lidR);
      const n = upper ? 11 : 6, up = new T.Vector3(0, 1, 0), dv = new T.Vector3();
      for (let i = 1; i < n; i++) {
        const ph = -1.25 + 2.5 * i / n, x = Math.sin(ph) * (lidR + 1), z = Math.cos(ph) * (lidR + 1);
        const c = k.cone(1.2, upper ? 8 : 5, mLash, L, x, 0, z, 6);
        dv.set(Math.sin(ph) * 0.7, upper ? -0.45 : 0.45, Math.cos(ph) * 0.7).normalize(); c.quaternion.setFromUnitVectors(up, dv);
        c.position.addScaledVector(dv, upper ? 3 : 2);
      }
      return L;
    });

    // ---- little demon horns on the brow ----
    for (const s of [-1, 1]) {
      k.sphere([9, 5, 7], mFlesh, g, s * 17, CY + R * 0.84, 8);
      k.tube([[s * 17, CY + R * 0.84, 8], [s * 32, CY + R * 1.12, 10], [s * 40, CY + R * 1.3, 8], [s * 31, CY + R * 1.6, 5]], 6.5, 0.6, mHorn, g, 14, 10);
      for (let j = 0; j < 4; j++) { const u = 0.15 + j * 0.17; const rg = k.mesh(rimG, mSocket, g, s * (17 + 22 * u), CY + R * (0.86 + 0.5 * u), 9); rg.scale.setScalar(6 - j * 1.1); rg.rotation.z = -s * (0.9 - j * 0.15); }
    }

    // ---- leathery bat wings (the drawing's outline), hinged at the shoulders, swept back a little ----
    const F = [[94, -70], [106, -34], [96, 2], [68, 20]], SP = [[80, -44], [88, -12], [76, 6], [34, 16]];
    const outline = [-4, 8]; quadPts(outline, -4, -8, 10, -28, 26, -32, 4, true); quadPts(outline, 26, -32, 40, -44, 54, -50, 3, true); outline.push(F[0][0], -F[0][1]);
    for (let i = 1; i < 4; i++) quadPts(outline, F[i - 1][0], F[i - 1][1], SP[i - 1][0], SP[i - 1][1], F[i][0], F[i][1], 5, true);
    quadPts(outline, F[3][0], F[3][1], SP[3][0], SP[3][1], 0, 14, 5, true);
    const wings = [-1, 1].map(s => {
      const P = k.group(g, s * R * 0.7, CY + R * 0.32, -14);
      const W = k.group(P); W.scale.set(s * 0.82, 0.82, 0.82);
      k.extrude(outline, 1.6, mWing, W, 0, 0, 0, 0.5);
      k.tube([[0, 0, 0.8], [26, 30, 0.8], [54, 50, 0.8]], 3.6, 2.2, mBone, W, 8, 8);
      for (const f of F) k.tube([[54, 50, 0.8], [(54 + f[0]) / 2, (50 - f[1]) / 2 + 2, 1], [f[0], -f[1], 0.8]], 1.8, 0.6, mBone, W, 6, 6);
      k.sphere(3.2, mBone, W, 26, 30, 0.8); k.sphere(3, mBone, W, 54, 50, 0.8);
      const cl = k.cone(1.6, 9, mClaw, W, 56, 56, 0.8, 6); cl.rotation.z = -0.3;
      return { s, P };
    });

    // ---- tendrils with small eyes on their tips ----
    const miniEye = (parent, r, lidded) => {
      const o = k.group(parent);
      k.sphere(r, mSmallWhite, o);
      k.sphere([r * 0.62, r * 0.62, r * 0.3], mSmallIris, o, 0, 0, r * 0.8);
      k.sphere([r * 0.12, r * 0.44, r * 0.12], mPupil, o, 0, 0, r * 1.02);
      if (lidded) { const ld = k.mesh(shell(true), mFlesh, o); ld.scale.setScalar(r * 1.07); ld.rotation.x = -1.0; o.lid = ld; }
      return o;
    };
    const NT = EY.N, tents = [];
    for (let i = 0; i < NT; i++) {
      const pts = []; for (let j = 0; j < 6; j++) pts.push([0, 0, 0]);
      const z = (i % 2 ? 6 : -3) + (i === 2 ? 8 : 0);
      const tube = k.tube([[0, 0, 0], [0, -20, 0], [0, -40, 0]], 6, 1.8, mTent, g, 14, 8); tube.castShadow = false;
      tents.push({ i, z, pts, tube, eye: miniEye(g, 5.6, true) });
    }

    // ---- tears ----
    const tears = [0, 1].map(() => { const t = k.sphere([2, 3, 2], mTear, g); t.castShadow = false; t.visible = false; return t; });

    // ---- world space: minions, eye-bolts and the death ray ----
    const minions = [];
    const wingShape = [3, 1, 13, 9, 21, 4, 17, 1, 18, -3, 12, 0, 9, -5];
    for (let i = 0; i < 6; i++) {
      const o = k.group(k.world); o.visible = false;
      const eye = miniEye(o, 9, true);
      const ws = [-1, 1].map(s => { const p = k.group(o, 0, 0, -3); const w = k.extrude(wingShape, 1, mWing, p, 0, 0, 0, 0.3); p.scale.x = s; return p; });
      minions.push({ o, eye, ws });
    }
    const mBolt = k.mat('#ffb080', { basic: true }), mBoltHalo = k.mat('#ff1a08', { basic: true, opacity: 0.45 });
    const bolts = [];
    for (let i = 0; i < 40; i++) { const b = k.sphere(1, mBolt, k.world); b.castShadow = false; b.visible = false; const h = k.sphere(2.3, mBoltHalo, b); h.castShadow = false; h.material.depthWrite = false; bolts.push(b); }
    const mRay = k.mat('#ff2a14', { basic: true, opacity: 0.38 }), mRayMid = k.mat('#ff4a20', { basic: true, opacity: 0.85 }), mRayCore = k.mat('#fff0e0', { basic: true });
    const ray = k.group(k.world); ray.visible = false;
    const CYL = M3.geo('eye:raycyl', () => { const c = new T.CylinderGeometry(1, 1, 1, 14, 1, true); c.translate(0, 0.5, 0); return c; });
    const rayParts = [[mRay, 15], [mRayMid, 6.5], [mRayCore, 2.4]].map(([m, r]) => { const c = k.mesh(CYL, m, ray); c.castShadow = false; c.r = r; if (m.opacity < 1) m.depthWrite = false; return c; });
    const rayEnd = k.sphere(1, mRay, k.world); rayEnd.castShadow = false; rayEnd.visible = false;
    const rayEndCore = k.sphere(0.45, mRayCore, rayEnd); rayEndCore.castShadow = false;

    // ---- posing ----
    const Z = new T.Vector3(0, 0, 1), Y = new T.Vector3(0, 1, 0), dv = new T.Vector3(), q = new T.Quaternion(), pa = new T.Vector3(), pb = new T.Vector3();
    const P0 = [0, 0, 0, 0, 0, 0];
    let yawK = null, frame = 0;
    // point an object's +z (its iris) along a world direction
    const lookWorld = (o, x, y, z) => { o.parent.getWorldQuaternion(q); q.invert(); dv.set(x, y, z).normalize().applyQuaternion(q); o.quaternion.setFromUnitVectors(Z, dv); };
    return function update(e, t, dt) {
      frame++;
      const ko = e.ko, held = e.held, flying = e.flying && !held, f = e.facing || 1, m3 = e._m3;
      // keep the eye's face toward the camera whichever way it faces (it has no back to show), turned a little that way
      const want = 0.3 * f; yawK = yawK == null ? want : yawK + (want - yawK) * Math.min(1, dt * 8);
      root.rotation.y = yawK - (m3 ? m3.yaw : 0);
      root.rotation.z = ko ? (e.angle || 0) * 0.75 : 0;   // a ball doesn't lie down: it rolls back instead
      const [wo, wp] = SB.D.eyeballWant(e, t);
      const open = e.lidK != null ? e.lidK : wo, pw = e.pupK != null ? e.pupK : wp;
      // the ball turns to look: along its ray, at its prey or the cursor (world), or rolled up (K.O.) / circling (dizzy)
      g.updateWorldMatrix(true, false);
      if (ko) ball.quaternion.setFromUnitVectors(Z, dv.set(0.06, 0.62, 0.78).normalize());
      else if (e.mood === 'dizzy') ball.quaternion.setFromUnitVectors(Z, dv.set(Math.cos(t * 7) * 0.35, Math.sin(t * 7) * 0.35, 0.87).normalize());
      else {
        let lx = e.eyeLX || 0, ly = e.eyeLY || 0; const mg = Math.hypot(lx, ly); if (mg > 1) { lx /= mg; ly /= mg; }
        const o2 = (lx * lx + ly * ly) * EY.off * EY.off;
        lookWorld(ball, lx * EY.off, -ly * EY.off, Math.sqrt(Math.max(0.05, 1 - o2)));
      }
      pupil.scale.x = Math.max(0.8, pw);
      const im = iris.material;
      if (im.emissive) im.emissiveIntensity = ko ? 0.08 : 1.0 + (e.rayCharge > 0 ? 1.4 + Math.sin(t * 40) * 0.3 : e.rayT > 0 ? 1.6 : 0) + (e.stareT > 0 ? 0.6 + Math.sin(t * 12) * 0.5 : 0);
      // the lids: the upper one rises to the lid line of the drawing, the lower one drops to it
      const upE = clamp(-(0.3 - 1.08 * open), -0.98, 0.98), loE = clamp(0.3 + 0.44 * Math.min(1.1, open), -0.98, 0.98);
      lids[0].rotation.x = -Math.asin(upE); lids[1].rotation.x = Math.asin(loE);
      // wings
      let flap;
      if (held) flap = Math.sin(t * 18) * 0.9; else if (ko) flap = -0.9; else if (flying) flap = Math.sin(t * 6 + e.seed); else flap = -0.4;
      for (const w of wings) { w.P.rotation.set(0, w.s * 0.45, w.s * (0.12 + flap * 0.42 - (ko ? 0.9 : 0))); w.P.scale.y = 0.85 + flap * 0.2; }
      // tendrils
      const [ax, ay, tk] = SB.D.eyeTendrilAim(e);
      for (const tn of tents) {
        SB.D.eyeTendril(tn.i, t, e, ax, ay, tk, P0);
        for (let j = 0; j < 6; j++) {
          const u = j / 5, mu = 1 - u, p = tn.pts[j];
          p[0] = (mu * mu * P0[0] + 2 * mu * u * P0[2] + u * u * P0[4]) * f; p[1] = -(mu * mu * P0[1] + 2 * mu * u * P0[3] + u * u * P0[5]); p[2] = tn.z * u + 2 * Math.sin(t * 1.3 + tn.i) * u;
        }
        if (frame % 2 === 0 || frame < 3) tn.tube.geometry.setPath(tn.pts);
        const a = tn.pts[4], b = tn.pts[5];
        tn.eye.position.set(b[0] + (b[0] - a[0]) * 0.25, b[1] + (b[1] - a[1]) * 0.25, b[2]);
        if (ko) tn.eye.quaternion.setFromUnitVectors(Z, dv.set(0, 1, 0.3).normalize());
        else if (tk > 0) lookWorld(tn.eye, (e.tendAX || 0), -(e.tendAY || 1), 0.8);
        else lookWorld(tn.eye, (e.eyeLX || 0) * 0.6 + (b[0] - a[0]) * 0.01, -(e.eyeLY || 0) * 0.5, 1);
        tn.eye.lid.rotation.x = ko ? 0.9 : open < 0.05 ? 1.1 : -1.0;
        const tg = tn.eye.children[1]; if (tg && tg.material.emissive) tg.material.emissiveIntensity = e.boltT > 0 ? 2.4 : ko ? 0 : 0.9;
      }
      // tears when hurt
      const crying = e.eyeHurtT > 0 || e.weakT > 0 || ko;
      for (let j = 0; j < 2; j++) {
        const tr = tears[j]; tr.visible = crying; if (!crying) continue;
        const s = j ? 1 : -1, u = (t * 1.3 + j * 0.47 + e.seed) % 1;
        tr.position.set(s * R * (0.6 + u * 0.12), CY - R * 0.2 - u * 34, Math.sqrt(Math.max(0, R * R - R * R * 0.4)) + 6);
      }
      const hz = haze.material; if (hz.opacity !== undefined && !e.invisible) hz.opacity = ko ? 0.01 : 0.04 + (e.rayT > 0 ? 0.1 : 0) + Math.sin(t * 2.2 + e.seed) * 0.015;
      // ---- world space ----
      const hide = e.invisible ? 0.0001 : 1, Ms = e.eyelets || [];
      for (let i = 0; i < minions.length; i++) {
        const mn = minions[i], mm = Ms[i];
        if (!mm) { mn.o.visible = false; continue; }
        const al = mm.dead ? Math.max(0, mm.life / 0.7) : 1;
        mn.o.visible = al > 0.02; if (!mn.o.visible) continue;
        mn.o.position.set(mm.x, -mm.y, 40 + ((mm.seed * 7.13) % 1 - 0.5) * 60);
        mn.o.scale.setScalar(Math.max(1, e.scale) * (0.5 + al * 0.5) * hide);
        mn.o.rotation.z = mm.dead ? t * 8 : 0;
        mn.o.updateMatrixWorld(true);
        if (mm.dead) mn.eye.quaternion.setFromUnitVectors(Z, dv.set(0, 1, 0.2).normalize()); else lookWorld(mn.eye, mm.lx, -mm.ly, 0.7);
        const fl = Math.sin(t * 30 + mm.seed * 7);
        mn.ws[0].rotation.set(0, 0.5, 0.3 + fl * 0.5); mn.ws[1].rotation.set(0, -0.5, -0.3 - fl * 0.5);
      }
      const Bs = e.bolts || [];
      for (let i = 0; i < bolts.length; i++) {
        const b = bolts[i], bb = Bs[i];
        b.visible = !!bb; if (!bb) continue;
        b.position.set(bb.x, -bb.y, 20); b.scale.setScalar(bb.r * (1 + Math.sin(t * 40 + bb.seed) * 0.15) * hide);
      }
      const rayOn = e.rayT > 0 && e.rayEnd && !ko;
      ray.visible = rayOn; rayEnd.visible = rayOn;
      if (rayOn) {
        pupil.updateMatrixWorld(true); pupil.getWorldPosition(pa);
        pb.set(e.rayEnd[0], -e.rayEnd[1], 0);
        const L = pa.distanceTo(pb), fl = 0.85 + Math.sin(t * 60) * 0.15, s = e.scale * hide;
        ray.position.copy(pa); ray.quaternion.setFromUnitVectors(Y, dv.subVectors(pb, pa).normalize());
        for (const c of rayParts) c.scale.set(c.r * s * (c.r > 10 ? fl : 1), L, c.r * s * (c.r > 10 ? fl : 1));
        rayEnd.position.copy(pb); rayEnd.scale.setScalar(26 * s * fl);
      }
    };
  };
})();
