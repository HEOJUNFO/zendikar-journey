---
id: itm-soul-stair-expedition
kind: item
name: 영혼 계단 원정
name_en: Soul Stair Expedition
summary: 아게딤 묘실 깊은 곳, 녹빛 혼령이 오르내리는 둥근 구덩이를 좇는 원정대의 야영지. 새 땅을 밟을 때마다 계단이 드러나고, 셋이면 원정을 마쳐 무덤의 죽은 이 둘까지를 되살린다
status: canon
sources: [ZEN-112]
tags: [부여마법, 원정, 흑색, 상륙, 무덤]
links:
  - { to: law-permanents, rel: 부여마법 }
  - { to: law-mana-colors, rel: 흑색 }
  - { to: loc-agadeem-crypt, rel: 서 있는 곳 (혼령의 구덩이) }
  - { to: itm-ior-ruin-expedition, rel: 같은 원정 }
  - { to: spl-grim-discovery, rel: 같은 되살림 (무덤의 생물이 제 거처에서) }
sim:
  card_type: enchantment   # 오라가 아닌 부여마법: 한곳에 서 있다 ([결정] 2026-09-30)
  cost: "{B}"              # 카드 그대로
  at: loc-agadeem-crypt    # [결정] 2026-10-02: 영혼이 오르내리는 지하 묘실 [가공]
  pos: [0.3, -0.4]         # [가공] 묘실 북동쪽, 녹빛 혼령이 솟는 둥근 구덩이
  effects:
    - { type: landfall_quest }                    # [카드] 상륙 — 탐색 카운터를 놓을 수 있다
    - { type: expedition, counters: 3, raise: 2 } # [카드] 셋을 떼고 희생: 무덤의 생물 카드 둘까지 손으로
---

## 설정

어두운 지하 방, 둥근 구덩이 아래에서 녹빛 혼령이 솟구치고 탐험가 둘이 그 가장자리에 서 있다 ([그림]). 흑색 부여마법이다 ([카드]).

## 게임에서의 역할

- 서 있는 곳: 아게딤의 아게딤 묘실(`loc-agadeem-crypt`), 북동쪽 녹빛 혼령이 솟는 둥근 구덩이(`pos: [0.3, -0.4]`) ([결정] 2026-10-02, 방위는 [가공]). 오라가 아닌 부여마법이라 아이템처럼 한곳에 서 있다. 값 {B}를 치르고 1시간 들여 길들인다. 같은 묘실에 무덤군주 탐색이 있다.
- **상륙: 탐색** (`landfall_quest`, [카드]): 주인이 땅과 유대를 맺을 때마다 탐색 카운터 하나 (이오르 폐허 원정과 같다, 늘 놓음).
- **영혼의 계단** (`expedition` 의 `raise: 2`, [카드] 셋을 떼고 희생: 무덤의 생물 카드 둘까지 손으로): 셋 이상이면 주인이 언제든 어디서든 1시간 들여 마친다 (원정 마치기). 탐색은 사라지고, 주인의 생물 무덤(`fallen`)에 든 죽은 이를 하나씩 둘까지 골라 되살린다: 제 거처에서 눈을 뜨고 누구도 섬기지 않는다 (음산한 발견과 같다, 손이 없는 세계라 다시 얻어야 한다). 그만둘 수도 있다. 플레이어는 곧바로, NPC는 한 시간 뒤 LLM이 고른다.
