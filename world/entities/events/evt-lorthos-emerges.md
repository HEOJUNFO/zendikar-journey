---
id: evt-lorthos-emerges
kind: event
name: 로르토스의 출현
name_en: Lorthos Emerges
summary: 로르토스가 심해에서 떠올라 조수를 뒤흔들고, 해안의 최대 여덟을 붙잡는다
status: canon
sources: [ZEN-53]
tags: [바다, 조수, 청색]
links:
  - { to: chr-lorthos, rel: 일으키는 존재 }
  - { to: loc-deepwater-realm, rel: 떠오르는 곳 }
sim:
  region: loc-deepwater-realm
  range: 20             # 심해에서 이 거리 안의 땅이 "해안"이다
  trigger: gm
  chance: 0.03          # LLM 없이 굴릴 때 하루 확률
  cooldown_hours: 168
  scope: world
  omen: 서쪽 하늘이 어두워지고, 바다가 이상하게 부풀어 오른다.
  text: 로르토스가 심해에서 떠올랐다. 조수가 그의 뜻대로 해안을 덮친다.
  effects:
    - { type: bind, max: 8, until: next-morning }
    - { type: condition, label: 조수에 잠긴 해안, hours: 12, blocks_travel: true }
---

## 설정

로르토스가 심해의 영역에서 떠오르는 일. 하늘이 어두워지고 바다가 부풀어 오른다. 조수가 그의 뜻대로 해안을 덮친다. 그의 촉수는 해안에 있던 것을 최대 여덟까지 붙잡아, 다음 날이 올 때까지 놓아주지 않는다.

## 게임에서의 역할

GM 사건 시스템이 생기면 넣는다. 설계:

- 발동: 드물게, GM이 일으킨다. 폭풍이나 이상한 조수가 전조로 온다.
- 효과 1 (조수): 해안 타일(모래사장, 검은 모래)이 한동안 물에 잠겨 지나갈 수 없다.
- 효과 2 (속박): 해안에 있던 NPC와 플레이어 중 최대 8명이 다음 게임일 아침까지 움직이지 못한다. 그날 일정은 멈춘다.
- 공중섬(에메리아)의 가장자리는 바다에 닿지 않으므로 영향이 없다.

## 미정/질문

- 로르토스를 달래거나 물리칠 방법이 있는지.
