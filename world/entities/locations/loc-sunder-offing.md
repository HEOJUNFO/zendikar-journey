---
id: loc-sunder-offing
kind: location
name: 선더만 앞바다
name_en: Sunder Bay Offing
summary: 무라사 북서쪽, 선더만 밖으로 펼쳐진 깊은 바다. 물빛이 유난히 짙고 소용돌이가 돌며, 거대한 문어 로르토스가 잠겨 산다
status: canon
sources: [ZEN-53]
tags: [바다, 심해]
links:
  - { to: loc-thunder-bay, rel: 안쪽의 만 }
  - { to: loc-murasa, rel: 남동쪽 해안 }
  - { to: chr-lorthos, rel: 주인 }
map: { x: 535, y: 577, terrain: deepsea, tiles: 20 }   # 선더만 방향, 무라사 북서쪽 먼 바다 [결정] 2026-09-30
sim:
  one_land_with: loc-thunder-bay           # 선더만과 한 땅(섬 하나) [결정] 2026-09-30
---

## 설정

무라사 북서쪽, 선더만 밖으로 펼쳐진 깊은 바다. 물빛이 유난히 짙고 한가운데에는 늘 소용돌이가 돈다. 이따금 수면 위로 거대한 촉수가 솟았다가 가라앉는다. 로르토스의 영역이다 ([카드] ZEN-53 "deepwater realm"). 로르토스는 선더만(Sunder Bay) 일대에서 자주 보였다 ([배경]). 뱃사람들은 이곳을 피해 돌아간다 ([가공]).

## 게임에서의 역할

- 무라사 북서쪽, 선더만 방향의 바다 지역이다 (지형 `deepsea`) ([결정] 2026-09-30: 사용자 결정으로 로르토스를 선더만보다 깊은 바다로 옮김). 물에 사는 이만 머물거나 지나갈 수 있다.
- **선더만과 한 땅**이다 ([결정] 2026-09-30, `sim.one_land_with`): 둘은 섬 하나로 친다. 앞바다에서 유대를 맺으면 선더만과 맺은 것이다 (청 마나 1). 앞바다와 선더만 사이는 1시간이다. 지도에서는 따로 그린다. (처음엔 땅이 아닌 바다로 정했다가 바꿈.)
- 로르토스(`chr-lorthos`)가 산다. 그의 출현(`evt-lorthos-emerges`)이 여기서 시작해 가까운 땅의 해안을 덮친다.
