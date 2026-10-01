---
id: ZEN-44
order: 91
name_en: "Cancel"
name_ko: "취소"
set: ZEN
number: 44
mana_cost: "{1}{U}{U}"
type_line: "Instant"
rarity: common
artist: "Scott Chou"
scryfall: https://scryfall.com/card/zen/44/cancel
added: 2026-10-01
entities: [spl-cancel, loc-tazeem]
---

## 카드 원문

**규칙 텍스트**

> Counter target spell.

**플레이버 텍스트**

> Zendikar's volatile mana is the basis for many spectacular spells—and some equally astonishing failures.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법. 대상 주문을 무효화한다. [카드]
- 플레이버: 젠디카르의 변덕스러운 마나는 장관과 실패의 바탕. [카드]
- 손끝의 불꽃이 연기로 꺼져 가는 늙은 마법사. [그림]
- 타짐에서 배운다 (4시간): 청색 대륙, 주문을 부수는 정신파괴 함정의 땅. [결정] 2026-10-01 [가공]
- 반응: 같은 칸에서 누군가 주문을 쓰면 값을 치른 채 한 시간 보류, 쥔 이가 무효화할지 정한다. 무효화되면 흩어지고 마나는 돌아오지 않는다. 시전자는 잊지 않는다. [가공] (소환자의 파멸의 반응 규칙을 넓힘)
- 권속 들이기(생물 주문)도 막는다. [결정] 2026-10-01
- 무효화를 무효화하는 다툼은 없다 (반응 주문은 보류되지 않음). 값 없이 따라오는 몫도 보류되지 않는다. [가공]

## 반영 내역

- `spl-cancel` (새 주문): 타짐, {1}{U}{U}, 순간마법, `counter_spell`.
- `sim/counter.ts`: `counter_spell` 을 쥔 이는 권속 들이기에도 답할 수 있고(`counterHolders`), 주문 시전은 `holdCast` 가 보류해 `answerCounterCast` 가 푼다. `sim/spells.ts` 의 `castSpell` 을 값 치르기와 `resolveSpell` 로 나누고 `held` 를 돌려준다. 고를 것 `counter_cast` (`sim/asks.ts`, `sim/run.ts`).
- `loc-tazeem`: 배우는 주문 링크.
