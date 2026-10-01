---
id: spl-slaughter-cry
kind: spell
name: 살육의 함성
name_en: Slaughter Cry
summary: 목청껏 내지르는 함성으로 한 사람의 피를 끓게 하는 적색 순간마법. 그날 하루 그의 일격은 더 세고 누구보다 먼저 떨어진다
status: canon
sources: [ZEN-149]
tags: [주문, 적색, 순간마법, 강화, 선제공격]
links:
  - { to: law-mana-colors, rel: 적색 마법 }
  - { to: loc-tangled-vale, rel: 배우는 곳 (조라가 음유시인의 이야기) }
  - { to: chr-joraga-bard, rel: 플레이버의 조라가 음유시인 }
sim:
  cost: "{2}{R}"
  speed: instant
  learn_at: loc-tangled-vale   # [결정] 2026-10-01: 플레이버의 조라가 음유시인 니코우
  learn_hours: 4
  target: any_here         # 같은 칸의 생물 하나 (자신 포함, 플레인즈워커 빼고)
  effects:
    - { type: pump_target, pt: [3, 0], abilities: [first_strike] }   # [카드] 턴 끝까지 +3/+0, 선제공격
---

## 설정

붉은 황무지에서 창을 든 고블린이 눈을 부릅뜨고 비명을 지르며 뛰어든다 ([그림]). "언제부터 '으아아아!'가 협상 전술이 된 거지?" 조라가 음유시인 니코우의 말이다 ([카드] 플레이버). 함성 하나로 싸움을 시작하는 고블린들의 이야기를, 엘프 음유시인들은 노래로 비웃는다 ([가공]).

## 게임에서의 역할

- 자리: 탱글드 베일(`loc-tangled-vale`)에서 4시간 들여 배운다 ([결정] 2026-10-01: 플레이버의 조라가 음유시인).
- 값 {2}{R} (마나 3, 적 하나). 순간마법이라 싸움 중에도 쓴다. 같은 칸의 생물 하나(자신도)에게 건다. 플레인즈워커는 생물이 아니라 고를 수 없다.
- **효과** (`pump_target`, [카드] 턴 끝까지 +3/+0, 선제공격): 대상이 00:00까지 공격력 +3과 선제공격(`first_strike`: 먼저 쳐서 쓰러뜨리면 되받아치지 못함)을 얻는다. 원래 선제공격을 지닌 이는 그대로.

## 미정/질문

- 니코우 자신: 조라가 음유시인(`chr-joraga-bard`)이 그일지도 모른다.
