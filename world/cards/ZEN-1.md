---
id: ZEN-1
order: 129
name_en: "Armament Master"
name_ko: "무장의 달인"
set: ZEN
number: 1
mana_cost: "{W}{W}"
type_line: "Creature — Kor Soldier"
pt: "2/2"
rarity: rare
artist: "Steven Belledin"
scryfall: https://scryfall.com/card/zen/1/armament-master
added: 2026-10-01
entities: [chr-armament-master, loc-makindi, itm-grappling-hook, cre-kor-soldier, chr-devout-lightcaster, chr-kor-cartographer, chr-kor-hookmaster, chr-makindi-shieldmate, chr-kor-sanctifiers, spl-conquerors-pledge]
---

## 카드 원문

**규칙 텍스트**

> Other Kor creatures you control get +2/+2 for each Equipment attached to this creature.

**플레이버 텍스트**

> "We prepare for the known with daggers, rations, rope, and pitons. But we also prepare for the unknown with billycat tails, pikku roots, hedron chips . . ."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 병사, 2/2. 당신이 조종하는 다른 코르 생물은 이것에 붙은 장비 하나마다 +2/+2. [카드]
- 플레이버: 아는 것에는 단검·식량·밧줄·쐐기, 모르는 것에는 빌리캣 꼬리·피쿠 뿌리·헤드론 조각. [카드]
- 밧줄과 장대로 엮은 야영지, 갈고리 무기를 손질하는 백발의 코르, 둘레의 장비들. [그림]
- 코르 = 밧줄·갈고리의 유랑 부족. [배경] 지명 없음, [새 지역 후보] 없음.
- 자리: 마킨디 협곡 한가운데 야영지. [결정] 2026-10-01 (방위는 [가공])
- 말하는 코르, 설득으로 권속. 먹고 돈을 씀.
- 코르 생물 유형을 새로 두고 세계의 코르 모두에게 붙임 (빛술사, 지도 제작자, 갈고리술사, 방패동료, 정화자들, 서약의 코르 병사 토큰). [가공]
- "당신이 조종하는 다른 코르" = 조종하는 이 자신과 그 권속 가운데 그를 뺀 코르 (기존 대응). 장비 = 그가 맨 장비(지금은 코르의 갈고리).

## 반영 내역

- `chr-armament-master` (새 인물): 마킨디 `home_pos: [0, 0.1]`, 2/2, 마나 백 2, `types: [kor]`, `equip_anthem: { kind: kor, pt: [2, 2] }`.
- 생물 유형 `kor`, 코르 인물 다섯과 정복자의 서약 토큰(`create_retainers` 의 `types`)에 붙임.
- `loc-makindi`, `itm-grappling-hook`, `cre-kor-soldier`: 링크.
- 새 규칙 `equip_anthem` (`sim/monument.ts` 의 `anthemHour`).
