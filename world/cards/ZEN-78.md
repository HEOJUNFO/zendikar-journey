---
id: ZEN-78
order: 87
name_en: "Windrider Eel"
name_ko: "바람타기 뱀장어"
set: ZEN
number: 78
mana_cost: "{3}{U}"
type_line: "Creature — Fish"
pt: "2/2"
rarity: common
artist: "Austin Hsu"
scryfall: https://scryfall.com/card/zen/78/windrider-eel
added: 2026-10-01
entities: [cre-windrider-eel, loc-makindi]
---

## 카드 원문

**규칙 텍스트**

> Flying
> Landfall — Whenever a land you control enters, this creature gets +2/+2 until end of turn.

**플레이버 텍스트**

> "The best spot to hook one is right behind the gills."
> —Rana Cloudwake, kor skyfisher

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 물고기, 2/2. 비행. 상륙: 턴 끝까지 +2/+2. [카드]
- 플레이버: 코르 하늘낚시꾼 라나 클라우드웨이크, "낚기 가장 좋은 자리는 아가미 바로 뒤". [카드]
- 구름 낀 하늘을 헤엄치는 주황 줄무늬의 이빨 돋은 거대한 뱀장어. [그림]
- 하늘을 헤엄치는 물고기를 코르 하늘낚시꾼이 낚는다. 코르의 터전은 온두. [배경] → 마킨디 협곡 북서쪽 떠 있는 바위들 사이에 산다. [결정] 2026-10-01 (방위는 [가공])
- 말하지 않는 짐승, 배고프면 덮친다. [결정] 2026-10-01
- 상륙은 기존 대응대로 (유대를 맺은 날 00:00까지 +2/+2).
- 라나 클라우드웨이크: 인물로 두지 않는다 (그 카드가 나오면).

## 반영 내역

- `cre-windrider-eel` (새 생물종, 한 마리가 산다): 마킨디 `home_pos: [-0.4, -0.3]`, 2/2, 마나 청 4, 짐승, `abilities: [fly]`, `landfall: { pt: [2, 2] }`.
- `loc-makindi`: 사는 뱀장어 링크. 새 규칙은 없다.
