import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, ASTRepresentation, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'empty-state-restructure';

// PF5 patterns: EmptyStateHeader and EmptyStateIcon as child components
const EMPTY_STATE_HEADER_RE = /\bEmptyStateHeader\b/;
const EMPTY_STATE_ICON_RE = /\bEmptyStateIcon\b/;

// PF6 patterns: titleText and icon as props on EmptyState
const TITLE_TEXT_PROP_RE = /\btitleText\b/;
const HEADING_LEVEL_PROP_RE = /\bheadingLevel\b/;

function hasEmptyStateChildren(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      EMPTY_STATE_HEADER_RE.test(l.content) ||
      EMPTY_STATE_ICON_RE.test(l.content),
  );
}

function hasEmptyStatePropsPattern(lines: Array<{ content: string }>): boolean {
  // Look for titleText or icon prop on EmptyState (added in PF6)
  return lines.some((l) => TITLE_TEXT_PROP_RE.test(l.content));
}

function detectWithAST(
  goldenAST: ASTRepresentation,
  migrationAST: ASTRepresentation,
): DetectionResult | null {
  // Check if golden AST shows EmptyStateHeader/EmptyStateIcon usage
  const goldenHasHeader = goldenAST.jsxComponents.some(
    (c) => c.tagName === 'EmptyStateHeader',
  );
  const goldenHasIcon = goldenAST.jsxComponents.some(
    (c) => c.tagName === 'EmptyStateIcon',
  );

  if (!goldenHasHeader && !goldenHasIcon) {
    return null; // AST doesn't show the relevant pattern
  }

  // Check if migration has EmptyState with titleText prop
  const migEmptyState = migrationAST.jsxComponents.filter(
    (c) => c.tagName === 'EmptyState',
  );
  const hasTitleTextProp = migEmptyState.some((c) =>
    c.props.some((p) => p.name === 'titleText'),
  );
  const hasIconProp = migEmptyState.some((c) =>
    c.props.some((p) => p.name === 'icon'),
  );

  // Check migration doesn't still have EmptyStateHeader/EmptyStateIcon
  const migStillHasHeader = migrationAST.jsxComponents.some(
    (c) => c.tagName === 'EmptyStateHeader',
  );
  const migStillHasIcon = migrationAST.jsxComponents.some(
    (c) => c.tagName === 'EmptyStateIcon',
  );

  if (migStillHasHeader || migStillHasIcon) {
    const details: string[] = [];
    if (migStillHasHeader) details.push('EmptyStateHeader still used as child component');
    if (migStillHasIcon) details.push('EmptyStateIcon still used as child component');
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'EmptyState partially restructured',
      details,
    };
  }

  if (hasTitleTextProp || hasIconProp) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'EmptyState children correctly restructured to props',
    };
  }

  return null; // Couldn't determine from AST alone
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
  goldenAST?: ASTRepresentation,
  migrationAST?: ASTRepresentation,
): DetectionResult {
  // Check if golden diff involves EmptyState restructuring
  const goldenRemovesChildren = hasEmptyStateChildren(goldenDiff.removedLines);
  const goldenAddsProps = hasEmptyStatePropsPattern(goldenDiff.addedLines);

  // Also check if golden removes EmptyStateHeader/Icon imports
  const goldenRemovesImports = goldenDiff.removedLines.some(
    (l) =>
      (EMPTY_STATE_HEADER_RE.test(l.content) || EMPTY_STATE_ICON_RE.test(l.content)) &&
      /import/.test(l.content),
  );

  if (!goldenRemovesChildren && !goldenRemovesImports) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No EmptyState restructuring in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  // Try AST-based detection first if available
  if (goldenAST && migrationAST) {
    const astResult = detectWithAST(goldenAST, migrationAST);
    if (astResult) {
      return astResult;
    }
  }

  // Fall back to diff-based detection
  const migRemovesChildren = hasEmptyStateChildren(migrationDiff.removedLines);
  const migAddsProps = hasEmptyStatePropsPattern(migrationDiff.addedLines);

  // Check if migration removes EmptyStateHeader/Icon from imports
  const migRemovesImports = migrationDiff.removedLines.some(
    (l) =>
      (EMPTY_STATE_HEADER_RE.test(l.content) || EMPTY_STATE_ICON_RE.test(l.content)) &&
      /import/.test(l.content),
  );

  if ((migRemovesChildren || migRemovesImports) && migAddsProps) {
    // Check if migration still adds EmptyStateHeader/Icon (partial migration)
    const migStillAddsChildren = hasEmptyStateChildren(migrationDiff.addedLines);
    if (migStillAddsChildren) {
      return {
        patternId: PATTERN_ID,
        status: DetectionStatus.INCORRECT,
        message: 'EmptyState partially restructured - still uses child components',
      };
    }

    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'EmptyState children correctly restructured to props',
    };
  }

  if (migRemovesChildren || migRemovesImports) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'EmptyState children removed but props not properly added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'EmptyState restructuring not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'EmptyState Restructure',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects EmptyState children restructuring (EmptyStateHeader/EmptyStateIcon moved to props)',
  detect,
};

registerPattern(pattern);

export { pattern };
