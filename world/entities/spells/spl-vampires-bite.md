---
id: spl-vampires-bite
kind: spell
name: 흡혈귀의 이빨
name_en: Vampire's Bite
summary: 말라키르의 흡혈귀들에게서 배우는 흑색 순간마법. 한 생물에게 송곳니의 사나움을 불어넣어 그날 하루 세게 치게 하고, 힘을 더 쏟으면 친 만큼 피를 마셔 생명으로 삼게 한다
status: canon
sources: [ZEN-117]
tags: [주문, 흑색, 순간마법, 부풂, 생명연결, 킥커]
links:
  - { to: law-mana-colors, rel: 흑색 마법 }
  - { to: loc-malakir, rel: 배우는 곳 (흡혈귀의 도시) }
  - { to: cre-vampire, rel: 흡혈귀의 이빨 }
  - { to: spl-slaughter-cry, rel: 같은 부풂 (+3/+0) }
sim:
  cost: "{B}"
  speed: instant
  learn_at: loc-malakir    # [결정] 2026-10-02: 흡혈귀의 도시 [가공]
  learn_hours: 4
  target: any_here         # 같은 칸의 생물 하나 (자신 포함, 플레인즈워커 빼고)
  kicker: { mana: "{2}{B}" }   # [카드] 킥커 {2}{B}
  effects:
    - { type: pump_target, pt: [3, 0], kicked_abilities: [lifelink] }   # [카드] 턴 끝까지 +3/+0, 킥커 시 생명연결
---

## 설정

금빛 문양을 두른 창백한 흡혈귀 여인이 송곳니를 드러내고 울부짖는다 ([그림]). 흑색 순간마법이다 ([카드]).

## 게임에서의 역할

- 자리: 굴 드라즈의 말라키르(`loc-malakir`)에서 4시간 들여 배운다 ([결정] 2026-10-02, [가공]). 플레이어도 NPC도.
- 값 {B} (마나 1, 흑 하나). 킥커 {2}{B}(마나 3 더). 순간마법이라 언제든 쓴다. 같은 칸의 하나(자신도)에게 건다. 플레인즈워커는 고를 수 없다. 해롭지 않아 적의를 사지 않는다.
- **송곳니** (`pump_target`, [카드] 턴 끝까지 +3/+0): 대상이 자정까지 +3/+0 (살육의 함성과 같은 틀).
- **피를 마심** (`kicked_abilities: [lifelink]`, [카드] 킥커 시 생명연결): 킥커를 치렀으면 자정까지 생명연결도 얻는다: 싸움에서 준 피해만큼 그를 조종하는 이가 생명을 얻는다.
- 쓴 뒤에는 마나 값만큼(1시간) 다시 쓸 수 없다 (사용함).
