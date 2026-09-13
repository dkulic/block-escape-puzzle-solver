// src/app.js
// Main application logic for Color Block Escape Solver

import { GameGrid, TILE_TYPES, COLOR_PALETTE } from './grid.js';
import { SHAPE_TYPES, SHAPE_LABELS, BLOCK_TYPES, getShapeCells, getShapeDimensions } from './shapes.js';
import { PuzzleSolver } from './solver.js';

class ColorBlockApp {
    constructor() {
        this.cols = 8;
        this.rows = 8;
        this.grid = new GameGrid(this.cols, this.rows);

        // Grid editing state: 'wall', 'gate', 'erase'
        this.activeGridTool = 'wall';
        this.selectedColor = COLOR_PALETTE[0];

        // Gate options
        this.gateIsToggle = false;
        this.gateInitialIsOpen = true;

        // Block creation state
        this.selectedShapeType = SHAPE_TYPES.SINGLE_1;
        this.selectedShapeRotation = 0;
        this.selectedBlockType = BLOCK_TYPES.NORMAL;
        this.selectedInnerColor = COLOR_PALETTE[1];
        this.selectedKeyCount = 1;
        this.selectedFreezeCount = 1;
        this.selectedIsPriority = false;

        // Selected elements in editor
        this.selectedBlockId = null;
        this.selectedGateCoord = null; // { x, y }

        // Blocks list: [{ id, type, rotation, color, x, y, blockType, innerColor, keyCount, freezeCount, isPriority }]
        this.blocks = [];
        this.nextBlockId = 1;

        // Undo stack
        this.undoStack = [];

        // Player / Solution state
        this.isSolving = false;
        this.solutionSteps = []; // [{ blocks, tiles, move }]
        this.currentStepIndex = 0;
        this.mode = 'editor'; // 'editor' | 'player'

        this.isMouseDown = false;

        this.initDOM();
        this.initColorPickers();
        this.renderShapePreview();
        this.renderBoard();
        this.attachEventListeners();
    }

    initDOM() {
        this.gridBoardEl = document.getElementById('grid-board');
        this.colorPickerEl = document.getElementById('color-picker');
        this.innerColorPickerEl = document.getElementById('inner-color-picker');
        this.shapeSelectEl = document.getElementById('select-shape');
        this.shapePreviewEl = document.getElementById('shape-preview');
        this.playerControlsEl = document.getElementById('player-controls');
        this.statusMessageEl = document.getElementById('status-message');
        this.statusTextEl = document.getElementById('status-text');
        this.btnModeEditor = document.getElementById('btn-mode-editor');
        this.btnModePlayer = document.getElementById('btn-mode-player');
        this.stepCounterEl = document.getElementById('step-counter');
        this.moveDescEl = document.getElementById('move-description');
        this.btnUndo = document.getElementById('btn-undo');

        // Gate options DOM
        this.gateOptionsEl = document.getElementById('gate-options');
        this.chkGateToggleEl = document.getElementById('chk-gate-toggle');
        this.gateInitialGroupEl = document.getElementById('gate-initial-state-group');
        this.selectGateStateEl = document.getElementById('select-gate-state');

        // Block type DOM
        this.selectBlockTypeEl = document.getElementById('select-block-type');
        this.dualColorGroupEl = document.getElementById('dual-color-group');
        this.lockedCountGroupEl = document.getElementById('locked-count-group');
        this.frozenCountGroupEl = document.getElementById('frozen-count-group');
        this.inputKeyCountEl = document.getElementById('input-key-count');
        this.inputFreezeCountEl = document.getElementById('input-freeze-count');
        this.chkPriorityBlockEl = document.getElementById('chk-priority-block');
    }

    initColorPickers() {
        // Outer color picker
        this.colorPickerEl.innerHTML = '';
        COLOR_PALETTE.forEach((color) => {
            const swatch = document.createElement('div');
            swatch.className = `color-swatch ${color === this.selectedColor ? 'selected' : ''}`;
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => {
                this.selectedColor = color;
                this.colorPickerEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                this.onOuterColorChanged(color);
            });
            this.colorPickerEl.appendChild(swatch);
        });

        // Inner color picker
        this.innerColorPickerEl.innerHTML = '';
        COLOR_PALETTE.forEach((color) => {
            const swatch = document.createElement('div');
            swatch.className = `color-swatch ${color === this.selectedInnerColor ? 'selected' : ''}`;
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => {
                this.selectedInnerColor = color;
                this.innerColorPickerEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                this.onInnerColorChanged(color);
            });
            this.innerColorPickerEl.appendChild(swatch);
        });
    }

    onOuterColorChanged(color) {
        if (this.selectedBlockId !== null) {
            const block = this.blocks.find(b => b.id === this.selectedBlockId);
            if (block) {
                this.saveUndoState();
                block.color = color;
            }
        } else if (this.selectedGateCoord !== null) {
            const { x, y } = this.selectedGateCoord;
            const tile = this.grid.getRawTile(x, y);
            if (tile.type === TILE_TYPES.GATE) {
                this.saveUndoState();
                tile.color = color;
            }
        }
        this.renderShapePreview();
        this.renderBoard();
    }

    onInnerColorChanged(color) {
        if (this.selectedBlockId !== null) {
            const block = this.blocks.find(b => b.id === this.selectedBlockId);
            if (block && block.blockType === BLOCK_TYPES.DUAL) {
                this.saveUndoState();
                block.innerColor = color;
            }
        }
        this.renderShapePreview();
        this.renderBoard();
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
                cell.style.position = 'relative';

                if (gridMap.has(`${c},${r}`)) {
                    cell.style.backgroundColor = this.selectedColor;
                    cell.style.border = '1px solid rgba(255,255,255,0.4)';

                    if (this.selectedBlockType === BLOCK_TYPES.DUAL) {
                        const innerCross = document.createElement('div');
                        innerCross.className = 'block-cell-inner-cross';
                        innerCross.style.backgroundColor = this.selectedInnerColor;
                        cell.appendChild(innerCross);
                    }
                } else {
                    cell.style.backgroundColor = 'transparent';
                }
                this.shapePreviewEl.appendChild(cell);
            }
        }
    }

    saveUndoState() {
        this.undoStack.push({
            gridRawTiles: JSON.parse(JSON.stringify(this.grid.tiles)),
            cols: this.cols,
            rows: this.rows,
            blocks: JSON.parse(JSON.stringify(this.blocks)),
            selectedBlockId: this.selectedBlockId,
            selectedGateCoord: this.selectedGateCoord ? { ...this.selectedGateCoord } : null,
            nextBlockId: this.nextBlockId
        });
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const lastState = this.undoStack.pop();
        this.cols = lastState.cols;
        this.rows = lastState.rows;
        this.grid.cols = lastState.cols;
        this.grid.rows = lastState.rows;
        this.grid.tiles = JSON.parse(JSON.stringify(lastState.gridRawTiles));
        this.blocks = JSON.parse(JSON.stringify(lastState.blocks));
        this.selectedBlockId = lastState.selectedBlockId;
        this.selectedGateCoord = lastState.selectedGateCoord;
        this.nextBlockId = lastState.nextBlockId;

        const colsInput = document.getElementById('input-cols');
        const rowsInput = document.getElementById('input-rows');
        if (colsInput) colsInput.value = this.cols;
        if (rowsInput) rowsInput.value = this.rows;

        this.renderBoard();
    }

    isValidBlockPosition(type, rotation, color, x, y, ignoreBlockId = null) {
        const shapeCells = getShapeCells(type, rotation);
        const effectiveTiles = this.grid.getEffectiveTiles();

        for (const [cx, cy] of shapeCells) {
            const gx = x + cx;
            const gy = y + cy;

            if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
                return false;
            }

            const tile = effectiveTiles[gy][gx];
            if (tile.type !== TILE_TYPES.FLOOR) {
                return false;
            }

            // Check collision with other blocks
            for (const other of this.blocks) {
                if (other.id === ignoreBlockId) continue;
                const otherCells = getShapeCells(other.type, other.rotation);
                for (const [ocx, ocy] of otherCells) {
                    if (other.x + ocx === gx && other.y + ocy === gy) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    findFirstValidPosition(type, rotation, color) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.isValidBlockPosition(type, rotation, color, c, r)) {
                    return { x: c, y: r };
                }
            }
        }
        return null;
    }

    renderBoard() {
        this.gridBoardEl.innerHTML = '';
        this.gridBoardEl.style.gridTemplateColumns = `repeat(${this.cols}, var(--cell-size))`;
        this.gridBoardEl.style.gridTemplateRows = `repeat(${this.rows}, var(--cell-size))`;

        const currentTiles = (this.mode === 'player' && this.solutionSteps.length > 0)
            ? this.solutionSteps[this.currentStepIndex].tiles
            : this.grid.getEffectiveTiles();

        // Render Grid Cells
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = currentTiles[r][c];
                const cell = document.createElement('div');
                cell.className = `grid-cell tile-${tile.type}`;
                cell.dataset.x = c;
                cell.dataset.y = r;

                if (tile.type === TILE_TYPES.GATE) {
                    cell.style.color = tile.color || '#3b82f6';
                    if (tile.isToggle) {
                        cell.classList.add('gate-toggle');
                    }
                    if (tile.isOpen === false) {
                        cell.classList.add('gate-closed');
                    }
                }

                if (this.mode === 'editor') {
                    cell.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return;
                        this.isMouseDown = true;
                        this.saveUndoState();
                        this.handleCellClick(c, r);
                    });
                    cell.addEventListener('mouseenter', () => {
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
        const { width, height } = getShapeDimensions(block.type, block.rotation);
        const blockEl = document.createElement('div');
        blockEl.className = 'block-element';
        blockEl.dataset.id = block.id;

        const cellSet = new Set(shapeCells.map(([cx, cy]) => `${cx},${cy}`));

        // Identify center cell for icon/badge rendering
        const centerCx = Math.floor((width - 1) / 2);
        const centerCy = Math.floor((height - 1) / 2);
        let centerCellCoords = shapeCells.find(([cx, cy]) => cx === centerCx && cy === centerCy) || shapeCells[0];

        shapeCells.forEach(([cx, cy], idx) => {
            const cellEl = document.createElement('div');
            cellEl.className = 'block-cell';
            if (block.blockType === BLOCK_TYPES.FROZEN && block.freezeCount > 0) {
                cellEl.classList.add('frozen-cell');
            }

            const cellX = (block.x + cx) * 42;
            const cellY = (block.y + cy) * 42;
            cellEl.style.left = `${cellX}px`;
            cellEl.style.top = `${cellY}px`;
            cellEl.style.backgroundColor = block.color;

            const hasTop = cellSet.has(`${cx},${cy - 1}`);
            const hasRight = cellSet.has(`${cx + 1},${cy}`);
            const hasBottom = cellSet.has(`${cx},${cy + 1}`);
            const hasLeft = cellSet.has(`${cx - 1},${cy}`);

            const borderStr = '2px solid rgba(0, 0, 0, 0.9)';
            cellEl.style.borderTop = hasTop ? 'none' : borderStr;
            cellEl.style.borderRight = hasRight ? 'none' : borderStr;
            cellEl.style.borderBottom = hasBottom ? 'none' : borderStr;
            cellEl.style.borderLeft = hasLeft ? 'none' : borderStr;

            cellEl.style.borderTopLeftRadius = (!hasTop && !hasLeft) ? '6px' : '0px';
            cellEl.style.borderTopRightRadius = (!hasTop && !hasRight) ? '6px' : '0px';
            cellEl.style.borderBottomRightRadius = (!hasBottom && !hasRight) ? '6px' : '0px';
            cellEl.style.borderBottomLeftRadius = (!hasBottom && !hasLeft) ? '6px' : '0px';

            // Dual color inner cross pattern on every cell
            if (block.blockType === BLOCK_TYPES.DUAL && block.innerColor) {
                const innerCross = document.createElement('div');
                innerCross.className = 'block-cell-inner-cross';
                innerCross.style.backgroundColor = block.innerColor;
                cellEl.appendChild(innerCross);
            }

            // Top-left priority star overlay
            if (idx === 0 && block.isPriority) {
                const starEl = document.createElement('span');
                starEl.className = 'block-priority-star';
                starEl.textContent = '⭐';
                cellEl.appendChild(starEl);
            }

            // Center cell badge (Locked padlock, Key, Frozen ice count)
            if (cx === centerCellCoords[0] && cy === centerCellCoords[1]) {
                let badgeText = null;
                if (block.blockType === BLOCK_TYPES.LOCKED) {
                    badgeText = `🔒 ${block.keyCount}`;
                } else if (block.blockType === BLOCK_TYPES.KEY) {
                    badgeText = `🔑`;
                } else if (block.blockType === BLOCK_TYPES.FROZEN) {
                    badgeText = `🧊 ${block.freezeCount}`;
                }

                if (badgeText) {
                    const badgeEl = document.createElement('div');
                    badgeEl.className = 'block-center-badge';
                    badgeEl.textContent = badgeText;
                    cellEl.appendChild(badgeEl);
                }
            }

            if (block.id === this.selectedBlockId && this.mode === 'editor') {
                cellEl.style.boxShadow = '0 0 0 3px #ffffff, 0 4px 8px rgba(0,0,0,0.5)';
            } else {
                cellEl.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.25)';
            }

            blockEl.appendChild(cellEl);
        });

        if (this.mode === 'editor') {
            blockEl.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();

                this.selectBlock(block.id);

                const startMouseX = e.clientX;
                const startMouseY = e.clientY;
                const origX = block.x;
                const origY = block.y;

                let dragging = false;
                let candidateX = origX;
                let candidateY = origY;
                let isValid = true;
                let isOffBoard = false;

                const onMouseMove = (moveEvent) => {
                    const dxPixels = moveEvent.clientX - startMouseX;
                    const dyPixels = moveEvent.clientY - startMouseY;

                    if (!dragging && (Math.abs(dxPixels) > 3 || Math.abs(dyPixels) > 3)) {
                        dragging = true;
                    }

                    if (!dragging) return;

                    const gridOffsetCols = Math.round(dxPixels / 42);
                    const gridOffsetRows = Math.round(dyPixels / 42);

                    candidateX = origX + gridOffsetCols;
                    candidateY = origY + gridOffsetRows;

                    const shape = getShapeCells(block.type, block.rotation);
                    const minX = Math.min(...shape.map(([cx]) => candidateX + cx));
                    const maxX = Math.max(...shape.map(([cx]) => candidateX + cx));
                    const minY = Math.min(...shape.map(([, cy]) => candidateY + cy));
                    const maxY = Math.max(...shape.map(([, cy]) => candidateY + cy));

                    isOffBoard = (maxX < 0 || minX >= this.cols || maxY < 0 || minY >= this.rows);

                    if (isOffBoard) {
                        isValid = false;
                    } else {
                        isValid = this.isValidBlockPosition(block.type, block.rotation, block.color, candidateX, candidateY, block.id);
                    }

                    this.updateDragPreview(block, candidateX, candidateY, isValid, isOffBoard);
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    if (dragging) {
                        if (isOffBoard) {
                            this.saveUndoState();
                            this.blocks = this.blocks.filter(b => b.id !== block.id);
                            this.selectedBlockId = null;
                        } else if (isValid && (candidateX !== origX || candidateY !== origY)) {
                            this.saveUndoState();
                            block.x = candidateX;
                            block.y = candidateY;
                        } else {
                            block.x = origX;
                            block.y = origY;
                        }
                    }
                    this.renderBoard();
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        this.gridBoardEl.appendChild(blockEl);
    }

    selectBlock(blockId) {
        this.selectedBlockId = blockId;
        this.selectedGateCoord = null;
        const block = this.blocks.find(b => b.id === blockId);
        if (block) {
            this.selectedColor = block.color;
            this.selectedBlockType = block.blockType || BLOCK_TYPES.NORMAL;
            if (block.innerColor) this.selectedInnerColor = block.innerColor;
            if (block.keyCount !== undefined) this.selectedKeyCount = block.keyCount;
            if (block.freezeCount !== undefined) this.selectedFreezeCount = block.freezeCount;
            this.selectedIsPriority = !!block.isPriority;

            // Sync UI inputs
            this.selectBlockTypeEl.value = this.selectedBlockType;
            this.inputKeyCountEl.value = this.selectedKeyCount;
            this.inputFreezeCountEl.value = this.selectedFreezeCount;
            this.chkPriorityBlockEl.checked = this.selectedIsPriority;

            this.updateSpecialPanelsVisibility();
            this.initColorPickers();
        }
        this.renderBoard();
    }

    updateDragPreview(block, candX, candY, isValid, isOffBoard) {
        const blockEl = this.gridBoardEl.querySelector(`.block-element[data-id="${block.id}"]`);
        if (!blockEl) return;

        const shapeCells = getShapeCells(block.type, block.rotation);
        const cellElements = blockEl.querySelectorAll('.block-cell');

        shapeCells.forEach(([cx, cy], idx) => {
            if (cellElements[idx]) {
                const cellX = (candX + cx) * 42;
                const cellY = (candY + cy) * 42;
                cellElements[idx].style.left = `${cellX}px`;
                cellElements[idx].style.top = `${cellY}px`;

                cellElements[idx].classList.remove('drag-valid', 'drag-invalid', 'drag-delete');
                if (isOffBoard) {
                    cellElements[idx].classList.add('drag-delete');
                } else if (isValid) {
                    cellElements[idx].classList.add('drag-valid');
                } else {
                    cellElements[idx].classList.add('drag-invalid');
                }
            }
        });
    }

    handleCellClick(x, y) {
        if (this.mode !== 'editor') return;

        if (this.activeGridTool === 'wall') {
            this.grid.setTile(x, y, TILE_TYPES.WALL);
            this.selectedGateCoord = null;
        } else if (this.activeGridTool === 'gate') {
            const raw = this.grid.getRawTile(x, y);
            if (raw.type === TILE_TYPES.GATE) {
                // Select existing gate for editing
                this.selectedGateCoord = { x, y };
                this.selectedColor = raw.color || this.selectedColor;
                this.gateIsToggle = !!raw.isToggle;
                this.gateInitialIsOpen = raw.isOpen !== false;
                this.chkGateToggleEl.checked = this.gateIsToggle;
                this.selectGateStateEl.value = this.gateInitialIsOpen ? 'open' : 'closed';
                this.updateSpecialPanelsVisibility();
            } else {
                // Place new gate
                this.grid.setTile(x, y, TILE_TYPES.GATE, this.selectedColor, this.gateIsToggle, this.gateInitialIsOpen);
                this.selectedGateCoord = null;
            }
        } else if (this.activeGridTool === 'erase') {
            this.grid.setTile(x, y, TILE_TYPES.EMPTY);
            this.selectedGateCoord = null;
        }
        this.selectedBlockId = null;
        this.renderBoard();
    }

    updateSpecialPanelsVisibility() {
        // Gate options panel
        if (this.activeGridTool === 'gate' || this.selectedGateCoord !== null) {
            this.gateOptionsEl.style.display = 'block';
            this.gateInitialGroupEl.style.display = this.chkGateToggleEl.checked ? 'flex' : 'none';
        } else {
            this.gateOptionsEl.style.display = 'none';
        }

        // Block type options
        const type = this.selectBlockTypeEl.value;
        this.dualColorGroupEl.style.display = type === BLOCK_TYPES.DUAL ? 'block' : 'none';
        this.lockedCountGroupEl.style.display = type === BLOCK_TYPES.LOCKED ? 'flex' : 'none';
        this.frozenCountGroupEl.style.display = type === BLOCK_TYPES.FROZEN ? 'flex' : 'none';
    }

    attachEventListeners() {
        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        // Grid Tool Selection
        ['wall', 'gate', 'erase'].forEach(tool => {
            const btn = document.getElementById(`tool-${tool}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.tool-buttons .btn').forEach(b => {
                        if (b.id.startsWith('tool-')) b.classList.remove('active');
                    });
                    btn.classList.add('active');
                    this.activeGridTool = tool;
                    this.selectedBlockId = null;
                    this.selectedGateCoord = null;
                    this.updateSpecialPanelsVisibility();
                });
            }
        });

        // Gate Options
        this.chkGateToggleEl.addEventListener('change', (e) => {
            this.gateIsToggle = e.target.checked;
            this.updateSpecialPanelsVisibility();
            if (this.selectedGateCoord) {
                const { x, y } = this.selectedGateCoord;
                const tile = this.grid.getRawTile(x, y);
                if (tile.type === TILE_TYPES.GATE) {
                    this.saveUndoState();
                    tile.isToggle = this.gateIsToggle;
                    tile.isOpen = this.gateIsToggle ? (this.selectGateStateEl.value === 'open') : true;
                    this.renderBoard();
                }
            }
        });

        this.selectGateStateEl.addEventListener('change', (e) => {
            this.gateInitialIsOpen = e.target.value === 'open';
            if (this.selectedGateCoord) {
                const { x, y } = this.selectedGateCoord;
                const tile = this.grid.getRawTile(x, y);
                if (tile.type === TILE_TYPES.GATE) {
                    this.saveUndoState();
                    tile.isOpen = this.gateInitialIsOpen;
                    this.renderBoard();
                }
            }
        });

        // Shape Selection and Rotation
        this.shapeSelectEl.addEventListener('change', (e) => {
            this.selectedShapeType = e.target.value;
            this.renderShapePreview();
        });

        // Block Type Selector
        this.selectBlockTypeEl.addEventListener('change', (e) => {
            this.selectedBlockType = e.target.value;
            this.updateSpecialPanelsVisibility();
            this.renderShapePreview();

            if (this.selectedBlockId !== null) {
                const block = this.blocks.find(b => b.id === this.selectedBlockId);
                if (block) {
                    this.saveUndoState();
                    block.blockType = this.selectedBlockType;
                    block.innerColor = this.selectedInnerColor;
                    block.keyCount = parseInt(this.inputKeyCountEl.value, 10) || 1;
                    block.freezeCount = parseInt(this.inputFreezeCountEl.value, 10) || 1;
                    this.renderBoard();
                }
            }
        });

        // Counter inputs
        this.inputKeyCountEl.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10) || 1;
            this.selectedKeyCount = val;
            if (this.selectedBlockId !== null) {
                const block = this.blocks.find(b => b.id === this.selectedBlockId);
                if (block && block.blockType === BLOCK_TYPES.LOCKED) {
                    this.saveUndoState();
                    block.keyCount = val;
                    this.renderBoard();
                }
            }
        });

        this.inputFreezeCountEl.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10) || 1;
            this.selectedFreezeCount = val;
            if (this.selectedBlockId !== null) {
                const block = this.blocks.find(b => b.id === this.selectedBlockId);
                if (block && block.blockType === BLOCK_TYPES.FROZEN) {
                    this.saveUndoState();
                    block.freezeCount = val;
                    this.renderBoard();
                }
            }
        });

        // Priority Flag Checkbox
        this.chkPriorityBlockEl.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            this.selectedIsPriority = isChecked;

            if (isChecked) {
                // Ensure only 1 priority block exists
                this.blocks.forEach(b => { b.isPriority = false; });
            }

            if (this.selectedBlockId !== null) {
                const block = this.blocks.find(b => b.id === this.selectedBlockId);
                if (block) {
                    this.saveUndoState();
                    block.isPriority = isChecked;
                }
            }
            this.renderBoard();
        });

        document.getElementById('btn-rotate-shape').addEventListener('click', () => {
            if (this.selectedBlockId !== null) {
                const block = this.blocks.find(b => b.id === this.selectedBlockId);
                if (block) {
                    const newRot = (block.rotation + 1) % 4;
                    if (this.isValidBlockPosition(block.type, newRot, block.color, block.x, block.y, block.id)) {
                        this.saveUndoState();
                        block.rotation = newRot;
                        this.renderBoard();
                    } else {
                        alert('Block rotation is not possible at the current position.');
                    }
                    return;
                }
            }
            this.selectedShapeRotation = (this.selectedShapeRotation + 1) % 4;
            this.renderShapePreview();
        });

        // Add Block Button
        document.getElementById('btn-add-block').addEventListener('click', () => {
            if (this.mode !== 'editor') return;

            const pos = this.findFirstValidPosition(this.selectedShapeType, this.selectedShapeRotation, this.selectedColor);
            if (!pos) {
                alert('No available floor space for this shape! Create an enclosed area surrounded by walls.');
                return;
            }

            this.saveUndoState();

            if (this.selectedIsPriority) {
                this.blocks.forEach(b => { b.isPriority = false; });
            }

            const newBlock = {
                id: this.nextBlockId++,
                type: this.selectedShapeType,
                rotation: this.selectedShapeRotation,
                color: this.selectedColor,
                x: pos.x,
                y: pos.y,
                blockType: this.selectedBlockType,
                innerColor: this.selectedInnerColor,
                keyCount: parseInt(this.inputKeyCountEl.value, 10) || 1,
                freezeCount: parseInt(this.inputFreezeCountEl.value, 10) || 1,
                isPriority: this.selectedIsPriority
            };
            this.blocks.push(newBlock);
            this.selectedBlockId = null;
            this.renderBoard();
        });

        // Resize Grid
        document.getElementById('btn-resize-grid').addEventListener('click', () => {
            const cols = parseInt(document.getElementById('input-cols').value, 10);
            const rows = parseInt(document.getElementById('input-rows').value, 10);
            if (cols >= 3 && cols <= 15 && rows >= 3 && rows <= 15) {
                this.saveUndoState();
                this.cols = cols;
                this.rows = rows;
                this.grid.resize(cols, rows);
                this.renderBoard();
            }
        });

        // Undo
        if (this.btnUndo) {
            this.btnUndo.addEventListener('click', () => {
                this.undo();
            });
        }

        // Clear Map
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the entire map and all blocks?')) {
                this.saveUndoState();
                this.grid = new GameGrid(this.cols, this.rows);
                this.blocks = [];
                this.selectedBlockId = null;
                this.selectedGateCoord = null;
                this.switchMode('editor');
                this.renderBoard();
            }
        });

        // Solve
        document.getElementById('btn-solve').addEventListener('click', () => {
            this.solvePuzzle();
        });

        // Player navigation
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

        // Keyboard navigation and shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (this.mode === 'player') {
                if (e.key === 'ArrowLeft' && this.currentStepIndex > 0) {
                    this.currentStepIndex--;
                    this.updatePlayerUI();
                } else if (e.key === 'ArrowRight' && this.currentStepIndex < this.solutionSteps.length - 1) {
                    this.currentStepIndex++;
                    this.updatePlayerUI();
                }
            } else if (this.mode === 'editor') {
                if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
                    e.preventDefault();
                    this.undo();
                    return;
                }

                if (this.selectedBlockId !== null) {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        this.saveUndoState();
                        this.blocks = this.blocks.filter(b => b.id !== this.selectedBlockId);
                        this.selectedBlockId = null;
                        this.renderBoard();
                    } else if (e.key === 'r' || e.key === 'R') {
                        const block = this.blocks.find(b => b.id === this.selectedBlockId);
                        if (block) {
                            const newRot = (block.rotation + 1) % 4;
                            if (this.isValidBlockPosition(block.type, newRot, block.color, block.x, block.y, block.id)) {
                                this.saveUndoState();
                                block.rotation = newRot;
                                this.renderBoard();
                            } else {
                                alert('Block rotation is not possible at the current position.');
                            }
                        }
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
            alert('Please insert at least one block onto the map before solving!');
            return;
        }

        this.statusMessageEl.style.display = 'flex';
        this.statusTextEl.textContent = 'Solving puzzle in progress...';

        setTimeout(() => {
            const solver = new PuzzleSolver(this.grid.toJSON(), this.blocks);
            const result = solver.solve(150000, (exploredCount) => {
                this.statusTextEl.textContent = `States explored: ${exploredCount}...`;
            });

            this.statusMessageEl.style.display = 'none';

            if (result.success) {
                const initialTiles = this.grid.getEffectiveTiles();
                this.solutionSteps = [
                    { blocks: this.blocks.map(b => ({ ...b })), tiles: initialTiles, move: null },
                    ...result.steps
                ];
                this.currentStepIndex = 0;
                this.btnModePlayer.disabled = false;
                this.switchMode('player');
            } else {
                console.log('SOLVE FAILED:', result.error, 'BLOCKS:', JSON.stringify(this.blocks), 'GRID:', JSON.stringify(this.grid.getEffectiveTiles()));
                alert(`Solving failed: ${result.error}`);
            }
        }, 50);
    }

    updatePlayerUI() {
        this.stepCounterEl.textContent = `Step ${this.currentStepIndex} / ${this.solutionSteps.length - 1}`;
        const currentStep = this.solutionSteps[this.currentStepIndex];

        if (this.currentStepIndex === 0) {
            this.moveDescEl.textContent = 'Initial map layout';
        } else if (currentStep && currentStep.move) {
            const { blockId, dir, exited, peeled } = currentStep.move;
            if (peeled) {
                this.moveDescEl.textContent = `Block #${blockId} peels outer color through gate! 🎨`;
            } else if (exited) {
                this.moveDescEl.textContent = `Block #${blockId} exits the board ${dir.toLowerCase()}! 🎉`;
            } else {
                this.moveDescEl.textContent = `Move Block #${blockId} ${dir.toLowerCase()}`;
            }
        }
        this.renderBoard();
    }
}

// Initialize application
window.addEventListener('DOMContentLoaded', () => {
    window.app = new ColorBlockApp();
});
