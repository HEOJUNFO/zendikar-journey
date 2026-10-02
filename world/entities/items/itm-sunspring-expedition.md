---
id: itm-sunspring-expedition
kind: item
name: 햇샘 원정
name_en: Sunspring Expedition
summary: 세지리 피난처 옛 유적의 새 석상 샘, 햇샘을 좇는 원정대의 야영지. 새 땅을 밟을 때마다 샘에 가까워지고, 셋이면 원정을 마쳐 샘물로 생명 여덟을 얻는다
status: canon
sources: [ZEN-37]
tags: [부여마법, 원정, 백색, 상륙, 생명]
links:
  - { to: law-permanents, rel: 부여마법 }
  - { to: law-mana-colors, rel: 백색 }
  - { to: law-life, rel: 생명을 얻음 }
  - { to: loc-sejiri-refuge, rel: 서 있는 곳 (유적의 샘) }
  - { to: itm-ior-ruin-expedition, rel: 같은 원정 }
sim:
  card_type: enchantment   # 오라가 아닌 부여마법: 한곳에 서 있다 ([결정] 2026-09-30)
  cost: "{W}"              # 카드 그대로
  at: loc-sejiri-refuge    # [결정] 2026-10-02: 원정대가 쉬어 가는 피난처 [가공]
  pos: [-0.3, -0.3]        # [가공] 피난처 북서쪽, 날개 편 새 석상을 인 옛 샘
  effects:
    - { type: landfall_quest }                    # [카드] 상륙 — 탐색 카운터를 놓을 수 있다
    - { type: expedition, counters: 3, life: 8 }  # [카드] 셋을 떼고 희생: 생명 8을 얻는다
---

## 설정

숲에 둘러싸인 옛 유적에, 날개 편 새 석상을 인 샘이 물을 쏟고 원정대 셋이 그 앞에 서 있다 ([그림]). 백색 부여마법이다 ([카드]).

## 게임에서의 역할

- 서 있는 곳: 세지리의 세지리 피난처(`loc-sejiri-refuge`), 북서쪽 새 석상을 인 옛 샘(`pos: [-0.3, -0.3]`) ([결정] 2026-10-02, 방위는 [가공]). 오라가 아닌 부여마법이라 아이템처럼 한곳에 서 있다. 값 {W}를 치르고 1시간 들여 길들인다.
- **상륙: 탐색** (`landfall_quest`, [카드]): 주인이 땅과 유대를 맺을 때마다 탐색 카운터 하나 (이오르 폐허 원정과 같다, 늘 놓음).
- **햇샘** (`expedition` 의 `life: 8`, [카드] 셋을 떼고 희생: 생명 8): 셋 이상이면 주인이 언제든 어디서든 1시간 들여 마친다 (원정 마치기). 탐색은 사라지고 주인이 생명 8을 얻는다.
