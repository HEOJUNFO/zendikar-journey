---
id: ZEN-61
order: 82
name_en: "Rite of Replication"
name_ko: "복제의 의식"
set: ZEN
number: 61
mana_cost: "{2}{U}{U}"
type_line: "Sorcery"
rarity: rare
artist: "Matt Cavotta"
scryfall: https://scryfall.com/card/zen/61/rite-of-replication
added: 2026-10-01
entities: [spl-rite-of-replication, loc-sea-gate]
---

## 카드 원문

**규칙 텍스트**

> Kicker {5} (You may pay an additional {5} as you cast this spell.)
> Create a token that's a copy of target creature. If this spell was kicked, create five of those tokens instead.

**플레이버 텍스트**

> (없음)

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 청색 집중마법, 킥커 {5}. 대상 생물의 복사본 토큰 하나, 킥커면 다섯. [카드]
- 푸른 물속에서 인어 여자가 두 팔을 벌리고, 그녀를 빼닮은 반투명한 형상들이 둘레에 떠 있다: 물로 분신을 빚는 의식. [그림]
- 젠디카르의 인어는 청색이고 타짐 해안의 바다 관문에 산다. [배경] → 바다 관문에서 배운다 (4시간). [결정] 2026-10-01
- 복사본 = 원본의 카드 그대로(이름, 기본 몸, 키워드, 능력, 색, 마나, 필요)인 분신이 시전자의 권속으로 난다. 카운터·오라·그날 힘·피해·기억·주문·유대는 복제되지 않는다. [카드] MTG의 복사 가능한 값
- 말하는 이의 분신은 원본의 성품과 목표를 지니고 말하되, 원본의 기억 없이 시전자를 섬긴다. [결정] 2026-10-01
- 플레인즈워커 빼고 누구든 복제할 수 있다. 카드 없는 플레이어는 타고난 몸과 땅의 색으로. [결정] 2026-10-01
- 분신은 토큰: 무덤에 들지 않고, 원본 토큰의 자정에 사라짐은 복제되지 않는다. 분신의 들어설 때 능력은 곧바로 일어난다. [카드] MTG 규칙

## 반영 내역

- `spl-rite-of-replication` (새 주문): 바다 관문, {2}{U}{U}, `target: any_here`, 킥커 {5}, `copy_target` (`count: 1`, `kicked_count: 5`).
- 새 효과 `copy_target` (`sim/replicate.ts` 의 `replicate`, `copyable`): 원본의 정의(`npcDef`, 없으면 플레이어의 몸)를 본뜬 토큰 정의(`NpcDef.copyOf`)를 만들고 시전자의 권속으로 묶는다(`bindRetainer`: 동료면 무리 발동), 들어설 때 능력(`onEnter`).
- 게임 중 생긴 이(토큰)의 탭 능력도 아침 LLM이 쓸 수 있게 했다 (`usableAbilities`: 칼리타스의 분신).
- `loc-sea-gate`: 배우는 주문 링크.
