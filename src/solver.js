// src/solver.js
// Memory & Speed Optimized BFS Puzzle Solver for Color Block Escape with Special Blocks & Toggle Gates

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
    constructor(gridData, blocksData, stitchesData = []) {
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
        this.initialStitches = (stitchesData || []).map(([a, b]) => [Math.min(a, b), Math.max(a, b)]);

        // Find toggle gate positions once for fast bitmask state representation
        this.toggleGateCoords = [];
        this.initialToggleMask = 0;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.initialTiles[r][c];
                if (tile.type === TILE_TYPES.GATE && tile.isToggle) {
                    const idx = this.toggleGateCoords.length;
                    this.toggleGateCoords.push([c, r]);
                    tile.toggleIdx = idx;
                    if (tile.isOpen !== false) {
                        this.initialToggleMask |= (1 << idx);
                    }
                }
            }
        }
    }

    getEffectiveTile(x, y, toggleMask) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
            return { type: TILE_TYPES.VOID, color: null };
        }
        const tile = this.initialTiles[y][x];
        if (tile.type === TILE_TYPES.GATE && tile.isToggle) {
            const isOpen = ((toggleMask >> tile.toggleIdx) & 1) === 1;
            return { ...tile, isOpen };
        }
        return tile;
    }

    getConnectedGroups(blocks, stitches) {
        const blockIds = new Set(blocks.map(b => b.id));
        const validStitches = (stitches || []).filter(([a, b]) => blockIds.has(a) && blockIds.has(b));

        const adj = new Map();
        for (const b of blocks) {
            adj.set(b.id, []);
        }
        for (const [a, b] of validStitches) {
            adj.get(a).push(b);
            adj.get(b).push(a);
        }

        const visited = new Set();
        const groups = [];

        for (const b of blocks) {
            if (!visited.has(b.id)) {
                const group = [];
                const queue = [b.id];
                visited.add(b.id);

                while (queue.length > 0) {
                    const curr = queue.shift();
                    group.push(curr);
                    for (const neighbor of (adj.get(curr) || [])) {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }
                groups.push(group);
            }
        }

        return { groups, validStitches };
    }

    isPlayableCell(gx, gy) {
        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
            return false;
        }
        return this.initialTiles[gy][gx].type !== TILE_TYPES.VOID;
    }

    canOccupy(block, bx, by, toggleMask) {
        const shapeCells = getShapeCells(block.type, block.rotation);
        for (const [cx, cy] of shapeCells) {
            const gx = bx + cx;
            const gy = by + cy;

            if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
                return false;
            }

            const tile = this.getEffectiveTile(gx, gy, toggleMask);
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

    canExit(block, bx, by, dx, dy, occupiedGrid, toggleMask) {
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

                if (this.isPlayableCell(gx, gy)) {
                    anyInsidePlayable = true;

                    if (occupiedGrid[gy][gx] !== null && occupiedGrid[gy][gx] !== block.id) {
                        return false;
                    }

                    const tile = this.getEffectiveTile(gx, gy, toggleMask);
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
                    if (this.isPlayableCell(prevGx, prevGy)) {
                        const exitTile = this.getEffectiveTile(prevGx, prevGy, toggleMask);
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

    applyEliminationEvent(blocks, toggleMask, eliminatedBlock) {
        let newToggleMask = toggleMask;

        if (this.toggleGateCoords.length > 0) {
            const toggleBits = (1 << this.toggleGateCoords.length) - 1;
            newToggleMask = toggleMask ^ toggleBits;
        }

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

        return { newBlocks, newToggleMask };
    }

    serializeState(blocks, toggleMask, stitches) {
        let blocksKey = '';
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            blocksKey += `${b.id}:${b.x},${b.y},${b.blockType},${b.color},${b.keyCount},${b.freezeCount};`;
        }

        const blockIds = new Set(blocks.map(b => b.id));
        const validStitchesStr = (stitches || [])
            .filter(([a, b]) => blockIds.has(a) && blockIds.has(b))
            .map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`)
            .sort()
            .join(',');

        return `${blocksKey}|${toggleMask}|${validStitchesStr}`;
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

    getTilesFromToggleMask(toggleMask) {
        return this.initialTiles.map((row, r) => row.map((tile, c) => {
            if (tile.type === TILE_TYPES.GATE && tile.isToggle) {
                const isOpen = ((toggleMask >> tile.toggleIdx) & 1) === 1;
                return { ...tile, isOpen };
            }
            return { ...tile };
        }));
    }

    reconstructHistory(endNode) {
        const history = [];
        let curr = endNode;
        while (curr && curr.move) {
            history.unshift({
                blocks: curr.blocks,
                tiles: this.getTilesFromToggleMask(curr.toggleMask),
                stitches: curr.stitches,
                move: curr.move
            });
            curr = curr.parent;
        }
        return history;
    }

    /**
     * Solves the puzzle using MinHeap BFS.
     */
    solve(maxStates = 1000000, progressCallback = null) {
        const startBlocks = this.initialBlocks.map(b => ({ ...b }));
        const startToggleMask = this.initialToggleMask;
        const startStitches = this.initialStitches.map(([a, b]) => [a, b]);

        for (const b of startBlocks) {
            if (!this.canOccupy(b, b.x, b.y, startToggleMask)) {
                return { success: false, error: 'Initial configuration has overlapping or invalid blocks.' };
            }
        }

        const priorityBlockId = (startBlocks.find(b => b.isPriority) || {}).id || null;

        const heap = new MinHeap();
        const startNode = {
            blocks: startBlocks,
            toggleMask: startToggleMask,
            stitches: startStitches,
            move: null,
            parent: null,
            priorityExitStep: priorityBlockId === null ? 0 : Infinity,
            totalSteps: 0
        };
        heap.push(startNode);

        const visited = new Set();
        visited.add(this.serializeState(startBlocks, startToggleMask, startStitches));

        const directions = [
            { dx: 0, dy: -1, name: 'Up' },
            { dx: 0, dy: 1, name: 'Down' },
            { dx: -1, dy: 0, name: 'Left' },
            { dx: 1, dy: 0, name: 'Right' }
        ];

        let exploredCount = 0;

        while (heap.size() > 0) {
            const current = heap.pop();
            const { blocks, toggleMask, stitches, priorityExitStep, totalSteps } = current;

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
            const blockMap = new Map(blocks.map(b => [b.id, b]));
            const { groups, validStitches } = this.getConnectedGroups(blocks, stitches);

            // 1. Group movements on board
            for (const groupIds of groups) {
                const groupBlocks = groupIds.map(id => blockMap.get(id));

                if (groupBlocks.some(b => !this.isMovable(b))) {
                    continue;
                }

                const groupSet = new Set(groupIds);

                for (const dir of directions) {
                    let canGroupMove = true;

                    for (const b of groupBlocks) {
                        const nx = b.x + dir.dx;
                        const ny = b.y + dir.dy;

                        if (!this.canOccupy(b, nx, ny, toggleMask)) {
                            canGroupMove = false;
                            break;
                        }

                        // Check collision with blocks outside this group
                        const shapeCells = getShapeCells(b.type, b.rotation);
                        for (const [cx, cy] of shapeCells) {
                            const gx = nx + cx;
                            const gy = ny + cy;
                            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
                                const occ = occupiedGrid[gy][gx];
                                if (occ !== null && !groupSet.has(occ)) {
                                    canGroupMove = false;
                                    break;
                                }
                            }
                        }
                        if (!canGroupMove) break;
                    }

                    if (canGroupMove) {
                        const newBlocks = blocks.map(b => groupSet.has(b.id) ? { ...b, x: b.x + dir.dx, y: b.y + dir.dy } : { ...b });
                        const key = this.serializeState(newBlocks, toggleMask, validStitches);
                        if (!visited.has(key)) {
                            visited.add(key);
                            heap.push({
                                blocks: newBlocks,
                                toggleMask: toggleMask,
                                stitches: validStitches,
                                move: {
                                    blockId: groupBlocks.length > 1 ? groupIds : groupBlocks[0].id,
                                    dir: dir.name,
                                    exited: false,
                                    color: groupBlocks[0].color,
                                    isGroup: groupBlocks.length > 1
                                },
                                parent: current,
                                priorityExitStep: priorityExitStep,
                                totalSteps: totalSteps + 1
                            });
                        }
                    }
                }
            }

            // 2. Individual Block Exits / Peeling through gates
            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];

                if (!this.isMovable(block)) {
                    continue;
                }

                for (const dir of directions) {
                    if (this.canExit(block, block.x, block.y, dir.dx, dir.dy, occupiedGrid, toggleMask)) {
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

                            const tempBlocks = blocks.map(b => b.id === block.id ? peeledBlock : { ...b });

                            const elimResult = this.applyEliminationEvent(tempBlocks, toggleMask, block);
                            newBlocks = elimResult.newBlocks;
                            const newToggleMask = elimResult.newToggleMask;

                            const key = this.serializeState(newBlocks, newToggleMask, validStitches);
                            if (!visited.has(key)) {
                                visited.add(key);
                                heap.push({
                                    blocks: newBlocks,
                                    toggleMask: newToggleMask,
                                    stitches: validStitches,
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

                            const tempBlocks = blocks.filter(b => b.id !== block.id);
                            const newStitches = validStitches.filter(([a, b]) => a !== block.id && b !== block.id);
                            const elimResult = this.applyEliminationEvent(tempBlocks, toggleMask, block);
                            newBlocks = elimResult.newBlocks;
                            const newToggleMask = elimResult.newToggleMask;

                            const key = this.serializeState(newBlocks, newToggleMask, newStitches);
                            if (!visited.has(key)) {
                                visited.add(key);
                                heap.push({
                                    blocks: newBlocks,
                                    toggleMask: newToggleMask,
                                    stitches: newStitches,
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
