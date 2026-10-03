// Reads world-v2/ (map v2, user decision 2026-10-03): its canon entities, the painted grid
// layers (map/layers.yaml) and the reference pieces (map/reference.yaml). The game never reads
// it: v1 (world/) stays the game's world.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { readFrontmatter } from './load.ts';
import { buildWorldV2, paintLayers } from './footprint.ts';
import type { GridLayer, Reference, V2Note } from './footprint.ts';
import type { RawEntity } from './world.ts';

export const WORLD_V2_DIR = fileURLToPath(new URL('../world-v2', import.meta.url));

const Tile = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
const LayersSchema = z.strictObject({
  layers: z.array(z.strictObject({ file: z.string(), origin: Tile.optional(), legend: z.record(z.string().length(1), z.string()) })).min(1),
});
const ReferenceSchema = z.strictObject({
  image: z.string(),
  size: z.tuple([z.number(), z.number()]),
  pieces: z.record(z.string(), z.strictObject({
    clip: z.array(z.tuple([z.number(), z.number()])).min(3),
    matrix: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]),
  })),
});
const DesignSchema = z.strictObject({ role: z.string().optional(), danger: z.number().int().min(1).max(5).optional(), note: z.string().optional() });

export function readLayers(root = WORLD_V2_DIR): GridLayer[] {
  const spec = LayersSchema.parse(parse(readFileSync(join(root, 'map', 'layers.yaml'), 'utf8')));
  return spec.layers.map((l) => ({ name: `map/${l.file}`, text: readFileSync(join(root, 'map', l.file), 'utf8'), origin: l.origin, legend: l.legend }));
}

// The entities, a broken file reported by name and left out instead of failing the whole map.
export function readEntitiesV2(root = WORLD_V2_DIR): { entities: RawEntity[]; errors: string[] } {
  const dir = join(root, 'entities');
  const entities: RawEntity[] = [];
  const errors: string[] = [];
  for (const kindDir of existsSync(dir) ? readdirSync(dir) : []) {
    const sub = join(dir, kindDir);
    if (kindDir.startsWith('.') || !statSync(sub).isDirectory()) continue;
    for (const f of readdirSync(sub).filter((f) => f.endsWith('.md'))) {
      const rel = `entities/${kindDir}/${f}`;
      try {
        const fm = readFrontmatter(join(sub, f));
        if (fm && typeof fm.id === 'string') entities.push(fm as RawEntity);
        else errors.push(`${rel}: frontmatter 나 id 가 없음`);
      } catch (e) {
        errors.push(`${rel}: frontmatter 를 읽지 못함: ${(e as Error).message}`);
      }
    }
  }
  return { entities: entities.sort((a, b) => a.id.localeCompare(b.id)), errors };
}

export function readWorldV2(root = WORLD_V2_DIR) {
  const { entities: all, errors: fileErrors } = readEntitiesV2(root);
  const drafts = new Set(all.filter((e) => e.status !== 'canon').map((e) => e.id));
  const built = buildWorldV2(all.filter((e) => e.status === 'canon'), paintLayers(readLayers(root)), drafts);
  return { world: built.world, errors: [...fileErrors, ...built.errors] };
}

export function readReference(root = WORLD_V2_DIR): Reference | null {
  const path = join(root, 'map', 'reference.yaml');
  return existsSync(path) ? ReferenceSchema.parse(parse(readFileSync(path, 'utf8'))) : null;
}

// Each location's level design (`design`), tags and the text under its frontmatter.
export function readNotes(root = WORLD_V2_DIR): { notes: Record<string, V2Note>; errors: string[] } {
  const dir = join(root, 'entities', 'locations');
  const notes: Record<string, V2Note> = {};
  const errors: string[] = [];
  for (const f of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []) {
    const text = readFileSync(join(dir, f), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) continue;
    let fm: Record<string, unknown>;
    try {
      fm = (parse(m[1]) ?? {}) as Record<string, unknown>;
    } catch {
      continue; // reported by readEntitiesV2
    }
    const design = fm.design === undefined ? undefined : DesignSchema.safeParse(fm.design);
    if (design && !design.success) errors.push(`${fm.id}: design 오류: ${design.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    notes[String(fm.id)] = { design: design?.success ? design.data : undefined, tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [], body: m[2].trim(), ...(fm.place === true ? { place: true } : {}) };
  }
  return { notes, errors };
}
