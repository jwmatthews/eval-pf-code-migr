import { Project, SyntaxKind, type SourceFile, type JsxOpeningElement, type JsxSelfClosingElement } from 'ts-morph';
import type { ASTRepresentation, ImportDeclaration, JSXComponentUsage, JSXProp, FileDiff, DiffLine } from '../types.js';

/**
 * Analyze source code content and extract AST information.
 */
export function analyzeAST(content: string, filePath: string): ASTRepresentation {
  const result: ASTRepresentation = {
    imports: [],
    jsxComponents: [],
    filePath,
    parseErrors: [],
  };

  try {
    const project = new Project({
      useInMemoryFileSystem: true,
      skipFileDependencyResolution: true,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        jsx: 1, // JsxEmit.Preserve
        strict: false,
        noEmit: true,
      },
    });

    // Always use .tsx extension so JSX parses correctly
    const tsxPath = filePath.endsWith('.tsx') ? filePath : filePath.replace(/\.(ts|js|jsx)$/, '.tsx');
    const sourceFile = project.createSourceFile(tsxPath, content);

    result.imports = extractImports(sourceFile);
    result.jsxComponents = extractJSXComponents(sourceFile);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.parseErrors.push(`Failed to parse ${filePath}: ${message}`);
  }

  return result;
}

/**
 * Reconstruct file content from diff added lines (for PR mode where we don't have full files).
 */
export function reconstructContentFromDiff(diff: FileDiff): string {
  return diff.addedLines
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((line) => line.content)
    .join('\n');
}

/**
 * Analyze a FileDiff by reconstructing content from added lines.
 */
export function analyzeFileDiff(diff: FileDiff): ASTRepresentation {
  const content = reconstructContentFromDiff(diff);
  return analyzeAST(content, diff.filePath);
}

function extractImports(sourceFile: SourceFile): ImportDeclaration[] {
  const imports: ImportDeclaration[] = [];

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const namedImports = importDecl.getNamedImports().map((ni) => ni.getName());
    const defaultImport = importDecl.getDefaultImport()?.getText();

    const decl: ImportDeclaration = {
      moduleSpecifier,
      namedImports,
    };

    if (defaultImport) {
      decl.defaultImport = defaultImport;
    }

    imports.push(decl);
  }

  return imports;
}

function extractJSXComponents(sourceFile: SourceFile): JSXComponentUsage[] {
  const components: JSXComponentUsage[] = [];

  // Handle JsxOpeningElement (paired with JsxClosingElement)
  const openingElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
  for (const element of openingElements) {
    components.push(extractComponentFromElement(element));
  }

  // Handle JsxSelfClosingElement
  const selfClosingElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  for (const element of selfClosingElements) {
    components.push(extractComponentFromElement(element));
  }

  return components;
}

function extractComponentFromElement(element: JsxOpeningElement | JsxSelfClosingElement): JSXComponentUsage {
  const tagName = element.getTagNameNode().getText();
  const props: JSXProp[] = [];

  for (const attr of element.getAttributes()) {
    if (attr.getKind() === SyntaxKind.JsxAttribute) {
      const name = attr.getChildAtIndex(0).getText();
      const prop: JSXProp = { name };
      // Boolean attributes (e.g. isDisabled) have only 1 child (the name).
      // Attributes with values (e.g. variant="primary") have 3: name, =, value.
      if (attr.getChildCount() >= 3) {
        prop.value = attr.getChildAtIndex(2).getText();
      }
      props.push(prop);
    } else if (attr.getKind() === SyntaxKind.JsxSpreadAttribute) {
      props.push({ name: `...${attr.getChildAtIndex(2)?.getText() ?? ''}` });
    }
  }

  const children: string[] = [];

  // Only opening elements (not self-closing) have children in the parent JsxElement
  if (element.getKind() === SyntaxKind.JsxOpeningElement) {
    const parent = element.getParent();
    if (parent && parent.getKind() === SyntaxKind.JsxElement) {
      const jsxChildren = parent.getChildrenOfKind(SyntaxKind.JsxElement);
      for (const child of jsxChildren) {
        const opening = child.getChildrenOfKind(SyntaxKind.JsxOpeningElement)[0];
        if (opening) {
          children.push(opening.getTagNameNode().getText());
        }
      }
      const selfClosingChildren = parent.getChildrenOfKind(SyntaxKind.JsxSelfClosingElement);
      for (const child of selfClosingChildren) {
        children.push(child.getTagNameNode().getText());
      }
    }
  }

  return { tagName, props, children };
}
