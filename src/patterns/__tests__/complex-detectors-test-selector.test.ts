import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff } from '../../types.js';

// Import detector to trigger registration
import '../test-selector-rewrite.js';

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

describe('Test Selector Rewrite Detector', () => {
  let detect: typeof import('../test-selector-rewrite.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../test-selector-rewrite.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no test selector changes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button>Click</Button>' }],
      addedLines: [{ lineNumber: 1, content: '<Button variant="primary">Click</Button>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns NOT_APPLICABLE when selectors only added but not removed', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<div>old</div>' }],
      addedLines: [{ lineNumber: 1, content: '<div data-testid="new-id">new</div>' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<div data-testid="old-select">content</div>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<div data-testid="new-select">content</div>' },
      ],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns CORRECT when data-testid changes match', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<div data-testid="pf5-select-toggle">Toggle</div>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<div data-testid="pf6-menu-toggle">Toggle</div>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<div data-testid="pf5-select-toggle">Toggle</div>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<div data-testid="pf6-menu-toggle">Toggle</div>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when aria-label changes match', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<button aria-label="Toggle dropdown">Toggle</button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<button aria-label="Toggle menu">Toggle</button>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<button aria-label="Toggle dropdown">Toggle</button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<button aria-label="Toggle menu">Toggle</button>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when PF5 CSS selectors updated to PF6', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v5-c-select__toggle').click();" },
      ],
      addedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v6-c-menu-toggle').click();" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v5-c-select__toggle').click();" },
      ],
      addedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v6-c-menu-toggle').click();" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when test query functions are updated', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: 'screen.getByTestId("old-component-id");' },
      ],
      addedLines: [
        { lineNumber: 1, content: 'screen.getByTestId("new-component-id");' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: 'screen.getByTestId("old-component-id");' },
      ],
      addedLines: [
        { lineNumber: 1, content: 'screen.getByTestId("new-component-id");' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration has no selector changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<div data-testid="old-id">content</div>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<div data-testid="new-id">content</div>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: '// unrelated change' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns INCORRECT when migration still uses PF5 CSS selectors', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v5-c-select__toggle').click();" },
      ],
      addedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v6-c-menu-toggle').click();" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v5-c-button').click();" },
      ],
      addedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v5-c-select__toggle').click();" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toBeDefined();
    expect(result.details!.some((d) => d.includes('pf-v5-c-'))).toBe(true);
  });

  it('returns INCORRECT when only some selector categories updated', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<div data-testid="old-id">content</div>' },
        { lineNumber: 2, content: '<button aria-label="Old Label">btn</button>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<div data-testid="new-id">content</div>' },
        { lineNumber: 2, content: '<button aria-label="New Label">btn</button>' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<div data-testid="old-id">content</div>' },
      ],
      addedLines: [
        { lineNumber: 1, content: '<div data-testid="new-id">content</div>' },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
    expect(result.details).toBeDefined();
    expect(result.details!.some((d) => d.includes('aria-label'))).toBe(true);
  });

  it('returns CORRECT for realistic test file migration with getByRole', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 5, content: "const toggle = screen.getByRole('button', { name: 'Options menu' });" },
        { lineNumber: 10, content: "expect(screen.getByTestId('select-expanded')).toBeInTheDocument();" },
      ],
      addedLines: [
        { lineNumber: 5, content: "const toggle = screen.getByRole('button', { name: 'Menu toggle' });" },
        { lineNumber: 10, content: "expect(screen.getByTestId('menu-toggle-expanded')).toBeInTheDocument();" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 5, content: "const toggle = screen.getByRole('button', { name: 'Options menu' });" },
        { lineNumber: 10, content: "expect(screen.getByTestId('select-expanded')).toBeInTheDocument();" },
      ],
      addedLines: [
        { lineNumber: 5, content: "const toggle = screen.getByRole('button', { name: 'Menu toggle' });" },
        { lineNumber: 10, content: "expect(screen.getByTestId('menu-toggle-expanded')).toBeInTheDocument();" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT for Cypress test selector migration', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v5-c-dropdown__toggle').click();" },
        { lineNumber: 2, content: "cy.get('[data-testid=\"dropdown-item-1\"]').should('be.visible');" },
      ],
      addedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v6-c-menu-toggle').click();" },
        { lineNumber: 2, content: "cy.get('[data-testid=\"menu-item-1\"]').should('be.visible');" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v5-c-dropdown__toggle').click();" },
        { lineNumber: 2, content: "cy.get('[data-testid=\"dropdown-item-1\"]').should('be.visible');" },
      ],
      addedLines: [
        { lineNumber: 1, content: "cy.get('.pf-v6-c-menu-toggle').click();" },
        { lineNumber: 2, content: "cy.get('[data-testid=\"menu-item-1\"]').should('be.visible');" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT for queryByLabelText migration', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "screen.queryByLabelText('Close')" },
      ],
      addedLines: [
        { lineNumber: 1, content: "screen.queryByLabelText('Dismiss')" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: "screen.queryByLabelText('Close')" },
      ],
      addedLines: [
        { lineNumber: 1, content: "screen.queryByLabelText('Dismiss')" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT for combined data-testid and CSS selector changes', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select data-testid="source-select">' },
        { lineNumber: 5, content: "wrapper.find('.pf-v5-c-select__toggle-text');" },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select data-testid="source-menu-select">' },
        { lineNumber: 5, content: "wrapper.find('.pf-v6-c-menu-toggle__text');" },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '<Select data-testid="source-select">' },
        { lineNumber: 5, content: "wrapper.find('.pf-v5-c-select__toggle-text');" },
      ],
      addedLines: [
        { lineNumber: 1, content: '<Select data-testid="source-menu-select">' },
        { lineNumber: 5, content: "wrapper.find('.pf-v6-c-menu-toggle__text');" },
      ],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('Test Selector Rewrite Registration', () => {
  it('has correct metadata', async () => {
    const { pattern } = await import('../test-selector-rewrite.js');
    expect(pattern.id).toBe('test-selector-rewrite');
    expect(pattern.complexity).toBe('complex');
    expect(pattern.weight).toBe(3);
  });
});
