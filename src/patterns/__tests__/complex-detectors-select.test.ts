import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff, ASTRepresentation } from '../../types.js';

// Import detector to trigger registration
import '../select-rewrite.js';

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

describe('Select Rewrite Detector', () => {
  let detect: typeof import('../select-rewrite.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../select-rewrite.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no Select changes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns NOT_APPLICABLE when Select is present but no API changes', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Select aria-label="Old">' }],
      addedLines: [{ lineNumber: 1, content: '<Select aria-label="New">' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen} selections={selected}>' },
        { lineNumber: 2, content: '  <SelectOption value="opt1">Option 1</SelectOption>' },
        { lineNumber: 3, content: '</Select>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(toggleRef) => <MenuToggle ref={toggleRef}>Select</MenuToggle>}>' },
        { lineNumber: 2, content: '  <SelectList><SelectOption value="opt1">Option 1</SelectOption></SelectList>' },
        { lineNumber: 3, content: '</Select>' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns CORRECT when migration rewrites Select from PF5 to PF6 API', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen} selections={selected} placeholderText="Choose...">' },
        { lineNumber: 2, content: '  <SelectOption value="opt1">Option 1</SelectOption>' },
        { lineNumber: 3, content: '</Select>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(toggleRef) => <MenuToggle ref={toggleRef}>Choose...</MenuToggle>}>' },
        { lineNumber: 2, content: '  <SelectList>' },
        { lineNumber: 3, content: '    <SelectOption value="opt1">Option 1</SelectOption>' },
        { lineNumber: 4, content: '  </SelectList>' },
        { lineNumber: 5, content: '</Select>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen} selections={selected} placeholderText="Choose...">' },
        { lineNumber: 2, content: '  <SelectOption value="opt1">Option 1</SelectOption>' },
        { lineNumber: 3, content: '</Select>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(toggleRef) => <MenuToggle ref={toggleRef}>Choose...</MenuToggle>}>' },
        { lineNumber: 2, content: '  <SelectList>' },
        { lineNumber: 3, content: '    <SelectOption value="opt1">Option 1</SelectOption>' },
        { lineNumber: 4, content: '  </SelectList>' },
        { lineNumber: 5, content: '</Select>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration adds MenuToggle without explicitly removing old props', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '  onToggle={handleToggle}' },
        { lineNumber: 2, content: '  isOpen={isOpen}' },
      ],
      addedLines: [
        { lineNumber: 1, content: '  toggle={(toggleRef) => <MenuToggle ref={toggleRef}>Select</MenuToggle>}' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '  toggle={(toggleRef) => <MenuToggle ref={toggleRef}>Select</MenuToggle>}' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration uses SelectList', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={fn} selections={sel}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select>' },
        { lineNumber: 2, content: '  <SelectList>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={fn} selections={sel}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select>' },
        { lineNumber: 2, content: '  <SelectList>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration uses onOpenChange', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select onOpenChange={setIsOpen}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select onOpenChange={setIsOpen}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration has no Select changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(ref) => <MenuToggle ref={ref}>Pick</MenuToggle>}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when migration still uses PF5 onToggle prop', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(ref) => <MenuToggle ref={ref}>Pick</MenuToggle>}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('onToggle prop still used (PF5 API)');
    expect(result.details).toContain('isOpen prop still used (PF5 API)');
  });

  it('returns INCORRECT when migration re-adds placeholderText and selections props', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select selections={selected} placeholderText="Pick one">' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(ref) => <MenuToggle ref={ref}>Pick one</MenuToggle>}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: '<Select selections={selected} placeholderText="Pick one">' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('selections prop still used (PF5 API)');
    expect(result.details).toContain('placeholderText prop still used (PF5 API)');
  });

  it('returns INCORRECT when old API removed but new API not added', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(ref) => <MenuToggle ref={ref}>Pick</MenuToggle>}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={onToggle} isOpen={isOpen}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toContain('Old Select props removed but MenuToggle/SelectList not introduced');
  });

  it('returns INCORRECT when SelectVariant enum is still used', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { Select, SelectOption, SelectVariant } from '@patternfly/react-core';" },
        { lineNumber: 2, content: '<Select variant={SelectVariant.typeahead} onToggle={fn}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { Select, SelectOption, SelectList } from '@patternfly/react-core';" },
        { lineNumber: 2, content: '<Select toggle={(ref) => <MenuToggle ref={ref}>Pick</MenuToggle>}>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [
        { lineNumber: 1, content: "import { Select, SelectOption, SelectVariant } from '@patternfly/react-core';" },
        { lineNumber: 2, content: '<Select variant={SelectVariant.typeahead} onToggle={fn}>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  // ── AST-based tests ──────────────────────────────────────────────────────

  it('returns CORRECT with AST when migration Select uses PF6 pattern', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={fn} isOpen={open}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(ref) => <MenuToggle ref={ref}>Select</MenuToggle>}>' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        {
          tagName: 'Select',
          props: [{ name: 'onToggle' }, { name: 'isOpen' }],
          children: ['SelectOption'],
        },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        {
          tagName: 'Select',
          props: [{ name: 'toggle' }, { name: 'onSelect' }],
          children: ['SelectList'],
        },
        {
          tagName: 'MenuToggle',
          props: [{ name: 'ref' }],
          children: [],
        },
        {
          tagName: 'SelectList',
          props: [],
          children: ['SelectOption'],
        },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns INCORRECT with AST when migration Select still has PF5 props', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select onToggle={fn} isOpen={open}>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select toggle={(ref) => <MenuToggle ref={ref}>Select</MenuToggle>}>' },
      ],
    });

    const migration = makeDiff();

    const goldenAST = makeAST({
      jsxComponents: [
        {
          tagName: 'Select',
          props: [{ name: 'onToggle' }, { name: 'isOpen' }, { name: 'selections' }],
          children: [],
        },
      ],
    });

    const migrationAST = makeAST({
      jsxComponents: [
        {
          tagName: 'Select',
          props: [{ name: 'onToggle' }, { name: 'isOpen' }, { name: 'selections' }],
          children: [],
        },
      ],
    });

    const result = detect(golden, migration, goldenAST, migrationAST);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toBeDefined();
    expect(result.details![0]).toContain('PF5 Select props still present');
  });

  it('returns NOT_APPLICABLE with AST when golden has no Select', () => {
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

  it('handles realistic PF5 Select with variant and SelectVariant', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { Select, SelectOption, SelectVariant } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '  <Select' },
        { lineNumber: 6, content: '    variant={SelectVariant.single}' },
        { lineNumber: 7, content: '    onToggle={onToggle}' },
        { lineNumber: 8, content: '    onSelect={onSelect}' },
        { lineNumber: 9, content: '    selections={selected}' },
        { lineNumber: 10, content: '    isOpen={isOpen}' },
        { lineNumber: 11, content: '  >' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { Select, SelectOption, SelectList, MenuToggle } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '  <Select' },
        { lineNumber: 6, content: '    onSelect={onSelect}' },
        { lineNumber: 7, content: '    onOpenChange={setIsOpen}' },
        { lineNumber: 8, content: '    toggle={(toggleRef) => <MenuToggle ref={toggleRef}>{selected || "Select"}</MenuToggle>}' },
        { lineNumber: 9, content: '  >' },
        { lineNumber: 10, content: '    <SelectList>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "import { Select, SelectOption, SelectVariant } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '  <Select' },
        { lineNumber: 6, content: '    variant={SelectVariant.single}' },
        { lineNumber: 7, content: '    onToggle={onToggle}' },
        { lineNumber: 8, content: '    onSelect={onSelect}' },
        { lineNumber: 9, content: '    selections={selected}' },
        { lineNumber: 10, content: '    isOpen={isOpen}' },
        { lineNumber: 11, content: '  >' },
      ],
      addedLines: [
        { lineNumber: 1, content: "import { Select, SelectOption, SelectList, MenuToggle } from '@patternfly/react-core';" },
        { lineNumber: 5, content: '  <Select' },
        { lineNumber: 6, content: '    onSelect={onSelect}' },
        { lineNumber: 7, content: '    onOpenChange={setIsOpen}' },
        { lineNumber: 8, content: '    toggle={(toggleRef) => <MenuToggle ref={toggleRef}>{selected || "Select"}</MenuToggle>}' },
        { lineNumber: 9, content: '  >' },
        { lineNumber: 10, content: '    <SelectList>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('does not match SelectOption or SelectGroup as Select', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<SelectOption value="old">Old Option</SelectOption>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<SelectOption value="new">New Option</SelectOption>' },
      ],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });
});

describe('Select Rewrite Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../select-rewrite.js');
    expect(pattern.id).toBe('select-rewrite');
    expect(pattern.complexity).toBe('complex');
    expect(pattern.weight).toBe(3);
  });
});
