// Card intake from Scryfall, in the order of https://scryfall.com/sets/zen?order=cmc&dir=desc
// (one entry per card, so basic lands with several arts appear once).
//   npm run card:sync   fetch the set into world/cards/_queue.json
//   npm run card:next   write the next card not yet in world/cards/ and print it. Nonbasic
//                       lands come first (the world's places are laid before anything stands
//                       on them), then the rest in order.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const cardsDir = join(repo, 'world', 'cards');
const queueFile = join(cardsDir, '_queue.json');
const SET = 'zen';

// Scryfall asks for an identifying User-Agent and 50-100ms between requests.
const HEADERS = { 'User-Agent': 'zendikar-journey/0.1', Accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sync() {
  let url = `https://api.scryfall.com/cards/search?q=set%3A${SET}&order=cmc&dir=desc&unique=cards`;
  const cards = [];
  while (url) {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Scryfall ${res.status}: ${await res.text()}`);
    const page = await res.json();
    cards.push(...page.data);
    url = page.has_more ? page.next_page : null;
    await sleep(100);
  }
  const queue = cards.map((c, i) => ({
    order: i + 1,
    id: `${SET.toUpperCase()}-${c.collector_number}`,
    name_en: c.name,
    set: SET.toUpperCase(),
    number: Number(c.collector_number),
    mana_cost: c.mana_cost ?? '',
    cmc: c.cmc,
    type_line: c.type_line,
    rarity: c.rarity,
    oracle_text: c.oracle_text ?? '',
    flavor_text: c.flavor_text ?? '',
    power: c.power,
    toughness: c.toughness,
    artist: c.artist,
    image: c.image_uris?.normal,
    scryfall: c.scryfall_uri?.split('?')[0],
  }));
  writeFileSync(queueFile, JSON.stringify(queue, null, 2) + '\n');
  console.log(`${queue.length}장을 ${SET.toUpperCase()} 순서표에 저장 (world/cards/_queue.json)`);
}

function quote(text) {
  return text ? text.split('\n').map((l) => `> ${l}`).join('\n') : '> (없음)';
}

function next() {
  if (!existsSync(queueFile)) throw new Error('순서표가 없음. 먼저 npm run card:sync');
  const queue = JSON.parse(readFileSync(queueFile, 'utf8'));
  const nonbasicLand = (c) => /\bLand\b/.test(c.type_line) && !/\bBasic\b/.test(c.type_line);
  const todo = (c) => !existsSync(join(cardsDir, `${c.id}.md`));
  const card = queue.find((c) => nonbasicLand(c) && todo(c)) ?? queue.find(todo);
  if (!card) {
    console.log(`${queue.length}장 모두 반영됨`);
    return;
  }
  const stats = card.power !== undefined ? `\npt: "${card.power}/${card.toughness}"` : '';
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(cardsDir, `${card.id}.md`),
    `---
id: ${card.id}
order: ${card.order}
name_en: ${JSON.stringify(card.name_en)}
name_ko: ""
set: ${card.set}
number: ${card.number}
mana_cost: ${JSON.stringify(card.mana_cost)}
type_line: ${JSON.stringify(card.type_line)}${stats}
rarity: ${card.rarity}
artist: ${JSON.stringify(card.artist)}
scryfall: ${card.scryfall}
added: ${today}
entities: []
---

## 카드 원문

**규칙 텍스트**

${quote(card.oracle_text)}

**플레이버 텍스트**

${quote(card.flavor_text)}

## 해석

## 반영 내역

-
`,
  );
  const done = queue.filter((c) => existsSync(join(cardsDir, `${c.id}.md`))).length;
  console.log(`[${card.order}/${queue.length}] ${card.id} ${card.name_en} ${card.mana_cost}`);
  console.log(card.type_line + (card.power !== undefined ? ` (${card.power}/${card.toughness})` : ''));
  if (card.oracle_text) console.log(card.oracle_text);
  if (card.flavor_text) console.log(`"${card.flavor_text}"`);
  console.log(`이미지: ${card.image}`);
  placeCheck(card);
  console.log(`파일: world/cards/${card.id}.md (진행 ${done}/${queue.length})`);
}

const command = process.argv[2];
if (command === 'sync') await sync();
else if (command === 'next') next();
else console.log('usage: node tools/card.mjs sync|next');

// The places of the world the card's text names, and a reminder to look for those it names (or
// whose people it names: Joraga → the Tangled Vale) that the world doesn't have yet.
function placeCheck(card) {
  const dir = join(repo, 'world', 'entities', 'locations');
  const text = [card.name_en, card.type_line, card.oracle_text, card.flavor_text].filter(Boolean).join(' ').toLowerCase();
  const known = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .map((s) => ({ en: /^name_en:\s*(.+)$/m.exec(s)?.[1].trim(), ko: /^name:\s*(.+)$/m.exec(s)?.[1].trim() }))
    // The whole name, or its first word (Hagra Swamp → Hagra): a false match only says too much.
    .filter((p) => p.en && [p.en, p.en.split(' ').length > 1 ? p.en.split(' ')[0] : ''].some((w) => w.length >= 4 && new RegExp(`\\b${w.toLowerCase()}\\b`).test(text)));
  console.log(`세계에 있는 지명: ${known.length ? known.map((p) => `${p.ko} (${p.en})`).join(', ') : '없음'}`);
  console.log('확인: 이름·플레이버의 지명, 이름에 든 부족·종족의 본거지가 세계에 없으면 [새 지역 후보]로 짚고 묻는다 (CLAUDE.md)');
}
