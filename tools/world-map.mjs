// Draws the region map preview world/map.svg from the canon locations' `map` blocks.
// Usage: npm run world:map
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorld, WORLD_DIR } from '../sim/load.ts';
import { MAP_HEIGHT, MAP_WIDTH, TERRAINS } from '../sim/world.ts';

const S = 10; // px per map unit
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const world = loadWorld();
const nodes = world.regions.map((r) => {
  const t = TERRAINS[r.terrain];
  const [x, y] = [r.x * S, r.y * S];
  const shape = t.sea
    ? `<circle cx="${x}" cy="${y}" r="70" fill="${t.color}" opacity="0.75"/>` +
      `<circle cx="${x}" cy="${y}" r="30" fill="none" stroke="#9fc4ff" stroke-width="2" stroke-dasharray="6 6"/>`
    : `<circle cx="${x}" cy="${y}" r="26" fill="${t.color}" stroke="#f4ecd8" stroke-width="3"/>`;
  return `  <g>${shape}
    <text x="${x}" y="${y + (t.sea ? 92 : 48)}" text-anchor="middle" class="name">${esc(r.name)}</text>
    <text x="${x}" y="${y + (t.sea ? 110 : 66)}" text-anchor="middle" class="terrain">${esc(t.label)}</text></g>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_WIDTH * S} ${MAP_HEIGHT * S}" width="${MAP_WIDTH * S}" height="${MAP_HEIGHT * S}">
  <style>
    .name { font: 600 18px sans-serif; fill: #f4ecd8; }
    .terrain { font: 13px sans-serif; fill: #b9c3cf; }
  </style>
  <rect width="100%" height="100%" fill="#16324f"/>
${nodes.join('\n')}
</svg>
`;
writeFileSync(join(WORLD_DIR, 'map.svg'), svg);
console.log(`world/map.svg: 지역 ${world.regions.length}곳`);
