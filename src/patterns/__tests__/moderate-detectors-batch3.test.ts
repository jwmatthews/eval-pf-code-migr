import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff, ASTRepresentation } from '../../types.js';

// Import detectors to trigger registration
import '../page-masthead.js';
import '../react-tokens-icon-status.js';
import '../avatar-adoption.js';

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

// ── Page Masthead ───────────────────────────────────────────────────────

describe('Page Masthead Detector', () => {
  let detect: typeof import('../page-masthead.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../page-masthead.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no header/masthead changes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page>Content</Page>' }],
      addedLines: [{ lineNumber: 1, content: '<Page>Content</Page>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration replaces header with masthead prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader logo={logo} />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page masthead={<Masthead />}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader logo={logo} />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page masthead={<Masthead />}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration replaces PageHeader with Masthead component', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageHeader headerTools={tools}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Masthead>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<PageHeader headerTools={tools}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Masthead>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page masthead={<Masthead />}>' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no header/masthead changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page masthead={<Masthead />}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when header removed but masthead not added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page masthead={<Masthead />}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('header prop removed but masthead prop not added');
  });

  it('returns INCORRECT when old PageHeader is re-added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page masthead={<Masthead />}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader />}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Page header={<PageHeader />}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Old PageHeader/header prop re-added in migration');
  });

  it('detects golden with only Masthead additions', () => {
    const golden = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<Masthead>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<Masthead>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('does not match MastheadContent, MastheadBrand, etc.', () => {
    const golden = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<MastheadContent>stuff</MastheadContent>' },
      ],
    });

    // MastheadContent should not trigger the detector since it's not the Masthead component itself
    // and no old header patterns are present
    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });
});

describe('Page Masthead Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../page-masthead.js');
    expect(pattern.id).toBe('page-masthead');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});

// ── React Tokens/Icon/Status ────────────────────────────────────────────

describe('React Tokens/Icon/Status Detector', () => {
  let detect: typeof import('../react-tokens-icon-status.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../react-tokens-icon-status.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no token/icon changes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Button } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Button } from '@patternfly/react-core';" }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration updates react-tokens import paths', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { t_color_background } from '@patternfly/react-tokens/dist/esm/t_color_background';" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { t_color_background } from '@patternfly/react-tokens/dist/esm/t_color_background';" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration updates icon import paths', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import CheckCircleIcon from '@patternfly/react-icons/dist/esm/icons/CheckCircleIcon';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { CheckCircleIcon } from '@patternfly/react-icons';" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import CheckCircleIcon from '@patternfly/react-icons/dist/esm/icons/CheckCircleIcon';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { CheckCircleIcon } from '@patternfly/react-icons';" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration updates global_ token references', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: 'const color = global_BackgroundColor_100.value;' },
      ],
      addedLines: [
        { lineNumber: 1, content: 'const color = t_color_background.value;' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: 'const color = global_BackgroundColor_100.value;' },
      ],
      addedLines: [
        { lineNumber: 1, content: 'const color = t_color_background.value;' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_Color } from '@patternfly/react-tokens';" },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no token/icon changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { t_color_background } from '@patternfly/react-tokens/dist/esm/t_color_background';" },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when old imports removed but new ones not added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { t_color_background } from '@patternfly/react-tokens/dist/esm/t_color_background';" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
      addedLines: [
        { lineNumber: 1, content: '// removed token import' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Old import paths removed but new import paths not added');
  });

  it('returns INCORRECT when old import paths are re-added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { t_color_background } from '@patternfly/react-tokens/dist/esm/t_color_background';" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { global_BackgroundColor_100 } from '@patternfly/react-tokens';" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Old react-tokens/icon import paths re-added in migration');
  });

  it('detects dist/js icon import paths as old pattern', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import TimesIcon from '@patternfly/react-icons/dist/js/icons/TimesIcon';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { TimesIcon } from '@patternfly/react-icons';" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import TimesIcon from '@patternfly/react-icons/dist/js/icons/TimesIcon';" },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { TimesIcon } from '@patternfly/react-icons';" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('React Tokens/Icon/Status Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../react-tokens-icon-status.js');
    expect(pattern.id).toBe('react-tokens-icon-status');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});

// ── Avatar Adoption ─────────────────────────────────────────────────────

describe('Avatar Adoption Detector', () => {
  let detect: typeof import('../avatar-adoption.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../avatar-adoption.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no Avatar changes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration has matching Avatar changes (diff-based)', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" isBordered />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" isBordered />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration adds Avatar size prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" size="lg" />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" size="lg" />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" isBordered />' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns MISSING when migration has no Avatar changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" isBordered />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when migration Avatar is missing isBordered prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" isBordered />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Missing isBordered prop on Avatar');
  });

  it('returns INCORRECT when migration Avatar is missing size prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} size="md" />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Missing size prop on Avatar');
  });

  it('returns CORRECT with AST when migration Avatar has isBordered prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} alt="user" isBordered />' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'Avatar', props: [{ name: 'src' }, { name: 'alt' }, { name: 'isBordered' }], children: [] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'Avatar', props: [{ name: 'src' }, { name: 'alt' }, { name: 'isBordered' }], children: [] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns INCORRECT with AST when migration Avatar is missing PF6 props', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={imgSrc} isBordered />' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        { tagName: 'Avatar', props: [{ name: 'src' }, { name: 'isBordered' }], children: [] },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        { tagName: 'Avatar', props: [{ name: 'src' }], children: [] },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  it('returns CORRECT when golden Avatar only has basic changes (no PF6 props)', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={oldSrc} alt="old" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={newSrc} alt="new" />' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Avatar src={oldSrc} alt="old" />' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Avatar src={newSrc} alt="new" />' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('Avatar Adoption Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../avatar-adoption.js');
    expect(pattern.id).toBe('avatar-adoption');
    expect(pattern.complexity).toBe('moderate');
    expect(pattern.weight).toBe(2);
  });
});
