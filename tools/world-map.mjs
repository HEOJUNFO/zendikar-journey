// Draws the region map preview world/map.svg from the canon locations' `map` blocks: the lands
// in tiles, as the game draws them (web/view.ts).
// Usage: npm run world:map
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorld, WORLD_DIR } from '../sim/load.ts';
import { mapSvg } from './map-svg.mjs';

const { svg, tiles, regions, areas } = mapSvg(loadWorld());
writeFileSync(join(WORLD_DIR, 'map.svg'), svg);
console.log(`world/map.svg: 칸 ${tiles}개, 지역 ${regions}곳, 구역 ${areas}곳`);
