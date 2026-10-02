---
id: spl-grim-discovery
kind: spell
name: 음산한 발견
name_en: Grim Discovery
summary: 굼 밀림의 묻힌 유적에서 배우는 흑색 주문. 죽은 자들의 폐허를 뒤져, 잃었던 동료의 목숨이나 끊겼던 땅으로 가는 길을 되찾는다
status: canon
sources: [ZEN-91]
tags: [주문, 흑색, 집중마법, 무덤, 되살림]
links:
  - { to: itm-soul-stair-expedition, rel: 같은 되살림 }
  - { to: law-mana-colors, rel: 흑색 마법 }
  - { to: loc-guum-wilds, rel: 배우는 곳 (묻힌 유적) }
  - { to: law-retainers, rel: 무덤의 생물 }
sim:
  cost: "{1}{B}"
  speed: sorcery
  learn_at: loc-guum-wilds   # [결정] 2026-10-01: 그림의 묻힌 석조 유적
  learn_hours: 4
  target: self             # 걸고 난 뒤 무덤에서 고른다
  effects:
    - { type: grim_discovery }   # [카드] 무덤의 생물 카드 그리고/또는 대지 카드를 손으로
---

## 설정

종유석 늘어진 동굴 속 묻힌 석조 유적을, 횃불을 든 탐험가들이 발견한다 ([그림]). "산 자들 가운데, 그들의 세계가 얼마나 죽은 자들의 폐허로 빚어졌는지 아는 이는 드물다" ([카드] 플레이버). 굼 밀림 가운데에는 옛 석조 유적이 묻혀 있다 ([배경]).

## 게임에서의 역할

- 자리: 굼 밀림(`loc-guum-wilds`)에서 4시간 들여 배운다 ([결정] 2026-10-01).
- 값 {1}{B} (마나 2, 흑 하나). 걸 때 사람을 고르지 않는다 (`target: self`). 무덤에 생물도 땅도 없으면 쓸 수 없다.
- **음산한 발견** (`grim_discovery`, [카드] 하나 또는 둘 다: 무덤의 생물 카드를 손으로, 무덤의 대지 카드를 손으로, `sim/discovery.ts`): 걸고 난 뒤 시전자가 둘 다 고를 수 있다 (각각 그만둘 수도: NPC는 LLM, 플레이어는 고를 것).
  - **무덤의 생물** (시전자의 생물 무덤 `fallen`: 섬기다 죽은 권속, 그가 죽인 이): 되살아나 제 거처에서 눈을 뜨지만 누구도 섬기지 않는다 ([결정] 2026-10-01: 손에서 다시 부를 길이 없어 자유롭게. 다시 설득해야 한다). 토큰과 세계에서 지워진 이는 돌아오지 않는다.
  - **무덤의 땅** (한때 유대를 맺었다가 지금은 쥐지 않은 땅, `Actor.everBonded`. 추방된 땅은 빼고, [결정] 2026-10-01): 손에 든 땅(`handLands`, 인어 길잡이와 같음)이 되어, 언제든 멀리서 그날의 땅으로 이을 수 있다.

## 미정/질문

- 없음.
