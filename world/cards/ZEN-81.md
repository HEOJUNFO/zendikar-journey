---
id: ZEN-81
order: 7
name_en: "Blood Tribute"
name_ko: "피의 공물"
set: ZEN
number: 81
mana_cost: "{4}{B}{B}"
type_line: "Sorcery"
rarity: rare
artist: "Alex Horley-Orlandelli"
scryfall: https://scryfall.com/card/zen/81/blood-tribute
added: 2026-09-29
entities: [spl-blood-tribute, cre-vampire, law-life, law-retainers]
---

## 카드 원문

**규칙 텍스트**

> Kicker—Tap an untapped Vampire you control. (You may tap a Vampire you control in addition to any other costs as you cast this spell.)
> Target opponent loses half their life, rounded up. If this spell was kicked, you gain life equal to the life lost this way.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자와 정한 것.

- 상대의 생명을 절반(올림) 빼앗는 흑색 주문이 있다. [카드] 집중마법, {4}{B}{B}
- 시전자가 부리는 흡혈귀가 힘을 보태면(탭), 빼앗은 생명이 시전자에게 온다. [카드] 킥커
- 촉수 같은 머리칼의 흡혈귀 여인이 허공에 떠서, 쓰러져 창백하게 말라 가는 사내의 생명을 빨아들인다. 붉은 달, 허공에 뜬 바위. [그림]
- 흡혈귀의 주문이다. [카드] 킥커의 흡혈귀, [그림]

## 반영 내역

- `spl-blood-tribute`: 새 요소 종류 "주문"(`spells/`, `spl-`)의 첫 주문.
- 엔진: 주문 체계 (`sim/spells.ts`). 배우는 곳(`learn_at`)에서 "배우기" 행동으로 익히고, "주문 쓰기"로 같은 곳의 한 사람에게 마나를 치러 건다. 킥커는 시전자의 권속 중 그 종류의 생물을 탭한다.
- `loc-malakir`, `cre-vampire`, `law-life`: 이었다. 이 주문의 킥커는 세계의 첫 "생명을 얻는" 효과다.
- 2026-09-29 결정:
  - 이 주문은 플레이어가 배워서 쓴다 (NPC는 아직 안 씀).
  - 주문은 새 요소 종류로 기록한다.
  - 말라키르에서 배운다 (4시간은 [가공]).
  - 대상은 같은 곳에 있는 이.
- 2026-09-29 결정 (이어서): "당신이 통제하는 생물" = 권속 (`law-retainers`). 플레이어는 대화로 설득해 권속을 얻는다.
- 게임에 아직 없는 것: 플레이어가 흡혈귀 권속을 얻을 현실적인 길 (지금 흡혈귀는 모두 칼리타스의 권속). 여섯 번째 땅(그래서 아직 시전할 마나가 안 모임).
