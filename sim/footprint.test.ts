import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildWorldV2, labelTile, paintLayers } from './footprint.ts';
import type { GridLayer } from './footprint.ts';
import { readNotes, readReference, readWorldV2 } from './load-v2.ts';
import { CONTINENT_MIN, LAND_MIN, tilesOf } from './tiles.ts';
import { descendantsOf, TERRAINS } from './world.ts';
import type { RawEntity } from './world.ts';

const loc = (id: string, map: Record<string, unknown>, extra: Partial<RawEntity> = {}): RawEntity => ({ id, kind: 'location', name: id, status: 'canon', map, ...extra });
const continent = (id: string) => loc(id, { terrain: 'grassland', size: 'continent' });
const area = (id: string, parent: string) => loc(id, { in: parent, terrain: 'forest' });

test('paintLayers reads a grid through its legend, and a later layer paints over from its origin', () => {
  const world = { name: 'world.txt', text: 'AA..\nAAB.\n', legend: { A: 'loc-a', B: 'loc-b' } };
  const fp = paintLayers([world], 4, 2);
  assert.deepEqual(fp.errors, []);
  assert.deepEqual(fp.tiles['loc-a'], [[0, 0], [1, 0], [0, 1], [1, 1]]);
  assert.deepEqual(fp.tiles['loc-b'], [[2, 1]]);
  assert.equal(fp.owner['3,0'], undefined);

  const areaLayer: GridLayer = { name: 'a.txt', text: '.x\n', origin: [0, 1], legend: { x: 'loc-x' } };
  const fp2 = paintLayers([world, areaLayer], 4, 2);
  assert.deepEqual(fp2.tiles['loc-x'], [[1, 1]]);
  assert.deepEqual(fp2.tiles['loc-a'], [[0, 0], [1, 0], [0, 1]]);
  assert.deepEqual(fp2.paints.at(-1), { id: 'loc-x', tile: [1, 1], prev: 'loc-a', layer: 'a.txt' });
});

test('paintLayers reports a wrong size, unknown characters and paint off the map, by line and character', () => {
  const fp = paintLayers(
    [
      { name: 'w.txt', text: 'A..\nAZ\n', legend: { A: 'loc-a' } },
      { name: 'x.txt', text: 'AA', origin: [2, 1], legend: { A: 'loc-a' } },
    ],
    3,
    2,
  );
  assert.ok(fp.errors.includes('w.txt 2줄: 2글자 (지도는 3칸)'));
  assert.ok(fp.errors.includes("w.txt 2줄 2째 글자: 범례에 없는 글자 'Z'"));
  assert.ok(fp.errors.includes('x.txt 1줄 2째 글자: 지도 밖 (칸 3,1)'));
});

test('buildWorldV2 places a top land at the middle of its painted tiles and keeps the painted tiles', () => {
  const fp = paintLayers([{ name: 'w', text: 'AA..\nAA.S\n', legend: { A: 'loc-a', S: 'loc-sea' } }], 4, 2);
  const { world, errors } = buildWorldV2([continent('loc-a'), loc('loc-sea', { terrain: 'deepsea' })], fp);
  assert.deepEqual(errors, []);
  const a = world.regions.find((r) => r.id === 'loc-a')!;
  assert.deepEqual([a.x, a.y], [24, 24]);
  assert.equal(tilesOf(world, 'loc-a').length, 4);
  assert.deepEqual(tilesOf(world, 'loc-sea'), [[3, 1]]);
  assert.equal(world.tileOwner!['3,1'], 'loc-sea');
});

test('buildWorldV2: an area lies on its land, painted on a later layer; strays are errors', () => {
  const layers: GridLayer[] = [
    { name: 'w', text: 'AAB.\nAAB.\n', legend: { A: 'loc-a', B: 'loc-b' } },
    { name: 'a', text: 'xy\n', origin: [1, 1], legend: { x: 'loc-x', y: 'loc-y' } },
  ];
  const entities = [
    continent('loc-a'),
    loc('loc-b', { terrain: 'forest' }),
    area('loc-x', 'loc-a'),
    // painted over loc-b, not over its own land
    area('loc-y', 'loc-a'),
    // no tiles anywhere
    loc('loc-z', { terrain: 'rocky' }),
  ];
  const { world, errors } = buildWorldV2(entities, paintLayers(layers, 4, 2));
  assert.deepEqual(tilesOf(world, 'loc-x'), [[1, 1]]);
  assert.ok(!errors.some((e) => e.startsWith('loc-x:')));
  assert.ok(errors.some((e) => e.startsWith('loc-y:') && e.includes('바깥 땅(loc-a) 위가 아닌')));
  assert.ok(errors.some((e) => e.startsWith('loc-z:') && e.includes('칸이 없음')));
  // The continent's place counts its areas' tiles: (0,0) (1,0) (0,1) and the areas' (1,1) (2,1).
  const a = world.regions.find((r) => r.id === 'loc-a')!;
  assert.deepEqual([a.x, a.y], [156 / 5, 132 / 5]);
});

test('buildWorldV2: an area in an area lies on that area, and a stray stays an error under a later paint', () => {
  const entities = [continent('loc-a'), area('loc-x', 'loc-a'), area('loc-z', 'loc-x')];
  const run = (...layers: GridLayer[]) => buildWorldV2(entities, paintLayers([{ name: 'w', text: 'AAAA.\n', legend: { A: 'loc-a' } }, ...layers], 5, 1)).errors;
  const x = (text: string, origin: [number, number] = [0, 0]): GridLayer => ({ name: 'x', text, origin, legend: { x: 'loc-x' } });
  const z = (text: string, origin: [number, number]): GridLayer => ({ name: 'z', text, origin, legend: { z: 'loc-z' } });
  // On the area, and painted again over itself: fine.
  assert.deepEqual(run(x('xx'), z('z', [1, 0]), z('z', [1, 0])), []);
  // On the continent's ground beside the area: the area it lies in doesn't hold that tile.
  assert.ok(run(x('xx'), z('z', [3, 0])).some((e) => e.startsWith('loc-z:') && e.includes('바깥 땅(loc-x)')));
  // On the same layer as its area: its tile was the continent's, not yet the area's.
  assert.ok(run({ name: 'xz', text: 'xz', legend: { x: 'loc-x', z: 'loc-z' } }).some((e) => e.startsWith('loc-z:')));
  // The area strays onto the open sea and the place covers that tile: both are reported.
  const errors = run(x('xxxxx'), z('z', [4, 0]));
  assert.ok(errors.some((e) => e.startsWith('loc-x:') && e.includes('칸 4,0')));
});

test('buildWorldV2: a wandering place keeps its own place and one tile, and is not painted', () => {
  const goma = loc('loc-goma', { x: 60, y: 12, terrain: 'rocky' }, { sim: { wanders: { per_day: 24, stops: [{ name: '동쪽', x: 84, y: 12 }, { name: '서쪽', x: 12, y: 12 }] } } });
  const fp = paintLayers([{ name: 'w', text: 'AAAA\n', legend: { A: 'loc-a' } }], 4, 1);
  const { world, errors } = buildWorldV2([continent('loc-a'), goma], fp);
  assert.deepEqual(errors, []);
  const g = world.regions.find((r) => r.id === 'loc-goma')!;
  assert.deepEqual([g.x, g.y], [60, 12]);
  assert.deepEqual(tilesOf(world, 'loc-goma'), [[2, 0]]);
  assert.equal(tilesOf(world, 'loc-a').length, 4);

  const painted = paintLayers([{ name: 'w', text: 'AAAg\n', legend: { A: 'loc-a', g: 'loc-goma' } }], 4, 1);
  const again = buildWorldV2([continent('loc-a'), goma], painted);
  assert.ok(again.errors.some((e) => e.startsWith('loc-goma:') && e.includes('칠하지 않는다')));
  assert.equal(again.world.tileOwner!['3,0'], undefined);
});

test('buildWorldV2: a draft painted is named as a draft and its tiles stay its land\'s; a map.in loop does not hang', () => {
  const fp = paintLayers(
    [
      { name: 'w', text: 'AAA\n', legend: { A: 'loc-a' } },
      { name: 'd', text: 'd', origin: [1, 0], legend: { d: 'loc-d' } },
    ],
    3,
    1,
  );
  const { world, errors } = buildWorldV2([continent('loc-a')], fp, new Set(['loc-d']));
  assert.ok(errors.some((e) => e.startsWith('loc-d:') && e.includes('draft')));
  assert.equal(world.tileOwner!['1,0'], 'loc-a');

  const loop = buildWorldV2([continent('loc-a'), area('loc-p', 'loc-q'), area('loc-q', 'loc-p')], paintLayers([{ name: 'w', text: 'AAA\n', legend: { A: 'loc-a' } }], 3, 1));
  assert.ok(loop.errors.some((e) => e.includes('돌고 돎')));
});

test('buildWorldV2: a legend id that is no land is an error', () => {
  const fp = paintLayers([{ name: 'w', text: 'AQ\n', legend: { A: 'loc-a', Q: 'loc-ghost' } }], 2, 1);
  const { errors } = buildWorldV2([loc('loc-a', { terrain: 'grassland' })], fp);
  assert.ok(errors.some((e) => e.startsWith('loc-ghost:')));
});

test('labelTile picks the tile deepest inside a land, not its middle when that is off it', () => {
  // A crescent around a bay: the middle of its tiles falls in the bay.
  const fp = paintLayers([{ name: 'w', text: 'AAAAA\nAA..A\nAA...\nAA..A\nAAAAA\n', legend: { A: 'loc-a' } }], 5, 5);
  const { world } = buildWorldV2([continent('loc-a')], fp);
  const t = labelTile(world, 'loc-a')!;
  assert.equal(world.tileOwner![`${t[0]},${t[1]}`], 'loc-a');
});

test('readWorldV2 names a broken entity file and still builds the map from the rest', () => {
  const root = mkdtempSync(join(tmpdir(), 'world-v2-'));
  try {
    mkdirSync(join(root, 'entities', 'locations'), { recursive: true });
    mkdirSync(join(root, 'map'));
    writeFileSync(join(root, 'map', 'layers.yaml'), 'layers:\n  - file: world.txt\n    legend: { A: loc-a }\n');
    writeFileSync(join(root, 'map', 'world.txt'), 'A'.repeat(120) + '\n' + '.'.repeat(120).concat('\n').repeat(89));
    writeFileSync(join(root, 'entities', 'locations', 'loc-a.md'), '---\nid: loc-a\nkind: location\nname: 가\nstatus: canon\nmap: { terrain: grassland, size: continent }\n---\n');
    writeFileSync(join(root, 'entities', 'locations', 'loc-bad.md'), '---\nid: loc-bad\nname: [broken\n---\n');
    const { world, errors } = readWorldV2(root);
    assert.ok(errors.some((e) => e.startsWith('entities/locations/loc-bad.md:')));
    assert.equal(tilesOf(world, 'loc-a').length, 120);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the real map v2 loads clean, every land as large as its kind needs', () => {
  const { world, errors } = readWorldV2();
  assert.deepEqual(errors, []);
  assert.deepEqual(readNotes().errors, []);
  for (const r of world.regions.filter((x) => !x.parent && !TERRAINS[x.terrain].sea)) {
    const n = tilesOf(world, r.id).length + descendantsOf(world, r.id).reduce((m, d) => m + tilesOf(world, d.id).length, 0);
    assert.ok(n >= (r.size === 'continent' ? CONTINENT_MIN : LAND_MIN), `${r.id}: ${n}칸`);
  }
  const ref = readReference();
  if (ref) for (const id of Object.keys(ref.pieces)) assert.ok(world.regions.some((r) => r.id === id), `reference ${id}`);
});
