// ==============================================================================
// tools/codebase-map/generate-repo-map.mjs
// Internal Zero-LLM-Cost Codebase Mapping Engine
// 1. Aider-style REPO_MAP.md with compact AST symbol signatures & line numbers
// 2. Graphify-style graph.json dependency graph mapping modules, imports & calls
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Default directory exclusions matching .gitignore and standard project hygiene
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.vercel',
  'out',
  'build',
  'dist',
  'coverage',
  '.system_generated',
  '.gemini',
  '.agents',
  'scratch',
  'logs'
]);

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.sql']);

/**
 * Determine node type categorization from path
 */
function categorizeFile(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm.startsWith('src/app/api/')) return 'api';
  if (norm.startsWith('src/app/') && (norm.includes('page.') || norm.includes('layout.'))) return 'page';
  if (norm.startsWith('src/actions/')) return 'action';
  if (norm.startsWith('src/components/')) return 'component';
  if (norm.startsWith('src/lib/')) return 'lib';
  if (norm.startsWith('src/types/')) return 'type';
  if (norm.startsWith('tests/')) return 'test';
  if (norm.startsWith('supabase/')) return 'database';
  if (norm.startsWith('tools/')) return 'tooling';
  return 'config';
}

/**
 * Recursively crawl directories while respecting ignore lists
 */
function crawlDirectory(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      crawlDirectory(fullPath, fileList);
    } else {
      const ext = path.extname(entry.name);
      if (EXTENSIONS.has(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

/**
 * Parse a TypeScript/JavaScript file using TypeScript Compiler AST
 */
function parseTypeScriptAST(filePath, sourceCode) {
  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filePath.endsWith('.ts')
    ? ts.ScriptKind.TS
    : filePath.endsWith('.jsx')
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const symbols = [];
  const imports = [];

  function getLineNumber(pos) {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function getCleanSignature(node) {
    const text = node.getText(sourceFile);
    // Grab first line or up to open brace/fat arrow
    const firstLine = text.split('\n')[0].trim();
    return firstLine.replace(/\{$/, '').trim();
  }

  function visit(node) {
    // 1. Imports
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.text;
      const specifiers = [];
      if (node.importClause) {
        if (node.importClause.name) {
          specifiers.push(node.importClause.name.text);
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const elem of node.importClause.namedBindings.elements) {
              specifiers.push(elem.name.text);
            }
          } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            specifiers.push(`* as ${node.importClause.namedBindings.name.text}`);
          }
        }
      }
      imports.push({
        moduleSpecifier,
        specifiers,
        line: getLineNumber(node.getStart(sourceFile)),
      });
    }

    // 2. Functions
    else if (ts.isFunctionDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      symbols.push({
        kind: 'function',
        name: node.name.text,
        signature: getCleanSignature(node),
        line: getLineNumber(node.getStart(sourceFile)),
        isExported: Boolean(isExported),
      });
    }

    // 3. Classes
    else if (ts.isClassDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const methods = [];

      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          methods.push({
            name: member.name.getText(sourceFile),
            signature: getCleanSignature(member),
            line: getLineNumber(member.getStart(sourceFile)),
          });
        }
      }

      symbols.push({
        kind: 'class',
        name: node.name.text,
        signature: getCleanSignature(node),
        line: getLineNumber(node.getStart(sourceFile)),
        isExported: Boolean(isExported),
        methods,
      });
    }

    // 4. Interfaces
    else if (ts.isInterfaceDeclaration(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      symbols.push({
        kind: 'interface',
        name: node.name.text,
        signature: `interface ${node.name.text}`,
        line: getLineNumber(node.getStart(sourceFile)),
        isExported: Boolean(isExported),
      });
    }

    // 5. Type Aliases
    else if (ts.isTypeAliasDeclaration(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      symbols.push({
        kind: 'type',
        name: node.name.text,
        signature: `type ${node.name.text}`,
        line: getLineNumber(node.getStart(sourceFile)),
        isExported: Boolean(isExported),
      });
    }

    // 6. Variable Statements (const Foo = () => ... or export const bar = ...)
    else if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      for (const decl of node.declarationList.declarations) {
        if (decl.name && ts.isIdentifier(decl.name)) {
          const varName = decl.name.text;
          const isComponentOrFn =
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) ||
              ts.isFunctionExpression(decl.initializer) ||
              /^[A-Z]/.test(varName));

          if (isExported || isComponentOrFn) {
            symbols.push({
              kind: isComponentOrFn ? 'component_or_fn' : 'const',
              name: varName,
              signature: getCleanSignature(decl),
              line: getLineNumber(decl.getStart(sourceFile)),
              isExported: Boolean(isExported),
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { symbols, imports };
}

/**
 * Fallback regex parser for SQL or other formats
 */
function parseGenericFile(sourceCode, ext) {
  const symbols = [];
  const lines = sourceCode.split('\n');

  if (ext === '.sql') {
    lines.forEach((line, idx) => {
      const tableMatch = line.match(/create\s+table\s+(if\s+not\s+exists\s+)?([a-zA-Z0-9_.]+)/i);
      const fnMatch = line.match(/create\s+(or\s+replace\s+)?function\s+([a-zA-Z0-9_.]+)/i);
      const policyMatch = line.match(/create\s+policy\s+"([^"]+)"\s+on\s+([a-zA-Z0-9_.]+)/i);

      if (tableMatch) {
        symbols.push({ kind: 'table', name: tableMatch[2], signature: line.trim(), line: idx + 1, isExported: true });
      } else if (fnMatch) {
        symbols.push({ kind: 'function', name: fnMatch[2], signature: line.trim(), line: idx + 1, isExported: true });
      } else if (policyMatch) {
        symbols.push({ kind: 'policy', name: `${policyMatch[1]} on ${policyMatch[2]}`, signature: line.trim(), line: idx + 1, isExported: true });
      }
    });
  }

  return { symbols, imports: [] };
}

/**
 * Resolve an import path to a concrete internal repository file
 */
function resolveImportPath(importerRelPath, importSpecifier, knownFilesSet) {
  // Ignore external packages (e.g. 'react', 'lucide-react')
  if (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('@/')) {
    return null;
  }

  let resolvedTarget = null;

  if (importSpecifier.startsWith('@/')) {
    const subPath = importSpecifier.slice(2);
    resolvedTarget = path.join(ROOT_DIR, 'src', subPath);
  } else if (importSpecifier.startsWith('.')) {
    const importerDir = path.dirname(path.join(ROOT_DIR, importerRelPath));
    resolvedTarget = path.resolve(importerDir, importSpecifier);
  }

  if (!resolvedTarget) return null;

  const candidates = [
    resolvedTarget,
    `${resolvedTarget}.ts`,
    `${resolvedTarget}.tsx`,
    `${resolvedTarget}.js`,
    `${resolvedTarget}.mjs`,
    path.join(resolvedTarget, 'index.ts'),
    path.join(resolvedTarget, 'index.tsx'),
    path.join(resolvedTarget, 'index.js'),
  ];

  for (const cand of candidates) {
    const relCand = path.relative(ROOT_DIR, cand).replace(/\\/g, '/');
    if (knownFilesSet.has(relCand)) {
      return relCand;
    }
  }

  return null;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Generating Enterprise Codebase Map & Dependency Graph...');

  const allFiles = crawlDirectory(ROOT_DIR);
  const knownFilesSet = new Set(allFiles.map((f) => path.relative(ROOT_DIR, f).replace(/\\/g, '/')));

  console.log(`📁 Found ${knownFilesSet.size} source files to inspect.`);

  const nodes = [];
  const edges = [];
  const repoMapEntries = [];
  let totalSymbolsCount = 0;
  let totalLinesCount = 0;

  for (const filePath of allFiles) {
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath);
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const lines = sourceCode.split('\n').length;
    totalLinesCount += lines;

    let parsed;
    if (['.ts', '.tsx', '.js', '.mjs'].includes(ext)) {
      parsed = parseTypeScriptAST(filePath, sourceCode);
    } else {
      parsed = parseGenericFile(sourceCode, ext);
    }

    totalSymbolsCount += parsed.symbols.length;
    const category = categorizeFile(relPath);

    // Add node to graph
    nodes.push({
      id: relPath,
      label: path.basename(relPath),
      path: relPath,
      type: category,
      extension: ext,
      lines,
      symbolsCount: parsed.symbols.length,
      symbols: parsed.symbols.map((s) => ({
        name: s.name,
        kind: s.kind,
        line: s.line,
        isExported: s.isExported,
      })),
    });

    // Add edges from imports
    for (const imp of parsed.imports) {
      const resolved = resolveImportPath(relPath, imp.moduleSpecifier, knownFilesSet);
      if (resolved && resolved !== relPath) {
        edges.push({
          source: relPath,
          target: resolved,
          type: 'imports',
          specifiers: imp.specifiers,
          line: imp.line,
        });
      }
    }

    // Build entry for REPO_MAP.md
    if (parsed.symbols.length > 0) {
      repoMapEntries.push({
        path: relPath,
        category,
        lines,
        symbols: parsed.symbols,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 1. Write REPO_MAP.md
  // --------------------------------------------------------------------------
  let markdown = `# Repository Map - Enterprise PMS\n\n`;
  markdown += `> Generated on ${new Date().toISOString()} | **${nodes.length}** source files | **${totalLinesCount.toLocaleString()}** lines of code | **${totalSymbolsCount.toLocaleString()}** indexed symbols | **${edges.length}** dependency relations\n\n`;
  markdown += `Compact AST symbol map (classes, functions, interfaces, types, components) with 1-based relative line numbers. Elides implementation bodies to optimize for AI token budget.\n\n`;
  markdown += `---\n\n`;

  // Group by category
  const categories = ['action', 'lib', 'component', 'page', 'api', 'type', 'database', 'tooling', 'test', 'config'];
  for (const cat of categories) {
    const catEntries = repoMapEntries.filter((e) => e.category === cat);
    if (catEntries.length === 0) continue;

    const catTitle = cat.toUpperCase();
    markdown += `## ${catTitle} (${catEntries.length} files)\n\n`;

    for (const entry of catEntries) {
      markdown += `### \`${entry.path}\` (${entry.lines} lines)\n`;
      markdown += `\`\`\`typescript\n`;
      for (const sym of entry.symbols) {
        const exportPrefix = sym.isExported ? 'export ' : '';
        if (sym.kind === 'class') {
          markdown += `L${sym.line}: ${exportPrefix}class ${sym.name}\n`;
          if (sym.methods && sym.methods.length > 0) {
            for (const m of sym.methods) {
              markdown += `  L${m.line}: ${m.name}(...)\n`;
            }
          }
        } else if (sym.kind === 'interface') {
          markdown += `L${sym.line}: ${exportPrefix}interface ${sym.name} { ... }\n`;
        } else if (sym.kind === 'type') {
          markdown += `L${sym.line}: ${exportPrefix}type ${sym.name}\n`;
        } else {
          markdown += `L${sym.line}: ${exportPrefix}${sym.kind} ${sym.name}\n`;
        }
      }
      markdown += `\`\`\`\n\n`;
    }
  }

  const repoMapPath = path.join(ROOT_DIR, 'REPO_MAP.md');
  fs.writeFileSync(repoMapPath, markdown, 'utf-8');
  console.log(`✅ Emitted REPO_MAP.md (${(fs.statSync(repoMapPath).size / 1024).toFixed(1)} KB)`);

  // --------------------------------------------------------------------------
  // 2. Write graph.json (Root, Tools, and Public directories)
  // --------------------------------------------------------------------------
  const graphData = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalFiles: nodes.length,
      totalEdges: edges.length,
      totalLines: totalLinesCount,
      totalSymbols: totalSymbolsCount,
    },
    nodes,
    edges,
  };

  const graphJsonStr = JSON.stringify(graphData, null, 2);

  // Root
  const rootGraphJsonPath = path.join(ROOT_DIR, 'graph.json');
  fs.writeFileSync(rootGraphJsonPath, graphJsonStr, 'utf-8');
  console.log(`✅ Emitted root graph.json (${(fs.statSync(rootGraphJsonPath).size / 1024).toFixed(1)} KB)`);

  // Tools
  const toolsGraphJsonPath = path.join(__dirname, 'graph.json');
  fs.writeFileSync(toolsGraphJsonPath, graphJsonStr, 'utf-8');
  console.log(`✅ Emitted tools/codebase-map/graph.json (${(fs.statSync(toolsGraphJsonPath).size / 1024).toFixed(1)} KB)`);

  // Public folder
  const publicGraphDir = path.join(ROOT_DIR, 'public/codebase-map');
  if (!fs.existsSync(publicGraphDir)) {
    fs.mkdirSync(publicGraphDir, { recursive: true });
  }
  const publicGraphJsonPath = path.join(publicGraphDir, 'graph.json');
  fs.writeFileSync(publicGraphJsonPath, graphJsonStr, 'utf-8');
  console.log(`✅ Mirrored to public/codebase-map/graph.json (${(fs.statSync(publicGraphJsonPath).size / 1024).toFixed(1)} KB)`);

  // --------------------------------------------------------------------------
  // 3. Write interactive index.html (with embedded data fallback)
  // --------------------------------------------------------------------------
  const templatePath = path.join(__dirname, 'index.html');
  let htmlTemplate = '';
  if (fs.existsSync(templatePath)) {
    htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
  }

  // Inject embedded graph data into HTML template for offline/standalone execution
  const embeddedScript = `<script>window.__EMBEDDED_GRAPH_DATA__ = ${JSON.stringify(graphData)};</script>\n  <script>`;
  let standaloneHtml = htmlTemplate;
  if (htmlTemplate.includes('<script>')) {
    standaloneHtml = htmlTemplate.replace('<script>', embeddedScript);
  }

  // Write to workspace root
  const rootHtmlPath = path.join(ROOT_DIR, 'index.html');
  fs.writeFileSync(rootHtmlPath, standaloneHtml, 'utf-8');
  console.log(`✅ Emitted root index.html (${(fs.statSync(rootHtmlPath).size / 1024).toFixed(1)} KB)`);

  const rootCodebaseMapHtmlPath = path.join(ROOT_DIR, 'codebase-map.html');
  fs.writeFileSync(rootCodebaseMapHtmlPath, standaloneHtml, 'utf-8');
  console.log(`✅ Emitted root codebase-map.html (${(fs.statSync(rootCodebaseMapHtmlPath).size / 1024).toFixed(1)} KB)`);

  // Write to public/codebase-map
  const publicHtmlPath = path.join(publicGraphDir, 'index.html');
  fs.writeFileSync(publicHtmlPath, standaloneHtml, 'utf-8');
  console.log(`✅ Mirrored to public/codebase-map/index.html (${(fs.statSync(publicHtmlPath).size / 1024).toFixed(1)} KB)`);

  console.log('✨ Codebase mapping completed successfully!');
}

main().catch((err) => {
  console.error('❌ Failed to generate repository map:', err);
  process.exit(1);
});
