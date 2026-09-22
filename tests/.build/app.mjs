
"use strict";
/* ======================= CONFIG ======================= */
const COLORS = ["#60a5fa","#f472b6","#34d399","#fbbf24","#a78bfa","#22d3ee","#fb923c","#f87171"];
const NAMES  = ["Cluster A","Cluster B","Cluster C","Cluster D","Cluster E","Cluster F","Cluster G","Cluster H"];
const GREY   = "#64748b";
const EPS    = 1e-6;            // convergence threshold (logical units)
const SPEEDS = [900, 480, 240, 60];
const SPDLBL = ["Slow","Normal","Fast","Instant"];
const LY     = 100;             // logical height, fixed at 100 units
let   LX     = 160;             // logical width — follows the canvas aspect ratio (same scale on both axes)

/* ======================= STATE ======================= */
const S = {
  points: [], centroids: [],
  k: 3, phase: "idle", iter: 0, sse: null, maxMove: null,
  history: [], running: false, animating: false, initMethod: "random", speed: 1
};

window.S = S;   // expose state for debugging / automated verification

/* ======================= DOM ======================= */
const $ = id => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const chart  = $("chart"),  cctx = chart.getContext("2d");
let cw = 0, ch = 0, plotW = 0, plotH = 0, unit = 1, ox = 0, oy = 0;

/* ======================= GEOMETRY + VIEW (pan / zoom) ======================= */
const ZMIN = 0.4, ZMAX = 8;
const V = { z: 1, px: 0, py: 0 };        // z = zoom, px/py = pan offset in screen pixels
S.view = V;

const sc = () => unit * V.z;             // pixels per logical unit, zoom included
const px = p => ({ x: ox + p.x * sc() + V.px, y: oy + plotH - p.y * sc() + V.py });
const toLogical = (mx, my) => ({ x: (mx - ox - V.px) / sc(), y: (plotH - (my - oy - V.py)) / sc() });
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const inWorld = p => p.x >= 0 && p.x <= LX && p.y >= 0 && p.y <= LY;

/* Keep the data frame from being panned off screen — always leave at least 60px visible */
function clampPan(){
  const m = 60, wW = LX * sc(), wH = LY * sc();
  V.px = Math.min(plotW - m, Math.max(m - wW, V.px));
  V.py = Math.min(wH - m, Math.max(m - plotH, V.py));
  markView();
}
/* Mirror the view state onto the DOM so external tests can read it without touching internals */
function markView(){
  canvas.dataset.view = V.z.toFixed(3) + "," + V.px.toFixed(1) + "," + V.py.toFixed(1);
}
/* Zoom while keeping the point under the cursor pinned in place */
function zoomAt(mx, my, factor){
  const w = toLogical(mx, my);
  const z2 = Math.min(ZMAX, Math.max(ZMIN, V.z * factor));
  if(Math.abs(z2 - V.z) < 1e-9) return;
  V.z = z2;
  V.px = mx - ox - w.x * sc();
  V.py = my - (oy + plotH) + w.y * sc();
  clampPan(); syncView();
}
function resetView(){ V.z = 1; V.px = 0; V.py = 0; syncView(); }
function syncView(){ $("lblZoom").textContent = Math.round(V.z * 100) + "%"; markView(); }

function resize(){
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cw = r.width; ch = r.height;

  const padX = 30, padY = 24;
  plotW = Math.max(60, cw - padX * 2);
  plotH = Math.max(60, ch - padY * 2);
  ox = padX; oy = padY;
  unit = plotH / LY;              // pixels per logical unit — identical on both axes
  LX   = plotW / unit;            // so the logical width stretches with the available space
  clampToView(); clampPan();

  const cr = chart.getBoundingClientRect();
  chart.width  = Math.max(1, Math.round(cr.width * dpr));
  chart.height = Math.max(1, Math.round(cr.height * dpr));
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* Shrinking the window narrows LX — pull stranded points back into view */
function clampToView(){
  const mx = LX - 1.5;
  for(const p of S.points) if(p.x > mx) p.x = mx;
  for(const c of S.centroids) if(c.x > mx){ c.x = mx; c.ax = Math.min(c.ax, mx); }
}

/* ======================= DATA GENERATION ======================= */
const rnd = (a, b) => a + Math.random() * (b - a);
function gauss(){
  let u = 0, v = 0;
  while(!u) u = Math.random();
  while(!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clampPt = p => ({ x: Math.min(LX - 2, Math.max(2, p.x)), y: Math.min(98, Math.max(2, p.y)), c: -1 });
function blob(cx, cy, sd, n, out){
  for(let i = 0; i < n; i++) out.push(clampPt({ x: cx + gauss() * sd, y: cy + gauss() * sd }));
}
/* Blob spread, scaled to both the height and the gap between blob centres */
function sdFor(g){
  return Math.min(LY * 0.125, (LX * 0.68) / Math.max(1, g - 1) * 0.28);
}
function spreadCenters(g){
  const best = [];
  for(let i = 0; i < g; i++){
    let bp = null, bd = -1;
    for(let t = 0; t < 300; t++){
      const p = { x: rnd(LX * 0.16, LX * 0.84), y: rnd(16, 84) };
      const dm = best.length ? Math.min(...best.map(b => d2(b, p))) : Infinity;
      if(dm > bd){ bd = dm; bp = p; }
    }
    best.push(bp);
  }
  return best;
}

function generate(){
  const n = +$("inN").value, kind = $("inData").value, pts = [];
  if(kind === "blobs"){
    const g = Math.max(2, Math.min(5, S.k)), cs = spreadCenters(g), sd = sdFor(g);
    for(let i = 0; i < g; i++) blob(cs[i].x, cs[i].y, sd, Math.round(n / g), pts);
  } else if(kind === "sizes"){
    const cs = spreadCenters(3), w = [0.08, 0.25, 0.67], sd = sdFor(3) * 0.95;
    for(let i = 0; i < 3; i++) blob(cs[i].x, cs[i].y, sd, Math.max(6, Math.round(n * w[i])), pts);
  } else if(kind === "density"){
    const cs = spreadCenters(3), b = sdFor(3), sd = [b * 0.34, b, b * 2.1];
    for(let i = 0; i < 3; i++) blob(cs[i].x, cs[i].y, sd[i], Math.round(n / 3), pts);
  } else if(kind === "rings"){
    const half = Math.round(n / 2), R = Math.min(LX, LY) / 2, cx = LX / 2, cy = LY / 2;
    for(let i = 0; i < half; i++){
      const a = rnd(0, Math.PI * 2), r = rnd(0, R * 0.24);
      pts.push(clampPt({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }));
    }
    for(let i = 0; i < n - half; i++){
      const a = rnd(0, Math.PI * 2), r = rnd(R * 0.70, R * 0.88);
      pts.push(clampPt({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }));
    }
  } else {
    const cs = spreadCenters(3);
    for(let i = 0; i < 3; i++) blob(cs[i].x, cs[i].y, sdFor(3) * 0.8, Math.round((n - 8) / 3), pts);
    for(let i = 0; i < 8; i++) pts.push(clampPt({ x: rnd(3, LX - 3), y: rnd(3, 97) }));
  }
  S.points = pts;
  hardReset();
  say(`Generated ${pts.length} points (${$("inData").selectedOptions[0].text.split(" —")[0]}) — press Initialize Centroids`);
}

/* ======================= K-MEANS CORE ======================= */
function pickInitial(points, k, method){
  if(method === "farthest"){
    const chosen = [points[Math.floor(Math.random() * points.length)]];
    while(chosen.length < k){
      let bp = points[0], bd = -1;
      for(const p of points){
        const dm = Math.min(...chosen.map(c => d2(c, p)));
        if(dm > bd){ bd = dm; bp = p; }
      }
      chosen.push(bp);
    }
    return chosen.map(p => ({ x: p.x, y: p.y }));
  }
  const idx = new Set();
  while(idx.size < k) idx.add(Math.floor(Math.random() * points.length));
  return [...idx].map(i => ({ x: points[i].x, y: points[i].y }));
}

function assignAll(points, cents){
  let sse = 0, changed = 0;
  for(const p of points){
    let bi = 0, bd = Infinity;
    for(let i = 0; i < cents.length; i++){
      const d = d2(p, cents[i]);
      if(d < bd){ bd = d; bi = i; }
    }
    if(p.c !== bi) changed++;
    p.c = bi; sse += bd;
  }
  return { sse, changed };
}

/* Empty cluster → keep the old centroid so nothing turns into NaN */
function meanUpdate(points, cents){
  const sx = new Array(cents.length).fill(0),
        sy = new Array(cents.length).fill(0),
        n  = new Array(cents.length).fill(0);
  for(const p of points){
    if(p.c < 0) continue;
    sx[p.c] += p.x; sy[p.c] += p.y; n[p.c]++;
  }
  return cents.map((c, i) => n[i] ? { x: sx[i] / n[i], y: sy[i] / n[i] } : { x: c.x, y: c.y });
}

/* Run k-means to completion silently (no animation) — used by Best-of-N */
function silentRun(src, k, method, maxIt = 100){
  const pts = src.map(p => ({ x: p.x, y: p.y, c: -1 }));
  let cents = pickInitial(pts, k, method), sse = 0;
  for(let it = 0; it < maxIt; it++){
    sse = assignAll(pts, cents).sse;
    const nc = meanUpdate(pts, cents);
    const mv = Math.max(...nc.map((c, i) => Math.hypot(c.x - cents[i].x, c.y - cents[i].y)));
    cents = nc;
    if(mv < EPS){ sse = assignAll(pts, cents).sse; break; }
  }
  return { labels: pts.map(p => p.c), cents, sse };
}

/* ======================= STEP MACHINE ======================= */
function doInit(){
  S.k = +$("inK").value;
  if(S.points.length < S.k){ say(`⚠️ Need at least ${S.k} data points`); return; }
  S.initMethod = $("inInit").value;
  S.points.forEach(p => p.c = -1);
  S.centroids = pickInitial(S.points, S.k, S.initMethod)
                  .map(c => ({ x: c.x, y: c.y, ax: c.x, ay: c.y, trail: [{ x: c.x, y: c.y }] }));
  S.phase = "assign"; S.iter = 0; S.sse = null; S.maxMove = null; S.history = [];
  say(S.initMethod === "farthest"
      ? "Initial centroids chosen farthest-first — the starting points are as far apart as possible"
      : "Initial centroids sampled at random — press again a few times and the outcome changes");
  sync();
}

function doAssign(){
  const r = assignAll(S.points, S.centroids);
  S.sse = r.sse; S.phase = "update";
  if(S.history.length === 0) S.history.push(S.sse);   // baseline before the centroids move at all
  say(`Assign: attached ${S.points.length} points to their nearest centroid (${r.changed} changed cluster)`);
  sync();
  return Promise.resolve();
}

function doUpdate(){
  const nc = meanUpdate(S.points, S.centroids);
  S.maxMove = Math.max(...nc.map((c, i) => Math.hypot(c.x - S.centroids[i].x, c.y - S.centroids[i].y)));
  S.iter++;
  const done = S.maxMove < EPS;
  const p = animateTo(nc).then(() => {
    S.sse = assignAll(S.points, S.centroids).sse;
    S.history.push(S.sse);
    S.phase = done ? "done" : "assign";
    say(done
      ? `✅ Converged! the centroids stopped moving (${S.iter} iterations, SSE = ${S.sse.toFixed(2)})`
      : `Update: moved each centroid to its cluster mean (largest move ${S.maxMove.toFixed(3)} units)`);
    sync();
  });
  sync();
  return p;
}

function nextStep(){
  if(S.centroids.length === 0){ doInit(); return Promise.resolve(); }
  if(S.phase === "assign") return doAssign();
  if(S.phase === "update") return doUpdate();
  say("The algorithm has converged — press Reset or generate new data to start another run");
  return Promise.resolve();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runToCompletion(){
  if(S.running){ S.running = false; return; }
  if(S.centroids.length === 0) doInit();
  if(S.centroids.length === 0) return;
  S.running = true; sync();
  let guard = 0;
  while(S.running && S.phase !== "done" && guard++ < 300){
    await nextStep();
    if(S.phase === "done") break;
    await sleep(Math.max(40, SPEEDS[S.speed] * 0.35));
  }
  S.running = false; sync();
}

function bestOfN(n = 10){
  S.k = +$("inK").value;
  if(S.points.length < S.k){ say(`⚠️ Need at least ${S.k} data points`); return; }
  let best = null, worst = -Infinity;
  for(let i = 0; i < n; i++){
    const r = silentRun(S.points, S.k, $("inInit").value);
    if(!best || r.sse < best.sse) best = r;
    if(r.sse > worst) worst = r.sse;
  }
  S.points.forEach((p, i) => p.c = best.labels[i]);
  S.centroids = best.cents.map(c => ({ x: c.x, y: c.y, ax: c.x, ay: c.y, trail: [{ x: c.x, y: c.y }] }));
  S.sse = best.sse; S.phase = "done"; S.maxMove = 0; S.history = [best.sse];
  say(`🏆 Ran ${n} times and kept the lowest SSE: ${best.sse.toFixed(2)} (worst seen ${worst.toFixed(2)}) — initialization clearly changes the answer`);
  sync();
}

/* ======================= ANIMATION ======================= */
function animateTo(target){
  const dur = SPEEDS[S.speed];
  const from = S.centroids.map(c => ({ x: c.x, y: c.y }));
  S.centroids.forEach((c, i) => c.trail.push({ x: target[i].x, y: target[i].y }));
  S.animating = true;
  if(dur <= 60){
    S.centroids.forEach((c, i) => { c.x = c.ax = target[i].x; c.y = c.ay = target[i].y; });
    S.animating = false;
    return Promise.resolve();
  }
  return new Promise(res => {
    const t0 = performance.now();
    (function tick(now){
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // easeInOutCubic
      S.centroids.forEach((c, i) => {
        c.ax = from[i].x + (target[i].x - from[i].x) * e;
        c.ay = from[i].y + (target[i].y - from[i].y) * e;
      });
      if(t < 1) requestAnimationFrame(tick);
      else {
        S.centroids.forEach((c, i) => { c.x = c.ax = target[i].x; c.y = c.ay = target[i].y; });
        S.animating = false; res();
      }
    })(t0);
  });
}

/* ======================= RENDER ======================= */
function drawGrid(){
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "#080d1c"; ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, plotW, plotH); ctx.clip();

  const o = px({ x: 0, y: 0 }), f = px({ x: LX, y: LY });
  ctx.fillStyle = "#0a1123"; ctx.fillRect(o.x, f.y, f.x - o.x, o.y - f.y);

  ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
  const step = V.z >= 3 ? 2 : V.z >= 1.6 ? 5 : 10;
  for(let gx = step; gx < LX; gx += step){
    const x = px({ x: gx, y: 0 }).x;
    if(x < ox - 1 || x > ox + plotW + 1) continue;
    ctx.beginPath(); ctx.moveTo(x, f.y); ctx.lineTo(x, o.y); ctx.stroke();
  }
  for(let gy = step; gy < LY; gy += step){
    const y = px({ x: 0, y: gy }).y;
    if(y < oy - 1 || y > oy + plotH + 1) continue;
    ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(f.x, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(96,165,250,.28)"; ctx.lineWidth = 1.2;
  ctx.strokeRect(o.x, f.y, f.x - o.x, o.y - f.y);
  ctx.restore();

  const la = toLogical(ox, oy + plotH), lb = toLogical(ox + plotW, oy);
  ctx.fillStyle = "#54628a"; ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.fillText(la.x.toFixed(0), ox - 3, oy + plotH + 15);
  ctx.fillText("x →", ox + plotW / 2 - 8, oy + plotH + 15);
  ctx.fillText(lb.x.toFixed(0), ox + plotW - 18, oy + plotH + 15);
  ctx.save();
  ctx.translate(ox - 10, oy + plotH / 2 + 10); ctx.rotate(-Math.PI / 2);
  ctx.fillText("y →", 0, 0);
  ctx.restore();
}

function render(){
  if(cw === 0) resize();
  drawGrid();

  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, plotW, plotH); ctx.clip();   // everything in data space is clipped to the viewport

  const N = S.points.length;
  if($("cbLines").checked && S.centroids.length && N <= LINEMAX){
    ctx.lineWidth = 1;
    for(const p of S.points){
      if(p.c < 0 || !S.centroids[p.c]) continue;
      const a = px(p), b = px({ x: S.centroids[p.c].ax, y: S.centroids[p.c].ay });
      ctx.strokeStyle = COLORS[p.c % COLORS.length] + "33";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  /* Data points: one path per colour, cull anything off-view, shrink the dot as the count grows
     — that is what makes an unlimited number of points affordable per frame */
  const R = N > 12000 ? 2 : N > 4000 ? 2.6 : N > 1500 ? 3.2 : 4;
  const outline = N <= LINEMAX;
  const byCol = new Map();
  for(const p of S.points){
    const a = px(p);
    if(a.x < ox - R || a.x > ox + plotW + R || a.y < oy - R || a.y > oy + plotH + R) continue;
    const col = p.c < 0 ? GREY : COLORS[p.c % COLORS.length];
    let list = byCol.get(col);
    if(!list){ list = []; byCol.set(col, list); }
    list.push(a);
  }
  for(const [col, list] of byCol){
    ctx.beginPath();
    for(const a of list){ ctx.moveTo(a.x + R, a.y); ctx.arc(a.x, a.y, R, 0, Math.PI * 2); }
    ctx.fillStyle = col; ctx.fill();
    if(outline){ ctx.lineWidth = 1; ctx.strokeStyle = "rgba(8,13,28,.85)"; ctx.stroke(); }
  }

  if($("cbTrail").checked){
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
    S.centroids.forEach((c, i) => {
      if(c.trail.length < 2) return;
      ctx.strokeStyle = COLORS[i % COLORS.length] + "88";
      ctx.beginPath();
      c.trail.forEach((t, j) => { const q = px(t); j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  S.centroids.forEach((c, i) => {
    const a = px({ x: c.ax, y: c.ay }), col = COLORS[i % COLORS.length];
    if(i === S.sel || i === hoverC){                       // the selected / hovered centroid
      ctx.beginPath(); ctx.arc(a.x, a.y, 20, 0, Math.PI * 2);
      ctx.strokeStyle = i === S.sel ? "#fbbf24" : "rgba(255,255,255,.5)";
      ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.arc(a.x, a.y, 15, 0, Math.PI * 2); ctx.fillStyle = col + "22"; ctx.fill();
    ctx.beginPath(); ctx.arc(a.x, a.y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(a.x, a.y, 7.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = "rgba(8,13,28,.9)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x - 4, a.y); ctx.lineTo(a.x + 4, a.y);
    ctx.moveTo(a.x, a.y - 4); ctx.lineTo(a.x, a.y + 4);
    ctx.stroke();
  });

  if(hoverPt && !busy() && (S.tool === "pen" || S.tool === "brush" || S.tool === "eraser" || S.tool === "spray")){
    const er = S.tool === "eraser", R = S.tool === "pen" ? 3.5 : brushR();
    const bx = stroke.on ? stroke.sx : hoverPt.x;               // mid-stroke the head lags behind the hand
    const by = stroke.on ? stroke.sy : hoverPt.y;
    if(stroke.on && Math.hypot(hoverPt.x - bx, hoverPt.y - by) > 1){
      ctx.beginPath(); ctx.moveTo(hoverPt.x, hoverPt.y); ctx.lineTo(bx, by);   // leash line showing the stabilizer lag
      ctx.strokeStyle = "rgba(226,232,240,.3)"; ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2);
    ctx.fillStyle = er ? "rgba(248,113,113,.07)" : "rgba(226,232,240,.05)"; ctx.fill();
    ctx.strokeStyle = er ? "rgba(248,113,113,.85)" : "rgba(226,232,240,.7)";
    ctx.lineWidth = 1.4;
    if(S.tool !== "pen") ctx.setLineDash([5, 4]);
    ctx.stroke(); ctx.setLineDash([]);
    if(mode === "spray"){                                        // spraying: inner dot marks the cone centre
      ctx.beginPath(); ctx.arc(bx, by, Math.max(2, R * 0.18), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(226,232,240,.45)"; ctx.fill();
    }
  }

  ctx.restore();
  requestAnimationFrame(render);
}

function drawChart(){
  const cr = chart.getBoundingClientRect();
  const w = cr.width, h = cr.height, H = S.history;
  if(w < 2 || h < 2) return;
  cctx.clearRect(0, 0, w, h);
  if(H.length < 1){ $("histTxt").textContent = "No data yet"; return; }
  const mx = Math.max(...H), mn = Math.min(...H), rg = (mx - mn) || 1;
  const X = i => 6 + (H.length === 1 ? 0 : i / (H.length - 1) * (w - 12));
  const Y = v => h - 16 - (v - mn) / rg * (h - 28);
  cctx.strokeStyle = "rgba(255,255,255,.07)"; cctx.lineWidth = 1;
  for(let i = 0; i <= 3; i++){
    const y = 8 + i * (h - 24) / 3;
    cctx.beginPath(); cctx.moveTo(6, y); cctx.lineTo(w - 6, y); cctx.stroke();
  }
  cctx.strokeStyle = "#34d399"; cctx.lineWidth = 2; cctx.beginPath();
  H.forEach((v, i) => i ? cctx.lineTo(X(i), Y(v)) : cctx.moveTo(X(i), Y(v)));
  cctx.stroke();
  cctx.fillStyle = "#34d399";
  H.forEach((v, i) => { cctx.beginPath(); cctx.arc(X(i), Y(v), 2.6, 0, Math.PI * 2); cctx.fill(); });
  if(H.length === 1){
    $("histTxt").innerHTML = `SSE <span class="mono">${H[0].toFixed(1)}</span> · single result (no convergence curve yet)`;
    return;
  }
  const drop = ((H[0] - H[H.length - 1]) / H[0] * 100).toFixed(1);
  $("histTxt").innerHTML =
    `${H.length} samples · SSE <span class="mono">${H[0].toFixed(1)} → ${H[H.length - 1].toFixed(1)}</span> (down ${drop}%)`;
}

/* ======================= UI SYNC ======================= */
const PHASE = {
  idle:   { name:"Waiting for data", dot:"bg-slate-500", line:0,
            title:"Not started",
            desc:"Press “New random data”, or draw points on the canvas yourself, then press Initialize Centroids to start the algorithm." },
  ready:  { name:"Ready to start", dot:"bg-blue-400", line:1,
            title:"Step 1 — Initialization",
            desc:"K-means needs the number of clusters K up front, then picks K starting points as centroids. Because those starting points are random, each run can land somewhere different." },
  assign: { name:"Next: Assign", dot:"bg-amber-400", line:3,
            title:"Step 2 — Assignment",
            desc:"Every data point joins the cluster of its nearest centroid, measured by Euclidean distance — the thin lines on the canvas show that membership.",
            math:"c(x) = argmin_i ‖x − c_i‖²" },
  update: { name:"Next: Update", dot:"bg-fuchsia-400", line:4,
            title:"Step 3 — Update",
            desc:"Each centroid moves to the mean of its members. Watch the animated move and the dashed trail it leaves behind.",
            math:"c_i = (1/|C_i|) · Σ_{x∈C_i} x" },
  done:   { name:"Converged ✓", dot:"bg-emerald-400", line:5,
            title:"Step 4 — Convergence",
            desc:"The centroids stopped moving, so the clustering is stable and the algorithm ends. The SSE you get is a local optimum and may not be the best one — compare it against Best of 10 runs.",
            math:"cost(C) = Σ_i Σ_{x∈C_i} dist(x, c_i)" }
};

function currentPhaseKey(){
  if(S.points.length === 0) return "idle";
  if(S.centroids.length === 0) return "ready";
  return S.phase;
}

function sync(){
  const info = PHASE[currentPhaseKey()];
  $("phaseName").textContent = info.name;
  $("phaseDot").className = "w-2.5 h-2.5 rounded-full " + info.dot;
  $("infoTitle").textContent = info.title;
  $("infoDesc").textContent  = info.desc;
  const m = $("infoMath");
  if(info.math){ m.textContent = info.math; m.classList.remove("hidden"); }
  else m.classList.add("hidden");

  document.querySelectorAll(".pc").forEach(el => {
    const n = +el.dataset.line;
    const on = n === info.line || (info.line >= 3 && info.line <= 4 && n === 2);
    el.className = "pc " + (on ? "on" : "off");
  });

  $("stCent").textContent = S.centroids.length + " / " + S.k;
  document.querySelectorAll(".tool").forEach(b => {
    b.classList.toggle("on", b.dataset.tool === S.tool);
    b.disabled = busy() && b.dataset.tool !== "hand";        // no editing while running, but panning stays available
  });
  $("lnHint").textContent = S.points.length > LINEMAX ? " · auto-off, too many points" : "";
  const painter = S.tool === "brush" || S.tool === "eraser" || S.tool === "spray";
  $("brushOpts").style.display = painter ? "" : "none";
  $("densOpt").style.display = S.tool === "eraser" ? "none" : "";   // flow means nothing for the eraser
  $("stabOpt").style.display = S.tool === "spray" ? "none" : "";    // the spray does not use the stabilizer
  $("toolHint").textContent = TOOLS[S.tool].hint;
  canvas.style.cursor = mode === "pan" ? "grabbing" : TOOLS[S.tool].cursor;

  $("stIter").textContent = S.iter;
  $("stN").textContent    = S.points.length;
  $("stSSE").textContent  = S.sse == null ? "—" : S.sse.toFixed(2);
  $("stMove").textContent = S.maxMove == null ? "—" : S.maxMove.toFixed(4);

  const isBusy = busy();
  $("bInit").disabled = isBusy || S.points.length < S.k;
  $("bStep").disabled = isBusy || S.points.length === 0 || S.phase === "done";
  $("bBest").disabled = isBusy || S.points.length < S.k;
  $("bGen").disabled  = isBusy;
  $("bClr").disabled  = isBusy;
  $("bRun").textContent = S.running ? "⏸ Stop" : "▶️ Run to Completion";
  $("bRun").disabled = S.points.length === 0 || (S.phase === "done" && !S.running);

  $("legend").innerHTML = S.centroids.length
    ? S.centroids.map((c, i) => {
        const n = S.points.filter(p => p.c === i).length;
        return `<span class="flex items-center gap-1.5"><span style="background:${COLORS[i % COLORS.length]}" class="w-2.5 h-2.5 rounded-full"></span>${NAMES[i]} <span class="mono opacity-60">${n}</span></span>`;
      }).join("")
    : `<span class="opacity-70">no centroids yet</span>`;

  drawChart();
}

const say = t => { $("msg").textContent = t; };

function hardReset(){
  S.running = false; S.centroids = []; S.phase = "idle"; S.sel = -1;
  S.iter = 0; S.sse = null; S.maxMove = null; S.history = [];
  S.points.forEach(p => p.c = -1);
  sync();
}

/* ======================= TOOLS ======================= */
const TOOLS = {
  pen:      { cursor:"crosshair", hint:"✒️ Pen — one click puts down exactly one point at the cursor · hold and drag to lay them down one at a time" },
  spray:    { cursor:"crosshair", hint:"💨 Spray — hold the button and points keep building up at the cursor; the longer you hold, the denser it gets (move while spraying)" },
  brush:    { cursor:"crosshair", hint:"🖌️ Brush — drag to paint a continuous stroke · tune Size, Flow and Smooth (stabilizer) in the bar above" },
  eraser:   { cursor:"crosshair", hint:"🧽 Eraser — drag to remove every point inside the ring, using the same stroke engine as the brush" },
  hand:     { cursor:"grab",      hint:"✋ Hand — drag to pan · mouse wheel to zoom · middle mouse or Space+drag pans from any tool" },
  centroid: { cursor:"pointer",   hint:"🎯 Centroid — drag to move · click empty space to add one (up to K) · right-click or Delete to remove" }
};
const LINEMAX = 2000;        // past this many points the connector lines switch off so drawing stays smooth (the point count itself is unlimited)
S.tool = "brush"; S.sel = -1;

const busy   = () => S.running || S.animating;
const brushR = () => +$("inBrush").value;                    // brush radius in screen pixels — constant at every zoom level
const stabF  = () => +$("inStab").value / 100;               // 0 = raw pointer, 0.9 = heavily damped
const spacing = () => Math.max(2.5, brushR() * 0.22);        // distance between dabs along a stroke
const SPRAYMS = 45;                                          // spray cadence in milliseconds
const PENMIN  = 4;                                           // minimum gap between pen points while dragging
let hoverPt = null, hoverC = -1, mode = null, spaceDown = false;
let panFrom = null, dragI = -1, dragOff = null, lastPaint = null, dragMoved = 0;
/* Live stroke state: sx,sy = smoothed head · lx,ly = last dab · carry = leftover distance from the previous event */
const stroke = { on: false, sx: 0, sy: 0, lx: 0, ly: 0, carry: 0 };

function setTool(t){
  if(!TOOLS[t]) return;
  const changed = S.tool !== t;
  S.tool = t;
  if(changed){ S.sel = -1; hoverC = -1; say(TOOLS[t].hint); }
  sync();
}

/* ---------- brush / eraser (paint-tool stroke engine) ---------- */
/* One brush dab: scatter points inside the circle, dense in the middle and thinning at the rim */
function dab(x, y, exact){
  const rw = brushR() / sc(), c = toLogical(x, y), dens = +$("inDens").value;
  let added = 0;
  for(let i = 0; i < dens; i++){
    let p;
    if(exact && i === 0) p = { x: c.x, y: c.y, c: -1 };      // first point of a stroke lands exactly on the cursor
    else {
      const a = Math.random() * Math.PI * 2;
      const r = rw * Math.pow(Math.random(), 0.75);          // exponent > 0.5 packs the ink toward the centre
      p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, c: -1 };
    }
    if(!inWorld(p)) continue;
    S.points.push(p); added++;
  }
  return added;
}
/* Erase every point inside the brush ring at the given screen position */
function erasePx(x, y){
  const rw = brushR() / sc(), c = toLogical(x, y), r2 = rw * rw, before = S.points.length;
  S.points = S.points.filter(p => d2(p, c) > r2);
  return before - S.points.length;
}
function sprayAt(m, exact){
  const n = dab(m.x, m.y, exact);
  if(n && S.centroids.length) S.phase = "assign";            // new points → the assignment is stale
  return n;
}
function eraseAt(m){
  const n = erasePx(m.x, m.y);
  if(n && S.centroids.length) S.phase = "assign";
  return n;
}

/* ---------- pen: one press = exactly one point at the cursor, with no scatter ----------
   Holding and dragging is allowed, but points come out one at a time along the path */
function penAt(m){
  const c = toLogical(m.x, m.y);
  if(!inWorld(c)) return 0;
  S.points.push({ x: c.x, y: c.y, c: -1 });
  if(S.centroids.length) S.phase = "assign";
  return 1;
}

/* ---------- spray (a spray can: emits over time, not over distance) ---------- */
let sprayOn = false, sprayT0 = 0;
function sprayPuff(){
  if(!hoverPt) return 0;
  const n = dab(hoverPt.x, hoverPt.y, false);
  if(n && S.centroids.length) S.phase = "assign";
  return n;
}
function sprayLoop(now){
  if(mode !== "spray"){ sprayOn = false; return; }
  if(now - sprayT0 >= SPRAYMS){ sprayT0 = now; sprayPuff(); sync(); }
  requestAnimationFrame(sprayLoop);
}
function startSpray(m){
  mode = "spray"; hoverPt = m; sprayT0 = performance.now();
  sprayPuff(); sync();
  if(!sprayOn){ sprayOn = true; requestAnimationFrame(sprayLoop); }
}

function beginStroke(m){
  stroke.on = true; stroke.carry = 0;
  stroke.sx = stroke.lx = m.x;
  stroke.sy = stroke.ly = m.y;
}
function endStroke(){ stroke.on = false; stroke.carry = 0; }

/* Continuous stroke: damp the pointer first (stabilizer), then dab at a fixed spacing along the path.
   A fast drag therefore stays unbroken, and density no longer depends on how often pointer events fire */
function strokeTo(m, erasing){
  if(!stroke.on) beginStroke(m);
  const a = 1 - stabF();
  stroke.sx += (m.x - stroke.sx) * a;
  stroke.sy += (m.y - stroke.sy) * a;

  const dx = stroke.sx - stroke.lx, dy = stroke.sy - stroke.ly;
  const dist = Math.hypot(dx, dy);
  if(dist < 1e-9) return 0;

  const sp = spacing();
  let travelled = stroke.carry, walked = 0, n = 0;
  while(travelled + (dist - walked) >= sp){
    walked += sp - travelled;
    const t = walked / dist;
    const x = stroke.lx + dx * t, y = stroke.ly + dy * t;
    n += erasing ? erasePx(x, y) : dab(x, y, false);
    travelled = 0;
  }
  stroke.carry = travelled + (dist - walked);
  stroke.lx = stroke.sx; stroke.ly = stroke.sy;
  if(n && S.centroids.length) S.phase = "assign";
  return n;
}

/* ---------- centroid editing ---------- */
function hitCentroid(m){
  for(let i = S.centroids.length - 1; i >= 0; i--){
    const a = px({ x: S.centroids[i].ax, y: S.centroids[i].ay });
    if(Math.hypot(m.x - a.x, m.y - a.y) <= 16) return i;
  }
  return -1;
}
/* A manual centroid edit restarts the iteration count — the previous SSE curve is no longer comparable */
function afterCentroidEdit(msg){
  S.running = false; S.history = []; S.iter = 0; S.maxMove = null;
  S.centroids.forEach(c => { c.ax = c.x; c.ay = c.y; c.trail = [{ x: c.x, y: c.y }]; });
  if(S.centroids.length && S.points.length){
    S.sse = assignAll(S.points, S.centroids).sse;
    S.phase = "assign";
  } else {
    S.points.forEach(p => p.c = -1);
    S.sse = null; S.phase = S.centroids.length ? "assign" : "idle";
  }
  if(msg) say(msg);
  sync();
}
function spawnCentroid(w){
  if(!inWorld(w)){ say("Centroids can only be placed inside the data frame"); return false; }
  if(S.centroids.length >= S.k){
    say("⚠️ At most K = " + S.k + " centroids — raise the K slider, or delete one first (right-click it)");
    return false;
  }
  S.centroids.push({ x: w.x, y: w.y, ax: w.x, ay: w.y, trail: [{ x: w.x, y: w.y }] });
  S.sel = S.centroids.length - 1;
  afterCentroidEdit("Placed a centroid at (" + w.x.toFixed(1) + ", " + w.y.toFixed(1) + ") — now " + S.centroids.length + "/" + S.k);
  return true;
}
function deleteCentroid(i){
  if(i < 0 || i >= S.centroids.length) return false;
  S.centroids.splice(i, 1);
  for(const p of S.points){                                  // shift the labels to match the new indices
    if(p.c === i) p.c = -1;
    else if(p.c > i) p.c--;
  }
  S.sel = -1; hoverC = -1;
  afterCentroidEdit("Centroid deleted — " + S.centroids.length + "/" + S.k + " left (the algorithm still runs with what remains)");
  return true;
}
function trimCentroids(n){
  if(S.centroids.length <= n) return false;
  while(S.centroids.length > n){
    const i = S.centroids.length - 1;
    S.centroids.pop();
    for(const p of S.points) if(p.c === i) p.c = -1;
  }
  S.sel = -1;
  afterCentroidEdit("K lowered to " + n + " — the extra centroids were trimmed");
  return true;
}

/* ======================= CANVAS EVENTS ======================= */
const evPos = ev => { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
const BUSYMSG = "⏸ The algorithm is running — stop it or wait for convergence before editing the canvas";

function onDown(e){
  if(e.button === 2) return;                                 // right-click is handled by contextmenu
  const m = evPos(e);
  hoverPt = m;
  if(canvas.setPointerCapture && e.pointerId != null) canvas.setPointerCapture(e.pointerId);
  if(e.button === 1 || spaceDown || S.tool === "hand"){      // panning is always allowed, even mid-run
    if(e.preventDefault) e.preventDefault();
    mode = "pan"; panFrom = { mx: m.x, my: m.y, px: V.px, py: V.py };
    canvas.style.cursor = "grabbing";
    return;
  }
  if(busy()){ say(BUSYMSG); return; }
  if(S.tool === "centroid"){
    const i = hitCentroid(m);
    if(i >= 0){
      mode = "drag"; dragI = i; S.sel = i; dragMoved = 0;
      const w = toLogical(m.x, m.y);
      dragOff = { x: S.centroids[i].x - w.x, y: S.centroids[i].y - w.y };
      sync();
    } else spawnCentroid(toLogical(m.x, m.y));
    return;
  }
  if(S.tool === "pen"){ mode = "pen"; penAt(m); lastPaint = m; sync(); }
  else if(S.tool === "spray"){ startSpray(m); }
  else if(S.tool === "brush"){ mode = "paint"; beginStroke(m); sprayAt(m, true); lastPaint = m; sync(); }
  else if(S.tool === "eraser"){ mode = "erase"; beginStroke(m); eraseAt(m); lastPaint = m; sync(); }
}

function onMove(e){
  const m = evPos(e);
  hoverPt = m;
  if(mode === "pan"){
    V.px = panFrom.px + (m.x - panFrom.mx);
    V.py = panFrom.py + (m.y - panFrom.my);
    clampPan();
    return;
  }
  if(mode === "drag"){
    const c = S.centroids[dragI];
    if(!c) return;
    const w = toLogical(m.x, m.y);
    const nx = Math.min(LX, Math.max(0, w.x + dragOff.x)), ny = Math.min(LY, Math.max(0, w.y + dragOff.y));
    dragMoved += Math.hypot(nx - c.x, ny - c.y);
    c.x = c.ax = nx; c.y = c.ay = ny;
    return;
  }
  if(mode === "pen"){                           // dragging lays points down one at a time
    if(lastPaint && Math.hypot(m.x - lastPaint.x, m.y - lastPaint.y) < PENMIN) return;
    penAt(m); lastPaint = m; sync();
    return;
  }
  if(mode === "spray") return;                  // the spray runs on its own clock from the latest hoverPt
  if(mode === "paint" || mode === "erase"){
    strokeTo(m, mode === "erase");
    lastPaint = m; sync();
    return;
  }
  if(S.tool === "centroid"){
    const i = hitCentroid(m);
    if(i !== hoverC){ hoverC = i; canvas.style.cursor = i >= 0 ? "grab" : TOOLS.centroid.cursor; }
  }
}

function onUp(){
  if(mode === "drag" && S.centroids[dragI]){
    if(dragMoved > 0.05) afterCentroidEdit("Moved " + NAMES[dragI] + " by hand → reassigned from where you dropped it (iteration count restarts)");
    else { say("Selected " + NAMES[dragI] + " — drag to move it, or press Delete to remove it"); sync(); }
  }
  endStroke();
  mode = null; dragI = -1; lastPaint = null; panFrom = null;
  canvas.style.cursor = TOOLS[S.tool].cursor;
}

function onWheel(e){
  if(e.preventDefault) e.preventDefault();
  const m = evPos(e);
  zoomAt(m.x, m.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}

function onContext(e){
  if(e.preventDefault) e.preventDefault();
  if(busy()){ say(BUSYMSG); return; }
  const i = hitCentroid(evPos(e));
  if(i >= 0) deleteCentroid(i);
  else if(S.tool === "centroid") say("Right-click a centroid to delete it — left-click empty space to add one");
}

function onKey(e){
  const t = e.target && e.target.tagName;
  if(t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
  if(e.code === "Space"){
    if(!spaceDown){ spaceDown = true; if(!mode) canvas.style.cursor = "grab"; }
    if(e.preventDefault) e.preventDefault();
    return;
  }
  const k = (e.key || "").toLowerCase();
  if(k === "p") setTool("pen");
  else if(k === "s") setTool("spray");
  else if(k === "b") setTool("brush");
  else if(k === "e") setTool("eraser");
  else if(k === "h") setTool("hand");
  else if(k === "c") setTool("centroid");
  else if(e.key === "Delete" || e.key === "Backspace"){
    if(busy()) say(BUSYMSG);
    else if(S.sel >= 0) deleteCentroid(S.sel);
    else say("Select a centroid first (click one with the 🎯 tool), then press Delete");
  }
  else if(e.key === "+" || e.key === "=") zoomAt(cw / 2, ch / 2, 1.25);
  else if(e.key === "-" || e.key === "_") zoomAt(cw / 2, ch / 2, 1 / 1.25);
  else if(e.key === "0") resetView();
}

canvas.addEventListener("pointerdown", onDown);
canvas.addEventListener("pointermove", onMove);
canvas.addEventListener("pointerleave", () => { if(!mode) hoverPt = null; });
canvas.addEventListener("wheel", onWheel, { passive: false });
canvas.addEventListener("contextmenu", onContext);
window.addEventListener("pointerup", onUp);
window.addEventListener("keydown", onKey);
window.addEventListener("keyup", e => {
  if(e.code === "Space"){ spaceDown = false; if(!mode) canvas.style.cursor = TOOLS[S.tool].cursor; }
});

document.querySelectorAll(".tool").forEach(b => b.addEventListener("click", () => setTool(b.dataset.tool)));
$("inBrush").addEventListener("input", e => { $("lblBrush").textContent = e.target.value; });
$("inDens").addEventListener("input",  e => { $("lblDens").textContent  = e.target.value; });
$("inStab").addEventListener("input",  e => { $("lblStab").textContent  = e.target.value + "%"; });
$("bZoomIn").onclick  = () => zoomAt(cw / 2, ch / 2, 1.25);
$("bZoomOut").onclick = () => zoomAt(cw / 2, ch / 2, 1 / 1.25);
$("bZoomRst").onclick = () => { resetView(); say("View reset to 100%"); };

/* ======================= CONTROL EVENTS ======================= */
$("inK").addEventListener("input", e => {
  S.k = +e.target.value; $("lblK").textContent = S.k;
  if(!S.centroids.length) hardReset();                       // nothing started yet → plain reset
  else if(S.centroids.length > S.k) trimCentroids(S.k);      // K went down → trim the extras
  else { say("K = " + S.k + " · " + S.centroids.length + " centroids placed — add more with the 🎯 tool, or press Initialize to resample the whole set"); sync(); }
});
$("inN").addEventListener("input", e => { $("lblN").textContent = e.target.value; });
$("inSpd").addEventListener("input", e => { S.speed = +e.target.value; $("lblSpd").textContent = SPDLBL[S.speed]; });
$("inData").addEventListener("change", generate);

$("bGen").onclick   = generate;
$("bClr").onclick   = () => { S.points = []; hardReset(); say("All points cleared — draw your own with the 🖌️ brush"); };
$("bInit").onclick  = doInit;
$("bStep").onclick  = () => nextStep();
$("bRun").onclick   = runToCompletion;
$("bBest").onclick  = () => bestOfN(10);
$("bReset").onclick = () => { hardReset(); say("Reset — the data points stay; press Initialize Centroids to start again (randomness may give a different answer)"); };

window.addEventListener("resize", () => { resize(); drawChart(); });
new ResizeObserver(() => { resize(); drawChart(); }).observe(canvas);

/* ======================= TEST HOOK ======================= */
/* Expose internals for the unit tests in tests/ — no effect on normal use */
window.__app = {
  S, V, TOOLS, COLORS, NAMES, LINEMAX, EPS, SPEEDS,
  get LX(){ return LX; }, get LY(){ return LY; },
  get unit(){ return unit; }, get ox(){ return ox; }, get oy(){ return oy; },
  get plotW(){ return plotW; }, get plotH(){ return plotH; },
  get cw(){ return cw; }, get ch(){ return ch; },
  px, toLogical, d2, inWorld, sc, clampPan, markView, zoomAt, resetView, syncView, clampToView,
  gauss, rnd, clampPt, blob, sdFor, spreadCenters, generate,
  pickInitial, assignAll, meanUpdate, silentRun,
  doInit, doAssign, doUpdate, nextStep, runToCompletion, bestOfN, animateTo, hardReset,
  currentPhaseKey, sync, say, resize, render, drawGrid, drawChart,
  setTool, brushR, busy, sprayAt, eraseAt, dab, erasePx, strokeTo, beginStroke, endStroke,
  sprayPuff, startSpray, sprayLoop, SPRAYMS, penAt, PENMIN,
  stabF, spacing, get stroke(){ return stroke; },
  hitCentroid, spawnCentroid, deleteCentroid,
  trimCentroids, afterCentroidEdit, evPos,
  onDown, onMove, onUp, onWheel, onContext, onKey,
  get mode(){ return mode; }, get hoverPt(){ return hoverPt; }, get hoverC(){ return hoverC; },
  get spaceDown(){ return spaceDown; }
};

/* ======================= BOOT ======================= */
resize();
setTool("brush");
syncView();
generate();
render();

export const app = window.__app;
