---
id: ZEN-71
order: 84
name_en: "Summoner's Bane"
name_ko: "소환자의 파멸"
set: ZEN
number: 71
mana_cost: "{2}{U}{U}"
type_line: "Instant"
rarity: uncommon
artist: "Cyril Van Der Haegen"
scryfall: https://scryfall.com/card/zen/71/summoners-bane
added: 2026-10-01
entities: [spl-summoners-bane, cre-illusion, loc-jwar-isle]
---

## 카드 원문

**규칙 텍스트**

> Counter target creature spell. Create a 2/2 blue Illusion creature token.

**플레이버 텍스트**

> "I don't need to have the perfect plan. My foe just has to have an imperfect one."
> —Jace Beleren

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 순간마법. 대상 생물 주문을 무효화하고, 2/2 청색 환영 토큰을 만든다. [카드]
- 불을 쏘는 마법사 앞에서 푸른 수정 조각들이 이빨 달린 아가리로 모여 불길을 삼킨다: 환영. [그림]
- 제이스 벨러렌(청색 정신 마법사)의 말: 완벽한 계획은 필요 없다, 적의 계획이 불완전하기만 하면 된다. [카드] 플레이버, [배경]
- 생물 주문 = 누군가를 권속으로 들이는 시도(고용, 설득, 짐승의 인정, 섬기라는 청에 답함), 무효화 = 그 시도를 가로막고 들이려던 이는 거절당한 이. [결정] 2026-09-30 대응 표
- 반응: 주문을 쥐고 값을 치를 수 있는 이와 같은 칸에서 누군가 권속을 들이면 한 시간 보류되고, 쥔 이가 무산시킬지 정한다. 치른 고용비는 돌아오지 않는다. 평소에는 쓸 수 없다. [결정] 2026-10-01
- 환영 토큰은 무산시킨 이의 권속, 죽을 때까지 남는다. [결정] 2026-10-01
- 즈와르 섬에서 배운다 (4시간): 청색 정신 마법과 환영, 스핑크스의 비밀의 섬. [결정] 2026-10-01 [가공]

## 반영 내역

- `spl-summoners-bane` (새 주문): 즈와르 섬, {2}{U}{U}, 순간마법, 효과 `counter_creature` + `create_retainers` 2/2 청색 환영.
- `cre-illusion` (새 생물종, 토큰으로만 남).
- 새 규칙 `sim/counter.ts`: 권속을 들이는 다섯 길(고용 `hireMerc`, NPC끼리의 설득, 플레이어의 설득, 짐승의 인정, 플레이어가 섬기라는 청에 답함)이 모두 `summon` 을 거친다. 같은 칸에 막을 이가 있으면 `state.choices` 의 `counter` 로 한 시간 보류, `answerCounter` 가 풀고 무산이면 `refuse`. 플레이어는 고를 것(`sim/asks.ts`), NPC는 LLM `pick`(`sim/run.ts`).
- 반응 주문(`reactionSpell`)은 `castBlocked`·`npcCastBlocked`·`castableSpells`·플레이어 행동 목록에서 빠진다. `castSpell` 이 풀렸는지를 돌려준다 (정신파괴 함정이 이 주문도 부술 수 있다).
- `loc-jwar-isle`: 배우는 주문 링크.
