# Enterprise Codebase Mapping Utility

This utility generates an internal, zero-LLM-cost codebase architecture map with two primary outputs:
1. **`REPO_MAP.md`**: An Aider-style compact symbol map parsing AST functions, classes, interfaces, and methods with line numbers.
2. **`graph.json` & `index.html`**: A Graphify-style interactive visual D3.js dependency graph mapping module relationships, imports, and calls.

## How to Run

Generate the latest map and dependency graph:
```bash
pnpm repo:map
```
or
```bash
node tools/codebase-map/generate-repo-map.mjs
```

## Visualizer Dashboard

Open `tools/codebase-map/index.html` or `public/codebase-map/index.html` in your browser (or serve with any static server) to interact with:
- Force-directed physics node-and-edge layout.
- Search and filter by file path, category, or symbol.
- Inspector drawer displaying line metrics, exported symbols, incoming dependencies (`Imported By`), and outgoing dependencies (`Imports`).
