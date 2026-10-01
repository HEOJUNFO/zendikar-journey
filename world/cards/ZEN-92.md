---
id: ZEN-92
order: 63
name_en: "Guul Draz Specter"
name_ko: "굴 드라즈 망령기사"
set: ZEN
number: 92
mana_cost: "{2}{B}{B}"
type_line: "Creature — Specter"
pt: "2/2"
rarity: rare
artist: "Mark Tedin"
scryfall: https://scryfall.com/card/zen/92/guul-draz-specter
added: 2026-10-01
entities: [cre-guul-draz-specter, loc-guul-draz, chr-bala-ged-thief]
---

## 카드 원문

**규칙 텍스트**

> Flying
> This creature gets +3/+3 as long as an opponent has no cards in hand.
> Whenever this creature deals combat damage to a player, that player discards a card.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 흑색 망령, 2/2, 비행. 상대가 손에 카드가 없는 동안 +3/+3. 플레이어에게 싸움 피해를 주면 그 플레이어는 카드 한 장을 버린다. [카드]
- 손이 빔 = 그날의 적 가운데 같은 칸에 선 이가 주문을 하나도 지니지 않음 → 5/5. [결정] 2026-10-01
- 버리기 = 주문 하나를 잊음 (잃는 이가 고름). 비밀은 버려지지 않는다: 이 카드에서 정하고 도둑(ZEN-79)도 주문만 뒤지게 고쳤다. [결정] 2026-10-01
- 두건 쓴 해골 기수가 사슬과 녹빛 등불을 들고 박쥐 날개의 검은 짐승을 타고 난다. [그림]
- 굴 드라즈에 산다 (이름). 흡혈귀와 언데드의 늪 대륙. [배경]
- 말하지 않고 먹지 않으며, 스스로 상대를 골라 덮친다 (늪의 누더기처럼). [가공]

## 반영 내역

- `cre-guul-draz-specter` (새 생물종, 하나): 굴 드라즈, 2/2, 흑 4, `beast`, `fly`, `empty_hand_pump: [3, 3]`, `discard_on_hit`, `needs: [energy]`.
- 새 능력 `sim.empty_hand_pump` (`combat.ts` 의 `refreshEmptyHand`, `Actor.emptyHand`), `sim.discard_on_hit` (`clash` 에서 `owesDiscard`).
- 이중 타격·선제공격 계산에서 이 합에 준 피해를 따로 센다 (`dealtA`/`dealtD`).
- 도둑(ZEN-79)의 손 뒤지기를 주문만으로 (`sim/discard.ts`).
- `loc-guul-draz`: 링크.
