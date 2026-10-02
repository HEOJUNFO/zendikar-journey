---
id: law-permanents
kind: law
name: 지속물
name_en: Permanents
summary: 세계에 남아 누군가에게 속한 것들. 땅, 걸어 둔 마법, 마법 물건, 그리고 인물
status: canon
sources: [ZEN-160, ZEN-200, ZEN-86, ZEN-199, ZEN-179, ZEN-39, ZEN-48, ZEN-49, ZEN-14, ZEN-167, ZEN-25, ZEN-143, ZEN-177, ZEN-70, ZEN-208, ZEN-155]
tags: [규칙]
links:
  - { to: cre-world-queller, rel: 새벽마다 지속물을 희생시킴 }
  - { to: itm-eldrazi-monument, rel: 마법물체 }
  - { to: spl-desecrated-earth, rel: 땅을 부수는 주문 }
  - { to: evt-cobra-trap, rel: 지속물이 부서질 때 }
  - { to: itm-eternity-vessel, rel: 마법물체 }
  - { to: itm-ior-ruin-expedition, rel: 부여마법 }
  - { to: itm-zektar-shrine-expedition, rel: 부여마법 }
  - { to: itm-trailblazers-boots, rel: 마법물체 (장비) }
  - { to: spl-spreading-seas, rel: 땅에 붙는 오라 }
  - { to: itm-quest-for-the-gemblades, rel: 부여마법 }
  - { to: itm-pyromancer-ascension, rel: 부여마법 }
  - { to: itm-luminarch-ascension, rel: 부여마법 }
  - { to: itm-khalni-heart-expedition, rel: 부여마법 }
  - { to: spl-journey-to-nowhere, rel: 시전자가 지닌 부여마법 }
  - { to: spl-into-the-roil, rel: 땅이 아닌 지속물을 되돌리는 주문 }
---

## 설정

세계에는 한 번 생기면 남아 있는 것들이 있다. 누군가와 유대를 맺은 땅, 누군가에게 걸어 둔 마법, 마법 물건, 그리고 살아 있는 이들. 카드는 이것들을 지속물이라 부른다 ([카드] "noncreature permanent").

## 게임에서의 역할

- 지속물 ([결정] 2026-09-30):
  - 땅 (지역, 구역). 유대를 맺은 이의 것.
  - 부여마법 (오라, 예: 천상의 망토). 건 이의 것. 없애는 효과는 아직 없다.
  - 마법물체 (아이템, `world/entities/items`, 예: 영원의 그릇). 한곳에 서 있고, 값을 치르고 길들인 이의 것. 주인이 죽거나 떠나면 다시 주인 없는 것이 된다 ([가공]).
  - 생물 (인물, 권속). "생물 아닌 지속물"은 이것을 뺀 나머지다.
- 플레인즈워커는 지속물이 아니다 ([결정]).
- 지속물이 부서지는 것에 답하는 사건: `trigger: destroyed` (그 땅에 있는 지속물이 남의 손에 부서질 때). 지금은 땅 파괴만 있다.

## 미정/질문

- 오라를 벗기거나 마법물체를 부수는 카드가 나오면 `destroyed` 사건이 그것도 보게 한다.
