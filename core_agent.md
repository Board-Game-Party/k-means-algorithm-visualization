# Core Agent Instruction: K-Means Interactive Web Generator

## 🎯 Role & Objective
You are an Expert Frontend Web Developer AI Agent. Your objective is to take textual data or playbooks about the K-means clustering algorithm and transform them into a fully functional, interactive, and visually appealing web application.

## 📥 Input Data
- K-means algorithm documentation, playbook, or theoretical concepts provided by the user.

## 📝 Task Description
1. **Data Comprehension:** Analyze the provided K-means data to extract key steps: Initialization, Assignment, Update, and Convergence.
2. **UI/UX Design:** Create a clean, modern interface.
   - **Information Panel:** Display a brief explanation of the current K-means step based on the provided text.
   - **Visualization Area:** An interactive 2D coordinate system or canvas.
3. **Interactive Features:**
   - Allow users to randomly generate data points or click to add custom points.
   - Provide action buttons: "Initialize Centroids", "Next Step", "Run to Completion", and "Reset".
   - Visually distinguish clusters using colors. Animate the movement of centroids to make the algorithm's logic easy to understand.
4. **Canvas Interaction Model (from `paybook/feedback.md` — REQUIRED):**
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
| Rev 2 | ✅ delivered — class feedback (`paybook/feedback.md`) implemented, see §4 |
| Tests | `npm test` → 241 unit tests, 0 fail · coverage line **100%** / branch 97.5% / funcs 97.1% |
| Browser QA | `tests/browser.smoke.mjs` → 34/34, 0 console errors, 0 failed requests |

### Rev 2 checklist (`paybook/feedback.md`)

| # | feedback item | status |
|---|---|---|
| 1 | Spray brush with size/density scale + eraser mode | ☑ `tools.test.mjs` (17) + `stroke.test.mjs` (34) |
| 1b | Spray can (time-based accumulation) + SAI-style stroke engine for brush/eraser | ☑ `stroke.test.mjs` — cadence, hold-to-build, continuity, spacing, carry, stabilizer |

### Feedback 2 checklist (`paybook/feedback.md` §Feedback 2)

| # | feedback item | status |
|---|---|---|
| 1 | Pen must plot **1 point per press** (not 8 at once); hold-drag adds one at a time | ☑ `stroke.test.mjs` › "pen (feedback 2: one press = one point)" — 14 tests |
| 2 | Drawing stops working after a while → make it **unlimited** | ☑ cap removed; `render.test.mjs` › "unlimited drawing (feedback 2)" — 6 tests + browser check at 2,000+ points |
| 2 | Pan (hand tool) + wheel zoom on the canvas | ☑ `view.test.mjs` (36 tests) |
| 3 | Drag centroids; click-to-spawn centroid capped at `k`; delete centroid | ☑ `tools.test.mjs` (25 tests) |

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

## 🤖 Sub-agents (`.claude/agents/`)

Token-lean roster — dispatch instead of doing these inline.

| agent | model | use it for |
|---|---|---|
| `kmeans-ui` | sonnet | any change to `index.html`; edits surgically, never rewrites the file |
| `kmeans-verify` | haiku | `npm test` + headless-browser QA after every edit, before reporting done |
| `kmeans-theory` | haiku | checking explanatory copy against `paybook/Clustering-k-mean.md` |
| `worklog` | haiku | appending what was done to `log.md` as a table row, with real numbers |

**Rule:** for a one-file change, edit directly. Dispatch a sub-agent only when the work is genuinely separable — otherwise the spawn costs more tokens than it saves.