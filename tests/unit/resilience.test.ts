// ==============================================================================
// tests/unit/resilience.test.ts
// Unit Tests: Timeouts, Retries with Jitter, Circuit Breaker & Idempotency (Rules 3.1 - 3.4)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  withTimeout,
  withRetry,
  CircuitBreaker,
  CircuitState,
  IdempotencyManager,
} from '@/lib/resilience/resilience';
import { RequestTimeoutException, CircuitBreakerOpenException } from '@/lib/error/domain-errors';

describe('Resilience Patterns', () => {
  it('should timeout an operation exceeding the allotted time threshold', async () => {
    const slowOperation = new Promise(resolve => setTimeout(resolve, 200));

    await expect(withTimeout(slowOperation, 50, 'slow-test')).rejects.toThrow(RequestTimeoutException);
  });

  it('should successfully retry a transient failure using exponential backoff with jitter', async () => {
    let callCount = 0;
    const transientOperation = async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Transient network glitch');
      }
      return 'SUCCESS';
    };

    const result = await withRetry(transientOperation, {
      maxRetries: 4,
      initialDelayMs: 10,
      maxDelayMs: 50,
      operationName: 'test-retry',
    });

    expect(result).toBe('SUCCESS');
    expect(callCount).toBe(3);
  });

  it('should trip the circuit breaker to OPEN when consecutive failures exceed threshold', async () => {
    const breaker = new CircuitBreaker('external-service', 3, 500);

    const failingOperation = async () => {
      throw new Error('Service down');
    };

    // 3 consecutive failures
    await expect(breaker.execute(failingOperation)).rejects.toThrow('Service down');
    await expect(breaker.execute(failingOperation)).rejects.toThrow('Service down');
    await expect(breaker.execute(failingOperation)).rejects.toThrow('Service down');

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Subsequent call fails fast with CircuitBreakerOpenException
    await expect(breaker.execute(failingOperation)).rejects.toThrow(CircuitBreakerOpenException);
  });

  it('should store and return cached response for duplicate idempotency keys', () => {
    const key = 'idem-key-12345';
    const responsePayload = { status: 'created', entityId: 'abc-001' };

    IdempotencyManager.set(key, responsePayload);
    const cached = IdempotencyManager.get(key);

    expect(cached).toEqual(responsePayload);
    expect(IdempotencyManager.get('non-existent-key')).toBeNull();
  });
});
