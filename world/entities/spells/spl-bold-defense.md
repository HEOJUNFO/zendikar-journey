---
id: spl-bold-defense
kind: spell
name: 대담한 방어
name_en: Bold Defense
summary: 괴물 앞에서 물러서지 않는 원정대의 백색 주문. 시전자와 곁의 권속 모두 자정까지 +1/+1, 마나를 더 부으면 +2/+2와 선제공격
status: canon
sources: [ZEN-3]
tags: [주문, 백색, 순간마법, 원정대]
links:
  - { to: law-mana-colors, rel: 백색 마법 }
  - { to: loc-kabira-crossroads, rel: 배우는 곳 }
  - { to: law-retainers, rel: 당신이 조종하는 생물 }
sim:
  cost: "{2}{W}"
  speed: instant
  learn_at: loc-kabira-crossroads   # [결정] 2026-10-01: 길이 모이는 백색 도시, 원정대와 나그네 [가공]
  learn_hours: 4
  target: self             # 대상 없음: 시전자와 곁의 권속
  kicker: { mana: "{3}{W}" }   # [카드] 킥커 {3}{W}
  effects:
    - { type: pump_controlled, pt: [1, 1], kicked: { pt: [2, 2], abilities: [first_strike] } }
---

## 설정

원정대원들이 비명을 지르며 물러서는 앞에, 뿔 돋친 거대한 애벌레 같은 괴물이 아가리를 벌린다. 흰 빛줄기가 괴물을 막아선다 ([그림]). 백색 마법이다 ([카드] {2}{W}, 순간마법).

## 게임에서의 역할

- 자리: 아게딤 섬의 카비라 교차로(`loc-kabira-crossroads`)에서 4시간 들여 배운다 ([결정] 2026-10-01: 길이 모이고 갈라지는 백색 도시, 원정대와 나그네의 주문 [가공]).
- 값 {2}{W}. 대상이 없다: 시전자의 것이다 (`target: self`). NPC는 시전을 마치면 곧바로 쓴다.
- **효과** (`pump_controlled`, [카드] 당신이 조종하는 생물들): 시전자와 **같은 칸의** 그의 권속 모두가 자정까지 +1/+1 ([결정] 2026-10-01: 곁의 이들만, 턴 끝 = 자정).
- **킥커 {3}{W}** ([카드]): 대신 +2/+2와 선제공격. 플레이어는 단추로, NPC는 치를 수 있으면 치른다.
