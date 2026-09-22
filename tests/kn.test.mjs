/* K and n are not capped at a fixed number — the only bound is the theory rule 1 ≤ K ≤ N */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { app, dom, reset, seed, unseed, setPoints, input, msg } from "./helpers.mjs";

after(() => unseed());
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
/** The opening tag of an input, e.g. tag("inK") */
const tag = id => html.match(new RegExp(`<input id="${id}"[^>]*>`, "s"))[0];
/** n points on a line, all distinct */
const line = n => Array.from({ length: n }, (_, i) => ({ x: 5 + (i * 90) / Math.max(1, n - 1), y: 50, c: -1 }));

describe("no fixed ceiling on K or n", () => {
  beforeEach(() => reset());

  test("the K control declares a minimum of 1 and no maximum at all", () => {
    const t = tag("inK");
    assert.match(t, /type="number"/);
    assert.match(t, /min="1"/);
    assert.ok(!/\bmax="/.test(t), `K must not be capped: ${t}`);
  });

  test("the n control declares a minimum of 1 and no maximum at all", () => {
    const t = tag("inN");
    assert.match(t, /type="number"/);
    assert.match(t, /min="1"/);
    assert.ok(!/\bmax="/.test(t), `n must not be capped: ${t}`);
  });

  test("K accepts values far past the old 8-cluster ceiling", () => {
    setPoints(line(60));
    input("inK", 37);
    assert.equal(app.S.k, 37);
    assert.equal(dom.el("lblK").textContent, "37");
    assert.equal(dom.el("stCent").textContent, "0 / 37");
  });

  test("K = 1 is legal (one cluster is the global mean)", () => {
    setPoints(line(20));
    input("inK", 1);
    app.doInit();
    assert.equal(app.S.centroids.length, 1);
    app.doAssign();
    assert.ok(app.S.points.every(p => p.c === 0));
  });

  test("a blank or junk K is ignored instead of collapsing to 0", () => {
    setPoints(line(20));
    input("inK", 5);
    input("inK", "");
    assert.equal(app.S.k, 5, "mid-typing must not wipe K");
    assert.equal(app.readInt("inK", 5), 5);
  });

  test("n generates whatever count is asked for, small or large", () => {
    for(const n of [3, 7, 137, 1500]){
      input("inN", n);
      app.generate();
      const got = app.S.points.length;
      assert.ok(Math.abs(got - n) <= Math.max(3, n * 0.06), `n = ${n} produced ${got} points`);
    }
  });
});

describe("the theory rule: 1 ≤ K ≤ N", () => {
  beforeEach(() => reset());

  test("kFeasible is exactly N >= K", () => {
    setPoints(line(5));
    app.S.k = 5; assert.equal(app.kFeasible(), true, "K = N is allowed");
    app.S.k = 6; assert.equal(app.kFeasible(), false, "K > N is not");
    app.S.k = 1; assert.equal(app.kFeasible(), true);
    assert.equal(app.kCap(), 5);
  });

  test("Initialize refuses K > N and says why", () => {
    setPoints(line(4));
    input("inK", 9);
    app.doInit();
    assert.equal(app.S.centroids.length, 0, "nothing may be initialized");
    assert.match(msg(), /K = 9 needs at least 9 data points/);
    assert.match(msg(), /K ≤ N/);
  });

  test("Best-of-N refuses K > N with the same rule", () => {
    setPoints(line(4));
    input("inK", 9);
    app.bestOfN(3);
    assert.equal(app.S.centroids.length, 0);
    assert.match(msg(), /K ≤ N/);
  });

  test("Initialize and Best are disabled exactly when K > N", () => {
    setPoints(line(6));
    input("inK", 6); app.sync();
    assert.equal(dom.el("bInit").disabled, false);
    assert.equal(dom.el("bBest").disabled, false);
    input("inK", 7); app.sync();
    assert.equal(dom.el("bInit").disabled, true);
    assert.equal(dom.el("bBest").disabled, true);
  });

  test("the K note reports the constraint live", () => {
    setPoints(line(10));
    input("inK", 3); app.sync();
    assert.match(dom.el("kNote").textContent, /K ≤ N ✓/);
    assert.ok(!dom.el("inK").classList.contains("bad"));
    input("inK", 11); app.sync();
    assert.match(dom.el("kNote").textContent, /K > N/);
    assert.ok(dom.el("inK").classList.contains("bad"));
    input("inK", 10); app.sync();
    assert.match(dom.el("kNote").textContent, /K = N → SSE 0/);
  });

  test("K = N is the degenerate boundary: every point becomes its own centroid, SSE = 0", () => {
    seed(7);
    setPoints(line(12));
    input("inK", 12);
    app.bestOfN(3);
    assert.equal(app.S.centroids.length, 12);
    assert.ok(app.S.sse < 1e-9, `SSE should collapse to 0, got ${app.S.sse}`);
  });

  test("pickInitial never hangs when asked for more centroids than there are points", () => {
    const pts = line(3);
    for(const method of ["random", "farthest"]){
      const got = app.pickInitial(pts, 50, method);
      assert.equal(got.length, 3, `${method} must clamp to N`);
    }
  });

  test("duplicate points are warned about: K distinct positions are needed, not just K points", () => {
    setPoints(Array.from({ length: 10 }, () => ({ x: 40, y: 40, c: -1 })).concat(line(2)));
    assert.equal(app.distinctPoints(), 3);
    input("inK", 6);
    app.doInit();
    assert.equal(app.S.centroids.length, 6, "it still runs — the warning is advisory");
    assert.match(msg(), /only 3 distinct positions/);
  });
});

describe("colours and names keep up with any K", () => {
  beforeEach(() => reset());

  test("every cluster index gets a valid hex colour, far past the 8 base hues", () => {
    for(const i of [0, 7, 8, 30, 500]) assert.match(app.colorFor(i), /^#[0-9a-f]{6}$/i, `colorFor(${i})`);
    for(let i = 0; i < app.COLORS.length; i++) assert.equal(app.colorFor(i), app.COLORS[i]);
  });

  test("the first 40 cluster colours are all different", () => {
    const seen = new Set();
    for(let i = 0; i < 40; i++) seen.add(app.colorFor(i));
    assert.equal(seen.size, 40);
  });

  test("cluster names continue A…Z, AA, AB … instead of running out", () => {
    for(let i = 0; i < app.NAMES.length; i++) assert.equal(app.nameFor(i), app.NAMES[i]);
    assert.equal(app.nameFor(8),  "Cluster I");
    assert.equal(app.nameFor(25), "Cluster Z");
    assert.equal(app.nameFor(26), "Cluster AA");
    assert.equal(app.nameFor(27), "Cluster AB");
    const seen = new Set();
    for(let i = 0; i < 300; i++) seen.add(app.nameFor(i));
    assert.equal(seen.size, 300, "names must stay unique");
  });

  test("the legend lists every cluster up to LEGENDMAX, then says how many more", () => {
    seed(11);
    setPoints(line(40));
    input("inK", 40);
    app.doInit();
    app.doAssign();
    const html2 = dom.el("legend").innerHTML;
    assert.ok(html2.includes(app.nameFor(0)));
    assert.ok(html2.includes(app.nameFor(app.LEGENDMAX - 1)));
    assert.ok(!html2.includes(app.nameFor(app.LEGENDMAX)), "past the cap the legend must stop listing");
    assert.ok(html2.includes(`+${40 - app.LEGENDMAX} more clusters`), html2);
  });
});
