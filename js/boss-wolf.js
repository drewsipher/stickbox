'use strict';
// boss-wolf.js — the giant wolf boss: drawing, definition and attacks
// A colossal, shaggy black wolf: a deep chest under raised hackles, long digitigrade legs with big claws, a long
// scarred muzzle full of dripping fangs, glowing yellow slit eyes and a thick bushy tail. It pounces from range and
// bites, rears up to maul with its claws, sprints down anything that runs, and HOWLS: everything nearby flees in
// terror and its pack of ordinary wolves comes running to fight for it.
// Lives in its own file (loaded after bosses.js, before colors.js); the 3D model is js/3d/m-wolf.js. Both draw
// the same skeleton (D.wolfPose), so the 2D painting, the 3D model and the attacks always agree.
(function () {
  const D = SB.D, TAU = SB.TAU;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const NAME = 'giant wolf', DRAWK = 1.35, G = 88;   // G: the ground line (paw soles) in template units
  const ks = e => e.scale * (e.def.drawK || 1);

  // ---------- the skeleton (template units, x forward, y down, origin at the box centre) ----------
  // The torso is rigid and pivots at the hip joint; shoulder, neck base and tail root are fixed on it.
  const HIP = [-70, -22];
  const TS = [118, 10], TN = [128, -16], TT = [-20, -14];   // torso-local: shoulder joint, neck base, tail root
  const FL = [40, 40, 22], HL = [46, 44, 30];               // fore: humerus, forearm, metacarpus; hind: femur, tibia, metatarsus
  // draw order: far hind, far fore, near hind, near fore
  const LEGS = [{ fore: false, near: false }, { fore: true, near: false }, { fore: false, near: true }, { fore: true, near: true }];
  const GALLOP = [0, 0.56, 0.1, 0.66], TROT = [0.5, 0, 0, 0.5];   // where in its stride each leg is
  const NECK = [30, -17];                                    // neck base -> head pivot at rest
  const HS = 1.12;                                           // the head is drawn this much bigger than its working units
  D.WOLF = { G, HIP, TS, TN, TT, FL, HL, K: DRAWK, HS, mouth: [68, 5] };

  // two-bone IK: the joint between a (root) and b (end) for bone lengths L1, L2; bend +1 puts it behind (elbow), -1 in front (stifle)
  function ik(ax, ay, bx, by, L1, L2, bend, out) {
    const dx = bx - ax, dy = by - ay; let d = Math.hypot(dx, dy) || 1e-6;
    const kk = d > (L1 + L2) * 0.995 ? d / ((L1 + L2) * 0.995) : 1; L1 *= kk; L2 *= kk;   // stretch a touch rather than snap
    const ux = dx / d, uy = dy / d; d = Math.max(d, Math.abs(L1 - L2) + 1e-3);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    out[0] = ax + ux * a - uy * h * bend; out[1] = ay + uy * a + ux * h * bend;
  }
  // a paw's offset from its rest spot over one stride: planted (sliding back) for `duty` of it, then an arcing swing
  function stride(u, duty, len, lift, out) {
    if (u < duty) { out[0] = len * (0.5 - u / duty); out[1] = 0; }
    else { const s = (u - duty) / (1 - duty), q = s * s * (3 - 2 * s); out[0] = len * (q - 0.5); out[1] = -Math.sin(s * Math.PI) * lift; }
  }
  const mkPose = () => ({
    hip: [0, 0], S: [0, 0], N: [0, 0], HP: [0, 0], TR: [0, 0], pitch: 0, headRot: 0, jaw: 0, ear: 0, hackle: 0, snarl: 0, sit: 0, lie: 0, leap: 0, tongue: 0,
    legs: LEGS.map(l => ({ fore: l.fore, near: l.near, r: [0, 0], a: [0, 0], b: [0, 0], p: [0, 0], pa: 0, lift: 0 })),
    tail: [[0, 0], [0, 0], [0, 0], [0, 0]], tailZ: 0, t: -1
  });
  const FD = [0, 0], A2 = [0, 0];
  // where everything is this frame. Smoothed per entity (e._wp), cheap enough to call from the drawing, the 3D
  // model and the attacks; calling it twice in one frame changes nothing.
  D.wolfPose = function (e, t) {
    const P = e._wpo || (e._wpo = mkPose());
    const s = e._wp || (e._wp = { t: -1, sit: 0, crouch: 0, rear: 0, leap: 0, up: 0, down: 0, snarl: 0, ear: 0, hackle: 0.4, tailA: 2.25, tailB: -0.2, lie: 0, jaw: 0, walk: 0, ko: 0 });
    let dt = t - s.t; const first = s.t < 0; if (!(dt >= 0) || dt > 0.1) dt = first ? 1 : 0.05;
    if (P.t === t && !first) return P;
    s.t = t; P.t = t;
    const kk = r => Math.min(1, dt * r);
    const held = !!e.held, ko = !!e.ko, mood = e.mood;
    const howl = e.howlT > 0, maul = e.maulT > 0, pph = e.pouncePh || '', sprint = e.chargeT > 0, hurt = e.hurtT > 0;
    const air = e.grounded === false && !held && !ko && !e.flying;
    const scared = mood === 'scared', angry = mood === 'angry' || e.mode === 'hunt';
    const sleep = (e.sleeping || mood === 'sleep') && !held && !ko;
    const wspd = Math.abs(e.vx || 0), sc = Math.max(0.3, (e.scale || 1) * (e.def.drawK || DRAWK));
    const walking = !!e.moving && e.grounded !== false && !held && !ko && !howl && !maul && pph !== 'crouch' && pph !== 'land' && !sleep;
    const gallop = walking && (sprint || wspd > 200);
    const hel = howl ? (e.howlDur || 2) - e.howlT : 0;
    // ---- smoothed pose targets ----
    s.sit += ((howl ? Math.min(sm(0, 0.3, hel), sm(0, 0.28, e.howlT)) : 0) - s.sit) * kk(14);
    s.crouch += ((pph === 'crouch' ? 1 : pph === 'land' ? 0.55 : scared && !held ? 0.4 : 0) - s.crouch) * kk(12);
    s.rear += ((maul ? 1 : 0) - s.rear) * kk(12);
    s.leap += ((air ? 1 : 0) - s.leap) * kk(12);
    s.lie += ((sleep ? 1 : 0) - s.lie) * kk(3);
    s.ko += ((ko ? 1 : 0) - s.ko) * kk(6);
    s.walk += ((walking ? clamp(wspd / 120, 0.3, 1) : 0) - s.walk) * kk(8);
    s.up += ((howl ? 1 : 0) - s.up) * kk(8);
    s.down += ((sprint ? 0.32 : pph === 'crouch' ? 0.38 : maul ? 0.3 : hurt ? -0.3 : angry && !howl ? 0.24 : scared ? 0.2 : 0) - s.down) * kk(10);
    s.ear += ((hurt || scared || sprint || pph === 'air' || ko || held ? 1 : howl ? 0.3 : 0) - s.ear) * kk(12);
    s.hackle += ((angry || maul || pph || howl || sprint ? 1 : 0.35) - s.hackle) * kk(5);
    s.snarl += (((angry || maul || pph === 'crouch' || held) && !howl && !ko ? 1 : 0) - s.snarl) * kk(8);
    const tA = ko ? 2.55 : scared || hurt ? 1.4 : howl ? 1.95 : sprint || pph === 'air' ? 3.0 : angry ? 2.75 : 2.25;
    const tB = ko ? -0.05 : scared || hurt ? -0.38 : howl ? -0.25 : sprint || pph === 'air' ? 0.04 : angry ? 0.06 : -0.22;
    s.tailA += (tA - s.tailA) * kk(6); s.tailB += (tB - s.tailB) * kk(6);
    // jaw: howling wide, gaping in the pounce, snapping while it mauls, a snarl, a pant
    let jw = 0.05 + Math.max(0, Math.sin(t * 2.3 + (e.seed || 0))) * 0.05;
    if (howl) jw = hel > 0.22 ? 0.66 + Math.sin(t * 7) * 0.08 : 0.15;
    else if (pph === 'air') jw = 0.95; else if (pph === 'land') jw = 0.05;
    else if (maul) jw = 0.45 + Math.sin(t * 22) * 0.4;
    else if (ko) jw = 0.32; else if (hurt) jw = 0.55;
    else if (e.lungeT > 0) jw = Math.sin((1 - e.lungeT / 0.24) * Math.PI) * 0.9;
    else if (s.snarl > 0.5) jw = 0.16;
    s.jaw += (jw - s.jaw) * kk(18);
    // ---- the torso ----
    const u0 = (((e.phase || 0) * (gallop ? 0.5 : 1)) / TAU) % 1;
    let bob = 0, flex = 0;
    if (gallop) { flex = Math.sin(u0 * TAU + 0.6) * 0.07 * s.walk; bob = -Math.abs(Math.sin(u0 * TAU)) * 6 * s.walk; }
    else bob = -Math.abs(Math.cos(u0 * TAU * 2)) * 1.8 * s.walk;
    const breathe = Math.sin(t * 2.4 + (e.seed || 0)) * 0.8;
    const vy = e.vy || 0;
    const pitch = s.rear * 0.38 + s.sit * 0.62 - s.crouch * 0.07 + flex + s.leap * clamp(-vy / 1600, -0.22, 0.26);
    const drop = s.sit * 80 + s.crouch * 18 + s.rear * 8 + s.lie * 62 + s.ko * 64 - s.leap * 4 + bob + (held ? -6 : 0);
    P.pitch = pitch; P.sit = s.sit; P.lie = s.lie; P.leap = s.leap;
    const hx = HIP[0] + s.sit * 6 - s.rear * 8, hy = HIP[1] + drop;
    P.hip[0] = hx; P.hip[1] = hy;
    const c = Math.cos(pitch), sn = Math.sin(pitch);
    const tw = (lx, ly, o) => { o[0] = hx + lx * c + ly * sn; o[1] = hy - lx * sn + ly * c; return o; };
    tw(TS[0], TS[1], P.S); tw(TN[0], TN[1] + breathe * 0.3, P.N); tw(TT[0], TT[1], P.TR);
    // ---- legs ----
    const offs = gallop ? GALLOP : TROT, duty = gallop ? 0.4 : 0.6;
    const len = Math.min(gallop ? 95 : 42, (duty * TAU * 11.1) / (sc * (gallop ? 0.5 : 1))) * s.walk;
    const el = maul ? 0.95 - e.maulT : 0;
    for (let i = 0; i < 4; i++) {
      const L = P.legs[i], fore = L.fore, near = L.near, r = fore ? P.S : P.hip;
      L.r[0] = r[0] + (near ? 0 : fore ? -3 : 3); L.r[1] = r[1] - (near ? 0 : 2);
      const rx = L.r[0], ry = L.r[1];
      let px, py, pa = 0, wrist = null;   // wrist: the metacarpus / metatarsus offset from the paw
      if (held) {   // dangling, paws kicking
        const k2 = Math.sin(t * 9 + i * 1.7);
        px = rx + (fore ? 10 : -12) + k2 * 10; py = ry + (fore ? 92 : 104) * 0.93; pa = 0.9 + k2 * 0.2; wrist = 'line';
      } else if (s.ko > 0.5) {   // knocked out: flat out on its side, legs limp and stretched along the ground
        const k2 = Math.sin(t * 1.3 + i) * 1.5;
        if (fore) { px = rx + 60 + (near ? 8 : 0) + k2; py = G - (near ? 1 : 4); pa = 0.15; }
        else { px = rx - 56 - (near ? 8 : 0) + k2; py = G - (near ? 2 : 5); pa = 1.35; }
        wrist = 'line';
      } else if (s.lie > 0.5) {   // lying down: forepaws out in front, hind legs folded under
        if (fore) { px = rx + 52 + (near ? 6 : 0); py = G; } else { px = rx + 34; py = G; }
        wrist = fore ? 'flat' : 'sit';
      } else if (s.leap > 0.5 && pph !== 'land') {   // flying through the air: forelegs reach, hind legs trail
        const up = clamp(-vy / 900, -1, 1);
        if (fore) { px = rx + 58 + (near ? 6 : 0) - up * 6; py = ry + 54 + up * 12; pa = -0.4; }
        else { px = rx - 62 - (near ? 6 : 0); py = ry + 62 - up * 8; pa = 1.1; }
        wrist = 'line';
      } else if (fore && s.rear > 0.3) {   // rearing up to maul: forepaws swipe in turn (near, far, near)
        const hits = near ? [0.23, 0.7] : [0.47];
        let th = 0.15;
        for (const ts of hits) { const d = el - ts; if (d > -0.2 && d <= 0) th = lerp(-0.85, 1.05, sm(-0.2, 0, d)); else if (d > 0 && d < 0.22) th = lerp(1.05, 0.15, d / 0.22); }
        const R2 = 66 + (near ? 4 : 0);
        px = rx + Math.cos(th) * R2; py = ry + Math.sin(th) * R2; pa = th + 0.2; wrist = 'line';
        if (!maul) { px = lerp(rx + 6, px, s.rear); py = lerp(G, py, s.rear); }
      } else {   // standing, trotting, galloping, sitting, crouching
        stride(((u0 + offs[i]) % 1 + 1) % 1, duty, len, fore ? (gallop ? 26 : 13) : (gallop ? 22 : 11), FD);
        if (!walking) { FD[0] = 0; FD[1] = 0; }
        const restX = fore ? rx + (near ? 8 : 2) : rx + lerp(near ? -12 : -6, 26, s.sit) + s.crouch * 10;
        px = restX + FD[0]; py = G + FD[1];
        if (fore && s.sit > 0) px = lerp(px, rx + 4, s.sit);
        pa = FD[1] < -2 ? clamp(-FD[1] * (fore ? 0.05 : -0.04) * (FD[0] < 0 ? 1 : 0.3), -0.6, 0.9) : 0;
        wrist = !fore && s.sit > 0.05 ? 'sit' : 'stand';
        L.lift = -FD[1];
      }
      if (fore && s.rear > 0.3 && s.rear < 1 && !maul) wrist = 'stand';
      L.p[0] = px; L.p[1] = py; L.pa = pa;
      // wrist / hock
      if (wrist === 'line') { const dx = px - rx, dy = py - ry, d = Math.hypot(dx, dy) || 1, m = fore ? FL[2] : HL[2]; L.b[0] = px - dx / d * m; L.b[1] = py - dy / d * m; }
      else if (wrist === 'flat') { L.b[0] = px - FL[2]; L.b[1] = py - 4; }
      else if (wrist === 'sit') { const q = s.lie > 0.5 ? 1 : s.sit; L.b[0] = px + lerp(-11, -34, q); L.b[1] = py + lerp(-28, -5, q); }
      else if (fore) { L.b[0] = px - 3 - L.lift * 0.3; L.b[1] = py - FL[2] + L.lift * 0.15; }
      else { L.b[0] = px - 11 + L.lift * 0.2; L.b[1] = py - 28 + L.lift * 0.1; }
      if (fore) ik(rx, ry, L.b[0], L.b[1], FL[0], FL[1], 1, A2); else ik(rx, ry, L.b[0], L.b[1], HL[0], HL[1], -1, A2);
      L.a[0] = A2[0]; L.a[1] = A2[1];
    }
    // ---- neck and head ----
    let wob = 0;
    if (e.dizzy > 0 && !ko) wob = Math.sin(t * 6) * 0.22;
    if (held) wob = Math.sin(t * 5) * 0.25;
    const nr = -pitch * 0.4 - s.up * 0.45 + s.down * 0.5 + s.ko * 0.55 + wob * 0.4 + s.lie * 0.25;
    const cn = Math.cos(nr), snn = Math.sin(nr);
    P.HP[0] = P.N[0] + NECK[0] * cn - NECK[1] * snn; P.HP[1] = P.N[1] + NECK[0] * snn + NECK[1] * cn;
    P.headRot = -pitch * 0.45 - s.up * 0.85 + s.down * 0.6 + wob + s.ko * 0.35 + (hurt ? Math.sin(t * 30) * 0.06 : 0) + Math.sin(t * 0.8 + (e.seed || 0)) * 0.03 + s.lie * 0.2;
    P.jaw = s.jaw; P.ear = s.ear; P.hackle = s.hackle; P.snarl = s.snarl; P.tongue = s.ko;
    // ---- tail: a bushy brush, hanging, raised when it hunts, streaming when it runs, tucked when it is scared ----
    const sw = Math.sin(t * 2.1 + (e.seed || 0)) * 0.1 + (gallop ? Math.sin(u0 * TAU) * 0.18 : 0) + (held ? Math.sin(t * 7) * 0.3 : 0);
    let a = lerp(s.tailA - pitch, 2.95, s.sit * 0.9), b = lerp(s.tailB, -0.12, s.sit);
    const T0 = P.tail[0]; T0[0] = P.TR[0]; T0[1] = P.TR[1];
    const seg = [30, 28, 26];
    for (let i = 1; i < 4; i++) {
      const ang = a + b * (i - 1) * 1.2 + sw * (0.3 + i * 0.35), q = P.tail[i], pr = P.tail[i - 1];
      q[0] = pr[0] + Math.cos(ang) * seg[i - 1]; q[1] = Math.min(G - 6, pr[1] + Math.sin(ang) * seg[i - 1]);
    }
    P.tailZ = Math.sin(t * 1.7 + (e.seed || 0)) * 6 + (gallop ? Math.sin(u0 * TAU * 2) * 5 : 0);
    return P;
  };
  // a point given in head-local units (x along the muzzle, y down), in template units
  const headPt = (P, x, y, out) => { const c = Math.cos(P.headRot) * HS, s = Math.sin(P.headRot) * HS; out[0] = P.HP[0] + x * c - y * s; out[1] = P.HP[1] + x * s + y * c; return out; };
  D.wolfHeadPt = headPt;
  // the mouth in game coordinates (bites, the howl's sound waves)
  const MW = [0, 0];
  D.wolfMouth = function (e, t) {
    const P = D.wolfPose(e, t == null ? (SB.world ? SB.world.time : 0) : t); headPt(P, D.WOLF.mouth[0], D.WOLF.mouth[1], MW);
    const K = ks(e), a = (e.angle || 0) + (e.tilt || 0), x = MW[0] * (e.facing || 1) * K, y = MW[1] * K, ca = Math.cos(a), sa = Math.sin(a);
    return [e.x + x * ca - y * sa, e.y + x * sa + y * ca, P];
  };

  // ---------- the painting ----------
  // a closed outline through control points [x, y, fur] (Catmull-Rom, n samples a segment); segments whose start
  // point has fur > 0 get a ragged edge of tufts that long, swept back toward the tail
  function furLoop(cp, n, seed) {
    const out = [], m = cp.length;
    for (let i = 0; i < m; i++) {
      const p0 = cp[(i - 1 + m) % m], p1 = cp[i], p2 = cp[(i + 1) % m], p3 = cp[(i + 2) % m], fur = p1[2] || 0, nn = fur > 0 ? n * 2 : n;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1, ox = dy / d, oy = -dx / d;
      for (let j = 0; j < nn; j++) {
        const u = j / nn, u2 = u * u, u3 = u2 * u;
        const f = k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
        let x = f(0), y = f(1);
        if (fur > 0) {   // tufts: base, a tip lying back toward the tail, a little shoulder
          const ph = j % 3, r = Math.abs(Math.sin(Math.floor(j / 3) * 5.31 + i * 2.7 + seed)), l = fur * (0.45 + 0.8 * r);
          if (ph === 1) { x += ox * l - l * 0.85; y += oy * l + l * 0.15; } else if (ph === 2) { x += ox * l * 0.22 - l * 0.2; y += oy * l * 0.22; }
        }
        out.push(x, y);
      }
    }
    return out;
  }
  // an open ragged strip: along a base polyline, tufts of length len on one side, the other side `depth` inside
  function furStrip(base, len, depth, side, seed) {
    const top = [], bot = [], n = base.length / 2;
    for (let i = 0; i < n; i++) {
      const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1), dx = base[j * 2] - base[k * 2], dy = base[j * 2 + 1] - base[k * 2 + 1], d = Math.hypot(dx, dy) || 1;
      const nx = dy / d * side, ny = -dx / d * side, taper = Math.sin(Math.PI * (i + 0.5) / n) ** 0.6;
      const l = (i % 2 ? len * (0.55 + 0.5 * Math.abs(Math.sin(i * 3.7 + seed))) : len * 0.15) * taper;
      top.push(base[i * 2] + nx * l - (i % 2 ? l * 0.35 : 0), base[i * 2 + 1] + ny * l);
      bot.unshift(base[i * 2] - nx * depth * taper, base[i * 2 + 1] - ny * depth * taper);
    }
    return [top, top.concat(bot)];
  }
  // an open polyline, resampled (n per segment)
  function spline(pts, n) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 0; j < n; j++) {
        const u = j / n, u2 = u * u, u3 = u2 * u;
        out.push(0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3));
      }
    }
    const L = pts[pts.length - 1]; out.push(L[0], L[1]);
    return out;
  }
  // fill without the soft outline (fur that has to melt into what is under it)
  const bare = (p, pts, fill) => { const k = p.inkK; p.inkK = 0; p.poly(pts, fill); p.inkK = k; };
  // fur strokes
  function strands(p, pts, len, side, step, tilt, col, alpha) {
    const c = p.ctx; c.save(); c.globalAlpha *= alpha; c.strokeStyle = col; c.lineWidth = Math.max(0.6, c.lineWidth * 0.5);
    D.fur(p, pts, step, len, side, tilt); c.restore();
  }
  // a soft round light or shadow (muscle, form) with no edge
  function glow(c, x, y, rx, ry, col, a) {
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha *= a; c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
  }
  const rgba = (h, a) => { const q = SB.hexRGB(h); return 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + a + ')'; };
  // a leg as one tapered shape down its joints (root, joint, wrist/hock, paw) with these widths
  function legShape(L, wd) {
    const J = [L.r, L.a, L.b, [L.p[0], L.p[1] - 4]], lft = [], rgt = [];
    for (let i = 0; i < 4; i++) {
      const a = J[Math.max(0, i - 1)], b = J[Math.min(3, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d * wd[i] / 2, ny = dx / d * wd[i] / 2;
      lft.push(J[i][0] + nx, J[i][1] + ny); rgt.unshift(J[i][0] - nx, J[i][1] - ny);
    }
    return lft.concat(rgt);
  }
  D.drawWolfBoss = function (p, e, t) {
    const P = D.wolfPose(e, t), c = p.ctx, pal = p.pal || {}, seed = (e.seed || 0) % 10;
    const BODY = pal.body || '#2c2b2f', FAR = pal.far || SB.shade(BODY, 0.4), MANE = pal.mane || SB.shade(BODY, 0.5), BELLY = pal.belly || SB.mixColor(BODY, '#c9c2b6', 0.35);
    const LIGHT = SB.mixColor(BODY, '#e8e4dc', 0.5), DARK = SB.shade(BODY, 0.6);
    const MOUTH = pal.mouth || '#4a1010', TEETH = pal.teeth || '#efe6cf', CLAW = pal.claw || '#16120f', NOSE = pal.nose || '#0e0d0f', SCAR = pal.scar || '#8f736a';
    const lw = c.lineWidth, hk = 0.45 + 0.75 * P.hackle;
    const cs = Math.cos(P.pitch), sn = Math.sin(P.pitch), hx = P.hip[0], hy = P.hip[1];
    const tw = (x, y, f) => [hx + x * cs + y * sn, hy - x * sn + y * cs, f || 0];   // torso-local -> template (with a fur length)
    // ---- tail (behind everything) ----
    {
      const cl = spline(P.tail, 5), n = cl.length / 2, L = [], R = [];
      for (let i = 0; i < n; i++) {
        const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1), dx = cl[j * 2] - cl[k * 2], dy = cl[j * 2 + 1] - cl[k * 2 + 1], d = Math.hypot(dx, dy) || 1;
        const u = i / (n - 1), wd = (6 + 14 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.06)), 0.6) * (1 - u * u * 0.4)) * (i % 2 ? 1.28 : 0.92) + (i === n - 1 ? 0 : 0), nx = -dy / d, ny = dx / d;
        const sw = i % 2 ? 4 : 0;   // tufts sweep toward the tip
        L.push(cl[i * 2] + nx * wd + dx / d * sw, cl[i * 2 + 1] + ny * wd + dy / d * sw); R.unshift(cl[i * 2] - nx * wd + dx / d * sw, cl[i * 2 + 1] - ny * wd + dy / d * sw);
      }
      p.fill = BODY; p.poly(L.concat(R), true);
      const h0 = Math.floor(n * 0.6), TL = L.slice(h0 * 2), TR = R.slice(0, (n - h0) * 2);
      c.save(); c.globalAlpha *= 0.85; bare(p, TL.concat(TR), MANE); c.restore();
      strands(p, cl.slice(0, Math.floor(n * 0.7) * 2), 8, 1, 6, -0.9, LIGHT, 0.35); strands(p, cl, 7, -1, 6, 0.9, DARK, 0.5);
    }
    // ---- legs: far pair dark, then the near pair, all tucked up under the body ----
    const paw = (L, col) => {
      c.save(); c.translate(L.p[0], L.p[1]); c.rotate(L.pa);
      p.fill = col; p.poly([-6, -2, -4, -9, 6, -11, 14, -8, 17, -3, 14, 0, -4, 0], true);
      c.save(); c.globalAlpha *= 0.5; c.strokeStyle = DARK; for (let k = 0; k < 3; k++) p.line(7 + k * 3.4, -10, 8 + k * 3.4, -2); c.restore();
      p.fill = CLAW; for (let k = 0; k < 3; k++) { const cx = 9 + k * 3; p.poly([cx, -3, cx + 6, 1, cx + 0.5, -0.2], true); }
      c.restore();
    };
    const leg = (L, col) => {
      p.fill = col; p.poly(legShape(L, L.fore ? [36, 21, 13, 12] : [44, 24, 13, 12]), true);
      strands(p, [L.a[0], L.a[1], L.b[0], L.b[1]], 6, L.fore ? -1 : 1, 5, L.fore ? 0.6 : -0.6, L.fore ? DARK : LIGHT, 0.45);
      paw(L, col);
    };
    leg(P.legs[0], FAR); leg(P.legs[1], FAR); leg(P.legs[2], BODY); leg(P.legs[3], BODY);
    // ---- body and neck: one shaggy silhouette ----
    const N = P.N, HP = P.HP, ndx = HP[0] - N[0], ndy = HP[1] - N[1], nd = Math.hypot(ndx, ndy) || 1, dX = ndx / nd, dY = ndy / nd, nX = -dY, nY = dX;
    const at = (q, a, b, f) => [q[0] + nX * a + dX * b, q[1] + nY * a + dY * b, f || 0];
    const mid = [(N[0] + HP[0]) / 2, (N[1] + HP[1]) / 2];
    const outline = [tw(-24, -22, 2), tw(12, -26, 2), tw(60, -30, 3), tw(102, -37, 4), at(mid, -28, -4, 4), at(HP, -22, -6, 3), at(HP, 4, -12), at(HP, 21, 8, 9),
      tw(152, 2, 6), tw(142, 28, 7), tw(118, 50, 8), tw(82, 46, 7), tw(44, 22, 5), tw(14, 12, 3), tw(-8, 20, 0), tw(-20, 34, 5), tw(-38, 8, 3), tw(-33, -12, 2)];
    p.fill = BODY; p.poly(furLoop(outline, 6, seed), true);
    // form: the haunch and the shoulder catch the light, the flank and the belly fall into shadow
    const hp = tw(-6, 2), sp = tw(TS[0] - 6, TS[1] - 12), rb = tw(70, 12), bl = tw(70, 34);
    glow(c, hp[0] - 6, hp[1] - 8, 26, 30, rgba(LIGHT, 0.6), 0.55); glow(c, sp[0] - 4, sp[1] - 8, 20, 28, rgba(LIGHT, 0.6), 0.5);
    glow(c, rb[0], rb[1], 38, 20, rgba(DARK, 0.7), 0.5);
    { const [, belly] = furStrip(spline([tw(140, 10), tw(126, 36), tw(96, 40), tw(60, 32)], 3).filter(() => true), 7, 8, 1, seed); c.save(); c.globalAlpha *= 0.55; bare(p, belly, BELLY); c.restore(); }
    c.save(); c.globalAlpha *= 0.35; c.strokeStyle = DARK;
    const k1 = tw(-24, 28), k2 = tw(-2, -6), k3 = tw(18, 20); p.curve(k1[0], k1[1], k2[0] - 6, k2[1], k3[0], k3[1]);   // the thigh's front edge
    const s1 = tw(98, -26), s2 = tw(120, 4), s3 = tw(112, 34); p.curve(s1[0], s1[1], s2[0], s2[1], s3[0], s3[1]);    // behind the shoulder
    c.restore();
    strands(p, spline([tw(-20, -18), tw(30, -24), tw(80, -29), tw(104, -33)], 3), 9, -1, 5, 0.95, LIGHT, 0.4);
    strands(p, spline([tw(-30, -4), tw(-14, 18)], 3), 8, -1, 4, 0.7, LIGHT, 0.35);
    // the dark saddle and the hackles, standing up along the neck and withers when it hunts
    {
      const base = spline([tw(40, -26), tw(80, -30), tw(104, -35), at(mid, -22, -4), at(HP, -16, -8)], 4);
      const [top, strip] = furStrip(base, 13 * hk, 10, 1, seed + 2);
      c.save(); c.globalAlpha *= 0.8; bare(p, strip, MANE); c.restore();
      c.save(); c.globalAlpha *= 0.45; p.path(top, false, false); c.restore();
      strands(p, base, 10, 1, 3, 0.9, MANE, 0.7); strands(p, base, 7, -1, 4, -0.8, MANE, 0.55);
    }
    // the throat ruff, paler
    { const base = spline([at(HP, 12, 2), at(mid, 22, 0), tw(150, 6)], 4); const [, strip] = furStrip(base, 10, 9, -1, seed + 4); c.save(); c.globalAlpha *= 0.6; bare(p, strip, BELLY); c.restore(); }
    strands(p, spline([at(N, -12, 0), at(HP, -8, 0)], 4), 9, -1, 4, 0.6, LIGHT, 0.3);
    // ---- head ----
    c.save(); c.translate(HP[0], HP[1]); c.rotate(P.headRot); c.scale(HS, HS);
    const ear = (near) => {
      c.save(); c.translate(near ? 4 : 13, -19); c.rotate(-P.ear * 1.15 - 0.12);
      p.fill = near ? BODY : FAR; p.poly([-10, 4, -6, -14, -2, -31, 4, -14, 9, 3], true);
      if (near) { bare(p, [-6, 1, -2.5, -23, 4, 1], SB.mixColor(BODY, '#7a5a5a', 0.4)); strands(p, [-6, 1, -3, -16], 6, 1, 2.5, 0.3, LIGHT, 0.55); }
      c.restore();
    };
    ear(false);
    const snr = P.snarl, jawA = P.jaw * 0.72, lip = 9 - snr * 4;   // the upper lip curls up off the teeth in a snarl
    // the inside of the mouth, then the lower jaw on its hinge
    if (jawA > 0.04) { p.fill = MOUTH; const ca = Math.cos(jawA), sa = Math.sin(jawA); p.poly([10, 9, 66, 6, 10 + 56 * ca - 4 * sa, 9 + 56 * sa + 4 * ca, 10 + 20 * ca - 4 * sa, 9 + 20 * sa + 4 * ca], true); }
    c.save(); c.translate(10, 9); c.rotate(jawA);
    if (P.tongue > 0.3 || jawA > 0.3) { p.fill = '#a8464f'; p.ellipse(34 + P.tongue * 14, 2 + P.tongue * 3, 18 + P.tongue * 8, 3.2, true, 0.1 + P.tongue * 0.3); }
    p.fill = BODY; p.poly([-6, -2, 26, 0, 56, -1, 58, 3, 52, 9, 24, 10, -4, 7], true);
    c.save(); c.globalAlpha *= 0.6; bare(p, [4, 4, 30, 6, 50, 6, 30, 9], BELLY); c.restore();
    p.fill = TEETH; for (let k = 0; k < 4; k++) { const x = 28 + k * 6.5; p.poly([x, 0.5, x + 2, -4.5, x + 4, 0.5], true); }
    p.poly([48, 0.5, 51, -9, 54, 0.5], true);                 // lower fang
    c.restore();
    // skull and long muzzle, a shaggy ruff swept back off the cheeks
    p.fill = BODY;
    p.poly(furLoop([[-10, -6, 4], [0, -21, 0], [18, -26, 0], [33, -19, 0], [50, -14, 0], [64, -9, 0], [72, -4, 0], [72, 4, 0], [68, lip - 1, 0], [48, lip, 0], [30, lip + 1, 0], [14, 15, 5], [-4, 16, 5]], 4, seed), true);
    { const [, strip] = furStrip(spline([[2, -20], [-4, -4], [2, 14], [12, 18]], 4), 13, 6, -1, seed + 6); c.save(); c.globalAlpha *= 0.9; bare(p, strip, MANE); c.restore(); }
    c.save(); c.globalAlpha *= 0.5; bare(p, [40, lip - 4, 68, lip - 5, 62, lip + 0.5, 40, lip + 0.5], BELLY); c.restore();
    glow(c, 20, -12, 16, 11, rgba(LIGHT, 0.6), 0.45);
    strands(p, [2, -18, 18, -23, 33, -17], 6, -1, 3.5, 0.9, LIGHT, 0.45);
    strands(p, [36, -14, 52, -11, 64, -7], 4, -1, 3.5, 1.2, LIGHT, 0.3);
    strands(p, [8, 8, 20, 12, 30, 12], 6, 1, 3, -0.6, DARK, 0.4);
    // upper teeth, bared
    p.fill = TEETH;
    for (let k = 0; k < 4; k++) { const x = 34 + k * 5.5; p.poly([x, lip - 1, x + 2, lip + 4 + snr * 1.5, x + 4, lip - 1], true); }
    p.poly([54, lip - 1.5, 57, lip + 11 + snr * 2, 60.5, lip - 1.5], true);   // the big fang
    p.poly([63, lip - 1, 64.5, lip + 4, 66.5, lip - 1], true);
    // gums show in a snarl, the muzzle wrinkles
    if (snr > 0.2) {
      c.save(); c.globalAlpha *= snr; bare(p, [32, lip - 2.5, 66, lip - 3, 66, lip - 0.6, 32, lip - 0.4], '#6e2328');
      c.strokeStyle = '#0a0a0b'; for (let k = 0; k < 3; k++) p.curve(42 + k * 6, -12 + k, 44 + k * 6, -6 + k, 42 + k * 6, -1 + k); c.restore();
    }
    // drool dripping off the fang
    { const dr = (t * 1.1 + seed * 0.13) % 1; c.save(); c.fillStyle = 'rgba(225,235,240,0.75)'; c.beginPath(); c.ellipse(57.5, lip + 13 + dr * dr * 26, 1.6, 2.6 + dr * 2, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(225,235,240,0.6)'; c.lineWidth = lw * 0.5; c.beginPath(); c.moveTo(57.5, lip + 10); c.lineTo(57.5, lip + 11 + dr * dr * 24); c.stroke(); c.restore(); }
    // nose
    p.fill = NOSE; p.poly([63, -8, 72, -7, 75, -2, 72, 2, 64, 1], true);
    c.save(); c.globalAlpha *= 0.5; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(70, -5, 1.6, 1, 0, 0, TAU); c.fill(); c.restore();
    // old scars: claw rakes across the muzzle and one through the eye
    c.save(); c.strokeStyle = SCAR; c.lineWidth = lw * 1.1; c.globalAlpha *= 0.9;
    p.line(44, -15, 52, -2); p.line(50, -14, 57, -3); p.line(56, -12, 61, -4); p.line(31, -26, 40, -1); c.restore();
    // eye: glowing, slit-pupilled, sunk under a heavy brow
    glow(c, 35, -11, 9, 7, 'rgba(0,0,0,0.9)', 0.6);
    D.eye(p, 35, -11, 4.2, e, 1);
    ear(true);
    c.restore();
    c.lineWidth = lw;
  };

  // ---------- definition (what B() in bosses.js does: drawK scales the template, the mass and the health) ----------
  const inner = { w: 300, h: 180, draw(p, e, t) { D.drawWolfBoss(p, e, t); } }, K = DRAWK;
  const PAL = { body: '#2d2c30', far: '#1b1a1d', mane: '#121114', belly: '#625d57', mouth: '#4a0f10', teeth: '#eee4cc', claw: '#141110', nose: '#0d0c0e', scar: '#93766c', eyeGlow: '#ffc21a' };
  const def = SB.def(NAME, SB.merge({
    cat: 'boss', boss: true, creature: true, move: 'walk', temper: 'hostile', bounce: 0.05, friction: 6, huntR: 760,
    tags: ['boss', 'monster', 'big', 'scary', 'villain', 'predator'], fears: [], hunts: [], eats: [], heldMood: 'angry'
  }, {
    drawK: K,
    t: { w: inner.w * K, h: inner.h * K, draw(p, e, t) { p.ctx.scale(K, K); inner.draw(p, e, t); } },
    aliases: ['giant wolves', 'huge wolf', 'huge wolves', 'big wolf', 'big wolves', 'mega wolf', 'enormous wolf', 'gigantic wolf', 'massive wolf', 'colossal wolf', 'jumbo wolf', 'large wolf',
      'dire wolf', 'direwolf', 'dire wolves', 'direwolves', 'wolf boss', 'boss wolf', 'alpha wolf', 'wolf king', 'king wolf', 'king wolves', 'wolf lord', 'pack leader', 'leader pack', 'wolf pack leader',
      'fenrir', 'fenris', 'fenris wolf', 'fenrir wolf', 'monster wolf', 'big bad wolf', 'the big bad wolf', 'bad wolf', 'shadow wolf', 'giant shadow wolf', 'demon wolf', 'giant black wolf', 'giant grey wolf', 'giant gray wolf',
      'huge black wolf', 'big black wolf', 'giant evil wolf', 'giant angry wolf', 'giant dire wolf', 'titan wolf', 'super wolf',
      'giant wofl', 'giant wolfe', 'giant wulf', 'giant woolf', 'giant wollf', 'giant wolv', 'giant wolfs', 'giant woof', 'huge wofl', 'big wofl', 'dier wolf', 'dire wofl', 'direwofl', 'fenir', 'fenrier'],
    speed: 190, chargeSpeed: 780, mass: 90, hp: 46, jump: 520, tags: ['wolf', 'canine', 'furry', 'hairy', 'animal'],
    weak: ['fire', 'hot', 'trap', 'axe'], special: 'giantwolf', kin: ['wolf', 'werewolf'], roarSfx: 'howl',
    hunts: ['sheep', 'lamb', 'pig', 'rabbit', 'deer', 'chicken', 'human', 'hero', 'animal', 'monster', 'vehicle'], eats: ['sheep', 'lamb', 'rabbit', 'chicken', 'chick', 'mouse', 'pig', 'bone'],
    say: ['*growl*', '*sniff sniff* I smell you...', 'The pack hunts tonight.', '*low snarl*', 'Run, little ones.', '*licks fangs*'], roar: ['AWOOOOOO!', 'GRRRAAAH!', '*SNARL*', 'RAAAWR!'],
    weakSay: ['YELP! FIRE!', 'Not the fire! NOT THE FIRE!', 'OW OW OW! My paw!', 'A woodcutter?! Run!', '*yelp yelp*'],
    power: 'A colossal black wolf, leader of the pack. Pounces from far away and bites, rears up to maul with its claws, and sprints down anything that runs. Its terrifying HOWL makes everything nearby flee in panic and calls its pack of wolves to fight for it.',
    weakText: 'fire, torches and anything hot, traps, and the woodcutter\'s axe. And it can\'t help howling at the moon, leaving itself wide open',
    hint: 'The giant wolf howls to call its pack! Weak to fire, traps and axes... and the moon.',
    onHurt(e, W) {
      e.hurtT = 0.5;
      if ((e.yelpCd || 0) <= 0) {
        e.yelpCd = 0.9;
        if (SB.sfx) SB.sfx.play('screech', { pitch: 1.35, vol: 0.45, pan: clamp((e.x / W.W) * 2 - 1, -1, 1) * 0.7 });
        if (Math.random() < 0.45) e.say(pick(['YELP!', '*yelp*', 'Arrooo?!', 'GRR! You\'ll pay!', '*whimper*... GRRR!']));
      }
      if (Math.random() < 0.5) W.burst('puff', e.x, e.y - e.h * 0.1, 4, 90, { size: 6, life: 0.5, col: '#3a393d' });   // tufts of fur
    }
  }));
  def.mass = Math.round(90 * K * K * 0.8); def.hp = Math.round(46 * (1 + (K - 1) * 0.6));
  // palette: colors.js gives every def its palette after this file runs; merge this one's own colours over whatever it sets
  let pal = Object.assign({}, PAL);
  Object.defineProperty(def, 'pal', { enumerable: true, configurable: true, get: () => pal, set: v => { pal = Object.assign({}, v, PAL); } });
  SB.BOSSES.push(NAME);

  // ---------- attacks ----------
  const S = SB.SPECIALS = SB.SPECIALS || {};
  const PACK_CAP = 3, PACK_MAX = 6;   // wolves per boss, wolves on screen
  const ready = e => !(e.ko || e.held || e.dizzy > 0 || e.sleeping || e.spawnT < 1 || e.frozenT > 0 || e.webT > 0);
  const valid = (e, o) => o && o !== e && o.alive && !o.dying && !o.ko && !SB.kin(e, o);
  const busy = e => e.howlT > 0 || e.maulT > 0 || !!e.pouncePh || e.chargeT > 0;
  function stopAll(e) { e.howlT = 0; e.maulT = 0; e.pouncePh = ''; e.chargeT = 0; e.pawT = 0; }
  const packOf = (e, W) => W.entities.filter(o => o.packOf === e && o.alive && !o.dying && !o.ko);

  S.giantwolf = function (e, dt, W) {
    hooks(W);
    if (e.howlCd == null) { e.howlCd = 3; e.pounceCd = 1.2; e.maulCd = 0; e.moonNext = 2; e.specT = Math.max(e.specT, 1); e.hurtT = 0; e.yelpCd = 0; e.packT = 0; }
    e.howlCd -= dt; e.pounceCd -= dt; e.maulCd -= dt; e.specT -= dt;
    if (e.hurtT > 0) e.hurtT -= dt; if (e.yelpCd > 0) e.yelpCd -= dt;
    if ((e.packT -= dt) <= 0) { e.packT = 0.4; packTick(e, W); }
    if (e.ko || !e.alive || e.dying) {
      if (!e.koClean) { e.koClean = true; stopAll(e); scatter(e, W); }
      // a wolf drops flat on its side rather than tipping up onto its nose: undo the 90-degree K.O. tilt and the
      // swapped box (put back on revive, see hooks)
      if (e.ko && !e.koFlat) { e.koFlat = true; e.koAngle = 0; e.angle = 0; e.angVel = 0; if (e.h > e.w) { const w = e.w; e.w = e.h; e.h = w; } }
      return;
    }
    e.koClean = false;
    if (!ready(e)) { if (busy(e) && !(e.pouncePh === 'air' && !e.held)) stopAll(e); return; }
    if (e.howlT > 0) { howlTick(e, dt, W); return; }
    if (e.maulT > 0) { maulTick(e, dt, W); return; }
    if (e.pouncePh) { pounceTick(e, dt, W); return; }
    if (e.chargeT > 0) { sprintTick(e, dt, W); return; }
    e.pawT = 0;
    if (!e.grounded || e.controlled) return;   // the player's wolf attacks with the E key (see hooks)
    // the moon: it can't help itself
    const moon = W.entities.find(o => o.special === 'moon' && o.alive && !o.dying);
    if (moon) { e.moonNext -= dt; if (e.moonNext <= 0) { e.moonNext = 9 + Math.random() * 3; startHowl(e, W, moon); return; } }
    else e.moonNext = Math.min(e.moonNext, 2);
    const tg = e.target;
    // something right under its nose gets mauled straight away, even between other moves
    if (valid(e, tg) && e.maulCd <= 0 && e.specT < 0.6 && Math.abs(tg.x - e.x) - e.w / 2 < 40 * e.scale + tg.w * 0.3 && (tg.x - e.x) * e.facing > -20 && tg.bottom > e.top - 30 && tg.top < e.bottom) return startMaul(e, tg, W);
    if (e.specT > 0) return;
    const pack = packOf(e, W).length;
    if (!valid(e, tg)) {   // nothing to hunt: now and then it calls the pack anyway
      if (e.howlCd <= 0 && pack < PACK_CAP && Math.random() < dt * 0.4) startHowl(e, W, null);
      else e.specT = 0.3;
      return;
    }
    const dx = tg.x - e.x, adx = Math.abs(dx), gap = adx - e.w / 2, dy = tg.y - e.y;
    let foes = 0; for (const o of W.entities) if (o.creature && valid(e, o) && Math.abs(o.x - e.x) < 600 * e.scale) foes++;
    if (e.howlCd <= 0 && (pack < PACK_CAP || foes >= 3) && adx < 760 * e.scale) return startHowl(e, W, null);
    if (e.maulCd <= 0 && gap < 46 * e.scale + tg.w * 0.3 && tg.bottom > e.top - 30 && tg.top < e.bottom) return startMaul(e, tg, W);
    if (e.pounceCd <= 0 && gap > 10 && gap < 440 * e.scale && Math.abs(dy) < 260 * e.scale) return startPounce(e, tg, W);
    if (gap > 420 * e.scale && Math.abs(dy) < 300 * e.scale) return startSprint(e, tg, W);
    e.specT = 0.25;
  };

  // ---- HOWL: everything nearby flees in terror, and the pack comes running ----
  function startHowl(e, W, moon) {
    e.howlDur = e.howlT = moon ? 3.2 : 2.3; e.howlMoon = !!moon; e.howlStage = 0; e.pawT = 1;
    if (!moon) e.howlCd = 13 + Math.random() * 4;
    e.say(moon ? pick(['AWOOOOO... the moon...', 'The MOON! AROOOOOO!', 'Must... howl... AWOOOO!']) : pick(['AWOOOOOOOO!', 'AROOOOOOO!', 'COME, MY PACK! AWOOOO!']), 2.2);
    W.sfx('howl', e.x);
  }
  function howlTick(e, dt, W) {
    e.pawT = 1; e.howlT -= dt;
    const el = e.howlDur - e.howlT;
    if (e.howlStage < 1 && el >= 0.35) {
      e.howlStage = 1;
      if (!e.howlMoon) scare(e, W); else W.popText(e.x, e.top - 30, 'Moonstruck!', 26);
      W.shake(e.howlMoon ? 3 : 8);
    }
    if (e.howlStage < 2 && el >= 1.0) { e.howlStage = 2; if (!e.howlMoon) summon(e, W); }
    if (e.howlMoon && e.howlStage < 3 && el >= 1.7) { e.howlStage = 3; W.sfx('howl', e.x, 0.8); }
    if (e.howlT <= 0) { e.howlT = 0; e.pawT = 0; e.specT = 0.6; }
  }
  function scare(e, W) {
    const R = 580 * e.scale, [mx, my] = D.wolfMouth(e, W.time);
    let n = 0;
    for (const o of W.entities) {
      if (o === e || !o.creature || !o.alive || o.dying || o.ko || o.static || SB.kin(e, o)) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) > R + o.w * 0.5) continue;
      if (o.def.boss) { if (Math.random() < 0.5) o.say(pick(['Hmph.', 'Nice try, puppy.', '...was that a howl?', 'I am not scared of YOU.'])); continue; }
      // heroes (knights, soldiers...) only flinch: an army can still stand and fight it
      const brave = o.tags && o.tags.has('hero');
      o.setMood('scared', brave ? 1 : 3.5);
      if (!o.controlled) { o.fleeT = brave ? 0.9 : 3.2; o.fleeFrom = e; o.threat = e; o.target = null; o.victim = null; o.attacker = null; o.scanT = 0.4; }
      const dir = o.x >= e.x ? 1 : -1, m = Math.min(1, 4 / Math.sqrt(Math.max(0.2, o.mass)));
      if (o.move !== 'none') { o.vx += dir * 240 * m; if (o.grounded && !o.flying) { o.vy = Math.min(o.vy, -260 * m); o.grounded = false; } }
      if (o.sleeping) o.sleeping = false;
      o.say(brave ? pick(['Steady!', 'Hold the line!', 'I fear no wolf!', 'Gulp... CHARGE!']) : pick(['AAAAH!', 'RUN!', 'Eeeek!', 'WOLF!', 'Mommy!', 'Nope nope nope!', 'Yikes!', 'Every man for himself!']));
      W.burst('sparkle', o.x, o.top, 2, 60, { size: 4, life: 0.5 });
      n++;
    }
    W.popText(mx, my - 40, 'AWOOOOO!', 36);
    if (n) W.particle('impact', e.x, e.top - 50, { life: 0.8, size: 56, text: 'FEAR!' });
  }
  function summon(e, W) {
    const pack = packOf(e, W), all = W.entities.filter(o => o.packOf && o.alive && !o.dying).length;
    const want = Math.min(PACK_CAP - pack.length, 2, PACK_MAX - all);
    if (want <= 0) { e.say(pick(['My pack is here!', 'ATTACK, my pack!', 'Get them!'])); for (const w of pack) w.say('AWOO!'); return; }
    for (let i = 0; i < want; i++) {
      // they come running in from the edges of the screen, the nearest edge behind it first
      const fromRight = (i % 2 === 0) === (e.x > W.W / 2);
      const x = fromRight ? W.W - 30 - i * 20 : 30 + i * 20;
      const w = W.spawn('wolf', x, W.groundY - 30, { quiet: true, scale: 1.25, temper: 'hostile' });
      if (!w) continue;
      w.packOf = e; w.facing = fromRight ? -1 : 1; w.vx = w.facing * 320; w.spawnT = 0.5;
      w.say(pick(['Awooo!', 'AWOO!', 'For the alpha!', 'Grrr!']));
      W.burst('puff', w.x, W.groundY - 10, 6, 120, { size: 9, life: 0.6 });
    }
    W.popText(e.x, e.top - 70, 'THE PACK!', 30);
    W.sfx('howl', e.x, 0.35);
  }
  // the pack fights whatever the alpha hunts
  function packTick(e, W) {
    if (e.ko || !e.alive || e.dying) return;
    const tg = e.target;
    for (const w of W.entities) {
      if (w.packOf !== e || !w.alive || w.dying || w.ko || w.fleeT > 0 || w.controlled) continue;
      if (valid(e, tg) && !SB.kin(w, tg)) { w.target = tg; w.scanT = Math.max(w.scanT, 0.5); if (w.mood !== 'angry') w.setMood('angry', 1); }
    }
  }
  // its pack runs off whimpering when the alpha goes down
  function scatter(e, W) {
    for (const w of W.entities) {
      if (w.packOf !== e || !w.alive || w.dying) continue;
      w.packOf = null; w.target = null; w.setMood('scared', 4); w.fleeT = 4; w.fleeFrom = e; w.say(pick(['*whimper*', 'Awoo...', 'The alpha is down! Run!']));
    }
  }

  // ---- POUNCE: a crouch, a huge leap from range, and a bite that lands with it ----
  function startPounce(e, tg, W) {
    e.facing = tg.x >= e.x ? 1 : -1; e.pouncePh = 'crouch'; e.pounceT = 0.38; e.pounceTg = tg; e.pawT = 1;
    e.pounceCd = 3 + Math.random() * 1.5;
    e.say(pick(['*crouches low*', 'GRRRRR...', '*wiggles haunches*']));
    W.sfx('roar', e.x, 0.4);
  }
  function pounceTick(e, dt, W) {
    if (e.pouncePh === 'crouch') {
      e.pawT = 1; e.pounceT -= dt;
      if (Math.random() < dt * 10) W.particle('puff', e.x - e.facing * e.w * 0.3, e.bottom - 4, { vx: -e.facing * 90, vy: -30, life: 0.5, size: 7 });
      if (e.pounceT > 0) return;
      const tg = e.pounceTg, ok = tg && tg.alive && !tg.dying;
      if (ok) e.facing = tg.x >= e.x ? 1 : -1;
      const tx = ok ? tg.x + (tg.vx || 0) * 0.3 : e.x + e.facing * 320 * e.scale;
      let dx = tx - e.facing * e.w * 0.32 - e.x;
      dx = e.facing * clamp(dx * e.facing, 80, 720 * e.scale);
      const T = clamp(Math.abs(dx) / 760, 0.45, 0.8), g = 1700 * (e.gravity || 1);
      const rise = ok ? clamp(e.bottom - tg.bottom, 0, 200) : 0;   // a little higher for things up on something
      e.vy = -0.5 * g * T - rise / T; e.pvx = dx / T; e.vx = e.pvx; e.grounded = false;
      e.pouncePh = 'air'; e.pounceT = 0; e.hitIds = new Set(); e.pawT = 0;
      W.sfx('whoosh', e.x); W.sfx('roar', e.x, 0.6); e.say(pick(['*POUNCE*', 'GOT YOU!', 'RAAAH!']));
      return;
    }
    if (e.pouncePh === 'air') {
      e.pounceT += dt; e.vx = e.pvx;
      if (Math.random() < dt * 30) W.particle('streak', e.x - e.facing * e.w * 0.3, e.y + (Math.random() - 0.5) * e.h * 0.5, { tx: e.vx, ty: e.vy, life: 0.2, size: 50 });
      bite(e, W, 1);
      if ((e.grounded && e.pounceT > 0.12) || e.pounceT > 1.6) {
        bite(e, W, 1.3);
        e.pouncePh = 'land'; e.pounceT = 0.32; e.vx *= 0.15; e.pawT = 1;
        W.shake(10); W.burst('puff', e.x + e.facing * e.w * 0.25, e.bottom, 10, 180, { size: 10, life: 0.7 }); W.sfx('stomp', e.x, 0.6);
      }
      return;
    }
    // landing
    e.pawT = 1; e.pounceT -= dt;
    if (e.pounceT <= 0) { e.pouncePh = ''; e.pawT = 0; e.specT = 0.7; }
  }
  // the jaws snap shut on whatever is at the front of it
  function bite(e, W, reach) {
    const f = e.facing, x0 = e.x + f * e.w * 0.12, x1 = e.x + f * (e.w * 0.5 + 34 * e.scale * reach);
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    for (const o of W.entities) {
      if (!o.creature || !valid(e, o) || o.static || o.held || e.hitIds.has(o.id)) continue;
      if (o.right < lo || o.left > hi || o.bottom < e.top - 30 || o.top > e.bottom + 10) continue;
      e.hitIds.add(o.id);
      const m = Math.min(1.3, 6 / Math.sqrt(Math.max(0.2, o.mass)));
      W.hurt(o, o.def.boss ? 4 : 3, e, { quiet: true });   // hard, but not a one-bite K.O. for a knight
      if (!o.def.boss) { o.vx = f * (360 + Math.random() * 140) * m; o.vy = -(380 + Math.random() * 120) * m; o.grounded = false; o.angVel = (Math.random() - 0.5) * 14; o.dizzy = Math.max(o.dizzy, 1.3); }
      o.say(pick(['CHOMPED!', 'YEOWCH!', 'It bit me!', 'AAAH!']));
      W.popText(o.x, o.top - 24, pick(['CHOMP!', 'CRUNCH!', 'SNAP!']), 30); W.sfx('snip', o.x); W.freezeFrame(0.08); W.shake(7);
      W.particle('slash', o.x, o.y, { life: 0.3, size: Math.max(30, o.h * 0.6), rot: f, col: '#ff6b6b' });
    }
  }

  // ---- MAUL: up on its hind legs, three savage swipes ----
  const MAUL_T = 0.95, MAUL_HITS = [0.23, 0.47, 0.7];
  function startMaul(e, tg, W) {
    e.facing = tg.x >= e.x ? 1 : -1; e.maulT = MAUL_T; e.maulHit = 0; e.maulCd = 2.6 + Math.random(); e.pawT = 1; e.hitIds = new Set();
    e.say(pick(['RAAAAH!', '*SAVAGE SNARL*', 'MAUL!', 'Tear them apart!'])); W.sfx('roar', e.x, 0.5);
  }
  function maulTick(e, dt, W) {
    e.pawT = 1; e.maulT -= dt;
    const el = MAUL_T - e.maulT;
    while (e.maulHit < 3 && el >= MAUL_HITS[e.maulHit]) maulStrike(e, W, e.maulHit++);
    if (e.maulT <= 0) { e.maulT = 0; e.pawT = 0; e.specT = 0.6; }
  }
  function maulStrike(e, W, i) {
    const f = e.facing, x0 = e.x + f * e.w * 0.1, x1 = e.x + f * (e.w * 0.5 + 74 * e.scale), lo = Math.min(x0, x1), hi = Math.max(x0, x1), last = i === 2;
    W.sfx('swing', e.x);
    const px = e.x + f * e.w * 0.48, py = e.y - e.h * 0.05;
    W.particle('slash', px, py, { life: 0.26, size: e.h * 0.42, rot: f, col: '#ff6b6b' });
    let hit = 0;
    for (const o of W.entities) {
      if (!valid(e, o) || o.static || o.held || (!o.creature && o.mass > 30)) continue;
      if (o.right < lo || o.left > hi || o.bottom < e.top - 40 || o.top > e.bottom) continue;
      const m = Math.min(1.3, 6 / Math.sqrt(Math.max(0.2, o.mass)));
      if (o.creature) { W.hurt(o, last ? 4 : 2, e, { quiet: true }); if (!o.def.boss) o.dizzy = Math.max(o.dizzy, last ? 1.4 : 0.5); o.say(pick(['OW!', 'Claws!', 'Aaah!', 'Ouch ouch!'])); }
      if (!o.def.boss) { o.vx = f * (last ? 560 : 170) * m; o.vy = -(last ? 520 : 160) * m; o.grounded = false; if (last) o.angVel = (Math.random() - 0.5) * 16; }
      hit++;
    }
    if (hit) { W.popText(px, py - 40, last ? pick(['MAULED!', 'RIIIP!']) : pick(['SLASH!', 'SWIPE!', 'RIP!']), last ? 32 : 24); W.shake(last ? 9 : 4); }
  }

  // ---- SPRINT: a burst of speed that bowls over anything in the way, ending in a maul ----
  function startSprint(e, tg, W) {
    e.facing = tg.x >= e.x ? 1 : -1; e.chargeT = 1.5; e.hitIds = new Set(); e.sprintTg = tg; e.specT = 0;
    e.say(pick(['*THE HUNT BEGINS*', 'You can\'t outrun me!', 'GRRRAAAH!', 'Run, run, RUN!'])); W.sfx('roar', e.x, 0.6); W.sfx('whoosh', e.x);
  }
  function sprintTick(e, dt, W) {
    e.chargeT -= dt;
    const tg = e.sprintTg;
    if (valid(e, tg)) { const want = tg.x >= e.x ? 1 : -1; if (want !== e.facing && Math.abs(tg.x - e.x) > e.w * 0.6) { e.chargeT = Math.min(e.chargeT, 0.05); } }
    if (Math.random() < dt * 24) W.particle('puff', e.x - e.facing * e.w * 0.3, e.bottom - 4, { vx: -e.facing * (60 + Math.random() * 100), vy: -30 - Math.random() * 50, life: 0.6, size: 8 + Math.random() * 5 });
    if (Math.random() < dt * 22) W.particle('streak', e.x - e.facing * e.w * 0.4, e.y + (Math.random() - 0.5) * e.h * 0.6, { tx: e.facing * 800, ty: 0, life: 0.2, size: 60 });
    const fx = e.x + e.facing * e.w * 0.42;
    for (const o of W.entities) {
      if (!valid(e, o) || o.held || o.static || (o.noCollide && !o.creature) || e.hitIds.has(o.id) || o === tg) continue;
      if (Math.abs(o.x - fx) > o.w / 2 + 30 * e.scale || o.bottom < e.top + e.h * 0.25 || o.top > e.bottom) continue;
      e.hitIds.add(o.id);
      const m = Math.min(1.3, 6 / Math.sqrt(Math.max(0.2, o.mass)));
      if (!o.def.boss) { o.vx = e.facing * (420 + Math.random() * 160) * m; o.vy = -(420 + Math.random() * 200) * m; o.grounded = false; o.angVel = (Math.random() - 0.5) * 16; }
      if (o.creature) { W.hurt(o, 3, e, { quiet: true }); o.dizzy = Math.max(o.dizzy, 1); o.say(pick(['WHOA!', 'Bowled over!', 'Aaah!'])); }
      W.popText(o.x, o.top - 20, pick(['WHAM!', 'BOWLED OVER!', 'BAM!']), 22);
    }
    // caught up: straight into a maul
    if (valid(e, tg) && Math.abs(tg.x - e.x) - e.w / 2 < 40 * e.scale && (tg.x - e.x) * e.facing > 0) { e.chargeT = 0; e.maulCd = 0; startMaul(e, tg, W); return; }
    if ((e.facing < 0 && e.x <= e.w / 2 + 6) || (e.facing > 0 && e.x >= W.W - e.w / 2 - 6)) { e.chargeT = 0; e.vx = 0; }
    if (e.chargeT <= 0) { e.chargeT = 0; e.specT = 0.9; W.burst('puff', e.x + e.facing * e.w * 0.3, e.bottom, 6, 120, { size: 8, life: 0.6 }); }
  }

  // ---------- hooks (installed once): in control mode E pounces, mauls, sprints or howls ----------
  function hooks(W) {
    if (!W || W.wolfHooked || !W.ctrlSpecial) return;
    W.wolfHooked = true;
    const ctrlSpecial = W.ctrlSpecial, revive = W.revive;
    if (revive) W.revive = function (e) { if (e && e.koFlat) { e.koFlat = false; if (e.ko) { const w = e.w; e.w = e.h; e.h = w; } } return revive.apply(W, arguments); };
    W.ctrlSpecial = function () {
      const e = W.ctrl && W.ctrl.e;
      if (!e || e.special !== 'giantwolf') return ctrlSpecial.apply(W, arguments);
      if (e.ko || e.dying || W.ctrl.atkCd > 0) return;
      W.ctrl.atkCd = 0.6;
      if (busy(e) || !e.grounded || !ready(e)) return;
      let best = null, bd = Infinity;
      for (const o of W.entities) {
        if (!o.creature || !valid(e, o) || o.held) continue;
        const dx = (o.x - e.x) * e.facing; if (dx < -o.w * 0.3 || dx > 900) continue;
        const d = Math.abs(dx) + Math.abs(o.y - e.y) * 0.5; if (d < bd) { bd = d; best = o; }
      }
      if (!best) { startHowl(e, W, null); return; }
      e.target = best; e.ctrlTargetT = 2;
      const gap = Math.abs(best.x - e.x) - e.w / 2;
      if (gap < 60 * e.scale) startMaul(e, best, W); else if (gap < 460 * e.scale) startPounce(e, best, W); else startSprint(e, best, W);
    };
  }
  window.addEventListener('DOMContentLoaded', () => hooks(SB.world));

  // ---------- drawn over the world: the howl's sound waves rolling out of its jaws ----------
  def.drawWorld = function (p, c, e, t) {
    if (!(e.howlT > 0) || e.ko) return;
    const el = (e.howlDur || 2) - e.howlT; if (el < 0.25) return;
    const [mx, my, P] = D.wolfMouth(e, t), f = e.facing || 1;
    const a = f > 0 ? P.headRot - 0.1 : Math.PI - P.headRot + 0.1, fade = Math.min(1, e.howlT / 0.4);
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const q = ((el - 0.25) * 1.2 + i / 4) % 1, r = 18 + q * 260 * e.scale;
      c.globalAlpha = (1 - q) * 0.6 * fade; c.strokeStyle = e.howlMoon ? '#e3ecff' : '#ffe6a0'; c.lineWidth = 6 * (1 - q) + 1.5;
      c.beginPath(); c.arc(mx, my, r, a - 0.55, a + 0.55); c.stroke();
    }
    c.restore();
  };
})();
