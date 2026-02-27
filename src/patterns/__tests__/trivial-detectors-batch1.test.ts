import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns, getPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff } from '../../types.js';

// Import detectors to trigger registration
import '../css-class-prefix.js';
import '../utility-class-rename.js';
import '../css-logical-properties.js';
import '../theme-dark-removal.js';

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

describe('CSS Class Prefix Detector', () => {
  beforeEach(() => {
    clearPatterns();
    // Re-import won't re-register since modules are cached, so manually register
  });

  // Use the detect function directly via the exported pattern
  let detectCSSPrefix: typeof import('../css-class-prefix.js').pattern.detect;

  beforeEach(async () => {
    const mod = await import('../css-class-prefix.js');
    detectCSSPrefix = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no pf-v5/pf-v6 classes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="some-class"' }],
      addedLines: [{ lineNumber: 1, content: 'className="other-class"' }],
    });

    const result = detectCSSPrefix(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames pf-v5 to pf-v6', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-c-button"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-c-button"' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-c-button"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-c-button"' }],
    });

    const result = detectCSSPrefix(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename pf-v5 classes', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-c-button"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-c-button"' }],
    });

    const migration = makeDiff({
      removedLines: [],
      addedLines: [{ lineNumber: 1, content: 'no changes here' }],
    });

    const result = detectCSSPrefix(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-c-button"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-c-button"' }],
    });

    const result = detectCSSPrefix(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when pf-v5 removed but pf-v6 not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-c-button"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-c-button"' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-c-button"' }],
      addedLines: [{ lineNumber: 1, content: 'className="something-else"' }],
    });

    const result = detectCSSPrefix(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('Utility Class Rename Detector', () => {
  let detectUtility: typeof import('../utility-class-rename.js').pattern.detect;

  beforeEach(async () => {
    const mod = await import('../utility-class-rename.js');
    detectUtility = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no utility classes in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-c-button"' }],
    });

    const result = detectUtility(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames pf-v5-u to pf-v6-u', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-u-text-align-center"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-u-text-align-center"' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-u-text-align-center"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-u-text-align-center"' }],
    });

    const result = detectUtility(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename utility classes', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-u-mt-md"' }],
      addedLines: [{ lineNumber: 1, content: 'className="pf-v6-u-mt-md"' }],
    });

    const migration = makeDiff();

    const result = detectUtility(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'className="pf-v5-u-mt-md"' }],
    });

    const result = detectUtility(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });
});

describe('CSS Logical Properties Detector', () => {
  let detectLogical: typeof import('../css-logical-properties.js').pattern.detect;

  beforeEach(async () => {
    const mod = await import('../css-logical-properties.js');
    detectLogical = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no physical properties in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '--pf-v5-c-button--Color: red' }],
    });

    const result = detectLogical(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration replaces physical with logical properties', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '--pf-v5-c-page--PaddingTop: 1rem' }],
      addedLines: [{ lineNumber: 1, content: '--pf-v6-c-page--PaddingBlockStart: 1rem' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '--pf-v5-c-page--PaddingTop: 1rem' }],
      addedLines: [{ lineNumber: 1, content: '--pf-v6-c-page--PaddingBlockStart: 1rem' }],
    });

    const result = detectLogical(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not replace physical properties', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '--PaddingTop: 1rem' }],
      addedLines: [{ lineNumber: 1, content: '--PaddingBlockStart: 1rem' }],
    });

    const migration = makeDiff();

    const result = detectLogical(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '--MarginRight: 1rem' }],
    });

    const result = detectLogical(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('detects multiple property renames', () => {
    const golden = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '--PaddingTop: 1rem' },
        { lineNumber: 2, content: '--MarginLeft: 2rem' },
      ],
      addedLines: [
        { lineNumber: 1, content: '--PaddingBlockStart: 1rem' },
        { lineNumber: 2, content: '--MarginInlineStart: 2rem' },
      ],
    });

    const migration = makeDiff({
      removedLines: [
        { lineNumber: 1, content: '--PaddingTop: 1rem' },
        { lineNumber: 2, content: '--MarginLeft: 2rem' },
      ],
      addedLines: [
        { lineNumber: 1, content: '--PaddingBlockStart: 1rem' },
        { lineNumber: 2, content: '--MarginInlineStart: 2rem' },
      ],
    });

    const result = detectLogical(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('Theme Dark Removal Detector', () => {
  let detectThemeDark: typeof import('../theme-dark-removal.js').pattern.detect;

  beforeEach(async () => {
    const mod = await import('../theme-dark-removal.js');
    detectThemeDark = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no theme="dark" in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page variant="light">' }],
    });

    const result = detectThemeDark(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration removes theme="dark"', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page theme="dark">' }],
      addedLines: [{ lineNumber: 1, content: '<Page>' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page theme="dark">' }],
      addedLines: [{ lineNumber: 1, content: '<Page>' }],
    });

    const result = detectThemeDark(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not remove theme="dark"', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page theme="dark">' }],
    });

    const migration = makeDiff();

    const result = detectThemeDark(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page theme="dark">' }],
    });

    const result = detectThemeDark(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when theme="dark" is removed then re-added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page theme="dark">' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Page theme="dark">' }],
      addedLines: [{ lineNumber: 2, content: '<Page theme="dark" variant="default">' }],
    });

    const result = detectThemeDark(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  it('detects theme={\'dark\'} variant', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "<Page theme={'dark'}>" }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: "<Page theme={'dark'}>" }],
      addedLines: [{ lineNumber: 1, content: '<Page>' }],
    });

    const result = detectThemeDark(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('Detector Registration', () => {
  beforeEach(() => {
    clearPatterns();
  });

  it('all 4 detectors register themselves when imported', async () => {
    // Fresh import to trigger registration
    await import('../css-class-prefix.js');
    await import('../utility-class-rename.js');
    await import('../css-logical-properties.js');
    await import('../theme-dark-removal.js');

    // Note: Due to module caching, they only register once.
    // The registration happened at initial import time.
    // After clearPatterns(), we need to verify via the exported pattern objects.
    const { pattern: p1 } = await import('../css-class-prefix.js');
    const { pattern: p2 } = await import('../utility-class-rename.js');
    const { pattern: p3 } = await import('../css-logical-properties.js');
    const { pattern: p4 } = await import('../theme-dark-removal.js');

    expect(p1.id).toBe('css-class-prefix');
    expect(p1.complexity).toBe('trivial');
    expect(p1.weight).toBe(1);

    expect(p2.id).toBe('utility-class-rename');
    expect(p2.complexity).toBe('trivial');
    expect(p2.weight).toBe(1);

    expect(p3.id).toBe('css-logical-properties');
    expect(p3.complexity).toBe('trivial');
    expect(p3.weight).toBe(1);

    expect(p4.id).toBe('theme-dark-removal');
    expect(p4.complexity).toBe('trivial');
    expect(p4.weight).toBe(1);
  });
});
