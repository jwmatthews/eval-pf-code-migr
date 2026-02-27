import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, ASTRepresentation, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'button-icon-prop';

// PF5 pattern: Button with icon as children (variant="plain" with icon child)
// or Button with separate icon/children structure
const BUTTON_TAG_RE = /\bButton\b/;

// PF6 pattern: Button with icon prop
const ICON_PROP_RE = /\bicon\s*=\s*\{/;

// PF5 variant="plain" with icon as child is a common pattern
const VARIANT_PLAIN_RE = /variant\s*=\s*(?:"|'|\{['"])plain(?:"|'|\}|['"])/;

function hasButtonIconChanges(
  removedLines: Array<{ content: string }>,
  addedLines: Array<{ content: string }>,
): boolean {
  // Check if golden shows Button changes involving icon restructuring
  // Pattern: removed lines have Button with icon as child, added lines have Button with icon prop
  const removedHasButton = removedLines.some((l) => BUTTON_TAG_RE.test(l.content));
  const addedHasIconProp = addedLines.some(
    (l) => BUTTON_TAG_RE.test(l.content) && ICON_PROP_RE.test(l.content),
  );

  return removedHasButton && addedHasIconProp;
}

function detectWithAST(
  goldenAST: ASTRepresentation,
  migrationAST: ASTRepresentation,
): DetectionResult | null {
  // Find Button components in golden that have been restructured with icon prop
  const goldenButtons = goldenAST.jsxComponents.filter((c) => c.tagName === 'Button');
  const migButtons = migrationAST.jsxComponents.filter((c) => c.tagName === 'Button');

  if (goldenButtons.length === 0) {
    return null;
  }

  // Check if migration Buttons have icon prop
  const migHasIconProp = migButtons.some((c) => c.props.some((p) => p.name === 'icon'));

  if (migHasIconProp) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Button icon correctly restructured to icon prop',
    };
  }

  // Check if migration still uses children for icons (variant="plain" without icon prop)
  const migHasPlainVariant = migButtons.some((c) =>
    c.props.some((p) => p.name === 'variant' && p.value?.includes('plain')),
  );

  if (migHasPlainVariant && !migHasIconProp) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Button still uses children for icon instead of icon prop',
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
  // Check if golden diff involves Button icon restructuring
  const goldenHasIconChanges = hasButtonIconChanges(
    goldenDiff.removedLines,
    goldenDiff.addedLines,
  );

  if (!goldenHasIconChanges) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Button icon prop changes in golden diff',
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
  const migHasIconChanges = hasButtonIconChanges(
    migrationDiff.removedLines,
    migrationDiff.addedLines,
  );

  if (migHasIconChanges) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Button icon correctly restructured to icon prop',
    };
  }

  // Check if migration at least has some Button changes with icon prop
  const migAddsIconProp = migrationDiff.addedLines.some(
    (l) => BUTTON_TAG_RE.test(l.content) && ICON_PROP_RE.test(l.content),
  );

  if (migAddsIconProp) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Button icon prop added in migration',
    };
  }

  // Check if migration has Button changes but without icon prop
  const migHasButtonChanges = migrationDiff.removedLines.some((l) =>
    BUTTON_TAG_RE.test(l.content),
  );

  if (migHasButtonChanges) {
    // Button was changed but icon prop not restructured
    const migStillHasPlainVariant = migrationDiff.addedLines.some(
      (l) => BUTTON_TAG_RE.test(l.content) && VARIANT_PLAIN_RE.test(l.content),
    );

    if (migStillHasPlainVariant) {
      return {
        patternId: PATTERN_ID,
        status: DetectionStatus.INCORRECT,
        message: 'Button modified but icon still used as children',
        details: ['Button variant="plain" exists but icon not moved to icon prop'],
      };
    }
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'Button icon prop restructuring not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Button Icon Prop',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects Button icon prop restructuring (icon as children -> icon prop)',
  detect,
};

registerPattern(pattern);

export { pattern };
