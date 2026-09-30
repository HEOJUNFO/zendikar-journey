---
id: ZEN-62
order: 16
name_en: "Roil Elemental"
name_ko: "뒤틀림 정령"
set: ZEN
number: 62
mana_cost: "{3}{U}{U}{U}"
type_line: "Creature — Elemental"
pt: "3/2"
rarity: rare
artist: "Raymond Swanland"
scryfall: https://scryfall.com/card/zen/62/roil-elemental
added: 2026-09-30
entities: [cre-roil-elemental, law-retainers, loc-tazeem]
---

## 카드 원문

**규칙 텍스트**

> Flying
> Landfall — Whenever a land you control enters, you may gain control of target creature for as long as you control this creature.

**플레이버 텍스트**

> A vortex that devours everything—even the souls of the living.

## 해석

- 부서진 바위 조각이 푸른 빛을 가운데 두고 소용돌이치고, 사람들과 날개 달린 짐승이 빨려 든다 [그림]. 청색 정령, 3/2 [카드].
- 젠디카르의 뒤틀림(Roil)이 모습을 얻은 것 [배경][가공]. 자리: 타짐 [결정].
- 말하지 않고 먹지도 자지도 않는다. 생명도 없다 [가공].
- 비행: 기존 `fly` [카드].
- 상륙: 대상 생물의 통제권 → 그 자리의 하나를 삼켜 권속으로 [카드]. LLM이 고르고 안 할 수도 있다. 플레이어도, 전설도 [결정]. 정령이 죽어야 풀린다 [카드] ("통제하는 동안"). 덤벼도 풀리지 않는다 [가공].
- 휩쓸린 플레이어: 정령을 따라 끌려다니며 기다리거나 정령에게 덤빌 수만 있다 [결정].

## 반영 내역

- `cre-roil-elemental` (새 생물종, 게임 속 하나): 타짐. 3/2, 청 6, `needs: []`, `beast`, `fly`, `landfall_seize`.
- `law-retainers`: 빼앗음(`seized`).
- `loc-tazeem`: 떠도는 뒤틀림.
- 엔진: `sim.landfall_seize` (`bondLand` → `state.choices` → `run.ts` 에서 LLM이 고름 → `retainers.ts` 의 `seize`), `Actor.seized` (덤벼도 안 풀림), 휩쓸린 플레이어의 행동 제한(`actions.ts`)과 끌려다님(`step.ts`), 웹의 휩쓸림 패널.
