---
id: spl-shieldmates-blessing
kind: spell
name: 방패동료의 축복
name_en: Shieldmate's Blessing
summary: 마킨디의 코르 방패동료들이 땅에서도 에메리아의 은총을 부르는 백색 순간마법. 한 사람을 빛의 장막으로 감싸 그날 받을 다음 피해 셋을 막는다
status: canon
sources: [ZEN-35]
tags: [주문, 백색, 순간마법, 가호, 에메리아]
links:
  - { to: law-mana-colors, rel: 백색 마법 }
  - { to: loc-makindi, rel: 배우는 곳 (코르 방패동료의 땅) }
  - { to: chr-makindi-shieldmate, rel: 이름의 방패동료 }
  - { to: loc-emeria, rel: 플레이버의 에메리아의 은총 }
  - { to: chr-noble-vestige, rel: 같은 가호 (다음 피해를 막음) }
sim:
  cost: "{W}"
  speed: instant
  learn_at: loc-makindi    # [결정] 2026-10-02: 이름의 방패동료, 땅에 사는 코르 [가공]
  learn_hours: 4
  target: any_here         # 같은 칸의 하나 (자신도, 플레인즈워커도: "아무 대상")
  effects:
    - { type: ward, amount: 3 }   # [카드] 이번 턴 대상이 받을 다음 피해 3을 막는다
---

## 설정

메마른 나무가 선 물가에서, 날개 달린 짐승이 토해 내는 숨결을 빛의 장막이 막아 낸다 ([그림]). 백색 순간마법이다 ([카드]). "땅에 사는 이들도 위급할 때 에메리아의 은총을 부를 수 있다." ([카드] 플레이버, 에메리아의 신조).

## 게임에서의 역할

- 자리: 온두의 마킨디(`loc-makindi`)에서 4시간 들여 배운다 ([결정] 2026-10-02, [가공]). 플레이어도 NPC도.
- 값 {W} (마나 1, 백 하나). 순간마법이라 언제든 쓴다. 같은 칸의 하나(자신도, 플레인즈워커도)에게 건다. 해롭지 않아 적의를 사지 않는다.
- **빛의 장막** (`ward: 3`, [카드] 이번 턴 대상이 받을 다음 피해 3을 막는다): 대상이 자정까지 받을 다음 피해 3을 막는다. 고귀한 잔영의 가호(`Actor.shield`)와 같은 것이라 함께 쌓인다.
- 쓴 뒤에는 마나 값만큼(1시간) 다시 쓸 수 없다 (사용함).
