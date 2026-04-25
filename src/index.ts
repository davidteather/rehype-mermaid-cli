import { renderMermaid } from "@mermaid-js/mermaid-cli";
import puppeteer from "puppeteer";
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

export interface MermaidConfig {
  securityLevel?: "strict" | "loose" | "antiscript" | "sandbox";
  [key: string]: unknown;
}

export interface RehypeMermaidOptions {
  renderThemes: Theme[];
  svgClassNames?: string[];
  mermaidConfig?: MermaidConfig;
  puppeteerConfig?: {
    headless?: boolean;
    args?: string[];
  };
  /**
   * Directory to persist rendered SVGs across builds.
   * Defaults to os.tmpdir(). Set to a project-relative path and cache it in
   * CI (e.g. actions/cache) to skip re-rendering unchanged diagrams.
   */
  cacheDir?: string;
  /**
   * Maximum number of diagrams rendered in parallel within a single browser.
   * Lower values reduce memory pressure on CI; higher values speed up large sites.
   * Defaults to 5.
   */
  concurrency?: number;
}

export const defaultOptions: RehypeMermaidOptions = {
  renderThemes: ["default"],
  concurrency: Math.max(1, os.cpus().length),
};

// ---------- Plugin ----------
export const rehypeMermaidCLI: Plugin<[RehypeMermaidOptions?], Root> = (
  _options
) => {
  const options = { ...defaultOptions, ..._options };
  const cacheDir = options.cacheDir ?? os.tmpdir();
  const concurrency = options.concurrency ?? 5;

  return async (ast, _file) => {
    const diagrams: {
      diagram: string;
      id: string;
      node: HastElement;
      ancestors: Parent[];
    }[] = [];

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

    if (diagrams.length === 0) return;

    await fs.mkdir(cacheDir, { recursive: true });

    // Collect (diagram, theme) pairs that are not already cached
    type RenderJob = { diagram: string; theme: Theme; cachePath: string; svgId: string };
    const jobs: RenderJob[] = [];
    for (const { diagram } of diagrams) {
      for (const theme of options.renderThemes) {
        const svgId = getDiagramIdWithTheme(diagram, theme, options.mermaidConfig);
        const cachePath = path.join(cacheDir, `${svgId}.svg`);
        if (!(await fileExists(cachePath))) {
          jobs.push({ diagram, theme, cachePath, svgId });
        }
      }
    }

    // Launch one browser for all uncached renders
    if (jobs.length > 0) {
      const browser = await puppeteer.launch({
        headless: options.puppeteerConfig?.headless ?? true,
        args: options.puppeteerConfig?.args ?? [],
      });

      try {
        await runWithConcurrency(jobs, concurrency, async (job) => {
          const resolvedConfig: MermaidConfig = {
            theme: job.theme,
            ...options.mermaidConfig,
          };
          const { data } = await renderMermaid(browser, job.diagram, "svg", {
            backgroundColor: "transparent",
            mermaidConfig: resolvedConfig,
            svgId: job.svgId,
          });
          await fs.writeFile(job.cachePath, Buffer.from(data).toString("utf8"), "utf8");
        });
      } finally {
        await browser.close();
      }
    }

    // Apply cached SVGs to AST
    await Promise.all(
      diagrams.map(async ({ diagram, id, node, ancestors }) => {
        const svgByTheme: Record<Theme, string> = Object.fromEntries(
          await Promise.all(
            options.renderThemes.map(async (theme) => {
              const svgId = getDiagramIdWithTheme(diagram, theme, options.mermaidConfig);
              const cachePath = path.join(cacheDir, `${svgId}.svg`);
              return [theme, await fs.readFile(cachePath, "utf8")] as const;
            })
          )
        ) as Record<Theme, string>;

        applyThemeAST(node, svgByTheme, id, ancestors, options.svgClassNames);
      })
    );
  };
};

export default rehypeMermaidCLI;

// ---------- Helpers ----------

function getDiagramId(diagram: string) {
  return `mermaid-${createHash("md5").update(diagram).digest("hex").slice(0, 8)}`;
}

function getDiagramIdWithTheme(diagram: string, theme: Theme, mermaidConfig?: MermaidConfig) {
  const hash = createHash("md5")
    .update(diagram)
    .update("\0")
    .update(theme)
    .update("\0")
    .update(mermaidConfig ? JSON.stringify(mermaidConfig) : "")
    .digest("hex")
    .slice(0, 16);
  return `mermaid-${hash}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Worker-pool concurrency: runs fn over all items with at most `limit`
 * concurrent executions at any time, without external dependencies.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

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
        style: index === 0 ? "display: block;" : "display: none;",
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
