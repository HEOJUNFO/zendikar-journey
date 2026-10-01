---
id: ZEN-32
order: 116
name_en: "Pitfall Trap"
name_ko: "구덩이 함정"
set: ZEN
number: 32
mana_cost: "{2}{W}"
type_line: "Instant — Trap"
rarity: uncommon
artist: "Franz Vohwinkel"
scryfall: https://scryfall.com/card/zen/32/pitfall-trap
added: 2026-10-01
entities: [evt-pitfall-trap, loc-guum-wilds, law-ruin-traps]
---

## 카드 원문

**규칙 텍스트**

> If exactly one creature is attacking, you may pay {W} rather than pay this spell's mana cost.
> Destroy target attacking creature without flying.

**플레이버 텍스트**

> Each spike is poisoned—the trapmaker's idea of mercy.

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 순간마법 — 함정 {2}{W}. 정확히 한 생물이 공격 중이면 {W}로 대신. 비행이 없는 공격 생물 하나를 파괴. [카드]
- 플레이버: 가시마다 독이 발려 있다, 함정꾼 나름의 자비. [카드]
- 구덩이 바닥에서 올려다본 가시와 덩굴 그물, 그 너머 밀림 빛. [그림]
- 지명 없음, [새 지역 후보] 없음.
- 함정 = 땅에 깔린 사건, 대체 비용 조건 = 발동 조건 (화살 세례·무기력 함정과 같은 대응).
- 자리: 굼 밀림 서쪽 숲 바닥. [결정] 2026-10-01 (방위는 [가공])
- 범위: 구덩이가 숨은 한 칸에서만 (땅 전체면 일대일 싸움마다 터지므로). [결정] 2026-10-01
- 함정은 NPC끼리도 죽인다 (기존 규칙). 날 수 있으면 무사.

## 반영 내역

- `evt-pitfall-trap` (새 함정): 굼 밀림 `pos: [-0.5, 0.2]`, `trigger: attacked`, `attackers: 1`, `exactly`, `on_tile`, `destroy_attackers` 의 `no_fly`.
- `loc-guum-wilds`, `law-ruin-traps`: 함정 링크.
- `attacked` 사건에 `exactly`·`on_tile`, 새 사건 효과 `destroy_attackers` (`step.ts`).
