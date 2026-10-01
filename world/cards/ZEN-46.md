---
id: ZEN-46
order: 96
name_en: "Gomazoa"
name_ko: "고마조아"
set: ZEN
number: 46
mana_cost: "{2}{U}"
type_line: "Creature — Jellyfish"
pt: "0/3"
rarity: uncommon
artist: "Chippy"
scryfall: https://scryfall.com/card/zen/46/gomazoa
added: 2026-10-01
entities: [cre-gomazoa, loc-tazeem]
---

## 카드 원문

**규칙 텍스트**

> Defender, flying
> {T}: Put this creature and each creature it's blocking on top of their owners' libraries, then those players shuffle.

**플레이버 텍스트**

> To explorers, "point man" is a polite way of saying "gomazoa fodder."

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 생물 — 해파리, 0/3. 수비대, 비행. {T}: 이것과 이것이 막고 있는 생물 모두를 주인의 서고 맨 위에 놓고 섞는다. [카드]
- 플레이버: 탐험가들에게 '선두'란 '고마조아 먹이'를 점잖게 이르는 말이다. [카드]
- 떠 있는 바위섬들 사이 하늘에 매달린 거대한 해파리, 붉은 촉수가 칼 든 탐험가를 휘감아 끌어올린다. [그림]
- 타짐 본토, 북쪽 떠 있는 바위 사이 하늘에 산다. [결정] 2026-10-01 (방위는 [가공])
- 지명이 없어 [새 지역 후보]는 없다.
- 파리지옥 같은 짐승: 먹지만 수비대라 먼저 덮치지 않고, 덤벼든 것을 붙잡아 먹는다. [결정] 2026-10-01
- 막음 = 그에게 덤빈 이, 곁에 선 주인에게 먼저 덤빈 이. [가공]
- 서고 맨 위 = 촉수로 휘감아 함께 고마조아의 거처로 끌려감. 둘 다 몸에 붙은 힘과 섬기던 이를 잃고(서고로 갔다 돌아온 것), 토큰은 먹혀 사라진다. 끌려간 이는 4시간 촉수에 묶이고, 고마조아는 배를 채우고 자정까지 탭(묶임). [결정] 2026-10-01: "어딘가로 끌려가지는 느낌", 거처로
- 정하는 이: 주인 없으면 파리지옥처럼 저절로, 주인이 있으면 주인(NPC는 LLM, 플레이어는 고를 것). [가공]

## 반영 내역

- `cre-gomazoa` (새 생물종, 한 마리가 산다): 타짐 `home_pos: [-0.1, -0.65]`, 0/3, 마나 청 3, 짐승, `abilities: [defender, fly]`, `engulf: true`.
- `loc-tazeem`: 사는 해파리 링크.
- 새 규칙 `engulf` (`sim/engulf.ts`, 싸움이 이어지는 시간 전 `run.ts` 의 `engulfs`, 고를 것 `engulf`). 채찍 함정의 힘 떨어뜨리기를 `shed`/`vanishToken` 으로 나눠 같이 씀.
