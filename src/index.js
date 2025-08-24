import { run } from "@mermaid-js/mermaid-cli";
import { fromHtml } from "hast-util-from-html";
import { visitParents } from "unist-util-visit-parents";
import { toText } from "hast-util-to-text";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createHash } from "crypto";
// Default options for the plugin
const defaultOptions = {
    renderThemes: ["default"],
};
// ---------- Plugin ----------
export const rehypeMermaidCLI = (_options) => {
    const options = { ...defaultOptions, ..._options };
    return async (ast, _file) => {
        const diagrams = [];
        // Find all code blocks with language-mermaid
        visitParents(ast, "element", (node, ancestors) => {
            if (node.tagName === "code" &&
                Array.isArray(node.properties?.className) &&
                node.properties.className.includes("language-mermaid")) {
                const diagramText = toText(node, { whitespace: "pre" });
                const id = getDiagramId(diagramText);
                node.properties = { ...node.properties, id };
                diagrams.push({ diagram: diagramText, id, node, ancestors });
            }
        });
        // Render each diagram for all requested themes
        await Promise.all(diagrams.map(async ({ diagram, id, node, ancestors }) => {
            const svgByTheme = Object.fromEntries(await Promise.all(options.renderThemes.map(async (theme) => {
                const svg = await renderMermaidDiagram(diagram, theme);
                return [theme, svg];
            })));
            applyThemeAST(node, svgByTheme, id, ancestors);
        }));
    };
};
export default rehypeMermaidCLI;
// ---------- Helper functions ----------
/** Generate a stable ID for a diagram from its text */
function getDiagramId(diagram) {
    const hash = createHash("md5").update(diagram).digest("hex").slice(0, 8);
    return `mermaid-${hash}`;
}
/** Generate ID that includes theme (for caching multiple themes) */
function getDiagramIdWithTheme(diagram, theme) {
    const hash = createHash("md5").update(diagram).digest("hex").slice(0, 8);
    return `mermaid-${hash}-${theme}`;
}
/** Check if a file exists */
async function exists(path) {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
/** Render a Mermaid diagram to SVG using CLI */
async function renderMermaidDiagram(diagram, theme) {
    const id = getDiagramIdWithTheme(diagram, theme);
    const tmpDir = os.tmpdir();
    const inputFile = path.join(tmpDir, `${id}.mmd`);
    const finalOutput = path.join(tmpDir, `${getDiagramIdWithTheme(diagram, theme)}.svg`);
    // Return cached output if already exists
    if (await exists(finalOutput)) {
        return fs.readFile(finalOutput, "utf8");
    }
    await fs.writeFile(inputFile, diagram, "utf8");
    await run(inputFile, finalOutput, {
        parseMMDOptions: {
            backgroundColor: "transparent",
            mermaidConfig: {
                theme: theme,
            },
            svgId: id,
        },
        puppeteerConfig: {
            headless: 1,
            args: ["--no-sandbox"],
        },
    });
    return fs.readFile(finalOutput, "utf8");
}
/** Replace AST node with a wrapper containing multiple theme SVGs */
function applyThemeAST(node, svgByTheme, id, ancestors) {
    const themeDivs = Object.entries(svgByTheme).map(([theme, svg], index) => ({
        type: "element",
        tagName: "div",
        properties: {
            id: `mermaid-${theme}-${id}`,
            className: ["mermaid", `mermaid-${theme}`],
            style: index === 0 ? "display: block;" : "display: none;", // show first theme
        },
        children: parseSvg(svg),
    }));
    const wrapper = {
        type: "element",
        tagName: "div",
        properties: { className: ["mermaid-wrapper"], id },
        children: themeDivs,
    };
    // Replace original node or its <pre> parent in the AST
    let targetNode = node;
    let parentNode = ancestors?.[ancestors.length - 1];
    if (parentNode && parentNode.type === "element" && "tagName" in parentNode) {
        const parentElement = parentNode;
        if (parentElement.tagName === "pre") {
            targetNode = parentElement;
            parentNode = ancestors?.[ancestors.length - 2];
        }
    }
    if (parentNode && "children" in parentNode) {
        const index = parentNode.children.indexOf(targetNode);
        if (index !== -1)
            parentNode.children[index] = wrapper;
    }
}
/** Parse raw SVG string into HAST children */
function parseSvg(svgContent) {
    const tree = fromHtml(svgContent, { fragment: true });
    const svgElement = tree.children[0];
    if (svgElement.tagName === "svg") {
        svgElement.properties = {
            ...svgElement.properties,
            className: [
                ...(svgElement.properties?.className || []),
                "mx-auto",
            ],
        };
    }
    return tree.children;
}
//# sourceMappingURL=index.js.map