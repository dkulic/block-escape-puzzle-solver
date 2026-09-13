// src/app.js
// Main application logic for Color Block Escape Solver

import { GameGrid, TILE_TYPES, COLOR_PALETTE } from './grid.js';
import { SHAPE_TYPES, SHAPE_LABELS, getShapeCells, getShapeDimensions } from './shapes.js';
import { PuzzleSolver } from './solver.js';

class ColorBlockApp {
    constructor() {
        this.cols = 8;
        this.rows = 8;
        this.grid = new GameGrid(this.cols, this.rows);

        // Grid editing state
        this.activeGridTool = TILE_TYPES.FLOOR; // 'floor', 'wall', 'gate', 'void'
        this.selectedColor = COLOR_PALETTE[0];

        // Block creation state
        this.selectedShapeType = SHAPE_TYPES.SINGLE_1;
        this.selectedShapeRotation = 0;

        // Blocks list: [{ id, type, rotation, color, x, y }]
        this.blocks = [];
        this.nextBlockId = 1;

        // Player / Solution state
        this.isSolving = false;
        this.solutionSteps = []; // [{ blocks, move }]
        this.currentStepIndex = 0;
        this.mode = 'editor'; // 'editor' | 'player'

        // Selection / Dragging state in Editor
        this.selectedBlockId = null;
        this.isMouseDown = false;

        this.initDOM();
        this.initColorPicker();
        this.renderShapePreview();
        this.renderBoard();
        this.attachEventListeners();
    }

    initDOM() {
        this.gridBoardEl = document.getElementById('grid-board');
        this.colorPickerEl = document.getElementById('color-picker');
        this.shapeSelectEl = document.getElementById('select-shape');
        this.shapePreviewEl = document.getElementById('shape-preview');
        this.playerControlsEl = document.getElementById('player-controls');
        this.statusMessageEl = document.getElementById('status-message');
        this.statusTextEl = document.getElementById('status-text');
        this.btnModeEditor = document.getElementById('btn-mode-editor');
        this.btnModePlayer = document.getElementById('btn-mode-player');
        this.stepCounterEl = document.getElementById('step-counter');
        this.moveDescEl = document.getElementById('move-description');
    }

    initColorPicker() {
        this.colorPickerEl.innerHTML = '';
        COLOR_PALETTE.forEach((color, idx) => {
            const swatch = document.createElement('div');
            swatch.className = `color-swatch ${color === this.selectedColor ? 'selected' : ''}`;
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => {
                this.selectedColor = color;
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                this.renderShapePreview();
            });
            this.colorPickerEl.appendChild(swatch);
        });
    }

    renderShapePreview() {
        this.shapePreviewEl.innerHTML = '';
        const cells = getShapeCells(this.selectedShapeType, this.selectedShapeRotation);
        const { width, height } = getShapeDimensions(this.selectedShapeType, this.selectedShapeRotation);

        this.shapePreviewEl.style.gridTemplateColumns = `repeat(${width}, 22px)`;
        this.shapePreviewEl.style.gridTemplateRows = `repeat(${height}, 22px)`;

        const gridMap = new Set(cells.map(([x, y]) => `${x},${y}`));

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const cell = document.createElement('div');
                cell.className = 'shape-cell';
                if (gridMap.has(`${c},${r}`)) {
                    cell.style.backgroundColor = this.selectedColor;
                    cell.style.border = '1px solid rgba(255,255,255,0.4)';
                } else {
                    cell.style.backgroundColor = 'transparent';
                }
                this.shapePreviewEl.appendChild(cell);
            }
        }
    }

    renderBoard() {
        this.gridBoardEl.innerHTML = '';
        this.gridBoardEl.style.gridTemplateColumns = `repeat(${this.cols}, var(--cell-size))`;
        this.gridBoardEl.style.gridTemplateRows = `repeat(${this.rows}, var(--cell-size))`;

        // Render Grid Cells
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.grid.getTile(c, r);
                const cell = document.createElement('div');
                cell.className = `grid-cell tile-${tile.type}`;
                cell.dataset.x = c;
                cell.dataset.y = r;

                if (tile.type === TILE_TYPES.GATE && tile.color) {
                    cell.style.color = tile.color;
                }

                if (this.mode === 'editor') {
                    cell.addEventListener('mousedown', (e) => {
                        this.isMouseDown = true;
                        this.handleCellClick(c, r);
                    });
                    cell.addEventListener('mouseenter', (e) => {
                        if (this.isMouseDown) {
                            this.handleCellClick(c, r);
                        }
                    });
                }

                this.gridBoardEl.appendChild(cell);
            }
        }

        // Render Blocks
        const currentBlocks = (this.mode === 'player' && this.solutionSteps.length > 0)
            ? this.solutionSteps[this.currentStepIndex].blocks
            : this.blocks;

        currentBlocks.forEach(block => {
            this.renderBlock(block);
        });
    }

    renderBlock(block) {
        const shapeCells = getShapeCells(block.type, block.rotation);
        const blockEl = document.createElement('div');
        blockEl.className = 'block-element';
        blockEl.dataset.id = block.id;

        shapeCells.forEach(([cx, cy]) => {
            const cellEl = document.createElement('div');
            cellEl.className = 'block-cell';
            const cellX = (block.x + cx) * 42; // cell-size 40px + 2px gap
            const cellY = (block.y + cy) * 42;
            cellEl.style.left = `${cellX}px`;
            cellEl.style.top = `${cellY}px`;
            cellEl.style.backgroundColor = block.color;

            if (block.id === this.selectedBlockId && this.mode === 'editor') {
                cellEl.style.boxShadow = '0 0 0 3px #ffffff, 0 4px 8px rgba(0,0,0,0.5)';
            }

            blockEl.appendChild(cellEl);
        });

        if (this.mode === 'editor') {
            blockEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedBlockId = (this.selectedBlockId === block.id) ? null : block.id;
                this.renderBoard();
            });
        }

        this.gridBoardEl.appendChild(blockEl);
    }

    handleCellClick(x, y) {
        if (this.mode !== 'editor') return;

        // If a block is currently selected, clicking on board moves that block
        if (this.selectedBlockId !== null) {
            const blockIndex = this.blocks.findIndex(b => b.id === this.selectedBlockId);
            if (blockIndex !== -1) {
                this.blocks[blockIndex].x = x;
                this.blocks[blockIndex].y = y;
                this.renderBoard();
                return;
            }
        }

        // Apply active grid tool
        this.grid.setTile(x, y, this.activeGridTool, this.selectedColor);
        this.renderBoard();
    }

    attachEventListeners() {
        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        // Grid Tool Selection Buttons
        ['floor', 'wall', 'gate', 'void'].forEach(tool => {
            const btn = document.getElementById(`tool-${tool}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.tool-buttons .btn').forEach(b => {
                        if (b.id.startsWith('tool-')) b.classList.remove('active');
                    });
                    btn.classList.add('active');
                    this.activeGridTool = tool;
                    this.selectedBlockId = null;
                });
            }
        });

        // Shape Selection and Rotation
        this.shapeSelectEl.addEventListener('change', (e) => {
            this.selectedShapeType = e.target.value;
            this.renderShapePreview();
        });

        document.getElementById('btn-rotate-shape').addEventListener('click', () => {
            this.selectedShapeRotation = (this.selectedShapeRotation + 1) % 4;
            this.renderShapePreview();
        });

        // Add Block Button
        document.getElementById('btn-add-block').addEventListener('click', () => {
            if (this.mode !== 'editor') return;
            // Place at first available cell (0, 0)
            const newBlock = {
                id: this.nextBlockId++,
                type: this.selectedShapeType,
                rotation: this.selectedShapeRotation,
                color: this.selectedColor,
                x: 0,
                y: 0
            };
            this.blocks.push(newBlock);
            this.selectedBlockId = newBlock.id;
            this.renderBoard();
        });

        // Resize Grid Button
        document.getElementById('btn-resize-grid').addEventListener('click', () => {
            const cols = parseInt(document.getElementById('input-cols').value, 10);
            const rows = parseInt(document.getElementById('input-rows').value, 10);
            if (cols >= 3 && cols <= 15 && rows >= 3 && rows <= 15) {
                this.cols = cols;
                this.rows = rows;
                this.grid.resize(cols, rows);
                this.renderBoard();
            }
        });

        // Clear Map Button
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('Da li ste sigurni da želite da očistite celu mapu i sve blokove?')) {
                this.grid = new GameGrid(this.cols, this.rows);
                this.blocks = [];
                this.selectedBlockId = null;
                this.switchMode('editor');
                this.renderBoard();
            }
        });

        // Solve Button
        document.getElementById('btn-solve').addEventListener('click', () => {
            this.solvePuzzle();
        });

        // Player navigation controls
        document.getElementById('btn-prev-step').addEventListener('click', () => {
            if (this.currentStepIndex > 0) {
                this.currentStepIndex--;
                this.updatePlayerUI();
            }
        });

        document.getElementById('btn-next-step').addEventListener('click', () => {
            if (this.currentStepIndex < this.solutionSteps.length - 1) {
                this.currentStepIndex++;
                this.updatePlayerUI();
            }
        });

        // Mode buttons
        this.btnModeEditor.addEventListener('click', () => this.switchMode('editor'));
        this.btnModePlayer.addEventListener('click', () => this.switchMode('player'));

        // Keyboard navigation for step player
        document.addEventListener('keydown', (e) => {
            if (this.mode === 'player') {
                if (e.key === 'ArrowLeft' && this.currentStepIndex > 0) {
                    this.currentStepIndex--;
                    this.updatePlayerUI();
                } else if (e.key === 'ArrowRight' && this.currentStepIndex < this.solutionSteps.length - 1) {
                    this.currentStepIndex++;
                    this.updatePlayerUI();
                }
            } else if (this.mode === 'editor' && this.selectedBlockId !== null) {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    this.blocks = this.blocks.filter(b => b.id !== this.selectedBlockId);
                    this.selectedBlockId = null;
                    this.renderBoard();
                } else if (e.key === 'r' || e.key === 'R') {
                    const block = this.blocks.find(b => b.id === this.selectedBlockId);
                    if (block) {
                        block.rotation = (block.rotation + 1) % 4;
                        this.renderBoard();
                    }
                }
            }
        });
    }

    switchMode(targetMode) {
        if (targetMode === 'player' && this.solutionSteps.length === 0) return;
        this.mode = targetMode;

        if (this.mode === 'editor') {
            this.btnModeEditor.classList.add('active');
            this.btnModePlayer.classList.remove('active');
            this.playerControlsEl.style.display = 'none';
        } else {
            this.btnModeEditor.classList.remove('active');
            this.btnModePlayer.classList.add('active');
            this.playerControlsEl.style.display = 'flex';
            this.updatePlayerUI();
        }
        this.renderBoard();
    }

    solvePuzzle() {
        if (this.blocks.length === 0) {
            alert('Molimo ubacite bar jedan blok na mapu pre rešavanja!');
            return;
        }

        this.statusMessageEl.style.display = 'flex';
        this.statusTextEl.textContent = 'Rešavanje slagalice u toku...';

        // Run solver in Web Worker or async timeout to avoid UI freeze
        setTimeout(() => {
            const solver = new PuzzleSolver(this.grid.toJSON(), this.blocks);
            const result = solver.solve(150000, (exploredCount) => {
                this.statusTextEl.textContent = `Pretraženo stanja: ${exploredCount}...`;
            });

            this.statusMessageEl.style.display = 'none';

            if (result.success) {
                // Build initial step 0 state
                this.solutionSteps = [
                    { blocks: this.blocks.map(b => ({ ...b })), move: null },
                    ...result.steps
                ];
                this.currentStepIndex = 0;
                this.btnModePlayer.disabled = false;
                this.switchMode('player');
            } else {
                alert(`Rešavanje nije uspelo: ${result.error}`);
            }
        }, 50);
    }

    updatePlayerUI() {
        this.stepCounterEl.textContent = `Korak ${this.currentStepIndex} / ${this.solutionSteps.length - 1}`;
        const currentStep = this.solutionSteps[this.currentStepIndex];

        if (this.currentStepIndex === 0) {
            this.moveDescEl.textContent = 'Početni raspored mape';
        } else if (currentStep && currentStep.move) {
            const { blockId, dir, exited } = currentStep.move;
            if (exited) {
                this.moveDescEl.textContent = `Blok #${blockId} izlazi sa mape u smeru ${dir}! 🎉`;
            } else {
                this.moveDescEl.textContent = `Pomeri Blok #${blockId} u smeru: ${dir}`;
            }
        }
        this.renderBoard();
    }
}

// Initialize application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.app = new ColorBlockApp();
});
