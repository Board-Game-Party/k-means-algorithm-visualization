/* K-means core and step machine — Rev 1 behaviour that Rev 2 must not break */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { app, dom, reset, seed, unseed, setPoints, setCentroids, pt, click, input, msg } from "./helpers.mjs";

after(() => unseed());
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

describe("assignAll", () => {
  beforeEach(() => reset());

  test("every point really is attached to its nearest centroid", () => {
    setPoints([pt(0, 0), pt(1, 1), pt(20, 20), pt(19, 21)]);
    setCentroids([{ x: 0, y: 0 }, { x: 20, y: 20 }]);
    app.assignAll(app.S.points, app.S.centroids);
    assert.deepEqual(app.S.points.map(p => p.c), [0, 0, 1, 1]);
  });

  test("every assignment is the minimum-distance one (checked by brute force)", () => {
    seed(7);
    setPoints(Array.from({ length: 60 }, () => pt(Math.random() * 100, Math.random() * 100)));
    setCentroids([{ x: 10, y: 10 }, { x: 50, y: 50 }, { x: 90, y: 20 }]);
    app.assignAll(app.S.points, app.S.centroids);
    for(const p of app.S.points){
      const ds = app.S.centroids.map(c => app.d2(p, c));
      assert.equal(p.c, ds.indexOf(Math.min(...ds)));
    }
  });

  test("returns SSE = the sum of squared distances to each point's own centroid", () => {
    setPoints([pt(0, 3), pt(4, 0)]);
    setCentroids([{ x: 0, y: 0 }]);
    const r = app.assignAll(app.S.points, app.S.centroids);
    near(r.sse, 9 + 16);
  });

  test("counts how many points changed cluster", () => {
    setPoints([pt(0, 0), pt(30, 30)]);
    setCentroids([{ x: 0, y: 0 }, { x: 30, y: 30 }]);
    assert.equal(app.assignAll(app.S.points, app.S.centroids).changed, 2);
    assert.equal(app.assignAll(app.S.points, app.S.centroids).changed, 0, "nobody should move on the second pass");
  });

  test("a tie resolves to the first centroid", () => {
    setPoints([pt(10, 0)]);
    setCentroids([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
    app.assignAll(app.S.points, app.S.centroids);
    assert.equal(app.S.points[0].c, 0);
  });
});

describe("meanUpdate", () => {
  beforeEach(() => reset());

  test("the new centroid is the mean of its members", () => {
    setPoints([pt(0, 0, 0), pt(10, 0, 0), pt(0, 10, 0), pt(10, 10, 0)]);
    const out = app.meanUpdate(app.S.points, [{ x: 99, y: 99 }]);
    near(out[0].x, 5); near(out[0].y, 5);
  });

  test("an empty cluster keeps its old centroid instead of producing NaN", () => {
    setPoints([pt(1, 1, 0)]);
    const out = app.meanUpdate(app.S.points, [{ x: 1, y: 1 }, { x: 40, y: 60 }]);
    assert.deepEqual(out[1], { x: 40, y: 60 });
    assert.ok(Number.isFinite(out[1].x) && Number.isFinite(out[1].y));
  });

  test("unassigned points (c = -1) are excluded from the mean", () => {
    setPoints([pt(0, 0, 0), pt(10, 10, -1)]);
    const out = app.meanUpdate(app.S.points, [{ x: 5, y: 5 }]);
    near(out[0].x, 0); near(out[0].y, 0);
  });
});

describe("pickInitial", () => {
  beforeEach(() => reset());

  test("random picks K points, all of them taken from the real dataset", () => {
    seed(11);
    setPoints(Array.from({ length: 40 }, (_, i) => pt(i, i * 2)));
    const cs = app.pickInitial(app.S.points, 4, "random");
    assert.equal(cs.length, 4);
    for(const c of cs) assert.ok(app.S.points.some(p => p.x === c.x && p.y === c.y));
  });

  test("random never picks the same point twice", () => {
    seed(3);
    setPoints(Array.from({ length: 12 }, (_, i) => pt(i, 0)));
    const cs = app.pickInitial(app.S.points, 5, "random");
    assert.equal(new Set(cs.map(c => `${c.x},${c.y}`)).size, 5);
  });

  test("farthest-first picks points from opposite corners of the data", () => {
    seed(5);
    setPoints([pt(0, 0), pt(1, 1), pt(2, 0), pt(100, 100), pt(99, 99), pt(0, 100)]);
    const cs = app.pickInitial(app.S.points, 3, "farthest");
    assert.equal(cs.length, 3);
    const keys = cs.map(c => `${c.x},${c.y}`);
    assert.equal(new Set(keys).size, 3, "must be distinct");
    assert.ok(keys.includes("100,100") || keys.includes("0,100") || keys.includes("0,0"));
  });

  test("the centroids are fresh objects, not references to data points", () => {
    setPoints([pt(4, 4), pt(8, 8)]);
    const cs = app.pickInitial(app.S.points, 2, "random");
    cs[0].x = -1;
    assert.ok(app.S.points.every(p => p.x !== -1));
  });
});

describe("silentRun (used by Best-of-N)", () => {
  beforeEach(() => reset());

  test("converges and returns a label for every point", () => {
    seed(21);
    setPoints(Array.from({ length: 50 }, (_, i) => pt(i % 10 * 3 + (i < 25 ? 0 : 60), 20 + (i % 5))));
    const r = app.silentRun(app.S.points, 2, "random");
    assert.equal(r.labels.length, 50);
    assert.equal(r.cents.length, 2);
    assert.ok(r.sse >= 0 && Number.isFinite(r.sse));
  });

  test("leaves the original points untouched", () => {
    seed(22);
    setPoints([pt(1, 1), pt(50, 50), pt(51, 49)]);
    const before = app.S.points.map(p => p.c);
    app.silentRun(app.S.points, 2, "random");
    assert.deepEqual(app.S.points.map(p => p.c), before);
  });

  test("two well-separated blobs give a low SSE and a correct split", () => {
    seed(23);
    setPoints([pt(0, 0), pt(1, 0), pt(0, 1), pt(80, 80), pt(81, 80), pt(80, 81)]);
    const r = app.silentRun(app.S.points, 2, "farthest");
    assert.ok(r.sse < 5, `sse = ${r.sse}`);
    assert.equal(new Set(r.labels.slice(0, 3)).size, 1);
    assert.equal(new Set(r.labels.slice(3)).size, 1);
    assert.notEqual(r.labels[0], r.labels[3]);
  });
});

describe("step machine", () => {
  beforeEach(() => { seed(31); reset(); });

  test("doInit refuses when there are fewer points than K", () => {
    setPoints([pt(1, 1), pt(2, 2)]);
    app.S.k = 3; dom.el("inK").value = 3;
    app.doInit();
    assert.equal(app.S.centroids.length, 0);
    assert.match(msg(), /at least 3 data points/);
  });

  test("doInit creates K centroids with animation state and a trail", () => {
    app.generate();
    app.doInit();
    assert.equal(app.S.centroids.length, 3);
    for(const c of app.S.centroids){
      assert.equal(c.ax, c.x); assert.equal(c.ay, c.y);
      assert.deepEqual(c.trail, [{ x: c.x, y: c.y }]);
    }
    assert.equal(app.S.phase, "assign");
    assert.equal(app.S.iter, 0);
  });

  test("doInit honours the selected farthest-first mode", () => {
    app.generate();
    dom.el("inInit").value = "farthest";
    app.doInit();
    assert.equal(app.S.initMethod, "farthest");
    assert.match(msg(), /farthest-first/);
  });

  test("doAssign moves to the update phase and records one baseline SSE", async () => {
    app.generate(); app.doInit();
    await app.doAssign();
    assert.equal(app.S.phase, "update");
    assert.equal(app.S.history.length, 1);
    assert.ok(app.S.sse > 0);
  });

  test("doUpdate moves centroids to the means, bumps the iteration and records history", async () => {
    app.generate(); app.doInit();
    await app.doAssign();
    const means = app.meanUpdate(app.S.points, app.S.centroids);
    await app.doUpdate();
    assert.equal(app.S.iter, 1);
    app.S.centroids.forEach((c, i) => { near(c.x, means[i].x, 1e-9); near(c.y, means[i].y, 1e-9); });
    assert.equal(app.S.history.length, 2);
  });

  test("SSE decreases every round until convergence (Lloyd's invariant)", async () => {
    app.generate(); app.doInit();
    for(let i = 0; i < 40 && app.S.phase !== "done"; i++) await app.nextStep();
    assert.equal(app.S.phase, "done");
    const h = app.S.history;
    assert.ok(h.length >= 2);
    for(let i = 1; i < h.length; i++)
      assert.ok(h[i] <= h[i - 1] + 1e-9, `SSE rose at round ${i}: ${h[i - 1]} → ${h[i]}`);
  });

  test("at convergence each centroid equals its cluster mean and every point sits with its nearest centroid", async () => {
    app.generate(); app.doInit();
    for(let i = 0; i < 40 && app.S.phase !== "done"; i++) await app.nextStep();
    const means = app.meanUpdate(app.S.points, app.S.centroids);
    app.S.centroids.forEach((c, i) => { near(c.x, means[i].x, 1e-6); near(c.y, means[i].y, 1e-6); });
    for(const p of app.S.points){
      const ds = app.S.centroids.map(c => app.d2(p, c));
      assert.equal(p.c, ds.indexOf(Math.min(...ds)));
    }
    assert.ok(app.S.maxMove < app.EPS);
  });

  test("nextStep with no centroids initializes them first", async () => {
    app.generate();
    await app.nextStep();
    assert.equal(app.S.centroids.length, 3);
  });

  test("nextStep after convergence changes nothing but tells the user", async () => {
    app.generate(); app.doInit();
    for(let i = 0; i < 40 && app.S.phase !== "done"; i++) await app.nextStep();
    const snap = JSON.stringify(app.S.centroids);
    await app.nextStep();
    assert.equal(JSON.stringify(app.S.centroids), snap);
    assert.match(msg(), /has converged/);
  });

  test("runToCompletion runs to convergence and clears the running flag", async () => {
    app.generate();
    await app.runToCompletion();
    assert.equal(app.S.phase, "done");
    assert.equal(app.S.running, false);
    assert.ok(app.S.iter > 0);
  });

  test("pressing Run again mid-run stops it", async () => {
    app.generate(); app.doInit();
    app.S.running = true;
    await app.runToCompletion();
    assert.equal(app.S.running, false);
  });

  test("hardReset clears centroids, history and every label", async () => {
    app.generate(); app.doInit();
    await app.doAssign();
    app.hardReset();
    assert.deepEqual(app.S.centroids, []);
    assert.deepEqual(app.S.history, []);
    assert.equal(app.S.iter, 0);
    assert.equal(app.S.sse, null);
    assert.equal(app.S.sel, -1);
    assert.ok(app.S.points.every(p => p.c === -1));
    assert.ok(app.S.points.length > 0, "the data points must survive");
  });

  test("currentPhaseKey reflects the real state", async () => {
    app.S.points = [];
    assert.equal(app.currentPhaseKey(), "idle");
    app.generate();
    assert.equal(app.currentPhaseKey(), "ready");
    app.doInit();
    assert.equal(app.currentPhaseKey(), "assign");
    await app.doAssign();
    assert.equal(app.currentPhaseKey(), "update");
  });
});

describe("Best of N", () => {
  beforeEach(() => { seed(41); reset(); });

  test("keeps the lowest-SSE result and ends in the done state", () => {
    app.generate();
    app.bestOfN(10);
    assert.equal(app.S.phase, "done");
    assert.equal(app.S.centroids.length, 3);
    assert.equal(app.S.history.length, 1);
    assert.equal(app.S.maxMove, 0);
    assert.match(msg(), /lowest SSE/);
  });

  test("the chosen SSE is never worse than repeated single runs", () => {
    app.generate();
    app.bestOfN(10);
    const best = app.S.sse;
    for(let i = 0; i < 5; i++){
      const r = app.silentRun(app.S.points, 3, "random");
      assert.ok(best <= r.sse + 1e-9, `best ${best} is worse than a single run ${r.sse}`);
    }
  });

  test("refuses when there are fewer points than K", () => {
    setPoints([pt(1, 1)]);
    app.S.k = 3; dom.el("inK").value = 3;
    app.bestOfN(10);
    assert.equal(app.S.centroids.length, 0);
    assert.match(msg(), /at least 3 data points/);
  });

  test("every label matches the nearest centroid of the chosen result", () => {
    app.generate();
    app.bestOfN(10);
    for(const p of app.S.points){
      const ds = app.S.centroids.map(c => app.d2(p, c));
      assert.equal(p.c, ds.indexOf(Math.min(...ds)));
    }
  });
});

describe("centroid animation", () => {
  beforeEach(() => { seed(51); reset(); });

  test("instant mode (top speed) sets the final position immediately", async () => {
    setPoints([pt(10, 10)]);
    setCentroids([{ x: 0, y: 0 }]);
    app.S.speed = 3;
    await app.animateTo([{ x: 40, y: 60 }]);
    const c = app.S.centroids[0];
    assert.deepEqual([c.x, c.y, c.ax, c.ay], [40, 60, 40, 60]);
    assert.equal(app.S.animating, false);
  });

  test("animated mode eases toward the target and lands exactly on it", async () => {
    setCentroids([{ x: 0, y: 0 }]);
    app.S.speed = 1;                       // 480ms
    const p = app.animateTo([{ x: 100, y: 0 }]);
    assert.equal(app.S.animating, true);
    dom.advance(240); dom.flushRaf();      // halfway through the animation
    const mid = app.S.centroids[0].ax;
    assert.ok(mid > 0 && mid < 100, `midpoint position = ${mid}`);
    for(let i = 0; i < 12 && app.S.animating; i++){ dom.advance(100); dom.flushRaf(); }
    await p;
    assert.equal(app.S.animating, false);
    assert.equal(app.S.centroids[0].x, 100);
    assert.equal(app.S.centroids[0].ax, 100);
  });

  test("every move is appended to the movement trail", async () => {
    setCentroids([{ x: 0, y: 0 }]);
    app.S.speed = 3;
    await app.animateTo([{ x: 10, y: 10 }]);
    await app.animateTo([{ x: 20, y: 20 }]);
    assert.equal(app.S.centroids[0].trail.length, 3);
    assert.deepEqual(app.S.centroids[0].trail.at(-1), { x: 20, y: 20 });
  });
});

describe("dataset presets", () => {
  beforeEach(() => { seed(61); reset(); });

  for(const kind of ["blobs", "sizes", "density", "rings", "outliers"]){
    test(`preset "${kind}" keeps every generated point inside the data frame`, () => {
      dom.el("inData").value = kind;
      app.generate();
      assert.ok(app.S.points.length > 20, `got ${app.S.points.length} points`);
      for(const p of app.S.points) assert.ok(app.inWorld(p), `point outside the frame: ${p.x},${p.y}`);
      assert.equal(app.S.centroids.length, 0, "generating data must reset the centroids");
    });
  }

  test("the point count lands close to the configured n", () => {
    dom.el("inN").value = 200;
    app.generate();
    assert.ok(Math.abs(app.S.points.length - 200) <= 6, `got ${app.S.points.length} points`);
  });

  test("the rings preset really builds two rings (an inner blob and an outer ring)", () => {
    dom.el("inData").value = "rings";
    app.generate();
    const cx = app.LX / 2, cy = app.LY / 2;
    const rs = app.S.points.map(p => Math.hypot(p.x - cx, p.y - cy));
    const R = Math.min(app.LX, app.LY) / 2;
    assert.ok(rs.some(r => r < R * 0.25), "there must be a core blob");
    assert.ok(rs.some(r => r > R * 0.65), "there must be an outer ring");
  });

  test("the outliers preset scatters points away from the main blobs", () => {
    dom.el("inData").value = "outliers";
    app.generate();
    const r = app.silentRun(app.S.points, 3, "farthest");
    assert.ok(r.sse > 0);
    assert.ok(app.S.points.length > 30);
  });

  test("changing the dataset dropdown regenerates immediately", () => {
    dom.el("inData").value = "density";
    dom.el("inData").fire("change");
    assert.ok(app.S.points.length > 20);
    assert.match(msg(), /Generated/);
  });

  test("clampPt always squeezes coordinates inside the frame", () => {
    const a = app.clampPt({ x: -50, y: -50 }), b = app.clampPt({ x: 9999, y: 9999 });
    assert.deepEqual([a.x, a.y], [2, 2]);
    assert.equal(b.y, 98);
    assert.ok(b.x <= app.LX - 2);
  });

  test("gauss returns finite values with a mean near zero", () => {
    unseed();
    const xs = Array.from({ length: 4000 }, () => app.gauss());
    assert.ok(xs.every(Number.isFinite));
    assert.ok(Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length) < 0.12);
    seed(61);
  });

  test("spreadCenters returns in-frame centres that do not overlap", () => {
    const cs = app.spreadCenters(4);
    assert.equal(cs.length, 4);
    for(const c of cs) assert.ok(c.x > 0 && c.x < app.LX && c.y > 0 && c.y < app.LY);
    for(let i = 0; i < cs.length; i++)
      for(let j = i + 1; j < cs.length; j++)
        assert.ok(app.d2(cs[i], cs[j]) > 1, "centres must not coincide");
  });

  test("the new-data and clear-points buttons work", () => {
    click("bGen");
    assert.ok(app.S.points.length > 0);
    click("bClr");
    assert.equal(app.S.points.length, 0);
    assert.match(msg(), /All points cleared/);
  });

  test("Reset clears the result but keeps the data points", () => {
    app.generate(); app.doInit();
    const n = app.S.points.length;
    click("bReset");
    assert.equal(app.S.centroids.length, 0);
    assert.equal(app.S.points.length, n);
    assert.match(msg(), /^Reset —/);
  });

  test("the n and speed sliders update their labels", () => {
    input("inN", 320);
    assert.equal(dom.el("lblN").textContent, "320");
    input("inSpd", 0);
    assert.equal(app.S.speed, 0);
    assert.equal(dom.el("lblSpd").textContent, "Slow");
  });
});
