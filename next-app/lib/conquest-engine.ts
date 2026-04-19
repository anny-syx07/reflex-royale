/**
 * 📚 KIẾN THỨC: Porting Class từ JS thuần sang TypeScript
 *
 * Code cũ dùng class JavaScript thông thường, lưu trong file .js
 * và load qua <script src="...">.
 *
 * Trong Next.js, không dùng thẻ <script src="..."> nữa.
 * Thay vào đó:
 *   1. Convert class sang TypeScript (thêm types)
 *   2. Export như module bình thường
 *   3. Import bằng: import { ConquestGrid } from '@/lib/conquest-engine'
 *
 * Bản chất logic không đổi, chỉ thêm type annotations.
 */

// TypeScript: định nghĩa shape của Special Cell
export interface SpecialCell {
  x: number;
  y: number;
  multiplier: 2 | 3;
}

// TypeScript: định nghĩa shape của Grid State (gửi qua socket)
export interface GridState {
  grid: (string | null)[][];
  specialCells: SpecialCell[];
}

export interface PendingAction {
  x: number;
  y: number;
}

// Màu cho 12 người chơi
const PLAYER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#82E0AA", "#F1948A",
];

/**
 * ConquestGrid: quản lý state của bản đồ 10x10
 * Convert trực tiếp từ conquest-game.js
 */
export class ConquestGrid {
  size: number;
  grid: (string | null)[][];
  specialCells: SpecialCell[];

  constructor(size = 10) {
    this.size = size;
    // Array(size).fill(null).map(...) = tạo mảng 2D với toàn null
    this.grid = Array(size).fill(null).map(() => Array(size).fill(null));
    this.specialCells = [];
  }

  initializeSpecialCells(count = 8): void {
    this.specialCells = [];
    const positions = new Set<string>();

    while (this.specialCells.length < count) {
      const x = Math.floor(Math.random() * this.size);
      const y = Math.floor(Math.random() * this.size);
      const key = `${x},${y}`;

      if (!positions.has(key)) {
        positions.add(key);
        this.specialCells.push({
          x, y,
          multiplier: this.specialCells.length < count / 2 ? 2 : 3,
        });
      }
    }
  }

  getCellMultiplier(x: number, y: number): number {
    const special = this.specialCells.find(cell => cell.x === x && cell.y === y);
    return special ? special.multiplier : 1;
  }

  setCell(x: number, y: number, playerId: string | null): void {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      this.grid[x][y] = playerId;
    }
  }

  getCell(x: number, y: number): string | null {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      return this.grid[x][y];
    }
    return null;
  }

  countTerritory(playerId: string): number {
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

  export(): GridState {
    return {
      grid: this.grid.map(row => [...row]),
      specialCells: [...this.specialCells],
    };
  }

  import(data: GridState): void {
    this.grid = data.grid.map(row => [...row]);
    this.specialCells = [...data.specialCells];
  }
}

/**
 * ConquestRenderer: render grid vào DOM element
 *
 * 📚 KIẾN THỨC: Tại sao giữ DOM manipulation thay vì dùng React state?
 *
 * Conquest grid 10x10 = 100 ô, cập nhật real-time mỗi click.
 * Nếu dùng React state cho từng ô → 100 state updates → React re-render toàn bộ.
 *
 * Giải pháp: Giữ ConquestRenderer dùng DOM trực tiếp,
 * nhúng vào React qua một div container với useRef.
 * React quản lý lifecycle (mount/unmount), renderer quản lý từng ô.
 *
 * Đây là pattern phổ biến khi tích hợp thư viện UI ngoài vào React
 * (ví dụ: Leaflet maps, D3.js charts, canvas games).
 */
export class ConquestRenderer {
  container: HTMLElement;
  grid: ConquestGrid;
  options: { large: boolean; clickable: boolean; showPlayerColor: boolean };
  playerColorMap: Map<string, number>;
  colorIndex: number;
  onCellClick: (x: number, y: number) => void;

  constructor(containerElement: HTMLElement, grid: ConquestGrid, options: Partial<{
    large: boolean;
    clickable: boolean;
    showPlayerColor: boolean;
  }> = {}) {
    this.container = containerElement;
    this.grid = grid;
    this.options = {
      large: options.large || false,
      clickable: options.clickable !== false,
      showPlayerColor: options.showPlayerColor !== false,
    };
    this.playerColorMap = new Map();
    this.colorIndex = 0;
    this.onCellClick = (x, y) => console.log(`Cell clicked: (${x}, ${y})`);
  }

  getPlayerColor(playerId: string): string {
    if (!this.playerColorMap.has(playerId)) {
      this.playerColorMap.set(playerId, this.colorIndex % 12);
      this.colorIndex++;
    }
    return PLAYER_COLORS[this.playerColorMap.get(playerId)!];
  }

  render(): void {
    this.container.innerHTML = "";
    // Tailwind-compatible grid styles
    this.container.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${this.grid.size}, ${this.options.large ? "52px" : "36px"});
      gap: 2px;
    `;

    for (let y = 0; y < this.grid.size; y++) {
      for (let x = 0; x < this.grid.size; x++) {
        const cell = this.createCell(x, y);
        this.container.appendChild(cell);
      }
    }
  }

  createCell(x: number, y: number): HTMLElement {
    const cell = document.createElement("div");
    const size = this.options.large ? "52px" : "36px";

    cell.dataset.x = String(x);
    cell.dataset.y = String(y);
    cell.style.cssText = `
      width: ${size};
      height: ${size};
      border-radius: 4px;
      border: 2px solid rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      background: rgba(255,255,255,0.05);
    `;

    // Owner color
    const owner = this.grid.getCell(x, y);
    if (owner !== null && this.options.showPlayerColor) {
      cell.style.background = this.getPlayerColor(owner);
      cell.style.borderColor = "transparent";
    }

    // Special cell badge
    const multiplier = this.grid.getCellMultiplier(x, y);
    if (multiplier > 1) {
      const badge = document.createElement("span");
      badge.style.cssText = `
        position: absolute;
        top: 2px;
        right: 2px;
        font-size: 9px;
        background: gold;
        color: black;
        border-radius: 3px;
        padding: 0 2px;
        font-weight: 900;
      `;
      badge.textContent = `×${multiplier}`;
      cell.appendChild(badge);
    }

    // Click handler
    if (this.options.clickable && owner === null) {
      cell.addEventListener("click", () => this.onCellClick(x, y));
      cell.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.onCellClick(x, y);
      }, { passive: false });
      cell.addEventListener("mouseenter", () => {
        if (this.grid.getCell(x, y) === null) {
          cell.style.borderColor = "rgba(255,255,255,0.6)";
          cell.style.transform = "scale(1.05)";
        }
      });
      cell.addEventListener("mouseleave", () => {
        cell.style.borderColor = "rgba(255,255,255,0.2)";
        cell.style.transform = "scale(1)";
      });
    }

    return cell;
  }

  updateCell(x: number, y: number): void {
    const cell = this.container.querySelector<HTMLElement>(`[data-x="${x}"][data-y="${y}"]`);
    if (!cell) return;

    const owner = this.grid.getCell(x, y);
    cell.style.background = owner !== null
      ? this.getPlayerColor(owner)
      : "rgba(255,255,255,0.05)";
    cell.style.borderColor = owner !== null ? "transparent" : "rgba(255,255,255,0.2)";
    cell.classList.remove("pending");
  }

  showConflict(x: number, y: number): void {
    const cell = this.container.querySelector<HTMLElement>(`[data-x="${x}"][data-y="${y}"]`);
    if (!cell) return;
    const orig = cell.style.background;
    cell.style.background = "#FF6B6B";
    cell.style.transform = "scale(1.15)";
    setTimeout(() => {
      cell.style.background = orig;
      cell.style.transform = "scale(1)";
    }, 500);
  }

  markPending(x: number, y: number, isPending: boolean): void {
    const cell = this.container.querySelector<HTMLElement>(`[data-x="${x}"][data-y="${y}"]`);
    if (!cell) return;
    cell.style.background = isPending ? "rgba(167, 139, 250, 0.6)" : "rgba(255,255,255,0.05)";
    cell.style.borderColor = isPending ? "#A78BFA" : "rgba(255,255,255,0.2)";
  }
}
