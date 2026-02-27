import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'page-section-variant';

// PF5 PageSection variant values that were removed/changed in PF6
const VARIANT_LIGHT_RE = /variant\s*=\s*(?:"|'|\{['"]|{PageSectionVariants\.)light(?:"|'|\}|['"]|})/;
const VARIANT_DARK_RE = /variant\s*=\s*(?:"|'|\{['"]|{PageSectionVariants\.)dark(?:"|'|\}|['"]|})/;
const VARIANT_DARKER_RE = /variant\s*=\s*(?:"|'|\{['"]|{PageSectionVariants\.)darker(?:"|'|\}|['"]|})/;

// PF5 PageSectionVariants enum import
const PAGE_SECTION_VARIANTS_RE = /\bPageSectionVariants\b/;

// PageSection component reference
const PAGE_SECTION_RE = /\bPageSection\b/;

function hasOldVariants(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      VARIANT_LIGHT_RE.test(l.content) ||
      VARIANT_DARK_RE.test(l.content) ||
      VARIANT_DARKER_RE.test(l.content) ||
      (PAGE_SECTION_VARIANTS_RE.test(l.content) && PAGE_SECTION_RE.test(l.content)),
  );
}

function hasVariantImportRemoval(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => PAGE_SECTION_VARIANTS_RE.test(l.content) && /import/.test(l.content),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff involves PageSection variant changes
  const goldenRemovesOldVariants = hasOldVariants(goldenDiff.removedLines);
  const goldenRemovesVariantImport = hasVariantImportRemoval(goldenDiff.removedLines);

  if (!goldenRemovesOldVariants && !goldenRemovesVariantImport) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No PageSection variant changes in golden diff',
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
  const migRemovesVariantImport = hasVariantImportRemoval(migrationDiff.removedLines);

  if (!migRemovesOldVariants && !migRemovesVariantImport) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'PageSection variant changes not found in migration',
    };
  }

  const details: string[] = [];

  // Check if old variants were re-added
  const migAddsOldVariants = hasOldVariants(migrationDiff.addedLines);
  if (migAddsOldVariants) {
    details.push('Old PageSection variant values re-added in migration');
  }

  // Check if PageSectionVariants enum is re-added
  const migAddsVariantImport = hasVariantImportRemoval(migrationDiff.addedLines);
  if (migAddsVariantImport) {
    details.push('PageSectionVariants import re-added in migration');
  }

  if (details.length > 0) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'PageSection variant partially migrated',
      details,
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.CORRECT,
    message: 'PageSection variant props correctly updated',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'PageSection Variant',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects PageSection variant changes (removal of light/dark/darker variants and PageSectionVariants enum)',
  detect,
};

registerPattern(pattern);

export { pattern };
