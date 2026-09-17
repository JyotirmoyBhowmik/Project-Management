// ==============================================================================
// src/lib/error/domain-errors.ts
// Domain exception hierarchy for enterprise error handling (Rule 2.2)
// ==============================================================================

export abstract class DomainException extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class EntityNotFoundException extends DomainException {
  public readonly statusCode = 404;
  public readonly errorCode = 'ENTITY_NOT_FOUND';

  constructor(entityName: string, identifier: string) {
    super(`${entityName} with identifier '${identifier}' was not found.`);
  }
}

export class TenantNotFoundException extends DomainException {
  public readonly statusCode = 404;
  public readonly errorCode = 'TENANT_NOT_FOUND';

  constructor(identifier: string) {
    super(`Tenant '${identifier}' could not be resolved.`);
  }
}

export class UnauthorizedAccessException extends DomainException {
  public readonly statusCode = 403;
  public readonly errorCode = 'FORBIDDEN_ACCESS';

  constructor(message: string = 'You do not have permission to perform this action or access this resource.') {
    super(message);
  }
}

export class GuestAccessViolationException extends DomainException {
  public readonly statusCode = 403;
  public readonly errorCode = 'GUEST_ACCESS_RESTRICTED';

  constructor(resource: string = 'domain-wide projects') {
    super(`Guest accounts are restricted from accessing ${resource}.`);
  }
}

export class ValidationException extends DomainException {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_FAILED';
  public readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class DependencyCycleException extends DomainException {
  public readonly statusCode = 422;
  public readonly errorCode = 'DEPENDENCY_CYCLE_DETECTED';

  constructor(taskA: string, taskB: string) {
    super(`Cannot create dependency between '${taskA}' and '${taskB}': creates a cyclic schedule loop.`);
  }
}

export class ScheduleConflictException extends DomainException {
  public readonly statusCode = 409;
  public readonly errorCode = 'SCHEDULE_CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

export class CircuitBreakerOpenException extends DomainException {
  public readonly statusCode = 503;
  public readonly errorCode = 'SERVICE_CIRCUIT_OPEN';

  constructor(serviceName: string) {
    super(`Service '${serviceName}' is currently unavailable due to repeated failures. Fail-fast triggered.`);
  }
}

export class RequestTimeoutException extends DomainException {
  public readonly statusCode = 504;
  public readonly errorCode = 'GATEWAY_TIMEOUT';

  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms.`);
  }
}
