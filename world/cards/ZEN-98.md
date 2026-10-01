---
id: ZEN-98
order: 101
name_en: "Hideous End"
name_ko: "흉측한 최후"
set: ZEN
number: 98
mana_cost: "{1}{B}{B}"
type_line: "Instant"
rarity: common
artist: "Zoltan Boros & Gabor Szikszai"
scryfall: https://scryfall.com/card/zen/98/hideous-end
added: 2026-10-01
entities: [spl-hideous-end, loc-guum-wilds]
---

## 카드 원문

**규칙 텍스트**

> Destroy target nonblack creature. Its controller loses 2 life.

**플레이버 텍스트**

> "A little dark magic won't stop me. The worse the curse, the better the prize."
> —Radavi, Joraga relic hunter, last words

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 순간마법. 흑색이 아닌 생물 하나를 파괴한다. 그 조종자는 생명 2를 잃는다. [카드]
- 플레이버: 조라가 유물 사냥꾼 라다비의 마지막 말, "저주가 고약할수록 보물은 값지거든." [카드]
- 검은 벌레 떼가 엘프 유물 사냥꾼을 뒤덮고, 폐허에 검은 우상이 선다. [그림]
- 조라가의 본거지 탱글드 베일은 세계에 있다, [새 지역 후보] 없음. [배경]
- 배우는 곳: 굼 밀림 (묻힌 유적의 우상). [결정] 2026-10-01 (유적은 [가공])
- 대상: 같은 칸의 흑색이 아닌 이(카드 없는 이는 유대한 땅의 색), 플레인즈워커 빼고. 파괴불가는 버팀. 주문이라 NPC끼리도 죽음. [가공] (기존 대응)
- 그 조종자 = 주인, 없으면 그 자신. 파괴와 상관없이 생명 2. [가공]
- 라다비: 인물로 두지 않는다 (마지막 말이다).

## 반영 내역

- `spl-hideous-end` (새 주문): 굼 밀림에서 배움, {1}{B}{B}, `destroy_target: { not_color: B, lose_life: 2 }`.
- `loc-guum-wilds`: 배우는 주문 링크.
- 새 효과 `destroy_target` (`castBlocked`·`castTargets` 의 `destroyBarred`, `resolveSpell`).
