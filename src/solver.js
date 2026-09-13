// src/solver.js
// Optimized BFS Puzzle Solver for Color Block Escape with Special Blocks & Toggle Gates

import { getShapeCells, BLOCK_TYPES } from './shapes.js';
import { TILE_TYPES } from './grid.js';

class MinHeap {
    constructor() {
        this.heap = [];
    }

    push(node) {
        this.heap.push(node);
        this._bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        const top = this.heap[0];
        this.heap[0] = this.heap.pop();
        this._sinkDown(0);
        return top;
    }

    size() {
        return this.heap.length;
    }

    _compare(a, b) {
        if (a.priorityExitStep !== b.priorityExitStep) {
            return a.priorityExitStep - b.priorityExitStep;
        }
        return a.totalSteps - b.totalSteps;
    }

    _bubbleUp(idx) {
        while (idx > 0) {
            const parentIdx = (idx - 1) >> 1;
            if (this._compare(this.heap[idx], this.heap[parentIdx]) < 0) {
                const temp = this.heap[idx];
                this.heap[idx] = this.heap[parentIdx];
                this.heap[parentIdx] = temp;
                idx = parentIdx;
            } else {
                break;
            }
        }
    }

    _sinkDown(idx) {
        const length = this.heap.length;
        while (true) {
            let leftIdx = (idx << 1) + 1;
            let rightIdx = leftIdx + 1;
            let smallest = idx;

            if (leftIdx < length && this._compare(this.heap[leftIdx], this.heap[smallest]) < 0) {
                smallest = leftIdx;
            }
            if (rightIdx < length && this._compare(this.heap[rightIdx], this.heap[smallest]) < 0) {
                smallest = rightIdx;
            }

            if (smallest !== idx) {
                const temp = this.heap[idx];
                this.heap[idx] = this.heap[smallest];
                this.heap[smallest] = temp;
                idx = smallest;
            } else {
                break;
            }
        }
    }
}

export class PuzzleSolver {
    constructor(gridData, blocksData) {
        this.cols = gridData.cols;
        this.rows = gridData.rows;
        this.initialTiles = gridData.tiles.map(row => row.map(tile => ({ ...tile })));
        this.initialBlocks = blocksData.map(b => ({
            id: b.id,
            type: b.type,
            rotation: b.rotation,
            color: b.color,
            x: b.x,
            y: b.y,
            blockType: b.blockType || BLOCK_TYPES.NORMAL,
            innerColor: b.innerColor || null,
            keyCount: b.keyCount || 0,
            freezeCount: b.freezeCount || 0,
            isPriority: !!b.isPriority
        }));

        // Find toggle gate positions once for fast state serialization
        this.toggleGateCoords = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.initialTiles[r][c].type === TILE_TYPES.GATE && this.initialTiles[r][c].isToggle) {
                    this.toggleGateCoords.push([c, r]);
                }
            }
        }
    }

    isPlayableCell(tiles, gx, gy) {
        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
            return false;
        }
        return tiles[gy][gx].type !== TILE_TYPES.VOID;
    }

    canOccupy(block, bx, by, tiles) {
        const shapeCells = getShapeCells(block.type, block.rotation);
        for (const [cx, cy] of shapeCells) {
            const gx = bx + cx;
            const gy = by + cy;

            if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
                return false;
            }

            const tile = tiles[gy][gx];
            if (tile.type === TILE_TYPES.VOID || tile.type === TILE_TYPES.WALL) {
                return false;
            }
            if (tile.type === TILE_TYPES.GATE) {
                if (tile.isToggle && !tile.isOpen) {
                    return false;
                }
                if (tile.color !== block.color) {
                    return false;
                }
            }
        }
        return true;
    }

    canExit(block, bx, by, dx, dy, occupiedGrid, tiles) {
        const shapeCells = getShapeCells(block.type, block.rotation);
        let currentX = bx;
        let currentY = by;

        while (true) {
            currentX += dx;
            currentY += dy;

            let anyInsidePlayable = false;

            for (const [cx, cy] of shapeCells) {
                const gx = currentX + cx;
                const gy = currentY + cy;

                if (this.isPlayableCell(tiles, gx, gy)) {
                    anyInsidePlayable = true;

                    if (occupiedGrid[gy][gx] !== null && occupiedGrid[gy][gx] !== block.id) {
                        return false;
                    }

                    const tile = tiles[gy][gx];
                    if (tile.type === TILE_TYPES.WALL) {
                        return false;
                    }
                    if (tile.type === TILE_TYPES.GATE) {
                        if (tile.isToggle && !tile.isOpen) {
                            return false;
                        }
                        if (tile.color !== block.color) {
                            return false;
                        }
                    }
                } else {
                    const prevGx = gx - dx;
                    const prevGy = gy - dy;
                    if (this.isPlayableCell(tiles, prevGx, prevGy)) {
                        const exitTile = tiles[prevGy][prevGx];
                        if (exitTile.type !== TILE_TYPES.GATE || exitTile.color !== block.color) {
                            return false;
                        }
                        if (exitTile.isToggle && !exitTile.isOpen) {
                            return false;
                        }
                    }
                }
            }

            if (!anyInsidePlayable) {
                return true;
            }
        }
    }

    isMovable(block) {
        if (block.blockType === BLOCK_TYPES.LOCKED && block.keyCount > 0) {
            return false;
        }
        if (block.blockType === BLOCK_TYPES.FROZEN && block.freezeCount > 0) {
            return false;
        }
        return true;
    }

    applyEliminationEvent(blocks, tiles, eliminatedBlock) {
        const newTiles = tiles.map(row => row.map(tile => {
            if (tile.type === TILE_TYPES.GATE && tile.isToggle) {
                return { ...tile, isOpen: !tile.isOpen };
            }
            return tile;
        }));

        const isKey = eliminatedBlock.blockType === BLOCK_TYPES.KEY;

        const newBlocks = blocks.map(b => {
            let nb = { ...b };
            if (nb.blockType === BLOCK_TYPES.FROZEN && nb.freezeCount > 0) {
                nb.freezeCount = nb.freezeCount - 1;
            }
            if (isKey && nb.blockType === BLOCK_TYPES.LOCKED && nb.keyCount > 0) {
                nb.keyCount = nb.keyCount - 1;
            }
            return nb;
        });

        return { newBlocks, newTiles };
    }

    serializeState(blocks, tiles) {
        let blocksKey = '';
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            blocksKey += `${b.id}:${b.x},${b.y},${b.blockType},${b.color},${b.keyCount},${b.freezeCount};`;
        }

        let gatesKey = '';
        for (let i = 0; i < this.toggleGateCoords.length; i++) {
            const [c, r] = this.toggleGateCoords[i];
            gatesKey += `${tiles[r][c].isOpen ? 1 : 0}`;
        }

        return `${blocksKey}|${gatesKey}`;
    }

    buildOccupiedGrid(blocks) {
        const grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
        for (const b of blocks) {
            const cells = getShapeCells(b.type, b.rotation);
            for (const [cx, cy] of cells) {
                const gx = b.x + cx;
                const gy = b.y + cy;
                if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
                    grid[gy][gx] = b.id;
                }
            }
        }
        return grid;
    }

    isCollidingWithOthers(block, nx, ny, occupiedGrid) {
        const cells = getShapeCells(block.type, block.rotation);
        for (const [cx, cy] of cells) {
            const gx = nx + cx;
            const gy = ny + cy;
            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
                const occ = occupiedGrid[gy][gx];
                if (occ !== null && occ !== block.id) {
                    return true;
                }
            }
        }
        return false;
    }

    reconstructHistory(endNode) {
        const history = [];
        let curr = endNode;
        while (curr && curr.move) {
            history.unshift({
                blocks: curr.blocks,
                tiles: curr.tiles,
                move: curr.move
            });
            curr = curr.parent;
        }
        return history;
    }

    /**
     * Solves the puzzle using MinHeap BFS.
     */
    solve(maxStates = 250000, progressCallback = null) {
        const startBlocks = this.initialBlocks.map(b => ({ ...b }));
        const startTiles = this.initialTiles.map(row => row.map(t => ({ ...t })));

        for (const b of startBlocks) {
            if (!this.canOccupy(b, b.x, b.y, startTiles)) {
                return { success: false, error: 'Initial configuration has overlapping or invalid blocks.' };
            }
        }

        const priorityBlockId = (startBlocks.find(b => b.isPriority) || {}).id || null;

        const heap = new MinHeap();
        const startNode = {
            blocks: startBlocks,
            tiles: startTiles,
            move: null,
            parent: null,
            priorityExitStep: priorityBlockId === null ? 0 : Infinity,
            totalSteps: 0
        };
        heap.push(startNode);

        const visited = new Set();
        visited.add(this.serializeState(startBlocks, startTiles));

        const directions = [
            { dx: 0, dy: -1, name: 'Up' },
            { dx: 0, dy: 1, name: 'Down' },
            { dx: -1, dy: 0, name: 'Left' },
            { dx: 1, dy: 0, name: 'Right' }
        ];

        let exploredCount = 0;

        while (heap.size() > 0) {
            const current = heap.pop();
            const { blocks, tiles, priorityExitStep, totalSteps } = current;

            exploredCount++;

            if (progressCallback && exploredCount % 2000 === 0) {
                progressCallback(exploredCount);
            }

            if (exploredCount > maxStates) {
                return { success: false, error: 'Search limit exceeded. Puzzle might be too complex or unsolvable.' };
            }

            // Target reached: all blocks exited!
            if (blocks.length === 0) {
                return {
                    success: true,
                    steps: this.reconstructHistory(current),
                    statesExplored: exploredCount
                };
            }

            const occupiedGrid = this.buildOccupiedGrid(blocks);

            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];

                if (!this.isMovable(block)) {
                    continue;
                }

                for (const dir of directions) {
                    // 1. Move inside board
                    const nx = block.x + dir.dx;
                    const ny = block.y + dir.dy;

                    if (this.canOccupy(block, nx, ny, tiles) && !this.isCollidingWithOthers(block, nx, ny, occupiedGrid)) {
                        const newBlocks = blocks.map((b, idx) => idx === i ? { ...b, x: nx, y: ny } : { ...b });
                        const key = this.serializeState(newBlocks, tiles);
                        if (!visited.has(key)) {
                            visited.add(key);
                            heap.push({
                                blocks: newBlocks,
                                tiles: tiles,
                                move: { blockId: block.id, dir: dir.name, exited: false, color: block.color },
                                parent: current,
                                priorityExitStep: priorityExitStep,
                                totalSteps: totalSteps + 1
                            });
                        }
                    }

                    // 2. Exit through gate
                    if (this.canExit(block, block.x, block.y, dir.dx, dir.dy, occupiedGrid, tiles)) {
                        let newBlocks;
                        let newPriorityExitStep = priorityExitStep;

                        if (block.blockType === BLOCK_TYPES.DUAL) {
                            const peeledBlock = {
                                ...block,
                                blockType: BLOCK_TYPES.NORMAL,
                                color: block.innerColor || block.color,
                                innerColor: null
                            };
                            if (block.id === priorityBlockId && priorityExitStep === Infinity) {
                                newPriorityExitStep = totalSteps + 1;
                            }

                            const tempBlocks = blocks.map((b, idx) => idx === i ? peeledBlock : { ...b });
                            const elimResult = this.applyEliminationEvent(tempBlocks, tiles, block);
                            newBlocks = elimResult.newBlocks;
                            const newTiles = elimResult.newTiles;

                            const key = this.serializeState(newBlocks, newTiles);
                            if (!visited.has(key)) {
                                visited.add(key);
                                heap.push({
                                    blocks: newBlocks,
                                    tiles: newTiles,
                                    move: { blockId: block.id, dir: dir.name, exited: false, peeled: true, color: block.color, newColor: peeledBlock.color },
                                    parent: current,
                                    priorityExitStep: newPriorityExitStep,
                                    totalSteps: totalSteps + 1
                                });
                            }
                        } else {
                            if (block.id === priorityBlockId && priorityExitStep === Infinity) {
                                newPriorityExitStep = totalSteps + 1;
                            }

                            const tempBlocks = blocks.filter((_, idx) => idx !== i);
                            const elimResult = this.applyEliminationEvent(tempBlocks, tiles, block);
                            newBlocks = elimResult.newBlocks;
                            const newTiles = elimResult.newTiles;

                            const key = this.serializeState(newBlocks, newTiles);
                            if (!visited.has(key)) {
                                visited.add(key);
                                heap.push({
                                    blocks: newBlocks,
                                    tiles: newTiles,
                                    move: { blockId: block.id, dir: dir.name, exited: true, color: block.color },
                                    parent: current,
                                    priorityExitStep: newPriorityExitStep,
                                    totalSteps: totalSteps + 1
                                });
                            }
                        }
                    }
                }
            }
        }

        return { success: false, error: 'No solution found for this puzzle layout.', statesExplored: exploredCount };
    }
}
