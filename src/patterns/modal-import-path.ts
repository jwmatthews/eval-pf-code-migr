import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'modal-import-path';

// Matches Modal import from main @patternfly/react-core
const MODAL_MAIN_IMPORT_RE = /from\s+['"]@patternfly\/react-core['"]/;
// Matches Modal import from deprecated path
const MODAL_DEPRECATED_IMPORT_RE = /from\s+['"]@patternfly\/react-core\/deprecated['"]/;
// Matches Modal in import specifiers
const MODAL_SPECIFIER_RE = /\bModal\b/;

function hasModalMainImport(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => MODAL_SPECIFIER_RE.test(l.content) && MODAL_MAIN_IMPORT_RE.test(l.content),
  );
}

function hasModalDeprecatedImport(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => MODAL_SPECIFIER_RE.test(l.content) && MODAL_DEPRECATED_IMPORT_RE.test(l.content),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Golden should remove Modal from main import and add it from deprecated path
  const goldenRemovesModalMain = hasModalMainImport(goldenDiff.removedLines);

  if (!goldenRemovesModalMain) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Modal import path change in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesModalMain = hasModalMainImport(migrationDiff.removedLines);
  const migrationAddsModalDeprecated = hasModalDeprecatedImport(migrationDiff.addedLines);

  if (migrationRemovesModalMain && migrationAddsModalDeprecated) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Modal import correctly moved to deprecated path',
    };
  }

  if (migrationRemovesModalMain && !migrationAddsModalDeprecated) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Modal removed from main import but not added to deprecated path',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'Modal import path change not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Modal Import Path Change',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects Modal import path change to deprecated path',
  detect,
};

registerPattern(pattern);

export { pattern };
