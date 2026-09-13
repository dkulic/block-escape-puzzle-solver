// src/shapes.js
// Shape definitions and rotation utilities for Color Block Escape Puzzle

export const SHAPE_TYPES = {
    SINGLE_1: 'single_1',
    LINE_2: 'line_2',
    LINE_3: 'line_3',
    LINE_4: 'line_4',
    SQUARE_2X2: 'square_2x2',
    L_3: 'l_3',
    T_4: 't_4',
    PLUS_5: 'plus_5'
};

export const SHAPE_LABELS = {
    [SHAPE_TYPES.SINGLE_1]: 'Single (1x1)',
    [SHAPE_TYPES.LINE_2]: 'Line (2)',
    [SHAPE_TYPES.LINE_3]: 'Line (3)',
    [SHAPE_TYPES.LINE_4]: 'Line (4)',
    [SHAPE_TYPES.SQUARE_2X2]: 'Square (2x2)',
    [SHAPE_TYPES.L_3]: 'L Shape (3)',
    [SHAPE_TYPES.T_4]: 'T Shape (4)',
    [SHAPE_TYPES.PLUS_5]: 'Plus (+ 5)'
};

export const BLOCK_TYPES = {
    NORMAL: 'normal',
    DUAL: 'dual',
    LOCKED: 'locked',
    KEY: 'key',
    FROZEN: 'frozen'
};

// Base coordinate definitions for each shape at rotation 0
const BASE_SHAPES = {
    [SHAPE_TYPES.SINGLE_1]: [[0, 0]],
    [SHAPE_TYPES.LINE_2]: [[0, 0], [1, 0]],
    [SHAPE_TYPES.LINE_3]: [[0, 0], [1, 0], [2, 0]],
    [SHAPE_TYPES.LINE_4]: [[0, 0], [1, 0], [2, 0], [3, 0]],
    [SHAPE_TYPES.SQUARE_2X2]: [[0, 0], [1, 0], [0, 1], [1, 1]],
    [SHAPE_TYPES.L_3]: [[0, 0], [0, 1], [1, 1]],
    [SHAPE_TYPES.T_4]: [[0, 0], [1, 0], [2, 0], [1, 1]],
    [SHAPE_TYPES.PLUS_5]: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
};

// Utility to normalize coordinates so min x = 0 and min y = 0
export function normalizeCells(cells) {
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    return cells
        .map(([x, y]) => [x - minX, y - minY])
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

// Rotate cells by 90 degrees clockwise 'rot' times (0, 1, 2, 3)
export function getShapeCells(type, rotation = 0) {
    let cells = BASE_SHAPES[type] || [[0, 0]];
    const rotCount = (rotation % 4 + 4) % 4;

    for (let i = 0; i < rotCount; i++) {
        // Rotate 90 deg clockwise: (x, y) -> (-y, x)
        cells = cells.map(([x, y]) => [-y, x]);
    }

    return normalizeCells(cells);
}

// Get bounding box dimensions for a shape at rotation
export function getShapeDimensions(type, rotation = 0) {
    const cells = getShapeCells(type, rotation);
    const maxX = Math.max(...cells.map(([x]) => x));
    const maxY = Math.max(...cells.map(([, y]) => y));
    return { width: maxX + 1, height: maxY + 1 };
}
