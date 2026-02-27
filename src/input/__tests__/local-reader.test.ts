import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateGitRepo, readLocalDiff, readFileContents } from '../local-reader.js';

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const mockExecFile = vi.mocked(execFile);
const mockAccess = vi.mocked(access);
const mockReadFile = vi.mocked(readFile);

function mockExecFileResult(stdout: string, stderr = '') {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
    // Handle overloaded signatures: callback may be 3rd or 4th arg
    const cb = typeof _opts === 'function' ? _opts : callback;
    cb(null, stdout, stderr);
    return {} as any;
  });
}

function mockExecFileError(error: Error) {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
    const cb = typeof _opts === 'function' ? _opts : callback;
    cb(error, '', '');
    return {} as any;
  });
}

/**
 * Helper: sets up sequential mock responses for execFile.
 * Each entry is either { stdout, stderr } or { error }.
 */
function mockExecFileSequence(
  responses: Array<{ stdout: string; stderr?: string } | { error: Error }>,
) {
  let callCount = 0;
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
    const cb = typeof _opts === 'function' ? _opts : callback;
    const resp = responses[callCount] ?? responses[responses.length - 1];
    callCount++;
    if ('error' in resp) {
      cb(resp.error, '', '');
    } else {
      cb(null, resp.stdout, resp.stderr ?? '');
    }
    return {} as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // By default, access succeeds (directory exists)
  mockAccess.mockResolvedValue(undefined);
});

describe('validateGitRepo', () => {
  it('succeeds for a valid git repository', async () => {
    mockExecFileResult('.git');
    await expect(validateGitRepo('/some/repo')).resolves.toBeUndefined();
  });

  it('throws when directory does not exist', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    await expect(validateGitRepo('/nonexistent')).rejects.toThrow(
      'Directory does not exist: "/nonexistent"',
    );
  });

  it('throws when directory is not a git repo', async () => {
    mockExecFileError(new Error('fatal: not a git repository'));
    await expect(validateGitRepo('/not-a-repo')).rejects.toThrow(
      'Directory is not a git repository: "/not-a-repo"',
    );
  });
});

describe('readLocalDiff', () => {
  const sampleDiff = `diff --git a/src/App.tsx b/src/App.tsx
index abc1234..def5678 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,3 +1,3 @@
 import React from 'react';
-import { Button } from '@patternfly/react-core';
+import { Button } from '@patternfly/react-core/dist/esm/components/Button';
`;

  it('reads and parses a diff from a local git repo', async () => {
    // Sequence: git rev-parse (validate), symbolic-ref (default branch), merge-base, git diff
    mockExecFileSequence([
      { stdout: '.git' },                          // git rev-parse --git-dir
      { stdout: 'refs/remotes/origin/main\n' },    // git symbolic-ref
      { stdout: 'abc123\n' },                      // git merge-base
      { stdout: sampleDiff },                      // git diff
    ]);

    const result = await readLocalDiff('/some/repo');

    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/App.tsx');
    expect(result[0].addedLines).toHaveLength(1);
    expect(result[0].removedLines).toHaveLength(1);
  });

  it('returns empty array when there is no diff', async () => {
    mockExecFileSequence([
      { stdout: '.git' },
      { stdout: 'refs/remotes/origin/main\n' },
      { stdout: 'abc123\n' },
      { stdout: '' },
    ]);

    const result = await readLocalDiff('/some/repo');
    expect(result).toEqual([]);
  });

  it('falls back to main/master when symbolic-ref fails', async () => {
    mockExecFileSequence([
      { stdout: '.git' },                         // git rev-parse --git-dir
      { error: new Error('fatal: ref not found') }, // symbolic-ref fails
      { stdout: 'abc123\n' },                     // rev-parse --verify main succeeds
      { stdout: 'def456\n' },                     // merge-base
      { stdout: sampleDiff },                     // git diff
    ]);

    const result = await readLocalDiff('/some/repo');
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/App.tsx');
  });

  it('throws when directory does not exist', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    await expect(readLocalDiff('/nonexistent')).rejects.toThrow(
      'Directory does not exist',
    );
  });

  it('throws when directory is not a git repo', async () => {
    mockExecFileError(new Error('fatal: not a git repository'));

    await expect(readLocalDiff('/not-a-repo')).rejects.toThrow(
      'Directory is not a git repository',
    );
  });

  it('throws when no default branch is found', async () => {
    mockExecFileSequence([
      { stdout: '.git' },                          // git rev-parse --git-dir
      { error: new Error('fatal: ref not found') }, // symbolic-ref fails
      { error: new Error('fatal: bad revision') },  // rev-parse main fails
      { error: new Error('fatal: bad revision') },  // rev-parse master fails
    ]);

    await expect(readLocalDiff('/some/repo')).rejects.toThrow(
      'Could not determine default branch',
    );
  });

  it('parses multi-file diffs', async () => {
    const multiDiff = `diff --git a/src/App.tsx b/src/App.tsx
index abc..def 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,2 +1,2 @@
-old line
+new line
diff --git a/src/index.ts b/src/index.ts
index 111..222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 export { App } from './App';
+export { About } from './About';
`;

    mockExecFileSequence([
      { stdout: '.git' },
      { stdout: 'refs/remotes/origin/main\n' },
      { stdout: 'abc123\n' },
      { stdout: multiDiff },
    ]);

    const result = await readLocalDiff('/some/repo');
    expect(result).toHaveLength(2);
    expect(result[0].filePath).toBe('src/App.tsx');
    expect(result[1].filePath).toBe('src/index.ts');
  });
});

describe('readFileContents', () => {
  it('reads file contents from disk', async () => {
    mockReadFile.mockImplementation((path: any) => {
      if (path.endsWith('App.tsx')) {
        return Promise.resolve('import React from "react";') as any;
      }
      if (path.endsWith('index.ts')) {
        return Promise.resolve('export { App } from "./App";') as any;
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const contents = await readFileContents('/repo', [
      'src/App.tsx',
      'src/index.ts',
    ]);

    expect(contents.size).toBe(2);
    expect(contents.get('src/App.tsx')).toBe('import React from "react";');
    expect(contents.get('src/index.ts')).toBe('export { App } from "./App";');
  });

  it('skips files that cannot be read', async () => {
    mockReadFile.mockImplementation((path: any) => {
      if (path.endsWith('App.tsx')) {
        return Promise.resolve('content') as any;
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const contents = await readFileContents('/repo', [
      'src/App.tsx',
      'src/missing.ts',
    ]);

    expect(contents.size).toBe(1);
    expect(contents.has('src/App.tsx')).toBe(true);
    expect(contents.has('src/missing.ts')).toBe(false);
  });

  it('returns empty map for empty file list', async () => {
    const contents = await readFileContents('/repo', []);
    expect(contents.size).toBe(0);
  });
});
