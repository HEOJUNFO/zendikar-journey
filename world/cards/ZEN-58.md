---
id: ZEN-58
order: 115
name_en: "Paralyzing Grasp"
name_ko: "마비시키는 손아귀"
set: ZEN
number: 58
mana_cost: "{2}{U}"
type_line: "Enchantment — Aura"
rarity: common
artist: "Izzy"
scryfall: https://scryfall.com/card/zen/58/paralyzing-grasp
added: 2026-10-01
entities: [spl-paralyzing-grasp, loc-sea-gate]
---

## 카드 원문

**규칙 텍스트**

> Enchant creature
> Enchanted creature doesn't untap during its controller's untap step.

**플레이버 텍스트**

> The Halimar Sea Caves are both the breeding ground of giant squids and the dumping ground of hardened criminals.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 부여마법 — 오라 {2}{U}. 생물에게 붙는다. 붙은 생물은 언탭 단계에 언탭되지 않는다. [카드]
- 플레이버: 할리마르 바다 동굴은 거대 오징어의 번식지이자 흉악범을 버리는 곳. [카드]
- 어두운 동굴 물속, 푸른 촉수가 거꾸로 매단 사람을 감아 쥐고 아래에 이빨 난 아가리. [그림]
- 할리마르 = 타짐 남쪽 내해(분지), 어귀에 바다 관문. [배경] **[새 지역 후보] 할리마르 바다 동굴**: 만들지 않음, 배우는 곳은 바다 관문. [결정] 2026-10-01
- 탭 = 묶임, 언탭 = 00:00. 카드대로: 걸어도 곧바로는 아무 일 없고, 묶인 이가 00:00에 풀려나지 못한다. [결정] 2026-10-01
- 해로운 주문으로 친다 (NPC는 시전자를 그날 적으로). [가공]

## 반영 내역

- `spl-paralyzing-grasp` (새 주문): 바다 관문에서 4시간, {2}{U}, `other_here`, `aura` 의 `no_untap`.
- `loc-sea-gate`: 가르치는 주문 링크.
- 새 오라 효과 `no_untap` (`Actor.auras[].noUntap`, `step.ts` 의 `actorHour`: 풀릴 때 오라가 있으면 다음 00:00까지 다시 묶임).
