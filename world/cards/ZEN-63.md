---
id: ZEN-63
order: 42
name_en: "Sea Gate Loremaster"
name_ko: "바다 관문의 전승술사"
set: ZEN
number: 63
mana_cost: "{4}{U}"
type_line: "Creature — Merfolk Wizard Ally"
pt: "1/3"
rarity: rare
artist: "Dave Kendall"
scryfall: https://scryfall.com/card/zen/63/sea-gate-loremaster
added: 2026-09-30
entities: [chr-sea-gate-loremaster, loc-sea-gate, loc-tazeem, law-allies]
---

## 카드 원문

**규칙 텍스트**

> {T}: Draw a card for each Ally you control.

**플레이버 텍스트**

> "He's a living library. He remembers everything our band of explorers has seen, and we can use that to our advantage."
> —Zahr Gada, Halimar expedition leader

## 해석

- 푸른 비늘의 늙은 인어 마법사가 두루마리를 펼쳐 들고 등에 두루마리 통을 졌다. 어깨의 새, 뒤의 원정대원들 [그림]. 청색 인어 마법사 동료, 1/3 [카드].
- "살아 있는 서고" — 할리마르 원정대장 자르 가다 [카드 플레이버]. 바다 관문 = 타짐 해안, 할리마르 어귀의 항구 도시 [배경].
- 타짐 안에 바다 관문(기본 섬) 구역을 더해 산다 [결정] (사용자 요청). 50코인 고용 + 설득 [결정].
- {T}: 동료마다 뽑기 → 조종하는 이가 쓰는 힘, 그는 00:00까지 묶이고 쓴 이가 동료 수만큼 세계의 비밀을 알게 됨 [카드][결정] (뽑기 = 비밀을 앎, 사용자 결정 2026-09-30).

## 반영 내역

- `chr-sea-gate-loremaster` (새 인물): 바다 관문, 1/3, 청 5, 동료, 50코인 용병, `tap_draw_allies`.
- `loc-sea-gate` (새 구역): 타짐 안, 기본 섬 (지형 `beach`, 청 마나).
- `loc-tazeem`, `law-allies`: 연결.
- 엔진: `sim/loremaster.ts` (`recall`, `recallBlocked`, `drawSpells`), 행동·계획 블록 `recall`, 웹 "기억 빌리기" 단추.
