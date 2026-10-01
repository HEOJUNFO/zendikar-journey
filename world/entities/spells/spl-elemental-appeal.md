---
id: spl-elemental-appeal
kind: spell
name: 정령의 부름
name_en: Elemental Appeal
summary: 화산의 불길과 번개로 7/1 불의 정령을 불러내는 적색 주문. 정령은 돌진·속공으로 부른 이를 위해 싸우고 자정에 흩어진다. 마나를 더 부으면 14/1
status: canon
sources: [ZEN-123]
tags: [주문, 적색, 집중마법, 토큰, 정령]
links:
  - { to: law-mana-colors, rel: 적색 마법 }
  - { to: loc-akoum, rel: 배우는 곳 }
  - { to: cre-fire-elemental, rel: 불러내는 정령 }
sim:
  cost: "{R}{R}{R}{R}"
  speed: sorcery
  learn_at: loc-akoum      # [결정] 2026-10-01: 화산과 불의 대륙
  learn_hours: 4
  target: self             # 대상 없음: 시전자의 것
  kicker: { mana: "{5}" }  # [카드] 킥커 {5}
  effects:
    - { type: create_retainers, creature: cre-fire-elemental, count: 1, pt: [7, 1], colors: [R], abilities: [trample, haste], until_midnight: true, kicked_pump: [7, 0] }
---

## 설정

용암이 흐르는 화산 바위 위에서 한 여자가 두 팔을 하늘로 뻗자, 번개와 불길이 엉켜 거대한 정령의 형체가 솟구친다 ([그림]). 적색 마법이다 ([카드] {R}{R}{R}{R}).

## 게임에서의 역할

- 자리: 아쿰(`loc-akoum`)에서 4시간 들여 배운다 ([결정] 2026-10-01, 화산과 불의 대륙).
- 값 {R}{R}{R}{R} (적 넷). 대상이 없다: 시전자의 것이다 (`target: self`).
- **효과** ([카드]): 7/1 적색 불의 정령(`cre-fire-elemental`) 하나가 시전자 곁에 나 그의 권속이 된다. 돌진·속공을 지닌다 (`abilities`).
- **자정에 사라짐** (`until_midnight`, [카드] 다음 종료 단계에 추방): 턴 = 하루라, 그날 00:00에 흩어져 사라진다 ([결정] 2026-10-01). 늦게 부를수록 짧게 머문다.
- **킥커 {5}** (`kicked_pump`, [카드]): 마나 5를 더 치르면 정령이 00:00까지 +7/+0, 곧 14/1이다. 플레이어는 단추로, NPC는 치를 수 있으면 치른다.
