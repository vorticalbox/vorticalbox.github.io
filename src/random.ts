export class SeededRandom {
  constructor(private seed: number) {}

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  integer(max: number) {
    return Math.floor(this.next() * max);
  }

  value() {
    return this.seed;
  }
}
