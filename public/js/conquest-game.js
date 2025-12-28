// Campus Conquest - Shared Game Logic

class ConquestGrid {
    constructor(size = 10) {
        this.size = size;
        this.grid = Array(size).fill(null).map(() => Array(size).fill(null));
        this.specialCells = [];
    }

    // Initialize special cells (x2, x3 multipliers)
    initializeSpecialCells(count = 8) {
        this.specialCells = [];
        const positions = new Set();

        while (this.specialCells.length < count) {
            const x = Math.floor(Math.random() * this.size);
            const y = Math.floor(Math.random() * this.size);
            const key = `${x},${y}`;

            if (!positions.has(key)) {
                positions.add(key);
                this.specialCells.push({
                    x,
                    y,
                    multiplier: this.specialCells.length < count / 2 ? 2 : 3
                });
            }
        }
    }

    // Get special cell multiplier
    getCellMultiplier(x, y) {
        const special = this.specialCells.find(cell => cell.x === x && cell.y === y);
        return special ? special.multiplier : 1;
    }

    // Set cell owner
    setCell(x, y, playerId) {
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            this.grid[x][y] = playerId;
        }
    }

    // Get cell owner
    getCell(x, y) {
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            return this.grid[x][y];
        }
        return null;
    }

    // Count territories for a player
    countTerritory(playerId) {
        let count = 0;
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.grid[x][y] === playerId) {
                    count += this.getCellMultiplier(x, y);
                }
            }
        }
        return count;
    }

    // Get all territories
    getAllTerritories() {
        const territories = new Map();
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                const owner = this.grid[x][y];
                if (owner !== null) {
                    const count = territories.get(owner) || 0;
                    territories.set(owner, count + this.getCellMultiplier(x, y));
                }
            }
        }
        return territories;
    }

    // Export grid state
    export() {
        return {
            grid: this.grid.map(row => [...row]),
            specialCells: [...this.specialCells]
        };
    }

    // Import grid state
    import(data) {
        this.grid = data.grid.map(row => [...row]);
        this.specialCells = [...data.specialCells];
    }
}

class ConquestRenderer {
    constructor(containerElement, grid, options = {}) {
        this.container = containerElement;
        this.grid = grid;
        this.options = {
            large: options.large || false,
            clickable: options.clickable !== false,
            showPlayerColor: options.showPlayerColor !== false
        };

        this.playerColorMap = new Map(); // playerId -> colorIndex
        this.colorIndex = 0;

        this.render();
    }

    // Get or assign color for player
    getPlayerColor(playerId) {
        if (!this.playerColorMap.has(playerId)) {
            this.playerColorMap.set(playerId, this.colorIndex % 12);
            this.colorIndex++;
        }
        return this.playerColorMap.get(playerId);
    }

    // Render the grid
    render() {
        this.container.innerHTML = '';
        this.container.className = `grid-container ${this.options.large ? 'large' : ''}`;

        for (let y = 0; y < this.grid.size; y++) {
            for (let x = 0; x < this.grid.size; x++) {
                const cell = this.createCell(x, y);
                this.container.appendChild(cell);
            }
        }
    }

    // Create a single cell
    createCell(x, y) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.x = x;
        cell.dataset.y = y;

        // Set owner color
        const owner = this.grid.getCell(x, y);
        if (owner !== null && this.options.showPlayerColor) {
            const colorIndex = this.getPlayerColor(owner);
            cell.classList.add(`player-color-${colorIndex}`);
            cell.classList.add('owned');
        }

        // Add special cell styling
        const multiplier = this.grid.getCellMultiplier(x, y);
        if (multiplier > 1) {
            cell.classList.add(`special-${multiplier}x`);
            const badge = document.createElement('span');
            badge.className = 'cell-multiplier';
            badge.textContent = `×${multiplier}`;
            cell.appendChild(badge);
        }

        // Add click handler if clickable
        if (this.options.clickable && owner === null) {
            cell.addEventListener('click', () => this.onCellClick(x, y));
        }

        return cell;
    }

    // Update a single cell
    updateCell(x, y) {
        const cell = this.container.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;

        const owner = this.grid.getCell(x, y);

        // Remove old color classes
        for (let i = 0; i < 12; i++) {
            cell.classList.remove(`player-color-${i}`);
        }
        cell.classList.remove('owned', 'pending');

        // Add new color if owned
        if (owner !== null && this.options.showPlayerColor) {
            const colorIndex = this.getPlayerColor(owner);
            cell.classList.add(`player-color-${colorIndex}`);
            cell.classList.add('owned');
            cell.classList.add('claimed'); // Trigger animation

            setTimeout(() => cell.classList.remove('claimed'), 400);
        }
    }

    // Show conflict animation
    showConflict(x, y) {
        const cell = this.container.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;

        cell.classList.add('conflict');
        setTimeout(() => cell.classList.remove('conflict'), 600);
    }

    // Mark cell as pending
    markPending(x, y, isPending) {
        const cell = this.container.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;

        if (isPending) {
            cell.classList.add('pending');
        } else {
            cell.classList.remove('pending');
        }
    }

    // Override this in subclass
    onCellClick(x, y) {
        console.log(`Cell clicked: (${x}, ${y})`);
    }
}

// Utility: Format time (seconds to MM:SS)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Utility: Play sound effect
function playSound(soundName) {
    // Optional: add sound effects
    console.log(`Sound: ${soundName}`);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConquestGrid, ConquestRenderer, formatTime, playSound };
}
