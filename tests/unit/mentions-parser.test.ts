// ==============================================================================
// tests/unit/mentions-parser.test.ts
// Unit Tests: Markdown @Mention Extraction & Attachment Boundary Validation
// ==============================================================================

import { describe, it, expect } from 'vitest';

describe('Markdown @Mentions & Attachment Validation', () => {
  function extractMentions(markdown: string): string[] {
    const matches = markdown.match(/@([a-zA-Z0-9_-]+)/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1).replace(/_/g, ' '));
  }

  function validateAttachmentUpload(file: { name: string; size: number }): { valid: boolean; error?: string } {
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'File size exceeds maximum 25MB limit' };
    }
    if (!file.name || file.name.trim().length === 0) {
      return { valid: false, error: 'File name cannot be empty' };
    }
    return { valid: true };
  }

  it('should accurately extract single and multiple @mentions from markdown text', () => {
    const text = 'Hey @admin, please review the latest updates from @Sarah_Connor and @John_Doe.';
    const mentions = extractMentions(text);
    expect(mentions).toEqual(['admin', 'Sarah Connor', 'John Doe']);
  });

  it('should return empty list when no @mentions are present', () => {
    const text = 'Standard commit message without any tags or mentions.';
    const mentions = extractMentions(text);
    expect(mentions).toEqual([]);
  });

  it('should enforce strict 25MB boundary limit on uploaded assets', () => {
    const validFile = { name: 'spec_document.pdf', size: 10 * 1024 * 1024 }; // 10MB
    const oversizedFile = { name: 'raw_backup.zip', size: 26 * 1024 * 1024 }; // 26MB

    expect(validateAttachmentUpload(validFile).valid).toBe(true);
    expect(validateAttachmentUpload(oversizedFile).valid).toBe(false);
    expect(validateAttachmentUpload(oversizedFile).error).toContain('exceeds maximum 25MB');
  });

  it('should sanitize filenames for hierarchical storage paths', () => {
    const raw = 'my special project (v1) & review.pdf';
    const sanitized = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
    expect(sanitized).toBe('my_special_project__v1____review.pdf');
  });
});
