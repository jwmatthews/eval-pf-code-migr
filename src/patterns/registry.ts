import type { PatternDefinition } from '../types.js';

const patterns: PatternDefinition[] = [];

export function registerPattern(pattern: PatternDefinition): void {
  patterns.push(pattern);
}

export function getPatterns(): PatternDefinition[] {
  return [...patterns];
}

export function getPatternsByComplexity(
  complexity: 'trivial' | 'moderate' | 'complex',
): PatternDefinition[] {
  return patterns.filter((p) => p.complexity === complexity);
}

export function clearPatterns(): void {
  patterns.length = 0;
}
