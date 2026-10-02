---
id: itm-zektar-shrine-expedition
kind: item
name: 젝타르 성소 원정
name_en: Zektar Shrine Expedition
summary: 섀터스컬 고개 높은 곳, 정령이 들끓는 젝타르 성소를 찾아 나선 원정대의 자리. 새 땅을 밟을 때마다 탐색이 쌓이고, 셋이면 성소의 불길에서 거대한 불의 정령이 솟구쳐 하루 동안 섬긴다
status: canon
sources: [ZEN-155]
tags: [부여마법, 원정, 적색, 탐색, 상륙, 정령]
links:
  - { to: law-permanents, rel: 부여마법 }
  - { to: law-mana-colors, rel: 적색 }
  - { to: loc-shatterskull-pass, rel: 서 있는 곳 (검은 돌 산맥 높은 곳의 성소) }
  - { to: cre-fire-elemental, rel: 불러내는 불의 정령 }
  - { to: itm-ior-ruin-expedition, rel: 같은 원정 }
sim:
  card_type: enchantment   # 오라가 아닌 부여마법: 한곳에 서 있다 ([결정] 2026-09-30)
  cost: "{1}{R}"           # 카드 그대로
  at: loc-shatterskull-pass   # [결정] 2026-10-02: "검은 돌의 섀터스컬 산맥 높은 곳" [배경], 이 세계의 섀터스컬 고개 [가공]
  pos: [0.3, -0.6]         # [가공] 고개 북동쪽 높은 곳, 붉은 불길이 솟는 바위 제단 (젝타르 성소)
  effects:
    - { type: landfall_quest }                    # [카드] 상륙 — 탐색 카운터를 놓을 수 있다
    - { type: expedition, counters: 3, token: { creature: cre-fire-elemental, pt: [7, 1], colors: [R], abilities: [trample, haste], until_midnight: true } }   # [카드] 탐색 카운터 셋을 떼고 희생: 7/1 돌진·속공 적색 정령 토큰, 다음 종료 단계에 추방
---

## 설정

어두운 산맥 높은 곳의 바위 제단에서 붉은 수정 같은 불길이 하늘로 솟구치고, 탐험가 둘이 그 아래에서 올려다본다 ([그림]). 적색 부여마법이다 ([카드] {1}{R}). 젝타르 성소는 정령이 들끓는 성소로, 검은 돌의 섀터스컬 산맥 높은 곳에 있다 ([배경] Savor the Flavor "The Moment of Discovery", 2009). 어느 대륙인지는 설정마다 다르다: 2009년 안내서의 섀터스컬은 무라사, 이후 설정과 이 세계는 아쿰이다 ([배경]/[가공]).

## 게임에서의 역할

- 서 있는 곳: 아쿰의 이빨 안 섀터스컬 고개(`loc-shatterskull-pass`), 북동쪽 높은 곳의 바위 제단 (`pos: [0.3, -0.6]`, [결정] 2026-10-02: 성소는 지역으로 만들지 않고 그 칸의 자리로, 방위는 [가공]). 오라가 아닌 부여마법이라 아이템처럼 한곳에 서 있다. 값 {1}{R}를 치르고 1시간 들여 길들인다.
- **상륙: 탐색 카운터** (`landfall_quest`, [카드]): 이오르 폐허 원정과 같다. 주인이 땅과 유대를 맺을 때마다 카운터 하나.
- **성소의 불길** (`expedition` 의 `token`, [카드] 탐색 카운터 셋을 떼고 희생: 7/1 돌진·속공 적색 정령 토큰, 다음 종료 단계에 추방): 카운터가 셋 이상이면 주인이 언제든 어디서든 1시간 들여 마친다 (원정 마치기). 원정은 사라지고, 불의 정령(`cre-fire-elemental`, 7/1, 돌진·속공, 적색)이 주인 곁에 솟구쳐 권속으로 섬기다가 자정에 사라진다 (정령의 부름과 같은 정령).
