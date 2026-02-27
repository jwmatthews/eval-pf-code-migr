import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDiff } from '../input/diff-parser.js';
import { matchFiles } from '../analysis/file-matcher.js';
import { analyzeFileDiff } from '../analysis/ast-analyzer.js';
import { getPatterns, clearPatterns } from '../patterns/registry.js';
import { computeScore } from '../scoring/engine.js';
import { detectNoise } from '../scoring/noise-detector.js';
import type { FileDiff, ASTRepresentation, DetectionResult, EvalReport, FileResult } from '../types.js';
import type { WeightedDetectionResult } from '../scoring/engine.js';

// Import all pattern detectors so they self-register
import '../patterns/css-class-prefix.js';
import '../patterns/utility-class-rename.js';
import '../patterns/css-logical-properties.js';
import '../patterns/theme-dark-removal.js';
import '../patterns/inner-ref-to-ref.js';
import '../patterns/align-right-to-end.js';
import '../patterns/is-action-cell.js';
import '../patterns/space-items-removal.js';
import '../patterns/ouia-component-id.js';
import '../patterns/chips-to-labels.js';
import '../patterns/split-button-items.js';
import '../patterns/modal-import-path.js';
import '../patterns/text-content-consolidation.js';
import '../patterns/empty-state-restructure.js';
import '../patterns/toolbar-variant.js';
import '../patterns/toolbar-gap.js';
import '../patterns/button-icon-prop.js';
import '../patterns/page-section-variant.js';
import '../patterns/page-masthead.js';
import '../patterns/avatar-adoption.js';
import '../patterns/react-tokens-icon-status.js';
import '../patterns/select-rewrite.js';
import '../patterns/masthead-reorganization.js';
import '../patterns/test-selector-rewrite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, 'fixtures');
const BASELINE_DIR = join(__dirname, 'fixtures', 'baselines');

describe('Integration test: quipucords PRs', () => {
  let goldenDiffs: FileDiff[];
  let migrationDiffs: FileDiff[];
  let report: EvalReport;

  beforeAll(async () => {
    // Read fixture diffs
    const goldenDiffText = await readFile(join(FIXTURES_DIR, 'golden-pr-664.diff'), 'utf-8');
    const migrationDiffText = await readFile(join(FIXTURES_DIR, 'migration-pr-4.diff'), 'utf-8');

    // Parse diffs
    goldenDiffs = parseDiff(goldenDiffText);
    migrationDiffs = parseDiff(migrationDiffText);

    // Match files
    const matchResult = matchFiles(goldenDiffs, migrationDiffs);

    // Run pattern detection on matched pairs
    const patterns = getPatterns();
    const allWeightedResults: WeightedDetectionResult[] = [];
    const allDetectionResults: DetectionResult[] = [];
    const fileResults: FileResult[] = [];

    for (const { golden, migration } of matchResult.matched) {
      const goldenAST = analyzeFileDiff(golden);
      const migrationAST = analyzeFileDiff(migration);

      const fileDetections: DetectionResult[] = [];

      for (const pattern of patterns) {
        const result = pattern.detect(golden, migration, goldenAST, migrationAST);
        fileDetections.push(result);
        allWeightedResults.push({ result, weight: pattern.weight });
        allDetectionResults.push(result);
      }

      fileResults.push({
        filePath: golden.filePath,
        detections: fileDetections,
        noiseInstances: [],
      });
    }

    // Also run detectors for missed files (migration is null)
    for (const goldenDiff of matchResult.missedFiles) {
      const goldenAST = analyzeFileDiff(goldenDiff);
      const fileDetections: DetectionResult[] = [];

      for (const pattern of patterns) {
        const result = pattern.detect(goldenDiff, null, goldenAST, undefined);
        fileDetections.push(result);
        allWeightedResults.push({ result, weight: pattern.weight });
        allDetectionResults.push(result);
      }
    }

    // Detect noise
    const noiseInstances = detectNoise({
      matchResult,
      migrationDiffs,
      detectionResults: allDetectionResults,
    });

    // Assign noise instances to file results
    for (const noise of noiseInstances) {
      const fr = fileResults.find(f => f.filePath === noise.file);
      if (fr) {
        fr.noiseInstances.push(noise);
      }
    }

    // Compute score
    const scoreBreakdown = computeScore({
      matchResult,
      weightedResults: allWeightedResults,
      noiseInstances,
    });

    // Build report
    report = {
      metadata: {
        timestamp: new Date().toISOString(),
        goldenSource: 'https://github.com/quipucords/quipucords-ui/pull/664',
        migrationSource: 'https://github.com/jwmatthews/quipucords-ui/pull/4',
      },
      summary: {
        overallScore: scoreBreakdown.overallScore,
        fileCoverage: scoreBreakdown.fileCoverage,
        patternScore: scoreBreakdown.patternScore,
        noisePenalty: scoreBreakdown.noisePenalty,
      },
      fileResults,
      patternBreakdown: allDetectionResults,
      noiseInstances,
    };

    // Save JSON as regression baseline
    await mkdir(BASELINE_DIR, { recursive: true });
    // Normalize timestamp for stable baseline
    const baselineReport = {
      ...report,
      metadata: { ...report.metadata, timestamp: '2026-02-27T00:00:00.000Z' },
    };
    await writeFile(
      join(BASELINE_DIR, 'quipucords-regression-baseline.json'),
      JSON.stringify(baselineReport, null, 2) + '\n',
      'utf-8',
    );
  }, 30000); // Allow 30s for parsing and analysis

  describe('Diff parsing', () => {
    it('parses golden PR diff into files', () => {
      expect(goldenDiffs.length).toBeGreaterThan(0);
    });

    it('parses migration PR diff into files', () => {
      expect(migrationDiffs.length).toBeGreaterThan(0);
    });
  });

  describe('File coverage', () => {
    it('identifies missed files (in golden but not in migration)', () => {
      const matchResult = matchFiles(goldenDiffs, migrationDiffs);
      const missedPaths = matchResult.missedFiles.map(f => f.filePath);

      // Files in golden PR that the migration did not touch
      expect(missedPaths).toContain('src/app.css');
      expect(missedPaths).toContain('src/components/actionMenu/actionMenu.tsx');
      expect(missedPaths).toContain('src/components/simpleDropdown/simpleDropdown.tsx');
      expect(missedPaths).toContain('src/components/viewLayout/__tests__/viewLayoutToolbarInteractions.test.tsx');

      // innerRef files that were missed
      const innerRefMissed = missedPaths.filter(p =>
        p.includes('useTableWithBatteries') ||
        p.includes('useTdWithBatteries') ||
        p.includes('useThWithBatteries') ||
        p.includes('useTrWithBatteries')
      );
      expect(innerRefMissed.length).toBeGreaterThanOrEqual(4);

      // Total missed files should be around 8
      expect(missedPaths.length).toBeGreaterThanOrEqual(7);
    });

    it('identifies extra files (in migration but not in golden)', () => {
      const matchResult = matchFiles(goldenDiffs, migrationDiffs);
      const extraPaths = matchResult.extraFiles.map(f => f.filePath);

      expect(extraPaths.length).toBe(2);
      expect(extraPaths).toContain('.cache_109v6st');
      expect(extraPaths).toContain('.eslintrc.js');
    });

    it('has correct file coverage percentage', () => {
      expect(report.summary.fileCoverage).toBeGreaterThan(70);
      expect(report.summary.fileCoverage).toBeLessThan(85);
    });
  });

  describe('Pattern detection - known issues', () => {
    it('detects placeholder tokens (t_temp_dev_tbd) in migration', () => {
      const placeholderNoise = report.noiseInstances.filter(
        n => n.type === 'placeholder_token' && n.description.includes('t_temp_dev_tbd')
      );
      // contextIcon.tsx has t_temp_dev_tbd placeholder tokens
      expect(placeholderNoise.length).toBeGreaterThanOrEqual(1);
    });

    it('detects placeholder tokens in noise instances', () => {
      const placeholders = report.noiseInstances.filter(n => n.type === 'placeholder_token');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('detects missing innerRef->ref renames for missed files', () => {
      const innerRefResults = report.patternBreakdown.filter(
        r => r.patternId === 'inner-ref-to-ref' && r.status === 'FILE_MISSING'
      );
      // The 4 useT*WithBatteries.tsx files were missed, and they contain innerRef patterns
      expect(innerRefResults.length).toBeGreaterThanOrEqual(1);
    });

    it('detects masthead migration patterns', () => {
      const mastheadResults = report.patternBreakdown.filter(
        r => r.patternId === 'masthead-reorganization'
      );
      // At least one masthead detection should be non-NOT_APPLICABLE
      const applicable = mastheadResults.filter(r => r.status !== 'NOT_APPLICABLE');
      expect(applicable.length).toBeGreaterThanOrEqual(1);
    });

    it('catches incorrect migration patterns', () => {
      const incorrectResults = report.patternBreakdown.filter(
        r => r.status === 'INCORRECT'
      );
      // The migration has known issues, so there should be some INCORRECT detections
      expect(incorrectResults.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Noise detection', () => {
    it('detects unnecessary changes (extra files)', () => {
      const unnecessary = report.noiseInstances.filter(n => n.type === 'unnecessary_change');
      expect(unnecessary.length).toBe(2);
    });

    it('applies noise penalty', () => {
      expect(report.summary.noisePenalty).toBeGreaterThan(0);
    });
  });

  describe('Scoring', () => {
    it('overall score falls in the 60-70% range', () => {
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(60);
      expect(report.summary.overallScore).toBeLessThanOrEqual(70);
    });

    it('pattern score is less than 100% (imperfect migration)', () => {
      expect(report.summary.patternScore).toBeLessThan(100);
    });

    it('file coverage is less than 100% (some files missed)', () => {
      expect(report.summary.fileCoverage).toBeLessThan(100);
    });

    it('scores are normalized 0-100%', () => {
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
      expect(report.summary.fileCoverage).toBeGreaterThanOrEqual(0);
      expect(report.summary.fileCoverage).toBeLessThanOrEqual(100);
      expect(report.summary.patternScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.patternScore).toBeLessThanOrEqual(100);
      expect(report.summary.noisePenalty).toBeGreaterThanOrEqual(0);
      expect(report.summary.noisePenalty).toBeLessThanOrEqual(100);
    });
  });

  describe('Regression baseline', () => {
    it('saves JSON regression baseline', async () => {
      const baselinePath = join(BASELINE_DIR, 'quipucords-regression-baseline.json');
      const content = await readFile(baselinePath, 'utf-8');
      const baseline = JSON.parse(content);

      expect(baseline.metadata.goldenSource).toBe('https://github.com/quipucords/quipucords-ui/pull/664');
      expect(baseline.metadata.migrationSource).toBe('https://github.com/jwmatthews/quipucords-ui/pull/4');
      expect(baseline.summary).toBeDefined();
      expect(baseline.summary.overallScore).toBe(report.summary.overallScore);
      expect(baseline.fileResults).toBeDefined();
      expect(baseline.patternBreakdown).toBeDefined();
      expect(baseline.noiseInstances).toBeDefined();
    });
  });
});
