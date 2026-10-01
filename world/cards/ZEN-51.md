---
id: ZEN-51
order: 70
name_en: "Lethargy Trap"
name_ko: "무기력 함정"
set: ZEN
number: 51
mana_cost: "{3}{U}"
type_line: "Instant — Trap"
rarity: common
artist: "Anthony Francisco"
scryfall: https://scryfall.com/card/zen/51/lethargy-trap
added: 2026-10-01
entities: [evt-lethargy-trap, loc-soaring-seacliff]
---

## 카드 원문

**규칙 텍스트**

> If three or more creatures are attacking, you may pay {U} rather than pay this spell's mana cost.
> Attacking creatures get -3/-0 until end of turn.

**플레이버 텍스트**

> Suddenly, Zurdi didn't care about treasure, glory, food . . . or the drakes circling above.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법 — 함정. 생물 셋 이상이 공격 중이면 {U}로 쓸 수 있다. 공격하는 생물들은 턴 끝까지 -3/-0. [카드]
- 지명 확인: 지명 없음 (주르디는 고블린 이름). [카드]
- 함정 = 사건, 대체 비용 조건 = 발동 조건: 같은 시간에 그 땅에서 셋 이상이 덤비면 (화살 세례 함정과 같은 `attacked`). [결정]
- 효과: 그 시간에 덤빈 이들 모두 00:00까지 -3/-0. 공격력은 0 아래로 내려가지 않는다. [가공]
- 푸른 안개 속 높은 바위에 멍하니 주저앉은 고블린. [그림]
- 솟아오른 바다절벽: 플레이버의 드레이크(바다절벽의 바람을 타는 하늘 폐허의 드레이크). [가공] [결정] 2026-10-01

## 반영 내역

- `evt-lethargy-trap` (새 함정 사건): 솟아오른 바다절벽, `trigger: attacked`, `attackers: 3`, 효과 `pump_attackers: [-3, 0]`.
- 새 효과 `pump_attackers` (`step.ts`, 덤빈 이들의 `pumps`). `ptOf` 의 공격력은 0 아래로 내려가지 않는다.
- `loc-soaring-seacliff`: 링크, 설명.
