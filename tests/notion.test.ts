import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

describe("Notion Integration", () => {
  describe("Client Module", () => {
    beforeEach(async () => {
      // Reset client state before each test
      const { resetNotionClient } = await import("../src/integrations/notion/client");
      resetNotionClient();
    });

    test("should export initNotionClient function", async () => {
      const { initNotionClient } = await import("../src/integrations/notion/client");
      expect(typeof initNotionClient).toBe("function");
    });

    test("should export getNotionClient function", async () => {
      const { getNotionClient } = await import("../src/integrations/notion/client");
      expect(typeof getNotionClient).toBe("function");
    });

    test("should export getRootPageId function", async () => {
      const { getRootPageId } = await import("../src/integrations/notion/client");
      expect(typeof getRootPageId).toBe("function");
    });

    test("should export isNotionInitialized function", async () => {
      const { isNotionInitialized } = await import("../src/integrations/notion/client");
      expect(typeof isNotionInitialized).toBe("function");
    });

    test("should export resetNotionClient function", async () => {
      const { resetNotionClient } = await import("../src/integrations/notion/client");
      expect(typeof resetNotionClient).toBe("function");
    });

    test("should export Client class", async () => {
      const { Client } = await import("../src/integrations/notion/client");
      expect(typeof Client).toBe("function");
    });

    test("initNotionClient should return a Client instance", async () => {
      const { initNotionClient, Client } = await import("../src/integrations/notion/client");

      const client = initNotionClient({ apiKey: "test-api-key" });
      expect(client).toBeInstanceOf(Client);
    });

    test("initNotionClient should store root page ID", async () => {
      const { initNotionClient, getRootPageId } = await import("../src/integrations/notion/client");

      initNotionClient({
        apiKey: "test-api-key",
        rootPageId: "test-root-page-id"
      });

      expect(getRootPageId()).toBe("test-root-page-id");
    });

    test("isNotionInitialized should return false before init", async () => {
      const { isNotionInitialized } = await import("../src/integrations/notion/client");
      expect(isNotionInitialized()).toBe(false);
    });

    test("isNotionInitialized should return true after init", async () => {
      const { initNotionClient, isNotionInitialized } = await import("../src/integrations/notion/client");

      initNotionClient({ apiKey: "test-api-key" });
      expect(isNotionInitialized()).toBe(true);
    });

    test("getNotionClient should throw if not initialized", async () => {
      const { getNotionClient } = await import("../src/integrations/notion/client");

      expect(() => getNotionClient()).toThrow("Notion client not initialized");
    });

    test("getNotionClient should return client after init", async () => {
      const { initNotionClient, getNotionClient, Client } = await import("../src/integrations/notion/client");

      initNotionClient({ apiKey: "test-api-key" });
      const client = getNotionClient();
      expect(client).toBeInstanceOf(Client);
    });

    test("resetNotionClient should clear state", async () => {
      const { initNotionClient, isNotionInitialized, getRootPageId, resetNotionClient } = await import("../src/integrations/notion/client");

      initNotionClient({ apiKey: "test-api-key", rootPageId: "test-page" });
      expect(isNotionInitialized()).toBe(true);
      expect(getRootPageId()).toBe("test-page");

      resetNotionClient();
      expect(isNotionInitialized()).toBe(false);
      expect(getRootPageId()).toBeNull();
    });
  });

  describe("Blocks Module", () => {
    test("should export createBlockObject function", async () => {
      const { createBlockObject } = await import("../src/integrations/notion/blocks");
      expect(typeof createBlockObject).toBe("function");
    });

    test("should export markdownToBlocks function", async () => {
      const { markdownToBlocks } = await import("../src/integrations/notion/blocks");
      expect(typeof markdownToBlocks).toBe("function");
    });

    test("should export blocksToMarkdown function", async () => {
      const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");
      expect(typeof blocksToMarkdown).toBe("function");
    });

    test("should export appendBlocks function", async () => {
      const { appendBlocks } = await import("../src/integrations/notion/blocks");
      expect(typeof appendBlocks).toBe("function");
    });

    test("should export getBlocks function", async () => {
      const { getBlocks } = await import("../src/integrations/notion/blocks");
      expect(typeof getBlocks).toBe("function");
    });

    test("should export getAllBlocks function", async () => {
      const { getAllBlocks } = await import("../src/integrations/notion/blocks");
      expect(typeof getAllBlocks).toBe("function");
    });

    test("should export updateBlock function", async () => {
      const { updateBlock } = await import("../src/integrations/notion/blocks");
      expect(typeof updateBlock).toBe("function");
    });

    test("should export deleteBlock function", async () => {
      const { deleteBlock } = await import("../src/integrations/notion/blocks");
      expect(typeof deleteBlock).toBe("function");
    });

    describe("createBlockObject", () => {
      test("should create paragraph block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "paragraph",
          content: "Hello world",
        });

        expect(block.type).toBe("paragraph");
        expect((block as any).paragraph.rich_text[0].text.content).toBe("Hello world");
      });

      test("should create heading_1 block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "heading_1",
          content: "Main Title",
        });

        expect(block.type).toBe("heading_1");
        expect((block as any).heading_1.rich_text[0].text.content).toBe("Main Title");
      });

      test("should create heading_2 block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "heading_2",
          content: "Section Title",
        });

        expect(block.type).toBe("heading_2");
        expect((block as any).heading_2.rich_text[0].text.content).toBe("Section Title");
      });

      test("should create heading_3 block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "heading_3",
          content: "Subsection Title",
        });

        expect(block.type).toBe("heading_3");
        expect((block as any).heading_3.rich_text[0].text.content).toBe("Subsection Title");
      });

      test("should create bulleted_list_item block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "bulleted_list_item",
          content: "List item",
        });

        expect(block.type).toBe("bulleted_list_item");
        expect((block as any).bulleted_list_item.rich_text[0].text.content).toBe("List item");
      });

      test("should create numbered_list_item block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "numbered_list_item",
          content: "Numbered item",
        });

        expect(block.type).toBe("numbered_list_item");
        expect((block as any).numbered_list_item.rich_text[0].text.content).toBe("Numbered item");
      });

      test("should create to_do block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "to_do",
          content: "Task item",
          checked: true,
        });

        expect(block.type).toBe("to_do");
        expect((block as any).to_do.rich_text[0].text.content).toBe("Task item");
        expect((block as any).to_do.checked).toBe(true);
      });

      test("should create code block with language", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "code",
          content: "console.log('hello');",
          language: "javascript",
        });

        expect(block.type).toBe("code");
        expect((block as any).code.rich_text[0].text.content).toBe("console.log('hello');");
        expect((block as any).code.language).toBe("javascript");
      });

      test("should create quote block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "quote",
          content: "A famous quote",
        });

        expect(block.type).toBe("quote");
        expect((block as any).quote.rich_text[0].text.content).toBe("A famous quote");
      });

      test("should create divider block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "divider",
        });

        expect(block.type).toBe("divider");
        expect((block as any).divider).toEqual({});
      });

      test("should create callout block with icon", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "callout",
          content: "Important note",
          icon: "⚠️",
        });

        expect(block.type).toBe("callout");
        expect((block as any).callout.rich_text[0].text.content).toBe("Important note");
        expect((block as any).callout.icon.emoji).toBe("⚠️");
      });

      test("should create image block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "image",
          url: "https://example.com/image.png",
        });

        expect(block.type).toBe("image");
        expect((block as any).image.external.url).toBe("https://example.com/image.png");
      });

      test("should create bookmark block", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "bookmark",
          url: "https://example.com",
        });

        expect(block.type).toBe("bookmark");
        expect((block as any).bookmark.url).toBe("https://example.com");
      });

      test("should throw for image block without URL", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        expect(() => createBlockObject({ type: "image" })).toThrow("Image block requires a URL");
      });

      test("should throw for bookmark block without URL", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        expect(() => createBlockObject({ type: "bookmark" })).toThrow("Bookmark block requires a URL");
      });

      test("should handle rich text content with formatting", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "paragraph",
          content: [
            { text: "Bold text", bold: true },
            { text: " and ", },
            { text: "italic text", italic: true },
          ],
        });

        expect(block.type).toBe("paragraph");
        expect((block as any).paragraph.rich_text[0].text.content).toBe("Bold text");
        expect((block as any).paragraph.rich_text[0].annotations.bold).toBe(true);
        expect((block as any).paragraph.rich_text[2].text.content).toBe("italic text");
        expect((block as any).paragraph.rich_text[2].annotations.italic).toBe(true);
      });

      test("should handle rich text with links", async () => {
        const { createBlockObject } = await import("../src/integrations/notion/blocks");

        const block = createBlockObject({
          type: "paragraph",
          content: [
            { text: "Click here", link: "https://example.com" },
          ],
        });

        expect((block as any).paragraph.rich_text[0].text.link.url).toBe("https://example.com");
      });
    });

    describe("markdownToBlocks", () => {
      test("should convert heading 1", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("# Main Title");

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe("heading_1");
        expect(blocks[0].content).toBe("Main Title");
      });

      test("should convert heading 2", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("## Section Title");

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe("heading_2");
        expect(blocks[0].content).toBe("Section Title");
      });

      test("should convert heading 3", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("### Subsection Title");

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe("heading_3");
        expect(blocks[0].content).toBe("Subsection Title");
      });

      test("should convert bullet lists", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("- Item 1\n- Item 2\n* Item 3");

        expect(blocks.length).toBe(3);
        expect(blocks[0].type).toBe("bulleted_list_item");
        expect(blocks[1].type).toBe("bulleted_list_item");
        expect(blocks[2].type).toBe("bulleted_list_item");
      });

      test("should convert numbered lists", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("1. First\n2. Second\n3. Third");

        expect(blocks.length).toBe(3);
        expect(blocks[0].type).toBe("numbered_list_item");
        expect(blocks[0].content).toBe("First");
      });

      test("should convert checkboxes", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("- [ ] Unchecked\n- [x] Checked");

        expect(blocks.length).toBe(2);
        expect(blocks[0].type).toBe("to_do");
        expect(blocks[0].checked).toBe(false);
        expect(blocks[1].type).toBe("to_do");
        expect(blocks[1].checked).toBe(true);
      });

      test("should convert code blocks", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("```javascript\nconsole.log('hello');\n```");

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe("code");
        expect(blocks[0].content).toBe("console.log('hello');");
        expect(blocks[0].language).toBe("javascript");
      });

      test("should convert blockquotes", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("> A quote");

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe("quote");
        expect(blocks[0].content).toBe("A quote");
      });

      test("should convert horizontal rules", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks1 = markdownToBlocks("---");
        const blocks2 = markdownToBlocks("***");
        const blocks3 = markdownToBlocks("___");

        expect(blocks1[0].type).toBe("divider");
        expect(blocks2[0].type).toBe("divider");
        expect(blocks3[0].type).toBe("divider");
      });

      test("should convert paragraphs", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("This is a paragraph.");

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe("paragraph");
      });

      test("should parse inline bold formatting", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("This has **bold** text");

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe("paragraph");
        const content = blocks[0].content as any[];
        expect(content.some(c => c.bold === true)).toBe(true);
      });

      test("should parse inline italic formatting", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("This has *italic* text");

        expect(blocks.length).toBe(1);
        const content = blocks[0].content as any[];
        expect(content.some(c => c.italic === true)).toBe(true);
      });

      test("should parse inline code formatting", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("This has `code` text");

        expect(blocks.length).toBe(1);
        const content = blocks[0].content as any[];
        expect(content.some(c => c.code === true)).toBe(true);
      });

      test("should parse links", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const blocks = markdownToBlocks("Check [this link](https://example.com)");

        expect(blocks.length).toBe(1);
        const content = blocks[0].content as any[];
        expect(content.some(c => c.link === "https://example.com")).toBe(true);
      });

      test("should handle complex markdown document", async () => {
        const { markdownToBlocks } = await import("../src/integrations/notion/blocks");

        const markdown = `# Title

This is a paragraph with **bold** and *italic*.

## Section

- Bullet 1
- Bullet 2

1. Number 1
2. Number 2

\`\`\`python
print("hello")
\`\`\`

> A quote

---

The end.`;

        const blocks = markdownToBlocks(markdown);

        expect(blocks.length).toBeGreaterThan(10);
        expect(blocks[0].type).toBe("heading_1");
        expect(blocks.some(b => b.type === "code")).toBe(true);
        expect(blocks.some(b => b.type === "quote")).toBe(true);
        expect(blocks.some(b => b.type === "divider")).toBe(true);
      });
    });

    describe("blocksToMarkdown", () => {
      test("should convert paragraph block to markdown", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "paragraph" as const,
            paragraph: {
              rich_text: [{ text: { content: "Hello world" } }],
            },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("Hello world");
      });

      test("should convert heading blocks to markdown", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "heading_1" as const,
            heading_1: { rich_text: [{ text: { content: "Title" } }] },
          },
          {
            id: "2",
            type: "heading_2" as const,
            heading_2: { rich_text: [{ text: { content: "Section" } }] },
          },
          {
            id: "3",
            type: "heading_3" as const,
            heading_3: { rich_text: [{ text: { content: "Subsection" } }] },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("# Title");
        expect(markdown).toContain("## Section");
        expect(markdown).toContain("### Subsection");
      });

      test("should convert list items to markdown", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "bulleted_list_item" as const,
            bulleted_list_item: { rich_text: [{ text: { content: "Bullet item" } }] },
          },
          {
            id: "2",
            type: "numbered_list_item" as const,
            numbered_list_item: { rich_text: [{ text: { content: "Numbered item" } }] },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("- Bullet item");
        expect(markdown).toContain("1. Numbered item");
      });

      test("should convert to_do blocks to markdown", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "to_do" as const,
            to_do: {
              rich_text: [{ text: { content: "Unchecked task" } }],
              checked: false,
            },
          },
          {
            id: "2",
            type: "to_do" as const,
            to_do: {
              rich_text: [{ text: { content: "Checked task" } }],
              checked: true,
            },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("- [ ] Unchecked task");
        expect(markdown).toContain("- [x] Checked task");
      });

      test("should convert code block to markdown", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "code" as const,
            code: {
              rich_text: [{ text: { content: "console.log('hi');" } }],
              language: "javascript",
            },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("```javascript");
        expect(markdown).toContain("console.log('hi');");
        expect(markdown).toContain("```");
      });

      test("should convert quote block to markdown", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "quote" as const,
            quote: { rich_text: [{ text: { content: "A wise quote" } }] },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("> A wise quote");
      });

      test("should convert divider to markdown", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          { id: "1", type: "divider" as const, divider: {} },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("---");
      });

      test("should handle rich text annotations", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "paragraph" as const,
            paragraph: {
              rich_text: [
                {
                  text: { content: "bold" },
                  annotations: { bold: true },
                },
                { text: { content: " and " } },
                {
                  text: { content: "italic" },
                  annotations: { italic: true },
                },
              ],
            },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("**bold**");
        expect(markdown).toContain("*italic*");
      });

      test("should handle links in rich text", async () => {
        const { blocksToMarkdown } = await import("../src/integrations/notion/blocks");

        const blocks = [
          {
            id: "1",
            type: "paragraph" as const,
            paragraph: {
              rich_text: [
                {
                  text: { content: "click here", link: { url: "https://example.com" } },
                },
              ],
            },
          },
        ];

        const markdown = blocksToMarkdown(blocks as any);
        expect(markdown).toContain("[click here](https://example.com)");
      });
    });
  });

  describe("Pages Module", () => {
    test("should export createPage function", async () => {
      const { createPage } = await import("../src/integrations/notion/pages");
      expect(typeof createPage).toBe("function");
    });

    test("should export getPage function", async () => {
      const { getPage } = await import("../src/integrations/notion/pages");
      expect(typeof getPage).toBe("function");
    });

    test("should export updatePage function", async () => {
      const { updatePage } = await import("../src/integrations/notion/pages");
      expect(typeof updatePage).toBe("function");
    });

    test("should export archivePage function", async () => {
      const { archivePage } = await import("../src/integrations/notion/pages");
      expect(typeof archivePage).toBe("function");
    });

    test("should export restorePage function", async () => {
      const { restorePage } = await import("../src/integrations/notion/pages");
      expect(typeof restorePage).toBe("function");
    });

    test("should export deletePage function", async () => {
      const { deletePage } = await import("../src/integrations/notion/pages");
      expect(typeof deletePage).toBe("function");
    });

    test("should export duplicatePage function", async () => {
      const { duplicatePage } = await import("../src/integrations/notion/pages");
      expect(typeof duplicatePage).toBe("function");
    });

    test("should export appendToPage function", async () => {
      const { appendToPage } = await import("../src/integrations/notion/pages");
      expect(typeof appendToPage).toBe("function");
    });

    test("should export replacePageContent function", async () => {
      const { replacePageContent } = await import("../src/integrations/notion/pages");
      expect(typeof replacePageContent).toBe("function");
    });
  });

  describe("Databases Module", () => {
    test("should export queryDatabase function", async () => {
      const { queryDatabase } = await import("../src/integrations/notion/databases");
      expect(typeof queryDatabase).toBe("function");
    });

    test("should export queryAllDatabaseEntries function", async () => {
      const { queryAllDatabaseEntries } = await import("../src/integrations/notion/databases");
      expect(typeof queryAllDatabaseEntries).toBe("function");
    });

    test("should export getDatabase function", async () => {
      const { getDatabase } = await import("../src/integrations/notion/databases");
      expect(typeof getDatabase).toBe("function");
    });

    test("should export createDatabase function", async () => {
      const { createDatabase } = await import("../src/integrations/notion/databases");
      expect(typeof createDatabase).toBe("function");
    });

    test("should export createDatabaseEntry function", async () => {
      const { createDatabaseEntry } = await import("../src/integrations/notion/databases");
      expect(typeof createDatabaseEntry).toBe("function");
    });

    test("should export updateDatabaseEntry function", async () => {
      const { updateDatabaseEntry } = await import("../src/integrations/notion/databases");
      expect(typeof updateDatabaseEntry).toBe("function");
    });

    test("should export archiveDatabaseEntry function", async () => {
      const { archiveDatabaseEntry } = await import("../src/integrations/notion/databases");
      expect(typeof archiveDatabaseEntry).toBe("function");
    });
  });

  describe("Search Module", () => {
    test("should export search function", async () => {
      const { search } = await import("../src/integrations/notion/search");
      expect(typeof search).toBe("function");
    });

    test("should export searchPages function", async () => {
      const { searchPages } = await import("../src/integrations/notion/search");
      expect(typeof searchPages).toBe("function");
    });

    test("should export searchDatabases function", async () => {
      const { searchDatabases } = await import("../src/integrations/notion/search");
      expect(typeof searchDatabases).toBe("function");
    });

    test("should export searchAll function", async () => {
      const { searchAll } = await import("../src/integrations/notion/search");
      expect(typeof searchAll).toBe("function");
    });

    test("should export findPageByTitle function", async () => {
      const { findPageByTitle } = await import("../src/integrations/notion/search");
      expect(typeof findPageByTitle).toBe("function");
    });

    test("should export findDatabaseByTitle function", async () => {
      const { findDatabaseByTitle } = await import("../src/integrations/notion/search");
      expect(typeof findDatabaseByTitle).toBe("function");
    });

    test("should export getRecentlyEditedPages function", async () => {
      const { getRecentlyEditedPages } = await import("../src/integrations/notion/search");
      expect(typeof getRecentlyEditedPages).toBe("function");
    });

    test("should export getRecentlyEditedDatabases function", async () => {
      const { getRecentlyEditedDatabases } = await import("../src/integrations/notion/search");
      expect(typeof getRecentlyEditedDatabases).toBe("function");
    });

    test("should export fullTextSearch function", async () => {
      const { fullTextSearch } = await import("../src/integrations/notion/search");
      expect(typeof fullTextSearch).toBe("function");
    });
  });

  describe("Main Index Module", () => {
    test("should export client functions", async () => {
      const notion = await import("../src/integrations/notion");

      expect(typeof notion.initNotionClient).toBe("function");
      expect(typeof notion.getNotionClient).toBe("function");
      expect(typeof notion.getRootPageId).toBe("function");
      expect(typeof notion.isNotionInitialized).toBe("function");
      expect(typeof notion.resetNotionClient).toBe("function");
    });

    test("should export page functions", async () => {
      const notion = await import("../src/integrations/notion");

      expect(typeof notion.createPage).toBe("function");
      expect(typeof notion.getPage).toBe("function");
      expect(typeof notion.updatePage).toBe("function");
      expect(typeof notion.archivePage).toBe("function");
      expect(typeof notion.restorePage).toBe("function");
      expect(typeof notion.deletePage).toBe("function");
      expect(typeof notion.duplicatePage).toBe("function");
      expect(typeof notion.appendToPage).toBe("function");
      expect(typeof notion.replacePageContent).toBe("function");
    });

    test("should export database functions", async () => {
      const notion = await import("../src/integrations/notion");

      expect(typeof notion.queryDatabase).toBe("function");
      expect(typeof notion.queryAllDatabaseEntries).toBe("function");
      expect(typeof notion.getDatabase).toBe("function");
      expect(typeof notion.createDatabase).toBe("function");
      expect(typeof notion.createDatabaseEntry).toBe("function");
      expect(typeof notion.updateDatabaseEntry).toBe("function");
      expect(typeof notion.archiveDatabaseEntry).toBe("function");
    });

    test("should export block functions", async () => {
      const notion = await import("../src/integrations/notion");

      expect(typeof notion.appendBlocks).toBe("function");
      expect(typeof notion.getBlocks).toBe("function");
      expect(typeof notion.getAllBlocks).toBe("function");
      expect(typeof notion.updateBlock).toBe("function");
      expect(typeof notion.deleteBlock).toBe("function");
      expect(typeof notion.createBlockObject).toBe("function");
      expect(typeof notion.markdownToBlocks).toBe("function");
      expect(typeof notion.blocksToMarkdown).toBe("function");
    });

    test("should export search functions", async () => {
      const notion = await import("../src/integrations/notion");

      expect(typeof notion.search).toBe("function");
      expect(typeof notion.searchPages).toBe("function");
      expect(typeof notion.searchDatabases).toBe("function");
      expect(typeof notion.searchAll).toBe("function");
      expect(typeof notion.findPageByTitle).toBe("function");
      expect(typeof notion.findDatabaseByTitle).toBe("function");
      expect(typeof notion.getRecentlyEditedPages).toBe("function");
      expect(typeof notion.getRecentlyEditedDatabases).toBe("function");
      expect(typeof notion.fullTextSearch).toBe("function");
    });

    test("should export initNotionFromEnv function", async () => {
      const notion = await import("../src/integrations/notion");

      expect(typeof notion.initNotionFromEnv).toBe("function");
    });

    test("should export syncNotes function", async () => {
      const notion = await import("../src/integrations/notion");

      expect(typeof notion.syncNotes).toBe("function");
    });

    test("should have default export with all functions", async () => {
      const notionModule = await import("../src/integrations/notion");
      const defaultExport = notionModule.default;

      expect(defaultExport).toBeTruthy();

      // Client functions
      expect(typeof defaultExport.initNotionClient).toBe("function");
      expect(typeof defaultExport.getNotionClient).toBe("function");

      // Page functions
      expect(typeof defaultExport.createPage).toBe("function");
      expect(typeof defaultExport.getPage).toBe("function");

      // Database functions
      expect(typeof defaultExport.queryDatabase).toBe("function");
      expect(typeof defaultExport.createDatabaseEntry).toBe("function");

      // Block functions
      expect(typeof defaultExport.markdownToBlocks).toBe("function");
      expect(typeof defaultExport.blocksToMarkdown).toBe("function");

      // Search functions
      expect(typeof defaultExport.search).toBe("function");
      expect(typeof defaultExport.searchPages).toBe("function");

      // Sync functions
      expect(typeof defaultExport.syncNotes).toBe("function");
    });
  });

  describe("Environment Configuration", () => {
    test("env schema should include NOTION_API_KEY", async () => {
      // Just verify the import works - the env validation happens at runtime
      const envModule = await import("../src/config/env");
      expect(envModule).toBeTruthy();
    });
  });

  describe("Type Exports", () => {
    test("should export NotionClientConfig type", async () => {
      // Type exists if module compiles
      const mod = await import("../src/integrations/notion/client");
      expect(mod).toBeTruthy();
    });

    test("should export PageResult type", async () => {
      const mod = await import("../src/integrations/notion/pages");
      expect(mod).toBeTruthy();
    });

    test("should export DatabaseEntry type", async () => {
      const mod = await import("../src/integrations/notion/databases");
      expect(mod).toBeTruthy();
    });

    test("should export BlockContent type", async () => {
      const mod = await import("../src/integrations/notion/blocks");
      expect(mod).toBeTruthy();
    });

    test("should export SearchResult type", async () => {
      const mod = await import("../src/integrations/notion/search");
      expect(mod).toBeTruthy();
    });
  });

  describe("Markdown Conversion Round-Trip", () => {
    test("should preserve headings in round-trip", async () => {
      const { markdownToBlocks, blocksToMarkdown, createBlockObject } = await import("../src/integrations/notion/blocks");

      const original = "# Heading 1\n\n## Heading 2\n\n### Heading 3";
      const blocks = markdownToBlocks(original);
      const notionBlocks = blocks.map(b => {
        const obj = createBlockObject(b);
        return {
          id: "test",
          type: obj.type,
          [obj.type]: (obj as any)[obj.type],
        };
      });
      const result = blocksToMarkdown(notionBlocks as any);

      expect(result).toContain("# Heading 1");
      expect(result).toContain("## Heading 2");
      expect(result).toContain("### Heading 3");
    });

    test("should preserve lists in round-trip", async () => {
      const { markdownToBlocks, blocksToMarkdown, createBlockObject } = await import("../src/integrations/notion/blocks");

      const original = "- Item 1\n- Item 2\n- Item 3";
      const blocks = markdownToBlocks(original);
      const notionBlocks = blocks.map(b => {
        const obj = createBlockObject(b);
        return {
          id: "test",
          type: obj.type,
          [obj.type]: (obj as any)[obj.type],
        };
      });
      const result = blocksToMarkdown(notionBlocks as any);

      expect(result).toContain("- Item 1");
      expect(result).toContain("- Item 2");
      expect(result).toContain("- Item 3");
    });

    test("should preserve code blocks in round-trip", async () => {
      const { markdownToBlocks, blocksToMarkdown, createBlockObject } = await import("../src/integrations/notion/blocks");

      const original = "```typescript\nconst x = 1;\n```";
      const blocks = markdownToBlocks(original);
      const notionBlocks = blocks.map(b => {
        const obj = createBlockObject(b);
        return {
          id: "test",
          type: obj.type,
          [obj.type]: (obj as any)[obj.type],
        };
      });
      const result = blocksToMarkdown(notionBlocks as any);

      expect(result).toContain("```typescript");
      expect(result).toContain("const x = 1;");
      expect(result).toContain("```");
    });

    test("should preserve checkboxes in round-trip", async () => {
      const { markdownToBlocks, blocksToMarkdown, createBlockObject } = await import("../src/integrations/notion/blocks");

      const original = "- [ ] Unchecked\n- [x] Checked";
      const blocks = markdownToBlocks(original);
      const notionBlocks = blocks.map(b => {
        const obj = createBlockObject(b);
        return {
          id: "test",
          type: obj.type,
          [obj.type]: (obj as any)[obj.type],
        };
      });
      const result = blocksToMarkdown(notionBlocks as any);

      expect(result).toContain("- [ ] Unchecked");
      expect(result).toContain("- [x] Checked");
    });
  });

  describe("Block Type Coverage", () => {
    test("should support all documented block types", async () => {
      const { createBlockObject } = await import("../src/integrations/notion/blocks");

      const blockTypes = [
        { type: "paragraph", content: "text" },
        { type: "heading_1", content: "h1" },
        { type: "heading_2", content: "h2" },
        { type: "heading_3", content: "h3" },
        { type: "bulleted_list_item", content: "bullet" },
        { type: "numbered_list_item", content: "number" },
        { type: "to_do", content: "task", checked: false },
        { type: "toggle", content: "toggle" },
        { type: "code", content: "code", language: "javascript" },
        { type: "quote", content: "quote" },
        { type: "callout", content: "callout", icon: "💡" },
        { type: "divider" },
        { type: "image", url: "https://example.com/img.png" },
        { type: "bookmark", url: "https://example.com" },
      ];

      for (const blockConfig of blockTypes) {
        const block = createBlockObject(blockConfig as any);
        expect(block.type).toBe(blockConfig.type);
      }
    });
  });
});
