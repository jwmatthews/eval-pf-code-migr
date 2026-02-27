import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileDiff } from '../types.js';
import { parseDiff } from './diff-parser.js';

/**
 * Promise wrapper for execFile that returns { stdout, stderr }.
 */
function execFileAsync(
  cmd: string,
  args: string[],
  options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: stdout as string, stderr: stderr as string });
      }
    });
  });
}

/**
 * Validate that a directory exists and is a git repository.
 * Throws with a clear message if not.
 */
export async function validateGitRepo(dir: string): Promise<void> {
  try {
    await access(dir);
  } catch {
    throw new Error(`Directory does not exist: "${dir}"`);
  }

  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: dir });
  } catch {
    throw new Error(
      `Directory is not a git repository: "${dir}"`,
    );
  }
}

/**
 * Find the default branch name (main or master) in the given repo.
 */
async function findDefaultBranch(dir: string): Promise<string> {
  // Try to find the default branch from remote HEAD
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['symbolic-ref', 'refs/remotes/origin/HEAD'],
      { cwd: dir },
    );
    const ref = stdout.trim();
    // refs/remotes/origin/main -> main
    const branch = ref.replace('refs/remotes/origin/', '');
    if (branch) return branch;
  } catch {
    // Fall through to heuristic
  }

  // Heuristic: check if main or master exists
  for (const candidate of ['main', 'master']) {
    try {
      await execFileAsync('git', ['rev-parse', '--verify', candidate], {
        cwd: dir,
      });
      return candidate;
    } catch {
      // Try next
    }
  }

  throw new Error(
    `Could not determine default branch in "${dir}". Neither "main" nor "master" found.`,
  );
}

/**
 * Compute the merge base between the default branch and HEAD.
 */
async function getMergeBase(dir: string, baseBranch: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['merge-base', baseBranch, 'HEAD'],
      { cwd: dir },
    );
    return stdout.trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to compute merge base between "${baseBranch}" and HEAD in "${dir}": ${message}`,
    );
  }
}

/**
 * Read the diff from a local git repository by comparing the merge base
 * of the default branch with HEAD. Returns parsed FileDiff[].
 */
export async function readLocalDiff(dir: string): Promise<FileDiff[]> {
  await validateGitRepo(dir);

  const defaultBranch = await findDefaultBranch(dir);
  const mergeBase = await getMergeBase(dir, defaultBranch);

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', mergeBase, 'HEAD'],
      { cwd: dir },
    );
    return parseDiff(stdout);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read diff in "${dir}": ${message}`);
  }
}

/**
 * Read full file contents from disk for the given file paths.
 * Used for AST analysis in local directory mode.
 * Returns a Map of file path -> file content.
 * Files that cannot be read are silently skipped.
 */
export async function readFileContents(
  dir: string,
  filePaths: string[],
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();

  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const fullPath = join(dir, filePath);
        const content = await readFile(fullPath, 'utf-8');
        contents.set(filePath, content);
      } catch {
        // Skip files that can't be read (deleted, binary, etc.)
      }
    }),
  );

  return contents;
}
