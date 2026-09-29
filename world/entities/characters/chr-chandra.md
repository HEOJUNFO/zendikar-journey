---
id: chr-chandra
kind: character
name: 찬드라, 불꽃의 방랑자
name_en: Chandra Ablaze
summary: 차원을 넘나드는 불의 마법사. 붉은 머리칼과 고글, 온몸의 불길. 용암 협곡을 헤매며 무언가를 찾는다
status: canon
sources: [ZEN-120]
tags: [플레인즈워커, 전설, 적색, 불]
links:
  - { to: loc-lava-chasm, rel: 헤매는 곳 }
  - { to: law-planeswalkers, rel: 플레인즈워커 }
  - { to: law-mana-colors, rel: 적색의 존재 }
sim:
  gm: true
  home: loc-lava-chasm   # [배경] 우긴의 눈을 찾아 아쿰(화산 지대)을 헤맴
  pt: [0, 5]             # 싸움에서 주먹으로 맞서지 않는다 ([가공]). 5는 충성도
  mana: { R: 6 }         # 카드 {4}{R}{R}
  loyalty: 5             # 카드 충성도 5 = 불꽃의 기세
  knows_colors: [R]      # 세계의 적색 주문을 모두 지닌다 ([가공], 불의 마법사)
  activated:
    - id: hurl-flame
      name: 불꽃 던지기
      loyalty: 1
      effects:
        - { type: discard_spell, if_color: R, damage: 4 }
    - id: burn-memory
      name: 기억을 태우는 불길
      loyalty: -2
      target: false
      effects:
        - { type: wheel, draw: 3 }
    - id: rekindle
      name: 되살아나는 불꽃
      loyalty: -7
      effects:
        - { type: flashback, color: R }
---

## 설정

차원을 넘나드는 불의 마법사 ([카드] 플레인즈워커, [배경]). 붉은 머리칼이 불길처럼 치솟고, 이마에 고글을 올려 쓰고, 붉은 갑옷을 걸쳤다. 두 주먹과 온몸이 불길에 휩싸인 채 포효한다 ([그림]).

젠디카르에 온 그녀는 화산 지대를 헤매며 무언가를 찾는다 ([배경] 우긴의 눈). 지금은 용암 협곡에 머문다.

## 게임에서의 역할

- GM이 움직이는 존재 (`sim.gm`)로, 용암 협곡에 머문다. 걸어서 만나 말을 걸거나 싸울 수 있다.
- **기세 5** (충성도, `law-planeswalkers`): 능력은 하루 한 번. 싸움에서 입은 피해는 기세에서 빠지고, 기세가 0이 되면 이 차원을 떠난다 (죽지 않는다). 주먹으로 맞서지는 않는다 (공격력 0, [가공]).
- **손패 = 지닌 주문**: 세계의 적색 주문을 모두 지닌다. 지금은 적색 주문이 없어 손이 비어 있다.
- **+1 불꽃 던지기**: 지닌 주문 하나를 불살라 날린다. 적색이면 대상(세계 어디의 누구든)에게 피해 4. 손이 비면 기세만 오른다.
- **−2 기억을 태우는 불길**: 그녀가 있는 곳의 모두(그녀 포함)가 지닌 주문을 잊고, 세계의 주문 중 셋을 무작위로 떠올린다.
- **−7 되살아나는 불꽃**: 잊은 적색 주문을 모두 대상에게 값 없이 건다.
- GM이 아침 계획으로 능력과 대상을 고른다.

## 미정/질문

- 성격과 말투, 무엇을 찾는지: [배경] 말고는 카드에 없다.
- 차원을 떠난 뒤 돌아오는지.
- 적색 주문 카드가 나오면 그녀의 손에 들어간다.
