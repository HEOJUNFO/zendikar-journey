---
id: spl-goblin-war-paint
kind: spell
name: 고블린 전투 물감
name_en: Goblin War Paint
summary: 콜리아 열매로 만든 아쿰 고블린의 전투 물감을 바르는 적색 오라. 바른 이는 두려움을 잊고 거세지고 날래진다
status: canon
sources: [ZEN-129]
tags: [주문, 적색, 오라, 고블린]
links:
  - { to: law-mana-colors, rel: 적색 마법 }
  - { to: loc-teeth-of-akoum, rel: 배우는 곳 (고블린 둥지) }
  - { to: chr-tuktuk-grunts, rel: 산비탈 둥지의 고블린 }
sim:
  cost: "{1}{R}"
  speed: sorcery           # 부여마법: 한가할 때만
  learn_at: loc-teeth-of-akoum   # [결정] 2026-10-01: 산비탈의 고블린 둥지
  learn_hours: 4
  target: any_here         # 같은 칸의 누구든 (자신 포함)
  effects:
    - { type: aura, pt: [2, 2], abilities: [haste] }   # [카드] +2/+2, 속공
---

## 설정

붉은 안개 속에서 온몸에 물감을 칠한 고블린이 칼을 치켜들고 함성을 지르며 달려 나가고, 뒤로 고블린 무리가 보인다 ([그림]). "콜리아 열매로 만든 전투 물감은 감각을 날카롭게 하고 두려움을 덜어 준다. 안타깝게도, 보통 목숨을 지켜 주는 건 그 두려움이다" ([카드] 플레이버). 고블린은 아쿰의 산비탈에 둥지를 매단다 ([배경]).

## 게임에서의 역할

- 자리: 아쿰의 이빨(`loc-teeth-of-akoum`)에서 4시간 들여 배운다 ([결정] 2026-10-01: 산비탈의 고블린 둥지).
- 값 {1}{R} (마나 2, 적 하나). 부여마법(오라). 같은 칸의 누구에게나(자신도) 건다. 죽을 때까지 남는다.
- **효과** (`aura: { pt: [2, 2], abilities: [haste] }`, [카드]): +2/+2와 속공(이동 시간 절반).

## 미정/질문

- 콜리아 열매: 그 카드가 나오면.
