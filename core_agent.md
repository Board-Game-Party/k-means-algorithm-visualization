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
4. **Technical Constraints:**
   - Build a Single Page Application (SPA).
   - Use HTML5, CSS (Tailwind CSS via CDN is allowed), and Vanilla JavaScript (HTML5 Canvas or lightweight libraries like Chart.js via CDN).
   - Combine all HTML, CSS, and JS into a single, self-contained `index.html` file.

## 📤 Output Format Requirements
1. Deliver the complete application as a single self-contained `index.html` at the project root.
2. Ensure the code is ready to run locally in any standard web browser without a build process.
3. Document how to use the interactive website in `README.md` (Thai).

---

## ✅ Delivery Status — DONE

| item | value |
|---|---|
| Deliverable | `index.html` (single file, no build step) |
| Docs | `README.md` |
| Verified | headless browser: 0 console errors, 0 failed requests, SSE monotonically decreasing, assignments = nearest centroid, centroids = cluster means |

**Implemented beyond the base spec**
- Step machine with an information panel + live-highlighted Lloyd's pseudocode
- Animated centroid movement (easeInOutCubic) with dashed movement trails
- Live SSE convergence chart
- 5 dataset presets that each demonstrate one documented K-means limitation
- Two initialization strategies (Random / Farthest-first) + `Best of 10 runs`, covering the playbook's "Dealing with Initialization" section

## 🤖 Sub-agents (`.claude/agents/`)

Token-lean roster — dispatch instead of doing these inline.

| agent | model | use it for |
|---|---|---|
| `kmeans-ui` | sonnet | any change to `index.html`; edits surgically, never rewrites the file |
| `kmeans-verify` | haiku | headless-browser QA after every edit, before reporting done |
| `kmeans-theory` | haiku | checking explanatory copy against `paybook/Clustering-k-mean.md` |

**Rule:** for a one-file change, edit directly. Dispatch a sub-agent only when the work is genuinely separable — otherwise the spawn costs more tokens than it saves.