// src/grid.js
// Representation of the puzzle grid: tiles, bounds, walls, and gates.

export const TILE_TYPES = {
    VOID: 'void',
    FLOOR: 'floor',
    WALL: 'wall',
    GATE: 'gate'
};

export const COLOR_PALETTE = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f1c40f', // Yellow
    '#9b59b6', // Purple
    '#e67e22', // Orange
    '#1abc9c', // Teal
    '#e84393'  // Pink
];

export class GameGrid {
    constructor(cols = 10, rows = 10) {
        this.cols = cols;
        this.rows = rows;
        // 2D grid storing tile objects: { type: TILE_TYPES, color: null | string }
        this.tiles = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => ({ type: TILE_TYPES.FLOOR, color: null }))
        );
    }

    isValidCoord(x, y) {
        return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    getTile(x, y) {
        if (!this.isValidCoord(x, y)) {
            return { type: TILE_TYPES.VOID, color: null };
        }
        return this.tiles[y][x];
    }

    setTile(x, y, type, color = null) {
        if (this.isValidCoord(x, y)) {
            this.tiles[y][x] = { type, color: type === TILE_TYPES.GATE ? color : null };
        }
    }

    resize(newCols, newRows) {
        const newTiles = Array.from({ length: newRows }, (_, r) =>
            Array.from({ length: newCols }, (_, c) => {
                if (r < this.rows && c < this.cols) {
                    return { ...this.tiles[r][c] };
                }
                return { type: TILE_TYPES.FLOOR, color: null };
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
            tiles: this.tiles
        };
    }

    static fromJSON(data) {
        const grid = new GameGrid(data.cols, data.rows);
        grid.tiles = data.tiles;
        return grid;
    }
}
