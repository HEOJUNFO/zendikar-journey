// Named places on the map. NPC schedules refer to these by id.
// Placeholders on the default AI Town map until Zendikar locations (world/entities/locations)
// arrive; `entityId` will link a place to its loc-* entity.
// Each spot must be a walkable tile, and a place needs several since two players
// can't stand on the same tile. Checked by `node scripts/checkPlaces.mjs`.

export type Place = {
  id: string;
  name: string;
  description: string;
  entityId?: string;
  spots: { x: number; y: number }[];
};

export const PLACES: Place[] = [
  {
    id: 'lodging',
    name: '숙소',
    description: '마을 사람들이 잠을 자고 쉬는 곳',
    spots: [1, 3, 5, 7, 9, 11, 13, 15].map((x) => ({ x, y: 29 })),
  },
  {
    id: 'plaza',
    name: '광장',
    description: '사람들이 모여 이야기를 나누는 마을 중심',
    spots: [42, 44, 46, 48].flatMap((x) => [
      { x, y: 17 },
      { x, y: 18 },
    ]),
  },
  {
    id: 'field',
    name: '들판',
    description: '작물을 기르고 채집하는 북쪽 들판',
    spots: [5, 8, 11, 14].flatMap((x) => [
      { x, y: 5 },
      { x, y: 6 },
    ]),
  },
  {
    id: 'workshop',
    name: '작업장',
    description: '도구를 만들고 고치는 남쪽 작업장',
    spots: [22, 25, 28, 31].flatMap((x) => [
      { x, y: 41 },
      { x, y: 42 },
    ]),
  },
  {
    id: 'waterside',
    name: '물가',
    description: '폭포 아래 물을 긷고 생각에 잠기는 곳',
    spots: [
      ...[21, 23, 25, 27, 29].map((x) => ({ x, y: 13 })),
      { x: 29, y: 14 },
      { x: 31, y: 14 },
    ],
  },
  {
    id: 'market',
    name: '시장',
    description: '물건을 사고파는 곳',
    spots: [32, 35, 38, 41].flatMap((x) => [
      { x, y: 25 },
      { x, y: 26 },
    ]),
  },
  {
    id: 'tavern',
    name: '식당',
    description: '끼니를 해결하는 곳',
    spots: [27, 29, 31, 33].flatMap((x) => [
      { x, y: 20 },
      { x, y: 21 },
    ]),
  },
];

export const PLACES_BY_ID = new Map(PLACES.map((p) => [p.id, p]));
