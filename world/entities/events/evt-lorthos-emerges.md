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
  chance: 0.03          # GM이 참고하는 빈도: 한 달에 한 번꼴
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

frontmatter `sim` 으로 게임에 들어가 있다.

- 발동 (`trigger: gm`): GM이 아침마다 오늘 일으킬지 정한다. 한 달에 한 번꼴을 기준으로 삼는다. 한 번 일어나면 7일 동안은 다시 일어나지 않는다.
- 전조: 1시간 전에 서쪽 하늘이 어두워지고 바다가 부풀어 오른다. 온 세상이 이 소식을 듣는다 (`scope: world`).
- 해안: 심해의 영역에서 지도 거리 20 안에 있는 땅이다 (`range: 20`). 지금은 해안에 해당하는 지역이 없다.
- 효과 1 (속박): 해안에 있던 인물 중 최대 8명이 다음 날 아침 6시까지 움직이지 못한다. 그날 일정은 멈춘다.
- 효과 2 (조수): 해안이 12시간 동안 "조수에 잠긴 해안" 상태가 되어 오갈 수 없다.
- 공중섬(에메리아)은 바다에서 멀어 영향을 받지 않는다.

## 미정/질문

- 로르토스를 달래거나 물리칠 방법이 있는지.
