---
id: ZEN-12
order: 12
name_en: "Felidar Sovereign"
name_ko: "펠리다르 군주"
set: ZEN
number: 12
mana_cost: "{4}{W}{W}"
type_line: "Creature — Cat Beast"
pt: "4/6"
rarity: mythic
artist: "Zoltan Boros & Gabor Szikszai"
scryfall: https://scryfall.com/card/zen/12/felidar-sovereign
added: 2026-09-30
entities: [cre-felidar, law-life, law-retainers, loc-sejiri]
---

## 카드 원문

**규칙 텍스트**

> Vigilance (Attacking doesn't cause this creature to tap.)
> Lifelink (Damage dealt by this creature also causes you to gain that much life.)
> At the beginning of your upkeep, if you have 40 or more life, you win the game.

**플레이버 텍스트**

> "If survival is a game, I've seen the winner."
> —Hazir, Sejiri cartographer

## 해석

- 뿔이 왕관처럼 솟고 불꽃 같은 갈기를 두른 거대한 고양이 짐승이, 눈 덮인 날카로운 바위 봉우리 위에 서 있다 [그림]. 백색 생물, 4/6 [카드].
- 이름의 "군주"(Sovereign): 이 개체는 짐승들의 군주다 [카드].
- 플레이버: 살아남는 일이 겨루기라면 그 승자를 보았다는 세지리 지도 제작자 하지르의 말 [카드]. 펠리다르는 살아남아 번성하는 자를 알아본다 [가공].
- 자리: 얼음 대륙 세지리 [결정] (그림의 설산 봉우리 + 플레이버의 세지리).
- 사냥하지 않는 짐승 [결정]: 말은 안 하지만 배고픔이 없어 사람을 덮치지 않는다.
- 경계: 이 게임은 공격해도 묶이지 않아 이미 성립 [결정].
- 생명연결: 싸움에서 준 피해만큼 통제자가 생명을 얻는다 [카드].
- "생명 40 이상이면 게임에서 이긴다": 처음엔 생명 1 = 기력 2.5 로 바꿔 기력 가득 = 생명 40 으로 했으나, 잠으로 기력이 차면 이겨 버려서 생명을 기력과 뗐다 [결정]: 20에서 시작, 저절로 돌아오지 않음, 0이면 죽음 (NPC가 NPC에게서 앗으면 기절 후 1). 이긴 이는 세계의 승자로 남고 게임은 계속된다 [결정].
- 통제자: 펠리다르는 인정한 이를 따른다. 플레이어도 NPC도 [결정]. 주인 없는 짐승 자신은 이기지 않는다 [가공].

## 반영 내역

- `cre-felidar` (새 생물종, 게임 속 한 마리 "펠리다르 군주"): 세지리에 산다. 4/6, 백 6, 먹지 않고 돈을 쓰지 않음, `beast`, `tamable`, 능력 `vigilance`·`lifelink`, `wins_at_life: 40`.
- `law-life`: 생명을 기력과 뗌 (`Actor.life`, 시작 20, 회복 없음, 0이면 죽음). 생명연결, 승리를 더함. 다른 생명 효과 문서의 기력 수치를 뺌. 페치의 생명 값은 가진 생명보다 적을 때만.
- `law-retainers`: 따를 이를 고르는 짐승(인정), NPC의 `court` 블록.
- `loc-sejiri`: 펠리다르 군주가 사는 곳.
- 엔진: `sim/win.ts` (00:00 승리 확인, `state.winners`), `combat.ts` 생명연결, `retainers.ts` 의 `courtTargets`/`courtBlocked`/`readyCourt`, 계획의 `court` 블록, `run.ts` 의 `followChoice`, 짐승의 몸짓 대답(`reply.ts` 의 `beast`). 웹: 세계의 승자 표시, 플레이어의 생명 표시.
