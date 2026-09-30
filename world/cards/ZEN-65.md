---
id: ZEN-65
order: 18
name_en: "Shoal Serpent"
name_ko: "여울 뱀"
set: ZEN
number: 65
mana_cost: "{5}{U}"
type_line: "Creature — Serpent"
pt: "5/5"
rarity: common
artist: "Trevor Claxton"
scryfall: https://scryfall.com/card/zen/65/shoal-serpent
added: 2026-09-30
entities: [cre-shoal-serpent, loc-silundi-sea, loc-ondu]
---

## 카드 원문

**규칙 텍스트**

> Defender
> Landfall — Whenever a land you control enters, this creature loses defender until end of turn.

**플레이버 텍스트**

> "It's like a reef that runs aground on ships."
> —Jaby, Silundi Sea nomad

## 해석

- 톱니 이빨의 긴 턱과 지느러미를 가진 거대한 바다뱀이 물살을 가르며 솟는다 [그림]. 청색 바다뱀, 5/5 [카드].
- 플레이버의 실룬디 바다 → 새 바다 지역 `loc-silundi-sea` [결정]. 자리는 처음 타짐 동쪽 [가공], 2026-09-30 사용자 결정으로 온두 북동쪽으로 옮김.
- 물에 삶: 바다에만 [가공] (여울 = 바다 속 얕은 곳).
- 수비대: 먼저 덤비지 않는다 (사냥도, 적에게 달려들기도 안 함). 맞으면 그 합에는 맞선다 [결정].
- 상륙: 땅(바다)과 유대를 맺은 날 00:00까지 수비대를 잃고 사냥하는 짐승이 된다 [카드].
- 지금 바다에는 사냥감이 없어 잠든 위험. 배가 생기면 깨어난다.

## 반영 내역

- `loc-silundi-sea` (새 바다, 심해): 처음 405·172 타짐 동쪽, 지금은 398·250 온두 북동쪽.
- `cre-shoal-serpent` (새 생물종, 한 마리): 5/5, 청 6, 기력·배고픔, `beast`, `aquatic`, `defender`, `landfall_lose: [defender]`.
- `loc-tazeem`: 동쪽 바다.
- 엔진: 능력 `defender`(`hostileNpcs` 에서 먼저 덤비지 않음), `sim.landfall_lose`(상륙하면 그 능력을 00:00까지 잃음, `Actor.lost`, `hasAbility`).
