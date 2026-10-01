---
id: ZEN-15
order: 102
name_en: "Kabira Evangel"
name_ko: "카비라 전도사"
set: ZEN
number: 15
mana_cost: "{2}{W}"
type_line: "Creature — Human Cleric Ally"
pt: "2/3"
rarity: rare
artist: "Eric Deschamps"
scryfall: https://scryfall.com/card/zen/15/kabira-evangel
added: 2026-10-01
entities: [chr-kabira-evangel, loc-kabira-crossroads]
---

## 카드 원문

**규칙 텍스트**

> Whenever this creature or another Ally you control enters, you may choose a color. If you do, Allies you control gain protection from the chosen color until end of turn.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 사람 성직자 동료, 2/3. 이것이나 다른 동료가 들어올 때마다 색 하나를 고를 수 있다; 고르면 당신이 조종하는 동료들이 턴 끝까지 그 색으로부터 보호. [카드]
- 밤 모닥불 앞에서 두 팔을 들어 설교하는 법복의 전도사, 둘러앉은 이들. [그림]
- 이름의 카비라 교차로(세계에 있음)에 산다, 남서쪽 길손 쉼터. [배경] ([결정] 2026-10-01, 방위는 [가공]). [새 지역 후보] 없음.
- 말하는 성직자, 먹고 돈을 씀, 30코인에 고용도 된다. [결정] 2026-10-01
- 무리 발동(동료가 주인의 무리에 들 때)의 색 = 주인이 고름 (NPC는 LLM, 플레이어는 고를 것, 안 고를 수도). 무리의 동료 모두가 00:00까지 그 색으로부터 보호 (기존 보호 규칙). [가공]

## 반영 내역

- `chr-kabira-evangel` (새 인물): 카비라 교차로 `home_pos: [-0.3, 0.3]`, 2/3, 마나 백 3, `ally`, `hireable`(30코인), `rally: ward_allies`.
- `loc-kabira-crossroads`: 사는 전도사 링크.
- 새 무리 발동 `ward_allies` (`allies.ts` 의 `applyWard`, 고를 것 `ward`), 자정까지의 보호 `Actor.warded` (`protectedFrom` 이 함께 봄, 힘이 떨어질 때 `shed` 가 지움).
