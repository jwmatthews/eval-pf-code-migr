import { execFile } from 'node:child_process';
import type { FileDiff } from '../types.js';
import { parseDiff } from './diff-parser.js';

/**
 * Promise wrapper for execFile that returns { stdout, stderr }.
 */
function execFileAsync(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: stdout as string, stderr: stderr as string });
      }
    });
  });
}

/**
 * Validate that a string looks like a GitHub PR URL.
 */
function isValidPRUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+\/?$/.test(url);
}

/**
 * Check that the `gh` CLI is installed and authenticated.
 * Throws with a clear message if not.
 */
export async function validateGhCli(): Promise<void> {
  try {
    await execFileAsync('gh', ['auth', 'status']);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    if (message.includes('ENOENT') || message.includes('not found')) {
      throw new Error(
        'GitHub CLI (gh) is not installed. Install it from https://cli.github.com/',
      );
    }
    throw new Error(
      `GitHub CLI (gh) is not authenticated. Run 'gh auth login' first. Details: ${message}`,
    );
  }
}

/**
 * Fetch the diff for a GitHub PR URL using `gh pr diff` and parse it into FileDiff[].
 */
export async function fetchPRDiff(prUrl: string): Promise<FileDiff[]> {
  if (!isValidPRUrl(prUrl)) {
    throw new Error(
      `Invalid GitHub PR URL: "${prUrl}". Expected format: https://github.com/owner/repo/pull/123`,
    );
  }

  await validateGhCli();

  try {
    const { stdout } = await execFileAsync('gh', ['pr', 'diff', prUrl]);
    return parseDiff(stdout);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch PR diff for ${prUrl}: ${message}`);
  }
}
