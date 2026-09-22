/* tests/dom.mjs — the smallest DOM/Canvas stub that lets the real index.html script run in Node.
   Not one line of app logic is mocked: only the browser is stubbed, the shipped code runs on top. */

export const W = 800, H = 500;          // assumed canvas size (CSS pixels)
export const CHART_W = 340, CHART_H = 104;

let clock = 0;
const raf = [];

class ClassList {
  constructor(el){ this.el = el; }
  add(...c){ c.forEach(x => this.el._cls.add(x)); }
  remove(...c){ c.forEach(x => this.el._cls.delete(x)); }
  contains(c){ return this.el._cls.has(c); }
  toggle(c, on){ const has = this.el._cls.has(c); const want = on === undefined ? !has : !!on;
                 want ? this.el._cls.add(c) : this.el._cls.delete(c); return want; }
}

class El {
  constructor(id, props = {}){
    this.id = id;
    this._cls = new Set(String(props.className || "").split(/\s+/).filter(Boolean));
    this.classList = new ClassList(this);
    this.dataset = props.dataset || {};
    this.style = {};
    this.tagName = props.tagName || "DIV";
    this.handlers = {};
    this.disabled = false;
    this.checked = props.checked !== undefined ? props.checked : false;
    this.options = props.options || null;
    this._value = props.value !== undefined ? String(props.value) : "";
    this._text = "";
    this._html = "";
    this.width = 0; this.height = 0;
    this.rect = props.rect || { left: 0, top: 0, width: W, height: H };
  }
  get className(){ return [...this._cls].join(" "); }
  set className(v){ this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent(){ return this._text; }
  set textContent(v){ this._text = String(v); }
  get innerHTML(){ return this._html; }
  set innerHTML(v){ this._html = String(v); }
  get value(){ return this._value; }
  set value(v){ this._value = String(v); }
  get selectedOptions(){
    const o = (this.options || []).find(x => x.value === this._value) || (this.options || [])[0];
    return o ? [o] : [];
  }
  getBoundingClientRect(){ return { ...this.rect }; }
  getContext(){ return this.ctx || (this.ctx = makeCtx()); }
  setPointerCapture(){}
  releasePointerCapture(){}
  addEventListener(t, f){ (this.handlers[t] = this.handlers[t] || []).push(f); }
  removeEventListener(t, f){ this.handlers[t] = (this.handlers[t] || []).filter(x => x !== f); }
  /** Dispatch an event on this element (stands in for a real click in tests) */
  fire(t, ev = {}){
    const e = { target: this, preventDefault(){ e.defaultPrevented = true; }, defaultPrevented: false, ...ev };
    (this.handlers[t] || []).forEach(f => f(e));
    if(t === "click" && typeof this.onclick === "function") this.onclick(e);
    if(t === "change" && typeof this.onchange === "function") this.onchange(e);
    return e;
  }
}

/** Record every draw call with its arguments so tests can assert what was drawn, and where */
function makeCtx(){
  const calls = {};
  const log = [];
  const rec = name => (...a) => {
    calls[name] = (calls[name] || 0) + 1;
    log.push([name, ...a]);
    if(name === "arc") calls._arcs = (calls._arcs || []).concat([a.slice(0, 3)]);
  };
  const c = {
    __calls: calls, __log: log,
    __reset(){ for(const k of Object.keys(calls)) delete calls[k]; log.length = 0; },
    /** Every argument list recorded for the given draw call */
    __args(name){ return log.filter(e => e[0] === name).map(e => e.slice(1)); }
  };
  for(const m of ["setTransform","clearRect","fillRect","strokeRect","beginPath","moveTo","lineTo","arc",
                  "fill","stroke","save","restore","translate","rotate","setLineDash","clip","rect",
                  "fillText","closePath","quadraticCurveTo","bezierCurveTo","ellipse","measureText"]) c[m] = rec(m);
  c.measureText = () => ({ width: 10 });
  return c;
}

const els = new Map();
function el(id, props){ const e = new El(id, props); els.set(id, e); return e; }

/* ---- every element the index.html script looks up ---- */
el("canvas", { tagName: "CANVAS", rect: { left: 0, top: 0, width: W, height: H } });
el("chart",  { tagName: "CANVAS", rect: { left: 0, top: 0, width: CHART_W, height: CHART_H } });
el("inK",     { tagName: "INPUT", value: 3 });    // number input: K has no fixed ceiling, only K ≤ N
el("inN",     { tagName: "INPUT", value: 150 });  // number input: n has no fixed ceiling
el("inSpd",   { tagName: "INPUT", value: 1 });
el("inBrush", { tagName: "INPUT", value: 28 });
el("inDens",  { tagName: "INPUT", value: 3 });
el("inStab",  { tagName: "INPUT", value: 45 });
el("cbLines", { tagName: "INPUT", checked: true });
el("cbTrail", { tagName: "INPUT", checked: true });
el("inData",  { tagName: "SELECT", value: "blobs", options: [
  { value: "blobs",    text: "Globular blobs — the well-behaved case" },
  { value: "sizes",    text: "Different sizes — clusters of unequal size" },
  { value: "density",  text: "Different densities — unequal spread" },
  { value: "rings",    text: "Non-globular — concentric rings" },
  { value: "outliers", text: "Outliers — stray points" }
]});
el("inInit", { tagName: "SELECT", value: "random", options: [
  { value: "random",   text: "Random" },
  { value: "farthest", text: "Farthest-first" }
]});
for(const id of ["lblK","lblN","lblSpd","lblBrush","lblDens","lblZoom","phaseName","phaseDot","infoTitle",
                 "infoDesc","infoMath","stIter","stN","stSSE","stMove","stCent","legend","msg","histTxt",
                 "toolHint","brushOpts","densOpt","stabOpt","lblStab","lnHint","kNote","nNote"]) el(id, {});
for(const id of ["bGen","bClr","bInit","bStep","bRun","bBest","bReset","bZoomIn","bZoomOut","bZoomRst"])
  el(id, { tagName: "BUTTON" });

/* .pc = pseudocode lines, .tool = the canvas tool buttons */
const pcs   = [1,2,3,4,5].map(n => new El("pc" + n, { className: "pc off", dataset: { line: String(n) } }));
const tools = ["pen","spray","brush","eraser","hand","centroid"].map(t =>
  new El("tool-" + t, { className: "tool", tagName: "BUTTON", dataset: { tool: t } }));

const windowHandlers = {};
const documentStub = {
  getElementById: id => els.get(id) || el(id, {}),
  querySelectorAll: sel => sel === ".pc" ? pcs : sel === ".tool" ? tools : [],
  querySelector: sel => (documentStub.querySelectorAll(sel)[0] || null),
  addEventListener(t, f){ (windowHandlers[t] = windowHandlers[t] || []).push(f); },
  documentElement: new El("html", {}),
  body: new El("body", {})
};

const windowStub = {
  devicePixelRatio: 1,
  addEventListener(t, f){ (windowHandlers[t] = windowHandlers[t] || []).push(f); },
  removeEventListener(t, f){ windowHandlers[t] = (windowHandlers[t] || []).filter(x => x !== f); }
};

class ResizeObserverStub {
  constructor(cb){ this.cb = cb; ResizeObserverStub.instances.push(this); }
  observe(){ this.observing = true; }
  unobserve(){ this.observing = false; }
  disconnect(){ this.observing = false; }
}
ResizeObserverStub.instances = [];

/* ---- install the globals before the app module is imported ---- */
globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = cb => { raf.push(cb); return raf.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.ResizeObserver = ResizeObserverStub;

/* ---- test helpers ---- */
export const dom = {
  el: id => els.get(id),
  canvas: () => els.get("canvas"),
  tools, pcs, windowHandlers, ResizeObserverStub,
  /** Fire a window-level event (keydown / pointerup / resize) */
  fireWindow(t, ev = {}){
    const e = { target: { tagName: "BODY" }, preventDefault(){ e.defaultPrevented = true; }, defaultPrevented: false, ...ev };
    (windowHandlers[t] || []).forEach(f => f(e));
    return e;
  },
  /** Fire an event straight at the canvas */
  fireCanvas(t, ev = {}){ return els.get("canvas").fire(t, ev); },
  now: () => clock,
  advance(ms){ clock += ms; },
  /** Run one batch of requestAnimationFrame callbacks */
  flushRaf(){ const q = raf.splice(0); q.forEach(cb => cb(clock)); return q.length; },
  /** Advance the clock and run frames — used to wait out centroid animations */
  async runFrames(steps = 30, dt = 80){
    for(let i = 0; i < steps; i++){ clock += dt; this.flushRaf(); await Promise.resolve(); }
  },
  rafPending: () => raf.length,
  ctx: () => els.get("canvas").getContext("2d")
};
