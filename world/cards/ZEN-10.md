---
id: ZEN-10
order: 92
name_en: "Devout Lightcaster"
name_ko: "독실한 빛술사"
set: ZEN
number: 10
mana_cost: "{W}{W}{W}"
type_line: "Creature — Kor Cleric"
pt: "2/2"
rarity: rare
artist: "Shelly Wan"
scryfall: https://scryfall.com/card/zen/10/devout-lightcaster
added: 2026-10-01
entities: [chr-devout-lightcaster, loc-arid-mesa]
---

## 카드 원문

**규칙 텍스트**

> Protection from black
> When this creature enters, exile target black permanent.

**플레이버 텍스트**

> "Goddess, grant us light to banish the world's shadows."
> —Prayer to Kamsa

## 해석

출처: [카드] 규칙·플레이버 텍스트와 카드 정보, [그림] 일러스트, [배경] 카드 밖의 MTG 배경지식, [가공] 게임을 위해 정한 것, [결정] 사용자 결정.

- 백색 생물 — 코르 성직자, 2/2. 흑색으로부터 보호. 들어올 때 흑색 지속물 하나를 추방. [카드]
- 플레이버: 캄사께 올리는 기도, "세상의 그림자를 몰아낼 빛을". [카드]
- 두 손에서 금빛을 터뜨리는 코르 여인, 물러서는 촉수 달린 검은 그림자. [그림]
- 캄사 = 코르의 하늘 여신, 캄사의 사제들은 메마른 메사를 순례. [배경] → 메마른 메사에 산다. [결정] 2026-10-01
- 말하는 코르 성직자 (권속이 될 수 있다). [가공]
- 들어올 때 = 그날 첫 도착 (대응 표). 대상은 그 칸, 있으면 반드시 하나. 존재의 추방 = 플레이어가 끼면 세계에서 지워짐, NPC끼리면 죽음. [결정] 2026-10-01
- 흑색 땅의 추방 = 그 이와의 유대가 영영 끊김. [결정] 2026-10-01

## 반영 내역

- `chr-devout-lightcaster` (새 인물): 메마른 메사, 2/2, 마나 백 3, `protection: [B]`, `enter_exile: { color: B }`.
- 새 규칙 `sim/banish.ts` (`banishOptions`, `enterExile`, `applyExile`): `onEnter` 가 부르고, 고를 것 `exile` (`sim/run.ts` LLM `pick`, `sim/asks.ts`). 땅의 추방은 `Actor.exiledLands` (`bondBlocked`, `fetchTargets`, `searchTargets`, `topBlocked` 이 막음).
- `loc-arid-mesa`: 순례하는 사제 링크.
