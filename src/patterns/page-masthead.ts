import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'page-masthead';

// PF5 patterns: Page uses header prop with PageHeader component
const PAGE_HEADER_PROP_RE = /\bheader\s*=\s*\{/;
const PAGE_HEADER_COMPONENT_RE = /\bPageHeader\b/;

// PF6 patterns: Page uses masthead prop with Masthead component
const PAGE_MASTHEAD_PROP_RE = /\bmasthead\s*=\s*\{/;
const MASTHEAD_COMPONENT_RE = /\bMasthead\b(?!Content|Brand|Toggle|Main)/;

function hasOldHeaderPatterns(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => PAGE_HEADER_PROP_RE.test(l.content) || PAGE_HEADER_COMPONENT_RE.test(l.content),
  );
}

function hasNewMastheadPatterns(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => PAGE_MASTHEAD_PROP_RE.test(l.content) || MASTHEAD_COMPONENT_RE.test(l.content),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff involves Page header -> masthead migration
  const goldenRemovesHeader = hasOldHeaderPatterns(goldenDiff.removedLines);
  const goldenAddsMasthead = hasNewMastheadPatterns(goldenDiff.addedLines);

  if (!goldenRemovesHeader && !goldenAddsMasthead) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Page masthead prop changes in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migRemovesHeader = hasOldHeaderPatterns(migrationDiff.removedLines);
  const migAddsMasthead = hasNewMastheadPatterns(migrationDiff.addedLines);

  // Migration didn't touch header/masthead at all
  if (!migRemovesHeader && !migAddsMasthead) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'Page masthead prop migration not found in migration',
    };
  }

  const details: string[] = [];

  // Check if header was removed but masthead not added (when golden adds masthead)
  if (goldenAddsMasthead && migRemovesHeader && !migAddsMasthead) {
    details.push('header prop removed but masthead prop not added');
  }

  // Check if old header/PageHeader props were re-added
  const migAddsHeader = hasOldHeaderPatterns(migrationDiff.addedLines);
  if (migAddsHeader) {
    details.push('Old PageHeader/header prop re-added in migration');
  }

  if (details.length > 0) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Page masthead migration partially completed',
      details,
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.CORRECT,
    message: 'Page masthead prop correctly migrated',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Page Masthead',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects Page masthead prop migration (header/PageHeader -> masthead/Masthead)',
  detect,
};

registerPattern(pattern);

export { pattern };
