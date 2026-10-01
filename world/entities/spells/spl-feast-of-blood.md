---
id: spl-feast-of-blood
kind: spell
name: 피의 향연
name_en: Feast of Blood
summary: 흡혈귀 무리를 거느린 이만 여는 흑색 주문. 무리가 한 사람을 덮쳐 숨을 끊고, 그 피가 시전자를 살찌운다
status: canon
sources: [ZEN-88]
tags: [주문, 흑색, 집중마법, 파괴, 생명, 흡혈귀]
links:
  - { to: law-mana-colors, rel: 흑색 마법 }
  - { to: loc-malakir, rel: 배우는 곳 }
  - { to: cre-vampire, rel: 거느려야 하는 흡혈귀 }
  - { to: chr-sorin-markov, rel: 플레이버의 소린 }
sim:
  cost: "{1}{B}"
  speed: sorcery
  requires: { kind: cre-vampire, count: 2 }   # [카드] 흡혈귀를 둘 이상 조종할 때만
  learn_at: loc-malakir    # [결정] 2026-10-01
  learn_hours: 4
  target: other_here       # 같은 칸의 다른 하나
  effects:
    - { type: destroy_target }           # [카드] 대상 생물을 파괴
    - { type: gain_life, amount: 4 }     # [카드] 당신은 생명 4를 얻는다
---

## 설정

어두운 방에서 붉은 눈의 흡혈귀들이 쓰러진 이를 둘러싸고 있다 ([그림]). "이 세계의 흡혈귀들은 굶주림의 즐거움을 모른다. 맛보지도 않고 배를 채울 뿐" (소린 마르코프, [카드] 플레이버). 말라키르는 굴 드라즈의 흡혈귀 도시다 ([배경]).

## 게임에서의 역할

- 자리: 말라키르(`loc-malakir`)에서 4시간 들여 배운다 ([결정] 2026-10-01).
- 값 {1}{B} (마나 2, 흑 하나). 같은 칸의 다른 하나에게 건다. 해로운 주문이다.
- **쓸 조건** (`requires: { kind: cre-vampire, count: 2 }`, [카드] 흡혈귀를 둘 이상 조종할 때만): 시전자 자신과 그 권속 가운데 흡혈귀(`creature: cre-vampire`)가 둘 이상이어야 쓴다 (배우는 것은 누구나).
- **효과** ([카드]): 대상(플레인즈워커 빼고)을 파괴하고 (`destroy_target`, 흉측한 최후와 같은 대응: 파괴불가·재생이 막는다), 시전자가 생명 4를 얻는다 (`gain_life`).

## 미정/질문

- 없음.
