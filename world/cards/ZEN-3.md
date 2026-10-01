---
id: ZEN-3
order: 90
name_en: "Bold Defense"
name_ko: "대담한 방어"
set: ZEN
number: 3
mana_cost: "{2}{W}"
type_line: "Instant"
rarity: common
artist: "Scott Chou"
scryfall: https://scryfall.com/card/zen/3/bold-defense
added: 2026-10-01
entities: [spl-bold-defense, loc-kabira-crossroads]
---

## 카드 원문

**규칙 텍스트**

> Kicker {3}{W} (You may pay an additional {3}{W} as you cast this spell.)
> Creatures you control get +1/+1 until end of turn. If this spell was kicked, instead creatures you control get +2/+2 and gain first strike until end of turn.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 순간마법, 킥커 {3}{W}. 당신이 조종하는 생물들이 턴 끝까지 +1/+1, 킥커면 대신 +2/+2와 선제공격. [카드]
- 뿔 돋친 거대한 애벌레 괴물 앞의 원정대, 괴물을 막아서는 흰 빛줄기. [그림]
- 카비라 교차로에서 배운다 (4시간): 길이 모이는 백색 도시, 원정대의 주문. [결정] 2026-10-01 [가공]
- 당신이 조종하는 생물들 = 시전자와 같은 칸의 그의 권속. [결정] 2026-10-01 (곁의 이들만)
- 대상 없음 = 시전자의 것 (NPC는 시전을 마치면 곧바로, 킥커는 치를 수 있으면). 턴 끝 = 자정. 대응 표대로.

## 반영 내역

- `spl-bold-defense` (새 주문): 카비라 교차로, {2}{W}, 순간마법, `target: self`, 킥커 {3}{W}, `pump_controlled` (`pt: [1, 1]`, `kicked: { pt: [2, 2], abilities: [first_strike] }`).
- 새 효과 `pump_controlled` (`sim/spells.ts`, `controlledCreatures` 가운데 시전자와 같은 칸). 00:00까지의 힘·능력을 주는 길을 `boostTillMidnight` 로 묶음 (바람 실은 돌격도).
- `loc-kabira-crossroads`: 배우는 주문 링크.
