# Onboarding Guide

This guide teaches you how to think about the codebase, run the tool, and extend it.

## What This Project Is

This is a **scoring tool**, not a migration tool. It answers one question: "How good was this PatternFly 5-to-6 migration?" It does this by comparing a migration PR (the candidate you want to score) against a golden PR (an expert-approved reference migration), then producing a weighted percentage score with detailed breakdowns.

Think of it like a grading rubric for code migrations. The golden PR is the answer key. The migration PR is the student's submission. The tool checks whether the student applied each required change correctly.

## Mental Model

The tool is a five-stage pipeline. Data flows in one direction:

```
Raw Diffs  -->  Matched File Pairs  -->  Pattern Detections  -->  Score  -->  Report
 (input)         (analysis)              (24 detectors)       (engine)    (JSON + MD)
```

Each stage has a clear responsibility and a clean boundary. Understanding this pipeline is the single most important thing for working in the codebase.

### Stage 1: Input (`src/input/`)

The tool accepts two input modes that produce the same output type (`FileDiff[]`):

- **PR URL mode** - Calls `gh pr diff <url>` to fetch a unified diff from GitHub. Requires the `gh` CLI installed and authenticated.
- **Local directory mode** - Runs `git diff` between the merge base and HEAD in a local checkout. Also reads full file contents from disk, which enables richer AST analysis.

Both modes feed into the diff parser (`diff-parser.ts`), which splits raw unified diff text into structured `FileDiff` objects: one per changed file, with parsed hunks, added lines, and removed lines.

### Stage 2: Analysis (`src/analysis/`)

Three modules prepare the data for pattern detection:

- **file-matcher.ts** - Pairs golden files with migration files by normalized path. Outputs matched pairs, missed files (in golden but not in migration), and extra files (in migration but not in golden). Snapshot and lockfiles are excluded.
- **ast-analyzer.ts** - Uses ts-morph to extract imports, JSX component usages, and props from TypeScript/TSX code. Works with full file contents (local mode) or reconstructed content from diff lines (PR mode).
- **css-analyzer.ts** - Regex-based detection of PF5/PF6 CSS class names and custom properties.

### Stage 3: Pattern Detection (`src/patterns/`)

This is the heart of the tool. 24 pattern detectors, each in its own file, check whether specific PF5-to-PF6 migration changes were applied correctly. They are organized by complexity:

| Tier | Count | Weight | Examples |
|------|-------|--------|----------|
| Trivial | 12 | 1x | CSS class prefix rename, `innerRef` to `ref`, prop renames |
| Moderate | 9 | 2x | EmptyState restructure, Button icon prop, PageSection variant removal |
| Complex | 3 | 3x | Select component rewrite, Masthead reorganization, test selector updates |

Every detector follows the same contract:

1. Examine the golden diff to see if this pattern is relevant. If not, return `NOT_APPLICABLE`.
2. If the migration file is null (missing), return `FILE_MISSING`.
3. Compare the migration against the golden to determine `CORRECT`, `MISSING`, or `INCORRECT`.

Detectors use a "diff-first, AST-second" strategy: they always check diff lines first (fast, works in both modes), and optionally use AST data for more precise detection when available.

### Stage 4: Scoring (`src/scoring/`)

Two modules produce the final score:

- **noise-detector.ts** - Scans migration diffs for artifacts (`console.log`, `debugger`, `TODO`), placeholder tokens (`t_temp_dev_tbd`, `FIXME`), formatting-only changes, and unnecessary files. Each carries a small penalty.
- **engine.ts** - Computes the weighted score:

```
FinalScore = (0.20 * FileCoverage) + (0.65 * PatternScore) + (0.15 * (1 - NoisePenalty))
```

Pattern detection is 65% of the score. Complex patterns (weight=3) count three times more than trivial patterns (weight=1). A `CORRECT` detection earns full credit (1.0), `INCORRECT` earns partial credit (0.25), and `MISSING` or `FILE_MISSING` earn nothing. `NOT_APPLICABLE` results are excluded from the denominator entirely.

### Stage 5: Reporting (`src/reporting/`)

Two reporters consume the `EvalReport` object:

- **json-reporter.ts** - Machine-readable JSON with full detail. Used for regression baselines and downstream tooling.
- **markdown-reporter.ts** - Human-readable Markdown with an executive summary, file coverage table, pattern results grouped by complexity with status icons, noise findings, and actionable recommendations.

Both write timestamped files to the output directory.

## How the Pattern Registry Works

The registry (`src/patterns/registry.ts`) is a module-level singleton array. Each detector file calls `registerPattern(pattern)` at module load time:

```typescript
// In each detector file:
const pattern: PatternDefinition = { id, name, complexity, weight, description, detect };
registerPattern(pattern);
export { pattern };
```

The CLI (`src/cli.ts`) imports all 24 detector files as side-effect imports at the top of the file. This triggers registration before any pattern detection runs. There is no config file or dynamic discovery; the import list in `cli.ts` is the source of truth for which detectors are active.

## Project Layout

```
eval-pf-code-migr/
├── eval/approach1/           # All source code lives here
│   ├── package.json          # ESM project ("type": "module")
│   ├── tsconfig.json         # Strict TypeScript, JSX preserve, bundler resolution
│   ├── src/
│   │   ├── cli.ts            # Entry point - orchestrates the full pipeline
│   │   ├── types.ts          # All shared type definitions
│   │   ├── utils/logger.ts   # Chalk-based colored logging
│   │   ├── input/            # Diff parsing, PR fetching, local reading
│   │   ├── analysis/         # File matching, AST extraction, CSS detection
│   │   ├── patterns/         # 24 pattern detectors + registry
│   │   ├── scoring/          # Scoring engine + noise detection
│   │   └── reporting/        # JSON + Markdown report generation
│   └── node_modules/
├── prd.json                  # Product requirements (23 user stories)
├── progress.txt              # Development journal with codebase patterns
├── CLAUDE.md                 # Ralph agent instructions
├── PLAN.md                   # Original PRD in Markdown form
└── ralph.sh                  # Autonomous agent loop runner
```

Tests live in `__tests__/` directories alongside their source modules (e.g., `src/input/__tests__/diff-parser.test.ts`).

## Running the Tool

### Prerequisites

- **Node.js** >= 18 (tested with v25.4.0)
- **npm** (comes with Node)
- **gh CLI** - Only needed for PR URL mode. Install from https://cli.github.com/ and run `gh auth login`.
- **Git** - Only needed for local directory mode.

### Setup

```bash
cd eval/approach1
npm install
```

### Quality Checks

```bash
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run test         # Run all 384 tests (~1.5s)
npm run test:watch   # Run tests in watch mode during development
```

### Running an Evaluation

**PR URL mode** - compare two GitHub PRs:

```bash
cd eval/approach1
npx tsx src/cli.ts \
  --golden-pr https://github.com/quipucords/quipucords-ui/pull/664 \
  --migration-pr https://github.com/jwmatthews/quipucords-ui/pull/4 \
  --output-dir ./results
```

**Local directory mode** - compare two local git checkouts:

```bash
cd eval/approach1
npx tsx src/cli.ts \
  --golden-dir /path/to/golden-branch-checkout \
  --migration-dir /path/to/migration-branch-checkout \
  --output-dir ./results
```

**Add `--verbose`** to see per-file detection results during analysis.

### Output

The tool prints a summary to stdout:

```
=== PF Migration Evaluation Summary ===
Overall Score: 66.69% (D)
File Coverage: 78.95%
Pattern Score: 64.46%
Noise Penalty: 40%
```

And writes two report files to the output directory:
- `eval-report_YYYY-MM-DD_HH-mm-ss-mmm.json` - Full machine-readable report
- `eval-report_YYYY-MM-DD_HH-mm-ss-mmm.md` - Human-readable Markdown with tables and recommendations

### Grade Scale

| Grade | Score Range |
|-------|------------|
| A | 90-100% |
| B | 80-89% |
| C | 70-79% |
| D | 60-69% |
| F | Below 60% |

## Key Type Definitions

All shared types live in `src/types.ts`. The most important ones:

- **`FileDiff`** - A parsed diff for a single file. Contains `filePath`, `addedLines[]`, `removedLines[]`, `hunks[]`, and metadata flags (`isBinary`, `isRenamed`).
- **`PatternDefinition`** - The contract for a detector. Has `id`, `name`, `complexity`, `weight`, `description`, and a `detect` function.
- **`DetectionResult`** - What a detector returns. Has `patternId`, `status` (one of the `DetectionStatus` enum values), `message`, and optional `details[]`.
- **`DetectionStatus`** - Enum: `CORRECT`, `MISSING`, `INCORRECT`, `UNNECESSARY`, `FILE_MISSING`, `NOT_APPLICABLE`.
- **`EvalReport`** - The full evaluation output: metadata, summary scores, per-file results, pattern breakdown, and noise instances.

## Extending the Tool

### Adding a New Pattern Detector

1. Create a new file in `src/patterns/`, e.g., `my-new-pattern.ts`.
2. Follow the standard detector template:

```typescript
import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, ASTRepresentation, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
  goldenAST?: ASTRepresentation,
  migrationAST?: ASTRepresentation,
): DetectionResult {
  // 1. Check golden diff for this pattern. If absent, return NOT_APPLICABLE.
  // 2. If migrationDiff is null, return FILE_MISSING.
  // 3. Compare golden vs migration. Return CORRECT, MISSING, or INCORRECT.
}

const pattern: PatternDefinition = {
  id: 'my-new-pattern',
  name: 'My New Pattern',
  complexity: 'trivial',  // or 'moderate' or 'complex'
  weight: 1,              // 1, 2, or 3 (must match complexity tier)
  description: 'Detects ...',
  detect,
};

registerPattern(pattern);
export { pattern };
```

3. Add a side-effect import in `src/cli.ts`:
```typescript
import './patterns/my-new-pattern.js';
```

4. Add the pattern ID to the appropriate complexity list in `src/reporting/markdown-reporter.ts` (the `groupByComplexity` function).

5. Write tests in `src/patterns/__tests__/`.

### Adjusting the Scoring Formula

The formula and credit values are in `src/scoring/engine.ts`. The weights (0.20, 0.65, 0.15) and credit values (CORRECT=1.0, INCORRECT=0.25) are constants at the top of the file. Change them and re-run the integration test to see the effect.

### Adding a New Noise Type

Add a new detection function in `src/scoring/noise-detector.ts`, define its penalty in the `PENALTY` object, and call it from `detectNoise()`.

## Gotchas and Important Patterns

These were discovered during development and will save you time:

- **ESM imports need `.js` extensions.** The project uses `"type": "module"`. Write `import { foo } from './bar.js'` even though the source file is `bar.ts`.
- **ts-morph requires specific config.** Always use `useInMemoryFileSystem: true`, `skipFileDependencyResolution: true`, `skipAddingFilesFromTsConfig: true`. Always add source files with `.tsx` extension for JSX parsing.
- **Don't use regex `g` flag with `.test()` in loops.** The `lastIndex` state persists between calls, causing intermittent failures. Use fresh regex literals instead.
- **Anchor import path matches with quotes, not `\b`.** Use `['"]@patternfly/react-tokens['"]` to avoid matching subpaths like `@patternfly/react-tokens/dist/...`.
- **The pattern registry is a singleton.** In tests, call `clearPatterns()` in `beforeEach` to avoid pollution between test files.
- **Don't use `promisify(execFile)` with vitest mocks.** Write a manual Promise wrapper instead. The real `execFile` has a `util.promisify.custom` symbol that `vi.fn()` doesn't replicate.
- **JsxAttribute children in ts-morph.** Boolean attributes like `isDisabled` have 1 child (the name). Value attributes like `size="lg"` have 3 children (name, `=`, value). Check `getChildCount()` before accessing index 2.

## The Ralph System

This project was built by an autonomous AI agent called Ralph, driven by the `CLAUDE.md` instructions and `prd.json` user stories. The `ralph.sh` script runs the agent in a loop, picking up one user story per iteration. The `progress.txt` file contains the full development journal.

You don't need to use Ralph to work on this project. It's a normal TypeScript project you can develop however you prefer. Ralph is relevant if you want to add new features via the PRD-driven autonomous workflow.

## Future Modification Ideas

- **Partial credit for complex patterns.** Currently a Select rewrite that gets 3 of 5 props right scores 0.25 (INCORRECT). It could score 0.6 with finer-grained credit.
- **Alternative-but-valid migrations.** The tool currently requires the migration to match the golden approach. Some PF6 components have multiple valid migration paths.
- **Custom pattern definitions via config file.** Teams could add repo-specific patterns without modifying source code.
- **Penalty calibration.** The current noise penalties (0.01-0.05) are initial estimates. Real-world usage may reveal they need adjustment.
- **CI/CD integration.** The JSON output is machine-readable. A GitHub Action could run the tool on migration PRs and post the Markdown report as a PR comment.
- **Incremental analysis.** Currently each run evaluates from scratch. Caching parsed diffs and AST results could speed up repeated runs.
- **Support for PF6-to-PF7.** The architecture generalizes beyond PF5-to-PF6. New detector sets could target future major version migrations.
