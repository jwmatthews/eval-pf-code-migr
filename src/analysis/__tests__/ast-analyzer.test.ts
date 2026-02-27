import { describe, it, expect } from 'vitest';
import { analyzeAST, analyzeFileDiff, reconstructContentFromDiff } from '../ast-analyzer.js';
import type { FileDiff } from '../../types.js';

function makeDiff(filePath: string, addedLines: string[]): FileDiff {
  return {
    filePath,
    addedLines: addedLines.map((content, i) => ({ lineNumber: i + 1, content })),
    removedLines: [],
    hunks: [],
    isBinary: false,
    isRenamed: false,
  };
}

describe('analyzeAST', () => {
  describe('import extraction', () => {
    it('extracts named imports', () => {
      const code = `import { Button, Alert } from '@patternfly/react-core';`;
      const result = analyzeAST(code, 'test.tsx');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].moduleSpecifier).toBe('@patternfly/react-core');
      expect(result.imports[0].namedImports).toEqual(['Button', 'Alert']);
      expect(result.imports[0].defaultImport).toBeUndefined();
      expect(result.parseErrors).toHaveLength(0);
    });

    it('extracts default imports', () => {
      const code = `import React from 'react';`;
      const result = analyzeAST(code, 'test.tsx');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].moduleSpecifier).toBe('react');
      expect(result.imports[0].defaultImport).toBe('React');
      expect(result.imports[0].namedImports).toEqual([]);
    });

    it('extracts mixed default and named imports', () => {
      const code = `import React, { useState, useEffect } from 'react';`;
      const result = analyzeAST(code, 'test.tsx');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].defaultImport).toBe('React');
      expect(result.imports[0].namedImports).toEqual(['useState', 'useEffect']);
    });

    it('extracts multiple import statements', () => {
      const code = `
import { Button } from '@patternfly/react-core';
import { TableComposable } from '@patternfly/react-table';
`;
      const result = analyzeAST(code, 'test.tsx');

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].moduleSpecifier).toBe('@patternfly/react-core');
      expect(result.imports[1].moduleSpecifier).toBe('@patternfly/react-table');
    });
  });

  describe('JSX component extraction', () => {
    it('extracts self-closing components with props', () => {
      const code = `
import React from 'react';
const App = () => <Button variant="primary" isDisabled />;
`;
      const result = analyzeAST(code, 'test.tsx');

      expect(result.jsxComponents).toHaveLength(1);
      expect(result.jsxComponents[0].tagName).toBe('Button');
      expect(result.jsxComponents[0].props).toEqual([
        { name: 'variant', value: '"primary"' },
        { name: 'isDisabled' },
      ]);
    });

    it('extracts components with children', () => {
      const code = `
import React from 'react';
const App = () => (
  <Page>
    <PageSection>content</PageSection>
    <PageSection>more</PageSection>
  </Page>
);
`;
      const result = analyzeAST(code, 'test.tsx');

      // Should have: Page (opening), PageSection x2 (opening)
      const page = result.jsxComponents.find((c) => c.tagName === 'Page');
      expect(page).toBeDefined();
      expect(page!.children).toContain('PageSection');
    });

    it('extracts expression prop values', () => {
      const code = `
import React from 'react';
const App = () => <Alert variant={AlertVariant.success} title={title} />;
`;
      const result = analyzeAST(code, 'test.tsx');

      const alert = result.jsxComponents.find((c) => c.tagName === 'Alert');
      expect(alert).toBeDefined();
      expect(alert!.props).toEqual([
        { name: 'variant', value: '{AlertVariant.success}' },
        { name: 'title', value: '{title}' },
      ]);
    });

    it('extracts spread props', () => {
      const code = `
import React from 'react';
const App = () => <Button {...rest} />;
`;
      const result = analyzeAST(code, 'test.tsx');

      expect(result.jsxComponents).toHaveLength(1);
      expect(result.jsxComponents[0].props).toEqual([{ name: '...rest' }]);
    });
  });

  describe('PF5 code snippets', () => {
    it('parses PF5 Select component', () => {
      const code = `
import React, { useState } from 'react';
import { Select, SelectOption, SelectVariant } from '@patternfly/react-core';

const MySelect = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Select
      variant={SelectVariant.single}
      onToggle={setIsOpen}
      isOpen={isOpen}
      selections={selected}
    >
      <SelectOption value="Option 1" />
      <SelectOption value="Option 2" />
    </Select>
  );
};
`;
      const result = analyzeAST(code, 'MySelect.tsx');

      expect(result.parseErrors).toHaveLength(0);

      // Check imports
      const pfImport = result.imports.find((i) => i.moduleSpecifier === '@patternfly/react-core');
      expect(pfImport).toBeDefined();
      expect(pfImport!.namedImports).toContain('Select');
      expect(pfImport!.namedImports).toContain('SelectOption');
      expect(pfImport!.namedImports).toContain('SelectVariant');

      // Check JSX
      const select = result.jsxComponents.find((c) => c.tagName === 'Select');
      expect(select).toBeDefined();
      expect(select!.props.map((p) => p.name)).toContain('variant');
      expect(select!.props.map((p) => p.name)).toContain('onToggle');
      expect(select!.props.map((p) => p.name)).toContain('isOpen');

      // Children
      expect(select!.children).toContain('SelectOption');
    });

    it('parses PF6 Select component', () => {
      const code = `
import React, { useState } from 'react';
import { Select, SelectOption, SelectList, MenuToggle } from '@patternfly/react-core';

const MySelect = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Select
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggle={(toggleRef) => (
        <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)}>
          Select option
        </MenuToggle>
      )}
    >
      <SelectList>
        <SelectOption value="Option 1">Option 1</SelectOption>
        <SelectOption value="Option 2">Option 2</SelectOption>
      </SelectList>
    </Select>
  );
};
`;
      const result = analyzeAST(code, 'MySelect.tsx');

      expect(result.parseErrors).toHaveLength(0);

      const pfImport = result.imports.find((i) => i.moduleSpecifier === '@patternfly/react-core');
      expect(pfImport).toBeDefined();
      expect(pfImport!.namedImports).toContain('Select');
      expect(pfImport!.namedImports).toContain('SelectList');
      expect(pfImport!.namedImports).toContain('MenuToggle');

      const select = result.jsxComponents.find((c) => c.tagName === 'Select');
      expect(select).toBeDefined();
      expect(select!.props.map((p) => p.name)).toContain('onOpenChange');
      expect(select!.props.map((p) => p.name)).toContain('toggle');
    });

    it('parses PF5 EmptyState', () => {
      const code = `
import React from 'react';
import { EmptyState, EmptyStateIcon, EmptyStateBody, Title } from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';

const Empty = () => (
  <EmptyState>
    <EmptyStateIcon icon={CubesIcon} />
    <Title headingLevel="h4">No results</Title>
    <EmptyStateBody>Try adjusting your filters.</EmptyStateBody>
  </EmptyState>
);
`;
      const result = analyzeAST(code, 'Empty.tsx');

      expect(result.parseErrors).toHaveLength(0);
      const emptyState = result.jsxComponents.find((c) => c.tagName === 'EmptyState');
      expect(emptyState).toBeDefined();
      expect(emptyState!.children).toContain('EmptyStateIcon');
      expect(emptyState!.children).toContain('Title');
      expect(emptyState!.children).toContain('EmptyStateBody');
    });
  });

  describe('error handling', () => {
    it('handles unparseable content gracefully', () => {
      const code = `this is not valid {{ typescript jsx @@@ code`;
      const result = analyzeAST(code, 'broken.tsx');

      // Should still return a result with the filePath
      expect(result.filePath).toBe('broken.tsx');
      expect(result.imports).toEqual([]);
      expect(result.jsxComponents).toEqual([]);
      // May or may not have parse errors depending on ts-morph tolerance
    });

    it('handles empty content', () => {
      const result = analyzeAST('', 'empty.tsx');

      expect(result.filePath).toBe('empty.tsx');
      expect(result.imports).toEqual([]);
      expect(result.jsxComponents).toEqual([]);
      expect(result.parseErrors).toHaveLength(0);
    });

    it('handles .ts files by treating them as .tsx', () => {
      const code = `import { Button } from '@patternfly/react-core';`;
      const result = analyzeAST(code, 'utils.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].moduleSpecifier).toBe('@patternfly/react-core');
    });
  });

  describe('reconstructContentFromDiff', () => {
    it('reconstructs content from added lines', () => {
      const diff = makeDiff('test.tsx', [
        'import React from "react";',
        'const App = () => <div>Hello</div>;',
      ]);

      const content = reconstructContentFromDiff(diff);

      expect(content).toBe('import React from "react";\nconst App = () => <div>Hello</div>;');
    });

    it('sorts lines by line number', () => {
      const diff: FileDiff = {
        filePath: 'test.tsx',
        addedLines: [
          { lineNumber: 3, content: 'line 3' },
          { lineNumber: 1, content: 'line 1' },
          { lineNumber: 2, content: 'line 2' },
        ],
        removedLines: [],
        hunks: [],
        isBinary: false,
        isRenamed: false,
      };

      const content = reconstructContentFromDiff(diff);

      expect(content).toBe('line 1\nline 2\nline 3');
    });
  });

  describe('analyzeFileDiff', () => {
    it('analyzes a FileDiff by reconstructing content', () => {
      const diff = makeDiff('App.tsx', [
        'import React from "react";',
        'import { Button } from "@patternfly/react-core";',
        'const App = () => <Button variant="primary">Click</Button>;',
      ]);

      const result = analyzeFileDiff(diff);

      expect(result.filePath).toBe('App.tsx');
      expect(result.imports).toHaveLength(2);
      expect(result.jsxComponents.length).toBeGreaterThan(0);
      const button = result.jsxComponents.find((c) => c.tagName === 'Button');
      expect(button).toBeDefined();
      expect(button!.props[0].name).toBe('variant');
    });
  });
});
