// ==============================================================================
// src/components/graphify/GraphCanvas.tsx
// Graphify: Visual Knowledge & Dependency Network Engine (100% Live D3-Force Canvas)
// ==============================================================================

'use client';

import * as React from 'react';
import * as d3 from 'd3-force';
import {
  Sparkles,
  Layers,
  Filter,
  Users,
  FileText,
  Diamond,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Task, TaskDependency, ProjectPhase, ProjectDocument, UserProfile } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'task' | 'phase' | 'member' | 'doc' | 'milestone';
  status?: string;
  priority?: string;
  isCritical?: boolean;
  code?: string;
  assignees?: Array<{ id: string; name: string; avatarUrl?: string | null }>;
  meta?: any;
}

export interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relationship: 'DEPENDS_ON' | 'ASSIGNED_TO' | 'PART_OF' | 'REFERENCES';
  depType?: string;
  lagDays?: number;
  isCritical?: boolean;
}

interface GraphCanvasProps {
  tasks: Task[];
  dependencies: TaskDependency[];
  phases?: ProjectPhase[];
  documents?: ProjectDocument[];
  members?: UserProfile[];
  onSelectTask?: (task: Task) => void;
  onSelectDoc?: (doc: ProjectDocument) => void;
  onCreateDependency?: (predecessorId: string, successorId: string, type: 'FS') => Promise<void>;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#64748b',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  completed: '#10b981',
  done: '#10b981',
  blocked: '#ef4444',
};

export function GraphCanvas({
  tasks,
  dependencies,
  phases = [],
  documents = [],
  members = [],
  onSelectTask,
  onSelectDoc,
  onCreateDependency,
  className = '',
}: GraphCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Filters & State
  const [highlightCritical, setHighlightCritical] = React.useState(false);
  const [filterType, setFilterType] = React.useState<string>('all');
  const [showClusters, setShowClusters] = React.useState(true);
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);

  // Drag-to-connect dependency wiring
  const [connectingSourceNode, setConnectingSourceNode] = React.useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);

  // Transform Data into Graph Nodes & Edges
  const { nodes, edges } = React.useMemo(() => {
    const nList: GraphNode[] = [];
    const eList: GraphEdge[] = [];
    const nodeMap = new Set<string>();

    // 1. Task & Milestone Nodes
    tasks.forEach((t) => {
      const isMilestone = t.is_milestone || t.duration_days === 0;
      const n: GraphNode = {
        id: `task-${t.id}`,
        name: t.title,
        type: isMilestone ? 'milestone' : 'task',
        status: String(t.status || 'todo'),
        priority: String(t.priority || 'medium'),
        isCritical: Boolean(t.is_critical || t.total_float === 0),
        code: t.task_code || t.code,
        meta: t,
        assignees: t.assignees?.map((a) => ({
          id: a.user_id,
          name: a.user?.full_name || 'Member',
          avatarUrl: a.user?.avatar_url,
        })),
      };
      nList.push(n);
      nodeMap.add(n.id);
    });

    // 2. Phase Nodes
    phases.forEach((p) => {
      const n: GraphNode = {
        id: `phase-${p.id}`,
        name: p.name,
        type: 'phase',
        meta: p,
      };
      nList.push(n);
      nodeMap.add(n.id);
    });

    // 3. Member Nodes (Active Assignees)
    const activeUserMap = new Map<string, UserProfile>();
    tasks.forEach((t) => {
      t.assignees?.forEach((a) => {
        if (a.user) activeUserMap.set(a.user.id, a.user);
      });
    });
    activeUserMap.forEach((u) => {
      const n: GraphNode = {
        id: `member-${u.id}`,
        name: u.full_name || u.email,
        type: 'member',
        meta: u,
      };
      nList.push(n);
      nodeMap.add(n.id);
    });

    // 4. Document Nodes
    documents.forEach((d) => {
      const n: GraphNode = {
        id: `doc-${d.id}`,
        name: d.title,
        type: 'doc',
        meta: d,
      };
      nList.push(n);
      nodeMap.add(n.id);
    });

    // 5. Dependency Edges (DEPENDS_ON)
    dependencies.forEach((dep) => {
      const srcId = `task-${dep.predecessor_id}`;
      const tgtId = `task-${dep.successor_id}`;
      if (nodeMap.has(srcId) && nodeMap.has(tgtId)) {
        const predTask = tasks.find((t) => t.id === dep.predecessor_id);
        const succTask = tasks.find((t) => t.id === dep.successor_id);
        const isCrit = Boolean(predTask?.is_critical && succTask?.is_critical);

        eList.push({
          id: `dep-${dep.id}`,
          source: srcId,
          target: tgtId,
          relationship: 'DEPENDS_ON',
          depType: dep.dep_type || dep.type || 'FS',
          lagDays: dep.lag_days,
          isCritical: isCrit,
        });
      }
    });

    // 6. Assignment Edges (ASSIGNED_TO)
    tasks.forEach((t) => {
      t.assignees?.forEach((a) => {
        const memberNodeId = `member-${a.user_id}`;
        const taskNodeId = `task-${t.id}`;
        if (nodeMap.has(memberNodeId)) {
          eList.push({
            id: `assign-${t.id}-${a.user_id}`,
            source: memberNodeId,
            target: taskNodeId,
            relationship: 'ASSIGNED_TO',
          });
        }
      });
    });

    // 7. Phase Containment Edges (PART_OF)
    tasks.forEach((t) => {
      if (t.phase_id) {
        const phaseNodeId = `phase-${t.phase_id}`;
        const taskNodeId = `task-${t.id}`;
        if (nodeMap.has(phaseNodeId)) {
          eList.push({
            id: `phase-edge-${t.id}`,
            source: taskNodeId,
            target: phaseNodeId,
            relationship: 'PART_OF',
          });
        }
      }
    });

    // 8. Document Reference Edges (REFERENCES)
    documents.forEach((d) => {
      d.linked_tasks?.forEach((lt) => {
        const docNodeId = `doc-${d.id}`;
        const taskNodeId = `task-${lt.id}`;
        if (nodeMap.has(taskNodeId)) {
          eList.push({
            id: `ref-${d.id}-${lt.id}`,
            source: docNodeId,
            target: taskNodeId,
            relationship: 'REFERENCES',
          });
        }
      });
    });

    return { nodes: nList, edges: eList };
  }, [tasks, dependencies, phases, documents]);

  // D3 Force Simulation
  const [simNodes, setSimNodes] = React.useState<GraphNode[]>([]);
  const [simEdges, setSimEdges] = React.useState<GraphEdge[]>([]);

  React.useEffect(() => {
    if (nodes.length === 0) return;

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance((l) => (l.relationship === 'DEPENDS_ON' ? 140 : 100))
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(450, 300))
      .force('collide', d3.forceCollide().radius(45));

    simulation.on('tick', () => {
      setSimNodes([...nodes]);
      setSimEdges([...edges]);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  // Pan & Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
    if (connectingSourceNode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - pan.x) / zoomLevel;
      const rawY = (e.clientY - rect.top - pan.y) / zoomLevel;
      setMousePos({ x: rawX, y: rawY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setConnectingSourceNode(null);
    setMousePos(null);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`relative w-full h-[700px] bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden select-none ${className}`}
    >
      {/* Top Controls Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 bg-[var(--card)]/90 backdrop-blur-md p-2 rounded-xl border border-[var(--border)] shadow-lg">
        <div className="flex items-center gap-1.5 px-2 font-bold text-xs text-[var(--foreground)]">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" />
          <span>Graphify Canvas</span>
          <Badge variant="outline" className="text-[10px] ml-1">
            {simNodes.length} Nodes • {simEdges.length} Edges
          </Badge>
        </div>

        <div className="h-4 w-[1px] bg-[var(--border)]" />

        {/* Critical Path Toggle */}
        <Button
          size="sm"
          variant={highlightCritical ? 'default' : 'outline'}
          onClick={() => setHighlightCritical(!highlightCritical)}
          className={`h-7 px-2.5 text-xs font-semibold gap-1.5 transition-all ${
            highlightCritical ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs' : ''
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${highlightCritical ? 'bg-white animate-ping' : 'bg-red-500'}`} />
          <span>Critical Path</span>
        </Button>

        {/* Filter Pill */}
        <div className="flex items-center gap-1 bg-[var(--secondary)]/60 p-0.5 rounded-lg text-[11px]">
          {['all', 'task', 'phase', 'doc', 'member'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2 py-0.5 rounded-md font-medium capitalize transition-colors ${
                filterType === type
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Zoom & Pan Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 bg-[var(--card)]/90 backdrop-blur-md p-1.5 rounded-xl border border-[var(--border)] shadow-lg">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.15))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.15))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => {
            setZoomLevel(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* SVG Canvas */}
      <svg className="w-full h-full cursor-grab active:cursor-grabbing">
        <defs>
          <marker id="arrow-fs" viewBox="0 -5 10 10" refX="28" refY="0" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,-5L10,0L0,5" fill="#64748b" />
          </marker>
          <marker id="arrow-critical" viewBox="0 -5 10 10" refX="28" refY="0" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,-5L10,0L0,5" fill="#ef4444" />
          </marker>
          <filter id="cpm-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoomLevel})`}>
          {/* Edges */}
          {simEdges.map((edge) => {
            const src = typeof edge.source === 'object' ? edge.source : simNodes.find((n) => n.id === edge.source);
            const tgt = typeof edge.target === 'object' ? edge.target : simNodes.find((n) => n.id === edge.target);
            if (!src || !tgt || src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined) {
              return null;
            }

            const isEdgeCritical = highlightCritical && edge.isCritical;
            const isDimmed = highlightCritical && !edge.isCritical;

            let stroke = '#64748b';
            let strokeDash = 'none';
            let marker = 'url(#arrow-fs)';

            if (edge.relationship === 'ASSIGNED_TO') {
              stroke = '#3b82f6';
              strokeDash = '4,4';
              marker = 'none';
            } else if (edge.relationship === 'PART_OF') {
              stroke = '#94a3b8';
              strokeDash = '2,2';
              marker = 'none';
            } else if (edge.relationship === 'REFERENCES') {
              stroke = '#a855f7';
              marker = 'none';
            }

            if (isEdgeCritical) {
              stroke = '#ef4444';
              marker = 'url(#arrow-critical)';
            }

            return (
              <g key={edge.id} opacity={isDimmed ? 0.15 : 0.85}>
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={stroke}
                  strokeWidth={isEdgeCritical ? 3 : 1.5}
                  strokeDasharray={strokeDash}
                  markerEnd={marker}
                  filter={isEdgeCritical ? 'url(#cpm-neon-glow)' : 'none'}
                />
                {edge.depType && (
                  <text
                    x={(src.x + tgt.x) / 2}
                    y={(src.y + tgt.y) / 2 - 4}
                    fontSize="9"
                    fontWeight="bold"
                    fill={isEdgeCritical ? '#ef4444' : 'var(--muted-foreground)'}
                    textAnchor="middle"
                  >
                    {edge.depType}
                  </text>
                )}
              </g>
            );
          })}

          {/* Interactive Dragging Dependency Preview Line */}
          {connectingSourceNode && mousePos && connectingSourceNode.x !== undefined && connectingSourceNode.y !== undefined && (
            <line
              x1={connectingSourceNode.x}
              y1={connectingSourceNode.y}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
          )}

          {/* Nodes */}
          {simNodes.map((node) => {
            if (node.x === undefined || node.y === undefined) return null;
            if (filterType !== 'all' && node.type !== filterType) return null;

            const isNodeCritical = highlightCritical && node.isCritical;
            const isDimmed = highlightCritical && !node.isCritical;
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                opacity={isDimmed ? 0.2 : 1}
                className="cursor-pointer transition-opacity duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node);
                  if (node.type === 'task' || node.type === 'milestone') {
                    onSelectTask?.(node.meta);
                  } else if (node.type === 'doc') {
                    onSelectDoc?.(node.meta);
                  }
                }}
              >
                {/* Milestone diamond anchor */}
                {node.type === 'milestone' && (
                  <polygon
                    points="0,-18 18,0 0,18 -18,0"
                    fill={STATUS_COLORS[node.status || 'todo'] || '#64748b'}
                    stroke={isSelected ? '#fbbf24' : isNodeCritical ? '#ef4444' : '#1e293b'}
                    strokeWidth={isSelected || isNodeCritical ? 3 : 1.5}
                    filter={isNodeCritical ? 'url(#cpm-neon-glow)' : 'none'}
                  />
                )}

                {/* Phase Hub */}
                {node.type === 'phase' && (
                  <circle
                    r={24}
                    fill="rgba(148, 163, 184, 0.15)"
                    stroke="rgba(148, 163, 184, 0.5)"
                    strokeWidth={2}
                    strokeDasharray="3,3"
                  />
                )}

                {/* Member Node */}
                {node.type === 'member' && (
                  <circle
                    r={18}
                    fill="#1e293b"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                )}

                {/* Document Node */}
                {node.type === 'doc' && (
                  <rect
                    x={-16}
                    y={-16}
                    width={32}
                    height={32}
                    rx={6}
                    fill="#1e1b4b"
                    stroke="#a855f7"
                    strokeWidth={2}
                  />
                )}

                {/* Task Node */}
                {node.type === 'task' && (
                  <rect
                    x={-42}
                    y={-18}
                    width={84}
                    height={36}
                    rx={8}
                    fill="var(--card)"
                    stroke={
                      isSelected ? '#fbbf24' : isNodeCritical ? '#ef4444' : STATUS_COLORS[node.status || 'todo']
                    }
                    strokeWidth={isSelected || isNodeCritical ? 3 : 1.5}
                    filter={isNodeCritical ? 'url(#cpm-neon-glow)' : 'none'}
                  />
                )}

                {/* Node Icons / Labels */}
                {node.type === 'member' && (
                  <text dy={4} textAnchor="middle" fill="#93c5fd" fontSize="10" fontWeight="bold">
                    {node.name.substring(0, 2).toUpperCase()}
                  </text>
                )}

                {node.type === 'doc' && (
                  <text dy={4} textAnchor="middle" fill="#c084fc" fontSize="11">
                    📄
                  </text>
                )}

                {node.type === 'phase' && (
                  <text dy={4} textAnchor="middle" fill="var(--muted-foreground)" fontSize="9" fontWeight="bold">
                    PHASE
                  </text>
                )}

                {/* Task Text & Badges */}
                {node.type === 'task' && (
                  <>
                    <text
                      dy={-3}
                      textAnchor="middle"
                      fill="var(--foreground)"
                      fontSize="9"
                      fontWeight="bold"
                      className="truncate max-w-[70px]"
                    >
                      {node.code || node.name.substring(0, 10)}
                    </text>
                    <text
                      dy={10}
                      textAnchor="middle"
                      fill="var(--muted-foreground)"
                      fontSize="8"
                      className="truncate"
                    >
                      {node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
                    </text>
                  </>
                )}

                {/* Drag Handle to create dependencies */}
                {node.type === 'task' && (
                  <circle
                    cx={42}
                    cy={0}
                    r={5}
                    fill="#3b82f6"
                    className="cursor-crosshair hover:scale-125 transition-transform"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setConnectingSourceNode(node);
                    }}
                    onMouseUp={async (e) => {
                      e.stopPropagation();
                      if (connectingSourceNode && connectingSourceNode.id !== node.id) {
                        const predId = connectingSourceNode.id.replace('task-', '');
                        const succId = node.id.replace('task-', '');
                        await onCreateDependency?.(predId, succId, 'FS');
                      }
                      setConnectingSourceNode(null);
                      setMousePos(null);
                    }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
