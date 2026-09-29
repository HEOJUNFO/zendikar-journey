---
id: evt-cobra-trap
kind: event
name: 코브라 함정
name_en: Cobra Trap
summary: 우거진 밀림의 폐허에 도사린 함정. 이 땅이 누군가의 손에 부서지면 코브라 넷이 쏟아져 나와 부순 자를 덮친다
status: canon
sources: [ZEN-160]
tags: [함정, 녹색, 뱀]
links:
  - { to: loc-overgrown-jungle, rel: 도사린 곳 }
  - { to: cre-snake, rel: 쏟아져 나오는 것 }
  - { to: law-ruin-traps, rel: 함정의 한 종류 }
  - { to: law-permanents, rel: 지속물이 부서질 때 }
  - { to: law-mana-colors, rel: 녹색 마법 }
sim:
  region: loc-overgrown-jungle
  trigger: destroyed      # [결정] 밀림에 있는 지속물이 남의 손에 부서질 때
  text: 부서진 밀림의 폐허 깊은 곳에서, 항아리들 사이로 코브라들이 고개를 쳐들었다.
  effects:
    - { type: create, creature: cre-snake, count: 4, pt: [1, 1] }
---

## 설정

우거진 밀림의 폐허에 도사린 함정. 어두운 폐허 바닥에서 코브라들이 고개를 쳐들고, 두건 쓴 탐험가가 그 한가운데 갇혀 있다 ([그림]). 이 땅이 누군가의 손에 부서지면, 폐허를 지키던 뱀들이 쏟아져 나온다 ([카드] "지속물이 상대의 주문이나 능력에 파괴되었다면", "뱀 넷").

## 게임에서의 역할

- 발동 조건 (`trigger: destroyed`, [결정]): 우거진 밀림에 있는 지속물(`law-permanents`)이 남의 주문, 능력, 사건에 부서질 때 반드시 발동한다. 지금 부서질 수 있는 지속물은 밀림 땅 자체다. 부여마법, 마법물체가 생기면 그것도 든다.
- 효과: 1/1 코브라 넷이 밀림에 생긴다 (`create`). 주인 없는 짐승이고, 그날은 땅을 부순 자를 적으로 삼아 덮친다 ([가공]).
- 순간마법이라 전조가 없다. 온전한 값({4}{G}{G})을 치를 주인은 없다.

## 지금 세계에서의 결과

- 땅을 부수는 것은 용암공 함정뿐인데, 그 함정은 하루 두 번째 상륙에 깨어나서 (하루에 한 땅) 아직 발동하지 않는다. 그래서 코브라 함정도 잠들어 있다.
