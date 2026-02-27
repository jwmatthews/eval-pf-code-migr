import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPattern,
  getPatterns,
  getPatternsByComplexity,
  clearPatterns,
} from '../registry.js';
import { DetectionStatus } from '../../types.js';
import type { PatternDefinition } from '../../types.js';

function makePattern(
  overrides: Partial<PatternDefinition> & { id: string },
): PatternDefinition {
  return {
    name: overrides.id,
    complexity: 'trivial',
    weight: 1,
    description: `Test pattern ${overrides.id}`,
    detect: () => ({
      patternId: overrides.id,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'stub',
    }),
    ...overrides,
  };
}

describe('Pattern Registry', () => {
  beforeEach(() => {
    clearPatterns();
  });

  it('starts empty', () => {
    expect(getPatterns()).toEqual([]);
  });

  it('accepts and returns registered patterns', () => {
    const p = makePattern({ id: 'test-1' });
    registerPattern(p);

    const result = getPatterns();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-1');
  });

  it('returns a copy so mutations do not affect the registry', () => {
    registerPattern(makePattern({ id: 'a' }));
    const list = getPatterns();
    list.pop();
    expect(getPatterns()).toHaveLength(1);
  });

  it('registers multiple patterns', () => {
    registerPattern(makePattern({ id: 'a' }));
    registerPattern(makePattern({ id: 'b' }));
    registerPattern(makePattern({ id: 'c' }));

    expect(getPatterns()).toHaveLength(3);
  });

  it('filters by trivial complexity', () => {
    registerPattern(makePattern({ id: 't1', complexity: 'trivial', weight: 1 }));
    registerPattern(makePattern({ id: 'm1', complexity: 'moderate', weight: 2 }));
    registerPattern(makePattern({ id: 'c1', complexity: 'complex', weight: 3 }));

    const trivial = getPatternsByComplexity('trivial');
    expect(trivial).toHaveLength(1);
    expect(trivial[0].id).toBe('t1');
  });

  it('filters by moderate complexity', () => {
    registerPattern(makePattern({ id: 't1', complexity: 'trivial', weight: 1 }));
    registerPattern(makePattern({ id: 'm1', complexity: 'moderate', weight: 2 }));
    registerPattern(makePattern({ id: 'm2', complexity: 'moderate', weight: 2 }));

    const moderate = getPatternsByComplexity('moderate');
    expect(moderate).toHaveLength(2);
    expect(moderate.map((p) => p.id)).toEqual(['m1', 'm2']);
  });

  it('filters by complex complexity', () => {
    registerPattern(makePattern({ id: 't1', complexity: 'trivial', weight: 1 }));
    registerPattern(makePattern({ id: 'c1', complexity: 'complex', weight: 3 }));

    const complex = getPatternsByComplexity('complex');
    expect(complex).toHaveLength(1);
    expect(complex[0].id).toBe('c1');
  });

  it('returns empty array when no patterns match complexity filter', () => {
    registerPattern(makePattern({ id: 't1', complexity: 'trivial', weight: 1 }));

    expect(getPatternsByComplexity('complex')).toEqual([]);
  });

  it('clearPatterns removes all registered patterns', () => {
    registerPattern(makePattern({ id: 'a' }));
    registerPattern(makePattern({ id: 'b' }));
    expect(getPatterns()).toHaveLength(2);

    clearPatterns();
    expect(getPatterns()).toEqual([]);
  });
});
