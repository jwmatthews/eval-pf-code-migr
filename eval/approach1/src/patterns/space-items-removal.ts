import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'space-items-removal';

// Matches spaceItems prop: spaceItems={...}, spaceItems="...", spaceItems='...'
const SPACE_ITEMS_RE = /\bspaceItems\s*[={]/;

function hasSpaceItems(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => SPACE_ITEMS_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesSpaceItems = hasSpaceItems(goldenDiff.removedLines);

  if (!goldenRemovesSpaceItems) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No spaceItems removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesSpaceItems = hasSpaceItems(migrationDiff.removedLines);

  if (migrationRemovesSpaceItems) {
    // Verify they didn't re-add it
    const migrationAddsSpaceItems = hasSpaceItems(migrationDiff.addedLines);
    if (migrationAddsSpaceItems) {
      return {
        patternId: PATTERN_ID,
        status: DetectionStatus.INCORRECT,
        message: 'spaceItems was removed but re-added in migration',
      };
    }
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'spaceItems prop correctly removed',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'spaceItems prop removal not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'SpaceItems Removal',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects removal of spaceItems prop',
  detect,
};

registerPattern(pattern);

export { pattern };
