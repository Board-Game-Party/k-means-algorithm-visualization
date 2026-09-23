/* Pen + spray + the brush stroke engine (modelled on SAI Paint Tool 2)
   - Pen    = one press, one point at the cursor; hold and drag lays them one at a time (feedback 2)
   - Spray  = emits over time; hold the button and points pile up at the cursor
   - Brush  = dabs at a fixed spacing along the path + a stabilizer → smooth, unbroken strokes */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { app, dom, reset, seed, unseed, setPoints, setCentroids, pt,
         down, move, up, key, input, msg } from "./helpers.mjs";

after(() => unseed());
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
const toolBtn = t => dom.tools.find(b => b.dataset.tool === t);

describe("pen (feedback 2: one press = one point)", () => {
  beforeEach(() => { seed(251); reset({ tool: "pen", dens: 8 }); });

  test("selectable with the P shortcut and with the toolbar button", () => {
    app.setTool("brush");
    key("p");
    assert.equal(app.S.tool, "pen");
    app.setTool("brush");
    toolBtn("pen").fire("click");
    assert.equal(app.S.tool, "pen");
    assert.ok(toolBtn("pen").classList.contains("on"));
  });

  test("one press yields one point, even with flow set to 8", () => {
    assert.equal(dom.el("inDens").value, "8");
    down(400, 250); up();
    assert.equal(app.S.points.length, 1, "must be a single point, not eight");
  });

  test("the point lands exactly on the cursor, with no scatter", () => {
    const w = app.toLogical(400, 250);
    down(400, 250); up();
    near(app.S.points[0].x, w.x);
    near(app.S.points[0].y, w.y);
  });

  test("several presses give one point each", () => {
    down(300, 200); up();
    down(400, 250); up();
    down(500, 300); up();
    assert.equal(app.S.points.length, 3);
  });

  test("holding and dragging adds points one at a time along the path", () => {
    down(200, 250);
    for(let x = 200 + app.PENMIN; x <= 300; x += app.PENMIN) move(x, 250);
    up();
    const n = app.S.points.length;
    assert.ok(n > 10 && n <= 30, `a 100px drag produced ${n} points — they should come out one at a time`);
    const y0 = app.S.points[0].y;
    for(const p of app.S.points) near(p.y, y0, 1e-9);     // horizontal drag: y must stay exactly constant
  });

  test("a move below the minimum gap does not stack a second point", () => {
    down(400, 250);
    const n = app.S.points.length;
    move(400 + app.PENMIN * 0.5, 250);
    assert.equal(app.S.points.length, n);
    move(400 + app.PENMIN + 0.5, 250);
    assert.equal(app.S.points.length, n + 1);
    up();
  });

  test("moving after mouse-up adds nothing", () => {
    down(300, 250); up();
    const n = app.S.points.length;
    move(500, 250); move(600, 250);
    assert.equal(app.S.points.length, n);
  });

  test("the pen ignores the stabilizer entirely", () => {
    input("inStab", 90);
    const w = app.toLogical(500, 300);
    down(300, 200);
    move(500, 300);
    up();
    const last = app.S.points.at(-1);
    near(last.x, w.x); near(last.y, w.y);
  });

  test("the pen places a point anywhere — the canvas is infinite", () => {
    down(2, 2); up();
    assert.equal(app.S.points.length, 1);
  });

  test("adding a point sends the phase back to assign", () => {
    setCentroids([{ x: 30, y: 30 }]);
    app.S.phase = "done";
    down(400, 250); up();
    assert.equal(app.S.phase, "assign");
  });

  test("the pen shows no brush sliders", () => {
    assert.equal(dom.el("brushOpts").style.display, "none");
  });

  test("the pen can draw without any count limit", () => {
    setPoints(Array.from({ length: 20000 }, () => pt(50, 50)));
    down(400, 250); up();
    assert.equal(app.S.points.length, 20001);
  });

  test("the pen is inert while the algorithm runs", () => {
    app.S.running = true;
    down(400, 250); up();
    assert.equal(app.S.points.length, 0);
    assert.match(msg(), /The algorithm is running/);
    app.S.running = false;
  });

  test("the pen cursor is a small dot, not a full brush ring", () => {
    move(400, 250);
    dom.ctx().__reset();
    app.render();
    const arcs = dom.ctx().__calls._arcs || [];
    const hit = (r) => arcs.some(a => Math.abs(a[0] - 400) < 0.6 && Math.abs(a[1] - 250) < 0.6 && Math.abs(a[2] - r) < 0.6);
    assert.ok(hit(3.5), "the small pen head must be drawn");
    assert.ok(!hit(app.brushR()), "no large brush ring should appear");
  });
});

describe("spray (hold to build up points)", () => {
  beforeEach(() => { seed(201); reset({ tool: "spray", dens: 3 }); });

  /** Advance the clock and run frames so the spray loop ticks as it would in a browser */
  const hold = (ms, step = app.SPRAYMS) => {
    for(let t = 0; t < ms; t += step){ dom.advance(step); dom.flushRaf(); }
  };

  test("selectable with the S shortcut and with the toolbar button", () => {
    app.setTool("brush");
    key("s");
    assert.equal(app.S.tool, "spray");
    app.setTool("brush");
    toolBtn("spray").fire("click");
    assert.equal(app.S.tool, "spray");
    assert.ok(toolBtn("spray").classList.contains("on"));
  });

  test("a single click gives one puff of exactly flow-many points", () => {
    down(400, 250); up();
    assert.equal(app.S.points.length, 3);
  });

  test("holding still keeps adding points even without moving the mouse", () => {
    down(400, 250);
    const first = app.S.points.length;
    hold(app.SPRAYMS * 5);
    const after = app.S.points.length;
    up();
    assert.ok(after >= first + 12, `five cadences should add roughly 15 points, got ${after - first}`);
  });

  test("the longer you hold, the denser it gets", () => {
    down(400, 250);
    hold(app.SPRAYMS * 3);
    const short = app.S.points.length;
    hold(app.SPRAYMS * 9);
    const long = app.S.points.length;
    up();
    assert.ok(long > short * 2, `${short} → ${long} should grow with hold time`);
  });

  test("nothing is emitted before the next cadence tick", () => {
    down(400, 250);
    const n = app.S.points.length;
    dom.advance(app.SPRAYMS * 0.4); dom.flushRaf();
    assert.equal(app.S.points.length, n, "emitted faster than the configured cadence");
    dom.advance(app.SPRAYMS); dom.flushRaf();
    assert.ok(app.S.points.length > n);
    up();
  });

  test("releasing the button stops the spray at once", () => {
    down(400, 250);
    hold(app.SPRAYMS * 3);
    up();
    const n = app.S.points.length;
    hold(app.SPRAYMS * 10);
    assert.equal(app.S.points.length, n, "still spraying after release");
  });

  test("moving while held carries the spray cone along", () => {
    const a = app.toLogical(250, 250), b = app.toLogical(600, 250);
    down(250, 250);
    hold(app.SPRAYMS * 3);
    move(600, 250);
    hold(app.SPRAYMS * 3);
    up();
    const R = app.brushR() / app.sc();
    assert.ok(app.S.points.some(p => Math.hypot(p.x - a.x, p.y - a.y) <= R), "no points at the first position");
    assert.ok(app.S.points.some(p => Math.hypot(p.x - b.x, p.y - b.y) <= R), "no points at the new position");
  });

  test("sprayed points stay inside the ring and cluster toward the centre", () => {
    input("inBrush", 60);
    input("inDens", 10);
    const c = app.toLogical(400, 250), r = app.brushR() / app.sc();
    down(400, 250);
    hold(app.SPRAYMS * 6);
    up();
    const ds = app.S.points.map(p => Math.hypot(p.x - c.x, p.y - c.y)).sort((x, y) => x - y);
    assert.ok(ds.at(-1) <= r + 1e-9, "a point escaped the spray ring");
    assert.ok(ds[Math.floor(ds.length / 2)] < r * 0.75, "the spray must be denser in the middle");
  });

  test("spraying works outside the visible frame too — the canvas is infinite", () => {
    input("inBrush", 8);
    down(2, 2);
    hold(app.SPRAYMS * 4);
    up();
    assert.ok(app.S.points.length > 0);
  });

  test("spraying continues even with a huge point count — no cap (feedback 2)", () => {
    setPoints(Array.from({ length: 12000 }, () => pt(50, 50)));
    const n = app.S.points.length;
    down(400, 250);
    hold(app.SPRAYMS * 4);
    up();
    assert.ok(app.S.points.length > n + 10, `could not keep spraying: ${n} → ${app.S.points.length}`);
  });

  test("spraying sends the phase back to assign", () => {
    setCentroids([{ x: 30, y: 30 }]);
    app.S.phase = "done";
    down(400, 250); up();
    assert.equal(app.S.phase, "assign");
  });

  test("the spray uses size and flow but not the stabilizer", () => {
    assert.equal(dom.el("brushOpts").style.display, "");
    assert.equal(dom.el("densOpt").style.display, "");
    assert.equal(dom.el("stabOpt").style.display, "none");
    app.setTool("brush");
    assert.equal(dom.el("stabOpt").style.display, "");
  });

  test("spraying is blocked while the algorithm runs, with a message", () => {
    app.S.running = true;
    down(400, 250);
    hold(app.SPRAYMS * 4);
    up();
    assert.equal(app.S.points.length, 0);
    assert.match(msg(), /The algorithm is running/);
    app.S.running = false;
  });

  test("the spray loop stops itself when the mode changes instead of spinning forever", () => {
    down(400, 250);
    hold(app.SPRAYMS * 2);
    up();
    assert.equal(app.mode, null);
    const n = app.S.points.length;
    hold(app.SPRAYMS * 6);
    assert.equal(app.S.points.length, n);
  });
});

describe("brush: strokes stay unbroken", () => {
  beforeEach(() => { seed(211); reset({ tool: "brush", dens: 1, stab: 0, brush: 28 }); });

  test("one fast jump across the canvas still paints an unbroken stroke", () => {
    input("inDens", 4);
    down(150, 250);
    move(650, 250);                                   // a single 500px jump (one event)
    up();
    const R = app.brushR() / app.sc();
    for(let sx = 150; sx <= 650; sx += app.spacing()){
      const c = app.toLogical(sx, 250);
      assert.ok(app.S.points.some(p => Math.hypot(p.x - c.x, p.y - c.y) <= R),
                `nothing painted around x=${sx.toFixed(0)}px — the stroke has a gap`);
    }
  });

  test("a pointer jump is filled in along the way, not only at its end", () => {
    down(150, 250);
    move(650, 250);
    up();
    const mid = app.toLogical(400, 250), R = app.brushR() / app.sc();
    const nearMid = app.S.points.filter(p => Math.hypot(p.x - mid.x, p.y - mid.y) <= R).length;
    assert.ok(nearMid > 0, "the middle of the stroke must have points, not just the ends");
    const xs = app.S.points.map(p => p.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) > (app.toLogical(650, 250).x - app.toLogical(150, 250).x) * 0.9,
              "the stroke must span almost the whole dragged length");
  });

  test("the dab count follows stroke length, not pointer-event count", () => {
    down(150, 250); move(650, 250); up();
    const fewEvents = app.S.points.length;

    reset({ tool: "brush", dens: 1, stab: 0, brush: 28 });
    down(150, 250);
    for(let x = 160; x <= 650; x += 10) move(x, 250);  // 50 events, same distance
    up();
    const manyEvents = app.S.points.length;

    assert.ok(Math.abs(fewEvents - manyEvents) <= 2,
              `fast drag ${fewEvents} points vs slow drag ${manyEvents} — they must be close`);
  });

  test("leftover distance carries across events instead of being discarded", () => {
    const sp = app.spacing();
    down(200, 250);
    const base = app.S.points.length;
    for(let i = 0; i < 10; i++) move(200 + (i + 1) * sp * 0.4, 250);   // 40% of a dab spacing at a time
    up();
    const added = app.S.points.length - base;
    assert.ok(added >= 3 && added <= 5, `four spacings of travel produced ${added} dabs`);
  });

  test("a bigger brush spaces its dabs further apart", () => {
    input("inBrush", 12);
    const small = app.spacing();
    input("inBrush", 80);
    assert.ok(app.spacing() > small, `${app.spacing()} should exceed ${small}`);
  });

  test("dab spacing has a floor so a tiny brush does not over-sample", () => {
    input("inBrush", 8);
    assert.ok(app.spacing() >= 2.5);
  });

  test("flow n means n points per dab", () => {
    input("inDens", 5);
    down(300, 250);
    const base = app.S.points.length;
    move(300 + app.spacing() * 3.02, 250);
    up();
    assert.equal(app.S.points.length - base, 15, "3 dabs × 5 points");
  });

  test("the brush is dense in the middle, thin at the rim, and never spills", () => {
    input("inDens", 12);
    input("inBrush", 60);
    const c = app.toLogical(400, 250), r = app.brushR() / app.sc();
    down(400, 250); up();
    const ds = app.S.points.map(p => Math.hypot(p.x - c.x, p.y - c.y)).sort((a, b) => a - b);
    assert.ok(ds.at(-1) <= r + 1e-9, "a point escaped the brush ring");
    const median = ds[Math.floor(ds.length / 2)];
    assert.ok(median < r * 0.75, `median ${median.toFixed(2)} should be below ${(r * 0.75).toFixed(2)} (ink must pack toward the centre)`);
  });

  test("every point along a stroke lands within the brush radius of the drag path", () => {
    down(60, 60);
    move(740, 440);
    up();
    assert.ok(app.S.points.length > 0);
    const r = app.brushR() / app.sc() + 1e-6;
    const a = app.toLogical(60, 60), b = app.toLogical(740, 440);
    const loX = Math.min(a.x, b.x) - r, hiX = Math.max(a.x, b.x) + r;
    const loY = Math.min(a.y, b.y) - r, hiY = Math.max(a.y, b.y) + r;
    for(const p of app.S.points)
      assert.ok(p.x >= loX && p.x <= hiX && p.y >= loY && p.y <= hiY, `off the stroke: ${p.x},${p.y}`);
  });
});

describe("brush: the stabilizer", () => {
  beforeEach(() => { seed(221); reset({ tool: "brush", dens: 1, brush: 28 }); });

  test("smoothing 0% keeps the head on the pointer", () => {
    input("inStab", 0);
    down(300, 250);
    move(500, 250);
    assert.equal(app.stroke.sx, 500);
    up();
  });

  test("high smoothing makes the head lag behind the hand", () => {
    input("inStab", 90);
    down(300, 250);
    move(500, 250);
    assert.ok(app.stroke.sx > 300 && app.stroke.sx < 340,
              `head at ${app.stroke.sx} — it should have covered only about 10% of the distance`);
    up();
  });

  test("the head catches up to the pointer over a continuous drag", () => {
    input("inStab", 70);
    down(300, 250);
    for(let i = 0; i < 40; i++) move(500, 250);
    assert.ok(Math.abs(app.stroke.sx - 500) < 1, `stuck at ${app.stroke.sx}`);
    up();
  });

  test("heavier smoothing paints a shorter stroke for the same hand movement", () => {
    input("inStab", 0);
    down(200, 250); move(600, 250); up();
    const raw = app.S.points.length;

    reset({ tool: "brush", dens: 1, brush: 28 });
    input("inStab", 80);
    down(200, 250); move(600, 250); up();
    assert.ok(app.S.points.length < raw, `smoothed ${app.S.points.length} should be fewer than raw ${raw}`);
  });

  test("mouse-up clears the stroke state", () => {
    input("inStab", 50);
    down(300, 250); move(400, 250);
    assert.equal(app.stroke.on, true);
    up();
    assert.equal(app.stroke.on, false);
    assert.equal(app.stroke.carry, 0);
  });

  test("a new stroke does not connect back to the previous one", () => {
    input("inStab", 0);
    down(200, 250); move(300, 250); up();
    const n = app.S.points.length;
    down(700, 100);                                   // start again far away
    assert.equal(app.S.points.length, n + 1, "only the first dab of the new stroke, not a line across the canvas");
    up();
  });

  test("the smoothing slider updates its label", () => {
    input("inStab", 65);
    assert.equal(dom.el("lblStab").textContent, "65%");
  });
});

describe("the eraser uses the same stroke engine", () => {
  beforeEach(() => { seed(231); reset({ tool: "eraser", stab: 0, brush: 24 }); });

  test("a fast drag across a row erases all of it, leaving no islands", () => {
    const y = app.toLogical(400, 250).y;
    const xs = [];
    for(let sx = 200; sx <= 600; sx += 8) xs.push(app.toLogical(sx, 250).x);
    setPoints(xs.map(x => pt(x, y)));
    down(200, 250);
    move(600, 250);                                   // a single jump
    up();
    assert.equal(app.S.points.length, 0, `${app.S.points.length} points still left along the swept path`);
  });

  test("only the swept path is erased; distant points are untouched", () => {
    const c = app.toLogical(400, 250), far = app.toLogical(400, 60);
    setPoints([pt(c.x, c.y), pt(far.x, far.y)]);
    down(200, 250); move(600, 250); up();
    assert.equal(app.S.points.length, 1);
    assert.ok(Math.abs(app.S.points[0].y - far.y) < 1e-9);
  });

  test("the eraser hides the flow slider but keeps size and smoothing", () => {
    assert.equal(dom.el("brushOpts").style.display, "");
    assert.equal(dom.el("densOpt").style.display, "none");
    app.setTool("brush");
    assert.equal(dom.el("densOpt").style.display, "");
  });

  test("erasing mid-drag sends the phase back to assign", () => {
    const c = app.toLogical(400, 250);
    setPoints([pt(c.x, c.y)]);
    setCentroids([{ x: 10, y: 10 }]);
    app.S.phase = "done";
    down(200, 250); move(600, 250); up();
    assert.equal(app.S.phase, "assign");
  });
});

describe("the brush head on screen", () => {
  beforeEach(() => { seed(241); reset(); });

  const ctx = () => dom.ctx();
  const hasArc = (x, y, r, eps = 0.6) =>
    (ctx().__calls._arcs || []).some(a => Math.abs(a[0] - x) < eps && Math.abs(a[1] - y) < eps && Math.abs(a[2] - r) < eps);

  test("the spray shows a ring of the configured radius", () => {
    app.setTool("spray");
    move(400, 250);
    ctx().__reset(); app.render();
    assert.ok(hasArc(400, 250, app.brushR()), "the spray ring must be drawn");
  });

  test("while spraying, a cone-centre dot appears", () => {
    app.setTool("spray");
    move(400, 250);
    ctx().__reset(); app.render();
    const inner = Math.max(2, app.brushR() * 0.18);
    assert.ok(!hasArc(400, 250, inner), "no centre dot before the button is pressed");
    down(400, 250);
    ctx().__reset(); app.render();
    assert.ok(hasArc(400, 250, inner), "the centre dot must appear while spraying");
    up();
  });

  test("with smoothing on, the head is drawn at the damped position, not the pointer", () => {
    app.setTool("brush");
    input("inStab", 85);
    down(300, 250);
    move(520, 250);
    ctx().__reset(); app.render();
    assert.ok(!hasArc(520, 250, app.brushR()), "must not be drawn at the raw pointer position");
    assert.ok(hasArc(app.stroke.sx, app.stroke.sy, app.brushR()), "must be drawn at the real brush head");
    up();
  });

  test("a leash line connects the hand to the head while smoothing", () => {
    app.setTool("brush");
    input("inStab", 85);
    down(300, 250);
    move(520, 250);
    ctx().__reset(); app.render();
    const lines = ctx().__args("moveTo").filter(a => Math.abs(a[0] - 520) < 0.6 && Math.abs(a[1] - 250) < 0.6);
    assert.ok(lines.length >= 1, "a dashed line should run from the pointer to the head");
    up();
  });

  test("after mouse-up the ring snaps back to the pointer", () => {
    app.setTool("brush");
    input("inStab", 85);
    down(300, 250); move(520, 250); up();
    move(520, 250);
    ctx().__reset(); app.render();
    assert.ok(hasArc(520, 250, app.brushR()));
  });
});
