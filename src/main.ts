// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================
const CLASSROOM_LOCATION = leaflet.latLng(
  36.98949379578401,
  -122.06277128548504,
);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const TARGET_TOKEN_VALUE = 32; // Win condition

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
interface Cell {
  i: number;
  j: number;
}

interface GameState {
  playerLocation: Cell;
  playerInventory: number | null;
  cellTokens: Map<string, number>;
}

// ============================================================================
// GAME STATE
// ============================================================================
const gameState: GameState = {
  playerLocation: { i: 0, j: 0 },
  playerInventory: null,
  cellTokens: new Map(),
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getCellKey(cell: Cell): string {
  return `${cell.i},${cell.j}`;
}

function latLngToCell(latLng: leaflet.LatLng): Cell {
  return {
    i: Math.floor(latLng.lat / TILE_DEGREES),
    j: Math.floor(latLng.lng / TILE_DEGREES),
  };
}

function cellToLatLng(cell: Cell): leaflet.LatLng {
  return leaflet.latLng(
    cell.i * TILE_DEGREES,
    cell.j * TILE_DEGREES,
  );
}

function cellBounds(cell: Cell): leaflet.LatLngBounds {
  const origin = cellToLatLng(cell);
  return leaflet.latLngBounds([
    [origin.lat, origin.lng],
    [origin.lat + TILE_DEGREES, origin.lng + TILE_DEGREES],
  ]);
}

function cellDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
}

function isInteractable(cell: Cell): boolean {
  return cellDistance(cell, gameState.playerLocation) <= 3;
}

// ============================================================================
// TOKEN SPAWNING
// ============================================================================

function shouldCellHaveToken(cell: Cell): boolean {
  const key = getCellKey(cell);
  return luck(key) < CACHE_SPAWN_PROBABILITY;
}

// Does not remember token values when you leave their range
function initializeCellToken(cell: Cell): void {
  const key = getCellKey(cell);

  if (!gameState.cellTokens.has(key)) {
    if (shouldCellHaveToken(cell)) {
      gameState.cellTokens.set(key, 1);
    }
  }
}

// ============================================================================
// MAP SETUP
// ============================================================================

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.appendChild(mapDiv);

const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LOCATION,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL - 2,
  maxZoom: GAMEPLAY_ZOOM_LEVEL + 2,
  zoomControl: true,
  scrollWheelZoom: true,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(CLASSROOM_LOCATION);
playerMarker.bindTooltip("You are here");
playerMarker.addTo(map);

gameState.playerLocation = latLngToCell(CLASSROOM_LOCATION);

// ============================================================================
// UI ELEMENTS
// ============================================================================

const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
document.body.appendChild(inventoryDiv);

function updateInventoryDisplay(): void {
  if (gameState.playerInventory === null) {
    inventoryDiv.innerHTML = "Inventory: Empty";
  } else {
    inventoryDiv.innerHTML = `Inventory: Token (${gameState.playerInventory})`;
  }
}

// ============================================================================
// MOVEMENT CONTROLS
// ============================================================================

const controlPanel = document.createElement("div");
controlPanel.id = "controls";
controlPanel.innerHTML = `
  <button id="north">⬆️ North</button>
  <button id="south">⬇️ South</button>
  <button id="west">⬅️ West</button>
  <button id="east">➡️ East</button>
  <button id="reset">🏠 Reset</button>
`;
document.body.appendChild(controlPanel);

function movePlayer(di: number, dj: number): void {
  // Update player location
  gameState.playerLocation.i += di;
  gameState.playerLocation.j += dj;

  // Update player marker position on map
  const newLatLng = cellToLatLng(gameState.playerLocation);
  playerMarker.setLatLng(newLatLng);

  // Center map on new player location
  map.panTo(newLatLng);

  // Re-render grid around new location
  renderGrid();
}

// Attach event listeners to buttons
document.getElementById("north")!.addEventListener("click", () => {
  movePlayer(1, 0); // Move north (increase latitude)
});

document.getElementById("south")!.addEventListener("click", () => {
  movePlayer(-1, 0); // Move south (decrease latitude)
});

document.getElementById("west")!.addEventListener("click", () => {
  movePlayer(0, -1); // Move west (decrease longitude)
});

document.getElementById("east")!.addEventListener("click", () => {
  movePlayer(0, 1); // Move east (increase longitude)
});

document.getElementById("reset")!.addEventListener("click", () => {
  // Reset to classroom location
  gameState.playerLocation = latLngToCell(CLASSROOM_LOCATION);
  playerMarker.setLatLng(CLASSROOM_LOCATION);
  map.setView(CLASSROOM_LOCATION, GAMEPLAY_ZOOM_LEVEL);
  renderGrid();
});

// ============================================================================
// GRID RENDERING
// ============================================================================

const gridElements: leaflet.Layer[] = [];

function renderGrid(): void {
  // Clear old grid
  gridElements.forEach((element) => map.removeLayer(element));
  gridElements.length = 0;

  const playerCell = gameState.playerLocation;

  for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
    for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
      const cell: Cell = {
        i: playerCell.i + di,
        j: playerCell.j + dj,
      };

      initializeCellToken(cell);

      const key = getCellKey(cell);
      const tokenValue = gameState.cellTokens.get(key);
      const bounds = cellBounds(cell);
      const interactable = isInteractable(cell);

      // Draw cell rectangle
      const rect = leaflet.rectangle(bounds, {
        color: interactable ? "#3388ff" : "#888",
        weight: 1,
        fillOpacity: tokenValue !== undefined ? 0.3 : 0.1,
      });
      rect.addTo(map);
      gridElements.push(rect);

      rect.on("click", () => handleCellClick(cell));

      // Display token value
      if (tokenValue !== undefined) {
        const center = bounds.getCenter();
        const label = leaflet.marker(center, {
          icon: leaflet.divIcon({
            className: "token-label",
            html:
              `<div style="font-weight: bold; color: black; background: white; padding: 2px 6px; border-radius: 3px;">${tokenValue}</div>`,
            iconSize: [30, 30],
          }),
        });
        label.addTo(map);
        gridElements.push(label);
      }
    }
  }
}

// ============================================================================
// GAME MECHANICS
// ============================================================================

function handleCellClick(cell: Cell): void {
  if (!isInteractable(cell)) {
    alert("Cell is too far away!");
    return;
  }

  const key = getCellKey(cell);
  const cellToken = gameState.cellTokens.get(key);

  // Pickup logic
  if (gameState.playerInventory === null) {
    if (cellToken !== undefined) {
      gameState.playerInventory = cellToken;
      gameState.cellTokens.delete(key);
      updateInventoryDisplay();
      renderGrid();
      checkWinCondition();
    } else {
      alert("This cell is empty!");
    }
  } // Crafting logic
  else {
    if (cellToken === undefined) {
      alert("Cannot place token in empty cell. Need matching token to craft!");
    } else if (cellToken === gameState.playerInventory) {
      const newValue = cellToken * 2;
      gameState.cellTokens.set(key, newValue);
      gameState.playerInventory = null;
      updateInventoryDisplay();
      renderGrid();
      alert(`✨ Crafted token of value ${newValue}!`);
      checkWinCondition();
    } else {
      alert(
        `Cannot craft: tokens don't match (you have ${gameState.playerInventory}, cell has ${cellToken})`,
      );
    }
  }
}

function checkWinCondition(): void {
  if (
    gameState.playerInventory !== null &&
    gameState.playerInventory >= TARGET_TOKEN_VALUE
  ) {
    alert(
      `🎉 Victory! You crafted a token of value ${gameState.playerInventory}!`,
    );
  }
}

// ============================================================================
// CACHE MANAGEMENT (Flyweight + Memento patterns)
// ============================================================================

// Store only cells that have been modified from their default state
// This implements the Flyweight pattern - unmodified cells aren't stored
interface CellMemento {
  i: number;
  j: number;
  coins: number;
}

// Persistent storage of modified cells (survives moving away and back)
const cellCache = new Map<string, CellMemento>();

// Save a cell's state to the cache (Memento pattern)
function _saveCell(cell: Cell, coins: number): void {
  const key = getCellKey(cell);
  cellCache.set(key, { i: cell.i, j: cell.j, coins });
}

// Load a cell's state from the cache, or null if not cached
function _loadCell(cell: Cell): CellMemento | null {
  const key = getCellKey(cell);
  return cellCache.get(key) || null;
}

// Remove a cell from the cache (when picked up completely)
function _removeCell(cell: Cell): void {
  const key = getCellKey(cell);
  cellCache.delete(key);
}

// ============================================================================
// INITIALIZATION
// ============================================================================
renderGrid();
updateInventoryDisplay();
