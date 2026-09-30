---
id: loc-jwar-isle-refuge
kind: location
name: 즈와르 섬 피난처
name_en: Jwar Isle Refuge
summary: 즈와르 섬의 안개 속, 암초를 뚫고 온 배들이 닻을 내리고 몸을 누이는 곳
status: canon
sources: [ZEN-215]
tags: [피난처, 청색, 흑색]
links:
  - { to: loc-jwar-isle, rel: 바깥 지역 }
  - { to: law-life, rel: 들어서면 생명 }
map: { in: loc-jwar-isle, terrain: settlement, color: [U, B], pos: [0, 0.2] }
sim:
  nonbasic: true                          # 이름 있는 대지: 섬이 아니다
  enters_tapped: true                     # [카드] 탭된 채 들어온다
  on_bond:
    - { type: gain_life, amount: 1 }      # [카드] 들어올 때 생명 1
---

## 설정

거친 바다와 암초를 뚫고 즈와르 섬에 닿은 이들이 쉬어 가는 곳이다 ([배경] 피난처, [그림] 섬으로 다가가는 돛배). 오래된 아치 다리 곁 물가에 자리를 잡으면, 파도에 시달린 몸에 기운이 돈다 ([카드] 생명 1).

## 게임에서의 역할

- 즈와르 섬 안의 구역이다 (지형 `settlement`) ([결정] 2026-09-30, 지형은 [가공]).
- **청 또는 흑** 땅 ([카드] {T}: Add {U} or {B}): 유대를 맺으면 하루 마나 1을 얻고, 쓸 때 청이나 흑 중 필요한 쪽이 된다.
- **탭된 채 들어온다** ([카드]): 유대를 맺은 그날은 이 땅의 마나가 나오지 않는다. 다음 날 00:00부터 나온다 (아쿰 피난처와 같다).
- **들어올 때 생명 1** ([카드]): 이 땅과 유대를 맺으면 생명 1을 얻는다. 그날은 생명을 얻은 날이 된다.

## 미정/질문

- 이곳에 누가 머무는지: 관련 카드가 나오면.
