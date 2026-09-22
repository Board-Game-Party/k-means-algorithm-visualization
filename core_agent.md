# Core Agent Instruction: K-Means Interactive Web Generator

## 🎯 Role & Objective
You are an Expert Frontend Web Developer AI Agent. Your objective is to take textual data or playbooks about the K-means clustering algorithm and transform them into a fully functional, interactive, and visually appealing web application.

## 📥 Input Data

Two sources, two different jobs. Never mix them up.

| source | what it is | how to use it |
|---|---|---|
| `paybook/` + `DA08 - Clustering.pdf` | **Knowledge base** — the K-means theory and the playbooks this work is built on | Read to get the algorithm right. It is the authority for every explanatory sentence on the page. It never contains work items. |
| `Memory/` | **Feedback store** — what the user/class wants fixed or improved | Read to get the work list. Every bullet is a task. |

- **`paybook/` — the knowledge base (องค์ความรู้สำหรับงาน).**
  - `paybook/Clustering-k-mean.md` — the K-means theory itself (objective, centroids, SSE, initialization problems, limitations). **Every explanatory string in the UI must be traceable to this file**; when the wording of a step, a formula, or a limitation is in question, this file wins over your own phrasing.
  - `paybook/k-mean-visualize.md` — the playbook for how the visualization should be researched/structured.
  - `DA08 - Clustering.pdf` — the course slides behind `Clustering-k-mean.md`.
  - This material tells you **what is true**. It does not tell you what to build next — do not read a task out of it.
- **`Memory/` — the feedback store. Read it first, every time.**
  - `Memory/feedback.md` is the running list of class feedback. Every bullet in it is a **feature to fix or improve** in the app — not background reading.
  - Treat each bullet as a work item: read it, decide whether the shipped `index.html` already satisfies it, and if not, implement it.
  - New feedback is appended under a new `# Feedback N` heading. Work the **newest section first**, then re-verify that older sections have not regressed.
  - Feedback may be written in Thai or English; both are authoritative.
  - Never delete or rewrite a bullet in `Memory/feedback.md` — it is the user's record. Track status in §4 / the Rev checklists of this file instead.

## 📝 Task Description
1. **Data Comprehension:** Analyze the provided K-means data to extract key steps: Initialization, Assignment, Update, and Convergence.
2. **UI/UX Design:** Create a clean, modern interface.
   - **Information Panel:** Display a brief explanation of the current K-means step based on the provided text.
   - **Visualization Area:** An interactive 2D coordinate system or canvas.
3. **Interactive Features:**
   - Allow users to randomly generate data points or click to add custom points.
   - Provide action buttons: "Initialize Centroids", "Next Step", "Run to Completion", and "Reset".
   - Visually distinguish clusters using colors. Animate the movement of centroids to make the algorithm's logic easy to understand.
4. **Canvas Interaction Model (from `Memory/feedback.md` — REQUIRED):**
   - **Pen tool (feedback 2):** exactly **one point per press** at the cursor — never a burst — and holding + dragging adds points **one at a time** along the path. Ignores the density slider.
   - **Spray tool:** a spray can — hold the pointer down and points keep accumulating at the cursor **over time** (fixed cadence), independent of movement; moving while held moves the spray cone. Distinct from the brush, which only emits as the pointer travels.
   - **Spray brush tool:** drag on the canvas to spray points instead of placing one at a time. It must behave like a real paint-tool brush (reference: SAI Paint Tool 2), not a per-event spray:
     - `Brush size` slider — radius of the brush in screen pixels (constant across zoom levels).
     - `Density` slider — how many points per dab, so the user can control cluster mass. Distribution is centre-weighted, thinning toward the rim.
     - `Stabilizer` slider — smooths the brush position so strokes are fluid, not jittery; show the lag as a leash line from the cursor to the brush head while stroking.
     - **Dabs are spaced by distance travelled, not by pointer events** — a single fast jump must still paint a continuous stroke, and leftover distance carries into the next event.
     - `Eraser` mode — same brush geometry and same stroke engine, but removes every point inside the radius. Show the brush as a live ring cursor in all three modes.
   - **Navigation:** the canvas is a pannable/zoomable viewport, not a fixed coordinate box.
     - `Hand / pan` tool: drag to translate the view; middle-mouse or space-drag pans from any tool.
     - Zoom with the mouse wheel (and `+` / `-` / `Reset view` buttons), anchored at the cursor, clamped to a sane scale range.
     - All hit-testing, brush radius, and drawing must go through one world↔screen transform so points stay put under pan/zoom.
   - **Manual centroid control:**
     - Drag any centroid to a new position; the assignment step must recompute from the dragged position.
     - Click on empty canvas (in `Centroid` tool mode) to spawn a new centroid at the cursor — but only while the centroid count is below the current `k`; block the spawn and show a hint when `k` is reached.
     - Delete a centroid (right-click it, or select + `Delete`), which decrements the live centroid count and lets the user place a replacement.
     - Keep `k` and the on-canvas centroid count in sync in both directions, and display it as `centroids: m / k`.
   - **No point cap (feedback 2):** drawing must never stop silently. Any number of points can be added; keep the frame rate usable by batching one path per colour, culling off-view points, shrinking the dot radius as the count grows, and auto-disabling centroid connector lines past 2,000 points (state it in the UI).
   - **K and n are never capped at a fixed number (REQUIRED):**
     - `Clusters (K)` and `Random points (n)` are unbounded integer inputs — `min="1"`, **no `max`**. Any hard-coded ceiling (the old `K ≤ 8`, `n ≤ 400`) is a bug.
     - The only bound is the theory rule from `paybook/Clustering-k-mean.md` §"Valid range of K": **1 ≤ K ≤ N**. Enforce it at the point of use — `Initialize` and `Best of 10` refuse to run and say why; the control itself never silently rewrites what the user typed.
     - Report the constraint live next to the K box (`K ≤ N ✓`, `K > N — needs m more points`, `K = N → SSE 0`), and mark the field invalid rather than clamping it.
     - Duplicate points are the tighter bound: warn when the number of *distinct* positions is below K, but still run.
     - Cluster colours and names must be generated, not indexed out of a fixed 8-entry table — any K gets a distinct colour (golden-angle hues after the 8 base ones) and a name (A…Z, AA, AB…). The legend lists up to `LEGENDMAX` and then says "+n more".
   - **Tool state:** one explicit active tool (`Pen` / `Spray` / `Brush` / `Eraser` / `Hand` / `Centroid`) shown in the UI, switchable by click and by keyboard shortcut. Editing tools are disabled (not silently ignored) while an animation is running.
5. **Technical Constraints:**
   - Build a Single Page Application (SPA).
   - Use HTML5, CSS (Tailwind CSS via CDN is allowed), and Vanilla JavaScript (HTML5 Canvas or lightweight libraries like Chart.js via CDN).
   - Combine all HTML, CSS, and JS into a single, self-contained `index.html` file.

## 📤 Output Format Requirements
1. Deliver the complete application as a single self-contained `index.html` at the project root.
2. Ensure the code is ready to run locally in any standard web browser without a build process.
3. Document how to use the interactive website in `README.md` (English).

---

## ✅ Delivery Status — REVISION 2 DONE

| item | value |
|---|---|
| Deliverable | `index.html` (single file, no build step) |
| Docs | `README.md` |
| Rev 1 | ✅ delivered — verified in headless browser: 0 console errors, 0 failed requests, SSE monotonically decreasing, assignments = nearest centroid, centroids = cluster means |
| Rev 2 | ✅ delivered — class feedback (`Memory/feedback.md`) implemented, see §4 |
| Tests | `npm test` → 259 unit tests, **246 pass / 13 fail** · coverage line 97.8% / branch 96.8% / funcs 94.6% |
| Browser QA | `tests/browser.smoke.mjs` → 44/44, 0 console errors, 0 failed requests |
| ⚠️ Known-failing | the 13 failures are **stale bounded-canvas assertions** (`inWorld`, `clampPan`, `clampToView`, `resize`, "outside the data frame"). Commit `a62f2f0` turned the canvas infinite — `inWorld` now returns `true` for every point — but the tests still encode the old fixed frame. Decide the infinite-canvas semantics, then rewrite those tests; they are not a K/n regression (verified: identical failure set before and after). |

### Rev 2 checklist (`Memory/feedback.md` §Feedback from class)

| # | feedback item | status |
|---|---|---|
| 1 | Spray brush with size/density scale + eraser mode | ☑ `tools.test.mjs` (17) + `stroke.test.mjs` (34) |
| 1b | Spray can (time-based accumulation) + SAI-style stroke engine for brush/eraser | ☑ `stroke.test.mjs` — cadence, hold-to-build, continuity, spacing, carry, stabilizer |

### Feedback 2 checklist (`Memory/feedback.md` §Feedback 2)

| # | feedback item | status |
|---|---|---|
| 1 | Pen must plot **1 point per press** (not 8 at once); hold-drag adds one at a time | ☑ `stroke.test.mjs` › "pen (feedback 2: one press = one point)" — 14 tests |
| 2 | Drawing stops working after a while → make it **unlimited** | ☑ cap removed; `render.test.mjs` › "unlimited drawing (feedback 2)" — 6 tests + browser check at 2,000+ points |
| 2 | Pan (hand tool) + wheel zoom on the canvas | ☑ `view.test.mjs` (36 tests) |
| 3 | Drag centroids; click-to-spawn centroid capped at `k`; delete centroid | ☑ `tools.test.mjs` (25 tests) |

### K / n ceiling removal checklist

| # | item | status |
|---|---|---|
| 1 | K has no fixed maximum (was `≤ 8`) | ☑ `kn.test.mjs` › "the K control declares a minimum of 1 and no maximum at all" |
| 2 | n has no fixed maximum (was `≤ 400`) | ☑ `kn.test.mjs` › "the n control declares a minimum of 1 and no maximum at all" |
| 3 | theory rule 1 ≤ K ≤ N enforced at use, not by clamping the input | ☑ `kn.test.mjs` › "Initialize refuses K > N and says why" + "kFeasible is exactly N >= K" |
| 4 | K = 1 and K = N (SSE → 0) both run | ☑ `kn.test.mjs` › "K = 1 is legal" + "K = N is the degenerate boundary" |
| 5 | duplicate-point warning (distinct positions < K) | ☑ `kn.test.mjs` › "duplicate points are warned about" |
| 6 | colours/names/legend scale to any K | ☑ `kn.test.mjs` › "colours and names keep up with any K" (4 tests) |
| 7 | `pickInitial` cannot hang when K > N | ☑ `kn.test.mjs` › "pickInitial never hangs…" (this was an infinite `while` loop) |

**Rev 2 acceptance — all four verified by a named test:**

| acceptance criterion | test |
|---|---|
| points survive a pan/zoom round-trip at the same world coordinates | `view.test.mjs` › "data points never move in world coordinates, however you pan and zoom" |
| the eraser removes only points inside the brush radius | `tools.test.mjs` › "erases only points inside the ring and never touches the rest" |
| spawning past `k` is refused | `tools.test.mjs` › "placement stops at K and warns the user" |
| deleting a centroid leaves `m < k` with the algorithm still runnable | `tools.test.mjs` › "with one centroid deleted, m < k and the algorithm still runs" |

**Do not regress Rev 1:** the step machine, animation, SSE chart, presets, init strategies, and single-file constraint all stay.

**Bug caught by the suite while building Rev 2:** a `const busy` local inside `sync()` shadowed the
`busy()` helper declared later in module scope — a TDZ error that broke the page on boot. Renamed to
`isBusy`. Regression-guarded by every test that calls `sync()`.

**Implemented beyond the base spec**
- Step machine with an information panel + live-highlighted Lloyd's pseudocode
- Animated centroid movement (easeInOutCubic) with dashed movement trails
- Live SSE convergence chart
- 5 dataset presets that each demonstrate one documented K-means limitation
- Two initialization strategies (Random / Farthest-first) + `Best of 10 runs`, covering the playbook's "Dealing with Initialization" section

## 🧪 Test strategy (Rev 2)

| layer | file | what it proves |
|---|---|---|
| extract | `tests/extract.mjs` | pulls the real inline `<script>` out of `index.html` into an ESM module — **the tests run the shipped code, never a copy** |
| browser stub | `tests/dom.mjs` | minimal DOM + canvas stub that records every draw call with its arguments |
| unit | `tests/{view,algorithm,tools,stroke,render}.test.mjs` | 241 `node:test` assertions over geometry, k-means core, tool interaction, the pen/stroke/spray engines and rendering |
| e2e | `tests/browser.smoke.mjs` | real headless browser, real mouse/keyboard, asserts through the DOM only |

Run: `npm test` (fails the build below line 90% / branch 85% / funcs 90%) · `npm run test:quick` for a fast loop.

**Watch out:** patchright runs `page.evaluate` in an *isolated world*, so `window.__app` / `window.S` are
invisible to browser tests. Assert through the DOM instead — `#stN`, `#stCent`, `#lblZoom`, `#msg`,
`#phaseName`, and `#canvas[data-view]` (which mirrors `zoom,panX,panY`).

## 🔁 Feedback workflow (`Memory/`)

Run this loop at the start of **every** session and whenever the user says "มีฟีดแบ็กใหม่":

1. **Read** `Memory/feedback.md` in full — old sections included, since they define behaviour that must not regress.
2. **Diff against reality:** for each bullet, check the shipped `index.html` / tests for whether it is already satisfied. A bullet with no named test covering it counts as *not done*.
3. **Turn each open bullet into a spec line** under §4 of this file, phrased as observable behaviour (what the user must be able to do on the canvas), not as an implementation note.
4. **Implement** it in `index.html` (single file, no build step).
5. **Prove it** with at least one named test in `tests/` plus a headless-browser check — then add the row to the matching Rev / Feedback checklist below with the test name in the `status` column.
6. **Log it** to `log.md` with real numbers.

Rules:
- A bullet is only "done" when a named test points at it. No test → still open.
- `Memory/` decides **what to build**; `paybook/` decides **what to say about it**. If implementing a bullet adds or changes explanatory copy, check that copy against `paybook/Clustering-k-mean.md` (dispatch `kmeans-theory`) before reporting done.
- Feedback never overrides the algorithm. If a bullet would make the visualization contradict `paybook/Clustering-k-mean.md`, implement the interaction the user asked for, keep the algorithm correct, and say so in the report.
- Older feedback outranks new convenience: never satisfy a new bullet by breaking an older one.
- If a bullet is ambiguous, implement the reading that gives the user more direct control of the canvas, and state the assumption in the report.

## 🤖 Sub-agents (`.claude/agents/`)

Token-lean roster — dispatch instead of doing these inline.

| agent | model | use it for |
|---|---|---|
| `kmeans-ui` | sonnet | any change to `index.html`; edits surgically, never rewrites the file |
| `kmeans-verify` | haiku | `npm test` + headless-browser QA after every edit, before reporting done |
| `kmeans-theory` | haiku | checking explanatory copy against the knowledge base (`paybook/Clustering-k-mean.md`, `DA08 - Clustering.pdf`) |
| `worklog` | haiku | appending what was done to `log.md` as a table row, with real numbers |

**Rule:** for a one-file change, edit directly. Dispatch a sub-agent only when the work is genuinely separable — otherwise the spawn costs more tokens than it saves.