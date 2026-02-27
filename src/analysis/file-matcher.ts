import type { FileDiff, MatchResult } from '../types.js';

const EXCLUDED_PATTERNS = [
  /\.snap$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];

/**
 * Normalize a file path for matching: strip a/ or b/ prefixes and normalize separators.
 */
function normalizePath(filePath: string): string {
  let p = filePath;
  if (p.startsWith('a/') || p.startsWith('b/')) {
    p = p.slice(2);
  }
  // Normalize backslashes to forward slashes
  p = p.replace(/\\/g, '/');
  return p;
}

/**
 * Check if a file should be excluded from matching (snapshots, lockfiles).
 */
function isExcluded(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Match golden files to migration files by normalized path.
 * Excludes snapshot files and lockfiles from matching.
 */
export function matchFiles(goldenDiffs: FileDiff[], migrationDiffs: FileDiff[]): MatchResult {
  // Filter out excluded files
  const goldenFiltered = goldenDiffs.filter(d => !isExcluded(d.filePath));
  const migrationFiltered = migrationDiffs.filter(d => !isExcluded(d.filePath));

  // Build a map of normalized path -> migration FileDiff
  const migrationMap = new Map<string, FileDiff>();
  for (const diff of migrationFiltered) {
    migrationMap.set(normalizePath(diff.filePath), diff);
  }

  const matched: Array<{ golden: FileDiff; migration: FileDiff }> = [];
  const missedFiles: FileDiff[] = [];
  const matchedMigrationPaths = new Set<string>();

  for (const goldenDiff of goldenFiltered) {
    const normalizedPath = normalizePath(goldenDiff.filePath);
    const migrationDiff = migrationMap.get(normalizedPath);

    if (migrationDiff) {
      matched.push({ golden: goldenDiff, migration: migrationDiff });
      matchedMigrationPaths.add(normalizedPath);
    } else {
      missedFiles.push(goldenDiff);
    }
  }

  // Extra files: in migration but not in golden
  const extraFiles = migrationFiltered.filter(
    d => !matchedMigrationPaths.has(normalizePath(d.filePath))
  );

  return { matched, missedFiles, extraFiles };
}
