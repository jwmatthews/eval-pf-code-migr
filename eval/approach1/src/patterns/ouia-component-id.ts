import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'ouia-component-id';

// Matches data-ouia-component-id attribute in JSX
const DATA_OUIA_RE = /\bdata-ouia-component-id\b/;
// Matches ouiaId prop in JSX
const OUIA_ID_RE = /\bouiaId\b/;

function hasDataOuia(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => DATA_OUIA_RE.test(l.content));
}

function hasOuiaId(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => OUIA_ID_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesDataOuia = hasDataOuia(goldenDiff.removedLines);

  if (!goldenRemovesDataOuia) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No data-ouia-component-id removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesDataOuia = hasDataOuia(migrationDiff.removedLines);
  const migrationAddsOuiaId = hasOuiaId(migrationDiff.addedLines);

  if (migrationRemovesDataOuia && migrationAddsOuiaId) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'data-ouia-component-id correctly renamed to ouiaId',
    };
  }

  if (migrationRemovesDataOuia && !migrationAddsOuiaId) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'data-ouia-component-id removed but ouiaId not added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'data-ouia-component-id -> ouiaId rename not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'OUIA Component ID Rename',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects data-ouia-component-id -> ouiaId renames',
  detect,
};

registerPattern(pattern);

export { pattern };
