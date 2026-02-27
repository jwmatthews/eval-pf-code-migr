import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeMarkdownReport, generateMarkdown } from '../markdown-reporter.js';
import { readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { DetectionStatus, EvalReport } from '../../types.js';

function makeReport(overrides?: Partial<EvalReport>): EvalReport {
  return {
    metadata: {
      timestamp: '2026-02-27T12:00:00.000Z',
      goldenSource: 'https://github.com/org/repo/pull/1',
      migrationSource: 'https://github.com/org/repo/pull/2',
    },
    summary: {
      overallScore: 85.5,
      fileCoverage: 90.0,
      patternScore: 82.3,
      noisePenalty: 5.0,
    },
    fileResults: [
      {
        filePath: 'src/components/App.tsx',
        detections: [
          {
            patternId: 'css-class-prefix',
            status: DetectionStatus.CORRECT,
            message: 'CSS class prefix correctly updated',
          },
        ],
        noiseInstances: [],
      },
    ],
    patternBreakdown: [
      {
        patternId: 'css-class-prefix',
        status: DetectionStatus.CORRECT,
        message: 'CSS class prefix correctly updated',
      },
      {
        patternId: 'select-rewrite',
        status: DetectionStatus.MISSING,
        message: 'Select rewrite not detected',
        details: ['Expected PF6 Select API usage'],
      },
    ],
    noiseInstances: [
      {
        type: 'artifact',
        file: 'src/utils/helper.ts',
        line: 42,
        description: 'console.log found in migration',
        penalty: 0.05,
      },
    ],
    ...overrides,
  };
}

describe('markdown-reporter', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'md-reporter-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes a Markdown file to the output directory', async () => {
    const report = makeReport();
    const filePath = await writeMarkdownReport(report, tempDir);

    const stats = await stat(filePath);
    expect(stats.isFile()).toBe(true);
    expect(filePath).toMatch(/\.md$/);
  });

  it('generates a timestamped filename', async () => {
    const report = makeReport();
    const filePath = await writeMarkdownReport(report, tempDir);

    expect(filePath).toContain('eval-report_2026-02-27_12-00-00-000Z.md');
  });

  it('includes Executive Summary with score and grade', () => {
    const report = makeReport();
    const md = generateMarkdown(report);

    expect(md).toContain('## Executive Summary');
    expect(md).toContain('85.5%');
    expect(md).toContain('(B)');
  });

  it('assigns correct letter grades', () => {
    const gradeTests = [
      { score: 95, grade: 'A' },
      { score: 85, grade: 'B' },
      { score: 75, grade: 'C' },
      { score: 65, grade: 'D' },
      { score: 50, grade: 'F' },
    ];

    for (const { score, grade } of gradeTests) {
      const report = makeReport({ summary: { overallScore: score, fileCoverage: 90, patternScore: 80, noisePenalty: 0 } });
      const md = generateMarkdown(report);
      expect(md).toContain(`(${grade})`);
    }
  });

  it('includes File Coverage table', () => {
    const report = makeReport();
    const md = generateMarkdown(report);

    expect(md).toContain('## File Coverage');
    expect(md).toContain('src/components/App.tsx');
    expect(md).toContain('Matched');
  });

  it('includes Pattern Results grouped by complexity', () => {
    const report = makeReport();
    const md = generateMarkdown(report);

    expect(md).toContain('## Pattern Results');
    expect(md).toContain('### Trivial Patterns');
    expect(md).toContain('css-class-prefix');
    expect(md).toContain('### Complex Patterns');
    expect(md).toContain('select-rewrite');
  });

  it('uses status icons for pattern results', () => {
    const report = makeReport();
    const md = generateMarkdown(report);

    // CORRECT gets checkmark
    expect(md).toContain('\u2705 CORRECT');
    // MISSING gets X
    expect(md).toContain('\u274C MISSING');
  });

  it('includes Noise Findings section', () => {
    const report = makeReport();
    const md = generateMarkdown(report);

    expect(md).toContain('## Noise Findings');
    expect(md).toContain('artifact');
    expect(md).toContain('src/utils/helper.ts:42');
    expect(md).toContain('console.log found in migration');
    expect(md).toContain('penalty: 0.05');
  });

  it('shows no noise message when clean', () => {
    const report = makeReport({
      noiseInstances: [],
      summary: { overallScore: 100, fileCoverage: 100, patternScore: 100, noisePenalty: 0 },
    });
    const md = generateMarkdown(report);

    expect(md).toContain('No noise detected.');
  });

  it('includes Recommendations section', () => {
    const report = makeReport();
    const md = generateMarkdown(report);

    expect(md).toContain('## Recommendations');
    expect(md).toContain('missing migration pattern');
    expect(md).toContain('select-rewrite');
    expect(md).toContain('artifact');
  });

  it('shows congrats message when perfect', () => {
    const report = makeReport({
      patternBreakdown: [
        { patternId: 'css-class-prefix', status: DetectionStatus.CORRECT, message: 'OK' },
      ],
      noiseInstances: [],
      summary: { overallScore: 100, fileCoverage: 100, patternScore: 100, noisePenalty: 0 },
    });
    const md = generateMarkdown(report);

    expect(md).toContain('No issues found');
  });

  it('includes metadata (golden and migration sources)', () => {
    const report = makeReport();
    const md = generateMarkdown(report);

    expect(md).toContain('https://github.com/org/repo/pull/1');
    expect(md).toContain('https://github.com/org/repo/pull/2');
  });

  it('handles INCORRECT pattern results', () => {
    const report = makeReport({
      patternBreakdown: [
        { patternId: 'empty-state-restructure', status: DetectionStatus.INCORRECT, message: 'Partial migration detected' },
      ],
    });
    const md = generateMarkdown(report);

    expect(md).toContain('\u26A0\uFE0F INCORRECT');
    expect(md).toContain('Review 1 incorrect migration');
  });

  it('handles FILE_MISSING status', () => {
    const report = makeReport({
      patternBreakdown: [
        { patternId: 'css-class-prefix', status: DetectionStatus.FILE_MISSING, message: 'File not in migration' },
      ],
    });
    const md = generateMarkdown(report);

    expect(md).toContain('FILE_MISSING');
    expect(md).toContain('not included in the migration');
  });

  it('creates the output directory if it does not exist', async () => {
    const nestedDir = join(tempDir, 'nested', 'output');
    const report = makeReport();
    const filePath = await writeMarkdownReport(report, nestedDir);

    const stats = await stat(filePath);
    expect(stats.isFile()).toBe(true);
    expect(filePath).toContain('nested/output/eval-report_');
  });

  it('handles empty results', () => {
    const report = makeReport({
      fileResults: [],
      patternBreakdown: [],
      noiseInstances: [],
    });
    const md = generateMarkdown(report);

    expect(md).toContain('## Executive Summary');
    expect(md).toContain('No noise detected.');
    expect(md).toContain('No issues found');
  });

  it('escapes pipe characters in messages', () => {
    const report = makeReport({
      patternBreakdown: [
        { patternId: 'test-pattern', status: DetectionStatus.CORRECT, message: 'value1 | value2' },
      ],
    });
    const md = generateMarkdown(report);

    // Pipe should be escaped in table cells
    expect(md).toContain('value1 \\| value2');
  });

  it('handles noise instances without line numbers', () => {
    const report = makeReport({
      noiseInstances: [
        { type: 'unnecessary_change', file: 'src/extra.ts', description: 'Extra file', penalty: 0.01 },
      ],
      summary: { overallScore: 90, fileCoverage: 100, patternScore: 90, noisePenalty: 1 },
    });
    const md = generateMarkdown(report);

    // Should show just filename without :lineNumber
    expect(md).toContain('`src/extra.ts`');
    expect(md).not.toContain('src/extra.ts:undefined');
  });
});
