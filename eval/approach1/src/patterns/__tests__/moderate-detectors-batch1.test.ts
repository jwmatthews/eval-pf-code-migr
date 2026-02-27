import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff, ASTRepresentation } from '../../types.js';

// Import detectors to trigger registration
import '../text-content-consolidation.js';
import '../empty-state-restructure.js';
import '../toolbar-variant.js';

function makeDiff(overrides: Partial<FileDiff> = {}): FileDiff {
  return {
    filePath: 'test.tsx',
    addedLines: [],
    removedLines: [],
    hunks: [],
    isBinary: false,
    isRenamed: false,
    ...overrides,
  };
}

function makeAST(overrides: Partial<ASTRepresentation> = {}): ASTRepresentation {
  return {
    imports: [],
    jsxComponents: [],
    filePath: 'test.tsx',
    parseErrors: [],
    ...overrides,
  };
}

// ── Text Content Consolidation ──────────────────────────────────────────

describe('Text Content Consolidation Detector', () => {
  let detect: typeof import('../text-content-consolidation.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../text-content-consolidation.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no Text components in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns NOT_APPLICABLE when Text removed but Content not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextContent>Hello</TextContent>' }],
      addedLines: [{ lineNumber: 1, content: '<div>Hello</div>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration consolidates TextContent to Content', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { TextContent } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<TextContent>Hello</TextContent>' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { Content } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<Content>Hello</Content>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { TextContent } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<TextContent>Hello</TextContent>' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { Content } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<Content>Hello</Content>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration renames Text to Content', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Text component="h3">Title</Text>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Content component="h3">Title</Content>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Text component="h3">Title</Text>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Content component="h3">Title</Content>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration renames TextList and TextListItem', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<TextList>' },
        { lineNumber: 2, content: '<TextListItem>Item A</TextListItem>' },
        { lineNumber: 3, content: '</TextList>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Content component="ul">' },
        { lineNumber: 2, content: '<Content component="li">Item A</Content>' },
        { lineNumber: 3, content: '</Content>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<TextList>' },
        { lineNumber: 2, content: '<TextListItem>Item A</TextListItem>' },
        { lineNumber: 3, content: '</TextList>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Content component="ul">' },
        { lineNumber: 2, content: '<Content component="li">Item A</Content>' },
        { lineNumber: 3, content: '</Content>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration renames TextVariants to ContentVariants', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: 'const foo = TextVariants.h1;' },
      ],
      addedLines: [
        { lineNumber: 1, content: 'const foo = ContentVariants.h1;' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: 'const foo = TextVariants.h1;' },
      ],
      addedLines: [
        { lineNumber: 1, content: 'const foo = ContentVariants.h1;' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextContent>Hello</TextContent>' }],
      addedLines: [{ lineNumber: 1, content: '<Content>Hello</Content>' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no Text changes', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextContent>Hello</TextContent>' }],
      addedLines: [{ lineNumber: 1, content: '<Content>Hello</Content>' }],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'no changes' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when Text removed but Content not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextContent>Hello</TextContent>' }],
      addedLines: [{ lineNumber: 1, content: '<Content>Hello</Content>' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextContent>Hello</TextContent>' }],
      addedLines: [{ lineNumber: 1, content: '<div>Hello</div>' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  it('returns INCORRECT when isVisited not renamed to isVisitedLink', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<TextContent isVisited>Link</TextContent>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Content isVisitedLink>Link</Content>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<TextContent isVisited>Link</TextContent>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Content isVisited>Link</Content>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Missing isVisited -> isVisitedLink rename');
  });
});

describe('Text Content Consolidation Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../text-content-consolidation.js');
    expect(pattern.id).toBe('text-content-consolidation');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});

// ── EmptyState Restructure ──────────────────────────────────────────────

describe('EmptyState Restructure Detector', () => {
  let detect: typeof import('../empty-state-restructure.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../empty-state-restructure.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no EmptyState restructuring in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration restructures EmptyState (diff-based)', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { EmptyState, EmptyStateBody, EmptyStateHeader, EmptyStateIcon } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<EmptyStateHeader titleText="Empty" headingLevel="h4" icon={<EmptyStateIcon icon={CubesIcon} />} />' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { EmptyState, EmptyStateBody } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<EmptyState titleText="Empty" headingLevel="h4" icon={CubesIcon}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { EmptyState, EmptyStateBody, EmptyStateHeader, EmptyStateIcon } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<EmptyStateHeader titleText="Empty" headingLevel="h4" icon={<EmptyStateIcon icon={CubesIcon} />} />' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { EmptyState, EmptyStateBody } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<EmptyState titleText="Empty" headingLevel="h4" icon={CubesIcon}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateHeader titleText="Empty" />' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration does not restructure EmptyState', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateHeader titleText="Empty" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<EmptyState titleText="Empty">' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when EmptyStateHeader still used in migration', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateHeader titleText="Old" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<EmptyState titleText="Old">' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateHeader titleText="Old" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: 'titleText="Old"' },
        { lineNumber: 2, content: '<EmptyStateHeader titleText="New" />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  it('returns CORRECT with AST when EmptyState has titleText prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateHeader titleText="Empty" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<EmptyState titleText="Empty">' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'EmptyStateHeader', props: [{ name: 'titleText', value: '"Empty"' }], children: [] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'EmptyState', props: [{ name: 'titleText', value: '"Empty"' }, { name: 'icon', value: '{CubesIcon}' }], children: [] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns INCORRECT with AST when EmptyStateHeader still exists in migration', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateHeader titleText="Empty" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<EmptyState titleText="Empty">' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'EmptyStateHeader', props: [{ name: 'titleText' }], children: [] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'EmptyState', props: [{ name: 'titleText' }], children: [] },
        { tagName: 'EmptyStateHeader', props: [{ name: 'titleText' }], children: [] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('EmptyStateHeader still used as child component');
  });

  it('detects EmptyStateIcon removal in golden', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateIcon icon={CubesIcon} />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<EmptyState icon={CubesIcon}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<EmptyStateIcon icon={CubesIcon} />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<EmptyState titleText="X" icon={CubesIcon}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('EmptyState Restructure Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../empty-state-restructure.js');
    expect(pattern.id).toBe('empty-state-restructure');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});

// ── Toolbar Variant ─────────────────────────────────────────────────────

describe('Toolbar Variant Detector', () => {
  let detect: typeof import('../toolbar-variant.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../toolbar-variant.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no ToolbarItem variant changes in golden', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<ToolbarItem>Content</ToolbarItem>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames chip-group to label-group', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="chip-group">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="label-group">' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="chip-group">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="label-group">' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration removes bulk-select variant', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="bulk-select" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="bulk-select" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration removes overflow-menu variant', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="overflow-menu">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="overflow-menu">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration removes search-filter variant', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="search-filter">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="search-filter">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="chip-group">' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no variant changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="chip-group">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="label-group">' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when old variant is re-added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="bulk-select">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="bulk-select">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="bulk-select">' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  it('returns INCORRECT when chip-group removed but label-group not added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="chip-group">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="label-group">' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem variant="chip-group">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('Toolbar Variant Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../toolbar-variant.js');
    expect(pattern.id).toBe('toolbar-variant');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});
