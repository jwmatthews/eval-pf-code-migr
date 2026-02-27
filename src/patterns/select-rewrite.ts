import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, ASTRepresentation, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'select-rewrite';

// PF5 Select patterns: old API props
const SELECT_TAG_RE = /\bSelect\b(?!Option|List|Group|Variant)/;
const PF5_ON_TOGGLE_RE = /\bonToggle\b/;
const PF5_IS_OPEN_RE = /\bisOpen\b/;
const PF5_SELECTIONS_RE = /\bselections\b/;
const PF5_PLACEHOLDER_RE = /\bplaceholderText\b/;
const PF5_SELECT_VARIANT_RE = /\bSelectVariant\b/;

// PF6 Select patterns: new API components/props
const MENU_TOGGLE_RE = /\bMenuToggle\b/;
const SELECT_LIST_RE = /\bSelectList\b/;
const TOGGLE_PROP_RE = /\btoggle\s*=\s*\{/;
const ON_OPEN_CHANGE_RE = /\bonOpenChange\b/;

function hasOldSelectAPI(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      PF5_ON_TOGGLE_RE.test(l.content) ||
      PF5_IS_OPEN_RE.test(l.content) ||
      PF5_SELECTIONS_RE.test(l.content) ||
      PF5_PLACEHOLDER_RE.test(l.content) ||
      PF5_SELECT_VARIANT_RE.test(l.content),
  );
}

function hasNewSelectAPI(lines: Array<{ content: string }>): boolean {
  return lines.some(
    (l) =>
      MENU_TOGGLE_RE.test(l.content) ||
      SELECT_LIST_RE.test(l.content) ||
      TOGGLE_PROP_RE.test(l.content) ||
      ON_OPEN_CHANGE_RE.test(l.content),
  );
}

function hasSelectUsage(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => SELECT_TAG_RE.test(l.content));
}

function detectWithAST(
  goldenAST: ASTRepresentation,
  migrationAST: ASTRepresentation,
): DetectionResult | null {
  // Check golden AST for PF5 Select usage
  const goldenSelects = goldenAST.jsxComponents.filter(
    (c) => c.tagName === 'Select',
  );

  if (goldenSelects.length === 0) {
    return null;
  }

  // Check for PF5-specific props on golden Select
  const goldenHasOldProps = goldenSelects.some((c) =>
    c.props.some(
      (p) =>
        p.name === 'onToggle' ||
        p.name === 'isOpen' ||
        p.name === 'selections' ||
        p.name === 'placeholderText',
    ),
  );

  if (!goldenHasOldProps) {
    return null; // Select exists but no PF5 props - can't determine from AST
  }

  // Check migration for PF6 patterns
  const migSelects = migrationAST.jsxComponents.filter(
    (c) => c.tagName === 'Select',
  );
  const migHasMenuToggle = migrationAST.jsxComponents.some(
    (c) => c.tagName === 'MenuToggle',
  );
  const migHasSelectList = migrationAST.jsxComponents.some(
    (c) => c.tagName === 'SelectList',
  );
  const migHasToggleProp = migSelects.some((c) =>
    c.props.some((p) => p.name === 'toggle'),
  );

  // Check if migration still has PF5 props
  const migStillHasOldProps = migSelects.some((c) =>
    c.props.some(
      (p) =>
        p.name === 'onToggle' ||
        p.name === 'isOpen' ||
        p.name === 'selections' ||
        p.name === 'placeholderText',
    ),
  );

  if (migStillHasOldProps) {
    const details: string[] = [];
    const oldProps = migSelects
      .flatMap((c) => c.props)
      .filter(
        (p) =>
          p.name === 'onToggle' ||
          p.name === 'isOpen' ||
          p.name === 'selections' ||
          p.name === 'placeholderText',
      )
      .map((p) => p.name);
    details.push(`PF5 Select props still present: ${[...new Set(oldProps)].join(', ')}`);
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Select partially rewritten - still uses PF5 API props',
      details,
    };
  }

  if (migHasMenuToggle || migHasSelectList || migHasToggleProp) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Select correctly rewritten to PF6 API',
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
  // Check if golden diff involves Select rewrite
  const goldenHasSelect = hasSelectUsage(goldenDiff.removedLines) || hasSelectUsage(goldenDiff.addedLines);
  const goldenRemovesOldAPI = hasOldSelectAPI(goldenDiff.removedLines);
  const goldenAddsNewAPI = hasNewSelectAPI(goldenDiff.addedLines);

  if (!goldenHasSelect || (!goldenRemovesOldAPI && !goldenAddsNewAPI)) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No Select component rewrite in golden diff',
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
  const migRemovesOldAPI = hasOldSelectAPI(migrationDiff.removedLines);
  const migAddsNewAPI = hasNewSelectAPI(migrationDiff.addedLines);
  const migStillAddsOldAPI = hasOldSelectAPI(migrationDiff.addedLines);

  // Check for partial migration: old API still present in added lines
  if (migStillAddsOldAPI && !migAddsNewAPI) {
    const details: string[] = [];
    if (migrationDiff.addedLines.some((l) => PF5_ON_TOGGLE_RE.test(l.content))) {
      details.push('onToggle prop still used (PF5 API)');
    }
    if (migrationDiff.addedLines.some((l) => PF5_IS_OPEN_RE.test(l.content))) {
      details.push('isOpen prop still used (PF5 API)');
    }
    if (migrationDiff.addedLines.some((l) => PF5_SELECTIONS_RE.test(l.content))) {
      details.push('selections prop still used (PF5 API)');
    }
    if (migrationDiff.addedLines.some((l) => PF5_PLACEHOLDER_RE.test(l.content))) {
      details.push('placeholderText prop still used (PF5 API)');
    }
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Select partially rewritten - still uses PF5 API',
      details,
    };
  }

  // Check for correct migration
  if (migRemovesOldAPI && migAddsNewAPI) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Select correctly rewritten to PF6 API',
    };
  }

  if (migAddsNewAPI) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Select rewritten to use PF6 API components',
    };
  }

  if (migRemovesOldAPI) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Select old API removed but PF6 API not properly added',
      details: ['Old Select props removed but MenuToggle/SelectList not introduced'],
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'Select rewrite not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Select Rewrite',
  complexity: 'complex',
  weight: 3,
  description:
    'Detects Select component rewrite from PF5 API (onToggle, isOpen, selections) to PF6 API (MenuToggle, SelectList, toggle prop)',
  detect,
};

registerPattern(pattern);

export { pattern };
