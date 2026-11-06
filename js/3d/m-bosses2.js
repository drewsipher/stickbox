'use strict';
// m-bosses2.js — 3D models (see js/3d/r3d.js for the model kit): the ice golem, giant snake, giant angry bull,
// giant scorpion, wasp swarm, beetle swarm and giant praying mantis.
// Each is built in its 2D drawing's own coordinates (bosses.js), so mouths, noses, stingers and claws sit
// where the game's attacks come from; a root group scales that up by the boss's drawK.
(function () {
  if (!SB.M3 || !window.THREE) return;
  const M3 = SB.M3, T = THREE, TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

  // ---------- local helpers ----------
  const DOWN = new T.Vector3(0, -1, 0), _v = new T.Vector3();
  // a bone: a kit limb (hangs along -y from its pivot); aim() points it from a to b and stretches it to fit
  const bone = (k, len, r0, r1, m, parent) => { const p = k.limb(len, r0, r1, m, parent); p.len = len; return p; };
  function aim(p, ax, ay, az, bx, by, bz) {
    p.position.set(ax, ay, az); _v.set(bx - ax, by - ay, bz - az);
    const d = _v.length() || 1e-6; _v.multiplyScalar(1 / d);
    p.quaternion.setFromUnitVectors(DOWN, _v); p.scale.set(1, d / p.len, 1);
  }
  // the root that holds a boss's drawing-space model, scaled up like its 2D drawing (drawK)
  const rootK = (k, e) => { const R = k.group(k.root); R.scale.setScalar(e.def.drawK || 1); return R; };
  // a material registered with the entity like k.mat (so hit flash, poison and invisibility still work)
  function own(k, m) {
    m.userData.base = { emissive: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent };
    k.mats.push(m); return m;
  }
  // a glassy faceted ice material
  const iceMat = (k, color, o) => own(k, new T.MeshPhysicalMaterial({
    color: new T.Color(color), roughness: o.rough != null ? o.rough : 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, flatShading: true,
    transparent: o.op < 1, opacity: o.op, depthWrite: true, emissive: new T.Color(o.glow || '#000000'), emissiveIntensity: o.glowK || 0, reflectivity: 0.6
  }));
  // emissive intensity that pulses but leaves the hit flash alone
  const pulse = (e, m, v) => { if (!(e.hitT > 0) && !(e.poisonT > 0)) m.emissiveIntensity = v; };
  // a jittered low-poly gem/rock (shared geometry, a few variants)
  const crystalGeo = (v, detail) => M3.geo('b2gem' + v + ':' + (detail || 0), () => {
    const g = new T.IcosahedronGeometry(1, detail || 0), P = g.attributes.position;
    const h = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + v * 4.13) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < P.count; i++) {
      const x = Math.round(P.getX(i) * 1000) / 1000, y = Math.round(P.getY(i) * 1000) / 1000, z = Math.round(P.getZ(i) * 1000) / 1000;
      const j = 0.8 + h(x, y, z) * 0.36; P.setXYZ(i, x * j, y * j, z * j);
    }
    g.computeVertexNormals(); return g;
  });
  const gem = (k, r, m, parent, x, y, z, v, detail) => { const me = k.mesh(crystalGeo(v || 0, detail), m, parent, x, y, z); me.scale.set(r[0], r[1], r[2]); return me; };
  // a hexagonal crystal spike: prism with a pointed tip, base at the group origin pointing +y
  const spikeG = (k, r, len, m, mTip, parent, x, y, z) => {
    const g = k.group(parent, x, y, z);
    k.cyl(r, r * 1.05, len * 0.55, m, g, 0, len * 0.275, 0, 6);
    k.cone(r, len * 0.45, mTip || m, g, 0, len * 0.55 + len * 0.225, 0, 6);
    return g;
  };
  // a torus (rings, nose ring)
  const torus = (k, R, r, m, parent, x, y, z) => k.mesh(M3.geo('b2torus:' + R + ':' + r, () => new T.TorusGeometry(R, r, 8, 24)), m, parent, x, y, z);
  // a hemisphere (domes, shells), flat side down
  const domeGeo = (phi0, phiLen) => M3.geo('b2dome:' + phi0 + ':' + phiLen, () => new T.SphereGeometry(1, 28, 12, phi0, phiLen, 0, Math.PI / 2));
  const tmpC = new T.Color();
  // a soft additive glow around glowing eyes, stingers and cores (fakes bloom)
  const haloMat = (k, color, op) => { const m = k.mat(color, { basic: true, opacity: op || 0.3, halo: 1 }); m.blending = T.AdditiveBlending; m.depthWrite = false; return m; };

  // ======================================================================================
  // ICE GOLEM — a giant of translucent faceted ice: frost core glowing inside, spiked shoulders,
  // icicle beard and fists, glowing frost-blue eyes. Shown turned toward the camera like the 2D front view.
  // ======================================================================================
  M3.named['ice golem'] = function (e, k) {
    const R = rootK(k, e);
    const body = k.col('body'), spikeC = k.col('spike');
    // the palette's ice colour, deepened so it reads as thick glacier ice and not snow
    const deep = c => '#' + tmpC.set(c).offsetHSL(0.01, 0.12, -0.14).getHexString();
    const ice = iceMat(k, deep(body), { op: 0.8, rough: 0.08, glow: '#1f6fae', glowK: 0.4 });
    const iceD = iceMat(k, '#' + tmpC.set(body).offsetHSL(0.02, 0.3, -0.36).getHexString(), { op: 0.86, rough: 0.14, glow: '#0c3c70', glowK: 0.5 });
    const iceL = iceMat(k, spikeC, { op: 0.7, rough: 0.04, glow: '#6cc4ff', glowK: 0.35 });
    const snow = k.mat('#f4f9ff', { rough: 0.95 });
    const core = k.mat('#b8fbff', { glow: '#4fe3ff', glowK: 2.2, rough: 0.3 });
    const vein = k.mat('#9ff7ff', { glow: '#3fd8ff', glowK: 1.6 });
    const dark = k.mat('#06182e', { rough: 0.4 });
    const halo = k.mat('#7ff3ff', { basic: true, opacity: 0.3 }); halo.blending = T.AdditiveBlending; halo.depthWrite = false;
    const turn = k.group(R);   // turned toward the camera a little more than other things
    const hips = k.group(turn, 0, -22, 0);
    const torso = k.group(hips, 0, 36, 0);
    // torso: a hulking mass of glacier ice; a frost heart and glowing fault lines show through it
    k.sphere(13, core, torso, 26, 8, 0);
    [[0, 30, 0.5, 0.2], [0, 26, -0.6, -0.3], [4, 34, 1.4, 0.4], [-4, 30, -1.2, 0.6]].forEach(([x, l, rz, rx]) => { const v = k.box(1.6, l, 1.6, vein, torso, 30 + x, 6, x * 3); v.rotation.set(rx, 0, rz); });
    gem(k, [40, 52, 52], ice, torso, 2, 0, 0, 1);
    gem(k, [30, 34, 40], iceD, torso, -4, -34, 0, 2);
    gem(k, [26, 30, 22], ice, torso, 14, 14, 20, 3); gem(k, [26, 30, 22], ice, torso, 14, 14, -20, 4);   // chest slabs
    gem(k, [26, 30, 34], iceD, torso, -20, 22, 0, 5);
    gem(k, [20, 14, 50], iceD, torso, 4, 44, 0, 22);   // hunched collar the head sinks into
    for (let i = 0; i < 6; i++) {   // icicles hanging from the belly ledge
      const a = (i + 0.5) / 6 * Math.PI - Math.PI / 2, ic = k.cone(3.2, 14 + (i * 7 % 3) * 6, iceL, torso, Math.cos(a) * 30, -54 - (i * 7 % 3) * 3, Math.sin(a) * 40, 6); ic.rotation.x = Math.PI;
    }
    // back: a cluster of long crystal shards
    [[-26, 44, 0, 44, -0.5, 0], [-30, 22, 14, 34, -0.9, 0.3], [-30, 22, -14, 34, -0.9, -0.3], [-18, 54, 18, 30, -0.3, 0.5], [-18, 54, -18, 30, -0.3, -0.5], [-34, 0, 0, 26, -1.2, 0], [-20, 40, 0, 52, -0.15, 0]].forEach(([x, y, z, l, a, b]) => {
      const s = spikeG(k, 5.5, l, iceL, null, torso, x, y, z); s.rotation.z = -a * 0.8 + 0.25; s.rotation.x = b;
    });
    // head: a heavy jagged crystal sunk between the shoulders, a crown of shards, slit eyes burning under the brow
    const neck = k.group(torso, 20, 38, 0);
    const head = k.group(neck, 0, 0, 0);
    gem(k, [24, 22, 27], ice, head, 0, 22, 0, 6);
    const jaw = k.group(head, 4, 12, 0);
    gem(k, [17, 9, 23], iceD, jaw, 8, -2, 0, 7);
    const brow = gem(k, [10, 6, 28], iceD, head, 22, 30, 0, 8); brow.rotation.z = -0.25;
    [[0, 40, 0, 36, 0], [-4, 38, 13, 28, 0.6], [-4, 38, -13, 28, -0.6], [-12, 34, 0, 30, 0.1], [8, 38, 10, 18, 0.45], [8, 38, -10, 18, -0.45], [-8, 32, 18, 20, 1.0], [-8, 32, -18, 20, -1.0]].forEach(([x, y, z, l, a]) => {
      const s = spikeG(k, 4.8, l, iceL, null, head, x, y, z); s.rotation.x = a; s.rotation.z = (x < 0 ? 0.45 : -0.05);
    });
    k.box(6, 7, 22, dark, head, 24, 25, 0);   // the dark hollow under the brow
    const eyes = [9, -9].map(z => {
      const g = k.group(head, 27.5, 25.5, z);
      k.sphere([1.6, 1.9, 4.6], core, g); k.sphere([2, 4.5, 8], halo, g);
      g.rotation.x = z > 0 ? -0.35 : 0.35;   // slanted inward: a scowl
      return g;
    });
    const maw = k.box(5, 3, 17, dark, jaw, 14, 4, 0);
    const fangs = [];
    for (let i = 0; i < 5; i++) { const f = k.cone(1.8, 7, iceL, head, 21, 13, -7 + i * 3.5, 5); f.rotation.x = Math.PI; fangs.push(f); }
    for (let i = 0; i < 4; i++) { const f = k.cone(1.5, 5, iceL, jaw, 21, 3, -6 + i * 4, 5); fangs.push(f); }
    for (let i = 0; i < 4; i++) { const ic = k.cone(2.6, 12 + (i % 2) * 6, iceL, jaw, 14 + (i % 2) * 2, -8, -8 + i * 5.3, 6); ic.rotation.x = Math.PI; }   // icicle beard
       // frost on the crown
    // shoulders, arms and fists (z = the two sides; +z is the near arm, the one that throws)
    const arm = side => {
      const sh = k.group(torso, 0, 40, side * 50);
      gem(k, [24, 22, 24], ice, sh, 0, 4, side * 2, 9 + side);   // shoulder boulder
      gem(k, [13, 5, 13], snow, sh, -2, 20, side * 2, 30);
      [[0, 22, 0, 28, 0], [-8, 18, 8, 22, 0.6], [8, 18, 8, 20, -0.5]].forEach(([x, y, z, l, a]) => {
        const s = spikeG(k, 4.5, l, iceL, null, sh, x, y, side * z); s.rotation.x = side * (0.35 + Math.abs(a) * 0.3); s.rotation.z = -a;
      });
      const up = bone(k, 40, 1, 1, ice, torso); up.limb.visible = false;
      gem(k, [15, 23, 15], ice, up, 0, -20, 0, 11 + side);
      const fo = bone(k, 42, 1, 1, ice, torso); fo.limb.visible = false;
      gem(k, [17, 24, 17], iceD, fo, 0, -18, 0, 13 + side);
      const fist = k.group(fo, 0, -42, 0);
      gem(k, [19, 18, 19], ice, fist, 0, -6, 0, 15 + side);
      for (let i = 0; i < 3; i++) { const ic = k.cone(2.6, 12 + i * 3, iceL, fist, -6 + i * 6, -20, side * (4 - i * 3), 6); ic.rotation.x = Math.PI; }
      const ready = k.group(fist, 0, 4, 0);   // ice spears grown for a throw
      [[0, 0], [-0.4, 6], [0.4, -6]].forEach(([a, z]) => { const s = spikeG(k, 4, 26, iceL, null, ready, 0, 8, z); s.rotation.x = a; });
      ready.visible = false;
      return { sh, up, fo, fist, ready, side };
    };
    const arms = [arm(1), arm(-1)];
    // legs: crystal thighs, shins and huge flat feet
    const leg = side => {
      const th = bone(k, 34, 1, 1, ice, hips); th.limb.visible = false; gem(k, [17, 21, 17], ice, th, 0, -16, 0, 17 + side);
      const sn = bone(k, 34, 1, 1, ice, hips); sn.limb.visible = false; gem(k, [15, 20, 15], iceD, sn, 0, -16, 0, 19 + side);
      const ft = k.group(hips, 0, 0, side * 22);
      gem(k, [26, 8, 18], ice, ft, 6, 6, 0, 21 + side);
      for (let i = 0; i < 3; i++) k.cone(3, 8, iceL, ft, 22, 4, -7 + i * 7, 5).rotation.z = -Math.PI / 2;
      return { th, sn, ft, side };
    };
    const legs = [leg(1), leg(-1)];
    let yawT = -0.5;
    return (e, t, dt) => {
      const held = e.held, walking = e.moving && e.grounded && !held, inAir = !e.grounded && !held;
      const mood = e.mood, angry = mood === 'angry' || e.mode === 'hunt';
      const windup = e.throwT > 0.25, throwing = e.throwT > 0, breathing = e.breath > 0;
      const sw = walking ? Math.sin(e.phase) : 0;
      yawT += (-0.5 * e.facing - yawT) * Math.min(1, dt * 10); turn.rotation.y = yawT;
      // legs
      for (const L of legs) {
        const a = L.side > 0 ? sw : -sw, lift = walking ? Math.max(0, a) * 10 : inAir ? 10 : 0;
        const hx = 0, hy = -6, hz = L.side * 20, fx = a * 16, fy = -82 + lift, fz = L.side * 22;
        const kx = (hx + fx) / 2 + 9 + lift * 0.3, ky = (hy + fy) / 2 + 2, kz = L.side * 22;
        aim(L.th, hx, hy, hz, kx, ky, kz); aim(L.sn, kx, ky, kz, fx, fy + 6, fz);
        L.ft.position.set(fx, fy, fz);
        L.ft.rotation.z = walking ? -a * 0.25 : 0;
      }
      hips.position.y = -22 + (walking ? -Math.abs(Math.cos(e.phase)) * 4 : 0);
      torso.rotation.y = sw * 0.08;
      torso.rotation.z = (angry || breathing) ? -0.12 : walking ? -0.05 : 0;
      // arms: shoulder at (0, 40, ±50) in torso space; elbow and fist targets per pose
      for (const A of arms) {
        const s = A.side, f = s > 0, a = s > 0 ? sw : -sw;
        let ex, ey, ez, hx, hy, hz;
        if (held) { ex = 6; ey = 74; ez = s * 64; hx = 10 + Math.sin(t * 11 + s) * 6; hy = 110; hz = s * 62; }
        else if (f && windup) { ex = -16; ey = 76; ez = 58; hx = -26; hy = 116; hz = 54; }
        else if (f && throwing) { ex = 32; ey = 52; ez = 50; hx = 72; hy = 50; hz = 40; }
        else if (breathing) { ex = 10; ey = 46; ez = s * 82; hx = 22; hy = 74; hz = s * 92; }
        else if (mood === 'dizzy') { ex = 4; ey = 4; ez = s * 64; hx = 10; hy = -36; hz = s * 66; }
        else if (angry && !walking) { ex = 22; ey = 28; ez = s * 70; hx = 40; hy = 66; hz = s * 60; }
        else { ex = -a * 10 + 4; ey = 4; ez = s * 62; hx = -a * 22 + 10; hy = -34; hz = s * 64; }
        const sx = 0, sy = 40, sz = s * 50;
        aim(A.up, sx, sy, sz, ex, ey, ez); aim(A.fo, ex, ey, ez, hx, hy, hz);
        A.ready.visible = f && windup;
      }
      // head: lowered and leaning in when angry, tossed when held
      head.rotation.z = angry || throwing ? -0.12 : held ? 0.2 * Math.sin(t * 6) : Math.sin(t * 0.7 + e.seed) * 0.03;
      brow.position.y = angry || throwing || breathing ? 29 : 30.5; brow.rotation.z = angry ? -0.4 : -0.25;
      const open = angry || throwing || breathing || mood === 'scared';
      jaw.rotation.z = open ? -0.32 - (breathing ? 0.15 : 0) : -0.04;
      maw.scale.y = open ? 4 : 1;
      for (const fg of fangs) fg.visible = open;
      const shut = e.ko || e.sleeping || mood === 'sleep' || mood === 'dizzy' || (e.seed * 7 + t) % 5 < 0.1;
      for (const ey of eyes) ey.scale.set(1, shut ? 0.15 : angry ? 0.75 : 1, 1);
      pulse(e, core, 1.3 + Math.sin(t * 3 + e.seed) * 0.4 + (angry || breathing ? 0.8 : 0));
    };
  };

  // ======================================================================================
  // GIANT SNAKE — a cobra the size of a bus: a long scaled tube coiled in a heap and rearing up,
  // hood flared, glowing yellow slit eyes, dripping fangs and a flicking forked tongue.
  // ======================================================================================
  let scaleCv = null;
  function scaleCanvas() {   // grey scale pattern; the material colour tints it to the palette
    if (scaleCv) return scaleCv;
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = '#777'; x.fillRect(0, 0, S, S);
    const cols = 4, rows = 4, w = S / cols, h = S / rows;
    let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let r = -1; r <= rows; r++) for (let q = -1; q <= cols; q++) {
      const cx = (q + (r % 2 ? 0.5 : 0)) * w, cy = r * h;
      const g = x.createRadialGradient(cx, cy - h * 0.15, 1, cx, cy, w * 0.62);
      const l = 205 + rnd() * 50 | 0; g.addColorStop(0, `rgb(${l},${l},${l})`); g.addColorStop(0.7, `rgb(${l * 0.8 | 0},${l * 0.8 | 0},${l * 0.8 | 0})`); g.addColorStop(1, '#333');
      x.fillStyle = g; x.beginPath(); x.moveTo(cx, cy - h * 0.62); x.quadraticCurveTo(cx + w * 0.62, cy - h * 0.1, cx, cy + h * 0.62); x.quadraticCurveTo(cx - w * 0.62, cy - h * 0.1, cx, cy - h * 0.62); x.fill();
    }
    return (scaleCv = c);
  }
  const scaleTex = (rx, ry) => { const t = new T.CanvasTexture(scaleCanvas()); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; };
  const scaleMat = (k, color, rx, ry, rough) => { const tx = scaleTex(rx, ry); return own(k, new T.MeshStandardMaterial({ color: new T.Color(color), map: tx, bumpMap: tx, bumpScale: 0.3, roughness: rough, metalness: 0 })); };

  M3.named['giant snake'] = function (e, k) {
    const R = rootK(k, e);
    const skin = scaleMat(k, k.col('body'), 3, 64, 0.5), headSkin = scaleMat(k, k.col('body'), 2, 3, 0.45);
    const bellyM = scaleMat(k, k.col('belly'), 1, 26, 0.5), hoodM = scaleMat(k, k.col('hood'), 3, 3, 0.45);
    hoodM.side = T.DoubleSide; bellyM.side = T.DoubleSide;
    const mouthM = k.mat(k.col('mouth'), { rough: 0.5 }), fangM = k.mat('#f2ead8', { rough: 0.25 });
    const venomM = k.mat('#7ddc6a', { glow: '#5fe04a', glowK: 1.3, rough: 0.1 });
    const darkM = k.mat('#0c140c', { rough: 0.6 }), tongueM = k.mat('#7a1020', { rough: 0.4 });
    const CX = -48;
    // the body path: a heap of coils from the tail up, then the neck rises out of the top coil to the head
    const NC = 26, coil = [], pts = [];
    for (let i = 0; i <= NC; i++) {
      const u = i / NC, a = 1.5 * Math.PI - u * 2.25 * TAU, r = 64 - u * 22;
      coil.push([CX + r * Math.cos(a), -69 + u * 46, r * 0.86 * Math.sin(a)]);
    }
    coil[0][1] = -80;   // the tail tip lies on the ground
    const NECK = [[14, -15, 6], [34, 4, 7], [46, 28, 5], [52, 50, 3], [56, 64, 1]];
    for (let i = 0; i <= NC + NECK.length; i++) pts.push([0, 0, 0]);
    const radius = u => u < 0.07 ? 3 + 14 * sm(0, 0.07, u) : u < 0.8 ? 17 - u * 1.5 : 15.8 - (u - 0.8) * 22;
    const bodyM = k.tube(pts.map((p, i) => i <= NC ? coil[i] : NECK[i - NC - 1]), radius, 0, skin, R, 140, 14);
    const bpts = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const belly = k.tube([[0, 0, 0], [1, 1, 0], [2, 2, 0], [3, 3, 0], [4, 4, 0]], u => 9.5 - u * 2.5, 0, bellyM, R, 16, 10);
    // hood: a cupped flap spread sideways behind the head, pale ventral face with dark throat bands
    const hoodG = k.group(R, 50, 40, 0);
    const hoodGeo = (sc, cup) => {
      const sh = new T.Shape(), H = [[-7, -12], [-20, 2], [-28, 22], [-24, 42], [-12, 54], [0, 57], [12, 54], [24, 42], [28, 22], [20, 2], [7, -12]].map(([z, y]) => [z * sc, (y - 20) * sc + 20]);
      sh.moveTo(H[0][0], H[0][1]); sh.splineThru(H.slice(1).map(([a, b]) => new T.Vector2(a, b))); sh.lineTo(H[0][0], H[0][1]);
      const g = new T.ExtrudeGeometry(sh, { depth: 2.5, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 1, curveSegments: 4 }), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const X = P.getX(i), Y = P.getY(i), Z = P.getZ(i); P.setXYZ(i, -Z - X * X * cup, Y, X); }
      g.computeVertexNormals(); k.own.push(g); return g;
    };
    k.mesh(hoodGeo(1, 0.022), hoodM, hoodG, -2, 0, 0);
    k.mesh(hoodGeo(0.8, 0.026), bellyM, hoodG, 1.2, 0, 0);
    for (const y of [14, 22]) { const b = k.box(1.5, 3, 30, darkM, hoodG, 2.4, y, 0); b.rotation.x = 0; }
    // head
    const head = k.group(R, 56, 66, 0); head.scale.setScalar(1.2);
    k.sphere([19, 9.5, 12.5], headSkin, head, 12, 3, 0);
    k.sphere([12, 7.5, 9.5], headSkin, head, 28, 1, 0);
    k.sphere([6, 6, 6], headSkin, head, 36, 0.5, 0).scale.set(6, 5.5, 7);
    for (const z of [7, -7]) { const br = k.sphere([7, 2.4, 3.6], headSkin, head, 22, 9, z); br.rotation.z = 0.25; br.rotation.y = z > 0 ? 0.25 : -0.25; }   // brow shields: a frown
    const eyes = [8.6, -8.6].map(z => k.eye(3.3, head, 22, 5.5, z, { glow: '#ffd23f', dir: [0.35, 0.15, z > 0 ? 1 : -1] }));
    k.sphere([14, 3, 9], mouthM, head, 22, -2.5, 0);
    const jaw = k.group(head, 4, -3, 0);
    k.sphere([18, 4, 10], headSkin, jaw, 14, -1.5, 0); k.sphere([10, 3, 7], bellyM, jaw, 14, -3.5, 0);
    const fangs = [], drips = [];
    for (const z of [4.2, -4.2]) {
      const f = k.cone(1.3, 9, fangM, head, 34, -6, z, 8); f.rotation.x = Math.PI; f.rotation.z = -0.25; fangs.push(f);
      drips.push(k.sphere([1.2, 1.7, 1.2], venomM, head, 35, -11, z));
    }
    for (let i = 0; i < 4; i++) for (const z of [5, -5]) { const tt = k.cone(0.7, 3, fangM, jaw, 8 + i * 5, 1.5, z * (1 - i * 0.08), 5); }
    const tongue = k.group(head, 36, -2, 0);
    const tg0 = bone(k, 14, 0.9, 0.7, tongueM, tongue); tg0.rotation.z = Math.PI / 2;
    const forks = [1, -1].map(s => { const f = bone(k, 6, 0.6, 0.3, tongueM, tongue); f.position.x = 13.5; f.rotation.set(s * 0.5, 0, Math.PI / 2 + 0.1); return f; });
    let hf = 1, open = 0;
    return (e, t, dt) => {
      const mood = e.mood, held = e.held, angry = mood === 'angry' || e.mode === 'hunt';
      const spit = e.spitT > 0, breathing = e.breath > 0;
      const sway = held ? Math.sin(t * 9) * 6 : Math.sin(t * 1.7 + e.seed) * 4;
      const lunge = spit ? Math.sin(Math.min(1, (0.45 - e.spitT) / 0.45) * Math.PI) * 16 : 0;
      const br = Math.sin(t * 2 + e.seed) * 1.5, crawl = e.moving && !held ? 1 : 0;
      const coilBack = angry && !spit ? -6 : 0;   // drawn back into a striking S
      for (let i = 0; i <= NC; i++) {
        const c = coil[i], p = pts[i], u = i / NC;
        p[0] = c[0]; p[1] = c[1] + br * u; p[2] = c[2] + crawl * Math.sin(e.phase * 2 - u * 9) * 5;
      }
      for (let j = 0; j < NECK.length; j++) {
        const n = NECK[j], p = pts[NC + 1 + j], w = (j + 1) / NECK.length;
        p[0] = n[0] + (sway * 0.4 + lunge + coilBack) * w * w; p[1] = n[1] + sway * w * 0.6 + br; p[2] = n[2] + Math.sin(t * 1.1 + e.seed) * 3 * w;
      }
      bodyM.geometry.setPath(pts);
      // the pale belly runs up the front of the neck
      for (let j = 0; j < 5; j++) { const a = pts[NC - 1 + j], b = bpts[j]; b[0] = a[0] + 8.5 + j * 0.2; b[1] = a[1] - 1; b[2] = a[2]; }
      belly.geometry.setPath(bpts);
      const top = pts[pts.length - 1], below = pts[pts.length - 2];
      head.position.set(top[0], top[1] + 2, top[2]);
      head.rotation.z = (angry ? -0.25 : -0.12) + (mood === 'dizzy' ? -0.5 + Math.sin(t * 3) * 0.2 : 0) + (spit ? -0.15 : 0);
      head.rotation.y = Math.sin(t * 0.9 + e.seed) * 0.12 - 0.3;
      hoodG.position.set(below[0] - 3, below[1] - 14, below[2]); hoodG.rotation.z = -0.12 + (top[0] - below[0]) * -0.01; hoodG.rotation.y = -0.55;
      hf += ((angry || spit || breathing ? 1.25 : 1) - hf) * Math.min(1, dt * 6); hoodG.scale.set(1, 1, hf);
      const wantOpen = breathing ? 0.55 : spit ? 0.5 : angry || mood === 'scared' ? 0.32 : 0.02;
      open += (wantOpen - open) * Math.min(1, dt * 12); jaw.rotation.z = -open;
      for (const f of fangs) f.scale.y = 0.4 + open * 1.6;
      const dr = (t * 1.2) % 1;
      drips.forEach((d, i) => { const q = (dr + i * 0.43) % 1; d.position.y = -9 - open * 9 - q * 12; d.scale.set(1.2 - q * 0.4, 1.7 + q * 1.2, 1.2 - q * 0.4); d.visible = open > 0.15 || i === 0; });
      const flick = Math.sin(t * 6 + e.seed) > 0.2 || spit;
      tongue.visible = flick; if (flick) { const f = Math.sin(t * 30); tongue.rotation.z = -0.1 + f * 0.12 - open * 0.6; tongue.position.y = -2 - open * 6; }
    };
  };

  // ======================================================================================
  // GIANT ANGRY BULL — a coal-black fighting bull the size of a barn: shoulder hump, slabs of muscle,
  // great pale horns going dark at the tips, glowing red eyes, a gold nose ring and steaming nostrils.
  // ======================================================================================
  // a texture that runs from one colour to another along a tube (horns that darken to the tip)
  const gradTex = (a, b) => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, a); g.addColorStop(0.55, a); g.addColorStop(1, b);
    x.fillStyle = g; x.fillRect(0, 0, 4, 64); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  };
  M3.named['giant angry bull'] = function (e, k) {
    const R = rootK(k, e);
    const skin = k.mat(k.col('body'), { rough: 0.55 }), farM = k.mat(k.col('far'), { rough: 0.6 });
    const hoofM = k.mat(k.col('hoof'), { rough: 0.35 }), hairM = k.mat(k.col('hair'), { rough: 0.95 });
    const snoutM = k.mat(k.col('snout'), { rough: 0.4 }), scarM = k.mat('#3a2420', { rough: 0.9 });
    const hornM = k.mat('#ffffff', { rough: 0.35, map: gradTex(k.col('horn'), '#1a1410') });
    const ringM = k.mat('#d4a017', { metal: 0.85, rough: 0.3 }), steamM = k.mat('#ffffff', { opacity: 0.5, rough: 1 });
    const dark = k.mat('#050303', { rough: 0.6 });
    const shift = k.group(R, -12, 0, 0);               // the 2D drawing's own offset
    const rearP = k.group(shift, -90, -100, 0);        // rears up around the back hooves
    const B = k.group(rearP, 90, 100, 0);
    // torso: rump, barrel, deep chest and the hump of muscle over the shoulders
    const trunk = k.lathe([[0, -136], [26, -131], [40, -120], [46, -100], [44, -70], [42, -40], [46, -10], [53, 20], [57, 45], [54, 66], [44, 86], [26, 98], [0, 102]], skin, B, 0, 0, 0, 28);
    trunk.rotation.z = -Math.PI / 2; trunk.scale.set(1, 1, 0.84);
    k.sphere([38, 40, 38], skin, B, -98, 6, 0);                       // rump
    k.sphere([54, 38, 44], skin, B, 38, 36, 0).rotation.z = -0.12;    // the hump
    k.sphere([34, 34, 32], skin, B, 82, 24, 0).rotation.z = -0.5;     // neck
    k.sphere([14, 20, 9], skin, B, 98, -18, 0);                       // dewlap
    for (const z of [1, -1]) {
      const m = z > 0 ? skin : farM;
      k.sphere([32, 36, 16], m, B, -88, 2, z * 26).rotation.z = 0.3;  // haunch
      k.sphere([28, 40, 16], m, B, 58, 2, z * 30).rotation.z = -0.25; // shoulder
    }
    [[46, 20, 0.7, 46], [-14, 8, -0.4, 40]].forEach(([x, y, a, z], i) => { const sc = k.sphere([13 - i * 3, 0.9, 1], scarM, B, x, y, z); sc.rotation.z = a; });   // old scars
    // tail
    const tpts = [[-116, 34, 0], [-136, 0, -4], [-134, -42, -6]];
    const tail = k.tube(tpts, 4.5, 2, skin, B, 10, 8);
    const tuft = k.sphere([6, 11, 6], hairM, B, -134, -48, -6);
    // head on a pivot at the neck
    const head = k.group(B, 92, 34, 0);
    k.sphere([27, 26, 25], skin, head, 22, 4, 0);
    k.sphere([22, 24, 20], skin, head, 42, -10, 0).rotation.z = 0.6;
    k.sphere([15, 16, 17], snoutM, head, 60, -26, 0).rotation.z = 0.4;
    for (const z of [7, -7]) k.sphere([3, 4, 3], dark, head, 71, -22, z);
    const ring = torus(k, 6.5, 1.1, ringM, head, 69, -36, 0);
    for (const z of [1, -1]) {
      const ear = k.sphere([11, 4, 6], z > 0 ? skin : farM, head, 6, 14, z * 27); ear.rotation.set(z * 0.5, z * 0.6, -0.2);
      const brow = k.sphere([10, 4.5, 7], skin, head, 32, 15, z * 19); brow.rotation.set(z * -0.3, 0, -0.35);
      for (let i = 0; i < 3; i++) k.sphere(5, hairM, head, 20 + i * 4, 28 - i * 2, z * (4 + i * 5));
      const hp = [[16, 24, 16], [22, 30, 34], [38, 34, 50], [56, 46, 56], [66, 66, 50], [70, 82, 40]].map(p => [p[0], p[1], p[2] * z]);
      k.tube(hp, 8, 1.2, hornM, head, 16, 10);
    }
    const eyes = [21, -21].map(z => k.eye(4.6, head, 33, 8, z, { glow: '#ff3b30', dir: [0.45, 0.05, z > 0 ? 1 : -1] }));
    const eh = haloMat(k, '#ff2a14', 0.35); for (const z of [22, -22]) k.sphere([6, 6, 4], eh, head, 34, 8, z);
    const steam = [];
    for (let i = 0; i < 4; i++) steam.push(k.sphere(4, steamM, head, 76, -24, (i % 2 ? 7 : -7)));
    // legs: three bones and a hoof each
    const mkLeg = (near, fore) => {
      const m = near ? skin : farM, L = { near, fore };
      L.a = bone(k, 40, fore ? 20 : 22, 13, m, B); L.b = bone(k, 26, 11, 8, m, B); L.c = bone(k, 24, 7, 6.5, m, B);
      L.h = k.group(B); k.cyl(8, 10.5, 12, hoofM, L.h, 3, 6, 0, 12); k.box(1, 12, 21, dark, L.h, 9, 6, 0);
      return L;
    };
    const legs = [mkLeg(false, false), mkLeg(false, true), mkLeg(true, false), mkLeg(true, true)];
    const G = 100, put = (L, z, ax, ay, bx, by, cx, cy, fx, fy) => {
      aim(L.a, ax, -ay, z, bx, -by, z); aim(L.b, bx, -by, z, cx, -cy, z); aim(L.c, cx, -cy, z, fx, -fy, z);
      L.h.position.set(fx, -fy - 8, z);
    };
    let down = 0.08;
    return (e, t, dt) => {
      const mood = e.mood, held = e.held, walking = e.moving && e.grounded && !held, inAir = !e.grounded && !held;
      const charging = e.chargeT > 0, pawing = e.pawT > 0, rear = e.rearT > 0;
      const angry = mood === 'angry' || e.mode === 'hunt' || charging || pawing;
      const ph = e.phase * (charging ? 1.5 : 1);
      const rk = rear ? Math.sin(Math.min(1, (0.7 - e.rearT) / 0.45) * Math.PI / 2) * (e.rearT < 0.2 ? e.rearT / 0.2 : 1) : 0;
      rearP.rotation.z = 0.34 * rk;
      B.rotation.z = charging ? -0.05 : 0; B.position.y = 100 + (walking || charging ? -Math.abs(Math.sin(ph)) * (charging ? 6 : 3) : 0);
      for (const L of legs) {
        const z = L.near ? 30 : -30;
        if (!L.fore) {   // hind leg, same joints as the 2D drawing
          const a = L.near ? ph : ph + Math.PI, hx = L.near ? -90 : -74, hy = L.near ? 10 : 4;
          const lift = (walking || charging) ? Math.max(0, Math.sin(a)) * 13 : inAir ? 10 : 0, sx = Math.sin(a) * (charging ? 28 : 16);
          put(L, z, hx, hy, hx + 12 + sx * 0.3, hy + 40, hx - 8 + sx * 0.6, hy + 66 - lift * 0.4, hx - 2 + sx, G - 2 - lift);
        } else {
          const a = L.near ? ph + Math.PI : ph, sx0 = L.near ? 54 : 64, sy0 = L.near ? 10 : 6;
          let lift = (walking || charging) ? Math.max(0, Math.sin(a)) * 15 : inAir ? 12 : 0, sx = Math.sin(a) * (charging ? 30 : 16);
          if (pawing && L.near) { const s2 = Math.sin(t * 13); lift = 12 + s2 * 7; sx = -8 + s2 * 16; }
          if (rear) { lift = L.near ? 42 : 34; sx = L.near ? 28 : 18; }
          put(L, z, sx0, sy0, sx0 - 2 + sx * 0.3, sy0 + 42 - lift * 0.3, sx0 + 2 + sx * 0.7, sy0 + 64 - lift * 0.7, sx0 + 4 + sx, G - 2 - lift);
        }
      }
      const wantDown = charging ? 0.55 : pawing ? 0.4 + Math.sin(t * 7) * 0.05 : rear ? -0.3 : angry ? 0.24 : 0.08 + Math.sin(t * 1.4 + e.seed) * 0.03;
      down += (wantDown - down) * Math.min(1, dt * 10); head.rotation.z = -down;
      head.rotation.y = held ? Math.sin(t * 8) * 0.2 : 0;
      ring.rotation.z = Math.sin(t * 3) * 0.15 + (charging ? 0.5 : 0);
      // tail swish
      const sw = Math.sin(t * 2.4 + e.seed) * 6 + (charging ? -16 : 0) + (angry ? Math.sin(t * 9) * 4 : 0);
      tpts[1][0] = -142 + sw * 0.4; tpts[2][0] = -134 + sw; tpts[2][1] = charging ? -20 : -42; tpts[2][2] = -6 + Math.sin(t * 1.7) * 6;
      tail.geometry.setPath(tpts); tuft.position.set(tpts[2][0], tpts[2][1] - 6, tpts[2][2]);
      // steam snorting from the nostrils
      const puff = angry || pawing || charging || mood === 'scared';
      steam.forEach((p, i) => {
        p.visible = puff; if (!puff) return;
        const q = (t * (pawing ? 2.6 : 1.4) + i * 0.27) % 1;
        p.position.set(74 + q * 26, -26 - q * 10 + i % 2 * 2, (i % 2 ? 7 : -7) * (1 + q * 1.6)); p.scale.setScalar(2 + q * 8);
      });
    };
  };

  // ======================================================================================
  // GIANT SCORPION — a glossy black emperor scorpion: armoured plates with a spiked keel, eight spiny
  // red-banded legs, two huge granular pincers, and THREE segmented tails ending in glowing venom bulbs.
  // Built in the 2D drawing's working coordinates (scaled by SK, shifted by (-33, 14)).
  // ======================================================================================
  const SK = 1.38;
  M3.named['giant scorpion'] = function (e, k) {
    const R = k.group(k.root); R.scale.setScalar(SK);
    const I = k.group(R, -33, -14, 0);
    const BODY = k.col('body'), FAR = k.col('far'), LEG = k.col('leg'), BAND = k.col('band');
    const shell = k.mat(BODY, { rough: 0.3, metal: 0.08 }), shellD = k.mat(tmpC.set(BODY).multiplyScalar(0.7).getStyle(), { rough: 0.34, metal: 0.08 });
    const farM = k.mat(FAR, { rough: 0.38, metal: 0.05 }), legM = k.mat(LEG, { rough: 0.36, metal: 0.05 });
    const bandM = k.mat(BAND, { rough: 0.4 }), bandF = k.mat(tmpC.set(BAND).multiplyScalar(0.45).getStyle(), { rough: 0.5 });
    const spikeM = k.mat('#08080a', { rough: 0.3 }), toothM = k.mat('#d9d2c0', { rough: 0.4 });
    const venomM = k.mat('#2f9a2a', { glow: '#2fc025', glowK: 0.7, rough: 0.12 }), venomH = haloMat(k, '#5aff4a', 0.13);
    const redGlow = k.mat('#ff2a14', { glow: '#ff2a14', glowK: 1.6, rough: 0.2 });
    // mesosoma: seven overlapping armour plates with a spiked keel, a softer belly underneath
    k.sphere([66, 13, 30], shellD, I, -18, -22, 0);
    for (let i = 0; i < 7; i++) {
      const x = -72 + i * 18.5, w = 1 - Math.abs(i - 3.5) * 0.06;
      const pl = k.sphere([13, 18 * w, 36 * w], shell, I, x, -7, 0); pl.rotation.z = 0.08;
      const kc = k.cone(3, 9 + (i % 2) * 3, spikeM, I, x - 2, -7 + 18 * w + 2, 0, 6); kc.rotation.z = 0.35;
      for (const z of [1, -1]) k.cone(2.2, 7, spikeM, I, x - 1, -6, z * 35 * w, 5).rotation.x = z * 1.3;
    }
    // prosoma (carapace) with glowing red median eyes and clusters of lateral eyes
    k.sphere([30, 19, 33], shell, I, 64, -8, 0);
    k.sphere([12, 10, 24], shell, I, 88, -10, 0);
    for (const z of [5, -5]) k.eye(3.4, I, 66, 10, z, { glow: '#ff2a14', dir: [0.7, 0.7, z * 0.06] });
    const eh = haloMat(k, '#ff2a14', 0.3); k.sphere([10, 6, 12], eh, I, 66, 11, 0);
    for (const z of [1, -1]) for (let j = 0; j < 3; j++) k.sphere(1.6, redGlow, I, 90 + j * 2, -3 + (j % 2) * 3, z * (16 - j * 2.5));
    const chel = [1, -1].map(z => { const c = k.group(I, 96, -15, z * 6); k.sphere([8, 3.5, 3.5], bandM, c, 6, 0, 0); k.cone(1.6, 5, spikeM, c, 15, -1, 0, 5).rotation.z = -Math.PI / 2; return c; });
    // walking legs
    const legs = [];
    for (const far of [true, false]) for (let i = 0; i < 4; i++) {
      const m = far ? farM : legM, bm = far ? bandF : bandM;
      const L = { far, i, a: bone(k, 40, 7, 6, m, I), b: bone(k, 36, 6, 4.4, m, I), c: bone(k, 34, 4.2, 1.4, m, I) };
      L.k1 = k.sphere([6, 5.5, 5.5], bm, I); L.k2 = k.sphere([5, 4.5, 4.5], bm, I);
      if (!far) { L.sp = k.cone(1.4, 6, spikeM, L.a, 0, -20, 4, 5); L.sp.rotation.x = 1.2; }
      legs.push(L);
    }
    // pedipalps: knobbly arm, swollen granular hand, serrated fingers; the near one at +z
    const claws = [true, false].map(far => {
      const col = far ? farM : shell, C = { far };
      C.a = bone(k, 30, 8, 7, col, I); C.b = bone(k, 26, 8, 8.5, col, I);
      C.el = k.sphere(7, col, I);
      k.cone(2, 8, spikeM, C.a, 3, -12, 0, 5).rotation.z = 1.2; k.cone(2, 8, spikeM, C.b, -3, -12, 0, 5).rotation.z = -1.2;
      C.hand = k.group(I);
      const H = k.group(C.hand); H.scale.setScalar(1.45);
      k.sphere([26, 15, 15], col, H, 6, 0, 0);
      for (let j = 0; j < 4; j++) k.sphere(1.8, spikeM, H, -6 + j * 7, 12 - Math.abs(j - 1.5) * 2, (j % 2 ? 5 : -4));
      k.tube([[24, -3, 0], [44, -6, 0], [66, -2, -1]], 6, 1.4, col, H, 10, 8);       // fixed finger
      for (let j = 0; j < 3; j++) k.cone(1.2, 4, toothM, H, 34 + j * 9, -1.5, 0, 4);
      C.mov = k.group(H, 22, 6, 0);
      k.tube([[0, 0, 0], [22, 3, 0], [46, -1, 1]], 5.5, 1.2, col, C.mov, 10, 8);     // movable finger
      for (let j = 0; j < 3; j++) { const tt = k.cone(1.2, 4, toothM, C.mov, 12 + j * 10, -2.5, 0, 4); tt.rotation.x = Math.PI; }
      k.cone(1.8, 6, spikeM, C.mov, 10, 5, 0, 5);
      return C;
    });
    // three tails: seven segments with a spine each, a glowing venom bulb and a hooked stinger
    const BASE = [[-74, -2], [-76, 6], [-72, 14]];
    const REST = [{ c1: [-132, -20], c2: [-150, -128], t: [-70, -110] }, { c1: [-124, 0], c2: [-128, -110], t: [-36, -96] }, { c1: [-112, 14], c2: [-104, -96], t: [-4, -78] }];
    const ZB = [-24, 0, 24];
    const tails = [0, 1, 2].map(i => {
      const m = i === 1 ? shell : shellD, segs = [];
      for (let j = 0; j < 7; j++) {
        const g = k.group(I), rad = 15 - j * 1.2;
        const sp = k.sphere(1, m, g); const sn = j < 6 ? k.cone(2.4, 7, spikeM, g, 0, rad * 0.8 + 3, 0, 5) : null;
        segs.push({ g, sp, rad });
      }
      const tip = k.group(I);
      k.sphere([13, 9.5, 10], venomM, tip, 7, 0, 0); k.sphere([18, 14, 14], venomH, tip, 7, 0, 0);
      k.tube([[14, 4, 0], [30, 0, 0], [38, -8, 0], [41, -17, 0]], 4.2, 0.4, spikeM, tip, 10, 8);
      const drip = k.sphere([1.8, 2.6, 1.8], venomM, tip, 41, -20, 0);
      return { segs, tip, drip };
    });
    const P = (b, c1, c2, tx, ty, u, out) => { const m = 1 - u; out[0] = m * m * m * b[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * tx; out[1] = m * m * m * b[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * ty; return out; };
    const A = [0, 0], Bp = [0, 0], c2 = [0, 0];
    return (e, t, dt) => {
      const mood = e.mood, held = e.held, walking = e.moving && e.grounded && !held;
      const angry = mood === 'angry' || e.mode === 'hunt' || e.stingQ > 0 || e.clawT > 0;
      const G = 84, ph = e.phase * 2;
      // legs, same gait as the 2D drawing, splayed out sideways
      for (const L of legs) {
        const { far, i } = L, a = ph + i * 1.6 + (far ? Math.PI : 0), z = far ? -1 : 1;
        const step = walking ? Math.sin(a) * 12 : held ? Math.sin(t * 12 + i) * 8 : 0;
        const lift = walking ? Math.max(0, Math.cos(a)) * 9 : held ? 16 : 0;
        const tw = Math.sin(t * 8.5 + i * 1.9 + (far ? 2 : 0)) * (angry ? 2.2 : 0.9);
        const spread = (1.5 - i) * 24, ax = (far ? 32 : 36) - i * 22;
        const kx = ax + spread * 0.55 + step * 0.4 + tw, ky = 22 - Math.abs(i - 1.5) * 4 + tw * 0.5;
        const fx = ax + spread * 1.5 + step, fy = -G + lift;
        const mx = kx + (fx - kx) * 0.5 + (fx > kx ? 5 : -5), my = ky + (fy - ky) * 0.45;
        aim(L.a, ax, -12, z * 24, kx, ky, z * 46); aim(L.b, kx, ky, z * 46, mx, my, z * 60); aim(L.c, mx, my, z * 60, fx, fy, z * 68);
        L.k1.position.set(kx, ky, z * 46); L.k2.position.set(mx, my, z * 60);
      }
      // pincers
      for (const C of claws) {
        const far = C.far, z = far ? -1 : 1;
        const ck = e.clawT > 0 ? Math.sin((1 - e.clawT / 0.4) * Math.PI) : 0;
        const open = ck > 0 ? ck : angry ? 0.42 + Math.sin(t * 6 + (far ? 1.3 : 0)) * 0.2 : 0.14 + Math.sin(t * 1.3 + (far ? 1 : 0)) * 0.05;
        const reach = ck * 30, wig = held ? Math.sin(t * 10 + (far ? 1 : 0)) * 8 : Math.sin(t * 1.8 + (far ? 2 : 0) + e.seed) * 2;
        const ex = 104 + reach * 0.4 - (far ? 6 : 0), ey = 18 - wig, hx = 122 + reach - (far ? 8 : 0), hy = 14 - wig;
        aim(C.a, 80, -6, z * 26, ex, ey, z * 52); aim(C.b, ex, ey, z * 52, hx, hy, z * 50);
        C.el.position.set(ex, ey, z * 52);
        C.hand.position.set(hx, hy, z * 50); C.hand.rotation.set(0, z * 0.22, -0.1 + (angry ? 0.12 : 0));
        C.mov.rotation.z = open * 0.8;
      }
      const mw = Math.sin(t * 11 + e.seed) * (angry ? 0.35 : 0.12);
      chel[0].rotation.y = mw; chel[1].rotation.y = -mw;
      // tails
      if (!e.tips) e.tips = [];
      for (let i = 0; i < 3; i++) {
        const b = BASE[i], r = REST[i], TL = tails[i];
        const sway = Math.sin(t * 2 + i * 2.1 + e.seed) * 5 + (held ? Math.sin(t * 9 + i) * 10 : 0) + (angry ? Math.sin(t * 8 + i) * 3 : 0);
        c2[0] = r.c2[0] + sway * 0.5; c2[1] = r.c2[1] + sway * 0.4;
        let tx = r.t[0] + sway, ty = r.t[1] + sway * 0.6;
        const kk = e.tailT && e.tailT[i] > 0 ? Math.sin((1 - e.tailT[i] / 0.35) * Math.PI) : 0;
        if (kk > 0) { c2[0] += 70 * kk; c2[1] -= 30 * kk; tx += (175 - tx) * kk; ty += (20 - ty) * kk; }
        for (let j = 0; j < 7; j++) {
          P(b, r.c1, c2, tx, ty, j / 7, A); P(b, r.c1, c2, tx, ty, (j + 1) / 7, Bp);
          const S = TL.segs[j], dx = Bp[0] - A[0], dy = Bp[1] - A[1], d = Math.hypot(dx, dy) || 1, u = (j + 0.5) / 7;
          S.g.position.set((A[0] + Bp[0]) / 2, -(A[1] + Bp[1]) / 2, ZB[i] * (0.5 + u * 0.9));
          S.g.rotation.z = Math.atan2(-dy, dx);
          S.sp.scale.set(d * 0.7, S.rad, S.rad * 0.95);
        }
        P(b, r.c1, c2, tx, ty, 0.97, A);
        TL.tip.position.set(tx, -ty, ZB[i] * 1.4); TL.tip.rotation.z = Math.atan2(-(ty - A[1]), tx - A[0]);
        const drip = (t * 1.3 + i * 0.37) % 1; TL.drip.visible = angry || drip < 0.3;
        TL.drip.position.y = -20 - drip * 16; TL.drip.scale.set(1.8 - drip * 0.6, 2.6 + drip * 1.5, 1.8 - drip * 0.6);
        e.tips[i] = [(tx - 33) * SK, (ty + 14) * SK];
      }
      pulse(e, venomM, angry ? 1.2 + Math.sin(t * 7) * 0.35 : 0.6);
    };
  };

  // ======================================================================================
  // SWARMS — the minions (e.wasps, in game coordinates) are drawn as instanced meshes in k.world:
  // one merged, vertex-coloured body geometry per kind plus a wing geometry that flaps by flipping.
  // ======================================================================================
  // merge [geometry, matrix, colour | (x, y, z) => colour] parts into one non-indexed geometry with vertex colours
  function merged(parts) {
    const gs = []; let n = 0;
    for (const [g0, m, c] of parts) { const g = (g0.index ? g0.toNonIndexed() : g0.clone()); g0.dispose(); g.userData.c = c; g.userData.src = g.attributes.position.clone(); g.applyMatrix4(m); gs.push(g); n += g.attributes.position.count; }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), cc = new T.Color();
    let o = 0;
    for (const g of gs) {
      const P = g.attributes.position, N = g.attributes.normal, S = g.userData.src, c = g.userData.c;
      pos.set(P.array, o * 3); nor.set(N.array, o * 3);
      for (let i = 0; i < P.count; i++) { cc.set(typeof c === 'function' ? c(S.getX(i), S.getY(i), S.getZ(i)) : c); col[(o + i) * 3] = cc.r; col[(o + i) * 3 + 1] = cc.g; col[(o + i) * 3 + 2] = cc.b; }
      o += P.count; g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.computeBoundingSphere(); return out;
  }
  const M4 = (x, y, z, sx, sy, sz, rx, ry, rz) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx, sy, sz));
  const SPH = (w, h) => new T.SphereGeometry(1, w || 10, h || 7);
  // one small wasp, in the 2D D.wasp's units (y up), facing +x
  const waspGeo = () => M3.geo('b2waspBody', () => merged([
    [SPH(12, 8), M4(-6, -1.5, 0, 6.2, 3.6, 3.4, 0, 0, -0.25), (x) => (x < -0.8 || Math.sin((x + 1) * Math.PI * 2.6) > 0.35) ? '#24170a' : '#f6c90e'],
    [SPH(8, 6), M4(1, 0, 0, 3.4, 3, 3), '#3a2a10'],
    [SPH(8, 6), M4(5, 0.5, 0, 2.6, 2.6, 2.4), '#f0b20c'],
    [SPH(6, 4), M4(5.9, 1, 1.4, 1.1, 1.8, 0.9), '#e01a10'], [SPH(6, 4), M4(5.9, 1, -1.4, 1.1, 1.8, 0.9), '#e01a10'],
    [new T.ConeGeometry(0.7, 4, 5), M4(-13.5, -3.6, 0, 1, 1, 1, 0, 0, Math.PI / 2 + 0.25), '#1a1206'],
    [new T.BoxGeometry(0.5, 5, 0.5), M4(-0.5, -3.5, 1.3, 1, 1, 1, 0.3, 0, 0.3), '#2b1d08'], [new T.BoxGeometry(0.5, 5, 0.5), M4(-0.5, -3.5, -1.3, 1, 1, 1, -0.3, 0, 0.3), '#2b1d08'],
    [new T.BoxGeometry(0.5, 5, 0.5), M4(2, -3.5, 1.3, 1, 1, 1, 0.3, 0, -0.1), '#2b1d08'], [new T.BoxGeometry(0.5, 5, 0.5), M4(2, -3.5, -1.3, 1, 1, 1, -0.3, 0, -0.1), '#2b1d08'],
    [new T.BoxGeometry(0.4, 4.5, 0.4), M4(7.5, 3.5, 0.8, 1, 1, 1, 0.3, 0, -0.6), '#1a1206'], [new T.BoxGeometry(0.4, 4.5, 0.4), M4(7.5, 3.5, -0.8, 1, 1, 1, -0.3, 0, -0.6), '#1a1206']
  ]));
  // a pair of wings with the hinge at the origin: flipping it in y flaps them
  const wingGeo = (len, wid) => M3.geo('b2wing:' + len + ':' + wid, () => merged([
    [SPH(10, 4), M4(-len * 0.3, len * 0.18, wid * 1.1, len * 0.55, 0.25, wid, 0.45, 0.35, 0), '#ffffff'],
    [SPH(10, 4), M4(-len * 0.3, len * 0.18, -wid * 1.1, len * 0.55, 0.25, wid, -0.45, -0.35, 0), '#ffffff'],
    [SPH(8, 4), M4(-len * 0.45, len * 0.1, wid * 0.8, len * 0.38, 0.2, wid * 0.7, 0.3, 0.6, 0), '#ffffff'],
    [SPH(8, 4), M4(-len * 0.45, len * 0.1, -wid * 0.8, len * 0.38, 0.2, wid * 0.7, -0.3, -0.6, 0), '#ffffff']
  ]));
  // one small beetle, in the 2D D.miniBeetle's units (y up): the shell takes the instance colour
  const beetleGeo = () => M3.geo('b2beetleBody', () => merged([
    [new T.SphereGeometry(1, 12, 5, 0, TAU, 0, Math.PI / 2), M4(-1, -1.5, 0, 7, 5.2, 5), '#ffffff'],
    [SPH(10, 4), M4(-1, -1.5, 0, 6.8, 1.2, 4.8), '#111111'],
    [SPH(8, 6), M4(4.6, -0.6, 0, 2.8, 2.5, 3.6), '#7a7a7a'],
    [SPH(8, 6), M4(7.2, -1.2, 0, 2.2, 2, 2.6), '#141414'],
    [SPH(4, 3), M4(8.2, -0.6, 1.4, 0.7, 0.7, 0.7), '#ff2a14'], [SPH(4, 3), M4(8.2, -0.6, -1.4, 0.7, 0.7, 0.7), '#ff2a14'],
    [new T.BoxGeometry(0.4, 4, 0.4), M4(9, 1.6, 0.9, 1, 1, 1, 0.3, 0, -0.7), '#141414'], [new T.BoxGeometry(0.4, 4, 0.4), M4(9, 1.6, -0.9, 1, 1, 1, -0.3, 0, -0.7), '#141414'],
    ...[-3, 0, 3].flatMap(x => [1, -1].map(z => [new T.BoxGeometry(0.7, 5, 0.7), M4(x, -3.6, z * 4.4, 1, 1, 1, z * 0.7, 0, x * 0.06), '#141414']))
  ]));
  const CAP = 150;
  // the instanced swarm in k.world; returns sync(e, t, dt)
  function swarm(k, e, kind) {
    const beetle = kind === 'beetle';
    const bodyM = k.mat('#ffffff', { rough: beetle ? 0.22 : 0.45, metal: beetle ? 0.2 : 0, vc: 1 }); bodyM.vertexColors = true;
    const wingM = k.mat(beetle ? '#c9b49a' : '#eef6ff', { opacity: 0.42, side: 'double', rough: 0.2 });
    const body = new T.InstancedMesh(beetle ? beetleGeo() : waspGeo(), bodyM, CAP), wings = new T.InstancedMesh(beetle ? wingGeo(11, 2.4) : wingGeo(10, 2.2), wingM, CAP);
    for (const m of [body, wings]) { m.frustumCulled = false; m.castShadow = true; m.count = 0; m.instanceMatrix.setUsage(T.DynamicDrawUsage); k.world.add(m); k.own.push({ dispose: () => m.dispose() }); }
    const col = new T.Color('#ffffff'); for (let i = 0; i < CAP; i++) body.setColorAt(i, col);
    k.ownsWorld = true;
    const mtx = new T.Matrix4(), wm = new T.Matrix4(), loc = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3();
    return (e, t, dt) => {
      const ws = e.wasps || [], hide = e.invisible ? 0.0001 : 1;
      let n = 0, nw = 0;
      for (const w of ws) {
        if (n >= CAP) break;
        const al = w.dead ? Math.max(0, w.life / 1.2) : 1; if (al <= 0.02) continue;
        const dir = w.vx >= 0 ? 1 : -1, want = dir > 0 ? -0.38 : Math.PI + 0.38;
        if (w._yaw == null) w._yaw = want; w._yaw += (want - w._yaw) * Math.min(1, dt * 10);
        const s = (beetle ? Math.max(1.75, e.scale * 1.75) : Math.max(1.3, e.scale * 1.3)) * (w.dead ? 0.5 + al * 0.5 : 1) * hide;
        const z = ((w.seed * 7.13) % 1 - 0.5) * (beetle ? 70 : 110);
        const fly = !beetle || w.fly;
        const bob = beetle && !fly && !w.dead ? Math.abs(Math.sin(t * 22 + w.seed)) * 0.5 : 0;
        const pitch = w.dead ? t * 7 + w.seed : fly ? clamp(-w.vy * 0.0012, -0.6, 0.6) : 0;
        eu.set(w.dead ? t * 5 : beetle ? Math.sin(t * 22 + w.seed) * 0.06 : 0, w._yaw, pitch);
        mtx.compose(pv.set(w.x, -(beetle ? w.y - 3 : w.y) + bob, z), q.setFromEuler(eu), sv.set(s, s, s));
        body.setMatrixAt(n, mtx);
        if (beetle) body.setColorAt(n, col.set(w.col || '#2e8b57').multiplyScalar(w.dead ? 0.5 : 1).lerp(tmpC.set('#ffffff'), w.cracked && !w.dead ? 0.25 : 0));
        n++;
        if (fly && !w.dead) {
          const f = Math.sin(t * (beetle ? 60 : 70) + w.seed * 7);
          loc.makeScale(1, Math.abs(f) < 0.15 ? (f < 0 ? -0.15 : 0.15) : f, 1); loc.setPosition(beetle ? -1 : -1, beetle ? 2.5 : 3, 0);
          wings.setMatrixAt(nw++, wm.multiplyMatrices(mtx, loc));
        }
      }
      body.count = n; wings.count = nw;
      body.instanceMatrix.needsUpdate = true; wings.instanceMatrix.needsUpdate = true;
      if (beetle && body.instanceColor) body.instanceColor.needsUpdate = true;
    };
  }

  // the queen: a murder hornet (big orange head, dark banded abdomen, glowing red eyes, a little gold crown)
  let veinCv = null;
  function veinTex() {   // a pale wing membrane with dark veins (for big wings)
    if (!veinCv) {
      const c = veinCv = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 64); x.strokeStyle = 'rgba(60,40,20,0.85)'; x.lineWidth = 2;
      const L = (pts) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke(); };
      L([256, 30, 180, 22, 90, 18, 10, 26]); L([256, 34, 170, 40, 80, 46, 14, 40]); L([200, 24, 150, 6]); L([150, 20, 110, 4]); L([120, 19, 60, 8]); L([180, 38, 130, 58]); L([120, 43, 70, 60]);
      x.lineWidth = 1; L([170, 23, 168, 39]); L([110, 19, 112, 44]); L([60, 22, 64, 44]);
    }
    const t = new T.CanvasTexture(veinCv); t.encoding = T.sRGBEncoding; return t;
  }
  // a flat wing outline (x back from the hinge, z out to the side) with a vein texture
  function bigWing(k, len, wid, m, parent) {
    const pts = [[0, 0], [-0.15, 0.45], [-0.45, 0.75], [-0.75, 0.8], [-0.95, 0.55], [-1, 0.2], [-0.9, -0.1], [-0.6, -0.25], [-0.3, -0.2], [-0.08, -0.1]];
    const sh = new T.Shape(); sh.moveTo(0, 0); sh.splineThru(pts.slice(1).map(([a, b]) => new T.Vector2(a * len, b * wid))); sh.lineTo(0, 0);
    const g = new T.ShapeGeometry(sh, 10); g.rotateX(Math.PI / 2);
    const P = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < P.count; i++) uv.setXY(i, 1 + P.getX(i) / len, 0.5 - P.getZ(i) / wid * 0.55);
    k.own.push(g); return k.mesh(g, m, parent);
  }
  M3.named['wasp swarm'] = function (e, k) {
    const R = rootK(k, e);
    const orange = k.mat(k.col('body'), { rough: 0.5 }), dark = k.mat(k.col('dark'), { rough: 0.45 }), brown = k.mat('#3a2410', { rough: 0.55 });
    const gold = k.mat(k.col('gold'), { metal: 0.8, rough: 0.3 });
    const eyeM = k.mat('#2a0402', { glow: '#c81a0c', glowK: 0.45, rough: 0.1 }), eyeH = haloMat(k, '#ff2a14', 0.16);
    const wingM = own(k, new T.MeshStandardMaterial({ color: new T.Color(k.col('wing')), map: veinTex(), transparent: true, opacity: 0.58, side: T.DoubleSide, roughness: 0.25, depthWrite: false }));
    const venom = k.mat('#c8ff9a', { glow: '#9aff5a', glowK: 0.8 });
    const bodyG = k.group(R);
    // abdomen: banded segments trailing back and down from the waist, the stinger at the tip
    const ab = k.group(bodyG, 2, -2, 0);
    // one smooth lathed abdomen, creased between segments, coloured in bands (front of each segment orange)
    const RAD = [10, 16, 20, 19.5, 16, 10.5, 3], prof = [[0, 0]];
    for (let y = 0; y <= 76; y += 1.25) {
      const sY = (y - 6) / 11, j = Math.floor(sY), f = sY - j, u = clamp(sY - 0.5, 0, 6), i0 = Math.floor(u);
      const env = y < 6 ? 4 + y : RAD[i0] + (RAD[Math.min(6, i0 + 1)] - RAD[i0]) * (u - i0);
      prof.push([env * (y < 6 ? 1 : 0.9 + 0.1 * Math.sin(Math.PI * f)) * (y > 70 ? (76 - y) / 6 : 1), -y]);
    }
    prof.push([0, -76]);
    const abM = k.mat('#ffffff', { rough: 0.42, vc: 1 }); abM.vertexColors = true;
    const abL = k.lathe(prof, abM, k.group(ab, 0, 0, 0), 0, 0, 0, 22); abL.parent.rotation.z = -Math.PI / 2; abL.scale.z = 0.92;
    { const P = abL.geometry.attributes.position, C = new Float32Array(P.count * 3), co = new T.Color(k.col('body')), cd = new T.Color(k.col('dark')), cc = new T.Color();
      for (let i = 0; i < P.count; i++) {
        const y = -P.getY(i) - 6, j = Math.floor(y / 11), f = y / 11 - j;
        const orangeK = y < 0 ? 0 : j <= 3 ? 1 - sm(0.3, 0.42, f) : j === 4 ? 1 - sm(0.15, 0.25, f) : 0;
        cc.copy(cd).lerp(co, orangeK); C[i * 3] = cc.r; C[i * 3 + 1] = cc.g; C[i * 3 + 2] = cc.b;
      }
      abL.geometry.setAttribute('color', new T.BufferAttribute(C, 3)); }
    const sting = k.group(ab, -76, 0, 0);
    k.cone(2.6, 14, dark, sting, -4, 0, 0, 8).rotation.z = Math.PI / 2;
    const vd = k.sphere([1.4, 1.9, 1.4], venom, sting, -11, -1.5, 0);
    k.sphere([5, 4, 4], brown, bodyG, 4, -2, 0);                       // waist
    k.sphere([16, 13.5, 13], brown, bodyG, 18, 4, 0);                  // thorax
    for (const [x, y] of [[12, 15], [24, 16]]) k.sphere([3, 1.5, 3], orange, bodyG, x, y, 0);
    // head: big and orange, kidney-shaped red compound eyes, scissor mandibles, elbowed antennae, crown
    const head = k.group(bodyG, 40, 6, 0);
    k.sphere([12, 13, 13], orange, head);
    for (const z of [1, -1]) {
      const ey = k.sphere([5.5, 9, 4], eyeM, head, 4, 3, z * 9); ey.rotation.x = z * 0.25;
      k.sphere([7, 11, 5], eyeH, head, 4.5, 3, z * 9.5);
      k.tube([[5, 11, z * 3], [7, 22, z * 6], [14, 30, z * 9], [24, 32, z * 12]], 0.9, 0.6, dark, head, 8, 5);
    }
    for (let i = 0; i < 3; i++) k.sphere(0.9, eyeM, head, 2 + i * 2, 12.5 - (i % 2), (i - 1) * 2.4);
    const mand = [1, -1].map(z => { const m = k.group(head, 7, -8, z * 4); const c = k.cone(2.8, 11, dark, m, 4, -1, 0, 6); c.rotation.z = -1.9; return m; });
    k.sphere([9, 10, 11], dark, head, -5, 1, 0);   // the dark back of the head
    const crown = k.group(head, -2, 12, 0);
    k.cyl(5.5, 5, 3, gold, crown, 0, 1.5, 0, 14);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.cone(1.3, 4, gold, crown, Math.cos(a) * 5, 5, Math.sin(a) * 5, 5); }
    // wings: two pairs on the thorax
    const wings = [];
    for (const z of [1, -1]) for (const hind of [false, true]) {
      const h = k.group(bodyG, hind ? 12 : 18, 14, z * 6);
      const w = bigWing(k, hind ? 42 : 62, hind ? 12 : 16, wingM, h);
      if (z < 0) w.scale.z = -1;
      wings.push({ h, z, hind });
    }
    // legs dangling from the thorax
    const legs = [];
    for (const z of [1, -1]) for (let i = 0; i < 3; i++) legs.push({ z, i, a: bone(k, 16, 2.2, 1.8, brown, bodyG), b: bone(k, 15, 1.8, 1, orange, bodyG) });
    const minions = swarm(k, e, 'wasp');
    return (e, t, dt) => {
      const held = e.held, flying = e.flying || held, angry = e.mood === 'angry' || e.mode === 'hunt';
      const f = flying ? Math.sin(t * 55 + e.seed) : 0;
      bodyG.position.y = flying ? Math.sin(t * 6 + e.seed) * 2 : 0;
      ab.rotation.z = 0.32 + (angry ? 0.25 + Math.sin(t * 9) * 0.06 : Math.sin(t * 3) * 0.04);   // pumping, curling to sting when angry
      for (const W of wings) {
        if (flying) { W.h.rotation.set(W.z * (0.25 + f * 0.75) * (W.hind ? 0.9 : 1), W.z * -0.35, 0.15); }
        else { W.h.rotation.set(W.z * 0.06, W.z * -(W.hind ? 0.12 : 0.05), -0.2); }
      }
      for (const L of legs) {
        const x = 8 + L.i * 8, sw = Math.sin(t * 6 + L.i) * 3, z = L.z;
        const kx = x - 4 + sw, ky = -16 - (flying ? 0 : 4), fx = x - 8 + sw + (flying ? 0 : L.i * 4 - 4), fy = flying ? -28 : -44;
        aim(L.a, x, -4, z * 7, kx, ky, z * 14); aim(L.b, kx, ky, z * 14, fx, fy, z * 17);
      }
      const ms = Math.sin(t * 7 + e.seed) * (angry ? 0.35 : 0.12); mand[0].rotation.y = 0.3 + ms; mand[1].rotation.y = -0.3 - ms;
      head.rotation.z = held ? Math.sin(t * 9) * 0.15 : 0;
      vd.visible = angry; vd.position.y = -1.5 - ((t * 1.4) % 1) * 6;
      pulse(e, eyeM, angry ? 1 : 0.55);
      minions(e, t, dt);
    };
  };

  // the king: a glossy black rhinoceros beetle with a great forked horn, red eyes and a gold crown
  M3.named['beetle swarm'] = function (e, k) {
    const R = rootK(k, e), I = k.group(R, -10, -4, 0);
    const shell = k.mat(k.col('body'), { rough: 0.16, metal: 0.3 }), darkM = k.mat(k.col('dark'), { rough: 0.3, metal: 0.2 });
    const farM = k.mat(k.col('far'), { rough: 0.35 }), hornM = k.mat(k.col('horn'), { rough: 0.2, metal: 0.25 });
    const gold = k.mat(k.col('gold'), { metal: 0.8, rough: 0.3 }), eh = haloMat(k, '#ff2a14', 0.3);
    const memM = k.mat('#8a6a48', { opacity: 0.45, side: 'double', rough: 0.3 });
    // elytra: two glossy half-domes meeting along the back; they crack open when it is angry
    const ely = [1, -1].map(z => {
      const g = k.group(I, -14, -18, 0);
      const d = k.mesh(domeGeo(z > 0 ? 0 : Math.PI, Math.PI), shell, g); d.scale.set(56, 44, 46);
      k.tube([[-54, 3, 0], [-40, 30, 0], [-14, 44.5, 0], [12, 38, 0], [34, 18, 0]], 1.4, 1.4, darkM, g, 14, 5).position.z = z * 0.6;
      return g;
    });
    k.sphere([54, 12, 42], darkM, I, -14, -20, 0);
    const hw = [1, -1].map(z => { const g = k.group(I, 10, 10, z * 8); bigWing(k, 70, 20, memM, g); if (z < 0) g.scale.z = -1; g.visible = false; return g; });
    // pronotum with its short horn, and the gold crown
    k.sphere([24, 21, 30], shell, I, 34, -4, 0);
    const ph = k.tube([[34, 12, 0], [40, 24, 0], [46, 32, 0]], 6, 1.5, hornM, I, 8, 8);
    const crown = k.group(I, 24, 14, 0); crown.rotation.z = 0.35;
    k.cyl(7, 6.5, 4, gold, crown, 0, 2, 0, 14); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.cone(1.6, 5, gold, crown, Math.cos(a) * 6.5, 6, Math.sin(a) * 6.5, 5); }
    // head and the great curved horn with its forked tip
    const head = k.group(I, 56, -12, 0);
    k.sphere([12, 10, 13], darkM, head);
    k.tube([[2, 4, 0], [20, 10, 0], [32, 22, 0], [36, 42, 0], [32, 54, 0]], 6.5, 2, hornM, head, 16, 10);
    for (const z of [1, -1]) { const c = k.cone(2, 10, hornM, head, 32 + 1, 56, z * 2.5, 6); c.rotation.set(z * 0.5, 0, -0.3); }
    for (const z of [1, -1]) { k.eye(3.2, head, 5, 3, z * 10, { glow: '#ff3b30', dir: [0.5, 0.1, z] }); k.sphere([5, 5, 3], eh, head, 5.5, 3, z * 10.5); }
    const mand = [1, -1].map(z => { const m = k.group(head, 10, -6, z * 5); k.cone(1.8, 8, darkM, m, 3, 0, 0, 5).rotation.z = -1.7; return m; });
    for (const z of [1, -1]) k.tube([[9, 0, z * 9], [14, 2, z * 13], [18, 6, z * 14]], 0.8, 0.8, darkM, head, 5, 4);
    // six legs: thick spiny femurs, toothed tibias, hooked feet
    const legs = [];
    for (const far of [true, false]) for (let i = 0; i < 3; i++) {
      const m = far ? farM : darkM, L = { far, i, a: bone(k, 26, 6, 4.6, m, I), b: bone(k, 30, 4.6, 2.6, m, I) };
      for (let j = 0; j < 3; j++) k.cone(1.2, 5, m, L.b, 2, -6 - j * 8, 0, 4).rotation.z = 1.1;
      legs.push(L);
    }
    const minions = swarm(k, e, 'beetle');
    let open = 0;
    return (e, t, dt) => {
      const held = e.held, walking = e.moving && e.grounded && !held, angry = e.mood === 'angry' || e.mode === 'hunt';
      const G = 56, phase = e.phase * 2;
      for (const L of legs) {
        const { far, i } = L, a = phase + i * 2.1 + (far ? Math.PI : 0), z = far ? -1 : 1;
        const step = walking ? Math.sin(a) * 9 : held ? Math.sin(t * 12 + i) * 8 : 0, lift = walking ? Math.max(0, Math.cos(a)) * 6 : held ? 12 : 0;
        const ax = 28 - i * 30, spread = (1 - i) * 22, kx = ax + spread * 0.5 + step * 0.4, fx = ax + spread * 1.3 + step;
        aim(L.a, ax, -16, z * 22, kx, -14, z * 40); aim(L.b, kx, -14, z * 40, fx, -G + lift, z * 47);
      }
      open += ((angry ? 0.22 + Math.sin(t * 5) * 0.04 : 0) - open) * Math.min(1, dt * 5);
      ely[0].rotation.set(open, 0, open * 0.6); ely[1].rotation.set(-open, 0, open * 0.6);
      for (const w of hw) { w.visible = open > 0.08; w.rotation.x = (w.scale.z > 0 ? 1 : -1) * Math.sin(t * 50) * 0.3 * open * 4; }
      head.rotation.z = angry ? 0.12 + Math.sin(t * 4) * 0.06 : held ? Math.sin(t * 8) * 0.2 : Math.sin(t * 1.2 + e.seed) * 0.04;
      const ms = Math.sin(t * 9 + e.seed) * (angry ? 0.4 : 0.1); mand[0].rotation.y = 0.3 + ms; mand[1].rotation.y = -0.3 - ms;
      minions(e, t, dt);
    };
  };

  // ======================================================================================
  // GIANT PRAYING MANTIS — raised slender neck, a triangular head that turns to watch you with huge red
  // compound eyes, spined raptorial forelegs that fold like knives and strike, leathery wings folded on a
  // long ringed abdomen. Fades out when camouflaged (e.camo).
  // ======================================================================================
  const ringTex = () => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 4, 128); x.fillStyle = 'rgba(40,50,20,0.5)';
    for (let i = 1; i < 9; i++) x.fillRect(0, 128 * (0.12 + i * 0.09), 4, 2.5);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  };
  // fade every material (camouflage), on top of the renderer's own effects
  function fadeAll(k, e, f) {
    for (const m of k.mats) {
      const b = m.userData.base, op = (e.invisible ? 0.28 : 1) * (b.opacity != null ? b.opacity : 1) * f, tr = b.transparent || op < 0.999;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = op; m.depthWrite = !tr || op > 0.6;
    }
  }
  M3.named['giant praying mantis'] = function (e, k) {
    const R = rootK(k, e), I = k.group(R, -20, -12, 0);
    const bodyM = k.mat(k.col('body'), { rough: 0.6 }), farM = k.mat(k.col('far'), { rough: 0.65 }), legM = k.mat(k.col('leg'), { rough: 0.6 });
    const bellyM = k.mat(k.col('belly'), { rough: 0.7 }), spineM = k.mat('#2c3018', { rough: 0.5 });
    const abM = own(k, new T.MeshStandardMaterial({ color: new T.Color(k.col('body')), map: ringTex(), roughness: 0.6 }));
    const wingM = own(k, new T.MeshStandardMaterial({ color: new T.Color(k.col('wing')), map: veinTex(), roughness: 0.7, side: T.DoubleSide }));
    const hindM = own(k, new T.MeshStandardMaterial({ color: new T.Color(k.col('wing')).lerp(new T.Color('#ffffff'), 0.4), map: veinTex(), transparent: true, opacity: 0.45, side: T.DoubleSide, roughness: 0.3, depthWrite: false }));
    const eyeC = k.col('eye'), eh = haloMat(k, eyeC, 0.1), ocM = k.mat(eyeC, { glow: eyeC, glowK: 1.4 });
    const eyeM = k.mat('#' + tmpC.set(eyeC).multiplyScalar(0.35).getHexString(), { glow: eyeC, glowK: 0.28, rough: 0.08 }), pupils = [];
    // abdomen: a long ringed tube, widest in the middle, the tip tilted up; pale underside
    const abP = [[-4, -18, 0], [-36, -18, 0], [-72, -18, 0], [-106, -16, 0], [-126, -11, 0]];
    const ab = k.tube(abP, u => 5 + 11 * Math.sin(Math.min(1, u * 1.25) * Math.PI) ** 0.7 + (u < 0.1 ? 2 : 0), 0, abM, I, 24, 12); ab.scale.z = 1.25;
    k.tube([[-8, -24, 0], [-40, -27, 0], [-76, -27, 0], [-108, -21, 0], [-122, -16, 0]], u => 4 + 6 * Math.sin(u * Math.PI), 0, bellyM, I, 16, 8).scale.z = 1.4;
    // folded leathery forewings lying on the back like a roof, hind wings that open in a leap
    const teg = [1, -1].map(z => { const g = k.group(I, -2, -3, z * 1); const w = bigWing(k, 120, 16, wingM, g); w.scale.z = z * 1; g.rotation.x = z * 0.35; return g; });
    const hind = [1, -1].map(z => { const g = k.group(I, -6, -2, 0); const w = bigWing(k, 96, 46, hindM, g); w.scale.z = z * 1; g.visible = false; return g; });
    k.sphere([15, 9, 11], bodyM, I, -2, -15, 0);   // meso/metathorax
    // the long prothorax ("neck") and the head
    const neckP = [[4, -12, 0], [22, 18, 0], [46, 58, 0]];
    const neck = k.tube(neckP, 7, 4.6, bodyM, I, 10, 10);
    const collar = k.sphere([8.5, 6.5, 8], bodyM, I, 47, 57, 0);
    const head = k.group(I, 58, 76, 0); head.scale.setScalar(1.35);
    k.sphere([7, 10, 12], bodyM, head, 0, 0, 0);
    const fr = k.cone(6.5, 15, bodyM, head, 4, -9, 0, 10); fr.rotation.z = Math.PI - 0.45; fr.scale.z = 1.3;
    for (const z of [1, -1]) {
      k.sphere([6.5, 8, 6], eyeM, head, 3, 5, z * 11.5);
      k.sphere([8, 9.5, 7], eh, head, 3.5, 5, z * 12.5);
      pupils.push(k.sphere(1.6, k.mat('#080404', { rough: 0.2 }), head, 3, 5, z * 11.5));
      k.tube([[2, 9, z * 3], [8, 30, z * 5], [22, 52, z * 9], [50, 62, z * 14]], 0.8, 0.5, legM, head, 10, 5);
      const palp = bone(k, 7, 1.2, 0.9, legM, head); palp.position.set(9, -15, z * 2.5); palp.rotation.z = 0.3;
    }
    for (let i = 0; i < 3; i++) k.sphere(1.1, ocM, head, 5, 9.5 + (i === 1 ? 1.5 : 0), (i - 1) * 2.6);
    // raptorial forelegs: coxa, a thick femur lined with spines, a spined tibia folded against it, a hook
    const fore = [false, true].map(far => {
      const m = far ? farM : bodyM, F = { far };
      F.cx = bone(k, 30, 4.4, 3.8, m, I);
      F.fe = bone(k, 50, 4.2, 3.2, m, I); k.sphere([5.4, 14, 5], m, F.fe, 0, -20, 0);
      F.sp = k.group(F.fe);
      for (let j = 1; j <= 7; j++) { const big = j === 3 || j === 6 ? 1.7 : 1; const c = k.cone(1.1 * big, 5 * big, spineM, F.sp, 4.2, -6 - j * 5.5, 0, 5); c.rotation.z = -1.3; }
      F.ti = bone(k, 32, 3.2, 2.2, m, I);
      F.tsp = k.group(F.ti);
      for (let j = 1; j <= 5; j++) { const c = k.cone(0.8, 3.5, spineM, F.tsp, 2.6, -j * 5, 0, 4); c.rotation.z = -1.2; }
      const hook = k.cone(1.6, 7, spineM, F.ti, 1.5, -33, 0, 5); hook.rotation.z = -2.4;
      return F;
    });
    // walking legs: middle and hind pairs, long and thin with high knees
    const walk = [];
    for (const far of [true, false]) for (const hindL of [false, true]) {
      const m = far ? farM : legM;
      walk.push({ far, hindL, a: bone(k, 40, 4, 3, m, I), b: bone(k, 50, 3, 1.8, m, I), c: bone(k, 10, 1.6, 1, m, I), kn: k.sphere(2.6, m, I) });
    }
    const v3 = new T.Vector3();
    let lastF = 1, look = -0.5;
    return (e, t, dt) => {
      const mood = e.mood, held = e.held, walking = e.moving && e.grounded && !held;
      const angry = mood === 'angry' || e.mode === 'hunt', inAir = !e.grounded && !held;
      const G = 100, ph = e.phase * 1.6;
      const sway = held ? Math.sin(t * 10) * 6 : Math.sin(t * 1.3 + e.seed) * 3;
      // neck and head
      neckP[1][0] = 22; neckP[1][1] = 18 - sway; neckP[2][0] = 46 + sway * 0.45; neck.geometry.setPath(neckP);
      collar.position.set(47 + sway * 0.45, 57, 0);
      head.position.set(58 + sway * 0.5, 76, 0);
      const busy = e.strikeT > 0 || e.slashT > 0 || e.grabbed;
      look += ((busy ? 0 : angry ? -0.25 : -0.6 + Math.sin(t * 0.4 + e.seed) * 0.25) - look) * Math.min(1, dt * (busy ? 20 : 3));
      head.rotation.y = look;
      // the dark pseudopupil that seems to follow you
      pupils.forEach((pp, i) => { const z = i ? -1 : 1; v3.set(0.55 + (e.lookX || 0) * 0.2, 0.1 - (e.lookY || 0) * 0.3, z).normalize(); pp.position.set(3 + v3.x * 6.4, 5 + v3.y * 7.8, z * 11.5 + v3.z * 5.9); }); head.rotation.z = (e.lookY || 0) * -0.3 + (held ? Math.sin(t * 9) * 0.2 : 0);
      // forelegs, same poses as the 2D drawing
      const sk = e.strikeT > 0 ? Math.min(1, (0.3 - e.strikeT) / 0.12) : 0;
      const sl = e.slashT > 0 ? Math.sin((1 - e.slashT / 0.35) * Math.PI) : 0;
      for (const F of fore) {
        const far = F.far, o = far ? -5 : 0, z = far ? -11 : 11;
        const bx = 48 + sway * 0.45 + o, by = -56 + o, cx = bx + 8, cy = by + 30;
        let fx = 92, fy = -64, tx = 70, ty = -38;
        if (e.grabbed) { fx = 112; fy = -54; tx = 120; ty = -28; }
        else if (sk > 0) { fx = 92 + 40 * sk; fy = -64 + 18 * sk; tx = 70 + 94 * sk; ty = -38 - 6 * sk; }
        else if (sl > 0) { fx = 92 + 22 * sl; fy = -64 - 36 * sl; tx = 70 + 78 * sl; ty = -38 - (far ? 10 : -6) * sl; }
        else if (held) { fx = 84; fy = -88 + Math.sin(t * 12 + o) * 6; tx = 102; ty = -98; }
        else if (angry) { fx = 98; fy = -78; tx = 82; ty = -52; }
        fx += sway * 0.5 + o; tx += sway * 0.5 + o; fy += o; ty += o;
        aim(F.cx, bx, -by, z * 0.6, cx, -cy, z); aim(F.fe, cx, -cy, z, fx, -fy, z); aim(F.ti, fx, -fy, z, tx, -ty, z);
        // spines face the folded tibia
        const dx = fx - cx, dy = -fy + cy, d = Math.hypot(dx, dy) || 1, side = ((-dy / d) * (tx - cx) + (dx / d) * (-ty + cy)) >= 0 ? 1 : -1;
        F.sp.scale.x = side;
        const ex = tx - fx, ey = -ty + fy, dd = Math.hypot(ex, ey) || 1, side2 = ((-ey / dd) * (fx - tx + dx * 0.5) + (ex / dd) * (-fy + ty + dy * 0.5)) >= 0 ? 1 : -1;
        F.tsp.scale.x = side2;
      }
      // walking legs
      const up = inAir ? 16 : held ? 18 : 0;
      for (const L of walk) {
        const a = ph + (L.far ? Math.PI : 0) + (L.hindL ? Math.PI : 0), fo = L.far ? 6 : 0, z = L.far ? -1 : 1;
        const s1 = walking ? Math.sin(a) * 11 : 0, l1 = walking ? Math.max(0, Math.cos(a)) * 9 : 0;
        let ax, ay, kx, ky, fx, fy;
        if (!L.hindL) { ax = 6; ay = 20; kx = 36 + s1 * 0.3; ky = -2 - fo; fx = 58 + s1; fy = G - l1 - up - fo; }
        else { ax = -10; ay = 22; kx = -50 + s1 * 0.3; ky = -4 - fo; fx = -92 + s1; fy = G - l1 - up - fo; }
        aim(L.a, ax, -ay, z * 8, kx, -ky, z * 34); aim(L.b, kx, -ky, z * 34, fx, -fy + 5, z * 46); aim(L.c, fx, -fy + 5, z * 46, fx + (fx > ax ? 8 : -8), -fy, z * 48);
        L.kn.position.set(kx, -ky, z * 34);
      }
      // wings: folded, or spread and whirring in a leap
      const leap = inAir && e.leapT > 0, f = Math.sin(t * 40);
      for (let i = 0; i < 2; i++) {
        const z = i ? -1 : 1, tg = teg[i], h = hind[i];
        h.visible = leap;
        if (leap) { tg.rotation.set(z * (0.9 + f * 0.3), z * -0.5, 0.35); h.rotation.set(z * (0.6 + f * 0.5), z * -0.25, 0.2); }
        else tg.rotation.set(z * 0.35, 0, 0.02 + (angry ? 0.06 : 0));
      }
      ab.scale.y = 1 + Math.sin(t * 2.2 + e.seed) * 0.03;   // breathing
      // camouflage: fade out while it keeps still
      const cf = 1 - (e.camo || 0) * 0.72;
      if (cf < 0.999 || lastF < 0.999) fadeAll(k, e, cf);
      lastF = cf;
    };
  };
})();
