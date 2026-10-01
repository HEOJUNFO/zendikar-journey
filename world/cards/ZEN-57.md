---
id: ZEN-57
order: 73
name_en: "Mindbreak Trap"
name_ko: "정신파괴 함정"
set: ZEN
number: 57
mana_cost: "{2}{U}{U}"
type_line: "Instant — Trap"
rarity: mythic
artist: "Christopher Moeller"
scryfall: https://scryfall.com/card/zen/57/mindbreak-trap
added: 2026-10-01
entities: [evt-mindbreak-trap, loc-tazeem]
---

## 카드 원문

**규칙 텍스트**

> If an opponent cast three or more spells this turn, you may pay {0} rather than pay this spell's mana cost.
> Exile any number of target spells.

**플레이버 텍스트**

> "Life is a maze. This is one of its dead ends."
> —Noyan Dar, Tazeem lullmage

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법 — 함정. 상대가 이번 턴에 주문을 셋 이상 시전했다면 {0}으로 쓸 수 있다. 원하는 만큼의 대상 주문을 추방한다. [카드]
- 지명 확인: 타짐은 이미 있다. 진정술사(lullmage)는 직업.
- 함정 = 사건, 대체 비용 조건 = 발동 조건: 타짐(구역 포함)에서 그날 셋째 주문을 쓰는 순간 (값 없이 쓴 것은 세지 않음). [결정] 2026-10-01
- 주문을 추방 = 그 주문은 무산되고 시전자가 그 주문을 잊는다 (무덤에 안 남음). [결정] 2026-10-01
- 추방이라 시전자는 그 주문을 영영 다시 익히지 못한다 (ZEN-109 때 추방 규칙을 맞춤). [결정] 2026-10-01
- NPC 시전자면 한 단계 가볍게 무덤으로 (다시 배울 수 있다). 영영 못 쓰는 것은 플레이어뿐. [결정] 2026-10-01
- 원하는 만큼의 주문 = 터지게 한 그 주문만 (그 시간 다른 이가 준비하던 주문은 막지 않음). [가공]
- 석상 얼굴들이 늘어선 돌 미로에서 시전자의 불꽃 주문이 부서진다. [그림]
- 타짐 본토: 타짐의 진정술사 (플레이버). [배경] [결정] 2026-10-01

## 반영 내역

- `evt-mindbreak-trap` (새 함정 사건): 타짐, `trigger: cast`, `spells: 3`, 효과 `counter_spell`.
- 새 발동 `cast` (`step.ts` 의 `castEvents`, `Actor.cast`): `spells.ts` 의 `castSpell` 이 값을 치른 뒤, 효과가 일어나기 전에 부른다.
- 새 효과 `counter_spell`: 주문 무산 + 시전자가 그 주문을 잊음.
- `loc-tazeem`: 링크, 설명.
