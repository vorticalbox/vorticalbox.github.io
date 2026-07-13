import { SeededRandom } from './random';
import type { Biome, RoutePlan, RouteSize, Segment, Settlement, SpeedZone } from './types';

const nameStarts = ['Ash', 'Bramble', 'Cedar', 'Dun', 'Elm', 'Fern', 'Glen', 'Hart', 'Ivy', 'Kirk', 'Lark', 'Meadow', 'Oak', 'Pine', 'Rose', 'Thorn', 'Willow'];
const nameEnds = ['bridge', 'by', 'combe', 'cross', 'dale', 'field', 'ford', 'gate', 'haven', 'hill', 'leigh', 'mere', 'minster', 'mouth', 'shire', 'stead', 'wick'];
// Routes stay in a Scottish Highland palette; towns are generated around stations.
const biomes: Biome[] = ['countryside', 'countryside', 'woodland', 'woodland', 'coast'];

export class RouteGenerator {
  private random = new SeededRandom((Date.now() & 0xfffffff) || 1);
  private currentSettlement: Settlement = 'town';
  private currentSettlementSpan = 2 + this.random.next();

  createSegment(previous = 'Oakleigh'): Segment {
    const routeLength = 9000 + this.random.integer(1500);
    const zones: SpeedZone[] = [];
    let start = 0;

    while (start < routeLength) {
      const curved = start > 250 && this.random.next() < .62;
      const length = Math.min(curved ? 1600 + this.random.integer(1600) : 750 + this.random.integer(1250), routeLength - start);
      const curve = curved ? (this.random.next() < .5 ? -1 : 1) * (48 + this.random.next() * 72) : 0;
      const bendSeverity = curve ? Math.abs(curve) / length : 0;
      zones.push({ start, length, curve, limit: bendSeverity > .055 ? 35 : bendSeverity > .028 ? 50 : 70 });
      start += length;
    }

    const fromSettlement = this.currentSettlement, fromSettlementSpan = this.currentSettlementSpan, toSettlement: Settlement = this.random.next() < .17 ? 'city' : 'town', toSettlementSpan = toSettlement === 'city' ? 4 + this.random.next() : 2 + this.random.next();
    this.currentSettlement = toSettlement; this.currentSettlementSpan = toSettlementSpan;
    return {
      from: previous,
      to: `${nameStarts[this.random.integer(nameStarts.length)]}${nameEnds[this.random.integer(nameEnds.length)]}`,
      fromSettlement,
      toSettlement,
      fromSettlementSpan,
      toSettlementSpan,
      biome: biomes[this.random.integer(biomes.length)]!,
      distance: routeLength / 1900,
      routeLength,
      zones,
      seed: this.random.value(),
    };
  }

  createRoute(size: RouteSize): RoutePlan {
    const stops = { tiny: 1, small: 3, big: 5, massive: 10 }[size];
    const segments: Segment[] = [], stations = [{ name: 'Oakleigh', settlement: this.currentSettlement }];
    let previous = 'Oakleigh';
    for (let index = 0; index < stops; index++) {
      const segment = this.createSegment(previous); segments.push(segment);
      stations.push({ name: segment.to, settlement: segment.toSettlement }); previous = segment.to;
    }
    return { size, stations, segments, totalDistance: segments.reduce((total, segment) => total + segment.distance, 0) };
  }
}
