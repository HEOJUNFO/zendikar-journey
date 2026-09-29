---
id: ZEN-53
order: 3
name_en: "Lorthos, the Tidemaker"
name_ko: "로르토스, 조수를 부리는 자"
set: ZEN
number: 53
mana_cost: "{5}{U}{U}{U}"
type_line: "Legendary Creature — Octopus"
pt: "8/8"
rarity: mythic
artist: "Kekai Kotaki"
scryfall: https://scryfall.com/card/zen/53/lorthos-the-tidemaker
added: 2026-09-29
entities: [chr-lorthos, evt-lorthos-emerges, law-mana-colors]
---

## 카드 원문

**규칙 텍스트**

> Whenever Lorthos attacks, you may pay {8}. If you do, tap up to eight target permanents. Those permanents don't untap during their controllers' next untap steps.

**플레이버 텍스트**

> When Lorthos emerges from his deepwater realm, the tides bow to his will and the coastline cowers in his presence.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것.

- 심해의 영역에 사는 전설의 거대한 문어 로르토스가 있다. [카드] 이름, 전설적 생물 — 문어, 플레이버 "deepwater realm"
- 청색이다. 아주 강한 존재다. [카드] {U}{U}{U}, 8/8, 9마나, 신화 등급
- 그가 떠오르면 조수가 그의 뜻을 따르고 해안이 움츠러든다. [카드] 플레이버 텍스트
- 공격할 때 최대 여덟을 붙잡는다. 붙잡힌 것은 다음 날이 다 지나도록 풀려나지 못한다. [카드] 지속물 8개 탭, 다음 언탭 단에 언탭되지 않음
- 붙잡는 대상은 사람만이 아니라 땅(해안)도 된다. [카드] "permanents" (생물과 대지 모두)
- 폭풍이 따르고, 파도가 해안의 바위와 구조물을 덮친다. 가시 돋친 관 같은 머리, 거대한 촉수. [그림]
- 평소에는 모습을 드러내지 않는다. [카드] "emerges"에서 추론
- 심해의 영역은 젠디카르 서쪽 바다에 있다. 물빛이 짙고 소용돌이가 돈다. 뱃사람들이 피해 돌아간다. [가공]
- 해안 = 심해에서 지도 거리 20 안의 땅. [가공]
- 한 달에 한 번꼴, 한 번 나오면 7일 쉰다. 1시간 전 전조가 오고 온 세상이 소식을 듣는다. [가공] 폭풍 전조는 [그림]에서 착안
- 로르토스는 일과를 사는 NPC가 아니라 GM이 사건으로 움직이는 존재다. [가공]

## 반영 내역

- `chr-lorthos`: 새 인물 (`sim` 없음, GM이 사건으로 움직임).
- `evt-lorthos-emerges`: 새 사건. `trigger: gm`, `range: 20`, `scope: world`. 효과는 `tap`(최대 8, 인물 먼저 그다음 해안의 땅, 다음 언탭 건너뜀 → 모레 00:00에 풀림)이다.
- `loc-deepwater-realm`: 새 지역 (바다, `map: { x: 18, y: 38, terrain: deepsea }`). 위치는 [가공].
- `law-mana-colors`: 청색을 더했다.
- 2026-09-29 점검: 탭(인물은 묶임, 대지는 잠시 쓸 수 없음)과 언탭(턴 시작 00:00)을 대응 표에 정했다. 속박을 "다음 날 06:00까지"에서 카드대로 "모레 00:00까지"로 바꿨다. [가공]이던 "조수에 잠긴 해안(12시간 이동 불가)"을 카드의 대지 탭("조수에 잠긴 해안", 탐색·일 불가)으로 바꿨다.
- 참고: 지금 지도에는 해안에 해당하는 땅이 없어서 출현해도 붙잡히는 것이 없다.
