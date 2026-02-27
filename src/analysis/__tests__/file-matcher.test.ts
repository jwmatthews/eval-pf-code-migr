import { describe, it, expect } from 'vitest';
import { matchFiles } from '../file-matcher.js';
import type { FileDiff } from '../../types.js';

function makeDiff(filePath: string, overrides?: Partial<FileDiff>): FileDiff {
  return {
    filePath,
    addedLines: [],
    removedLines: [],
    hunks: [],
    isBinary: false,
    isRenamed: false,
    ...overrides,
  };
}

describe('matchFiles', () => {
  it('matches files with identical paths', () => {
    const golden = [makeDiff('src/App.tsx'), makeDiff('src/index.ts')];
    const migration = [makeDiff('src/App.tsx'), makeDiff('src/index.ts')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(2);
    expect(result.missedFiles).toHaveLength(0);
    expect(result.extraFiles).toHaveLength(0);
    expect(result.matched[0].golden.filePath).toBe('src/App.tsx');
    expect(result.matched[0].migration.filePath).toBe('src/App.tsx');
  });

  it('identifies missed files (in golden but not migration)', () => {
    const golden = [makeDiff('src/App.tsx'), makeDiff('src/utils.ts')];
    const migration = [makeDiff('src/App.tsx')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(1);
    expect(result.missedFiles).toHaveLength(1);
    expect(result.missedFiles[0].filePath).toBe('src/utils.ts');
    expect(result.extraFiles).toHaveLength(0);
  });

  it('identifies extra files (in migration but not golden)', () => {
    const golden = [makeDiff('src/App.tsx')];
    const migration = [makeDiff('src/App.tsx'), makeDiff('src/extra.ts')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(1);
    expect(result.extraFiles).toHaveLength(1);
    expect(result.extraFiles[0].filePath).toBe('src/extra.ts');
    expect(result.missedFiles).toHaveLength(0);
  });

  it('handles both missed and extra files', () => {
    const golden = [makeDiff('src/A.tsx'), makeDiff('src/B.tsx')];
    const migration = [makeDiff('src/A.tsx'), makeDiff('src/C.tsx')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].golden.filePath).toBe('src/A.tsx');
    expect(result.missedFiles).toHaveLength(1);
    expect(result.missedFiles[0].filePath).toBe('src/B.tsx');
    expect(result.extraFiles).toHaveLength(1);
    expect(result.extraFiles[0].filePath).toBe('src/C.tsx');
  });

  it('excludes .snap snapshot files from matching', () => {
    const golden = [makeDiff('src/App.tsx'), makeDiff('src/__snapshots__/App.test.tsx.snap')];
    const migration = [makeDiff('src/App.tsx')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(1);
    expect(result.missedFiles).toHaveLength(0);
    expect(result.extraFiles).toHaveLength(0);
  });

  it('excludes lockfiles from matching', () => {
    const golden = [makeDiff('src/App.tsx'), makeDiff('package-lock.json')];
    const migration = [makeDiff('src/App.tsx'), makeDiff('yarn.lock'), makeDiff('pnpm-lock.yaml')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(1);
    expect(result.missedFiles).toHaveLength(0);
    expect(result.extraFiles).toHaveLength(0);
  });

  it('normalizes a/ and b/ prefixes for matching', () => {
    const golden = [makeDiff('a/src/App.tsx')];
    const migration = [makeDiff('b/src/App.tsx')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(1);
    expect(result.missedFiles).toHaveLength(0);
    expect(result.extraFiles).toHaveLength(0);
  });

  it('normalizes backslashes to forward slashes', () => {
    const golden = [makeDiff('src\\components\\App.tsx')];
    const migration = [makeDiff('src/components/App.tsx')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(1);
    expect(result.missedFiles).toHaveLength(0);
    expect(result.extraFiles).toHaveLength(0);
  });

  it('returns empty results for empty inputs', () => {
    const result = matchFiles([], []);

    expect(result.matched).toHaveLength(0);
    expect(result.missedFiles).toHaveLength(0);
    expect(result.extraFiles).toHaveLength(0);
  });

  it('handles golden-only input with no migration files', () => {
    const golden = [makeDiff('src/App.tsx'), makeDiff('src/utils.ts')];
    const result = matchFiles(golden, []);

    expect(result.matched).toHaveLength(0);
    expect(result.missedFiles).toHaveLength(2);
    expect(result.extraFiles).toHaveLength(0);
  });

  it('excludes snapshot files from both golden and migration', () => {
    const golden = [makeDiff('src/__snapshots__/foo.snap')];
    const migration = [makeDiff('src/__snapshots__/bar.snap')];

    const result = matchFiles(golden, migration);

    expect(result.matched).toHaveLength(0);
    expect(result.missedFiles).toHaveLength(0);
    expect(result.extraFiles).toHaveLength(0);
  });
});
