import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'react-tokens-icon-status';

// PF5 patterns: react-tokens bare import (not /dist subpath)
const OLD_TOKENS_IMPORT_RE = /from\s+['"]@patternfly\/react-tokens['"]/;
const OLD_GLOBAL_TOKEN_RE = /\bglobal_/;

// PF6 patterns: react-tokens/dist/esm imports or new token format
const NEW_TOKENS_IMPORT_RE = /from\s+['"]@patternfly\/react-tokens\/dist\b/;
const NEW_TOKEN_FORMAT_RE = /\bt_/;

// PF5 icon imports from specific paths
const OLD_ICON_IMPORT_RE = /from\s+['"]@patternfly\/react-icons\/dist\/(?:js|esm)\/icons\b/;
// PF6 icon imports from top-level
const NEW_ICON_IMPORT_RE = /from\s+['"]@patternfly\/react-icons\b/;

// PF5 status icon patterns (e.g., CheckCircleIcon used as status)
const OLD_STATUS_IMPORT_RE = /from\s+['"]@patternfly\/react-icons\/dist\b/;

function hasOldTokenOrIconPatterns(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      OLD_TOKENS_IMPORT_RE.test(l.content) ||
      OLD_GLOBAL_TOKEN_RE.test(l.content) ||
      OLD_ICON_IMPORT_RE.test(l.content) ||
      OLD_STATUS_IMPORT_RE.test(l.content),
  );
}

function hasNewTokenOrIconPatterns(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      NEW_TOKENS_IMPORT_RE.test(l.content) ||
      NEW_TOKEN_FORMAT_RE.test(l.content) ||
      NEW_ICON_IMPORT_RE.test(l.content),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff involves token/icon/status import path changes
  const goldenRemovesOld = hasOldTokenOrIconPatterns(goldenDiff.removedLines);
  const goldenAddsNew = hasNewTokenOrIconPatterns(goldenDiff.addedLines);

  if (!goldenRemovesOld && !goldenAddsNew) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No react-tokens or icon/status import changes in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migRemovesOld = hasOldTokenOrIconPatterns(migrationDiff.removedLines);
  const migAddsNew = hasNewTokenOrIconPatterns(migrationDiff.addedLines);

  // Migration didn't touch tokens/icons at all
  if (!migRemovesOld && !migAddsNew) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'react-tokens/icon/status import changes not found in migration',
    };
  }

  const details: string[] = [];

  // Check if old imports were removed but new ones not added
  if (goldenAddsNew && migRemovesOld && !migAddsNew) {
    details.push('Old import paths removed but new import paths not added');
  }

  // Check if old patterns were re-added
  const migAddsOld = hasOldTokenOrIconPatterns(migrationDiff.addedLines);
  if (migAddsOld) {
    details.push('Old react-tokens/icon import paths re-added in migration');
  }

  if (details.length > 0) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'react-tokens/icon/status imports partially migrated',
      details,
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.CORRECT,
    message: 'react-tokens/icon/status imports correctly updated',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'React Tokens/Icon/Status',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects react-tokens and icon/status import path changes',
  detect,
};

registerPattern(pattern);

export { pattern };
