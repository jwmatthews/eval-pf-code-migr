import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'text-content-consolidation';

// PF5 component/type names that get consolidated into Content in PF6
const PF5_TEXT_NAMES = /\b(TextContent|TextListItem|TextList|TextVariants|TextListVariants|TextListItemVariants|TextProps)\b/;
// Also match bare <Text or Text> but avoid matching "TextContent" etc.
const PF5_TEXT_COMPONENT = /\bText\b(?!Content|List|Variants|Props)/;

// PF6 replacements
const PF6_CONTENT = /\bContent\b(?!Variants|Props)/;
const PF6_CONTENT_NAMES = /\b(Content|ContentVariants|ContentProps)\b/;

// Prop renames
const PF5_IS_VISITED = /\bisVisited\b/;
const PF6_IS_VISITED_LINK = /\bisVisitedLink\b/;
const PF5_IS_PLAIN = /\bisPlain\b/;
const PF6_IS_PLAIN_LIST = /\bisPlainList\b/;

function hasTextComponents(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => PF5_TEXT_NAMES.test(l.content) || PF5_TEXT_COMPONENT.test(l.content),
  );
}

function hasContentComponent(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) => PF6_CONTENT.test(l.content) || PF6_CONTENT_NAMES.test(l.content),
  );
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  // Check if golden diff involves Text component consolidation
  const goldenRemovesText = hasTextComponents(goldenDiff.removedLines);
  const goldenAddsContent = hasContentComponent(goldenDiff.addedLines);

  if (!goldenRemovesText || !goldenAddsContent) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Text->Content consolidation in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migRemovesText = hasTextComponents(migrationDiff.removedLines);
  const migAddsContent = hasContentComponent(migrationDiff.addedLines);

  if (migRemovesText && migAddsContent) {
    // Check for prop renames as bonus quality signals
    const details: string[] = [];

    // Check isVisited -> isVisitedLink
    const goldenHasVisitedRename =
      goldenDiff.removedLines.some((l) => PF5_IS_VISITED.test(l.content)) &&
      goldenDiff.addedLines.some((l) => PF6_IS_VISITED_LINK.test(l.content));
    if (goldenHasVisitedRename) {
      const migHasVisitedRename =
        migrationDiff.removedLines.some((l) => PF5_IS_VISITED.test(l.content)) &&
        migrationDiff.addedLines.some((l) => PF6_IS_VISITED_LINK.test(l.content));
      if (!migHasVisitedRename) {
        details.push('Missing isVisited -> isVisitedLink rename');
      }
    }

    // Check isPlain -> isPlainList
    const goldenHasPlainRename =
      goldenDiff.removedLines.some((l) => PF5_IS_PLAIN.test(l.content)) &&
      goldenDiff.addedLines.some((l) => PF6_IS_PLAIN_LIST.test(l.content));
    if (goldenHasPlainRename) {
      const migHasPlainRename =
        migrationDiff.removedLines.some((l) => PF5_IS_PLAIN.test(l.content)) &&
        migrationDiff.addedLines.some((l) => PF6_IS_PLAIN_LIST.test(l.content));
      if (!migHasPlainRename) {
        details.push('Missing isPlain -> isPlainList rename');
      }
    }

    if (details.length > 0) {
      return {
        patternId: PATTERN_ID,
        status: DetectionStatus.INCORRECT,
        message: 'Text components partially consolidated to Content',
        details,
      };
    }

    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Text/TextContent/TextList components correctly consolidated to Content',
    };
  }

  if (migRemovesText && !migAddsContent) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Text components removed but Content not added',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'Text->Content consolidation not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Text Content Consolidation',
  complexity: 'moderate',
  weight: 2,
  description:
    'Detects consolidation of Text, TextContent, TextList, TextListItem into Content component',
  detect,
};

registerPattern(pattern);

export { pattern };
