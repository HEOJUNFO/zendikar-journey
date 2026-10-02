---
id: ZEN-14
order: 144
name_en: "Journey to Nowhere"
name_ko: "무로의 여정"
set: ZEN
number: 14
mana_cost: "{1}{W}"
type_line: "Enchantment"
rarity: common
artist: "Warren Mahy"
scryfall: https://scryfall.com/card/zen/14/journey-to-nowhere
added: 2026-10-02
entities: [spl-journey-to-nowhere, loc-emeria, law-permanents]
---

## 카드 원문

**규칙 텍스트**

> When this enchantment enters, exile target creature.
> When this enchantment leaves the battlefield, return the exiled card to the battlefield under its owner's control.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 부여마법 {1}{W}. 들어올 때 대상 생물을 추방하고, 이것이 떠나면 추방된 카드가 소유자의 조종으로 돌아온다. [카드] 플레이버 없음.
- 나무 터널 같은 빛의 소용돌이 속으로, 하늘과 들판의 풍경이 되어 녹아드는 사람. [그림]
- 지명 확인: 카드에 지명 없음. [새 지역 후보] 없음.
- 배우는 곳: 에메리아. [결정] 2026-10-02
- 추방 = 어디에도 없는 곳: 세계에서 사라져 아무도 닿지 못하고 시간이 흐르지 않음(시간 밖처럼). 몸에 붙은 것과 섬기던 이를 잃고, 토큰은 영영 사라짐. 플레이어도 걸릴 수 있음(돌아올 때까지 기다림). [결정] 2026-10-02 / [가공]
- 부여마법은 시전자가 지닌 오라처럼 침 (부수기·되돌리기·바치기가 닿음). [결정] 2026-10-02
- 돌아옴: 그 부여마법이 사라지면(부서짐, 되돌려짐, 바쳐짐, 시전자가 죽거나 차원을 떠남), 사라졌던 칸에 누구도 섬기지 않고 다시 섬. [결정] 2026-10-02

## 반영 내역

- `spl-journey-to-nowhere` (새 주문): 에메리아에서 4시간, {1}{W}, 부여마법(한가할 때만), `target: other_here`, `exile_until`.
- `loc-emeria`: 가르치는 주문 링크.
- 새 주문 효과 `exile_until` (`sim/nowhere.ts`): `Actor.nowhere`, 시전자의 오라(`auras[].nowhere`), `outOfTime` 이 걸린 이를 시간 밖으로 침, 매시간 `nowhereHour` 가 부여마법이 사라졌는지 보고 돌려보냄.
