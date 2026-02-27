import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'toolbar-gap';

// PF5 patterns: spacer prop with breakpoint objects on Toolbar/ToolbarGroup/ToolbarItem
const SPACER_PROP_RE = /\bspacer\s*=\s*\{/;
// Also detect spaceItems prop on Toolbar (covered by space-items-removal, but gap replacement is different)
const SPACE_ITEMS_PROP_RE = /\bspaceItems\s*=\s*\{/;

// PF6 patterns: gap/columnGap/rowGap props
const GAP_PROP_RE = /\bgap\s*=\s*\{/;
const COLUMN_GAP_PROP_RE = /\bcolumnGap\s*=\s*\{/;
const ROW_GAP_PROP_RE = /\browGap\s*=\s*\{/;

function hasOldSpacerPatterns(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => SPACER_PROP_RE.test(l.content) || SPACE_ITEMS_PROP_RE.test(l.content),
  );
}

function hasNewGapPatterns(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      GAP_PROP_RE.test(l.content) ||
      COLUMN_GAP_PROP_RE.test(l.content) ||
      ROW_GAP_PROP_RE.test(l.content),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff involves spacer -> gap changes
  const goldenRemovesSpacers = hasOldSpacerPatterns(goldenDiff.removedLines);
  const goldenAddsGaps = hasNewGapPatterns(goldenDiff.addedLines);

  if (!goldenRemovesSpacers && !goldenAddsGaps) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Toolbar gap/spacer changes in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migRemovesSpacers = hasOldSpacerPatterns(migrationDiff.removedLines);
  const migAddsGaps = hasNewGapPatterns(migrationDiff.addedLines);

  // Migration didn't touch spacers at all
  if (!migRemovesSpacers && !migAddsGaps) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'Toolbar gap/spacer changes not found in migration',
    };
  }

  const details: string[] = [];

  // Check if spacers were removed but gaps not added (when golden adds gaps)
  if (goldenAddsGaps && migRemovesSpacers && !migAddsGaps) {
    details.push('spacer props removed but gap props not added');
  }

  // Check if old spacer props were re-added
  const migAddsSpacers = hasOldSpacerPatterns(migrationDiff.addedLines);
  if (migAddsSpacers) {
    details.push('Old spacer props re-added in migration');
  }

  if (details.length > 0) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Toolbar gap/spacer partially migrated',
      details,
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.CORRECT,
    message: 'Toolbar gap/spacer props correctly updated',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Toolbar Gap',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects Toolbar gap/spacer changes (spacer/spaceItems -> gap/columnGap/rowGap)',
  detect,
};

registerPattern(pattern);

export { pattern };
