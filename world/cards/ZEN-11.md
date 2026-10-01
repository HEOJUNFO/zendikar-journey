---
id: ZEN-11
order: 61
name_en: "Emeria Angel"
name_ko: "에메리아 천사"
set: ZEN
number: 11
mana_cost: "{2}{W}{W}"
type_line: "Creature — Angel"
pt: "3/3"
rarity: rare
artist: "Jim Murray"
scryfall: https://scryfall.com/card/zen/11/emeria-angel
added: 2026-10-01
entities: [cre-emeria-angel, cre-bird, loc-emeria, chr-iona]
---

## 카드 원문

**규칙 텍스트**

> Flying
> Landfall — Whenever a land you control enters, you may create a 1/1 white Bird creature token with flying.

**플레이버 텍스트**

> When the earth shudders, the sky overflows.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 천사, 3/3, 비행. 상륙: 1/1 백색 비행 새 토큰을 만들 수 있다. [카드]
  = 땅과 유대를 맺을 때마다 새 하나가 곁에 나 그녀의 권속이 된다 (`landfall_token`), 늘 쓴다. [결정] 대응 표, [가공] ("할 수 있다")
- 새는 죽을 때까지 남는다. [결정] 2026-10-01
- 왕관 쓴 천사가 푸른 옷을 휘날리며 창을 들고 흰·갈색 새 떼 속을 난다. [그림]
- 땅이 들썩이면 하늘이 넘쳐흐른다. [카드] 플레이버
- 에메리아에 산다 (이름). 말하는 천사로 이오나를 섬긴다. 먹지 않고 돈을 쓰지 않는다. [결정] 2026-10-01

## 반영 내역

- `cre-emeria-angel` (새 생물종, 하나): 에메리아, 3/3, 백 4, `fly`, `types: [angel]`, `landfall_token: cre-bird 1/1 W fly`, `needs: [energy]`.
- `cre-bird` (새 생물종, 토큰으로만 남).
- 상륙 토큰이 키워드를 지닐 수 있다 (`landfall_token.abilities`).
- `loc-emeria`, `chr-iona`: 링크.
