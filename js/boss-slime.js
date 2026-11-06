'use strict';
// boss-slime.js — the giant slime blob boss: drawing, definition and attacks
// A huge wobbling blob of glossy green jelly you can half see into: bones, a knight's helmet and a fish skeleton
// float inside it among rising bubbles. Bulging eyes roll around on its front over a wide gooey mouth that drips.
// It moves by squashing down and HOPPING (big squash-and-stretch bounces that shake the ground), body-slams from
// high up, spits sticky goo that glues things down, swallows creatures whole (you can see them inside!) and, when
// it is hit hard, SPLITS into little slimes (real creatures, 'slimeling') that hop about and fight for it, then
// slurp back into it to heal it. Fire makes it sizzle and shrink; cold freezes it solid and brittle.
// Lives in its own file (loaded after bosses.js, before colors.js); the 3D model is js/3d/m-slime.js.
(function () {
  const D = SB.D, TAU = SB.TAU;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const NAME = 'giant slime', MINI = 'slimeling', DRAWK = 1.35, G = 1700;
  const rgba = (h, a) => { const q = SB.hexRGB(h); return 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; };

  // ---------- template geometry, shared by the drawing, the 3D model and the attacks ----------
  // template units (before drawK), origin at the centre of the w x h box. The surface function works y UP
  // (like the 3D model): ground at gyU, the jelly's centre at cyU, radii rx (across), ry (up), rz (depth).
  // MINI: a slimeling is this same blob drawn at MINI scale. YAW: the face turns this far toward the viewer.
  const SL = D.SLIME = { w: 150, h: 116, gyU: -58, cyU: -4, rx: 70, ry: 56, rz: 60, K: DRAWK, MINI: 0.32, YAW: -1.05 };
  const ks = e => e.scale * (e.def.drawK || (e.def.name === MINI ? SL.MINI : 1));
  // the face, as directions from the centre in the blob's own frame (+x = its face axis, y up)
  SL.EYES = [[0.70, 0.50, 0.42, 11], [0.70, 0.50, -0.42, 11], [0.42, 0.86, 0, 7]];   // [dx, dy, dz, radius]
  SL.MOUTH = [0.985, -0.12, 0];

  // squash / stretch / size / melt / wobble for this frame (the attacks keep e.sq, e.slSz, e.meltK... up to date)
  D.slimePose = function (e, t, out) {
    out = out || {};
    const sq = e.sq || 1, sz = e.slSz || 1;
    out.sq = sq; out.sz = sz; out.mk = e.meltK || 0; out.sx = sz / Math.sqrt(sq); out.lean = e.lean || 0;
    out.A = e.ko ? 0.35 : e.frozenT > 0 ? 0.12 : 1 + (e.sizzleT > 0 ? 1.3 : 0) + (e.held ? 0.8 : 0) + (e.mood === 'angry' ? 0.15 : 0);
    out.zap = e.zapT > 0 ? Math.min(1, e.zapT) : 0;
    out.t = e.frozenT > 0 && e.frozeAt != null ? e.frozeAt : t;   // frozen solid: the wobble stops
    out.seed = (e.seed || 0) % 100;
    return out;
  };
  // a point on the jelly's surface for the unit direction (ux, uy, uz): template units, y UP
  D.slimeSurf = function (P, ux, uy, uz, out) {
    const S = SL, t = P.t, sd = P.seed, A = P.A, th = Math.atan2(uz, ux);
    let r = 1 + A * (0.034 * Math.sin(3 * th + t * 2.6 + sd) + 0.026 * Math.sin(5 * th - t * 3.4 + sd * 1.7) * (1 - uy * uy) + 0.03 * Math.sin(uy * 3.5 + t * 2.2 + sd * 0.6));
    if (P.zap) r += 0.035 * P.zap * Math.sin(th * 9 + uy * 7 + t * 47);
    let x = ux * S.rx * r, y = S.cyU + uy * S.ry * r, z = uz * S.rz * r;
    if (uy < 0) { const k = 1 + 0.24 * uy * uy; x *= k; z *= k; }        // a heavy blob sags out at the bottom
    const fl = S.gyU + 2; if (y < fl) y = fl - (fl - y) * 0.12;          // ...and sits flat on the ground
    const m = 1 + P.mk * 0.75; x *= m; z *= m;                           // melting: spreads into a puddle
    const h = (y - S.gyU) * P.sq * P.sz * (1 - 0.74 * P.mk);
    out[0] = x * P.sx + P.lean * h * 0.35; out[1] = S.gyU + h; out[2] = z * P.sx;
    return out;
  };
  const fp = [0, 0, 0];
  // how wide the mouth gapes (0 shut .. 1.1 wide)
  D.slimeMouth = function (e, t) {
    if (e.ko) return 0.22;
    if (e.gulpT > 0) return 1.15;
    if (e.engulfed) return 0.12 + 0.06 * Math.sin(t * 3);
    if (e.spitT > 0) return e.spitT > 0.22 ? 0.18 : 0.85;
    if (e.crouchT > 0) return 0.16;
    if (e.held) return 0.75;
    if (e.grounded === false) return 0.55;
    return (e.mood === 'angry' || e.mode === 'hunt' ? 0.4 : 0.26) + 0.07 * Math.sin(t * 1.7 + (e.seed || 0));
  };
  // where the eyes look, in its local frame (x forward, y down), length <= 1
  D.slimeLook = function (e, t, i) {
    if (e.ko) return [Math.cos(t * 3 + i * 2) * 0.6, Math.sin(t * 3 + i * 2) * 0.6];
    if (e.mood === 'dizzy') return [Math.cos(t * 7 + i) * 0.7, Math.sin(t * 7 + i) * 0.7];
    const lx = e.slLX != null ? e.slLX : (e.lookX || 0), ly = e.slLY != null ? e.slLY : (e.lookY || 0);
    return [clamp(lx + 0.14 * Math.sin(t * 1.3 + i * 2.1), -1, 1), clamp(ly + 0.12 * Math.cos(t * 1.1 + i * 1.7), -1, 1)];   // each eye rolls on its own a little
  };
  // the mouth in game coordinates (goo comes out of here)
  D.slimeMouthAt = function (e) {
    const P = D.slimePose(e, SB.world.time), m = D.slimeFace2D(P, SL.MOUTH, 0), K = ks(e);
    return [e.x + e.facing * m[0] * K, e.y + m[1] * K];
  };
  // a face point (a direction in the blob's own frame) as seen in the 2D drawing: [x, y down, depth]
  D.slimeFace2D = function (P, d, push) {
    const n = Math.hypot(d[0], d[1], d[2]), ux = d[0] / n, uy = d[1] / n, uz = d[2] / n;
    D.slimeSurf(P, ux, uy, uz, fp);
    const c = Math.cos(SL.YAW), s = Math.sin(SL.YAW), q = push || 0, x = fp[0] + ux * q, y = fp[1] + uy * q, z = fp[2] + uz * q;
    return [x * c + z * s, -y, -x * s + z * c];   // turned toward the viewer, y down, depth (+ = near)
  };

  // ---------- the drawing ----------
  const PTS = [], PS = {}, SP = [0, 0, 0];
  // the body outline (y down) into PTS, n points
  function outline(P, n) {
    PTS.length = 0;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; D.slimeSurf(P, Math.cos(a), Math.sin(a), 0, SP); PTS.push(SP[0], -SP[1]); }
    return PTS;
  }
  function bodyPath(c, pts) {   // a smooth closed curve through the outline points
    const n = pts.length / 2, mx = (i) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2, my = (i) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
    c.beginPath(); c.moveTo(mx(0), my(0));
    for (let i = 1; i <= n; i++) c.quadraticCurveTo(pts[(i % n) * 2], pts[(i % n) * 2 + 1], mx(i), my(i));
    c.closePath();
  }
  D.slime = function (mini) { return { w: SL.w, h: SL.h, draw(p, e, t) { D.drawSlime(p, e, t, mini); } }; };
  D.drawSlime = function (p, e, t, mini) {
    const c = p.ctx, tint = p.tint, ko = e.ko, mk = e.meltK || 0;
    const T = k => tint ? SB.mixColor(k, tint, 0.5) : k;
    const col = r => T(p.use(r).fill);
    let body = col('body'), core = col('core'), hi = col('glow');
    if (e.frozenT > 0) { body = SB.mixColor(body, '#bfe8ff', 0.55); core = SB.mixColor(core, '#5a8fb0', 0.5); hi = '#eaf8ff'; }
    if (e.sizzleT > 0 || e.onFire > 0) { body = SB.mixColor(body, '#c8d050', 0.25); }
    const P = D.slimePose(e, t, PS), gy = -SL.gyU;
    c.save();
    // it never lies down: stay upright (the K.O. box is turned on its side, so the ground moves down too)
    if (e.angle || e.tilt) c.rotate(-((e.angle || 0) + (e.tilt || 0)) * (e.facing || 1));
    if (ko && e.h && e.scale) c.translate(0, (e.h / e.scale - e.def.h) / 2 / (mini ? SL.MINI : (e.def.drawK || 1)));
    const pts = outline(P, mini ? 28 : 44);
    // ---- the wet puddle it sits in ----
    const prx = SL.rx * 1.22 * P.sx * (1 + mk * 0.9), pg = c.createRadialGradient(0, gy, prx * 0.2, 0, gy, prx);
    pg.addColorStop(0, rgba(core, 0.55)); pg.addColorStop(0.75, rgba(body, 0.4)); pg.addColorStop(1, rgba(body, 0));
    c.fillStyle = pg; c.beginPath(); c.ellipse(0, gy, prx, 7 + mk * 3, 0, 0, TAU); c.fill();
    // ---- the jelly: see-through in the middle, thicker and darker toward the edges ----
    bodyPath(c, pts);
    const hK = P.sq * P.sz * (1 - 0.7 * mk), bg = c.createRadialGradient(-14, gy - 64 * hK, 6, 0, gy - 46 * hK, 70 * Math.max(P.sx, hK) + 26);
    bg.addColorStop(0, rgba(SB.mixColor(body, '#ffffff', 0.3), 0.5)); bg.addColorStop(0.5, rgba(body, 0.56)); bg.addColorStop(0.82, rgba(SB.mixColor(body, core, 0.45), 0.74)); bg.addColorStop(1, rgba(SB.shade(core, 0.25), 0.9));
    c.fillStyle = bg; c.fill();
    c.save(); bodyPath(c, pts); c.clip();
    // a darker, denser core low down
    const cg = c.createRadialGradient(-4, gy - 34 * P.sq * P.sz, 4, -4, gy - 30 * P.sq * P.sz, 46 * P.sx);
    cg.addColorStop(0, rgba(core, 0.42)); cg.addColorStop(1, rgba(core, 0));
    c.fillStyle = cg; c.fillRect(-120, -120, 240, 240);
    // ---- things it has swallowed, floating inside (tinted by the jelly) ----
    const inner = (x, y) => [x * P.sx, gy - (gy - y) * P.sq * P.sz * (1 - 0.7 * mk)];
    const sw = k => SB.mixColor(T(k), body, 0.38);
    c.globalAlpha *= 0.72;
    if (!mini) {
      // a bone
      { const [x, y] = inner(-34 + Math.sin(t * 0.7) * 3, 22 + Math.cos(t * 0.6) * 2), a = 0.7 + Math.sin(t * 0.5) * 0.25, bc = sw(col('bone'));
        c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = bc; c.fillRect(-13, -2.6, 26, 5.2);
        for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 13, -2.8, 3.6, 0, TAU); c.arc(s * 13, 2.8, 3.6, 0, TAU); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-12, -2.2, 24, 1.4); c.restore(); }
      // a knight's helmet, upside down and sinking
      { const [x, y] = inner(6 + Math.sin(t * 0.45 + 1) * 3, 34), a = 2.6 + Math.sin(t * 0.4) * 0.2, mc = sw(col('metal'));
        c.save(); c.translate(x, y); c.rotate(a);
        const hg = c.createLinearGradient(-11, -12, 11, 8); hg.addColorStop(0, SB.mixColor(mc, '#ffffff', 0.35)); hg.addColorStop(1, SB.shade(mc, 0.45));
        c.fillStyle = hg; c.beginPath(); c.moveTo(-11, 8); c.lineTo(-11, -2); c.quadraticCurveTo(-11, -14, 0, -14); c.quadraticCurveTo(11, -14, 11, -2); c.lineTo(11, 8); c.closePath(); c.fill();
        c.fillStyle = SB.shade(mc, 0.7); c.fillRect(-8, -4, 16, 2.4); c.fillRect(-1, -4, 2, 9);
        c.fillStyle = SB.mixColor(T('#c0392b'), body, 0.4); c.beginPath(); c.moveTo(0, -14); c.quadraticCurveTo(-8, -22, -14, -18); c.quadraticCurveTo(-6, -17, 0, -12); c.fill();   // its plume
        c.restore(); }
      // a fish skeleton
      { const [x, y] = inner(-22 + Math.cos(t * 0.5) * 4, -8 + Math.sin(t * 0.8) * 2), a = -0.25 + Math.sin(t * 0.6) * 0.15, bc = sw(col('bone'));
        c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = bc; c.lineWidth = 1.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(9, 0); c.stroke();
        for (let i = 0; i < 5; i++) { const x0 = -9 + i * 3.8, L = 5 - Math.abs(i - 2) * 0.8; c.beginPath(); c.moveTo(x0 + 1.5, -L); c.quadraticCurveTo(x0 - 0.5, 0, x0 + 1.5, L); c.stroke(); }
        c.fillStyle = bc; c.beginPath(); c.moveTo(8, -4.5); c.quadraticCurveTo(16, -3, 17, 0); c.quadraticCurveTo(16, 3, 8, 4.5); c.closePath(); c.fill();
        c.fillStyle = SB.shade(body, 0.6); c.beginPath(); c.arc(13, -1, 1.3, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(-20, -5); c.lineTo(-19, 0); c.lineTo(-20, 5); c.closePath(); c.fillStyle = bc; c.fill();
        c.restore(); }
      // a couple of coins
      for (let i = 0; i < 2; i++) { const [x, y] = inner(-8 + i * 18 + Math.sin(t * 0.6 + i) * 2, 46 - i * 6); c.fillStyle = sw('#f2b632'); c.beginPath(); c.ellipse(x, y, 3.6, 2.2, 0.4 + i, 0, TAU); c.fill(); }
    }
    // bubbles drifting up through it
    c.globalAlpha /= 0.72;
    const nb = mini ? 3 : 8;
    for (let i = 0; i < nb; i++) {
      const sp = 9 + (i * 7) % 6, u = ((t * sp + i * 37 + P.seed * 3) % 92) / 92, r = (mini ? 2.2 : 1.6) + (i % 3) * 1.4;
      const [x, y] = inner(Math.sin(i * 2.4 + t * 0.9) * 34 + Math.sin(u * 9 + i) * 3, gy - 6 - u * 92);
      c.strokeStyle = rgba(hi, 0.5 * Math.sin(u * Math.PI)); c.lineWidth = 0.9; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.fillStyle = rgba('#ffffff', 0.55 * Math.sin(u * Math.PI)); c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU); c.fill();
    }
    // thicker jelly at the rim, light bouncing up through the bottom
    c.strokeStyle = rgba(SB.shade(core, 0.2), 0.32); c.lineWidth = 12; bodyPath(c, pts); c.stroke();
    const bl = c.createRadialGradient(0, gy, 2, 0, gy, 50 * P.sx); bl.addColorStop(0, rgba(hi, 0.3)); bl.addColorStop(1, rgba(hi, 0));
    c.fillStyle = bl; c.fillRect(-120, gy - 60, 240, 70);
    if (e.frozenT > 0) {   // frost cracks
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.1;
      for (let i = 0; i < 5; i++) { const x0 = -40 + i * 20, y0 = gy - 20 - (i % 2) * 30; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 8, y0 - 12); c.lineTo(x0 + 4, y0 - 22); c.lineTo(x0 + 12, y0 - 34); c.stroke(); }
    }
    c.restore();
    // a fine dark edge and a glossy rim light along the top
    c.strokeStyle = rgba(SB.shade(core, 0.55), 0.55); c.lineWidth = 1.2; bodyPath(c, pts); c.stroke();
    const n = pts.length / 2;
    c.lineCap = 'round'; c.strokeStyle = rgba('#ffffff', 0.42); c.lineWidth = 2.4;
    c.beginPath(); for (let i = Math.floor(n * 0.56); i <= Math.floor(n * 0.82); i++) { const x = pts[i * 2] * 0.94, y = pts[i * 2 + 1] * 0.94 + gy * 0.06; if (i === Math.floor(n * 0.56)) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    // big soft highlight and sharp window glints
    const hy = gy - 78 * P.sq * P.sz * (1 - 0.7 * mk), hx = -22 * P.sx;
    const hg = c.createRadialGradient(hx, hy, 1, hx, hy, 30 * P.sx); hg.addColorStop(0, 'rgba(255,255,255,0.4)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hg; c.beginPath(); c.ellipse(hx, hy, 32 * P.sx, 20 * P.sx, -0.5, 0, TAU); c.fill();
    if (!ko || mk < 0.8) {
      c.fillStyle = 'rgba(255,255,255,0.88)'; c.beginPath(); c.ellipse(hx - 4, hy - 4, 7.5 * P.sx, 3.4 * P.sx, -0.6, 0, TAU); c.fill();
      c.beginPath(); c.arc(hx + 9 * P.sx, hy - 9 * P.sx, 2 * P.sx, 0, TAU); c.fill();
    }
    // ---- the face: a wide gooey mouth, bulging eyes ----
    drawMouth(c, e, t, P, body, core, hi, T, mini);
    const nE = mini ? 2 : 3;
    for (let i = 0; i < nE; i++) drawEye(c, e, t, P, i, body, core, T, mini, col('iris'));
    // ---- drips hanging off its belly ----
    const drips = mini ? [[-0.5, 0], [0.55, 1.7]] : [[-0.82, 0.2], [-0.35, 1.3], [0.18, 2.6], [0.64, 3.4]];
    for (const [ux, ph] of drips) {
      const uy = -Math.sqrt(1 - ux * ux) * 0.35; D.slimeSurf(P, ux, uy, 0, SP);
      drip(c, SP[0], -SP[1] - 2, t, ph + P.seed, body, hi, Math.min(1, gy + SP[1] + 10));
    }
    c.restore();
  };
  // a drip that slowly stretches down, then lets go
  function drip(c, x, y, t, ph, body, hi, maxL) {
    const u = ((t * 0.42 + ph * 0.31) % 1 + 1) % 1, L = Math.min(2 + u * 12, Math.max(3, maxL * 12)), r = 1.6 + u * 1.6;
    c.fillStyle = rgba(body, 0.75);
    c.beginPath(); c.moveTo(x - 3, y); c.quadraticCurveTo(x - 1, y + L * 0.6, x - r, y + L); c.arc(x, y + L, r, Math.PI, 0, true); c.quadraticCurveTo(x + 1, y + L * 0.6, x + 3, y); c.closePath(); c.fill();
    c.fillStyle = rgba('#ffffff', 0.6); c.beginPath(); c.arc(x - r * 0.35, y + L - r * 0.3, r * 0.3, 0, TAU); c.fill();
    if (u > 0.8) { const f = (u - 0.8) / 0.2, yy = y + L + 4 + f * f * 30; c.fillStyle = rgba(body, 0.75 * (1 - f)); c.beginPath(); c.arc(x, yy, r * 0.8, 0, TAU); c.fill(); }
  }
  function drawEye(c, e, t, P, i, body, core, T, mini, irisC) {
    const d = SL.EYES[i], R = d[3] * (mini ? 1.35 : 1) * Math.min(1.15, P.sz + 0.1), bob = Math.sin(t * 2.3 + i * 1.9) * 1.2;
    const [x, y0, z] = D.slimeFace2D(P, d, R * 0.35), y = y0 + bob;
    if (z < -20) return;
    const ko = e.ko, [lx, ly] = D.slimeLook(e, t, i);
    // the jelly bulges up round the eye
    const mg = c.createRadialGradient(x - R * 0.4, y - R * 0.5, 1, x, y, R * 1.45);
    mg.addColorStop(0, rgba(SB.mixColor(body, '#ffffff', 0.3), 0.75)); mg.addColorStop(1, rgba(body, 0.65));
    c.fillStyle = mg; c.beginPath(); c.ellipse(x, y + R * 0.15, R * 1.42, R * 1.32, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(SB.shade(core, 0.4), 0.45); c.lineWidth = 1; c.stroke();
    // the eyeball: slightly yellowed, bloodshot round the edge
    const wg = c.createRadialGradient(x - R * 0.35, y - R * 0.4, 0, x, y, R);
    wg.addColorStop(0, '#fffef6'); wg.addColorStop(0.65, T('#f2f0d8')); wg.addColorStop(1, T('#b9b58a'));
    c.fillStyle = wg; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip();
    c.strokeStyle = 'rgba(190,40,40,0.35)'; c.lineWidth = 0.6;
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + i, r0 = R; c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.quadraticCurveTo(x + Math.cos(a + 0.2) * r0 * 0.75, y + Math.sin(a + 0.2) * r0 * 0.75, x + Math.cos(a - 0.1) * r0 * 0.55, y + Math.sin(a - 0.1) * r0 * 0.55); c.stroke(); }
    if (ko) {   // swirly K.O. eyes
      c.strokeStyle = '#2a2a18'; c.lineWidth = 1.4; c.beginPath();
      for (let k = 0; k <= 24; k++) { const u = k / 24, a = t * 4 + u * TAU * 2, r = u * R * 0.7; if (k) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x, y); }
      c.stroke();
    } else {
      const ix = x + lx * R * 0.42, iy = y + ly * R * 0.42, rI = R * 0.55;
      const ig = c.createRadialGradient(ix, iy, 0, ix, iy, rI);
      const ic = T(irisC || '#e2b21a');
      ig.addColorStop(0, SB.mixColor(ic, '#fff4b0', 0.5)); ig.addColorStop(0.7, ic); ig.addColorStop(1, SB.shade(ic, 0.6));
      c.fillStyle = ig; c.beginPath(); c.arc(ix, iy, rI, 0, TAU); c.fill();
      const pw = e.mood === 'angry' || e.mode === 'hunt' ? 0.16 : 0.34;   // the pupil narrows to a slit when it hunts
      c.fillStyle = '#0a0a06'; c.beginPath(); c.ellipse(ix + lx, iy + ly, rI * pw * 1.4, rI * 0.72, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath(); c.arc(x - R * 0.35, y - R * 0.38, R * 0.2, 0, TAU); c.fill();
    }
    // a heavy jelly lid: narrows when angry, shuts to blink or sleep
    const blink = !ko && ((e.seed || 0) * 7 + t + i * 0.13) % 4.1 < 0.14, shut = e.sleeping || e.mood === 'sleep' || blink;
    const lidK = shut ? 1 : ko ? 0.35 : e.mood === 'angry' || e.mode === 'hunt' ? 0.42 : 0.22;
    const ly0 = y - R + lidK * R * 2.05;
    const ang = e.mood === 'angry' || e.mode === 'hunt' ? R * 0.3 : 0;   // angry: the lid slants down toward the middle
    c.save(); c.beginPath(); c.arc(x, y, R * 1.04, 0, TAU); c.clip();
    const lg = c.createLinearGradient(0, y - R, 0, ly0); lg.addColorStop(0, rgba(SB.mixColor(body, '#ffffff', 0.15), 0.96)); lg.addColorStop(1, rgba(SB.mixColor(body, core, 0.35), 0.96));
    c.fillStyle = lg; c.beginPath(); c.moveTo(x - R * 1.1, y - R * 1.1); c.lineTo(x + R * 1.1, y - R * 1.1); c.lineTo(x + R * 1.1, ly0 - (i === 0 ? ang : -ang)); c.quadraticCurveTo(x, ly0 + R * 0.22, x - R * 1.1, ly0 + (i === 0 ? ang : -ang)); c.closePath(); c.fill();
    c.strokeStyle = rgba(SB.shade(core, 0.5), 0.6); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + R * 1.1, ly0 - (i === 0 ? ang : -ang)); c.quadraticCurveTo(x, ly0 + R * 0.22, x - R * 1.1, ly0 + (i === 0 ? ang : -ang)); c.stroke();
    c.restore();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(x - R * 0.2, y - R * 0.92, R * 0.5, R * 0.14, 0, 0, TAU); c.fill();
  }
  function drawMouth(c, e, t, P, body, core, hi, T, mini) {
    const o = D.slimeMouth(e, t), [mx, my] = D.slimeFace2D(P, SL.MOUTH, 0);
    const W2 = (mini ? 30 : 25) * P.sx * (1 + o * 0.12) * (e.spitT > 0 && e.spitT > 0.22 ? 0.55 : 1), H = 2 + o * (mini ? 30 : 26) * P.sz;
    const x0 = mx - W2, x1 = mx + W2, yU = my - 2 - o * 4, yL = my + H;
    const lip = () => { c.beginPath(); c.moveTo(x0, my); c.bezierCurveTo(x0 + W2 * 0.4, yU - 3, x1 - W2 * 0.4, yU - 3, x1, my - 2); c.bezierCurveTo(x1 - W2 * 0.2, yL, x0 + W2 * 0.3, yL + 2, x0, my); c.closePath(); };
    lip();
    const g = c.createLinearGradient(0, yU, 0, yL); g.addColorStop(0, '#050a04'); g.addColorStop(1, T(SB.mixColor('#3a1418', core, 0.3)));
    c.fillStyle = g; c.fill();
    c.save(); lip(); c.clip();
    if (o > 0.35) {   // a dark gullet and a glistening tongue
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.ellipse(mx, my + H * 0.45, W2 * 0.45, H * 0.32, 0, 0, TAU); c.fill();
      c.fillStyle = T('#8a3b4a'); c.beginPath(); c.ellipse(mx + W2 * 0.1, yL - H * 0.08, W2 * 0.55, H * 0.24, 0, 0, TAU); c.fill();
    }
    c.restore();
    // strings of slime across the gap
    c.strokeStyle = rgba(SB.mixColor(body, '#ffffff', 0.25), 0.7); c.lineCap = 'round';
    if (o > 0.2) for (let k = 0; k < 2; k++) {   // two stretchy strings that sag and thin in the middle
      const u = 0.3 + k * 0.42 + Math.sin(t * 1.4 + k) * 0.05, x = x0 + (x1 - x0) * u, yt = yU + 1, yb = yL - H * 0.2, sag = 3 + Math.sin(t * 2 + k * 2) * 2;
      c.strokeStyle = rgba(SB.mixColor(body, '#ffffff', 0.3), 0.55); c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(x - 1.5, yt); c.quadraticCurveTo(x + sag, (yt + yb) / 2 + 2, x + 2, yb); c.stroke();
      c.fillStyle = rgba(body, 0.6); c.beginPath(); c.arc(x + sag * 0.5, (yt + yb) / 2 + 1, 1.3, 0, TAU); c.fill();
    }
    // thick jelly lips
    c.strokeStyle = rgba(SB.mixColor(body, core, 0.5), 0.85); c.lineWidth = 3.4; lip(); c.stroke();
    c.strokeStyle = rgba('#ffffff', 0.45); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 + 4, my - 3); c.bezierCurveTo(x0 + W2 * 0.5, yU - 5, x1 - W2 * 0.5, yU - 5, x1 - 4, my - 5); c.stroke();
    // drool off the lower lip
    for (let k = 0; k < (mini ? 1 : 2); k++) drip(c, mx - W2 * 0.3 + k * W2 * 0.7, yL - 1, t, k * 1.7 + 0.4, body, hi, 1);
  }

  // ---------- definitions ----------
  const PAL = { body: '#62d148', core: '#1f7a22', glow: '#d8ff9a', iris: '#e2b21a', bone: '#ece4cc', metal: '#a7b0ba', mouth: '#120a06' };
  const palOf = def => { let pal = Object.assign({}, PAL); Object.defineProperty(def, 'pal', { enumerable: true, configurable: true, get: () => pal, set: v => { pal = Object.assign({}, v, PAL); } }); };
  const inner = D.slime(false), K = DRAWK;
  const def = SB.def(NAME, SB.merge({
    cat: 'boss', boss: true, creature: true, move: 'walk', temper: 'hostile', bounce: 0.05, friction: 6, huntR: 760,
    tags: ['boss', 'monster', 'big', 'scary', 'villain', 'predator'], fears: [], hunts: [], eats: [], heldMood: 'angry'
  }, {
    drawK: K,
    t: { w: inner.w * K, h: inner.h * K, draw(p, e, t) { p.ctx.scale(K, K); inner.draw(p, e, t); } },
    aliases: ['slime', 'slime boss', 'slime blob', 'giant slime blob', 'blob', 'the blob', 'giant blob', 'blob monster', 'slime monster', 'ooze', 'giant ooze', 'goo monster', 'goo', 'jelly monster', 'giant jelly',
      'king slime', 'slime king', 'gelatinous cube', 'big slime', 'huge slime', 'mega slime', 'slime giant', 'green slime', 'slime blob boss', 'blob boss', 'slimy blob', 'slimy monster', 'ooze monster', 'gloop', 'gloop monster', 'slime beast',
      'gaint slime', 'giant slim', 'giant slme', 'gient slime', 'giant slyme', 'slyme', 'slmie', 'sliem', 'slim blob', 'slime blop', 'blobb', 'giant slimeblob', 'slimeblob', 'gooey monster', 'snot monster'],
    move: 'hop', speed: 150, mass: 85, hp: 50, jump: 560, tags: ['slime', 'goo', 'jelly', 'blob', 'wet', 'gross', 'squishy', 'creepy'], kin: ['slime'],
    weak: ['fire', 'hot', 'lava', 'cold', 'ice', 'snow', 'lightning', 'salt'], special: 'slime', roarSfx: 'splat',
    hunts: ['human', 'hero', 'animal', 'monster', 'bug', 'fish'], eats: [],
    say: ['*blorp*', '*gurgle gurgle*', '*squelch*', 'Hungry...', 'Come here... I give great hugs...', 'Everything fits inside me!', '*wobble wobble*', 'Bloooorp.'],
    roar: ['BLOOORP!', 'GLORP!', '*SPLORCH!*', 'SLUUURP!'],
    weakSay: ['SIZZLE! Too hot!', 'I\'m melting! MELTING!', 'B-b-brr! I\'m going crunchy!', 'Hsssss! Not the heat!', '*fizzle*'],
    power: 'A giant wobbling blob of slime. Hops around and lands with a ground-shaking SPLAT, body-slams from high up, spits sticky goo that glues things to the ground, and SWALLOWS creatures whole (you can see them stuck inside!). Hit it hard and it SPLITS into little slimes that hop around and fight for it, then slurp back into it to heal it.',
    weakText: 'fire and heat (it sizzles and shrinks), ice and cold (it freezes solid and goes brittle, so hit it while it\'s frozen!) and lightning. Hurt it enough and it spits out whatever it swallowed.',
    hint: 'The giant slime hops, swallows things, spits goo and SPLITS! Weak to fire and ice.',
    onHurt(e, W) { slimeHurt(e, W); }
  }));
  def.mass = Math.round(85 * K * K * 0.8); def.hp = Math.round(50 * (1 + (K - 1) * 0.6));
  palOf(def);
  SB.BOSSES.push(NAME);

  const innerM = D.slime(true), KM = SL.MINI;
  const mdef = SB.def(MINI, {
    cat: 'creature', hidden: true, creature: true, move: 'hop', temper: 'hostile', speed: 140, jump: 380, mass: 4, hp: 5, bounce: 0.1, friction: 6, huntR: 520,
    t: { w: innerM.w * KM, h: innerM.h * KM, draw(p, e, t) { p.ctx.scale(KM, KM); innerM.draw(p, e, t); } },
    aliases: ['baby slime', 'mini slime', 'little slime', 'small slime', 'tiny slime', 'slime minion', 'slimelet', 'slime baby', 'blobling', 'little blob', 'baby blob', 'mini blob'],
    tags: ['slime', 'goo', 'jelly', 'blob', 'wet', 'squishy', 'monster', 'small'], kin: ['slime'],
    weak: ['fire', 'hot', 'lava', 'cold', 'ice', 'snow', 'lightning'], special: 'slimeling',
    hunts: ['human', 'hero', 'animal', 'monster', 'bug'], fears: [], eats: [],
    say: ['*blip*', '*bloop*', 'Blorp!', '*boing*'], roar: ['Blip!', 'BLOOP!', '*squish*'],
    hint: 'A little slime. Fire melts it, and it slurps back into a giant slime.'
  });
  palOf(mdef);

  // ---------- attacks ----------
  const S = SB.SPECIALS = SB.SPECIALS || {};
  const ready = e => !(e.ko || e.held || e.dizzy > 0 || e.sleeping || e.spawnT < 1 || e.frozenT > 0 || e.webT > 0);
  const foeOf = (e, o) => o !== e && o.alive && !o.dying && !o.static && !o.held && !o.invisible && !SB.kin(e, o) && !o.engulfedBy;
  const CAP = 5;   // most little slimes one blob can have out at once
  const isMini = o => o.def.name === MINI;
  const minionsOf = (e, W) => W.entities.filter(o => o.slimeBoss === e && o.alive && !o.dying && !o.ko);

  // the squash-and-stretch spring, the shrinking with health, the lean; landing bounces kick it
  function pose(e, dt) {
    if (e.sq == null) { e.sq = 1; e.sqV = 0; e.slSz = 1; e.lean = 0; e.meltK = 0; e.airT = 0; e.fallV = 0; }
    let want = 1;
    if (e.held) want = 1.3;                                                      // dangles and stretches when you pick it up
    else if (e.crouchT > 0) want = e.slamNext ? 0.66 : 0.78;                     // squashes down to jump
    else if (e.spitT > 0) want = e.spitT > 0.22 ? 0.86 : 1.12;
    else if (e.gulpT > 0) want = 1.12;
    else if (!e.grounded && !e.ko) want = 1 + clamp(Math.abs(e.vy) / 2600, 0, 0.24);
    if (e.ko || e.frozenT > 0) want = e.frozenT > 0 ? e.sq : 1;
    const n = dt > 0.03 ? Math.ceil(dt / 0.03) : 1, h = dt / n;
    for (let i = 0; i < n; i++) { e.sqV += ((want - e.sq) * 170 - e.sqV * 6.5) * h; e.sq += e.sqV * h; }
    e.sq = clamp(e.sq, 0.55, 1.5);
    const hpK = e.hpMax ? clamp(e.hp / e.hpMax, 0, 1) : 1, szW = (isMini(e) ? 1 : 0.76 + 0.24 * hpK) - (e.sizzleT > 0 ? 0.05 : 0);
    e.slSz += (szW - e.slSz) * Math.min(1, dt * 2.5);
    const lw = e.grounded ? (e.crouchT > 0 ? -0.12 : 0) : clamp(e.vx * e.facing / 1300, -0.25, 0.25);
    e.lean += (lw - e.lean) * Math.min(1, dt * 6);
    if (e.sizzleT > 0) e.sizzleT -= dt;
    if (e.zapT > 0) e.zapT -= dt;
    if (e.frozenT > 0) { if (e.frozeAt == null) e.frozeAt = SB.world.time; } else e.frozeAt = null;
  }
  // where to look (local frame): its prey, the cursor, or glancing about
  function look(e, dt, W) {
    const tg = e.engulfed || e.target, cur = W.cursor;
    let wx, wy;
    if (tg && tg.alive && !tg.dying) { const dx = tg.x - e.x, dy = tg.y - (e.y - e.h * 0.2), d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 120); wx = dx / d * m; wy = dy / d * m; }
    else if (cur && cur.in && Math.hypot(cur.x - e.x, cur.y - e.y) < 700) { const dx = cur.x - e.x, dy = cur.y - (e.y - e.h * 0.2), d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 120); wx = dx / d * m; wy = dy / d * m; }
    else { const k = Math.floor(W.time * 0.8 + (e.seed || 0)); wx = Math.sin(k * 12.9898) * 0.8; wy = Math.sin(k * 78.233) * 0.5; }
    const lx = wx * (e.facing || 1), kk = Math.min(1, dt * 7);
    e.slLX = (e.slLX || 0) + (lx - (e.slLX || 0)) * kk; e.slLY = (e.slLY || 0) + (wy - (e.slLY || 0)) * kk;
  }
  // a hop toward tx: up at speed vy, timed to come down there
  function hop(e, tx, vy, maxV, W, vol) {
    const T = 2 * vy / G, dx = clamp(tx, 30, W.W - 30) - e.x;
    e.vx = clamp(dx / T, -maxV, maxV); e.vy = -vy; e.grounded = false; e.jumpCd = 0.3;
    if (Math.abs(dx) > 4) e.facing = dx > 0 ? 1 : -1;
    e.sqV += 5;
    W.sfx('boing', e.x, vol == null ? 0.7 : vol);
  }
  // touched down: squash, splash, leave slime on the ground; a body slam flattens whatever is under it
  function land(e, W, mini) {
    const s = e.scale, v = e.fallV;
    e.sqV -= Math.min(10, v / 95);
    if (mini) { if (v > 300) { W.burst('drop', e.x, e.bottom - 2, 3, 90, { size: 3, g: 600, col: '#62d148', life: 0.4 }); } return; }
    addTrail(e, e.x, e.w * 0.85, 7, W);
    W.burst('drop', e.x, e.bottom - 4, 8, 220, { size: 5, g: 900, col: '#62d148', life: 0.6 });
    W.sfx('splat', e.x, 0.8);
    if (e.slamming) {
      e.slamming = false;
      W.stompWave(e, 380 * s, 680, 3); W.shake(20); W.flash = 0.12;
      W.particle('impact', e.x, e.top - 10, { life: 0.6, size: 52, text: 'SPLAT!' });
      for (const o of W.entities) {
        if (!foeOf(e, o) || !o.creature || o.ko) continue;
        if (Math.abs(o.x - e.x) > e.w * 0.45 + o.w * 0.3 || o.bottom < e.bottom - e.h * 0.6) continue;
        W.hurt(o, o.def.boss ? 3 : 4, e, { quiet: true }); o.gooT = Math.max(o.gooT || 0, 2.5); o.gooBy = e;
        o.vx = (o.x < e.x ? -1 : 1) * 420; o.vy = -380; o.grounded = false;
        o.say(pick(['SQUISH!', 'Ewww!', 'I\'m all gooey!', 'Flattened!'])); W.popText(o.x, o.top - 18, 'Squish!', 20);
      }
      e.say(pick(['BODY SLAM!', '*SPLORCH!*', 'BLOOORP!']));
    }
  }
  function addTrail(e, x, w, life, W) {
    e.trail = e.trail || [];
    e.trail.push({ x, w, life, max: life, seed: Math.random() * 10 });
    if (e.trail.length > 16) e.trail.shift();
  }

  // the big blob
  S.slime = function (e, dt, W) {
    hooks(W);
    const s = e.scale;
    pose(e, dt); look(e, dt, W);
    if (e.slInit == null) { e.slInit = 1; e.trail = e.trail || []; e.goos = []; e.hopCd = 0.8; e.spitCd = 3; e.slamCd = 5; e.gulpCd = 3.5; e.splitI = 0; e.splitCd = 0; e.engDmg = 0; }
    if (!e.controlled) e.timer = 9;   // it times its own hops (keeps the hop AI from bouncing it about)
    e.hopCd -= dt; e.spitCd -= dt; e.slamCd -= dt; e.gulpCd -= dt; e.splitCd -= dt;
    trailTick(e, dt, W); goosTick(e, dt, W); gooTick(e, dt, W);
    // landing
    if (!e.grounded && !e.held) { e.airT += dt; e.fallV = Math.max(e.fallV, e.vy); }
    else { if (e.grounded && e.airT > 0.12) land(e, W, false); e.airT = 0; e.fallV = 0; }
    if (e.held) e.slamming = false;
    // little slimes that touch it again slurp back in and heal it
    for (const m of W.entities) {
      if (m.slimeBoss !== e || !m.alive || m.dying || m.ko || e.ko || m.held) continue;
      if (!(m.returning || m.age > 9) || m.age < 2) continue;
      if (Math.abs(m.x - e.x) < (e.w + m.w) / 2 + 6 && m.bottom > e.top + e.h * 0.25) merge(e, m, W);
    }
    if (e.ko || !e.alive) {
      if (e.engulfed) release(e, W, 'ko');
      e.crouchT = e.spitT = e.gulpT = 0; e.slamming = false;
      e.meltK = Math.min(1, (e.meltK || 0) + dt / 1.4);
      if (!e.meltSaid) { e.meltSaid = true; W.sfx('splash', e.x); W.particle('puddle', e.x, e.bottom - 2, { life: 6, size: e.w * 0.55, col: '#62d148' }); for (const m of minionsOf(e, W)) { W.melt(m); } }
      return;
    }
    e.meltK = Math.max(0, (e.meltK || 0) - dt * 2); e.meltSaid = false;
    // fire on it counts as its weakness: it sizzles and shrinks
    if (e.onFire > 0 && e.weakT <= 0) W.weaken(e, e.fireSrc && e.fireSrc.alive ? e.fireSrc : null);
    if (e.sizzleT > 0 && Math.random() < dt * 16) W.particle('smoke', e.x + (Math.random() - 0.5) * e.w * 0.7, e.top + e.h * 0.3 * Math.random(), { vy: -70, life: 0.8, size: 6 + Math.random() * 6, col: '#f2f2f2' });
    if (e.frozenT > 0 && !e.wasFrozen) { e.wasFrozen = true; e.say(pick(['B-b-brr...', 'I\'m going c-crunchy!', '*crackle*'])); W.popText(e.x, e.top - 40, 'BRITTLE!', 24); if (e.engulfed) release(e, W, 'frozen'); }
    if (e.frozenT <= 0) e.wasFrozen = false;
    // split at each quarter of its health
    const hk = e.hp / e.hpMax;
    while (e.splitI < 4 && hk < 0.8 - e.splitI * 0.2) { e.splitI++; split(e, 2, W); }
    // something inside: hold it, digest it, spit it out when hurt enough
    if (e.engulfed) { holdTick(e, dt, W); return; }
    // attacks in progress
    if (e.crouchT > 0) {
      e.crouchT -= dt;
      if (e.crouchT <= 0 && ready(e) && e.grounded) {
        const slam = e.slamNext; e.slamNext = false;
        hop(e, e.hopTx, slam ? 1000 : 560, slam ? 560 : 420, W, slam ? 1 : 0.7);
        if (slam) { e.slamming = true; W.sfx('whoosh', e.x); e.say(pick(['BLOOORP!', 'Incoming!', '*SPROING*'])); }
      }
      return;
    }
    if (e.spitT > 0) { const was = e.spitT; e.spitT -= dt; if (was > 0.22 && e.spitT <= 0.22) spit(e, W); return; }
    if (e.gulpT > 0) { const was = e.gulpT; e.gulpT -= dt; if (was > 0.2 && e.gulpT <= 0.2) gulp(e, W); return; }
    if (!ready(e) || e.controlled || !e.grounded) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying && !tg.ko)) {   // nothing to fight: an idle hop now and then
      if (e.hopCd <= 0) { e.hopCd = 1.8 + Math.random() * 2.2; e.hopTx = e.x + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 120) * s; e.crouchT = 0.3; }
      return;
    }
    const dx = tg.x - e.x, ad = Math.abs(dx), reach = e.w * 0.5 + 34 * s + tg.w * 0.5;
    const level = tg.bottom > e.top + e.h * 0.15 && tg.top < e.bottom + 10;
    if (e.gulpCd <= 0 && canEngulf(e, tg) && ad < reach + 26 * s && level) { startGulp(e, W); return; }
    if (e.slamCd <= 0 && ad > 170 * s && ad < 560 * s) { e.slamCd = 7 + Math.random() * 3; e.hopCd = 1.5; e.slamNext = true; e.hopTx = tg.x + (tg.vx || 0) * 0.5; e.crouchT = 0.5; e.facing = dx >= 0 ? 1 : -1; e.say(pick(['*wobble wobble*', 'Here I COME!', 'BLOOORP!'])); return; }
    if (e.spitCd <= 0 && ad > 180 * s && ad < 720 * s) { e.spitCd = 4.5 + Math.random() * 2; e.spitT = 0.6; e.aim = tg; e.facing = dx >= 0 ? 1 : -1; W.sfx('hiss', e.x, 0.4); return; }
    if (e.hopCd <= 0) { e.hopCd = 0.75 + Math.random() * 0.5; e.hopTx = ad < reach ? e.x + Math.sign(dx || 1) * 30 : tg.x; e.crouchT = 0.24; return; }
  };
  function canEngulf(e, o) {
    return !!o && o.creature && o.alive && !o.dying && !o.ko && !o.held && !o.static && !o.def.boss && !SB.kin(e, o) && !o.engulfedBy && !(o.frozenT > 0)
      && o.h < e.h * 0.72 && o.w < e.w * 0.72 && o.mass <= 45 * e.scale * e.scale;
  }
  function startGulp(e, W) {
    e.gulpT = 0.45; e.gulpCd = 8 + Math.random() * 3; e.lungeT = 0.24; e.lungeDir = e.facing; e.sqV += 4;
    W.sfx('whoosh', e.x, 0.7); e.say(pick(['GLORP!', 'Come here...', 'SLUUURP!', 'Into my belly!']));
  }
  function gulp(e, W) {
    const s = e.scale, reach = e.w * 0.5 + 60 * s;
    let best = null, bd = Infinity;
    for (const o of W.entities) {
      if (!foeOf(e, o) || !canEngulf(e, o)) continue;
      const dx = (o.x - e.x) * e.facing;
      if (dx < -e.w * 0.25 || dx > reach + o.w * 0.5 || o.bottom < e.top || o.top > e.bottom + 10) continue;
      if (Math.abs(dx) < bd) { bd = Math.abs(dx); best = o; }
    }
    if (!best) { e.say(pick(['Blorp?', '*misses*', 'Hmph.'])); W.sfx('splat', e.x, 0.4); return; }
    engulf(e, best, W);
  }
  function engulf(e, v, W) {
    e.engulfed = v; v.engulfedBy = e; e.engT = 0; e.engDmg = 0; e.engTick = 0.7;
    v.engNC = v.noCollide; v.noCollide = true; v.target = null; v.attacker = null; v.mode = 'wander';
    if (v.webT > 0) v.webT = 0;
    if (v.onFire > 0) W.douse(v, true);
    v.say(pick(['Mmmph!', 'HEY!', 'Ewww!', 'AAAH!'])); e.say(pick(['GULP!', '*SLURP*', 'Mmm... crunchy.', 'Delicious!']));
    W.popText(v.x, v.top - 16, 'GULP!', 26); W.sfx('splat', e.x); W.sfx('pop', e.x, 0.6); W.shake(5); e.sqV += 6;
    W.burst('drop', v.x, v.y, 8, 160, { size: 4, g: 600, col: '#62d148', life: 0.5 });
  }
  function holdTick(e, dt, W) {
    const v = e.engulfed, t = W.time, K = ks(e);
    if (!v.alive || v.dying || v.held || e.held || e.weakT > 0 || e.engDmg >= 6) { release(e, W, e.engDmg >= 6 || e.weakT > 0 ? 'hurt' : 'drop'); return; }
    e.engT += dt; e.engTick -= dt;
    // it floats in the middle of the jelly, slowly turning, bubbles streaming off it
    const P = D.slimePose(e, t), cy = SL.gyU + (12 - SL.gyU) * P.sq * P.sz * 0.62;
    v.x = e.x + e.facing * 4 * K + Math.sin(t * 1.1 + e.seed) * 5 * K;
    v.y = Math.min(e.y - cy * K + Math.cos(t * 0.9) * 4 * K, W.groundY - v.h / 2 - 14 * K);
    v.vx = 0; v.vy = 0; v.grounded = false; v.angle = Math.sin(t * 1.3 + e.seed) * 0.5; v.angVel = 0;
    v.target = null; v.mode = 'wander'; v.dizzy = Math.max(v.dizzy, 0.12); v.gooT = 0;
    if (Math.random() < dt * 6) W.particle('sparkle', v.x + (Math.random() - 0.5) * v.w, v.y, { vy: -40, life: 0.6, size: 3, col: '#d8ff9a' });
    if (e.engTick <= 0) {
      e.engTick = 0.8; W.hurt(v, 1, e, { quiet: true, soft: true, col: '#62d148' }); W.sfx('splat', e.x, 0.25);
      if (Math.random() < 0.45) v.say(pick(['Let me OUT!', 'Mmmph!', 'It\'s so squishy in here!', 'Ewww, slimy!', 'HELP!', 'Blub blub!']));
      if (Math.random() < 0.2) e.say(pick(['*gurgle*', '*digesting*', 'Mmmm...']));
    }
    if (v.ko || e.engT > 5.5) release(e, W, v.ko ? 'ko' : 'done');
  }
  function release(e, W, why) {
    const v = e.engulfed; e.engulfed = null; e.gulpCd = Math.max(e.gulpCd, 4);
    if (!v) return;
    v.engulfedBy = null; v.noCollide = v.engNC != null ? v.engNC : v.def.noCollide; v.engNC = null; v.angle = v.ko ? v.angle : 0; v.dizzy = Math.max(v.dizzy, 0.6);
    if (!v.alive || v.dying) return;
    const dir = e.facing || 1;
    v.x = clamp(e.x + dir * (e.w * 0.5 + v.w * 0.5 + 4), v.w / 2, W.W - v.w / 2); v.y = Math.min(e.y - e.h * 0.1, W.groundY - v.h / 2);
    if (why !== 'drop') { v.vx = dir * (380 + Math.random() * 160); v.vy = -440; v.grounded = false; v.angVel = dir * 8; }
    v.gooT = Math.max(v.gooT || 0, 2.5); v.gooBy = e;
    W.sfx('splat', v.x); W.sfx('pop', v.x, 0.7); W.burst('drop', v.x, v.y, 10, 220, { size: 4, g: 800, col: '#62d148', life: 0.6 });
    if (why === 'hurt' || why === 'frozen' || why === 'ko' && e.ko) { W.popText(v.x, v.top - 20, 'ESCAPED!', 24); if (!v.ko) v.say(pick(['I\'m OUT!', 'Freedom!', 'Ewww, I\'m all slimy!', 'Phew!'])); e.say(pick(['BLEGH!', '*hurk*', 'PTOOEY!'])); }
    else { W.popText(v.x, v.top - 20, 'PTOOEY!', 24); e.say(pick(['PTOOEY!', 'Blegh. Tastes funny.', '*BURP*'])); }
  }
  // split off little slimes (real creatures) that hop out and fight for it
  function split(e, n, W) {
    n = Math.min(n, CAP - minionsOf(e, W).length);
    if (n <= 0 || e.ko) return;
    for (let i = 0; i < n; i++) {
      const m = W.spawn(MINI, e.x + (Math.random() - 0.5) * e.w * 0.3, e.y - e.h * 0.15, { quiet: true, scale: 0.85 + Math.random() * 0.4 });
      if (!m) continue;
      m.slimeBoss = e; m.homeT = 10 + Math.random() * 6; m.spawnT = 0.5;
      m.vx = (i % 2 ? 1 : -1) * (200 + Math.random() * 220); m.vy = -480 - Math.random() * 220; m.grounded = false;
    }
    e.sqV -= 5; W.sfx('pop', e.x); W.sfx('splat', e.x, 0.7); W.shake(4);
    W.burst('drop', e.x, e.y - e.h * 0.2, 12, 260, { size: 5, g: 900, col: '#62d148', life: 0.7 });
    W.popText(e.x, e.top - 40, 'SPLIT!', 30); e.say(pick(['More of me!', '*SPLORP*', 'Go, my little blobs!', 'Divide and CONQUER!']));
  }
  function merge(e, m, W) {
    W.remove(m, 'poof');
    const heal = 3; e.hp = Math.min(e.hpMax, e.hp + heal); e.lastHp = e.hp; e.sqV += 5;
    W.popText(e.x, e.top - 26, '+' + heal + ' SLURP!', 22); W.sfx('pop', e.x); W.sfx('splat', e.x, 0.5);
    W.burst('sparkle', m.x, m.y, 6, 80, { size: 4, col: '#d8ff9a', life: 0.6 });
    if (Math.random() < 0.5) e.say(pick(['Welcome back!', '*slurp*', 'Mmm, that\'s better.']));
  }
  // when it gets hurt: brittle while frozen, a big hit knocks a little slime loose, damage counts toward spitting out its meal
  function slimeHurt(e, W) {
    const dmg = e.lastHp - e.hp; if (!(dmg > 0)) return;
    if (e.frozenT > 0 && !e.ko) {
      e.hp -= 2; W.popText(e.x, e.top - 30, 'CRACK!', 26); W.burst('shard', e.x, e.y, 10, 240, { size: 6, g: 900, life: 0.8 }); W.sfx('shatter', e.x, 0.7);
      if (e.hp <= 0) W.knockOut(e, null); else if (Math.random() < 0.5) split(e, 1, W);
    } else if (dmg >= 4 && e.splitCd <= 0 && !e.ko) { e.splitCd = 2.5; split(e, 1, W); }
    if (e.engulfed) e.engDmg += dmg + (e.frozenT > 0 ? 2 : 0);
    e.sqV -= Math.min(6, 1.5 + dmg);
    W.burst('drop', e.x, e.y, 4, 140, { size: 4, g: 700, col: '#62d148', life: 0.5 });
    if (Math.random() < 0.3) e.say(pick(['BLORP!', '*squelch*', 'Ow, my jelly!', 'Hey! That jiggled!']));
  }

  // sticky goo: spat in arcs; whatever it hits is glued down and slowed
  function spit(e, W) {
    const tg = e.aim; e.aim = null;
    const [mx, my] = D.slimeMouthAt(e), live = tg && tg.alive && !tg.dying;
    const tx = live ? tg.x + (tg.vx || 0) * 0.35 : e.x + e.facing * 300, ty = live ? tg.y : W.groundY - 20;
    for (let i = 0; i < 3; i++) {
      const T = clamp(Math.abs(tx - mx) / 650, 0.45, 1.1) * (0.9 + i * 0.12), gx = tx + (i - 1) * 34 * e.scale;
      e.goos.push({ x: mx, y: my, vx: (gx - mx) / T, vy: (ty - my) / T - 0.5 * 1100 * T, r: 8 * Math.sqrt(e.scale), life: 3, seed: Math.random() * 10 });
    }
    W.sfx('spit', e.x); W.sfx('splat', e.x, 0.4); e.sqV -= 3; W.shake(2);
    e.say(pick(['PTOO!', '*HOCK* PTOO!', 'Catch!', 'Sticky goo!']));
  }
  function goosTick(e, dt, W) {
    const B = e.goos;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.vy += 1100 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let hit = b.life <= 0 || b.x < -40 || b.x > W.W + 40;
      if (!hit && b.y > W.groundY - b.r * 0.5) { hit = true; addTrail(e, b.x, 34 * e.scale, 6, W); W.burst('drop', b.x, W.groundY - 3, 5, 120, { size: 4, g: 700, col: '#62d148', life: 0.5 }); W.sfx('splat', b.x, 0.35); }
      if (!hit) for (const o of W.entities) {
        if (!o.creature || o.ko || !foeOf(e, o)) continue;
        if (Math.abs(o.x - b.x) > o.w * 0.45 + b.r || Math.abs(o.y - b.y) > o.h * 0.45 + b.r) continue;
        W.hurt(o, 1, e, { quiet: true, soft: true, col: '#62d148' }); goo(o, e, o.def.boss ? 1.5 : 3.5, W);
        W.burst('drop', b.x, b.y, 7, 160, { size: 4, g: 700, col: '#62d148', life: 0.5 }); W.sfx('splat', b.x, 0.6);
        hit = true; break;
      }
      if (hit) B.splice(i, 1);
    }
  }
  function goo(o, e, dur, W) {
    const fresh = !(o.gooT > 0.5);
    o.gooT = Math.max(o.gooT || 0, dur); o.gooBy = e; o.vx *= 0.3;
    if (fresh) { W.popText(o.x, o.top - 16, 'Gooey!', 18); o.say(pick(['Eww, sticky!', 'I\'m stuck!', 'Gross!', 'Yuck! Goo!', 'I can\'t move my feet!'])); }
  }
  // gooey things are slowed right down (fire burns the goo off)
  function gooTick(e, dt, W) {
    for (const o of W.entities) {
      if (o.gooBy !== e || !(o.gooT > 0)) continue;
      o.gooT -= dt;
      if (o.onFire > 0 || !o.alive || o.ko) o.gooT = 0;
      if (o.gooT <= 0) { o.gooT = 0; o.gooBy = null; continue; }
      if (o.held || o.engulfedBy) continue;
      o.vx *= Math.exp(-dt * (o.def.boss ? 6 : 20));
      if (o.flying) o.vy += 420 * dt;
    }
  }
  // slime trails and goo splats on the ground: sticky for anyone walking through
  function trailTick(e, dt, W) {
    const L = e.trail;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life -= dt; if (p.life <= 0) { L.splice(i, 1); continue; }
      if (p.life < 1.5) continue;
      for (const o of W.entities) {
        if (!o.creature || !o.grounded || o.ko || o.def.boss || SB.kin(e, o) || o.engulfedBy || o.bottom < W.groundY - 8) continue;
        if (Math.abs(o.x - p.x) < p.w * 0.5) { o.gooT = Math.max(o.gooT || 0, 0.35); o.gooBy = e; }
      }
    }
  }

  // the little slimes: hop at their prey, and after a while hop home to the big one
  S.slimeling = function (m, dt, W) {
    hooks(W);
    pose(m, dt); look(m, dt, W);
    if (!m.controlled) m.timer = 9;
    if (m.hopCd == null) { m.hopCd = 0.4 + Math.random() * 0.5; m.homeT = m.homeT || 12 + Math.random() * 6; }
    m.hopCd -= dt;
    if (!m.grounded && !m.held) { m.airT += dt; m.fallV = Math.max(m.fallV, m.vy); }
    else { if (m.grounded && m.airT > 0.1) land(m, W, true); m.airT = 0; m.fallV = 0; }
    if (m.ko) { m.koT = (m.koT || 0) + dt; if (m.koT > 0.8) W.melt(m); return; }
    if (m.onFire > 0 && m.alive && !m.dying) { W.burst('smoke', m.x, m.y, 6, 60, { size: 6, col: '#f2f2f2', life: 0.8 }); W.sfx('hiss', m.x, 0.5); W.melt(m); return; }
    let boss = m.slimeBoss;
    if (boss && (!boss.alive || boss.dying || boss.ko)) boss = m.slimeBoss = null;
    m.homeT -= dt;
    if (!boss && m.homeT <= 0) {   // a stray little slime looks for a big one to join
      let bd = 900; for (const o of W.entities) if (o.def.name === NAME && o.alive && !o.ko && !o.dying) { const d = Math.abs(o.x - m.x); if (d < bd) { bd = d; boss = o; } }
      if (boss) m.slimeBoss = boss; else m.homeT = 5;
    }
    if (boss && m.homeT <= 0 && !m.returning) { m.returning = true; if (Math.random() < 0.4) m.say(pick(['Home time!', '*bloop bloop*', 'Coming!'])); }
    if (!ready(m) || m.controlled || !m.grounded || m.hopCd > 0) return;
    const tg = m.target, s = m.scale;
    let tx;
    if (m.returning && boss) tx = boss.x;
    else if (tg && tg.alive && !tg.dying && !tg.ko) tx = tg.x;
    else { m.hopCd = 1 + Math.random() * 1.5; hop(m, m.x + (Math.random() - 0.5) * 160, 300, 220, W, 0.2); return; }
    m.hopCd = 0.45 + Math.random() * 0.5;
    hop(m, tx, 360 + Math.random() * 90, 330 * Math.max(0.8, s), W, 0.25);
  };

  // hooks into the world (installed once)
  function hooks(W) {
    if (!W || W.slimeHooked || !W.ctrlSpecial) return;
    W.slimeHooked = true;
    // its own stomps don't launch its little slimes or whatever it has swallowed
    const sw0 = W.stompWave;
    W.stompWave = function (src) {
      if (!src || !(src.special === 'slime' || src.special === 'slimeling')) return sw0.apply(this, arguments);
      const skip = []; for (const o of W.entities) if (o !== src && !o.held && (SB.kin(src, o) || o.engulfedBy)) { o.held = true; skip.push(o); }
      try { return sw0.apply(this, arguments); } finally { for (const o of skip) o.held = false; }
    };
    // weaknesses: fire sizzles it, cold freezes it brittle, lightning makes it shiver
    const wk0 = W.weaken;
    W.weaken = function (e, src) {
      const was = e.weakT, r = wk0.apply(this, arguments);
      if ((e.special === 'slime' || e.special === 'slimeling') && was <= 0 && e.weakT > 0) slimeWeak(e, src, W);
      return r;
    };
    // control mode: E swallows what's in front, body-slams what's further off, spits goo at what's far
    const ctrlSpecial = W.ctrlSpecial;
    W.ctrlSpecial = function () {
      const e = W.ctrl && W.ctrl.e;
      if (!e || e.special !== 'slime') return ctrlSpecial.call(W);
      if (e.ko || e.dying || W.ctrl.atkCd > 0 || e.engulfed || e.crouchT > 0 || e.spitT > 0 || e.gulpT > 0) return;
      W.ctrl.atkCd = 0.6;
      let best = null, bd = Infinity;
      for (const o of W.entities) {
        if (o === e || !o.alive || o.dying || !o.creature || o.ko || o.held || SB.kin(e, o)) continue;
        const dx = (o.x - e.x) * e.facing; if (dx < -o.w * 0.3 || dx > 900) continue;
        const dd = Math.abs(dx) + Math.abs(o.y - e.y) * 0.5; if (dd < bd) { bd = dd; best = o; }
      }
      const ad = best ? Math.abs(best.x - e.x) : 0;
      if (best && canEngulf(e, best) && ad < e.w * 0.5 + 80 * e.scale + best.w * 0.5) { startGulp(e, W); return; }
      if (!e.grounded) return;
      if (!best || ad < 560 * e.scale) { e.slamNext = true; e.hopTx = best ? best.x : e.x + e.facing * 260 * e.scale; e.crouchT = 0.4; return; }
      e.spitT = 0.6; e.aim = best;
    };
  }
  window.addEventListener('DOMContentLoaded', () => hooks(SB.world));
  function slimeWeak(e, src, W) {
    const cold = src && (src.def.frost || src.tags.has('cold') || src.tags.has('ice') || src.tags.has('snow'));
    const zap = src && (src.def.name === 'lightning' || src.special === 'lightning');
    if (e.onFire > 0 || !(cold || zap)) {   // fire and heat
      e.sizzleT = 1.4; W.sfx('hiss', e.x); W.popText(e.x, e.top - 50, 'SIZZLE!', 26);
      W.burst('smoke', e.x, e.y - e.h * 0.2, 12, 120, { size: 9, col: '#f2f2f2', life: 1 });
      if (isMini(e)) W.melt(e);
    } else if (cold) {
      W.freeze(e, src, 6);
      if (!e.def.boss && e.frozenT > 0) W.popText(e.x, e.top - 20, 'Brittle!', 16);
    } else {
      e.zapT = 1.1; W.sfx('zap', e.x); W.burst('spark', e.x, e.y, 12, 260, { size: 7, col: '#fff27a' }); W.popText(e.x, e.top - 50, 'ZZZT!', 24);
    }
  }

  // ---------- drawn over the world: trails, goo, goo on stuck creatures, the jelly in front of a swallowed victim ----------
  // (in 3D the model draws all of this itself)
  def.drawWorld = function (p, c, e, t) {
    const W = SB.world, pal = e.pal || e.def.pal, body = pal.body, core = pal.core;
    if (W.mode3d && e._m3) return;
    // slime trails on the ground
    for (const q of e.trail || []) {
      const a = Math.min(1, q.life / 1.5) * 0.55, rx = q.w * 0.5 * (0.7 + 0.3 * Math.min(1, (q.max - q.life) * 3)), y = W.groundY - 1;
      const g = c.createRadialGradient(q.x, y, 1, q.x, y, rx); g.addColorStop(0, rgba(core, a)); g.addColorStop(0.7, rgba(body, a * 0.8)); g.addColorStop(1, rgba(body, 0));
      c.fillStyle = g; c.beginPath(); c.ellipse(q.x, y, rx, 4.5, 0, 0, TAU); c.fill();
      c.fillStyle = rgba('#ffffff', a * 0.6); c.beginPath(); c.ellipse(q.x - rx * 0.25, y - 1.5, rx * 0.25, 1, 0, 0, TAU); c.fill();
    }
    // goo stuck on things
    for (const o of W.entities) {
      if (o.gooBy !== e || !(o.gooT > 0) || !o.alive || o.dying) continue;
      const k = Math.min(1, o.gooT), s = Math.max(0.6, Math.min(1.6, o.h / 60));
      for (let i = 0; i < 3; i++) {
        const x = o.x + (i - 1) * o.w * 0.25, y = o.bottom - 4 - (i === 1 ? o.h * 0.35 : 0), r = (5 + i % 2 * 2) * s * k;
        const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); g.addColorStop(0, rgba(SB.mixColor(body, '#ffffff', 0.3), 0.9)); g.addColorStop(1, rgba(body, 0.75));
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r * 1.2, r, 0, 0, TAU); c.fill();
        drip(c, x, y + r * 0.6, t, i + o.seed, body, '#ffffff', 0.6);
      }
    }
    // goo in flight
    for (const b of e.goos || []) {
      c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx)); const st = 1 + Math.min(0.6, Math.hypot(b.vx, b.vy) / 1600);
      const g = c.createRadialGradient(-b.r * 0.3, -b.r * 0.3, 0, 0, 0, b.r * st); g.addColorStop(0, rgba('#eaffc8', 0.95)); g.addColorStop(0.5, rgba(body, 0.9)); g.addColorStop(1, rgba(core, 0.85));
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, b.r * st, b.r / Math.sqrt(st), 0, 0, TAU); c.fill();
      c.fillStyle = rgba(body, 0.6); c.beginPath(); c.ellipse(-b.r * st * 1.3, 0, b.r * 0.5, b.r * 0.3, 0, 0, TAU); c.fill();
      c.restore();
    }
    // the jelly in front of whatever it has swallowed, so it looks inside
    if (e.engulfed && e.alive && !e.dying) {
      const P = D.slimePose(e, t, PS), K = e.def.drawK, f = e.facing || 1;
      c.save(); c.translate(e.x, e.y); c.scale(e.scale * f * K, e.scale * K);
      const pts = outline(P, 44);
      bodyPath(c, pts); c.fillStyle = rgba(SB.mixColor(body, core, 0.2), 0.42); c.fill();
      c.save(); bodyPath(c, pts); c.clip();
      for (let i = 0; i < 6; i++) { const u = ((t * 14 + i * 29) % 80) / 80, x = Math.sin(i * 3.1 + t) * 20, y = -SL.gyU - 20 - u * 70; c.strokeStyle = rgba('#ffffff', 0.5 * Math.sin(u * Math.PI)); c.lineWidth = 0.9; c.beginPath(); c.arc(x, y, 1.5 + i % 3, 0, TAU); c.stroke(); }
      c.restore();
      const hy = -SL.gyU - 78 * P.sq * P.sz, hx = -22 * P.sx;
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(hx - 4, hy - 4, 7.5 * P.sx, 3.4 * P.sx, -0.6, 0, TAU); c.fill();
      drawMouth(c, e, t, P, body, core, pal.glow, k => k, false);
      for (let i = 0; i < 3; i++) drawEye(c, e, t, P, i, body, core, k => k, false, pal.iris);
      c.restore();
    }
  };
})();
