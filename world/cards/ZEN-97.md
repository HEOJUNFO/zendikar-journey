---
id: ZEN-97
order: 65
name_en: "Heartstabber Mosquito"
name_ko: "심장찌르개 모기"
set: ZEN
number: 97
mana_cost: "{3}{B}"
type_line: "Creature — Insect"
pt: "2/2"
rarity: common
artist: "Jason Felix"
scryfall: https://scryfall.com/card/zen/97/heartstabber-mosquito
added: 2026-10-01
entities: [cre-heartstabber-mosquito, loc-piranha-marsh]
---

## 카드 원문

**규칙 텍스트**

> Kicker {2}{B} (You may pay an additional {2}{B} as you cast this spell.)
> Flying
> When this creature enters, if it was kicked, destroy target creature.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 곤충, 2/2, 비행. 킥커 {2}{B}. 들어올 때 킥커했다면 대상 생물 하나를 파괴한다. [카드]
- 생물의 킥커 = 제 마나로 치를 수 있으면 치름 (스핑크스 ZEN-69 와 같음). 들어올 때 = 그날 처음 어느 땅에 들어설 때, 매일 (후광 사냥꾼 ZEN-96 과 같음). [결정] 2026-10-01
- 대상 생물 = 그 칸의 플레인즈워커가 아닌 누구든 (플레이어도). 한 시간 뒤 LLM이 고르고(안 고를 수도), 고르면 그때 마나를 치르고 파괴한다. [결정] 2026-10-01
- 검은 갑각, 붉은 배와 겹눈, 창 같은 붉은 주둥이의 거대 모기가 초록 그늘의 나뭇가지에 앉아 있다. [그림]
- 피라냐 습지에 산다: 설정에 자리가 없어 흑색 곤충, 늪 그늘의 그림으로. [가공] [결정] 2026-10-01
- 말하지 않는 짐승. 피를 먹고, 배고프면 곁의 가장 약한 이를 덮친다. [가공]

## 반영 내역

- `cre-heartstabber-mosquito` (새 생물종, 하나): 피라냐 습지, 2/2, 흑 4, `beast`, `fly`, `needs: [energy, hunger]`, `enter_destroy: { kicker: "{2}{B}" }`.
- `sim.enter_destroy` 를 넓힘: 생물 유형(후광 사냥꾼의 천사) 대신 `{ kind?, kicker? }` 도 받는다. 유형이 없으면 플레인즈워커가 아닌 누구든, 킥커가 있으면 제 마나로 치를 수 있을 때만 고르고 파괴할 때 치른다 (`abilities.ts` 의 `enterDestroy`, `applyEnterDestroy`).
- `loc-piranha-marsh`: 링크.
