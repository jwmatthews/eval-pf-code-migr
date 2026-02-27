import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff, ASTRepresentation } from '../../types.js';

// Import detector to trigger registration
import '../masthead-reorganization.js';

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

describe('Masthead Reorganization Detector', () => {
  let detect: typeof import('../masthead-reorganization.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../masthead-reorganization.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no Masthead sub-components in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns NOT_APPLICABLE when Masthead sub-components only in removed lines', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadToggle>' },
        { lineNumber: 2, content: '</MastheadToggle>' },
      ],
      addedLines: [{ lineNumber: 1, content: '<div>something else</div>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadToggle>' },
        { lineNumber: 2, content: '  <PageToggleButton>' },
        { lineNumber: 3, content: '</MastheadToggle>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadMain>' },
        { lineNumber: 2, content: '  <MastheadToggle>' },
        { lineNumber: 3, content: '    <PageToggleButton>' },
        { lineNumber: 4, content: '  </MastheadToggle>' },
        { lineNumber: 5, content: '</MastheadMain>' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns CORRECT when golden introduces MastheadLogo and migration matches', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <Brand src={logo} alt="Logo" />' },
        { lineNumber: 3, content: '</MastheadBrand>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <MastheadLogo>' },
        { lineNumber: 3, content: '    <Brand src={logo} alt="Logo" />' },
        { lineNumber: 4, content: '  </MastheadLogo>' },
        { lineNumber: 5, content: '</MastheadBrand>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <Brand src={logo} alt="Logo" />' },
        { lineNumber: 3, content: '</MastheadBrand>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <MastheadLogo>' },
        { lineNumber: 3, content: '    <Brand src={logo} alt="Logo" />' },
        { lineNumber: 4, content: '  </MastheadLogo>' },
        { lineNumber: 5, content: '</MastheadBrand>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration restructures sub-components (no MastheadLogo in golden)', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadToggle>' },
        { lineNumber: 2, content: '  <button />' },
        { lineNumber: 3, content: '</MastheadToggle>' },
        { lineNumber: 4, content: '<MastheadMain>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadMain>' },
        { lineNumber: 2, content: '  <MastheadToggle>' },
        { lineNumber: 3, content: '    <button />' },
        { lineNumber: 4, content: '  </MastheadToggle>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadToggle>' },
        { lineNumber: 2, content: '  <button />' },
        { lineNumber: 3, content: '</MastheadToggle>' },
        { lineNumber: 4, content: '<MastheadMain>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadMain>' },
        { lineNumber: 2, content: '  <MastheadToggle>' },
        { lineNumber: 3, content: '    <button />' },
        { lineNumber: 4, content: '  </MastheadToggle>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration has no Masthead restructuring', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadToggle>' },
        { lineNumber: 2, content: '  <PageToggleButton />' },
        { lineNumber: 3, content: '</MastheadToggle>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadMain>' },
        { lineNumber: 2, content: '  <MastheadToggle>' },
        { lineNumber: 3, content: '    <PageToggleButton />' },
        { lineNumber: 4, content: '  </MastheadToggle>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: '// unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when migration restructures but misses MastheadLogo', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <Brand src={logo} />' },
        { lineNumber: 3, content: '</MastheadBrand>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <MastheadLogo>' },
        { lineNumber: 3, content: '    <Brand src={logo} />' },
        { lineNumber: 4, content: '  </MastheadLogo>' },
        { lineNumber: 5, content: '</MastheadBrand>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <Brand src={logo} />' },
        { lineNumber: 3, content: '</MastheadBrand>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <Brand src={logo} />' },
        { lineNumber: 3, content: '</MastheadBrand>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain(
      'MastheadLogo component not introduced (PF6 requires MastheadLogo inside MastheadBrand)',
    );
  });

  it('returns CORRECT for realistic full Masthead restructuring', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { Masthead, MastheadToggle, MastheadMain, MastheadBrand, MastheadContent } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<Masthead>' },
        { lineNumber: 6, content: '  <MastheadToggle>' },
        { lineNumber: 7, content: '    <PageToggleButton variant="plain">' },
        { lineNumber: 8, content: '      <BarsIcon />' },
        { lineNumber: 9, content: '    </PageToggleButton>' },
        { lineNumber: 10, content: '  </MastheadToggle>' },
        { lineNumber: 11, content: '  <MastheadMain>' },
        { lineNumber: 12, content: '    <MastheadBrand>' },
        { lineNumber: 13, content: '      <Brand src={logo} alt="App Logo" />' },
        { lineNumber: 14, content: '    </MastheadBrand>' },
        { lineNumber: 15, content: '  </MastheadMain>' },
        { lineNumber: 16, content: '  <MastheadContent>{headerToolbar}</MastheadContent>' },
        { lineNumber: 17, content: '</Masthead>' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { Masthead, MastheadToggle, MastheadMain, MastheadBrand, MastheadLogo, MastheadContent } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '<Masthead>' },
        { lineNumber: 6, content: '  <MastheadMain>' },
        { lineNumber: 7, content: '    <MastheadToggle>' },
        { lineNumber: 8, content: '      <PageToggleButton variant="plain">' },
        { lineNumber: 9, content: '        <BarsIcon />' },
        { lineNumber: 10, content: '      </PageToggleButton>' },
        { lineNumber: 11, content: '    </MastheadToggle>' },
        { lineNumber: 12, content: '    <MastheadBrand>' },
        { lineNumber: 13, content: '      <MastheadLogo>' },
        { lineNumber: 14, content: '        <Brand src={logo} alt="App Logo" />' },
        { lineNumber: 15, content: '      </MastheadLogo>' },
        { lineNumber: 16, content: '    </MastheadBrand>' },
        { lineNumber: 17, content: '  </MastheadMain>' },
        { lineNumber: 18, content: '  <MastheadContent>{headerToolbar}</MastheadContent>' },
        { lineNumber: 19, content: '</Masthead>' },
      ],
    });

    const migration = makeDiff({
      removedLines: golden.removedLines,
      addedLines: golden.addedLines,
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  // ── AST-based tests ──────────────────────────────────────────────────────

  it('returns CORRECT with AST when migration has MastheadLogo', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <MastheadLogo>' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'MastheadToggle', props: [], children: [] },
        { tagName: 'MastheadMain', props: [], children: ['MastheadBrand'] },
        { tagName: 'MastheadBrand', props: [], children: ['Brand'] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'MastheadMain', props: [], children: ['MastheadToggle', 'MastheadBrand'] },
        { tagName: 'MastheadToggle', props: [], children: [] },
        { tagName: 'MastheadBrand', props: [], children: ['MastheadLogo'] },
        { tagName: 'MastheadLogo', props: [], children: ['Brand'] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns INCORRECT with AST when migration has sub-components but no MastheadLogo', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<MastheadBrand>' },
        { lineNumber: 2, content: '  <MastheadLogo>' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'MastheadToggle', props: [], children: [] },
        { tagName: 'MastheadMain', props: [], children: ['MastheadBrand'] },
        { tagName: 'MastheadBrand', props: [], children: ['Brand'] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'MastheadToggle', props: [], children: [] },
        { tagName: 'MastheadMain', props: [], children: ['MastheadBrand'] },
        { tagName: 'MastheadBrand', props: [], children: ['Brand'] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain(
      'MastheadLogo component not introduced (PF6 requires MastheadLogo inside MastheadBrand)',
    );
  });

  it('returns NOT_APPLICABLE with AST when golden has no Masthead sub-components', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'Button', props: [], children: [] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'Button', props: [], children: [] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('detects MastheadLogo introduction as reorganization signal', () => {
    const golden = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<MastheadLogo>' },
        { lineNumber: 2, content: '  <Brand src={logo} />' },
        { lineNumber: 3, content: '</MastheadLogo>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<MastheadLogo>' },
        { lineNumber: 2, content: '  <Brand src={logo} />' },
        { lineNumber: 3, content: '</MastheadLogo>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('handles MastheadLogo import being added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { MastheadBrand } from '@patternfly/react-core';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { MastheadBrand, MastheadLogo } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '  <MastheadLogo>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { MastheadBrand } from '@patternfly/react-core';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { MastheadBrand, MastheadLogo } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '  <MastheadLogo>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('Masthead Reorganization Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../masthead-reorganization.js');
    expect(pattern.id).toBe('masthead-reorganization');
    expect(pattern.complexity).toBe('complex');
    expect(pattern.weight).toBe(3);
  });
});
