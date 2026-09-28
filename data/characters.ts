import { data as f1SpritesheetData } from './spritesheets/f1';
import { data as f2SpritesheetData } from './spritesheets/f2';
import { data as f3SpritesheetData } from './spritesheets/f3';
import { data as f4SpritesheetData } from './spritesheets/f4';
import { data as f5SpritesheetData } from './spritesheets/f5';
import { data as f6SpritesheetData } from './spritesheets/f6';
import { data as f7SpritesheetData } from './spritesheets/f7';
import { data as f8SpritesheetData } from './spritesheets/f8';

import type { LifeKind, LifeProfile, ScheduleBlock } from '../convex/life/types';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
// [start, end, placeId, kind, activity, emoji]; places are in data/places.ts.
export function routine(...rows: [string, string, string, LifeKind, string, string][]): ScheduleBlock[] {
  return rows.map(([start, end, placeId, kind, activity, emoji]) => ({
    start: minutes(start),
    end: minutes(end),
    placeId,
    kind,
    activity,
    emoji,
  }));
}

export type CharacterDescription = {
  name: string;
  character: string;
  identity: string;
  plan: string;
  life?: LifeProfile;
};

// NPCs of the plane. Empty until characters arrive from cards (world/entities/characters);
// each needs a `life` whose places exist in data/places.ts (generated from locations).
export const Descriptions: CharacterDescription[] = [
  // world/entities/characters/chr-iona.md (ZEN-13)
  {
    name: '이오나',
    character: 'f3',
    identity: `이오나는 하늘의 폐허 에메리아를 지키는 전설의 천사로, "에메리아의 방패"라 불린다. 빛을 두른 갑옷과 긴 검을 지니고 떠다니는 폐허 사이를 날며 그곳을 지킨다. 정의롭고 단호하며 과묵하고, 맹세하듯 짧고 장엄하게 말한다. 약한 자를 두고 물러서는 법이 없고, 악 앞에서는 결코 굽히지 않는다. 적의를 품은 자 앞에서는 한 가지 색의 마법을 봉인할 수 있다. 낯선 이는 먼저 경계하지만, 의로움을 보이는 이에게는 수호자로서 곁을 내어준다.`,
    plan: '에메리아와 그곳을 찾는 의로운 이들을 지킨다.',
    life: {
      role: '에메리아를 지키는 천사 수호자',
      home: 'loc-emeria',
      routine: routine(
        ['00:00', '05:00', 'loc-emeria', 'sleep', '날개를 접고 휴식', '🪽'],
        ['05:00', '06:00', 'loc-emeria', 'leisure', '새벽 기도', '🙏'],
        ['06:00', '06:30', 'loc-emeria', 'eat', '성소의 샘물 마시기', '💧'],
        ['06:30', '12:00', 'loc-emeria', 'work', '하늘 순찰', '🛡️'],
        ['12:00', '12:30', 'loc-emeria', 'eat', '성소의 샘물 마시기', '💧'],
        ['12:30', '18:00', 'loc-emeria', 'work', '폐허 수호', '⚔️'],
        ['18:00', '18:30', 'loc-emeria', 'eat', '성소의 샘물 마시기', '💧'],
        ['18:30', '21:00', 'loc-emeria', 'leisure', '폐허의 비문 읽기', '📜'],
        ['21:00', '24:00', 'loc-emeria', 'sleep', '날개를 접고 휴식', '🪽'],
      ),
    },
  },
];

export const characters = [
  {
    name: 'f1',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f1SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f2',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f2SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f3',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f3SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f4',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f4SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f5',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f5SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f6',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f6SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f7',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f7SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f8',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f8SpritesheetData,
    speed: 0.1,
  },
];

// Characters move at 0.75 tiles per second.
export const movementSpeed = 0.75;
