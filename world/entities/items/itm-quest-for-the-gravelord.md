---
id: itm-quest-for-the-gravelord
kind: item
name: 무덤군주 탐색
name_en: Quest for the Gravelord
summary: 아게딤 묘실 깊은 곳, 사령술사들이 번개 아래 시체를 모으는 묘지. 주인이 선 땅에서 죽음이 셋 쌓이면, 시체 덩어리 거인을 일으켜 곁에 둔다
status: canon
sources: [ZEN-108]
tags: [부여마법, 탐색, 흑색, 죽음, 토큰]
links:
  - { to: law-permanents, rel: 부여마법 }
  - { to: law-mana-colors, rel: 흑색 }
  - { to: loc-agadeem-crypt, rel: 서 있는 곳 (묘실의 묘지) }
  - { to: cre-zombie-giant, rel: 일으키는 좀비 거인 }
  - { to: itm-zektar-shrine-expedition, rel: 같은 마치는 법 (토큰) }
sim:
  card_type: enchantment   # 오라가 아닌 부여마법: 한곳에 서 있다 ([결정] 2026-09-30)
  cost: "{B}"              # 카드 그대로
  at: loc-agadeem-crypt    # [결정] 2026-10-02: 죽은 이들의 땅, 묘실의 묘지 [가공]
  pos: [-0.3, 0.3]         # [가공] 묘실 남서쪽, 번개 치는 묘지
  effects:
    - { type: death_quest }   # [카드] 생물이 죽을 때마다 탐색 카운터를 놓을 수 있다
    - { type: expedition, counters: 3, token: { creature: cre-zombie-giant, pt: [5, 5], colors: [B] } }   # [카드] 셋을 떼고 희생: 5/5 흑색 좀비 거인 토큰
---

## 설정

번개 치는 묘지에서 시체들이 엉겨 붙은 거대한 좀비가 일어서고, 뒤에서 지팡이를 든 사령술사들이 불러낸다 ([그림]). 흑색 부여마법이다 ([카드]).

## 게임에서의 역할

- 서 있는 곳: 아게딤의 아게딤 묘실(`loc-agadeem-crypt`), 남서쪽 번개 치는 묘지(`pos: [-0.3, 0.3]`) ([결정] 2026-10-02, 방위는 [가공]). 오라가 아닌 부여마법이라 아이템처럼 한곳에 서 있다. 값 {B}를 치르고 1시간 들여 길들인다.
- **죽음의 탐색** (`death_quest`, [카드] 생물이 죽을 때마다 탐색 카운터를 놓을 수 있다, `sim/bloodchief.ts` 의 `gravelordHour`): 주인이 선 땅(구역 포함)에서 누가 죽을 때마다(주인 자신 빼고; 기절, 토큰이 사라짐, 플레인즈워커가 떠남은 죽음이 아니다) 탐색 카운터 하나 ([결정] 2026-10-02). 매시간 센다. 해로울 게 없어 늘 놓는다 ([가공]).
- **무덤군주** (`expedition` 의 `token`, [카드] 셋을 떼고 희생: 5/5 흑색 좀비 거인 토큰): 셋 이상이면 주인이 언제든 어디서든 1시간 들여 마친다 (원정 마치기, 젝타르 성소 원정과 같은 틀). 탐색은 사라지고 좀비 거인(`cre-zombie-giant`, 5/5, 흑색)이 주인 곁에 일어나 권속으로 섬긴다. 자정에 사라지지 않는다.
