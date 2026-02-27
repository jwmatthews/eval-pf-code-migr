import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeJsonReport } from '../json-reporter.js';
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

describe('json-reporter', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'json-reporter-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes a JSON file to the output directory', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const stats = await stat(filePath);
    expect(stats.isFile()).toBe(true);
  });

  it('generates a timestamped filename', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    expect(filePath).toContain('eval-report_2026-02-27_12-00-00-000Z.json');
  });

  it('writes valid JSON with 2-space indentation', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toEqual(report);

    // Check 2-space indentation
    const lines = content.split('\n');
    const indentedLine = lines.find(l => l.startsWith('  "'));
    expect(indentedLine).toBeDefined();
    // Should NOT use 4-space indentation
    expect(lines[1]).toMatch(/^ {2}"/);
  });

  it('includes metadata section', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.metadata).toEqual({
      timestamp: '2026-02-27T12:00:00.000Z',
      goldenSource: 'https://github.com/org/repo/pull/1',
      migrationSource: 'https://github.com/org/repo/pull/2',
    });
  });

  it('includes summary section with all score components', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.summary).toEqual({
      overallScore: 85.5,
      fileCoverage: 90.0,
      patternScore: 82.3,
      noisePenalty: 5.0,
    });
  });

  it('includes per-file breakdown', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.fileResults).toHaveLength(1);
    expect(parsed.fileResults[0].filePath).toBe('src/components/App.tsx');
    expect(parsed.fileResults[0].detections).toHaveLength(1);
    expect(parsed.fileResults[0].detections[0].patternId).toBe('css-class-prefix');
  });

  it('includes per-pattern breakdown', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.patternBreakdown).toHaveLength(2);
    expect(parsed.patternBreakdown[0].status).toBe(DetectionStatus.CORRECT);
    expect(parsed.patternBreakdown[1].status).toBe(DetectionStatus.MISSING);
    expect(parsed.patternBreakdown[1].details).toEqual(['Expected PF6 Select API usage']);
  });

  it('includes noise instances', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.noiseInstances).toHaveLength(1);
    expect(parsed.noiseInstances[0].type).toBe('artifact');
    expect(parsed.noiseInstances[0].file).toBe('src/utils/helper.ts');
    expect(parsed.noiseInstances[0].line).toBe(42);
    expect(parsed.noiseInstances[0].penalty).toBe(0.05);
  });

  it('creates the output directory if it does not exist', async () => {
    const nestedDir = join(tempDir, 'nested', 'output');
    const report = makeReport();
    const filePath = await writeJsonReport(report, nestedDir);

    const stats = await stat(filePath);
    expect(stats.isFile()).toBe(true);
    expect(filePath).toContain('nested/output/eval-report_');
  });

  it('handles empty results', async () => {
    const report = makeReport({
      fileResults: [],
      patternBreakdown: [],
      noiseInstances: [],
    });
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.fileResults).toEqual([]);
    expect(parsed.patternBreakdown).toEqual([]);
    expect(parsed.noiseInstances).toEqual([]);
  });

  it('file ends with a newline', async () => {
    const report = makeReport();
    const filePath = await writeJsonReport(report, tempDir);

    const content = await readFile(filePath, 'utf-8');
    expect(content.endsWith('\n')).toBe(true);
  });
});
