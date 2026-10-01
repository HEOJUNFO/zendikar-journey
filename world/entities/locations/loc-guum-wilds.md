---
id: loc-guum-wilds
kind: location
name: 굼 밀림
name_en: Guum Wilds
summary: 발라 게드의 대부분을 덮은 습한 우림. 거목 꼭대기에 멀 다야 엘프의 마을들이 걸려 있고, 그 깊은 곳에 거목 마을 리버루트가, 가운데에 묻힌 유적이, 땅속에 칼니 심장이, 동쪽 가장자리에 우멍 강 어귀의 보주카 만이 있다
status: canon
sources: [ZEN-172, ZEN-159, ZEN-98, ZEN-32, ZEN-91]
tags: [우림, 밀림, 엘프, 멀 다야, 녹색]
links:
  - { to: spl-grim-discovery, rel: 가르치는 주문 (묻힌 유적의 음산한 발견) }
  - { to: spl-hideous-end, rel: 묻힌 유적의 우상에서 배우는 주문 (흉측한 최후) }
  - { to: loc-bala-ged, rel: 바깥 지역 }
  - { to: loc-riverroot, rel: 안의 구역 (멀 다야의 마을) }
  - { to: loc-bojuka-bay, rel: 안의 구역 (가장자리의 만) }
  - { to: evt-summoning-trap, rel: 가운데 묻힌 유적의 함정 }
  - { to: evt-pitfall-trap, rel: 서쪽 숲 바닥의 구덩이 함정 }
  - { to: chr-bala-ged-thief, rel: 유적을 터는 도적 }
  - { to: chr-ob-nixilis, rel: 칼니 심장을 찾는 악마 }
  - { to: cre-zendikar-farguide, rel: 밀림을 헤치며 걷는 정령 }
  - { to: itm-beastmaster-ascension, rel: 밀림의 승천 }
map: { in: loc-bala-ged, terrain: forest, pos: [0.3, 0.05], tiles: 70 }   # 기본 숲 [결정] 2026-10-01. 발라 게드 대부분 [배경]: 70칸은 안의 리버루트·보주카 만 포함. 동쪽 해안까지는 [가공]
---

## 설정

발라 게드의 대부분을 덮은 습하고 무더운 우림 ([배경] MTG 위키, A Planeswalker's Guide to Zendikar: Bala Ged and Elves). 멀 다야 엘프는 이 밀림의 거목 꼭대기에 마을을 짓고 산다. 그 가운데 하나가 거목 하나에 통째로 지은 리버루트 마을이다 ([배경] 매직 스토리 "Beneath Riverroot Tree").

## 게임에서의 역할

- **발라 게드 안의 구역**이다 (지형 `forest`) ([결정] 2026-10-01: 멀 다야의 신탁자 ZEN-172 에서, 사용자 요청으로 더함). 처음엔 북쪽 안쪽 40칸이었다가, 같은 날 세계를 설정대로 정리하며 **발라 게드 대부분(70칸)**으로 키웠다. **그 안에 다시 구역 리버루트(`loc-riverroot`, 10칸)와 보주카 만(`loc-bojuka-bay`, 10칸)을 품는다**: 구역 안의 구역.
- **기본 숲**처럼 친다: 유대를 맺으면 녹 마나 1, 숲 종류.
- 자리: 발라 게드 가운데에서 동쪽 해안까지(`pos: [0.3, 0.05]`). 남서쪽 언덕의 탱글드 베일과, 굴 드라즈 쪽 서쪽·북쪽 가장자리(발라 게드 본토 40칸)만 굼 밖이다 ([가공]).
- 가운데에 옛 석조 유적이 묻혀 있고 소환 함정(`evt-summoning-trap`)이 숨어 있다. 바로 곁에 발라 게드의 도둑(`chr-bala-ged-thief`)이 산다.
- 땅속 동굴 깊은 곳에 칼니 심장이 있다 ([배경]: 굼 밀림 어딘가, 대부분 땅속). 불꽃을 잃은 오브 닉실리스(`chr-ob-nixilis`)가 그 어귀에 머문다.
- 남동쪽 깊은 곳을 젠디카르 길잡이(`cre-zendikar-farguide`)가 헤치며 걷는다.
- 동쪽 깊은 곳에 야수조련사의 승천(`itm-beastmaster-ascension`, ZEN-159)이 서 있다: 부리는 것들이 덤빌 때마다 탐색이 쌓이고, 일곱이면 부리는 것 모두 +5/+5.

- 서쪽 숲 바닥의 한 칸에 구덩이 함정(`evt-pitfall-trap`, ZEN-32)이 숨어 있다 ([결정] 2026-10-01). 그 칸에서 홀로 덤벼드는 자가 날지 못하면 독 가시 구덩이에 떨어져 죽는다.

- 음산한 발견(`spl-grim-discovery`, ZEN-91)을 배울 수 있다 (4시간, [결정] 2026-10-01): 무덤의 생물 하나를 되살리고(자유롭게), 끊겼던 땅 하나를 손에 쥔다.

## 미정/질문

- 굼 밀림의 다른 마을과 늪(보더마이어): 그 카드가 나오면.
