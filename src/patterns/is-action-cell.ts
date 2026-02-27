import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'is-action-cell';

// Matches isActionCell prop
const IS_ACTION_CELL_RE = /\bisActionCell\b/;
// Matches hasAction prop
const HAS_ACTION_RE = /\bhasAction\b/;

function hasIsActionCell(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => IS_ACTION_CELL_RE.test(l.content));
}

function hasHasAction(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => HAS_ACTION_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesIsActionCell = hasIsActionCell(goldenDiff.removedLines);

  if (!goldenRemovesIsActionCell) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No isActionCell removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesIsActionCell = hasIsActionCell(migrationDiff.removedLines);
  const migrationAddsHasAction = hasHasAction(migrationDiff.addedLines);

  if (migrationRemovesIsActionCell && migrationAddsHasAction) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'isActionCell correctly renamed to hasAction',
    };
  }

  if (migrationRemovesIsActionCell && !migrationAddsHasAction) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'isActionCell removed but hasAction not added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'isActionCell -> hasAction rename not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'IsActionCell to HasAction Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects isActionCell -> hasAction prop renames',
  detect,
};

registerPattern(pattern);

export { pattern };
