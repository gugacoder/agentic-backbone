import { tool } from "ai";
import { z } from "zod";

const MAX_OUTPUT = 50_000;
const FETCH_TIMEOUT = 30_000;

/**
 * Converts HTML to a simplified markdown representation.
 * Handles common elements: headings, links, lists, paragraphs, code blocks, bold, italic.
 */
function htmlToMarkdown(html: string): string {
  let text = html;

  // Remove script, style, nav, footer, header tags and their content
  text = text.replace(/<(script|style|nav|footer|header|aside|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Headings
  text = text.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  text = text.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  text = text.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // Code blocks (pre > code)
  text = text.replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, "\n```\n$1\n```\n");
  text = text.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

  // Inline code
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Bold
  text = text.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");

  // Italic
  text = text.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

  // Links
  text = text.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Images
  text = text.replace(/<img\b[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, "![$1]($2)");
  text = text.replace(/<img\b[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  text = text.replace(/<img\b[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // List items
  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");

  // Unordered/ordered list wrappers
  text = text.replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n");

  // Paragraphs and divs
  text = text.replace(/<\/?p\b[^>]*>/gi, "\n");
  text = text.replace(/<\/?div\b[^>]*>/gi, "\n");

  // Line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Horizontal rules
  text = text.replace(/<hr\b[^>]*\/?>/gi, "\n---\n");

  // Table handling (basic)
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/?(table|thead|tbody|tfoot)\b[^>]*>/gi, "\n");
  text = text.replace(/<th\b[^>]*>([\s\S]*?)<\/th>/gi, "| **$1** ");
  text = text.replace(/<td\b[^>]*>([\s\S]*?)<\/td>/gi, "| $1 ");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  // Clean up whitespace: collapse multiple blank lines
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

export const webFetchTool = tool({
  description:
    "Fetches content from a URL and returns it as markdown/text. Converts HTML to markdown. Timeout: 30s. Max output: 50KB.",
  parameters: z.object({
    url: z.string().url().describe("The URL to fetch content from"),
    prompt: z
      .string()
      .optional()
      .describe("Extraction instruction — what to look for in the content"),
  }),
  execute: async ({ url, prompt }) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "AiSDK/1.0 (WebFetch tool)",
          Accept: "text/html, application/json, text/plain, */*",
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const rawBody = await response.text();

      let content: string;

      if (contentType.includes("text/html")) {
        content = htmlToMarkdown(rawBody);
      } else if (contentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(rawBody);
          content = JSON.stringify(parsed, null, 2);
        } catch {
          content = rawBody;
        }
      } else {
        content = rawBody;
      }

      if (content.length > MAX_OUTPUT) {
        content = content.slice(0, MAX_OUTPUT) + "\n...[truncated at 50KB]";
      }

      let result = `# Fetched: ${url}\n\n${content}`;

      if (prompt) {
        result = `# Fetched: ${url}\n# Extraction: ${prompt}\n\n${content}`;
      }

      return result;
    } catch (err: any) {
      if (err.name === "AbortError") {
        return `Error: Request timed out after ${FETCH_TIMEOUT / 1000}s`;
      }
      return `Error fetching URL: ${err.message}`;
    }
  },
});
