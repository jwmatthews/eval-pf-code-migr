import { DetectionStatus } from '../types.js';
import type { PatternDefinition, FileDiff, DetectionResult } from '../types.js';
import { registerPattern } from './registry.js';

const PATTERN_ID = 'theme-dark-removal';

// Matches theme="dark", theme={'dark'}, theme='dark', or theme={ThemeVariant.dark}
const THEME_DARK_RE = /theme\s*=\s*(?:"dark"|{'dark'}|'dark'|\{['"]dark['"]\}|\{ThemeVariant\.dark\})/;

function hasThemeDark(lines: Array<{ content: string }>): boolean {
  return lines.some((l) => THEME_DARK_RE.test(l.content));
}

function detect(
  goldenDiff: FileDiff,
  migrationDiff: FileDiff | null,
): DetectionResult {
  const goldenRemovesThemeDark = hasThemeDark(goldenDiff.removedLines);

  if (!goldenRemovesThemeDark) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.NOT_APPLICABLE,
      message: 'No theme="dark" removal in golden diff',
    };
  }

  if (migrationDiff === null) {
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.FILE_MISSING,
      message: 'Migration file is missing',
    };
  }

  const migrationRemovesThemeDark = hasThemeDark(migrationDiff.removedLines);

  if (migrationRemovesThemeDark) {
    // Verify they didn't re-add it
    const migrationAddsThemeDark = hasThemeDark(migrationDiff.addedLines);
    if (migrationAddsThemeDark) {
      return {
        patternId: PATTERN_ID,
        status: DetectionStatus.INCORRECT,
        message: 'theme="dark" was removed but re-added in migration',
      };
    }
    return {
      patternId: PATTERN_ID,
      status: DetectionStatus.CORRECT,
      message: 'theme="dark" prop correctly removed',
    };
  }

  return {
    patternId: PATTERN_ID,
    status: DetectionStatus.MISSING,
    message: 'theme="dark" prop removal not found in migration',
  };
}

const pattern: PatternDefinition = {
  id: PATTERN_ID,
  name: 'Theme Dark Removal',
  complexity: 'trivial',
  weight: 1,
  description: 'Detects removal of theme="dark" prop',
  detect,
};

registerPattern(pattern);

export { pattern };
