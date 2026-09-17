// ==============================================================================
// src/lib/stores/gantt-store.ts
// Interactive SVG Gantt Chart & Canvas Pan/Zoom State Store
// ==============================================================================

import { create } from 'zustand';

export type GanttZoomLevel = 'day' | 'week' | 'month' | 'quarter';

interface GanttState {
  zoomLevel: GanttZoomLevel;
  columnWidth: number;
  rowHeight: number;
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
  // Drag-to-connect dependency state
  isConnectingDependency: boolean;
  sourceTaskId: string | null;
  sourceHandle: 'start' | 'finish' | null;
  // Visual filters & highlights
  highlightCriticalPath: boolean;
  filterStatus: string;
  filterAssignee: string;
  searchQuery: string;

  // Actions
  setZoomLevel: (zoom: GanttZoomLevel) => void;
  setSelectedTaskId: (id: string | null) => void;
  setHoveredTaskId: (id: string | null) => void;
  startDependencyConnection: (taskId: string, handle: 'start' | 'finish') => void;
  cancelDependencyConnection: () => void;
  toggleCriticalPathHighlight: () => void;
  setFilterStatus: (status: string) => void;
  setFilterAssignee: (assignee: string) => void;
  setSearchQuery: (query: string) => void;
}

const ZOOM_WIDTHS: Record<GanttZoomLevel, number> = {
  day: 44,
  week: 110,
  month: 160,
  quarter: 220,
};

export const useGanttStore = create<GanttState>((set) => ({
  zoomLevel: 'day',
  columnWidth: ZOOM_WIDTHS.day,
  rowHeight: 44,
  selectedTaskId: null,
  hoveredTaskId: null,
  isConnectingDependency: false,
  sourceTaskId: null,
  sourceHandle: null,
  highlightCriticalPath: true,
  filterStatus: 'all',
  filterAssignee: 'all',
  searchQuery: '',

  setZoomLevel: (zoomLevel: GanttZoomLevel) => {
    set({
      zoomLevel,
      columnWidth: ZOOM_WIDTHS[zoomLevel],
    });
  },

  setSelectedTaskId: (selectedTaskId: string | null) => {
    set({ selectedTaskId });
  },

  setHoveredTaskId: (hoveredTaskId: string | null) => {
    set({ hoveredTaskId });
  },

  startDependencyConnection: (sourceTaskId: string, sourceHandle: 'start' | 'finish') => {
    set({
      isConnectingDependency: true,
      sourceTaskId,
      sourceHandle,
    });
  },

  cancelDependencyConnection: () => {
    set({
      isConnectingDependency: false,
      sourceTaskId: null,
      sourceHandle: null,
    });
  },

  toggleCriticalPathHighlight: () => {
    set((state) => ({ highlightCriticalPath: !state.highlightCriticalPath }));
  },

  setFilterStatus: (filterStatus: string) => {
    set({ filterStatus });
  },

  setFilterAssignee: (filterAssignee: string) => {
    set({ filterAssignee });
  },

  setSearchQuery: (searchQuery: string) => {
    set({ searchQuery });
  },
}));
