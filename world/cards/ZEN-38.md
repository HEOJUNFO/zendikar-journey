---
id: ZEN-38
order: 86
name_en: "Windborne Charge"
name_ko: "바람 실은 돌격"
set: ZEN
number: 38
mana_cost: "{2}{W}{W}"
type_line: "Sorcery"
rarity: uncommon
artist: "Ryan Pancoast"
scryfall: https://scryfall.com/card/zen/38/windborne-charge
added: 2026-10-01
entities: [spl-windborne-charge, loc-emeria]
---

## 카드 원문

**규칙 텍스트**

> Two target creatures you control each get +2/+2 and gain flying until end of turn.

**플레이버 텍스트**

> The merfolk call the sky goddess Emeria. The kor call her Kamsa. The two races agree on little except that she offers many blessings to the faithful.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 집중마법. 당신이 조종하는 대상 생물 둘이 각각 턴 끝까지 +2/+2와 비행을 얻는다. [카드]
- 플레이버: 하늘 여신을 인어는 에메리아, 코르는 캄사라 부르고, 그녀가 믿는 이에게 축복을 내린다는 데에는 뜻을 같이한다. [카드]
- 푸른 하늘에서 붉은 천 날개를 단 코르 전사 둘이 갈고리 낫을 들고 날아든다. [그림]
- 하늘 폐허 에메리아에서 배운다 (4시간): 하늘 여신의 이름. [결정] 2026-10-01 [배경]
- 당신이 조종하는 생물 = 같은 칸의 시전자 자신과 그의 권속. [결정] 2026-10-01 (자신도 든다, 대응 표의 권속)
- 대상 둘이 없으면 쓸 수 없다. [결정] 2026-10-01 (MTG대로)
- 턴 끝 = 자정. 첫째는 시전할 때, 둘째는 한 시간 뒤 반드시 고른다. [가공]

## 반영 내역

- `spl-windborne-charge` (새 주문): 에메리아, {2}{W}{W}, `target: any_here`, `pump_own` (`count: 2`, `pt: [2, 2]`, `abilities: [fly]`).
- 새 효과 `pump_own` (`sim/spells.ts`: 대상은 자신과 권속만, 수가 모자라면 `castBlocked`, 효과는 `Actor.pumps`·`Actor.granted` 00:00까지, 둘째는 `state.choices` 의 `cast` + `second`: 반드시 고름, `sim/asks.ts`·`sim/run.ts` 의 `castChoice`).
- `loc-emeria`: 배우는 주문 링크.
