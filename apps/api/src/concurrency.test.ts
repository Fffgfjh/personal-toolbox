import { describe, expect, it } from 'vitest';
import { ConcurrencyGate } from './concurrency.js';

describe('ConcurrencyGate', () => {
  it('rejects work above the limit and safely releases slots', () => {
    const gate = new ConcurrencyGate(1);
    const release = gate.tryAcquire();

    expect(release).toBeTypeOf('function');
    expect(gate.tryAcquire()).toBeUndefined();

    release?.();
    release?.();
    expect(gate.tryAcquire()).toBeTypeOf('function');
  });
});
