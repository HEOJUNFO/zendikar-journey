---
id: ZEN-40
order: 128
name_en: "Aether Figment"
name_ko: "에테르 환영"
set: ZEN
number: 40
mana_cost: "{1}{U}"
type_line: "Creature — Illusion"
pt: "1/1"
rarity: uncommon
artist: "Thomas M. Baxa"
scryfall: https://scryfall.com/card/zen/40/aether-figment
added: 2026-10-01
entities: [cre-aether-figment, loc-jwar-isle]
---

## 카드 원문

**규칙 텍스트**

> Kicker {3} (You may pay an additional {3} as you cast this spell.)
> If this creature was kicked, it enters with two +1/+1 counters on it.
> This creature can't be blocked.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 환영, 1/1. 킥커 {3}. 막을 수 없다. 킥커했다면 +1/+1 카운터 둘을 얹고 들어온다. [카드]
- 금빛·분홍빛 에테르 소용돌이 속 촉수 끝에 눈알 달린 푸른 환영. [그림]
- 지명 없음, [새 지역 후보] 없음. 자리: 즈와르 섬 북동쪽 벼랑. [결정] 2026-10-01 (방위는 [가공])
- 말하지 않는 환영 (짐승, 먹지 않음, 모든 짐승처럼 길들임). [가공]
- 막을 수 없다 = 땅걷기·위협과 같은 대응 (맞받아치지 못함, 주인 지키기도 못함, 날아 피하기는 됨). [가공]
- 킥커 카운터 = 매일 첫 도착 때 제 마나로 {3}을 낼 수 있으면 자정까지 +2/+2. [결정] 2026-10-01

## 반영 내역

- `cre-aether-figment` (새 생물종, 한 마리가 산다): 즈와르 섬 `home_pos: [0.3, -0.3]`, 1/1, 마나 청 2, 짐승, `unblockable`, `enter_pump: { pt: [2, 2], kicker: "{3}" }`.
- `loc-jwar-isle`: 링크.
- 새 능력 `unblockable` (`combat.ts` 의 `unblockable`, 권속의 지키기에서도 빠짐), 새 규칙 `enter_pump` (`abilities.ts` 의 `onEnter`).
