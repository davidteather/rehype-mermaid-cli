import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { rehypeMermaidCLI } from '../dist/index.js';

// Helper to get CI-friendly puppeteer config when needed
const getCIConfig = () => {
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    return {
      puppeteerConfig: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      }
    };
  }
  return {};
};

describe('rehype-mermaid-cli', () => {
  it('should render a simple mermaid diagram', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { renderThemes: ['default'], ...getCIConfig() })
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Check that the output contains expected elements
    expect(output).toContain('class="mermaid-wrapper"');
    expect(output).toContain('class="mermaid mermaid-default"');
    expect(output).toContain('<svg');
    expect(output).toContain('id="mermaid-');
  });

  it('should render multiple themes', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { renderThemes: ['default', 'dark'], ...getCIConfig() })
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Check that both themes are present
    expect(output).toContain('mermaid-default');
    expect(output).toContain('mermaid-dark');
    expect(output).toContain('display: block'); // First theme should be visible
    expect(output).toContain('display: none'); // Second theme should be hidden
  });

  it('should handle multiple diagrams', async () => {
    const html = `
      <pre><code class="language-mermaid">graph TD; A-->B;</code></pre>
      <pre><code class="language-mermaid">graph LR; X-->Y;</code></pre>
    `;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { renderThemes: ['default'], ...getCIConfig() })
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Should have two separate mermaid wrappers
    const wrapperMatches = output.match(/class="mermaid-wrapper"/g);
    expect(wrapperMatches).toHaveLength(2);
  });

  it('should ignore non-mermaid code blocks', async () => {
    const html = `<pre><code class="language-javascript">console.log('hello');</code></pre>`;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { renderThemes: ['default'], ...getCIConfig() })
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Should not contain mermaid wrapper
    expect(output).not.toContain('mermaid-wrapper');
    expect(output).toContain('language-javascript');
    expect(output).toContain("console.log('hello');");
  });

  it('should use default options when none provided', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI) // No options provided
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Should default to 'default' theme
    expect(output).toContain('mermaid-default');
    expect(output).not.toContain('mermaid-dark');
  });

  it('should generate consistent IDs for same diagram', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    const result1 = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { renderThemes: ['default'], ...getCIConfig() })
      .use(rehypeStringify)
      .process(html);

    const result2 = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { renderThemes: ['default'], ...getCIConfig() })
      .use(rehypeStringify)
      .process(html);

    const output1 = result1.toString();
    const output2 = result2.toString();
    
    // Extract the ID from both outputs
    const idMatch1 = output1.match(/id="(mermaid-[a-f0-9]+)"/);
    const idMatch2 = output2.match(/id="(mermaid-[a-f0-9]+)"/);
    
    expect(idMatch1).toBeTruthy();
    expect(idMatch2).toBeTruthy();
    expect(idMatch1![1]).toBe(idMatch2![1]);
  });

  it('should apply custom SVG classes when specified', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    // Test with single class
    const result1 = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { 
        renderThemes: ['default'],
        svgClassNames: ['mx-auto'],
        ...getCIConfig()
      })
      .use(rehypeStringify)
      .process(html);

    const output1 = result1.toString();
    expect(output1).toContain('mx-auto');

    // Test with multiple classes
    const result2 = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { 
        renderThemes: ['default'],
        svgClassNames: ['mx-auto', 'max-w-full', 'h-auto'],
        ...getCIConfig()
      })
      .use(rehypeStringify)
      .process(html);

    const output2 = result2.toString();
    expect(output2).toContain('mx-auto');
    expect(output2).toContain('max-w-full');
    expect(output2).toContain('h-auto');
  });

  it('should not apply any classes when svgClassNames is not specified', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { renderThemes: ['default'], ...getCIConfig() })
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Should not contain mx-auto or any other custom classes
    expect(output).not.toContain('mx-auto');
    // But should still contain the SVG element
    expect(output).toContain('<svg');
  });

  it('should not apply classes when svgClassNames is empty array', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { 
        renderThemes: ['default'],
        svgClassNames: [],
        ...getCIConfig()
      })
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Should not contain mx-auto or any other custom classes
    expect(output).not.toContain('mx-auto');
    // But should still contain the SVG element
    expect(output).toContain('<svg');
  });

  it('should work with custom puppeteer config', async () => {
    const html = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeMermaidCLI, { 
        renderThemes: ['default'],
        puppeteerConfig: {
          headless: true,
          args: ['--no-sandbox'] // Test that custom args work
        }
      })
      .use(rehypeStringify)
      .process(html);

    const output = result.toString();
    
    // Should render successfully with custom puppeteer config
    expect(output).toContain('mermaid-wrapper');
    expect(output).toContain('<svg');
  });
});