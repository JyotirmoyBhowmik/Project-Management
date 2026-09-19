// ==============================================================================
// src/components/admin/CodebaseVisualizer.tsx
// In-Portal Codebase Architecture, Graph & Treemap Visualizer Hub
// Configurable under Governance & Controls and Base System Configuration
// ==============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Boxes,
  Sparkles,
  Layers,
  Search,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Folder,
  FileCode,
  ArrowUpRight,
  ArrowDownLeft,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
} from 'lucide-react';
import * as d3Force from 'd3-force';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface CodebaseNode {
  id: string;
  label: string;
  path: string;
  type: string;
  extension: string;
  lines: number;
  symbolsCount: number;
  symbols: Array<{
    name: string;
    kind: string;
    line: number;
    isExported: boolean;
  }>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface CodebaseEdge {
  source: any;
  target: any;
  type: string;
  specifiers?: string[];
  line?: number;
}

export interface CodebaseGraphData {
  meta: {
    generatedAt: string;
    totalFiles: number;
    totalEdges: number;
    totalLines: number;
    totalSymbols: number;
  };
  nodes: CodebaseNode[];
  edges: CodebaseEdge[];
}

const CATEGORY_COLORS: Record<string, string> = {
  action: '#ef4444',
  component: '#3b82f6',
  lib: '#10b981',
  page: '#f59e0b',
  api: '#8b5cf6',
  type: '#ec4899',
  database: '#06b6d4',
  test: '#84cc16',
  tooling: '#eab308',
  config: '#6b7280',
};

export function CodebaseVisualizer() {
  const [data, setData] = React.useState<CodebaseGraphData | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // View state
  const [activeView, setActiveView] = React.useState<'graph' | 'treemap' | 'tree'>('graph');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedNode, setSelectedNode] = React.useState<CodebaseNode | null>(null);
  const [copiedPath, setCopiedPath] = React.useState<boolean>(false);

  // Graph canvas state
  const [zoomLevel, setZoomLevel] = React.useState<number>(1);
  const [panOffset, setPanOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = React.useState<boolean>(false);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Simulation ref
  const simulationRef = React.useRef<any>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Fetch codebase graph data
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Primary in-portal path from Next.js public directory
      let res = await fetch('/codebase-map/graph.json');
      if (!res.ok) {
        // Fallback relative path
        res = await fetch('/graph.json');
      }
      if (!res.ok) throw new Error(`Failed to load graph data (HTTP ${res.status})`);
      const json: CodebaseGraphData = await res.json();
      setData(json);
      if (json.nodes.length > 0) {
        setSelectedNode(json.nodes[0]);
      }
    } catch (err: any) {
      console.error('Error fetching codebase graph data:', err);
      setError(err?.message || 'Failed to load codebase architecture map');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered nodes
  const filteredNodes = React.useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();
    return data.nodes.filter((node) => {
      const matchesCategory = selectedCategory === 'all' || node.type === selectedCategory;
      const matchesSearch =
        !q ||
        node.path.toLowerCase().includes(q) ||
        node.label.toLowerCase().includes(q) ||
        node.symbols?.some((s) => s.name.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [data, searchQuery, selectedCategory]);

  const filteredNodeIds = React.useMemo(() => {
    return new Set(filteredNodes.map((n) => n.id));
  }, [filteredNodes]);

  // Filtered edges
  const filteredEdges = React.useMemo(() => {
    if (!data) return [];
    return data.edges.filter((edge) => {
      const srcId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const tgtId = typeof edge.target === 'object' ? edge.target.id : edge.target;
      return filteredNodeIds.has(srcId) && filteredNodeIds.has(tgtId);
    });
  }, [data, filteredNodeIds]);

  // D3 force simulation
  React.useEffect(() => {
    if (activeView !== 'graph' || filteredNodes.length === 0) return;

    const width = 1000;
    const height = 700;

    // Clone nodes and links for simulation
    const simNodes: CodebaseNode[] = filteredNodes.map((n) => ({ ...n }));
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges: any[] = filteredEdges
      .map((e) => {
        const srcId = typeof e.source === 'object' ? e.source.id : e.source;
        const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
        const source = nodeMap.get(srcId);
        const target = nodeMap.get(tgtId);
        if (!source || !target) return null;
        return {
          ...e,
          source,
          target,
        };
      })
      .filter((e): e is NonNullable<typeof e> => Boolean(e));

    const simulation = d3Force
      .forceSimulation(simNodes)
      .force(
        'link',
        d3Force
          .forceLink(simEdges)
          .id((d: any) => d.id)
          .distance(85)
      )
      .force('charge', d3Force.forceManyBody().strength(-150))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3Force.forceCollide().radius((d: any) => Math.max(8, Math.sqrt(d.lines || 10) * 1.5) + 6)
      );

    simulation.on('tick', () => {
      // Force update by triggering state or re-render
      if (simulationRef.current) {
        simulationRef.current.tickCount = (simulationRef.current.tickCount || 0) + 1;
        if (simulationRef.current.tickCount % 2 === 0) {
          setData((prev) => (prev ? { ...prev } : prev));
        }
      }
    });

    simulationRef.current = { simulation, nodes: simNodes, edges: simEdges, tickCount: 0 };

    return () => {
      simulation.stop();
    };
  }, [activeView, filteredNodes.length, filteredEdges.length]);

  // Copy Path helper
  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    toast.success('File path copied to clipboard');
    setTimeout(() => setCopiedPath(false), 2000);
  };

  // Canvas Pan & Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsDraggingCanvas(true);
      dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // Node dependencies helper
  const nodeDependencies = React.useMemo(() => {
    if (!data || !selectedNode) return { imports: [], importedBy: [] };
    const imports = data.edges.filter((e) => {
      const srcId = typeof e.source === 'object' ? e.source.id : e.source;
      return srcId === selectedNode.id;
    });
    const importedBy = data.edges.filter((e) => {
      const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
      return tgtId === selectedNode.id;
    });
    return { imports, importedBy };
  }, [data, selectedNode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="h-8 w-8 text-[var(--primary)] animate-spin" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading codebase architecture map...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
          <Boxes className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Architecture Map Unavailable</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          {error || 'Unable to load codebase architecture graph.'}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
          <a
            href="/codebase-map/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
          >
            <ExternalLink className="h-4 w-4" /> Open Standalone Visualizer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-5 py-3 flex flex-wrap items-center justify-between gap-4 z-20 shadow-xs">
        {/* Left: Branding & Metrics */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[var(--foreground)]">Codebase Architecture & Visualizer</h1>
              <Badge variant="outline" className="text-[10px] font-mono text-[var(--primary)] border-[var(--primary)]/30">
                {data.nodes.length} files • {data.edges.length} links • {data.meta?.totalLines.toLocaleString()} LOC
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Interactive architectural dependency graph, codebase treemap packing, and AST symbol inspector.
            </p>
          </div>
        </div>

        {/* Center: View Switcher */}
        <div className="flex items-center bg-[var(--secondary)]/70 p-1 rounded-lg border border-[var(--border)]">
          <button
            onClick={() => setActiveView('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeView === 'graph'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span>🕸️</span> Dependency Graph
          </button>
          <button
            onClick={() => setActiveView('treemap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeView === 'treemap'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span>🗺️</span> Codebase Treemap
          </button>
          <button
            onClick={() => setActiveView('tree')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeView === 'tree'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span>🌳</span> Architecture Tree
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={fetchData} variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <a
            href="/codebase-map/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-[var(--foreground)] border border-[var(--border)] transition-colors"
            title="Open visualizer in full-screen tab"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span>Open Standalone ↗</span>
          </a>
        </div>
      </div>

      {/* Sub-toolbar: Search & Category Filter Pills */}
      <div className="border-b border-[var(--border)] bg-[var(--card)]/50 px-5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-[var(--muted-foreground)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files, symbols, types..."
              className="h-8 pl-8 text-xs bg-[var(--secondary)]/40 border-[var(--border)]"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'action', 'component', 'lib', 'page', 'api', 'database', 'type'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-[var(--primary)] text-white font-semibold'
                  : 'bg-[var(--secondary)]/50 text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Area: Visualizer + Inspector Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Visualizer Canvas */}
        <div className="flex-1 h-full relative overflow-hidden bg-[var(--background)]">
          {/* VIEW 1: DEPENDENCY GRAPH */}
          {activeView === 'graph' && (
            <div
              className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* Zoom Controls */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 bg-[var(--card)]/90 backdrop-blur-md p-1 rounded-lg border border-[var(--border)] shadow-md">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 3))}
                  className="p-1.5 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <span className="text-[11px] font-mono px-1 text-[var(--muted-foreground)]">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.3))}
                  className="p-1.5 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-1.5 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Reset View"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>

              {/* D3 Graph SVG */}
              <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              >
                <defs>
                  <marker
                    id="portal-arrow"
                    viewBox="0 -5 10 10"
                    refX="18"
                    refY="0"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0,-5L10,0L0,5" fill="#6b7280" />
                  </marker>
                  <marker
                    id="portal-arrow-highlight"
                    viewBox="0 -5 10 10"
                    refX="18"
                    refY="0"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0,-5L10,0L0,5" fill="#3b82f6" />
                  </marker>
                </defs>

                <g
                  transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
                >
                  {/* Edges */}
                  <g className="edges">
                    {(simulationRef.current?.edges || []).map((edge: any, idx: number) => {
                      const isHighlighted =
                        selectedNode &&
                        (edge.source?.id === selectedNode.id || edge.target?.id === selectedNode.id);
                      return (
                        <line
                          key={`edge-${idx}`}
                          x1={edge.source?.x || 0}
                          y1={edge.source?.y || 0}
                          x2={edge.target?.x || 0}
                          y2={edge.target?.y || 0}
                          stroke={isHighlighted ? '#3b82f6' : '#374151'}
                          strokeWidth={isHighlighted ? 2.5 : 1}
                          strokeOpacity={isHighlighted ? 1 : 0.4}
                          markerEnd={isHighlighted ? 'url(#portal-arrow-highlight)' : 'url(#portal-arrow)'}
                        />
                      );
                    })}
                  </g>

                  {/* Nodes */}
                  <g className="nodes">
                    {(simulationRef.current?.nodes || filteredNodes).map((node: CodebaseNode) => {
                      const isSelected = selectedNode?.id === node.id;
                      const radius = Math.max(8, Math.min(24, Math.sqrt(node.lines || 10) * 1.5));
                      const color = CATEGORY_COLORS[node.type] || '#6b7280';
                      const posX = node.x || 500;
                      const posY = node.y || 350;

                      return (
                        <g
                          key={`node-${node.id}`}
                          transform={`translate(${posX}, ${posY})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(node);
                          }}
                          className="cursor-pointer"
                        >
                          <circle
                            r={radius}
                            fill={color}
                            stroke={isSelected ? '#fbbf24' : '#1f2937'}
                            strokeWidth={isSelected ? 3.5 : 2}
                            filter={isSelected ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.8))' : undefined}
                          />
                          <text
                            dy={radius + 12}
                            textAnchor="middle"
                            fill="var(--foreground)"
                            fontSize="10"
                            fontWeight="500"
                            className="pointer-events-none select-none drop-shadow"
                          >
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </g>
              </svg>
            </div>
          )}

          {/* VIEW 2: CODEBASE TREEMAP */}
          {activeView === 'treemap' && (
            <div className="w-full h-full p-6 overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)]">Codebase Treemap Packing</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Area sized proportionally by lines of code (LOC). Color mapped to architecture category.
                  </p>
                </div>
                <div className="text-xs text-[var(--muted-foreground)] font-mono">
                  {filteredNodes.length} modules
                </div>
              </div>

              {/* Interactive Treemap Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredNodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const color = CATEGORY_COLORS[node.type] || '#6b7280';
                  // Calculate relative size scaling
                  const colSpan = node.lines > 500 ? 'col-span-2 row-span-2' : node.lines > 250 ? 'col-span-2' : 'col-span-1';

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`${colSpan} p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#fbbf24] ring-2 ring-[#fbbf24]/40 bg-[#fbbf24]/10 shadow-lg'
                          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)] hover:scale-[1.01]'
                      }`}
                      style={{
                        borderLeftColor: color,
                        borderLeftWidth: '4px',
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold truncate text-[var(--foreground)]">{node.label}</span>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                            style={{ backgroundColor: `${color}25`, color: color }}
                          >
                            {node.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">{node.path}</p>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[10px] pt-2 border-t border-[var(--border)]/50">
                        <span className="font-semibold text-[var(--foreground)]">{node.lines} LOC</span>
                        <span className="text-[var(--muted-foreground)]">{node.symbolsCount} symbols</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 3: ARCHITECTURE TREE */}
          {activeView === 'tree' && (
            <div className="w-full h-full p-6 overflow-y-auto space-y-4">
              {['action', 'lib', 'component', 'page', 'api', 'database', 'type', 'tooling', 'test', 'config'].map(
                (cat) => {
                  const catNodes = filteredNodes.filter((n) => n.type === cat);
                  if (catNodes.length === 0) return null;

                  const color = CATEGORY_COLORS[cat] || '#6b7280';
                  const totalCatLines = catNodes.reduce((acc, curr) => acc + curr.lines, 0);

                  return (
                    <div key={cat} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                      <div className="px-4 py-3 bg-[var(--secondary)]/40 border-b border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                            {cat} Layer
                          </span>
                          <Badge variant="outline" className="text-[10px] text-[var(--muted-foreground)]">
                            {catNodes.length} files • {totalCatLines.toLocaleString()} LOC
                          </Badge>
                        </div>
                      </div>

                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {catNodes.map((node) => {
                          const isSelected = selectedNode?.id === node.id;
                          return (
                            <div
                              key={node.id}
                              onClick={() => setSelectedNode(node)}
                              className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'border-[#fbbf24] bg-[#fbbf24]/10'
                                  : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]/50'
                              }`}
                            >
                              <div className="overflow-hidden">
                                <div className="text-xs font-semibold truncate text-[var(--foreground)]">
                                  {node.label}
                                </div>
                                <div className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
                                  {node.path}
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-[var(--muted-foreground)] shrink-0">
                                {node.lines} L
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* Right: Inspector Sidebar */}
        <div className="w-80 md:w-96 border-l border-[var(--border)] bg-[var(--card)] flex flex-col h-full z-20 shadow-md">
          {selectedNode ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold truncate text-[var(--foreground)]">{selectedNode.label}</h3>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[selectedNode.type] || '#6b7280'}25`,
                        color: CATEGORY_COLORS[selectedNode.type] || '#6b7280',
                      }}
                    >
                      {selectedNode.type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyPath(selectedNode.path)}
                  className="p-1.5 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Copy relative file path"
                >
                  {copiedPath ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 flex-1 overflow-y-auto space-y-5">
                {/* Metric Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Lines of Code</div>
                    <div className="text-base font-bold font-mono text-[var(--foreground)] mt-0.5">
                      {selectedNode.lines}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Symbols</div>
                    <div className="text-base font-bold font-mono text-[var(--foreground)] mt-0.5">
                      {selectedNode.symbolsCount}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Imports</div>
                    <div className="text-base font-bold font-mono text-[var(--foreground)] mt-0.5">
                      {nodeDependencies.imports.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)]">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Imported By</div>
                    <div className="text-base font-bold font-mono text-[var(--foreground)] mt-0.5">
                      {nodeDependencies.importedBy.length}
                    </div>
                  </div>
                </div>

                {/* File Path */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-1">File Location</div>
                  <div className="p-2 rounded bg-[var(--secondary)]/50 border border-[var(--border)] text-[10px] font-mono break-all text-[var(--muted-foreground)]">
                    {selectedNode.path}
                  </div>
                </div>

                {/* Declared Symbols */}
                {selectedNode.symbols && selectedNode.symbols.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-2 flex items-center justify-between">
                      <span>Declared Symbols ({selectedNode.symbols.length})</span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedNode.symbols.map((sym, idx) => (
                        <div
                          key={`sym-${idx}`}
                          className="p-2 rounded bg-[var(--secondary)]/30 border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono font-medium truncate text-[var(--foreground)]">{sym.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-mono">
                              L{sym.line}
                            </span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] uppercase">
                              {sym.kind}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outbound Imports */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-2 flex items-center justify-between">
                    <span>Dependencies Outbound ({nodeDependencies.imports.length})</span>
                  </div>
                  {nodeDependencies.imports.length === 0 ? (
                    <div className="text-[11px] text-[var(--muted-foreground)] italic">No internal imports detected.</div>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {nodeDependencies.imports.map((dep, idx) => {
                        const targetId = typeof dep.target === 'object' ? dep.target.id : dep.target;
                        const targetNode = data.nodes.find((n) => n.id === targetId);
                        return (
                          <div
                            key={`imp-${idx}`}
                            onClick={() => targetNode && setSelectedNode(targetNode)}
                            className="p-1.5 rounded bg-[var(--secondary)]/20 hover:bg-[var(--secondary)]/60 border border-[var(--border)] text-[11px] font-mono cursor-pointer flex items-center justify-between text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            <span className="truncate">{targetId}</span>
                            <ArrowUpRight className="h-3 w-3 shrink-0 text-[var(--primary)]" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Inbound Dependents */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] mb-2 flex items-center justify-between">
                    <span>Imported By ({nodeDependencies.importedBy.length})</span>
                  </div>
                  {nodeDependencies.importedBy.length === 0 ? (
                    <div className="text-[11px] text-[var(--muted-foreground)] italic">Not imported by other internal files.</div>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {nodeDependencies.importedBy.map((dep, idx) => {
                        const srcId = typeof dep.source === 'object' ? dep.source.id : dep.source;
                        const srcNode = data.nodes.find((n) => n.id === srcId);
                        return (
                          <div
                            key={`by-${idx}`}
                            onClick={() => srcNode && setSelectedNode(srcNode)}
                            className="p-1.5 rounded bg-[var(--secondary)]/20 hover:bg-[var(--secondary)]/60 border border-[var(--border)] text-[11px] font-mono cursor-pointer flex items-center justify-between text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            <span className="truncate">{srcId}</span>
                            <ArrowDownLeft className="h-3 w-3 shrink-0 text-emerald-500" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-[var(--muted-foreground)] text-xs flex flex-col items-center justify-center h-full">
              <Boxes className="h-8 w-8 mb-2 opacity-40" />
              <p>Select any module in the graph, treemap, or tree view to inspect its architectural specifications.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
