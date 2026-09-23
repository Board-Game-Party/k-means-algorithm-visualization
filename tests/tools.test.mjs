/* Canvas tools — feedback item 1 (brush/eraser) and item 3 (hand-editing centroids) */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { app, dom, reset, seed, unseed, setPoints, setCentroids, cScreen, pt,
         down, move, up, leave, rclick, key, input, click, msg } from "./helpers.mjs";

after(() => unseed());
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
/** Brush radius in world units at the current zoom */
const rw = () => app.brushR() / app.sc();
const toolBtn = t => dom.tools.find(b => b.dataset.tool === t);

describe("switching tools", () => {
  beforeEach(() => reset());

  test("the brush is the default tool and its button is highlighted", () => {
    assert.equal(app.S.tool, "brush");
    assert.ok(toolBtn("brush").classList.contains("on"));
    assert.ok(!toolBtn("hand").classList.contains("on"));
  });

  test("clicking a tool button switches mode and moves the highlight", () => {
    toolBtn("centroid").fire("click");
    assert.equal(app.S.tool, "centroid");
    assert.ok(toolBtn("centroid").classList.contains("on"));
    assert.ok(!toolBtn("brush").classList.contains("on"));
  });

  test("the S / B / E / H / C shortcuts cover every tool", () => {
    key("s"); assert.equal(app.S.tool, "spray");
    key("e"); assert.equal(app.S.tool, "eraser");
    key("h"); assert.equal(app.S.tool, "hand");
    key("c"); assert.equal(app.S.tool, "centroid");
    key("b"); assert.equal(app.S.tool, "brush");
  });

  test("uppercase shortcuts work too", () => {
    key("H");
    assert.equal(app.S.tool, "hand");
  });

  test("shortcuts are ignored while typing in an input", () => {
    dom.fireWindow("keydown", { key: "h", target: { tagName: "INPUT" } });
    assert.equal(app.S.tool, "brush");
    dom.fireWindow("keydown", { key: "h", target: { tagName: "SELECT" } });
    assert.equal(app.S.tool, "brush");
  });

  test("an unknown tool name is rejected", () => {
    app.setTool("laser");
    assert.equal(app.S.tool, "brush");
  });

  test("every tool has its own hint and cursor", () => {
    for(const t of ["spray", "brush", "eraser", "hand", "centroid"]){
      app.setTool(t);
      assert.equal(dom.el("toolHint").textContent, app.TOOLS[t].hint);
      assert.equal(dom.canvas().style.cursor, app.TOOLS[t].cursor);
    }
  });

  test("the brush sliders only show for painting tools", () => {
    app.setTool("brush");   assert.equal(dom.el("brushOpts").style.display, "");
    app.setTool("eraser");  assert.equal(dom.el("brushOpts").style.display, "");
    app.setTool("spray");   assert.equal(dom.el("brushOpts").style.display, "");
    app.setTool("hand");    assert.equal(dom.el("brushOpts").style.display, "none");
    app.setTool("centroid");assert.equal(dom.el("brushOpts").style.display, "none");
  });

  test("the size and flow sliders update their labels", () => {
    input("inBrush", 60);
    assert.equal(dom.el("lblBrush").textContent, "60");
    input("inDens", 9);
    assert.equal(dom.el("lblDens").textContent, "9");
  });

  test("switching tools clears the centroid selection", () => {
    setCentroids([{ x: 20, y: 20 }]);
    app.S.sel = 0;
    app.setTool("eraser");
    assert.equal(app.S.sel, -1);
  });
});

describe("brush painting", () => {
  beforeEach(() => { seed(71); reset({ dens: 1 }); });

  test("the first click lands a point exactly on the cursor", () => {
    const w = app.toLogical(400, 250);
    down(400, 250); up();
    assert.equal(app.S.points.length, 1);
    near(app.S.points[0].x, w.x, 1e-9);
    near(app.S.points[0].y, w.y, 1e-9);
  });

  test("flow n emits n points per dab", () => {
    input("inDens", 6);
    down(400, 250); up();
    assert.equal(app.S.points.length, 6);
  });

  test("every painted point stays inside the brush ring", () => {
    input("inDens", 12);
    input("inBrush", 40);
    const c = app.toLogical(400, 250);
    down(400, 250); up();
    const r = rw() + 1e-9;
    for(const p of app.S.points)
      assert.ok(Math.hypot(p.x - c.x, p.y - c.y) <= r, `point escaped the ring: ${Math.hypot(p.x - c.x, p.y - c.y)} > ${r}`);
  });

  test("a continuous drag keeps adding points", () => {
    down(200, 250);
    for(let x = 210; x <= 400; x += 20) move(x, 250);
    up();
    assert.ok(app.S.points.length > 5, `got ${app.S.points.length} points`);
  });

  test("a move below the threshold does not repaint (no stacking)", () => {
    input("inBrush", 40);
    down(400, 250);
    const n = app.S.points.length;
    move(402, 251);
    assert.equal(app.S.points.length, n);
    move(400 + 40, 250);
    assert.ok(app.S.points.length > n);
    up();
  });

  test("moving after mouse-up paints nothing", () => {
    down(300, 250); up();
    const n = app.S.points.length;
    move(500, 250); move(600, 250);
    assert.equal(app.S.points.length, n);
  });

  test("painting outside the visible frame still adds points — the canvas is infinite", () => {
    input("inBrush", 8);
    const n = app.S.points.length;
    down(2, 2); up();                       // the top-left corner is outside the plot frame
    assert.ok(app.S.points.length > n);
  });

  test("drawing never stops — there is no point cap (feedback 2)", () => {
    setPoints(Array.from({ length: 12000 }, () => pt(50, 50)));
    const n = app.S.points.length;
    down(400, 250); up();
    assert.ok(app.S.points.length > n, `had ${n} points and could not draw further`);
  });

  test("painting while centroids exist sends the phase back to assign", () => {
    setCentroids([{ x: 30, y: 30 }, { x: 90, y: 60 }]);
    app.S.phase = "done";
    down(400, 250); up();
    assert.equal(app.S.phase, "assign");
  });

  test("the data-point counter updates immediately", () => {
    input("inDens", 4);
    down(400, 250); up();
    assert.equal(dom.el("stN").textContent, String(app.S.points.length));
  });

  test("zooming in narrows the world area the ring covers", () => {
    const wide = rw();
    app.zoomAt(400, 250, 4);
    assert.ok(rw() < wide / 3, `${rw()} should be smaller than ${wide / 3}`);
  });
});

describe("eraser", () => {
  beforeEach(() => { seed(81); reset({ tool: "eraser", brush: 30 }); });

  test("erases only points inside the ring and never touches the rest (Rev 2 acceptance)", () => {
    const c = app.toLogical(400, 250), r = rw();
    setPoints([
      pt(c.x, c.y),                    // inside
      pt(c.x + r * 0.5, c.y),          // inside
      pt(c.x + r * 2.0, c.y),          // outside
      pt(c.x, c.y + r * 3.0)           // outside
    ]);
    down(400, 250); up();
    assert.equal(app.S.points.length, 2);
    for(const p of app.S.points) assert.ok(Math.hypot(p.x - c.x, p.y - c.y) > r);
  });

  test("a point exactly on the rim survives (strictly-greater test)", () => {
    const c = app.toLogical(400, 250);
    setPoints([pt(c.x + rw(), c.y)]);
    down(400, 250); up();
    assert.equal(app.S.points.length, 1);
  });

  test("dragging the eraser clears a long path", () => {
    seed(82);
    setPoints(Array.from({ length: 120 }, (_, i) => pt(10 + i, 50)));
    const n = app.S.points.length;
    down(200, 250);
    for(let x = 220; x <= 600; x += 20) move(x, 250);
    up();
    assert.ok(app.S.points.length < n, `nothing was erased (${n} → ${app.S.points.length})`);
  });

  test("erasing empty space changes nothing", () => {
    setPoints([pt(5, 5)]);
    down(700, 100); up();
    assert.equal(app.S.points.length, 1);
  });

  test("erasing sends the phase back to assign when centroids exist", () => {
    const c = app.toLogical(400, 250);
    setPoints([pt(c.x, c.y)]);
    setCentroids([{ x: 10, y: 10 }]);
    app.S.phase = "done";
    down(400, 250); up();
    assert.equal(app.S.phase, "assign");
  });

  test("the erase radius follows the zoom level", () => {
    const c0 = app.toLogical(400, 250);
    setPoints([pt(c0.x + rw() * 0.8, c0.y)]);
    app.zoomAt(400, 250, 6);                     // zooming in shrinks the world-space radius a lot
    const c1 = app.toLogical(400, 250);
    assert.ok(Math.hypot(app.S.points[0].x - c1.x, app.S.points[0].y - c1.y) > rw());
    down(400, 250); up();
    assert.equal(app.S.points.length, 1, "after zooming in, a far point must no longer be erased");
  });
});

describe("centroids: place / move / delete", () => {
  beforeEach(() => { seed(91); reset({ tool: "centroid" }); setPoints([pt(20, 20), pt(25, 25), pt(120, 70), pt(125, 75)]); });

  test("clicking empty space places a centroid at the cursor", () => {
    const w = app.toLogical(400, 250);
    down(400, 250); up();
    assert.equal(app.S.centroids.length, 1);
    near(app.S.centroids[0].x, w.x, 1e-9);
    near(app.S.centroids[0].y, w.y, 1e-9);
    assert.equal(app.S.centroids[0].ax, app.S.centroids[0].x);
  });

  test("placement stops at K and warns the user (Rev 2 acceptance)", () => {
    for(const x of [200, 300, 400, 500, 600]){ down(x, 250); up(); }
    assert.equal(app.S.centroids.length, 3, "K = 3, so only three fit");
    assert.match(msg(), /At most K = 3 centroids/);
  });

  test("raising K allows more without wiping the existing ones", () => {
    for(const x of [200, 300, 400]){ down(x, 250); up(); }
    input("inK", 5);
    assert.equal(app.S.centroids.length, 3, "raising K must not clear existing centroids");
    down(500, 250); up();
    assert.equal(app.S.centroids.length, 4);
  });

  test("lowering K trims the extra centroids", () => {
    input("inK", 4);
    for(const x of [200, 300, 400, 500]){ down(x, 250); up(); }
    assert.equal(app.S.centroids.length, 4);
    input("inK", 2);
    assert.equal(app.S.centroids.length, 2);
    assert.match(msg(), /K lowered to 2/);
  });

  test("after lowering K, points of the removed clusters become unassigned", () => {
    input("inK", 4);
    for(const x of [200, 300, 400, 500]){ down(x, 250); up(); }
    app.assignAll(app.S.points, app.S.centroids);
    input("inK", 1);
    assert.equal(app.S.centroids.length, 1);
    assert.ok(app.S.points.every(p => p.c === 0 || p.c === -1));
  });

  test("the centroids m / k counter tracks reality", () => {
    assert.equal(dom.el("stCent").textContent, "0 / 3");
    down(300, 250); up();
    assert.equal(dom.el("stCent").textContent, "1 / 3");
    input("inK", 6);
    assert.equal(dom.el("stCent").textContent, "1 / 6");
  });

  test("a centroid can be placed outside the visible frame — the canvas is infinite", () => {
    down(3, 3); up();
    assert.equal(app.S.centroids.length, 1);
  });

  test("placing a centroid reassigns the points straight away", () => {
    down(300, 250); up();
    assert.ok(app.S.points.every(p => p.c === 0));
    assert.ok(app.S.sse > 0);
  });

  test("dragging really moves a centroid", () => {
    down(300, 250); up();
    const s = cScreen(0);
    down(s.x, s.y);
    move(s.x + 120, s.y - 60);
    up();
    const w = app.toLogical(s.x + 120, s.y - 60);
    near(app.S.centroids[0].x, w.x, 1e-6);
    near(app.S.centroids[0].y, w.y, 1e-6);
  });

  test("releasing after a drag reassigns from the dropped position (Rev 2 acceptance)", () => {
    setCentroids([{ x: 20, y: 20 }, { x: 120, y: 70 }]);
    app.assignAll(app.S.points, app.S.centroids);
    const s = cScreen(0);
    const target = app.px({ x: 124, y: 74 });             // drag centroid 0 onto the right-hand cluster
    down(s.x, s.y); move(target.x, target.y); up();
    for(const p of app.S.points){
      const ds = app.S.centroids.map(c => app.d2(p, c));
      assert.equal(p.c, ds.indexOf(Math.min(...ds)), "must reassign from where it was dropped");
    }
    assert.match(msg(), /Moved .* by hand/);
  });

  test("dragging a centroid restarts the iteration count and clears the SSE history", async () => {
    app.generate(); app.doInit();
    await app.doAssign(); await app.doUpdate();
    assert.ok(app.S.history.length >= 2 && app.S.iter > 0);
    const s = cScreen(0);
    down(s.x, s.y); move(s.x + 60, s.y + 30); up();
    assert.equal(app.S.iter, 0);
    assert.deepEqual(app.S.history, []);
    assert.equal(app.S.phase, "assign");
    assert.deepEqual(app.S.centroids[0].trail, [{ x: app.S.centroids[0].x, y: app.S.centroids[0].y }]);
  });

  test("dragging a centroid far off screen is not clamped back", () => {
    down(300, 250); up();
    const s = cScreen(0);
    down(s.x, s.y); move(s.x + 5000, s.y + 5000); up();
    const c = app.S.centroids[0];
    assert.ok(c.x > app.LX, `x was clamped back to ${c.x}`);
    assert.ok(c.y < 0, `y was clamped back to ${c.y}`);
  });

  test("a plain click selects a centroid instead of moving it", () => {
    down(300, 250); up();
    const s = cScreen(0), before = { ...app.S.centroids[0] };
    down(s.x, s.y); up();
    assert.equal(app.S.sel, 0);
    assert.equal(app.S.centroids[0].x, before.x);
    assert.match(msg(), /drag to move it/);
  });

  test("hovering a centroid switches the cursor to a grab hand", () => {
    down(300, 250); up();
    const s = cScreen(0);
    move(s.x, s.y);
    assert.equal(app.hoverC, 0);
    assert.equal(dom.canvas().style.cursor, "grab");
    move(s.x + 200, s.y);
    assert.equal(app.hoverC, -1);
  });

  test("right-clicking a centroid deletes it", () => {
    down(300, 250); up();
    const s = cScreen(0);
    const e = rclick(s.x, s.y);
    assert.equal(app.S.centroids.length, 0);
    assert.equal(e.defaultPrevented, true);
    assert.match(msg(), /Centroid deleted/);
  });

  test("right-clicking empty space deletes nothing but explains the gesture", () => {
    down(300, 250); up();
    rclick(700, 400);
    assert.equal(app.S.centroids.length, 1);
    assert.match(msg(), /Right-click a centroid/);
  });

  test("the Delete key removes the selected centroid", () => {
    down(300, 250); up();
    const s = cScreen(0);
    down(s.x, s.y); up();                    // select it
    key("Delete");
    assert.equal(app.S.centroids.length, 0);
  });

  test("Backspace deletes it as well", () => {
    down(300, 250); up();
    const s = cScreen(0);
    down(s.x, s.y); up();
    key("Backspace");
    assert.equal(app.S.centroids.length, 0);
  });

  test("pressing Delete with nothing selected asks you to select first", () => {
    down(300, 250); up();
    app.S.sel = -1;
    key("Delete");
    assert.equal(app.S.centroids.length, 1);
    assert.match(msg(), /Select a centroid first/);
  });

  test("deleting a middle centroid reindexes the point labels correctly", () => {
    setCentroids([{ x: 10, y: 10 }, { x: 80, y: 50 }, { x: 150, y: 90 }]);
    setPoints([pt(10, 10), pt(80, 50), pt(150, 90)]);
    app.assignAll(app.S.points, app.S.centroids);
    assert.deepEqual(app.S.points.map(p => p.c), [0, 1, 2]);
    app.S.k = 3;
    app.deleteCentroid(1);
    assert.equal(app.S.centroids.length, 2);
    for(const p of app.S.points){
      const ds = app.S.centroids.map(c => app.d2(p, c));
      assert.equal(p.c, ds.indexOf(Math.min(...ds)));
    }
    assert.ok(app.S.points.every(p => p.c < app.S.centroids.length));
  });

  test("with one centroid deleted, m < k and the algorithm still runs (Rev 2 acceptance)", async () => {
    app.generate(); app.doInit();
    app.deleteCentroid(0);
    assert.equal(app.S.centroids.length, 2);
    assert.ok(app.S.centroids.length < app.S.k);
    for(let i = 0; i < 40 && app.S.phase !== "done"; i++) await app.nextStep();
    assert.equal(app.S.phase, "done");
    assert.equal(app.S.centroids.length, 2);
    const h = app.S.history;
    for(let i = 1; i < h.length; i++) assert.ok(h[i] <= h[i - 1] + 1e-9);
  });

  test("deleting the last centroid returns to the not-started state", () => {
    down(300, 250); up();
    app.deleteCentroid(0);
    assert.equal(app.S.centroids.length, 0);
    assert.equal(app.S.sse, null);
    assert.ok(app.S.points.every(p => p.c === -1));
    assert.equal(app.currentPhaseKey(), "ready");
  });

  test("deleteCentroid with an out-of-range index does nothing", () => {
    down(300, 250); up();
    assert.equal(app.deleteCentroid(5), false);
    assert.equal(app.deleteCentroid(-1), false);
    assert.equal(app.S.centroids.length, 1);
  });

  test("Initialize still resamples a full set of K, even after manual placement", () => {
    down(300, 250); up();
    app.generate();
    app.doInit();
    assert.equal(app.S.centroids.length, 3);
  });

  test("changing K with no centroids performs the plain reset", () => {
    app.generate();
    input("inK", 5);
    assert.equal(app.S.k, 5);
    assert.equal(app.S.centroids.length, 0);
    assert.equal(dom.el("lblK").textContent, "5");
  });
});

describe("editing is locked while the algorithm runs", () => {
  beforeEach(() => { seed(95); reset(); app.generate(); app.doInit(); });

  test("the brush is inert while running and says why (never silent)", () => {
    app.S.running = true;
    const n = app.S.points.length;
    down(400, 250); up();
    assert.equal(app.S.points.length, n);
    assert.match(msg(), /The algorithm is running/);
    app.S.running = false;
  });

  test("the eraser is inert during an animation", () => {
    app.setTool("eraser");
    app.S.animating = true;
    const n = app.S.points.length;
    down(400, 250); up();
    assert.equal(app.S.points.length, n);
    app.S.animating = false;
  });

  test("centroids cannot be added or deleted mid-run", () => {
    app.setTool("centroid");
    app.S.running = true;
    const n = app.S.centroids.length;
    down(700, 400); up();
    assert.equal(app.S.centroids.length, n);
    rclick(cScreen(0).x, cScreen(0).y);
    assert.equal(app.S.centroids.length, n);
    key("Delete");
    assert.equal(app.S.centroids.length, n);
    assert.match(msg(), /The algorithm is running/);
    app.S.running = false;
  });

  test("tool buttons are disabled mid-run, except the hand", () => {
    app.S.running = true;
    app.sync();
    assert.equal(toolBtn("brush").disabled, true);
    assert.equal(toolBtn("eraser").disabled, true);
    assert.equal(toolBtn("centroid").disabled, true);
    assert.equal(toolBtn("hand").disabled, false, "panning must remain available");
    app.S.running = false;
    app.sync();
    assert.equal(toolBtn("brush").disabled, false);
  });

  test("the main control buttons are disabled mid-run", () => {
    app.S.running = true;
    app.sync();
    assert.equal(dom.el("bGen").disabled, true);
    assert.equal(dom.el("bClr").disabled, true);
    assert.equal(dom.el("bInit").disabled, true);
    assert.equal(dom.el("bStep").disabled, true);
    app.S.running = false;
    app.sync();
    assert.equal(dom.el("bGen").disabled, false);
  });
});

describe("pointer state", () => {
  beforeEach(() => reset());

  test("the ring disappears when the pointer leaves the canvas", () => {
    move(400, 250);
    assert.ok(app.hoverPt);
    leave();
    assert.equal(app.hoverPt, null);
  });

  test("leaving the canvas mid-drag keeps the stroke state", () => {
    down(400, 250);
    leave();
    assert.ok(app.hoverPt, "the position must still be remembered mid-drag");
    up();
  });

  test("mouse-up always clears the active mode", () => {
    app.setTool("hand");
    down(400, 250);
    assert.equal(app.mode, "pan");
    up();
    assert.equal(app.mode, null);
  });

  test("a right-click never starts a paint mode", () => {
    down(400, 250, { button: 2 });
    assert.equal(app.mode, null);
    assert.equal(app.S.points.length, 0);
  });
});
