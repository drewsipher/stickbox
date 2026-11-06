'use strict';
// m-people.js — 3D people and humanoid creatures (every D.humanoid template) and the werewolf.
// A jointed figure with realistic proportions: pelvis -> spine -> chest -> neck -> head, shoulder -> elbow -> hand,
// hip -> knee -> ankle -> shoe. Clothes, hair, hats, items and costume parts follow the 2D template options (tpl.o).
(function () {
  if (!SB.M3) return;
  const T = THREE, M3 = SB.M3, TAU = Math.PI * 2, PI = Math.PI;
  const geo = M3.geo;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mix = (a, b, k) => SB.mixColor ? SB.mixColor(a, b, k) : a;
  const shade = (c, k) => mix(c, '#000000', k);
  const tint = (c, k) => mix(c, '#ffffff', k);

  // ---------- shared unit geometry (scaled per mesh) ----------
  const lathe = (key, prof, seg) => geo('pl:' + key, () => new T.LatheGeometry(prof.map(p => new T.Vector2(Math.max(0, p[0]), p[1])), seg || 20));
  const cap = (key, tlen, tstart) => geo('pcap:' + key, () => new T.SphereGeometry(1, 20, 12, 0, TAU, tstart || 0, tlen));
  const torus = (arc, tube) => geo('ptor:' + arc.toFixed(2) + ':' + tube, () => new T.TorusGeometry(1, tube, 6, 18, arc));
  const disc = () => geo('pdisc', () => new T.CircleGeometry(1, 18));
  // torso: unit radius, y 0 (crotch) .. 1 (base of the neck); split into trousers and shirt
  const TORSO = {
    m: [[0, 0], [0.55, 0.01], [0.8, 0.05], [0.88, 0.13], [0.84, 0.28], [0.8, 0.42], [0.86, 0.58], [0.95, 0.73], [0.98, 0.84], [0.95, 0.91], [0.72, 0.975], [0.4, 1]],
    f: [[0, 0], [0.6, 0.01], [0.86, 0.06], [0.95, 0.15], [0.86, 0.3], [0.72, 0.44], [0.8, 0.6], [0.9, 0.74], [0.92, 0.84], [0.88, 0.92], [0.66, 0.975], [0.38, 1]],
    b: [[0, 0], [0.6, 0.01], [0.86, 0.06], [0.95, 0.2], [1.0, 0.4], [0.98, 0.58], [0.94, 0.75], [0.9, 0.86], [0.78, 0.94], [0.45, 0.99], [0.34, 1]]   // babies, plush, apes: barrel
  };
  const sub = (prof, y0, y1, grow) => {   // the part of a profile between y0 and y1, re-ended
    const at = y => { for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const a = prof[i - 1], b = prof[i], f = (y - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * f; } return prof[prof.length - 1][0]; };
    const out = [[0, y0], [at(y0) * grow, y0]];
    for (const p of prof) if (p[1] > y0 && p[1] < y1) out.push([p[0] * grow, p[1]]);
    out.push([at(y1) * grow, y1], [y1 >= 1 ? 0.3 : 0, y1]);
    return out;
  };
  const torsoGeo = (style, part) => lathe('t' + style + part, part === 'w' ? TORSO[style] : part === 'p' ? sub(TORSO[style], 0, 0.4, 1.02) : part === 's' ? sub(TORSO[style], 0.33, 1, 1.07) : TORSO[style], 22);
  // skirt / robe: an open flared tube (unit: top radius 1 at y 0, hanging to y -1)
  const skirtGeo = (flare, tattered) => geo('pskirt:' + flare + ':' + (tattered ? 1 : 0), () => {
    const g = new T.CylinderGeometry(1, flare, 1, 22, 5, true); g.translate(0, -0.5, 0);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), a = Math.atan2(P.getZ(i), P.getX(i)), f = -y;
      const fold = 1 + Math.sin(a * 9) * 0.05 * f;   // soft folds toward the hem
      P.setX(i, P.getX(i) * fold); P.setZ(i, P.getZ(i) * fold);
      if (tattered && y < -0.99) { const j = Math.round((a + PI) / TAU * 22); P.setY(i, y + (j % 2 ? 0.12 : 0) + (j % 3 === 0 ? 0.06 : 0)); }
    }
    g.computeVertexNormals(); return g;
  });
  // a five-pointed star outline (badges, emblems, wands)
  const starPts = (r) => { const p = []; for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; p.push(Math.cos(a) * rr, Math.sin(a) * rr); } return p; };
  const IRIS = ['#5b3a1f', '#3b6ea8', '#4f7d3a', '#8a6a2f', '#6b4423', '#2e2e2e', '#5a8fa8'];

  // ---------- head (head-local: origin mid-head, +x = the face, R = half the chin-to-crown height) ----------
  function buildHead(c, hg) {
    const { k, o, R, M } = c, P = { hg };
    const top = 1.02 * R;
    const hidden = o.hat === 'helmet' && c.knight;   // a great helm hides the face
    if (o.boxy) {   // robot: a machined box head, glowing eyes, speaker grille, ear bolts
      k.rbox(1.75 * R, 1.8 * R, 1.6 * R, M.metal, hg, 0, 0, 0, 0.25 * R);
      k.rbox(0.2 * R, 0.6 * R, 1.4 * R, M.dark, hg, 0.9 * R, 0.08 * R, 0, 0.08 * R);
      const em = k.mat('#9ff6ff', { glow: '#3ee8ff', glowK: 1.6, rough: 0.2 });
      for (const s of [-1, 1]) { const d = k.mesh(disc(), em, hg, 1.005 * R, 0.1 * R, s * 0.36 * R); d.rotation.y = PI / 2; d.scale.setScalar(0.22 * R); }
      for (let i = 0; i < 3; i++) k.box(0.06 * R, 0.06 * R, 0.7 * R, M.dark, hg, 0.88 * R, (-0.4 - i * 0.14) * R, 0);
      for (const s of [-1, 1]) { const b = k.cyl(0.25 * R, 0.25 * R, 0.2 * R, M.metal2, hg, 0, 0, s * 0.85 * R); b.rotation.x = PI / 2; }
      P.mouthOff = true;
    } else if (c.bony) {   // a skull: cranium, cheekbones, dark sockets, a hinged jaw with teeth
      k.sphere([0.9 * R, 0.86 * R, 0.74 * R], M.skin, hg, -0.06 * R, 0.16 * R);
      k.sphere([0.5 * R, 0.4 * R, 0.6 * R], M.skin, hg, 0.4 * R, -0.22 * R);
      const dk = k.mat('#0d0a08', { rough: 0.9 });
      for (const s of [-1, 1]) k.sphere([0.12 * R, 0.17 * R, 0.16 * R], dk, hg, 0.8 * R, 0.06 * R, s * 0.28 * R);
      k.sphere([0.06 * R, 0.1 * R, 0.07 * R], dk, hg, 0.88 * R, -0.22 * R, 0);
      if (o.hood) { const gl = k.mat('#ff4020', { glow: '#ff3010', glowK: 2 }); for (const s of [-1, 1]) k.sphere(0.045 * R, gl, hg, 0.86 * R, 0.06 * R, s * 0.28 * R); }
      const jaw = P.jaw = k.group(hg, -0.1 * R, -0.25 * R, 0);
      k.rbox(0.75 * R, 0.3 * R, 0.78 * R, M.skin, jaw, 0.52 * R, -0.42 * R, 0, 0.12 * R);
      k.box(0.04 * R, 0.12 * R, 0.5 * R, M.teeth, jaw, 0.9 * R, -0.24 * R, 0);
      k.box(0.04 * R, 0.1 * R, 0.5 * R, M.teeth, hg, 0.86 * R, -0.36 * R, 0);
      P.mouthOff = true;
    } else {
      const sk = c.furry && !c.plush ? M.face : M.skinH;
      k.sphere([0.92 * R, 0.9 * R, 0.76 * R], c.furry ? M.fur : M.skinH, hg, -0.05 * R, 0.12 * R);
      k.sphere([0.7 * R, 0.68 * R, 0.62 * R], c.furry ? M.fur : M.skinH, hg, 0.18 * R, -0.3 * R);
      if (c.plush) {   // a teddy's sewn muzzle and nose
        k.sphere([0.42 * R, 0.36 * R, 0.46 * R], M.belly, hg, 0.62 * R, -0.36 * R);
        k.sphere([0.12 * R, 0.09 * R, 0.16 * R], M.black, hg, 1.02 * R, -0.22 * R);
      } else if (c.furry) {   // ape/beast face: bare skin mask, heavy brow, jutting muzzle, flat nose
        k.sphere([0.5 * R, 0.66 * R, 0.66 * R], sk, hg, 0.42 * R, -0.12 * R);
        k.sphere([0.45 * R, 0.42 * R, 0.5 * R], sk, hg, 0.6 * R, -0.5 * R);
        k.sphere([0.26 * R, 0.14 * R, 0.68 * R], sk, hg, 0.72 * R, 0.3 * R);
        for (const s of [-1, 1]) k.sphere([0.06 * R, 0.07 * R, 0.08 * R], M.black, hg, 1.0 * R, -0.3 * R, s * 0.1 * R);
      } else if (o.nose) k.sphere(0.24 * R, M.nose, hg, 0.9 * R, -0.12 * R);
      else if (c.witch) { const n = k.tube([[0.75 * R, 0.0, 0], [1.15 * R, -0.25 * R, 0], [1.25 * R, -0.5 * R, 0]], 0.14 * R, 0.03 * R, sk, hg, 6, 8); k.sphere(0.06 * R, M.wart, hg, 1.0 * R, -0.18 * R, 0.08 * R); P.nose = n; }
      else { const n = k.sphere([0.17 * R, 0.3 * R, 0.13 * R], sk, hg, 0.82 * R, -0.12 * R); n.rotation.z = -0.25; }
      // ears
      if (!o.earsRound && !o.hood && !c.helmetFull) for (const s of [-1, 1]) { const e2 = k.sphere([0.14 * R, 0.27 * R, 0.08 * R], c.furry ? M.fur : sk, hg, -0.08 * R, -0.05 * R, s * 0.76 * R); e2.rotation.x = s * 0.15; }
      // eyes
      const er = 0.14 * R * (o.eyeR > 2.5 ? 1.4 : 1);
      const iris = c.iris;
      if (o.eyeR > 2.5) {   // alien: huge black almond eyes
        const gm = k.mat('#050608', { rough: 0.08, metal: 0.2 });
        for (const s of [-1, 1]) { const ey = k.sphere([0.2 * R, 0.24 * R, 0.36 * R], gm, hg, 0.62 * R, 0.0, s * 0.36 * R); ey.rotation.x = s * 0.5; ey.rotation.y = s * 0.3; }
      } else if (o.oneEye) k.eye(0.36 * R, hg, 0.66 * R, 0.14 * R, 0, { dir: [1, 0, 0.1], iris, lid: c.skinC });
      else if (o.eyes === 'sockets') { const dk = k.mat('#0a0806'); for (const s of [-1, 1]) k.sphere([0.12 * R, 0.16 * R, 0.16 * R], dk, hg, 0.72 * R, 0.08 * R, s * 0.3 * R); }
      else if (c.plush) for (const s of [-1, 1]) k.sphere(0.1 * R, k.mat('#0b0b0d', { rough: 0.1 }), hg, 0.78 * R, 0.12 * R, s * 0.32 * R);
      else if (!hidden) for (const s of [-1, 1]) {
        if (o.mask === 'eyepatch' && s > 0) { const pt = k.sphere([0.06 * R, 0.2 * R, 0.2 * R], M.black, hg, 0.84 * R, 0.08 * R, 0.3 * R); pt.rotation.y = -0.3; continue; }
        k.eye(er, hg, (o.mask === 'hero' ? 0.74 : 0.7) * R, 0.08 * R, s * 0.3 * R, { dir: [1, 0, s * 0.22], iris, lid: c.furry ? c.faceC : c.skinC });
      }
      // brows
      if (!c.furry && !hidden && o.eyeR <= 2.5 && o.eyes !== 'sockets' && !o.boxy) {
        P.brows = [];
        const bm = o.oneEye ? [0] : [-1, 1];
        for (const s of bm) { const b = k.box(0.06 * R, 0.07 * R, (o.oneEye ? 0.5 : 0.26) * R, M.brow, hg, 0.82 * R, 0.33 * R, s * 0.3 * R); b.userData.s = s; P.brows.push(b); }
      }
      if (o.mask === 'eyepatch') { const st = k.mesh(torus(TAU, 0.05), M.black, hg, -0.02 * R, 0.25 * R, 0); st.scale.set(0.9 * R, 0.82 * R, 0.82 * R); st.rotation.set(PI / 2, 0.35, 0); }
      if (o.mask === 'hero') { const b = k.mesh(geo('pband', () => new T.CylinderGeometry(1, 1, 1, 22, 1, true)), k.mat('#111', { side: 'double', rough: 0.5 }), hg, -0.03 * R, 0.1 * R, 0); b.scale.set(0.97 * R, 0.3 * R, 0.82 * R); }
      if (o.mask === 'ninja') { k.sphere([0.74 * R, 0.6 * R, 0.66 * R], M.black, hg, 0.2 * R, -0.36 * R); P.mouthOff = true; }
      if (o.glasses) {
        const gm = k.mat('#2a2522', { rough: 0.4, metal: 0.3 }), gl = k.mat('#cfe8f4', { opacity: 0.25, rough: 0.05 });
        for (const s of [-1, 1]) { const r = k.mesh(torus(TAU, 0.12), gm, hg, 0.86 * R, 0.08 * R, s * 0.3 * R); r.scale.setScalar(0.19 * R); r.rotation.y = PI / 2; const l = k.mesh(disc(), gl, hg, 0.86 * R, 0.08 * R, s * 0.3 * R); l.rotation.y = PI / 2; l.scale.setScalar(0.18 * R); k.box(0.85 * R, 0.04 * R, 0.04 * R, gm, hg, 0.42 * R, 0.1 * R, s * 0.62 * R); }
        k.box(0.04 * R, 0.04 * R, 0.22 * R, gm, hg, 0.88 * R, 0.1 * R, 0);
      }
      if (!P.mouthOff && !hidden) buildMouth(c, hg, P, c.furry ? 0.98 : 0.84, c.furry ? -0.62 : -0.52);
      if (o.mustache) for (const s of [-1, 1]) { const m = k.sphere([0.07 * R, 0.065 * R, 0.25 * R], M.hair, hg, 0.86 * R, -0.37 * R, s * 0.15 * R); m.rotation.x = s * 0.4; }
    }
    // beards
    if (o.beard === 'short') { k.sphere([0.6 * R, 0.5 * R, 0.66 * R], M.hair, hg, 0.22 * R, -0.58 * R); if (P.mouth) P.mouth.position.x += 0.06 * R; }
    if (o.beard === 'long') { k.sphere([0.6 * R, 0.5 * R, 0.66 * R], M.hair, hg, 0.22 * R, -0.58 * R); const b = k.sphere([0.4 * R, 1.15 * R, 0.52 * R], M.hair, hg, 0.4 * R, -1.3 * R); b.rotation.z = 0.12; if (P.mouth) P.mouth.position.x += 0.06 * R; P.beard = b; }
    if (o.earsRound) for (const s of [-1, 1]) { k.sphere([0.14 * R, 0.34 * R, 0.34 * R], c.furry ? M.fur : M.skinH, hg, -0.1 * R, 0.72 * R, s * 0.66 * R); k.sphere([0.06 * R, 0.2 * R, 0.2 * R], c.furry ? M.belly : M.skinH, hg, 0.0, 0.72 * R, s * 0.68 * R); }
    if (o.hood) {   // a deep hood, open at the front, dark inside
      const hm = k.mesh(geo('phood', () => new T.SphereGeometry(1, 20, 12, PI + 0.85, TAU - 1.7, 0, PI * 0.78)), k.mat(c.clothC, { side: 'double', rough: 0.95 }), hg, -0.12 * R, 0.08 * R, 0);
      hm.scale.set(1.22 * R, 1.3 * R, 1.08 * R);
      k.sphere([0.9 * R, 1.0 * R, 0.9 * R], k.mat('#050404', { rough: 1 }), hg, -0.3 * R, 0.1 * R);
    }
    if (o.horns) for (const s of [-1, 1]) k.tube([[0.25 * R, 0.62 * R, s * 0.42 * R], [0.2 * R, 1.15 * R, s * 0.72 * R], [-0.1 * R, 1.6 * R, s * 0.7 * R], [-0.35 * R, 1.8 * R, s * 0.55 * R]], 0.18 * R, 0.015 * R, M.horn, hg, 10, 8);
    if (o.antenna) for (let i = 0; i < o.antenna; i++) {
      const z = o.antenna === 1 ? 0 : (i ? 0.4 : -0.4) * R, a = k.group(hg, -0.05 * R, (o.boxy ? 0.9 : 0.95) * R, z);
      a.rotation.x = -z / R * 0.6;
      k.cyl(0.035 * R, 0.045 * R, 1.2 * R, M.metal, a, 0, 0.6 * R, 0);
      k.sphere(0.13 * R, o.boxy ? k.mat('#ff4a3a', { glow: '#ff2010', glowK: 1.2 }) : M.metal, a, 0, 1.25 * R, 0);
    }
    if (o.halo) { const h = k.mesh(torus(TAU, 0.08), k.mat('#ffd75a', { glow: '#ffc93a', glowK: 0.9, metal: 0.6, rough: 0.3 }), hg, -0.1 * R, 1.55 * R, 0); h.scale.setScalar(0.62 * R); h.rotation.x = PI / 2; P.halo = h; }
    buildHair(c, hg, P);
    buildHat(c, hg, P, top);
    return P;
  }

  // the mouth: a few lip shapes, shown by mood
  function buildMouth(c, hg, P, x, y) {
    const { k, o, R } = c, m = P.mouth = k.group(hg, x * R, y * R, 0);
    m.rotation.y = PI / 2;   // its xy plane faces +x
    const lip = k.mat(mix(c.skinC, '#9a3a3a', 0.4), { rough: 0.5 });
    const dark = k.mat('#3a1414', { rough: 0.8 });
    const smile = k.mesh(torus(1.8, 0.2), lip, m, 0, 0.12 * R, 0); smile.scale.setScalar(0.24 * R); smile.rotation.z = PI + (PI - 1.8) / 2;
    const frown = k.mesh(torus(1.4, 0.22), lip, m, 0, -0.16 * R, 0); frown.scale.setScalar(0.22 * R); frown.rotation.z = (PI - 1.4) / 2;
    const flat = k.sphere([0.2 * R, 0.035 * R, 0.05 * R], lip, m);
    const open = k.sphere([0.11 * R, 0.15 * R, 0.06 * R], dark, m, 0, -0.03 * R, 0);
    P.mouths = { happy: smile, angry: frown, scared: open, normal: flat };
    if (o.fangs) for (const s of [-1, 1]) { const f = k.cone(0.035 * R, 0.16 * R, k.mat('#fbfaf2', { rough: 0.3 }), m, s * 0.1 * R, -0.08 * R, 0.02 * R); f.rotation.x = PI; }
    if (o.tusks) for (const s of [-1, 1]) { const f = k.cone(0.07 * R, 0.4 * R, k.mat('#f2ead2', { rough: 0.4 }), m, s * 0.22 * R, 0.08 * R, 0.04 * R); f.rotation.z = -s * 0.2; }
  }

  function buildHair(c, hg, P) {
    const { k, o, R, M } = c, kind = o.hair;
    const H = M.hair, capM = (sc, th) => { const h = k.mesh(cap('h' + (th || 0.52), PI * (th || 0.52)), H, hg, -0.08 * R, 0.16 * R, 0); h.scale.set(1.0 * R * (sc || 1), 0.98 * R * (sc || 1), 0.82 * R * (sc || 1)); h.rotation.z = 0.45; return h; };
    if (kind === 'bald' && c.def.cat === 'person') {   // a fringe round the back of a bald head
      const f = k.mesh(cap('hfr', PI * 0.3, PI * 0.42), H, hg, -0.12 * R, 0.1 * R, 0); f.scale.set(0.98 * R, 0.96 * R, 0.8 * R); f.rotation.z = 0.9;
      return;
    }
    if (kind === 'none' || kind === 'bald' || o.boxy || c.bony) return;
    if (o.hat === 'astronaut' || (o.hat === 'helmet' && c.knight)) return;
    switch (kind) {
      case 'short': capM(1.03); break;
      case 'long': case 'ponytail': case 'bun': case 'pigtails': case 'curly': capM(1.04); break;
      case 'spiky': capM(1.02); for (let i = 0; i < 9; i++) { const a = -0.9 + (i % 5) * 0.45, b = i < 5 ? 0.35 : -0.35; const s = k.cone(0.2 * R, 0.6 * R, H, hg, 0, 0, 0); const d = new T.Vector3(Math.sin(a) * 0.9 - 0.15, Math.cos(a), b).normalize(); s.position.set(d.x * 0.95 * R - 0.08 * R, d.y * 0.92 * R + 0.12 * R, d.z * 0.8 * R); s.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); } break;
      case 'mohawk': for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36, s = k.cone(0.16 * R, 0.9 * R, H, hg, Math.sin(a) * 0.95 * R - 0.08 * R, Math.cos(a) * 0.95 * R + 0.12 * R, 0); s.rotation.z = -a; s.scale.z = 0.4; } break;
      case 'tuft': { const t = k.tube([[0, 0.98 * R, 0], [0.15 * R, 1.3 * R, 0], [0.35 * R, 1.35 * R, 0], [0.3 * R, 1.18 * R, 0]], 0.08 * R, 0.03 * R, H, hg, 8, 6); P.tuft = t; break; }
    }
    if (kind === 'long') {
      k.sphere([0.55 * R, 1.35 * R, 0.86 * R], H, hg, -0.52 * R, -0.62 * R);
      for (const s of [-1, 1]) { const l = k.sphere([0.32 * R, 0.95 * R, 0.16 * R], H, hg, -0.4 * R, -0.45 * R, s * 0.74 * R); l.rotation.x = s * -0.08; }
    }
    if (kind === 'ponytail') { P.pony = k.group(hg, -0.85 * R, 0.4 * R, 0); k.sphere(0.16 * R, M.hairTie, P.pony); const pt = k.sphere([0.28 * R, 0.85 * R, 0.3 * R], H, P.pony, -0.12 * R, -0.75 * R); pt.rotation.z = -0.2; }
    if (kind === 'bun') k.sphere(0.4 * R, H, hg, -0.55 * R, 0.85 * R);
    if (kind === 'pigtails') for (const s of [-1, 1]) { const g = k.group(hg, -0.25 * R, 0.25 * R, s * 0.82 * R); k.sphere(0.12 * R, M.hairTie, g); const p = k.sphere([0.26 * R, 0.75 * R, 0.26 * R], H, g, -0.05 * R, -0.62 * R, s * 0.12 * R); p.rotation.x = s * 0.35; (P.pigs = P.pigs || []).push(g); }
    if (kind === 'curly') for (let i = 0; i < 11; i++) { const a = -PI * 0.55 + i * PI * 0.12, z = (i % 3 - 1) * 0.5; k.sphere(0.33 * R, H, hg, Math.sin(a) * 0.92 * R - 0.12 * R, Math.cos(a) * 0.88 * R + 0.12 * R, z * R * 0.9 * Math.abs(Math.cos(a * 0.5))); }
  }

  function buildHat(c, hg, P, top) {
    const { k, o, R, M } = c, kind = o.hat, hm = M.hat;
    const dome = (sx, sy, sz, y, mat, tl) => { const d = k.mesh(cap('hd' + (tl || 0.5), PI * (tl || 0.5)), mat || hm, hg, -0.05 * R, y, 0); d.scale.set(sx * R, sy * R, sz * R); return d; };
    const brimDisc = (r, y, x, mat, th) => k.sphere([r * R, (th || 0.05) * R, r * R * 0.92], mat || hm, hg, (x || 0) * R, y, 0);
    switch (kind) {
      case 'cap': case 'mailman': { const d = dome(1.06, 0.82, 0.9, 0.36 * R); d.rotation.z = 0.25; const b = k.sphere([0.62 * R, 0.05 * R, 0.6 * R], hm, hg, 0.82 * R, 0.4 * R, 0); b.rotation.z = -0.12; k.sphere(0.08 * R, hm, hg, -0.12 * R, 1.1 * R, 0); if (kind === 'mailman') k.box(0.04 * R, 0.16 * R, 0.25 * R, M.gold, hg, 0.98 * R, 0.6 * R, 0); break; }
      case 'top': k.cyl(0.66 * R, 0.68 * R, 1.5 * R, hm, hg, -0.05 * R, top + 0.62 * R, 0); k.cyl(0.69 * R, 0.69 * R, 0.22 * R, M.black, hg, -0.05 * R, top + 0.05 * R, 0); brimDisc(1.15, top - 0.08 * R, -0.05); break;
      case 'crown': case 'tiara': {
        const gm = k.mat(c.col('hat'), { metal: 0.85, rough: 0.28 }), jm = k.mat('#c0182b', { rough: 0.15, metal: 0.2 }), tiara = kind === 'tiara';
        const ring = k.mesh(geo('pcrown', () => new T.CylinderGeometry(1, 0.92, 1, 24, 1, true)), k.mat(c.col('hat'), { metal: 0.85, rough: 0.28, side: 'double' }), hg, -0.05 * R, top - (tiara ? 0.28 : 0.12) * R, 0);
        ring.scale.set(0.8 * R, (tiara ? 0.14 : 0.42) * R, 0.72 * R);
        const n = tiara ? 3 : 6;
        for (let i = 0; i < n; i++) { const a = tiara ? -0.5 + i * 0.5 : i / n * TAU; const x = Math.cos(a) * 0.8 * R - 0.05 * R, z = Math.sin(a) * 0.72 * R; k.cone(0.12 * R, (tiara ? (i === 1 ? 0.45 : 0.3) : 0.45) * R, gm, hg, x, top + (tiara ? 0.0 : 0.3) * R, z, 6); k.sphere(0.08 * R, i % 2 && !tiara ? k.mat('#2a64c8', { rough: 0.15 }) : jm, hg, x * 1.04, top + (tiara ? -0.18 : 0.12) * R, z * 1.04); }
        if (!tiara) k.sphere([0.75 * R, 0.3 * R, 0.66 * R], k.mat('#8a1f3a', { rough: 0.9 }), hg, -0.05 * R, top + 0.05 * R, 0);
        break;
      }
      case 'wizard': case 'witch': {
        const wz = kind === 'wizard';
        brimDisc(wz ? 1.45 : 1.75, top - 0.12 * R, -0.05, hm, 0.06);
        P.cone = k.tube([[-0.05 * R, top - 0.12 * R, 0], [-0.15 * R, top + 1.3 * R, 0], [-0.5 * R, top + 2.3 * R, 0], [wz ? -0.95 * R : -1.3 * R, top + (wz ? 2.9 : 2.6) * R, 0]], 0.95 * R, 0.02 * R, hm, hg, 12, 14);
        k.mesh(torus(TAU, 0.12), wz ? M.gold : k.mat('#6a2c91'), hg, -0.05 * R, top + 0.05 * R, 0).scale.set(0.9 * R, 0.9 * R, 0.9 * R);
        hg.children[hg.children.length - 1].rotation.x = PI / 2;
        if (wz) { const s = k.extrude(starPts(0.28 * R), 0.06 * R, k.mat('#ffd75a', { metal: 0.6, rough: 0.3, glow: '#a07000', glowK: 0.4 }), hg, 0.62 * R, top + 0.95 * R, 0.2 * R); s.rotation.y = PI / 2 + 0.3; s.rotation.x = -0.15; }
        break;
      }
      case 'helmet': {
        if (c.knight) {   // a great helm: closed, eye slit, breaths, a plume
          const mm = M.metal;
          k.sphere([1.1 * R, 1.12 * R, 0.98 * R], mm, hg, 0.0, 0.05 * R);
          k.cyl(0.98 * R, 0.92 * R, 1.1 * R, mm, hg, 0.02 * R, -0.45 * R, 0).scale.z = 0.9;
          k.box(0.08 * R, 0.1 * R, 1.2 * R, M.black, hg, 1.04 * R, 0.08 * R, 0);
          k.box(0.1 * R, 1.5 * R, 0.08 * R, mm, hg, 1.08 * R, -0.15 * R, 0);
          for (let i = 0; i < 3; i++) for (const s of [-1, 1]) k.box(0.06 * R, 0.05 * R, 0.14 * R, M.black, hg, 1.0 * R, (-0.25 - i * 0.15) * R, s * 0.32 * R);
          P.plume = k.tube([[-0.1 * R, 1.05 * R, 0], [-0.5 * R, 1.7 * R, 0], [-1.3 * R, 1.6 * R, 0], [-1.7 * R, 0.9 * R, 0]], 0.25 * R, 0.08 * R, M.plume, hg, 10, 8);
        } else {   // football helmet: shell, stripe, face mask
          k.sphere([1.12 * R, 1.08 * R, 1.0 * R], hm, hg, -0.06 * R, 0.14 * R);
          k.box(1.9 * R, 0.1 * R, 0.24 * R, M.white, hg, -0.06 * R, 0.85 * R, 0).rotation.z = 0;
          const gm = k.mat('#9aa5b1', { metal: 0.5, rough: 0.4 });
          for (let i = 0; i < 3; i++) { const t = k.mesh(torus(PI * 0.9, 0.06), gm, hg, 0.55 * R, (-0.2 - i * 0.22) * R, 0); t.scale.set(0.75 * R, 0.6 * R, 0.75 * R); t.rotation.set(PI / 2, 0, -PI * 0.45); }
          for (const s of [-1, 1]) { const ep = k.cyl(0.18 * R, 0.18 * R, 0.08 * R, gm, hg, -0.05 * R, -0.05 * R, s * 1.0 * R); ep.rotation.x = PI / 2; }
        }
        break;
      }
      case 'hardhat': dome(1.1, 0.95, 0.95, 0.2 * R); brimDisc(1.35, 0.25 * R, 0, hm, 0.06); k.box(1.6 * R, 0.14 * R, 0.16 * R, hm, hg, -0.05 * R, 1.08 * R, 0); break;
      case 'police': { k.cyl(1.0 * R, 0.84 * R, 0.5 * R, hm, hg, -0.06 * R, top + 0.05 * R, 0).scale.z = 0.9; k.cyl(0.86 * R, 0.86 * R, 0.16 * R, M.black, hg, -0.06 * R, top - 0.22 * R, 0).scale.z = 0.9; const v = k.sphere([0.5 * R, 0.05 * R, 0.6 * R], M.black, hg, 0.72 * R, top - 0.3 * R, 0); v.rotation.z = -0.25; const b = k.extrude(starPts(0.16 * R), 0.05 * R, k.mat(c.col('gold'), { metal: 0.8, rough: 0.3 }), hg, 0.86 * R, top + 0.04 * R, 0); b.rotation.y = PI / 2; break; }
      case 'chef': { const w = M.white; k.cyl(0.84 * R, 0.82 * R, 0.6 * R, w, hg, -0.05 * R, top - 0.05 * R, 0).scale.z = 0.88; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.sphere(0.55 * R, w, hg, Math.cos(a) * 0.5 * R - 0.05 * R, top + 0.85 * R, Math.sin(a) * 0.45 * R); } k.sphere(0.6 * R, w, hg, -0.05 * R, top + 1.05 * R, 0); break; }
      case 'cowboy': case 'pirate': {
        const pr = kind === 'pirate';
        const br = k.mesh(lathe(pr ? 'pirbrim' : 'cowbrim', pr ? [[0, 0], [0.75, 0], [1.25, 0.12], [1.42, 0.7], [1.3, 0.75], [1.15, 0.2], [0.7, 0.08], [0, 0.08]] : [[0, 0], [0.7, 0], [1.35, 0.06], [1.65, 0.34], [1.58, 0.38], [1.3, 0.12], [0.7, 0.06], [0, 0.06]], 22), hm, hg, -0.05 * R, top - 0.3 * R, 0);
        br.scale.set(R, R, R * (pr ? 0.95 : 0.82));
        const cr = k.sphere([0.78 * R, pr ? 0.55 * R : 0.68 * R, 0.68 * R], hm, hg, -0.05 * R, top - 0.05 * R, 0);
        if (!pr) { k.cyl(0.8 * R, 0.8 * R, 0.14 * R, k.mat(shade(c.col('hat'), 0.5)), hg, -0.05 * R, top - 0.15 * R, 0).scale.z = 0.86; k.box(0.9 * R, 0.1 * R, 0.1 * R, k.mat(shade(c.col('hat'), 0.3)), hg, -0.05 * R, top + 0.6 * R, 0); }
        else { k.sphere(0.16 * R, M.white, hg, 0.82 * R, top + 0.12 * R, 0); for (const s of [-1, 1]) { const bn = k.box(0.04 * R, 0.06 * R, 0.4 * R, M.white, hg, 0.84 * R, top - 0.08 * R, 0); bn.rotation.x = s * 0.6; } }
        cr.scale.y *= 1;
        break;
      }
      case 'bandana': { const b = k.mesh(geo('pband', () => new T.CylinderGeometry(1, 1, 1, 22, 1, true)), k.mat(c.col('hat'), { side: 'double', rough: 0.85 }), hg, -0.05 * R, 0.5 * R, 0); b.scale.set(0.98 * R, 0.25 * R, 0.84 * R); b.rotation.z = 0.15; P.tails = []; for (let i = 0; i < 2; i++) { const t = k.group(hg, -0.98 * R, 0.6 * R, (i ? 0.08 : -0.08) * R); k.box(0.9 * R, 0.16 * R, 0.04 * R, hm, t, -0.45 * R, 0, 0); P.tails.push(t); } break; }
      case 'astronaut': {
        const gl = k.mat('#d8ecff', { opacity: 0.22, rough: 0.02, metal: 0.4 });
        k.sphere(1.6 * R, gl, hg, 0.12 * R, -0.05 * R);
        const vz = k.mesh(cap('visor', PI * 0.45), k.mat('#f0c050', { opacity: 0.35, rough: 0.05, metal: 0.9, side: 'double' }), hg, 0.12 * R, -0.05 * R, 0); vz.scale.setScalar(1.63 * R); vz.rotation.z = -1.15;
        const rg = k.mesh(torus(TAU, 0.22), M.white, hg, 0.0, -1.35 * R, 0); rg.scale.set(1.05 * R, 1.05 * R, 1.0 * R); rg.rotation.x = PI / 2;
        break;
      }
      case 'santa': { const fm = k.mat('#fbfbf6', { rough: 1 }); const b = k.mesh(torus(TAU, 0.24), fm, hg, -0.06 * R, 0.62 * R, 0); b.scale.set(0.95 * R, 0.95 * R, 0.82 * R); b.rotation.set(PI / 2, 0.22, 0); P.cone = k.tube([[-0.08 * R, 0.6 * R, 0], [-0.2 * R, 1.6 * R, 0], [-0.9 * R, 1.9 * R, 0], [-1.45 * R, 1.25 * R, 0]], 0.9 * R, 0.08 * R, hm, hg, 12, 12); P.pom = k.sphere(0.24 * R, fm, hg, -1.5 * R, 1.1 * R, 0); break; }
      case 'party': { const cn = k.cone(0.6 * R, 1.6 * R, hm, hg, 0.05 * R, top + 0.62 * R, 0.0); cn.rotation.z = -0.12; k.sphere(0.18 * R, M.gold, hg, 0.15 * R, top + 1.42 * R, 0); for (let i = 0; i < 3; i++) k.sphere(0.07 * R, i % 2 ? M.cloth2 : M.gold, hg, 0.42 * R - i * 0.08 * R, top + (0.15 + i * 0.4) * R, 0.2 * R); break; }
      case 'viking': { dome(1.1, 1.0, 0.95, 0.14 * R, M.metal); k.box(0.1 * R, 0.7 * R, 0.12 * R, M.metal, hg, 1.0 * R, 0.25 * R, 0); k.mesh(torus(TAU, 0.08), M.metal2, hg, -0.05 * R, 0.25 * R, 0).scale.set(1.07 * R, 1.07 * R, 0.94 * R); hg.children[hg.children.length - 1].rotation.x = PI / 2; for (const s of [-1, 1]) k.tube([[-0.05 * R, 0.55 * R, s * 0.85 * R], [0.05 * R, 0.8 * R, s * 1.35 * R], [0.25 * R, 1.4 * R, s * 1.55 * R], [0.4 * R, 1.95 * R, s * 1.4 * R]], 0.22 * R, 0.02 * R, M.horn, hg, 10, 8); break; }
      case 'bow': for (const s of [-1, 1]) { const b = k.sphere([0.35 * R, 0.22 * R, 0.12 * R], hm, hg, -0.25 * R, 0.95 * R, s * 0.3 * R); b.rotation.x = s * 0.5; } k.sphere(0.12 * R, hm, hg, -0.25 * R, 0.98 * R, 0); break;
      case 'fire': { dome(1.12, 1.0, 0.98, 0.16 * R); const bb = k.sphere([0.9 * R, 0.06 * R, 0.95 * R], hm, hg, -0.55 * R, 0.2 * R, 0); bb.rotation.z = 0.3; k.box(1.6 * R, 0.14 * R, 0.14 * R, hm, hg, -0.05 * R, 1.12 * R, 0); const sh = k.extrude([0, 0.35 * R, 0.25 * R, 0.2 * R, 0.22 * R, -0.25 * R, 0, -0.35 * R, -0.22 * R, -0.25 * R, -0.25 * R, 0.2 * R], 0.06 * R, M.gold, hg, 0.95 * R, 0.72 * R, 0); sh.rotation.y = PI / 2; sh.rotation.x = 0; sh.rotation.z = 0; break; }
      case 'beanie': { const d = dome(1.07, 1.0, 0.9, 0.12 * R, hm, 0.52); d.rotation.z = 0.15; const f = k.mesh(torus(TAU, 0.16), hm, hg, -0.02 * R, 0.25 * R, 0); f.scale.set(1.0 * R, 1.0 * R, 0.86 * R); f.rotation.set(PI / 2, 0.15, 0); k.sphere(0.25 * R, hm, hg, -0.15 * R, 1.15 * R, 0); break; }
      case 'flower': { const pm = k.mat('#f28cb1', { rough: 0.6 }); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.sphere([0.06 * R, 0.16 * R, 0.16 * R], pm, hg, 0.2 * R, 0.75 * R + Math.cos(a) * 0.2 * R, 0.72 * R + Math.sin(a) * 0.2 * R); } k.sphere(0.1 * R, M.gold, hg, 0.24 * R, 0.75 * R, 0.74 * R); break; }
      case 'grad': { dome(1.02, 0.8, 0.88, 0.2 * R, M.black); const b = k.box(1.9 * R, 0.08 * R, 1.9 * R, M.black, hg, -0.05 * R, top + 0.05 * R, 0); b.rotation.y = PI / 4; k.box(0.04 * R, 0.7 * R, 0.04 * R, M.gold, hg, 0.6 * R, top - 0.3 * R, 0.6 * R); break; }
      case 'bunny': for (const s of [-1, 1]) { const g = k.group(hg, -0.1 * R, 0.85 * R, s * 0.35 * R); g.rotation.x = s * -0.18; k.sphere([0.2 * R, 1.0 * R, 0.3 * R], hm, g, 0, 0.9 * R, 0); k.sphere([0.06 * R, 0.8 * R, 0.18 * R], k.mat('#f4b6c2'), g, 0.15 * R, 0.9 * R, 0); } break;
      case 'headphones': { const a = k.mesh(torus(PI, 0.1), hm, hg, -0.05 * R, 0.05 * R, 0); a.scale.set(0.95 * R, 1.05 * R, 0.95 * R); a.rotation.y = PI / 2; for (const s of [-1, 1]) { const cp = k.cyl(0.32 * R, 0.32 * R, 0.22 * R, hm, hg, -0.05 * R, 0, s * 0.82 * R); cp.rotation.x = PI / 2; } break; }
    }
  }

  // ---------- things held in the hand (item-local: origin at the grip, +y along the shaft, flat faces toward ±z) ----------
  // world tilt of each item (rotation about z: 0 = upright, negative leans the top forward)
  const TILT = { sword: -0.75, lightsaber: -0.75, wand: -0.75, staff: 0, cane: 0, hammer: -0.45, axe: -0.45, broom: -0.4, club: -0.5, pitchfork: 0, trident: 0, shovel: 0,
    guitar: -1.05, balloon: -0.08, football: 0, basketball: 0, flag: 0, magnifier: -0.7, bat: -0.5, torch: -0.2, book: 0, letter: 0, racket: -0.6, lollipop: -0.35, brush: -0.6, mic: -0.6, stick: -0.75, scythe: -0.06, bolt: 0 };
  const LONG = ['staff', 'cane', 'broom', 'pitchfork', 'shovel', 'balloon', 'flag', 'scythe', 'trident'];
  function buildItem(c, kind, g) {
    const { k, u, M } = c, P = {};
    const wood = M.wood, metal = M.blade, item = M.item;
    const shaft = (y0, y1, r, m) => k.cyl(r * u, r * u, (y1 - y0) * u, m || item, g, 0, (y0 + y1) / 2 * u, 0, 10);
    switch (kind) {
      case 'sword': shaft(-1.5, 2.6, 0.55, M.leather); k.sphere(0.9 * u, M.gold, g, 0, -1.9 * u, 0); k.rbox(6 * u, 0.9 * u, 1.1 * u, M.gold, g, 0, 2.9 * u, 0, 0.35 * u); k.extrude([-0.85 * u, 0, 0.85 * u, 0, 0.65 * u, 19 * u, 0, 22.5 * u, -0.65 * u, 19 * u], 0.45 * u, metal, g, 0, 3.2 * u, 0, 0.15 * u); break;
      case 'lightsaber': k.cyl(0.75 * u, 0.75 * u, 6 * u, k.mat('#c8ced4', { metal: 0.85, rough: 0.25 }), g, 0, 1 * u, 0, 12); k.cyl(0.8 * u, 0.8 * u, 1.2 * u, M.black, g, 0, 3.4 * u, 0, 12); { const sc = c.col('saber'); k.cyl(0.5 * u, 0.5 * u, 25 * u, k.mat(tint(sc, 0.7), { glow: sc, glowK: 2.2 }), g, 0, 16.5 * u, 0, 10); k.cyl(0.85 * u, 0.85 * u, 25 * u, k.mat(sc, { glow: sc, glowK: 1.2, opacity: 0.35 }), g, 0, 16.5 * u, 0, 10); } break;
      case 'wand': k.cyl(0.2 * u, 0.32 * u, 11 * u, M.darkwood, g, 0, 4.5 * u, 0, 8); { const s = k.extrude(starPts(2.6 * u), 0.7 * u, k.mat('#ffd75a', { metal: 0.6, rough: 0.3, glow: '#ffb020', glowK: 0.8 }), g, 0, 11.5 * u, 0, 0.2 * u); P.spin = s; } break;
      case 'staff': k.tube([[0, -20 * u, 0], [0.4 * u, 5 * u, 0], [-0.2 * u, 30 * u, 0]], 0.7 * u, 0.55 * u, M.darkwood, g, 8, 8); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, p = k.cone(0.4 * u, 4 * u, M.darkwood, g, Math.cos(a) * 1.6 * u, 32 * u, Math.sin(a) * 1.6 * u, 6); p.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); } k.sphere(3 * u, k.mat(c.col('gem'), { glow: c.col('gem'), glowK: 0.9, rough: 0.1, metal: 0.1 }), g, 0, 33.5 * u, 0); break;
      case 'cane': k.cyl(0.55 * u, 0.55 * u, 26 * u, M.darkwood, g, 0, -12.5 * u, 0, 10); { const h = k.mesh(torus(PI, 0.22), M.darkwood, g, 2.4 * u, 0.5 * u, 0); h.scale.setScalar(2.4 * u); } k.sphere(0.7 * u, M.black, g, 0, -25.8 * u, 0); break;
      case 'hammer': shaft(-3, 14, 0.6, wood); k.rbox(8 * u, 3 * u, 3 * u, k.mat('#5d6874', { metal: 0.8, rough: 0.35 }), g, 1 * u, 14.5 * u, 0, 0.5 * u); k.cone(1.4 * u, 3 * u, k.mat('#5d6874', { metal: 0.8, rough: 0.35 }), g, -4.5 * u, 14.5 * u, 0).rotation.z = PI / 2; break;
      case 'axe': shaft(-3, 17, 0.65, wood); k.extrude([0, 0, 6 * u, -3.5 * u, 7.5 * u, 0, 7.5 * u, 6 * u, 6 * u, 9 * u, 0, 4.5 * u], 0.8 * u, metal, g, 0.5 * u, 11.5 * u, 0, 0.25 * u); break;
      case 'broom': shaft(-20, 26, 0.5, wood); { const b = k.cone(4.2 * u, 11 * u, M.straw, g, 0, -25 * u, 0, 12); b.rotation.x = PI; b.scale.z = 0.45; k.cyl(1.2 * u, 1.2 * u, 1.6 * u, k.mat('#8b2a1a'), g, 0, -20 * u, 0, 10); } break;
      case 'club': k.tube([[0, -3 * u, 0], [0.5 * u, 6 * u, 0], [1.2 * u, 16 * u, 0]], 0.9 * u, 3.2 * u, wood, g, 8, 10); k.sphere(3.3 * u, wood, g, 1.3 * u, 16.5 * u, 0); for (let i = 0; i < 3; i++) k.sphere(0.8 * u, M.darkwood, g, (i - 1) * 2 * u + 1 * u, (11 + i * 2) * u, 2.4 * u); break;
      case 'pitchfork': case 'trident': {
        const tri = kind === 'trident', mm = tri ? k.mat(c.col('gold'), { metal: 0.85, rough: 0.3 }) : metal;
        shaft(-18, 24, 0.55, tri ? mm : wood); k.box(9 * u, 1 * u, 1 * u, mm, g, 0, 24 * u, 0);
        for (let i = -1; i <= 1; i++) { k.cyl(0.4 * u, 0.4 * u, 8 * u, mm, g, i * 4 * u, 28 * u, 0, 8); k.cone(0.6 * u, 2 * u, mm, g, i * 4 * u, 33 * u, 0, 8); }
        break;
      }
      case 'shovel': shaft(-20, 10, 0.55, wood); k.box(4 * u, 1 * u, 1 * u, wood, g, 0, 10 * u, 0); k.extrude([-3.6 * u, 0, 3.6 * u, 0, 3.6 * u, -6 * u, 0, -9.5 * u, -3.6 * u, -6 * u], 0.6 * u, metal, g, 0, -20 * u, 0, 0.2 * u); break;
      case 'guitar': { const gm = k.mat(c.col('item') === SB.ROLES.item ? '#c0392b' : c.col('item'), { rough: 0.25, metal: 0.1 }); k.sphere([6 * u, 5.2 * u, 1.6 * u], gm, g, 0, -10 * u, 0); k.sphere([4.4 * u, 3.8 * u, 1.6 * u], gm, g, 0, -4 * u, 0); k.mesh(disc(), M.black, g, 0, -6.5 * u, 1.65 * u).scale.setScalar(1.4 * u); k.box(1.6 * u, 16 * u, 0.9 * u, M.darkwood, g, 0, 6 * u, 0.4 * u); k.box(2.2 * u, 3.2 * u, 0.9 * u, M.darkwood, g, 0, 15 * u, 0.4 * u); break; }
      case 'balloon': { k.cyl(0.08 * u, 0.08 * u, 30 * u, M.white, g, 0, 15 * u, 0, 4); const b = k.group(g, 0, 30 * u, 0); P.bob = b; const bm = k.mat(c.col('balloon'), { rough: 0.15, metal: 0.05 }); k.sphere([7 * u, 8.5 * u, 7 * u], bm, b, 0, 8.6 * u, 0); k.cone(0.9 * u, 1.4 * u, bm, b, 0, 0.3 * u, 0, 8); break; }
      case 'football': { const f = k.sphere([5.5 * u, 3.4 * u, 3.4 * u], k.mat(c.col('leather'), { rough: 0.6 }), g, 2 * u, 1 * u, 0); f.rotation.z = -0.4; k.box(3 * u, 0.3 * u, 0.5 * u, M.white, g, 2.3 * u, 4.2 * u, 0.8 * u).rotation.z = -0.4; break; }
      case 'basketball': { const bm = k.mat(c.col('orange'), { rough: 0.7 }); k.sphere(5 * u, bm, g, 3 * u, 2 * u, 0); for (let i = 0; i < 2; i++) { const r = k.mesh(torus(TAU, 0.02), M.black, g, 3 * u, 2 * u, 0); r.scale.setScalar(5.02 * u); r.rotation.y = i * PI / 2; } break; }
      case 'flag': {
        shaft(-14, 29, 0.45, k.mat('#8c8c8c', { metal: 0.6, rough: 0.4 })); k.sphere(0.9 * u, M.gold, g, 0, 29.5 * u, 0);
        const fg = new T.PlaneGeometry(16 * u, 10 * u, 8, 1); fg.translate(8 * u, 23 * u, 0); k.own.push(fg);
        P.flag = k.mesh(fg, k.mat(c.col('cloth2'), { side: 'double', rough: 0.8 }), g); P.flagX = Float32Array.from(fg.attributes.position.array);
        break;
      }
      case 'magnifier': shaft(-1, 6, 0.55, M.darkwood); { const r = k.mesh(torus(TAU, 0.12), M.gold, g, 0, 11 * u, 0); r.scale.setScalar(5 * u); k.mesh(disc(), k.mat('#cfeeff', { opacity: 0.35, rough: 0.02 }), g, 0, 11 * u, 0).scale.setScalar(4.9 * u); } break;
      case 'bat': k.tube([[0, -3 * u, 0], [0, 8 * u, 0], [0, 20 * u, 0]], 0.6 * u, 1.9 * u, M.wood, g, 6, 10); break;
      case 'torch': { k.cyl(0.6 * u, 0.9 * u, 13 * u, M.darkwood, g, 0, 3.5 * u, 0, 8); const f = P.flame = k.group(g, 0, 10 * u, 0); k.cone(2.6 * u, 7 * u, k.mat('#ff8c1a', { glow: '#ff6a00', glowK: 1.8, opacity: 0.9 }), f, 0, 3.5 * u, 0, 10); k.cone(1.5 * u, 4.5 * u, k.mat('#ffe07a', { glow: '#ffd23f', glowK: 2 }), f, 0, 2.4 * u, 0, 8); break; }
      case 'book': k.rbox(7 * u, 9 * u, 2.4 * u, k.mat(c.col('book'), { rough: 0.7 }), g, 1 * u, 3 * u, 0, 0.4 * u); k.box(6.6 * u, 8.4 * u, 1.9 * u, M.paper, g, 1.5 * u, 3 * u, 0); break;
      case 'letter': k.box(8 * u, 5.5 * u, 0.3 * u, M.paper, g, 2.5 * u, 2.5 * u, 0); break;
      case 'racket': shaft(-1, 7, 0.55, M.white); { const r = k.mesh(torus(TAU, 0.06), k.mat('#3d7ee8', { rough: 0.4 }), g, 0, 14 * u, 0); r.scale.set(5 * u, 7 * u, 5 * u); k.mesh(disc(), k.mat('#f4f4f4', { opacity: 0.4 }), g, 0, 14 * u, 0).scale.set(4.8 * u, 6.8 * u, 1); } break;
      case 'lollipop': shaft(0, 10, 0.3, M.white); { const d = k.cyl(4 * u, 4 * u, 1.2 * u, k.mat(c.col('candy'), { rough: 0.15 }), g, 0, 14 * u, 0); d.rotation.x = PI / 2; const s = k.mesh(torus(TAU * 0.9, 0.08), M.white, g, 0, 14 * u, 0.65 * u); s.scale.setScalar(2.4 * u); } break;
      case 'brush': shaft(-1, 11, 0.5, M.wood); k.cyl(0.8 * u, 0.7 * u, 2.4 * u, metal, g, 0, 12 * u, 0, 8); k.cone(0.9 * u, 3.2 * u, k.mat(c.col('cloth2'), { rough: 0.8 }), g, 0, 14.8 * u, 0, 8); break;
      case 'mic': shaft(-1, 6, 0.8, M.black); k.sphere(2 * u, k.mat('#555b62', { metal: 0.7, rough: 0.4 }), g, 0, 7.8 * u, 0); break;
      case 'stick': k.tube([[0, -2 * u, 0], [0.8 * u, 6 * u, 0], [0, 15 * u, 0]], 0.6 * u, 0.4 * u, M.wood, g, 6, 6); break;
      case 'scythe': k.tube([[0, -24 * u, 0], [1 * u, 6 * u, 0], [0, 36 * u, 0]], 0.65 * u, 0.6 * u, M.darkwood, g, 8, 8); k.cyl(0.5 * u, 0.5 * u, 6 * u, M.darkwood, g, 3 * u, 8 * u, 0, 6).rotation.z = PI / 2;
        k.extrude([0, 37 * u, 8 * u, 40 * u, 17 * u, 40 * u, 25 * u, 36 * u, 29 * u, 29 * u, 22 * u, 33.5 * u, 14 * u, 35.5 * u, 6 * u, 34.5 * u, 0, 33.5 * u], 0.6 * u, k.mat('#c7ccd2', { metal: 0.9, rough: 0.25 }), g, 0, 0, 0, 0.2 * u); break;
      case 'bolt': k.extrude([3 * u, 14 * u, 8 * u, 14 * u, 4 * u, 6 * u, 9 * u, 6 * u, -1 * u, -6 * u, 2 * u, 3 * u, -2 * u, 3 * u], 1.2 * u, k.mat('#ffe14a', { glow: '#ffc400', glowK: 1.6 }), g, 0, 0, 0, 0.3 * u); break;
    }
    return P;
  }

  function buildShield(c, g, viking) {
    const { k, u } = c, sm = k.mat(c.col('shield'), { rough: 0.6 });
    const s = k.group(g, 1.5 * u, 0, 0);
    s.rotation.y = -PI / 2 + 0.85;   // its face points forward, turned a little toward the camera
    if (viking) {
      const d = k.cyl(7.5 * u, 7.5 * u, 1 * u, sm, s, 0, 0, 0, 22); d.rotation.x = PI / 2;
      const r = k.mesh(torus(TAU, 0.06), c.M.metal, s, 0, 0, 0.1 * u); r.scale.setScalar(7.5 * u);
      k.sphere([2 * u, 2 * u, 1.4 * u], c.M.metal, s, 0, 0, 0.6 * u);
      for (let i = -2; i <= 2; i++) k.box(0.2 * u, 14 * u * Math.sqrt(1 - (i / 2.6) ** 2), 0.1 * u, k.mat(shade(c.col('shield'), 0.3)), s, i * 2.6 * u, 0, 0.55 * u);
    } else {
      k.extrude([-6 * u, 7 * u, 6 * u, 7 * u, 6 * u, 1 * u, 4 * u, -5 * u, 0, -9 * u, -4 * u, -5 * u, -6 * u, 1 * u], 1.2 * u, sm, s, 0, 0, 0, 0.4 * u);
      k.box(1.4 * u, 14 * u, 0.5 * u, c.M.gold, s, 0, -1 * u, 0.6 * u); k.box(10 * u, 1.4 * u, 0.5 * u, c.M.gold, s, 0, 2.5 * u, 0.6 * u);
    }
    return s;
  }

  // wings on the back: returns [near, far] pivots (rotation.y opens/closes them)
  function buildWings(c, g, kind) {
    const { k, u } = c, out = [];
    const sc = kind === 'fairy' ? 0.8 : 1;
    for (const s of [1, -1]) {
      const p = k.group(g, 0, 0, s * 1.5 * u); out.push(p);
      if (kind === 'fairy') {
        const fm = k.mat(c.col('fairywing'), { opacity: 0.45, side: 'double', rough: 0.15, glow: '#bfe8ff', glowK: 0.25 });
        const ell = (rx, ry, ang, cx, cy) => { const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pts.push(cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)); } return pts; };
        k.extrude(ell(9 * u * sc, 5 * u * sc, -0.6, -8 * u * sc, 6 * u * sc), 0.2 * u, fm, p, 0, 0, 0, 0);
        k.extrude(ell(6.5 * u * sc, 3.6 * u * sc, 0.5, -6 * u * sc, -4 * u * sc), 0.2 * u, fm, p, 0, 0, 0, 0);
      } else if (kind === 'bat') {
        k.extrude([0, 2 * u, -12 * u, 12 * u, -24 * u, 8 * u, -21 * u, 0, -16 * u, 2 * u, -12 * u, -3 * u, -7 * u, 0, 0, -3 * u], 0.5 * u, k.mat(c.col('batwing'), { side: 'double', rough: 0.7 }), p, 0, 0, 0, 0.1 * u);
      } else {   // feathered: a covert layer over long flight feathers
        const wm = k.mat(c.col('wing'), { rough: 0.85 }), wm2 = k.mat(shade(c.col('wing'), 0.08), { rough: 0.9 });
        k.extrude([0, 3 * u, -5 * u, 11 * u, -14 * u, 17 * u, -22 * u, 16 * u, -27 * u, 9 * u, -28 * u, 1 * u, -25 * u, -6 * u, -22 * u, -3 * u, -20 * u, -11 * u, -16 * u, -7 * u, -13 * u, -14 * u, -9 * u, -8 * u, -5 * u, -12 * u, -3 * u, -5 * u, 0, -3 * u], 1.0 * u, wm2, p, 0, 0, 0, 0.35 * u);
        k.extrude([0, 4 * u, -5 * u, 11.5 * u, -13 * u, 16 * u, -20 * u, 14 * u, -19 * u, 7 * u, -15 * u, 3 * u, -10 * u, 1 * u, -5 * u, -1 * u, 0, -1 * u], 1.0 * u, wm, p, 0.2 * u, 0, s * 0.5 * u, 0.4 * u);
      }
    }
    return out;
  }

  // ---------- the humanoid ----------
  M3.kinds.humanoid = function (e, k, tpl) {
    const o = tpl.o, def = e.def, name = def.name, H = tpl.h, u = H / 70;
    const pal = e.pal || def.pal || {};
    const col = k.col;
    const ape = def.cat === 'animal';
    const furry = !!o.fur || ape, plush = !!(o.fur && o.bigHead), bony = !!o.ribs, robot = !!o.boxy, wrap = !!o.wrap;
    const baby = !!o.bigHead && H <= 40 && !ape;
    const kid = def.cat === 'person' && H < 60 && !o.bigHead;
    const female = (o.dress || ['long', 'ponytail', 'bun', 'pigtails'].includes(o.hair)) && o.beard === 'none' && !o.mustache && !furry && !robot && !bony;
    const knight = o.hat === 'helmet' && o.shield;
    const fish = !!o.fishTail, genie = name === 'genie';
    const robe = !!o.robe || o.hat === 'wizard' || o.hat === 'witch';
    const heavy = !!o.belly;
    // proportions: heads tall, leg length and shoulder width depend on age and build
    const heads = plush ? 2.9 : baby ? 3.7 : o.bigHead ? (H < 60 ? 3.3 : 4.8) : kid ? 5.6 : ape ? 5.0 : def.cat !== 'person' && (def.tags || []).includes('big') ? 6.2 : H >= 130 ? 7.4 : 6.9;
    const bulky = !!(def.tags && def.tags.includes('big')) && !ape;   // ogres, giants, cyclopes, yetis
    const hh = H / heads * (o.bigHead ? 1 : Math.pow((o.headR || 9) / 9, 0.6)), R = hh / 2;
    const legFrac = plush ? 0.28 : baby ? 0.32 : ape ? 0.38 : kid ? 0.44 : 0.47;
    const footY = -H / 2, ankH = 0.035 * H;
    const headC = H / 2 - 1.02 * R, chin = headC - 0.98 * R;
    const neckL = (baby || plush) ? 0.1 * hh : furry ? 0.14 * hh : 0.2 * hh;
    const tTop = chin - neckL, shY = tTop - 0.018 * H;
    const hipY = footY + legFrac * H, crotch = hipY - 0.045 * H, tLen = tTop - crotch;
    const sw = (bulky ? 1.38 : 1) * (ape || o.fur ? 0.14 : baby ? 0.13 : robot ? 0.12 : female ? 0.094 : kid ? 0.1 : 0.108) * H * (heavy ? 1.08 : 1);
    const tw = sw * 0.94, dr = (baby || ape || plush || furry) ? 0.8 : robot ? 0.7 : 0.62, td = tw * dr;
    const hipW = tw * 0.46;
    const lm = (plush ? 1.7 : baby ? 1.35 : furry ? 1.6 : bony ? 0.42 : robot ? 1.15 : kid ? 1.05 : 1) * (heavy && !furry ? 1.12 : 1);
    const am = lm * (female ? 0.88 : 1) * (bulky ? 1.45 : 1);
    const armL = (ape ? 0.47 : plush ? 0.26 : baby ? 0.28 : kid ? 0.32 : 0.335) * H, upL = armL * 0.53, foL = armL * 0.47;
    const legL = hipY - footY - ankH, thL = legL * 0.52, shL = legL * 0.48;
    const c = { k, o, R, u, H, def, col, furry, plush, bony, knight, witch: o.hat === 'witch' };

    // ---- colours & materials (palette roles as in the 2D drawing) ----
    let furC = pal.fur || (ape ? col('body') : col('fur'));
    if (new T.Color(furC).getHSL({}).l > 0.88) furC = shade(furC, 0.1);   // white fur still shows its form
    const skinC = c.skinC = col('skin');
    let faceC = furry ? (ape ? (pal.skin || '#c9a184') : skinC) : skinC;
    if (furry && !plush && faceC === furC) faceC = shade(furC, 0.3);
    c.faceC = faceC; c.clothC = col('cloth');
    c.iris = pal.iris || (def.cat === 'person' ? IRIS[Math.floor((e.seed || 0) * 13) % IRIS.length] : o.oneEye ? '#a0521a' : '#7a4a1a');
    const mt = (cc, o2) => k.mat(cc, o2);
    const M = c.M = {
      skinH: mt(skinC, { rough: 0.55 }), face: mt(faceC, { rough: 0.7 }), fur: mt(furC, { rough: 0.95 }), belly: mt(plush ? tint(furC, 0.45) : tint(furC, 0.3), { rough: 0.95 }),
      cloth: mt(col('cloth'), { rough: 0.85 }), cloth2: mt(col('cloth2'), { rough: 0.8 }), hair: mt(col('hair'), { rough: 0.75 }), hat: mt(col('hat'), { rough: 0.7 }),
      metal: mt(col('metal'), { metal: 0.75, rough: 0.32 }), metal2: mt(shade(col('metal'), 0.3), { metal: 0.7, rough: 0.4 }), gold: mt(col('gold'), { metal: 0.85, rough: 0.3 }),
      black: mt('#141414', { rough: 0.5 }), white: mt('#f6f6f2', { rough: 0.8 }), teeth: mt(col('teeth'), { rough: 0.35 }), dark: mt('#1c2024', { rough: 0.4, metal: 0.3 }),
      wood: mt(col('wood'), { rough: 0.8 }), darkwood: mt(shade(col('item'), 0.15), { rough: 0.75 }), leather: mt(col('leather'), { rough: 0.6 }), straw: mt(col('straw'), { rough: 1 }),
      paper: mt(col('paper'), { rough: 0.9 }), item: mt(col('item'), { rough: 0.75 }), blade: mt('#cfd6dd', { metal: 0.9, rough: 0.22 }), brow: mt(shade(col('hair'), 0.25), { rough: 0.9 }),
      hairTie: mt(col('cloth2')), nose: mt(col('nose'), { rough: 0.25 }), wart: mt(shade(skinC, 0.2)), plume: mt(col('cloth2'), { rough: 0.9 })
    };
    if (bony || wrap) M.skinH = mt(skinC, { rough: bony ? 0.6 : 0.95 });
    const skinB = furry ? M.fur : M.skinH;
    M.skin = skinB;
    const sleeveM = fish || genie ? M.skinH : furry ? M.fur : bony ? M.skinH : robot ? M.metal : wrap ? M.skinH : knight ? M.metal : M.cloth;
    const shortSleeve = kid || ['basketball player', 'soccer player', 'tennis player', 'rockstar', 'caveman', 'scarecrow'].includes(name) || genie || fish;
    const foreM = shortSleeve && !furry && !robot ? M.skinH : sleeveM;
    const legM = furry ? M.fur : bony ? M.skinH : robot ? M.metal : wrap ? M.skinH : knight ? M.metal : o.hat === 'astronaut' || o.hat === 'santa' || baby ? M.cloth : (o.dress || robe) ? M.skinH : mt(col('pants'), { rough: 0.85 });
    const shoeM = furry ? (ape ? M.face : M.fur) : bony || wrap ? M.skinH : robot ? M.metal2 : baby ? M.skinH : o.hat === 'santa' ? M.black : o.hat === 'astronaut' ? M.white : mt(col('shoe'), { rough: 0.45 });
    const handM = robot ? M.metal2 : plush ? M.belly : furry ? M.face : knight ? M.metal : M.skinH;
    const shirtM = furry ? M.fur : bony ? null : robot ? M.metal : wrap ? M.skinH : (fish || genie) ? M.skinH : M.cloth;

    // ---- skeleton of groups ----
    const body = k.group(k.root, 0, hipY, 0);           // hips: bob and lean pivot
    const spine = k.group(body, 0, 0, 0);
    const sy = v => v - hipY;                            // model y -> body-local y
    // trousers / pelvis
    const style = (baby || plush || ape || furry || heavy || bulky) ? 'b' : female ? 'f' : 'm';
    if (!bony && !fish && !genie && !furry && !wrap) { const p = k.mesh(torsoGeo(style, 'p'), legM === M.skinH && !(wrap || furry) ? M.cloth : legM, body, 0, sy(crotch), 0); p.scale.set(td, tLen, tw); }
    // legs
    const legs = [];
    if (!fish && !genie) for (const s of [1, -1]) {
      const hg = k.group(body, 0, 0, s * hipW);
      const r0 = 0.047 * H * lm * (bulky ? 1.4 : 1), r1 = 0.03 * H * lm * (bulky ? 1.4 : 1), r2 = 0.019 * H * lm * (bulky ? 1.4 : 1);
      const th = k.limb(thL, r0, r1, legM, hg);
      const sh = k.limb(shL, r1 * 0.98, r2, legM, th, 0, -thL, 0);
      if (bony) k.sphere(r1 * 1.5, M.skinH, th, 0, -thL, 0);
      if (knight) k.sphere(r1 * 1.45, M.metal2, th, r1 * 0.3, -thL, 0);
      const an = k.group(sh, 0, -shL, 0);
      const fl = 0.125 * H * (baby ? 0.85 : furry ? 1.2 : 1), fh = ankH * 0.95, fw = 0.044 * H * Math.max(1, lm * 0.8);
      if (furry || bony) k.sphere([fl * 0.5, fh * 0.55, fw * 0.5], shoeM, an, fl * 0.22, -ankH * 0.55, 0);
      else { k.sphere([fl * 0.5, fh * 0.6, fw * 0.5], shoeM, an, fl * 0.26, -ankH * 0.5, 0); k.sphere([fl * 0.22, fh * 0.75, fw * 0.45], shoeM, an, 0, -ankH * 0.35, 0); }
      legs.push({ hg, th, sh, an });
    }
    // torso
    if (bony) {   // spine, ribcage, pelvis
      for (let i = 0; i < 6; i++) k.cyl(0.012 * H, 0.012 * H, tLen * 0.14, M.skinH, spine, -td * 0.3, sy(crotch) + tLen * (0.2 + i * 0.13), 0, 8);
      for (let i = 0; i < 4; i++) { const r = k.mesh(torus(PI * 1.5, 0.08), M.skinH, spine, -td * 0.3, sy(crotch) + tLen * (0.82 - i * 0.1), 0); const w = tw * (0.85 - i * 0.03); r.scale.set(td * 1.1, w, w); r.rotation.set(PI / 2, 0, PI * 0.25); }
      k.sphere([td * 0.6, 0.04 * H, tw * 0.7], M.skinH, spine, 0, sy(crotch) + tLen * 0.08, 0);
      k.sphere([td * 0.4, 0.03 * H, tw * 0.9], M.skinH, spine, -td * 0.1, sy(tTop) - 0.01 * H, 0);
    } else if (robot) {
      k.rbox(td * 2, tLen * 0.72, tw * 2, M.metal, spine, 0, sy(crotch) + tLen * 0.6, 0, 0.03 * H);
      k.rbox(td * 0.3, tLen * 0.3, tw * 1.0, M.dark, spine, td * 0.95, sy(crotch) + tLen * 0.62, 0, 0.01 * H);
      const lm2 = k.mat('#59ff8a', { glow: '#2bff6a', glowK: 1.3 }), lm3 = k.mat('#ff5a4a', { glow: '#ff2a1a', glowK: 1.3 });
      k.sphere(0.018 * H, lm2, spine, td * 1.1, sy(crotch) + tLen * 0.67, -tw * 0.25); k.sphere(0.018 * H, lm3, spine, td * 1.1, sy(crotch) + tLen * 0.67, tw * 0.25);
      k.cyl(tw * 0.5, tw * 0.55, tLen * 0.25, M.metal2, spine, 0, sy(crotch) + tLen * 0.15, 0).scale.x = dr;
    } else {
      const sh = k.mesh(torsoGeo(style, fish || genie || furry || wrap ? 'w' : 's'), shirtM, spine, 0, sy(crotch), 0); sh.scale.set(td, tLen, tw);
      if (furry && !plush) k.sphere([td * 0.5, tLen * 0.3, tw * 0.6], ape ? M.face : M.belly, spine, td * 0.55, sy(crotch) + tLen * 0.62, 0);
      if (plush) k.sphere([td * 0.6, tLen * 0.36, tw * 0.62], M.belly, spine, td * 0.5, sy(crotch) + tLen * 0.42, 0);
      if (heavy && !furry) k.sphere([td * 0.95, tLen * 0.4, tw * 0.92], shirtM, spine, td * 0.5, sy(crotch) + tLen * 0.42, 0);
      if (wrap) for (let i = 0; i < 6; i++) { const r = k.mesh(torus(TAU, 0.05), mt(i % 2 ? shade(skinC, 0.12) : tint(skinC, 0.15), { rough: 1 }), spine, 0, sy(crotch) + tLen * (0.15 + i * 0.14), 0); r.scale.set(td * 1.04, tw * 1.02, 1); r.scale.z = tw * 1.0; r.rotation.set(PI / 2, (i % 2 ? 0.12 : -0.1), 0); }
    }
    // shaggy fur: clumps of hair hanging from the shoulders, chest, back and hips
    if (furry && !plush) {
      const sm = mt(shade(furC, 0.08), { rough: 1 }), cl = 0.085 * H;
      for (let i = 0; i < 21; i++) {
        const a = i / 7 * TAU + (i % 3) * 0.3, row = i % 3, y = sy(crotch) + tLen * (row === 2 ? 0.25 : row ? 0.58 : 0.92);
        const cn = k.cone(cl * 0.3, cl, sm, spine, Math.cos(a) * td * 0.95, y, Math.sin(a) * tw * 0.95, 5);
        cn.rotation.set(Math.sin(a) * 2.6, 0, -Math.cos(a) * 2.6);
      }
    }
    // dress / robe
    if (o.dress && !robe) { const d = k.mesh(skirtGeo(1.9), mt(col('cloth'), { rough: 0.8, side: 'double' }), body, 0, sy(crotch) + tLen * 0.42, 0); d.scale.set(td * 0.95, (baby || kid ? 0.25 : 0.27) * H, tw * 0.9); }
    if (robe) { const rTop = sy(shY) - 0.01 * H, d = k.mesh(skirtGeo(1.75, o.tattered), mt(col('cloth'), { rough: 0.9, side: 'double' }), spine, 0, rTop, 0); d.scale.set(td * 1.05, rTop - sy(footY) - 0.01 * H, tw * 1.0); }
    // fish tail / genie smoke
    let tailG = null;
    if (fish || genie) {
      tailG = k.group(body, 0, sy(crotch) + 0.04 * H, 0);
      const L = crotch - footY, tm = fish ? mt(col('tail'), { rough: 0.35, metal: 0.15 }) : mt(skinC, { rough: 0.6, opacity: 0.88 });
      if (fish) {
        k.tube([[0, 0.02 * H, 0], [0.02 * H, -L * 0.35, 0], [0, -L * 0.7, 0], [-0.05 * H, -L * 0.95, 0]], u => tw * (1 - u * 0.82) * (u < 0.15 ? 0.95 + u : 1), 0, tm, tailG, 14, 12);
        const fin = k.extrude([0, 0, 0.12 * H, -0.05 * H, 0.16 * H, -0.12 * H, 0.06 * H, -0.06 * H, 0, -0.1 * H, -0.06 * H, -0.06 * H, -0.16 * H, -0.12 * H, -0.12 * H, -0.05 * H], 0.012 * H, mt(tint(col('tail'), 0.15), { rough: 0.4, side: 'double' }), tailG, -0.05 * H, -L * 0.95, 0, 0.003 * H);
        fin.rotation.y = PI / 2;
        for (const s of [-1, 1]) k.sphere([tw * 0.25, tw * 0.22, tw * 0.3], M.cloth2, spine, td * 0.62, sy(crotch) + tLen * 0.73, s * tw * 0.36);
      } else {
        k.tube([[0, 0.02 * H, 0], [0.02 * H, -L * 0.3, 0], [-0.06 * H, -L * 0.6, 0], [-0.02 * H, -L * 0.85, 0.02 * H], [0.06 * H, -L * 0.8, 0]], u => tw * (1 - u * 0.9) * 0.95, 0, tm, tailG, 16, 12);
        for (const s of [-1, 1]) { const v = k.box(td * 0.1, tLen * 0.62, tw * 0.6, M.cloth2, spine, td * 0.82, sy(crotch) + tLen * 0.6, s * tw * 0.58); v.rotation.y = s * 0.7; }
        k.mesh(torus(TAU, 0.12), M.gold, spine, 0, sy(crotch) + tLen * 0.12, 0).scale.set(td * 0.95, tw * 0.95, tw * 0.95);
        spine.children[spine.children.length - 1].rotation.x = PI / 2;
      }
    }
    // arms
    const arms = [];
    for (const s of [1, -1]) {
      const g = k.group(spine, 0, sy(shY), s * sw);
      const r0 = 0.028 * H * am, r1 = 0.021 * H * am, r2 = 0.016 * H * am;
      k.sphere([r0 * 1.12, r0 * 1.2, r0 * 1.1], sleeveM, g, 0, -r0 * 0.3, -s * r0 * 0.25);
      const up = k.limb(upL, r0, r1, sleeveM, g);
      const fo = k.limb(foL, r1 * 0.97, r2, foreM, up, 0, -upL, 0);
      if (bony) k.sphere(r1 * 1.6, M.skinH, up, 0, -upL, 0);
      if (furry && !plush) for (let j = 0; j < 3; j++) { const cn = k.cone(r1 * 0.8, r1 * 3, M.fur, j < 2 ? up : fo, -r1 * 0.7, j < 2 ? -upL * (0.55 + j * 0.4) : -foL * 0.6, s * r1 * 0.3 * (j - 1), 5); cn.rotation.z = 2.5; }
      if (robot || knight) k.sphere(r1 * 1.35, M.metal2, up, 0, -upL, 0);
      if (!shortSleeve && !furry && !robot && !bony && !wrap && !knight) k.cyl(r2 * 1.25, r2 * 1.2, r2 * 1.4, M.cloth, fo, 0, -foL + r2 * 0.6, 0, 12);
      const hand = k.group(fo, 0, -foL, 0);
      const hs = 0.05 * H * (baby ? 0.85 : furry ? 1.2 : bony ? 0.7 : 1) * (kid ? 0.95 : 1);
      if (s > 0 && o.hook) { const h = k.mesh(torus(PI * 1.3, 0.13), M.metal, hand, 0.1 * hs, -hs * 0.9, 0); h.scale.setScalar(hs * 0.5); h.rotation.z = PI * 1.1; k.cyl(hs * 0.45, hs * 0.5, hs * 0.5, M.darkwood, hand, 0, -hs * 0.15, 0, 10); }
      else { k.sphere([hs * 0.38, hs * 0.55, hs * 0.24], handM, hand, 0.04 * hs, -hs * 0.45, 0); k.sphere([hs * 0.14, hs * 0.26, hs * 0.13], handM, hand, hs * 0.32, -hs * 0.3, s * hs * 0.1).rotation.z = 0.5; }
      arms.push({ g, up, fo, hand, s });
    }
    // ---- costume parts on the chest and back ----
    const chestY = sy(crotch) + tLen * 0.72, frontX = td * 1.0;
    const front = (m2, x, y, z) => { m2.position.set(x, y, z || 0); m2.rotation.y = PI / 2; return m2; };
    if (o.tie) { const t2 = k.extrude([0, 0, -0.012 * H, -0.02 * H, 0, -0.1 * H, 0.012 * H, -0.02 * H], 0.006 * H, M.cloth2, spine, 0, 0, 0, 0.002 * H); front(t2, frontX * 1.02, sy(tTop) - 0.008 * H); t2.rotation.z = 0.12; }
    if (o.bowtie) for (const s of [-1, 1]) { const b = k.cone(0.02 * H, 0.04 * H, M.cloth2, spine, frontX * 0.75, sy(tTop) - 0.005 * H, s * 0.02 * H, 10); b.rotation.x = -s * PI / 2; }
    if (o.badge) front(k.extrude(starPts(0.022 * H), 0.006 * H, M.gold, spine, 0, 0, 0, 0.002 * H), frontX * 1.0, chestY + 0.01 * H, tw * 0.4);
    if (o.emblem) { const em = k.extrude([0, 0.05 * H, 0.06 * H, 0.02 * H, 0, -0.05 * H, -0.06 * H, 0.02 * H], 0.008 * H, M.gold, spine, 0, 0, 0, 0.003 * H); front(em, frontX * 1.03, chestY, 0); front(k.extrude(starPts(0.025 * H), 0.006 * H, M.cloth2, spine, 0, 0, 0, 0.002 * H), frontX * 1.06, chestY + 0.004 * H, 0); }
    if (o.stethoscope) { const st = k.mesh(torus(PI, 0.06), M.dark, spine, td * 0.3, sy(tTop) - 0.005 * H, 0); st.scale.set(td * 0.9, 0.09 * H, tw * 0.55); st.rotation.set(PI / 2, 0, PI); st.scale.y = tw * 0.6; k.cyl(0.015 * H, 0.015 * H, 0.006 * H, M.metal, spine, frontX * 1.02, chestY - 0.05 * H, tw * 0.4).rotation.z = PI / 2; k.cyl(0.003 * H, 0.003 * H, 0.08 * H, M.dark, spine, frontX * 0.98, chestY - 0.012 * H, tw * 0.45); }
    if (o.apron) { const ap = k.box(0.006 * H, tLen * 0.95, tw * 1.25, mt(col('apron'), { rough: 0.9 }), spine, frontX * 1.03, sy(crotch) + tLen * 0.3, 0); ap.rotation.z = 0.05; }
    if (o.stripes) for (let i = 0; i < 4; i++) { const r = k.mesh(torus(TAU, 0.06), M.black, spine, 0, sy(crotch) + tLen * (0.45 + i * 0.13), 0); r.scale.set(td * 1.07, tw * 1.07, 1); r.scale.z = tw * 1.07; r.rotation.x = PI / 2; }
    if (o.hat === 'santa' || heavy && def.cat === 'person' && o.hat === 'crown') { const b = k.mesh(torus(TAU, 0.08), M.black, spine, td * 0.1, sy(crotch) + tLen * 0.36, 0); b.scale.set(td * 1.25, tw * 1.08, 1); b.scale.z = tw * 1.08; b.rotation.x = PI / 2; front(k.box(0.05 * H, 0.04 * H, 0.008 * H, M.gold, spine), td * 1.35, sy(crotch) + tLen * 0.36, 0); }
    if (o.backpack) { const big = o.hat === 'astronaut'; k.rbox(td * (big ? 1.1 : 0.8), tLen * (big ? 0.75 : 0.55), tw * (big ? 1.5 : 1.2), big ? M.white : M.cloth2, spine, -td * (big ? 1.35 : 1.25), sy(crotch) + tLen * 0.6, 0, 0.02 * H); if (big) for (const s of [-1, 1]) k.cyl(0.02 * H, 0.02 * H, tLen * 0.6, M.metal, spine, -td * 1.9, sy(crotch) + tLen * 0.62, s * tw * 0.4, 10); }
    if (o.bag) { const bm = mt(col('bag'), { rough: 0.95 }); k.sphere([td * 1.0, tLen * 0.5, tw * 0.9], bm, spine, -td * 1.6, sy(crotch) + tLen * 0.75, 0); k.sphere([td * 0.35, tLen * 0.12, tw * 0.3], bm, spine, -td * 1.5, sy(crotch) + tLen * 1.2, 0); const st = k.mesh(torus(TAU, 0.04), M.leather, spine, 0, chestY, 0); st.scale.set(td * 1.05, tLen * 0.5, tw * 1.05); st.rotation.set(0.4, 0, 0); st.scale.z = tw * 1.05; }
    if (o.cape && o.hat === 'crown') { const r = k.mesh(torus(TAU, 0.22), mt('#f6f3ea', { rough: 1 }), spine, -td * 0.1, sy(tTop) - 0.012 * H, 0); r.scale.set(td * 1.05, tw * 1.0, 1); r.scale.z = tw * 1.0; r.rotation.x = PI / 2; }
    // cape: a cloth sheet hanging from the shoulders, bent every frame
    let cape = null;
    if (o.cape) {
      const cols = 5, rows = 7, g = new T.PlaneGeometry(1, 1, cols, rows); k.own.push(g);
      cape = { g, cols, rows, mesh: k.mesh(g, mt(col('cape'), { side: 'double', rough: 0.75 }), spine), top: sy(shY) + 0.012 * H, x0: -td * 0.85, len: (fish ? 0.5 : 0.62) * H, w: tw * 2.1, wrap: td * 1.5, tick: 0 };
      cape.mesh.castShadow = true;
      if (o.fangs) for (const s of [-1, 1]) { const cl = k.extrude([0, 0, 0.05 * H, 0.1 * H, 0.0, 0.11 * H, -0.03 * H, 0.04 * H], 0.005 * H, mt(col('cape'), { side: 'double' }), spine, -td * 0.5, sy(tTop) - 0.02 * H, s * tw * 0.75, 0.001 * H); cl.rotation.y = s * 0.5; }
    }
    // wings, tail
    const wings = o.wings !== 'none' ? buildWings(c, k.group(spine, -td * 0.9, sy(shY) - 0.04 * H, 0), o.wings) : null;
    let tail = null;
    if (o.tail !== 'none') {
      tail = k.group(body, -td * 0.85, sy(crotch) + 0.06 * H, 0);
      const tc = o.tail === 'devil' ? M.skinH : furry ? M.fur : mt(col('body'), { rough: 0.9 });
      const tm = o.tail === 'monkey' ? mt(furC === col('fur') && ape ? col('body') : col('body'), { rough: 0.9 }) : tc;
      if (o.tail === 'devil') { k.tube([[0, 0, 0], [-0.1 * H, -0.08 * H, 0], [-0.2 * H, 0.02 * H, 0], [-0.22 * H, 0.14 * H, 0]], 0.012 * H, 0.008 * H, tm, tail, 12, 6); const sp = k.cone(0.03 * H, 0.06 * H, tm, tail, -0.22 * H, 0.17 * H, 0, 4); sp.scale.z = 0.3; }
      else k.tube([[0, 0, 0], [-0.12 * H, -0.06 * H, 0], [-0.2 * H, 0.08 * H, 0], [-0.15 * H, 0.2 * H, 0], [-0.1 * H, 0.15 * H, 0]], 0.022 * H, 0.012 * H, tm, tail, 16, 8);
    }
    // neck and head
    const neckG = k.group(spine, 0.012 * H, sy(tTop), 0);
    if (!robot) k.cyl(0.42 * R * (bony ? 0.45 : furry ? 1.3 : 1), 0.46 * R * (bony ? 0.45 : furry ? 1.4 : 1), neckL + 0.6 * R, bony ? M.skinH : furry ? M.fur : M.skinH, neckG, 0, (chin - tTop) * 0.5 + 0.1 * R, 0, 14);
    else k.cyl(0.3 * R, 0.4 * R, neckL + 0.3 * R, M.metal2, neckG, 0, (chin - tTop) * 0.5, 0, 12);
    if (knight) k.cyl(0.75 * R, 0.95 * R, 0.5 * R, M.metal, neckG, 0, 0.1 * R, 0, 16);
    const headG = k.group(neckG, 0.02 * H * (furry ? 1.5 : 1), headC - tTop, 0);
    const HP = buildHead(c, headG);
    // held item and shield
    const itemKind = o.item;
    const itemG = itemKind !== 'none' ? k.group(arms[0].hand, 0.004 * H, -0.028 * H, 0.004 * H) : null;
    const IP = itemG ? buildItem(c, itemKind, itemG) : {};
    const shieldG = o.shield ? k.group(arms[1].hand, 0, -0.03 * H, -0.01 * H) : null, shield = shieldG ? buildShield(c, shieldG, o.hat === 'viking') : null;

    // ---- animation ----
    const longItem = LONG.includes(itemKind), tilt = TILT[itemKind] || 0;
    const flyHero = !!o.cape && def.move === 'fly';
    const scarecrow = name === 'scarecrow', zombie = !!o.zombie || name === 'mummy';
    let lean = 0, lastMood = '', capeB = 0.3;
    const setMouth = (m) => {
      if (!HP.mouths) return;
      const key = m === 'happy' ? 'happy' : m === 'angry' ? 'angry' : m === 'scared' || m === 'dizzy' ? 'scared' : 'normal';
      for (const kk in HP.mouths) HP.mouths[kk].visible = kk === key;
    };
    const updCape = (e2, t) => {
      const P = cape.g.attributes.position, cols = cape.cols, rows = cape.rows, dl = cape.len / rows;
      let x = cape.x0, y = cape.top;
      for (let r = 0; r <= rows; r++) {
        const f = r / rows, th = capeB * f * 1.6 + Math.sin(t * 5 + f * 3 + e2.seed) * 0.08 * f * (0.4 + capeB);
        if (r) { x -= Math.sin(th) * dl; y -= Math.cos(th) * dl; }
        for (let q = 0; q <= cols; q++) {
          const gq = q / cols - 0.5, i = r * (cols + 1) + q, w = cape.w * (0.62 + f * 0.5);
          P.setXYZ(i, x + (gq * 2) * (gq * 2) * cape.wrap * (1 - f * 0.45) + Math.sin(t * 7 + gq * 4 + f * 5) * 0.012 * H * f * capeB, y, gq * w);
        }
      }
      P.needsUpdate = true; cape.g.computeVertexNormals(); cape.g.computeBoundingSphere();
    };
    const flagPos = IP.flag ? IP.flag.geometry.attributes.position : null;

    return function (e2, t, dt) {
      const mood = e2.mood, held = e2.held, flying = e2.flying, ko = e2.ko, sleep = e2.sleeping || mood === 'sleep';
      const inAir = !e2.grounded && !flying && !held;
      const walking = e2.moving && e2.grounded && !flying && !ko;
      const ph = e2.phase || 0;
      const flail = Math.sin(t * 16) * 0.35;
      let l1, l2, k1, k2;
      if (ko) { l1 = 0.08; l2 = -0.12; k1 = 0.15; k2 = 0.05; }
      else if (held) { l1 = Math.sin(t * 9) * 0.25; l2 = -l1; k1 = 0.3 + l1; k2 = 0.3 - l1; }
      else if (inAir) { l1 = 0.45; l2 = -0.35; k1 = 0.9; k2 = 0.45; }
      else if (flying) { l1 = flyHero ? 0.05 : 0.15; l2 = (flyHero ? -0.1 : -0.05) + Math.sin(t * 3) * 0.08; k1 = flyHero ? 0.05 : 0.35; k2 = flyHero ? 0.15 : 0.55; }
      else if (walking) { const a = zombie ? 0.3 : baby ? 0.4 : 0.55; l1 = Math.sin(ph) * a; l2 = -l1; const cp = Math.cos(ph); k1 = 0.1 + Math.max(0, cp) * 1.3 * a; k2 = 0.1 + Math.max(0, -cp) * 1.3 * a; }
      else { l1 = 0.06; l2 = -0.06; k1 = 0.06; k2 = 0.04; }
      // arms: a = swing (forward +), b = spread out to the side, eb = elbow bend
      let a1, a2, b1 = 0.06, b2 = 0.06, e1 = 0.15, e3 = 0.15;
      if (ko) { a1 = 0.4; a2 = -0.3; b1 = 0.5; b2 = 0.4; e1 = 0.2; e3 = 0.3; }
      else if (held) { a1 = 2.5 + flail; a2 = 2.4 - flail; b1 = b2 = 0.4; e1 = e3 = 0.3; }
      else if (zombie && !sleep) { a1 = 1.5 + Math.sin(t * 2) * 0.05; a2 = 1.35; e1 = e3 = 0.08; b1 = b2 = 0.05; }
      else if (mood === 'scared') { a1 = 2.5 + flail * 0.5; a2 = 2.4 - flail * 0.5; b1 = b2 = 0.45; e1 = e3 = 0.6; }
      else if (mood === 'dizzy') { a1 = 0.2; a2 = -0.2; b1 = 1.2 + Math.sin(t * 5) * 0.3; b2 = 1.2 - Math.sin(t * 5) * 0.3; e1 = e3 = 0.2; }
      else if (mood === 'angry') { a1 = 1.3; a2 = -0.4; e1 = 0.9; e3 = 0.9; }
      else if (mood === 'happy' && !walking) { a1 = 2.5; a2 = 2.5; b1 = b2 = 0.45; e1 = e3 = 0.25; }
      else if (inAir) { a1 = 2.2; a2 = 2.0; b1 = b2 = 0.5; }
      else if (flying) { if (flyHero) { a1 = 2.95; a2 = 0.3; e1 = 0.05; } else { a1 = 0.5; a2 = 0.3; b1 = b2 = 0.35; e1 = e3 = 0.6; } }
      else if (walking) { const sa = ape ? 0.35 : 0.5; a1 = -Math.sin(ph) * sa; a2 = Math.sin(ph) * sa; e1 = 0.3 + Math.max(0, -Math.sin(ph)) * 0.4; e3 = 0.3 + Math.max(0, Math.sin(ph)) * 0.4; }
      else { const br = Math.sin(t * 2.1 + e2.seed) * 0.03; a1 = 0.08 + br; a2 = -0.06 - br; }
      if (scarecrow && !held && !ko) { a1 = a2 = 0; b1 = b2 = 1.45; e1 = e3 = 0.05; }
      if (sleep && !held && !ko) { a1 = 0.05; a2 = 0; e1 = e3 = 0.1; b1 = b2 = 0.08; }
      const holding = itemKind !== 'none' && !held && mood !== 'scared' && mood !== 'dizzy' && !zombie && !ko;
      if (holding) { if (longItem) { a1 = 0.55; e1 = 1.0; } else { a1 = Math.max(a1, 0.95); e1 = Math.max(e1, 0.7); } b1 = 0.06; }
      if (shield && !held && !ko && mood !== 'scared') { a2 = 0.55; e3 = 1.1; b2 = 0.12; }
      let swing = false;
      if (e2.lungeT > 0 && !held && !zombie && !ko) { const pr = 1 - e2.lungeT / 0.24; a1 = 2.9 - 2.4 * pr; a2 = shield ? 0.8 : -0.5 - 0.6 * pr; e1 = 0.15; swing = true; }
      const ar = arms[0], af = arms[1];
      ar.up.rotation.z = a1 - e1 * 0.45; ar.fo.rotation.z = e1; ar.g.rotation.x = -b1;
      af.up.rotation.z = a2 - e3 * 0.45; af.fo.rotation.z = e3; af.g.rotation.x = b2;
      // fists when angry or holding, open otherwise (a slight curl of the hand)
      ar.hand.rotation.z = holding || mood === 'angry' ? 0.3 : 0.1; af.hand.rotation.z = 0.1;
      if (shieldG) shieldG.rotation.z = -(af.up.rotation.z + e3 + 0.1) - lean * 0.6;
      if (itemG) {
        itemG.visible = holding || swing;
        const armW = ar.up.rotation.z + e1 + ar.hand.rotation.z;
        itemG.rotation.z = swing ? 2.5 : tilt - armW - lean * 0.6;
        if (IP.flame) { const f = 1 + Math.sin(t * 17 + e2.seed) * 0.12; IP.flame.scale.set(f, 2 - f, f); }
        if (IP.bob) IP.bob.rotation.z = Math.sin(t * 1.7 + e2.seed) * 0.12;
        if (IP.spin) IP.spin.rotation.y = t * 2;
        if (flagPos && ((e2.id + (t * 30 | 0)) & 1)) { const src = IP.flagX; for (let i = 0; i < flagPos.count; i++) { const x = src[i * 3]; flagPos.setZ(i, Math.sin(t * 7 - x / u * 0.5) * x * 0.12); } flagPos.needsUpdate = true; }
      }
      // legs
      if (legs.length) {
        const L = legs;
        L[0].th.rotation.z = l1; L[0].sh.rotation.z = -k1; L[0].an.rotation.z = k1 - l1 - (walking ? Math.max(0, -l1) * 0.5 : 0);
        L[1].th.rotation.z = l2; L[1].sh.rotation.z = -k2; L[1].an.rotation.z = k2 - l2 - (walking ? Math.max(0, -l2) * 0.5 : 0);
        L[0].hg.rotation.x = ko ? -0.15 : 0; L[1].hg.rotation.x = ko ? 0.15 : 0;
      }
      if (tailG) tailG.rotation.z = fish ? Math.sin(t * (walking ? 7 : 2.5) + e2.seed) * (walking || held ? 0.22 : 0.08) : Math.sin(t * 2 + e2.seed) * 0.1;
      if (tail) tail.rotation.x = Math.sin(t * 3 + e2.seed) * 0.2;
      // body: bob, lean, bounce, breathing
      let by = hipY, wantLean = 0;
      if (walking && legs.length) by -= (1 - Math.cos(l1)) * legL * 0.45 - Math.abs(Math.sin(ph)) * 0.004 * H;
      if (inAir) by -= 0.02 * H;
      if (mood === 'happy' && e2.grounded && !walking && !held && !ko && !sleep) by += Math.abs(Math.sin(t * 8 + e2.seed)) * 0.035 * H;
      if (walking) wantLean = zombie ? -0.15 : -0.06;
      if (ape) wantLean -= 0.35;
      if (zombie && !walking) wantLean = -0.1;
      if (mood === 'scared' && !held) wantLean = 0.08;
      if (flying) wantLean = flyHero && (e2.moving || Math.abs(e2.vx) > 30) ? -1.3 : -0.12;
      lean += (wantLean - lean) * Math.min(1, dt * 6);
      body.position.y = by; body.rotation.z = flyHero ? lean : lean * 0.4; spine.rotation.z = flyHero ? 0 : lean * 0.6;
      const brt = Math.sin(t * (sleep ? 1.4 : 2.2) + e2.seed);
      spine.scale.set(1 + brt * 0.015, 1, 1 + brt * 0.012);
      spine.rotation.x = mood === 'dizzy' ? Math.sin(t * 4) * 0.12 : 0;
      // head: look, nod, droop, sway
      neckG.rotation.z = -lean * (flyHero ? 0.5 : 0.7);
      let hz = -(e2.lookY || 0) * 0.25, hx = 0;
      if (sleep) hz = -0.4; else if (ko) { hz = 0.25; hx = 0.35; }
      else if (mood === 'dizzy') { hx = Math.sin(t * 4) * 0.18; hz += Math.cos(t * 4) * 0.12; }
      else if (mood === 'angry') hz -= 0.12; else if (mood === 'scared') hz += 0.12;
      if (flyHero && lean < -0.6) hz += 0.6;
      headG.rotation.z = hz; headG.rotation.x = hx;
      if (HP.jaw) HP.jaw.rotation.z = mood === 'angry' || mood === 'scared' ? -0.3 - Math.abs(Math.sin(t * 9)) * 0.1 : mood === 'happy' ? -0.12 * Math.abs(Math.sin(t * 6)) : 0;
      if (mood !== lastMood) {
        lastMood = mood; setMouth(mood);
        if (HP.brows) for (const b of HP.brows) { const s = b.userData.s; b.rotation.x = mood === 'angry' ? -s * 0.5 : mood === 'scared' ? s * 0.35 : 0; b.position.y = (mood === 'scared' ? 0.4 : mood === 'angry' ? 0.29 : 0.33) * R; }
      }
      if (HP.pony) HP.pony.rotation.z = Math.sin(t * 5 + e2.seed) * 0.18 + (walking ? 0.15 : 0);
      if (HP.pigs) for (const p of HP.pigs) p.rotation.z = Math.sin(t * 5 + e2.seed) * 0.12;
      if (HP.tails) for (let i = 0; i < HP.tails.length; i++) HP.tails[i].rotation.z = -0.5 + Math.sin(t * 7 + i) * 0.15 - (walking ? 0.2 : 0);
      if (HP.halo) HP.halo.position.y = 1.55 * R + Math.sin(t * 2.2 + e2.seed) * 0.06 * R;
      // wings
      if (wings) {
        const fast = o.wings === 'fairy' ? 30 : 9, f = flying || held ? Math.sin(t * fast) * 0.5 + 0.5 : 0.15 + Math.sin(t * 1.5) * 0.05;
        const open = 0.35 + f * (o.wings === 'fairy' ? 0.6 : 0.9);
        wings[0].rotation.y = open; wings[1].rotation.y = -open;
        wings[0].rotation.x = -0.15 - f * 0.25; wings[1].rotation.x = 0.15 + f * 0.25;
      }
      // cape
      if (cape) {
        const want = flyHero && lean < -0.6 ? -0.12 : 0.18 + (e2.moving ? 0.4 : 0) + (flying ? 0.7 : 0) + (inAir ? 0.4 : 0) + Math.min(0.4, Math.abs(e2.vx || 0) / 600);
        capeB += (want - capeB) * Math.min(1, dt * 4);
        if ((cape.tick++ & 1) === 0) updCape(e2, t);
      }
    };
  };

  // ---------- werewolf: hunched, shaggy, digitigrade, clawed, a wolf's head ----------
  M3.kinds.werewolf = function (e, k, tpl) {
    const u = tpl.h / 86, col = k.col;
    const furC = col('body'), fm = k.mat(furC, { rough: 0.95 }), fd = k.mat(shade(furC, 0.3), { rough: 1 }), fl = k.mat(tint(furC, 0.25), { rough: 1 });
    const claw = k.mat('#e8e0cc', { rough: 0.35 }), black = k.mat('#121010', { rough: 0.35 }), gum = k.mat('#6a2026', { rough: 0.5 }), teeth = k.mat('#f4efdc', { rough: 0.3 });
    const body = k.group(k.root, -2 * u, -9 * u, 0);
    const chest = k.group(body, 0, 0, 0);
    // hips, hunched chest, shaggy back
    k.sphere([7.5 * u, 8 * u, 8 * u], fm, body, -1 * u, 2 * u, 0);
    const ch = k.sphere([9.5 * u, 12 * u, 10 * u], fm, chest, 5 * u, 15 * u, 0); ch.rotation.z = -0.55;
    k.sphere([5 * u, 8 * u, 7 * u], fl, chest, 9.5 * u, 13 * u, 0).rotation.z = -0.5;
    for (let i = 0; i < 7; i++) { const a = -0.3 + i * 0.25, sp = k.cone(2.4 * u, 6 * u, fd, chest, -4 * u + i * 2.2 * u, 10 * u + Math.sin(i * 0.5) * 8 * u + i * 1.4 * u, (i % 2 ? 1 : -1) * 1.5 * u, 6); sp.rotation.z = 0.9 - a; }
    // torn shorts
    const sh = k.sphere([8.4 * u, 6 * u, 8.6 * u], k.mat(col('cloth'), { rough: 0.9 }), body, -1 * u, -1 * u, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, cn = k.cone(1.6 * u, 3.5 * u, k.mat(col('cloth'), { rough: 0.9 }), body, -1 * u + Math.cos(a) * 7.5 * u, -6 * u, Math.sin(a) * 7.8 * u, 4); cn.rotation.x = PI; }
    sh.scale.y *= 1;
    // tail
    const tail = k.group(body, -8 * u, 1 * u, 0);
    k.tube([[0, 0, 0], [-7 * u, -3 * u, 0], [-15 * u, -2 * u, 0], [-21 * u, 2 * u, 0]], uu => (2.5 + Math.sin(uu * PI) * 3) * u, 0, fm, tail, 12, 10);
    // legs: hip -> knee (forward) -> hock (back) -> paw
    const legs = [];
    for (const s of [1, -1]) {
      const hg = k.group(body, 0, 0, s * 5 * u);
      const th = k.limb(12 * u, 4.5 * u, 3.2 * u, fm, hg);
      const sn = k.limb(13 * u, 3 * u, 1.9 * u, fm, th, 0, -12 * u, 0);
      const mtp = k.limb(11 * u, 1.9 * u, 1.6 * u, fd, sn, 0, -13 * u, 0);
      const paw = k.group(mtp, 0, -11 * u, 0);
      k.sphere([4.2 * u, 1.8 * u, 2.6 * u], fd, paw, 2.5 * u, -0.5 * u, 0);
      for (let i = -1; i <= 1; i++) { const cl = k.cone(0.55 * u, 2.4 * u, claw, paw, 6.8 * u, -1 * u, i * 1.3 * u, 6); cl.rotation.z = -PI / 2 - 0.3; }
      legs.push({ hg, th, sn, mtp, paw });
    }
    // arms: long, clawed
    const arms = [];
    for (const s of [1, -1]) {
      const g = k.group(chest, 6 * u, 21 * u, s * 8.5 * u);
      k.sphere(4.4 * u, fm, g, 0, -1 * u, 0);
      const up = k.limb(13 * u, 3.4 * u, 2.6 * u, fm, g);
      const fo = k.limb(13 * u, 2.6 * u, 2 * u, fm, up, 0, -13 * u, 0);
      k.cone(1.6 * u, 4 * u, fd, up, -2 * u, -13 * u, 0, 5).rotation.z = 2.2;
      const hand = k.group(fo, 0, -13 * u, 0);
      k.sphere([2.4 * u, 3 * u, 2 * u], fd, hand, 0, -2 * u, 0);
      for (let i = -1.5; i <= 1.5; i++) { const cl = k.cone(0.45 * u, 3 * u, claw, hand, 1.2 * u, -5.4 * u, i * 0.9 * u, 6); cl.rotation.z = PI - 0.35; }
      arms.push({ g, up, fo, hand });
    }
    // neck and head
    const neck = k.group(chest, 10 * u, 25 * u, 0);
    k.sphere([5.5 * u, 6 * u, 5.5 * u], fm, neck, 0, 0, 0).rotation.z = -0.6;
    const head = k.group(neck, 5 * u, 5 * u, 0);
    k.sphere([6.6 * u, 6.2 * u, 6 * u], fm, head, 0, 0, 0);
    for (const s of [-1, 1]) { const ck = k.cone(2.4 * u, 6 * u, fm, head, -2 * u, -3 * u, s * 5.4 * u, 6); ck.rotation.set(s * 1.9, 0, 0.6); }
    const snout = k.sphere([6.5 * u, 2.8 * u, 3.3 * u], fm, head, 7.5 * u, -1.2 * u, 0); snout.rotation.z = -0.08;
    k.sphere([3 * u, 2 * u, 2.8 * u], fl, head, 8.5 * u, -2.8 * u, 0);
    k.sphere([1.4 * u, 1.1 * u, 1.5 * u], black, head, 13.6 * u, -0.3 * u, 0);
    const jaw = k.group(head, 3 * u, -3.4 * u, 0);
    k.sphere([6 * u, 1.4 * u, 2.7 * u], fl, jaw, 5 * u, -0.8 * u, 0);
    k.sphere([5.2 * u, 0.9 * u, 2.3 * u], gum, jaw, 4.8 * u, -0.1 * u, 0);
    for (const s of [-1, 1]) { k.cone(0.45 * u, 2 * u, teeth, jaw, 8.4 * u, 0.9 * u, s * 1.6 * u, 6); const f = k.cone(0.5 * u, 2.2 * u, teeth, head, 11.6 * u, -3.4 * u, s * 1.6 * u, 6); f.rotation.x = PI; }
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const f = k.cone(0.3 * u, 1.1 * u, teeth, head, (6 + i * 1.6) * u, -3.6 * u, s * 2.1 * u, 5); f.rotation.x = PI; }
    k.sphere([2.4 * u, 1 * u, 4.6 * u], fd, head, 4.4 * u, 2.6 * u, 0);
    for (const s of [-1, 1]) k.eye(1.35 * u, head, 4.8 * u, 1.3 * u, s * 2.9 * u, { dir: [1, 0.05, s * 0.35], iris: '#e8a81c', lid: shade(furC, 0.2) });
    for (const s of [-1, 1]) { const ear = k.cone(2.3 * u, 6.5 * u, fm, head, -2 * u, 6.5 * u, s * 3.4 * u, 5); ear.rotation.set(s * -0.25, 0, 0.35); ear.scale.z = 0.55; const ei = k.cone(1.3 * u, 4.5 * u, gum, head, -1.6 * u, 6.2 * u, s * 3.5 * u, 5); ei.rotation.set(s * -0.25, 0, 0.35); ei.scale.z = 0.3; }
    k.sphere([4 * u, 4 * u, 2.6 * u], fd, head, -5 * u, 2 * u, 0);

    return function (e2, t, dt) {
      const mood = e2.mood, held = e2.held, ko = e2.ko;
      const walking = e2.moving && e2.grounded && !ko, inAir = !e2.grounded && !held;
      const ph = e2.phase || 0, sw = walking ? Math.sin(ph) : 0, cp = walking ? Math.cos(ph) : 0;
      const angry = mood === 'angry' || e2.mode === 'hunt' || mood === 'scared';
      const fl2 = held ? Math.sin(t * 14) * 0.6 : 0;
      const stance = walking ? 0 : inAir ? 0.4 : 0.15;
      for (let i = 0; i < 2; i++) {
        const L = legs[i], s = i ? -1 : 1, a = (i ? -sw : sw) * 0.55 + (i ? -stance : stance) * 0.5 + (held ? Math.sin(t * 9 + i * 3) * 0.3 : 0);
        const lift = walking ? Math.max(0, (i ? -cp : cp)) * 0.5 : inAir ? 0.4 : 0;
        L.th.rotation.z = 0.6 + a + lift * 0.4; L.sn.rotation.z = -1.3 - lift; L.mtp.rotation.z = 0.75 + lift * 0.3; L.paw.rotation.z = -(L.th.rotation.z + L.sn.rotation.z + L.mtp.rotation.z);
        L.hg.rotation.x = ko ? s * -0.2 : 0;
      }
      for (let i = 0; i < 2; i++) {
        const A = arms[i];
        let au, af;
        if (ko) { au = 0.6; af = 0.4; }
        else if (held || inAir || mood === 'scared') { au = i ? 2.5 - fl2 * 0.4 : 2.3 + fl2 * 0.4; af = 0.5; }
        else if (mood === 'dizzy') { au = 1.4; af = 0.2; }
        else if (e2.lungeT > 0 && i === 0) { const pr = 1 - e2.lungeT / 0.24; au = 2.6 - 2.2 * pr; af = 0.3; }
        else { au = 0.55 + (i ? -sw : sw) * 0.45 + (angry ? 0.35 : 0); af = 0.6 + (angry ? 0.5 : 0); }
        A.up.rotation.z = au; A.fo.rotation.z = af; A.hand.rotation.z = angry ? 0.5 : 0.2;
        A.g.rotation.x = (i ? 1 : -1) * (held || mood === 'scared' ? 0.4 : 0.12);
      }
      body.position.y = -9 * u - (walking ? Math.abs(cp) * 1.2 * u : 0) + (inAir ? 2 * u : 0);
      chest.rotation.z = (walking ? -0.08 : 0) + Math.sin(t * 2 + e2.seed) * 0.02 + (ko ? 0.15 : 0);
      neck.rotation.z = angry ? -0.1 : (e2.lookY || 0) * -0.2;
      head.rotation.x = mood === 'dizzy' ? Math.sin(t * 4) * 0.2 : 0;
      jaw.rotation.z = angry ? -0.38 - Math.abs(Math.sin(t * 7)) * 0.08 : mood === 'happy' ? -0.15 : -0.03;
      tail.rotation.z = -0.15 + Math.sin(t * 3 + e2.seed) * 0.12 + (walking ? 0.15 : 0);
      tail.rotation.y = Math.sin(t * 2.3 + e2.seed) * 0.3;
    };
  };
})();
