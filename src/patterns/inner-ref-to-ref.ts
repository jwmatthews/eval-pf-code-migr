import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'inner-ref-to-ref';

// Matches innerRef prop in JSX: innerRef={...}, innerRef="...", innerRef='...'
const INNER_REF_RE = /\binnerRef\s*[={]/;
// Matches ref prop (but not innerRef): standalone ref={...}, ref="...", ref='...'
const REF_RE = /\bref\s*[={]/;

function hasInnerRef(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => INNER_REF_RE.test(l.content));
}

function hasRef(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => REF_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff removes innerRef and adds ref
  const goldenRemovesInnerRef = hasInnerRef(goldenDiff.removedLines);

  if (!goldenRemovesInnerRef) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No innerRef removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesInnerRef = hasInnerRef(migrationDiff.removedLines);
  const migrationAddsRef = hasRef(migrationDiff.addedLines);

  if (migrationRemovesInnerRef && migrationAddsRef) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'innerRef correctly renamed to ref',
    };
  }

  if (migrationRemovesInnerRef && !migrationAddsRef) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'innerRef removed but ref not added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'innerRef -> ref rename not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'InnerRef to Ref Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects innerRef -> ref prop renames',
  detect,
};

registerPattern(pattern);

export { pattern };
