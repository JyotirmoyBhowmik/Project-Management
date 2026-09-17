// ==============================================================================
// src/lib/email/index.ts
// Public Barrel Export for Transactional Email Infrastructure
// ==============================================================================

export * from './types';
export * from './email-service';
export * from './adapters/resend-adapter';
export * from './adapters/smtp-adapter';
export * from './templates/workspace-invitation';
export * from './templates/guest-invitation';
export * from './templates/task-assignment';
export * from './templates/sla-milestone';
export * from './templates/daily-digest';
