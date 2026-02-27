import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'utility-class-rename';

const PF5_UTILITY_RE = /\bpf-v5-u-[\w-]+/;
const PF6_UTILITY_RE = /\bpf-v6-u-[\w-]+/;

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesPF5 = goldenDiff.removedLines.some((l) =>
    PF5_UTILITY_RE.test(l.content),
  );
  const goldenAddsPF6 = goldenDiff.addedLines.some((l) =>
    PF6_UTILITY_RE.test(l.content),
  );

  if (!goldenRemovesPF5 && !goldenAddsPF6) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No pf-v5-u/pf-v6-u utility class changes in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesPF5 = migrationDiff.removedLines.some((l) =>
    PF5_UTILITY_RE.test(l.content),
  );
  const migrationAddsPF6 = migrationDiff.addedLines.some((l) =>
    PF6_UTILITY_RE.test(l.content),
  );

  if (migrationRemovesPF5 && migrationAddsPF6) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'pf-v5-u-* utility classes correctly renamed to pf-v6-u-*',
    };
  }

  if (migrationAddsPF6 && !migrationRemovesPF5) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'pf-v6-u-* utility classes added in migration',
    };
  }

  if (!migrationRemovesPF5 && !migrationAddsPF6) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'pf-v5-u-* to pf-v6-u-* utility class rename not found in migration',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.INCORRECT,
    message: 'pf-v5-u-* utility classes removed but pf-v6-u-* replacements not added',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Utility Class Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects pf-v5-u-* to pf-v6-u-* utility class renames',
  detect,
};

registerPattern(pattern);

export { pattern };
