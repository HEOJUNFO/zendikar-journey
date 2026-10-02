---
id: ZEN-4
order: 178
name_en: "Brave the Elements"
name_ko: "원소를 무릅쓰고"
set: ZEN
number: 4
mana_cost: "{W}"
type_line: "Instant"
rarity: uncommon
artist: "Goran Josic"
scryfall: https://scryfall.com/card/zen/4/brave-the-elements
added: 2026-10-02
entities: [spl-brave-the-elements, loc-sejiri-refuge]
---

## 카드 원문

**규칙 텍스트**

> Choose a color. White creatures you control gain protection from the chosen color until end of turn.

**플레이버 텍스트**

> "Trust me, your lost fingers and toes are nothing compared to the lost treasures of Sejiri."
> —Zahr Gada, Halimar expedition leader

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 순간마법 {W}. 색 하나를 골라, 당신이 조종하는 백색 생물들이 턴 끝까지 그 색으로부터 보호를 얻는다. [카드]
- 플레이버: 잃은 손발가락은 세지리의 잃어버린 보물에 비하면 아무것도 아니다 — 할리마르 원정대장 자흐 가다. [카드]
- 눈보라와 원소의 폭풍을 밧줄을 붙들고 거슬러 가는 원정대원. [그림]
- 지명 확인: 세지리·세지리 피난처는 세계에 있음. [새 지역 후보] 없음.
- 배우는 곳: 세지리 피난처. [결정] 2026-10-02
- 당신이 조종하는 백색 생물 = 시전자와 같은 칸의 자신과 권속 가운데 백색인 이들. 색은 한 시간 뒤 시전자가 고름. 보호는 카비라 전도사의 설교와 같음. [가공]

## 반영 내역

- `spl-brave-the-elements` (새 주문): 세지리 피난처에서 4시간, {W}, 순간마법, `target: self`, `brave`.
- `loc-sejiri-refuge`, `chr-kabira-evangel`: 링크.
- 새 주문 효과 `brave` (`sim/allies.ts` 의 `applyBrave`, 고를 것 `brave`).
