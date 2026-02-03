import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { executeCommand } from "./shell";
import {
  listDirectory,
  readFileContent,
  writeFileContent,
  searchFiles,
} from "./files";
import { navigateTo, searchGoogle, takeScreenshot as browserScreenshot } from "./browser";
import { webSearch, research } from "./web-search";
import { analyzeImage } from "./image-analysis";
import { performOCR, extractStructuredData } from "./ocr";
import { screenshotAndAnalyze, takeScreenshot as systemScreenshot } from "./screenshot";
import { generatePDF } from "./file-generation/pdf";
import { generateSpreadsheet } from "./file-generation/spreadsheet";
import { generateChart } from "./file-generation/charts";
import { generateDiagram, generateStructuredDiagram } from "./file-generation/diagrams";
import { spawnAgent, getAgent, cancelAgent } from "../core/agents/agent-manager";
import { renderMath, renderMathDocument } from "./rendering/math-renderer";
import { highlightCode, renderCode } from "./rendering/code-highlighter";
import { markdownToHtml, renderMarkdown } from "./rendering/markdown-renderer";
import {
  summarizeVideo,
  quickSummarizeVideo,
  detailedSummarizeVideo,
  extractKeyMoments,
  getVideoInfo,
} from "./video-summarization";

// Define tools for Claude
export const TOOLS: Tool[] = [
  {
    name: "execute_command",
    description:
      "Execute a shell command on the system. Use for system tasks, git operations, running scripts, etc. Some dangerous commands are blocked for safety.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        working_directory: {
          type: "string",
          description: "Optional working directory for the command",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The directory path to list",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file (creates or overwrites)",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to write to",
        },
        content: {
          type: "string",
          description: "The content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "search_files",
    description: "Search for files matching a glob pattern",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern to search for (e.g., '**/*.ts')",
        },
        base_path: {
          type: "string",
          description: "Base directory to search from",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "web_search",
    description: "Search the web for information",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "browse_url",
    description: "Navigate to a URL and extract its content",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to browse",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of the current browser page",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "analyze_image",
    description: "Analyze an image using AI vision. Can describe, extract information, or answer questions about images.",
    input_schema: {
      type: "object" as const,
      properties: {
        image_url: {
          type: "string",
          description: "URL of the image to analyze",
        },
        image_path: {
          type: "string",
          description: "Local file path of the image to analyze",
        },
        prompt: {
          type: "string",
          description: "What to analyze or ask about the image",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "ocr_document",
    description: "Extract text from an image or document using OCR",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the image or PDF file",
        },
        language: {
          type: "string",
          description: "Expected language of the text (default: English)",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "extract_document_data",
    description: "Extract structured data from documents like receipts, invoices, forms, or tables",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the document image",
        },
        data_type: {
          type: "string",
          enum: ["table", "form", "receipt", "invoice"],
          description: "Type of data to extract",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "screenshot_analyze",
    description: "Take a screenshot of the desktop and analyze it with AI",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "What to analyze or look for in the screenshot",
        },
        region: {
          type: "string",
          description: "Screen region: 'full', 'active_window', or coordinates 'x,y,width,height'",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "generate_pdf",
    description: "Generate a PDF document from markdown or HTML content",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The markdown or HTML content for the PDF",
        },
        filename: {
          type: "string",
          description: "Output filename for the PDF",
        },
        content_type: {
          type: "string",
          enum: ["markdown", "html"],
          description: "Type of content (default: markdown)",
        },
        title: {
          type: "string",
          description: "Document title",
        },
      },
      required: ["content", "filename"],
    },
  },
  {
    name: "generate_spreadsheet",
    description: "Generate a spreadsheet (Excel or CSV) from data",
    input_schema: {
      type: "object" as const,
      properties: {
        data: {
          type: "array",
          description: "Data rows (2D array or array of objects)",
        },
        filename: {
          type: "string",
          description: "Output filename (.xlsx or .csv)",
        },
        headers: {
          type: "array",
          description: "Column headers",
          items: { type: "string" },
        },
        sheet_name: {
          type: "string",
          description: "Name of the worksheet",
        },
      },
      required: ["data", "filename"],
    },
  },
  {
    name: "generate_chart",
    description: "Generate a chart as SVG",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["bar", "line", "pie", "doughnut", "scatter", "area"],
          description: "Type of chart",
        },
        labels: {
          type: "array",
          description: "Labels for data points",
          items: { type: "string" },
        },
        values: {
          type: "array",
          description: "Numeric values",
          items: { type: "number" },
        },
        title: {
          type: "string",
          description: "Chart title",
        },
        filename: {
          type: "string",
          description: "Output filename for the SVG",
        },
      },
      required: ["type", "labels", "values"],
    },
  },
  {
    name: "generate_diagram",
    description: "Generate a diagram using Mermaid syntax",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["flowchart", "sequence", "class", "state", "er", "gantt", "mindmap"],
          description: "Type of diagram",
        },
        mermaid_code: {
          type: "string",
          description: "Mermaid diagram code (if providing raw code)",
        },
        data: {
          type: "object",
          description: "Structured data for the diagram (alternative to mermaid_code)",
        },
        filename: {
          type: "string",
          description: "Output filename",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "spawn_agent",
    description: "Spawn a background agent to work on a task autonomously",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["research", "coding", "writing", "analysis"],
          description: "Type of agent to spawn",
        },
        objective: {
          type: "string",
          description: "The objective/task for the agent",
        },
        context: {
          type: "object",
          description: "Additional context for the agent",
        },
        token_budget: {
          type: "number",
          description: "Maximum tokens the agent can use",
        },
      },
      required: ["type", "objective"],
    },
  },
  {
    name: "check_agent",
    description: "Check the status and progress of a running agent",
    input_schema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description: "The ID of the agent to check",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "cancel_agent",
    description: "Cancel a running agent",
    input_schema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description: "The ID of the agent to cancel",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "render_math",
    description: "Render a LaTeX mathematical expression to SVG/HTML. Useful for displaying equations, formulas, and mathematical notation.",
    input_schema: {
      type: "object" as const,
      properties: {
        latex: {
          type: "string",
          description: "LaTeX expression to render (e.g., 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')",
        },
        display_mode: {
          type: "boolean",
          description: "true for block/display math, false for inline (default: true)",
        },
        filename: {
          type: "string",
          description: "Optional filename to save the rendered SVG",
        },
        font_size: {
          type: "number",
          description: "Font size in pixels (default: 20)",
        },
        color: {
          type: "string",
          description: "Text color (default: black)",
        },
      },
      required: ["latex"],
    },
  },
  {
    name: "render_math_document",
    description: "Render multiple LaTeX expressions into an HTML document with MathJax support",
    input_schema: {
      type: "object" as const,
      properties: {
        expressions: {
          type: "array",
          description: "Array of expressions with latex and optional label",
          items: {
            type: "object",
            properties: {
              latex: { type: "string" },
              label: { type: "string" },
            },
            required: ["latex"],
          },
        },
        filename: {
          type: "string",
          description: "Output filename for the HTML document",
        },
      },
      required: ["expressions"],
    },
  },
  {
    name: "render_code",
    description: "Syntax highlight code with themes. Outputs styled HTML for code display.",
    input_schema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "The source code to highlight",
        },
        language: {
          type: "string",
          enum: ["typescript", "javascript", "python", "go", "rust"],
          description: "Programming language (default: javascript)",
        },
        theme: {
          type: "string",
          enum: ["light", "dark", "github", "monokai"],
          description: "Color theme (default: dark)",
        },
        line_numbers: {
          type: "boolean",
          description: "Show line numbers (default: true)",
        },
        highlight_lines: {
          type: "array",
          description: "Line numbers to highlight",
          items: { type: "number" },
        },
        title: {
          type: "string",
          description: "Optional title/filename to display above the code",
        },
        filename: {
          type: "string",
          description: "Output filename to save the HTML",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "render_markdown",
    description: "Convert markdown to styled HTML. Supports code blocks, tables, images, links, and more.",
    input_schema: {
      type: "object" as const,
      properties: {
        markdown: {
          type: "string",
          description: "The markdown content to render",
        },
        theme: {
          type: "string",
          enum: ["light", "dark", "github"],
          description: "Visual theme (default: github)",
        },
        syntax_highlight: {
          type: "boolean",
          description: "Enable syntax highlighting in code blocks (default: true)",
        },
        table_of_contents: {
          type: "boolean",
          description: "Generate a table of contents from headings (default: false)",
        },
        filename: {
          type: "string",
          description: "Output filename to save the HTML",
        },
      },
      required: ["markdown"],
    },
  },
  {
    name: "summarize_video",
    description: "Summarize a video file by extracting frames, transcribing audio, and generating a comprehensive summary with key moments.",
    input_schema: {
      type: "object" as const,
      properties: {
        video_path: {
          type: "string",
          description: "Path to the video file to summarize",
        },
        frame_count: {
          type: "number",
          description: "Number of frames to extract and analyze (default: 8, max: 20)",
        },
        include_transcript: {
          type: "boolean",
          description: "Whether to transcribe audio (default: true if video has audio)",
        },
        analysis_depth: {
          type: "string",
          enum: ["quick", "standard", "detailed"],
          description: "Depth of analysis (default: standard)",
        },
        language: {
          type: "string",
          description: "Language for transcription (default: en)",
        },
        focus_areas: {
          type: "array",
          description: "Specific aspects to focus on in the analysis",
          items: { type: "string" },
        },
      },
      required: ["video_path"],
    },
  },
  {
    name: "video_info",
    description: "Get basic information about a video file (duration, resolution, codec, etc.) without full analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        video_path: {
          type: "string",
          description: "Path to the video file",
        },
      },
      required: ["video_path"],
    },
  },
  {
    name: "extract_video_moments",
    description: "Extract and analyze key moments from a video without generating a full summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        video_path: {
          type: "string",
          description: "Path to the video file",
        },
        frame_count: {
          type: "number",
          description: "Number of key moments to extract (default: 8)",
        },
      },
      required: ["video_path"],
    },
  },
];

// Execute a tool by name
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; result: unknown; error?: string }> {
  try {
    switch (name) {
      case "execute_command": {
        const result = await executeCommand(
          input.command as string,
          input.working_directory as string | undefined
        );
        return {
          success: result.success,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          },
          error: result.success ? undefined : result.stderr,
        };
      }

      case "list_directory": {
        const files = await listDirectory(input.path as string);
        return { success: true, result: files };
      }

      case "read_file": {
        const content = await readFileContent(input.path as string);
        return { success: true, result: content };
      }

      case "write_file": {
        await writeFileContent(input.path as string, input.content as string);
        return { success: true, result: "File written successfully" };
      }

      case "search_files": {
        const files = await searchFiles(
          input.pattern as string,
          input.base_path as string | undefined
        );
        return { success: true, result: files };
      }

      case "web_search": {
        const results = await webSearch(input.query as string);
        return { success: true, result: results };
      }

      case "browse_url": {
        const page = await navigateTo(input.url as string);
        return { success: true, result: page };
      }

      case "take_screenshot": {
        const screenshot = await browserScreenshot();
        return {
          success: true,
          result: { screenshot: `data:image/png;base64,${screenshot}` },
        };
      }

      case "analyze_image": {
        const result = await analyzeImage({
          imageUrl: input.image_url as string | undefined,
          imagePath: input.image_path as string | undefined,
          prompt: input.prompt as string,
        });
        return {
          success: result.success,
          result: result.analysis,
          error: result.error,
        };
      }

      case "ocr_document": {
        const result = await performOCR(
          input.file_path as string,
          { language: input.language as string | undefined }
        );
        return {
          success: result.success,
          result: result.text,
          error: result.error,
        };
      }

      case "extract_document_data": {
        const result = await extractStructuredData(
          input.file_path as string,
          input.data_type as "table" | "form" | "receipt" | "invoice" | undefined
        );
        return {
          success: result.success,
          result: result.data,
          error: result.error,
        };
      }

      case "screenshot_analyze": {
        let region: "full" | "active_window" | { x: number; y: number; width: number; height: number } = "full";

        if (input.region === "active_window") {
          region = "active_window";
        } else if (typeof input.region === "string" && input.region.includes(",")) {
          const [x, y, width, height] = input.region.split(",").map(Number);
          region = { x, y, width, height };
        }

        const result = await screenshotAndAnalyze(
          input.prompt as string,
          { region }
        );
        return {
          success: result.success,
          result: result.analysis,
          error: result.error,
        };
      }

      case "generate_pdf": {
        const result = await generatePDF(
          input.content as string,
          input.filename as string,
          {
            contentType: input.content_type as "markdown" | "html" | undefined,
            title: input.title as string | undefined,
          }
        );
        return {
          success: result.success,
          result: result.filePath,
          error: result.error,
        };
      }

      case "generate_spreadsheet": {
        const result = await generateSpreadsheet(
          input.data as unknown[][],
          input.filename as string,
          {
            headers: input.headers as string[] | undefined,
            sheetName: input.sheet_name as string | undefined,
          }
        );
        return {
          success: result.success,
          result: result.filePath,
          error: result.error,
        };
      }

      case "generate_chart": {
        const { quickChart } = await import("./file-generation/charts");
        const result = await quickChart(
          input.type as "bar" | "line" | "pie" | "doughnut" | "scatter" | "area",
          input.labels as string[],
          input.values as number[],
          input.title as string | undefined,
          input.filename as string | undefined
        );
        return {
          success: result.success,
          result: result.filePath,
          error: result.error,
        };
      }

      case "generate_diagram": {
        if (input.mermaid_code) {
          const result = await generateDiagram(
            input.mermaid_code as string,
            input.filename as string | undefined
          );
          return {
            success: result.success,
            result: result.filePath,
            error: result.error,
          };
        } else if (input.data) {
          const result = await generateStructuredDiagram(
            input.type as "flowchart" | "sequence" | "class" | "state" | "er" | "gantt" | "mindmap",
            input.data,
            input.filename as string | undefined
          );
          return {
            success: result.success,
            result: result.filePath,
            error: result.error,
          };
        }
        return { success: false, result: null, error: "Must provide mermaid_code or data" };
      }

      case "spawn_agent": {
        const agentId = await spawnAgent({
          userId: "system", // Would come from context in real usage
          type: input.type as "research" | "coding" | "writing" | "analysis",
          objective: input.objective as string,
          context: input.context as Record<string, unknown> | undefined,
          tokenBudget: input.token_budget as number | undefined,
        });
        return {
          success: true,
          result: { agentId, message: "Agent spawned successfully" },
        };
      }

      case "check_agent": {
        const agent = await getAgent(input.agent_id as string);
        if (!agent) {
          return { success: false, result: null, error: "Agent not found" };
        }
        return {
          success: true,
          result: {
            id: agent.id,
            type: agent.type,
            status: agent.status,
            objective: agent.objective,
            tokensUsed: agent.tokensUsed,
            progress: agent.progress.slice(-5),
            result: agent.result,
          },
        };
      }

      case "cancel_agent": {
        const cancelled = await cancelAgent(input.agent_id as string);
        return {
          success: cancelled,
          result: cancelled ? "Agent cancelled" : "Could not cancel agent",
        };
      }

      case "render_math": {
        const result = await renderMath(
          input.latex as string,
          input.filename as string | undefined,
          {
            displayMode: input.display_mode as boolean | undefined,
            fontSize: input.font_size as number | undefined,
            color: input.color as string | undefined,
          }
        );
        return {
          success: result.success,
          result: {
            svg: result.svg,
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "render_math_document": {
        const result = await renderMathDocument(
          input.expressions as Array<{ latex: string; label?: string }>,
          input.filename as string | undefined
        );
        return {
          success: result.success,
          result: {
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "render_code": {
        const result = await renderCode(
          input.code as string,
          input.filename as string | undefined,
          {
            language: input.language as string | undefined,
            theme: input.theme as "light" | "dark" | "github" | "monokai" | undefined,
            lineNumbers: input.line_numbers as boolean | undefined,
            highlightLines: input.highlight_lines as number[] | undefined,
            title: input.title as string | undefined,
          }
        );
        return {
          success: result.success,
          result: {
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "render_markdown": {
        const result = await renderMarkdown(
          input.markdown as string,
          input.filename as string | undefined,
          {
            theme: input.theme as "light" | "dark" | "github" | undefined,
            syntaxHighlight: input.syntax_highlight as boolean | undefined,
            tableOfContents: input.table_of_contents as boolean | undefined,
          }
        );
        return {
          success: result.success,
          result: {
            html: result.html,
            filePath: result.filePath,
          },
          error: result.error,
        };
      }

      case "summarize_video": {
        const result = await summarizeVideo(
          input.video_path as string,
          {
            frameCount: input.frame_count as number | undefined,
            includeTranscript: input.include_transcript as boolean | undefined,
            analysisDepth: input.analysis_depth as "quick" | "standard" | "detailed" | undefined,
            language: input.language as string | undefined,
            focusAreas: input.focus_areas as string[] | undefined,
          }
        );
        return {
          success: result.success,
          result: result.summary,
          error: result.error,
        };
      }

      case "video_info": {
        const result = await getVideoInfo(input.video_path as string);
        return {
          success: result.success,
          result: result.info,
          error: result.error,
        };
      }

      case "extract_video_moments": {
        const result = await extractKeyMoments(
          input.video_path as string,
          input.frame_count as number | undefined
        );
        return {
          success: result.success,
          result: result.moments,
          error: result.error,
        };
      }

      default:
        return { success: false, result: null, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
