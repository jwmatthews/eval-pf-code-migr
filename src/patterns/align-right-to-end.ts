import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'align-right-to-end';

// Matches alignRight prop: alignRight, alignRight={true}, alignRight={false}
const ALIGN_RIGHT_RE = /\balignRight\b/;
// Matches alignEnd prop: alignEnd, alignEnd={true}, alignEnd={false}
const ALIGN_END_RE = /\balignEnd\b/;

function hasAlignRight(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => ALIGN_RIGHT_RE.test(l.content));
}

function hasAlignEnd(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => ALIGN_END_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesAlignRight = hasAlignRight(goldenDiff.removedLines);

  if (!goldenRemovesAlignRight) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No alignRight removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesAlignRight = hasAlignRight(migrationDiff.removedLines);
  const migrationAddsAlignEnd = hasAlignEnd(migrationDiff.addedLines);

  if (migrationRemovesAlignRight && migrationAddsAlignEnd) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'alignRight correctly renamed to alignEnd',
    };
  }

  if (migrationRemovesAlignRight && !migrationAddsAlignEnd) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'alignRight removed but alignEnd not added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'alignRight -> alignEnd rename not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'AlignRight to AlignEnd Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects alignRight -> alignEnd prop renames',
  detect,
};

registerPattern(pattern);

export { pattern };
