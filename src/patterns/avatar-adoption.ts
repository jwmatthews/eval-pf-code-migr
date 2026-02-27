import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, ASTRepresentation, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'avatar-adoption';

// Avatar component references
const AVATAR_TAG_RE = /\bAvatar\b/;

// PF5 Avatar patterns: img-based props, alt prop usage
const OLD_AVATAR_SRC_RE = /\bsrc\s*=\s*(?:\{|"|')/;
const OLD_AVATAR_ALT_RE = /\balt\s*=\s*(?:\{|"|')/;

// PF6 Avatar patterns: border prop, size prop, isBordered
const AVATAR_BORDER_RE = /\bisBordered\b/;
const AVATAR_SIZE_RE = /\bsize\s*=\s*(?:\{|"|')/;

function hasAvatarChanges(
  removedLines: Array<{ content: string }>,
  addedLines: Array<{ content: string }>,
): boolean {
  // Check if golden shows Avatar component changes
  const removedHasAvatar = removedLines.some((l) => AVATAR_TAG_RE.test(l.content));
  const addedHasAvatar = addedLines.some((l) => AVATAR_TAG_RE.test(l.content));

  return removedHasAvatar || addedHasAvatar;
}

function detectWithAST(
  goldenAST: ASTRepresentation,
  migrationAST: ASTRepresentation,
): DetectionResult | null {
  const goldenAvatars = goldenAST.jsxComponents.filter((c) => c.tagName === 'Avatar');
  const migAvatars = migrationAST.jsxComponents.filter((c) => c.tagName === 'Avatar');

  if (goldenAvatars.length === 0) {
    return null;
  }

  if (migAvatars.length === 0) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'Avatar component not found in migration AST',
    };
  }

  // Check for PF6 patterns: isBordered or size prop
  const migHasBorder = migAvatars.some((c) => c.props.some((p) => p.name === 'isBordered'));
  const migHasSize = migAvatars.some((c) => c.props.some((p) => p.name === 'size'));
  const goldenHasBorder = goldenAvatars.some((c) => c.props.some((p) => p.name === 'isBordered'));
  const goldenHasSize = goldenAvatars.some((c) => c.props.some((p) => p.name === 'size'));

  if ((goldenHasBorder || goldenHasSize) && (migHasBorder || migHasSize)) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Avatar component correctly adopted with PF6 props',
    };
  }

  if ((goldenHasBorder || goldenHasSize) && !migHasBorder && !migHasSize) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Avatar component present but missing PF6 props',
      details: ['Avatar missing isBordered or size props from golden'],
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
  // Check if golden diff involves Avatar changes
  const goldenHasAvatarChanges = hasAvatarChanges(
    goldenDiff.removedLines,
    goldenDiff.addedLines,
  );

  if (!goldenHasAvatarChanges) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Avatar component changes in golden diff',
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
  const migHasAvatarChanges = hasAvatarChanges(
    migrationDiff.removedLines,
    migrationDiff.addedLines,
  );

  if (!migHasAvatarChanges) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.MISSING,
      message: 'Avatar component changes not found in migration',
    };
  }

  // Check for PF6 patterns in migration added lines
  const migAddsAvatar = migrationDiff.addedLines.filter((l) => AVATAR_TAG_RE.test(l.content));
  const goldenAddsAvatar = goldenDiff.addedLines.filter((l) => AVATAR_TAG_RE.test(l.content));

  // Check if migration has new PF6 Avatar props
  const migHasBorder = migAddsAvatar.some((l) => AVATAR_BORDER_RE.test(l.content));
  const migHasSize = migAddsAvatar.some((l) => AVATAR_SIZE_RE.test(l.content));
  const goldenHasBorder = goldenAddsAvatar.some((l) => AVATAR_BORDER_RE.test(l.content));
  const goldenHasSize = goldenAddsAvatar.some((l) => AVATAR_SIZE_RE.test(l.content));

  // If golden adds PF6 props, check migration does too
  if (goldenHasBorder || goldenHasSize) {
    const details: string[] = [];

    if (goldenHasBorder && !migHasBorder) {
      details.push('Missing isBordered prop on Avatar');
    }
    if (goldenHasSize && !migHasSize) {
      details.push('Missing size prop on Avatar');
    }

    if (details.length > 0) {
      return {
        patternId: PATTERN_ID,
        status: DetectionStatus.INCORRECT,
        message: 'Avatar partially migrated - missing PF6 props',
        details,
      };
    }
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.CORRECT,
    message: 'Avatar component correctly adopted',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Avatar Adoption',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects Avatar component adoption patterns (PF5 to PF6 prop changes)',
  detect,
};

registerPattern(pattern);

export { pattern };
