// ==============================================================================
// tests/unit/wbs-and-tree-hierarchy.test.ts
// Unit Tests for WBS Code Generation, Recursive Tree Traversal & Global Config
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { GlobalAppConfigSchema } from '@/lib/validation/config-schemas';

describe('WBS Hierarchical Indexing Engine', () => {
  interface MockTask {
    id: string;
    parent_id?: string | null;
    title: string;
  }

  function buildWbsHierarchy(tasks: MockTask[]) {
    const parentMap: Record<string, MockTask[]> = {};
    const taskMap = new Map<string, MockTask>();

    tasks.forEach((t) => {
      taskMap.set(t.id, t);
      if (t.parent_id) {
        if (!parentMap[t.parent_id]) parentMap[t.parent_id] = [];
        parentMap[t.parent_id].push(t);
      }
    });

    interface WbsNode {
      id: string;
      wbsCode: string;
      title: string;
      children: WbsNode[];
    }

    function buildNodes(list: MockTask[], prefix: string): WbsNode[] {
      return list.map((t, idx) => {
        const wbsCode = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}.0`;
        const children = parentMap[t.id] || [];
        const nextPrefix = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
        return {
          id: t.id,
          wbsCode,
          title: t.title,
          children: buildNodes(children, nextPrefix),
        };
      });
    }

    const roots = tasks.filter((t) => !t.parent_id || !taskMap.has(t.parent_id));
    return buildNodes(roots, '');
  }

  it('should correctly assign WBS codes to root tasks and multi-level subtasks', () => {
    const sampleTasks: MockTask[] = [
      { id: 'task-1', title: 'Phase 1: Discovery', parent_id: null },
      { id: 'task-1-1', title: 'Stakeholder Interviews', parent_id: 'task-1' },
      { id: 'task-1-2', title: 'Requirements Synthesis', parent_id: 'task-1' },
      { id: 'task-1-2-1', title: 'Data Model RFC', parent_id: 'task-1-2' },
      { id: 'task-2', title: 'Phase 2: Execution', parent_id: null },
      { id: 'task-2-1', title: 'Database Migration', parent_id: 'task-2' },
    ];

    const nodes = buildWbsHierarchy(sampleTasks);

    expect(nodes).toHaveLength(2);
    // Task 1
    expect(nodes[0].wbsCode).toBe('1.0');
    expect(nodes[0].title).toBe('Phase 1: Discovery');
    expect(nodes[0].children).toHaveLength(2);
    expect(nodes[0].children[0].wbsCode).toBe('1.1');
    expect(nodes[0].children[1].wbsCode).toBe('1.2');

    // Deeply nested subtask
    expect(nodes[0].children[1].children).toHaveLength(1);
    expect(nodes[0].children[1].children[0].wbsCode).toBe('1.2.1');
    expect(nodes[0].children[1].children[0].title).toBe('Data Model RFC');

    // Task 2
    expect(nodes[1].wbsCode).toBe('2.0');
    expect(nodes[1].children).toHaveLength(1);
    expect(nodes[1].children[0].wbsCode).toBe('2.1');
  });
});

describe('Recursive Document Tree & Breadcrumbs Engine', () => {
  interface MockDoc {
    id: string;
    title: string;
    children?: MockDoc[];
  }

  function findDocPath(docs: MockDoc[], targetId: string, currentPath: MockDoc[] = []): MockDoc[] | null {
    for (const doc of docs) {
      const newPath = [...currentPath, doc];
      if (doc.id === targetId) return newPath;
      if (doc.children && doc.children.length > 0) {
        const found = findDocPath(doc.children, targetId, newPath);
        if (found) return found;
      }
    }
    return null;
  }

  function filterTree(docs: MockDoc[], query: string): { filtered: MockDoc[]; matchedIds: Set<string> } {
    const q = query.trim().toLowerCase();
    const matched = new Set<string>();
    const ancestorIds = new Set<string>();

    function scan(node: MockDoc, path: string[]): boolean {
      const isSelf = node.title.toLowerCase().includes(q);
      if (isSelf) {
        matched.add(node.id);
        path.forEach((p) => ancestorIds.add(p));
      }
      let childMatched = false;
      for (const c of node.children || []) {
        if (scan(c, [...path, node.id])) childMatched = true;
      }
      return isSelf || childMatched;
    }

    docs.forEach((d) => scan(d, []));

    function prune(list: MockDoc[]): MockDoc[] {
      return list
        .filter((n) => matched.has(n.id) || ancestorIds.has(n.id))
        .map((n) => ({
          ...n,
          children: n.children ? prune(n.children) : [],
        }));
    }

    return { filtered: prune(docs), matchedIds: matched };
  }

  const sampleDocTree: MockDoc[] = [
    {
      id: 'doc-root-1',
      title: 'Architecture Overview',
      children: [
        {
          id: 'doc-child-1',
          title: 'Database Schema & Migrations',
          children: [
            { id: 'doc-leaf-1', title: 'RLS Security Policies' },
            { id: 'doc-leaf-2', title: 'Audit Trail Specifications' },
          ],
        },
        {
          id: 'doc-child-2',
          title: 'API Reference',
        },
      ],
    },
    {
      id: 'doc-root-2',
      title: 'Deployment Guide',
    },
  ];

  it('should compute complete breadcrumb path from root to deep leaf', () => {
    const path = findDocPath(sampleDocTree, 'doc-leaf-1');
    expect(path).not.toBeNull();
    expect(path!.map((d) => d.title)).toEqual([
      'Architecture Overview',
      'Database Schema & Migrations',
      'RLS Security Policies',
    ]);
  });

  it('should filter tree preserving ancestor branches when leaf matches', () => {
    const { filtered, matchedIds } = filterTree(sampleDocTree, 'RLS');
    expect(matchedIds.has('doc-leaf-1')).toBe(true);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('doc-root-1');
    expect(filtered[0].children![0].id).toBe('doc-child-1');
    expect(filtered[0].children![0].children![0].id).toBe('doc-leaf-1');
    // Non-matching branch doc-root-2 is pruned
    expect(filtered.find((d) => d.id === 'doc-root-2')).toBeUndefined();
  });
});

describe('Global App Configuration Validation Schema', () => {
  it('should validate a valid enterprise global configuration payload', () => {
    const validPayload = {
      app_name: 'Antigravity Enterprise PMS',
      app_short_name: 'AGY',
      app_tagline: 'Precision Portfolio & Engineering Intelligence',
      app_icon: 'FolderKanban',
      primary_color: '#2563eb',
      company_name: 'Globex Innovations',
      support_email: 'support@globex.internal',
      control_features: {
        enable_wiki: true,
        enable_graphify: true,
        enable_sprints: true,
        enable_cpm_engine: true,
        enable_evm: true,
        enable_subtasks: true,
        enable_milestones: true,
        enable_scim: true,
        enable_sso: true,
        enable_sla_milestone_alerts: true,
        enable_public_registration: false,
        maintenance_mode: false,
        maintenance_message: 'Under maintenance',
      },
      security_controls: {
        session_timeout_minutes: 120,
        max_upload_size_mb: 50,
        mfa_enforcement: 'optional',
        audit_retention_days: 90,
      },
    };

    const parsed = GlobalAppConfigSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid primary hex colors and unsupported icon names', () => {
    const invalidPayload = {
      app_name: 'PMS',
      app_short_name: 'PMS',
      app_icon: 'UnsupportedFakeIcon' as any,
      primary_color: 'not-a-hex-color',
    };

    const parsed = GlobalAppConfigSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.path.join('.'));
      expect(issues).toContain('app_icon');
      expect(issues).toContain('primary_color');
    }
  });

  it('should reject session timeout out of bounds (min 5, max 1440)', () => {
    const invalidTimeoutPayload = {
      app_name: 'PMS',
      app_short_name: 'PMS',
      security_controls: {
        session_timeout_minutes: 2, // Below minimum of 5
      },
    };

    const parsed = GlobalAppConfigSchema.safeParse(invalidTimeoutPayload);
    expect(parsed.success).toBe(false);
  });
});
