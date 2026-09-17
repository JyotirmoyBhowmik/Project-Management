// ==============================================================================
// src/lib/resilience/resilience.ts
// Resilience Patterns: Timeouts, Retries with Jitter, Circuit Breaker, Idempotency (Rules 3.1 - 3.4)
// ==============================================================================

import { CircuitBreakerOpenException, RequestTimeoutException } from '../error/domain-errors';
import { logger } from '../logger/logger';

// ------------------------------------------------------------------------------
// 1. Explicit Timeouts (Rule 3.1)
// ------------------------------------------------------------------------------
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 8000,
  operationName: string = 'async-operation'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RequestTimeoutException(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

// ------------------------------------------------------------------------------
// 2. Retries with Exponential Backoff and Jitter (Rule 3.2)
// ------------------------------------------------------------------------------
export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  operationName?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 200,
    maxDelayMs = 3000,
    backoffFactor = 2,
    operationName = 'resilient-op',
  } = options;

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) {
        logger.error(`Exhausted all ${maxRetries} retries for ${operationName}`, {
          fn: 'withRetry',
          ctx: { attempt, maxRetries },
          err: error,
        });
        throw error;
      }

      // Exponential backoff with full decorrelated jitter
      const calculatedDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(backoffFactor, attempt - 1));
      const jitterDelay = Math.floor(Math.random() * calculatedDelay);

      logger.warn(`Retrying ${operationName} (attempt ${attempt}/${maxRetries}) in ${jitterDelay}ms`, {
        fn: 'withRetry',
        ctx: { attempt, jitterDelay },
      });

      await new Promise(resolve => setTimeout(resolve, jitterDelay));
    }
  }

  throw new Error(`Unexpected retry termination for ${operationName}`);
}

// ------------------------------------------------------------------------------
// 3. Circuit Breaker (Rule 3.3)
// ------------------------------------------------------------------------------
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  public readonly serviceName: string;

  constructor(serviceName: string, failureThreshold: number = 5, resetTimeoutMs: number = 15000) {
    this.serviceName = serviceName;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  public getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker for ${this.serviceName} shifted from OPEN to HALF_OPEN`);
      }
    }
    return this.state;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      throw new CircuitBreakerOpenException(this.serviceName);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.error(`Circuit breaker tripped to OPEN for ${this.serviceName} after ${this.failureCount} failures`);
    }
  }

  public reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

// ------------------------------------------------------------------------------
// 4. Idempotency Manager (Rule 3.4)
// Prevents duplicate operations across network retries using an in-memory / cache store.
// ------------------------------------------------------------------------------
export class IdempotencyManager {
  private static store = new Map<string, { timestamp: number; response: unknown }>();
  private static readonly TTL_MS = 1000 * 60 * 15; // 15 minutes TTL

  public static get(key: string): unknown | null {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() - record.timestamp > this.TTL_MS) {
      this.store.delete(key);
      return null;
    }
    return record.response;
  }

  public static set(key: string, response: unknown) {
    this.store.set(key, { timestamp: Date.now(), response });
    // Cleanup aged entries if store exceeds threshold
    if (this.store.size > 2000) {
      const now = Date.now();
      for (const [k, v] of this.store.entries()) {
        if (now - v.timestamp > this.TTL_MS) {
          this.store.delete(k);
        }
      }
    }
  }

  public static clear() {
    this.store.clear();
  }
}
