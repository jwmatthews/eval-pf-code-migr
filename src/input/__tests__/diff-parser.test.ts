import { describe, it, expect } from 'vitest';
import { parseDiff } from '../diff-parser.js';

describe('parseDiff', () => {
  it('returns empty array for empty input', () => {
    expect(parseDiff('')).toEqual([]);
    expect(parseDiff('   \n  ')).toEqual([]);
  });

  it('parses a single-file diff', () => {
    const diff = `diff --git a/src/App.tsx b/src/App.tsx
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
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/App.tsx');
    expect(result[0].isBinary).toBe(false);
    expect(result[0].isRenamed).toBe(false);
    expect(result[0].addedLines).toHaveLength(2);
    expect(result[0].removedLines).toHaveLength(2);
    expect(result[0].hunks).toHaveLength(1);
    expect(result[0].addedLines[0].content).toBe(
      "import { Button } from '@patternfly/react-core/dist/esm/components/Button';"
    );
    expect(result[0].addedLines[0].lineNumber).toBe(2);
    expect(result[0].removedLines[0].lineNumber).toBe(2);
  });

  it('parses a multi-file diff', () => {
    const diff = `diff --git a/src/App.tsx b/src/App.tsx
index abc1234..def5678 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,3 +1,3 @@
 import React from 'react';
-const a = 1;
+const a = 2;
diff --git a/src/index.ts b/src/index.ts
index 1111111..2222222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -5,3 +5,4 @@
 export { App } from './App';
 export { Home } from './Home';
+export { About } from './About';
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(2);
    expect(result[0].filePath).toBe('src/App.tsx');
    expect(result[1].filePath).toBe('src/index.ts');
    expect(result[0].removedLines).toHaveLength(1);
    expect(result[0].addedLines).toHaveLength(1);
    expect(result[1].addedLines).toHaveLength(1);
    expect(result[1].addedLines[0].lineNumber).toBe(7);
    expect(result[1].addedLines[0].content).toBe("export { About } from './About';");
  });

  it('handles renamed files', () => {
    const diff = `diff --git a/src/OldName.tsx b/src/NewName.tsx
similarity index 90%
rename from src/OldName.tsx
rename to src/NewName.tsx
index abc1234..def5678 100644
--- a/src/OldName.tsx
+++ b/src/NewName.tsx
@@ -1,3 +1,3 @@
 import React from 'react';
-export const OldName = () => <div />;
+export const NewName = () => <div />;
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/NewName.tsx');
    expect(result[0].oldPath).toBe('src/OldName.tsx');
    expect(result[0].isRenamed).toBe(true);
    expect(result[0].isBinary).toBe(false);
    expect(result[0].removedLines).toHaveLength(1);
    expect(result[0].addedLines).toHaveLength(1);
  });

  it('handles binary files', () => {
    const diff = `diff --git a/logo.png b/logo.png
index abc1234..def5678 100644
Binary files a/logo.png and b/logo.png differ
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('logo.png');
    expect(result[0].isBinary).toBe(true);
    expect(result[0].addedLines).toEqual([]);
    expect(result[0].removedLines).toEqual([]);
    expect(result[0].hunks).toEqual([]);
  });

  it('handles no newline at end of file', () => {
    const diff = `diff --git a/src/config.ts b/src/config.ts
index abc1234..def5678 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,3 @@
 const config = {
-  debug: false
+  debug: true
\\ No newline at end of file
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].addedLines).toHaveLength(1);
    expect(result[0].addedLines[0].content).toBe('  debug: true');
    expect(result[0].removedLines).toHaveLength(1);
    // The "\ No newline at end of file" should not appear as an added/removed line
    expect(
      result[0].addedLines.every(l => !l.content.includes('No newline'))
    ).toBe(true);
  });

  it('parses hunk headers correctly', () => {
    const diff = `diff --git a/src/utils.ts b/src/utils.ts
index abc1234..def5678 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,7 @@ function existing() {
 const a = 1;
 const b = 2;
 const c = 3;
+const d = 4;
 const e = 5;
 const f = 6;
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].hunks).toHaveLength(1);
    expect(result[0].hunks[0].oldStart).toBe(10);
    expect(result[0].hunks[0].oldCount).toBe(6);
    expect(result[0].hunks[0].newStart).toBe(10);
    expect(result[0].hunks[0].newCount).toBe(7);
    expect(result[0].addedLines[0].lineNumber).toBe(13);
    expect(result[0].addedLines[0].content).toBe('const d = 4;');
  });

  it('handles multiple hunks in a single file', () => {
    const diff = `diff --git a/src/big.ts b/src/big.ts
index abc1234..def5678 100644
--- a/src/big.ts
+++ b/src/big.ts
@@ -1,3 +1,4 @@
 line1
+inserted at top
 line2
 line3
@@ -20,3 +21,3 @@
 line20
-old line 21
+new line 21
 line22
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].hunks).toHaveLength(2);
    expect(result[0].addedLines).toHaveLength(2);
    expect(result[0].addedLines[0].lineNumber).toBe(2);
    expect(result[0].addedLines[0].content).toBe('inserted at top');
    expect(result[0].addedLines[1].lineNumber).toBe(22);
    expect(result[0].removedLines).toHaveLength(1);
    expect(result[0].removedLines[0].lineNumber).toBe(21);
  });

  it('handles new file creation', () => {
    const diff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export const hello = 'world';
+export const foo = 'bar';
+export const baz = 42;
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/new-file.ts');
    expect(result[0].addedLines).toHaveLength(3);
    expect(result[0].removedLines).toHaveLength(0);
    expect(result[0].addedLines[0].lineNumber).toBe(1);
  });

  it('handles file deletion', () => {
    const diff = `diff --git a/src/old-file.ts b/src/old-file.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export const hello = 'world';
-export const foo = 'bar';
-export const baz = 42;
`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/old-file.ts');
    expect(result[0].removedLines).toHaveLength(3);
    expect(result[0].addedLines).toHaveLength(0);
  });
});
