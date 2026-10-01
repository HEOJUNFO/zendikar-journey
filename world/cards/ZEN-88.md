---
id: ZEN-88
order: 134
name_en: "Feast of Blood"
name_ko: "피의 향연"
set: ZEN
number: 88
mana_cost: "{1}{B}"
type_line: "Sorcery"
rarity: uncommon
artist: "Jason Felix"
scryfall: https://scryfall.com/card/zen/88/feast-of-blood
added: 2026-10-01
entities: [spl-feast-of-blood, loc-malakir, cre-vampire, chr-sorin-markov]
---

## 카드 원문

**규칙 텍스트**

> Cast this spell only if you control two or more Vampires.
> Destroy target creature. You gain 4 life.

**플레이버 텍스트**

> "The vampires of this world don't know the pleasures of hunger. They gorge themselves without savoring the kill."
> —Sorin Markov

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 집중마법 {1}{B}. 흡혈귀를 둘 이상 조종할 때만. 대상 생물을 파괴, 생명 4를 얻는다. [카드]
- 플레이버: 이 세계 흡혈귀는 굶주림의 즐거움을 모른다 (소린 마르코프). [카드] 소린은 세계에 있다.
- 어두운 방, 쓰러진 이를 둘러싼 붉은 눈의 흡혈귀들. [그림]
- 지명 없음, [새 지역 후보] 없음. 배우는 곳: 말라키르. [결정] 2026-10-01
- 조종하는 흡혈귀 = 시전자 자신과 그 권속 가운데 `creature: cre-vampire` (기존 "당신이 조종하는 생물" 대응). 파괴 = `destroy_target`, 생명 = `gain_life`.

## 반영 내역

- `spl-feast-of-blood` (새 주문): 말라키르에서 4시간, {1}{B}, `requires: { kind: cre-vampire, count: 2 }`, `other_here`, `destroy_target` + `gain_life: 4`.
- `loc-malakir`, `cre-vampire`, `chr-sorin-markov`: 링크.
- 새 주문 조건 `requires` (`spells.ts` 의 `requiresBlocked`: `castBlocked`·`npcCastBlocked`).
