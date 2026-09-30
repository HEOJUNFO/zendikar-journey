---
id: ZEN-96
order: 35
name_en: "Halo Hunter"
name_ko: "후광 사냥꾼"
set: ZEN
number: 96
mana_cost: "{2}{B}{B}{B}"
type_line: "Creature — Demon"
pt: "6/3"
rarity: rare
artist: "Chris Rahn"
scryfall: https://scryfall.com/card/zen/96/halo-hunter
added: 2026-09-30
entities: [cre-halo-hunter, chr-iona, loc-akoum]
---

## 카드 원문

**규칙 텍스트**

> Intimidate (This creature can't be blocked except by artifact creatures and/or creatures that share a color with it.)
> When this creature enters, destroy target Angel.

**플레이버 텍스트**

> Hanging on the walls of his lair, the fallen halos cast his depravity in everlasting light.

## 해석

- 가시 돋친 거대한 악마가 한 손으로 불타는 날개의 천사를 떨어뜨리고, 다른 손에 금빛 후광을 쥐었다. 주황빛 노을과 험한 산 [그림]. 흑색 악마, 6/3 [카드].
- 굴 벽에 떨어진 후광들이 걸려 그의 타락을 비춘다 [카드 플레이버] → 천사를 사냥해 후광을 모은다. 천사들은 에메리아를 섬긴다 [배경].
- 굴은 아쿰의 산속 [결정] (그림의 산과 노을). 말하는 악마 [결정].
- 위협: 막기 = 맞받아치기·날아 피하기. 그와 색을 나누지 않는 이는 막지 못한다. 마법물체(아티팩트) 생물은 막는다 [카드]. 카드 없는 이의 색 = 유대한 땅의 색 [결정].
- 들어올 때 천사 파괴: 지역에 들어설 때마다 그곳의 천사 하나를 LLM이 그로서 골라 파괴 [결정]. 날지 못해 에메리아에는 밧줄로 오른다 (6시간 더).

## 반영 내역

- `cre-halo-hunter` (새 생물종, 한 마리 "후광 사냥꾼"): 아쿰, 6/3, 흑 5, 기력만, `intimidate`, `types: [demon]`, `enter_destroy: angel`.
- `chr-iona`: 생물 유형 천사 (`types: [angel]`).
- `loc-akoum`: 산속 굴.
- 엔진: 능력 `intimidate` (`combat.ts` 의 `unblockable`, `intimidated`; `mana.ts` 의 `actorColors`), 생물 유형 `sim.types`, `sim.enter_destroy` (`abilities.ts` 의 `enterDestroy`/`applyEnterDestroy`, 도착한 틱과 `callForth` 에서, 고를 것 `destroy`), 파괴 공통 `destroy`.
