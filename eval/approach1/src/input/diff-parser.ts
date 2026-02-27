import type { FileDiff, DiffLine, DiffHunk } from '../types.js';

/**
 * Parse a unified diff string into structured FileDiff objects.
 */
export function parseDiff(diffText: string): FileDiff[] {
  if (!diffText.trim()) {
    return [];
  }

  const files: FileDiff[] = [];
  const fileChunks = splitIntoFileChunks(diffText);

  for (const chunk of fileChunks) {
    const fileDiff = parseFileChunk(chunk);
    if (fileDiff) {
      files.push(fileDiff);
    }
  }

  return files;
}

/**
 * Split a unified diff into per-file chunks, each starting with "diff --git".
 */
function splitIntoFileChunks(diffText: string): string[] {
  const chunks: string[] = [];
  const lines = diffText.split('\n');
  let currentChunk: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git ') && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
    }
    currentChunk.push(line);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

/**
 * Parse a single file chunk from a unified diff.
 */
function parseFileChunk(chunk: string): FileDiff | null {
  const lines = chunk.split('\n');

  // Find the diff --git line
  const gitDiffLine = lines.find(l => l.startsWith('diff --git '));
  if (!gitDiffLine) {
    return null;
  }

  // Check for binary file
  if (lines.some(l => l.startsWith('Binary files ') || l.includes('GIT binary patch'))) {
    const paths = parseGitDiffPaths(gitDiffLine);
    return {
      filePath: paths.newPath,
      oldPath: paths.oldPath !== paths.newPath ? paths.oldPath : undefined,
      addedLines: [],
      removedLines: [],
      hunks: [],
      isBinary: true,
      isRenamed: paths.oldPath !== paths.newPath,
    };
  }

  // Check for rename
  const renameLine = lines.find(l => l.startsWith('rename from '));
  const renameToLine = lines.find(l => l.startsWith('rename to '));
  const isRenamed = !!(renameLine && renameToLine);

  let filePath: string;
  let oldPath: string | undefined;

  if (isRenamed) {
    oldPath = renameLine!.replace('rename from ', '');
    filePath = renameToLine!.replace('rename to ', '');
  } else {
    // Parse from --- and +++ lines, or fall back to diff --git line
    const minusLine = lines.find(l => l.startsWith('--- '));
    const plusLine = lines.find(l => l.startsWith('+++ '));

    if (plusLine && plusLine !== '+++ /dev/null') {
      filePath = stripABPrefix(plusLine.slice(4));
    } else if (minusLine && minusLine !== '--- /dev/null') {
      filePath = stripABPrefix(minusLine.slice(4));
    } else {
      const paths = parseGitDiffPaths(gitDiffLine);
      filePath = paths.newPath;
    }

    if (minusLine && minusLine !== '--- /dev/null') {
      const minusPath = stripABPrefix(minusLine.slice(4));
      if (minusPath !== filePath) {
        oldPath = minusPath;
      }
    }
  }

  // Parse hunks
  const hunks: DiffHunk[] = [];
  const addedLines: DiffLine[] = [];
  const removedLines: DiffLine[] = [];

  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newCount: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
        lines: [line],
      };
      continue;
    }

    if (currentHunk) {
      // Track lines within the hunk
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push(line);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push(line);
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push(line);
      } else if (line === '\\ No newline at end of file') {
        currentHunk.lines.push(line);
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // Extract added/removed lines with line numbers from hunks
  for (const hunk of hunks) {
    let oldLineNum = hunk.oldStart;
    let newLineNum = hunk.newStart;

    for (const line of hunk.lines) {
      if (line.startsWith('@@')) {
        continue;
      }
      if (line === '\\ No newline at end of file') {
        continue;
      }
      if (line.startsWith('+')) {
        addedLines.push({ lineNumber: newLineNum, content: line.slice(1) });
        newLineNum++;
      } else if (line.startsWith('-')) {
        removedLines.push({ lineNumber: oldLineNum, content: line.slice(1) });
        oldLineNum++;
      } else if (line.startsWith(' ')) {
        oldLineNum++;
        newLineNum++;
      }
    }
  }

  return {
    filePath,
    oldPath,
    addedLines,
    removedLines,
    hunks,
    isBinary: false,
    isRenamed,
  };
}

/**
 * Parse the two paths from a "diff --git a/path b/path" line.
 */
function parseGitDiffPaths(gitDiffLine: string): { oldPath: string; newPath: string } {
  // "diff --git a/foo/bar.ts b/foo/bar.ts"
  const withoutPrefix = gitDiffLine.slice('diff --git '.length);
  // Split on " b/" - handle case where path itself may contain spaces
  const bIndex = withoutPrefix.indexOf(' b/');
  if (bIndex === -1) {
    // Fallback: split on space
    const parts = withoutPrefix.split(' ');
    const oldPath = stripABPrefix(parts[0]);
    const newPath = stripABPrefix(parts[parts.length - 1]);
    return { oldPath, newPath };
  }
  const oldPath = stripABPrefix(withoutPrefix.slice(0, bIndex));
  const newPath = stripABPrefix(withoutPrefix.slice(bIndex + 1));
  return { oldPath, newPath };
}

/**
 * Strip the a/ or b/ prefix from a diff path.
 */
function stripABPrefix(path: string): string {
  if (path.startsWith('a/') || path.startsWith('b/')) {
    return path.slice(2);
  }
  return path;
}
