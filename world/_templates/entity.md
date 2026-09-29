---
id: loc-example        # <접두사>-<영문 슬러그>, 파일 이름과 같게
kind: location         # location | creature | character | faction | item | event | law | spell
name: ""               # 한국어 이름
name_en: ""
summary: ""            # 한 줄 요약. LLM 프롬프트(GM, 하루 계획, 서술)에 그대로 들어감
status: draft          # draft | canon
sources: []            # 근거 카드 id (예: [ZEN-229])
tags: []
links: []              # 다른 요소와의 관계. 예: - { to: fac-joraga, rel: 거주 }
# location 만: 지도에 지역으로 올릴 때. 없으면 게임에 나오지 않는다 (world/README.md 지도)
# map: { x: 48, y: 36, terrain: forest }
# character, event 만: 게임 데이터 (world/README.md 게임 데이터)
# sim: { ... }
---

## 설정

세계관 속 모습과 이야기.

## 게임에서의 역할

<!--
종류별로 채울 것 (해당하는 것만):
- location: 지역 구분, 얻을 수 있는 자원, 위험 요소, 할 수 있는 일(일, 휴식, 거래 등)
- creature: 위협도, 행동 패턴, 서식지(loc-), 사냥/길들이기 가능 여부
- character: 성격, 목표, 말투, 하루 일과, 플레이어와의 관계 (`sim` 의 persona/goal/routine 재료)
- faction: 목표, 거점(loc-), 다른 세력과의 관계, 가입 조건
- item: 효과, 구하는 방법, 가치
- event: 발생 조건, 효과, 빈도
- law: 규칙 내용, 게임 시스템에 미치는 영향
-->

## 미정/질문

- 
