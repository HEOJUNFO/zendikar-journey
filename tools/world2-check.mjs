// Validates world-v2/ (map v2): frontmatter shape, id/file/folder agreement, cross-references,
// the painted grid (sim/footprint.ts) and each land's size.
// Usage: npm run world2:check
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'yaml';

import { readNotes, readReference, readWorldV2, WORLD_V2_DIR } from '../sim/load-v2.ts';
import { WORLD_DIR } from '../sim/load.ts';
import { CONTINENT_MIN, LAND_MIN, tileKey, tilesOf } from '../sim/tiles.ts';
import { TERRAINS } from '../sim/world.ts';

// Map v2 holds lands and places only, for now (user decision 2026-10-03): cards come later.
const KINDS = { location: { prefix: 'loc', dir: 'locations' } };
const STATUSES = ['draft', 'canon'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// v1 map fields the grid decides in v2 (a wandering place keeps x, y: where it starts).
const PAINTED = ['x', 'y', 'tiles', 'pos', 'order'];

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function readFrontmatter(path) {
  const m = readFileSync(path, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  return m ? (parse(m[1]) ?? {}) : null;
}
const mdFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f)) : []);

// Cards are shared with v1 (world/cards): v2 places cite them once cards are brought in.
const cards = new Set(mdFiles(join(WORLD_DIR, 'cards')).map((p) => basename(p, '.md')));

const entities = new Map();
const entitiesDir = join(WORLD_V2_DIR, 'entities');
for (const dir of existsSync(entitiesDir) ? readdirSync(entitiesDir) : []) {
  if (dir.startsWith('.') || !statSync(join(entitiesDir, dir)).isDirectory()) continue;
  if (!Object.values(KINDS).some((k) => k.dir === dir)) err(`entities/${dir}`, `지도 v2 에는 아직 ${Object.values(KINDS).map((k) => k.dir).join(', ')} 만 둔다`);
}
for (const [kind, { prefix, dir }] of Object.entries(KINDS)) {
  for (const path of mdFiles(join(entitiesDir, dir))) {
    const rel = `entities/${dir}/${basename(path)}`;
    let fm;
    try {
      fm = readFrontmatter(path);
    } catch (e) {
      err(rel, `frontmatter 를 읽지 못함: ${e.message}`);
      continue;
    }
    if (!fm) {
      err(rel, 'frontmatter 없음');
      continue;
    }
    const id = String(fm.id);
    if (fm.kind !== kind) err(rel, `kind(${fm.kind})가 폴더(${dir})와 다름`);
    if (!id.startsWith(`${prefix}-`) || !SLUG.test(id.slice(prefix.length + 1))) err(rel, `id는 ${prefix}-<영문 슬러그> 형식이어야 함: ${id}`);
    if (`${id}.md` !== basename(path)) err(rel, `파일 이름이 id(${id})와 다름`);
    if (!fm.name) err(rel, 'name 없음');
    if (!fm.name_en) err(rel, 'name_en 없음');
    if (!fm.summary) err(rel, 'summary 없음');
    if (!STATUSES.includes(fm.status)) err(rel, `status는 ${STATUSES.join('|')} 중 하나: ${fm.status}`);
    if (!Array.isArray(fm.sources)) err(rel, 'sources 는 배열이어야 함');
    else for (const src of fm.sources) if (!cards.has(src)) err(rel, `sources의 카드 ${src} 가 world/cards/ 에 없음`);
    if (!Array.isArray(fm.links)) err(rel, 'links 는 배열이어야 함');
    const map = fm.map && typeof fm.map === 'object' ? fm.map : null;
    const wanders = !!fm.sim?.wanders;
    for (const k of PAINTED.filter((k) => map && k in map && !(wanders && (k === 'x' || k === 'y')))) err(rel, `map.${k} 는 지도 v2 에 적지 않는다 (칸과 자리는 격자가 정함: map/layers.yaml)`);
    if (entities.has(id)) err(rel, `중복 요소 id: ${id}`);
    entities.set(id, { rel, fm });
  }
}
for (const [, { rel, fm }] of entities) {
  for (const link of Array.isArray(fm.links) ? fm.links : []) {
    if (!link?.to || !link?.rel) err(rel, `links 항목은 { to, rel } 형식: ${JSON.stringify(link)}`);
    else if (!entities.has(link.to)) err(rel, `links 대상 ${link.to} 가 world-v2 에 없음`);
  }
}

// A message about an entity goes under its file; others (a grid line, a layer file) as they are.
const report = (msg) => {
  const id = msg.slice(0, msg.indexOf(':'));
  const e = entities.get(id);
  if (e) err(e.rel, msg.slice(id.length + 1).trimStart());
  else errors.push(msg);
};
const attempt = (what, read) => {
  try {
    return read();
  } catch (e) {
    errors.push(`${what}: ${e.message}`);
    return null;
  }
};

// The painted grid and the world built from it: canon only, as the page reads it.
const built = attempt('world-v2 읽기 (map/layers.yaml, 격자 파일)', () => readWorldV2());
const notes = attempt('entities (design)', () => readNotes());
const ref = attempt('map/reference.yaml', () => readReference());
for (const msg of [...(built?.errors ?? []), ...(notes?.errors ?? [])]) report(msg);
const world = built?.world;
// A land's areas, theirs and so on down, safe on a map.in loop (reported above).
const below = (id, seen = new Set([id])) =>
  world.regions.filter((r) => r.parent === id && !seen.has(r.id)).flatMap((r) => (seen.add(r.id), [r, ...below(r.id, seen)]));
if (world) {
  // Lands at least as large as their kind (user decision 2026-10-01): a continent 100 tiles with
  // its areas, any other land 10. A sea holds water, a wandering place one tile of its own.
  for (const r of world.regions.filter((x) => !x.wanders && !(TERRAINS[x.terrain].sea && !x.parent))) {
    const n = [r, ...below(r.id)].reduce((m, x) => m + tilesOf(world, x.id).length, 0);
    const least = r.size === 'continent' ? CONTINENT_MIN : LAND_MIN;
    if (n < least) report(`${r.id}: 칸 ${n}개 (최소 ${least})`);
  }
  // A land (an area too) in one piece with its areas: a stray character in a grid makes a
  // far-off tile.
  for (const r of world.regions.filter((x) => !x.wanders)) {
    const ts = [r, ...below(r.id)].flatMap((x) => tilesOf(world, x.id));
    const left = new Set(ts.map(tileKey));
    let pieces = 0;
    for (const t of ts) {
      if (!left.has(tileKey(t))) continue;
      pieces++;
      const stack = [t];
      left.delete(tileKey(t));
      while (stack.length) {
        const [c, rr] = stack.pop();
        for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
          const k = tileKey([c + dc, rr + dr]);
          if (left.has(k)) {
            left.delete(k);
            stack.push([c + dc, rr + dr]);
          }
        }
      }
    }
    if (pieces > 1) warn(entities.get(r.id)?.rel ?? r.id, `칸이 ${pieces}조각으로 떨어져 있음 (격자에 잘못 친 글자가 없는지)`);
  }
}
for (const id of Object.keys(ref?.pieces ?? {})) if (!entities.has(id)) err('map/reference.yaml', `${id} 가 world-v2 에 없음`);

if (world) {
  const sum = (rs) => rs.reduce((n, r) => n + tilesOf(world, r.id).length, 0);
  const tops = world.regions.filter((r) => !r.parent);
  const seas = tops.filter((r) => TERRAINS[r.terrain].sea);
  console.log(`요소 ${entities.size}개 / 지역 ${world.regions.length}곳 (대륙 ${tops.filter((r) => r.size === 'continent').length}, 섬 ${tops.filter((r) => r.size === 'island').length}, 바다 ${seas.length}, 구역 ${world.regions.length - tops.length}) / 땅 ${sum(world.regions) - sum(seas)}칸, 바다 ${sum(seas)}칸`);
}
for (const w of new Set(warnings)) console.log(`경고  ${w}`);
for (const e of new Set(errors)) console.log(`오류  ${e}`);
if (errors.length) process.exit(1);
console.log(warnings.length ? '통과 (경고 있음)' : '통과');
