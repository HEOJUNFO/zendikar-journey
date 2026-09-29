import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGmPlan } from './gm.ts';
import { toHostedBody } from './chat.ts';
import type { EventDef } from '../world.ts';

const eligible = [{ id: 'evt-a' }, { id: 'evt-b' }] as EventDef[];

test('parseGmPlan keeps eligible events at hours still ahead', () => {
  const plan = parseGmPlan('```json\n{"fires":[{"eventId":"evt-a","hour":14}],"note":"폭풍"}\n```', { day: 2, hour: 6, eligible });
  assert.deepEqual(plan, { day: 2, source: 'llm', fires: [{ eventId: 'evt-a', hour: 14 }], uses: [], note: '폭풍' });
  assert.deepEqual(parseGmPlan('{"fires":[]}', { day: 0, hour: 6, eligible })?.fires, []);
});

test('parseGmPlan rejects unknown events, past hours and repeats', () => {
  const at = { day: 0, hour: 10, eligible };
  assert.equal(parseGmPlan('{"fires":[{"eventId":"evt-z","hour":12}]}', at), null);
  assert.equal(parseGmPlan('{"fires":[{"eventId":"evt-a","hour":9}]}', at), null);
  assert.equal(parseGmPlan('{"fires":[{"eventId":"evt-a","hour":12},{"eventId":"evt-a","hour":13}]}', at), null);
  assert.equal(parseGmPlan('오늘은 조용하다', at), null);
});

test('parseGmPlan checks ability uses: known power, living target, once each', () => {
  const abilities = [{ being: { id: 'chr-k' }, ability: { id: 'kin' } }] as never;
  const at = { day: 0, hour: 6, eligible: [], abilities, targets: ['chr-x', 'chr-k'] };
  const use = (u: object) => JSON.stringify({ fires: [], uses: [u] });
  assert.equal(parseGmPlan(use({ being: 'chr-k', ability: 'kin', target: 'chr-x', hour: 9 }), at)?.uses?.length, 1);
  assert.equal(parseGmPlan(use({ being: 'chr-k', ability: 'kin', target: 'chr-dead', hour: 9 }), at), null);
  assert.equal(parseGmPlan(use({ being: 'chr-k', ability: 'fly', target: 'chr-x', hour: 9 }), at), null);
  assert.equal(parseGmPlan(use({ being: 'chr-k', ability: 'kin', target: 'chr-k', hour: 9 }), at), null); // not itself
});

test('hosted body uses each provider’s token field and a floor', () => {
  const base = { url: '', apiKey: '', model: 'm', reasoningEffort: undefined };
  const msgs = [{ role: 'user' as const, content: 'hi' }];
  assert.equal((toHostedBody({ ...base, provider: 'openai' }, msgs, 10) as Record<string, unknown>).max_completion_tokens, 2048);
  assert.equal((toHostedBody({ ...base, provider: 'gemini' }, msgs, 4000) as Record<string, unknown>).max_tokens, 4000);
});
