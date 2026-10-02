---
id: ZEN-87
order: 182
name_en: "Disfigure"
name_ko: "흉터 새기기"
set: ZEN
number: 87
mana_cost: "{B}"
type_line: "Instant"
rarity: common
artist: "Justin Sweet"
scryfall: https://scryfall.com/card/zen/87/disfigure
added: 2026-10-02
entities: [spl-disfigure, loc-ghet-estate]
---

## 카드 원문

**규칙 텍스트**

> Target creature gets -2/-2 until end of turn.

**플레이버 텍스트**

> "Brave scar or unfortunate tale? It all depends on your pain threshold."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 순간마법 {B}: 대상 생물 하나가 이번 턴 -2/-2. [카드]
- 플레이버: 용감한 흉터인가 불행한 사연인가, 고통을 견디는 정도에 달렸다. [카드]
- 창백하고 손톱이 검은 손이 노란 얼굴을 할퀴어 붉은 상처를 낸다. 흡혈귀의 손으로 본다. [그림] / [가공]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 배우는 곳: 게트 혈족의 영지 (흉터로 서열을 새기는 흡혈귀 귀족). [결정] 2026-10-02, [가공]
- 대상 = 같은 칸의 다른 하나(플레이어도, 플레인즈워커 빼고). 이번 턴 = 자정까지. 방어력이 0 이하나 상처에 닿으면 죽음(주문이라 NPC끼리도). [가공] (대응 표)

## 반영 내역

- `spl-disfigure` (새 주문): 게트 혈족의 영지에서 4시간, {B}, 순간마법, `weaken_target` -2/-2.
- `loc-ghet-estate`: 가르치는 주문 링크.
- 새 효과 `weaken_target` (`sim/spells.ts`, 늪지의 사상자의 `weaken_controlled` 와 같은 틀로 대상 하나만).
