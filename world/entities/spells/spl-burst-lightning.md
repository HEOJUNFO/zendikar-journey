---
id: spl-burst-lightning
kind: spell
name: 터지는 번개
name_en: Burst Lightning
summary: 섀터스컬 고개의 검은 절벽에서 배우는 적색 순간마법. 손끝에서 번개를 터뜨려 누구에게든 내리꽂고, 힘을 더 모으면 갑절로 내리친다
status: canon
sources: [ZEN-119]
tags: [주문, 적색, 순간마법, 피해, 킥커]
links:
  - { to: law-mana-colors, rel: 적색 마법 }
  - { to: loc-shatterskull-pass, rel: 배우는 곳 (번개가 내리치는 검은 절벽) }
sim:
  cost: "{R}"
  speed: instant
  learn_at: loc-shatterskull-pass   # [결정] 2026-10-02: 그림의 번개 맞는 높은 바위 절벽 [가공]
  learn_hours: 4
  target: other_here       # 같은 칸의 다른 하나 (생물이나 플레이어)
  kicker: { mana: "{4}" }  # [카드] 킥커 {4}
  effects:
    - { type: damage, amount: 2, any: true, kicked_amount: 4 }   # [카드] 아무 대상에게 피해 2, 킥커면 4
---

## 설정

거대한 바위 기둥에 하늘에서 번개가 여러 갈래로 내리꽂히고, 그 아래 협곡을 원정대가 지나간다 ([그림]). 적색 순간마법이다 ([카드]).

## 게임에서의 역할

- 자리: 아쿰의 이빨 안 섀터스컬 고개(`loc-shatterskull-pass`)에서 4시간 들여 배운다 ([결정] 2026-10-02, [가공]). 플레이어도 NPC도.
- 값 {R} (적 하나). 킥커 {4}(마나 4 더, 플레이어는 단추로 고르고 NPC는 치를 수 있으면 치른다). 순간마법이라 싸움 중에도 쓴다. 같은 칸의 다른 하나에게 건다. 해로운 주문이다.
- **번개** (`damage: 2, any, kicked_amount: 4`, [카드] 아무 대상에게 피해 2, 킥커면 4): 누구에게든 (플레인즈워커면 기세에서). 주문이라 NPC끼리도 죽일 수 있다.
- 쓴 뒤에는 마나 값만큼(1시간) 다시 쓸 수 없다 (사용함).
