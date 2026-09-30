---
id: spl-conquerors-pledge
kind: spell
name: 정복자의 서약
name_en: Conqueror's Pledge
summary: 코르 전사들을 불러 모아 시전자에게 충성을 서약하게 하는 백색 주문. 마나를 더 치르면 두 배의 전사가 모인다
status: canon
sources: [ZEN-8]
tags: [주문, 백색, 코르, 집중마법]
links:
  - { to: cre-kor-soldier, rel: 불러 모으는 병사 }
  - { to: law-retainers, rel: 병사들이 권속이 됨 }
  - { to: law-mana-colors, rel: 백색 마법 }
  - { to: loc-ondu, rel: 배우는 곳 }
sim:
  cost: "{2}{W}{W}{W}"
  speed: sorcery
  learn_at: loc-ondu       # [결정] 2026-09-30
  learn_hours: 4
  target: self             # 대상 없음: 시전자의 것
  kicker: { mana: "{6}" }  # [카드] 킥커 {6}
  effects:
    - { type: create_retainers, creature: cre-kor-soldier, count: 6, kicked_count: 12, pt: [1, 1], colors: [W] }
---

## 설정

바람 부는 모래빛 들판에 흰 머리칼의 코르 여인이 푸른 옷을 휘날리며 서 있고, 흰 머리의 코르 전사들이 그 앞에 엎드려 충성을 서약한다 ([그림]). 정복자에게 바치는 서약이다 ([카드] 이름).

## 게임에서의 역할

- 자리: 백색 평원 대륙 온두(`loc-ondu`)에서 4시간 들여 배운다 ([결정] 2026-09-30).
- 값 {2}{W}{W}{W} (마나 5, 백 셋). 대상이 없다: 시전자 자신의 주문이다 (`target: self`).
- **효과**: 1/1 백색 코르 병사 **여섯**이 시전자 곁에 태어나 그의 권속이 된다 (`create_retainers`).
- **킥커 {6}** ([카드]): 마나 6을 더 치르면(모두 마나 11) 병사가 **열둘**이다. 마나로 치르는 첫 킥커다.
  - 플레이어는 "킥커" 단추로 고른다. NPC는 시전을 마칠 때 치를 수 있으면 치른다.
- 병사들은 토큰이라 주인의 하루를 따르고(LLM 비용 없음), 주인의 싸움에 함께 덤빈다. 주인이 죽거나 떠나면 각자 LLM이 짜는 하루를 산다 ([결정]).
- 권속이 여섯 이상 붙으면 온두의 화살 세례 함정(넷 이상이 덤빌 때)을 깨우기 쉽다.

## 미정/질문

- 마나 11은 지금 세계에서 모으기 어렵다 (땅 하나에 마나 1). 킥커는 땅을 많이 쥔 이의 몫이다.
