/**
 * Image Analyzer Module
 *
 * Analyzes images using Claude Vision API for:
 * - Object detection and description
 * - Scene understanding
 * - Text extraction (OCR)
 * - Image comparison
 * - Activity recognition
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { env } from "../../config/env";
import { promises as fs } from "fs";

/**
 * Claude client instance
 */
const client = new Anthropic({
  apiKey: env.CLAUDE_API_KEY,
});

/**
 * Supported image MIME types
 */
export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Image input for analysis
 */
export interface ImageInput {
  /** Image as Buffer */
  buffer?: Buffer;
  /** Image as base64 string */
  base64?: string;
  /** Image file path */
  path?: string;
  /** Image URL (publicly accessible) */
  url?: string;
  /** Media type (will be auto-detected if not provided) */
  mediaType?: ImageMediaType;
}

/**
 * Image analysis options
 */
export interface ImageAnalysisOptions {
  /** Custom prompt for analysis */
  prompt?: string;
  /** Analysis type */
  type?:
    | "general"
    | "objects"
    | "text"
    | "scene"
    | "people"
    | "comparison"
    | "activity"
    | "technical"
    | "accessibility";
  /** Maximum response tokens */
  maxTokens?: number;
  /** Response format */
  format?: "text" | "json" | "markdown";
  /** Level of detail in response */
  detail?: "brief" | "normal" | "detailed";
  /** Additional context for analysis */
  context?: string;
  /** Model to use */
  model?: string;
}

/**
 * Image analysis result
 */
export interface ImageAnalysisResult {
  /** Success status */
  success: boolean;
  /** Analysis text */
  analysis?: string;
  /** Parsed JSON if format is json */
  data?: Record<string, unknown>;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens used */
  outputTokens?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Object detection result
 */
export interface DetectedObject {
  /** Object name/label */
  name: string;
  /** Confidence (if available) */
  confidence?: number;
  /** Approximate location description */
  location?: string;
  /** Object attributes */
  attributes?: string[];
}

/**
 * Scene analysis result
 */
export interface SceneAnalysis {
  /** Scene type (indoor, outdoor, etc.) */
  sceneType: string;
  /** Setting description */
  setting: string;
  /** Lighting conditions */
  lighting: string;
  /** Time of day (if determinable) */
  timeOfDay?: string;
  /** Weather (if outdoor) */
  weather?: string;
  /** Mood/atmosphere */
  mood?: string;
  /** Key elements */
  elements: string[];
}

/**
 * Text extraction result
 */
export interface ExtractedText {
  /** All extracted text */
  fullText: string;
  /** Text blocks with positions */
  blocks: Array<{
    text: string;
    location?: string;
    type?: "heading" | "paragraph" | "label" | "caption" | "other";
  }>;
  /** Detected language */
  language?: string;
  /** Confidence */
  confidence?: "high" | "medium" | "low";
}

/**
 * Activity analysis result
 */
export interface ActivityAnalysis {
  /** Main activity */
  mainActivity: string;
  /** People involved */
  participants?: number;
  /** Context of activity */
  context: string;
  /** Detected actions */
  actions: string[];
  /** Setting */
  setting: string;
}

/**
 * Detect media type from buffer
 */
function detectMediaType(buffer: Buffer): ImageMediaType | null {
  // Check magic bytes
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/gif";
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  ) {
    // RIFF container, could be WebP
    if (
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return "image/webp";
    }
  }

  return null;
}

/**
 * Detect media type from file extension
 */
function detectMediaTypeFromPath(path: string): ImageMediaType | null {
  const ext = path.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}

/**
 * Prepare image for API
 */
async function prepareImage(input: ImageInput): Promise<{
  type: "base64" | "url";
  data: string;
  mediaType: ImageMediaType;
}> {
  // URL input
  if (input.url) {
    const mediaType = input.mediaType || "image/jpeg";
    return {
      type: "url",
      data: input.url,
      mediaType,
    };
  }

  // Buffer input
  if (input.buffer) {
    const mediaType =
      input.mediaType || detectMediaType(input.buffer) || "image/jpeg";
    return {
      type: "base64",
      data: input.buffer.toString("base64"),
      mediaType,
    };
  }

  // Base64 input
  if (input.base64) {
    const mediaType = input.mediaType || "image/jpeg";
    return {
      type: "base64",
      data: input.base64,
      mediaType,
    };
  }

  // File path input
  if (input.path) {
    const buffer = await fs.readFile(input.path);
    const mediaType =
      input.mediaType ||
      detectMediaTypeFromPath(input.path) ||
      detectMediaType(buffer) ||
      "image/jpeg";
    return {
      type: "base64",
      data: buffer.toString("base64"),
      mediaType,
    };
  }

  throw new Error("No valid image input provided");
}

/**
 * Build analysis prompt based on type
 */
function buildPrompt(options: ImageAnalysisOptions): string {
  if (options.prompt) {
    return options.prompt;
  }

  const detail = options.detail || "normal";
  const format = options.format || "text";

  let detailInstruction = "";
  switch (detail) {
    case "brief":
      detailInstruction = "Keep your response concise and to the point.";
      break;
    case "detailed":
      detailInstruction = "Provide a thorough and detailed analysis.";
      break;
    default:
      detailInstruction = "Provide a balanced analysis with appropriate detail.";
  }

  let formatInstruction = "";
  switch (format) {
    case "json":
      formatInstruction =
        "Respond with valid JSON only. No markdown formatting or explanation outside the JSON.";
      break;
    case "markdown":
      formatInstruction =
        "Format your response using Markdown with headers and bullet points.";
      break;
    default:
      formatInstruction = "Respond in plain text.";
  }

  const context = options.context ? `\nContext: ${options.context}` : "";

  switch (options.type) {
    case "objects":
      return `Identify and describe all objects visible in this image. For each object, note its name, approximate location in the image, and any notable attributes.${context}

${detailInstruction}
${formatInstruction}${
        format === "json"
          ? "\nJSON structure: { objects: [{ name: string, location: string, attributes: string[] }] }"
          : ""
      }`;

    case "text":
      return `Extract all visible text from this image. Include:
1. The complete text content
2. Location of each text block (top, middle, bottom, left, right)
3. Type of text (heading, paragraph, label, etc.)
4. Any detected language${context}

${detailInstruction}
${formatInstruction}${
        format === "json"
          ? "\nJSON structure: { fullText: string, blocks: [{ text: string, location: string, type: string }], language: string, confidence: string }"
          : ""
      }`;

    case "scene":
      return `Analyze the scene in this image. Describe:
1. Scene type (indoor/outdoor, environment type)
2. Setting and location
3. Lighting conditions
4. Time of day (if determinable)
5. Weather (if outdoor and visible)
6. Overall mood/atmosphere
7. Key visual elements${context}

${detailInstruction}
${formatInstruction}${
        format === "json"
          ? "\nJSON structure: { sceneType: string, setting: string, lighting: string, timeOfDay: string?, weather: string?, mood: string, elements: string[] }"
          : ""
      }`;

    case "people":
      return `Analyze any people visible in this image. Describe:
1. Number of people
2. Approximate ages and genders (if determinable)
3. Activities they appear to be doing
4. Emotional expressions (if visible)
5. Clothing and appearance
6. Positions and groupings${context}

${detailInstruction}
${formatInstruction}
Note: Do not attempt to identify specific individuals. Focus on general characteristics.`;

    case "activity":
      return `Analyze the activity or activities happening in this image. Describe:
1. Main activity taking place
2. Number of participants
3. Context and setting of the activity
4. Specific actions being performed
5. Any equipment or tools being used${context}

${detailInstruction}
${formatInstruction}${
        format === "json"
          ? "\nJSON structure: { mainActivity: string, participants: number?, context: string, actions: string[], setting: string }"
          : ""
      }`;

    case "technical":
      return `Provide a technical analysis of this image. Include:
1. Image composition (framing, rule of thirds, etc.)
2. Color analysis (dominant colors, palette)
3. Lighting (direction, quality, shadows)
4. Focus and depth of field
5. Any notable camera/photography techniques
6. Image quality assessment${context}

${detailInstruction}
${formatInstruction}`;

    case "accessibility":
      return `Provide an accessibility-focused description of this image that would help someone who cannot see it understand its content. Include:
1. Main subject and purpose of the image
2. Key visual elements and their relationships
3. Text content (if any)
4. Colors and contrast (if meaningful)
5. Emotional tone or mood
6. Any important context not visually obvious${context}

${detailInstruction}
${formatInstruction}`;

    case "comparison":
      return `Compare and contrast the images provided. Identify:
1. Similarities between the images
2. Differences between the images
3. Changes over time (if applicable)
4. Key distinguishing features${context}

${detailInstruction}
${formatInstruction}`;

    case "general":
    default:
      return `Analyze this image and describe what you see. Include the main subject, setting, notable details, and any relevant context.${context}

${detailInstruction}
${formatInstruction}`;
  }
}

/**
 * Analyze a single image
 */
export async function analyzeImage(
  image: ImageInput,
  options: ImageAnalysisOptions = {}
): Promise<ImageAnalysisResult> {
  try {
    const prepared = await prepareImage(image);
    const prompt = buildPrompt(options);
    const maxTokens = options.maxTokens || 2048;
    const model = options.model || "claude-sonnet-4-20250514";

    const imageBlock: ImageBlockParam =
      prepared.type === "url"
        ? {
            type: "image",
            source: {
              type: "url",
              url: prepared.data,
            },
          }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: prepared.mediaType,
              data: prepared.data,
            },
          };

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [imageBlock, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const analysisText = textBlock?.type === "text" ? textBlock.text : "";

    let data: Record<string, unknown> | undefined;
    if (options.format === "json") {
      try {
        // Try to extract JSON from the response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // JSON parsing failed, continue with text only
      }
    }

    return {
      success: true,
      analysis: analysisText,
      data,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Compare multiple images
 */
export async function compareImages(
  images: ImageInput[],
  options: Omit<ImageAnalysisOptions, "type"> = {}
): Promise<ImageAnalysisResult> {
  try {
    if (images.length < 2) {
      return {
        success: false,
        error: "At least 2 images are required for comparison",
      };
    }

    const preparedImages = await Promise.all(images.map(prepareImage));
    const prompt = buildPrompt({ ...options, type: "comparison" });
    const maxTokens = options.maxTokens || 2048;
    const model = options.model || "claude-sonnet-4-20250514";

    const content: Array<ImageBlockParam | { type: "text"; text: string }> = [];

    for (let i = 0; i < preparedImages.length; i++) {
      const prepared = preparedImages[i];
      const imageBlock: ImageBlockParam =
        prepared.type === "url"
          ? {
              type: "image",
              source: {
                type: "url",
                url: prepared.data,
              },
            }
          : {
              type: "image",
              source: {
                type: "base64",
                media_type: prepared.mediaType,
                data: prepared.data,
              },
            };

      content.push(imageBlock);
      content.push({ type: "text", text: `Image ${i + 1}` });
    }

    content.push({ type: "text", text: prompt });

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const analysisText = textBlock?.type === "text" ? textBlock.text : "";

    let data: Record<string, unknown> | undefined;
    if (options.format === "json") {
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // JSON parsing failed
      }
    }

    return {
      success: true,
      analysis: analysisText,
      data,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Detect objects in image
 */
export async function detectObjects(
  image: ImageInput,
  options: Omit<ImageAnalysisOptions, "type" | "format"> = {}
): Promise<{
  success: boolean;
  objects?: DetectedObject[];
  error?: string;
}> {
  const result = await analyzeImage(image, {
    ...options,
    type: "objects",
    format: "json",
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const objects = result.data?.objects as DetectedObject[] | undefined;
  return {
    success: true,
    objects: objects || [],
  };
}

/**
 * Extract text from image (OCR)
 */
export async function extractTextFromImage(
  image: ImageInput,
  options: Omit<ImageAnalysisOptions, "type" | "format"> = {}
): Promise<{
  success: boolean;
  text?: ExtractedText;
  error?: string;
}> {
  const result = await analyzeImage(image, {
    ...options,
    type: "text",
    format: "json",
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data as Record<string, unknown> | undefined;
  const text: ExtractedText = data && data.fullText
    ? {
        fullText: data.fullText as string,
        blocks: (data.blocks as ExtractedText["blocks"]) || [],
        language: data.language as string | undefined,
        confidence: data.confidence as ExtractedText["confidence"],
      }
    : {
        fullText: result.analysis || "",
        blocks: [],
      };
  return {
    success: true,
    text,
  };
}

/**
 * Analyze scene in image
 */
export async function analyzeScene(
  image: ImageInput,
  options: Omit<ImageAnalysisOptions, "type" | "format"> = {}
): Promise<{
  success: boolean;
  scene?: SceneAnalysis;
  error?: string;
}> {
  const result = await analyzeImage(image, {
    ...options,
    type: "scene",
    format: "json",
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data as Record<string, unknown> | undefined;
  const scene: SceneAnalysis = data && data.sceneType
    ? {
        sceneType: data.sceneType as string,
        setting: data.setting as string,
        lighting: data.lighting as string,
        timeOfDay: data.timeOfDay as string | undefined,
        weather: data.weather as string | undefined,
        mood: data.mood as string | undefined,
        elements: (data.elements as string[]) || [],
      }
    : {
        sceneType: "unknown",
        setting: result.analysis || "",
        lighting: "unknown",
        elements: [],
      };
  return {
    success: true,
    scene,
  };
}

/**
 * Analyze activity in image
 */
export async function analyzeActivity(
  image: ImageInput,
  options: Omit<ImageAnalysisOptions, "type" | "format"> = {}
): Promise<{
  success: boolean;
  activity?: ActivityAnalysis;
  error?: string;
}> {
  const result = await analyzeImage(image, {
    ...options,
    type: "activity",
    format: "json",
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data as Record<string, unknown> | undefined;
  const activity: ActivityAnalysis = data && data.mainActivity
    ? {
        mainActivity: data.mainActivity as string,
        participants: data.participants as number | undefined,
        context: data.context as string,
        actions: (data.actions as string[]) || [],
        setting: data.setting as string,
      }
    : {
        mainActivity: "unknown",
        context: result.analysis || "",
        actions: [],
        setting: "unknown",
      };
  return {
    success: true,
    activity,
  };
}

/**
 * Generate accessibility description for image
 */
export async function generateAltText(
  image: ImageInput,
  options: { maxLength?: number; context?: string } = {}
): Promise<{
  success: boolean;
  altText?: string;
  error?: string;
}> {
  const result = await analyzeImage(image, {
    type: "accessibility",
    detail: "brief",
    context: options.context,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  let altText = result.analysis || "";

  if (options.maxLength && altText.length > options.maxLength) {
    // Truncate intelligently at sentence boundary
    const truncated = altText.substring(0, options.maxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    altText = lastPeriod > 0 ? truncated.substring(0, lastPeriod + 1) : truncated + "...";
  }

  return {
    success: true,
    altText,
  };
}

/**
 * Answer a question about an image
 */
export async function askAboutImage(
  image: ImageInput,
  question: string,
  options: Omit<ImageAnalysisOptions, "prompt" | "type"> = {}
): Promise<ImageAnalysisResult> {
  return analyzeImage(image, {
    ...options,
    prompt: question,
  });
}

/**
 * Batch analyze multiple images
 */
export async function batchAnalyzeImages(
  images: ImageInput[],
  options: ImageAnalysisOptions = {}
): Promise<ImageAnalysisResult[]> {
  return Promise.all(images.map((image) => analyzeImage(image, options)));
}
