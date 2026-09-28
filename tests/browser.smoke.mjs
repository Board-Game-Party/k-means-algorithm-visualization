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
  ok("all 7 tool buttons are present", (await page.locator(".tool").count()) === 7, await page.locator(".tool").count());
  ok("the centroid counter shows m / k", /^\d+ \/ \d+$/.test((await txt("#stCent")).trim()), await txt("#stCent"));
  ok("the view starts at 100%", (await txt("#lblZoom")).trim() === "100%");

  /* 1b. K and n have no fixed ceiling — the only rule is 1 ≤ K ≤ N */
  const setNum = async (sel, v) => page.locator(sel).evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
  /* feedback 7: Generate lives inside the 🎲 tool panel, so selecting the tool is part of generating */
  const genData = async () => {
    await page.locator(String.raw`.tool[data-tool="random"]`).click();
    await page.locator("#randOpts #bGen").click();
  };
  /* mid-typing only — no "change", so the feedback-6 commit clamp does not fire */
  const typeNum = async (sel, v) => page.locator(sel).evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
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
  await setNum("#inK", 1);
  await setNum("#inN", 9);
  await genData();
  ok("n = 9 generates a handful of points, not a fixed minimum", (await num("#stN")) <= 12, await txt("#stN"));
  await typeNum("#inK", 12);                             // typed, not committed — K may exceed N
  ok("K = 12 > N = 9 is flagged", (await txt("#kNote")).includes("K > distinct positions"), await txt("#kNote"));
  ok("Initialize is disabled while K > N", await page.locator("#bInit").isDisabled());
  await page.locator("#bInit").click({ force: true }).catch(() => {});
  await setNum("#inK", await num("#stN"));               // exactly K = N (the preset rounds, so read the real count)
  ok("K = N is allowed and noted", (await txt("#kNote")).includes("K = N"), await txt("#kNote"));
  ok("Initialize is enabled again at K = N", !(await page.locator("#bInit").isDisabled()));
  await setNum("#inN", 150);
  await genData();
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
  ok("a typed K past the track's end is kept by the box, not capped",
     (await page.locator("#inK").inputValue()) === "260",
     await page.locator("#inK").inputValue());
  await setNum("#inNR", 60);
  ok("scrubbing the n slider fills the n box", (await page.locator("#inN").inputValue()) === "60");
  await genData();
  ok("a slider-set n really generates that many points", Math.abs((await num("#stN")) - 60) <= 8, await txt("#stN"));
  await setNum("#inN", 150);
  await genData();
  await setNum("#inK", 3);

  /* 1d. feedback 5 — K and the data points relate the way the theory says */
  ok("the generate button sits inside the n control group",
     await page.locator("#inN").evaluate(el => {
       const cell = el.closest("div").parentElement;
       return !!cell.querySelector("#bGen");
     }));
  for(const [kind, n] of [["blobs", 7], ["sizes", 33], ["density", 100], ["rings", 45], ["outliers", 61]]){
    await page.locator("#inData").selectOption(kind);      // selecting a preset regenerates
    await setNum("#inN", n);
    await genData();
    ok(`the ${kind} preset generates exactly n = ${n} points`, (await num("#stN")) === n, await txt("#stN"));
  }
  await page.locator("#inData").selectOption("blobs");
  await setNum("#inN", 40);
  await genData();
  ok("the K slider's top end is N, the data-point count",
     (await page.locator("#inKR").getAttribute("max")) === "40",
     await page.locator("#inKR").getAttribute("max"));
  await setNum("#inKR", 40);
  ok("the far end of the K track is still a legal K", !(await page.locator("#bInit").isDisabled()));
  await typeNum("#inK", 90);
  ok("a typed K above N still sticks and is flagged",
     (await page.locator("#inK").inputValue()) === "90" && (await txt("#kNote")).includes("K > distinct positions"),
     await txt("#kNote"));
  ok("the track still refuses to go past N even so",
     (await page.locator("#inKR").getAttribute("max")) === "40",
     await page.locator("#inKR").getAttribute("max"));
  ok("and the thumb pins at N rather than reading past it",
     (await page.locator("#inKR").inputValue()) === "40",
     await page.locator("#inKR").inputValue());
  await setNum("#inK", 3);
  ok("the track is still exactly N after the overshoot is gone",
     (await page.locator("#inKR").getAttribute("max")) === "40",
     await page.locator("#inKR").getAttribute("max"));
  /* the feedback-5 examples, literally: N = 999 → 999, N = 696 → 696 */
  for(const N of [999, 696]){
    await setNum("#inN", N);
    await genData();
    ok(`N = ${N} generates exactly ${N} points`, (await num("#stN")) === N, await txt("#stN"));
    ok(`with N = ${N} the K track stops at ${N}`,
       (await page.locator("#inKR").getAttribute("max")) === String(N),
       await page.locator("#inKR").getAttribute("max"));
    await page.locator("#inKR").evaluate(el => {               // drag the thumb to the very end
      el.value = String(Number(el.max) + 500);                 // ask for more than the track allows
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    ok(`the K slider cannot be dragged past ${N}`, (await txt("#stCent")).trim() === `0 / ${N}`, await txt("#stCent"));
    ok(`K = N = ${N} is a legal clustering`, !(await page.locator("#bInit").isDisabled()));
  }
  await setNum("#inN", 40);
  await genData();
  await setNum("#inK", 3);
  await typeNum("#inN", 2);                              // typed, not committed — n may sit below K
  ok("the n control leads the warning with the rule that must hold",
     (await txt("#nNote")).startsWith("Need n ≥ K"), await txt("#nNote"));
  ok("New random data is disabled while n < K", await page.locator("#bGen").isDisabled());
  await setNum("#inN", 150);
  await genData();
  await setNum("#inK", 3);

  /* 1d2. feedback 7 — 🎲 is a real tool, and n is its option the way Size is the brush's */
  ok("🎲 sits in the tool group with the pen and the brush",
     (await page.locator('.tool[data-tool="random"]').count()) === 1);
  await page.locator('.tool[data-tool="brush"]').click();
  ok("with the brush selected, the brush options show and the 🎲 options do not",
     (await page.locator("#brushOpts").isVisible()) && !(await page.locator("#randOpts").isVisible()));
  await page.locator('.tool[data-tool="random"]').click();
  ok("selecting 🎲 swaps in its own option panel",
     (await page.locator("#randOpts").isVisible()) && !(await page.locator("#brushOpts").isVisible()));
  ok("🎲 is the active tool, shown as such",
     (await page.locator('.tool[data-tool="random"]').getAttribute("class")).includes("on"));
  ok("n and its slider are inside that panel",
     (await page.locator("#randOpts #inN").count()) === 1 && (await page.locator("#randOpts #inNR").count()) === 1);
  ok("so is the Generate button", (await page.locator("#randOpts #bGen").count()) === 1);
  ok("the 🎲 hint explains the option", (await txt("#toolHint")).includes("Random data"), await txt("#toolHint"));
  {
    const before = await num("#stN");
    await page.mouse.click(cx, cy);
    ok("clicking the canvas with 🎲 selected adds nothing — it is not a drawing tool",
       (await num("#stN")) === before, await txt("#stN"));
  }
  await setNum("#inK", 1);
  await setNum("#inN", 77);
  await page.locator("#randOpts #bGen").click();
  ok("Generate inside the panel really generates exactly n", (await num("#stN")) === 77, await txt("#stN"));
  await page.locator('.tool[data-tool="brush"]').click();
  await setNum("#inK", 3);

  /* 1e. feedback 6 — the n / K conditions and k-means robustness */
  await setNum("#inN", 1936);
  await genData();
  ok("N = 1936 generated exactly", (await num("#stN")) === 1936, await txt("#stN"));
  ok("the n track always reaches at least as far as the K track",
     Number(await page.locator("#inNR").getAttribute("max")) >= Number(await page.locator("#inKR").getAttribute("max")),
     (await page.locator("#inNR").getAttribute("max")) + " vs " + (await page.locator("#inKR").getAttribute("max")));
  await setNum("#inK", 10);
  ok("an ordinary K = 10 at N = 1936 says nothing but the green tick",
     (await txt("#kNote")).startsWith("K ≤ N ✓") && (await page.locator("#kNote").getAttribute("class")) === "note",
     await txt("#kNote"));
  await setNum("#inK", 120);
  ok("a K above 2√N is a soft grey hint",
     (await txt("#kNote")).includes("higher than typical") &&
     (await page.locator("#kNote").getAttribute("class")).includes("hint"),
     await txt("#kNote"));
  await setNum("#inK", 1936);
  ok("K = N is amber and still runnable",
     (await txt("#kNote")).includes("every point is its own cluster") &&
     (await page.locator("#kNote").getAttribute("class")).includes("caution") &&
     !(await page.locator("#bInit").isDisabled()),
     await txt("#kNote"));
  /* task 3 — the two controls drag each other */
  await setNum("#inK", 10);
  await setNum("#inNR", 4);
  ok("lowering n below K drags K down with it", (await page.locator("#inK").inputValue()) === "4",
     await page.locator("#inK").inputValue());
  await setNum("#inKR", 60);
  ok("raising K past n drags n up with it", (await page.locator("#inN").inputValue()) === "60",
     await page.locator("#inN").inputValue());
  /* task 6 — a stranded centroid must not poison SSE or MAX MOVE */
  await setNum("#inN", 400);
  await genData();
  await setNum("#inK", 6);
  await page.locator("#bInit").click();
  await page.locator("#bRun").click();
  await page.waitForFunction(() => document.getElementById("phaseName")?.textContent?.includes("Converged")
                                || document.getElementById("msg")?.textContent?.includes("Converged"),
                             null, { timeout: 15000 }).catch(() => {});
  ok("a full run leaves SSE a real number", /^[\d.]+$/.test((await txt("#stSSE")).trim()), await txt("#stSSE"));
  ok("a full run leaves MAX MOVE a real number", /^[\d.]+$/.test((await txt("#stMove")).trim()), await txt("#stMove"));
  ok("no NaN anywhere in the stats bar",
     !(await page.locator(".card2").allInnerTexts()).join(" ").includes("NaN"));
  await setNum("#inN", 150);
  await genData();
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

  /* 8. cluster status click-to-focus (Memory/cluster_focus_feature.md) —
        the delegated legend handlers only exist in a real DOM, so this is the only place they run */
  await setNum("#inK", 3);
  await setNum("#inN", 150);
  await genData();
  await page.locator('.tool[data-tool="brush"]').click();
  await page.locator("#bInit").click();
  await page.locator("#bRun").click();
  await page.waitForFunction(() => document.getElementById("phaseName").textContent.includes("Converged"),
                             null, { timeout: 20000 });
  ok("the status bar renders one clickable item per cluster",
     (await page.locator(".cluster-status-item").count()) === 3,
     await page.locator(".cluster-status-item").count());
  ok("the items look clickable", (await page.locator(".cluster-status-item").first().getAttribute("role")) === "button");

  const viewBefore = await view();
  await page.locator('.cluster-status-item[data-cluster="1"]').click();
  await page.waitForTimeout(700);                       // the fly-through is 500ms
  const viewAfter = await view();
  ok("clicking a cluster flies the canvas somewhere new",
     viewAfter.some((v, i) => Math.abs(v - viewBefore[i]) > 0.01),
     { before: viewBefore, after: viewAfter });
  ok("it zooms in rather than out", viewAfter[0] > viewBefore[0], { before: viewBefore[0], after: viewAfter[0] });
  ok("the clicked cluster is marked active",
     (await page.locator('.cluster-status-item[data-cluster="1"]').getAttribute("class")).includes("active"));
  ok("the other clusters are dimmed",
     (await page.locator('.cluster-status-item[data-cluster="0"]').getAttribute("class")).includes("dimmed") &&
     (await page.locator('.cluster-status-item[data-cluster="2"]').getAttribute("class")).includes("dimmed"));
  ok("the status line explains what happened", (await txt("#msg")).includes("Focused on"), await txt("#msg"));

  await page.locator('.cluster-status-item[data-cluster="2"]').click();
  await page.waitForTimeout(700);
  ok("clicking a different cluster moves the focus instead of toggling",
     (await page.locator('.cluster-status-item[data-cluster="2"]').getAttribute("class")).includes("active") &&
     !(await page.locator('.cluster-status-item[data-cluster="1"]').getAttribute("class")).includes("active"));

  await page.locator('.cluster-status-item[data-cluster="2"]').click();
  await page.waitForTimeout(700);
  ok("clicking the same cluster again releases the focus",
     !(await page.locator('.cluster-status-item[data-cluster="2"]').getAttribute("class")).includes("active"));
  ok("and nothing is left dimmed",
     (await page.locator(".cluster-status-item.dimmed").count()) === 0,
     await page.locator(".cluster-status-item.dimmed").count());
  const viewOut = await view();
  ok("zooming back out really widens the view", viewOut[0] < (await viewAfter)[0], { out: viewOut[0] });

  await page.locator('.cluster-status-item[data-cluster="0"]').click();
  await page.waitForTimeout(700);
  await page.locator("#bInit").click();
  ok("re-running k-means drops the focus",
     (await page.locator(".cluster-status-item.active").count()) === 0,
     await page.locator(".cluster-status-item.active").count());

  /* ===== feedback 8: the lag / resource drain =====
     index.html mirrors its repaint count onto #canvas[data-paints], so idleness is observable from
     the DOM. Before the fix this counter climbed ~60 a second forever, whatever the user was doing. */
  const paints = async () => Number(await page.locator("#canvas").getAttribute("data-paints"));

  await page.mouse.move(5, 5);              // pointer off the canvas, nothing hovered
  await page.waitForTimeout(900);           // let any animation in flight finish
  const idleA = await paints();
  await page.waitForTimeout(1500);
  const idleB = await paints();
  ok("an idle page repaints zero times (feedback 8)", idleB === idleA,
     { over1500ms: idleB - idleA, before: idleA, after: idleB });
  ok("the paint counter is actually wired up", idleA > 0, idleA);

  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -240);          // zooming must still repaint
  await page.waitForTimeout(250);
  const afterZoom = await paints();
  ok("zooming wakes the render loop back up (feedback 8)", afterZoom > idleB, { idleB, afterZoom });

  await page.waitForTimeout(1200);
  const settled = await paints();
  await page.waitForTimeout(1200);
  ok("and it goes back to sleep once the view settles (feedback 8)", (await paints()) === settled,
     { settled, after: await paints() });

  await page.locator(String.raw`.tool[data-tool="hand"]`).click();
  const beforeRun = await paints();
  await page.locator("#bInit").click();
  await page.locator("#bRun").click();
  await page.waitForFunction(() => /Converged|Stop/.test(document.getElementById("msg")?.textContent || ""),
                             null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  ok("a running animation still gets its frames (feedback 8)", (await paints()) > beforeRun + 5,
     { beforeRun, after: await paints() });

  await page.waitForTimeout(1200);
  const afterRun = await paints();
  await page.waitForTimeout(1500);
  ok("and the loop stops again when the algorithm converges (feedback 8)", (await paints()) === afterRun,
     { afterRun, after: await paints() });

  return { passed: checks.filter(c => c.startsWith("PASS")).length, failed: fail.length, checks, fail };
}
