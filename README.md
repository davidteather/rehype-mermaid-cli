# rehype-mermaid-cli

[![npm version](https://badge.fury.io/js/rehype-mermaid-cli.svg)](https://badge.fury.io/js/rehype-mermaid-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Rehype](https://github.com/rehypejs/rehype) plugin to render [Mermaid](https://mermaid.js.org/) diagrams in multiple themes using the Mermaid CLI. This plugin transforms code blocks with the `language-mermaid` class into beautiful SVG diagrams that can be styled with different themes.

**⚠️ Server-Side Only**: This plugin is designed for server-side rendering and static site generation at build time. It uses the Mermaid CLI with Puppeteer to generate SVG diagrams during the build process, not in the browser.

## Features

- 🎨 **Multiple Theme Support**: Render diagrams in different themes (default, dark, forest, etc.)
- 🚀 **Server-Side Rendering**: Uses Mermaid CLI for server-side diagram generation
- 🔒 **Consistent IDs**: Generates stable, hash-based IDs for diagrams
- 📦 **ESM Support**: ES Module support with TypeScript definitions
- ⚡ **Caching**: Built-in caching to avoid re-rendering identical diagrams

## Installation

```bash
npm install rehype-mermaid-cli
```

**Note**: This plugin requires Node.js 18 or higher and is designed for server-side use only (build-time processing).

## Usage

### Basic Usage

```javascript
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { rehypeMermaidCLI } from 'rehype-mermaid-cli';

const html = `<pre><code class="language-mermaid">
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
</code></pre>`;

const result = await unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeMermaidCLI, { 
    renderThemes: ['default'] 
  })
  .use(rehypeStringify)
  .process(html);

console.log(result.toString());
```

### Multiple Themes

You can render diagrams in multiple themes simultaneously:

```javascript
const result = await unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeMermaidCLI, { 
    renderThemes: ['default', 'dark', 'forest'] 
  })
  .use(rehypeStringify)
  .process(html);
```

This will generate multiple SVG versions of the same diagram, each with a different theme. The first theme will be visible by default, and you can use CSS or JavaScript to switch between themes.

### With Markdown Processing

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypeMermaidCLI } from 'rehype-mermaid-cli';

const result = await unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeMermaidCLI, { renderThemes: ['default', 'dark'] })
  .use(rehypeStringify)
  .process('```mermaid\ngraph TD; A-->B;\n```');
```

### Using with Astro

If you're interested in using this plugin with Astro, check out this blog post: [**Using Mermaid Diagrams in Astro with rehype-mermaid-cli**](https://dteather.com/blogs/astro-rehype-mermaid-cli)

## API

### Options

The plugin accepts an options object with the following properties:

#### `renderThemes`

- **Type**: `Array<Theme>`
- **Default**: `['default']`
- **Description**: Array of themes to render for each diagram

Available themes (same themes as mermaid-cli supports):
- `'default'` - Mermaid's default theme
- `'base'` - Base theme
- `'dark'` - Dark theme  
- `'forest'` - Forest theme
- `'neutral'` - Neutral theme
- `'null'` - Null theme (no styling)

### Example with All Options

```javascript
import { rehypeMermaidCLI } from 'rehype-mermaid-cli';

const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeMermaidCLI, {
    renderThemes: ['default', 'dark', 'forest']
  })
  .use(rehypeStringify);
```

## Output Structure

The plugin transforms code blocks into a structured HTML output:

### Input

```html
<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>
```

### Output

```html
<div class="mermaid-wrapper" id="mermaid-536b8b06">
  <div id="mermaid-default-mermaid-536b8b06" class="mermaid mermaid-default" style="display: block;">
    <svg><!-- SVG content for default theme --></svg>
  </div>
  <div id="mermaid-dark-mermaid-536b8b06" class="mermaid mermaid-dark" style="display: none;">
    <svg><!-- SVG content for dark theme --></svg>
  </div>
</div>
```

### CSS Classes

- `.mermaid-wrapper` - Container for all theme versions
- `.mermaid` - Individual diagram container
- `.mermaid-{theme}` - Theme-specific class (e.g., `.mermaid-default`, `.mermaid-dark`)
- `.mx-auto` - Added to SVG elements for center alignment

## Theme Switching

To implement theme switching, you can use CSS or JavaScript:

### CSS-based Theme Switching

```css
/* Hide all themes by default */
.mermaid {
  display: none;
}

/* Show default theme */
.theme-default .mermaid-default,
.mermaid-default {
  display: block;
}

/* Show dark theme when dark mode is active */
.theme-dark .mermaid-dark {
  display: block;
}

.theme-dark .mermaid-default {
  display: none;
}
```

### JavaScript Theme Switching

```javascript
function switchMermaidTheme(theme) {
  document.querySelectorAll('.mermaid').forEach(el => {
    el.style.display = 'none';
  });
  
  document.querySelectorAll(`.mermaid-${theme}`).forEach(el => {
    el.style.display = 'block';
  });
}

// Usage
switchMermaidTheme('dark');
```

## Supported Diagram Types

This plugin supports all [Mermaid diagram types](https://mermaid.js.org/intro/). For diagram syntax and examples, see the [official Mermaid documentation](https://mermaid.js.org/).

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Development Mode

```bash
npm run dev
```

## Requirements

- Node.js 18 or higher
- Server-side environment (this plugin cannot run in browsers)
- The Mermaid CLI package is included as a dependency
- Puppeteer dependencies (automatically installed with @mermaid-js/mermaid-cli)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [rehype](https://github.com/rehypejs/rehype) - HTML processor powered by plugins
- [mermaid](https://mermaid.js.org/) - Generation of diagram and flowchart from text
- [@mermaid-js/mermaid-cli](https://github.com/mermaid-js/mermaid-cli) - Command line interface for mermaid
- [unified](https://github.com/unifiedjs/unified) - Interface for processing text with syntax trees