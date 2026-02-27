import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'css-class-prefix';

const PF5_CLASS_RE = /\bpf-v5-[\w-]+/;
const PF6_CLASS_RE = /\bpf-v6-[\w-]+/;

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff has pf-v5 removals and pf-v6 additions (the expected migration)
  const goldenRemovesPF5 = goldenDiff.removedLines.some((l) =>
    PF5_CLASS_RE.test(l.content),
  );
  const goldenAddsPF6 = goldenDiff.addedLines.some((l) =>
    PF6_CLASS_RE.test(l.content),
  );

  if (!goldenRemovesPF5 && !goldenAddsPF6) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No pf-v5/pf-v6 class prefix changes in golden diff',
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
    PF5_CLASS_RE.test(l.content),
  );
  const migrationAddsPF6 = migrationDiff.addedLines.some((l) =>
    PF6_CLASS_RE.test(l.content),
  );

  if (migrationRemovesPF5 && migrationAddsPF6) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'pf-v5-* classes correctly renamed to pf-v6-*',
    };
  }

  if (migrationAddsPF6 && !migrationRemovesPF5) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'pf-v6-* classes added in migration',
    };
  }

  if (!migrationRemovesPF5 && !migrationAddsPF6) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'pf-v5-* to pf-v6-* class prefix rename not found in migration',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.INCORRECT,
    message: 'pf-v5-* classes removed but pf-v6-* replacements not added',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'CSS Class Prefix Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects pf-v5-* to pf-v6-* CSS class prefix renames',
  detect,
};

registerPattern(pattern);

export { pattern };
