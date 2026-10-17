/* ==========================================================================
   Wiki de geometría analítica: las cónicas
   Lógica de la página
   --------------------------------------------------------------------------
   1. Utilidades numéricas y de formato
   2. Modelo matemático de las cónicas (elementos y ecuaciones)
   3. Motor de gráficas SVG (plano cartesiano)
   4. Catálogo de gráficas de la wiki
   5. Laboratorio interactivo
   6. Interfaz: pestañas, menú, tema, índice activo, campos editables
   ========================================================================== */
"use strict";

/* ---------- 1. Utilidades ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";
const MINUS = "−";

/** Redondea a 2 decimales y elimina ceros sobrantes. Usa el signo menos tipográfico. */
function fmt(v, digits = 2) {
  if (Math.abs(v) < 1e-9) v = 0;
  const r = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(digits));
  return r.replace("-", MINUS);
}
/** Igual que fmt pero con el guion ASCII, apto para LaTeX. */
function tex(v, digits = 3) {
  if (Math.abs(v) < 1e-9) v = 0;
  return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(digits));
}
const pt = (x, y) => `(${fmt(x)}, ${fmt(y)})`;

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

/** Paso "bonito" (1, 2 o 5 × 10^n) para la cuadrícula. */
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

/* ---------- 2. Modelo matemático ---------- */
/*
  Representación de una cónica:
    { type: "circle",    h, k, r }
    { type: "parabola",  h, k, p, orient: "v" | "h" }     (x−h)² = 4p(y−k)  |  (y−k)² = 4p(x−h)
    { type: "ellipse",   h, k, a, b, orient: "h" | "v" }  a > b
    { type: "hyperbola", h, k, a, b, orient: "h" | "v" }
*/

/** Calcula c (distancia del centro a cada foco) y la excentricidad. */
function focalData(c) {
  switch (c.type) {
    case "circle": return { c: 0, e: 0 };
    case "parabola": return { c: Math.abs(c.p), e: 1 };
    case "ellipse": { const f = Math.sqrt(c.a * c.a - c.b * c.b); return { c: f, e: f / c.a }; }
    case "hyperbola": { const f = Math.sqrt(c.a * c.a + c.b * c.b); return { c: f, e: f / c.a }; }
  }
}

/**
 * Devuelve los elementos geométricos de una cónica:
 * puntos (con nombre y posición de la etiqueta), rectas y segmentos.
 * Todo se calcula a partir de los parámetros, de modo que la gráfica
 * siempre coincide con la ecuación.
 */
function elementsOf(c) {
  const { h, k } = c;
  const P = [], L = [], S = [];
  const { c: f } = focalData(c);
  if (c.type === "circle") {
    P.push({ x: h, y: k, name: "C", pos: "sw", role: "center" });
    S.push({ x1: h, y1: k, x2: h + c.r, y2: k, label: "r", role: "radius" });
  }
  if (c.type === "parabola") {
    if (c.orient === "v") {
      P.push({ x: h, y: k, name: "V", pos: c.p > 0 ? "se" : "ne", role: "vertex" });
      P.push({ x: h, y: k + c.p, name: "F", pos: "e", role: "focus" });
      L.push({ p: [h, k - c.p], d: [1, 0], label: `y = ${fmt(k - c.p)}`, role: "directrix" });
      L.push({ p: [h, k], d: [0, 1], role: "axis" });
    } else {
      P.push({ x: h, y: k, name: "V", pos: c.p > 0 ? "nw" : "ne", role: "vertex" });
      P.push({ x: h + c.p, y: k, name: "F", pos: "n", role: "focus" });
      L.push({ p: [h - c.p, k], d: [0, 1], label: `x = ${fmt(h - c.p)}`, role: "directrix" });
      L.push({ p: [h, k], d: [1, 0], role: "axis" });
    }
  }
  if (c.type === "ellipse" || c.type === "hyperbola") {
    const horiz = c.orient === "h";
    P.push({ x: h, y: k, name: "C", pos: horiz ? "n" : "e", role: "center" });
    const ax = horiz ? [1, 0] : [0, 1];
    const vPos = horiz ? ["nw", "ne"] : ["se", "ne"];
    const fPos = horiz ? ["sw", "se"] : ["sw", "nw"];
    if (!horiz) { vPos[0] = "e"; vPos[1] = "e"; fPos[0] = "w"; fPos[1] = "w"; }
    P.push({ x: h - ax[0] * c.a, y: k - ax[1] * c.a, name: "V₁", pos: vPos[0], role: "vertex" });
    P.push({ x: h + ax[0] * c.a, y: k + ax[1] * c.a, name: "V₂", pos: vPos[1], role: "vertex" });
    P.push({ x: h - ax[0] * f, y: k - ax[1] * f, name: "F₁", pos: fPos[0], role: "focus" });
    P.push({ x: h + ax[0] * f, y: k + ax[1] * f, name: "F₂", pos: fPos[1], role: "focus" });
    if (c.type === "ellipse") {
      // Covértices (extremos del eje menor)
      const bx = horiz ? [0, 1] : [1, 0];
      P.push({ x: h - bx[0] * c.b, y: k - bx[1] * c.b, name: "B₁", pos: horiz ? "s" : "w", role: "covertex" });
      P.push({ x: h + bx[0] * c.b, y: k + bx[1] * c.b, name: "B₂", pos: horiz ? "n" : "e", role: "covertex" });
    } else {
      // Asíntotas y rectángulo fundamental
      const m = horiz ? c.b / c.a : c.a / c.b;
      L.push({ p: [h, k], d: [1, m], role: "asymptote" });
      L.push({ p: [h, k], d: [1, -m], role: "asymptote" });
      const w = horiz ? c.a : c.b, ht = horiz ? c.b : c.a;
      S.push({ rect: [h - w, k - ht, h + w, k + ht], role: "box" });
    }
  }
  return { points: P, lines: L, segments: S };
}

/** Puntos (x, y) de la curva, separados en ramas. */
function sampleConic(c, span = 40) {
  const branches = [];
  const N = 240;
  if (c.type === "circle") {
    const b = [];
    for (let i = 0; i <= N; i++) { const t = (2 * Math.PI * i) / N; b.push([c.h + c.r * Math.cos(t), c.k + c.r * Math.sin(t)]); }
    branches.push(b);
  } else if (c.type === "ellipse") {
    const [rx, ry] = c.orient === "h" ? [c.a, c.b] : [c.b, c.a];
    const b = [];
    for (let i = 0; i <= N; i++) { const t = (2 * Math.PI * i) / N; b.push([c.h + rx * Math.cos(t), c.k + ry * Math.sin(t)]); }
    branches.push(b);
  } else if (c.type === "parabola") {
    const b = [];
    for (let i = 0; i <= N; i++) {
      const t = -span + (2 * span * i) / N;
      const s = (t * t) / (4 * c.p);
      b.push(c.orient === "v" ? [c.h + t, c.k + s] : [c.h + s, c.k + t]);
    }
    branches.push(b);
  } else if (c.type === "hyperbola") {
    const U = Math.acosh(Math.max(2, span / Math.min(c.a, c.b)));
    for (const sgn of [1, -1]) {
      const b = [];
      for (let i = 0; i <= N; i++) {
        const u = -U + (2 * U * i) / N;
        const ch = sgn * Math.cosh(u), sh = Math.sinh(u);
        b.push(c.orient === "h" ? [c.h + c.a * ch, c.k + c.b * sh] : [c.h + c.b * sh, c.k + c.a * ch]);
      }
      branches.push(b);
    }
  }
  return branches;
}

/* --- Ecuaciones en LaTeX --- */

/** (x − h)² o x² según el valor de h. */
function sqTex(v, h) { return Math.abs(h) < 1e-9 ? `${v}^2` : `(${v} ${h > 0 ? "-" : "+"} ${tex(Math.abs(h))})^2`; }
function linTex(v, h) { return Math.abs(h) < 1e-9 ? v : `(${v} ${h > 0 ? "-" : "+"} ${tex(Math.abs(h))})`; }
function coefTex(c) { return c === 1 ? "" : c === -1 ? "-" : tex(c); }

function ordinaryTex(c) {
  const X = sqTex("x", c.h), Y = sqTex("y", c.k);
  switch (c.type) {
    case "circle": return `${X} + ${Y} = ${tex(c.r * c.r)}`;
    case "parabola":
      return c.orient === "v" ? `${X} = ${coefTex(4 * c.p)}${linTex("y", c.k)}` : `${Y} = ${coefTex(4 * c.p)}${linTex("x", c.h)}`;
    case "ellipse": {
      const [dx, dy] = c.orient === "h" ? [c.a, c.b] : [c.b, c.a];
      return `\\frac{${X}}{${tex(dx * dx)}} + \\frac{${Y}}{${tex(dy * dy)}} = 1`;
    }
    case "hyperbola": {
      const a2 = tex(c.a * c.a), b2 = tex(c.b * c.b);
      return c.orient === "h" ? `\\frac{${X}}{${a2}} - \\frac{${Y}}{${b2}} = 1` : `\\frac{${Y}}{${a2}} - \\frac{${X}}{${b2}} = 1`;
    }
  }
}

/** Coeficientes [A, C, D, E, F] de Ax² + Cy² + Dx + Ey + F = 0. */
function generalCoefs(c) {
  const { h, k } = c;
  let A, C, D, E, F;
  if (c.type === "circle") { A = 1; C = 1; D = -2 * h; E = -2 * k; F = h * h + k * k - c.r * c.r; }
  if (c.type === "parabola") {
    if (c.orient === "v") { A = 1; C = 0; D = -2 * h; E = -4 * c.p; F = h * h + 4 * c.p * k; }
    else { A = 0; C = 1; D = -4 * c.p; E = -2 * k; F = k * k + 4 * c.p * h; }
  }
  if (c.type === "ellipse") {
    const [p2, q2] = c.orient === "h" ? [c.a * c.a, c.b * c.b] : [c.b * c.b, c.a * c.a]; // denominadores de x e y
    A = q2; C = p2; D = -2 * q2 * h; E = -2 * p2 * k; F = q2 * h * h + p2 * k * k - p2 * q2;
  }
  if (c.type === "hyperbola") {
    const a2 = c.a * c.a, b2 = c.b * c.b;
    if (c.orient === "h") { A = b2; C = -a2; D = -2 * b2 * h; E = 2 * a2 * k; F = b2 * h * h - a2 * k * k - a2 * b2; }
    else { A = a2; C = -b2; D = -2 * a2 * h; E = 2 * b2 * k; F = a2 * h * h - b2 * k * k + a2 * b2; }
  }
  // Escala a enteros cuando sea posible y simplifica por el MCD
  let co = [A, C, D, E, F];
  for (const m of [1, 2, 4, 8, 16, 32, 64, 100]) {
    const s = co.map((v) => v * m);
    if (s.every((v) => Math.abs(v - Math.round(v)) < 1e-6)) {
      co = s.map(Math.round);
      const g = co.reduce((acc, v) => gcd(acc, v), 0) || 1;
      co = co.map((v) => v / g);
      break;
    }
  }
  return co;
}

function generalTex(c) {
  const names = ["x^2", "y^2", "x", "y", ""];
  let out = "";
  generalCoefs(c).forEach((v, i) => {
    if (Math.abs(v) < 1e-9) return;
    const sign = v < 0 ? "-" : "+";
    const mag = Math.abs(v);
    const body = names[i] && Math.abs(mag - 1) < 1e-9 ? names[i] : tex(mag) + names[i];
    out += out ? ` ${sign} ${body}` : (v < 0 ? "-" : "") + body;
  });
  return `${out} = 0`;
}

/* ---------- 3. Motor de gráficas SVG ---------- */

let graphCounter = 0;

/** Rectángulo de visualización automático que contiene la curva y sus elementos. */
function autoView(spec) {
  let xs = [0], ys = [0];
  const add = (x, y) => { xs.push(x); ys.push(y); };
  for (const c of spec.conics || []) {
    const { c: f } = focalData(c);
    if (c.type === "circle") { add(c.h - c.r, c.k - c.r); add(c.h + c.r, c.k + c.r); }
    if (c.type === "ellipse") {
      const [rx, ry] = c.orient === "h" ? [c.a, c.b] : [c.b, c.a];
      add(c.h - rx, c.k - ry); add(c.h + rx, c.k + ry);
    }
    if (c.type === "parabola") {
      const w = Math.max(4, 3 * Math.abs(c.p)), d = (w * w) / (4 * c.p);
      if (c.orient === "v") { add(c.h - w, c.k); add(c.h + w, c.k + d); add(c.h, c.k - c.p); }
      else { add(c.h, c.k - w); add(c.h + d, c.k + w); add(c.h - c.p, c.k); }
    }
    if (c.type === "hyperbola") {
      const [ex, ey] = c.orient === "h" ? [f + c.a * 0.8, Math.max(c.b * 2, f)] : [Math.max(c.b * 2, f), f + c.a * 0.8];
      add(c.h - ex, c.k - ey); add(c.h + ex, c.k + ey);
    }
  }
  for (const p of (spec.extras && spec.extras.points) || []) add(p.x, p.y);
  let xmin = Math.min(...xs) - 1.5, xmax = Math.max(...xs) + 1.5;
  let ymin = Math.min(...ys) - 1.5, ymax = Math.max(...ys) + 1.5;
  // Proporciones razonables (ni demasiado alta ni demasiado ancha)
  const w = xmax - xmin, hgt = ymax - ymin;
  if (hgt > w * 1.05) { const d = (hgt * 1.05 - w) / 2; xmin -= d; xmax += d; }
  if (w > hgt * 1.5) { const d = (w / 1.5 - hgt) / 2; ymin -= d; ymax += d; }
  return { xmin: Math.floor(xmin), xmax: Math.ceil(xmax), ymin: Math.floor(ymin), ymax: Math.ceil(ymax) };
}

/** Intersección de la recta p + t·d con el rectángulo (Liang–Barsky). */
function clipLine(p, d, v) {
  let t0 = -Infinity, t1 = Infinity;
  const checks = [[-d[0], p[0] - v.xmin], [d[0], v.xmax - p[0]], [-d[1], p[1] - v.ymin], [d[1], v.ymax - p[1]]];
  for (const [q, r] of checks) {
    if (Math.abs(q) < 1e-12) { if (r < 0) return null; continue; }
    const t = r / q;
    if (q < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
  }
  return t0 <= t1 ? [t0, t1] : null;
}

const LABEL_OFFSETS = {
  n: [0, -12, "middle"], s: [0, 20, "middle"], e: [10, 4, "start"], w: [-10, 4, "end"],
  ne: [8, -9, "start"], nw: [-8, -9, "end"], se: [8, 18, "start"], sw: [-8, 18, "end"],
};

/**
 * Dibuja un plano cartesiano con cónicas dentro de `container`.
 * spec = { view?, conics: [...], ghosts?: [...], labels: "full"|"name"|"none",
 *          elements?: bool, extras?: {points, segments, lines}, title, desc }
 */
function renderGraph(container, spec) {
  const view = spec.view || autoView(spec);
  const W = spec.width || 600;
  const s = W / (view.xmax - view.xmin);
  const H = Math.round((view.ymax - view.ymin) * s);
  const X = (x) => (x - view.xmin) * s;
  const Y = (y) => (view.ymax - y) * s;
  const id = `g${++graphCounter}`;

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-labelledby": `${id}-t ${id}-d` });
  el("title", { id: `${id}-t` }, svg).textContent = spec.title || "Gráfica en el plano cartesiano";
  el("desc", { id: `${id}-d` }, svg).textContent = spec.desc || describe(spec);
  const defs = el("defs", {}, svg);
  const clip = el("clipPath", { id: `${id}-clip` }, defs);
  el("rect", { x: 0, y: 0, width: W, height: H }, clip);

  // Cuadrícula
  const step = niceStep((view.xmax - view.xmin) / 12);
  const grid = el("g", { class: "g-grid" }, svg);
  for (let x = Math.ceil(view.xmin / step) * step; x <= view.xmax + 1e-9; x += step)
    el("line", { x1: X(x), y1: 0, x2: X(x), y2: H, class: Math.abs(x % (step * 5)) < 1e-9 ? "major" : "" }, grid);
  for (let y = Math.ceil(view.ymin / step) * step; y <= view.ymax + 1e-9; y += step)
    el("line", { x1: 0, y1: Y(y), x2: W, y2: Y(y), class: Math.abs(y % (step * 5)) < 1e-9 ? "major" : "" }, grid);

  // Ejes (si el origen no está a la vista, los rótulos se colocan en el borde)
  const axis = el("g", { class: "g-axis" }, svg);
  const ticks = el("g", { class: "g-ticks" }, svg);
  const y0 = Math.min(Math.max(Y(0), 0), H), x0 = Math.min(Math.max(X(0), 0), W);
  if (view.ymin <= 0 && view.ymax >= 0) {
    el("line", { x1: 0, y1: y0, x2: W - 2, y2: y0 }, axis);
    el("polygon", { points: `${W},${y0} ${W - 10},${y0 - 5} ${W - 10},${y0 + 5}` }, axis);
    el("text", { x: W - 14, y: y0 - 10, "text-anchor": "end" }, axis).textContent = "x";
  }
  if (view.xmin <= 0 && view.xmax >= 0) {
    el("line", { x1: x0, y1: H, x2: x0, y2: 2 }, axis);
    el("polygon", { points: `${x0},0 ${x0 - 5},10 ${x0 + 5},10` }, axis);
    el("text", { x: x0 + 10, y: 16 }, axis).textContent = "y";
  }
  const labelEvery = (view.xmax - view.xmin) / step > 14 ? 2 : 1;
  let i = 0;
  for (let x = Math.ceil(view.xmin / step) * step; x <= view.xmax + 1e-9; x += step, i++) {
    if (Math.abs(x) < 1e-9 || X(x) < 8 || X(x) > W - 18 || i % labelEvery) continue;
    el("text", { x: X(x), y: Math.min(y0 + 15, H - 4), "text-anchor": "middle" }, ticks).textContent = fmt(x);
  }
  i = 0;
  for (let y = Math.ceil(view.ymin / step) * step; y <= view.ymax + 1e-9; y += step, i++) {
    if (Math.abs(y) < 1e-9 || Y(y) < 22 || Y(y) > H - 6 || i % labelEvery) continue;
    const left = x0 < 30;
    el("text", { x: left ? x0 + 6 : x0 - 6, y: Y(y) + 4, "text-anchor": left ? "start" : "end" }, ticks).textContent = fmt(y);
  }
  if (view.xmin <= 0 && view.xmax >= 0 && view.ymin <= 0 && view.ymax >= 0)
    el("text", { x: x0 - 6, y: y0 + 15, "text-anchor": "end" }, ticks).textContent = "0";

  const plot = el("g", { "clip-path": `url(#${id}-clip)` }, svg);
  const labels = el("g", {}, svg);

  const drawLine = (ln, cls, parent = plot) => {
    const t = clipLine(ln.p, ln.d, view);
    if (!t) return null;
    const a = [ln.p[0] + t[0] * ln.d[0], ln.p[1] + t[0] * ln.d[1]];
    const b = [ln.p[0] + t[1] * ln.d[0], ln.p[1] + t[1] * ln.d[1]];
    el("line", { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]), class: cls }, parent);
    return [a, b];
  };
  const drawPath = (branches, cls) => {
    for (const b of branches) {
      const d = b.map(([x, y], j) => `${j ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join("");
      el("path", { d, class: cls }, plot);
    }
  };
  const drawLabel = (x, y, text, pos, extra = "") => {
    const [dx, dy, anchor] = LABEL_OFFSETS[pos] || LABEL_OFFSETS.ne;
    let px = X(x) + dx, py = Y(y) + dy;
    px = Math.min(Math.max(px, 4), W - 4);
    py = Math.min(Math.max(py, 14), H - 4);
    let a = anchor;
    if (anchor === "start" && px > W - 70) a = "end";
    if (anchor === "end" && px < 70) a = "start";
    el("text", { x: px, y: py, "text-anchor": a, class: `lbl ${extra}` }, labels).textContent = text;
  };

  const span = Math.max(view.xmax - view.xmin, view.ymax - view.ymin) * 1.5;
  const mode = spec.labels || "full";

  // Curvas de comparación (fantasmas)
  for (const g of spec.ghosts || []) drawPath(sampleConic(g, span), `curve ghost k-${g.type}`);

  for (const c of spec.conics || []) {
    const kc = `k-${c.type}`;
    const showEl = spec.elements !== false && c.elements !== false;
    const E = elementsOf(c);
    if (showEl) {
      for (const sg of E.segments) {
        if (sg.rect) {
          const [x1, y1, x2, y2] = sg.rect;
          el("rect", { x: X(x1), y: Y(y2), width: (x2 - x1) * s, height: (y2 - y1) * s, class: `aux faint ${kc}` }, plot);
        } else {
          el("line", { x1: X(sg.x1), y1: Y(sg.y1), x2: X(sg.x2), y2: Y(sg.y2), class: `aux ${kc}` }, plot);
          if (mode !== "none" && sg.label) drawLabel((sg.x1 + sg.x2) / 2, (sg.y1 + sg.y2) / 2, sg.label, "n", "line-lbl");
        }
      }
      for (const ln of E.lines) {
        const seg = drawLine(ln, ln.role === "axis" ? `aux faint ${kc}` : `aux ${kc}`);
        if (seg && ln.label && mode !== "none") {
          const t = 0.88;
          const lx = seg[0][0] + (seg[1][0] - seg[0][0]) * t, ly = seg[0][1] + (seg[1][1] - seg[0][1]) * t;
          const vertical = Math.abs(ln.d[0]) < 1e-9;
          drawLabel(lx, ly, mode === "full" ? `directriz: ${ln.label}` : "directriz", vertical ? "e" : "n", "line-lbl");
        }
      }
    }
    drawPath(sampleConic(c, span), `curve ${kc}`);
    if (showEl) {
      for (const p of E.points) {
        if (p.x < view.xmin || p.x > view.xmax || p.y < view.ymin || p.y > view.ymax) continue;
        const cls = p.role === "focus" ? `pt focus hollow ${kc}` : `pt ${kc}`;
        el("circle", { cx: X(p.x), cy: Y(p.y), r: p.role === "covertex" ? 3.5 : 4.5, class: cls }, plot);
        if (mode === "none" || (mode === "full" && p.role === "covertex" && c.hideCovertexLabels)) continue;
        drawLabel(p.x, p.y, mode === "full" ? `${p.name}${pt(p.x, p.y)}` : p.name, p.pos);
      }
    }
  }

  // Elementos adicionales (puntos de ejemplo, segmentos de la definición, rectas tangentes…)
  const ex = spec.extras || {};
  for (const ln of ex.lines || []) {
    const seg = drawLine(ln, `aux ${ln.k ? "k-" + ln.k : "k-neutral"}`);
    if (seg && ln.label) drawLabel(seg[0][0] + (seg[1][0] - seg[0][0]) * 0.8, seg[0][1] + (seg[1][1] - seg[0][1]) * 0.8, ln.label, ln.pos || "n", "line-lbl");
  }
  for (const sg of ex.segments || []) {
    el("line", { x1: X(sg.x1), y1: Y(sg.y1), x2: X(sg.x2), y2: Y(sg.y2), class: `seg ${sg.k ? "k-" + sg.k : "k-neutral"}` }, plot);
    if (sg.label) drawLabel((sg.x1 + sg.x2) / 2, (sg.y1 + sg.y2) / 2, sg.label, sg.pos || "n", "line-lbl");
  }
  for (const p of ex.points || []) {
    el("circle", { cx: X(p.x), cy: Y(p.y), r: 4.5, class: `pt ${p.k ? "k-" + p.k : "k-neutral"}` }, plot);
    if (p.label) drawLabel(p.x, p.y, p.label, p.pos || "ne");
  }

  container.querySelector("svg")?.remove();
  container.prepend(svg);
  return svg;
}

/** Descripción textual de la gráfica para lectores de pantalla. */
function describe(spec) {
  const names = { circle: "circunferencia", parabola: "parábola", ellipse: "elipse", hyperbola: "hipérbola" };
  return (spec.conics || []).map((c) => `${names[c.type]} de ecuación ${ordinaryTex(c).replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)").replace(/\\/g, "")}`).join("; ");
}

/* ---------- 4. Catálogo de gráficas ---------- */

const C = (h, k, r) => ({ type: "circle", h, k, r });
const Pv = (h, k, p) => ({ type: "parabola", h, k, p, orient: "v" });
const Ph = (h, k, p) => ({ type: "parabola", h, k, p, orient: "h" });
const Eh = (h, k, a, b) => ({ type: "ellipse", h, k, a, b, orient: "h" });
const Ev = (h, k, a, b) => ({ type: "ellipse", h, k, a, b, orient: "v" });
const Hh = (h, k, a, b) => ({ type: "hyperbola", h, k, a, b, orient: "h" });
const Hv = (h, k, a, b) => ({ type: "hyperbola", h, k, a, b, orient: "v" });

// Punto de ejemplo sobre cada curva para ilustrar la definición
const pPar = [4, 16 / 6];                                   // sobre x² = 6y
const pEll = [5 * Math.cos(1), 3 * Math.sin(1)];            // sobre x²/25 + y²/9 = 1
const pHyp = [3 * Math.cosh(1), 4 * Math.sinh(1)];          // sobre x²/9 − y²/16 = 1

const GRAPHS = {
  /* Miniaturas de la portada */
  "mini-circle":    { conics: [C(0, 0, 3)], labels: "none", view: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 } },
  "mini-parabola":  { conics: [Pv(0, -3, 1)], labels: "none", view: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 } },
  "mini-ellipse":   { conics: [Eh(0, 0, 4, 2.5)], labels: "none", view: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 } },
  "mini-hyperbola": { conics: [Hh(0, 0, 1.5, 1.5)], labels: "none", view: { xmin: -5, xmax: 5, ymin: -4, ymax: 4 } },

  /* Gráficas que ilustran la definición de cada cónica */
  "circle-main": {
    conics: [C(0, 0, 4)], labels: "full", view: { xmin: -6, xmax: 6, ymin: -5, ymax: 5 },
    extras: { points: [{ x: 4 * Math.cos(0.9), y: 4 * Math.sin(0.9), label: "P(x, y)", k: "circle", pos: "ne" }],
              segments: [{ x1: 0, y1: 0, x2: 4 * Math.cos(0.9), y2: 4 * Math.sin(0.9), k: "circle", label: "r = 4", pos: "nw" }] },
  },
  "parabola-main": {
    conics: [Pv(0, 0, 1.5)], labels: "full", view: { xmin: -7, xmax: 7, ymin: -3, ymax: 8 },
    extras: {
      points: [{ x: pPar[0], y: pPar[1], label: "P", k: "parabola", pos: "e" }, { x: pPar[0], y: -1.5, label: "Q", pos: "s" }],
      segments: [{ x1: pPar[0], y1: pPar[1], x2: 0, y2: 1.5, k: "parabola", label: "d(P,F)", pos: "n" },
                 { x1: pPar[0], y1: pPar[1], x2: pPar[0], y2: -1.5, k: "neutral", label: "d(P,directriz)", pos: "e" }],
    },
  },
  "ellipse-main": {
    conics: [Eh(0, 0, 5, 3)], labels: "full", view: { xmin: -7, xmax: 7, ymin: -5, ymax: 5 },
    extras: {
      points: [{ x: pEll[0], y: pEll[1], label: "P", k: "ellipse", pos: "ne" }],
      segments: [{ x1: pEll[0], y1: pEll[1], x2: -4, y2: 0, k: "neutral", label: "d₁", pos: "nw" },
                 { x1: pEll[0], y1: pEll[1], x2: 4, y2: 0, k: "neutral", label: "d₂", pos: "e" }],
    },
  },
  "hyperbola-main": {
    conics: [Hh(0, 0, 3, 4)], labels: "full", view: { xmin: -9, xmax: 9, ymin: -7, ymax: 7 },
    extras: {
      points: [{ x: pHyp[0], y: pHyp[1], label: "P", k: "hyperbola", pos: "e" }],
      segments: [{ x1: pHyp[0], y1: pHyp[1], x2: -5, y2: 0, k: "neutral", label: "d₁", pos: "nw" },
                 { x1: pHyp[0], y1: pHyp[1], x2: 5, y2: 0, k: "neutral", label: "d₂", pos: "e" }],
    },
  },

  /* Orientaciones */
  "parabola-orient": {
    conics: [Pv(0, 1, 1), Pv(0, -1, -1), Ph(1, 0, 1), Ph(-1, 0, -1)], labels: "name",
    view: { xmin: -8, xmax: 8, ymin: -8, ymax: 8 },
    title: "Cuatro parábolas: abren hacia arriba, abajo, derecha e izquierda",
  },
  "hyperbola-orient": {
    conics: [Hh(0, 0, 2, 1.5), { ...Hv(0, 0, 2, 1.5), elements: false }], labels: "name",
    view: { xmin: -8, xmax: 8, ymin: -7, ymax: 7 },
    title: "Hipérbola horizontal (con elementos) y vertical (solo curva) con a = 2, b = 1,5",
  },

  /* Ejemplos resueltos de cada sección */
  "circle-ex":    { conics: [C(2, -3, 5)] },
  "parabola-ex":  { conics: [Ph(2, 1, 2)], view: { xmin: -3, xmax: 11, ymin: -7, ymax: 9 } },
  "ellipse-ex":   { conics: [{ ...Eh(2, -3, 5, 3), hideCovertexLabels: true }], view: { xmin: -5, xmax: 9, ymin: -8, ymax: 2 } },
  "hyperbola-ex": { conics: [Hh(1, -2, 4, 3)], view: { xmin: -9, xmax: 11, ymin: -10, ymax: 6 } },

  /* Jeiner Ruales */
  "ex-1-c": { conics: [C(-1, 4, 5)], extras: { points: [{ x: 3, y: 1, label: "P(3, 1)", k: "circle", pos: "se" }] } },
  "ex-1-p": { conics: [Pv(0, 0, 3)], view: { xmin: -9, xmax: 9, ymin: -5, ymax: 9 },
              extras: { points: [{ x: 6, y: 3, label: "L(6, 3)", k: "parabola", pos: "e" }, { x: -6, y: 3, label: "R(−6, 3)", k: "parabola", pos: "w" }],
                        segments: [{ x1: -6, y1: 3, x2: 6, y2: 3, k: "parabola", label: "lado recto = 12", pos: "s" }] } },
  "ex-1-e": { conics: [Ev(0, 0, 5, 4)], view: { xmin: -8, xmax: 8, ymin: -7, ymax: 7 } },
  "ex-1-h": { conics: [Hh(0, 0, 3, 4)], view: { xmin: -10, xmax: 10, ymin: -8, ymax: 8 } },

  /* David Melo */
  "ex-2-c": { conics: [C(1, 5, 5)],
              extras: { points: [{ x: -2, y: 1, label: "A(−2, 1)", k: "circle", pos: "sw" }, { x: 4, y: 9, label: "B(4, 9)", k: "circle", pos: "ne" }],
                        segments: [{ x1: -2, y1: 1, x2: 4, y2: 9, k: "neutral" }] } },
  "ex-2-p": { conics: [Pv(-2, 3, 2)], view: { xmin: -10, xmax: 6, ymin: -1, ymax: 11 } },
  "ex-2-e": { conics: [{ ...Eh(2, -1, 3, 2), hideCovertexLabels: true }], view: { xmin: -3, xmax: 7, ymin: -5, ymax: 3 } },
  "ex-2-h": { conics: [Hv(2, 1, 4, 3)], view: { xmin: -8, xmax: 12, ymin: -7, ymax: 9 } },

  /* Santiago Rojas */
  "ex-3-c": { conics: [C(3, -2, 4)], view: { xmin: -3, xmax: 9, ymin: -7, ymax: 4 },
              extras: { lines: [{ p: [-1, 0], d: [4, 3], label: "3x − 4y + 3 = 0", pos: "nw" }],
                        points: [{ x: 3 - 12 / 5, y: -2 + 16 / 5, label: "T(0,6; 1,2)", pos: "nw" }] } },
  "ex-3-p": { conics: [Pv(0, 0, 2)], view: { xmin: -5, xmax: 5, ymin: -3, ymax: 4 },
              extras: { points: [{ x: 2, y: 0.5, label: "(2; 0,5)", k: "parabola", pos: "e" }, { x: -2, y: 0.5, label: "(−2; 0,5)", k: "parabola", pos: "w" }] } },
  "ex-3-e": { conics: [{ ...Eh(2, 2, 5, 4), hideCovertexLabels: true }], view: { xmin: -5, xmax: 9, ymin: -4, ymax: 8 } },
  "ex-3-h": { conics: [Hh(-1, 2, 1, 2)], view: { xmin: -7, xmax: 5, ymin: -4, ymax: 8 } },

  /* Herramientas: vista esperada del ejemplo de cada plataforma */
  "tool-geogebra": { conics: [Eh(1, -2, 5, 3)], labels: "name" },
  "tool-desmos":   { conics: [C(2, 1, 3)], labels: "name" },
  "tool-wolfram":  { conics: [Ph(0, 2, 1)], labels: "name", view: { xmin: -4, xmax: 10, ymin: -5, ymax: 8 } },

  /* Comparación de las cuatro cónicas */
  "compare": {
    conics: [C(-5, 4, 2.5), Pv(5, 1.5, 0.75), Eh(-5, -4.5, 3.5, 2), Hh(5, -4.5, 1, 1.2)],
    labels: "none", view: { xmin: -10, xmax: 10, ymin: -9, ymax: 8 },
    title: "Las cuatro cónicas en un mismo plano",
  },
};

function renderAllGraphs() {
  document.querySelectorAll("[data-graph]").forEach((fig) => {
    const spec = GRAPHS[fig.dataset.graph];
    if (spec) renderGraph(fig, spec);
  });
}

/* ---------- 5. Laboratorio interactivo ---------- */

const LAB_DEFAULTS = {
  circle:    { type: "circle", h: 0, k: 0, r: 4 },
  parabola:  { type: "parabola", h: 0, k: 0, p: 1, orient: "v" },
  ellipse:   { type: "ellipse", h: 0, k: 0, a: 6, b: 4, orient: "h" },
  hyperbola: { type: "hyperbola", h: 0, k: 0, a: 3, b: 2, orient: "h" },
};
// Rango y paso de cada parámetro
const LAB_PARAMS = {
  circle:    [["h", -6, 6, 0.5], ["k", -6, 6, 0.5], ["r", 0.5, 8, 0.5]],
  parabola:  [["h", -6, 6, 0.5], ["k", -6, 6, 0.5], ["p", -4, 4, 0.25]],
  ellipse:   [["h", -5, 5, 0.5], ["k", -5, 5, 0.5], ["a", 1, 9, 0.5], ["b", 0.5, 8.5, 0.5]],
  hyperbola: [["h", -5, 5, 0.5], ["k", -5, 5, 0.5], ["a", 0.5, 6, 0.5], ["b", 0.5, 6, 0.5]],
};
const LAB_VIEW = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };

function katexInto(node, src, display = true) {
  if (window.katex) window.katex.render(src, node, { displayMode: display, throwOnError: false });
  else node.textContent = src;
}
const ik = (src) => (window.katex ? window.katex.renderToString(src, { throwOnError: false }) : src);

function initLab() {
  const root = document.getElementById("lab");
  if (!root) return;
  const typeBtns = root.querySelectorAll(".seg-control button");
  const paramsBox = root.querySelector("#lab-params");
  const orientField = root.querySelector("#lab-orient-field");
  const orientSel = root.querySelector("#lab-orient");
  const showEl = root.querySelector("#lab-show-elements");
  const showLbl = root.querySelector("#lab-show-labels");
  const fig = root.querySelector("#lab-graph");
  const ghostList = root.querySelector("#lab-ghosts");
  let state = { ...LAB_DEFAULTS.circle };
  let ghosts = [];

  function buildParams() {
    paramsBox.innerHTML = "";
    root.style.setProperty("--k", `var(--c-${state.type})`);
    for (const [name, min, max, step] of LAB_PARAMS[state.type]) {
      const id = `lab-${name}`;
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.innerHTML = `<label for="${id}"><span>Parámetro <var>${name}</var></span><output id="${id}-out" for="${id}"></output></label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${state[name]}">`;
      paramsBox.appendChild(wrap);
      const input = wrap.querySelector("input");
      input.addEventListener("input", () => {
        state[name] = parseFloat(input.value);
        enforce(name);
        update();
      });
    }
    orientField.hidden = state.type === "circle";
    if (!orientField.hidden) {
      const opts = state.type === "parabola"
        ? [["v", "Vertical: (x − h)² = 4p(y − k)"], ["h", "Horizontal: (y − k)² = 4p(x − h)"]]
        : [["h", "Eje focal horizontal"], ["v", "Eje focal vertical"]];
      orientSel.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
      orientSel.value = state.orient;
    }
  }

  // Restricciones: p ≠ 0 en la parábola y a > b en la elipse
  function enforce(changed) {
    if (state.type === "parabola" && Math.abs(state.p) < 1e-9) state.p = changed === "p" ? 0.25 : state.p;
    if (state.type === "ellipse" && state.b >= state.a) {
      if (changed === "b") state.a = Math.min(9, state.b + 0.5);
      else state.b = Math.max(0.5, state.a - 0.5);
      if (state.b >= state.a) state.b = state.a - 0.5;
    }
    for (const [name] of LAB_PARAMS[state.type]) {
      const inp = root.querySelector(`#lab-${name}`);
      if (inp && parseFloat(inp.value) !== state[name]) inp.value = state[name];
    }
  }

  function elementsHtml(c) {
    const { c: f, e } = focalData(c);
    const E = elementsOf(c);
    const get = (role) => E.points.filter((p) => p.role === role);
    const list = [];
    if (c.type === "circle") {
      list.push(`Centro: ${ik(`C(${tex(c.h)}, ${tex(c.k)})`)}`, `Radio: ${ik(`r = ${tex(c.r)}`)}`,
        `Excentricidad: ${ik("e = 0")}`);
    }
    if (c.type === "parabola") {
      const V = get("vertex")[0], F = get("focus")[0], dir = E.lines.find((l) => l.role === "directrix");
      const open = c.orient === "v" ? (c.p > 0 ? "hacia arriba" : "hacia abajo") : (c.p > 0 ? "hacia la derecha" : "hacia la izquierda");
      list.push(`Vértice: ${ik(`V(${tex(V.x)}, ${tex(V.y)})`)}`, `Foco: ${ik(`F(${tex(F.x)}, ${tex(F.y)})`)}`,
        `Directriz: ${ik(dir.label.replace(MINUS, "-"))}`, `Eje de simetría: ${ik(c.orient === "v" ? `x = ${tex(c.h)}` : `y = ${tex(c.k)}`)}`,
        `Abre ${open} (${ik(`p = ${tex(c.p)}`)})`, `Lado recto: ${ik(`|4p| = ${tex(Math.abs(4 * c.p))}`)}`, `Excentricidad: ${ik("e = 1")}`);
    }
    if (c.type === "ellipse" || c.type === "hyperbola") {
      const V = get("vertex"), F = get("focus");
      const rel = c.type === "ellipse" ? "c = \\sqrt{a^2 - b^2}" : "c = \\sqrt{a^2 + b^2}";
      list.push(`Centro: ${ik(`C(${tex(c.h)}, ${tex(c.k)})`)}`,
        `Vértices: ${ik(`(${tex(V[0].x)}, ${tex(V[0].y)})`)} y ${ik(`(${tex(V[1].x)}, ${tex(V[1].y)})`)}`,
        `Focos: ${ik(`(${tex(F[0].x, 2)}, ${tex(F[0].y, 2)})`)} y ${ik(`(${tex(F[1].x, 2)}, ${tex(F[1].y, 2)})`)}`,
        `${ik(`a = ${tex(c.a)},\\; b = ${tex(c.b)},\\; ${rel} \\approx ${tex(f, 3)}`)}`,
        `Excentricidad: ${ik(`e = c/a \\approx ${tex(e, 3)}`)}`);
      if (c.type === "hyperbola") {
        const m = c.orient === "h" ? c.b / c.a : c.a / c.b;
        list.push(`Asíntotas: ${ik(`${linTex("y", c.k)} = \\pm ${tex(m, 3)}\\,${linTex("x", c.h)}`)}`);
      }
    }
    return `<ul class="lab-elements">${list.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  }

  function update() {
    for (const [name] of LAB_PARAMS[state.type]) {
      const out = root.querySelector(`#lab-${name}-out`);
      if (out) out.textContent = fmt(state[name]);
    }
    renderGraph(fig, {
      conics: [{ ...state }], ghosts, view: LAB_VIEW,
      elements: showEl.checked, labels: showLbl.checked ? "name" : "none",
      title: "Gráfica del laboratorio interactivo",
    });
    katexInto(root.querySelector("#lab-eq-ordinary"), ordinaryTex(state));
    katexInto(root.querySelector("#lab-eq-general"), generalTex(state));
    root.querySelector("#lab-elements").innerHTML = elementsHtml(state);
  }

  function renderGhosts() {
    ghostList.innerHTML = ghosts.length
      ? ghosts.map((g, i) => `<li>Comparación ${i + 1}: ${ik(ordinaryTex(g))}</li>`).join("")
      : `<li class="muted">Aún no hay ecuaciones fijadas. Use “Fijar para comparar”.</li>`;
  }

  function setType(type) {
    state = { ...LAB_DEFAULTS[type] };
    typeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === type)));
    buildParams();
    update();
  }

  typeBtns.forEach((b) => b.addEventListener("click", () => setType(b.dataset.type)));
  orientSel.addEventListener("change", () => { state.orient = orientSel.value; update(); });
  showEl.addEventListener("change", update);
  showLbl.addEventListener("change", update);
  root.querySelector("#lab-reset").addEventListener("click", () => setType(state.type));
  root.querySelector("#lab-pin").addEventListener("click", () => {
    if (ghosts.length >= 4) ghosts.shift();
    ghosts.push({ ...state });
    renderGhosts(); update();
  });
  root.querySelector("#lab-clear").addEventListener("click", () => { ghosts = []; renderGhosts(); update(); });

  // Enlaces "Abrir en el laboratorio" desde otras secciones
  document.querySelectorAll("[data-lab-open]").forEach((a) => a.addEventListener("click", () => setType(a.dataset.labOpen)));

  renderGhosts();
  setType("circle");
}

/* ---------- 6. Interfaz ---------- */

/** Pestañas accesibles (patrón WAI-ARIA con flechas, Inicio y Fin). */
function initTabs() {
  document.querySelectorAll("[data-tabs]").forEach((box) => {
    const tabs = [...box.querySelectorAll(':scope > [role="tablist"] > [role="tab"]')];
    const select = (tab, focus = false) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const n = tabs.length;
        const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (next !== undefined) { e.preventDefault(); select(tabs[next], true); }
      });
    });
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  });
}

/** Menú lateral desplegable en pantallas pequeñas. */
function initMenu() {
  const btn = document.getElementById("menu-btn");
  const side = document.getElementById("sidebar");
  let scrim = null;
  const close = () => {
    side.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    scrim?.remove(); scrim = null;
  };
  btn.addEventListener("click", () => {
    if (side.classList.contains("open")) return close();
    side.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.addEventListener("click", close);
    document.body.appendChild(scrim);
    side.querySelector("a")?.focus();
  });
  side.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && side.classList.contains("open")) { close(); btn.focus(); } });
}

/** Resalta en el índice la sección visible. */
function initScrollSpy() {
  const links = [...document.querySelectorAll(".toc a, .topnav a")];
  const sections = [...document.querySelectorAll("main .section[id]")];
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => {
        const on = a.getAttribute("href") === `#${en.target.id}`;
        a.classList.toggle("active", on);
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  sections.forEach((s) => obs.observe(s));

  const toTop = document.getElementById("to-top");
  window.addEventListener("scroll", () => toTop.classList.toggle("show", window.scrollY > 900), { passive: true });
  toTop.addEventListener("click", () => window.scrollTo({ top: 0 }));
}

/* Almacenamiento local seguro (puede no estar disponible) */
const STORE_KEY = "wikiConicas.v1";
function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function saveStore(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* sin almacenamiento */ } }

/** Tema claro/oscuro. */
function initTheme() {
  const btn = document.getElementById("theme-btn");
  const store = loadStore();
  if (store.theme) document.documentElement.dataset.theme = store.theme;
  const current = () => document.documentElement.dataset.theme ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const sync = () => btn.setAttribute("aria-label", current() === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    saveStore({ ...loadStore(), theme: next });
    sync();
  });
  sync();
}

/**
 * Campos editables (integrantes, asignatura, institución, fecha, enlace).
 * Los valores se guardan en este navegador y se reflejan en todos los
 * elementos con data-show="campo".
 */
function initFields() {
  const store = loadStore();
  const fields = store.fields || {};

  const reflect = (name) => {
    document.querySelectorAll(`[data-show="${name}"]`).forEach((n) => {
      n.textContent = (fields[name] || "").trim() || n.dataset.fallback || "";
    });
  };
  document.querySelectorAll("[data-field]").forEach((inp) => {
    const name = inp.dataset.field;
    if (fields[name] !== undefined) inp.value = fields[name];
    inp.addEventListener("input", () => {
      fields[name] = inp.value;
      document.querySelectorAll(`[data-field="${name}"]`).forEach((o) => { if (o !== inp) o.value = inp.value; });
      reflect(name);
      saveStore({ ...loadStore(), fields });
    });
    reflect(name);
  });
}

/** Renderiza las fórmulas escritas con \( … \) y \[ … \]. */
function renderMath() {
  if (typeof window.renderMathInElement !== "function") return;
  window.renderMathInElement(document.body, {
    delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }],
    ignoredClasses: ["no-math"],
    throwOnError: false,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderMath();
  renderAllGraphs();
  initTabs();
  initLab();
  initMenu();
  initScrollSpy();
  initFields();
});
