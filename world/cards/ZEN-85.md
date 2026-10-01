---
id: ZEN-85
order: 57
name_en: "Crypt Ripper"
name_ko: "묘실 찢개"
set: ZEN
number: 85
mana_cost: "{2}{B}{B}"
type_line: "Creature — Shade"
pt: "2/2"
rarity: common
artist: "Dave Kendall"
scryfall: https://scryfall.com/card/zen/85/crypt-ripper
added: 2026-10-01
entities: [cre-crypt-ripper, loc-agadeem-crypt]
---

## 카드 원문

**규칙 텍스트**

> Haste
> {B}: This creature gets +1/+1 until end of turn.

**플레이버 텍스트**

> The tender light of the living quickens the pulse of the dead.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 그늘, 2/2, 속공. {B}: 턴 끝까지 +1/+1. [카드]
- 쓰러진 비석과 뼈가 드러난 무덤 위로 검은 그림자 몸이 갈고리 발톱을 뻗으며 덮친다. [그림]
- 산 자의 따스한 빛이 죽은 것의 맥박을 뛰게 한다. [카드] 플레이버
- 묘실(crypt)에 깃든다. [카드] 이름. 아게딤의 묘실에 둔다. [결정] 2026-10-01
- 먹지 않고 말하지 않는다. 스스로 산 자를 골라 덤빈다 (늪의 누더기처럼). [가공]
- 속공: 이동 시간 절반. [결정] 대응 표
- {B}: +1/+1 → 싸움이 이어지는 시간마다 그 전에 조종하는 이가 얼마나 부을지 정한다 (NPC는 LLM, 플레이어는 고를 것), 00:00까지. [결정] 2026-10-01

## 반영 내역

- `cre-crypt-ripper` (새 생물종, 하나): 아게딤의 묘실, 2/2, 흑 4, `beast`, `haste`, `pump: {B} +1/+1`, `needs: [energy]`.
- 새 능력 `sim.pump` (`sim/pump.ts`: `pumpMax`, `pumpsDue`, `applyPump`; `run.ts` 의 `pumps`, 고를 것 `pour`).
- `loc-agadeem-crypt`: 링크와 설명.
