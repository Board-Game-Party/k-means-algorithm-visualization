/* View: coordinate transform, zoom and pan — feedback item 2 (panning hand, zoom) */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { app, dom, reset, setPoints, pt, down, move, up, wheel, key, keyup, click, msg } from "./helpers.mjs";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b} (off by ${Math.abs(a - b)})`);

describe("world ↔ screen transform", () => {
  beforeEach(() => reset());

  test("px/toLogical round-trips at 100% zoom", () => {
    const w = { x: 42.5, y: 17.25 };
    const back = app.toLogical(app.px(w).x, app.px(w).y);
    near(back.x, w.x); near(back.y, w.y);
  });

  test("px/toLogical still round-trips after zooming and panning", () => {
    app.zoomAt(300, 200, 2.5);
    app.V.px += 37; app.V.py -= 21; app.markView();
    for(const w of [{ x: 0, y: 0 }, { x: 10, y: 90 }, { x: 80.5, y: 33.3 }]){
      const s = app.px(w), back = app.toLogical(s.x, s.y);
      near(back.x, w.x, 1e-9); near(back.y, w.y, 1e-9);
    }
  });

  test("the y axis points up: a larger y is higher on screen", () => {
    assert.ok(app.px({ x: 0, y: 90 }).y < app.px({ x: 0, y: 10 }).y);
  });

  test("the origin sits at the bottom-left of the data frame", () => {
    const o = app.px({ x: 0, y: 0 });
    near(o.x, app.ox); near(o.y, app.oy + app.plotH);
  });

  test("sc() = unit × zoom", () => {
    near(app.sc(), app.unit);
    app.zoomAt(100, 100, 2);
    near(app.sc(), app.unit * app.V.z);
  });

  test("d2 is the squared distance", () => {
    assert.equal(app.d2({ x: 0, y: 0 }, { x: 3, y: 4 }), 25);
    assert.equal(app.d2({ x: 2, y: 2 }, { x: 2, y: 2 }), 0);
  });

  test("the canvas is infinite: the transform is valid arbitrarily far outside the frame", () => {
    for(const w of [{ x: -5000, y: -5000 }, { x: app.LX + 5000, y: app.LY + 5000 }]){
      const back = app.toLogical(app.px(w).x, app.px(w).y);
      near(back.x, w.x, 1e-6); near(back.y, w.y, 1e-6);
    }
  });
});

describe("zoom", () => {
  beforeEach(() => reset());

  test("zoomAt pins the point under the cursor", () => {
    const mx = 420, my = 260;
    const before = app.toLogical(mx, my);
    app.zoomAt(mx, my, 2);
    const after = app.toLogical(mx, my);
    near(after.x, before.x, 1e-6); near(after.y, before.y, 1e-6);
  });

  test("zooming in raises the scale, zooming out lowers it", () => {
    app.zoomAt(400, 250, 1.5);
    assert.ok(app.V.z > 1);
    const z = app.V.z;
    app.zoomAt(400, 250, 1 / 1.5);
    assert.ok(app.V.z < z);
  });

  test("zooming in is clamped at ZMAX = 8", () => {
    for(let i = 0; i < 60; i++) app.zoomAt(400, 250, 1.25);
    assert.ok(app.V.z <= 8 + 1e-9, `z = ${app.V.z}`);
    near(app.V.z, 8, 1e-9);
  });

  test("zooming out is clamped at ZMIN = 0.05", () => {
    for(let i = 0; i < 60; i++) app.zoomAt(400, 250, 0.8);
    near(app.V.z, 0.05, 1e-9);
  });

  test("zooming past the ceiling changes nothing", () => {
    for(let i = 0; i < 60; i++) app.zoomAt(400, 250, 1.25);
    const snap = { ...app.V };
    app.zoomAt(100, 100, 1.25);
    assert.deepEqual({ ...app.V }, snap);
  });

  test("resetView returns to 100% and zero pan", () => {
    app.zoomAt(200, 200, 3); app.V.px = 50;
    app.resetView();
    assert.deepEqual({ z: app.V.z, px: app.V.px, py: app.V.py }, { z: 1, px: 0, py: 0 });
    assert.equal(dom.el("lblZoom").textContent, "100%");
  });

  test("the zoom percentage label tracks the real value", () => {
    app.zoomAt(400, 250, 2);
    assert.equal(dom.el("lblZoom").textContent, "200%");
  });

  test("the view state is mirrored onto the canvas data-view attribute", () => {
    app.zoomAt(400, 250, 2);
    const [z, px, py] = dom.canvas().dataset.view.split(",").map(Number);
    assert.equal(z.toFixed(2), app.V.z.toFixed(2));
    assert.equal(px.toFixed(1), app.V.px.toFixed(1));
    assert.equal(py.toFixed(1), app.V.py.toFixed(1));
    app.resetView();
    assert.equal(dom.canvas().dataset.view, "1.000,0.0,0.0");
  });

  test("data-view also follows panning, not just zooming", () => {
    const before = dom.canvas().dataset.view;
    app.setTool("hand");
    down(400, 250); move(460, 220); up();
    assert.notEqual(dom.canvas().dataset.view, before);
    assert.match(dom.canvas().dataset.view, /^1\.000,60\.0,-30\.0$/);
  });

  test("wheel up zooms in, wheel down zooms out", () => {
    wheel(400, 250, -100);
    assert.ok(app.V.z > 1);
    const z = app.V.z;
    wheel(400, 250, 100);
    assert.ok(app.V.z < z);
  });

  test("the wheel zooms around the cursor position", () => {
    const mx = 600, my = 120, before = app.toLogical(mx, my);
    wheel(mx, my, -100);
    const after = app.toLogical(mx, my);
    near(after.x, before.x, 1e-6); near(after.y, before.y, 1e-6);
  });

  test("wheel calls preventDefault so the page does not scroll", () => {
    const e = wheel(400, 250, -100);
    assert.equal(e.defaultPrevented, true);
  });

  test("the +/− and ⟲ toolbar buttons work", () => {
    click("bZoomIn");
    assert.ok(app.V.z > 1);
    click("bZoomOut");
    near(app.V.z, 1, 1e-9);
    app.zoomAt(400, 250, 2);
    click("bZoomRst");
    assert.equal(app.V.z, 1);
    assert.match(msg(), /View reset/);
  });

  test("the + − 0 shortcuts drive the zoom", () => {
    key("+");
    assert.ok(app.V.z > 1);
    key("-");
    near(app.V.z, 1, 1e-9);
    key("=");
    assert.ok(app.V.z > 1);
    key("0");
    assert.equal(app.V.z, 1);
  });
});

describe("pan (hand tool)", () => {
  beforeEach(() => reset({ tool: "hand" }));

  test("dragging with the hand pans by the drag distance", () => {
    down(400, 250); move(430, 220); up();
    assert.equal(app.V.px, 30);
    assert.equal(app.V.py, -30);
  });

  test("the cursor is grabbing mid-drag and grab again afterwards", () => {
    down(400, 250);
    assert.equal(dom.canvas().style.cursor, "grabbing");
    up();
    assert.equal(dom.canvas().style.cursor, "grab");
  });

  test("the pan is never clamped to the right — the canvas is infinite", () => {
    down(400, 250); move(400 + 5000, 250); up();
    assert.equal(app.V.px, 5000);
  });

  test("the pan is never clamped to the left either", () => {
    down(400, 250); move(400 - 5000, 250); up();
    assert.equal(app.V.px, -5000);
  });

  test("vertical panning is unbounded in both directions", () => {
    down(400, 250); move(400, 250 + 5000); up();
    assert.equal(app.V.py, 5000);
    app.resetView();
    down(400, 250); move(400, 250 - 5000); up();
    assert.equal(app.V.py, -5000);
  });

  test("panning still works while the algorithm runs (navigation is not editing)", () => {
    app.S.running = true;
    down(400, 250); move(450, 250); up();
    assert.equal(app.V.px, 50);
    app.S.running = false;
  });

  test("the middle mouse button pans from the brush tool", () => {
    app.setTool("brush");
    const n = app.S.points.length;
    down(400, 250, { button: 1 }); move(440, 250); up();
    assert.equal(app.V.px, 40);
    assert.equal(app.S.points.length, n, "the middle button must not paint");
  });

  test("Space+drag pans from the brush tool, and keyup restores the state", () => {
    app.setTool("brush");
    key(" ", { code: "Space" });
    assert.equal(app.spaceDown, true);
    const n = app.S.points.length;
    down(300, 200); move(340, 200); up();
    assert.equal(app.V.px, 40);
    assert.equal(app.S.points.length, n);
    keyup(" ", { code: "Space" });
    assert.equal(app.spaceDown, false);
  });

  test("keydown Space calls preventDefault", () => {
    const e = key(" ", { code: "Space" });
    assert.equal(e.defaultPrevented, true);
    keyup(" ", { code: "Space" });
  });
});

describe("data stays put when the view changes (Rev 2 acceptance)", () => {
  beforeEach(() => reset());

  test("data points never move in world coordinates, however you pan and zoom", () => {
    setPoints([pt(10, 10), pt(80, 55), pt(150, 95)]);
    const snap = app.S.points.map(p => ({ x: p.x, y: p.y }));
    wheel(500, 150, -100); wheel(200, 400, -100);
    app.setTool("hand"); down(400, 250); move(300, 310); up();
    wheel(350, 220, 100);
    app.resetView();
    app.S.points.forEach((p, i) => { near(p.x, snap[i].x, 1e-12); near(p.y, snap[i].y, 1e-12); });
  });

  test("a point lands on the same pixel again once the view is reset", () => {
    setPoints([pt(33, 44)]);
    const before = app.px(app.S.points[0]);
    app.zoomAt(120, 90, 3.2);
    app.setTool("hand"); down(400, 250); move(250, 190); up();
    app.resetView();
    const after = app.px(app.S.points[0]);
    near(after.x, before.x, 1e-9); near(after.y, before.y, 1e-9);
  });

  test("centroids share the same world coordinates as the data", () => {
    setPoints([pt(50, 50)]);
    app.S.centroids = [{ x: 50, y: 50, ax: 50, ay: 50, trail: [{ x: 50, y: 50 }] }];
    app.zoomAt(400, 250, 2.7);
    const p = app.px(app.S.points[0]), c = app.px({ x: app.S.centroids[0].ax, y: app.S.centroids[0].ay });
    near(p.x, c.x, 1e-9); near(p.y, c.y, 1e-9);
  });
});

describe("resize", () => {
  beforeEach(() => reset());

  test("resize recomputes unit/LX and leaves the pan exactly where it was", () => {
    app.zoomAt(400, 250, 4);
    app.V.px = 99999;
    app.resize();
    assert.equal(app.V.px, 99999, "an infinite canvas never claws the pan back");
    assert.ok(app.LX > 0 && app.plotH > 0);
    assert.equal(app.LX.toFixed(4), (app.plotW / app.unit).toFixed(4));
  });

  test("resize never moves a point that sits outside the visible frame", () => {
    setPoints([pt(app.LX + 40, 50)]);
    const snap = { ...app.S.points[0] };
    app.resize();
    assert.equal(app.S.points[0].x, snap.x);
    assert.equal(app.S.points[0].y, snap.y);
  });

  test("resize never drags an off-screen centroid back either", () => {
    app.S.centroids = [{ x: app.LX + 30, y: 20, ax: app.LX + 30, ay: 20, trail: [] }];
    const snap = { ...app.S.centroids[0] };
    app.resize();
    assert.equal(app.S.centroids[0].x, snap.x);
    assert.equal(app.S.centroids[0].ax, snap.ax);
  });
});
