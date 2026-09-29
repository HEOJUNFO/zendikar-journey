// Validates world/: frontmatter shape, id/file/folder agreement, and cross-references.
// Usage: npm run world:check
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { MAP_HEIGHT, MAP_WIDTH, TERRAINS } from './build-map.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'world');

const KINDS = {
  location: { prefix: 'loc', dir: 'locations' },
  creature: { prefix: 'cre', dir: 'creatures' },
  character: { prefix: 'chr', dir: 'characters' },
  faction: { prefix: 'fac', dir: 'factions' },
  item: { prefix: 'itm', dir: 'items' },
  event: { prefix: 'evt', dir: 'events' },
  law: { prefix: 'law', dir: 'laws' },
};
const STATUSES = ['draft', 'canon'];
const CARD_ID = /^[A-Z0-9]+-\d+[a-z]?$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function readFrontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  return parse(m[1]) ?? {};
}

function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f));
}

// Cards
const cards = new Map();
for (const path of mdFiles(join(root, 'cards'))) {
  const rel = `cards/${basename(path)}`;
  const fm = readFrontmatter(path);
  if (!fm) {
    err(rel, 'frontmatter 없음');
    continue;
  }
  if (!CARD_ID.test(String(fm.id))) err(rel, `카드 id 형식 오류: ${fm.id}`);
  if (`${fm.id}.md` !== basename(path)) err(rel, `파일 이름이 id(${fm.id})와 다름`);
  if (!fm.name_en) err(rel, 'name_en 없음');
  if (!Array.isArray(fm.entities)) err(rel, 'entities 는 배열이어야 함');
  if (cards.has(fm.id)) err(rel, `중복 카드 id: ${fm.id}`);
  cards.set(fm.id, { rel, fm });
}

// Entities
const entities = new Map();
for (const [kind, { prefix, dir }] of Object.entries(KINDS)) {
  for (const path of mdFiles(join(root, 'entities', dir))) {
    const rel = `entities/${dir}/${basename(path)}`;
    const fm = readFrontmatter(path);
    if (!fm) {
      err(rel, 'frontmatter 없음');
      continue;
    }
    const id = String(fm.id);
    if (fm.kind !== kind) err(rel, `kind(${fm.kind})가 폴더(${dir})와 다름`);
    if (!id.startsWith(`${prefix}-`) || !SLUG.test(id.slice(prefix.length + 1)))
      err(rel, `id는 ${prefix}-<영문 슬러그> 형식이어야 함: ${id}`);
    if (`${id}.md` !== basename(path)) err(rel, `파일 이름이 id(${id})와 다름`);
    if (!fm.name) err(rel, 'name 없음');
    if (!STATUSES.includes(fm.status)) err(rel, `status는 ${STATUSES.join('|')} 중 하나: ${fm.status}`);
    if (!Array.isArray(fm.sources)) err(rel, 'sources 는 배열이어야 함');
    if (!Array.isArray(fm.links)) err(rel, 'links 는 배열이어야 함');
    if (entities.has(id)) err(rel, `중복 요소 id: ${id}`);
    entities.set(id, { rel, fm });
  }
}

// Map blocks (see world/README.md: 맵)
const mapped = [];
for (const [id, { rel, fm }] of entities) {
  if (!fm.map) continue;
  if (fm.kind !== 'location') {
    err(rel, 'map 은 location 에만 쓸 수 있음');
    continue;
  }
  const { x, y, w, h, terrain } = fm.map;
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!num(x) || !num(y) || x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT)
    err(rel, `map.x/y 는 0..${MAP_WIDTH - 1} / 0..${MAP_HEIGHT - 1} 범위의 숫자: ${x}, ${y}`);
  if (!num(w) || !num(h) || w < 4 || h < 4) err(rel, `map.w/h 는 4 이상의 숫자: ${w}, ${h}`);
  if (!(terrain in TERRAINS)) err(rel, `map.terrain 은 ${Object.keys(TERRAINS).join('|')} 중 하나: ${terrain}`);
  // Sea features are painted on the map but are not places.
  else if (!TERRAINS[terrain].sea) mapped.push(id);
}
const placesFile = join(root, '..', 'data', 'places.ts');
const built = existsSync(placesFile)
  ? [...readFileSync(placesFile, 'utf8').matchAll(/"id": "([^"]+)"/g)].map((m) => m[1])
  : [];
if (mapped.sort().join() !== built.sort().join())
  warn('data/places.ts', '맵이 세계관과 다름. npm run world:map 실행 필요');

// Cross-references
for (const [id, { rel, fm }] of entities) {
  for (const src of fm.sources ?? []) {
    const card = cards.get(src);
    if (!card) err(rel, `sources의 카드 ${src} 가 cards/ 에 없음`);
    else if (!(card.fm.entities ?? []).includes(id))
      warn(rel, `카드 ${src} 의 entities 에 ${id} 가 빠져 있음`);
  }
  for (const link of fm.links ?? []) {
    if (!link?.to || !link?.rel) err(rel, `links 항목은 { to, rel } 형식: ${JSON.stringify(link)}`);
    else if (!entities.has(link.to)) err(rel, `links 대상 ${link.to} 가 없음`);
  }
}
for (const [cardId, { rel, fm }] of cards) {
  for (const id of fm.entities ?? []) {
    const e = entities.get(id);
    if (!e) err(rel, `entities 의 ${id} 가 없음`);
    else if (!(e.fm.sources ?? []).includes(cardId))
      warn(rel, `${id} 의 sources 에 ${cardId} 가 빠져 있음`);
  }
}

const byKind = Object.keys(KINDS)
  .map((k) => `${k} ${[...entities.values()].filter((e) => e.fm.kind === k).length}`)
  .join(', ');
console.log(`카드 ${cards.size}장 / 요소 ${entities.size}개 (${byKind})`);
for (const w of warnings) console.log(`경고  ${w}`);
for (const e of errors) console.log(`오류  ${e}`);
if (errors.length) process.exit(1);
console.log(warnings.length ? '통과 (경고 있음)' : '통과');
