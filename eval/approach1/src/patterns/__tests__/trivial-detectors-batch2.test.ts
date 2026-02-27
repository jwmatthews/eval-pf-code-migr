import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff } from '../../types.js';

// Import detectors to trigger registration
import '../inner-ref-to-ref.js';
import '../align-right-to-end.js';
import '../is-action-cell.js';
import '../space-items-removal.js';

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

describe('InnerRef to Ref Detector', () => {
  let detect: typeof import('../inner-ref-to-ref.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../inner-ref-to-ref.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no innerRef in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Input ref={myRef} />' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames innerRef to ref', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextInput innerRef={inputRef} />' }],
      addedLines: [{ lineNumber: 1, content: '<TextInput ref={inputRef} />' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextInput innerRef={inputRef} />' }],
      addedLines: [{ lineNumber: 1, content: '<TextInput ref={inputRef} />' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename innerRef', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextInput innerRef={inputRef} />' }],
      addedLines: [{ lineNumber: 1, content: '<TextInput ref={inputRef} />' }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextInput innerRef={inputRef} />' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when innerRef removed but ref not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextInput innerRef={inputRef} />' }],
      addedLines: [{ lineNumber: 1, content: '<TextInput ref={inputRef} />' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<TextInput innerRef={inputRef} />' }],
      addedLines: [{ lineNumber: 1, content: '<TextInput />' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('AlignRight to AlignEnd Detector', () => {
  let detect: typeof import('../align-right-to-end.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../align-right-to-end.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no alignRight in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownItem align="left" />' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames alignRight to alignEnd', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight />' }],
      addedLines: [{ lineNumber: 1, content: '<DropdownGroup alignEnd />' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight />' }],
      addedLines: [{ lineNumber: 1, content: '<DropdownGroup alignEnd />' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename alignRight', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight />' }],
      addedLines: [{ lineNumber: 1, content: '<DropdownGroup alignEnd />' }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight />' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when alignRight removed but alignEnd not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight />' }],
      addedLines: [{ lineNumber: 1, content: '<DropdownGroup alignEnd />' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight />' }],
      addedLines: [{ lineNumber: 1, content: '<DropdownGroup />' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });

  it('detects alignRight={true} variant', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight={true} />' }],
      addedLines: [{ lineNumber: 1, content: '<DropdownGroup alignEnd />' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<DropdownGroup alignRight={true} />' }],
      addedLines: [{ lineNumber: 1, content: '<DropdownGroup alignEnd />' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });
});

describe('IsActionCell to HasAction Detector', () => {
  let detect: typeof import('../is-action-cell.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../is-action-cell.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no isActionCell in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Td dataLabel="actions" />' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames isActionCell to hasAction', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Td isActionCell>' }],
      addedLines: [{ lineNumber: 1, content: '<Td hasAction>' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Td isActionCell>' }],
      addedLines: [{ lineNumber: 1, content: '<Td hasAction>' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename isActionCell', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Td isActionCell>' }],
      addedLines: [{ lineNumber: 1, content: '<Td hasAction>' }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Td isActionCell>' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when isActionCell removed but hasAction not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Td isActionCell>' }],
      addedLines: [{ lineNumber: 1, content: '<Td hasAction>' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Td isActionCell>' }],
      addedLines: [{ lineNumber: 1, content: '<Td>' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('SpaceItems Removal Detector', () => {
  let detect: typeof import('../space-items-removal.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../space-items-removal.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no spaceItems in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Flex gap="md" />' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration removes spaceItems', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Flex spaceItems={{ default: "spaceItemsMd" }}>' }],
      addedLines: [{ lineNumber: 1, content: '<Flex>' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Flex spaceItems={{ default: "spaceItemsMd" }}>' }],
      addedLines: [{ lineNumber: 1, content: '<Flex>' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not remove spaceItems', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Flex spaceItems={{ default: "spaceItemsMd" }}>' }],
      addedLines: [{ lineNumber: 1, content: '<Flex>' }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Flex spaceItems={{ default: "sm" }}>' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when spaceItems removed then re-added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Flex spaceItems={{ default: "spaceItemsMd" }}>' }],
      addedLines: [{ lineNumber: 1, content: '<Flex>' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Flex spaceItems={{ default: "spaceItemsMd" }}>' }],
      addedLines: [{ lineNumber: 2, content: '<Flex spaceItems={{ default: "spaceItemsLg" }}>' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('Batch 2 Detector Registration', () => {
  beforeEach(() => {
    clearPatterns();
  });

  it('all 4 detectors have correct metadata', async () => {
    const { pattern: p1 } = await import('../inner-ref-to-ref.js');
    const { pattern: p2 } = await import('../align-right-to-end.js');
    const { pattern: p3 } = await import('../is-action-cell.js');
    const { pattern: p4 } = await import('../space-items-removal.js');

    expect(p1.id).toBe('inner-ref-to-ref');
    expect(p1.complexity).toBe('trivial');
    expect(p1.weight).toBe(1);

    expect(p2.id).toBe('align-right-to-end');
    expect(p2.complexity).toBe('trivial');
    expect(p2.weight).toBe(1);

    expect(p3.id).toBe('is-action-cell');
    expect(p3.complexity).toBe('trivial');
    expect(p3.weight).toBe(1);

    expect(p4.id).toBe('space-items-removal');
    expect(p4.complexity).toBe('trivial');
    expect(p4.weight).toBe(1);
  });
});
