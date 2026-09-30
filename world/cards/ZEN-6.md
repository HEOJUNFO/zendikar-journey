---
id: ZEN-6
order: 8
name_en: "Celestial Mantle"
name_ko: "천상의 망토"
set: ZEN
number: 6
mana_cost: "{3}{W}{W}{W}"
type_line: "Enchantment — Aura"
rarity: rare
artist: "Steve Argyle"
scryfall: https://scryfall.com/card/zen/6/celestial-mantle
added: 2026-09-29
entities: [spl-celestial-mantle, law-life, law-mana-colors, law-retainers, loc-emeria]
---

## 카드 원문

**규칙 텍스트**

> Enchant creature
> Enchanted creature gets +3/+3.
> Whenever enchanted creature deals combat damage to a player, double its controller's life total.

**플레이버 텍스트**

> Upon such armor, even a mountain would break.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자와 정한 것.

- 생물에게 입히는 백색 마법 갑옷이 있다. 입은 이는 +3/+3. [카드] 부여마법 — 오라, {3}{W}{W}{W}
- 입은 이가 싸움에서 상대에게 피해를 주면, 그를 부리는 이의 생명이 두 배가 된다. [카드]
- "이런 갑옷 앞에서는 산도 부서지리라." [카드] 플레이버
- 해 질 녘 하늘 아래, 수정 조각 같은 빛나는 갑옷과 방패를 두르고 창을 든 여인. [그림]
- 천사들의 빛나는 갑옷 같아 에메리아와 잇는다. [가공] 연결

## 반영 내역

- `spl-celestial-mantle`: 새 주문. 첫 오라(오래 남는 주문).
- 엔진: 주문 효과 `aura` (죽을 때까지 +P/+T, `double_life_on_hit`), 대상 `any_here`(자신 포함), 해롭지 않은 주문은 대상이 적의를 품지 않음. 생명 두 배(`doubleLife`)는 지금 생명만큼 얻기.
- `loc-emeria`, `law-life`, `law-mana-colors`: 이었다.
- 2026-09-29 결정:
  - 주문(오라)으로 넣는다.
  - 에메리아에서 배운다. 지금은 오를 수 없어 배울 수 없다.
- 카드의 "플레이어에게 전투 피해" = 싸움에서 누군가에게 피해를 줌, "통제하는 이" = 권속이면 주인 (`law-retainers`).
- 2026-09-30 다시 놓기 (지역 초기화 뒤, 대지 20장을 깐 다음):
  - 배우는 곳: 에메리아(`loc-emeria`, 타짐 안의 공중섬) ([결정] 예전과 같은 자리). `spl-celestial-mantle` 을 canon 으로 되돌렸다.
  - 이제 배울 수 있다: 에메리아는 밧줄(6시간)이나 비행으로 오르고, 백 마나 3을 모을 백색 땅도 여럿 있다.
  - NPC도 주문을 배우고 쓰므로 (ZEN-81 다시 놓기의 결정), 에메리아의 이오나(백 9)가 배워 쓸 수 있다.
