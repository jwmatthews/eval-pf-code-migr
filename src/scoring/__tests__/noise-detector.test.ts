import { describe, it, expect } from 'vitest';
import { detectNoise, NoiseDetectorInput } from '../noise-detector.js';
import { DetectionResult, DetectionStatus, DiffLine, FileDiff, MatchResult } from '../../types.js';

function makeDiff(filePath: string, added: DiffLine[] = [], removed: DiffLine[] = []): FileDiff {
  return {
    filePath,
    addedLines: added,
    removedLines: removed,
    hunks: [],
    isBinary: false,
    isRenamed: false,
  };
}

function makeLine(lineNumber: number, content: string): DiffLine {
  return { lineNumber, content };
}

function makeMatchResult(
  matched: Array<{ golden: FileDiff; migration: FileDiff }> = [],
  missedFiles: FileDiff[] = [],
  extraFiles: FileDiff[] = [],
): MatchResult {
  return { matched, missedFiles, extraFiles };
}

function makeDetectionResult(
  patternId: string,
  status: DetectionStatus,
  message = 'test',
): DetectionResult {
  return { patternId, status, message };
}

describe('detectNoise', () => {
  it('returns empty array when there is no noise', () => {
    const input: NoiseDetectorInput = {
      matchResult: makeMatchResult(),
      migrationDiffs: [],
      detectionResults: [],
    };
    expect(detectNoise(input)).toEqual([]);
  });

  describe('unnecessary changes', () => {
    it('penalizes extra files not in golden at 0.01 per file', () => {
      const extra1 = makeDiff('extra1.ts');
      const extra2 = makeDiff('extra2.ts');
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult([], [], [extra1, extra2]),
        migrationDiffs: [],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const unnecessary = results.filter(r => r.type === 'unnecessary_change');
      expect(unnecessary).toHaveLength(2);
      expect(unnecessary[0].file).toBe('extra1.ts');
      expect(unnecessary[0].penalty).toBe(0.01);
      expect(unnecessary[1].file).toBe('extra2.ts');
      expect(unnecessary[1].penalty).toBe(0.01);
    });
  });

  describe('formatting-only changes', () => {
    it('penalizes files with only whitespace changes at 0.02 per file', () => {
      const migDiff = makeDiff(
        'app.ts',
        [makeLine(1, '  const x = 1;')],
        [makeLine(1, 'const x = 1;')],
      );
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult([
          { golden: makeDiff('app.ts'), migration: migDiff },
        ]),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const formatting = results.filter(r => r.type === 'formatting_only');
      expect(formatting).toHaveLength(1);
      expect(formatting[0].file).toBe('app.ts');
      expect(formatting[0].penalty).toBe(0.02);
    });

    it('does not flag files with semantic changes', () => {
      const migDiff = makeDiff(
        'app.ts',
        [makeLine(1, 'const y = 2;')],
        [makeLine(1, 'const x = 1;')],
      );
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult([
          { golden: makeDiff('app.ts'), migration: migDiff },
        ]),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const formatting = results.filter(r => r.type === 'formatting_only');
      expect(formatting).toHaveLength(0);
    });

    it('does not flag files that are not in matched set', () => {
      const migDiff = makeDiff(
        'unmatched.ts',
        [makeLine(1, '  const x = 1;')],
        [makeLine(1, 'const x = 1;')],
      );
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const formatting = results.filter(r => r.type === 'formatting_only');
      expect(formatting).toHaveLength(0);
    });
  });

  describe('incorrect migrations', () => {
    it('penalizes INCORRECT detection results at 0.03 per instance', () => {
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [],
        detectionResults: [
          makeDetectionResult('select-rewrite', DetectionStatus.INCORRECT, 'Old API still present'),
          makeDetectionResult('css-prefix', DetectionStatus.INCORRECT, 'Mixed v5/v6 classes'),
        ],
      };
      const results = detectNoise(input);
      const incorrect = results.filter(r => r.type === 'incorrect_migration');
      expect(incorrect).toHaveLength(2);
      expect(incorrect[0].penalty).toBe(0.03);
      expect(incorrect[1].penalty).toBe(0.03);
    });

    it('does not flag CORRECT, MISSING, or NOT_APPLICABLE results', () => {
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [],
        detectionResults: [
          makeDetectionResult('p1', DetectionStatus.CORRECT),
          makeDetectionResult('p2', DetectionStatus.MISSING),
          makeDetectionResult('p3', DetectionStatus.NOT_APPLICABLE),
          makeDetectionResult('p4', DetectionStatus.FILE_MISSING),
        ],
      };
      const results = detectNoise(input);
      const incorrect = results.filter(r => r.type === 'incorrect_migration');
      expect(incorrect).toHaveLength(0);
    });
  });

  describe('artifacts', () => {
    it('detects console.log in added lines at 0.05 per instance', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(10, '  console.log("debug");'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const artifacts = results.filter(r => r.type === 'artifact');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].penalty).toBe(0.05);
      expect(artifacts[0].line).toBe(10);
    });

    it('detects console.debug in added lines', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(5, '  console.debug("info");'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const artifacts = results.filter(r => r.type === 'artifact');
      expect(artifacts).toHaveLength(1);
    });

    it('detects TODO comments in added lines', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(3, '  // TODO fix this later'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const artifacts = results.filter(r => r.type === 'artifact');
      expect(artifacts).toHaveLength(1);
    });

    it('detects @ts-ignore in added lines', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(7, '  // @ts-ignore'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const artifacts = results.filter(r => r.type === 'artifact');
      expect(artifacts).toHaveLength(1);
    });

    it('detects debugger statement in added lines', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(2, '  debugger;'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const artifacts = results.filter(r => r.type === 'artifact');
      expect(artifacts).toHaveLength(1);
    });

    it('only counts one penalty per line even with multiple artifact patterns', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(1, '  console.log("test"); // TODO remove'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const artifacts = results.filter(r => r.type === 'artifact');
      expect(artifacts).toHaveLength(1);
    });
  });

  describe('placeholder tokens', () => {
    it('detects t_temp_dev_tbd at 0.05 per instance', () => {
      const migDiff = makeDiff('comp.tsx', [
        makeLine(15, '  const title = t_temp_dev_tbd;'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(placeholders).toHaveLength(1);
      expect(placeholders[0].penalty).toBe(0.05);
      expect(placeholders[0].file).toBe('comp.tsx');
      expect(placeholders[0].line).toBe(15);
    });

    it('detects TEMP_PLACEHOLDER', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(1, '  const val = TEMP_PLACEHOLDER;'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(placeholders).toHaveLength(1);
    });

    it('detects PLACEHOLDER', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(1, '  return "PLACEHOLDER";'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(placeholders).toHaveLength(1);
    });

    it('detects FIXME tokens', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(1, '  const x = "FIXME value";'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(placeholders).toHaveLength(1);
    });

    it('detects HACK tokens', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(1, '  // HACK workaround'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(placeholders).toHaveLength(1);
    });

    it('detects XXX tokens', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(1, '  // XXX needs review'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(placeholders).toHaveLength(1);
    });

    it('only counts one penalty per line even with multiple placeholder patterns', () => {
      const migDiff = makeDiff('app.ts', [
        makeLine(1, '  const x = FIXME; // XXX'),
      ]);
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: [migDiff],
        detectionResults: [],
      };
      const results = detectNoise(input);
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(placeholders).toHaveLength(1);
    });
  });

  describe('combined noise', () => {
    it('detects multiple noise types in a single evaluation', () => {
      const extraFile = makeDiff('extra.ts');
      const migDiff = makeDiff('component.tsx', [
        makeLine(1, '  console.log("debug");'),
        makeLine(5, '  const title = t_temp_dev_tbd;'),
      ]);
      const formattingDiff = makeDiff('style.ts',
        [makeLine(1, '  const x = 1;')],
        [makeLine(1, 'const x = 1;')],
      );

      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(
          [{ golden: makeDiff('style.ts'), migration: formattingDiff }],
          [],
          [extraFile],
        ),
        migrationDiffs: [migDiff, formattingDiff],
        detectionResults: [
          makeDetectionResult('p1', DetectionStatus.INCORRECT, 'bad migration'),
        ],
      };

      const results = detectNoise(input);
      expect(results.filter(r => r.type === 'unnecessary_change')).toHaveLength(1);
      expect(results.filter(r => r.type === 'formatting_only')).toHaveLength(1);
      expect(results.filter(r => r.type === 'incorrect_migration')).toHaveLength(1);
      expect(results.filter(r => r.type === 'artifact')).toHaveLength(1);
      expect(results.filter(r => r.type === 'placeholder_token')).toHaveLength(1);
      expect(results).toHaveLength(5);
    });

    it('accumulates penalties across multiple files', () => {
      const diffs = Array.from({ length: 10 }, (_, i) =>
        makeDiff(`file${i}.ts`, [
          makeLine(1, `  console.log("debug ${i}");`),
          makeLine(2, `  const val = t_temp_dev_tbd;`),
        ]),
      );
      const input: NoiseDetectorInput = {
        matchResult: makeMatchResult(),
        migrationDiffs: diffs,
        detectionResults: [],
      };
      const results = detectNoise(input);
      // 10 artifacts + 10 placeholders = 20 instances at 0.05 each = 1.0 total
      const artifacts = results.filter(r => r.type === 'artifact');
      const placeholders = results.filter(r => r.type === 'placeholder_token');
      expect(artifacts).toHaveLength(10);
      expect(placeholders).toHaveLength(10);
      const totalPenalty = results.reduce((sum, r) => sum + r.penalty, 0);
      expect(totalPenalty).toBeCloseTo(1.0);
    });
  });
});
