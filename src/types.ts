export enum DetectionStatus {
  CORRECT = 'CORRECT',
  MISSING = 'MISSING',
  INCORRECT = 'INCORRECT',
  UNNECESSARY = 'UNNECESSARY',
  FILE_MISSING = 'FILE_MISSING',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export interface DiffLine {
  lineNumber: number;
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

export interface FileDiff {
  filePath: string;
  oldPath?: string;
  addedLines: DiffLine[];
  removedLines: DiffLine[];
  hunks: DiffHunk[];
  isBinary: boolean;
  isRenamed: boolean;
}

export interface ImportDeclaration {
  moduleSpecifier: string;
  namedImports: string[];
  defaultImport?: string;
}

export interface JSXProp {
  name: string;
  value?: string;
}

export interface JSXComponentUsage {
  tagName: string;
  props: JSXProp[];
  children: string[];
}

export interface ASTRepresentation {
  imports: ImportDeclaration[];
  jsxComponents: JSXComponentUsage[];
  filePath: string;
  parseErrors: string[];
}

export interface PatternDefinition {
  id: string;
  name: string;
  complexity: 'trivial' | 'moderate' | 'complex';
  weight: 1 | 2 | 3;
  description: string;
  detect: (
    goldenDiff: FileDiff,
    migrationDiff: FileDiff | null,
    goldenAST?: ASTRepresentation,
    migrationAST?: ASTRepresentation,
  ) => DetectionResult;
}

export interface DetectionResult {
  patternId: string;
  status: DetectionStatus;
  message: string;
  details?: string[];
}

export interface MatchResult {
  matched: Array<{ golden: FileDiff; migration: FileDiff }>;
  missedFiles: FileDiff[];
  extraFiles: FileDiff[];
}

export interface NoiseInstance {
  type: 'unnecessary_change' | 'formatting_only' | 'incorrect_migration' | 'artifact' | 'placeholder_token';
  file: string;
  line?: number;
  description: string;
  penalty: number;
}

export interface FileResult {
  filePath: string;
  detections: DetectionResult[];
  noiseInstances: NoiseInstance[];
}

export interface EvalReport {
  metadata: {
    timestamp: string;
    goldenSource: string;
    migrationSource: string;
  };
  summary: {
    overallScore: number;
    fileCoverage: number;
    patternScore: number;
    noisePenalty: number;
  };
  fileResults: FileResult[];
  patternBreakdown: DetectionResult[];
  noiseInstances: NoiseInstance[];
}
