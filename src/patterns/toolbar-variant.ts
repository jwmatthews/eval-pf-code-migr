import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'toolbar-variant';

// PF5 ToolbarItem variant values that changed in PF6
const CHIP_GROUP_VARIANT_RE = /variant\s*=\s*(?:"|'|\{['"])chip-group(?:"|'|\}|['"])/;
const BULK_SELECT_VARIANT_RE = /variant\s*=\s*(?:"|'|\{['"])bulk-select(?:"|'|\}|['"])/;
const OVERFLOW_MENU_VARIANT_RE = /variant\s*=\s*(?:"|'|\{['"])overflow-menu(?:"|'|\}|['"])/;
const SEARCH_FILTER_VARIANT_RE = /variant\s*=\s*(?:"|'|\{['"])search-filter(?:"|'|\}|['"])/;

// PF6 replacement
const LABEL_GROUP_VARIANT_RE = /variant\s*=\s*(?:"|'|\{['"])label-group(?:"|'|\}|['"])/;

function hasOldVariants(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      CHIP_GROUP_VARIANT_RE.test(l.content) ||
      BULK_SELECT_VARIANT_RE.test(l.content) ||
      OVERFLOW_MENU_VARIANT_RE.test(l.content) ||
      SEARCH_FILTER_VARIANT_RE.test(l.content),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff involves ToolbarItem variant changes
  const goldenRemovesOldVariants = hasOldVariants(goldenDiff.removedLines);

  if (!goldenRemovesOldVariants) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No ToolbarItem variant changes in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migRemovesOldVariants = hasOldVariants(migrationDiff.removedLines);

  if (!migRemovesOldVariants) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'ToolbarItem variant changes not found in migration',
    };
  }

  // Check specific changes
  const details: string[] = [];

  // chip-group -> label-group rename
  const goldenHasChipGroup = goldenDiff.removedLines.some((l) =>
    CHIP_GROUP_VARIANT_RE.test(l.content),
  );
  if (goldenHasChipGroup) {
    const migRemovesChipGroup = migrationDiff.removedLines.some((l) =>
      CHIP_GROUP_VARIANT_RE.test(l.content),
    );
    const migAddsLabelGroup = migrationDiff.addedLines.some((l) =>
      LABEL_GROUP_VARIANT_RE.test(l.content),
    );

    if (migRemovesChipGroup && !migAddsLabelGroup) {
      details.push('chip-group variant removed but label-group not added');
    }
  }

  // Removed variants should not be re-added
  const migAddsOldVariants = hasOldVariants(migrationDiff.addedLines);
  if (migAddsOldVariants) {
    details.push('Old variant values re-added in migration');
  }

  if (details.length > 0) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'ToolbarItem variant partially migrated',
      details,
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.CORRECT,
    message: 'ToolbarItem variant props correctly updated',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Toolbar Variant',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects ToolbarItem variant prop changes (chip-group->label-group, removal of bulk-select/overflow-menu/search-filter)',
  detect,
};

registerPattern(pattern);

export { pattern };
