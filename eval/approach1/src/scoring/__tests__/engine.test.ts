import { describe, it, expect } from 'vitest';
import {
  computeScore,
  computeFileCoverage,
  computePatternScore,
  computeNoisePenalty,
  WeightedDetectionResult,
  ScoreInput,
} from '../engine.js';
import { DetectionStatus, FileDiff, MatchResult, NoiseInstance } from '../../types.js';

function makeDiff(filePath: string): FileDiff {
  return { filePath, addedLines: [], removedLines: [], hunks: [], isBinary: false, isRenamed: false };
}

function makeMatchResult(matchedCount: number, missedCount: number): MatchResult {
  const matched = Array.from({ length: matchedCount }, (_, i) => ({
    golden: makeDiff(`file${i}.ts`),
    migration: makeDiff(`file${i}.ts`),
  }));
  const missedFiles = Array.from({ length: missedCount }, (_, i) =>
    makeDiff(`missed${i}.ts`),
  );
  return { matched, missedFiles, extraFiles: [] };
}

function makeWeightedResult(
  status: DetectionStatus,
  weight: number,
  patternId = 'test-pattern',
): WeightedDetectionResult {
  return {
    result: { patternId, status, message: `${status} detection` },
    weight,
  };
}

describe('computeFileCoverage', () => {
  it('returns 1.0 when all golden files are matched', () => {
    const match = makeMatchResult(10, 0);
    expect(computeFileCoverage(match)).toBe(1.0);
  });

  it('returns 0 when no golden files are matched', () => {
    const match = makeMatchResult(0, 5);
    expect(computeFileCoverage(match)).toBe(0);
  });

  it('returns proportional coverage', () => {
    const match = makeMatchResult(7, 3);
    expect(computeFileCoverage(match)).toBe(0.7);
  });

  it('returns 1.0 when there are no golden files at all', () => {
    const match = makeMatchResult(0, 0);
    expect(computeFileCoverage(match)).toBe(1.0);
  });

  it('ignores extra files in the denominator', () => {
    const match = makeMatchResult(5, 5);
    match.extraFiles = [makeDiff('extra1.ts'), makeDiff('extra2.ts')];
    expect(computeFileCoverage(match)).toBe(0.5);
  });
});

describe('computePatternScore', () => {
  it('returns 1.0 when all results are CORRECT', () => {
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.CORRECT, 1),
      makeWeightedResult(DetectionStatus.CORRECT, 2),
      makeWeightedResult(DetectionStatus.CORRECT, 3),
    ];
    expect(computePatternScore(results)).toBe(1.0);
  });

  it('returns 0 when all results are MISSING', () => {
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.MISSING, 1),
      makeWeightedResult(DetectionStatus.MISSING, 2),
    ];
    expect(computePatternScore(results)).toBe(0);
  });

  it('returns 0.25 credit for INCORRECT', () => {
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.INCORRECT, 1),
    ];
    expect(computePatternScore(results)).toBe(0.25);
  });

  it('returns 0 for FILE_MISSING', () => {
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.FILE_MISSING, 1),
    ];
    expect(computePatternScore(results)).toBe(0);
  });

  it('excludes NOT_APPLICABLE from denominator', () => {
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.CORRECT, 1),
      makeWeightedResult(DetectionStatus.NOT_APPLICABLE, 3),
    ];
    expect(computePatternScore(results)).toBe(1.0);
  });

  it('returns 1.0 when all results are NOT_APPLICABLE', () => {
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.NOT_APPLICABLE, 1),
      makeWeightedResult(DetectionStatus.NOT_APPLICABLE, 2),
    ];
    expect(computePatternScore(results)).toBe(1.0);
  });

  it('returns 1.0 for empty results', () => {
    expect(computePatternScore([])).toBe(1.0);
  });

  it('applies weights correctly', () => {
    // weight=3 CORRECT (credit 3*1=3), weight=1 MISSING (credit 1*0=0)
    // expected = 3+1 = 4, credit = 3
    // score = 3/4 = 0.75
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.CORRECT, 3),
      makeWeightedResult(DetectionStatus.MISSING, 1),
    ];
    expect(computePatternScore(results)).toBe(0.75);
  });

  it('handles mixed statuses with different weights', () => {
    // weight=2 CORRECT (credit 2), weight=2 INCORRECT (credit 0.5), weight=1 MISSING (credit 0)
    // expected = 2+2+1=5, credit = 2+0.5+0=2.5
    // score = 2.5/5 = 0.5
    const results: WeightedDetectionResult[] = [
      makeWeightedResult(DetectionStatus.CORRECT, 2),
      makeWeightedResult(DetectionStatus.INCORRECT, 2),
      makeWeightedResult(DetectionStatus.MISSING, 1),
    ];
    expect(computePatternScore(results)).toBe(0.5);
  });
});

describe('computeNoisePenalty', () => {
  it('returns 0 for empty noise list', () => {
    expect(computeNoisePenalty([])).toBe(0);
  });

  it('sums penalties', () => {
    const noise: NoiseInstance[] = [
      { type: 'unnecessary_change', file: 'a.ts', description: 'test', penalty: 0.01 },
      { type: 'formatting_only', file: 'b.ts', description: 'test', penalty: 0.02 },
      { type: 'artifact', file: 'c.ts', description: 'test', penalty: 0.05 },
    ];
    expect(computeNoisePenalty(noise)).toBeCloseTo(0.08);
  });

  it('caps at 1.0', () => {
    const noise: NoiseInstance[] = Array.from({ length: 30 }, (_, i) => ({
      type: 'artifact' as const,
      file: `file${i}.ts`,
      description: 'test',
      penalty: 0.05,
    }));
    // 30 * 0.05 = 1.5 -> capped at 1.0
    expect(computeNoisePenalty(noise)).toBe(1.0);
  });
});

describe('computeScore', () => {
  it('perfect migration = 100%', () => {
    const input: ScoreInput = {
      matchResult: makeMatchResult(10, 0),
      weightedResults: [
        makeWeightedResult(DetectionStatus.CORRECT, 1),
        makeWeightedResult(DetectionStatus.CORRECT, 2),
        makeWeightedResult(DetectionStatus.CORRECT, 3),
      ],
      noiseInstances: [],
    };
    const score = computeScore(input);
    expect(score.overallScore).toBe(100);
    expect(score.fileCoverage).toBe(100);
    expect(score.patternScore).toBe(100);
    expect(score.noisePenalty).toBe(0);
  });

  it('empty migration produces low score', () => {
    const input: ScoreInput = {
      matchResult: makeMatchResult(0, 10),
      weightedResults: [
        makeWeightedResult(DetectionStatus.FILE_MISSING, 1),
        makeWeightedResult(DetectionStatus.FILE_MISSING, 2),
        makeWeightedResult(DetectionStatus.FILE_MISSING, 3),
      ],
      noiseInstances: [],
    };
    const score = computeScore(input);
    // fileCoverage=0, patternScore=0, noisePenalty=0
    // overall = 0.20*0 + 0.65*0 + 0.15*(1-0) = 0.15 = 15%
    expect(score.overallScore).toBe(15);
    expect(score.fileCoverage).toBe(0);
    expect(score.patternScore).toBe(0);
    expect(score.noisePenalty).toBe(0);
  });

  it('partial migration scores proportionally', () => {
    const input: ScoreInput = {
      matchResult: makeMatchResult(5, 5), // 50% coverage
      weightedResults: [
        makeWeightedResult(DetectionStatus.CORRECT, 2), // credit: 2
        makeWeightedResult(DetectionStatus.MISSING, 2),  // credit: 0
        // expected: 4, score: 2/4 = 0.5
      ],
      noiseInstances: [
        { type: 'unnecessary_change', file: 'a.ts', description: 'test', penalty: 0.1 },
      ],
    };
    const score = computeScore(input);
    // fileCoverage=0.5, patternScore=0.5, noisePenalty=0.1
    // overall = 0.20*0.5 + 0.65*0.5 + 0.15*(1-0.1) = 0.1 + 0.325 + 0.135 = 0.56
    expect(score.overallScore).toBe(56);
    expect(score.fileCoverage).toBe(50);
    expect(score.patternScore).toBe(50);
    expect(score.noisePenalty).toBe(10);
  });

  it('heavy noise brings down the score', () => {
    const input: ScoreInput = {
      matchResult: makeMatchResult(10, 0),
      weightedResults: [
        makeWeightedResult(DetectionStatus.CORRECT, 1),
      ],
      noiseInstances: Array.from({ length: 25 }, (_, i) => ({
        type: 'artifact' as const,
        file: `file${i}.ts`,
        description: 'test',
        penalty: 0.05,
      })),
    };
    const score = computeScore(input);
    // fileCoverage=1.0, patternScore=1.0, noisePenalty=1.0 (capped)
    // overall = 0.20*1 + 0.65*1 + 0.15*(1-1) = 0.85 = 85%
    expect(score.overallScore).toBe(85);
    expect(score.noisePenalty).toBe(100);
  });

  it('NOT_APPLICABLE patterns do not affect score', () => {
    const input: ScoreInput = {
      matchResult: makeMatchResult(10, 0),
      weightedResults: [
        makeWeightedResult(DetectionStatus.CORRECT, 1),
        makeWeightedResult(DetectionStatus.NOT_APPLICABLE, 3),
        makeWeightedResult(DetectionStatus.NOT_APPLICABLE, 3),
      ],
      noiseInstances: [],
    };
    const score = computeScore(input);
    expect(score.overallScore).toBe(100);
    expect(score.patternScore).toBe(100);
  });

  it('INCORRECT gets partial credit', () => {
    const input: ScoreInput = {
      matchResult: makeMatchResult(10, 0),
      weightedResults: [
        makeWeightedResult(DetectionStatus.INCORRECT, 2),
      ],
      noiseInstances: [],
    };
    const score = computeScore(input);
    // fileCoverage=1.0, patternScore=0.25, noisePenalty=0
    // overall = 0.20*1 + 0.65*0.25 + 0.15*1 = 0.2 + 0.1625 + 0.15 = 0.5125 = 51.25%
    expect(score.overallScore).toBe(51.25);
    expect(score.patternScore).toBe(25);
  });
});
