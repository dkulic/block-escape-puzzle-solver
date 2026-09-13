# Color Block Escape Puzzle Solver

A modern, responsive, browser-based **Color Block Escape Puzzle Solver** built for deployment on **Cloudflare Pages / Workers Assets** (or any static Web Host).

## 🌟 Features

- **Visual Map Editor:**
  - Configurable board dimensions (from 3x3 to 15x15, default 8x8).
  - Grid element tools: **Wall**, **Gate** (colored exits), and **Erase**.
  - **Toggle Gates:** Special gates that alternate between open and closed on every block elimination event.
  - Implicit floor/void generation via automatic flood-fill from border cells.
  - Color picker palette for defining gates and matching blocks.

- **Block Creation & Placement:**
  - Supported shape profiles:
    - `Single (1x1)`
    - `Line (2, 3, 4 squares)`
    - `L Profile (3 squares)`
    - `T Profile (4 squares)`
    - `+ Profile (5 squares)`
  - **Special Block Types:**
    - `Normal`: Regular color blocks.
    - `Dual Color`: Displays outer color with inner cross pattern. Must first pass through an outer-color gate to peel off its outer layer and become a normal block of the inner color.
    - `Locked`: Locked with a key counter badge. Cannot move until required keys are collected.
    - `Key Block`: Regular movement; eliminating it reduces padlock counters on all locked blocks by 1.
    - `Frozen`: Unmovable while frozen with an ice overlay and freeze counter. Any block elimination event decrements the freeze counter by 1 until it unfreezes.
  - **Priority Flag (⭐):** Assignable to at most 1 block to prioritize exiting it in as few moves as possible.
  - **90° Shape Rotation** before and after placement.
  - Automatic smart placement in available enclosed floor space.
  - Interactive mouse **Drag & Drop** with real-time green/red visual validation.
  - Block deletion (drag off-board or press `Delete`/`Backspace`).
  - Full **Undo (`Ctrl+Z`)** history support.

- **Automated Puzzle Solver:**
  - Breadth-First Search (BFS) solver algorithm running natively in JavaScript.
  - Block escape logic requiring blocks to exit through matching colored gates.

- **Step-by-Step Solution Player:**
  - Step navigation via UI controls (`<` and `>`) or keyboard arrow keys (`Left` / `Right`).
  - Detailed descriptions for every step (direction and exit status).

---

## 🚀 Running Locally

The application is built with standard HTML5, CSS3, and ES6 JavaScript modules. No complex build step is required.

Run using any static HTTP server:

```bash
python3 -m http.server 8000
```

Then open your browser at `http://localhost:8000`.

---

## ☁️ Deploying to Cloudflare Pages / Workers

1. Open your [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages**.
2. Click **Create application** -> **Pages** or **Worker** -> **Connect to Git**.
3. Select this repository.
4. Set build settings:
   - **Framework preset:** `None`
   - **Build command:** *(Leave empty)*
   - **Build output directory:** `.` (root directory)
5. Click **Save and Deploy**.
