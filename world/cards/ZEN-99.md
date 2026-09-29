---
id: ZEN-99
order: 4
name_en: "Kalitas, Bloodchief of Ghet"
name_ko: "칼리타스, 게트의 혈족장"
set: ZEN
number: 99
mana_cost: "{5}{B}{B}"
type_line: "Legendary Creature — Vampire Warrior"
pt: "5/5"
rarity: mythic
artist: "Todd Lockwood"
scryfall: https://scryfall.com/card/zen/99/kalitas-bloodchief-of-ghet
added: 2026-09-29
entities: [chr-kalitas, cre-vampire, fac-ghet, law-mana-colors, loc-guul-draz, loc-ghet-estate]
---

## 카드 원문

**규칙 텍스트**

> {B}{B}{B}, {T}: Destroy target creature. If that creature dies this way, create a black Vampire creature token. Its power is equal to that creature's power and its toughness is equal to that creature's toughness.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것.

- 흡혈귀 전사들을 이끄는 전설의 흡혈귀 칼리타스가 있다. [카드] 이름, 전설적 생물 — 흡혈귀 전사
- 흑색이고, 아주 강하다. [카드] {5}{B}{B}, 5/5, 신화 등급
- 그는 누구든 죽일 수 있고, 그렇게 죽은 자는 같은 힘을 지닌 흡혈귀로 되살아난다. 흡혈귀는 이렇게 퍼진다. [카드] 능력
- 이 능력을 쓰려면 흑색 마력을 치르고, 자신도 한동안 움직이지 못한다. [카드] {B}{B}{B}, {T}
- 게트는 그가 이끄는 흡혈귀 혈족이다. [카드] "Bloodchief of Ghet"에서 추론, [배경] 게트는 흡혈귀 가문
- 창백한 피부, 녹색 구슬을 꿴 긴 머리 가닥, 날개처럼 퍼진 가시 돋친 검은 갑옷. [그림]
- 성격과 말투는 알 수 없다. 그래서 일과 없이 GM이 움직이는 존재로 둔다. [가공]
- 거처는 카드에 없다. 젠디카르의 흡혈귀가 사는 늪의 땅 굴 드라즈로 정했다. [배경] 흡혈귀의 땅, [그림] 음울한 녹황색 하늘, [결정] 거처 추가
- 굴 드라즈 안에 게트 혈족이 모여 사는 구역(영지)이 있고, 칼리타스는 그곳에 머문다. [결정] 구역 추가, [가공] 이름 "게트 혈족의 영지"

## 반영 내역

- `chr-kalitas`: 새 인물. `sim: { gm: true, pt: [5, 5], mana: { B: 7 } }`. 능력 "죽여서 혈족으로 들이기"({B}{B}{B}, {T}: 파괴, 죽으면 흡혈귀로 되살림)를 GM이 쓴다. 능력 이름은 [가공].
- `cre-vampire`: 새 생물종. 칼리타스에게 죽은 자가 흡혈귀 토큰(새 NPC)이 된다.
- `fac-ghet`: 새 세력. 게트 혈족.
- `law-mana-colors`: 흑색과 마나 규칙을 더했다.
- 2026-09-29 결정:
  - 마나는 두 갈래다. 카드 존재는 카드의 마나 값과 색을 품고, 플레이어는 땅과 유대를 맺어 얻는다.
  - 상륙은 "땅과 유대 맺기"로 바꿨다 (하루에 한 땅). 용암공 함정도 이 뜻을 따른다.
  - 로르토스의 {8}과 이오나의 역량(백 9)을 함께 반영했다.
  - 토큰은 게임 안에서 생기는 새 인물이다.
- 2026-09-29 결정 (보강): 칼리타스와 로르토스를 지도에 올린다.
  - `loc-guul-draz`: 새 지역 굴 드라즈 (34, 58), 새 지형 늪(`swamp`, 흑색 땅). 칼리타스의 거처, 게트 혈족의 거점.
  - GM이 움직이는 존재는 거처(`home`)에 머무는 인물이 된다. 칼리타스는 굴 드라즈, 로르토스는 심해의 영역.
  - 같은 지역이면 대화하고 싸울 수 있다. 공격받으면 그날 반격하고, 죽으면 능력과 출현도 끝난다.
- 2026-09-29 결정 (보강 2): 굴 드라즈 안에 게트 혈족 구역을 둔다.
  - 엔진에 지역 안의 세부 구역(`map.in`)을 새로 만들었다.
  - `loc-ghet-estate`: 게트 혈족의 영지, 굴 드라즈 안의 구역, 늪(흑색 땅). 칼리타스의 거처와 게트 혈족의 거점을 이리로 옮겼다.
- 게임에 아직 없는 것: 마나를 쓰는 주문(플레이어는 마나를 얻지만 아직 쓸 곳이 없다).
