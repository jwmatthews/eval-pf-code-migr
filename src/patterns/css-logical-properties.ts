import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'css-logical-properties';

// Physical property names that should be replaced with logical equivalents
// e.g., --PaddingTop -> --PaddingBlockStart, --MarginRight -> --MarginInlineEnd
const PHYSICAL_PROPS = [
  'PaddingTop', 'PaddingBottom', 'PaddingLeft', 'PaddingRight',
  'MarginTop', 'MarginBottom', 'MarginLeft', 'MarginRight',
];

const LOGICAL_PROPS = [
  'PaddingBlockStart', 'PaddingBlockEnd', 'PaddingInlineStart', 'PaddingInlineEnd',
  'MarginBlockStart', 'MarginBlockEnd', 'MarginInlineStart', 'MarginInlineEnd',
];

function hasPhysicalProperties(lines: Array<{ content: string }>): boolean {
  return lines.some((l) =>
    PHYSICAL_PROPS.some((prop) => l.content.includes(prop)),
  );
}

function hasLogicalProperties(lines: Array<{ content: string }>): boolean {
  return lines.some((l) =>
    LOGICAL_PROPS.some((prop) => l.content.includes(prop)),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesPhysical = hasPhysicalProperties(goldenDiff.removedLines);
  const goldenAddsLogical = hasLogicalProperties(goldenDiff.addedLines);

  if (!goldenRemovesPhysical && !goldenAddsLogical) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No physical-to-logical CSS property changes in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesPhysical = hasPhysicalProperties(migrationDiff.removedLines);
  const migrationAddsLogical = hasLogicalProperties(migrationDiff.addedLines);

  if (migrationRemovesPhysical && migrationAddsLogical) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Physical CSS properties correctly replaced with logical equivalents',
    };
  }

  if (migrationAddsLogical && !migrationRemovesPhysical) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Logical CSS properties added in migration',
    };
  }

  if (!migrationRemovesPhysical && !migrationAddsLogical) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'Physical-to-logical CSS property rename not found in migration',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.INCORRECT,
    message: 'Physical CSS properties removed but logical replacements not added',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'CSS Logical Properties',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects physical-to-logical CSS property renames (e.g., --PaddingTop -> --PaddingBlockStart)',
  detect,
};

registerPattern(pattern);

export { pattern };
