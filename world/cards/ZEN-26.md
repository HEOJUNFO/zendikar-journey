---
id: ZEN-26
order: 107
name_en: "Makindi Shieldmate"
name_ko: "마킨디 방패동료"
set: ZEN
number: 26
mana_cost: "{2}{W}"
type_line: "Creature — Kor Soldier Ally"
pt: "0/3"
rarity: common
artist: "Howard Lyon"
scryfall: https://scryfall.com/card/zen/26/makindi-shieldmate
added: 2026-10-01
entities: [chr-makindi-shieldmate, loc-makindi]
---

## 카드 원문

**규칙 텍스트**

> Defender
> Whenever this creature or another Ally you control enters, you may put a +1/+1 counter on this creature.

**플레이버 텍스트**

> The more who rely on him, the more resolute he becomes.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 병사 동료, 0/3. 수비대. 이것이나 다른 동료가 들어올 때마다 이것에 +1/+1 카운터를 놓을 수 있다. [카드]
- 플레이버: 그에게 기대는 이가 많을수록 더 굳건해진다. [카드]
- 깃털 장식 방패와 갈고리 창을 든 흰 머리 코르 병사, 얼굴 새긴 석상이 늘어선 풀밭. [그림] (Scryfall 이미지 서버에 닿지 않아 Gatherer 에서 받음)
- 이름의 마킨디 협곡(세계에 있음), 남쪽 석상 풀밭. [카드] ([결정] 2026-10-01, 방위는 [가공]). [새 지역 후보] 없음.
- 말하는 코르 병사, 30코인 용병, 설득도 됨. [결정] 2026-10-01
- 무리 발동은 기존 `counter_self` (투크투크 졸개들과 같음).
- 수비대: 지금까지 수비대 권속은 주인이 공격받아도 맞서지 않았다. MTG 수비대는 막을 수는 있으므로, 수비대도 주인에게 먼저 덤빈 이에게는 맞서게 고친다 (주인이 먼저 건 싸움, 사냥에는 끼지 않음). [결정] 2026-10-01

## 반영 내역

- `chr-makindi-shieldmate` (새 인물): 마킨디 `home_pos: [-0.2, 0.4]`, 0/3, 마나 백 3, `defender`, `ally`, `hireable`(30코인), `rally: counter_self`.
- `loc-makindi`: 사는 방패동료 링크.
- 수비대 규칙 고침 (`combat.ts` 의 `hostileNpcs`): 막기는 한다. 여울 뱀·고마조아에도 적용.
