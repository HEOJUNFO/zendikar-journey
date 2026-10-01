---
id: spl-mind-sludge
kind: spell
name: 정신 오물
name_en: Mind Sludge
summary: 대상의 머릿속을 검은 오물로 게워 내게 하는 흑색 주문. 시전자가 쥔 늪이 많을수록 더 많은 주문을 잊게 한다
status: canon
sources: [ZEN-102]
tags: [주문, 흑색, 집중마법, 늪]
links:
  - { to: loc-ghet-estate, rel: 배우는 곳 }
  - { to: chr-kalitas, rel: 생각을 지키라 한 이 }
  - { to: law-mana-colors, rel: 흑색 마법 }
sim:
  cost: "{4}{B}"
  speed: sorcery
  learn_at: loc-ghet-estate  # [결정] 2026-09-30
  learn_hours: 4
  target: other_here
  effects:
    - { type: discard_per_land, land: swamp }
---

## 설정

화려한 갑옷을 입은 사내의 입에서 검은 오물이 연기처럼 뿜어져 나온다. 뒤편 어둠에 무언가의 얼굴이 도사린다 ([그림]). 머릿속의 것을 게워 내게 하는 흑색 주문이다 ([카드]). "생각을 지켜라. 누가 그것을 앗아가려 할지 모르니." 게트의 혈족장 칼리타스의 말이다 ([카드] 플레이버).

## 게임에서의 역할

- 자리: 칼리타스의 거처 게트 혈족의 영지(`loc-ghet-estate`)에서 4시간 들여 배운다 ([결정] 2026-09-30, 플레이버의 칼리타스).
- 값 {4}{B} (마나 5, 흑 하나). 같은 곳의 다른 한 사람에게 건다. 해로운 주문이라 맞은 이는 시전자를 적으로 삼는다.
- **효과** (`discard_per_land`, [카드]): 대상이 시전자가 유대를 맺은 늪(늪 종류, 부서진 것 빼고) 하나마다 주문 하나를 잊는다. 무엇을 잊을지는 잃는 이가 하나씩 고른다 (NPC는 LLM, 플레이어는 고를 것). 지닌 주문이 그 수 이하면 모두 잊는다.
- 늪이 없으면 아무 일도 없다. 지금 세계의 늪: 굴 드라즈, 게트 혈족의 영지, 하그라 저수조.
