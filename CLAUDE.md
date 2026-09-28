# zendikar-journey

젠디카르(MTG) 세계관 속에서 플레이어가 가상의 인생을 사는 LLM 기반 시뮬레이션.

## 구조

- `world/`: 세계관 원본. 카드 1장 = `cards/` 파일 1개, 세계 요소 = `entities/<종류>/` 파일. 규칙은 `world/README.md`.
- `game/`: [AI Town](https://github.com/a16z-infra/ai-town) 포크 (upstream 커밋 `8e05997`, 2026-08-25). 2D 마을 + NPC 에이전트 + 플레이어 참여.
- `tools/world-check.mjs`: world/ 형식·참조 검사.

## 세계관 구축 방식 (중요)

사용자가 카드를 한 장씩 보여주면 그 카드에서 나온 요소만 추가한다. 세계를 한 번에 지어내지 않는다.

1. 카드 원문을 `world/cards/<세트>-<번호>.md` 에 기록 (`world/_templates/card.md`).
2. 해석과 반영 계획을 사용자에게 먼저 보여주고 확인받는다.
3. 확인되면 `world/entities/` 에 요소를 만들거나 보강하고, 카드의 `entities` 와 요소의 `sources` 를 서로 연결한다.
4. `npm run world:check` 통과시킨다.
5. 기존 설정과 연결되는 점, 부딪히는 점을 짚는다.

## 실행

```sh
npm run up          # Docker: Convex 백엔드(:3210), 임베딩용 Ollama, 대시보드(:6791)
npm run dev         # game/ 프론트엔드 + convex dev
npm run world:check
```

게임 월드 초기화(NPC 생성)는 `cd game && npm run predev`. API 키 설정 후에 할 것.

## LLM

- 채팅: OpenAI 호환 API. **운영은 GPT, 테스트는 Gemini** (`game/convex/util/hostedChat.ts`). Claude는 쓰지 않는다.
  - `CHAT_PROVIDER=gemini` + `GEMINI_API_KEY` (+ 선택 `GEMINI_CHAT_MODEL`, 기본 `gemini-2.5-flash`)
  - `CHAT_PROVIDER=openai` + `OPENAI_API_KEY` (+ 선택 `OPENAI_CHAT_MODEL`, 기본 `gpt-5-mini`)
  - 선택 `CHAT_REASONING_EFFORT` (low 등). 추론 모델용이며, 설정하지 않으면 보내지 않는다.
  - 기본 모델명은 추정값이다. 키를 넣은 뒤 실제 사용 가능한 모델명인지 확인할 것.
- 임베딩: Docker 안의 Ollama `bge-m3` (1024차원). 채팅 공급자를 바꿔도 NPC 기억이 호환되도록 고정했다.
  `LLM_PROVIDER=ollama` 는 반드시 유지해야 한다. OPENAI_API_KEY 가 있으면 AI Town이 임베딩까지 OpenAI(1536차원)로 보내려 하기 때문이다.
- 설정: `cd game && npx convex env set <이름> <값>`

## NPC 인생 엔진 (`game/convex/life/`)

AI Town의 무작위 배회와 끊임없는 NPC 대화를 대체한다. NPC는 일정표대로 산다.

- **게임 시계** (`clock.ts`, `World.advanceClock`): 실제 1초 = 게임 1분, 게임 하루 = 실제 24분. 월드가 멈추면 시계도 멈춘다.
- **장소** (`data/places.ts`): 이름이 붙은 장소와 서 있을 좌표 목록. 지금은 기본 맵 위의 임시 장소 7곳이고, 나중에 `world/entities/locations` 와 연결한다 (`entityId`). 좌표를 바꾸면 `node --experimental-strip-types scripts/checkPlaces.mjs` 로 걸을 수 있는지, 서로 이어지는지 검사한다.
- **평소 일과** (`data/characters.ts` 의 `life`): 역할, 집, 하루 일정 블록 `[시작, 끝, 장소, 종류, 활동, 이모지]`. 지금은 AI Town 기본 캐릭터 5명의 임시 일과다.
- **하루 계획** (`planner.ts`, 작업 `agentPlanDay`): 게임 하루마다 NPC당 LLM을 1번 호출한다. 성격, 목표, 스탯을 보고 일정을 짜고, 결과를 zod로 검증한다. 실패하면 평소 일과를 그대로 쓴다.
- **실행** (`executor.ts`, LLM 없음): 현재 블록의 장소로 걸어가서 활동을 표시하고, 블록 종류에 따라 스탯(기력, 배고픔, 돈)을 바꾼다 (`rules.ts`).
- **NPC끼리 대화**: 둘 다 같은 장소에서 social/eat 블록 중이고, 4칸 안에 있고, 오늘 서로 대화한 적이 없을 때만 시작한다. 확률로 정하지 않는다. 사람 플레이어와의 대화는 AI Town 방식 그대로다.
- 끄고 켜기 (Convex env): `LIFE_NPC_CHAT=off` 이면 NPC끼리 대화하지 않는다. `LIFE_LLM_PLANNING=off` 이면 LLM 계획 없이 평소 일과만 쓴다.
- 상태 확인: `cd game && npx convex run life/debug:state`
- 테스트: `cd game && npm test -- convex/life`

아직 없는 것: 하루를 마치며 하는 회고, GM 사건, 플레이어 인생 스탯, 시야 밖 NPC의 간략 시뮬레이션.

## AI Town에서 바꾼 것

- `convex/util/llm.ts` + `hostedChat.ts`: `CHAT_PROVIDER` 가 있으면 채팅만 GPT/Gemini로 보낸다. max_tokens 하한, temperature와 stop 제거, stop word는 로컬에서 자른다.
- `convex/util/embeddingDimension.ts`: 임베딩 차원 상수 분리. `agent/schema.ts` 는 npm 의존성이 섞인 모듈을 import하면 Convex 스키마 평가가 실패해서.
- `docker-compose.yml`: 임베딩용 `ollama` 서비스 추가, 호스트 11434 포트 매핑 제거 (로컬 Ollama와 충돌).
- `convex/aiTown/agent.ts`: life 프로필이 있는 에이전트는 `agentDoSomething` 대신 `lifeTick` 을 쓴다. 대화 기억(`toRemember`)을 먼저 처리하도록 순서를 바꿨고, `schedule`/`stats`/`talkedWith` 필드를 추가했다.
- `world.ts`(clock), `game.ts`(시계 진행), `agentDescription.ts`(life), `agentOperations.ts`(agentPlanDay), `agentInputs.ts`(finishPlanDay).
- `src/components/LifePanel.tsx`: 게임 시계, NPC의 역할, 스탯, 오늘 일정을 표시한다.
