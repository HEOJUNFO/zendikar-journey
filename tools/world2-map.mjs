// Draws the map v2 preview world-v2/map.svg from world-v2/ (its painted tiles, sim/footprint.ts).
// Usage: npm run world2:map
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWorldV2, WORLD_V2_DIR } from '../sim/load-v2.ts';
import { mapSvg } from './map-svg.mjs';

const { world, errors } = readWorldV2();
for (const e of errors) console.log(`오류  ${e}`);
const { svg, tiles, regions, areas } = mapSvg(world, { withShelves: false });
writeFileSync(join(WORLD_V2_DIR, 'map.svg'), svg);
console.log(`world-v2/map.svg: 칸 ${tiles}개, 지역 ${regions}곳, 구역 ${areas}곳`);
