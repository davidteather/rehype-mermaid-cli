import { run } from "@mermaid-js/mermaid-cli";
import type { Plugin } from "unified";
import { fromHtml } from "hast-util-from-html";
import { visitParents } from "unist-util-visit-parents";
import { toText } from "hast-util-to-text";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createHash } from "crypto";
import type { Root, Element as HastElement, Parent } from "hast";

// ---------- Types ----------
export type Theme = "default" | "base" | "dark" | "forest" | "neutral" | "null";

export interface RehypeMermaidOptions {
  renderThemes: Theme[];
  svgClassNames?: string[];
  puppeteerConfig?: {
    headless?: boolean;
    args?: string[];
  };
}

// Default options for the plugin
export const defaultOptions: RehypeMermaidOptions = {
  renderThemes: ["default"],
};

// ---------- Plugin ----------
export const rehypeMermaidCLI: Plugin<[RehypeMermaidOptions?], Root> = (
  _options
) => {
  const options = { ...defaultOptions, ..._options };

  return async (ast, _file) => {
    const diagrams: {
      diagram: string;
      id: string;
      node: HastElement;
      ancestors: Parent[];
    }[] = [];

    // Find all code blocks with language-mermaid
    visitParents(ast, "element", (node, ancestors) => {
      if (
        node.tagName === "code" &&
        Array.isArray(node.properties?.className) &&
        node.properties.className.includes("language-mermaid")
      ) {
        const diagramText = toText(node, { whitespace: "pre" });
        const id = getDiagramId(diagramText);
        node.properties = { ...node.properties, id };
        diagrams.push({ diagram: diagramText, id, node, ancestors });
      }
    });

    // Render each diagram for all requested themes
    await Promise.all(
      diagrams.map(async ({ diagram, id, node, ancestors }) => {
        const svgByTheme: Record<Theme, string> = Object.fromEntries(
          await Promise.all(
            options.renderThemes.map(async (theme) => {
              const svg = await renderMermaidDiagram(diagram, theme, options.puppeteerConfig);
              return [theme, svg] as const;
            })
          )
        ) as Record<Theme, string>;

        applyThemeAST(node, svgByTheme, id, ancestors, options.svgClassNames);
      })
    );
  };
};

export default rehypeMermaidCLI;

// ---------- Helper functions ----------

/** Generate a stable ID for a diagram from its text */
function getDiagramId(diagram: string) {
  const hash = createHash("md5").update(diagram).digest("hex").slice(0, 8);
  return `mermaid-${hash}`;
}

/** Generate ID that includes theme (for caching multiple themes) */
function getDiagramIdWithTheme(diagram: string, theme: Theme) {
  const hash = createHash("md5").update(diagram).digest("hex").slice(0, 8);
  return `mermaid-${hash}-${theme}`;
}

/** Check if a file exists */
async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Render a Mermaid diagram to SVG using CLI */
async function renderMermaidDiagram(diagram: string, theme: Theme, puppeteerConfig?: { headless?: boolean; args?: string[]; }) {
  const id = getDiagramIdWithTheme(diagram, theme);
  const tmpDir = os.tmpdir();
  const inputFile = path.join(tmpDir, `${id}.mmd`);
  const finalOutput = path.join(
    tmpDir,
    `${getDiagramIdWithTheme(diagram, theme)}.svg`
  );

  // Return cached output if already exists
  if (await exists(finalOutput)) {
    return fs.readFile(finalOutput, "utf8");
  }

  await fs.writeFile(inputFile, diagram, "utf8");

  await run(inputFile, finalOutput as `${string}.svg`, {
    parseMMDOptions: {
      backgroundColor: "transparent",
      mermaidConfig: {
        theme: theme,
      },
      svgId: id,
    },
    puppeteerConfig: {
      headless: puppeteerConfig?.headless ?? true,
      args: puppeteerConfig?.args ?? [],
    },
  });

  return fs.readFile(finalOutput, "utf8");
}

/** Replace AST node with a wrapper containing multiple theme SVGs */
function applyThemeAST(
  node: HastElement,
  svgByTheme: Partial<Record<Exclude<Theme, undefined>, string>>,
  id: string,
  ancestors?: Parent[],
  svgClassNames?: string[]
) {
  const themeDivs: HastElement[] = Object.entries(svgByTheme).map(
    ([theme, svg], index) => ({
      type: "element",
      tagName: "div",
      properties: {
        id: `mermaid-${theme}-${id}`,
        className: ["mermaid", `mermaid-${theme}`],
        style: index === 0 ? "display: block;" : "display: none;", // show first theme
      },
      children: parseSvg(svg!, svgClassNames),
    })
  );

  const wrapper: HastElement = {
    type: "element",
    tagName: "div",
    properties: { className: ["mermaid-wrapper"], id },
    children: themeDivs,
  };

  // Replace original node or its <pre> parent in the AST
  let targetNode: HastElement = node;
  let parentNode: Parent | undefined = ancestors?.[ancestors.length - 1];

  if (parentNode && parentNode.type === "element" && "tagName" in parentNode) {
    const parentElement = parentNode as HastElement;
    if (parentElement.tagName === "pre") {
      targetNode = parentElement;
      parentNode = ancestors?.[ancestors.length - 2];
    }
  }

  if (parentNode && "children" in parentNode) {
    const index = parentNode.children.indexOf(targetNode);
    if (index !== -1) parentNode.children[index] = wrapper;
  }
}

/** Parse raw SVG string into HAST children */
function parseSvg(svgContent: string, svgClassNames?: string[]): HastElement["children"] {
  const tree = fromHtml(svgContent, { fragment: true });
  const svgElement = tree.children[0] as HastElement;

  if (svgElement.tagName === "svg" && svgClassNames && svgClassNames.length > 0) {
    svgElement.properties = {
      ...svgElement.properties,
      className: [
        ...((svgElement.properties?.className as string[]) || []),
        ...svgClassNames,
      ],
    };
  }

  return tree.children as HastElement["children"];
}
