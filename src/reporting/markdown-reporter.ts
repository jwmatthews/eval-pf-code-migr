import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DetectionStatus, EvalReport, DetectionResult, NoiseInstance } from '../types.js';

/**
 * Generate a timestamped filename for the Markdown report.
 */
function generateFilename(timestamp: string): string {
  const sanitized = timestamp.replace(/[:.]/g, '-').replace(/[T ]/g, '_');
  return `eval-report_${sanitized}.md`;
}

/**
 * Map an overall score (0-100) to a letter grade.
 */
function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Status icon for detection results.
 */
function statusIcon(status: DetectionStatus): string {
  switch (status) {
    case DetectionStatus.CORRECT: return '\u2705';
    case DetectionStatus.MISSING: return '\u274C';
    case DetectionStatus.INCORRECT: return '\u26A0\uFE0F';
    case DetectionStatus.FILE_MISSING: return '\uD83D\uDCC1';
    case DetectionStatus.NOT_APPLICABLE: return '\u2796';
    case DetectionStatus.UNNECESSARY: return '\uD83D\uDDD1\uFE0F';
    default: return '\u2753';
  }
}

/**
 * Group pattern results by complexity level.
 */
function groupByComplexity(patterns: DetectionResult[]): Map<string, DetectionResult[]> {
  const complexityMap: Record<string, string> = {};
  // Infer complexity from pattern IDs based on known patterns
  const trivialPatterns = [
    'css-class-prefix', 'utility-class-rename', 'css-logical-properties', 'theme-dark-removal',
    'inner-ref-to-ref', 'align-right-to-end', 'is-action-cell', 'space-items-removal',
    'ouia-component-id', 'chips-to-labels', 'split-button-items', 'modal-import-path',
  ];
  const moderatePatterns = [
    'text-content-consolidation', 'empty-state-restructure', 'toolbar-variant',
    'toolbar-gap', 'button-icon-prop', 'page-section-variant',
    'page-masthead', 'react-tokens-icon-status', 'avatar-adoption',
  ];
  const complexPatterns = [
    'select-rewrite', 'masthead-reorganization', 'test-selector-rewrite',
  ];

  for (const id of trivialPatterns) complexityMap[id] = 'Trivial';
  for (const id of moderatePatterns) complexityMap[id] = 'Moderate';
  for (const id of complexPatterns) complexityMap[id] = 'Complex';

  const groups = new Map<string, DetectionResult[]>();
  groups.set('Trivial', []);
  groups.set('Moderate', []);
  groups.set('Complex', []);

  for (const pattern of patterns) {
    const complexity = complexityMap[pattern.patternId] ?? 'Unknown';
    if (!groups.has(complexity)) {
      groups.set(complexity, []);
    }
    groups.get(complexity)!.push(pattern);
  }

  return groups;
}

/**
 * Generate the full Markdown report content from an EvalReport.
 */
export function generateMarkdown(report: EvalReport): string {
  const lines: string[] = [];
  const { summary, fileResults, patternBreakdown, noiseInstances } = report;
  const grade = scoreToGrade(summary.overallScore);

  // Executive Summary
  lines.push('# PF Migration Evaluation Report');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| **Overall Score** | **${summary.overallScore}% (${grade})** |`);
  lines.push(`| File Coverage | ${summary.fileCoverage}% |`);
  lines.push(`| Pattern Score | ${summary.patternScore}% |`);
  lines.push(`| Noise Penalty | ${summary.noisePenalty}% |`);
  lines.push('');
  lines.push(`> Golden: \`${report.metadata.goldenSource}\``);
  lines.push(`> Migration: \`${report.metadata.migrationSource}\``);
  lines.push('');

  // File Coverage
  lines.push('## File Coverage');
  lines.push('');

  const matchedFiles = fileResults.map(f => f.filePath);
  const allDetections = patternBreakdown;
  const missedFiles = allDetections
    .filter(d => d.status === DetectionStatus.FILE_MISSING)
    .map(d => d.patternId);

  lines.push('| File | Status |');
  lines.push('| --- | --- |');

  if (fileResults.length === 0 && noiseInstances.length === 0) {
    lines.push('| _(no files)_ | - |');
  } else {
    for (const fr of fileResults) {
      const hasIssues = fr.detections.some(d =>
        d.status === DetectionStatus.MISSING ||
        d.status === DetectionStatus.INCORRECT ||
        d.status === DetectionStatus.FILE_MISSING
      );
      const icon = hasIssues ? '\u26A0\uFE0F' : '\u2705';
      lines.push(`| ${fr.filePath} | ${icon} Matched |`);
    }
  }

  lines.push('');

  // Pattern Results
  lines.push('## Pattern Results');
  lines.push('');

  const groups = groupByComplexity(patternBreakdown);
  for (const [complexity, patterns] of groups) {
    if (patterns.length === 0) continue;
    lines.push(`### ${complexity} Patterns`);
    lines.push('');
    lines.push('| Pattern | Status | Message |');
    lines.push('| --- | --- | --- |');
    for (const p of patterns) {
      const icon = statusIcon(p.status);
      const msg = p.message.replace(/\|/g, '\\|');
      lines.push(`| ${p.patternId} | ${icon} ${p.status} | ${msg} |`);
    }
    lines.push('');
  }

  // Noise Findings
  lines.push('## Noise Findings');
  lines.push('');

  if (noiseInstances.length === 0) {
    lines.push('No noise detected.');
  } else {
    lines.push(`Found ${noiseInstances.length} noise instance(s):`);
    lines.push('');
    for (const n of noiseInstances) {
      const loc = n.line != null ? `${n.file}:${n.line}` : n.file;
      lines.push(`- **${n.type}** in \`${loc}\`: ${n.description} _(penalty: ${n.penalty})_`);
    }
  }
  lines.push('');

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');

  const recommendations = generateRecommendations(patternBreakdown, noiseInstances, summary);
  if (recommendations.length === 0) {
    lines.push('No issues found. Great migration!');
  } else {
    for (const rec of recommendations) {
      lines.push(`- ${rec}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate actionable recommendations based on results.
 */
function generateRecommendations(
  patterns: DetectionResult[],
  noise: NoiseInstance[],
  summary: { overallScore: number; fileCoverage: number; patternScore: number; noisePenalty: number },
): string[] {
  const recs: string[] = [];

  // Missing patterns
  const missing = patterns.filter(p => p.status === DetectionStatus.MISSING);
  if (missing.length > 0) {
    recs.push(`Fix ${missing.length} missing migration pattern(s): ${missing.map(p => p.patternId).join(', ')}`);
  }

  // Incorrect patterns
  const incorrect = patterns.filter(p => p.status === DetectionStatus.INCORRECT);
  if (incorrect.length > 0) {
    recs.push(`Review ${incorrect.length} incorrect migration(s): ${incorrect.map(p => p.patternId).join(', ')}`);
  }

  // File missing patterns
  const fileMissing = patterns.filter(p => p.status === DetectionStatus.FILE_MISSING);
  if (fileMissing.length > 0) {
    recs.push(`Address ${fileMissing.length} pattern(s) in files not included in the migration`);
  }

  // Noise
  if (summary.noisePenalty > 0) {
    const artifacts = noise.filter(n => n.type === 'artifact');
    const placeholders = noise.filter(n => n.type === 'placeholder_token');
    if (artifacts.length > 0) {
      recs.push(`Remove ${artifacts.length} artifact(s) (e.g., console.log, TODO comments)`);
    }
    if (placeholders.length > 0) {
      recs.push(`Replace ${placeholders.length} placeholder token(s) with real values`);
    }
  }

  return recs;
}

/**
 * Write the Markdown report to a file in the specified output directory.
 * Returns the full path to the written file.
 */
export async function writeMarkdownReport(report: EvalReport, outputDir: string): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const filename = generateFilename(report.metadata.timestamp);
  const filePath = join(outputDir, filename);
  const content = generateMarkdown(report);

  await writeFile(filePath, content, 'utf-8');

  return filePath;
}
