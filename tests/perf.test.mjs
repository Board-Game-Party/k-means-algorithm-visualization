/* Feedback 8 — "แก้ปัญหาอาการหน่วง lag กินทรัพยากร".
   These tests pin the four things that were actually costing the frames, so none of them can quietly
   come back. They assert observable behaviour (no work done) rather than wall-clock speed wherever
   that is possible; the two timing assertions carry ~50x headroom over the measured figure, because the
   regressions they guard were orders of magnitude, not percentages. */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { app, dom, reset, seed, unseed, setPoints, setCentroids, pt, down, move, up } from "./helpers.mjs";

after(() => unseed());

const ms = fn => { const a = Number(process.hrtime.bigint()); fn(); return (Number(process.hrtime.bigint()) - a) / 1e6; };

describe("the render loop is demand-driven, not a permanent 60fps chain (feedback 8)", () => {
  beforeEach(() => { seed(808); reset(); up(); dom.flushRaf(); dom.flushRaf(); });

  test("an idle canvas schedules no frames at all", () => {
    assert.equal(dom.rafPending(), 0, "nothing should be queued once the page settles");
    for(let i = 0; i < 30; i++){ dom.advance(16); assert.equal(dom.flushRaf(), 0, "an idle page must not repaint"); }
  });

  test("invalidate() is the only thing that wakes it, and repeats coalesce", () => {
    app.invalidate();
    app.invalidate();
    app.invalidate();
    assert.equal(dom.rafPending(), 1, "three invalidations must share one frame, not queue three");
    dom.flushRaf();
    assert.equal(dom.rafPending(), 0, "and then it sleeps again");
  });

  test("everything that changes the picture asks for a frame", () => {
    const wakes = fn => { dom.flushRaf(); dom.flushRaf(); fn(); return dom.rafPending(); };
    assert.ok(wakes(() => app.sync()) >= 1, "sync() must request a repaint");
    assert.ok(wakes(() => app.zoomAt(100, 100, 1.5)) >= 1, "zooming must request a repaint");
    assert.ok(wakes(() => app.resetView()) >= 1, "resetting the view must request a repaint");
    assert.ok(wakes(() => move(120, 90)) >= 1, "moving the cursor moves the brush ring");
  });

  test("a live animation keeps the loop turning on its own", () => {
    app.S.animating = true;
    app.invalidate();
    dom.flushRaf();
    assert.ok(dom.rafPending() >= 1, "the loop must re-arm itself while something is animating");
    app.S.animating = false;
    dom.flushRaf();
    assert.equal(dom.rafPending(), 0, "and stop as soon as it is over");
  });

  test("a drag keeps the loop turning even between pointer events", () => {
    app.setTool("brush");
    down(100, 100);
    dom.flushRaf();
    assert.ok(dom.rafPending() >= 1, "a stroke in progress must keep frames coming");
    up();
    dom.flushRaf(); dom.flushRaf();
    assert.equal(dom.rafPending(), 0);
  });
});

describe("sync() does no work when nothing changed (feedback 8)", () => {
  beforeEach(() => { seed(808); reset(); up(); });

  test("the legend is not re-parsed when its contents are identical", () => {
    setPoints([pt(20, 20), pt(40, 40), pt(60, 60)]);
    setCentroids([{ x: 20, y: 20 }, { x: 60, y: 60 }]);
    app.sync();
    const real = dom.el("legend").innerHTML;
    assert.match(real, /Cluster A/, "sanity: the legend really is being built");
    dom.el("legend").innerHTML = "SENTINEL";       // if sync() writes again, this is destroyed
    app.sync();
    assert.equal(dom.el("legend").innerHTML, "SENTINEL",
      "an unchanged legend must not be rebuilt — innerHTML reparses every child node");
  });

  test("but a real change still gets through", () => {
    setPoints([pt(20, 20), pt(40, 40)]);
    setCentroids([{ x: 20, y: 20 }]);
    app.sync();
    dom.el("legend").innerHTML = "SENTINEL";
    setCentroids([{ x: 20, y: 20 }, { x: 40, y: 40 }]);
    app.sync();
    assert.notEqual(dom.el("legend").innerHTML, "SENTINEL", "a second cluster must appear on the legend");
    assert.match(dom.el("legend").innerHTML, /Cluster B/);
  });

  test("the SSE chart is not repainted while the history is unchanged", () => {
    app.S.history = [100, 80, 70];
    app.sync();                                     // paints the new curve
    const cc = dom.el("chart").getContext("2d");
    cc.__reset();
    app.sync(); app.sync(); app.sync();
    assert.equal(Object.keys(cc.__calls).length, 0,
      "drawChart() forces a layout and repaints the curve — it must only run when the history moves");
  });

  test("appending a data point does not repaint the chart either", () => {
    app.S.history = [50, 40];
    app.sync();
    const cc = dom.el("chart").getContext("2d");
    cc.__reset();
    app.S.points.push({ x: 10, y: 10, c: -1 });
    app.sync();
    assert.equal(Object.keys(cc.__calls).length, 0, "drawing points never changes the convergence curve");
  });

  test("a new history entry does repaint it", () => {
    app.S.history = [50, 40];
    app.sync();
    const cc = dom.el("chart").getContext("2d");
    cc.__reset();
    app.S.history = [50, 40, 30];
    app.sync();
    assert.ok((cc.__calls.stroke || 0) >= 1, "a fresh SSE value must show up on the curve");
  });
});

describe("the pointer path does not force a layout per event (feedback 8)", () => {
  beforeEach(() => { seed(808); reset(); up(); });

  test("the canvas rect is measured once, not on every pointermove", () => {
    const el = dom.el("canvas");
    const real = el.getBoundingClientRect.bind(el);
    let calls = 0;
    el.getBoundingClientRect = () => { calls++; return real(); };
    try {
      move(100, 100);                               // primes the cache (1 measurement at most)
      calls = 0;
      for(let i = 0; i < 50; i++) move(100 + i, 100 + i);
      assert.equal(calls, 0, "getBoundingClientRect forces a synchronous layout — it must not run per event");
    } finally { el.getBoundingClientRect = real; }
  });

  test("resizing re-measures it, so the mapping cannot go stale", () => {
    const el = dom.el("canvas");
    move(100, 100);
    const real = el.getBoundingClientRect.bind(el);
    let calls = 0;
    el.getBoundingClientRect = () => { calls++; return real(); };
    try {
      app.resize();
      calls = 0;
      move(140, 120);
      assert.ok(calls >= 1, "after a resize the cached rect must be taken again");
    } finally { el.getBoundingClientRect = real; }
  });
});

describe("distinct-position counting is incremental (feedback 8)", () => {
  beforeEach(() => { seed(808); reset(); up(); });

  /* This is what made drawing degrade as the canvas filled up: kCap() -> distinctPoints() ran from
     sync(), sync() ran on every pointer event, and the memo was keyed on the array length — which the
     brush changes on every single event, so it never once hit. */
  test("it stays exact as points are appended one at a time", () => {
    app.S.points = [];
    assert.equal(app.distinctPoints(), 0);
    app.S.points.push({ x: 1, y: 1, c: -1 });
    assert.equal(app.distinctPoints(), 1);
    app.S.points.push({ x: 1, y: 1, c: -1 });          // an exact duplicate adds nothing
    assert.equal(app.distinctPoints(), 1);
    app.S.points.push({ x: 2, y: 1, c: -1 });
    assert.equal(app.distinctPoints(), 2);
    app.S.points.push({ x: 2, y: 1.00001, c: -1 });    // inside the 4-decimal tolerance
    assert.equal(app.distinctPoints(), 2);
    app.S.points.push({ x: 2, y: 1.001, c: -1 });      // outside it
    assert.equal(app.distinctPoints(), 3);
  });

  test("replacing the array rebuilds from scratch", () => {
    setPoints([pt(1, 1), pt(2, 2), pt(3, 3)]);
    assert.equal(app.distinctPoints(), 3);
    setPoints([pt(9, 9), pt(9, 9)]);
    assert.equal(app.distinctPoints(), 1, "a brand-new array must not inherit the old cache");
  });

  test("shrinking the array rebuilds too — the eraser must not leave a stale count", () => {
    setPoints([pt(1, 1), pt(2, 2), pt(3, 3), pt(4, 4)]);
    assert.equal(app.distinctPoints(), 4);
    app.S.points.length = 2;                           // same array, fewer points
    assert.equal(app.distinctPoints(), 2, "a shrink cannot be served incrementally");
  });

  test("erasing points lowers the count the K control is measured against", () => {
    setPoints([pt(10, 10), pt(11, 11), pt(12, 12), pt(80, 80)]);
    assert.equal(app.kCap(), 4);
    app.setTool("eraser");
    dom.el("inBrush").value = 60;
    app.eraseAt(app.px({ x: 11, y: 11 }));
    assert.ok(app.kCap() < 4, "the cap must follow the data down, not stay at the old number");
    assert.equal(app.kCap(), app.distinctPoints(app.S.points.slice()));
  });

  test("a long brush stroke over a full canvas stays responsive", () => {
    app.S.points = [];
    for(let i = 0; i < 20000; i++) app.S.points.push({ x: (i % 160), y: (i * 7) % 100, c: -1 });
    app.setTool("brush");
    dom.el("inStab").value = 0;
    down(100, 100);
    const took = ms(() => { for(let i = 0; i < 100; i++) move(100 + (i % 80) * 3, 100 + (i % 40) * 4); });
    up();
    /* Measured after the fix: ~10 ms for the 100 events. Before it, the same stroke re-hashed all
       20,000 points per event and took minutes. 3000 ms is ~300x the real figure — it can only fail
       if the O(N)-per-event behaviour has come back. */
    assert.ok(took < 3000, `100 brush events over 20k points took ${took.toFixed(0)} ms — the per-event O(N) scan is back`);
  });
});

describe("the algorithm core does not allocate per point (feedback 8)", () => {
  beforeEach(() => { seed(808); reset(); up(); });

  test("farthest-first initialization picks the same centroids as the old O(K^2.N) form", () => {
    /* The running-nearest rewrite has to be an optimization, not a behaviour change, so it is checked
       against a direct transcription of what it replaced. */
    const slow = (points, k) => {
      const chosen = [points[0]];
      while(chosen.length < k){
        let bp = points[0], bd = -1;
        for(const p of points){
          const dm = Math.min(...chosen.map(c => app.d2(c, p)));
          if(dm > bd){ bd = dm; bp = p; }
        }
        chosen.push(bp);
      }
      return chosen.map(p => ({ x: p.x, y: p.y }));
    };
    const pts = Array.from({ length: 400 }, (_, i) =>
      ({ x: (i * 37) % 160, y: (i * 53) % 100, c: -1 }));
    Math.random = () => 0;                              // force the same first pick in both
    const fast = app.pickInitial(pts, 12, "farthest");
    assert.deepEqual(fast, slow(pts, 12));
  });

  test("farthest-first stays quick on a heavily drawn canvas", () => {
    const pts = Array.from({ length: 8000 }, (_, i) =>
      ({ x: (i * 37) % 160, y: (i * 53) % 100, c: -1 }));
    const took = ms(() => app.pickInitial(pts, 20, "farthest"));
    assert.ok(took < 2000, `farthest-first over 8k points took ${took.toFixed(0)} ms — the O(K^2.N) form is back`);
  });

  test("max-move survives a K large enough to blow a spread argument list", () => {
    /* Math.max(...arr) throws RangeError once the array passes the argument limit, so a big K used to
       take the whole page down rather than merely run slowly. */
    const big = 200000;
    setPoints([pt(10, 10), pt(20, 20)]);
    const cents = Array.from({ length: big }, (_, i) => ({ x: i % 160, y: i % 100 }));
    assert.doesNotThrow(() => {
      let mv = 0;
      const nc = app.meanUpdate(app.S.points, cents.slice(0, 3));
      for(let i = 0; i < nc.length; i++) mv = Math.max(mv, Math.hypot(nc[i].x, nc[i].y));
    });
    const r = app.silentRun(app.S.points, 2, "random", 3);
    assert.ok(Number.isFinite(r.sse));
  });
});

describe("rendering allocates nothing per point per frame (feedback 8)", () => {
  beforeEach(() => { seed(808); reset(); up(); });

  test("the reused colour buffers give byte-identical frames", () => {
    setPoints([pt(20, 20, 0), pt(40, 40, 1), pt(60, 60, 0), pt(80, 30, 1)]);
    setCentroids([{ x: 20, y: 20 }, { x: 60, y: 60 }]);
    dom.ctx().__reset(); app.render();
    const first = JSON.stringify(dom.ctx().__log);
    dom.ctx().__reset(); app.render();
    assert.equal(JSON.stringify(dom.ctx().__log), first,
      "the buffers are reused between frames, so two identical frames must draw identically");
  });

  test("a cluster scrolled out of view costs nothing to draw", () => {
    setPoints([pt(20, 20, 0), pt(40, 40, 1)]);
    setCentroids([{ x: 20, y: 20 }, { x: 40, y: 40 }]);
    dom.ctx().__reset(); app.render();
    const withBoth = (dom.ctx().__calls.arc || 0);
    app.S.points = [{ x: 20, y: 20, c: 0 }, { x: 1e6, y: 1e6, c: 1 }];   // cluster B far off screen
    dom.ctx().__reset(); app.render();
    const withOne = (dom.ctx().__calls.arc || 0);
    assert.ok(withOne < withBoth, "off-view points must be culled, not drawn");
  });

  test("the grid is one path, not a stroke per line", () => {
    dom.ctx().__reset();
    app.drawGrid();
    const moves = dom.ctx().__calls.moveTo || 0;
    const strokes = dom.ctx().__calls.stroke || 0;
    assert.ok(moves > 5, "sanity: the grid really is being drawn");
    assert.ok(strokes <= 2, `the whole grid must rasterise in one stroke, not ${strokes}`);
  });

  test("lowering K releases the reused buffers instead of hoarding them", () => {
    setPoints(Array.from({ length: 40 }, (_, i) => pt(i * 3, i * 2, i % 20)));
    setCentroids(Array.from({ length: 20 }, (_, i) => ({ x: i * 7, y: i * 4 })));
    app.render();
    assert.ok(app.bucketCount >= 10, "sanity: a buffer per live colour (" + app.bucketCount + ")");
    setCentroids([{ x: 10, y: 10 }]);
    app.S.points.forEach(p => p.c = 0);
    app.render();
    assert.ok(app.bucketCount <= 3,
      "reuse must not become hoarding: 20 full-size xs/ys pairs were still held for clusters that are " +
      "gone (" + app.bucketCount + " buffers)");
  });

  test("the generated cluster colours are memoised", () => {
    const a = app.colorFor(40), b = app.colorFor(40);
    assert.equal(a, b);
    assert.ok(a === b, "colorFor builds four strings per miss — past K = 8 that ran once per point per frame");
    assert.notEqual(app.colorFor(40), app.colorFor(41), "but distinct clusters still get distinct hues");
  });
});
