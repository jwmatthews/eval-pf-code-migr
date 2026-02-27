import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, ASTRepresentation, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'masthead-reorganization';

// Masthead sub-components
const MASTHEAD_TOGGLE_RE = /\bMastheadToggle\b/;
const MASTHEAD_MAIN_RE = /\bMastheadMain\b/;
const MASTHEAD_BRAND_RE = /\bMastheadBrand\b/;
const MASTHEAD_CONTENT_RE = /\bMastheadContent\b/;
const MASTHEAD_LOGO_RE = /\bMastheadLogo\b/;

// PF5 Masthead hierarchy: MastheadToggle as sibling of MastheadMain
// PF6 Masthead hierarchy: MastheadToggle inside MastheadMain, MastheadLogo introduced

function hasMastheadSubComponents(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      MASTHEAD_TOGGLE_RE.test(l.content) ||
      MASTHEAD_MAIN_RE.test(l.content) ||
      MASTHEAD_BRAND_RE.test(l.content) ||
      MASTHEAD_CONTENT_RE.test(l.content),
  );
}

function hasMastheadLogo(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => MASTHEAD_LOGO_RE.test(l.content));
}

function hasReorganizationSignals(
  removedLines: Array<{ content: string }>,
  addedLines: Array<{ content: string }>,
): boolean {
  // Signal 1: MastheadLogo is introduced (new PF6 component)
  const addsMastheadLogo = hasMastheadLogo(addedLines);

  // Signal 2: Sub-components are being restructured (removed and re-added)
  const removesSubComponents = hasMastheadSubComponents(removedLines);
  const addsSubComponents = hasMastheadSubComponents(addedLines);
  const restructured = removesSubComponents && addsSubComponents;

  return addsMastheadLogo || restructured;
}

function detectWithAST(
  goldenAST: ASTRepresentation,
  migrationAST: ASTRepresentation,
): DetectionResult | null {
  const goldenComponents = goldenAST.jsxComponents.map((c) => c.tagName);
  const migComponents = migrationAST.jsxComponents.map((c) => c.tagName);

  // Check golden has Masthead sub-components being reorganized
  const goldenHasToggle = goldenComponents.includes('MastheadToggle');
  const goldenHasMain = goldenComponents.includes('MastheadMain');
  const goldenHasBrand = goldenComponents.includes('MastheadBrand');

  if (!goldenHasToggle && !goldenHasMain && !goldenHasBrand) {
    return null; // No Masthead hierarchy to reorganize
  }

  // Check PF6 signals in migration
  const migHasLogo = migComponents.includes('MastheadLogo');
  const migHasToggle = migComponents.includes('MastheadToggle');
  const migHasMain = migComponents.includes('MastheadMain');
  const migHasBrand = migComponents.includes('MastheadBrand');

  // Check if migration has MastheadLogo (strongest PF6 signal)
  if (migHasLogo) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Masthead hierarchy correctly reorganized with MastheadLogo',
    };
  }

  // If migration has the sub-components but no MastheadLogo, partial migration
  if (migHasToggle && migHasMain && migHasBrand) {
    const details: string[] = [];
    details.push('MastheadLogo component not introduced (PF6 requires MastheadLogo inside MastheadBrand)');
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Masthead partially reorganized - missing MastheadLogo',
      details,
    };
  }

  return null;
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
  goldenAST?: ASTRepresentation,
  migrationAST?: ASTRepresentation,
): DetectionResult {
  // Check if golden diff involves Masthead hierarchy reorganization
  if (!hasReorganizationSignals(goldenDiff.removedLines, goldenDiff.addedLines)) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Masthead hierarchy reorganization in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  // Try AST-based detection first
  if (goldenAST && migrationAST) {
    const astResult = detectWithAST(goldenAST, migrationAST);
    if (astResult) {
      return astResult;
    }
  }

  // Fall back to diff-based detection
  const goldenAddsMastheadLogo = hasMastheadLogo(goldenDiff.addedLines);
  const migAddsMastheadLogo = hasMastheadLogo(migrationDiff.addedLines);
  const migRestructures =
    hasMastheadSubComponents(migrationDiff.removedLines) &&
    hasMastheadSubComponents(migrationDiff.addedLines);

  // Check if migration adds MastheadLogo (strongest PF6 signal)
  if (migAddsMastheadLogo) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Masthead hierarchy correctly reorganized with MastheadLogo',
    };
  }

  // Check if migration restructures sub-components without MastheadLogo
  if (migRestructures) {
    const details: string[] = [];
    if (goldenAddsMastheadLogo) {
      details.push('MastheadLogo component not introduced (PF6 requires MastheadLogo inside MastheadBrand)');
    }
    if (details.length > 0) {
      return {
        patternId: PATTERN_ID,
        status: DetectionStatus.INCORRECT,
        message: 'Masthead partially reorganized - missing MastheadLogo',
        details,
      };
    }
    // If golden didn't introduce MastheadLogo but restructured, migration matches
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Masthead hierarchy correctly reorganized',
    };
  }

  // No restructuring detected in migration
  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'Masthead hierarchy reorganization not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Masthead Reorganization',
  complexity: 'complex',
  weight: 3,
  description:
    'Detects Masthead component hierarchy reorganization from PF5 to PF6 (MastheadToggle moves into MastheadMain, MastheadLogo introduced)',
  detect,
};

registerPattern(pattern);

export { pattern };
