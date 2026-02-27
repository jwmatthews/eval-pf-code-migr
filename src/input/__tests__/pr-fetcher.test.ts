import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPRDiff, validateGhCli } from '../pr-fetcher.js';

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

const mockExecFile = vi.mocked(execFile);

/**
 * Helper to make mockExecFile invoke the callback with given result.
 */
function mockExecFileResult(stdout: string, stderr = '') {
  mockExecFile.mockImplementation((_cmd, _args, callback: any) => {
    callback(null, stdout, stderr);
    return {} as any;
  });
}

function mockExecFileError(error: Error) {
  mockExecFile.mockImplementation((_cmd, _args, callback: any) => {
    callback(error, '', '');
    return {} as any;
  });
}

/**
 * Helper that mocks different responses for sequential calls.
 * First call (gh auth status) succeeds, second call (gh pr diff) returns the given stdout.
 */
function mockExecFileSequence(diffOutput: string) {
  let callCount = 0;
  mockExecFile.mockImplementation((_cmd, _args, callback: any) => {
    callCount++;
    if (callCount === 1) {
      // gh auth status - success
      callback(null, '', '');
    } else {
      // gh pr diff - return diff output
      callback(null, diffOutput, '');
    }
    return {} as any;
  });
}

function mockExecFileSequenceWithError(error: Error) {
  let callCount = 0;
  mockExecFile.mockImplementation((_cmd, _args, callback: any) => {
    callCount++;
    if (callCount === 1) {
      // gh auth status - success
      callback(null, '', '');
    } else {
      // gh pr diff - fail
      callback(error, '', '');
    }
    return {} as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateGhCli', () => {
  it('succeeds when gh is installed and authenticated', async () => {
    mockExecFileResult('');
    await expect(validateGhCli()).resolves.toBeUndefined();
    expect(mockExecFile).toHaveBeenCalledWith(
      'gh',
      ['auth', 'status'],
      expect.any(Function),
    );
  });

  it('throws when gh is not installed', async () => {
    const err = new Error('spawn gh ENOENT');
    mockExecFileError(err);
    await expect(validateGhCli()).rejects.toThrow(
      'GitHub CLI (gh) is not installed',
    );
  });

  it('throws when gh is not authenticated', async () => {
    const err = new Error('You are not logged into any GitHub hosts');
    mockExecFileError(err);
    await expect(validateGhCli()).rejects.toThrow(
      'GitHub CLI (gh) is not authenticated',
    );
  });
});

describe('fetchPRDiff', () => {
  it('rejects invalid PR URLs', async () => {
    await expect(fetchPRDiff('not-a-url')).rejects.toThrow(
      'Invalid GitHub PR URL',
    );
    await expect(
      fetchPRDiff('https://github.com/owner/repo/issues/1'),
    ).rejects.toThrow('Invalid GitHub PR URL');
    await expect(
      fetchPRDiff('https://gitlab.com/owner/repo/pull/1'),
    ).rejects.toThrow('Invalid GitHub PR URL');
  });

  it('fetches and parses a PR diff', async () => {
    const sampleDiff = `diff --git a/src/App.tsx b/src/App.tsx
index abc1234..def5678 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,5 +1,5 @@
 import React from 'react';
-import { Button } from '@patternfly/react-core';
+import { Button } from '@patternfly/react-core/dist/esm/components/Button';

 export const App = () => {
-  return <Button variant="primary">Click</Button>;
+  return <Button variant="primary" icon={<Icon />}>Click</Button>;
diff --git a/src/index.ts b/src/index.ts
index 1111111..2222222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 export { App } from './App';
 export { Home } from './Home';
+export { About } from './About';
`;

    mockExecFileSequence(sampleDiff);

    const result = await fetchPRDiff(
      'https://github.com/owner/repo/pull/123',
    );

    expect(result).toHaveLength(2);
    expect(result[0].filePath).toBe('src/App.tsx');
    expect(result[0].addedLines).toHaveLength(2);
    expect(result[0].removedLines).toHaveLength(2);
    expect(result[1].filePath).toBe('src/index.ts');
    expect(result[1].addedLines).toHaveLength(1);
  });

  it('returns empty array for PR with no diff', async () => {
    mockExecFileSequence('');

    const result = await fetchPRDiff(
      'https://github.com/owner/repo/pull/1',
    );
    expect(result).toEqual([]);
  });

  it('throws when gh pr diff fails', async () => {
    mockExecFileSequenceWithError(new Error('Could not resolve to a PullRequest'));

    await expect(
      fetchPRDiff('https://github.com/owner/repo/pull/999'),
    ).rejects.toThrow('Failed to fetch PR diff');
  });

  it('accepts valid PR URLs with trailing slash', async () => {
    mockExecFileSequence('');

    const result = await fetchPRDiff(
      'https://github.com/owner/repo/pull/42/',
    );
    expect(result).toEqual([]);
  });

  it('validates gh auth before fetching', async () => {
    const err = new Error('spawn gh ENOENT');
    mockExecFileError(err);

    await expect(
      fetchPRDiff('https://github.com/owner/repo/pull/1'),
    ).rejects.toThrow('GitHub CLI (gh) is not installed');
  });
});
