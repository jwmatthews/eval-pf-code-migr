/**
 * CSS pattern analyzer for detecting PatternFly CSS class references,
 * custom properties, and utility classes in source code.
 */

export interface CSSClassReference {
  className: string;
  line: number;
  context: 'className-prop' | 'template-literal' | 'string-concat' | 'string-literal';
}

export interface CSSCustomPropertyReference {
  property: string;
  line: number;
}

export interface CSSAnalysisResult {
  classReferences: CSSClassReference[];
  customProperties: CSSCustomPropertyReference[];
  utilityClasses: CSSClassReference[];
}

// Regex for pf-v5-* or pf-v6-* class names
const PF_CLASS_PATTERN = /\bpf-v[56]-[\w-]+/g;

// Regex for pf-v5-u-* or pf-v6-u-* utility classes
const PF_UTILITY_CLASS_PATTERN = /\bpf-v[56]-u-[\w-]+/g;

// Regex for --pf-v5-* or --pf-v6-* CSS custom properties
const PF_CUSTOM_PROPERTY_PATTERN = /--pf-v[56]-[\w-]+/g;

// Regex to detect className prop assignments (className="..." or className={'...'})
const CLASSNAME_PROP_PATTERN = /className\s*=\s*(?:"([^"]*)"|{[`']([^`']*)[`']|{'([^']*)'})/;

// Regex to detect template literal usage with className
const CLASSNAME_TEMPLATE_PATTERN = /className\s*=\s*\{`([^`]*)`\}/;

/**
 * Analyze lines of code for CSS-related PatternFly references.
 */
export function analyzeCSSPatterns(lines: Array<{ content: string; lineNumber: number }>): CSSAnalysisResult {
  const classReferences: CSSClassReference[] = [];
  const customProperties: CSSCustomPropertyReference[] = [];
  const utilityClasses: CSSClassReference[] = [];

  for (const { content, lineNumber } of lines) {
    // Detect CSS custom properties (--pf-v5-* or --pf-v6-*)
    const customPropMatches = content.matchAll(PF_CUSTOM_PROPERTY_PATTERN);
    for (const match of customPropMatches) {
      customProperties.push({
        property: match[0],
        line: lineNumber,
      });
    }

    // Determine the context of PF class references
    const context = detectClassContext(content);

    // Detect PF class references (pf-v5-* or pf-v6-*)
    const classMatches = content.matchAll(PF_CLASS_PATTERN);
    for (const match of classMatches) {
      const className = match[0];

      // Check if it's a utility class (use a fresh regex to avoid lastIndex issues)
      if (/\bpf-v[56]-u-[\w-]+/.test(className)) {
        utilityClasses.push({ className, line: lineNumber, context });
      }

      classReferences.push({ className, line: lineNumber, context });
    }
  }

  return { classReferences, customProperties, utilityClasses };
}

/**
 * Detect the context in which a CSS class appears on a line.
 */
function detectClassContext(line: string): CSSClassReference['context'] {
  if (CLASSNAME_TEMPLATE_PATTERN.test(line)) {
    return 'template-literal';
  }
  if (CLASSNAME_PROP_PATTERN.test(line)) {
    return 'className-prop';
  }
  if (/className\s*=\s*\{.*\+/.test(line) || /className\s*=\s*\{.*\.concat\(/.test(line)) {
    return 'string-concat';
  }
  return 'string-literal';
}

/**
 * Extract PF5-specific class references from lines.
 */
export function findPF5Classes(lines: Array<{ content: string; lineNumber: number }>): CSSClassReference[] {
  const result: CSSClassReference[] = [];
  for (const { content, lineNumber } of lines) {
    const matches = content.matchAll(/\bpf-v5-[\w-]+/g);
    for (const match of matches) {
      result.push({
        className: match[0],
        line: lineNumber,
        context: detectClassContext(content),
      });
    }
  }
  return result;
}

/**
 * Extract PF6-specific class references from lines.
 */
export function findPF6Classes(lines: Array<{ content: string; lineNumber: number }>): CSSClassReference[] {
  const result: CSSClassReference[] = [];
  for (const { content, lineNumber } of lines) {
    const matches = content.matchAll(/\bpf-v6-[\w-]+/g);
    for (const match of matches) {
      result.push({
        className: match[0],
        line: lineNumber,
        context: detectClassContext(content),
      });
    }
  }
  return result;
}

/**
 * Extract PF5 CSS custom property references.
 */
export function findPF5CustomProperties(lines: Array<{ content: string; lineNumber: number }>): CSSCustomPropertyReference[] {
  const result: CSSCustomPropertyReference[] = [];
  for (const { content, lineNumber } of lines) {
    const matches = content.matchAll(/--pf-v5-[\w-]+/g);
    for (const match of matches) {
      result.push({ property: match[0], line: lineNumber });
    }
  }
  return result;
}

/**
 * Extract PF6 CSS custom property references.
 */
export function findPF6CustomProperties(lines: Array<{ content: string; lineNumber: number }>): CSSCustomPropertyReference[] {
  const result: CSSCustomPropertyReference[] = [];
  for (const { content, lineNumber } of lines) {
    const matches = content.matchAll(/--pf-v6-[\w-]+/g);
    for (const match of matches) {
      result.push({ property: match[0], line: lineNumber });
    }
  }
  return result;
}

/**
 * Extract PF5 utility class references (pf-v5-u-*).
 */
export function findPF5UtilityClasses(lines: Array<{ content: string; lineNumber: number }>): CSSClassReference[] {
  const result: CSSClassReference[] = [];
  for (const { content, lineNumber } of lines) {
    const matches = content.matchAll(/\bpf-v5-u-[\w-]+/g);
    for (const match of matches) {
      result.push({
        className: match[0],
        line: lineNumber,
        context: detectClassContext(content),
      });
    }
  }
  return result;
}

/**
 * Extract PF6 utility class references (pf-v6-u-*).
 */
export function findPF6UtilityClasses(lines: Array<{ content: string; lineNumber: number }>): CSSClassReference[] {
  const result: CSSClassReference[] = [];
  for (const { content, lineNumber } of lines) {
    const matches = content.matchAll(/\bpf-v6-u-[\w-]+/g);
    for (const match of matches) {
      result.push({
        className: match[0],
        line: lineNumber,
        context: detectClassContext(content),
      });
    }
  }
  return result;
}
