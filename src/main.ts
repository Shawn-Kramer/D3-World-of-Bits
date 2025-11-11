// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";

// Configuration
const CLASSROOM_LOCATION = leaflet.latLng(
  36.98949379578401,
  -122.06277128548504,
);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 8;

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

// Cell coordinate type
interface Cell {
  i: number; // latitude index
  j: number; // longitude index
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

/*
// Create a unique key for each cell
function getCellKey(cell: Cell): string {
  return `${cell.i},${cell.j}`;
}
*/

// Draw grid around player
function renderGrid(): void {
  const playerCell = latLngToCell(CLASSROOM_LOCATION);

  for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
    for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
      const cell: Cell = {
        i: playerCell.i + di,
        j: playerCell.j + dj,
      };

      const bounds = cellBounds(cell);
      const rect = leaflet.rectangle(bounds, {
        color: "#3388ff",
        weight: 1,
        fillOpacity: 0.1,
      });
      rect.addTo(map);
    }
  }
}

renderGrid();
