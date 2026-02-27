import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'chips-to-labels';

// Matches chips-related props/components: chips, deleteChip, Chip, ChipGroup
const CHIPS_RE = /\b(chips|deleteChip|Chip|ChipGroup)\b/;
// Matches labels-related replacements: labels, deleteLabel, Label, LabelGroup
const LABELS_RE = /\b(labels|deleteLabel|Label|LabelGroup)\b/;

function hasChips(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => CHIPS_RE.test(l.content));
}

function hasLabels(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => LABELS_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesChips = hasChips(goldenDiff.removedLines);

  if (!goldenRemovesChips) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No chips/deleteChip removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesChips = hasChips(migrationDiff.removedLines);
  const migrationAddsLabels = hasLabels(migrationDiff.addedLines);

  if (migrationRemovesChips && migrationAddsLabels) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'chips/deleteChip correctly renamed to labels/deleteLabel',
    };
  }

  if (migrationRemovesChips && !migrationAddsLabels) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'chips/deleteChip removed but labels/deleteLabel not added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'chips/deleteChip -> labels/deleteLabel rename not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Chips to Labels Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects chips/deleteChip -> labels/deleteLabel renames',
  detect,
};

registerPattern(pattern);

export { pattern };
