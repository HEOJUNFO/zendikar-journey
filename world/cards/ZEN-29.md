---
id: ZEN-29
order: 113
name_en: "Noble Vestige"
name_ko: "고귀한 잔영"
set: ZEN
number: 29
mana_cost: "{2}{W}"
type_line: "Creature — Spirit"
pt: "1/2"
rarity: common
artist: "Jason Chan"
scryfall: https://scryfall.com/card/zen/29/noble-vestige
added: 2026-10-01
entities: [chr-noble-vestige, loc-emeria]
---

## 카드 원문

**규칙 텍스트**

> Flying
> {T}: Prevent the next 1 damage that would be dealt to target player or planeswalker this turn.

**플레이버 텍스트**

> Most spirits are chained to this world by their despair, but he remains tethered by his hope for better days.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 영혼, 1/2, 비행. {T}: 대상 플레이어(나 플레인즈워커)가 이번 턴에 받을 다음 피해 1을 방지. [카드]
- 플레이버: 대부분의 영혼은 절망에 묶여 남지만, 그는 더 나은 날에 대한 희망에 묶여 머문다. [카드]
- 떠 있는 부서진 석조 아치와 바위 조각 사이의 금빛 사람 형상 영혼. [그림] = 타짐 하늘의 에메리아. [배경]
- 지명 없음, [새 지역 후보] 없음.
- 자리: 에메리아, 남서쪽 부서진 아치 아래. [결정] 2026-10-01 (방위는 [가공])
- 말하는 영혼, 설득으로 권속. 먹지 않고 돈을 쓰지 않음. [결정] 2026-10-01
- 대상 플레이어 = 같은 칸의 한 사람(자신도). 이번 턴 = 자정까지. 피해 방지 = `dealDamage` 앞에서 빠짐 (생명 잃기는 막지 못함). 탭 = 잔영이 자정까지 묶임. [가공]
- 쓰는 법: 조종하는 이가 골라 건다 (플레이어 행동, NPC 계획 블록, 전승술사처럼). [결정] 2026-10-01

## 반영 내역

- `chr-noble-vestige` (새 인물): 에메리아 `home_pos: [-0.3, 0.3]`, 1/2, 마나 백 3, 비행, `tap_shield: 1`.
- `loc-emeria`: 머무는 영혼 링크.
- 새 규칙 `tap_shield` (`sim/vestige.ts`, `Actor.shield`, `dealDamage` 의 `shielded`), 플레이어 행동 `shield`, NPC 계획 블록 `shield`, 웹 "가호" 단추.
