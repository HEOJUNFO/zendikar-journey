---
id: ZEN-67
order: 201
name_en: "Spell Pierce"
name_ko: "주문 꿰뚫기"
set: ZEN
number: 67
mana_cost: "{U}"
type_line: "Instant"
rarity: common
artist: "Vance Kovacs"
scryfall: https://scryfall.com/card/zen/67/spell-pierce
added: 2026-10-02
entities: [spl-spell-pierce, loc-sea-gate, loc-tazeem]
---

## 카드 원문

**규칙 텍스트**

> Counter target noncreature spell unless its controller pays {2}.

**플레이버 텍스트**

> "There's a hole in your plan."
> —Noyan Dar, Tazeem lullmage

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법 {U}. 대상 비생물 주문을 무효화한다, 그 조종자가 {2}를 내지 않으면. [카드]
- 플레이버: 네 계획엔 구멍이 있어 — 타짐의 진정술사 노얀 다르 (인물로 넣지 않음). [카드]
- 물살 위 덩굴 몸의 마법사가 지팡이로 빛나는 구체를 꿰뚫음. [그림]
- 지명 확인: 타짐 (세계에 있음). [새 지역 후보] 없음.
- 배우는 곳: 바다 관문 (진정술사들의 도시). [결정] 2026-10-02, [가공]
- 취소처럼 반응으로만. 비생물 주문 = 주문 쓰기만 (권속 들이기는 아님). {2}를 냄 = 시전자가 낼 수 있으면 저절로. [가공]

## 반영 내역

- `spl-spell-pierce` (새 주문): 바다 관문에서 4시간, {U}, `counter_spell { noncreature, unless: {2} }`.
- `loc-sea-gate`, `loc-tazeem`, `spl-cancel`: 링크.
- `counter_spell` 에 `noncreature`·`unless` 필드 (`sim/counter.ts`).
