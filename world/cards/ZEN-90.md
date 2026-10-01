---
id: ZEN-90
order: 94
name_en: "Giant Scorpion"
name_ko: "거대 전갈"
set: ZEN
number: 90
mana_cost: "{2}{B}"
type_line: "Creature — Scorpion"
pt: "1/3"
rarity: common
artist: "Raymond Swanland"
scryfall: https://scryfall.com/card/zen/90/giant-scorpion
added: 2026-10-01
entities: [cre-giant-scorpion, loc-guul-draz]
---

## 카드 원문

**규칙 텍스트**

> Deathtouch (Any amount of damage this deals to a creature is enough to destroy it.)

**플레이버 텍스트**

> Its sting hurts, but death is strangely painless.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 생물 — 전갈, 1/3. 죽음의 손길. [카드]
- 플레이버: "그 침은 아프지만, 죽음은 이상하리만치 아프지 않다." [카드]
- 녹황빛 안개 속 뿌리와 이끼가 엉킨 탁한 물가, 붉은 마디의 검은 갑각을 두른 거대한 전갈이 꼬리를 치켜든다. [그림]
- 설정에 자리가 없다. 그림의 늪 물가와 흑색을 따라 굴 드라즈 본토, 남쪽 한가운데 구역들에서 떨어진 물가에 산다. [결정] 2026-10-01 (방위는 [가공])
- 말하지 않는 짐승, 배고프면 덮친다. [가공]
- 죽음의 손길 = 이 존재가 직접 입힌 피해(싸움, 돌진, 물어뜯기, 번개)는 1이라도 방어력에 닿은 것으로 친다. NPC끼리면 다른 싸움처럼 기절, 플레이어가 끼면 죽음. [결정] 2026-10-01
- 지명·부족 이름이 없어 [새 지역 후보]는 없다.

## 반영 내역

- `cre-giant-scorpion` (새 생물종, 한 마리가 산다): 굴 드라즈 `home_pos: [0.0, 0.5]`, 1/3, 마나 흑 3, 짐승, `abilities: [deathtouch]`.
- `loc-guul-draz`: 사는 전갈 링크.
- 새 능력 `deathtouch` (`dealDamage` 의 `dealer`: 싸움·돌진·물어뜯기·전기의 힘·무리 발동 피해. 돌진은 1만 주고 넘김).
