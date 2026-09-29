---
id: ZEN-13
order: 1
name_en: "Iona, Shield of Emeria"
name_ko: "이오나, 에메리아의 방패"
set: ZEN
number: 13
mana_cost: "{6}{W}{W}{W}"
type_line: "Legendary Creature — Angel"
pt: "7/7"
rarity: mythic
artist: "Jason Chan"
scryfall: https://scryfall.com/card/zen/13/iona-shield-of-emeria
added: 2026-09-28
entities: [chr-iona, loc-emeria, law-mana-colors]
---

## 카드 원문

**규칙 텍스트**

> Flying
> As Iona enters, choose a color.
> Your opponents can't cast spells of the chosen color.

**플레이버 텍스트**

> No more shall the righteous cower before evil.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것.

- 에메리아를 지키는 전설의 천사 이오나가 있다. [카드] 이름, 전설적 생물 — 천사
- 이오나는 난다. [카드] Flying
- 흰 날개, 붉은 깃을 단 투구와 갑옷, 아래로 세워 쥔 긴 검. 빛에 싸여 있다. [그림]
- 정의롭고 단호하다. 의로운 자들이 악 앞에서 움츠러들지 않게 지킨다. [카드] 플레이버 텍스트
- 적의를 품은 상대의 한 색 마법을 봉인한다. [카드] 색을 고르면 상대가 그 색 주문을 쓰지 못한다
- 마법에는 색이 있다. [카드] "choose a color". 백·청·흑·적·녹 다섯 색이라는 것은 [배경]
- 이오나는 백색이다. [카드] 마나 비용 {W}{W}{W}
- 아주 강한 존재다. [카드] 7/7, 9마나, 신화 등급
- 에메리아는 장소다. [카드] 이름 "에메리아의 방패"에서 추론
- 에메리아는 하늘에 떠 있는 고대 석조 폐허다. [그림] 공중에 뜬 바위와 부서진 석조물, [배경] 대지 카드 *Emeria, the Sky Ruin*
- 에메리아에는 천사들이 머문다. [배경]
- 좀처럼 모습을 드러내지 않아 이야기로만 아는 이가 많다. [가공] 신화 등급, 9마나에서 착안
- 하루 일과(새벽 기도, 하늘 순찰, 폐허 수호, 비문 읽기), 낯선 이는 경계하다가 의로운 이에게 곁을 내어주는 태도. [가공]
- 먹지 않고 돈을 쓰지 않으며, 지치기만 한다. [가공] 2026-09-29 점검에서 정함

## 반영 내역

- `chr-iona`: 새 인물. 설정과 `sim`(역할, persona, 목표, 비행, `needs: [energy]`, 에메리아에서의 일과).
- `loc-emeria`: 새 지역. `map: { x: 48, y: 13, terrain: sky }`. 지도 북쪽이라는 위치는 [가공].
- `law-mana-colors`: 새 법칙. 다섯 색과 색 봉인.
- 게임에 아직 없는 것: 색 봉인(마법·대결 시스템이 없음), 7/7의 힘(전투가 없음).
- 2026-09-29 결정: "들어올 때"는 "전투에 돌입할 때"로 본다. 색 봉인의 구체적인 규칙은 마법 카드가 나올 때 마법 시스템과 함께 정한다.
- 2026-09-29 점검: 세계 시뮬레이션 전환에 맞춰 일과를 정시 단위로 바꾸고, 식사(성소의 샘물) 블록을 뺐다. 천사에게는 배고픔과 돈이 없다.
