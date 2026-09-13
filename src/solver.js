// src/solver.js
// BFS Puzzle Solver for Color Block Escape with Special Blocks & Toggle Gates

import { getShapeCells, BLOCK_TYPES } from './shapes.js';
import { TILE_TYPES } from './grid.js';

export class PuzzleSolver {
    constructor(gridData, blocksData) {
        this.cols = gridData.cols;
        this.rows = gridData.rows;
        // Deep clone initial tiles so solver can track gate toggle states dynamically
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
    }

    /**
     * Helper to get effective tile properties for current state gates map.
     */
    getTile(tiles, x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
            return { type: TILE_TYPES.VOID, color: null };
        }
        return tiles[y][x];
    }

    /**
     * Checks if a cell is playable inside board bounds.
     */
    isPlayableCell(tiles, gx, gy) {
        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
            return false;
        }
        const tile = tiles[gy][gx];
        return tile.type !== TILE_TYPES.VOID;
    }

    /**
     * Checks whether a block can legally occupy a given position.
     * Closed gates or mismatched gate colors act as impassable.
     */
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
                    return false; // Closed toggle gate acts as wall
                }
                if (tile.color !== block.color) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Checks if a block can exit through matching open gate in direction (dx, dy).
     */
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

    /**
     * Checks if a block is currently movable.
     * Locked blocks (keyCount > 0) and Frozen blocks (freezeCount > 0) cannot move.
     */
    isMovable(block) {
        if (block.blockType === BLOCK_TYPES.LOCKED && block.keyCount > 0) {
            return false;
        }
        if (block.blockType === BLOCK_TYPES.FROZEN && block.freezeCount > 0) {
            return false;
        }
        return true;
    }

    /**
     * Applies an elimination event (either outer peel or full block exit).
     * - Toggles toggle gates
     * - Decrements freeze counts on frozen blocks
     * - If key block eliminated, decrements key counts on locked blocks
     */
    applyEliminationEvent(blocks, tiles, eliminatedBlock) {
        // Toggle toggle gates
        const newTiles = tiles.map(row => row.map(tile => {
            if (tile.type === TILE_TYPES.GATE && tile.isToggle) {
                return { ...tile, isOpen: !tile.isOpen };
            }
            return tile;
        }));

        const isKey = eliminatedBlock.blockType === BLOCK_TYPES.KEY;

        // Update blocks
        const newBlocks = blocks.map(b => {
            let nb = { ...b };
            // Decrement freezeCount
            if (nb.blockType === BLOCK_TYPES.FROZEN && nb.freezeCount > 0) {
                nb.freezeCount = nb.freezeCount - 1;
            }
            // Decrement keyCount if key block eliminated
            if (isKey && nb.blockType === BLOCK_TYPES.LOCKED && nb.keyCount > 0) {
                nb.keyCount = nb.keyCount - 1;
            }
            return nb;
        });

        return { newBlocks, newTiles };
    }

    serializeState(blocks, tiles) {
        const blocksKey = blocks
            .slice()
            .sort((a, b) => a.id - b.id)
            .map(b => `${b.id}:${b.x},${b.y},${b.blockType},${b.color},${b.keyCount},${b.freezeCount}`)
            .join(';');

        let gatesKey = '';
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (tiles[r][c].type === TILE_TYPES.GATE && tiles[r][c].isToggle) {
                    gatesKey += `${c},${r}:${tiles[r][c].isOpen ? 1 : 0};`;
                }
            }
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

    /**
     * Solves the puzzle using BFS with priority queue to minimize moves before priority block exit.
     */
    solve(maxStates = 150000, progressCallback = null) {
        const startBlocks = this.initialBlocks.map(b => ({ ...b }));
        const startTiles = this.initialTiles.map(row => row.map(t => ({ ...t })));

        for (const b of startBlocks) {
            if (!this.canOccupy(b, b.x, b.y, startTiles)) {
                return { success: false, error: 'Initial configuration has overlapping or invalid blocks.' };
            }
        }

        const priorityBlockId = (startBlocks.find(b => b.isPriority) || {}).id || null;

        // Priority Queue implementation (or layered BFS queues)
        // Primary sort: priorityExitStep (infinity if not exited), Secondary sort: totalSteps
        const queue = [{
            blocks: startBlocks,
            tiles: startTiles,
            history: [],
            priorityExitStep: priorityBlockId === null ? 0 : Infinity,
            totalSteps: 0
        }];

        const visited = new Set();
        visited.add(this.serializeState(startBlocks, startTiles));

        const directions = [
            { dx: 0, dy: -1, name: 'Up' },
            { dx: 0, dy: 1, name: 'Down' },
            { dx: -1, dy: 0, name: 'Left' },
            { dx: 1, dy: 0, name: 'Right' }
        ];

        let exploredCount = 0;

        while (queue.length > 0) {
            // Find minimum cost element in queue (Priority Queue pop)
            let bestIdx = 0;
            for (let i = 1; i < queue.length; i++) {
                if (queue[i].priorityExitStep < queue[bestIdx].priorityExitStep ||
                   (queue[i].priorityExitStep === queue[bestIdx].priorityExitStep && queue[i].totalSteps < queue[bestIdx].totalSteps)) {
                    bestIdx = i;
                }
            }
            const current = queue.splice(bestIdx, 1)[0];
            const { blocks, tiles, history, priorityExitStep, totalSteps } = current;

            exploredCount++;

            if (progressCallback && exploredCount % 1000 === 0) {
                progressCallback(exploredCount);
            }

            if (exploredCount > maxStates) {
                return { success: false, error: 'Search limit exceeded. Puzzle might be too complex or unsolvable.' };
            }

            // Check if solved (all blocks exited)
            if (blocks.length === 0) {
                return { success: true, steps: history, statesExplored: exploredCount };
            }

            const occupiedGrid = this.buildOccupiedGrid(blocks);

            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];

                if (!this.isMovable(block)) {
                    continue;
                }

                for (const dir of directions) {
                    // 1. Try moving inside board
                    const nx = block.x + dir.dx;
                    const ny = block.y + dir.dy;

                    if (this.canOccupy(block, nx, ny, tiles) && !this.isCollidingWithOthers(block, nx, ny, occupiedGrid)) {
                        const newBlocks = blocks.map((b, idx) => idx === i ? { ...b, x: nx, y: ny } : { ...b });
                        const key = this.serializeState(newBlocks, tiles);
                        if (!visited.has(key)) {
                            visited.add(key);
                            queue.push({
                                blocks: newBlocks,
                                tiles: tiles,
                                history: [
                                    ...history,
                                    {
                                        blocks: newBlocks,
                                        tiles: tiles,
                                        move: { blockId: block.id, dir: dir.name, exited: false, color: block.color }
                                    }
                                ],
                                priorityExitStep: priorityExitStep,
                                totalSteps: totalSteps + 1
                            });
                        }
                    }

                    // 2. Try exiting through gate
                    if (this.canExit(block, block.x, block.y, dir.dx, dir.dy, occupiedGrid, tiles)) {
                        let newBlocks;
                        let newPriorityExitStep = priorityExitStep;

                        if (block.blockType === BLOCK_TYPES.DUAL) {
                            // Dual color block outer peel: transforms to normal block with inner color at same position
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
                                queue.push({
                                    blocks: newBlocks,
                                    tiles: newTiles,
                                    history: [
                                        ...history,
                                        {
                                            blocks: newBlocks,
                                            tiles: newTiles,
                                            move: { blockId: block.id, dir: dir.name, exited: false, peeled: true, color: block.color, newColor: peeledBlock.color }
                                        }
                                    ],
                                    priorityExitStep: newPriorityExitStep,
                                    totalSteps: totalSteps + 1
                                });
                            }
                        } else {
                            // Complete block exit from board
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
                                queue.push({
                                    blocks: newBlocks,
                                    tiles: newTiles,
                                    history: [
                                        ...history,
                                        {
                                            blocks: newBlocks,
                                            tiles: newTiles,
                                            move: { blockId: block.id, dir: dir.name, exited: true, color: block.color }
                                        }
                                    ],
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
