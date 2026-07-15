export type ReleaseConcurrencySlot = () => void;

export class ConcurrencyGate {
  private active = 0;

  constructor(private readonly limit: number) {}

  tryAcquire(): ReleaseConcurrencySlot | undefined {
    if (this.active >= this.limit) return undefined;

    this.active += 1;
    let released = false;

    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }
}
