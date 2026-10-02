// Game server: JSON API over the simulation plus the web UI (Vite in middleware mode).
// Usage: npm run dev  (PORT, default 5173)
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createServer as createVite } from 'vite';
import { z } from 'zod';
import { createLlm } from '../sim/llm/index.ts';
import type { Llm } from '../sim/run.ts';
import { ActSchema, AdvanceSchema, Game, NewGameSchema, UserError } from './game.ts';
import { handleV2 } from './v2.ts';

try {
  process.loadEnvFile();
} catch {
  // no .env: createLlm says what's missing
}

// Without LLM settings the server still starts, for looking around locally: but no one's day
// can be planned, so time doesn't move (advance and act answer with an error).
let llm: Llm = {};
try {
  llm = createLlm();
} catch (e) {
  console.warn(`LLM 없이 시작: ${(e as Error).message}`);
}
const game = new Game(llm);

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function api(req: IncomingMessage, res: ServerResponse, path: string) {
  const view = () => ({ world: game.world, state: game.state });
  try {
    if (req.method === 'GET' && path === '/api/game') {
      game.reloadWorld();
      return send(res, 200, view());
    }
    if (req.method === 'POST' && path === '/api/new') {
      await game.newGame(NewGameSchema.parse(await body(req)));
      return send(res, 200, view());
    }
    if (req.method === 'POST' && path === '/api/advance') {
      const { hours } = AdvanceSchema.parse(await body(req));
      const result = await game.advance(hours);
      return send(res, 200, { ...view(), error: result.error });
    }
    if (req.method === 'POST' && path === '/api/act') {
      const result = await game.act(ActSchema.parse(await body(req)));
      return send(res, 200, { ...view(), error: result.error });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    if (e instanceof UserError) return send(res, 200, { ...view(), error: e.message });
    if (e instanceof z.ZodError || e instanceof SyntaxError) return send(res, 400, { error: String(e) });
    console.error(e);
    send(res, 500, { error: (e as Error).message });
  }
}

const vite = await createVite({
  root: fileURLToPath(new URL('../web', import.meta.url)),
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'spa',
});

const port = Number(process.env.PORT ?? 5173);
createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  if (path.startsWith('/api/v2/')) handleV2(req, res, path);
  else if (path.startsWith('/api/')) void api(req, res, path);
  else vite.middlewares(req, res);
}).listen(port, () => {
  console.log(`젠디카르: http://localhost:${port}  (LLM: ${process.env.CHAT_PROVIDER ?? '없음'})`);
});
