# K-Means Clustering — Interactive Visualizer

A single-page web app for learning Lloyd's algorithm one step at a time.
Built from the `paybook/Clustering-k-mean.md` playbook.

## Running it

Double-click `index.html` and open it in any browser — no build, no install, no server.

The layout is designed to fit **one screen with no scrolling**: on displays ≥1280px wide the page locks to the
viewport height, the canvas stretches into whatever space is left (always at an equal scale on both axes), and the
theory panel on the right scrolls inside itself. Below that width it falls back to a normal scrolling page.

### A suggested path through it

| Step | Do this | Watch for |
|---|---|---|
| 1 | Press **🎲 New random data** · tap points with the **✒️ pen** · draw a line with the **🖌️ brush** · build a blob with the **💨 spray** | grey points are not yet assigned |
| 2 | Set **K**, then press **Initialize Centroids** | the ringed cross markers are the centroids |
| 3 | Press **Next Step** repeatedly | even steps = *Assign* (points recolour to their nearest centroid) · odd steps = *Update* (centroids move) |
| 4 | Press **Run to Completion** | it runs to convergence; press again to stop early |
| 5 | Watch the **Convergence history (SSE)** chart | SSE must fall and then flatten out |

### 🧰 Canvas tools

The bar above the canvas holds five drawing/navigation tools. Click a button or press its shortcut — the active
tool is highlighted in blue.

| Tool | Key | What it does |
|---|:--:|---|
| ✒️ **Pen** | `P` | Puts down **exactly one point per press**, right at the cursor, ignoring the flow slider. Hold and drag and the points come out **one at a time** along the path. |
| 💨 **Spray** | `S` | **Hold the button and points keep piling up** at the cursor — the longer you hold, the denser it gets. Move while spraying and the cone follows. Good for building clusters of deliberately different density. |
| 🖌️ **Brush** | `B` | Drag to paint a **continuous stroke** of points. Tune Size, Flow and Smooth (see below). |
| 🧽 **Eraser** | `E` | Drag to **delete every point inside the ring**. Uses the same stroke engine as the brush, so a fast drag never leaves gaps. |
| ✋ **Hand** | `H` | Drag to **pan the view**. |
| 🎯 **Centroid** | `C` | **Drag** a centroid to move it · **click empty space** to add one · **right-click**, or select and press `Delete`, to remove one. |

**The brush behaves like a paint tool (modelled on SAI Paint Tool 2)**

| Slider | Meaning |
|---|---|
| **Size** | Brush radius in screen pixels — constant at every zoom level, so zooming in gives finer control. Shared with the spray and the eraser. |
| **Flow** | How many points land per dab (or per spray tick). The ink is dense in the middle and thins toward the rim. |
| **Smooth** | A *stabilizer* that damps the brush head so strokes glide instead of jittering. While you drag, a dashed leash shows the lag between your hand and the head. Used by the brush and eraser; the spray does not need it. |

Dabs are spaced **by distance travelled, not by pointer events** — one fast flick across the canvas still paints a
continuous stroke, the density is identical everywhere along it, and leftover distance carries into the next event
instead of being discarded.

**How the three drawing tools differ**

| | Pen ✒️ | Brush 🖌️ | Spray 💨 |
|---|---|---|---|
| One press gives | **1 point** | 1 dab (= Flow points) | 1 puff, then it keeps going |
| Points are added | per distance dragged (one at a time) | per distance dragged (continuous dabs) | **per unit of time** — it builds even while still |
| Point placement | exactly on the cursor | scattered in the ring, dense at the centre | scattered in the ring, dense at the centre |

**There is no cap on the number of points.** Drawing never stops silently. Past 2,000 points the app switches off
the centroid connector lines automatically (the checkbox says so) and shrinks the dot radius as the count grows, so
drawing stays smooth however much you paint.

**Panning and zooming**

- The mouse wheel zooms **around the point under the cursor** (40%–800%).
- The `−` / `+` / `⟲ View` buttons sit at the right of the toolbar; the `+` `-` `0` keys do the same.
- **Middle mouse button** or **hold Space and drag** pans from any tool, with no need to switch to the hand.
- The numbers along the bottom edge are the real x coordinates of the view edges, so they change as you pan and zoom.
- Points and centroids all live in the same world coordinates: **no amount of panning or zooming moves the data**.

**Editing centroids by hand**

- The **Centroids** stat shows the live count as `m / k`. You may place up to `K`; beyond that the app warns you and refuses.
- Want more? Raise the **K** field (already-placed centroids are kept). Lower it below the current count and the extras are trimmed.
- Deleting centroids until `m < k` is fine — the algorithm keeps running with what is left. **Initialize** always resamples a full set of `K`.
- Every manual move, add or delete **reassigns the points from the new position immediately** and restarts the iteration
  count (the old SSE curve is no longer comparable).
- While **Run to Completion** is going, editing tools are locked and say so — but you can still pan and zoom freely.

### Buttons and controls

- **K** — number of clusters, offered as **both a slider and a typed box** — drag to scrub, or type an exact value;
  the two always show the same number. The **slider runs from 1 to N**, the live data-point count, so dragging it
  can never ask for more clusters than you have **distinct** points — the control itself is the theory rule, and it never
  stretches past N for any reason (999 data points → the track ends at 999; 696 → it ends at 696). The **box has
  no ceiling**: type any integer ≥ 1, and a K above N still sticks (flagged red, with *Initialize* refusing)
  rather than being silently clamped — the slider thumb simply pins at the top end while the box keeps the truth.
  With no centroids yet it resets; with centroids placed it keeps them and only trims those above K.
  The note underneath grades the choice as well as checking it: **red** when it cannot run (K above the number of
  distinct positions, or n below K — the buttons go with it), **amber** when it runs but means little
  (`K = N`, or under two points per cluster), **grey** for a gentle `K > 2√N` nudge, and a plain green tick
  otherwise. When some points share a coordinate the note says so — `K ≤ N ✓ (N = 1936, distinct = 1930)` —
  because identical points can never be split into different clusters.
  The one rule k-means imposes is **1 ≤ K ≤ N** — you cannot ask for more clusters than you have data points —
  so the note under the box reports the state live (`K ≤ N ✓`, `K > N — needs 4 more points`, `K = N → SSE 0`),
  the field turns red when it is impossible, and *Initialize* / *Best of 10* refuse to run and tell you why.
  Nothing is silently clamped: what you typed stays on screen.
  K = 1 gives the global mean; K = N puts every point on its own centroid and drives SSE to 0 — which is exactly why a
  low SSE on its own never proves a good K. Past the eight named clusters, colours keep going on a golden-angle hue
  sweep and names continue `Cluster I`, `Cluster J` … `Cluster AA`; the legend lists 24 and then says "+n more".
- **n** — how many points 🎲 generates, as **both a slider and a typed box**. 🎲 is a **tool** (shortcut `R`)
  in the same row as the pen and the brush, and n is *its option*, appearing in the toolbar only while 🎲 is
  selected — exactly the way *Size* / *Flow* / *Smooth* appear for the brush. Press **Generate** in that panel,
  or **`G`** from any tool. Selecting 🎲 never draws on the canvas: generating replaces the whole dataset, so
  it stays an explicit act.
  Every preset generates **exactly** n points — not "about n" — because n is what N becomes and the K ≤ N rule has to
  answer for the number you actually typed. The note under it tells you in advance whether the pair works
  (`n ≥ K ✓ · generates exactly 150 points`, or `n < K — …`). **No fixed ceiling**: any integer ≥ 1; the slider
  reaches 1000 out of the box and stretches further the moment you type a bigger number, and it always reaches at
  least as far as the K slider so you can never get stuck. **K and n hold each other in range:** raise K past n and
  n comes up with it; drop n below K and K comes down. That happens when you *commit* a value — a slider step, or
  pressing Enter / clicking away from the box — never while you are still typing. Drawing on the canvas adds
  more on top, also without a limit.
- **Speed** — Slow / Normal / Fast / Instant animation.
- **Dataset preset** — each one demonstrates a documented K-means limitation (table below).
- **Initial centroid method** — `Random` or `Farthest-first`.
- **🏆 Best of 10 runs** — runs ten times and keeps the lowest SSE, showing how much initialization really matters.
- **↺ Reset** — clears the centroids but keeps the data (handy for re-rolling the initialization).
- **🧹 Clear points** — wipes the data so you can draw a set by hand.

### Presets that demonstrate the limitations

| Dataset | Limitation it shows |
|---|---|
| Globular blobs | the case K-means handles well (baseline) |
| Different sizes | clusters of very unequal size |
| Different densities | unequal spread |
| Non-globular (rings) | non-spherical shapes — K-means slices the ring apart |
| Outliers | stray points drag the centroids off target |

## Architecture

One file: `index.html` = HTML + CSS + vanilla JS (HTML5 Canvas), with Tailwind from a CDN.

```
inside <script>
  CONFIG / STATE        constants and the central state object (S) — exposed as window.S for debugging
  GEOMETRY + VIEW       logical LX×100 ↔ pixels through a single view (V = zoom + pan)
                        px() / toLogical() / zoomAt() — every draw and hit-test shares them.
                        The canvas is infinite: nothing clamps the pan and no position is out of bounds
  DATA GENERATION       gaussian blobs, rings, outliers
  K-MEANS CORE          pickInitial / assignAll / meanUpdate / silentRun
  STEP MACHINE          doInit → doAssign ⇄ doUpdate → done
  ANIMATION             easeInOutCubic centroid moves, recording a trail
  RENDER                main canvas (clipped to the view) + brush head + SSE chart
  TOOLS                 pen / spray / brush / eraser / hand / centroid + the busy lock
                        penAt() = one point at the cursor · dab() = one brush dab
                        strokeTo() = stabilizer + dabs at fixed spacing (carrying leftover distance)
                        sprayLoop() = time-based emission driven by requestAnimationFrame while held
  CANVAS EVENTS         pointer, wheel, contextmenu, keyboard
  UI SYNC / EVENTS      buttons, stats, legend, centroid counter and pseudocode highlighting
  TEST HOOK             window.__app — internals exposed for the unit tests (no effect on normal use)
```

The plot always fills its box: the logical height is pinned at 100 units and **the logical width LX stretches with the
aspect ratio** (a 1106×513px box gives LX ≈ 214). Pixels per unit are therefore identical on both axes, so "nearest
centroid" on screen always matches the computed answer, and no dead space is left beside the plot.

Blob spread (`sdFor`) is derived from LX/LY as well, so the clusters stay proportionate on any screen size.

**Drawing large point counts** relies on three things working together, which is what makes an uncapped point count
affordable: batching one path per colour and filling once, culling anything outside the view, and shrinking the dot
radius automatically as the count grows (4 → 3.2 → 2.6 → 2 px).

**The view (zoom / pan)** lives in a single object `V = { z, px, py }` threaded through `px()` / `toLogical()`.
Drawing, hit-testing, brush radius and centroid grabbing all share that one transform — the data itself stays in world
coordinates and is never rewritten when you zoom or pan. The view state is also mirrored onto `#canvas[data-view]`
(as `zoom,panX,panY`) so external tests can read it.

### Clicking a cluster to focus on it

The coloured cluster list under the canvas is not just a key — **every entry is a button**.

- **Click a cluster** and the canvas flies to it: a half-second pan and zoom that frames exactly that
  cluster's points, with a little padding. Its points stay solid while every other cluster fades back, so you
  can see the shape of one group on its own.
- The entry you picked is underlined in its own colour; the others fade.
- **Click it again** to fly back out to the whole dataset. Clicking a *different* cluster just redirects the
  flight — you do not have to wait for the first one to land.
- The focus is dropped automatically whenever it would stop making sense: pressing *Initialize*, generating
  new data, clearing the points, lowering K, or deleting the centroid you were looking at.

## Testing

```bash
npm test            # unit tests + coverage (a shortfall exits non-zero)
npm run test:quick  # tests only, no coverage — faster while iterating
```

The suite **pulls the real `<script>` out of `index.html`** and runs it against a DOM/Canvas stub
(`tests/extract.mjs` + `tests/dom.mjs`), so it exercises the same code the browser loads rather than a copy.

| File | Tests | Covers |
|---|---:|---|
| `tests/view.test.mjs` | 36 | coordinate round-trips, zoom limits, unclamped panning on the infinite canvas, data staying put under pan/zoom |
| `tests/algorithm.test.mjs` | 56 | assign/update/init/best-of-N/presets/animation, SSE falling every round, and empty-cluster repair |
| `tests/tools.test.mjs` | 61 | brush, eraser, placing–dragging–deleting centroids, the K ceiling, the busy lock |
| `tests/focus.test.mjs` | 30 | cluster click-to-focus: box maths, framing and padding, the fly-through and its retargeting, canvas dimming, and every reset path |
| `tests/kn.test.mjs` | 65 | K and n have no fixed maximum, the 1 ≤ K ≤ distinct(N) and n ≥ K rules, K = 1 / K = N boundaries, colours+names for any K, the paired slider+box controls, the K track pinned to N, exact-n generation, the K ↔ n clamp, and the four warning bands |
| `tests/stroke.test.mjs` | 53 | pen one-press-one-point, spray cadence, stroke continuity, dab spacing, stabilizer |
| `tests/render.test.mjs` | 41 | brush ring, highlight rings, grid vs zoom, SSE chart, drawing huge point counts |
| **Total** | **342** | coverage: line **99.4%** · branch **96.3%** · funcs **96.5%** |

A further 34 checks run in a real headless browser (`tests/browser.smoke.mjs`) using real mouse and keyboard input,
asserting only through the DOM:

```bash
node "$USERPROFILE/.claude/skills/browser-automation/browser.mjs" \
  "file:///$PWD/index.html" --script tests/browser.smoke.mjs
```

## Verification results (headless browser)

Confirmed by actually running the page, not by reading the code:

- 0 console errors, 0 failed requests, no horizontal overflow
- SSE **never increases** across iterations, e.g. `129861.7 → 90582.8 → 86355.5 → 54126.8 → 15222.1 → 14612.1` (down 88.7%)
- every point really is assigned to its nearest centroid (checked independently)
- every centroid really equals the mean of its members (error < 1e-6)
- all 5 presets × K=5 × farthest-first converge
- pen / spray / brush / eraser / zoom / pan / place–drag–delete centroid: 34/34 checks pass
- one pen press gives one point even with Flow set to 8
- holding the spray without moving the mouse keeps adding points, and stops the moment you release
- drawing past 2,000 points still works, and a large dataset still clusters to convergence
- placing more centroids than K is refused with a warning
- deleting down to 2 of K=3 still converges, with SSE falling every round

## Project sub-agents

They live in `.claude/agents/` and are built to be token-light (haiku everywhere except the one that writes code).

| Agent | Model | Job |
|---|---|---|
| `kmeans-ui` | sonnet | edits `index.html` — surgical edits only, never a full rewrite |
| `kmeans-verify` | haiku | runs `npm test` (coverage gate) then the headless browser; reports in ≤10 lines |
| `kmeans-theory` | haiku | checks the explanatory copy against the playbook on 5 fronts (algorithm, cost, initialization, limitations, terminology) |
| `worklog` | haiku | appends what was done to `log.md` as a table row, with real numbers |

The full work history is in [`log.md`](log.md).
