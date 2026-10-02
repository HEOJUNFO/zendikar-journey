// Draws a world's map as SVG, the lands in tiles as the game draws them (web/view.ts): the map
// previews of world/ (tools/world-map.mjs) and world-v2/ (tools/world2-map.mjs).
import { TERRAINS } from '../sim/world.ts';
import { TILE } from '../sim/tiles.ts';
import { areaLabelAt, fitView, halfCircle, landColors, PLAIN_NODE, regionLabelAt, shelves, tileRects } from '../web/view.ts';

const S = 6; // px per map unit
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// `withShelves`: the shallow water joining a continent and its islands (map v2 paints its lands'
// shapes instead).
export function mapSvg(world, { withShelves = true } = {}) {
  // Shallow water joining a continent and its islands, under everything.
  const shelfShapes = !withShelves ? [] : shelves(world).flatMap((sh) => [
    ...sh.bands.map((b) => `  <line x1="${b.x1 * S}" y1="${b.y1 * S}" x2="${b.x2 * S}" y2="${b.y2 * S}" stroke="#1f4468" stroke-width="${b.width * S}" stroke-linecap="round"/>`),
    ...sh.circles.map((c) => `  <circle cx="${c.x * S}" cy="${c.y * S}" r="${c.r * S}" fill="#1f4468"/>`),
  ]);
  // Each tile in its land's mana colors (split corner to corner for a two-color land); an
  // area's tiles edged lighter.
  const T = TILE * S;
  const tiles = tileRects(world).map(({ region: r, x, y }) => {
    const t = TERRAINS[r.terrain];
    const [a, b] = t.sea && !r.parent ? [t.color] : landColors(r);
    const edge = r.parent ? 'stroke="#f4ecd8" stroke-width="3"' : 'stroke="#1a1408" stroke-opacity="0.35" stroke-width="2"';
    const [px, py] = [x * S, y * S];
    return (
      `  <rect x="${px}" y="${py}" width="${T}" height="${T}" fill="${a}" fill-opacity="${r.parent ? 0.95 : 0.8}" ${edge}/>` +
      (b ? `<path d="M${px + T} ${py}L${px + T} ${py + T}L${px} ${py + T}Z" fill="${b}" fill-opacity="${r.parent ? 0.95 : 0.8}"/>` : '')
    );
  });
  // A wandering place: a round mark where it walks.
  const wanderers = world.regions.filter((r) => r.wanders).map((r) => {
    const [a, b] = landColors(r);
    const [x, y, R] = [r.x * S, r.y * S, PLAIN_NODE * S];
    const shape = b
      ? `<path d="${halfCircle(x, y, R, 0)}" fill="${a}"/><path d="${halfCircle(x, y, R, 1)}" fill="${b}"/>`
      : `<circle cx="${x}" cy="${y}" r="${R}" fill="${a}"/>`;
    return `  <g>${shape}<circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="#f4ecd8" stroke-width="3"/>
    <text x="${x}" y="${y + R + 30}" text-anchor="middle" class="name">${esc(r.name)}</text></g>`;
  });
  const areaNames = world.regions
    .filter((r) => r.parent)
    .map((r) => {
      const label = areaLabelAt(world, r);
      return `  <text x="${label.x * S}" y="${label.y * S}" text-anchor="middle" class="area">${esc(r.name)}</text>`;
    });
  // A region is named where the game names it (above its tiles, or below for an island below
  // its continent), its terrain on the next line.
  const names = world.regions.filter((r) => !r.parent && !r.wanders).map((r) => {
    const t = TERRAINS[r.terrain];
    const label = regionLabelAt(world, r);
    const [ny, ty] = label.side === 'above' ? [label.y * S - 18, label.y * S] : [label.y * S, label.y * S + 17];
    return `  <g><text x="${label.x * S}" y="${ny}" text-anchor="middle" class="name">${esc(r.name)}</text>
    <text x="${label.x * S}" y="${ty}" text-anchor="middle" class="terrain">${esc(t.label)}</text></g>`;
  });

  // The lands as the game map first shows them (web/view.ts fitView), not the whole sea.
  const box = Object.fromEntries(Object.entries(fitView(world)).map(([k, v]) => [k, Math.round(v * S)]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="${box.w}" height="${box.h}">
  <style>
    .name { font: 600 27px sans-serif; fill: #f4ecd8; paint-order: stroke; stroke: #16324f; stroke-width: 6px; }
    .terrain { font: 19.5px sans-serif; fill: #b9c3cf; paint-order: stroke; stroke: #16324f; stroke-width: 5px; }
    .area { font: 600 21px sans-serif; fill: #f4ecd8; paint-order: stroke; stroke: #16324f; stroke-width: 5px; }
  </style>
  <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#16324f"/>
${shelfShapes.join('\n')}
${tiles.join('\n')}
${wanderers.join('\n')}
${areaNames.join('\n')}
${names.join('\n')}
</svg>
`;
  return { svg, tiles: tiles.length, regions: names.length + wanderers.length, areas: areaNames.length };
}
