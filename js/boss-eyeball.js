'use strict';
// boss-eyeball.js — the demon eyeball boss: drawing, definition and attacks
// A huge floating demonic eye: a veiny, bloodshot ball under heavy fleshy lids, a glowing slit-pupilled iris
// that follows its prey (and the cursor), little horns, leathery bat wings and a fringe of writhing tendrils
// with small eyes on their tips. It sweeps a red death ray from its pupil, stares creatures into a trance
// (dizzy, terrified, or fighting for it), fires eye-bolts from its tendril eyes and sends out eyeball minions.
// Lives in its own file (loaded after bosses.js, before colors.js); the 3D model is js/3d/m-eyeball.js.
(function () {
  const D = SB.D, TAU = SB.TAU;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const NAME = 'demon eyeball', DRAWK = 1.4;

  // ---------- template geometry, shared by the drawing, the 3D model and the attacks ----------
  // the ball's centre (0, cy) and radius R; the iris (radius rI) slides up to off * R from the centre as it looks
  const EY = D.EYEBALL = { cy: -14, R: 46, rI: 22, off: 0.5, K: DRAWK, N: 5, w: 176, h: 172 };
  const ks = e => e.scale * (e.def.drawK || 1);
  // where it is looking, in world directions (x right, y down), length 0..1 (1: the iris at its full offset)
  const lookOf = e => e.eyeLX != null ? [e.eyeLX, e.eyeLY] : [(e.lookX || 0) * (e.facing || 1), e.lookY || 0];
  // the pupil in game coordinates (the death ray leaves from here; the 3D model puts its pupil on the same spot)
  D.eyeballPupil = function (e) {
    const K = ks(e), a = (e.angle || 0) + (e.tilt || 0), [lx, ly] = lookOf(e), off = EY.off * EY.R * K;
    return [e.x - Math.sin(a) * EY.cy * K + lx * off, e.y + Math.cos(a) * EY.cy * K + ly * off];
  };
  // a tendril in template units (y down): [bx, by, cx, cy, tx, ty]; ax, ay (a local direction) and k bend it to aim
  D.eyeTendril = function (i, t, e, ax, ay, k, out) {
    const s = (i - (EY.N - 1) / 2) / ((EY.N - 1) / 2), ph = t * 1.7 + i * 1.37 + (e.seed || 0), A = e.ko ? 0.3 : 1;
    const bx = s * 24, by = EY.cy + EY.R * 0.8 - Math.abs(s) * 7;
    let cx = s * 32 + Math.sin(ph) * 9 * A, cy = by + 26 + Math.cos(ph * 0.9) * 4 * A;
    let tx = s * 46 + Math.sin(ph * 0.8 + 1.1) * 11 * A, ty = by + 56 - Math.abs(s) * 8 + Math.sin(ph * 1.2) * 5 * A;
    if (e.ko) { tx = s * 62; ty = by + 40; cx = s * 40; cy = by + 30; }
    if (k > 0) {
      const L = 58 - Math.abs(s) * 4, ex = bx + ax * L + s * 12, ey = by + ay * L, mx = bx + ax * L * 0.45 + s * 14, my = by + ay * L * 0.45 + 8;
      cx += (mx - cx) * k; cy += (my - cy) * k; tx += (ex - tx) * k; ty += (ey - ty) * k;
    }
    out = out || [0, 0, 0, 0, 0, 0];
    out[0] = bx; out[1] = by; out[2] = cx; out[3] = cy; out[4] = tx; out[5] = ty;
    return out;
  };
  // a world direction -> the drawing's local frame (mirrored by facing, turned by its tilt)
  const toLocal = (e, wx, wy) => { const a = (e.angle || 0) + (e.tilt || 0), ca = Math.cos(a), sa = Math.sin(a); return [(wx * ca + wy * sa) * (e.facing || 1), -wx * sa + wy * ca]; };
  // the tendrils' aim in local units: [ax, ay, k]
  D.eyeTendrilAim = function (e) {
    const k = e.tendK || 0; if (k <= 0) return [0, 1, 0];
    let [ax, ay] = toLocal(e, e.tendAX || 0, e.tendAY || 1);
    ay = Math.max(ay, -0.1); const d = Math.hypot(ax, ay) || 1;
    return [ax / d, ay / d, k];
  };
  // a tendril tip in game coordinates (where its eye-bolts come from)
  const TT = [0, 0, 0, 0, 0, 0];
  D.eyeTendrilTip = function (e, i, t) {
    const [ax, ay, k] = D.eyeTendrilAim(e); D.eyeTendril(i, t, e, ax, ay, k, TT);
    const K = ks(e), a = (e.angle || 0) + (e.tilt || 0), ca = Math.cos(a), sa = Math.sin(a), x = TT[4] * (e.facing || 1) * K, y = TT[5] * K;
    return [e.x + x * ca - y * sa, e.y + x * sa + y * ca];
  };
  // how open the lids are (0 shut .. 1.25 wide) and how wide the slit pupil is, for its mood and attack
  D.eyeballWant = function (e, t) {
    const angry = e.mood === 'angry' || e.mode === 'hunt';
    let open = e.sleeping || e.mood === 'sleep' ? 0 : angry ? 0.66 : 0.92, pup = 4.2 + Math.sin(t * 0.9 + (e.seed || 0)) * 0.6;
    if (e.stareT > 0) { open = 1.25; pup = 9; }
    if (e.rayCharge > 0) { open = 0.48; pup = 1.5; } else if (e.rayT > 0) { open = 1.05; pup = 2.6; }
    if (e.boltT > 0) open = Math.min(open, 0.6);
    if (e.eyeHurtT > 0 || e.weakT > 0) { open = Math.min(open, 0.3); pup = 2.4; }
    if (e.mood === 'dizzy') { open = Math.min(open, 0.75); pup = 6.5; }
    if (e.ko) { open = 0.5; pup = 7.5; }
    else if (!(e.stareT > 0 || e.rayT > 0 || e.rayCharge > 0) && ((e.seed || 0) * 7 + t) % 4.3 < 0.13) open = 0;
    return [open, pup];
  };
  // the look in the drawing's local frame
  const localLook = (e, t) => {
    if (e.ko) return [0.12, -1.25];
    if (e.mood === 'dizzy') return [Math.cos(t * 7) * 0.7, Math.sin(t * 7) * 0.7];
    const [wx, wy] = lookOf(e); let [x, y] = toLocal(e, wx, wy); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return [x, y];
  };

  // ---------- the veins on the white, built once (seeded), as polylines relative to the ball's centre ----------
  const VEINS = [];
  (function () {
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const grow = (a, r, n, w) => { const pts = [[Math.cos(a) * r, Math.sin(a) * r, w]]; for (let i = 0; i < n; i++) { a += (rnd() - 0.5) * 0.34; r -= EY.R * (0.06 + rnd() * 0.05); w *= 0.78; pts.push([Math.cos(a) * r, Math.sin(a) * r, w]); } return pts; };
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + (rnd() - 0.5) * 0.3, v = grow(a, EY.R * 0.99, 5 + Math.floor(rnd() * 2), 1.9);
      VEINS.push(v);
      if (rnd() < 0.7) { const b = v[2]; VEINS.push(grow(Math.atan2(b[1], b[0]) + (rnd() < 0.5 ? 0.35 : -0.35), Math.hypot(b[0], b[1]), 3, b[2] * 0.9)); }
    }
  })();

  // a small eye (tendril tips, minions): ball, glowing iris, slit pupil, a little lid; lx, ly = where it looks
  D.miniEye = function (c, x, y, r, lx, ly, irisC, white, lidC, glow, open) {
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, 0, 0, 0, r * 1.05);
    g.addColorStop(0, '#fffaf2'); g.addColorStop(0.6, white); g.addColorStop(1, SB.mixColor(white, '#5a1a1a', 0.6));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    const ix = lx * r * 0.38, iy = ly * r * 0.38;
    if (glow) { c.shadowColor = irisC; c.shadowBlur = r * 1.6 * glow; }
    c.fillStyle = irisC; c.beginPath(); c.arc(ix, iy, r * 0.56, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,220,120,0.7)'; c.beginPath(); c.arc(ix, iy, r * 0.3, 0, TAU); c.fill();
    c.fillStyle = '#080304'; c.beginPath(); c.ellipse(ix, iy, r * 0.12, r * 0.44, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(-r * 0.35, -r * 0.4, r * 0.18, 0, TAU); c.fill();
    if (lidC) {   // a heavy upper lid
      const o = open == null ? 0.8 : open, ly0 = -r + r * 1.4 * (1 - o);
      c.fillStyle = lidC; c.beginPath(); c.moveTo(-r * 1.05, 0); c.quadraticCurveTo(0, ly0 * 1.6 + r * 0.2, r * 1.05, 0); c.arc(0, 0, r * 1.06, 0, Math.PI, true); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(20,4,4,0.7)'; c.lineWidth = Math.max(0.6, r * 0.12); c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, ly0 * 1.6 + r * 0.2, r, 0); c.stroke();
    }
    c.restore();
  };

  // ---------- the drawing ----------
  D.eyeball = function () { return { w: EY.w, h: EY.h, draw(p, e, t) { D.drawEyeball(p, e, t); } }; };
  const TD = [0, 0, 0, 0, 0, 0];
  D.drawEyeball = function (p, e, t) {
    const c = p.ctx, tint = p.tint, R = EY.R, cy = EY.cy, ko = e.ko;
    const T = k => tint ? SB.mixColor(k, tint, 0.55) : k;
    const col = r => T(p.use(r).fill);
    const flesh = col('body'), wingC = col('wing'), hornC = col('horn'), irisC0 = col('iris'), veinC = col('vein'), white = col('eye'), tentC = col('tentacle'), glowC = col('eyeGlow');
    const irisC = ko ? SB.mixColor(irisC0, '#5a4a48', 0.65) : irisC0;
    const [wOpen, wPup] = D.eyeballWant(e, t);
    const open = e.lidK != null ? e.lidK : wOpen, pw = e.pupK != null ? e.pupK : wPup;
    const [lx, ly] = localLook(e, t);
    const angry = e.mood === 'angry' || e.mode === 'hunt' || e.rayT > 0 || e.rayCharge > 0;
    c.save();
    if (ko) c.rotate(-(e.angle || 0) * 0.75);   // a ball doesn't lie down: it rolls back instead
    // a red glow around it
    if (!ko) {
      const gk = 0.16 + (angry ? 0.1 : 0) + (e.rayT > 0 ? 0.2 : 0) + Math.sin(t * 2.2 + e.seed) * 0.04, gl = c.createRadialGradient(0, cy, R * 0.6, 0, cy, R * 2.1);
      gl.addColorStop(0, 'rgba(255,40,12,' + gk.toFixed(3) + ')'); gl.addColorStop(1, 'rgba(120,0,20,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(0, cy, R * 2.1, 0, TAU); c.fill();
    }
    // ---- leathery bat wings behind the ball ----
    const flying = e.flying && !e.held;
    let flap;
    if (e.held) flap = Math.sin(t * 18) * 0.9;
    else if (ko) flap = -0.9;
    else if (flying || e.flying === undefined) flap = Math.sin(t * 6 + (e.seed || 0));
    else flap = -0.4;
    const boneC = SB.shade(SB.mixColor(wingC, flesh, 0.4), 0.15), memA = SB.shade(wingC, 0.3), memB = SB.mixColor(wingC, '#b02a30', 0.35);
    const wing = side => {
      c.save(); c.translate(side * R * 0.7, cy - R * 0.32); c.scale(side * 0.82, 0.82); c.rotate(-0.12 - flap * 0.42 + (ko ? 0.9 : 0)); c.scale(1, 0.8 + flap * 0.26);
      const F = [[94, -70], [106, -34], [96, 2], [68, 20]], S = [[80, -44], [88, -12], [76, 6], [34, 16]];
      c.beginPath(); c.moveTo(-4, -8); c.quadraticCurveTo(10, -28, 26, -32); c.quadraticCurveTo(40, -44, 54, -50); c.lineTo(F[0][0], F[0][1]);
      for (let i = 1; i < 4; i++) c.quadraticCurveTo(S[i - 1][0], S[i - 1][1], F[i][0], F[i][1]);
      c.quadraticCurveTo(S[3][0], S[3][1], 0, 14); c.closePath();
      const g = c.createLinearGradient(0, 0, 100, -30); g.addColorStop(0, memA); g.addColorStop(0.55, wingC); g.addColorStop(1, memB);
      c.fillStyle = g; c.fill();
      c.strokeStyle = SB.shade(wingC, 0.55); c.lineWidth = 1; c.stroke();
      c.save(); c.globalAlpha *= 0.35; c.strokeStyle = SB.mixColor(wingC, '#ff6050', 0.3); c.lineWidth = 0.7;   // fine veins in the membrane
      for (let i = 0; i < 4; i++) { const f = F[i]; for (let j = 1; j <= 2; j++) { const u = j / 3, x = 54 + (f[0] - 54) * u, y = -50 + (f[1] + 50) * u; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 6, y + 10, x - 14 + i * 2, y + 16); c.stroke(); } }
      c.restore();
      D.cap(p, 0, 0, 26, -30, 8, 6, boneC); D.cap(p, 26, -30, 54, -50, 6, 4.5, boneC);
      for (const f of F) D.cap(p, 54, -50, f[0], f[1], 3.6, 1.4, boneC);
      p.circle(26, -30, 3.4, SB.shade(boneC, 0.1)); p.circle(54, -50, 3.2, SB.shade(boneC, 0.1));
      p.poly([52, -52, 56, -64, 60, -60, 58, -52], '#140c0a');   // thumb claw
      c.restore();
    };
    wing(-1); wing(1);
    // ---- tendrils hanging below, little eyes on their tips ----
    const [tax, tay, tk] = D.eyeTendrilAim(e);
    const tipGlow = e.boltT > 0 ? 1.6 : 0.5;
    for (let i = 0; i < EY.N; i++) {
      D.eyeTendril(i, t, e, tax, tay, tk, TD);
      const mid = D.tube(p, TD[0], TD[1], TD[2], TD[3], TD[4], TD[5], 12, 3.6, 10, i % 2 ? SB.shade(tentC, 0.12) : tentC);
      c.save(); c.strokeStyle = SB.shade(tentC, 0.5); c.lineWidth = 0.9; c.globalAlpha *= 0.6;
      for (let j = 2; j < mid.length - 1; j += 2) { const [x0, y0] = mid[j - 1], [x1, y1] = mid[j + 1], dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, w = (12 - (12 - 3.6) * j / 10) * 0.5; c.beginPath(); c.moveTo(mid[j][0] - dy / d * w, mid[j][1] + dx / d * w); c.lineTo(mid[j][0] + dy / d * w, mid[j][1] - dx / d * w); c.stroke(); }
      c.restore();
      const [ex, ey] = mid[mid.length - 2], dx = TD[4] - ex, dy = TD[5] - ey, d = Math.hypot(dx, dy) || 1;
      const elx = tk > 0 ? tax : dx / d * 0.6 + lx * 0.4, ely = tk > 0 ? tay : dy / d * 0.6 + ly * 0.4;
      D.miniEye(c, TD[4] + dx / d * 2, TD[5] + dy / d * 2, 5.6, elx, ely, irisC, white, SB.shade(tentC, 0.1), ko ? 0 : tipGlow, ko ? 0.15 : open > 0.05 ? 0.85 : 0.1);
    }
    // ---- the fleshy socket the ball sits in, and the knot the tendrils grow from ----
    p.ellipse(0, cy + R * 0.76, 27, 14, SB.shade(flesh, 0.15), 0);
    const sg = c.createRadialGradient(0, cy, R * 0.8, 0, cy, R + 7); sg.addColorStop(0, SB.shade(flesh, 0.5)); sg.addColorStop(1, SB.shade(flesh, 0.25));
    c.fillStyle = sg; c.beginPath(); c.arc(0, cy, R + 6, 0, TAU); c.fill();
    // ---- the eye itself, inside the opening of the lids ----
    const cyl = cy + R * 0.12, Lx = -R * 0.97, Rx = R * 0.97;                 // the corners of the eye
    const upPk = cy + R * 0.3 - R * 1.08 * open, loPk = cy + R * 0.3 + R * 0.44 * Math.min(1.1, open);   // lid edges at the middle
    const upC = 2 * upPk - cyl, loC = 2 * loPk - cyl;                       // quadratic control points
    const opening = () => { c.beginPath(); c.moveTo(Lx, cyl); c.quadraticCurveTo(0, upC, Rx, cyl); c.quadraticCurveTo(0, loC, Lx, cyl); c.closePath(); };
    if (open > 0.03) {
      c.save(); c.beginPath(); c.arc(0, cy, R, 0, TAU); c.clip(); opening(); c.clip();
      const blood = clamp((angry ? 0.55 : 0.3) + (e.eyeHurtT > 0 || e.weakT > 0 ? 0.4 : 0) + (ko ? 0.3 : 0), 0, 1);
      const g = c.createRadialGradient(-R * 0.25, cy - R * 0.3, 0, 0, cy, R * 1.05);
      g.addColorStop(0, SB.mixColor(white, '#ffffff', 0.5)); g.addColorStop(0.5, white); g.addColorStop(0.82, SB.mixColor(white, veinC, 0.2 + blood * 0.2)); g.addColorStop(1, SB.mixColor(white, '#4a1416', 0.6));
      c.fillStyle = g; c.fillRect(-R, cy - R, R * 2, R * 2);
      // veins creeping in from the edge (they ride along a little as the ball turns)
      const ix = lx * EY.off * R, iy = ly * EY.off * R;
      c.strokeStyle = veinC; c.lineCap = 'round'; c.globalAlpha *= 0.45 + blood * 0.45;
      for (const v of VEINS) for (let i = 1; i < v.length; i++) {
        const a = v[i - 1], b = v[i], ka = 1 - Math.hypot(a[0], a[1]) / R, kb = 1 - Math.hypot(b[0], b[1]) / R;
        c.lineWidth = a[2]; c.beginPath(); c.moveTo(a[0] + ix * ka, cy + a[1] + iy * ka); c.lineTo(b[0] + ix * kb, cy + b[1] + iy * kb); c.stroke();
      }
      c.globalAlpha /= 0.45 + blood * 0.45;
      // the iris: glowing, fibred, foreshortened as it turns toward the edge
      const rI = EY.rI, m = Math.hypot(lx, ly), fs = Math.sqrt(Math.max(0.2, 1 - (m * EY.off) * (m * EY.off))), ang = Math.atan2(ly, lx);
      c.save(); c.translate(ix, cy + iy); c.rotate(ang); c.scale(fs, 1); c.rotate(-ang);
      if (!ko) { c.shadowColor = glowC; c.shadowBlur = 16 + (e.rayCharge > 0 || e.rayT > 0 ? 22 : 0) + (e.stareT > 0 ? 14 : 0); }
      const ig = c.createRadialGradient(0, 0, 0, 0, 0, rI);
      ig.addColorStop(0, ko ? '#7a6a60' : '#fff3a0'); ig.addColorStop(0.28, ko ? '#8a6a5a' : SB.mixColor(irisC, '#ffd23f', 0.6)); ig.addColorStop(0.6, irisC); ig.addColorStop(0.88, SB.shade(irisC, 0.55)); ig.addColorStop(1, '#2a0404');
      c.fillStyle = ig; c.beginPath(); c.arc(0, 0, rI, 0, TAU); c.fill(); c.shadowBlur = 0;
      c.lineWidth = 0.9;
      for (let k = 0; k < 34; k++) {
        const a = k / 34 * TAU + Math.sin(k * 7.3) * 0.06, r0 = rI * 0.3, r1 = rI * (0.78 + 0.16 * Math.sin(k * 3.1));
        c.strokeStyle = k % 2 ? 'rgba(255,215,120,0.35)' : 'rgba(80,0,0,0.38)'; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
      }
      if (e.stareT > 0 && !ko) {   // hypnotic rings turning in the iris
        c.save(); c.strokeStyle = 'rgba(255,240,180,0.55)'; c.lineWidth = 1.4;
        for (let k = 0; k < 3; k++) { const r = ((t * 14 + k * 6) % 18) + 3; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
        c.restore();
      }
      c.strokeStyle = 'rgba(30,2,2,0.85)'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, rI - 1, 0, TAU); c.stroke();
      c.fillStyle = '#060203'; c.beginPath(); c.ellipse(0, 0, pw, rI * 0.82, 0, 0, TAU); c.fill();
      if (!ko) { c.strokeStyle = e.rayCharge > 0 ? 'rgba(255,250,220,0.95)' : 'rgba(255,190,80,0.55)'; c.lineWidth = e.rayCharge > 0 ? 2 : 1.1; c.beginPath(); c.ellipse(0, 0, pw + 0.8, rI * 0.84, 0, 0, TAU); c.stroke(); }
      if (e.rayT > 0) { c.fillStyle = 'rgba(255,240,220,0.95)'; c.beginPath(); c.ellipse(0, 0, pw * 0.6, rI * 0.5, 0, 0, TAU); c.fill(); }
      c.restore();
      // the ball's roundness over the iris, the lid's shadow, a wet shine
      const sh = c.createRadialGradient(-R * 0.15, cy - R * 0.2, R * 0.45, 0, cy, R); sh.addColorStop(0, 'rgba(40,5,5,0)'); sh.addColorStop(1, 'rgba(50,8,8,0.45)');
      c.fillStyle = sh; c.fillRect(-R, cy - R, R * 2, R * 2);
      c.strokeStyle = 'rgba(40,4,4,0.32)'; c.lineWidth = 10; c.beginPath(); c.moveTo(Lx, cyl + 5); c.quadraticCurveTo(0, upC + 5, Rx, cyl + 5); c.stroke();
      c.strokeStyle = 'rgba(40,4,4,0.45)'; c.lineWidth = 4; c.beginPath(); c.moveTo(Lx, cyl + 2); c.quadraticCurveTo(0, upC + 2.5, Rx, cyl + 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.ellipse(-R * 0.3, cy - R * 0.34, R * 0.34, R * 0.2, -0.6, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(-R * 0.36, cy - R * 0.4, 8, 4.5, -0.6, 0, TAU); c.fill();
      c.beginPath(); c.arc(-R * 0.14, cy - R * 0.5, 2.2, 0, TAU); c.fill();
      c.restore();
    }
    // ---- heavy fleshy lids ----
    const aR = Math.atan2(cyl - cy, Rx), aL = Math.PI - aR;
    const lid = upper => {
      c.beginPath(); c.moveTo(Lx, cyl); c.quadraticCurveTo(0, upper ? upC : loC, Rx, cyl); c.arc(0, cy, R + 3, aR, aL, upper); c.closePath();
    };
    const lidFill = upper => { const g = c.createRadialGradient(-R * 0.25, cy + (upper ? -R * 0.55 : R * 0.45), 0, 0, cy, R * 1.25); g.addColorStop(0, SB.mixColor(flesh, '#ffb0a0', 0.2)); g.addColorStop(0.55, flesh); g.addColorStop(1, SB.shade(flesh, 0.55)); return g; };
    for (const upper of [false, true]) {
      lid(upper); c.fillStyle = lidFill(upper); c.fill();
      c.save(); lid(upper); c.clip();   // skin creases following the lid edge
      c.strokeStyle = SB.shade(flesh, 0.5); c.globalAlpha *= 0.55; c.lineWidth = 1.6;
      for (let j = 1; j <= (upper ? 3 : 2); j++) { const o = j * (upper ? -7 : 6); c.beginPath(); c.moveTo(Lx + 5 * j, cyl + o * 0.3); c.quadraticCurveTo(0, (upper ? upC : loC) + o * 1.4, Rx - 5 * j, cyl + o * 0.3); c.stroke(); }
      c.strokeStyle = SB.mixColor(flesh, veinC, 0.5); c.lineWidth = 0.8;   // a few dark veins in the skin
      for (let j = 0; j < 3; j++) { const x = -R * 0.5 + j * R * 0.5, y = upper ? cy - R * 0.8 : cy + R * 0.82; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y + (upper ? 8 : -6), x + 2, y + (upper ? 16 : -12)); c.stroke(); }
      c.restore();
      // the thick wet rim of the lid
      c.lineCap = 'round';
      c.strokeStyle = SB.shade(flesh, 0.35); c.lineWidth = 5; c.beginPath(); c.moveTo(Lx, cyl); c.quadraticCurveTo(0, upper ? upC : loC, Rx, cyl); c.stroke();
      c.strokeStyle = T('#c4776c'); c.lineWidth = 1.8; c.beginPath(); c.moveTo(Lx + 2, cyl + (upper ? 1.5 : -1.5)); c.quadraticCurveTo(0, (upper ? upC + 3 : loC - 3), Rx - 2, cyl + (upper ? 1.5 : -1.5)); c.stroke();
      // spiky black lashes
      c.fillStyle = '#140808';
      const n = upper ? 11 : 6, ctl = upper ? upC : loC;
      for (let i = 1; i < n; i++) {
        const u = i / n, x = (1 - u) * (1 - u) * Lx + u * u * Rx, y = (1 - u) * (1 - u) * cyl + 2 * u * (1 - u) * ctl + u * u * cyl;
        const tx = 2 * (1 - u) * (0 - Lx) + 2 * u * (Rx - 0), ty = 2 * (1 - u) * (ctl - cyl) + 2 * u * (cyl - ctl), d = Math.hypot(tx, ty) || 1;
        const nx = ty / d * (upper ? 1 : -1), ny = -tx / d * (upper ? 1 : -1), L = (upper ? 8 : 5) * (0.6 + 0.4 * Math.sin(u * Math.PI)), sp = (u - 0.5) * 0.8;
        c.beginPath(); c.moveTo(x - tx / d * 1.6, y - ty / d * 1.6); c.lineTo(x + (nx + tx / d * sp) * L, y + (ny + ty / d * sp) * L); c.lineTo(x + tx / d * 1.6, y + ty / d * 1.6); c.closePath(); c.fill();
      }
    }
    // ---- little demon horns growing out of the brow ----
    for (const s of [-1, 1]) {
      const bx = s * 17, by = cy - R * 0.84;
      p.ellipse(bx, by + 2, 9, 5, SB.shade(flesh, 0.2), s * 0.3);
      const mid = D.tube(p, bx, by, s * 40, cy - R * 1.22, s * 31, cy - R * 1.6, 13, 1.4, 10, hornC);
      c.save(); c.strokeStyle = SB.shade(hornC, 0.5); c.lineWidth = 1; c.globalAlpha *= 0.7;
      for (let j = 1; j < mid.length - 2; j++) { const [x0, y0] = mid[j], [x1, y1] = mid[j + 1], dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, w = (13 - 11.6 * j / 10) * 0.48; c.beginPath(); c.moveTo(x0 - dy / d * w, y0 + dx / d * w); c.quadraticCurveTo(x0 + dx * 0.4, y0 + dy * 0.4, x0 + dy / d * w, y0 - dx / d * w); c.stroke(); }
      c.strokeStyle = 'rgba(255,240,220,0.25)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(mid[1][0] - s * 2, mid[1][1]); for (let j = 2; j < mid.length - 1; j++) c.lineTo(mid[j][0] - s * 2 * (1 - j / mid.length), mid[j][1]); c.stroke();
      c.restore();
    }
    // ---- tears when it is hurt ----
    if (e.eyeHurtT > 0 || e.weakT > 0 || ko) {
      for (let j = 0; j < 2; j++) {
        const s = j ? 1 : -1, u = (t * 1.3 + j * 0.47 + (e.seed || 0)) % 1, x = s * R * (0.62 + u * 0.12), y = cyl + 4 + u * 34;
        c.fillStyle = 'rgba(190,225,255,0.85)'; c.beginPath(); c.moveTo(x, y - 5); c.quadraticCurveTo(x + 3.2, y + 1, x, y + 3.4); c.quadraticCurveTo(x - 3.2, y + 1, x, y - 5); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(x - 0.8, y, 0.9, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(190,225,255,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s * R * 0.62, cyl + 3); c.lineTo(x, y - 4); c.stroke();
      }
    }
    c.restore();
  };

  // ---------- definition (what B() in bosses.js does: drawK scales the template, the mass and the health) ----------
  const inner = D.eyeball(), K = DRAWK;
  const PAL = { body: '#5c1c20', wing: '#2c1113', horn: '#2a1e1a', eye: '#efe5d6', iris: '#ff4a12', vein: '#b3121c', tentacle: '#5a2028', eyeGlow: '#ff3010' };
  const def = SB.def(NAME, SB.merge({
    cat: 'boss', boss: true, creature: true, move: 'walk', temper: 'hostile', bounce: 0.05, friction: 6, huntR: 760,
    tags: ['boss', 'monster', 'big', 'scary', 'villain', 'predator'], fears: [], hunts: [], eats: [], heldMood: 'angry'
  }, {
    drawK: K,
    t: { w: inner.w * K, h: inner.h * K, draw(p, e, t) { p.ctx.scale(K, K); inner.draw(p, e, t); } },
    aliases: ['demon eye', 'eyeball boss', 'giant eyeball', 'evil eye', 'eye of doom', 'eye demon', 'beholder', 'floating eye', 'giant eye', 'eyeball monster', 'eye boss', 'demon eyeball boss', 'devil eye',
      'deamon eyeball', 'deamon eye', 'demon eyball', 'demon eyebal', 'eyball', 'eyebal', 'eyeball', 'eye ball', 'giant eye ball', 'demon eye ball', 'eye', 'big eyeball', 'huge eyeball', 'eye monster',
      'evil eyeball', 'flying eyeball', 'flying eye', 'scary eyeball', 'demonic eye', 'demonic eyeball', 'monster eye', 'eyeball demon', 'eye of sauron', 'all seeing eye', 'the eye', 'creepy eye', 'creepy eyeball'],
    move: 'fly', speed: 120, mass: 60, hp: 44, jump: 300, flyMin: 0.05, flyMax: 0.38, tags: ['eye', 'eyeball', 'demon', 'winged', 'creepy', 'floating'],
    weak: ['sun', 'lamp', 'candle', 'torch', 'camera', 'angel', 'god', 'holy', 'sharp', 'stick'], special: 'eyeball', roarSfx: 'screech',
    hunts: ['human', 'hero', 'animal', 'monster', 'vehicle'], eats: [],
    say: ['*stares*', 'I see you...', 'I see EVERYTHING.', '*blink... blink*', 'Look into my eye...', '*squelch*'], roar: ['SKREEEE!', '*GLARE*', 'BEHOLD!', 'LOOK AT ME!'],
    weakSay: ['AAARGH! My EYE!', 'Too BRIGHT!', 'Don\'t poke me!', 'It\'s in my eye! IT\'S IN MY EYE!', '*blinks furiously*'],
    power: 'A giant floating demon eye. Sweeps a red DEATH RAY from its pupil, stares creatures into a trance (they get dizzy, run away in terror, or even fight for it), fires eye-bolts from the little eyes on its tendrils and sends out a flock of eyeball minions.', weakText: 'bright light (a camera flash, lamps, candles, torches, the sun, angels) and sharp pokes (swords, sticks, pencils). Click its minions to pop them!',
    hint: 'The demon eyeball fires a death ray and hypnotizes! Weak to bright light and pokes in the eye.',
    onHurt(e, W) { e.eyeHurtT = 0.9; W.burst('drop', e.x, e.y, 4, 120, { size: 4, g: 600, life: 0.6 }); if (Math.random() < 0.35) e.say(pick(['OW! My eye!', 'SKREE!', '*squint*'])); }
  }));
  def.mass = Math.round(60 * K * K * 0.8); def.hp = Math.round(44 * (1 + (K - 1) * 0.6));
  // palette: colors.js gives every def its palette after this file runs; merge this one's own colours over whatever it sets
  let pal = Object.assign({}, PAL);
  Object.defineProperty(def, 'pal', { enumerable: true, configurable: true, get: () => pal, set: v => { pal = Object.assign({}, v, PAL); } });
  SB.BOSSES.push(NAME);

  // ---------- attacks ----------
  const S = SB.SPECIALS = SB.SPECIALS || {};
  const ready = e => !(e.ko || e.held || e.dizzy > 0 || e.sleeping || e.spawnT < 1 || e.frozenT > 0 || e.webT > 0);
  const foeOf = (e, o) => o !== e && o.alive && !o.dying && !o.static && !o.held && !o.invisible && !SB.kin(e, o);
  const RAY_T = 1.5, CHARGE_T = 0.75;
  S.eyeball = function (e, dt, W) {
    hooks(W);
    const t = W.time;
    e.eyelets = e.eyelets || []; e.bolts = e.bolts || [];
    if (e.eyeHurtT > 0) e.eyeHurtT -= dt;
    if (e.summonCd == null) { e.summonCd = 5; e.specT = Math.max(e.specT, 1.5); }
    e.summonCd -= dt;
    look(e, dt, W);
    const [wo, wp] = D.eyeballWant(e, t);
    e.lidK = e.lidK == null ? wo : e.lidK + (wo - e.lidK) * Math.min(1, dt * 18);
    e.pupK = e.pupK == null ? wp : e.pupK + (wp - e.pupK) * Math.min(1, dt * 8);
    e.tendK = Math.max(0, (e.tendK || 0) + (e.boltT > 0 ? dt * 5 : -dt * 2)); if (e.tendK > 1) e.tendK = 1;
    boltsTick(e, dt, W); minionsTick(e, dt, W); hypnoTick(e, dt, W);
    if (e.ko || !e.alive) {
      e.rayT = e.rayCharge = e.stareT = e.boltT = 0;
      for (const m of e.eyelets) if (!m.dead) { m.dead = true; m.life = 0.8; m.vy = -100; }
      return;
    }
    if ((e.lightT = (e.lightT || 0) - dt) <= 0) { e.lightT = 0.1; lightCheck(e, W); }
    e.specT -= dt;
    if (e.stareT > 0) { e.stareT -= dt; stareTick(e, dt, W); }
    if (e.rayCharge > 0) { hold(e, dt, W); chargeTick(e, dt, W); return; }
    if (e.rayT > 0) { hold(e, dt, W); rayTick(e, dt, W); return; }
    if (e.stareT > 0) { hold(e, dt, W); return; }
    if (e.boltT > 0) { hold(e, dt, W); const was = e.boltT; e.boltT -= dt; if (was > 0.25 && e.boltT <= 0.25) fireBolts(e, W); return; }
    if (!ready(e)) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying && !tg.ko)) { if (e.specT <= 0) e.specT = 0.3; return; }
    const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy);
    // hover off to one side of its prey, low enough to be hit back, drifting slowly so things can catch it
    if (e.flying && !e.controlled) {
      const hy = clamp(tg.y - e.h * 0.5 - 20 * e.scale, W.groundY * 0.08 + e.h / 2, W.groundY - e.h / 2 - 20);
      const hx = tg.x + (dx >= 0 ? -1 : 1) * 230 * e.scale, kk = Math.min(1, dt * 5);
      e.vy += (clamp((hy - e.y) * 2, -260, 260) + Math.sin(t * 1.9 + e.seed) * 30 - e.vy) * kk;
      e.vx += (clamp((hx - e.x) * 1.4, -95, 95) - e.vx) * kk * 0.6;
      e.facing = dx >= 0 ? 1 : -1;
    }
    if (e.specT > 0) return;
    let near = 0; for (const o of W.entities) if (o.creature && !o.ko && foeOf(e, o) && Math.hypot(o.x - e.x, o.y - e.y) < 420 * e.scale) near++;
    const live = e.eyelets.filter(m => !m.dead).length;
    if (live < 2 && e.summonCd <= 0) summon(e, W);
    else if (near >= 2 && e.lastAtk !== 'stare' && Math.random() < 0.45) startStare(e, W);
    else if (d < 720 * e.scale && (e.lastAtk !== 'ray' || Math.random() < 0.35)) startRay(e, tg, W);
    else if (d < 700 * e.scale) startBolts(e, tg, W);
    else e.specT = 0.4;
  };
  // hang in the air while attacking
  function hold(e, dt, W) { const k = Math.min(1, dt * 4); e.vx -= e.vx * k; e.vy += (Math.sin(W.time * 1.9 + e.seed) * 20 - e.vy) * k; }
  // where the eye looks: along its ray, at its prey, at the cursor, or ahead
  function look(e, dt, W) {
    if (e.rayT > 0 || e.rayCharge > 0) { const a = e.rayAng; e.eyeLX = Math.cos(a); e.eyeLY = Math.sin(a); return; }
    let tx = null, ty = null;
    const tg = e.target, cur = W.cursor;
    if (tg && tg.alive && !tg.dying) { tx = tg.x; ty = tg.y - tg.h * 0.1; }
    else if (cur && cur.in && Math.hypot(cur.x - e.x, cur.y - e.y) < 800) { tx = cur.x; ty = cur.y; }
    let wx, wy;
    if (tx == null) { wx = e.facing * 0.55; wy = 0.25; }
    else { const K = ks(e), cyw = e.y + EY.cy * K, dx = tx - e.x, dy = ty - cyw, d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / (130 * K)); wx = dx / d * m; wy = dy / d * m; }
    const k = Math.min(1, dt * 9);
    e.eyeLX = (e.eyeLX || 0) + (wx - (e.eyeLX || 0)) * k; e.eyeLY = (e.eyeLY || 0) + (wy - (e.eyeLY || 0)) * k;
  }
  // a camera flash or the sun nearby blinds it
  function lightCheck(e, W) {
    if (e.weakT > 0) return;
    for (const o of W.entities) {
      if (!o.alive || o.dying) continue;
      const n = o.def.name, d = Math.hypot(o.x - e.x, o.y - e.y);
      if ((n === 'camera' && o.flash > 0.8 && d < 560) || (n === 'sun' && d < 300)) { W.weaken(e, o); e.say(n === 'camera' ? 'AAARGH! The FLASH!' : 'The SUN! It BURNS my eye!'); e.eyeHurtT = 1.5; return; }
    }
  }

  // death ray: the pupil shrinks to a pinpoint, then a red beam sweeps across its prey
  function startRay(e, tg, W) {
    const [px, py] = D.eyeballPupil(e), a0 = Math.atan2(tg.y - py, tg.x - px), dir = Math.random() < 0.5 ? -1 : 1;
    e.rayFrom = a0 - dir * 0.42; e.rayTo = a0 + dir * 0.42; e.rayAng = e.rayFrom;
    e.rayCharge = CHARGE_T; e.specT = CHARGE_T + RAY_T + 1.6; e.lastAtk = 'ray'; e.rayId = (e.rayId || 0) + 1; e.facing = tg.x >= e.x ? 1 : -1;
    W.sfx('charge', e.x); e.say(pick(['*GLARE*', 'LOOK AT ME!', 'DEATH RAY!', 'I SEE YOU!']));
  }
  function chargeTick(e, dt, W) {
    e.rayCharge -= dt;
    const [px, py] = D.eyeballPupil(e);
    if (Math.random() < dt * 40) { const a = Math.random() * TAU, r = 50 + Math.random() * 40; W.particle('spark', px + Math.cos(a) * r, py + Math.sin(a) * r, { vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, life: 0.22, size: 6, col: '#ff3b1f' }); }
    if (e.rayCharge <= 0) { e.rayCharge = 0; e.rayT = RAY_T; W.sfx('laser', e.x); W.sfx('zap', e.x, 0.6); W.flash = 0.2; W.shake(7); }
  }
  function rayTick(e, dt, W) {
    e.rayT -= dt;
    const u = clamp(1 - e.rayT / RAY_T, 0, 1), s = u * u * (3 - 2 * u);
    e.rayAng = e.rayFrom + (e.rayTo - e.rayFrom) * s;
    e.eyeLX = Math.cos(e.rayAng); e.eyeLY = Math.sin(e.rayAng);
    const [px, py] = D.eyeballPupil(e), ax = e.eyeLX, ay = e.eyeLY;
    let L = 720 * e.scale, ground = false;
    if (ay > 0.01) { const lg = (W.groundY - py) / ay; if (lg < L) { L = Math.max(0, lg); ground = true; } }
    e.rayEnd = [px + ax * L, py + ay * L]; e.rayGround = ground;
    const R0 = 18 * e.scale;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || o.static || SB.kin(e, o)) continue;
      const qx = o.x - px, qy = o.y - py, sp = qx * ax + qy * ay;
      if (sp < 0 || sp > L) continue;
      if (Math.abs(qx * ay - qy * ax) > R0 + Math.max(o.w, o.h) * 0.35) continue;
      if (!o.creature) { W.burn(o, e, dt); if (o.special === 'bomb') o.fuse = Math.min(o.fuse, 0.1); }
      if (o.rayHit === e.rayId) continue;
      o.rayHit = e.rayId;
      const m = Math.min(1, 6 / Math.sqrt(o.mass));
      o.vx += ax * 420 * m; o.vy -= 300 * m; o.grounded = false; o.angVel += (Math.random() - 0.5) * 10;
      if (o.creature) { W.hurt(o, 2, e, { quiet: true }); o.say(pick(['ZAP!', 'AAAH!', 'Yeow!', 'My eyes!'])); o.dizzy = Math.max(o.dizzy, 1); }
      W.burst('spark', o.x, o.y, 9, 220, { size: 7, col: '#ff3b1f' }); W.popText(o.x, o.top - 20, 'ZZZAP!', 22); W.shake(5);
    }
    if (ground && Math.random() < dt * 30) W.particle('spark', e.rayEnd[0], W.groundY - 2, { vx: (Math.random() - 0.5) * 300, vy: -150 - Math.random() * 200, g: 900, life: 0.4, size: 6, col: '#ff6a1a' });
    if (ground && Math.random() < dt * 8) W.particle('smoke', e.rayEnd[0], W.groundY - 6, { vy: -50, life: 0.9, size: 7 });
    if (e.rayT <= 0) { e.rayT = 0; e.rayEnd = null; }
  }

  // hypnotic stare: pulsing rings; everything nearby falls under its spell
  function startStare(e, W) {
    e.stareT = 2.0; e.stareHit = false; e.specT = 3.6; e.lastAtk = 'stare';
    W.sfx('charge', e.x, 0.7); W.sfx('screech', e.x, 0.4); e.say(pick(['Look into my eye...', 'You are getting sleepy...', 'Obey me...', 'Look... deeper...']));
  }
  function stareTick(e, dt, W) {
    if (e.stareHit || e.stareT > 1.1) return;
    e.stareHit = true; W.sfx('zap', e.x, 0.5);
    const R = 420 * e.scale, vic = [];
    for (const o of W.entities) if (o.creature && !o.ko && foeOf(e, o) && Math.hypot(o.x - e.x, o.y - e.y) < R) vic.push(o);
    let charmed = 0;
    for (const o of vic) {
      o.hypnoT = 3.2; o.hypnoBy = e;
      if (o.def.boss) { o.hypnoMode = 'dizzy'; o.dizzy = Math.max(o.dizzy, 1); continue; }
      const others = vic.filter(x => x !== o);
      const r = Math.random();
      if (!charmed && others.length && r < 0.35) {
        charmed++; o.hypnoMode = 'charm'; o.hypnoT = 5; o.charmFoe = others[Math.floor(Math.random() * others.length)];
        o.say(pick(['Yes... master...', 'I obey...', '*blank stare*'])); W.popText(o.x, o.top - 24, 'Hypnotized!', 18);
      } else if (r < 0.7) {
        o.hypnoMode = 'dizzy'; o.dizzy = Math.max(o.dizzy, 2.5); o.say(pick(['@_@', 'So... sleepy...', 'Ooooh... swirly...']));
      } else {
        o.hypnoMode = 'flee'; o.setMood('scared', 3); o.fleeT = 3; o.fleeFrom = e; o.say(pick(['AAAH! The EYE!', 'Don\'t look at me!', 'RUN!']));
      }
    }
  }
  function hypnoTick(e, dt, W) {
    for (const o of W.entities) {
      if (o.hypnoBy !== e) continue;
      o.hypnoT -= dt;
      if (o.hypnoT <= 0 || !o.alive || o.ko || e.ko) { o.hypnoBy = null; o.hypnoT = 0; if (o.hypnoMode === 'charm' && o.alive) { o.target = null; o.attacker = null; o.scanT = 0; o.say('Huh? What happened?'); } o.hypnoMode = null; continue; }
      if (o.hypnoMode === 'charm') {   // fights for the eye: it won't touch the eye and goes after one of its friends
        let f = o.charmFoe;
        if (!f || !f.alive || f.dying || f.ko) { f = null; let bd = 600; for (const x of W.entities) if (x !== o && x.creature && !x.ko && foeOf(e, x) && x.hypnoMode !== 'charm') { const d = Math.hypot(x.x - o.x, x.y - o.y); if (d < bd) { bd = d; f = x; } } o.charmFoe = f; }
        if (!f) { o.hypnoT = 0; continue; }
        o.victim = e; o.victimT = Math.max(o.victimT, 0.5); o.attacker = f; o.target = f; o.scanT = 0.5; o.threat = null; o.setMood('angry', 0.3);
      } else if (o.hypnoMode === 'flee') { o.fleeT = Math.max(o.fleeT, 0.3); o.fleeFrom = e; }
    }
  }

  // eye-bolts from the little eyes on its tendrils
  function startBolts(e, tg, W) {
    e.boltT = 0.75; e.specT = 2.4; e.lastAtk = 'bolts'; e.boltAim = tg; e.facing = tg.x >= e.x ? 1 : -1;
    const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1; e.tendAX = dx / d; e.tendAY = dy / d;
    W.sfx('hiss', e.x, 0.6); e.say(pick(['*all eyes on you*', 'SKREE!', 'Eyes, FIRE!']));
  }
  function fireBolts(e, W) {
    const tg = e.boltAim; e.boltAim = null;
    const live = tg && tg.alive && !tg.dying, tx = live ? tg.x + tg.vx * 0.3 : e.x + e.facing * 300, ty = live ? tg.y : W.groundY - 30;
    for (let i = 0; i < EY.N; i++) {
      const [x, y] = D.eyeTendrilTip(e, i, W.time), sp = 560 * Math.sqrt(e.scale), ox = (i - 2) * 26 * e.scale;
      const dx = tx + ox - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      shoot(e, x, y, dx / d * sp, dy / d * sp, 6.5 * e.scale);
      W.burst('spark', x, y, 3, 90, { size: 4, col: '#ff3b1f' });
    }
    W.sfx('zap', e.x); W.sfx('laser', e.x, 0.35); W.shake(3);
  }
  function shoot(e, x, y, vx, vy, r) { if (e.bolts.length < 40) e.bolts.push({ x, y, vx, vy, r, life: 1.8, seed: Math.random() * 10 }); }
  function boltsTick(e, dt, W) {
    const B = e.bolts;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let hit = b.life <= 0 || b.x < -50 || b.x > W.W + 50;
      if (!hit && b.y > W.groundY - 3) { hit = true; W.burst('spark', b.x, W.groundY - 3, 5, 140, { size: 5, col: '#ff6a1a' }); }
      if (!hit) for (const o of W.entities) {
        if (!o.creature || o.ko || !foeOf(e, o)) continue;
        if (Math.abs(o.x - b.x) > o.w * 0.4 + b.r || Math.abs(o.y - b.y) > o.h * 0.4 + b.r) continue;
        const m = Math.min(1, 4 / Math.sqrt(o.mass));
        W.hurt(o, 1, e, { quiet: true }); o.vx += b.vx * 0.3 * m; o.vy -= 140 * m; o.grounded = false;
        if (Math.random() < 0.4) o.say(pick(['Ow!', 'Zap!', 'Yikes!']));
        W.burst('spark', b.x, b.y, 6, 160, { size: 5, col: '#ff3b1f' }); W.sfx('zap', b.x, 0.3);
        hit = true; break;
      }
      if (hit) B.splice(i, 1);
    }
  }

  // eyeball minions: little winged eyes that circle it, swoop to bite and spit tiny bolts
  function summon(e, W) {
    e.summonCd = 16; e.specT = 1.4; e.lastAtk = 'summon';
    const n = Math.min(3, 6 - e.eyelets.filter(m => !m.dead).length);
    for (let i = 0; i < n; i++) e.eyelets.push({ x: e.x, y: e.y + EY.cy * ks(e), vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 200, seed: Math.random() * 100, ang: Math.random() * TAU, r: 120 + Math.random() * 50, shotT: 1.5 + Math.random() * 2, dartT: 0, dead: false, life: 24, lx: 0, ly: 0.3 });
    W.sfx('screech', e.x, 0.6); W.sfx('spawn', e.x, 0.5); W.burst('spark', e.x, e.y, 8, 160, { size: 5, col: '#ff3b1f' });
    e.say(pick(['Go, my little eyes!', 'Watch them... my children!', '*more eyes open*'])); W.popText(e.x, e.top - 30, 'Eyeball minions!', 18);
  }
  function minionsTick(e, dt, W) {
    const M = e.eyelets, tg = e.target, live = tg && tg.alive && !tg.dying && !tg.ko, K = e.scale;
    for (let i = M.length - 1; i >= 0; i--) {
      const m = M[i];
      if (m.dead) { m.life -= dt; m.vy += 900 * dt; m.x += m.vx * dt; m.y += m.vy * dt; if (m.life <= 0 || m.y > W.groundY) { if (m.y > W.groundY) W.burst('drop', m.x, W.groundY - 4, 4, 100, { size: 4, g: 600 }); M.splice(i, 1); } continue; }
      m.life -= dt; m.shotT -= dt;
      if (m.life <= 0) { pop(e, m, W); continue; }
      let gx, gy;
      if (m.dartT > 0 && live) {
        m.dartT -= dt; gx = tg.x; gy = tg.y;
        if (Math.abs(tg.x - m.x) < tg.w * 0.4 + 10 && Math.abs(tg.y - m.y) < tg.h * 0.4 + 10) {
          W.hurt(tg, 1, e, { quiet: true }); tg.vx += m.vx * 0.2; tg.vy -= 100; tg.grounded = false; W.sfx('hit', m.x, 0.4); W.popText(m.x, m.y - 14, 'Chomp!', 16);
          m.dartT = 0; m.vx = -m.vx * 0.8; m.vy = -300;
        }
      } else {
        m.ang += dt * (1 + (m.seed % 0.5)); gx = e.x + Math.cos(m.ang) * m.r * K; gy = e.y + EY.cy * ks(e) + Math.sin(m.ang) * m.r * 0.55 * K;
        if (live && m.shotT <= 0 && !e.ko) {
          m.shotT = 2.2 + Math.random() * 1.6;
          const dx = tg.x - m.x, dy = tg.y - m.y, d = Math.hypot(dx, dy) || 1;
          if (d < 560 && Math.random() < 0.35) m.dartT = 1.1;
          else if (d < 640) { shoot(e, m.x, m.y, dx / d * 480, dy / d * 480, 4 * K); W.sfx('zap', m.x, 0.25); }
        }
      }
      const k = Math.min(1, dt * 3), spd = m.dartT > 0 ? 6 : 3;
      m.vx += ((gx - m.x) * spd - m.vx) * k; m.vy += ((gy - m.y) * spd + Math.sin(W.time * 5 + m.seed) * 40 - m.vy) * k;
      const v = Math.hypot(m.vx, m.vy), mx = m.dartT > 0 ? 700 : 420; if (v > mx) { m.vx *= mx / v; m.vy *= mx / v; }
      m.x += m.vx * dt; m.y = Math.min(W.groundY - 14, m.y + m.vy * dt);
      // looks at the prey (or at the cursor)
      const cur = W.cursor, lt = live ? tg : cur && cur.in ? cur : null;
      let lx = m.vx >= 0 ? 0.5 : -0.5, ly = 0.2;
      if (lt) { const dx = lt.x - m.x, dy = lt.y - m.y, d = Math.hypot(dx, dy) || 1; lx = dx / d; ly = dy / d; }
      m.lx += (lx - m.lx) * Math.min(1, dt * 8); m.ly += (ly - m.ly) * Math.min(1, dt * 8);
    }
  }
  function pop(e, m, W) {
    m.dead = true; m.life = 0.7; m.vy = -160; m.vx *= 0.3;
    W.burst('drop', m.x, m.y, 6, 150, { size: 4, g: 600, life: 0.6 }); W.burst('spark', m.x, m.y, 5, 120, { size: 4, col: '#ff3b1f' }); W.sfx('pop', m.x); W.popText(m.x, m.y - 16, 'Pop!', 16);
  }
  // click the minions to pop them
  const swat0 = SB.swat;
  SB.swat = function (x, y) {
    const W = SB.world;
    if (W) for (const e of W.entities) if (e.eyelets && e.alive) for (const m of e.eyelets) if (!m.dead && Math.hypot(m.x - x, m.y - y) < 26 * Math.max(1, e.scale)) { pop(e, m, W); return true; }
    return swat0 ? swat0(x, y) : false;
  };

  // hooks into the world (installed once): in control mode E fires its attack at whatever is in front
  function hooks(W) {
    if (!W || W.eyeballHooked || !W.ctrlSpecial) return;
    W.eyeballHooked = true;
    const ctrlSpecial = W.ctrlSpecial;
    W.ctrlSpecial = function () {
      const e = W.ctrl && W.ctrl.e;
      if (!e || e.special !== 'eyeball') return ctrlSpecial.call(W);
      if (e.ko || e.dying || W.ctrl.atkCd > 0) return;
      W.ctrl.atkCd = 0.6;
      let best = null, bd = Infinity;
      for (const o of W.entities) {
        if (o === e || !o.alive || o.dying || !o.creature || o.ko || o.held) continue;
        const dx = (o.x - e.x) * e.facing; if (dx < -o.w * 0.3 || dx > 900) continue;
        const dd = Math.abs(dx) + Math.abs(o.y - e.y) * 0.5; if (dd < bd) { bd = dd; best = o; }
      }
      if (!best) { e.say('Nothing to look at!'); return; }
      e.target = best; e.ctrlTargetT = 2; e.facing = best.x >= e.x ? 1 : -1; e.specT = 0;
    };
  }
  window.addEventListener('DOMContentLoaded', () => hooks(SB.world));

  // ---------- drawn over the world: the ray, the bolts, the minions, the hypnotic rings ----------
  // (in 3D the model draws the ray, bolts and minions itself; the rings and trance spirals stay on the 2D layer)
  def.drawWorld = function (p, c, e, t) {
    const W = SB.world, three = W.mode3d && e._m3;
    for (const o of W.entities) if (o.hypnoBy === e && o.alive && !o.dying) {   // spirals over the hypnotised
      const x = o.x, y = o.top - 16, a0 = t * 6;
      c.save(); c.strokeStyle = o.hypnoMode === 'charm' ? '#e0243a' : '#b04ae0'; c.lineWidth = 2.2; c.beginPath();
      for (let i = 0; i <= 30; i++) { const u = i / 30, a = a0 + u * TAU * 2.2, r = u * 10; if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); else c.moveTo(x, y); }
      c.stroke(); c.restore();
    }
    if (e.stareT > 0 && !e.ko) {
      const [px, py] = D.eyeballPupil(e);
      c.save();
      for (let k = 0; k < 4; k++) { const u = (((W.time * 1.4 + k * 0.25) % 1) + 1) % 1, r = 20 + u * 420 * e.scale; c.globalAlpha = (1 - u) * 0.55; c.strokeStyle = k % 2 ? '#b04ae0' : '#ff3b1f'; c.lineWidth = 5 * (1 - u) + 1; c.beginPath(); c.arc(px, py, r, 0, TAU); c.stroke(); }
      c.restore();
    }
    if (three) return;
    const pal = e.pal || e.def.pal;
    for (const m of e.eyelets || []) {
      const al = m.dead ? Math.max(0, m.life / 0.7) : 1, s = Math.max(1, e.scale), fl = Math.sin(t * 30 + m.seed * 7);
      c.save(); c.globalAlpha *= al; c.translate(m.x, m.y); if (m.dead) c.rotate(t * 8);
      for (const sd of [-1, 1]) {   // little bat wings
        c.save(); c.scale(sd * s, s); c.rotate(-0.3 - fl * 0.5);
        c.fillStyle = pal.wing; c.beginPath(); c.moveTo(4, -2); c.lineTo(14, -10); c.lineTo(22, -4); c.quadraticCurveTo(17, -2, 18, 3); c.quadraticCurveTo(12, 0, 9, 5); c.closePath(); c.fill(); c.restore();
      }
      c.scale(s, s);
      D.miniEye(c, 0, 0, 9, m.dead ? 0 : m.lx, m.dead ? -1 : m.ly, pal.iris, pal.eye, pal.body, m.dead ? 0 : 0.9, m.dead ? 0.2 : 0.75);
      c.restore();
    }
    for (const b of e.bolts || []) {
      const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.4);
      g.addColorStop(0, 'rgba(255,245,220,1)'); g.addColorStop(0.3, 'rgba(255,70,30,0.95)'); g.addColorStop(1, 'rgba(200,0,20,0)');
      c.save(); c.strokeStyle = 'rgba(255,50,20,0.45)'; c.lineWidth = b.r * 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 0.05, b.y - b.vy * 0.05); c.stroke();
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r * 2.4, 0, TAU); c.fill(); c.restore();
    }
    if (e.rayT > 0 && e.rayEnd && !e.ko) {
      const [px, py] = D.eyeballPupil(e), [qx, qy] = e.rayEnd, fl = 0.85 + Math.sin(t * 60) * 0.15, s = e.scale;
      c.save(); c.lineCap = 'round';
      c.strokeStyle = 'rgba(255,30,20,' + (0.28 * fl).toFixed(3) + ')'; c.lineWidth = 30 * s; c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.stroke();
      c.strokeStyle = 'rgba(255,50,25,0.85)'; c.lineWidth = 13 * s * fl; c.stroke();
      c.strokeStyle = 'rgba(255,235,210,0.95)'; c.lineWidth = 4.5 * s; c.stroke();
      const g = c.createRadialGradient(qx, qy, 0, qx, qy, 34 * s); g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(0.4, 'rgba(255,60,20,0.7)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(qx, qy, 34 * s, 0, TAU); c.fill();
      c.restore();
    }
  };
})();
