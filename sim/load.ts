// Reads world/entities into a World. Only canon entities enter the game; drafts wait for
// the user's confirmation (world/README.md: status).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildWorld } from './world.ts';
import type { RawEntity, World } from './world.ts';

export const WORLD_DIR = fileURLToPath(new URL('../world', import.meta.url));

export function readFrontmatter(path: string): Record<string, unknown> | null {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  return (parse(m[1]) as Record<string, unknown>) ?? {};
}

export function readEntities(root = WORLD_DIR): RawEntity[] {
  const dir = join(root, 'entities');
  const out: RawEntity[] = [];
  for (const kindDir of readdirSync(dir)) {
    const sub = join(dir, kindDir);
    if (!existsSync(sub) || kindDir.startsWith('.')) continue;
    for (const f of readdirSync(sub).filter((f) => f.endsWith('.md'))) {
      const fm = readFrontmatter(join(sub, f));
      if (fm) out.push(fm as RawEntity);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function loadWorld(root = WORLD_DIR): World {
  const { world, errors } = buildWorld(readEntities(root).filter((e) => e.status === 'canon'));
  if (errors.length) throw new Error(`world/ 오류 (npm run world:check):\n${errors.join('\n')}`);
  return world;
}
