import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, ASTRepresentation, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'test-selector-rewrite';

// Test selector patterns that change during PF5 -> PF6 migration
const DATA_TESTID_RE = /\bdata-testid\b/;
const ARIA_LABEL_RE = /\baria-label\b/;
const PF5_CSS_SELECTOR_RE = /\.pf-v5-c-/;
const PF6_CSS_SELECTOR_RE = /\.pf-v6-c-/;
const PF5_CLASS_SELECTOR_RE = /pf-v5-c-[\w-]+/;
const PF6_CLASS_SELECTOR_RE = /pf-v6-c-[\w-]+/;

// Test query patterns that reference selectors
const GET_BY_TESTID_RE = /getByTestId|queryByTestId|findByTestId|getAllByTestId|queryAllByTestId|findAllByTestId/;
const GET_BY_ROLE_RE = /getByRole|queryByRole|findByRole|getAllByRole|queryAllByRole|findAllByRole/;
const GET_BY_LABEL_RE = /getByLabelText|queryByLabelText|findByLabelText|getAllByLabelText|queryAllByLabelText|findAllByLabelText/;
const CY_GET_RE = /cy\.get\s*\(/;

function hasTestSelectorChanges(
  removedLines: Array<{ content: string }>,
  addedLines: Array<{ content: string }>,
): boolean {
  const removesSelectors = removedLines.some(
    (l) =>
      DATA_TESTID_RE.test(l.content) ||
      ARIA_LABEL_RE.test(l.content) ||
      PF5_CSS_SELECTOR_RE.test(l.content) ||
      PF5_CLASS_SELECTOR_RE.test(l.content),
  );

  const addsSelectors = addedLines.some(
    (l) =>
      DATA_TESTID_RE.test(l.content) ||
      ARIA_LABEL_RE.test(l.content) ||
      PF6_CSS_SELECTOR_RE.test(l.content) ||
      PF6_CLASS_SELECTOR_RE.test(l.content),
  );

  // Also check for test query functions being updated
  const removesTestQueries = removedLines.some(
    (l) =>
      GET_BY_TESTID_RE.test(l.content) ||
      GET_BY_ROLE_RE.test(l.content) ||
      GET_BY_LABEL_RE.test(l.content) ||
      CY_GET_RE.test(l.content),
  );

  const addsTestQueries = addedLines.some(
    (l) =>
      GET_BY_TESTID_RE.test(l.content) ||
      GET_BY_ROLE_RE.test(l.content) ||
      GET_BY_LABEL_RE.test(l.content) ||
      CY_GET_RE.test(l.content),
  );

  // Check for CSS selector version changes (pf-v5 -> pf-v6)
  const removesPF5Selectors = removedLines.some((l) => PF5_CSS_SELECTOR_RE.test(l.content));
  const addsPF6Selectors = addedLines.some((l) => PF6_CSS_SELECTOR_RE.test(l.content));

  return (
    (removesSelectors && addsSelectors) ||
    (removesTestQueries && addsTestQueries) ||
    (removesPF5Selectors && addsPF6Selectors)
  );
}

function hasPF5CSSSelectors(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => PF5_CSS_SELECTOR_RE.test(l.content));
}

function hasPF6CSSSelectors(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => PF6_CSS_SELECTOR_RE.test(l.content));
}

function hasTestIdChanges(
  removedLines: Array<{ content: string }>,
  addedLines: Array<{ content: string }>,
): boolean {
  const removesTestId = removedLines.some((l) => DATA_TESTID_RE.test(l.content));
  const addsTestId = addedLines.some((l) => DATA_TESTID_RE.test(l.content));
  return removesTestId && addsTestId;
}

function hasAriaLabelChanges(
  removedLines: Array<{ content: string }>,
  addedLines: Array<{ content: string }>,
): boolean {
  const removesAriaLabel = removedLines.some((l) => ARIA_LABEL_RE.test(l.content));
  const addsAriaLabel = addedLines.some((l) => ARIA_LABEL_RE.test(l.content));
  return removesAriaLabel && addsAriaLabel;
}

function hasTestQueryChanges(
  removedLines: Array<{ content: string }>,
  addedLines: Array<{ content: string }>,
): boolean {
  const allQueryREs = [GET_BY_TESTID_RE, GET_BY_ROLE_RE, GET_BY_LABEL_RE, CY_GET_RE];
  const removesQueries = removedLines.some((l) =>
    allQueryREs.some((re) => re.test(l.content)),
  );
  const addsQueries = addedLines.some((l) =>
    allQueryREs.some((re) => re.test(l.content)),
  );
  return removesQueries && addsQueries;
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
  _goldenAST?: ASTRepresentation,
  _migrationAST?: ASTRepresentation,
): DetectionResult {
  // Check if golden diff involves test selector changes
  if (!hasTestSelectorChanges(goldenDiff.removedLines, goldenDiff.addedLines)) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No test selector changes in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  // Categorize what golden changes
  const goldenHasTestIdChanges = hasTestIdChanges(goldenDiff.removedLines, goldenDiff.addedLines);
  const goldenHasAriaLabelChanges = hasAriaLabelChanges(goldenDiff.removedLines, goldenDiff.addedLines);
  const goldenHasCSSChanges =
    hasPF5CSSSelectors(goldenDiff.removedLines) && hasPF6CSSSelectors(goldenDiff.addedLines);
  const goldenHasQueryChanges = hasTestQueryChanges(goldenDiff.removedLines, goldenDiff.addedLines);

  // Check migration for matching changes
  const migHasTestIdChanges = hasTestIdChanges(migrationDiff.removedLines, migrationDiff.addedLines);
  const migHasAriaLabelChanges = hasAriaLabelChanges(migrationDiff.removedLines, migrationDiff.addedLines);
  const migHasCSSChanges =
    hasPF5CSSSelectors(migrationDiff.removedLines) && hasPF6CSSSelectors(migrationDiff.addedLines);
  const migHasQueryChanges = hasTestQueryChanges(migrationDiff.removedLines, migrationDiff.addedLines);

  // Check for PF5 selectors still present in migration added lines (re-added = partial)
  const migStillAddsPF5 = hasPF5CSSSelectors(migrationDiff.addedLines);

  // Track what's missing from migration
  const missingChanges: string[] = [];
  let matchedCount = 0;
  let expectedCount = 0;

  if (goldenHasTestIdChanges) {
    expectedCount++;
    if (migHasTestIdChanges) {
      matchedCount++;
    } else {
      missingChanges.push('data-testid updates not found in migration');
    }
  }

  if (goldenHasAriaLabelChanges) {
    expectedCount++;
    if (migHasAriaLabelChanges) {
      matchedCount++;
    } else {
      missingChanges.push('aria-label updates not found in migration');
    }
  }

  if (goldenHasCSSChanges) {
    expectedCount++;
    if (migHasCSSChanges) {
      matchedCount++;
    } else {
      missingChanges.push('PF5 CSS selector updates (pf-v5-c-* -> pf-v6-c-*) not found in migration');
    }
  }

  if (goldenHasQueryChanges) {
    expectedCount++;
    if (migHasQueryChanges) {
      matchedCount++;
    } else {
      missingChanges.push('Test query function updates not found in migration');
    }
  }

  // If migration still adds PF5 selectors (and golden moved to PF6)
  if (goldenHasCSSChanges && migStillAddsPF5 && !migHasCSSChanges) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Test selectors partially updated - PF5 CSS selectors still present',
      details: ['Migration adds pf-v5-c-* selectors instead of pf-v6-c-*', ...missingChanges],
    };
  }

  if (matchedCount === expectedCount) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'Test selectors correctly updated',
    };
  }

  if (matchedCount > 0) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.INCORRECT,
      message: 'Test selectors partially updated',
      details: missingChanges,
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'Test selector updates not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Test Selector Rewrite',
  complexity: 'complex',
  weight: 3,
  description:
    'Detects test selector updates (data-testid, aria-label, CSS selectors) from PF5 to PF6',
  detect,
};

registerPattern(pattern);

export { pattern };
