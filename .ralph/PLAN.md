# PRD: PatternFly 5-to-6 Migration Evaluation Suite

## Introduction

A repeatable evaluation tool that scores how well an AI migration tool converted PatternFly 5 code to PatternFly 6. It works by comparing a migration PR (the candidate) against an expert-approved "golden source" PR (the answer key), producing a weighted score with detailed per-file and per-pattern breakdowns.

The tool is generalizable to any repository with a golden PR. The initial validation target is quipucords-ui, where a known golden PR (quipucords/quipucords-ui#664, 57 files, 35+ patterns) and a known AI migration PR (jwmatthews/quipucords-ui#4, 51 files, several correctness issues) provide a concrete baseline.

A small team of engineers will use this tool to iteratively improve an AI-powered migration skill, running it after each migration attempt to measure progress.

## Goals

- Score migration quality on a 0-100% scale using weighted pattern detection across trivial (1x), moderate (2x), and complex (3x) categories
- Detect 24 specific PF5-to-PF6 migration patterns covering imports, props, component restructuring, CSS, and test selectors
- Identify and penalize noise: unnecessary changes, placeholder tokens, artifacts, formatting-only edits
- Support two input modes equally: PR URLs (via `gh pr diff`) and local directory comparison
- Produce both machine-readable (JSON) and human-readable (Markdown) reports
- Work against any PF5-to-PF6 migration, not just quipucords-ui

## User Stories

### US-001: Initialize project scaffolding
**Description:** As a developer, I need the project structure, dependencies, and build tooling so I can start implementing features.

**Acceptance Criteria:**
- [ ] `eval/approach1/package.json` with dependencies: ts-morph, commander, chalk
- [ ] `eval/approach1/tsconfig.json` configured for TypeScript with JSX support
- [ ] `eval/approach1/src/types.ts` with all shared interfaces (FileDiff, ASTRepresentation, PatternDefinition, DetectionResult, EvalReport)
- [ ] `eval/approach1/src/cli.ts` skeleton using commander with `--golden-pr`, `--migration-pr`, `--golden-dir`, `--migration-dir`, `--output-dir`, `--verbose` options
- [ ] `eval/approach1/src/utils/logger.ts` with chalk-based console logging
- [ ] `npm install` succeeds
- [ ] `npx tsc --noEmit` passes with no errors

### US-002: Parse unified diffs into structured data
**Description:** As the evaluation engine, I need to parse unified diff output into structured FileDiff objects so pattern detectors can examine added/removed lines per file.

**Acceptance Criteria:**
- [ ] `src/input/diff-parser.ts` parses standard unified diff format
- [ ] Each FileDiff contains: file path, list of added lines (with line numbers), list of removed lines (with line numbers), raw hunks
- [ ] Handles renamed files (detects `a/old-path` -> `b/new-path`)
- [ ] Handles binary files gracefully (skips them)
- [ ] Handles files with no newline at end of file
- [ ] Unit tests cover: single-file diff, multi-file diff, renamed files, empty diff, binary files
- [ ] Typecheck passes

### US-003: Fetch diffs from GitHub PR URLs
**Description:** As a user, I want to provide GitHub PR URLs so I can evaluate migrations without cloning repos.

**Acceptance Criteria:**
- [ ] `src/input/pr-fetcher.ts` calls `gh pr diff <url>` and returns parsed FileDiff[]
- [ ] Validates that `gh` CLI is available and authenticated
- [ ] Provides clear error message if `gh` is not installed or PR URL is invalid
- [ ] Works with PRs from any public GitHub repository
- [ ] Unit test with mocked `gh` output

### US-004: Read diffs from local directories
**Description:** As a user, I want to provide local directories (checked-out branches) so I can evaluate migrations from local git repos.

**Acceptance Criteria:**
- [ ] `src/input/local-reader.ts` runs `git diff` between the merge base and branch HEAD
- [ ] Also reads full file contents from disk for AST analysis
- [ ] Validates that provided directories are valid git repositories
- [ ] Provides clear error message if directory doesn't exist or isn't a git repo
- [ ] Unit test with a temporary git repo fixture

### US-005: Match golden files to migration files
**Description:** As the evaluation engine, I need to pair files from the golden PR with corresponding files in the migration PR so I can compare them.

**Acceptance Criteria:**
- [ ] `src/analysis/file-matcher.ts` matches files by normalized path
- [ ] Identifies files present in golden but missing in migration (missed files)
- [ ] Identifies files present in migration but not in golden (extra files)
- [ ] Excludes snapshot files (`.snap`) and lockfiles from matching
- [ ] Handles path prefix differences (e.g., `a/src/...` vs `src/...`)
- [ ] Returns a MatchResult with: matched pairs, missed files, extra files
- [ ] Unit tests cover: exact matches, missed files, extra files, snapshot exclusion

### US-006: Extract AST information from TypeScript/TSX files
**Description:** As pattern detectors, I need structured AST data (imports, component usages, props) so I can perform semantic comparison beyond simple text matching.

**Acceptance Criteria:**
- [ ] `src/analysis/ast-analyzer.ts` uses ts-morph with `skipFileDependencyResolution: true`
- [ ] Files are added with `.tsx` extension for JSX parsing
- [ ] Extracts: import declarations (module specifier + named imports), JSX component usages (tag name + props with values), JSX children structure
- [ ] Handles files that fail to parse gracefully (returns partial result + warning)
- [ ] Works with both full file content (local mode) and reconstructed content from diff (PR mode)
- [ ] Unit tests against known PF5 and PF6 code snippets

### US-007: Detect CSS patterns via regex
**Description:** As pattern detectors, I need to identify CSS class references and custom property names so I can check CSS-related migration patterns.

**Acceptance Criteria:**
- [ ] `src/analysis/css-analyzer.ts` detects class name references in JSX `className` props, template literals, and string concatenation
- [ ] Detects CSS custom property references (e.g., `--pf-v5-*` -> `--pf-v6-*`)
- [ ] Detects `pf-v5-u-*` utility class references
- [ ] Unit tests for className strings, template literals, CSS custom properties

### US-008: Build pattern registry and detector framework
**Description:** As a developer, I need a registry that catalogs all 24 pattern detectors and dispatches detection so individual detectors have a consistent interface.

**Acceptance Criteria:**
- [ ] `src/patterns/registry.ts` exports a list of all registered PatternDefinition objects
- [ ] `src/patterns/types.ts` defines the PatternDefinition interface: id, name, complexity (trivial|moderate|complex), weight (1|2|3), description, detect function signature
- [ ] Detect function signature: `(goldenDiff: FileDiff, migrationDiff: FileDiff | null, goldenAST?: ASTRepresentation, migrationAST?: ASTRepresentation) => DetectionResult`
- [ ] Registry can filter patterns by complexity level
- [ ] DetectionResult statuses: CORRECT, MISSING, INCORRECT, UNNECESSARY, FILE_MISSING, NOT_APPLICABLE
- [ ] Unit test: registry returns all 24 patterns, grouped correctly by complexity

### US-009: Implement 12 trivial pattern detectors
**Description:** As the evaluation engine, I need to detect the 12 simplest PF5-to-PF6 migration patterns (weight=1) that involve straightforward renames or removals.

**Acceptance Criteria:**
- [ ] `css-class-prefix.ts` - detects `pf-v5-*` -> `pf-v6-*` class renames
- [ ] `inner-ref-to-ref.ts` - detects `innerRef` -> `ref` prop renames
- [ ] `ouia-component-id.ts` - detects `data-ouia-component-id` -> `ouiaId`
- [ ] `align-right-to-end.ts` - detects `alignRight` -> `alignEnd`
- [ ] `chips-to-labels.ts` - detects chips/deleteChip -> labels/deleteLabel
- [ ] `split-button-items.ts` - detects `splitButtonOptions` -> `splitButtonItems`
- [ ] `modal-import-path.ts` - detects Modal import path to deprecated path
- [ ] `utility-class-rename.ts` - detects `pf-v5-u-*` -> `pf-v6-u-*`
- [ ] `is-action-cell.ts` - detects `isActionCell` -> `hasAction`
- [ ] `theme-dark-removal.ts` - detects removal of `theme="dark"`
- [ ] `space-items-removal.ts` - detects removal of `spaceItems` prop
- [ ] `css-logical-properties.ts` - detects `--PaddingTop` -> `--PaddingBlockStart` and similar
- [ ] Each detector returns NOT_APPLICABLE when the pattern doesn't exist in the golden diff
- [ ] Each detector has at least one unit test with a golden/migration diff pair
- [ ] Typecheck passes

### US-010: Implement 9 moderate pattern detectors
**Description:** As the evaluation engine, I need to detect 9 moderately complex PF5-to-PF6 migration patterns (weight=2) that involve structural changes or multi-prop updates.

**Acceptance Criteria:**
- [ ] `text-content-consolidation.ts` - detects TextContent component consolidation
- [ ] `empty-state-restructure.ts` - detects EmptyState children restructuring (uses AST)
- [ ] `toolbar-variant.ts` - detects Toolbar variant prop changes
- [ ] `toolbar-gap.ts` - detects Toolbar gap/spacer changes
- [ ] `button-icon-prop.ts` - detects Button icon prop restructuring (uses AST)
- [ ] `page-section-variant.ts` - detects PageSection variant changes
- [ ] `page-masthead.ts` - detects Page masthead prop migration
- [ ] `react-tokens-icon-status.ts` - detects react-tokens and icon/status import changes
- [ ] `avatar-adoption.ts` - detects Avatar component adoption patterns
- [ ] Each detector returns NOT_APPLICABLE when the pattern doesn't exist in the golden diff
- [ ] Each detector has at least one unit test
- [ ] Typecheck passes

### US-011: Implement 3 complex pattern detectors
**Description:** As the evaluation engine, I need to detect 3 complex PF5-to-PF6 migration patterns (weight=3) that involve significant component rewrites or architectural changes.

**Acceptance Criteria:**
- [ ] `select-rewrite.ts` - detects Select component rewrite to new PF6 API (uses AST for prop/children comparison)
- [ ] `masthead-reorganization.ts` - detects Masthead component hierarchy reorganization (uses AST)
- [ ] `test-selector-rewrite.ts` - detects test selector updates (data-testid, aria-label changes)
- [ ] Each detector handles partial migrations (returns INCORRECT with explanatory notes)
- [ ] Each detector returns NOT_APPLICABLE when the pattern doesn't exist in the golden diff
- [ ] Each detector has at least one unit test with realistic code snippets
- [ ] Typecheck passes

### US-012: Implement weighted scoring engine
**Description:** As a user, I want an overall quality score that weights pattern detection results by complexity and accounts for file coverage and noise.

**Acceptance Criteria:**
- [ ] `src/scoring/engine.ts` implements the formula: `FinalScore = (0.20 * FileCoverage) + (0.65 * PatternScore) + (0.15 * (1 - NoisePenalty))`
- [ ] FileCoverage = matched files / golden files (excluding snapshots and lockfiles)
- [ ] PatternScore = sum(weight * credit) / sum(weight * expected), where CORRECT=1.0, INCORRECT=0.25, MISSING=0, FILE_MISSING=0, NOT_APPLICABLE excluded from denominator
- [ ] NoisePenalty = min(1.0, sum of all penalty amounts)
- [ ] Score is normalized to 0-100% range
- [ ] Unit tests: perfect migration = 100%, empty migration = ~15% (noise-free), known bad migration = 60-70%
- [ ] Typecheck passes

### US-013: Implement noise detection and penalties
**Description:** As a user, I want the tool to identify and penalize artifacts, placeholder tokens, and unnecessary changes so the score reflects real migration quality.

**Acceptance Criteria:**
- [ ] `src/scoring/noise-detector.ts` detects and penalizes:
  - Unnecessary changes not in golden (0.01/file)
  - Formatting-only changes (0.02/file)
  - Incorrect migrations that introduce bugs (0.03/instance)
  - Build/tool artifacts left in code (0.05/instance)
  - Placeholder tokens like `t_temp_dev_tbd` (0.05/instance)
- [ ] Returns a list of NoiseInstance objects with type, file, line, description
- [ ] Total penalty is capped at 1.0
- [ ] Unit tests for each noise type
- [ ] Typecheck passes

### US-014: Generate JSON report
**Description:** As a developer, I want machine-readable JSON output so I can track scores over time, compare runs, and integrate with other tools.

**Acceptance Criteria:**
- [ ] `src/reporting/json-reporter.ts` writes an EvalReport to a JSON file
- [ ] Report includes: metadata (timestamp, golden source, migration source, tool version), summary (overall score, file coverage, pattern score, noise penalty), per-file breakdown, per-pattern breakdown, noise instances
- [ ] Output file is written to `--output-dir` with a timestamped filename
- [ ] JSON is formatted with 2-space indentation for readability
- [ ] Typecheck passes

### US-015: Generate Markdown report
**Description:** As a user, I want a human-readable Markdown report so I can quickly understand what the migration got right, what it missed, and where it introduced errors.

**Acceptance Criteria:**
- [ ] `src/reporting/markdown-reporter.ts` generates a Markdown file from the EvalReport
- [ ] Report sections: Executive Summary (score + grade), File Coverage (table of matched/missed/extra), Pattern Results (grouped by complexity, with status icons), Noise Findings (list with file/line references), Recommendations (top issues to fix)
- [ ] Uses tables and status icons (checkmark, X, warning) for scannability
- [ ] Output file is written to `--output-dir` with a timestamped filename
- [ ] Typecheck passes

### US-016: Wire CLI end-to-end
**Description:** As a user, I want to run a single command that fetches inputs, runs analysis, scores results, and produces reports.

**Acceptance Criteria:**
- [ ] `src/cli.ts` orchestrates the full pipeline: input -> file matching -> AST analysis -> pattern detection -> scoring -> reporting
- [ ] PR URL mode: `tsx src/cli.ts --golden-pr <url> --migration-pr <url>` works end-to-end
- [ ] Local directory mode: `tsx src/cli.ts --golden-dir <path> --migration-dir <path>` works end-to-end
- [ ] `--output-dir` defaults to `./results`
- [ ] `--verbose` prints per-file detection results during analysis
- [ ] Exits with code 0 on success, non-zero on error
- [ ] Prints summary score to stdout on completion
- [ ] Typecheck passes

### US-017: Integration test against known PRs
**Description:** As a developer, I need to validate the tool against the known golden and migration PRs to ensure scores are consistent and match manual analysis.

**Acceptance Criteria:**
- [ ] Run tool against quipucords/quipucords-ui#664 (golden) and jwmatthews/quipucords-ui#4 (migration)
- [ ] File coverage correctly identifies the 7 missed files and 2 extra files
- [ ] Pattern detectors catch known issues: `title` vs `titleText`, placeholder tokens (`t_temp_dev_tbd`), missing `innerRef`->`ref` renames, incomplete masthead migration
- [ ] Overall score falls in the 60-70% range
- [ ] JSON output is saved as a regression baseline
- [ ] Future runs on the same PRs produce identical scores

## Functional Requirements

- FR-1: The system must parse standard unified diff format into structured FileDiff objects with per-file added/removed lines
- FR-2: The system must fetch PR diffs using `gh pr diff <url>` for any public GitHub repository
- FR-3: The system must generate diffs from local git repositories using `git diff` between merge base and HEAD
- FR-4: The system must match files between golden and migration diffs by normalized path, reporting missed and extra files
- FR-5: The system must exclude snapshot files (`.snap`) and lockfiles from file matching and scoring
- FR-6: The system must extract AST information (imports, JSX component usages with props, CSS class references) from TypeScript/TSX files using ts-morph
- FR-7: The system must detect 24 specific PF5-to-PF6 migration patterns across three complexity tiers: 12 trivial (weight=1), 9 moderate (weight=2), 3 complex (weight=3)
- FR-8: Each pattern detector must return one of: CORRECT, MISSING, INCORRECT, UNNECESSARY, FILE_MISSING, or NOT_APPLICABLE
- FR-9: Pattern detection must work in diff-only mode (PR URLs) using line-level matching, with optional AST enhancement when full files are available (local mode)
- FR-10: The system must compute a weighted score using the formula: `FinalScore = (0.20 * FileCoverage) + (0.65 * PatternScore) + (0.15 * (1 - NoisePenalty))`
- FR-11: The system must detect and penalize noise: unnecessary changes (0.01/file), formatting-only (0.02/file), incorrect migrations (0.03/instance), artifacts (0.05/instance), placeholder tokens (0.05/instance)
- FR-12: The system must produce a JSON report with metadata, summary scores, per-file breakdowns, and per-pattern results
- FR-13: The system must produce a Markdown report with executive summary, file coverage table, pattern results grouped by complexity, noise findings, and recommendations
- FR-14: The system must accept input via CLI with `--golden-pr`/`--migration-pr` (PR mode) or `--golden-dir`/`--migration-dir` (local mode)
- FR-15: The system must work against any PF5-to-PF6 migration repository, not just quipucords-ui

## Non-Goals

- **Not a migration tool** - This tool evaluates migrations, it does not perform them
- **Not a linter or codemod** - It does not modify source code or suggest fixes
- **No PF4-to-PF5 support** - Only PF5-to-PF6 patterns are in scope
- **No real-time or watch mode** - It runs as a one-shot CLI command
- **No web UI or dashboard** - Output is JSON and Markdown files only
- **No CI/CD integration** - No GitHub Actions, webhooks, or automated PR commenting (though JSON output enables downstream integration)
- **No private repo support** - Assumes `gh` is authenticated but does not handle SSO or fine-grained token management
- **No incremental analysis** - Each run evaluates the full migration from scratch

## Technical Considerations

### Directory Structure

```
eval/approach1/
  package.json
  tsconfig.json
  src/
    cli.ts                          # CLI entry point (commander)
    types.ts                        # All shared interfaces
    input/
      diff-parser.ts                # Parse unified diff -> FileDiff objects
      pr-fetcher.ts                 # gh pr diff integration
      local-reader.ts               # Local git diff + file reading
    analysis/
      ast-analyzer.ts               # ts-morph extraction -> ASTRepresentation
      css-analyzer.ts               # Regex-based CSS pattern detection
      file-matcher.ts               # Match golden files to migration files
    patterns/
      registry.ts                   # Pattern catalog & dispatch
      types.ts                      # Pattern-specific types
      detectors/
        trivial/                    # 12 detectors (weight=1)
          css-class-prefix.ts       # pf-v5-* -> pf-v6-*
          inner-ref-to-ref.ts       # innerRef -> ref
          ouia-component-id.ts      # data-ouia-component-id -> ouiaId
          align-right-to-end.ts     # alignRight -> alignEnd
          chips-to-labels.ts        # chips/deleteChip -> labels/deleteLabel
          split-button-items.ts     # splitButtonOptions -> splitButtonItems
          modal-import-path.ts      # Modal -> deprecated path
          utility-class-rename.ts   # pf-v5-u-* -> pf-v6-u-*
          is-action-cell.ts         # isActionCell -> hasAction
          theme-dark-removal.ts     # theme="dark" removal
          space-items-removal.ts    # spaceItems removal
          css-logical-properties.ts # --PaddingTop -> --PaddingBlockStart
        moderate/                   # 9 detectors (weight=2)
          text-content-consolidation.ts
          empty-state-restructure.ts
          toolbar-variant.ts
          toolbar-gap.ts
          button-icon-prop.ts
          page-section-variant.ts
          page-masthead.ts
          react-tokens-icon-status.ts
          avatar-adoption.ts
        complex/                    # 3 detectors (weight=3)
          select-rewrite.ts
          masthead-reorganization.ts
          test-selector-rewrite.ts
    scoring/
      engine.ts                     # Weighted scoring algorithm
      noise-detector.ts             # Artifact/noise detection & penalties
    reporting/
      json-reporter.ts              # EvalReport -> JSON file
      markdown-reporter.ts          # EvalReport -> Markdown file
    utils/
      logger.ts                     # Console logging with chalk
```

### Dependencies

```json
{
  "dependencies": {
    "ts-morph": "^27.0.2",
    "commander": "^13.0.0",
    "chalk": "^5.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.21.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

### Core Architecture

**Detection Strategy: Diff-first, AST-second.** Every pattern detector first examines the unified diff lines (fast, always available for both input modes). Only when more precision is needed does it use the ts-morph AST. This means the tool works with PR URLs (diff-only) and local directories (full AST).

**Key Types:**
- `FileDiff`: Parsed unified diff with added/removed lines per file
- `ASTRepresentation`: Extracted imports, component usages with props, CSS class refs
- `PatternDefinition`: id, name, complexity, description, detect function
- `DetectionResult`: status (CORRECT | MISSING | INCORRECT | UNNECESSARY | FILE_MISSING | NOT_APPLICABLE), expected/actual locations, notes
- `EvalReport`: Full report with summary scores, per-file breakdowns, pattern summaries

**ts-morph Setup:**
```typescript
const project = new Project({
  compilerOptions: { jsx: 1 /* Preserve */, strict: false },
  skipFileDependencyResolution: true,
  skipAddingFilesFromTsConfig: true,
});
// Files MUST use .tsx extension for JSX parsing
```

**Additional Notes:**
- **Chalk v5**: ESM-only package. The project must use ESM modules or dynamic import.
- **gh CLI dependency**: PR URL mode requires `gh` to be installed and authenticated. The tool should fail fast with a clear message if `gh` is unavailable.
- **File path normalization**: Diffs use `a/` and `b/` prefixes. Local paths may be absolute or relative. The file matcher must normalize all paths before comparison.

### Scoring Algorithm

```
FinalScore = (0.20 * FileCoverage) + (0.65 * PatternScore) + (0.15 * (1 - NoisePenalty))

FileCoverage  = |files in golden AND migration| / |files in golden|  (excluding snapshots/lockfiles)
PatternScore  = sum(weight_i * credit_i) / sum(weight_i * expected_i)
NoisePenalty  = min(1.0, sum(penalty_amounts))

Credit:
  CORRECT = 1.0 * weight
  INCORRECT = 0.25 * weight  (identified pattern but applied wrong)
  MISSING / FILE_MISSING = 0
  NOT_APPLICABLE = excluded from denominator

Noise penalties per instance:
  unnecessary_change: 0.01/file
  formatting_only: 0.02/file
  incorrect_migration: 0.03/instance
  artifact: 0.05/instance
  placeholder_token: 0.05/instance
```

### CLI Interface

```bash
# PR URL mode
tsx src/cli.ts --golden-pr https://github.com/quipucords/quipucords-ui/pull/664 \
               --migration-pr https://github.com/jwmatthews/quipucords-ui/pull/4

# Local directory mode
tsx src/cli.ts --golden-dir ./golden-checkout \
               --migration-dir ./migration-checkout

# Options
  --output-dir ./results     # Default: ./results
  --verbose                  # Per-file details during analysis
```

## Success Metrics

- Tool correctly identifies all 7 missed files and 2 extra files in the known migration PR
- Tool catches the 4 known correctness issues (titleText, placeholder tokens, innerRef, masthead)
- Known AI migration PR scores 60-70% (consistent with manual analysis)
- A perfect migration (golden compared against itself) scores 100%
- An empty migration (no changes) scores ~15% or less
- Tool runs to completion in under 60 seconds for a 50-file migration
- Successive runs on the same inputs produce identical scores (deterministic)

## Open Questions

- Should detectors report partial credit granularity beyond the current CORRECT/INCORRECT binary? For example, a Select rewrite that gets 3 of 5 props right could score 0.6 instead of 0.25.
- How should the tool handle migrations that take a different-but-valid approach from the golden PR? (e.g., using a different PF6 component that achieves the same result)
- Should the tool support custom pattern definitions via a config file, so teams can add repo-specific patterns?
- What's the right penalty calibration? The current values are estimates and may need adjustment after integration testing.
- Should noise detection distinguish between "harmless noise" (extra whitespace) and "harmful noise" (wrong imports, broken code)?
