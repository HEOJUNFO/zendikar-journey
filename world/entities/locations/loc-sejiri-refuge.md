---
id: loc-sejiri-refuge
kind: location
name: 세지리 피난처
name_en: Sejiri Refuge
summary: 세지리의 얼음 절벽 틈에 숨은 작은 쉼터. 눈보라 속에서 따뜻한 불빛이 새어 나온다
status: canon
sources: [ZEN-224]
tags: [피난처, 얼음, 백색, 청색]
links:
  - { to: loc-sejiri, rel: 바깥 지역 }
  - { to: law-life, rel: 들어서면 생명 }
map: { in: loc-sejiri, terrain: settlement, color: [W, U], pos: [0, 0.1] }
sim:
  nonbasic: true                          # 이름 있는 대지
  enters_tapped: true                     # [카드] 탭된 채 들어온다
  on_bond:
    - { type: gain_life, amount: 1 }      # [카드] 들어올 때 생명 1
---

## 설정

눈보라가 몰아치는 얼음 절벽, 비스듬히 겹친 얼음판들 사이에 작은 쉼터가 숨어 있다. 그 틈에서 따뜻한 불빛이 새어 나온다 ([그림]).

얼음 땅을 건너는 이들이 몸을 녹이는 곳이다 ([배경] 피난처). 이곳에 자리를 잡으면 언 몸에 기운이 돈다 ([카드] 생명 1).

## 게임에서의 역할

- 세지리 안의 구역이다 (지형 `settlement`) ([결정] 2026-09-30).
- **백 또는 청** 땅 ([카드] {T}: Add {W} or {U}): 유대를 맺으면 하루 마나 1을 얻고, 쓸 때 백이나 청 중 필요한 쪽이 된다.
- **탭된 채 들어온다** ([카드]): 유대를 맺은 그날은 이 땅의 마나가 나오지 않는다 (아쿰 피난처와 같다).
- **들어올 때 생명 1** ([카드]): 이 땅과 유대를 맺으면 생명 1을 얻는다.

## 미정/질문

- 이곳에 누가 머무는지: 관련 카드가 나오면.
