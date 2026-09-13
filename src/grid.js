// src/grid.js
// Representation of the puzzle grid: tiles, bounds, walls, and gates.

export const TILE_TYPES = {
    VOID: 'void',
    FLOOR: 'floor',
    WALL: 'wall',
    GATE: 'gate',
    EMPTY: 'empty'
};

export const COLOR_PALETTE = [
    '#e74c3c', // Red
    '#3498db', // Light Blue
    '#1d4ed8', // Dark Blue
    '#2ecc71', // Light Green
    '#15803d', // Dark Green
    '#f1c40f', // Yellow
    '#9b59b6', // Purple
    '#e67e22', // Orange
    '#1abc9c', // Teal
    '#e84393'  // Pink
];

export class GameGrid {
    constructor(cols = 8, rows = 8) {
        this.cols = cols;
        this.rows = rows;
        // 2D grid storing raw user tile objects: { type: TILE_TYPES, color: null | string }
        // Default is EMPTY (which will compute to VOID if outside or FLOOR if enclosed)
        this.tiles = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => ({ type: TILE_TYPES.EMPTY, color: null }))
        );
    }

    isValidCoord(x, y) {
        return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    /**
     * Calculates effective grid tiles where empty space connected to border is VOID,
     * and enclosed empty space is FLOOR.
     */
    getEffectiveTiles() {
        const effective = Array.from({ length: this.rows }, () =>
            Array.from({ length: this.cols }, () => null)
        );

        const visited = Array.from({ length: this.rows }, () =>
            Array.from({ length: this.cols }, () => false)
        );

        const queue = [];

        // Add all border empty cells to queue for BFS flood-fill
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.type === TILE_TYPES.WALL || tile.type === TILE_TYPES.GATE) {
                    effective[r][c] = { ...tile };
                } else if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
                    queue.push([c, r]);
                    visited[r][c] = true;
                }
            }
        }

        // BFS from border cells
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            effective[y][x] = { type: TILE_TYPES.VOID, color: null };

            for (const [dx, dy] of dirs) {
                const nx = x + dx;
                const ny = y + dy;
                if (this.isValidCoord(nx, ny) && !visited[ny][nx]) {
                    const nextTile = this.tiles[ny][nx];
                    if (nextTile.type !== TILE_TYPES.WALL && nextTile.type !== TILE_TYPES.GATE) {
                        visited[ny][nx] = true;
                        queue.push([nx, ny]);
                    }
                }
            }
        }

        // Remaining unvisited empty cells are enclosed, so they become FLOOR
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (effective[r][c] === null) {
                    effective[r][c] = { type: TILE_TYPES.FLOOR, color: null };
                }
            }
        }

        return effective;
    }

    getTile(x, y) {
        if (!this.isValidCoord(x, y)) {
            return { type: TILE_TYPES.VOID, color: null };
        }
        const effective = this.getEffectiveTiles();
        return effective[y][x];
    }

    getRawTile(x, y) {
        if (!this.isValidCoord(x, y)) {
            return { type: TILE_TYPES.VOID, color: null };
        }
        return this.tiles[y][x];
    }

    setTile(x, y, type, color = null, isToggle = false, isOpen = true) {
        if (this.isValidCoord(x, y)) {
            if (type === TILE_TYPES.GATE) {
                this.tiles[y][x] = {
                    type,
                    color,
                    isToggle: !!isToggle,
                    isOpen: isToggle ? !!isOpen : true
                };
            } else {
                this.tiles[y][x] = { type, color: null };
            }
        }
    }

    resize(newCols, newRows) {
        const newTiles = Array.from({ length: newRows }, (_, r) =>
            Array.from({ length: newCols }, (_, c) => {
                if (r < this.rows && c < this.cols) {
                    return { ...this.tiles[r][c] };
                }
                return { type: TILE_TYPES.EMPTY, color: null };
            })
        );
        this.cols = newCols;
        this.rows = newRows;
        this.tiles = newTiles;
    }

    clone() {
        const cloned = new GameGrid(this.cols, this.rows);
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                cloned.tiles[r][c] = { ...this.tiles[r][c] };
            }
        }
        return cloned;
    }

    toJSON() {
        return {
            cols: this.cols,
            rows: this.rows,
            tiles: this.getEffectiveTiles(),
            rawTiles: this.tiles
        };
    }

    static fromJSON(data) {
        const grid = new GameGrid(data.cols, data.rows);
        if (data.rawTiles) {
            grid.tiles = data.rawTiles;
        } else if (data.tiles) {
            grid.tiles = data.tiles;
        }
        return grid;
    }
}
