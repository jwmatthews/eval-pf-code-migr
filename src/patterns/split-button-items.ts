import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'split-button-items';

// Matches splitButtonOptions prop
const SPLIT_BUTTON_OPTIONS_RE = /\bsplitButtonOptions\b/;
// Matches splitButtonItems prop
const SPLIT_BUTTON_ITEMS_RE = /\bsplitButtonItems\b/;

function hasSplitButtonOptions(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => SPLIT_BUTTON_OPTIONS_RE.test(l.content));
}

function hasSplitButtonItems(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => SPLIT_BUTTON_ITEMS_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesSplitButtonOptions = hasSplitButtonOptions(goldenDiff.removedLines);

  if (!goldenRemovesSplitButtonOptions) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No splitButtonOptions removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesSplitButtonOptions = hasSplitButtonOptions(migrationDiff.removedLines);
  const migrationAddsSplitButtonItems = hasSplitButtonItems(migrationDiff.addedLines);

  if (migrationRemovesSplitButtonOptions && migrationAddsSplitButtonItems) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'splitButtonOptions correctly renamed to splitButtonItems',
    };
  }

  if (migrationRemovesSplitButtonOptions && !migrationAddsSplitButtonItems) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'splitButtonOptions removed but splitButtonItems not added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'splitButtonOptions -> splitButtonItems rename not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'SplitButton Options to Items Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects splitButtonOptions -> splitButtonItems renames',
  detect,
};

registerPattern(pattern);

export { pattern };
