---
id: spl-unstable-footing
kind: spell
name: 불안정한 발판
name_en: Unstable Footing
summary: 섀터스컬 고개의 무너지는 협곡에서 배우는 적색 순간마법. 발밑을 뒤흔들어 그 자리에서는 어떤 가호도 피해를 막지 못하게 하고, 힘을 더 쏟으면 한 사람을 낭떠러지로 내던진다
status: canon
sources: [ZEN-153]
tags: [주문, 적색, 순간마법, 피해, 킥커]
links:
  - { to: law-mana-colors, rel: 적색 마법 }
  - { to: loc-shatterskull-pass, rel: 배우는 곳 (무너지는 협곡) }
  - { to: spl-tanglesap, rel: 막지 못하게 하는 안개 }
  - { to: chr-noble-vestige, rel: 막지 못하게 하는 가호 }
sim:
  cost: "{R}"
  speed: instant
  learn_at: loc-shatterskull-pass   # [결정] 2026-10-02: 그림의 무너지는 붉은 바위 협곡 [가공]
  learn_hours: 4
  target: any_here         # 같은 칸의 하나 (킥커일 때 피해를 받는 이, 플레인즈워커도)
  kicker: { mana: "{3}{R}" }   # [카드] 킥커 {3}{R}
  effects:
    - { type: no_prevent }   # [카드] 이번 턴 피해를 막을 수 없다 → 시전자가 선 칸에서 자정까지 ([결정] 2026-10-02)
    - { type: damage, amount: 5, any: true, if_kicked: true }   # [카드] 킥커 시 대상 플레이어나 플레인즈워커에게 피해 5
---

## 설정

무너지는 붉은 바위 협곡에서 적색 마법사와 전사가 엉켜 떨어진다 ([그림]). 적색 순간마법이다 ([카드]). "먼 길도 떨어지면 생각보다 짧다." ([카드] 플레이버).

## 게임에서의 역할

- 자리: 아쿰의 이빨 안 섀터스컬 고개(`loc-shatterskull-pass`)에서 4시간 들여 배운다 ([결정] 2026-10-02, [가공]). 플레이어도 NPC도.
- 값 {R} (마나 1, 적 하나). 킥커 {3}{R}(마나 4 더). 순간마법이라 언제든 쓴다. 같은 칸의 하나(자신도, 플레인즈워커도)에게 건다.
- **막을 수 없음** (`no_prevent`, [카드] 이번 턴 피해를 막을 수 없다): 시전자가 선 칸에서 자정까지 피해를 막는 것이 모두 꺼진다 ([결정] 2026-10-02: 그 칸). 가호(고귀한 잔영, 방패동료의 축복), 얽히는 수액의 안개, 색으로부터의 보호(싸움 피해)가 막지 못한다 (`combat.ts` 의 `unpreventable`).
- **낭떠러지** (`damage` 의 `if_kicked`, [카드] 킥커 시 대상 플레이어나 플레인즈워커에게 피해 5): 킥커를 치렀으면 대상이 피해 5를 받는다 (주문이라 NPC끼리도 죽을 수 있다). 킥커 없이는 대상에게 아무 일도 없다.
- 해로운 주문이라 대상이 된 NPC는 시전자를 적으로 삼는다. 쓴 뒤에는 마나 값만큼(1시간) 다시 쓸 수 없다 (사용함).
