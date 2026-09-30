---
id: ZEN-8
order: 29
name_en: "Conqueror's Pledge"
name_ko: "정복자의 서약"
set: ZEN
number: 8
mana_cost: "{2}{W}{W}{W}"
type_line: "Sorcery"
rarity: rare
artist: "Kev Walker"
scryfall: https://scryfall.com/card/zen/8/conquerors-pledge
added: 2026-09-30
entities: [spl-conquerors-pledge, cre-kor-soldier, loc-ondu, law-retainers]
---

## 카드 원문

**규칙 텍스트**

> Kicker {6} (You may pay an additional {6} as you cast this spell.)
> Create six 1/1 white Kor Soldier creature tokens. If this spell was kicked, create twelve of those tokens instead.

**플레이버 텍스트**

> (없음)

## 해석

- 바람 부는 모래빛 들판, 푸른 옷의 코르 여인 앞에 흰 머리의 코르 전사들이 엎드려 서약한다 [그림]. 백색 집중마법, {2}{W}{W}{W}, 킥커 {6} [카드].
- 배우는 주문, 온두에서 [결정]. 대상 없이 시전자의 것.
- 코르 병사 여섯(킥커면 열둘)이 시전자의 권속으로 태어난다. 주인을 따르고, 주인이 죽으면 각자 살아간다 [결정].
- 마나 킥커를 새로 넣는다 (지금까지는 권속을 탭하는 킥커뿐).

## 반영 내역

- `spl-conquerors-pledge` (새 주문): 온두에서 배움, `target: self`, `kicker: { mana: "{6}" }`, 효과 `create_retainers`.
- `cre-kor-soldier` (새 생물종, 개체 없음): 코르 병사.
- `loc-ondu`, `law-retainers`: 연결.
- 엔진: 대상 없는 주문(`target: self`), 마나 킥커(`kicker.mana`, `addCosts`), 효과 `create_retainers`(토큰이 시전자의 권속으로 태어남).
