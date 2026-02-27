import { DetectionResult, DetectionStatus, MatchResult, NoiseInstance } from '../types.js';

export interface WeightedDetectionResult {
  result: DetectionResult;
  weight: number;
}

export interface ScoreInput {
  matchResult: MatchResult;
  weightedResults: WeightedDetectionResult[];
  noiseInstances: NoiseInstance[];
}

export interface ScoreBreakdown {
  overallScore: number;
  fileCoverage: number;
  patternScore: number;
  noisePenalty: number;
}

const CREDIT: Partial<Record<DetectionStatus, number>> = {
  [DetectionStatus.CORRECT]: 1.0,
  [DetectionStatus.INCORRECT]: 0.25,
  [DetectionStatus.MISSING]: 0,
  [DetectionStatus.FILE_MISSING]: 0,
};

/**
 * Compute the weighted score for a migration evaluation.
 *
 * FinalScore = (0.20 * FileCoverage) + (0.65 * PatternScore) + (0.15 * (1 - NoisePenalty))
 * Score normalized to 0-100% range.
 */
export function computeScore(input: ScoreInput): ScoreBreakdown {
  const fileCoverage = computeFileCoverage(input.matchResult);
  const patternScore = computePatternScore(input.weightedResults);
  const noisePenalty = computeNoisePenalty(input.noiseInstances);

  const overallScore = (0.20 * fileCoverage) + (0.65 * patternScore) + (0.15 * (1 - noisePenalty));

  return {
    overallScore: round(overallScore * 100),
    fileCoverage: round(fileCoverage * 100),
    patternScore: round(patternScore * 100),
    noisePenalty: round(noisePenalty * 100),
  };
}

/**
 * FileCoverage = matched files / golden files (excluding snapshots and lockfiles).
 * Snapshots and lockfiles are already excluded by the file matcher.
 */
export function computeFileCoverage(matchResult: MatchResult): number {
  const goldenTotal = matchResult.matched.length + matchResult.missedFiles.length;
  if (goldenTotal === 0) return 1.0;
  return matchResult.matched.length / goldenTotal;
}

/**
 * PatternScore = sum(weight * credit) / sum(weight * expected)
 * NOT_APPLICABLE excluded from denominator.
 * CORRECT=1.0, INCORRECT=0.25, MISSING=0, FILE_MISSING=0
 */
export function computePatternScore(results: WeightedDetectionResult[]): number {
  let weightedCredit = 0;
  let weightedExpected = 0;

  for (const { result, weight } of results) {
    if (result.status === DetectionStatus.NOT_APPLICABLE) continue;

    const credit = CREDIT[result.status] ?? 0;
    weightedCredit += weight * credit;
    weightedExpected += weight * 1.0;
  }

  if (weightedExpected === 0) return 1.0;
  return weightedCredit / weightedExpected;
}

/**
 * NoisePenalty = min(1.0, sum of all penalty amounts)
 */
export function computeNoisePenalty(noiseInstances: NoiseInstance[]): number {
  const totalPenalty = noiseInstances.reduce((sum, n) => sum + n.penalty, 0);
  return Math.min(1.0, totalPenalty);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
