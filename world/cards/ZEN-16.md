---
id: ZEN-16
order: 145
name_en: "Kazandu Blademaster"
name_ko: "카잔두 검사"
set: ZEN
number: 16
mana_cost: "{W}{W}"
type_line: "Creature — Human Soldier Ally"
pt: "1/1"
rarity: uncommon
artist: "Michael Komarck"
scryfall: https://scryfall.com/card/zen/16/kazandu-blademaster
added: 2026-10-02
entities: [chr-kazandu-blademaster, loc-kazandu-refuge, law-allies]
---

## 카드 원문

**규칙 텍스트**

> First strike, vigilance
> Whenever this creature or another Ally you control enters, you may put a +1/+1 counter on this creature.

**플레이버 텍스트**

> "If you hire a sell-sword, you'd better watch your back. Hire me, and I'll watch it for you."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 인간 병사 동료 {W}{W}, 1/1. 선제공격, 경계. 이것이나 다른 동료가 들어올 때마다 이것에 +1/+1 카운터를 놓을 수 있다. [카드]
- 플레이버: "용병을 고용하면 등 뒤를 조심해야 하지. 나를 고용하면 내가 지켜 주지." [카드]
- 금빛으로 빛나는 밀림 그늘, 사슬 감은 넓은 장검과 고글을 쓴 백발의 검사. [그림]
- 지명 확인: 이름의 카잔두 = 원정대와 함정꾼이 모이는 무라사의 밀림, 세계에 있음 (카잔두, 카잔두 피난처). [배경] [새 지역 후보] 없음.
- 사는 곳: 카잔두 피난처, 남동쪽 거목 뿌리 아래(`home_pos: [0.3, 0.2]`). [결정] 2026-10-02, 방위는 [가공]
- 말하는 인물, 열일곱 번째 동료. 설득하거나 20코인(마나 값 2 × 10)에 고용 (플레이버의 "나를 고용하면"). [카드]/[가공]
- 동료가 들 때 카운터는 늘 놓음 (`counter_self`, 투크투크 졸개들과 같음). [가공]

## 반영 내역

- `chr-kazandu-blademaster` (새 인물): 카잔두 피난처, 1/1, 마나 백 2, `first_strike`·`vigilance`, `ally`, `hireable`, `rally: counter_self`.
- `loc-kazandu-refuge`, `law-allies`: 링크.
