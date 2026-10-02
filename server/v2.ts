// Map v2 (world-v2/, user decision 2026-10-03): the redesigned map, read fresh on every request
// and kept apart from the game (server/game.ts and saves/ never see it).
//   GET /api/v2/world        the v2 world, its problems, level design notes and reference pieces
//   GET /api/v2/ref/<file>   an image of the reference map in map/ (local only, not in git)
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { readNotes, readReference, readWorldV2 } from '../sim/load-v2.ts';
import type { WorldV2View } from '../sim/footprint.ts';

const REF_DIR = fileURLToPath(new URL('../map', import.meta.url));
const IMAGE_TYPES: Record<string, string> = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

// A reference image the route serves: a known image type, a file in map/.
function refImage(name: string) {
  const base = basename(name);
  const type = IMAGE_TYPES[extname(base).toLowerCase()];
  const file = join(REF_DIR, base);
  return type && existsSync(file) && statSync(file).isFile() ? { file, type } : null;
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

export function handleV2(req: IncomingMessage, res: ServerResponse, path: string) {
  try {
    if (req.method === 'GET' && path === '/api/v2/world') {
      // The world itself must load; a broken notes or reference file only shows as a problem.
      const { world, errors } = readWorldV2();
      const extra: string[] = [];
      const optional = <T,>(what: string, read: () => T): T | null => {
        try {
          return read();
        } catch (e) {
          extra.push(`${what}: ${(e as Error).message}`);
          return null;
        }
      };
      const notes = optional('entities (design, 본문)', readNotes);
      const ref = optional('map/reference.yaml', readReference);
      const view: WorldV2View = {
        world,
        errors: [...errors, ...(notes?.errors ?? []), ...extra],
        notes: notes?.notes ?? {},
        reference: ref && { ...ref, available: !!refImage(ref.image) },
      };
      return json(res, 200, view);
    }
    if (req.method === 'GET' && path.startsWith('/api/v2/ref/')) {
      const img = refImage(decodeURIComponent(path.slice('/api/v2/ref/'.length)));
      if (!img) return json(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': img.type, 'Cache-Control': 'no-cache' });
      // A read that fails midway ends this response, not the server.
      return void pipeline(createReadStream(img.file), res, (err) => err && res.destroy(err));
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: (e as Error).message });
  }
}
