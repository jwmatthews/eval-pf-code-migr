import { describe, it, expect, beforeEach } from 'vitest';
import { clearPatterns } from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { FileDiff } from '../../types.js';

// Import detectors to trigger registration
import '../ouia-component-id.js';
import '../chips-to-labels.js';
import '../split-button-items.js';
import '../modal-import-path.js';

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

describe('OUIA Component ID Detector', () => {
  let detect: typeof import('../ouia-component-id.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../ouia-component-id.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no data-ouia-component-id in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button id="myBtn" />' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames data-ouia-component-id to ouiaId', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button data-ouia-component-id="submit-btn" />' }],
      addedLines: [{ lineNumber: 1, content: '<Button ouiaId="submit-btn" />' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button data-ouia-component-id="submit-btn" />' }],
      addedLines: [{ lineNumber: 1, content: '<Button ouiaId="submit-btn" />' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename data-ouia-component-id', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button data-ouia-component-id="submit-btn" />' }],
      addedLines: [{ lineNumber: 1, content: '<Button ouiaId="submit-btn" />' }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button data-ouia-component-id="submit-btn" />' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when data-ouia-component-id removed but ouiaId not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button data-ouia-component-id="submit-btn" />' }],
      addedLines: [{ lineNumber: 1, content: '<Button ouiaId="submit-btn" />' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Button data-ouia-component-id="submit-btn" />' }],
      addedLines: [{ lineNumber: 1, content: '<Button />' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('Chips to Labels Detector', () => {
  let detect: typeof import('../chips-to-labels.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../chips-to-labels.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no chips in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Select onToggle={toggle} />' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames chips to labels', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'chips={selectedChips}' }],
      addedLines: [{ lineNumber: 1, content: 'labels={selectedLabels}' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'chips={selectedChips}' }],
      addedLines: [{ lineNumber: 1, content: 'labels={selectedLabels}' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT when migration renames deleteChip to deleteLabel', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'deleteChip={handleDelete}' }],
      addedLines: [{ lineNumber: 1, content: 'deleteLabel={handleDelete}' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'deleteChip={handleDelete}' }],
      addedLines: [{ lineNumber: 1, content: 'deleteLabel={handleDelete}' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename chips', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'chips={selectedChips}' }],
      addedLines: [{ lineNumber: 1, content: 'labels={selectedLabels}' }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'chips={selectedChips}' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when chips removed but labels not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'chips={selectedChips}' }],
      addedLines: [{ lineNumber: 1, content: 'labels={selectedLabels}' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'chips={selectedChips}' }],
      addedLines: [{ lineNumber: 1, content: 'items={selectedItems}' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('SplitButton Items Detector', () => {
  let detect: typeof import('../split-button-items.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../split-button-items.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no splitButtonOptions in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: '<Dropdown toggle={toggle} />' }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration renames splitButtonOptions to splitButtonItems', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'splitButtonOptions={{ variant: "action" }}' }],
      addedLines: [{ lineNumber: 1, content: 'splitButtonItems={[<DropdownItem />]}' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'splitButtonOptions={{ variant: "action" }}' }],
      addedLines: [{ lineNumber: 1, content: 'splitButtonItems={[<DropdownItem />]}' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not rename splitButtonOptions', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'splitButtonOptions={{ variant: "action" }}' }],
      addedLines: [{ lineNumber: 1, content: 'splitButtonItems={[<DropdownItem />]}' }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'splitButtonOptions={{ variant: "action" }}' }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when splitButtonOptions removed but splitButtonItems not added', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'splitButtonOptions={{ variant: "action" }}' }],
      addedLines: [{ lineNumber: 1, content: 'splitButtonItems={[<DropdownItem />]}' }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: 'splitButtonOptions={{ variant: "action" }}' }],
      addedLines: [{ lineNumber: 1, content: 'items={[<DropdownItem />]}' }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('Modal Import Path Detector', () => {
  let detect: typeof import('../modal-import-path.js').pattern.detect;

  beforeEach(async () => {
    clearPatterns();
    const mod = await import('../modal-import-path.js');
    detect = mod.pattern.detect;
  });

  it('returns NOT_APPLICABLE when no Modal import change in golden diff', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Button } from '@patternfly/react-core';" }],
    });

    const result = detect(golden, makeDiff());
    expect(result.status).toBe(DetectionStatus.NOT_APPLICABLE);
  });

  it('returns CORRECT when migration moves Modal to deprecated import path', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core/deprecated';" }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core/deprecated';" }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns CORRECT with ModalVariant import', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal, ModalVariant } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';" }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal, ModalVariant } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';" }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.CORRECT);
  });

  it('returns MISSING when migration does not change Modal import path', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core/deprecated';" }],
    });

    const migration = makeDiff();

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.MISSING);
  });

  it('returns FILE_MISSING when migration diff is null', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core';" }],
    });

    const result = detect(golden, null);
    expect(result.status).toBe(DetectionStatus.FILE_MISSING);
  });

  it('returns INCORRECT when Modal removed from main but not added to deprecated', () => {
    const golden = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core/deprecated';" }],
    });

    const migration = makeDiff({
      removedLines: [{ lineNumber: 1, content: "import { Modal } from '@patternfly/react-core';" }],
      addedLines: [{ lineNumber: 1, content: "import { Button } from '@patternfly/react-core';" }],
    });

    const result = detect(golden, migration);
    expect(result.status).toBe(DetectionStatus.INCORRECT);
  });
});

describe('Batch 3 Detector Registration', () => {
  beforeEach(() => {
    clearPatterns();
  });

  it('all 4 detectors have correct metadata', async () => {
    const { pattern: p1 } = await import('../ouia-component-id.js');
    const { pattern: p2 } = await import('../chips-to-labels.js');
    const { pattern: p3 } = await import('../split-button-items.js');
    const { pattern: p4 } = await import('../modal-import-path.js');

    expect(p1.id).toBe('ouia-component-id');
    expect(p1.complexity).toBe('trivial');
    expect(p1.weight).toBe(1);

    expect(p2.id).toBe('chips-to-labels');
    expect(p2.complexity).toBe('trivial');
    expect(p2.weight).toBe(1);

    expect(p3.id).toBe('split-button-items');
    expect(p3.complexity).toBe('trivial');
    expect(p3.weight).toBe(1);

    expect(p4.id).toBe('modal-import-path');
    expect(p4.complexity).toBe('trivial');
    expect(p4.weight).toBe(1);
  });
});
