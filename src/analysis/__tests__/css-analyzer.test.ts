import { describe, it, expect } from 'vitest';
import {
  analyzeCSSPatterns,
  findPF5Classes,
  findPF6Classes,
  findPF5CustomProperties,
  findPF6CustomProperties,
  findPF5UtilityClasses,
  findPF6UtilityClasses,
} from '../css-analyzer.js';

function toLines(lines: string[]): Array<{ content: string; lineNumber: number }> {
  return lines.map((content, i) => ({ content, lineNumber: i + 1 }));
}

describe('analyzeCSSPatterns', () => {
  it('detects pf-v5 class names in className prop (double quotes)', () => {
    const lines = toLines([
      '<div className="pf-v5-c-page__main-section">content</div>',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(1);
    expect(result.classReferences[0].className).toBe('pf-v5-c-page__main-section');
    expect(result.classReferences[0].context).toBe('className-prop');
    expect(result.classReferences[0].line).toBe(1);
  });

  it('detects pf-v6 class names in className prop', () => {
    const lines = toLines([
      '<div className="pf-v6-c-page__main-section">content</div>',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(1);
    expect(result.classReferences[0].className).toBe('pf-v6-c-page__main-section');
  });

  it('detects class names in template literals', () => {
    const lines = toLines([
      'className={`pf-v5-c-card ${isActive ? "active" : ""}`}',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(1);
    expect(result.classReferences[0].className).toBe('pf-v5-c-card');
    expect(result.classReferences[0].context).toBe('template-literal');
  });

  it('detects class names in string concatenation', () => {
    const lines = toLines([
      'className={"pf-v5-c-button" + " " + extraClass}',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(1);
    expect(result.classReferences[0].className).toBe('pf-v5-c-button');
    expect(result.classReferences[0].context).toBe('string-concat');
  });

  it('detects multiple class names on the same line', () => {
    const lines = toLines([
      '<div className="pf-v5-c-page pf-v5-c-page__sidebar">',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(2);
    expect(result.classReferences[0].className).toBe('pf-v5-c-page');
    expect(result.classReferences[1].className).toBe('pf-v5-c-page__sidebar');
  });

  it('detects class names across multiple lines', () => {
    const lines = toLines([
      '<div className="pf-v5-c-page">',
      '  <span className="pf-v5-c-label">text</span>',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(2);
    expect(result.classReferences[0].line).toBe(1);
    expect(result.classReferences[1].line).toBe(2);
  });

  it('detects CSS custom properties (--pf-v5-*)', () => {
    const lines = toLines([
      'style={{ "--pf-v5-c-page--BackgroundColor": "white" }}',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.customProperties).toHaveLength(1);
    expect(result.customProperties[0].property).toBe('--pf-v5-c-page--BackgroundColor');
    expect(result.customProperties[0].line).toBe(1);
  });

  it('detects CSS custom properties (--pf-v6-*)', () => {
    const lines = toLines([
      'var(--pf-v6-global--spacer--md)',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.customProperties).toHaveLength(1);
    expect(result.customProperties[0].property).toBe('--pf-v6-global--spacer--md');
  });

  it('detects multiple custom properties on the same line', () => {
    const lines = toLines([
      'padding: var(--pf-v5-global--spacer--sm) var(--pf-v5-global--spacer--md);',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.customProperties).toHaveLength(2);
    expect(result.customProperties[0].property).toBe('--pf-v5-global--spacer--sm');
    expect(result.customProperties[1].property).toBe('--pf-v5-global--spacer--md');
  });

  it('detects utility class references (pf-v5-u-*)', () => {
    const lines = toLines([
      '<div className="pf-v5-u-mt-md pf-v5-u-mb-lg">',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.utilityClasses).toHaveLength(2);
    expect(result.utilityClasses[0].className).toBe('pf-v5-u-mt-md');
    expect(result.utilityClasses[1].className).toBe('pf-v5-u-mb-lg');
    // Utility classes also appear in classReferences
    expect(result.classReferences).toHaveLength(2);
  });

  it('returns empty results for lines with no PF patterns', () => {
    const lines = toLines([
      '<div className="my-custom-class">',
      'const x = 42;',
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(0);
    expect(result.customProperties).toHaveLength(0);
    expect(result.utilityClasses).toHaveLength(0);
  });

  it('returns empty results for empty input', () => {
    const result = analyzeCSSPatterns([]);
    expect(result.classReferences).toHaveLength(0);
    expect(result.customProperties).toHaveLength(0);
    expect(result.utilityClasses).toHaveLength(0);
  });

  it('detects class names in plain string literals (non-className prop)', () => {
    const lines = toLines([
      "const cls = 'pf-v5-c-alert';",
    ]);
    const result = analyzeCSSPatterns(lines);
    expect(result.classReferences).toHaveLength(1);
    expect(result.classReferences[0].className).toBe('pf-v5-c-alert');
    expect(result.classReferences[0].context).toBe('string-literal');
  });
});

describe('findPF5Classes', () => {
  it('returns only pf-v5 class references', () => {
    const lines = toLines([
      '<div className="pf-v5-c-page pf-v6-c-page">',
    ]);
    const result = findPF5Classes(lines);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('pf-v5-c-page');
  });

  it('returns empty array when no pf-v5 classes found', () => {
    const lines = toLines([
      '<div className="pf-v6-c-page">',
    ]);
    const result = findPF5Classes(lines);
    expect(result).toHaveLength(0);
  });
});

describe('findPF6Classes', () => {
  it('returns only pf-v6 class references', () => {
    const lines = toLines([
      '<div className="pf-v5-c-page pf-v6-c-page">',
    ]);
    const result = findPF6Classes(lines);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('pf-v6-c-page');
  });
});

describe('findPF5CustomProperties', () => {
  it('returns only --pf-v5 custom properties', () => {
    const lines = toLines([
      'color: var(--pf-v5-global--Color--100);',
      'font-size: var(--pf-v6-global--FontSize--md);',
    ]);
    const result = findPF5CustomProperties(lines);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe('--pf-v5-global--Color--100');
  });
});

describe('findPF6CustomProperties', () => {
  it('returns only --pf-v6 custom properties', () => {
    const lines = toLines([
      'color: var(--pf-v5-global--Color--100);',
      'font-size: var(--pf-v6-global--FontSize--md);',
    ]);
    const result = findPF6CustomProperties(lines);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe('--pf-v6-global--FontSize--md');
  });
});

describe('findPF5UtilityClasses', () => {
  it('returns only pf-v5-u-* utility classes', () => {
    const lines = toLines([
      '<div className="pf-v5-u-mt-md pf-v6-u-mt-md pf-v5-c-card">',
    ]);
    const result = findPF5UtilityClasses(lines);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('pf-v5-u-mt-md');
  });
});

describe('findPF6UtilityClasses', () => {
  it('returns only pf-v6-u-* utility classes', () => {
    const lines = toLines([
      '<div className="pf-v5-u-mt-md pf-v6-u-mt-md pf-v6-c-card">',
    ]);
    const result = findPF6UtilityClasses(lines);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('pf-v6-u-mt-md');
  });
});
