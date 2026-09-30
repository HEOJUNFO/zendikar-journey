---
id: ZEN-86
order: 30
name_en: "Desecrated Earth"
name_ko: "더럽혀진 대지"
set: ZEN
number: 86
mana_cost: "{4}{B}"
type_line: "Sorcery"
rarity: common
artist: "Daarken"
scryfall: https://scryfall.com/card/zen/86/desecrated-earth
added: 2026-09-30
entities: [spl-desecrated-earth, loc-agadeem-crypt, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> Destroy target land. Its controller discards a card.

**플레이버 텍스트**

> "The land is swollen with mana, cursed relics, and secrets. If you puncture it, you never know what will burst out."
> —Javad Nasrin, Ondu relic hunter

## 해석

- 땅에서 터져 나온 검은 흙먼지와 연기에 칼을 쥔 전사가 튕겨 나간다 [그림]. 흑색 집중마법 {4}{B} [카드].
- 배우는 주문, 아게딤의 묘실에서 [결정].
- 대상 대지 → 같은 곳의 한 사람이 가장 최근에 유대를 맺은 땅을 부순다 [결정]. 7일 부서짐(기존 대지 파괴).
- 그 조종자가 카드를 버린다 → 그 사람이 주문 하나를 잊는다, 잃는 이가 고른다 [결정].

## 반영 내역

- `spl-desecrated-earth` (새 주문): 아게딤의 묘실, 효과 `destroy_land`, `discard`.
- `loc-agadeem-crypt`, `law-permanents`: 연결.
- 엔진: 주문 효과 `destroy_land`(`landToDestroy`, `step.ts` 의 `destroyLand` 로 대지 파괴를 한데 모음), `discard`(`sim/discard.ts`: 잃는 이가 고름, NPC는 LLM `discard`, 플레이어는 고를 것).
