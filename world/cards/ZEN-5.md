---
id: ZEN-5
order: 28
name_en: "Caravan Hurda"
name_ko: "대상단 후르다"
set: ZEN
number: 5
mana_cost: "{4}{W}"
type_line: "Creature — Giant"
pt: "1/5"
rarity: common
artist: "Dave Kendall"
scryfall: https://scryfall.com/card/zen/5/caravan-hurda
added: 2026-09-30
entities: [cre-hurda, loc-goma-fada, loc-akoum]
---

## 카드 원문

**규칙 텍스트**

> Lifelink (Damage dealt by this creature also causes you to gain that much life.)

**플레이버 텍스트**

> "Not too bright, but good enough for the job required—carrying and walking in a straight line."
> —Bruse Tarl, Goma Fada nomad

## 해석

- 등에 짐 꾸러미를 잔뜩 동여맨 거구가 금빛 평원을 걷고, 지팡이 든 유목민들이 곁을 따른다. 멀리 허공에 뜬 바위 [그림]. 백색 거인, 1/5, 생명연결 [카드].
- 고마 파다 = 아쿰을 떠도는 "걸어 다니는 도시", 코르·인간 유목민의 대상단. 후르다는 거인의 먼 친척인 반인형 거구로 대상단의 수레를 끈다 [배경] (웹 검색으로 확인).
- 고마 파다를 더한다 [결정] (사용자 요청). 처음엔 아쿰 안의 구역이었다가, 원작처럼 아쿰 위를 걸어 다니는 지도 위의 점으로 바꿨다 [결정]. 땅이 아니라 유대를 맺을 수 없다 [결정].
- 후르다는 고용할 수 있는 짐꾼: 50코인에 끝없이 따른다 [결정].

## 반영 내역

- `loc-goma-fada` (새 지역, 아쿰 위를 걸어 다님): 정착지, 마나 없음, `not_land`, `wanders` (하루 12, 행선지 셋).
- `cre-hurda` (새 생물종, 한 마리 "대상단 후르다"): 1/5, 백 5, 기력·배고픔, `lifelink`, `hireable`.
- `loc-akoum`: 안의 구역 고마 파다.
- 엔진: 땅이 아닌 곳(`not_land`: 유대를 맺을 수 없음, 마나 없음), 걸어 다니는 곳(`sim/wander.ts`, LLM `wander` 가 다음 행선지를 고름).
