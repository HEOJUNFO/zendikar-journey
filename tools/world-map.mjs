// Draws the region map preview world/map.svg from the canon locations' `map` blocks.
// Usage: npm run world:map
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorld, WORLD_DIR } from '../sim/load.ts';
import { MAP_HEIGHT, MAP_WIDTH, TERRAINS } from '../sim/world.ts';
import { areaLabelAt, containerRadius, nodeAt } from '../web/view.ts';

const S = 10; // px per map unit
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const world = loadWorld();
// As the game draws them (web/view.ts): a region holding areas is itself a large circle, with
// its areas as small circles across the lower part.
const containers = world.regions.filter((r) => !r.parent && containerRadius(world, r)).map((r) => {
  const t = TERRAINS[r.terrain];
  const R = containerRadius(world, r) * S;
  return `  <circle cx="${r.x * S}" cy="${r.y * S}" r="${R}" fill="${t.color}" fill-opacity="0.35" stroke="#f4ecd8" stroke-opacity="0.7" stroke-width="3"/>`;
});
const areaNodes = world.regions
  .filter((r) => r.parent)
  .map((r) => {
    const t = TERRAINS[r.terrain];
    const { x, y } = nodeAt(world, r);
    const label = areaLabelAt(world, r);
    return `  <g><circle cx="${x * S}" cy="${y * S}" r="16" fill="${t.color}" stroke="#f4ecd8" stroke-width="2"/>
    <text x="${label.x * S}" y="${label.y * S}" text-anchor="${label.anchor}" class="area">${esc(r.name)}</text></g>`;
  });
const nodes = world.regions.filter((r) => !r.parent).map((r) => {
  const t = TERRAINS[r.terrain];
  const { x, y } = Object.fromEntries(Object.entries(nodeAt(world, r)).map(([k, v]) => [k, v * S]));
  const R = containerRadius(world, r) * S;
  const shape = t.sea
    ? `<circle cx="${x}" cy="${y}" r="70" fill="${t.color}" opacity="0.75"/>` +
      `<circle cx="${x}" cy="${y}" r="30" fill="none" stroke="#9fc4ff" stroke-width="2" stroke-dasharray="6 6"/>`
    : R
      ? ''
      : `<circle cx="${x}" cy="${y}" r="26" fill="${t.color}" stroke="#f4ecd8" stroke-width="3"/>`;
  // A region holding areas is named above its circle; others below their node.
  const [ny, ty] = R ? [r.y * S - R - 28, r.y * S - R - 10] : [y + (t.sea ? 92 : 48), y + (t.sea ? 110 : 66)];
  return `  <g>${shape}
    <text x="${x}" y="${ny}" text-anchor="middle" class="name">${esc(r.name)}</text>
    <text x="${x}" y="${ty}" text-anchor="middle" class="terrain">${esc(t.label)}</text></g>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_WIDTH * S} ${MAP_HEIGHT * S}" width="${MAP_WIDTH * S}" height="${MAP_HEIGHT * S}">
  <style>
    .name { font: 600 18px sans-serif; fill: #f4ecd8; }
    .terrain { font: 13px sans-serif; fill: #b9c3cf; }
    .area { font: 600 14px sans-serif; fill: #f4ecd8; }
  </style>
  <rect width="100%" height="100%" fill="#16324f"/>
${containers.join('\n')}
${areaNodes.join('\n')}
${nodes.join('\n')}
</svg>
`;
writeFileSync(join(WORLD_DIR, 'map.svg'), svg);
console.log(`world/map.svg: 지역 ${nodes.length}곳, 구역 ${areaNodes.length}곳`);
