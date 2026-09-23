# Core Agent Instruction: K-Means Interactive Web Generator

## 🎯 Role & Objective
You are an Expert Frontend Web Developer AI Agent. Your objective is to take textual data or playbooks about the K-means clustering algorithm and transform them into a fully functional, interactive, and visually appealing web application.

## 📥 Input Data

Two sources, two different jobs. Never mix them up.

| source | what it is | how to use it |
|---|---|---|
| `paybook/` + `DA08 - Clustering.pdf` | **Knowledge base** — the K-means theory and the playbooks this work is built on | Read to get the algorithm right. It is the authority for every explanatory sentence on the page. It never contains work items. |
| `Memory/feedback.md` | **Feedback store** — what the user/class wants fixed or improved in what already exists | Read to get the work list. Every bullet is a task. |
| `Memory/*_feature.md` | **Feature specs** — a whole new capability, written up on its own | Read to get the spec for one new feature. Build it; do not touch unrelated work. |

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
- **`Memory/<name>_feature.md` — a feature specification. One file, one new capability.**
  - These are **additive**: a `*_feature.md` asks for something that does not exist yet, unlike `feedback.md`,
    which corrects something that does. Build the feature and **leave every other behaviour alone** — no
    refactors, no "while I'm here" fixes to unrelated code.
  - The file carries its own behaviour table, animation timings, CSS and edge cases. Treat those as the spec;
    where it leaves a gap, follow the conventions already in `index.html` rather than inventing a new style.
  - Same proof bar as feedback: named tests in `tests/` plus a headless-browser check, then a checklist row
    in this file and a `log.md` entry.
  - Shipped so far: `Memory/cluster_focus_feature.md` → see the Cluster focus checklist below.

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
     - The bound is the theory rule from `paybook/Clustering-k-mean.md` §"Valid range of K", tightened by
       feedback 6 to the form that is actually true: **1 ≤ K ≤ distinct(N)**, and **n ≥ K**.
       `kCap()` is `distinctPoints()`, and `kFeasible()` is measured against it — identical points always
       share a nearest centroid, so K copies of one coordinate can never be split into K clusters.
       `Initialize` and `Best of 10` refuse to run and say why.
     - Report the constraint live next to the K box — `K ≤ N ✓ (N = 1936)`, or `(N = 1936, distinct = 1930)`
       when the two differ, or `K > distinct positions — needs m more distinct points` — and mark the field
       invalid.
     - **K ↔ n are clamped to each other (feedback 6, task 3).** Raising K drags n up; lowering n drags K
       down, so the pair can never settle in the unusable `n < K` state. This is a deliberate, *narrow*
       override of feedback 3's "never silently rewrite what the user typed": the clamp fires **only on
       commit** — a slider step, or `change` (blur / Enter) on a box — and **never per keystroke**, so
       typing `1672` one digit at a time is not fought. Feedback 3's real guarantee, that the boxes carry
       no `max` and a half-typed value is never rewritten, is intact.
       K's relation to **N** is still report-only (see the feedback 5 rule): only K ↔ **n** is clamped.
     - **Both a slider and a typed box (feedback 4).** Each of K and n is offered twice: an uncapped
       `<input type="number">` and an `<input type="range">` scrubber beside it, kept in sync both ways and
       running through one code path. A range input must declare a `max`, so **the box is the authority** — it
       is the half that is never capped and never rewritten. The two tracks are bounded differently, on purpose:
       `n` has no natural ceiling, so its track ratchets up to whatever was typed and never shrinks; `K` does
       have one (N), so its track stops there — see the feedback 5 rule below.
     - **The controls must embody 1 ≤ K ≤ N, not just report it (feedback 5).** The K slider's top end
       **is exactly N**, the live data-point count, and it never stretches past it for any reason:
       *"Data point = 999 → slider bar ต้องลากได้แค่ 999 · Data point = 696 → slider bar ≤ 696
       เราจะลากเกินไม่ได้."* Dragging simply cannot reach an infeasible K.
       Typing still wins for the **value** (feedback 3): a K above N stays in the box, turns it red and
       blocks `Initialize` — the thumb just pins at the top end, because a thumb position past N would
       depict a clustering the theory does not allow. `kSlideMax()` is `kCap() || KSLIDE` — the distinct
       count since feedback 6 task 5 — and depends on nothing else, so the track cannot rescale under a
       thumb mid-drag either.
     - **`n` is what `N` will become, so it must be exact (feedback 5).** `New random data` generates
       **exactly** n points for every preset — largest-remainder `split()`, never `Math.round(n / g)` per
       blob. "Roughly n" silently changes whether a given K is legal. The n control also reports ahead of
       time whether the pair will satisfy the rule (`n ≥ K ✓ · generates exactly n points` / `n < K — …`).
     - **`🎲` is a real tool and `n` is its tool option (feedback 5 → 6 → 7).** Feedback 5 required the
       value and its button to stay adjacent; feedback 6 moved them into the tools bar; **feedback 7 settled
       the form**: `🎲` is a `.tool` button in the same group as the pen and the brush (`data-tool="random"`,
       shortcut `R`), and `#randOpts` — `n` box + `n` slider + `🎲 Generate` + `#nNote` — is its option
       panel, shown **only while that tool is active**, in the very slot `#brushOpts` uses. Exactly the way
       `Size` belongs to the brush.
       The tool is deliberately inert on the canvas: selecting it draws nothing, because generating replaces
       the whole dataset and must stay an explicit act (`Generate`, or `G` from any tool).
     - **The n track must always reach the K track (feedback 6, task 2).** `nSlideMax() ≥ kSlideMax()`
       always, or a user stuck at `K > n` could not drag n up to escape — a dead-end control.
     - **Possible is not the same as meaningful (feedback 6, task 7).** Beyond the hard rule, `kQualityHint()`
       grades the choice and `#kNote` takes one of four states: red `.warn` + buttons disabled (K > distinct,
       or n < K) · amber `.caution` (K = N, or under 2 points per cluster) · grey `.hint` (K > 2√N) ·
       plain green tick otherwise. Only the red band ever disables anything.
     - **Empty clusters are repaired, not merely survived (feedback 6, task 6).** A cluster can come out
       empty even when K ≤ N. `meanUpdate()` re-seeds an empty centroid onto the point furthest from its own
       centroid, claiming each point at most once and only drawing from clusters with ≥ 2 members, so a
       repair can never empty another cluster. With nothing to spare the centroid holds position. The count
       is surfaced in the step message and accumulated on `S.emptyFixed`.
     - Cluster colours and names must be generated, not indexed out of a fixed 8-entry table — any K gets a distinct colour (golden-angle hues after the 8 base ones) and a name (A…Z, AA, AB…). The legend lists up to `LEGENDMAX` and then says "+n more".
   - **Cluster status click-to-focus (`Memory/cluster_focus_feature.md`):** the legend is not a passive
     key — every cluster on it is a button.
     - Clicking one **flies the canvas to that cluster**: a 500 ms easeInOutCubic pan + zoom onto the
       cluster's bounding box with 15 % padding. Clicking the **same** one again flies back out to fit
       everything; clicking a **different** one retargets mid-flight instead of fighting the first tween.
     - While focused, that cluster's points stay solid and every other cluster is drawn at
       `DIMALPHA = 0.2`; the status bar marks the chosen item `.active` (underlined in its own colour via
       `--cc`) and fades the rest to `.dimmed`.
     - A one-point cluster must not zoom to absurdity — the focus zoom is capped at `FOCUSZMAX` on top of
       the global `ZMAX`.
     - **The focus can never outlive what it points at.** `sync()` drops it whenever
       `S.focus >= S.centroids.length` (K lowered, centroid deleted, points cleared), and `doInit` /
       `hardReset` clear it outright, so re-running k-means always starts from the overview.
   - **Tool state:** one explicit active tool (`Pen` / `Spray` / `Brush` / `Eraser` / `Hand` / `Centroid` / `Random`) shown in the UI, switchable by click and by keyboard shortcut (`P` `S` `B` `E` `H` `C` `R`). Editing tools — `Random` included — are disabled (not silently ignored) while an animation is running; only `Hand` stays live.
5. **Technical Constraints:**
   - Build a Single Page Application (SPA).
   - Use HTML5, CSS (Tailwind CSS via CDN is allowed), and Vanilla JavaScript (HTML5 Canvas or lightweight libraries like Chart.js via CDN).
   - Combine all HTML, CSS, and JS into a single, self-contained `index.html` file.

## 📤 Output Format Requirements
1. Deliver the complete application as a single self-contained `index.html` at the project root.
2. Ensure the code is ready to run locally in any standard web browser without a build process.
3. Document how to use the interactive website in `README.md` (English).

---

## ✅ Delivery Status — REVISION 2 DONE (Feedback 1–7 closed · 1 feature spec shipped)

| item | value |
|---|---|
| Deliverable | `index.html` (single file, no build step) |
| Docs | `README.md` |
| Rev 1 | ✅ delivered — verified in headless browser: 0 console errors, 0 failed requests, SSE monotonically decreasing, assignments = nearest centroid, centroids = cluster means |
| Rev 2 | ✅ delivered — class feedback (`Memory/feedback.md`) implemented, see §4 |
| Tests | `npm test` → 342 unit tests, **342 pass / 0 fail** · coverage line 99.4% / branch 96.3% / funcs 96.5% |
| Browser QA | `npm run verify:browser` → 105/105, 0 console errors, 0 failed requests |

### Canvas semantics — settled: the canvas is infinite

Commit `a62f2f0` made the canvas infinite but left the bounded-frame machinery behind as stubs
(`inWorld` returning `true` for everything, empty `clampPan` / `clampToView`), which silently turned
13 tests into stale assertions. The semantics are now decided and the dead code is gone:

| rule | where it is enforced |
|---|---|
| **No world boundary.** Pen, spray, brush and centroids place at the cursor wherever it is — there is no "outside the data frame". | `inWorld` deleted, with its three guard sites |
| **The pan is never clamped.** Dragging the hand 5,000px moves the view exactly 5,000px; `Focus` / `Reset view` are how you get back. | `clampPan` deleted; the pan handler calls `markView()` |
| **Resize moves nothing.** Changing the window recomputes `unit` / `LX` only — no point, centroid or pan offset is pulled back. | `clampToView` deleted; `resize()` calls `markView()` |
| **Zoom is still clamped** to `ZMIN = 0.05 … ZMAX = 8` — a scale range, not a world bound. | `zoomAt` |
| Only **generated** data is bounded (`clampPt`), so a new preset always lands on screen. | `generate` |

Rewritten tests: `view.test.mjs` › "the canvas is infinite: the transform is valid arbitrarily far outside the frame",
"the pan is never clamped to the right/left", "vertical panning is unbounded in both directions",
"zooming out is clamped at ZMIN = 0.05", "resize … leaves the pan exactly where it was",
"resize never moves a point / drags an off-screen centroid back" · `stroke.test.mjs` › "the pen places a point anywhere",
"spraying works outside the visible frame too", "every point along a stroke lands within the brush radius of the drag path"
· `tools.test.mjs` › "painting outside the visible frame still adds points", "a centroid can be placed outside the visible frame",
"dragging a centroid far off screen is not clamped back" · `algorithm.test.mjs` › the preset tests now assert real `0…LX` / `0…LY` bounds
instead of calling the vacuous `inWorld`.

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

### Feedback 3 checklist (`Memory/feedback.md` §Feedback 3)

| # | feedback item | status |
|---|---|---|
| 1 | paybook must state the K ↔ n relationship, `K ≤ n` | ☑ `paybook/Clustering-k-mean.md` §"Valid range of K (K ≤ N)" — 1 ≤ K ≤ N, K = 1 and K = N boundaries, distinct-positions caveat |
| 2 | K and n controls become typed **input fields**, not sliders, still obeying `K ≤ n` | ☑ `index.html` `#inK` / `#inN` are `<input type="number" min="1" step="1">` with no `max`; `kn.test.mjs` › "the K control declares a minimum of 1 and no maximum at all" + "Initialize refuses K > N and says why" |

### Feedback 4 checklist (`Memory/feedback.md` §Feedback 4)

| # | feedback item | status |
|---|---|---|
| 1 | "UI use both Slider and Input field" — K and n each get a slider *and* a typed box | ☑ `#inK`+`#inKR`, `#inN`+`#inNR`; `kn.test.mjs` › "K is offered as a number box AND a range slider" + "n is offered as…" |
| 2 | both halves stay in sync, in both directions | ☑ `kn.test.mjs` › "dragging the K slider drives K, the label and the number box" + "typing in the K box moves the slider" + "dragging the n slider drives n, and generate honours it" |
| 3 | the slider must not reintroduce the ceiling feedback 3 removed | ☑ `kn.test.mjs` › "the number boxes are still the uncapped ones (feedback 3 is not regressed)" + "a typed K far above the track's top end is kept by the box, not capped" + "the n slider stretches to a typed n far past its default top" + "the far end of the K track is the largest legal K, never an infeasible one" |
| 4 | scrubbing takes the same code path as typing (trimming, warnings, K ≤ N note) | ☑ `kn.test.mjs` › "scrubbing K down trims the extra centroids, exactly like typing does"; the shared `applyK()` |
| 5 | the track never rescales under the thumb mid-drag | ☑ `kn.test.mjs` › "the track depends only on N, so nothing can rescale it under the thumb mid-drag" (K) + "the n slider stretches to a typed n far past its default top" (n still ratchets) |

**Assumption stated (per the ambiguity rule):** "use both" is read as *one value, two controls* — not two
independent settings. The typed box remains the source of truth precisely because feedback 3 said K and n must
never be silently rewritten, and only an adaptive, ratcheting slider range can honour that alongside a slider.

### Feedback 5 checklist (`Memory/feedback.md` §Feedback 5)

| # | feedback item | status |
|---|---|---|
| 1 | "K value and data point don't relate along theory · K values ≤ N" — the K **control** must embody the bound, not merely report it | ☑ `kn.test.mjs` › "the K slider's top end is N — scrubbing cannot reach an infeasible K" + "the slider top follows N as the data changes" |
| 2 | …without regressing feedback 3 (a typed value is never rewritten) | ☑ `kn.test.mjs` › "typing a K above N still sticks and is flagged (feedback 3 is not regressed)" — box keeps 57, track still stops at 20, thumb pins |
| 3 | "random point value and button generate random data point should live closely" — **exactness**: n is what N becomes, so the rule must answer for the number actually typed | ☑ **real bug fixed** — every preset missed n by ±1 (`Math.round(n / g)` per blob). New largest-remainder `split()`. `kn.test.mjs` › "every preset generates EXACTLY n points, not roughly n" (45 combinations) + "split() hands out exactly the total it was given" + "an exact n means the K ≤ N rule answers for the number the user actually typed" |
| 4 | "…should live closely" — **proximity**: the button belongs with the value it reads | ☑ `🎲 New random data` moved into the `Random points (n)` group; `kn.test.mjs` › "the generate button lives with the n control it reads, not off in the button row" + a browser check on the live DOM |
| 5 | the n control states the K relationship before you press the button | ☑ `kn.test.mjs` › "the n control says up front whether n will support the current K" |
| 6 | "slider bar ให้ K กับ data point relate กัน · Data point = 999 → ลากได้แค่ 999 · = 696 → ≤ 696 · **ลากเกินไม่ได้**" | ☑ `kSlideMax()` = `kCap() \|\| KSLIDE` — the track is the distinct count and never stretches past it; `kn.test.mjs` › "the feedback-5 examples hold literally: N = 999 → drag to 999, N = 696 → drag to 696" + "the track is exactly N throughout — before, during and after a typed overshoot" + "the far end of the K track is the largest legal K, never an infeasible one" + browser checks that push the thumb past the end at both 999 and 696 and watch it clamp |

**Both readings implemented.** "Should live closely" is ambiguous between *proximity* (put the button next
to the box) and *agreement* (the generated count should match the value). Both were true problems — the
generated N really was off by ±1 — so both are fixed rather than one guessed at.

**Correction made in the second pass.** The first attempt at bullet 1 still let the track *stretch* above N
when a larger K had been typed (a ratchet carried over from feedback 4), so at N = 696 with K = 1500 typed you
could still drag past 696. The third bullet ruled that out explicitly, so the ratchet is gone for K: the track
is `N`, nothing else. Two feedback-4 tests had to be rewritten as well — they still passed, but only because
their N happened to exceed the typed K, so their names ("the K slider stretches to fit…") described behaviour
that no longer existed. A test whose name lies is the exact debt cleaned up in §"Canvas semantics"; don't rebuild it.

**Trade-off, stated:** tying the track to N is what makes the control honest to the theory, but it makes
scrubbing coarse at large N (at N = 999, K = 3 sits ~0.3% along the track). The number box is the precise path
and is still uncapped. This is the user's explicit instruction, so it stays; if the coarseness ever outweighs
the bound, a non-linear (log) track would keep both.

### n / K conditions checklist (`Memory/feedback.md` §"งาน: แก้เงื่อนไข n / K …")

Rules restated by this feedback: `1 ≤ K ≤ distinct(N)` and `n ≥ K`.

| task | item | status |
|---|---|---|
| 1 | the `n < K` warning is misread as "n must be below K" → lead with the rule | ☑ `Need n ≥ K — n = 1564 is less than K = 1672. Increase n or lower K.` · `kn.test.mjs` › "Task 1 — the n warning reads 'Need n ≥ K', never 'n < K'" (asserts the exact string and that it does **not** open with `n < K`) |
| 2 | the n track must reach at least as far as the K track | ☑ `nSlideMax() ≥ kSlideMax()` · `kn.test.mjs` › "Task 2 — the n slider's top end is never below the K slider's" + "…dragging n to its far end always reaches at least K" |
| 3 | clamp K ↔ n, on commit not per keystroke | ☑ `raiseNfor()` / `lowerKfor()` · `kn.test.mjs` › "Task 3 — raising K past n drags n up with it" + "…lowering n below K drags K down with it" + "…the boxes clamp on commit, never mid-keystroke" + "…committing a small n pulls K down to match" + "…n = K exactly is runnable and fills every cluster" |
| 4 | re-check inside the generator, and disable the button | ☑ `generate()` refuses and says why; `#bGen` disabled while `n < K` · `kn.test.mjs` › "Task 1/4 — New random data is disabled while n < K" + "Task 4 — generate() itself refuses n < K even if the button were reachable" |
| 5 | use **distinct** positions as the cap on K | ☑ `kCap() = distinctPoints()`, memoised · `kn.test.mjs` › "Task 5 — the K track stops at the distinct count, not the raw point count" + "…the K note spells out both counts when they differ" + "…the distinct count is memoised but never goes stale" + "distinct positions, not the raw count, are what K is measured against" |
| 6 | repair empty clusters during iteration | ☑ `meanUpdate()` re-seeds · `algorithm.test.mjs` › "empty-cluster repair (feedback 6, task 6)" — 6 tests covering the re-seed target, two empties landing apart, never draining a donor, finite SSE/MAX MOVE after a full round, the reported count, and silence on a healthy run |
| 7 | soft warnings when K is technically legal but meaningless | ☑ `kQualityHint()` + `.warn`/`.caution`/`.hint` · `kn.test.mjs` › "Task 7 — K = N is flagged amber as meaningless, but still runs" + "…fewer than 2 points per cluster is amber" + "…a K above 2√N is a soft grey hint" + "…an ordinary K says nothing but the green tick" + "…kQualityHint covers its four bands directly" |

**Two deliberate overrides of older feedback, both flagged rather than slipped in:**

1. **Task 3's clamp vs feedback 3's "never silently rewrites what the user typed".** Implemented as the spec
   directs — clamping on **commit only** (slider step, or `change`/blur/Enter on a box), never per keystroke.
   The dead-end it fixes is real: at K = 1672 with the n track ending at 1564 there was no way to drag out of
   the bad state. §4 has been rewritten so the spec no longer contradicts itself.
2. **Task 5 + task 7's table vs the old "duplicate-point warning … but still run".** The new table is explicit
   (`K > distinct N → แดง → ปิดปุ่ม: ใช่`), so `Initialize` now **refuses** instead of warning-and-running, and
   the K/n ceiling checklist row below is superseded. The old test asserting "it still runs — the warning is
   advisory" was rewritten accordingly.

**Task 6's premise did not hold, and the spec asked me to check first.** `meanUpdate()` already guarded
`count === 0` by holding the centroid in place, so there was **no `NaN` bug** to fix. The relocation is still
a genuine improvement (it drives SSE down instead of stranding a centroid), so it was implemented — with two
guards the spec's sketch lacked: a donor cluster must keep at least 2 members, and each point is claimed at
most once. Without the first guard, the sketch would have emptied a single-member cluster to fill another and
looped forever.

**Task 5's "สุ่มแบบไม่ซ้ำ (ใช้ Set กันซ้ำ)" was done differently:** the generator draws floating-point
gaussians/uniforms, so exact duplicates essentially never arise from it — de-duplicating the sampler would be
dead code. Duplicates in practice come from the user clicking the same pixel twice, or from `clampPt` pinning
several points to a boundary, and `distinctPoints()` catches both.

**Performance note:** `distinctPoints()` is O(N) and `syncBounds()` runs every frame, which would have been a
real cost against the "unlimited points" requirement. It is memoised on (array identity, length); every path
that changes the data either replaces the array or changes its length, and nothing mutates a point's x/y in
place, so the cache cannot go stale — guarded by `kn.test.mjs` › "…memoised but never goes stale".

### Feedback 6 checklist (`Memory/feedback.md` §Feedback 6)

| # | feedback item | status |
|---|---|---|
| 1 | "move random button to tools bar" | ☑ `#bGen` moved out of the controls grid into `.toolbar` · `kn.test.mjs` › "the random group sits in the tools bar, not in the controls grid" |
| 2 | "randompoint function this opption for randombutton tools" — n becomes the button's own option | ☑ `#randOpts` holds `#bGen` + `#inN` + `#inNR` together, mirroring how `Size`/`Flow`/`Smooth` are the brush's options · `kn.test.mjs` › "the generate button lives with the n control it reads, not off in the button row" (rewritten to assert **containment in `#randOpts`** rather than source ordering) |
| 3 | …without making 🎲 a canvas mode | ❌ **reversed by feedback 7** — this was my reading, not the user's. See the feedback 7 checklist below. |

**Assumption stated — and it was wrong.** I read "option for random button tools" as *keep 🎲 an action
button and park n beside it*, explicitly rejecting the seventh-tool reading because it costs an extra click.
Feedback 7 corrected that: the user wants the literal tool form. The extra click was the user's to weigh, not
mine to rule out. Recorded here rather than quietly overwritten — the misread is the useful part.

**Knock-on cleanups:** `#lblN` was a duplicate readout of the n box and is gone, along with its stub entry in
`tests/dom.mjs` — a stub id the real page lacks would let a test pass against an element the browser returns
as `null`. The freed grid column went to `Clusters (K)` (`lg:col-span-2`), which also widens the K track and
softens the scrubbing-coarseness trade-off noted under feedback 5. `G` generates from the keyboard, and says
why when `n < K` blocks it.

### Feedback 7 checklist (`Memory/feedback.md` §Feedback 7)

> "ให้ย้าย Radombutton ไป ในtoolsbar **จริงๆเหมือน bush หรือpen** ส่วน fuction randompotion ให้เป็น
> **เหมือนการปรับขนาดปากกา** นั่นแหละ เป็น optionของ Randombutton"

| # | feedback item | status |
|---|---|---|
| 1 | 🎲 must be a real tool button, like the brush or the pen — not an action parked in the bar | ☑ `<button class="tool" data-tool="random">` in the same group, `TOOLS.random`, shortcut `R` · `kn.test.mjs` › "🎲 is a real tool button, sitting with the pen and the brush" (`.tool` count is now **7**) |
| 2 | n must behave like the pen/brush size option — an option **of** that tool | ☑ `#randOpts` sits beside `#brushOpts` and is shown only while 🎲 is active, by the same `sync()` line · `kn.test.mjs` › "n behaves like the brush's Size: shown only while its tool is active" + "n, its slider and Generate all live in the 🎲 tool's own option group" |
| 3 | the tool must behave like a tool in every other respect | ☑ selectable by click and by `R`, shown as `.on`, disabled mid-run like the other editing tools · `kn.test.mjs` › "the R shortcut selects the 🎲 tool, and G still generates" + "🎲 is disabled mid-run like every other editing tool" + "selecting 🎲 leaves the canvas alone — it is not a drawing tool" |

**This reverses my feedback-6 judgement, at the user's explicit direction.** I had argued against the seventh
tool because it puts a click between the user and `Generate`. That cost is real and is now paid: with any
other tool active, `#randOpts` (and therefore `Generate`) is hidden, so generating means selecting 🎲 first.
Two mitigations keep it cheap — `G` generates from **any** tool, and `R` selects 🎲 in one keystroke.

**The browser suite proved the cost rather than hiding it.** Twelve existing checks called
`page.locator("#bGen").click()` with another tool active and began timing out on a hidden element — the
suite failing exactly where a user would now have to change tools. They were routed through a `genData()`
helper that selects 🎲 first, which is the honest encoding of the new flow.

### Cluster focus checklist (`Memory/cluster_focus_feature.md`)

New tests live in their own file, `tests/focus.test.mjs` (30 tests), so the feature is additive in the suite too.

| spec item | status |
|---|---|
| status bar items are clickable, with hover / pointer affordance | ☑ `.cluster-status-item` + `role="button"` + `tabindex="0"` · `focus.test.mjs` › "the status items advertise themselves as clickable buttons" + "the stylesheet carries the hover, active and dimmed states" |
| click → smooth pan + zoom onto that cluster | ☑ `focusCluster` → `tweenView(viewFor(clusterBox(i)))` · `focus.test.mjs` › "the view really travels, and lands on the framing view" + "it eases rather than jumping" |
| bounding box + ~15 % padding, centred | ☑ `focus.test.mjs` › "viewFor frames the box: its centre lands in the middle of the viewport" + "viewFor leaves padding — the cluster never touches the viewport edge" |
| click the same cluster again → zoom back out | ☑ `focus.test.mjs` › "clicking the same cluster again zooms back out" + "zooming back out frames everything again" |
| focused cluster highlighted, others dimmed to ~0.2 on the canvas | ☑ `ctx.globalAlpha` per colour batch · `focus.test.mjs` › "while focused the other clusters are painted faint and the chosen one stays solid" + "the alpha is handed back so nothing after the points is left faded" |
| active indicator on the status bar, others faded | ☑ `.active` / `.dimmed` classes · `focus.test.mjs` › "the focused item is marked active and the others are dimmed" |
| 500 ms pan/zoom, easeInOutCubic | ☑ `FOCUSMS = 500`, same easing as the centroid animation |
| edge: a single-point cluster must not over-zoom | ☑ `FOCUSZMAX` · `focus.test.mjs` › "a single-point cluster does not zoom in absurdly far" |
| edge: changing cluster mid-animation cancels the old tween | ☑ generation token, not `cancelAnimationFrame` · `focus.test.mjs` › "retargeting mid-flight abandons the first tween instead of fighting it" |
| edge: re-running k-means resets the view | ☑ `focus.test.mjs` › "re-running k-means returns to the overview" + "clearing the data drops the focus" + "generating new data drops the focus" |
| edge: cluster deleted / K changed resets the focus | ☑ the `S.focus >= S.centroids.length` guard in `sync()` · `focus.test.mjs` › "lowering K below the focused cluster drops the focus" + "deleting the focused centroid drops the focus" |

**Real-DOM coverage matters here.** The legend is rebuilt by `sync()` on every frame, so the click is
delegated on `#legend` — and a delegated handler cannot fire against the unit-test stub, whose `innerHTML`
is a plain string with no child elements. `npm test` reports those handler lines as the only uncovered ones
in the feature; `browser.smoke.mjs` (12 new checks) is what actually clicks them.

**Two notes on how this was built**

1. `cancelAnimationFrame` is a **no-op in `tests/dom.mjs`**, so cancelling a tween by handle alone would have
   looked correct in tests and only half-worked in the browser. `tweenView` therefore guards with a
   generation counter that a superseded frame checks before doing anything — correct in both worlds.
2. The canvas stub recorded draw *calls* but not the paint *state*, so alpha was invisible to tests. It now
   snapshots `{alpha, style}` on each `fill` (`__calls._fills`), which is what lets the dimming be asserted
   rather than assumed.

**Snag worth remembering:** `tests/dom.mjs` replaces `globalThis.performance` with a fake clock, and
`node:test` reads the same global when it runs a **single file** in-process. `focus.test.mjs` originally
advanced that clock by 8 s while settling tweens, which stalled the runner (`node --test tests/focus.test.mjs`
hung with near-zero CPU, though the full glob run passed). Bounding the settle loop to the ~13 frames the
tween actually needs fixed it. Do not over-advance `dom.advance()`.

### K / n ceiling removal checklist

| # | item | status |
|---|---|---|
| 1 | K has no fixed maximum (was `≤ 8`) | ☑ `kn.test.mjs` › "the K control declares a minimum of 1 and no maximum at all" |
| 2 | n has no fixed maximum (was `≤ 400`) | ☑ `kn.test.mjs` › "the n control declares a minimum of 1 and no maximum at all" |
| 3 | theory rule 1 ≤ K ≤ N enforced at use, not by clamping the input | ☑ `kn.test.mjs` › "Initialize refuses K > N and says why" + "kFeasible is exactly N >= K" |
| 4 | K = 1 and K = N (SSE → 0) both run | ☑ `kn.test.mjs` › "K = 1 is legal" + "K = N is the degenerate boundary" |
| 5 | duplicate positions bound K (**superseded by feedback 6 task 5**: now a hard refusal, not an advisory warning) | ☑ `kn.test.mjs` › "distinct positions, not the raw count, are what K is measured against" |
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
| unit | `tests/{view,algorithm,tools,stroke,render,kn,focus}.test.mjs` | 342 `node:test` assertions over geometry, k-means core, tool interaction, the pen/stroke/spray engines, rendering, the K/n controls and empty-cluster repair |
| e2e | `tests/browser.smoke.mjs` | real headless browser, real mouse/keyboard, asserts through the DOM only |

Run: `npm test` (fails the build below line 90% / branch 85% / funcs 90%) · `npm run test:quick` for a fast loop.

**Watch out:** patchright runs `page.evaluate` in an *isolated world*, so `window.__app` / `window.S` are
invisible to browser tests. Assert through the DOM instead — `#stN`, `#stCent`, `#lblZoom`, `#msg`,
`#phaseName`, and `#canvas[data-view]` (which mirrors `zoom,panX,panY`).

## 🔁 Feedback workflow (`Memory/`)

`Memory/` carries two kinds of work item and they are handled differently:

| file | means | how to treat it |
|---|---|---|
| `feedback.md` | fix or change something that already exists | work the newest `# Feedback N` section first, then re-verify the older ones have not regressed |
| `<name>_feature.md` | build something new | build exactly that feature, additively; **change no other behaviour**, and add its tests in their own file |

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