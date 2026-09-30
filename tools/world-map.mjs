// Draws the region map preview world/map.svg from the canon locations' `map` blocks.
// Usage: npm run world:map
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorld, WORLD_DIR } from '../sim/load.ts';
import { TERRAINS } from '../sim/world.ts';
import { AREA_NODE, areaLabelAt, bridges, containerRadius, fitView, halfCircle, landColors, nodeAt, PLAIN_NODE, regionLabelAt, shelves } from '../web/view.ts';

const S = 6; // px per map unit
// A land's circle in its mana colors (web/view.ts landColors), split for a two-color land.
const land = (x, y, r, colors, style) =>
  colors.length < 2
    ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[0]}" ${style}/>`
    : `<path d="${halfCircle(x, y, r, 0)}" fill="${colors[0]}" ${style.replace(/stroke[^ ]*="[^"]*"/g, '')}/>` +
      `<path d="${halfCircle(x, y, r, 1)}" fill="${colors[1]}" ${style.replace(/stroke[^ ]*="[^"]*"/g, '')}/>` +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="none" ${style.replace(/fill-opacity="[^"]*"/, '')}/>`;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const world = loadWorld();
// Shallow water joining a continent and its islands, under everything.
const shelfShapes = shelves(world).flatMap((sh) => [
  ...sh.bands.map((b) => `  <line x1="${b.x1 * S}" y1="${b.y1 * S}" x2="${b.x2 * S}" y2="${b.y2 * S}" stroke="#1f4468" stroke-width="${b.width * S}" stroke-linecap="round"/>`),
  ...sh.circles.map((c) => `  <circle cx="${c.x * S}" cy="${c.y * S}" r="${c.r * S}" fill="#1f4468"/>`),
]);
// A land between two regions, on a strip of land joining them.
const bridgeShapes = bridges(world).flatMap((b) =>
  b.bands.map((x) => `  <line x1="${x.x1 * S}" y1="${x.y1 * S}" x2="${x.x2 * S}" y2="${x.y2 * S}" stroke="${b.color}" stroke-opacity="0.72" stroke-width="${x.width * S}"/>`),
);
// As the game draws them (web/view.ts): a region holding areas is itself a large circle, with
// its areas as small circles across the lower part.
const containers = world.regions.filter((r) => !r.parent && containerRadius(world, r)).map((r) => {
  const R = containerRadius(world, r) * S;
  return `  ${land(r.x * S, r.y * S, R, landColors(r), 'fill-opacity="0.72" stroke="#f4ecd8" stroke-opacity="0.7" stroke-width="3"')}`;
});
const areaNodes = world.regions
  .filter((r) => r.parent)
  .map((r) => {
    const { x, y } = nodeAt(world, r);
    const label = areaLabelAt(world, r);
    return `  <g>${land(x * S, y * S, AREA_NODE * S, landColors(r), 'stroke="#f4ecd8" stroke-width="2"')}
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
      : land(x, y, PLAIN_NODE * S, landColors(r), 'stroke="#f4ecd8" stroke-width="3"');
  // A region circle is named where the game names it (above, or beside/below for an island of
  // a continent), its terrain on the next line; other nodes are named below.
  const label = R ? regionLabelAt(world, r) : null;
  const [lx, anchor] = label ? [label.x * S, label.anchor] : [x, 'middle'];
  const [ny, ty] = !label
    ? [y + (t.sea ? 92 : (PLAIN_NODE + 3.5) * S), y + (t.sea ? 110 : (PLAIN_NODE + 6.5) * S)]
    : label.side === 'above'
      ? [label.y * S - 18, label.y * S]
      : [label.y * S, label.y * S + 17];
  return `  <g>${shape}
    <text x="${lx}" y="${ny}" text-anchor="${anchor}" class="name">${esc(r.name)}</text>
    <text x="${lx}" y="${ty}" text-anchor="${anchor}" class="terrain">${esc(t.label)}</text></g>`;
});

// The lands as the game map first shows them (web/view.ts fitView), not the whole sea.
const box = Object.fromEntries(Object.entries(fitView(world)).map(([k, v]) => [k, Math.round(v * S)]));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="${box.w}" height="${box.h}">
  <style>
    .name { font: 600 18px sans-serif; fill: #f4ecd8; }
    .terrain { font: 13px sans-serif; fill: #b9c3cf; }
    .area { font: 600 14px sans-serif; fill: #f4ecd8; }
  </style>
  <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#16324f"/>
${shelfShapes.join('\n')}
${bridgeShapes.join('\n')}
${containers.join('\n')}
${areaNodes.join('\n')}
${nodes.join('\n')}
</svg>
`;
writeFileSync(join(WORLD_DIR, 'map.svg'), svg);
console.log(`world/map.svg: 지역 ${nodes.length}곳, 구역 ${areaNodes.length}곳`);
