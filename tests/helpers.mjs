/* tests/helpers.mjs — shared fixture state and event helpers for every test file */
import { dom } from "./dom.mjs";
import { app } from "./.build/app.mjs";

export { app, dom };

const realRandom = Math.random;

/** Seedable RNG (xorshift32) so randomness-dependent tests stay reproducible */
export function seed(n){
  let x = (n >>> 0) || 1;
  Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
export function unseed(){ Math.random = realRandom; }

/** Reset the app to a known state before each test */
export function reset(o = {}){
  const { k = 3, n = 150, data = "blobs", init = "random", brush = 28, dens = 3,
          stab = 0, tool = "brush", speed = 3 } = o;
  dom.el("inK").value = k;
  dom.el("inN").value = n;
  dom.el("inData").value = data;
  dom.el("inInit").value = init;
  dom.el("inBrush").value = brush;
  dom.el("inDens").value = dens;
  dom.el("inStab").value = stab;
  dom.el("inSpd").value = speed;
  dom.el("cbLines").checked = true;
  dom.el("cbTrail").checked = true;
  app.S.k = k;
  app.S.speed = speed;
  app.S.running = false;
  app.S.animating = false;
  app.S.points = [];
  app.hardReset();
  app.resetView();
  app.setTool(tool);
  dom.ctx().__reset();
}

/* ---- data builders ---- */
export const pt = (x, y, c = -1) => ({ x, y, c });
export function setPoints(list){ app.S.points = list.map(p => ({ x: p.x, y: p.y, c: p.c === undefined ? -1 : p.c })); }
export function setCentroids(list){
  app.S.centroids = list.map(c => ({ x: c.x, y: c.y, ax: c.x, ay: c.y, trail: [{ x: c.x, y: c.y }] }));
}
/** Screen position of centroid i */
export const cScreen = i => app.px({ x: app.S.centroids[i].ax, y: app.S.centroids[i].ay });

/* ---- event helpers ---- */
export const down  = (x, y, o = {}) => dom.fireCanvas("pointerdown", { clientX: x, clientY: y, button: 0, pointerId: 1, ...o });
export const move  = (x, y, o = {}) => dom.fireCanvas("pointermove", { clientX: x, clientY: y, button: 0, pointerId: 1, ...o });
export const up    = () => dom.fireWindow("pointerup", {});
export const leave = () => dom.fireCanvas("pointerleave", {});
export const wheel = (x, y, dy) => dom.fireCanvas("wheel", { clientX: x, clientY: y, deltaY: dy });
export const rclick = (x, y) => dom.fireCanvas("contextmenu", { clientX: x, clientY: y, button: 2 });
export const key   = (k, o = {}) => dom.fireWindow("keydown", { key: k, code: o.code || "", ...o });
export const keyup = (k, o = {}) => dom.fireWindow("keyup", { key: k, code: o.code || "", ...o });
export const click = id => dom.el(id).fire("click");
export const input = (id, v) => { dom.el(id).value = v; return dom.el(id).fire("input"); };
export const msg   = () => dom.el("msg").textContent;
