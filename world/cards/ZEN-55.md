---
id: ZEN-55
order: 72
name_en: "Merfolk Seastalkers"
name_ko: "인어 바다추적자"
set: ZEN
number: 55
mana_cost: "{3}{U}"
type_line: "Creature — Merfolk Scout"
pt: "2/3"
rarity: uncommon
artist: "Eric Deschamps"
scryfall: https://scryfall.com/card/zen/55/merfolk-seastalkers
added: 2026-10-01
entities: [chr-merfolk-seastalkers, loc-bojuka-bay, loc-bala-ged]
---

## 카드 원문

**규칙 텍스트**

> Islandwalk (This creature can't be blocked as long as defending player controls an Island.)
> {2}{U}: Tap target creature without flying.

**플레이버 텍스트**

> "Do they seek knowledge or wealth? Are they bandits or benefactors? It depends on who is chanting the tale."
> —Nikou, Joraga bard

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 인어 정찰병, 2/3. 섬걷기. {2}{U}: 비행 없는 대상 생물을 탭한다. [카드]
- 지명 확인: 지명 없음. 니코우는 사람 이름, 조라가(탱글드 베일)는 이미 있다.
- 섬걷기 = 늪걷기·숲걷기와 같은 규칙, 섬. [결정] (대응 표)
- 탭 능력 = 싸움 중, 그 시간 전에 조종하는 이가 {2}{U}를 내어 날지 못하는 적 하나를 자정까지 묶음 (탭 = 묶임, 언탭 = 00:00). [결정] 2026-10-01
- 배의 돛줄을 타고 오르는 인어 둘. [그림]
- **[새 지역]** 보주카 만: 우멍 강이 바다로 나는 발라 게드의 만 [배경]. 조라가 가까이 인어가 살 곳으로 (사용자 요청). 발라 게드 안의 구역, 기본 섬, 10칸, 남쪽 해안 (방위 [가공]). [결정] 2026-10-01
- 인어 무리 하나를 한 인물로. 말하는 인물, 먹고 지침. [가공]

## 반영 내역

- `chr-merfolk-seastalkers` (새 인물): 보주카 만, 2/3, 청 4, `islandwalk`, `tap_foe: { cost: "{2}{U}", no_fly: true }`, `needs: [energy, hunger]`.
- `loc-bojuka-bay` (새 구역): 발라 게드 안, `terrain: beach` (기본 섬), 10칸, `pos: [0.35, 0.94]`.
- 새 능력 `islandwalk` (`combat.ts` 의 `LANDWALK`), `sim.tap_foe` (`sim/bind.ts`, `run.ts` 의 `binds`, 고를 것 `bind`).
- `loc-bala-ged`, `loc-tangled-vale`, `chr-joraga-bard`: 링크, 설명.
