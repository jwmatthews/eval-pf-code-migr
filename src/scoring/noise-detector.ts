import { DetectionResult, DetectionStatus, FileDiff, MatchResult, NoiseInstance } from '../types.js';

const PENALTY = {
  unnecessary_change: 0.01,
  formatting_only: 0.02,
  incorrect_migration: 0.03,
  artifact: 0.05,
  placeholder_token: 0.05,
} as const;

const PLACEHOLDER_PATTERNS = [
  /\bt_temp_dev_tbd\b/,
  /\bTEMP_PLACEHOLDER\b/,
  /\bPLACEHOLDER\b/,
  /\bFIXME\b/,
  /\bHACK\b/,
  /\bXXX\b/,
];

const ARTIFACT_PATTERNS = [
  /\bconsole\.log\(/,
  /\bconsole\.debug\(/,
  /\/\/\s*TODO\b/,
  /\/\/\s*@ts-ignore\b/,
  /\bdebugger\b/,
];

export interface NoiseDetectorInput {
  matchResult: MatchResult;
  migrationDiffs: FileDiff[];
  detectionResults: DetectionResult[];
}

/**
 * Detect noise in a migration and return penalty instances.
 * Total penalty is capped at 1.0 by the scoring engine.
 */
export function detectNoise(input: NoiseDetectorInput): NoiseInstance[] {
  const instances: NoiseInstance[] = [];

  instances.push(...detectUnnecessaryChanges(input.matchResult));
  instances.push(...detectFormattingOnlyChanges(input.migrationDiffs, input.matchResult));
  instances.push(...detectIncorrectMigrations(input.detectionResults));
  instances.push(...detectArtifacts(input.migrationDiffs));
  instances.push(...detectPlaceholderTokens(input.migrationDiffs));

  return instances;
}

/**
 * Files in migration but not in golden are unnecessary changes. 0.01 per file.
 */
function detectUnnecessaryChanges(matchResult: MatchResult): NoiseInstance[] {
  return matchResult.extraFiles.map(diff => ({
    type: 'unnecessary_change' as const,
    file: diff.filePath,
    description: `File changed in migration but not in golden PR`,
    penalty: PENALTY.unnecessary_change,
  }));
}

/**
 * Files where migration changes are only whitespace/formatting. 0.02 per file.
 */
function detectFormattingOnlyChanges(migrationDiffs: FileDiff[], matchResult: MatchResult): NoiseInstance[] {
  const instances: NoiseInstance[] = [];

  const matchedMigrationPaths = new Set(
    matchResult.matched.map(m => m.migration.filePath)
  );

  for (const diff of migrationDiffs) {
    if (!matchedMigrationPaths.has(diff.filePath)) continue;
    if (diff.addedLines.length === 0 && diff.removedLines.length === 0) continue;

    if (isFormattingOnly(diff)) {
      instances.push({
        type: 'formatting_only',
        file: diff.filePath,
        description: 'Changes appear to be formatting/whitespace only',
        penalty: PENALTY.formatting_only,
      });
    }
  }

  return instances;
}

/**
 * Check if a diff contains only whitespace/formatting changes.
 */
function isFormattingOnly(diff: FileDiff): boolean {
  const removedNormalized = diff.removedLines.map(l => l.content.replace(/\s+/g, '').trim());
  const addedNormalized = diff.addedLines.map(l => l.content.replace(/\s+/g, '').trim());

  if (removedNormalized.length !== addedNormalized.length) return false;

  const removedSorted = [...removedNormalized].sort();
  const addedSorted = [...addedNormalized].sort();

  return removedSorted.every((line, i) => line === addedSorted[i]);
}

/**
 * Detection results with INCORRECT status. 0.03 per instance.
 */
function detectIncorrectMigrations(results: DetectionResult[]): NoiseInstance[] {
  return results
    .filter(r => r.status === DetectionStatus.INCORRECT)
    .map(r => ({
      type: 'incorrect_migration' as const,
      file: r.patternId,
      description: `Incorrect migration for pattern: ${r.message}`,
      penalty: PENALTY.incorrect_migration,
    }));
}

/**
 * Detect artifacts (console.log, debugger, TODO comments, @ts-ignore) in migration added lines. 0.05 per instance.
 */
function detectArtifacts(migrationDiffs: FileDiff[]): NoiseInstance[] {
  const instances: NoiseInstance[] = [];

  for (const diff of migrationDiffs) {
    for (const line of diff.addedLines) {
      for (const pattern of ARTIFACT_PATTERNS) {
        if (pattern.test(line.content)) {
          instances.push({
            type: 'artifact',
            file: diff.filePath,
            line: line.lineNumber,
            description: `Artifact detected: ${line.content.trim()}`,
            penalty: PENALTY.artifact,
          });
          break; // one penalty per line
        }
      }
    }
  }

  return instances;
}

/**
 * Detect placeholder tokens (t_temp_dev_tbd, PLACEHOLDER, FIXME, etc.) in migration added lines. 0.05 per instance.
 */
function detectPlaceholderTokens(migrationDiffs: FileDiff[]): NoiseInstance[] {
  const instances: NoiseInstance[] = [];

  for (const diff of migrationDiffs) {
    for (const line of diff.addedLines) {
      for (const pattern of PLACEHOLDER_PATTERNS) {
        if (pattern.test(line.content)) {
          instances.push({
            type: 'placeholder_token',
            file: diff.filePath,
            line: line.lineNumber,
            description: `Placeholder token detected: ${line.content.trim()}`,
            penalty: PENALTY.placeholder_token,
          });
          break; // one penalty per line
        }
      }
    }
  }

  return instances;
}
