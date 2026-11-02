'use strict';
// pen.js — the drawing helper for Canvas 2D. Originally a sketchy hand-drawn pen (every primitive gets a
// small seeded wobble that "boils"); in realistic mode the wobble is off, corners are rounded, fills are
// lit like solid forms and outlines are faint shades of each colour.
const SB = window.SB = window.SB || {};
SB.FONT = "'Patrick Hand', 'Comic Sans MS', 'Chalkboard SE', 'Segoe Print', cursive";
// colour helpers: '#rgb' or '#rrggbb' in, '#rrggbb' out
SB.hexRGB = function (h) { h = (h || '#fff').replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
SB.rgbHex = function (r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); };
SB.mixColor = function (a, b, k) { const A = SB.hexRGB(a), B = SB.hexRGB(b); return SB.rgbHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); };
SB.shade = function (col, k) { return SB.mixColor(col, '#000', k); };
SB.TAU = Math.PI * 2;
const SHADES = new Map();   // colour -> [highlight, shadow]
const GRADS = new Map();    // colour + size -> cached gradient

SB.Pen = class Pen {
  constructor(ctx) {
    this.ctx = ctx;
    this.seed = 1;
    this.boil = 0;
    this.i = 0;
    this.wobble = 1.1;   // px amplitude of the wobble
    this.segLen = 12;    // px between wobble control points
    this.fill = '#fff';  // colour used when a shape asks for fill === true
    this.base = '#fff'; this.pal = null; this.seq = null; this.seqI = 0; this.tint = null; this.ink = '#000'; this.paper = '#fff';
    this.shading = false; // when on, filled shapes get a soft light-to-shadow gradient
    this.softInk = true;  // ...and an outline in a deep shade of their own colour instead of black
    this.lastCol = null;
    this.smooth = 0;      // >0: polygon corners are rounded off (realistic mode), up to this many px
    this.round = false;   // realistic mode: lit like a solid rounded form (radial light) instead of a flat panel
    this.inkK = 0.72;     // outline width as a fraction of the line width
  }
  begin(seed, boil) { this.seed = seed; this.boil = boil; this.i = 0; }
  // colours: a palette maps roles (skin, cloth, body, window...) to colours; use(role) picks one.
  // seq (items) colours each filled shape in drawing order; tint blends every fill toward a colour (poison).
  setPalette(pal, seq) { this.pal = pal || null; this.base = (pal && pal.body) || '#fff'; this.fill = this.base; this.seq = seq || null; this.seqI = 0; }
  use(role) { this.fill = (this.pal && this.pal[role]) || (SB.ROLES && SB.ROLES[role]) || this.base; return this; }
  stroke(col) { this.ctx.strokeStyle = col || this.ink; }
  _col(fill) {
    let col = fill === true ? (this.seq ? (this.seq[this.seqI++] || this.fill) : this.fill) : fill;
    if (this.tint && fill === true) col = SB.mixColor(col, this.tint, 0.55);
    return col;
  }
  // fill the current path: flat, or (shading on) with a soft top-left light to bottom-right shadow gradient.
  // Gradients are cached per colour and size, built at the origin and moved into place with a translate
  // (the path itself was fixed when it was built, so only the gradient moves).
  // [highlight, shadow, outline] for a colour (white and black get no gradient but still a soft outline)
  _shades(col) {
    let L = SHADES.get(col);
    if (L === undefined) {
      const lc = col.toLowerCase();
      if (lc === '#fff' || lc === '#ffffff') L = [null, null, '#9a948c'];
      else if (lc === '#000' || lc === '#000000' || lc === '#111' || lc === '#1a1a1a' || lc === '#222') L = [null, null, '#000'];
      else L = [SB.mixColor(col, '#fff', 0.32), SB.shade(col, 0.24), SB.shade(col, 0.55), SB.mixColor(col, '#fff', 0.5), SB.shade(col, 0.42)];
      SHADES.set(col, L);
    }
    return L;
  }
  _strokeLast() {
    const c = this.ctx, col = this.lastCol;
    if (!this.shading || !this.softInk || typeof col !== 'string' || col.charCodeAt(0) !== 35) { c.stroke(); return; }
    const ss = c.strokeStyle, lw = c.lineWidth;
    if (this.inkK <= 0) return;
    c.strokeStyle = this._shades(col)[2]; c.lineWidth = lw * this.inkK; c.stroke();
    c.strokeStyle = ss; c.lineWidth = lw;
  }
  _fill(fill, x0, y0, x1, y1, roundForm) {
    const c = this.ctx, col = this.lastCol = this._col(fill);
    const w = x1 - x0, h = y1 - y0;
    if (!this.shading || typeof col !== 'string' || col.charCodeAt(0) !== 35 || (w < 10 && h < 10)) { c.fillStyle = col; c.fill(); return; }
    const L = this._shades(col);
    if (!L[0]) { c.fillStyle = col; c.fill(); return; }
    const radial = (this.round || roundForm) && (w > 22 || h > 22);   // small parts: the cheaper flat light looks the same
    const qw = Math.max(1, Math.round(w / 6)), qh = Math.max(1, Math.round(h / 6)), key = (radial ? 'r' : 'l') + col + qw + 'x' + qh;
    let g = GRADS.get(key);
    if (!g) {
      const W = qw * 6, H = qh * 6;
      if (radial) {
        // light from the upper left: a soft highlight, the true colour, then shadow toward the far edge
        g = c.createRadialGradient(W * 0.36, H * 0.3, 0, W * 0.45, H * 0.45, Math.max(W, H) * 0.78);
        g.addColorStop(0, L[3]); g.addColorStop(0.18, L[0]); g.addColorStop(0.55, col); g.addColorStop(1, L[4]);
      } else {
        g = c.createLinearGradient(W * 0.15, 0, W * 0.85, H);
        g.addColorStop(0, L[0]); g.addColorStop(0.42, col); g.addColorStop(1, L[1]);
      }
      if (GRADS.size > 4000) GRADS.clear();
      GRADS.set(key, g);
    }
    c.translate(x0, y0); c.fillStyle = g; c.fill(); c.translate(-x0, -y0);
  }
  // deterministic pseudo-random in [-1, 1]
  n() {
    this.i++;
    const x = Math.sin(this.seed * 12.9898 + this.i * 78.233 + this.boil * 37.719) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }
  _seg(x1, y1, x2, y2) {
    const c = this.ctx;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const n = Math.round(len / this.segLen);
    if (n <= 1) { c.lineTo(x2, y2); return; }
    const nx = -dy / len * this.wobble, ny = dx / len * this.wobble;
    for (let i = 1; i < n; i++) {
      const t = i / n, w = this.n();
      c.lineTo(x1 + dx * t + nx * w, y1 + dy * t + ny * w);
    }
    c.lineTo(x2, y2);
  }
  line(x1, y1, x2, y2) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x1, y1); this._seg(x1, y1, x2, y2); c.stroke();
  }
  // polyline; pts = [x0,y0,x1,y1,...]; fill: true => white, or a color string
  path(pts, closed, fill) {
    const c = this.ctx;
    c.beginPath();
    const n = pts.length / 2;
    if (closed && this.smooth > 0 && n >= 3 && n <= 18) {   // shapes with many points are already smooth
      // realistic mode: round every corner off (sharp tips like teeth and spikes stay fairly sharp because their edges are short)
      const X = i => pts[((i % n) + n) % n * 2], Y = i => pts[((i % n) + n) % n * 2 + 1];
      c.moveTo((X(n - 1) + X(0)) / 2, (Y(n - 1) + Y(0)) / 2);
      for (let i = 0; i < n; i++) {
        const ux = X(i - 1) - X(i), uy = Y(i - 1) - Y(i), vx = X(i + 1) - X(i), vy = Y(i + 1) - Y(i);
        const a = Math.hypot(ux, uy), b = Math.hypot(vx, vy);
        if (a < 0.01 || b < 0.01) { c.lineTo(X(i), Y(i)); continue; }
        // the rounded corner must touch the edges within their middle halves: on a sharp tip that means a tiny radius
        // (tan of half the corner angle = |cross| / (|u||v| + dot), no trig needed)
        const r = Math.min(this.smooth, Math.min(a, b) * 0.45 * Math.abs(ux * vy - uy * vx) / Math.max(1e-6, a * b + ux * vx + uy * vy));
        if (r < 0.2 || !isFinite(r)) c.lineTo(X(i), Y(i));
        else c.arcTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2, r);
      }
      c.closePath();
    } else {
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) this._seg(pts[i - 2], pts[i - 1], pts[i], pts[i + 1]);
      if (closed) { this._seg(pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1]); c.closePath(); }
    }
    if (fill) {
      let x0 = pts[0], y0 = pts[1], x1 = x0, y1 = y0;
      for (let i = 2; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; if (x < x0) x0 = x; else if (x > x1) x1 = x; if (y < y0) y0 = y; else if (y > y1) y1 = y; }
      this._fill(fill, x0, y0, x1, y1);
    }
    if (fill) this._strokeLast(); else c.stroke();
  }
  poly(pts, fill) { this.path(pts, true, fill); }
  rect(x, y, w, h, fill) { this.poly([x, y, x + w, y, x + w, y + h, x, y + h], fill); }
  circle(cx, cy, r, fill) { this.ellipse(cx, cy, r, r, fill, 0); }
  ellipse(cx, cy, rx, ry, fill, rot) {
    const c = this.ctx;
    c.beginPath();
    if (rx + ry < 6 || this.wobble < 0.05) { // tiny, or realistic mode: a true smooth ellipse
      c.ellipse(cx, cy, rx, ry, rot || 0, 0, SB.TAU);
    } else {
      const per = Math.PI * (rx + ry);
      const n = Math.max(8, Math.round(per / this.segLen));
      const w = this.wobble * 0.7;
      const cr = rot ? Math.cos(rot) : 1, sr = rot ? Math.sin(rot) : 0;
      let fx = 0, fy = 0;
      for (let i = 0; i < n; i++) {
        const a = i / n * SB.TAU, j = this.n() * w;
        const px = Math.cos(a) * (rx + j), py = Math.sin(a) * (ry + j);
        const x = cx + px * cr - py * sr, y = cy + px * sr + py * cr;
        if (i === 0) { c.moveTo(x, y); fx = x; fy = y; } else c.lineTo(x, y);
      }
      c.lineTo(fx, fy);
    }
    c.closePath();
    if (fill) { const m = Math.max(rx, ry); this._fill(fill, cx - m, cy - m, cx + m, cy + m, true); this._strokeLast(); } else c.stroke();
  }
  arc(cx, cy, r, a0, a1) {
    const c = this.ctx;
    const n = Math.max(3, Math.round(Math.abs(a1 - a0) * r / this.segLen));
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      const j = (i === 0 || i === n) ? 0 : this.n() * this.wobble * 0.7;
      const x = cx + Math.cos(a) * (r + j), y = cy + Math.sin(a) * (r + j);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  // quadratic curve with wobble
  curve(x1, y1, cx, cy, x2, y2) {
    const c = this.ctx;
    const len = Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
    const n = Math.max(3, Math.round(len / this.segLen));
    c.beginPath(); c.moveTo(x1, y1);
    for (let i = 1; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      let x = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
      let y = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
      if (i < n) { x += this.n() * this.wobble * 0.6; y += this.n() * this.wobble * 0.6; }
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // zigzag between two points (teeth, beards, grass, crowns)
  zigzag(x1, y1, x2, y2, amp, n) {
    const c = this.ctx;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * amp, ny = dx / len * amp;
    c.beginPath(); c.moveTo(x1, y1);
    for (let i = 1; i < n; i++) {
      const t = i / n, s = (i % 2) ? 1 : 0;
      c.lineTo(x1 + dx * t + nx * s, y1 + dy * t + ny * s);
    }
    c.lineTo(x2, y2); c.stroke();
  }
  spiral(cx, cy, r, turns, rot) {
    const c = this.ctx;
    const n = Math.round(turns * 14);
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * SB.TAU + (rot || 0), rr = r * t;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  star(cx, cy, r, fill) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2) ? r * 0.45 : r;
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    this.poly(pts, fill);
  }
  heart(cx, cy, r, fill) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(cx, cy + r);
    c.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.7, cy - r * 1.2, cx, cy - r * 0.4);
    c.bezierCurveTo(cx + r * 0.7, cy - r * 1.2, cx + r * 1.6, cy - r * 0.2, cx, cy + r);
    c.closePath();
    if (fill) { this._fill(fill, cx - r * 1.6, cy - r * 1.2, cx + r * 1.6, cy + r); this._strokeLast(); } else c.stroke();
  }
  // fuzzy / woolly closed blob (sheep, lion mane, bushes)
  fuzz(cx, cy, rx, ry, fill, bumps) {
    const c = this.ctx;
    const n = bumps || Math.max(8, Math.round((rx + ry) / 4));
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * SB.TAU;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      if (i === 0) c.moveTo(x, y);
      else {
        const am = a - Math.PI / n;
        const bx = cx + Math.cos(am) * rx * 1.28, by = cy + Math.sin(am) * ry * 1.28;
        c.quadraticCurveTo(bx, by, x, y);
      }
    }
    c.closePath();
    if (fill) { this._fill(fill, cx - rx * 1.3, cy - ry * 1.3, cx + rx * 1.3, cy + ry * 1.3, true); this._strokeLast(); } else c.stroke();
  }
  dot(x, y, r) {
    const c = this.ctx;
    c.beginPath(); c.arc(x, y, r, 0, SB.TAU); c.fillStyle = '#000'; c.fill();
  }
  text(str, x, y, size, align) {
    const c = this.ctx;
    c.font = `${size}px ${SB.FONT}`;
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#000';
    c.fillText(str, x, y);
  }
  width(str, size) {
    this.ctx.font = `${size}px ${SB.FONT}`;
    return this.ctx.measureText(str).width;
  }
};
