# zendikar-journey

젠디카르(MTG) 세계관 속에서 플레이어가 가상의 인생을 사는 LLM 기반 세계 시뮬레이션.
세계가 턴 단위로 흘러가고, 플레이어는 지켜보거나(관찰자) 한 인물로 살아간다(인물 모드).

## 구조

- `world/`: 세계관 원본이자 게임 데이터. 카드 1장 = `cards/` 파일 1개, 세계 요소 = `entities/<종류>/` 파일. 규칙은 `world/README.md`.
- `sim/`: 시뮬레이션 엔진 (Node/TS, I/O 없는 순수 로직 위주). `sim/llm/`: GPT/Gemini 호출.
- `server/`: 게임 서버. JSON API와 웹 UI를 한 프로세스에서 제공하고, 게임을 `saves/current.json` 에 저장한다.
- `web/`: React UI. 지역 노드 지도, 이야기 로그, 행동 컨트롤로 이루어진다. `sim/` 의 타입과 순수 함수를 같이 쓴다.
- `tools/`: 세계관 검사(`world-check.mjs`), 지도 미리보기(`world-map.mjs`), 카드 불러오기(`card.mjs`).

Node 24 가 `.ts` 를 바로 실행한다 (type stripping). 그래서 import 에 `.ts` 확장자를 붙이고, 타입은 `import type` 으로 가져오고, enum 이나 parameter property 같은 지울 수 없는 TS 문법은 쓰지 않는다 (`tsconfig.json` 의 `erasableSyntaxOnly`).

## 세계관 구축 방식 (중요)

사용자가 카드를 한 장씩 보여주면 그 카드에서 나온 요소만 추가한다. 세계를 한 번에 지어내지 않는다.

1. 카드 원문을 `world/cards/<세트>-<번호>.md` 에 기록 (`world/_templates/card.md`).
2. 해석과 반영 계획을 사용자에게 먼저 보여주고 확인받는다. 게임에서 어떻게 움직일지(`map`, `sim`)도 계획에 넣는다.
3. 확인되면 `world/entities/` 에 요소를 만들거나 보강하고, 카드의 `entities` 와 요소의 `sources` 를 서로 연결한다.
4. 지역이 생겼으면 `npm run world:map`. 그리고 `npm run world:check` 통과시킨다.
5. 기존 설정과 연결되는 점, 부딪히는 점을 짚는다.
6. 카드 하나당 커밋 하나를 만들고 (`카드 ZEN-xxx: <이름>`) 곧바로 `origin main` 으로 푸시한다.

## 실행

```sh
npm run dev          # http://localhost:5173 (PORT 로 변경)
npm test             # node:test, sim/**/*.test.ts
npm run typecheck
npm run world:check
```

게임을 처음부터 다시 하려면 UI의 "새 게임"을 누른다 (또는 `saves/current.json` 삭제). 서버가 떠 있는 동안 카드를 반영하면 다음 요청 때 새 인물, 지역, 사건이 기존 저장에 합류한다. `sim/`, `server/` 코드를 고쳤으면 서버를 다시 띄운다.

## LLM

- OpenAI 호환 API. **운영은 GPT, 테스트는 Gemini** (`sim/llm/chat.ts`). Claude는 쓰지 않는다.
- 설정은 저장소 루트의 `.env` (git 에 올리지 않음):
  - `CHAT_PROVIDER=gemini` + `GEMINI_API_KEY` (+ 선택 `GEMINI_CHAT_MODEL`, 기본 `gemini-2.5-flash`)
  - `CHAT_PROVIDER=openai` + `OPENAI_API_KEY` (+ 선택 `OPENAI_CHAT_MODEL`, 기본 `gpt-5-mini`)
  - 선택 `CHAT_REASONING_EFFORT` (low 등). 추론 모델용이며, 설정하지 않으면 보내지 않는다.
  - `SIM_LLM=off` 면 키가 있어도 LLM 없이 돌린다.
  - 기본 모델명은 추정값이다. 키를 넣은 뒤 실제 사용 가능한 모델명인지 확인할 것.
- `CHAT_PROVIDER` 가 없으면 규칙만으로 돌아간다. 일과는 평소대로, 사건은 확률로 일어나고, 로그는 엔진 문장 그대로 나온다. 자유 입력과 NPC 대답만 쓸 수 없다.
- LLM이 맡는 일 (`sim/llm/`): 모든 답은 zod로 검증하고, 실패하면 규칙으로 되돌아간다. **상태를 바꾸는 결정은 엔진(코드)이 한다.** LLM은 정의된 선택지 안에서 고르거나 글을 쓸 뿐이다.
  - `gm.ts`: 아침마다 오늘 일어날 사건을 고른다. `world/` 에 정의된 사건만 고를 수 있다.
  - `planner.ts`: NPC마다 하루 일정을 짠다 (게임 하루에 NPC당 1번 호출).
  - `narrate.ts`: 턴에서 일어난 일을 서술한다. 인물 모드는 2인칭, 관찰자 모드는 연대기 문체다.
  - `interpret.ts`: 플레이어의 자유 입력을 행동(`sim/actions.ts`) 하나로 바꾼다.
  - `reply.ts`: NPC가 캐릭터를 유지하며 플레이어에게 대답한다.

## 시뮬레이션 엔진 (`sim/`)

- **턴제**: 시간은 `sim/run.ts` 에서만 흐른다. 관찰자는 N시간을 진행하고(`advance`), 플레이어는 행동하면 그 행동이 끝날 때까지 세계가 돈다(`act`). 한 틱은 게임 1시간이고, 새 게임은 1일차 06:00 에 시작한다.
- **세계** (`world.ts`, `load.ts`): `world/entities` 의 canon 요소에서 만든다. location 의 `map` 은 지역, character 의 `sim` 은 NPC, event 의 `sim` 은 사건이 된다.
- **한 틱** (`step.ts`, LLM 없음, 결정적): GM 사건 → 세력(아직 없음) → 지역 상태 → 인물 → 만남 순으로 처리한다.
  - 사건: 전조(`omen`)가 있으면 1시간 뒤에 터진다. `enter` 사건은 머무는 이들의 속도(`pace`)에 따라 확률이 바뀐다.
  - 인물: 일정 블록의 지역이 다르면 이동한다. 이동 시간은 거리 ÷ 4 시간이다. 블록 종류에 따라 스탯(기력, 배고픔, 돈)이 바뀐다 (`rules.ts`). 기력이 0이 되면 쓰러져 6시간 잔다.
  - 이동: 공중섬(`sky`)은 비행이 필요하고, 바다(`deepsea`)는 들어갈 수 없다. `blocks_travel` 상태인 지역도 오갈 수 없다.
  - 만남: 같은 지역에서 둘 다 식사나 사교 중인 NPC는 하루 한 번 마주친다 (로그만 남음. NPC끼리 대화는 아직 없다).
- **상태** (`state.ts`): JSON 그대로 저장한다. 난수도 상태에 들어 있어서 같은 저장은 같은 결과를 낸다. 로그 항목마다 플레이어가 보았는지(`seen`)를 기록하고, 인물 모드 UI는 본 것만 보여준다.
- **플레이어 행동** (`actions.ts`): 이동, 쉬기, 탐색(조심/평소/서둘러), 먹기, 기다리기, 대화. 자기 지역에서 전조나 사건이 일어나면 하던 일을 멈추고 선택을 돌려받는다.

아직 없는 것: 세력, 이동 수단(배, 항로), NPC끼리의 대화, 하루 회고, 인물의 기억, 지역 안의 세부 구역, 탐색으로 얻는 것(아이템, 발견).
