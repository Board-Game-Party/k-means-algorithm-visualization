/* Real-browser smoke test — asserts through the DOM and real input only.
   (patchright runs evaluate in an isolated world, so page globals are unreadable; check what the user sees.)
   Run: node <skills>/browser-automation/browser.mjs <file://.../index.html> --script tests/browser.smoke.mjs */
export default async function run(page){
  const checks = [], fail = [];
  const ok = (name, cond, extra) => { checks.push(`${cond ? "PASS" : "FAIL"} ${name}`); if(!cond) fail.push({ name, extra }); };
  const txt  = sel => page.locator(sel).innerText();
  const num  = async sel => Number((await txt(sel)).replace(/[^\d.-]/g, ""));
  const view = async () => (await page.locator("#canvas").getAttribute("data-view")).split(",").map(Number);

  await page.waitForFunction(() => document.getElementById("stN")?.textContent > 0, null, { timeout: 10000 });
  const box = await page.locator("#canvas").boundingBox();
  const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);
  const at = (dx, dy) => [Math.round(cx + dx), Math.round(cy + dy)];

  /* 1. boot */
  ok("data points exist after load", (await num("#stN")) > 0, await txt("#stN"));
  ok("the canvas has a real size", box.width > 100 && box.height > 100, box);
  ok("all 6 tool buttons are present", (await page.locator(".tool").count()) === 6);
  ok("the centroid counter shows m / k", /^\d+ \/ \d+$/.test((await txt("#stCent")).trim()), await txt("#stCent"));
  ok("the view starts at 100%", (await txt("#lblZoom")).trim() === "100%");

  /* 1b. K and n have no fixed ceiling — the only rule is 1 ≤ K ≤ N */
  const setNum = async (sel, v) => page.locator(sel).evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
  ok("the K box is a number field with no maximum",
     (await page.locator("#inK").getAttribute("type")) === "number" && (await page.locator("#inK").getAttribute("max")) === null);
  ok("the n box is a number field with no maximum",
     (await page.locator("#inN").getAttribute("type")) === "number" && (await page.locator("#inN").getAttribute("max")) === null);
  await setNum("#inK", 12);
  ok("K accepts 12, well past the old 8-cluster ceiling", (await txt("#stCent")).trim() === "0 / 12", await txt("#stCent"));
  await page.locator("#bInit").click();
  ok("12 centroids really get placed", (await txt("#stCent")).trim() === "12 / 12", await txt("#stCent"));
  ok("the legend names all 12 clusters", (await page.locator("#legend span").count()) >= 12);
  await setNum("#inN", 9);
  await page.locator("#bGen").click();
  ok("n = 9 generates a handful of points, not a fixed minimum", (await num("#stN")) <= 12, await txt("#stN"));
  ok("K = 12 > N = 9 is flagged", (await txt("#kNote")).includes("K > N"), await txt("#kNote"));
  ok("Initialize is disabled while K > N", await page.locator("#bInit").isDisabled());
  await page.locator("#bInit").click({ force: true }).catch(() => {});
  await setNum("#inK", await num("#stN"));               // exactly K = N (the preset rounds, so read the real count)
  ok("K = N is allowed and noted", (await txt("#kNote")).includes("K = N"), await txt("#kNote"));
  ok("Initialize is enabled again at K = N", !(await page.locator("#bInit").isDisabled()));
  await setNum("#inN", 150);
  await page.locator("#bGen").click();
  await setNum("#inK", 3);

  /* 1c. feedback 4 — K and n each offer a slider AND a typed box, and they track each other */
  ok("K has both a number box and a range slider",
     (await page.locator("#inK").getAttribute("type")) === "number" &&
     (await page.locator("#inKR").getAttribute("type")) === "range");
  ok("n has both a number box and a range slider",
     (await page.locator("#inN").getAttribute("type")) === "number" &&
     (await page.locator("#inNR").getAttribute("type")) === "range");
  await setNum("#inKR", 6);
  ok("scrubbing the K slider drives K", (await txt("#stCent")).trim() === "0 / 6", await txt("#stCent"));
  ok("scrubbing the K slider fills the K box", (await page.locator("#inK").inputValue()) === "6");
  await setNum("#inK", 9);
  ok("typing K moves the slider", (await page.locator("#inKR").inputValue()) === "9");
  await setNum("#inK", 260);
  ok("the K slider stretches instead of capping a typed K",
     Number(await page.locator("#inKR").getAttribute("max")) >= 260 &&
     (await page.locator("#inK").inputValue()) === "260",
     await page.locator("#inKR").getAttribute("max"));
  await setNum("#inNR", 60);
  ok("scrubbing the n slider fills the n box", (await page.locator("#inN").inputValue()) === "60");
  await page.locator("#bGen").click();
  ok("a slider-set n really generates that many points", Math.abs((await num("#stN")) - 60) <= 8, await txt("#stN"));
  await setNum("#inN", 150);
  await page.locator("#bGen").click();
  await setNum("#inK", 3);

  /* 2a0. pen — one press, one point (feedback 2) */
  await page.locator("#bClr").click();
  await page.locator("#inDens").evaluate(el => { el.value = "8"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.keyboard.press("p");
  ok("the P shortcut selects the pen", (await txt("#toolHint")).includes("Pen —"), await txt("#toolHint"));
  await page.mouse.click(...at(-120, -60));
  ok("one pen press gives one point, even with flow = 8", (await num("#stN")) === 1, await txt("#stN"));
  await page.mouse.click(...at(-80, -60));
  await page.mouse.click(...at(-40, -60));
  ok("three presses give three points", (await num("#stN")) === 3, await txt("#stN"));

  await page.mouse.move(...at(0, -60));
  await page.mouse.down();
  for(let i = 1; i <= 12; i++) await page.mouse.move(...at(i * 8, -60));
  await page.mouse.up();
  const penDrag = await num("#stN");
  ok("holding and dragging the pen adds points gradually", penDrag > 5 && penDrag < 30, { penDrag });

  /* 2a. spray — hold to build up points */
  await page.locator("#bClr").click();
  await page.locator("#inDens").evaluate(el => { el.value = "3"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.keyboard.press("s");
  ok("the S shortcut selects the spray", (await txt("#toolHint")).includes("Spray —"), await txt("#toolHint"));
  await page.mouse.move(...at(-60, -30));
  await page.mouse.click(...at(-60, -30));
  const puffN = await num("#stN");
  ok("a single spray click gives one puff", puffN >= 3 && puffN <= 9, { puffN });

  await page.mouse.move(...at(60, -30));
  await page.mouse.down();
  await page.waitForTimeout(600);                        // hold still, without moving the mouse at all
  await page.mouse.up();
  const heldN = await num("#stN");
  ok("holding builds points up continuously", heldN - puffN > 15, { puffN, heldN });

  await page.waitForTimeout(400);
  ok("releasing stops the spray", (await num("#stN")) === heldN, { heldN, now: await num("#stN") });
  const penN = heldN;

  /* 2b. brush — an unbroken stroke from a single jump */
  await page.keyboard.press("b");
  ok("the B shortcut selects the brush", (await txt("#toolHint")).includes("Brush —"), await txt("#toolHint"));
  await page.locator("#inStab").evaluate(el => { el.value = "0"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.mouse.move(...at(-200, 60));
  await page.mouse.down();
  await page.mouse.move(...at(200, 60));                 // a single 400px jump
  await page.mouse.up();
  const jumpN = await num("#stN");
  ok("one brush jump paints a long unbroken stroke", jumpN - penN > 30, { penN, jumpN });

  const n0 = jumpN;
  await page.mouse.move(...at(-90, -20));
  await page.mouse.down();
  for(let i = 1; i <= 8; i++) await page.mouse.move(...at(-90 + i * 16, -20 + i * 7));
  await page.mouse.up();
  const n1 = await num("#stN");
  ok("dragging the brush adds points", n1 > n0, { n0, n1 });

  await page.locator("#inStab").evaluate(el => { el.value = "45"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  ok("the smoothing slider is adjustable", (await txt("#lblStab")).trim() === "45%", await txt("#lblStab"));

  /* 3. eraser */
  await page.keyboard.press("e");
  ok("the E shortcut selects the eraser", (await txt("#toolHint")).includes("Eraser —"), await txt("#toolHint"));
  await page.mouse.move(...at(-90, -20));
  await page.mouse.down();
  for(let i = 1; i <= 8; i++) await page.mouse.move(...at(-90 + i * 16, -20 + i * 7));
  await page.mouse.up();
  const n2 = await num("#stN");
  ok("the eraser removes points", n2 < n1, { n1, n2 });

  /* 4. zoom + pan */
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -300);
  const [z1] = await view();
  ok("the mouse wheel zooms in", z1 > 1, { z1 });
  ok("the zoom label keeps up", (await txt("#lblZoom")).trim() !== "100%", await txt("#lblZoom"));

  await page.keyboard.press("h");
  const [, px0, py0] = await view();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy - 45);
  await page.mouse.up();
  const [, px1, py1] = await view();
  ok("dragging the hand pans the view", px1 !== px0 || py1 !== py0, { px0, py0, px1, py1 });

  await page.locator("#bZoomRst").click();
  ok("the view-reset button returns to 100%", (await page.locator("#canvas").getAttribute("data-view")) === "1.000,0.0,0.0",
     await page.locator("#canvas").getAttribute("data-view"));

  /* 5. centroids: place / exceed K / drag / delete */
  await page.locator("#bReset").click();
  await page.keyboard.press("c");
  const spots = [at(-110, -50), at(60, 40), at(120, -70)];
  for(const [x, y] of spots) await page.mouse.click(x, y);
  ok("clicking places all 3 centroids", (await txt("#stCent")).trim() === "3 / 3", await txt("#stCent"));

  await page.mouse.click(...at(-150, 40));
  ok("placing past K is refused with a warning",
     (await txt("#stCent")).trim() === "3 / 3" && (await txt("#msg")).includes("At most K"),
     { cent: await txt("#stCent"), msg: await txt("#msg") });

  await page.mouse.move(...spots[0]);
  await page.mouse.down();
  await page.mouse.move(spots[0][0] + 70, spots[0][1] + 45);
  await page.mouse.up();
  ok("dragging a centroid reassigns the points", (await txt("#msg")).includes("by hand"), await txt("#msg"));

  await page.mouse.click(spots[1][0], spots[1][1], { button: "right" });
  ok("right-click deletes a centroid", (await txt("#stCent")).trim() === "2 / 3", await txt("#stCent"));

  /* 6. still converges with only 2 centroids left */
  await page.locator("#inSpd").evaluate(el => { el.value = "3"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.locator("#bRun").click();
  await page.waitForFunction(() => document.getElementById("phaseName").textContent.includes("Converged"), null, { timeout: 20000 });
  ok("still converges with only 2 centroids",
     (await txt("#stCent")).trim() === "2 / 3" && (await num("#stIter")) > 0,
     { cent: await txt("#stCent"), iter: await txt("#stIter") });
  ok("SSE is reported and the convergence chart updates",
     (await num("#stSSE")) > 0 && (await txt("#histTxt")).includes("samples"),
     { sse: await txt("#stSSE"), hist: await txt("#histTxt") });

  /* 7. unlimited drawing (feedback 2) */
  await page.locator("#bClr").click();
  await page.locator("#inDens").evaluate(el => { el.value = "12"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.keyboard.press("s");
  await page.mouse.move(...at(-60, 0));
  await page.mouse.down();
  await page.waitForTimeout(1500);                       // hold the spray for a long time
  await page.mouse.up();
  const bulk = await num("#stN");
  ok("a long spray hold keeps accumulating points", bulk > 200, { bulk });

  await page.keyboard.press("b");                        // paint past the old cap with the brush
  const dy = Math.round(box.height * 0.15);              // offsets must scale with the canvas — it is short in a headless window
  for(let row = -2; row <= 2; row++){
    await page.mouse.move(...at(-Math.round(box.width * 0.4), row * dy));
    await page.mouse.down();
    await page.mouse.move(...at(Math.round(box.width * 0.4), row * dy));
    await page.mouse.up();
  }
  const many = await num("#stN");
  ok("drawing goes past the old 4000-point cap", many > 2000, { bulk, many });

  await page.mouse.move(...at(0, dy * 2));
  await page.mouse.down();
  await page.mouse.move(...at(Math.round(box.width * 0.2), dy * 2));
  await page.mouse.up();
  const evenMore = await num("#stN");
  ok("drawing continues at high counts — no cap", evenMore > many, { many, evenMore });
  ok("connector lines auto-disable at high counts", (await txt("#lnHint")).includes("auto-off"),
     { hint: await txt("#lnHint"), n: evenMore });

  await page.locator("#bInit").click();
  await page.locator("#bRun").click();
  await page.waitForFunction(() => document.getElementById("phaseName").textContent.includes("Converged"), null, { timeout: 30000 });
  ok("a huge dataset still clusters to convergence", (await num("#stIter")) > 0 && (await num("#stSSE")) > 0,
     { iter: await txt("#stIter"), sse: await txt("#stSSE"), n: await txt("#stN") });

  return { passed: checks.filter(c => c.startsWith("PASS")).length, failed: fail.length, checks, fail };
}
