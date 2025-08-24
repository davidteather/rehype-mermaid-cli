import type { Plugin } from "unified";
import type { Root } from "hast";
type Theme = "default" | "base" | "dark" | "forest" | "neutral" | "null";
interface RehypeMermaidOptions {
    renderThemes: Theme[];
}
export declare const rehypeMermaidCLI: Plugin<[RehypeMermaidOptions?], Root>;
export default rehypeMermaidCLI;
//# sourceMappingURL=index.d.ts.map