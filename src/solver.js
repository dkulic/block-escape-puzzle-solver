// src/solver.js
// BFS Puzzle Solver for Color Block Escape

import { getShapeCells } from './shapes.js';
import { TILE_TYPES } from './grid.js';

export class PuzzleSolver {
    constructor(gridData, blocksData) {
        this.cols = gridData.cols;
        this.rows = gridData.rows;
        this.tiles = gridData.tiles; // 2D array of { type, color }
        this.initialBlocks = blocksData; // [{ id, type, rotation, color, x, y }]
    }

    /**
     * Checks whether a block at position (bx, by) can legally occupy grid coordinates.
     * Block cells must land on FLOOR or GATE of matching color.
     * Cannot overlap WALL or VOID.
     */
    canOccupy(block, bx, by) {
        const shapeCells = getShapeCells(block.type, block.rotation);
        for (const [cx, cy] of shapeCells) {
            const gx = bx + cx;
            const gy = by + cy;

            if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
                return false; // Out of bounds inside board (exiting is checked separately)
            }

            const tile = this.tiles[gy][gx];
            if (tile.type === TILE_TYPES.VOID || tile.type === TILE_TYPES.WALL) {
                return false;
            }
            if (tile.type === TILE_TYPES.GATE) {
                if (tile.color !== block.color) {
                    return false; // Cannot enter a gate of different color
                }
            }
        }
        return true;
    }

    /**
     * Checks if a block can successfully EXIT the board through a gate of matching color.
     * To exit in direction (dx, dy):
     * The block moves step by step in (dx, dy) until ALL its cells leave the board.
     * During each step of exiting, any cell that is still inside the grid bounds must land on:
     * - A GATE tile of matching color, or
     * - A FLOOR tile (if allowed/traversing out), or
     * specifically: Every cell of the block that crosses the boundary must pass through GATE tiles of the matching color.
     */
    canExit(block, bx, by, dx, dy, occupiedGrid) {
        const shapeCells = getShapeCells(block.type, block.rotation);
        let currentX = bx;
        let currentY = by;

        // Move step by step until all cells are strictly outside grid bounds
        while (true) {
            currentX += dx;
            currentY += dy;

            let anyInside = false;

            for (const [cx, cy] of shapeCells) {
                const gx = currentX + cx;
                const gy = currentY + cy;

                // Check if this cell is within grid bounds
                if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
                    anyInside = true;
                    // Check if obstructed by another block
                    if (occupiedGrid[gy][gx] !== null && occupiedGrid[gy][gx] !== block.id) {
                        return false;
                    }

                    const tile = this.tiles[gy][gx];
                    if (tile.type === TILE_TYPES.WALL || tile.type === TILE_TYPES.VOID) {
                        return false;
                    }
                    if (tile.type === TILE_TYPES.GATE && tile.color !== block.color) {
                        return false;
                    }
                } else {
                    // Cell is outside bounds. The point where it crossed the boundary must have been a matching GATE.
                    // To verify valid exit, we trace the cell's previous position before leaving bounds.
                    const prevGx = gx - dx;
                    const prevGy = gy - dy;
                    if (prevGx >= 0 && prevGx < this.cols && prevGy >= 0 && prevGy < this.rows) {
                        const exitTile = this.tiles[prevGy][prevGx];
                        if (exitTile.type !== TILE_TYPES.GATE || exitTile.color !== block.color) {
                            return false;
                        }
                    }
                }
            }

            if (!anyInside) {
                // Fully exited!
                return true;
            }
        }
    }

    /**
     * Serializes state to string for BFS memoization / visited set.
     */
    serializeState(blocks) {
        // Sort blocks by id for deterministic key
        return blocks
            .slice()
            .sort((a, b) => a.id - b.id)
            .map(b => `${b.id}:${b.x},${b.y}`)
            .join(';');
    }

    /**
     * Solves the puzzle using BFS.
     * Returns an array of steps:
     * [{ blocks: [...], move: { blockId, from: {x, y}, to: {x, y}, exited: boolean } }]
     */
    solve(maxStates = 100000, progressCallback = null) {
        // Build initial block positions
        const startBlocks = this.initialBlocks.map(b => ({ ...b }));

        // Validate initial state
        const initialOccupied = this.buildOccupiedGrid(startBlocks);
        for (const b of startBlocks) {
            if (!this.canOccupy(b, b.x, b.y)) {
                return { success: false, error: 'Initial configuration has overlapping or invalid blocks.' };
            }
        }

        const queue = [{ blocks: startBlocks, history: [] }];
        const visited = new Set();
        visited.add(this.serializeState(startBlocks));

        const directions = [
            { dx: 0, dy: -1, name: 'Up' },
            { dx: 0, dy: 1, name: 'Down' },
            { dx: -1, dy: 0, name: 'Left' },
            { dx: 1, dy: 0, name: 'Right' }
        ];

        let exploredCount = 0;

        while (queue.length > 0) {
            const { blocks, history } = queue.shift();
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

                for (const dir of directions) {
                    // Try 1-step move inside board
                    const nx = block.x + dir.dx;
                    const ny = block.y + dir.dy;

                    if (this.canOccupy(block, nx, ny) && !this.isCollidingWithOthers(block, nx, ny, occupiedGrid)) {
                        const newBlocks = blocks.map((b, idx) => idx === i ? { ...b, x: nx, y: ny } : { ...b });
                        const key = this.serializeState(newBlocks);
                        if (!visited.has(key)) {
                            visited.add(key);
                            queue.push({
                                blocks: newBlocks,
                                history: [
                                    ...history,
                                    {
                                        blocks: newBlocks,
                                        move: { blockId: block.id, dir: dir.name, exited: false, color: block.color }
                                    }
                                ]
                            });
                        }
                    }

                    // Try exiting through gate in direction dir
                    if (this.canExit(block, block.x, block.y, dir.dx, dir.dy, occupiedGrid)) {
                        const newBlocks = blocks.filter((_, idx) => idx !== i);
                        const key = this.serializeState(newBlocks);
                        if (!visited.has(key)) {
                            visited.add(key);
                            queue.push({
                                blocks: newBlocks,
                                history: [
                                    ...history,
                                    {
                                        blocks: newBlocks,
                                        move: { blockId: block.id, dir: dir.name, exited: true, color: block.color }
                                    }
                                ]
                            });
                        }
                    }
                }
            }
        }

        return { success: false, error: 'No solution found for this puzzle layout.', statesExplored: exploredCount };
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
}
