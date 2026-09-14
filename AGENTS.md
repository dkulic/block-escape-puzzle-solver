# Project Guidelines & Agent Instructions

## Overview
This application is a modern, responsive, browser-based **Color Block Escape Puzzle Solver** built with HTML5, CSS3, and ES JavaScript modules (`src/grid.js`, `src/shapes.js`, `src/solver.js`, `src/app.js`).

## Critical Requirements
1. **Language Requirement:** All user interface text, labels, option descriptions, dialog messages, code comments, and documentation MUST be strictly in **English**. Never use non-English terms in user-facing elements or code artifacts.
2. **Architecture:** Pure client-side ES modules. Do not introduce node build dependencies or transpilation steps unless required.
3. **Local Development:** Run locally using any standard static web server (e.g., `python3 -m http.server 8000`).

## File Structure & Responsibilities
- `index.html`: Main HTML layout including editor sidebar controls and main grid workspace.
- `styles.css`: Styling for grid board, block elements, sidebars, tools, and UI components.
- `src/grid.js`: Core grid matrix representation (`GameGrid`), tile types, and `COLOR_PALETTE`.
- `src/shapes.js`: Block shape definitions, rotations, and type constants.
- `src/solver.js`: BFS puzzle solver algorithm and state transitions.
- `src/app.js`: Application lifecycle, DOM event listeners, board rendering, drag-and-drop, and state management.
