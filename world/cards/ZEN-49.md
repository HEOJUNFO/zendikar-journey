---
id: ZEN-49
order: 143
name_en: "Ior Ruin Expedition"
name_ko: "이오르 폐허 원정"
set: ZEN
number: 49
mana_cost: "{1}{U}"
type_line: "Enchantment"
rarity: common
artist: "Chris Rahn"
scryfall: https://scryfall.com/card/zen/49/ior-ruin-expedition
added: 2026-10-02
entities: [itm-ior-ruin-expedition, loc-glasspool, loc-akoum, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> Landfall — Whenever a land you control enters, you may put a quest counter on this enchantment.
> Remove three quest counters from this enchantment and sacrifice it: Draw two cards.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 부여마법 {1}{U}. 상륙 — 탐색 카운터를 놓을 수 있다. 탐색 카운터 셋을 떼고 희생: 카드 두 장. [카드] 플레이버 없음.
- 어두운 호수 밑에 비치는 탑과 돔의 폐허, 붉은 바위 끝에서 내려다보는 창과 칼을 든 탐험가 둘. [그림]
- 이오르 = 아쿰 산중의 육각형 호수 글래스풀 바닥에 가라앉은 옛 학문의 폐허, 코르의 순례지, 엘드라지보다 오래됨. 글래스풀은 아쿰 산맥의 유일한 청 마나, 뒤틀림도 흔들지 못하는 고요한 물, 둘레를 봉우리가 감쌈. [배경] (A Planeswalker's Guide to Zendikar: Akoum, Worldwake Player's Guide, Plane Shift: Zendikar)
- 지명 확인: 이오르·글래스풀은 세계에 없었다 → [새 지역 후보]. 아쿰 안의 구역 글래스풀(기본 섬 10칸, 지형 river)로 만들고, 아쿰의 이빨 기슭에 둔다 [결정] 2026-10-02. 남쪽 기슭(`[-0.35, -0.4]`)은 칸이 서쪽 가장자리에 길게 늘어져, 산맥 남동쪽 기슭(`pos: [0.55, -0.45]`)으로 옮겼다 (산맥이 서·북을 감쌈). 방위는 [가공]
- 원정은 호수 북쪽 바위 끝(`pos: [0.2, -0.6]`)에 선다 (오라 아닌 부여마법 = 서 있는 아이템). [가공]
- 상륙 카운터는 늘 놓는다 (이득). [가공]
- 원정을 마치는 것은 언제든 행동으로 (플레이어 단추, NPC 계획 블록), 어디서든 1시간. 카드 두 장 = 비밀 둘. [결정] 2026-10-02 / [가공]

## 반영 내역

- `loc-glasspool` (새 구역): 아쿰 안, 기본 섬(river) 10칸, `pos: [0.55, -0.45]`. 룬불꽃 함정은 제 칸이 호수가 되어 한 칸 동쪽으로.
- `itm-ior-ruin-expedition` (새 아이템, 부여마법): 글래스풀 북쪽 바위, {1}{U}, `landfall_quest` + `expedition: 3 → 2`.
- `loc-akoum`, `loc-teeth-of-akoum`: 구역 링크. 지옥불 함정·룬불꽃 함정: 칸이 옮겨지지 않게 `pos` 를 박음.
- 새 아이템 효과 `landfall_quest` (`items.ts` 의 `itemsOnLandfall`), `expedition` (`sim/expedition.ts`, 플레이어 행동·NPC 계획 블록 `expedition`).
