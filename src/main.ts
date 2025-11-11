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
const CACHE_SPAWN_PROBABILITY = 0.1; // 10% of cells have tokens

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
interface Cell {
  i: number; // latitude index
  j: number; // longitude index
}

interface GameState {
  cellTokens: Map<string, number>; // key: "i,j", value: token value
}

// ============================================================================
// GAME STATE
// ============================================================================
const gameState: GameState = {
  playerLocation: latLngToCell(CLASSROOM_LOCATION),
  playerInventory: null,
  cellTokens: new Map(),
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Create a unique key for each cell
function getCellKey(cell: Cell): string {
  return `${cell.i},${cell.j}`;
}

// Convert lat/lng to cell coordinates
function latLngToCell(latLng: leaflet.LatLng): Cell {
  return {
    i: Math.floor(latLng.lat / TILE_DEGREES),
    j: Math.floor(latLng.lng / TILE_DEGREES),
  };
}

// Convert cell coordinates back to lat/lng
function cellToLatLng(cell: Cell): leaflet.LatLng {
  return leaflet.latLng(
    cell.i * TILE_DEGREES,
    cell.j * TILE_DEGREES,
  );
}

// Get the bounds of a cell for drawing
function cellBounds(cell: Cell): leaflet.LatLngBounds {
  const origin = cellToLatLng(cell);
  return leaflet.latLngBounds([
    [origin.lat, origin.lng],
    [origin.lat + TILE_DEGREES, origin.lng + TILE_DEGREES],
  ]);
}

// ============================================================================
// TOKEN SPAWNING
// ============================================================================

// Check if a cell should have a token (deterministic)
function shouldCellHaveToken(cell: Cell): boolean {
  const key = getCellKey(cell);
  return luck(key) < CACHE_SPAWN_PROBABILITY;
}

// Initialize a cell's token if it should have one
function initializeCellToken(cell: Cell): void {
  const key = getCellKey(cell);
  if (shouldCellHaveToken(cell) && !gameState.cellTokens.has(key)) {
    gameState.cellTokens.set(key, 1); // Start with value 1
  }
}

// ============================================================================
// MAP SETUP
// ============================================================================

// Create map container
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.appendChild(mapDiv);

// Initialize map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LOCATION,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL - 2,
  maxZoom: GAMEPLAY_ZOOM_LEVEL + 2,
  zoomControl: true,
  scrollWheelZoom: true,
});

// Add tile layer
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Add player marker
const playerMarker = leaflet.marker(CLASSROOM_LOCATION);
playerMarker.bindTooltip("You are here");
playerMarker.addTo(map);

// ============================================================================
// GRID RENDERING
// ============================================================================

// Draw grid around player
function renderGrid(): void {
  const playerCell = latLngToCell(CLASSROOM_LOCATION);

  for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
    for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
      const cell: Cell = {
        i: playerCell.i + di,
        j: playerCell.j + dj,
      };

      // Initialize token if needed
      initializeCellToken(cell);

      const key = getCellKey(cell);
      const tokenValue = gameState.cellTokens.get(key);
      const bounds = cellBounds(cell);

      // Draw cell rectangle
      const rect = leaflet.rectangle(bounds, {
        color: "#3388ff",
        weight: 1,
        fillOpacity: tokenValue !== undefined ? 0.3 : 0.1,
      });
      rect.addTo(map);

      // Display token value if present
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
      }
    }
  }
}

// ============================================================================
// PLAYER INVENTORY UI
// ============================================================================

// Create inventory display
const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
inventoryDiv.innerHTML = "Inventory: Empty";
document.body.appendChild(inventoryDiv);

// Update game state to track inventory
interface GameState {
  playerLocation: Cell;
  playerInventory: number | null; // null = empty, number = token value
  cellTokens: Map<string, number>;
}

function updateInventoryDisplay(): void {
  if (gameState.playerInventory === null) {
    inventoryDiv.innerHTML = "Inventory: Empty";
  } else {
    inventoryDiv.innerHTML = `Inventory: Token (${gameState.playerInventory})`;
  }
}

// ============================================================================
// INITIALIZE GAME
// ============================================================================
renderGrid();
