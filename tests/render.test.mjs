/* Rendering and the info panel — proving the new tools are actually visible on the canvas */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { app, dom, reset, seed, unseed, setPoints, setCentroids, cScreen, pt,
         down, move, up, key, click, msg } from "./helpers.mjs";

after(() => unseed());
const ctx = () => dom.ctx();
const arcs = () => ctx().__calls._arcs || [];
/** Was a circle of radius r drawn at (x, y)? */
const hasArc = (x, y, r, eps = 0.5) =>
  arcs().some(a => Math.abs(a[0] - x) < eps && Math.abs(a[1] - y) < eps && Math.abs(a[2] - r) < eps);

describe("canvas rendering", () => {
  beforeEach(() => { seed(101); reset(); });

  test("render paints the background and grid, and clips to the viewport", () => {
    ctx().__reset();
    app.render();
    assert.ok(ctx().__calls.clearRect >= 1);
    assert.ok(ctx().__calls.clip >= 1, "must clip so nothing spills out when zoomed or panned");
    assert.ok(ctx().__calls.save >= 2 && ctx().__calls.restore >= 2);
  });

  test("one circle is drawn per data point", () => {
    setPoints([pt(10, 10), pt(50, 50), pt(120, 80)]);
    ctx().__reset();
    app.render();
    for(const p of app.S.points){
      const s = app.px(p);
      assert.ok(hasArc(s.x, s.y, 4), `no point found at ${s.x},${s.y}`);
    }
  });

  test("a centroid is drawn as three concentric rings", () => {
    setCentroids([{ x: 60, y: 40 }]);
    ctx().__reset();
    app.render();
    const s = cScreen(0);
    for(const r of [15, 11, 7.5]) assert.ok(hasArc(s.x, s.y, r), `missing the ring of radius ${r}`);
  });

  test("the selected centroid gets an extra dashed highlight", () => {
    setCentroids([{ x: 60, y: 40 }]);
    app.S.sel = -1;
    ctx().__reset(); app.render();
    const s = cScreen(0);
    assert.ok(!hasArc(s.x, s.y, 20), "nothing selected, so no highlight ring");
    app.S.sel = 0;
    ctx().__reset(); app.render();
    assert.ok(hasArc(s.x, s.y, 20), "once selected the highlight must appear");
  });

  test("a hovered centroid gets the highlight too", () => {
    app.setTool("centroid");
    setCentroids([{ x: 60, y: 40 }]);
    const s = cScreen(0);
    move(s.x, s.y);
    assert.equal(app.hoverC, 0);
    ctx().__reset(); app.render();
    assert.ok(hasArc(s.x, s.y, 20));
  });

  test("the brush ring follows the pointer", () => {
    app.setTool("brush");
    move(400, 250);
    ctx().__reset(); app.render();
    assert.ok(hasArc(400, 250, app.brushR()), "the ring must sit at the pointer");
  });

  test("the ring grows with the size slider", () => {
    app.setTool("brush");
    dom.el("inBrush").value = 70;
    move(300, 200);
    ctx().__reset(); app.render();
    assert.ok(hasArc(300, 200, 70));
  });

  test("the eraser shows a ring as well", () => {
    app.setTool("eraser");
    move(350, 220);
    ctx().__reset(); app.render();
    assert.ok(hasArc(350, 220, app.brushR()));
  });

  test("the hand and centroid tools show no ring", () => {
    for(const t of ["hand", "centroid"]){
      app.setTool(t);
      move(400, 250);
      ctx().__reset(); app.render();
      assert.ok(!hasArc(400, 250, app.brushR()), `${t} must not draw a ring`);
    }
  });

  test("no ring is drawn while the algorithm runs", () => {
    app.setTool("brush");
    move(400, 250);
    app.S.running = true;
    ctx().__reset(); app.render();
    assert.ok(!hasArc(400, 250, app.brushR()));
    app.S.running = false;
  });

  test("the ring vanishes once the pointer leaves the canvas", () => {
    app.setTool("brush");
    move(400, 250);
    dom.fireCanvas("pointerleave", {});
    ctx().__reset(); app.render();
    assert.ok(!hasArc(400, 250, app.brushR()));
  });

  test("unchecking the link option stops the connector lines", () => {
    setPoints([pt(20, 20), pt(30, 30)]);
    setCentroids([{ x: 25, y: 25 }]);
    app.assignAll(app.S.points, app.S.centroids);
    dom.el("cbLines").checked = true;
    ctx().__reset(); app.render();
    const withLines = ctx().__calls.lineTo || 0;
    dom.el("cbLines").checked = false;
    ctx().__reset(); app.render();
    assert.ok((ctx().__calls.lineTo || 0) < withLines);
  });

  test("unchecking the trail option stops the movement trail", () => {
    setCentroids([{ x: 20, y: 20 }]);
    app.S.centroids[0].trail.push({ x: 60, y: 60 });
    dom.el("cbTrail").checked = true;
    ctx().__reset(); app.render();
    const withTrail = ctx().__calls.setLineDash || 0;
    dom.el("cbTrail").checked = false;
    ctx().__reset(); app.render();
    assert.ok((ctx().__calls.setLineDash || 0) < withTrail);
  });

  test("unassigned points are painted grey", () => {
    setPoints([pt(40, 40)]);
    ctx().__reset(); app.render();
    assert.ok(ctx().__log.some(e => e[0] === "fill"));
    assert.equal(app.S.points[0].c, -1);
  });

  test("render always queues the next frame", () => {
    dom.flushRaf();
    app.render();
    assert.ok(dom.rafPending() >= 1);
    dom.flushRaf();
  });

  test("render works even with no data at all", () => {
    app.S.points = []; app.S.centroids = [];
    ctx().__reset();
    assert.doesNotThrow(() => app.render());
    assert.ok(ctx().__calls.clearRect >= 1);
  });

  test("the grid gets finer as you zoom in", () => {
    ctx().__reset(); app.drawGrid();
    const at1 = ctx().__calls.moveTo || 0;
    app.zoomAt(400, 250, 4);
    ctx().__reset(); app.drawGrid();
    const at4 = ctx().__calls.moveTo || 0;
    assert.notEqual(at1, at4, "grid spacing must follow the zoom level");
  });

  test("the x-axis label reports the real view edge after panning", () => {
    ctx().__reset(); app.drawGrid();
    const before = ctx().__args("fillText")[0][0];
    app.setTool("hand"); down(400, 250); move(200, 250); up();
    ctx().__reset(); app.drawGrid();
    const after = ctx().__args("fillText")[0][0];
    assert.notEqual(before, after, "the left-edge value must change after panning");
    assert.equal(before, "0");
  });
});

describe("the convergence chart (SSE)", () => {
  beforeEach(() => { seed(111); reset(); });

  test("an empty history shows the no-data message", () => {
    app.S.history = [];
    app.drawChart();
    assert.equal(dom.el("histTxt").textContent, "No data yet");
  });

  test("a single value is reported as a single result", () => {
    app.S.history = [123.4];
    app.drawChart();
    assert.match(dom.el("histTxt").innerHTML, /single result/);
  });

  test("several values give the correct percentage drop", () => {
    app.S.history = [200, 150, 100];
    app.drawChart();
    const html = dom.el("histTxt").innerHTML;
    assert.match(html, /3 samples/);
    assert.match(html, /50\.0%/);
  });

  test("the line and a marker are drawn for every history value", () => {
    app.S.history = [10, 8, 6, 5];
    dom.el("chart").getContext("2d").__reset();
    app.drawChart();
    const cc = dom.el("chart").getContext("2d").__calls;
    assert.ok((cc.arc || 0) >= 4);
    assert.ok((cc.stroke || 0) >= 1);
  });

  test("identical values never divide by zero", () => {
    app.S.history = [5, 5, 5];
    assert.doesNotThrow(() => app.drawChart());
    assert.match(dom.el("histTxt").innerHTML, /0\.0%/);
  });
});

describe("the info panel and stats", () => {
  beforeEach(() => { seed(121); reset(); });

  test("every stat tile updates together", async () => {
    app.generate(); app.doInit();
    await app.doAssign(); await app.doUpdate();
    assert.equal(dom.el("stIter").textContent, String(app.S.iter));
    assert.equal(dom.el("stN").textContent, String(app.S.points.length));
    assert.equal(dom.el("stSSE").textContent, app.S.sse.toFixed(2));
    assert.equal(dom.el("stMove").textContent, app.S.maxMove.toFixed(4));
    assert.equal(dom.el("stCent").textContent, `${app.S.centroids.length} / ${app.S.k}`);
  });

  test("with no result yet the tiles show a dash", () => {
    assert.equal(dom.el("stSSE").textContent, "—");
    assert.equal(dom.el("stMove").textContent, "—");
  });

  test("the legend lists every cluster with its member count", async () => {
    app.generate(); app.doInit(); await app.doAssign();
    const html = dom.el("legend").innerHTML;
    for(let i = 0; i < app.S.centroids.length; i++){
      const n = app.S.points.filter(p => p.c === i).length;
      assert.ok(html.includes(app.NAMES[i]), `missing ${app.NAMES[i]}`);
      assert.ok(html.includes(">" + n + "<"), `missing the member count ${n}`);
    }
  });

  test("with no centroids the legend says so plainly", () => {
    assert.match(dom.el("legend").innerHTML, /no centroids yet/);
  });

  test("the explanation panel follows the algorithm phase", async () => {
    app.S.points = []; app.sync();
    assert.equal(dom.el("infoTitle").textContent, "Not started");
    app.generate();
    assert.match(dom.el("infoTitle").textContent, /Initialization/);
    app.doInit();
    assert.match(dom.el("infoTitle").textContent, /Assignment/);
    assert.ok(!dom.el("infoMath").classList.contains("hidden"));
    await app.doAssign();
    assert.match(dom.el("infoTitle").textContent, /Update/);
    for(let i = 0; i < 40 && app.S.phase !== "done"; i++) await app.nextStep();
    assert.match(dom.el("infoTitle").textContent, /Convergence/);
  });

  test("the formula is hidden before the run starts", () => {
    app.S.points = []; app.sync();
    assert.ok(dom.el("infoMath").classList.contains("hidden"));
  });

  test("the highlighted pseudocode line matches the current step", async () => {
    app.generate();
    app.doInit();
    const on = () => dom.pcs.filter(p => p.classList.contains("on")).map(p => p.dataset.line);
    assert.deepEqual(on(), ["2", "3"], "the assign step highlights repeat + assign");
    await app.doAssign();
    assert.deepEqual(on(), ["2", "4"], "the update step highlights repeat + update");
  });

  test("the status dot and phase name really change", () => {
    app.S.points = []; app.sync();
    const idle = dom.el("phaseName").textContent;
    app.generate();
    assert.notEqual(dom.el("phaseName").textContent, idle);
    assert.match(dom.el("phaseDot").className, /bg-/);
  });

  test("say() puts a status message in front of the user", () => {
    app.say("status message under test");
    assert.equal(msg(), "status message under test");
  });

  test("the Run button swaps its label while running", () => {
    app.generate();
    app.S.running = true; app.sync();
    assert.match(dom.el("bRun").textContent, /Stop/);
    app.S.running = false; app.sync();
    assert.match(dom.el("bRun").textContent, /Run to Completion/);
  });

  test("a window resize re-runs resize without breaking", () => {
    assert.doesNotThrow(() => dom.fireWindow("resize", {}));
    assert.ok(app.plotW > 0);
  });

  test("the ResizeObserver is attached to the canvas and callable", () => {
    const ro = dom.ResizeObserverStub.instances.at(-1);
    assert.ok(ro && ro.observing, "the canvas must be observed");
    assert.doesNotThrow(() => ro.cb());
  });
});

describe("unlimited drawing (feedback 2)", () => {
  beforeEach(() => { seed(131); reset(); });

  const ctx = () => dom.ctx();
  const manyPoints = n => setPoints(Array.from({ length: n }, (_, i) =>
    pt(2 + (i * 7.3) % (app.LX - 4), 2 + (i * 3.1) % 96, i % 3)));

  test("points are batched into one path per colour, not one fill per point", () => {
    manyPoints(3000);
    setCentroids([{ x: 20, y: 20 }, { x: 80, y: 50 }, { x: 140, y: 80 }]);
    ctx().__reset(); app.render();
    const fills = ctx().__calls.fill || 0;
    assert.ok(fills < 40, `fill was called ${fills} times for 3000 points — they must be batched by colour`);
    assert.ok((ctx().__calls.arc || 0) >= 3000, "every point must still be drawn");
  });

  test("the dot radius shrinks automatically as the count grows", () => {
    setPoints([pt(50, 50)]);
    ctx().__reset(); app.render();
    const small = (ctx().__calls._arcs || []).find(a => a[2] === 4);
    assert.ok(small, "a small set must draw at radius 4");

    manyPoints(5000);
    ctx().__reset(); app.render();
    const radii = new Set((ctx().__calls._arcs || []).map(a => a[2]));
    assert.ok(radii.has(2.6), `radii used: ${[...radii].join(",")}`);
  });

  test("connector lines switch off past the threshold, and the UI says so", () => {
    manyPoints(app.LINEMAX + 500);
    setCentroids([{ x: 20, y: 20 }, { x: 80, y: 50 }, { x: 140, y: 80 }]);
    app.assignAll(app.S.points, app.S.centroids);
    dom.el("cbLines").checked = true;
    app.sync();
    ctx().__reset(); app.render();
    const on = ctx().__calls.lineTo || 0;          // (the centroid crosshairs still use lineTo)
    dom.el("cbLines").checked = false;
    ctx().__reset(); app.render();
    const off = ctx().__calls.lineTo || 0;
    assert.equal(on, off, "connectors still drawn at high counts — must match the manually-off case");
    assert.match(dom.el("lnHint").textContent, /auto-off/);
  });

  test("below the threshold the connector lines are drawn as usual", () => {
    setPoints([pt(20, 20), pt(30, 30)]);
    setCentroids([{ x: 25, y: 25 }]);
    app.assignAll(app.S.points, app.S.centroids);
    dom.el("cbLines").checked = true;
    app.sync();
    ctx().__reset(); app.render();
    assert.ok((ctx().__calls.lineTo || 0) >= 2);
    assert.equal(dom.el("lnHint").textContent, "");
  });

  test("off-view points are skipped instead of being drawn", () => {
    setPoints([pt(5, 50), pt(app.LX - 5, 50)]);
    ctx().__reset(); app.render();
    const before = (ctx().__calls._arcs || []).length;
    app.zoomAt(app.ox + 10, app.oy + app.plotH - 10, 8);   // zoom into the far bottom-left corner
    ctx().__reset(); app.render();
    const after = (ctx().__calls._arcs || []).length;
    assert.ok(after < before, `still drawing every point after zooming in (${before} → ${after})`);
  });

  test("the algorithm still behaves correctly with a huge point count", async () => {
    manyPoints(9000);
    app.S.points.forEach(p => p.c = -1);
    app.doInit();
    for(let i = 0; i < 60 && app.S.phase !== "done"; i++) await app.nextStep();
    assert.equal(app.S.phase, "done");
    assert.equal(dom.el("stN").textContent, "9000");
    const h = app.S.history;
    for(let i = 1; i < h.length; i++) assert.ok(h[i] <= h[i - 1] + 1e-9);
  });
});
