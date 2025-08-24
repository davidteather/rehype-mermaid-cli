# rehype-mermaid-cli

[![npm version](https://badge.fury.io/js/rehype-mermaid-cli.svg)](https://badge.fury.io/js/rehype-mermaid-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Rehype](https://github.com/rehypejs/rehype) plugin to render [Mermaid](https://mermaid.js.org/) diagrams in multiple themes using the Mermaid CLI.

**⚠️ Server-Side Only**: Uses Mermaid CLI with Puppeteer for build-time diagram generation.

## Features

- 🎨 **Multiple Theme Support** - Render diagrams in different themes
- 🚀 **Server-Side Rendering** - Build-time processing with Mermaid CLI
- 🔒 **Consistent IDs** - Hash-based stable diagram IDs
- 📦 **TypeScript Support** - Full type definitions included
- ⚡ **Caching** - Avoids re-rendering identical diagrams

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

### TypeScript Usage

```typescript
import { 
  rehypeMermaidCLI, 
  type RehypeMermaidOptions, 
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

### Exports

```typescript
import { 
  rehypeMermaidCLI,      // Main plugin
  type RehypeMermaidOptions, // Options interface
  type Theme,            // Theme type
  defaultOptions         // Default config
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