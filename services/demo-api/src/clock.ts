/** Server clock with a development offset, so scenario tests can move time deterministically. */
export class Clock {
  private offsetMs = 0;
  constructor(private readonly base: () => number = Date.now) {}
  now(): number {
    return this.base() + this.offsetMs;
  }
  iso(): string {
    return new Date(this.now()).toISOString();
  }
  advance(seconds: number) {
    this.offsetMs += seconds * 1000;
  }
  reset() {
    this.offsetMs = 0;
  }
}

/** A fully manual clock for tests. */
export class ManualClock extends Clock {
  private t: number;
  constructor(startIso: string) {
    super(() => 0);
    this.t = Date.parse(startIso);
  }
  override now() {
    return this.t;
  }
  override advance(seconds: number) {
    this.t += seconds * 1000;
  }
}
