/* Cluster Status Click-to-Focus — Memory/cluster_focus_feature.md
   Clicking a cluster on the status bar flies the canvas to that cluster's points and dims the
   rest; clicking it again flies back out. */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { app, dom, reset, seed, unseed, setPoints, setCentroids, pt, msg } from "./helpers.mjs";

after(() => unseed());
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/** three tight, well separated clusters, already assigned */
function threeClusters(){
  setPoints([
    pt(10, 10, 0), pt(12, 10, 0), pt(11, 12, 0),
    pt(80, 80, 1), pt(82, 80, 1), pt(81, 82, 1),
    pt(50, 20, 2), pt(52, 20, 2),
  ]);
  setCentroids([{ x: 11, y: 10.7 }, { x: 81, y: 80.7 }, { x: 51, y: 20 }]);
  app.S.k = 3;
  app.sync();
}
/** run the tween to completion */
function settle(){
  /* FOCUSMS/40 frames is all the tween needs; do not over-advance the stub clock — node:test
     reads the same globalThis.performance when it runs a single file in-process. */
  for(let i = 0; i < 20 && dom.rafPending(); i++){ dom.advance(40); dom.flushRaf(); }
}

describe("focus geometry", () => {
  beforeEach(() => { seed(5); reset(); });

  test("clusterBox is the bounding box of just that cluster, with its count", () => {
    threeClusters();
    const b = app.clusterBox(0);
    assert.deepEqual({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY, n: b.n },
      { minX: 10, maxX: 12, minY: 10, maxY: 12, n: 3 });
    assert.equal(app.clusterBox(2).n, 2);
  });

  test("a cluster with no points has no box at all", () => {
    threeClusters();
    app.S.points.forEach(p => { if(p.c === 2) p.c = 0; });
    assert.equal(app.clusterBox(2), null);
  });

  test("viewFor frames the box: its centre lands in the middle of the viewport", () => {
    threeClusters();
    const b = app.clusterBox(0), v = app.viewFor(b.minX, b.maxX, b.minY, b.maxY);
    const save = { ...app.V };
    Object.assign(app.V, v);
    const mid = app.px({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
    assert.ok(Math.abs(mid.x - (app.ox + app.plotW / 2)) < 1e-6, `x ${mid.x}`);
    assert.ok(Math.abs(mid.y - (app.oy + app.plotH / 2)) < 1e-6, `y ${mid.y}`);
    Object.assign(app.V, save);
  });

  test("viewFor leaves padding — the cluster never touches the viewport edge", () => {
    threeClusters();
    const b = app.clusterBox(0), v = app.viewFor(b.minX, b.maxX, b.minY, b.maxY);
    const save = { ...app.V };
    Object.assign(app.V, v);
    for(const p of app.S.points.filter(p => p.c === 0)){
      const s = app.px(p);
      assert.ok(s.x > app.ox && s.x < app.ox + app.plotW, `x ${s.x} outside the plot`);
      assert.ok(s.y > app.oy && s.y < app.oy + app.plotH, `y ${s.y} outside the plot`);
    }
    Object.assign(app.V, save);
  });

  test("a single-point cluster does not zoom in absurdly far", () => {
    setPoints([pt(40, 40, 0), pt(10, 10, 1), pt(11, 11, 1)]);
    setCentroids([{ x: 40, y: 40 }, { x: 10.5, y: 10.5 }]);
    app.S.k = 2; app.sync();
    const b = app.clusterBox(0);
    assert.equal(b.n, 1);
    const v = app.viewFor(b.minX, b.maxX, b.minY, b.maxY, app.FOCUSPAD, app.FOCUSZMAX);
    assert.ok(v.z <= app.FOCUSZMAX + 1e-9, `zoom ran away to ${v.z}`);
  });

  test("viewFor still respects the global zoom clamps", () => {
    const v = app.viewFor(-1e6, 1e6, -1e6, 1e6);
    assert.ok(v.z >= 0.05 - 1e-9, `z = ${v.z}`);
  });
});

describe("focusing a cluster", () => {
  beforeEach(() => { seed(5); reset(); threeClusters(); });

  test("clicking a cluster focuses it and says so", () => {
    assert.equal(app.focusCluster(1), true);
    assert.equal(app.S.focus, 1);
    assert.match(msg(), /Focused on .*3 points/);
  });

  test("the focused item is marked active and the others are dimmed", () => {
    app.focusCluster(1);
    const h = dom.el("legend").innerHTML;
    const items = h.split("cluster-status-item").slice(1);
    assert.equal(items.length, 3);
    assert.ok(items[1].startsWith(" flex") || items[1].includes("active"), items[1].slice(0, 60));
    assert.match(h, /cluster-status-item flex items-center gap-1\.5 active" data-cluster="1"/);
    assert.match(h, /cluster-status-item flex items-center gap-1\.5 dimmed" data-cluster="0"/);
    assert.match(h, /cluster-status-item flex items-center gap-1\.5 dimmed" data-cluster="2"/);
  });

  test("with nothing focused no item is active or dimmed", () => {
    const h = dom.el("legend").innerHTML;
    assert.ok(!/active/.test(h) && !/dimmed/.test(h), h);
  });

  test("clicking the same cluster again zooms back out", () => {
    app.focusCluster(1);
    settle();
    assert.equal(app.focusCluster(1), true);
    assert.equal(app.S.focus, -1, "a second click must release the focus");
    const h = dom.el("legend").innerHTML;
    assert.ok(!/active/.test(h) && !/dimmed/.test(h));
  });

  test("clicking a different cluster moves the focus rather than toggling", () => {
    app.focusCluster(1);
    app.focusCluster(2);
    assert.equal(app.S.focus, 2);
  });

  test("a cluster with no points is refused, and the focus is left alone", () => {
    app.S.points.forEach(p => { if(p.c === 2) p.c = 0; });
    assert.equal(app.focusCluster(2), false);
    assert.equal(app.S.focus, -1);
    assert.match(msg(), /no points yet/);
  });

  test("an out-of-range cluster index is ignored", () => {
    assert.equal(app.focusCluster(9), false);
    assert.equal(app.focusCluster(-1), false);
    assert.equal(app.S.focus, -1);
  });

  test("the status items advertise themselves as clickable buttons", () => {
    const h = dom.el("legend").innerHTML;
    assert.match(h, /role="button"/);
    assert.match(h, /tabindex="0"/);
    assert.match(h, /data-cluster="0"/);
    assert.match(h, /--cc:#/, "the underline colour comes from the cluster colour");
  });

  test("the stylesheet carries the hover, active and dimmed states", () => {
    assert.match(html, /\.cluster-status-item\{[^}]*cursor:pointer/);
    assert.match(html, /\.cluster-status-item:hover\{[^}]*transform:scale/);
    assert.match(html, /\.cluster-status-item\.active\{[^}]*border-bottom-color/);
    assert.match(html, /\.cluster-status-item\.dimmed\{[^}]*opacity:\.4/);
  });

  test("the click is delegated, so it survives the legend being re-rendered", () => {
    assert.match(html, /\$\("legend"\)\.addEventListener\("click"/);
    assert.match(html, /closest\(".cluster-status-item"\)/);
  });
});

describe("the focus fly-through", () => {
  beforeEach(() => { seed(5); reset(); threeClusters(); });

  test("the view really travels, and lands on the framing view", () => {
    const before = { ...app.V };
    app.focusCluster(1);
    const b = app.clusterBox(1);
    const want = app.viewFor(b.minX, b.maxX, b.minY, b.maxY, app.FOCUSPAD, app.FOCUSZMAX);
    settle();
    assert.notDeepEqual({ z: app.V.z, px: app.V.px, py: app.V.py }, { z: before.z, px: before.px, py: before.py });
    for(const k of ["z", "px", "py"])
      assert.ok(Math.abs(app.V[k] - want[k]) < 1e-6, `${k}: ${app.V[k]} should reach ${want[k]}`);
  });

  test("it eases rather than jumping — partway through it is partway there", () => {
    const from = { ...app.V };
    app.focusCluster(1);
    const b = app.clusterBox(1);
    const want = app.viewFor(b.minX, b.maxX, b.minY, b.maxY, app.FOCUSPAD, app.FOCUSZMAX);
    dom.advance(app.FOCUSMS / 2); dom.flushRaf();
    const mid = app.V.z;
    assert.ok(Math.abs(mid - from.z) > 1e-9, "it must have moved");
    assert.ok(Math.abs(mid - want.z) > 1e-9, "but not arrived at the halfway mark");
  });

  test("the zoom label keeps up during the flight", () => {
    app.focusCluster(1);
    settle();
    assert.equal(dom.el("lblZoom").textContent, Math.round(app.V.z * 100) + "%");
  });

  test("retargeting mid-flight abandons the first tween instead of fighting it", () => {
    app.focusCluster(1);
    dom.advance(100); dom.flushRaf();            // in the air, heading for cluster 1
    app.focusCluster(2);                      // change our mind
    settle();
    const b = app.clusterBox(2);
    const want = app.viewFor(b.minX, b.maxX, b.minY, b.maxY, app.FOCUSPAD, app.FOCUSZMAX);
    assert.equal(app.S.focus, 2);
    for(const k of ["z", "px", "py"])
      assert.ok(Math.abs(app.V[k] - want[k]) < 1e-6, `${k}: ${app.V[k]} should reach ${want[k]}, not cluster 1`);
  });

  test("zooming back out frames everything again", () => {
    app.focusCluster(1); settle();
    app.focusCluster(1); settle();            // second click
    const all = app.allBox();
    const want = app.viewFor(all.minX, all.maxX, all.minY, all.maxY, 0.1);
    for(const k of ["z", "px", "py"])
      assert.ok(Math.abs(app.V[k] - want[k]) < 1e-6, `${k}: ${app.V[k]} should reach ${want[k]}`);
  });
});

describe("dimming on the canvas", () => {
  beforeEach(() => { seed(5); reset(); threeClusters(); });

  test("with no focus every cluster is painted solid", () => {
    dom.ctx().__reset();
    app.render();
    const fills = dom.ctx().__calls._fills || [];
    assert.ok(fills.length >= 3);
    assert.ok(fills.every(f => f.alpha === 1), JSON.stringify(fills));
  });

  test("while focused the other clusters are painted faint and the chosen one stays solid", () => {
    app.focusCluster(1);
    dom.ctx().__reset();
    app.render();
    const want = app.colorFor(1);
    const fills = (dom.ctx().__calls._fills || []).filter(f => typeof f.style === "string" && f.style.startsWith("#"));
    const mine  = fills.filter(f => f.style === want);
    const other = fills.filter(f => f.style !== want && /^#[0-9a-f]{6}$/i.test(f.style));
    assert.ok(mine.length, "the focused cluster must still be drawn");
    assert.ok(mine.every(f => f.alpha === 1), "focused cluster must stay fully opaque");
    assert.ok(other.length, "the other clusters must still be drawn, just faded");
    assert.ok(other.some(f => f.alpha === app.DIMALPHA), JSON.stringify(other));
  });

  test("the alpha is handed back so nothing after the points is left faded", () => {
    app.focusCluster(1);
    app.render();
    assert.equal(dom.ctx().globalAlpha, 1, "a leaked globalAlpha would fade the whole canvas");
  });
});

describe("the focus never outlives what it points at", () => {
  beforeEach(() => { seed(5); reset(); threeClusters(); });

  test("lowering K below the focused cluster drops the focus", () => {
    app.focusCluster(2);
    assert.equal(app.S.focus, 2);
    app.trimCentroids(2);
    app.sync();
    assert.equal(app.S.focus, -1, "cluster 2 no longer exists");
  });

  test("deleting the focused centroid drops the focus", () => {
    app.focusCluster(2);
    app.deleteCentroid(2);
    assert.equal(app.S.focus, -1);
  });

  test("re-running k-means returns to the overview", () => {
    app.focusCluster(1);
    app.doInit();
    assert.equal(app.S.focus, -1, "a fresh Initialize must reset the focus");
  });

  test("clearing the data drops the focus", () => {
    app.focusCluster(1);
    app.hardReset();
    assert.equal(app.S.focus, -1);
  });

  test("generating new data drops the focus", () => {
    app.focusCluster(1);
    app.S.k = 1;
    dom.el("inN").value = 30;
    app.generate();
    assert.equal(app.S.focus, -1);
  });

  test("the Focus button clears a cluster focus rather than leaving it half-applied", () => {
    app.focusCluster(1);
    dom.el("bFocus").fire("click");
    assert.equal(app.S.focus, -1);
    assert.ok(!/dimmed/.test(dom.el("legend").innerHTML));
  });
});
