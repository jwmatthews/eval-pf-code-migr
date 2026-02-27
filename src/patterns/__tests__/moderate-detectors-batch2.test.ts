import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff, ASTRepresentation } from '../../types.js';

// Import detectors to trigger registration
import '../toolbar-gap.js';
import '../button-icon-prop.js';
import '../page-section-variant.js';

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

// ── Toolbar Gap ─────────────────────────────────────────────────────────

describe('Toolbar Gap Detector', () => {
  let detect: typeof import('../toolbar-gap.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../toolbar-gap.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no spacer/gap changes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Toolbar>Content</Toolbar>' }],
      addedLines: [{ lineNumber: 1, content: '<Toolbar>Content</Toolbar>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration replaces spacer with gap', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapNone\' }}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapNone\' }}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration replaces spaceItems with gap', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Toolbar spaceItems={{ default: \'spaceItemsMd\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Toolbar gap={{ default: \'gapMd\' }}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Toolbar spaceItems={{ default: \'spaceItemsMd\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Toolbar gap={{ default: \'gapMd\' }}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration uses columnGap/rowGap', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarGroup spacer={{ default: \'spacerLg\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarGroup columnGap={{ default: \'gapLg\' }}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarGroup spacer={{ default: \'spacerLg\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarGroup columnGap={{ default: \'gapLg\' }}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapNone\' }}>' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no spacer/gap changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapNone\' }}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when spacer removed but gap not added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapNone\' }}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('spacer props removed but gap props not added');
  });

  it('returns INCORRECT when old spacer props are re-added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapNone\' }}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem spacer={{ default: \'spacerNone\' }}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Old spacer props re-added in migration');
  });

  it('detects golden with only gap additions (no spacer removal)', () => {
    const golden = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapSm\' }}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<ToolbarItem gap={{ default: \'gapSm\' }}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('Toolbar Gap Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../toolbar-gap.js');
    expect(pattern.id).toBe('toolbar-gap');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});

// ── Button Icon Prop ────────────────────────────────────────────────────

describe('Button Icon Prop Detector', () => {
  let detect: typeof import('../button-icon-prop.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../button-icon-prop.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no Button icon changes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns NOT_APPLICABLE when no Button at all in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Toolbar>Content</Toolbar>' }],
      addedLines: [{ lineNumber: 1, content: '<Toolbar>Content</Toolbar>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration restructures Button with icon prop (diff-based)', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<TimesIcon />} />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<TimesIcon />} />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration adds icon prop to Button', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><CloseIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<CloseIcon />} />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 5, content: 'some other Button line' },
      ],
      addedLines: [
        { lineNumber: 5, content: '<Button variant="plain" icon={<CloseIcon />} />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<TimesIcon />} />' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no Button icon changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<TimesIcon />} />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when Button has variant="plain" but no icon prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<TimesIcon />} />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  it('returns CORRECT with AST when migration Button has icon prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<TimesIcon />} />' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'Button', props: [{ name: 'variant', value: '"plain"' }], children: ['TimesIcon'] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'Button', props: [{ name: 'variant', value: '"plain"' }, { name: 'icon', value: '{<TimesIcon />}' }], children: [] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns INCORRECT with AST when migration Button still has children for icon', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Button variant="plain"><TimesIcon /></Button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Button variant="plain" icon={<TimesIcon />} />' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'Button', props: [{ name: 'variant', value: '"plain"' }], children: ['TimesIcon'] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'Button', props: [{ name: 'variant', value: '"plain"' }], children: ['TimesIcon'] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('Button Icon Prop Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../button-icon-prop.js');
    expect(pattern.id).toBe('button-icon-prop');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});

// ── PageSection Variant ─────────────────────────────────────────────────

describe('PageSection Variant Detector', () => {
  let detect: typeof import('../page-section-variant.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../page-section-variant.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no PageSection variant changes in golden', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<PageSection>Content</PageSection>' }],
      addedLines: [{ lineNumber: 1, content: '<PageSection>Content</PageSection>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration removes variant="light"', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="light">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="light">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration removes variant="dark"', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="dark">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="dark">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration removes variant="darker"', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="darker">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="darker">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration removes PageSectionVariants enum usage', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { PageSection, PageSectionVariants } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<PageSection variant={PageSectionVariants.light}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { PageSection } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<PageSection>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { PageSection, PageSectionVariants } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<PageSection variant={PageSectionVariants.light}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { PageSection } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<PageSection>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="light">' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no PageSection variant changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="light">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
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
        { lineNumber: 1, content: '<PageSection variant="light">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageSection variant="light">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<PageSection variant="light">' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Old PageSection variant values re-added in migration');
  });

  it('returns INCORRECT when PageSectionVariants import is re-added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { PageSection, PageSectionVariants } from '@patternfly/react-core';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { PageSection } from '@patternfly/react-core';" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { PageSection, PageSectionVariants } from '@patternfly/react-core';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { PageSection, PageSectionVariants } from '@patternfly/react-core';" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('PageSectionVariants import re-added in migration');
  });
});

describe('PageSection Variant Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../page-section-variant.js');
    expect(pattern.id).toBe('page-section-variant');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});
