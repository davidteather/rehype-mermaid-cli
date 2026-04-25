# rehype-mermaid-cli

[![npm version](https://badge.fury.io/js/rehype-mermaid-cli.svg)](https://badge.fury.io/js/rehype-mermaid-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![NPM Downloads](https://img.shields.io/npm/d18m/rehype-mermaid-cli)


A [Rehype](https://github.com/rehypejs/rehype) plugin to render [Mermaid](https://mermaid.js.org/) diagrams in multiple themes using the Mermaid CLI.

**⚠️ Server-Side Only**: Uses Mermaid CLI with Puppeteer for build-time diagram generation.

## Features

- 🎨 **Multiple Theme Support** - Render diagrams in different themes
- 🚀 **Server-Side Rendering** - Build-time processing with Mermaid CLI
- 🔒 **Consistent IDs** - Hash-based stable diagram IDs
- 📦 **TypeScript Support** - Full type definitions included
- ⚡ **Caching** - Avoids re-rendering identical diagrams
- 🏎️ **Browser Reuse** - One shared Puppeteer browser per build, not one per diagram
- 🔢 **Bounded Concurrency** - Configurable parallel render limit to avoid OOM on CI

## Installation

```bash
npm install rehype-mermaid-cli
```

**Requirements**: Node.js 18+ (server-side only)

## Usage

### Basic Usage

```javascript
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { rehypeMermaidCLI } from 'rehype-mermaid-cli';

const result = await unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeMermaidCLI, { 
    renderThemes: ['default'] 
  })
  .use(rehypeStringify)
  .process(`<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`);
```

### Multiple Themes

```javascript
.use(rehypeMermaidCLI, { 
  renderThemes: ['default', 'dark', 'forest'] 
})
```

### Custom SVG Classes

```javascript
.use(rehypeMermaidCLI, {
  renderThemes: ['default'],
  svgClassNames: ['mx-auto', 'max-w-full'] // Add custom CSS classes
})
```

### Mermaid Config

Pass any [Mermaid configuration](https://mermaid.js.org/config/schema-docs/config.html) options, including `securityLevel`. `theme` is always set from `renderThemes` but all other keys are forwarded as-is. Changing this config automatically busts the render cache.

```javascript
// Enable loose security level (required for HTML labels / markdown strings)
.use(rehypeMermaidCLI, {
  renderThemes: ['default'],
  mermaidConfig: {
    securityLevel: 'loose'
  }
})

// Arbitrary mermaid config keys are also supported
.use(rehypeMermaidCLI, {
  renderThemes: ['default'],
  mermaidConfig: {
    securityLevel: 'loose',
    flowchart: { curve: 'basis' }
  }
})
```

### Puppeteer Configuration

```javascript
// Default (works in most environments)
.use(rehypeMermaidCLI, {
  renderThemes: ['default']
})

// For CI/Docker environments
.use(rehypeMermaidCLI, {
  renderThemes: ['default'],
  puppeteerConfig: {
    headless: true,
    args: ['--no-sandbox']
  }
})
```

### Cache Directory (CI / persistent builds)

By default rendered SVGs are written to `os.tmpdir()`, which is ephemeral per CI runner. Set `cacheDir` to a project-relative path and cache it between runs to skip re-rendering unchanged diagrams.

```javascript
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

.use(rehypeMermaidCLI, {
  renderThemes: ['default', 'dark'],
  cacheDir: path.join(__dirname, '.mermaid-cache'),
})
```

Then in your GitHub Actions workflow:

```yaml
- name: Restore Mermaid SVG cache
  uses: actions/cache@v4
  with:
    path: .mermaid-cache
    key: mermaid-svgs-${{ hashFiles('src/content/**/*.md') }}
    restore-keys: mermaid-svgs-

- name: Create Mermaid cache dir
  run: mkdir -p .mermaid-cache
```

### Concurrency

Cap how many diagrams render in parallel within the shared browser. Lower values reduce memory pressure on constrained CI runners.

```javascript
.use(rehypeMermaidCLI, {
  renderThemes: ['default'],
  concurrency: 3, // default: 5
})
```

### TypeScript Usage

```typescript
import { 
  rehypeMermaidCLI, 
  type RehypeMermaidOptions, 
  type MermaidConfig,
  type Theme 
} from 'rehype-mermaid-cli';

const options: RehypeMermaidOptions = {
  renderThemes: ['default', 'dark'],
  svgClassNames: ['custom-class']
};
```

## API

### Options

#### `renderThemes`
- **Type**: `Theme[]`
- **Default**: `['default']`
- **Description**: Array of themes to render

Available themes: `'default'`, `'base'`, `'dark'`, `'forest'`, `'neutral'`, `'null'`

#### `svgClassNames`
- **Type**: `string[]`
- **Default**: `undefined`
- **Description**: CSS class names to add to generated SVG elements

#### `mermaidConfig`
- **Type**: `MermaidConfig` (`{ securityLevel?: 'strict' | 'loose' | 'antiscript' | 'sandbox'; [key: string]: unknown }`)
- **Default**: `undefined`
- **Description**: Mermaid configuration options forwarded to the CLI. `theme` is always derived from `renderThemes`. Changing this config busts the render cache automatically.

Common values:
- `securityLevel: 'loose'` — required when diagram labels contain HTML or Mermaid markdown strings
- `securityLevel: 'strict'` — default Mermaid behavior (HTML-encodes labels)

#### `puppeteerConfig`
- **Type**: `{ headless?: boolean; args?: string[]; }`
- **Default**: `{ headless: true, args: [] }`
- **Description**: Puppeteer configuration for the headless browser

```javascript
// For CI/Docker environments
puppeteerConfig: {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
}

// For debugging (show browser)
puppeteerConfig: {
  headless: false
}
```

#### `cacheDir`
- **Type**: `string`
- **Default**: `os.tmpdir()`
- **Description**: Directory where rendered SVG files are persisted. Files are named by a hash of the diagram content + theme + mermaid config, so unchanged diagrams are never re-rendered. Set to a project-relative path and cache it in CI for fast incremental builds.

#### `concurrency`
- **Type**: `number`
- **Default**: `os.cpus().length` (number of logical CPU cores)
- **Description**: Maximum number of diagrams rendered in parallel within the shared browser. All renders for a given markdown file share one browser instance. Reduce this value if you see OOM errors on low-memory CI runners.

### Exports

```typescript
import { 
  rehypeMermaidCLI,          // Main plugin
  type RehypeMermaidOptions, // Options interface
  type MermaidConfig,        // Mermaid config interface
  type Theme,                // Theme type
  defaultOptions             // Default config
} from 'rehype-mermaid-cli';
```

## Output Structure

### Input
```html
<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>
```

### Output
```html
<div class="mermaid-wrapper" id="mermaid-536b8b06">
  <div class="mermaid mermaid-default" style="display: block;">
    <svg><!-- SVG content --></svg>
  </div>
</div>
```

### CSS Classes
- `.mermaid-wrapper` - Container for all theme versions
- `.mermaid` - Individual diagram container  
- `.mermaid-{theme}` - Theme-specific classes

## Theme Switching

### CSS Example
```css
.mermaid { display: none; }
.mermaid-default { display: block; }

.dark-mode .mermaid-default { display: none; }
.dark-mode .mermaid-dark { display: block; }
```

### JavaScript Example
```javascript
function switchTheme(theme) {
  document.querySelectorAll('.mermaid').forEach(el => el.style.display = 'none');
  document.querySelectorAll(`.mermaid-${theme}`).forEach(el => el.style.display = 'block');
}
```

## Development

```bash
npm run build    # Build
npm test         # Test
npm run dev      # Watch mode
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
