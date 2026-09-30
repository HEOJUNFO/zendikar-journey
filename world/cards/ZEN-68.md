---
id: ZEN-68
order: 20
name_en: "Sphinx of Jwar Isle"
name_ko: "즈와르 섬의 스핑크스"
set: ZEN
number: 68
mana_cost: "{4}{U}{U}"
type_line: "Creature — Sphinx"
pt: "5/5"
rarity: rare
artist: "Justin Sweet"
scryfall: https://scryfall.com/card/zen/68/sphinx-of-jwar-isle
added: 2026-09-30
entities: [cre-sphinx, loc-jwar-isle]
---

## 카드 원문

**규칙 텍스트**

> Flying
> Shroud (This creature can't be the target of spells or abilities.)
> You may look at the top card of your library any time.

**플레이버 텍스트**

> "Even if the sphinxes do know the location of every relic, getting one to talk is harder than just searching yourself."
> —Sachir, Akoum Expeditionary House

## 해석

- 사람 얼굴에 수염 난 사자 몸의 스핑크스가 커다란 깃털 날개로 어둠 속을 난다. 아래에 푸르게 빛나는 수정 기둥 [그림]. 청색 스핑크스, 5/5 [카드].
- 즈와르 섬에 산다 [결정] (카드 이름). 섬 안쪽의 초록빛·수정을 둥지로 [가공].
- 말하되 과묵한 NPC [결정]: 입을 열게 하기가 직접 찾기보다 어렵다 [카드 플레이버]. 옛 지식의 수호자 [배경].
- 방어막(shroud): 누구의 주문·능력·땅 효과·무리 발동·뒤틀림 정령도 그를 고를 수 없다. 자기 편도 [결정] (MTG 그대로, hexproof 와 다름). 싸움은 그대로 [결정].
- 서고 맨 위를 언제든 본다 → 앞일을 안다: 오늘 아침 LLM이 고른 남은 사건·능력을 하루 계획과 대화에서 안다 [결정].

## 반영 내역

- `cre-sphinx` (새 생물종, 한 마리 "즈와르 섬의 스핑크스"): 5/5, 청 6, 먹지 않음, `fly`, `shroud`, `foresight`.
- `loc-jwar-isle`: 스핑크스가 사는 곳.
- 엔진: 능력 `shroud`(`targetable`: 주문 대상, 능력 대상, 땅의 대상 효과, 발라쿠트, 무리 발동, 뒤틀림 정령의 후보에서 빠짐), `sim.foresight`(`sim/foresight.ts`: 하루 계획은 아침 계획 뒤에, 대화에 남은 앞일).
