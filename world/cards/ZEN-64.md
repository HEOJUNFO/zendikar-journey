---
id: ZEN-64
order: 43
name_en: "Seascape Aerialist"
name_ko: "해경 비행술사"
set: ZEN
number: 64
mana_cost: "{4}{U}"
type_line: "Creature — Merfolk Wizard Ally"
pt: "2/3"
rarity: uncommon
artist: "Andrew Robinson"
scryfall: https://scryfall.com/card/zen/64/seascape-aerialist
added: 2026-09-30
entities: [chr-seascape-aerialist, loc-silundi-coast, loc-silundi-sea, law-allies]
---

## 카드 원문

**규칙 텍스트**

> Whenever this creature or another Ally you control enters, you may have Ally creatures you control gain flying until end of turn.

**플레이버 텍스트**

> "The sky is like another sea. It teems with currents, life, and endless possibility."

## 해석

- 노란 하늘 아래 모래빛 땅에서 지팡이를 든 인어 마법사가 바람의 물결을 부린다 [그림]. 청색 인어 마법사 동료, 2/3 [카드].
- "하늘은 또 하나의 바다" [카드 플레이버].
- 실룬디 바다 안에 실룬디 연안(기본 섬) 구역을 더해 산다. 연안과 바다는 한 지역으로 친다 [결정] (사용자 요청). 50코인 고용 + 설득 [결정].
- 동료가 들 때 무리의 동료(`ally`) 모두 00:00까지 비행, 대상 없이 늘 [카드][결정].

## 반영 내역

- `chr-seascape-aerialist` (새 인물): 실룬디 연안, 2/3, 청 5, 동료, 50코인 용병, `rally: grant_allies fly`.
- `loc-silundi-coast` (새 구역): 실룬디 바다 안, 기본 섬 (지형 `beach`).
- `loc-silundi-sea`, `law-allies`: 연결.
- 엔진: 무리 발동 `grant_allies`, 바다 지역 안의 뭍 구역 허용 (`world.ts`).
