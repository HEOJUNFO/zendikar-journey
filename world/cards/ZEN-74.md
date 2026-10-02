---
id: ZEN-74
order: 169
name_en: "Trapmaker's Snare"
name_ko: "함정장이의 올가미"
set: ZEN
number: 74
mana_cost: "{1}{U}"
type_line: "Instant"
rarity: uncommon
artist: "Daarken"
scryfall: https://scryfall.com/card/zen/74/trapmakers-snare
added: 2026-10-02
entities: [spl-trapmakers-snare, loc-jwar-isle, law-ruin-traps]
---

## 카드 원문

**규칙 텍스트**

> Search your library for a Trap card, reveal it, put it into your hand, then shuffle.

**플레이버 텍스트**

> "Trapmaking is an art. The trap is a corporeal riddle, a battle of wits between its creator and whatever it lures inside."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법 {1}{U}. 서고에서 함정 카드 하나를 찾아 공개하고 손에. [카드]
- 플레이버: 함정을 만드는 것은 예술, 만든 이와 꾀여 드는 것 사이의 지혜 겨루기. [카드]
- 빛나는 룬 동심원 위의 검은 옷의 함정장이. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 배우는 곳: 즈와르 섬 (기록보관소 함정이 숨은 비밀의 섬). [결정] 2026-10-02
- 각색 (사용자 제안): 세계의 함정 하나를 무작위로 손에 쥐고, 나중에 선 자리에 그 함정 카드의 마나 비용을 들여 1시간 들여 놓는다. 놓인 함정은 본래 함정과 같은 조건에 누구에게든(놓은 이도) 터지고, 놓은 이는 그 자리를 안다. [결정] 2026-10-02 / [가공]

## 반영 내역

- `spl-trapmakers-snare` (새 주문): 즈와르 섬에서 4시간, {1}{U}, 순간마법, `target: self`, `snare_trap`.
- 함정 사건 14개에 `card_cost`(그 카드의 마나 비용)를 더함.
- `loc-jwar-isle`, `law-ruin-traps`, `spl-trapfinders-trick`: 링크.
- 새 주문 효과 `snare_trap`, 플레이어 행동·NPC 계획 블록 `set_trap` (`sim/snare.ts`: `Actor.traps`, `state.placedTraps`, `withPositions` 가 놓인 함정을 세계의 사건으로 더함, `eventTile` 이 놓인 칸을 씀).
