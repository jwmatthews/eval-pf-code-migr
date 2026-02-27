# PF Migration Eval

A scoring tool that measures how well an AI migration tool converted PatternFly 5 code to PatternFly 6. It compares a migration PR against an expert-approved "golden source" PR and produces a weighted score (0-100%) with per-file and per-pattern breakdowns.

The tool detects 24 specific PF5-to-PF6 migration patterns across three complexity tiers, penalizes noise (placeholder tokens, artifacts, unnecessary changes), and outputs both machine-readable JSON and human-readable Markdown reports.

## Quick Start

### Prerequisites

- Node.js >= 18
- npm
- [gh CLI](https://cli.github.com/) (for PR URL mode only) - must be authenticated via `gh auth login`

### Install and Verify

```bash
cd eval/approach1
npm install
npm run typecheck   # Should complete with no errors
npm run test        # Should show 384 tests passing
```

### Run an Evaluation

**Option A: Compare two GitHub PRs**

```bash
cd eval/approach1
npx tsx src/cli.ts \
  --golden-pr https://github.com/quipucords/quipucords-ui/pull/664 \
  --migration-pr https://github.com/jwmatthews/quipucords-ui/pull/4 \
  --output-dir ./results
```

**Option B: Compare two local git checkouts**

```bash
cd eval/approach1
npx tsx src/cli.ts \
  --golden-dir /path/to/golden-branch \
  --migration-dir /path/to/migration-branch \
  --output-dir ./results
```

### Expected Output

The tool prints a summary to the console:

```
=== PF Migration Evaluation Summary ===
Overall Score: 66.69% (D)
File Coverage: 78.95%
Pattern Score: 64.46%
Noise Penalty: 40%
```

And writes two files to the output directory:

- `eval-report_<timestamp>.json` - Full report with all detection results
- `eval-report_<timestamp>.md` - Markdown report with executive summary, pattern tables, and recommendations

## Verification Steps

Run these commands in order from the `eval/approach1/` directory to confirm everything works:

```bash
# 1. Install dependencies
npm install

# 2. Typecheck - should produce no output (clean)
npm run typecheck

# 3. Run full test suite - should show "384 passed"
npm run test

# 4. Run the CLI with the known baseline PRs (requires gh CLI)
npx tsx src/cli.ts \
  --golden-pr https://github.com/quipucords/quipucords-ui/pull/664 \
  --migration-pr https://github.com/jwmatthews/quipucords-ui/pull/4 \
  --output-dir ./results \
  --verbose

# 5. Verify reports were generated
ls -la ./results/

# 6. View the Markdown report
cat ./results/eval-report_*.md
```

Step 4 should produce an overall score in the 60-70% range (Grade D) with ~79% file coverage and ~40% noise penalty. This matches the known quality of the migration PR.

## How It Works

The tool runs a five-stage pipeline:

1. **Input** - Fetches unified diffs from GitHub PRs (`gh pr diff`) or local git repos (`git diff`)
2. **Analysis** - Matches golden files to migration files by path, extracts AST information via ts-morph
3. **Detection** - Runs 24 pattern detectors (12 trivial, 9 moderate, 3 complex) against each file pair
4. **Scoring** - Computes a weighted score: `0.20 * FileCoverage + 0.65 * PatternScore + 0.15 * (1 - NoisePenalty)`
5. **Reporting** - Writes JSON and Markdown reports to the output directory

### Pattern Tiers

| Tier | Weight | Count | Examples |
|------|--------|-------|----------|
| Trivial | 1x | 12 | CSS class prefix renames, `innerRef` to `ref`, prop renames |
| Moderate | 2x | 9 | EmptyState restructure, Button icon prop, Toolbar gap changes |
| Complex | 3x | 3 | Select component rewrite, Masthead reorganization, test selector updates |

### CLI Options

| Option | Description |
|--------|-------------|
| `--golden-pr <url>` | GitHub PR URL for the golden (reference) migration |
| `--migration-pr <url>` | GitHub PR URL for the migration to evaluate |
| `--golden-dir <path>` | Local directory for the golden migration |
| `--migration-dir <path>` | Local directory for the migration to evaluate |
| `--output-dir <path>` | Output directory for reports (default: `./results`) |
| `--verbose` | Print per-file detection results during analysis |

Provide either `--golden-pr` + `--migration-pr` (PR mode) or `--golden-dir` + `--migration-dir` (local mode).

## Documentation

See [ONBOARDING.md](./ONBOARDING.md) for a deeper guide covering:
- How to think about the codebase architecture
- How each pipeline stage works
- How to add new pattern detectors
- Important gotchas and patterns
- Future modification ideas

## Code of Conduct

Refer to Konveyor's Code of Conduct [here](https://github.com/konveyor/community/blob/main/CODE_OF_CONDUCT.md).
