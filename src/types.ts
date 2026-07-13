export type Biome = 'countryside' | 'coast' | 'woodland' | 'suburbs' | 'city';
export type Settlement = 'town' | 'city';
export type RouteSize = 'tiny' | 'small' | 'big' | 'massive';

export type SpeedZone = {
  start: number;
  length: number;
  limit: number;
  curve: number;
};

export type Segment = {
  from: string;
  to: string;
  fromSettlement: Settlement;
  toSettlement: Settlement;
  fromSettlementSpan: number;
  toSettlementSpan: number;
  biome: Biome;
  distance: number;
  routeLength: number;
  zones: SpeedZone[];
  seed: number;
};

export type RouteStation = { name: string; settlement: Settlement; };
export type RoutePlan = { size: RouteSize; stations: RouteStation[]; segments: Segment[]; totalDistance: number; };

export type Save = {
  history: string[];
  best: number;
  muted: boolean;
};
