// Verifies every place spot in data/places.ts is a walkable tile on the map.
// Usage (from game/): node --experimental-strip-types scripts/checkPlaces.mjs
import * as map from '../data/gentle.js';
import { PLACES } from '../data/places.ts';

const blocked = (x, y) =>
  x < 0 || y < 0 || x >= map.mapwidth || y >= map.mapheight ||
  map.objmap.some((layer) => layer[x][y] !== -1);

let bad = 0;
for (const place of PLACES) {
  for (const { x, y } of place.spots) {
    if (blocked(x, y)) {
      console.log(`blocked: ${place.id} (${x}, ${y})`);
      bad++;
    }
  }
}
// All spots must be mutually reachable (4-neighbour, like movement.ts findRoute).
const start = PLACES[0].spots[0];
const seen = new Set([`${start.x},${start.y}`]);
const queue = [start];
while (queue.length) {
  const { x, y } = queue.pop();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = { x: x + dx, y: y + dy };
    const key = `${n.x},${n.y}`;
    if (!seen.has(key) && !blocked(n.x, n.y)) {
      seen.add(key);
      queue.push(n);
    }
  }
}
for (const place of PLACES) {
  for (const { x, y } of place.spots) {
    if (!blocked(x, y) && !seen.has(`${x},${y}`)) {
      console.log(`unreachable from ${PLACES[0].id}: ${place.id} (${x}, ${y})`);
      bad++;
    }
  }
}
console.log(bad ? `${bad} bad spot(s)` : `ok: ${PLACES.length} places, all spots walkable and connected`);
process.exit(bad ? 1 : 0);
