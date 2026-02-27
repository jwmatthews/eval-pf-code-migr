import { Command } from 'commander';
import { fetchPRDiff, validateGhCli } from './input/pr-fetcher.js';
import { readLocalDiff, readFileContents } from './input/local-reader.js';
import { matchFiles } from './analysis/file-matcher.js';
import { analyzeAST, analyzeFileDiff } from './analysis/ast-analyzer.js';
import { getPatterns } from './patterns/registry.js';
import { computeScore } from './scoring/engine.js';
import { detectNoise } from './scoring/noise-detector.js';
import { writeJsonReport } from './reporting/json-reporter.js';
import { writeMarkdownReport } from './reporting/markdown-reporter.js';
import * as logger from './utils/logger.js';
import type { FileDiff, ASTRepresentation, DetectionResult, EvalReport, FileResult } from './types.js';
import type { WeightedDetectionResult } from './scoring/engine.js';

// Import all pattern detectors so they self-register
import './patterns/css-class-prefix.js';
import './patterns/utility-class-rename.js';
import './patterns/css-logical-properties.js';
import './patterns/theme-dark-removal.js';
import './patterns/inner-ref-to-ref.js';
import './patterns/align-right-to-end.js';
import './patterns/is-action-cell.js';
import './patterns/space-items-removal.js';
import './patterns/ouia-component-id.js';
import './patterns/chips-to-labels.js';
import './patterns/split-button-items.js';
import './patterns/modal-import-path.js';
import './patterns/text-content-consolidation.js';
import './patterns/empty-state-restructure.js';
import './patterns/toolbar-variant.js';
import './patterns/toolbar-gap.js';
import './patterns/button-icon-prop.js';
import './patterns/page-section-variant.js';
import './patterns/page-masthead.js';
import './patterns/avatar-adoption.js';
import './patterns/react-tokens-icon-status.js';
import './patterns/select-rewrite.js';
import './patterns/masthead-reorganization.js';
import './patterns/test-selector-rewrite.js';

const program = new Command();

program
  .name('pf-migration-eval')
  .description('PatternFly 5-to-6 Migration Evaluation Suite')
  .version('0.1.0');

program
  .option('--golden-pr <url>', 'GitHub PR URL for the golden (reference) migration')
  .option('--migration-pr <url>', 'GitHub PR URL for the migration to evaluate')
  .option('--golden-dir <path>', 'Local directory for the golden (reference) migration')
  .option('--migration-dir <path>', 'Local directory for the migration to evaluate')
  .option('--output-dir <path>', 'Directory for output reports', './results')
  .option('--verbose', 'Print detailed detection results during analysis', false);

program.action(async (options) => {
  const { goldenPr, migrationPr, goldenDir, migrationDir, outputDir, verbose } = options;

  if (verbose) {
    logger.setVerbose(true);
  }

  const hasPrInput = goldenPr && migrationPr;
  const hasDirInput = goldenDir && migrationDir;

  if (!hasPrInput && !hasDirInput) {
    logger.error(
      'Provide either --golden-pr and --migration-pr, or --golden-dir and --migration-dir.',
    );
    process.exit(1);
  }

  try {
    // Step 1: Fetch diffs
    let goldenDiffs: FileDiff[];
    let migrationDiffs: FileDiff[];
    let goldenSource: string;
    let migrationSource: string;
    let goldenFileContents: Map<string, string> | undefined;
    let migrationFileContents: Map<string, string> | undefined;

    if (hasPrInput) {
      logger.info('Using PR URL mode');
      await validateGhCli();
      logger.info(`Fetching golden PR diff: ${goldenPr}`);
      goldenDiffs = await fetchPRDiff(goldenPr);
      logger.info(`Fetching migration PR diff: ${migrationPr}`);
      migrationDiffs = await fetchPRDiff(migrationPr);
      goldenSource = goldenPr;
      migrationSource = migrationPr;
    } else {
      logger.info('Using local directory mode');
      logger.info(`Reading golden diff from: ${goldenDir}`);
      goldenDiffs = await readLocalDiff(goldenDir);
      logger.info(`Reading migration diff from: ${migrationDir}`);
      migrationDiffs = await readLocalDiff(migrationDir);
      goldenSource = goldenDir;
      migrationSource = migrationDir;

      // Read full file contents for AST analysis in local mode
      const goldenFilePaths = goldenDiffs.map(d => d.filePath);
      const migrationFilePaths = migrationDiffs.map(d => d.filePath);
      goldenFileContents = await readFileContents(goldenDir, goldenFilePaths);
      migrationFileContents = await readFileContents(migrationDir, migrationFilePaths);
    }

    logger.info(`Golden: ${goldenDiffs.length} file(s), Migration: ${migrationDiffs.length} file(s)`);

    // Step 2: Match files
    const matchResult = matchFiles(goldenDiffs, migrationDiffs);
    logger.info(`Matched: ${matchResult.matched.length}, Missed: ${matchResult.missedFiles.length}, Extra: ${matchResult.extraFiles.length}`);

    // Step 3: Run pattern detection on each matched file pair
    const patterns = getPatterns();
    logger.info(`Loaded ${patterns.length} pattern detector(s)`);

    const allWeightedResults: WeightedDetectionResult[] = [];
    const allDetectionResults: DetectionResult[] = [];
    const fileResults: FileResult[] = [];

    for (const { golden, migration } of matchResult.matched) {
      // Build AST representations
      let goldenAST: ASTRepresentation | undefined;
      let migrationAST: ASTRepresentation | undefined;

      if (goldenFileContents?.has(golden.filePath)) {
        goldenAST = analyzeAST(goldenFileContents.get(golden.filePath)!, golden.filePath);
      } else {
        goldenAST = analyzeFileDiff(golden);
      }

      if (migrationFileContents?.has(migration.filePath)) {
        migrationAST = analyzeAST(migrationFileContents.get(migration.filePath)!, migration.filePath);
      } else {
        migrationAST = analyzeFileDiff(migration);
      }

      const fileDetections: DetectionResult[] = [];

      for (const pattern of patterns) {
        const result = pattern.detect(golden, migration, goldenAST, migrationAST);
        fileDetections.push(result);
        allWeightedResults.push({ result, weight: pattern.weight });
        allDetectionResults.push(result);

        if (verbose) {
          logger.verbose(`[${golden.filePath}] ${pattern.id}: ${result.status} - ${result.message}`);
        }
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

        if (verbose) {
          logger.verbose(`[${goldenDiff.filePath}] ${pattern.id}: ${result.status} - ${result.message}`);
        }
      }
    }

    // Step 4: Detect noise
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

    logger.info(`Noise instances: ${noiseInstances.length}`);

    // Step 5: Compute score
    const scoreBreakdown = computeScore({
      matchResult,
      weightedResults: allWeightedResults,
      noiseInstances,
    });

    // Step 6: Build report
    const report: EvalReport = {
      metadata: {
        timestamp: new Date().toISOString(),
        goldenSource,
        migrationSource,
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

    // Step 7: Write reports
    const jsonPath = await writeJsonReport(report, outputDir);
    const mdPath = await writeMarkdownReport(report, outputDir);

    logger.success(`JSON report: ${jsonPath}`);
    logger.success(`Markdown report: ${mdPath}`);

    // Print summary to stdout
    const grade = scoreBreakdown.overallScore >= 90 ? 'A'
      : scoreBreakdown.overallScore >= 80 ? 'B'
      : scoreBreakdown.overallScore >= 70 ? 'C'
      : scoreBreakdown.overallScore >= 60 ? 'D'
      : 'F';

    console.log('');
    console.log('=== PF Migration Evaluation Summary ===');
    console.log(`Overall Score: ${scoreBreakdown.overallScore}% (${grade})`);
    console.log(`File Coverage: ${scoreBreakdown.fileCoverage}%`);
    console.log(`Pattern Score: ${scoreBreakdown.patternScore}%`);
    console.log(`Noise Penalty: ${scoreBreakdown.noisePenalty}%`);
    console.log('');

    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    process.exit(1);
  }
});

program.parse();
