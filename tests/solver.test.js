import { PuzzleSolver } from '../src/solver.js';
import { GameGrid, TILE_TYPES, COLOR_PALETTE } from '../src/grid.js';
import { SHAPE_TYPES, BLOCK_TYPES } from '../src/shapes.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

console.log('Running PuzzleSolver tests...');

// Test 1: Single basic block solve
{
    const grid = new GameGrid(5, 5);
    for (let r = 1; r <= 3; r++) {
        grid.setTile(1, r, TILE_TYPES.WALL);
        grid.setTile(3, r, TILE_TYPES.WALL);
    }
    grid.setTile(2, 1, TILE_TYPES.WALL);
    grid.setTile(2, 3, TILE_TYPES.WALL);
    grid.setTile(1, 2, TILE_TYPES.GATE, COLOR_PALETTE[0]); // Red gate

    const blocks = [
        { id: 1, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], x: 2, y: 2, blockType: BLOCK_TYPES.NORMAL }
    ];

    const solver = new PuzzleSolver(grid.toJSON(), blocks, []);
    const res = solver.solve();
    assert(res.success === true, 'Test 1 failed: basic solve should succeed');
    console.log('✓ Test 1: Single basic block exit');
}

// Test 2: Two stitched blocks move together and exit individually
{
    const grid = new GameGrid(6, 6);
    for (let r = 1; r <= 3; r++) {
        grid.setTile(1, r, TILE_TYPES.WALL);
        grid.setTile(4, r, TILE_TYPES.WALL);
    }
    for (let c = 1; c <= 4; c++) {
        grid.setTile(c, 1, TILE_TYPES.WALL);
        grid.setTile(c, 3, TILE_TYPES.WALL);
    }
    grid.setTile(1, 2, TILE_TYPES.GATE, COLOR_PALETTE[0]); // Red gate
    grid.setTile(4, 2, TILE_TYPES.GATE, COLOR_PALETTE[1]); // Blue gate

    const blocks = [
        { id: 1, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], x: 2, y: 2, blockType: BLOCK_TYPES.NORMAL },
        { id: 2, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[1], x: 3, y: 2, blockType: BLOCK_TYPES.NORMAL }
    ];
    const stitches = [[1, 2]];

    const solver = new PuzzleSolver(grid.toJSON(), blocks, stitches);
    const res = solver.solve();
    assert(res.success === true, 'Test 2 failed: 2 stitched blocks should solve');
    assert(res.steps.length === 2, 'Test 2 failed: expected 2 exit steps');
    console.log('✓ Test 2: Two stitched blocks exit through matching gates');
}

// Test 3: Three stitched blocks (1 exits, remaining 2 remain stitched and move together)
{
    const grid = new GameGrid(7, 5);
    for (let r = 1; r <= 3; r++) {
        grid.setTile(1, r, TILE_TYPES.WALL);
        grid.setTile(5, r, TILE_TYPES.WALL);
    }
    for (let c = 1; c <= 5; c++) {
        grid.setTile(c, 1, TILE_TYPES.WALL);
        grid.setTile(c, 3, TILE_TYPES.WALL);
    }
    grid.setTile(1, 2, TILE_TYPES.GATE, COLOR_PALETTE[0]); // Red gate
    grid.setTile(5, 2, TILE_TYPES.GATE, COLOR_PALETTE[1]); // Blue gate

    const blocks = [
        { id: 1, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], x: 2, y: 2, blockType: BLOCK_TYPES.NORMAL },
        { id: 2, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], x: 3, y: 2, blockType: BLOCK_TYPES.NORMAL },
        { id: 3, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[1], x: 4, y: 2, blockType: BLOCK_TYPES.NORMAL }
    ];
    const stitches = [[1, 2], [2, 3]];

    const solver = new PuzzleSolver(grid.toJSON(), blocks, stitches);
    const res = solver.solve();
    assert(res.success === true, 'Test 3 failed: 3 stitched blocks should solve');
    console.log('✓ Test 3: Three stitched blocks un-stitch sequentially on exit');
}

// Test 4: Frozen block in stitched group prevents group movement when group must move
{
    const grid = new GameGrid(7, 7);
    for (let r = 1; r <= 5; r++) {
        grid.setTile(1, r, TILE_TYPES.WALL);
        grid.setTile(5, r, TILE_TYPES.WALL);
        grid.setTile(r, 1, TILE_TYPES.WALL);
        grid.setTile(r, 5, TILE_TYPES.WALL);
    }
    grid.setTile(1, 2, TILE_TYPES.GATE, COLOR_PALETTE[0]); // Red gate at (1, 2)
    grid.setTile(5, 2, TILE_TYPES.GATE, COLOR_PALETTE[1]); // Blue gate at (5, 2)

    // Blocks at row 3; must move UP to row 2 to reach gates, but Block 2 is frozen!
    const blocks = [
        { id: 1, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], x: 2, y: 3, blockType: BLOCK_TYPES.NORMAL },
        { id: 2, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[1], x: 3, y: 3, blockType: BLOCK_TYPES.FROZEN, freezeCount: 1 }
    ];
    const stitches = [[1, 2]];

    const solver = new PuzzleSolver(grid.toJSON(), blocks, stitches);
    const res = solver.solve();
    assert(res.success === false, 'Test 4 failed: frozen block in group should prevent group movement');
    console.log('✓ Test 4: Frozen block in stitched group prevents group movement');
}

// Test 5: Dual color block in stitched group peels outer color
{
    const grid = new GameGrid(6, 6);
    for (let r = 1; r <= 3; r++) {
        grid.setTile(1, r, TILE_TYPES.WALL);
        grid.setTile(4, r, TILE_TYPES.WALL);
    }
    for (let c = 1; c <= 4; c++) {
        grid.setTile(c, 1, TILE_TYPES.WALL);
        grid.setTile(c, 3, TILE_TYPES.WALL);
    }
    grid.setTile(1, 2, TILE_TYPES.GATE, COLOR_PALETTE[0]); // Red gate
    grid.setTile(4, 2, TILE_TYPES.GATE, COLOR_PALETTE[1]); // Blue gate

    const blocks = [
        { id: 1, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], innerColor: COLOR_PALETTE[1], x: 2, y: 2, blockType: BLOCK_TYPES.DUAL },
        { id: 2, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[1], x: 3, y: 2, blockType: BLOCK_TYPES.NORMAL }
    ];
    const stitches = [[1, 2]];

    const solver = new PuzzleSolver(grid.toJSON(), blocks, stitches);
    const res = solver.solve();
    assert(res.success === true, 'Test 5 failed: dual color in stitched group should peel then exit');
    console.log('✓ Test 5: Dual color block in stitched group peels outer color');
}

// Test 6: Stitched blocks group movement with obstacles and exit
{
    const grid = new GameGrid(6, 6);
    for (let r = 1; r <= 4; r++) {
        grid.setTile(1, r, TILE_TYPES.WALL);
        grid.setTile(4, r, TILE_TYPES.WALL);
    }
    for (let c = 1; c <= 4; c++) {
        grid.setTile(c, 1, TILE_TYPES.WALL);
        grid.setTile(c, 4, TILE_TYPES.WALL);
    }
    grid.setTile(1, 2, TILE_TYPES.GATE, COLOR_PALETTE[0]); // Red gate
    grid.setTile(4, 3, TILE_TYPES.GATE, COLOR_PALETTE[1]); // Blue gate

    const blocks = [
        { id: 1, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], x: 2, y: 2, blockType: BLOCK_TYPES.NORMAL },
        { id: 2, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[1], x: 3, y: 2, blockType: BLOCK_TYPES.NORMAL }
    ];
    const stitches = [[1, 2]];

    const solver = new PuzzleSolver(grid.toJSON(), blocks, stitches);
    const res = solver.solve();
    assert(res.success === true, 'Test 6 failed: stitched blocks should navigate and exit');
    console.log('✓ Test 6: Stitched blocks navigate obstacles and exit');
}

// Test 7: Save & Load Map JSON serialization with Stitches & Solver
{
    const grid = new GameGrid(6, 6);
    grid.setTile(1, 2, TILE_TYPES.GATE, COLOR_PALETTE[0]);
    grid.setTile(4, 2, TILE_TYPES.GATE, COLOR_PALETTE[1]);
    for (let c = 1; c <= 4; c++) {
        grid.setTile(c, 1, TILE_TYPES.WALL);
        grid.setTile(c, 3, TILE_TYPES.WALL);
    }

    const blocks = [
        { id: 1, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[0], x: 2, y: 2, blockType: BLOCK_TYPES.NORMAL },
        { id: 2, type: SHAPE_TYPES.SINGLE_1, rotation: 0, color: COLOR_PALETTE[1], x: 3, y: 2, blockType: BLOCK_TYPES.NORMAL }
    ];
    const stitches = [[1, 2]];

    // Export map JSON string (same format as app.exportMapToFile)
    const mapData = {
        version: 1,
        cols: 6,
        rows: 6,
        grid: grid.toJSON(),
        blocks: blocks,
        stitches: stitches,
        nextBlockId: 3
    };
    const jsonStr = JSON.stringify(mapData);

    // Import map from JSON (same format as app.importMapFromFile)
    const importedData = JSON.parse(jsonStr);
    const importedGrid = GameGrid.fromJSON(importedData.grid);
    const importedBlocks = importedData.blocks;
    const importedStitches = importedData.stitches;

    assert(importedStitches.length === 1 && importedStitches[0][0] === 1 && importedStitches[0][1] === 2, 'Test 7 failed: stitches serialization mismatch');

    const solver = new PuzzleSolver(importedGrid.toJSON(), importedBlocks, importedStitches);
    const res = solver.solve();
    assert(res.success === true, 'Test 7 failed: imported map should solve successfully');
    console.log('✓ Test 7: Save & Load map JSON serialization with stitches');
}

console.log('\nAll PuzzleSolver tests passed successfully! ✨');
