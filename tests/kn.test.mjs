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
    assert.match(dom.el("kNote").textContent, /K > distinct positions/);
    assert.ok(dom.el("inK").classList.contains("bad"));
    input("inK", 10); app.sync();
    assert.match(dom.el("kNote").textContent, /every point is its own cluster/);
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

  test("distinct positions, not the raw count, are what K is measured against", () => {
    setPoints(Array.from({ length: 10 }, () => ({ x: 40, y: 40, c: -1 })).concat(line(2)));
    assert.equal(app.distinctPoints(), 3, "12 points, 3 distinct coordinates");
    assert.equal(app.kCap(), 3);
    input("inK", 6); app.sync();
    assert.equal(app.kFeasible(), false, "K = 6 cannot be reached with 3 distinct positions");
    app.doInit();
    assert.equal(app.S.centroids.length, 0, "Initialize refuses rather than building empty clusters");
    assert.match(msg(), /only 3 distinct/);
    assert.match(dom.el("kNote").textContent, /distinct = 3/);
    input("inK", 3); app.sync();
    assert.equal(app.kFeasible(), true, "K = distinct is the real boundary");
    app.doInit();
    assert.equal(app.S.centroids.length, 3);
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


/* ---------------------------------------------------------------------------
   Feedback 4: "UI use both Slider and Input field".
   The number box stays the authority (unbounded, never silently rewritten) and the
   slider is a scrubber over an adaptive range, so feedback 3's rule survives intact.
   --------------------------------------------------------------------------- */
describe("Feedback 4: both a slider and an input field", () => {
  beforeEach(() => reset());

  test("K is offered as a number box AND a range slider", () => {
    assert.match(tag("inK"), /type="number"/);
    assert.match(tag("inKR"), /type="range"/);
    assert.match(tag("inKR"), /min="1"/);
  });

  test("n is offered as a number box AND a range slider", () => {
    assert.match(tag("inN"), /type="number"/);
    assert.match(tag("inNR"), /type="range"/);
    assert.match(tag("inNR"), /min="1"/);
  });

  test("the number boxes are still the uncapped ones (feedback 3 is not regressed)", () => {
    assert.ok(!/\bmax="/.test(tag("inK")), "the K box must stay uncapped");
    assert.ok(!/\bmax="/.test(tag("inN")), "the n box must stay uncapped");
  });

  test("dragging the K slider drives K, the label and the number box", () => {
    setPoints(line(40));
    input("inKR", 7);
    assert.equal(app.S.k, 7);
    assert.equal(dom.el("inK").value, "7", "the box must mirror the scrub");
    assert.equal(dom.el("lblK").textContent, "7");
    assert.equal(dom.el("stCent").textContent, "0 / 7");
  });

  test("typing in the K box moves the slider", () => {
    setPoints(line(40));
    input("inK", 11);
    assert.equal(Number(dom.el("inKR").value), 11);
  });

  test("a typed K far above the track's top end is kept by the box, not capped", () => {
    setPoints(line(300)); app.sync();
    input("inK", 720);
    assert.equal(app.S.k, 720);
    assert.equal(dom.el("inK").value, "720", "the box is the uncapped half of the pair");
    assert.equal(Number(dom.el("inKR").max), 300, "the slider half still stops at N (feedback 5)");
  });

  test("the track depends only on N, so nothing can rescale it under the thumb mid-drag", () => {
    setPoints(line(300)); app.sync();
    input("inK", 90);
    const top = Number(dom.el("inKR").max);
    assert.equal(top, 300);
    input("inK", 4);
    assert.equal(Number(dom.el("inKR").max), top, "typing must not move the track");
    assert.equal(Number(dom.el("inKR").value), 4);
    input("inKR", 7);
    assert.equal(Number(dom.el("inKR").max), top, "scrubbing must not move it either");
  });

  test("dragging the n slider drives n, and generate honours it", () => {
    input("inNR", 42);
    assert.equal(dom.el("inN").value, "42");
    assert.equal(dom.el("lblN").textContent, "42");
    app.generate();
    assert.ok(Math.abs(app.S.points.length - 42) <= 6, `got ${app.S.points.length}`);
  });

  test("the n slider stretches to a typed n far past its default top", () => {
    input("inN", app.NSLIDE * 3);
    assert.equal(dom.el("inN").value, String(app.NSLIDE * 3), "the typed n must survive untouched");
    assert.ok(Number(dom.el("inNR").max) >= app.NSLIDE * 3);
  });

  test("scrubbing K down trims the extra centroids, exactly like typing does", () => {
    setPoints(line(40));
    input("inK", 6);
    app.doInit();
    assert.equal(app.S.centroids.length, 6);
    input("inKR", 2);
    assert.equal(app.S.k, 2);
    assert.equal(app.S.centroids.length, 2, "scrubbing must take the same code path as typing");
  });

  test("the far end of the K track is the largest legal K, never an infeasible one", () => {
    setPoints(line(5)); app.sync();
    assert.equal(Number(dom.el("inKR").max), 5, "the track stops at N");
    input("inKR", 5);
    assert.equal(app.S.k, 5);
    assert.equal(app.kFeasible(), true, "dragging to the very end still gives a runnable K");
    assert.match(dom.el("kNote").textContent, /K = N/);
  });
});


/* ---------------------------------------------------------------------------
   Feedback 5: "K value and data point don't relate along theory" —
     * K ≤ N (data points)
     * the n value and the "generate random data" button should live closely
   --------------------------------------------------------------------------- */
describe("Feedback 5: K and the data points relate the way the theory says", () => {
  beforeEach(() => { seed(7); reset(); });

  test("split() hands out exactly the total it was given", () => {
    for(const n of [0, 1, 2, 3, 7, 100, 150, 9999])
      for(const w of [[1, 1, 1], [0.08, 0.25, 0.67], [1, 1], [1]])
        assert.equal(app.split(n, w).reduce((a, b) => a + b, 0), n, `split(${n}, ${w})`);
  });

  test("every preset generates EXACTLY n points, not roughly n", () => {
    input("inK", 1);                                   // K = 1 so the n ≥ K guard never blocks a tiny n
    for(const kind of ["blobs", "sizes", "density", "rings", "outliers"]){
      dom.el("inData").value = kind;
      for(const n of [1, 2, 3, 5, 9, 17, 100, 150, 777]){
        input("inN", n);
        app.generate();
        assert.equal(app.S.points.length, n, `${kind} asked for ${n}`);
      }
    }
  });

  test("an exact n means the K ≤ N rule answers for the number the user actually typed", () => {
    dom.el("inData").value = "blobs";
    input("inN", 5);
    app.generate();
    input("inK", 5);
    assert.equal(app.S.points.length, 5);
    assert.equal(app.kFeasible(), true, "K = n = N must be runnable, not a rounding lottery");
    assert.match(dom.el("kNote").textContent, /K = N/);
  });

  test("the K slider's top end is N — scrubbing cannot reach an infeasible K", () => {
    setPoints(line(40)); app.sync();
    assert.equal(Number(dom.el("inKR").max), 40, "the track must stop at the data-point count");
    input("inKR", 40);
    assert.equal(app.S.k, 40);
    assert.equal(app.kFeasible(), true, "the far end of the track is still legal");
  });

  test("the slider top follows N as the data changes", () => {
    setPoints(line(12)); app.sync();
    assert.equal(Number(dom.el("inKR").max), 12);
    setPoints(line(90)); app.sync();
    assert.equal(Number(dom.el("inKR").max), 90);
  });

  test("typing a K above N still sticks and is flagged (feedback 3 is not regressed)", () => {
    setPoints(line(20)); app.sync();
    input("inK", 57);
    assert.equal(app.S.k, 57, "a typed K must never be clamped to N");
    assert.equal(dom.el("inK").value, "57", "the box keeps the truth");
    assert.match(dom.el("kNote").textContent, /K > distinct positions/);
    assert.equal(app.kFeasible(), false);
    assert.equal(Number(dom.el("inKR").max), 20, "but the track still refuses to go past N");
    assert.equal(Number(dom.el("inKR").value), 20, "the thumb pins at the top rather than reading past N");
  });

  test("scrubbing never moves the track, so it cannot rescale under the thumb mid-drag", () => {
    setPoints(line(20)); app.sync();
    input("inK", 57);
    const top = Number(dom.el("inKR").max);
    input("inKR", 4);
    assert.equal(app.S.k, 4);
    assert.equal(Number(dom.el("inKR").max), top, "a scrub must leave the range alone");
  });

  test("the track is exactly N throughout — before, during and after a typed overshoot", () => {
    setPoints(line(20)); app.sync();
    assert.equal(Number(dom.el("inKR").max), 20);
    input("inK", 57);
    assert.equal(Number(dom.el("inKR").max), 20);
    input("inK", 4);
    assert.equal(Number(dom.el("inKR").max), 20);
  });

  test("the feedback-5 examples hold literally: N = 999 → drag to 999, N = 696 → drag to 696", () => {
    for(const N of [999, 696]){
      setPoints(line(N)); app.sync();
      assert.equal(Number(dom.el("inKR").max), N, `with ${N} data points the track must stop at ${N}`);
      input("inKR", N);
      assert.equal(app.S.k, N, "the very end of the track is reachable");
      assert.equal(app.kFeasible(), true, "and it is a legal K");
    }
  });

  test("with no data at all the K slider is still usable", () => {
    app.S.points = [];
    app.sync();
    assert.ok(Number(dom.el("inKR").max) >= 2, "an empty canvas must not leave a dead control");
  });

  test("the n control says up front whether n will support the current K", () => {
    setPoints(line(30));
    input("inK", 6);
    input("inN", 3);
    assert.match(dom.el("nNote").textContent, /^Need n ≥ K — n = 3 is less than K = 6\./,
      "the line must lead with the rule that has to hold, never with 'n < K'");
    assert.ok(dom.el("inN").classList.contains("bad"));
    input("inN", 300);
    assert.match(dom.el("nNote").textContent, /n ≥ K ✓/);
    assert.match(dom.el("nNote").textContent, /exactly 300/);
    assert.ok(!dom.el("inN").classList.contains("bad"));
  });

  test("the generate button lives with the n control it reads, not off in the button row", () => {
    const iN = html.indexOf('id="inNR"'), iB = html.indexOf('id="bGen"'), iNote = html.indexOf('id="nNote"');
    assert.ok(iN > 0 && iB > 0 && iNote > 0);
    assert.ok(iB > iN && iB < iNote,
      "bGen must sit inside the Random points (n) group, between the slider and its note");
  });
});


/* ---------------------------------------------------------------------------
   Feedback 6 — "แก้เงื่อนไข n / K และความทนทานของ k-means", tasks 1-5 and 7.
   Rules:  1 ≤ K ≤ distinct(N)   and   n ≥ K
   --------------------------------------------------------------------------- */
describe("Feedback 6: the n / K conditions", () => {
  beforeEach(() => { seed(7); reset(); });

  /** commit a box the way blur / Enter does, rather than per keystroke */
  const commit = (id, v) => { dom.el(id).value = v; return dom.el(id).fire("change"); };

  /* ---- Task 1: the warning must lead with the rule that has to hold ---- */
  test("Task 1 — the n warning reads 'Need n ≥ K', never 'n < K'", () => {
    setPoints(line(2000)); app.sync();
    input("inK", 1672);
    input("inN", 1564);
    const note = dom.el("nNote").textContent;
    assert.equal(note, "Need n ≥ K — n = 1564 is less than K = 1672. Increase n or lower K.");
    assert.ok(!/^n < K/.test(note), "must not open with the misreadable form");
  });

  test("Task 1/4 — New random data is disabled while n < K", () => {
    setPoints(line(2000)); app.sync();
    input("inK", 1672);
    input("inN", 1564);
    assert.equal(dom.el("bGen").disabled, true, "the button must be off, not merely warned about");
    input("inN", 1672);
    assert.equal(dom.el("bGen").disabled, false);
  });

  test("Task 4 — generate() itself refuses n < K even if the button were reachable", () => {
    setPoints(line(2000)); app.sync();
    input("inK", 40);
    dom.el("inN").value = 10;                        // straight past the clamp, as a stuck state would be
    const before = app.S.points.length;
    app.generate();
    assert.equal(app.S.points.length, before, "no data may be generated");
    assert.match(msg(), /Need n ≥ K/);
  });

  /* ---- Task 2: the n track must always reach the K track ---- */
  test("Task 2 — the n slider's top end is never below the K slider's", () => {
    for(const N of [150, 1936]){
      setPoints(line(N)); app.sync();
      assert.ok(Number(dom.el("inNR").max) >= Number(dom.el("inKR").max),
        `n max ${dom.el("inNR").max} < K max ${dom.el("inKR").max} at N = ${N}`);
    }
  });

  test("Task 2 — dragging n to its far end always reaches at least K", () => {
    setPoints(line(2000)); app.sync();
    input("inK", 1672);
    assert.ok(Number(dom.el("inNR").max) >= 1672, "otherwise the user cannot drag out of n < K");
  });

  /* ---- Task 3: K and n are clamped to each other ---- */
  test("Task 3 — raising K past n drags n up with it", () => {
    setPoints(line(2000)); app.sync();
    input("inN", 100);
    input("inKR", 400);                              // scrubbing commits on every step
    assert.equal(app.readInt("inN", 0), 400, "n must follow K up");
    assert.equal(app.S.k, 400);
  });

  test("Task 3 — lowering n below K drags K down with it", () => {
    setPoints(line(2000)); app.sync();
    input("inK", 400);
    input("inNR", 60);
    assert.equal(app.S.k, 60, "K must follow n down");
    assert.equal(dom.el("inK").value, "60", "and the K box must show it");
  });

  test("Task 3 — the boxes clamp on commit, never mid-keystroke", () => {
    setPoints(line(2000)); app.sync();
    input("inN", 100);
    input("inK", 4);
    input("inK", 40);                                // typing "40" one keystroke at a time
    assert.equal(app.readInt("inN", 0), 100, "typing must not be fought by the clamp");
    commit("inK", 400);
    assert.equal(app.readInt("inN", 0), 400, "…but committing settles it");
  });

  test("Task 3 — committing a small n pulls K down to match", () => {
    setPoints(line(2000)); app.sync();
    input("inK", 300);
    commit("inN", 25);
    assert.equal(app.S.k, 25);
  });

  test("Task 3 — n = K exactly is runnable and fills every cluster", () => {
    input("inK", 6);
    input("inN", 6);
    app.generate();
    assert.equal(app.S.points.length, 6);
    assert.equal(app.kFeasible(), true);
    app.doInit();
    app.doAssign();
    const counts = new Array(6).fill(0);
    for(const p of app.S.points) counts[p.c]++;
    assert.ok(counts.every(c => c >= 1), `every cluster needs a point: ${counts}`);
  });

  /* ---- Task 5: distinct positions are the cap ---- */
  test("Task 5 — the K track stops at the distinct count, not the raw point count", () => {
    setPoints(Array.from({ length: 30 }, () => ({ x: 40, y: 40, c: -1 })).concat(line(5)));
    app.sync();
    assert.equal(app.S.points.length, 35);
    assert.equal(app.kCap(), 6, "5 on the line + 1 repeated coordinate");
    assert.equal(Number(dom.el("inKR").max), 6, "the slider must stop at distinct, not 35");
  });

  test("Task 5 — the K note spells out both counts when they differ", () => {
    setPoints(Array.from({ length: 30 }, () => ({ x: 40, y: 40, c: -1 })).concat(line(5)));
    input("inK", 3); app.sync();
    assert.match(dom.el("kNote").textContent, /N = 35, distinct = 6/);
    setPoints(line(20)); app.sync();
    assert.match(dom.el("kNote").textContent, /N = 20/);
    assert.ok(!/distinct/.test(dom.el("kNote").textContent), "no noise when they agree");
  });

  test("Task 5 — the distinct count is memoised but never goes stale", () => {
    setPoints(line(10)); app.sync();
    assert.equal(app.kCap(), 10);
    app.S.points.push({ x: 999, y: 999, c: -1 });      // push: same array, new length
    assert.equal(app.kCap(), 11, "a push must invalidate the cache");
    app.S.points = app.S.points.filter(p => p.x !== 999);   // filter: new array
    assert.equal(app.kCap(), 10, "a replacement array must invalidate it too");
  });

  /* ---- Task 7: possible vs meaningful ---- */
  test("Task 7 — K = N is flagged amber as meaningless, but still runs", () => {
    setPoints(line(12));
    input("inK", 12); app.sync();
    assert.match(dom.el("kNote").textContent, /every point is its own cluster/);
    assert.ok(dom.el("kNote").classList.contains("caution"));
    assert.ok(!dom.el("kNote").classList.contains("warn"), "amber, not red");
    assert.ok(!dom.el("inK").classList.contains("bad"));
    assert.equal(app.kFeasible(), true, "it must still be runnable");
    assert.equal(dom.el("bInit").disabled, false);
  });

  test("Task 7 — fewer than 2 points per cluster is amber", () => {
    setPoints(line(100));
    input("inK", 60); app.sync();
    assert.match(dom.el("kNote").textContent, /only 1\.7 points per cluster/);
    assert.ok(dom.el("kNote").classList.contains("caution"));
    assert.equal(dom.el("bInit").disabled, false);
  });

  test("Task 7 — a K above 2√N is a soft grey hint", () => {
    setPoints(line(1936));
    input("inK", 120); app.sync();                     // 2√1936 = 88
    assert.match(dom.el("kNote").textContent, /higher than typical/);
    assert.ok(dom.el("kNote").classList.contains("hint"));
    assert.ok(!dom.el("kNote").classList.contains("warn"));
  });

  test("Task 7 — an ordinary K says nothing but the green tick", () => {
    setPoints(line(1936));
    input("inK", 10); app.sync();
    assert.match(dom.el("kNote").textContent, /^K ≤ N ✓/);
    assert.equal(dom.el("kNote").className, "note", "no colour class at all");
  });

  test("Task 7 — kQualityHint covers its four bands directly", () => {
    assert.deepEqual(app.kQualityHint(10, 1936), ["", ""]);
    assert.equal(app.kQualityHint(1936, 1936)[0], "caution");
    assert.equal(app.kQualityHint(1200, 1936)[0], "caution");
    assert.equal(app.kQualityHint(120, 1936)[0], "hint");
  });
});
