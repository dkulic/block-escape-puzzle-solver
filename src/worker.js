// src/worker.js
// Web Worker for asynchronous puzzle solving

import { PuzzleSolver } from './solver.js';

self.onmessage = function (e) {
    const { gridData, blocksData } = e.data;
    const solver = new PuzzleSolver(gridData, blocksData);

    const result = solver.solve(150000, (exploredCount) => {
        self.postMessage({ type: 'progress', exploredCount });
    });

    self.postMessage({ type: 'result', result });
};
