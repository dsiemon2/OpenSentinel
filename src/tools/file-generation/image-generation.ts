import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export type ImageSize = "256x256" | "512x512" | "1024x1024" | "1024x1792" | "1792x1024";
export type ImageQuality = "standard" | "hd";
export type ImageStyle = "natural" | "vivid";
export type ImageModel = "dall-e-2" | "dall-e-3" | "stable-diffusion" | "midjourney";
export type ImageFormat = "png" | "jpeg" | "webp" | "svg";

export interface ImageGenerationOptions {
  model?: ImageModel;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number;
  format?: ImageFormat;
  responseFormat?: "url" | "b64_json";
  user?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  filePath?: string;
  url?: string;
  revisedPrompt?: string;
  base64?: string;
  error?: string;
}

export interface BatchImageGenerationResult {
  success: boolean;
  images: ImageGenerationResult[];
  error?: string;
}

export interface ImageEditOptions extends ImageGenerationOptions {
  mask?: string; // Path to mask image for inpainting
}

export interface ImageVariationOptions extends ImageGenerationOptions {
  image: string; // Path to source image
}

// Default options
const DEFAULT_OPTIONS: ImageGenerationOptions = {
  model: "dall-e-3",
  size: "1024x1024",
  quality: "standard",
  style: "vivid",
  n: 1,
  format: "png",
  responseFormat: "url",
};

// Generate temp file path
function getTempPath(format: ImageFormat = "png"): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-image-${id}.${format}`);
}

// Get OpenAI API key from environment
function getOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

// Validate image size for model
function validateSizeForModel(size: ImageSize, model: ImageModel): ImageSize {
  const validSizes: Record<ImageModel, ImageSize[]> = {
    "dall-e-2": ["256x256", "512x512", "1024x1024"],
    "dall-e-3": ["1024x1024", "1024x1792", "1792x1024"],
    "stable-diffusion": ["256x256", "512x512", "1024x1024"],
    "midjourney": ["256x256", "512x512", "1024x1024", "1024x1792", "1792x1024"],
  };

  const modelSizes = validSizes[model] || validSizes["dall-e-3"];

  if (modelSizes.includes(size)) {
    return size;
  }

  // Return default size for model
  return model === "dall-e-2" ? "1024x1024" : "1024x1024";
}

// Generate image using OpenAI DALL-E API
export async function generateImageWithDALLE(
  prompt: string,
  filename?: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY environment variable is not set",
    };
  }

  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const model = finalOptions.model === "dall-e-2" ? "dall-e-2" : "dall-e-3";
  const size = validateSizeForModel(finalOptions.size!, model);

  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath(finalOptions.format);

  try {
    await mkdir(dirname(filePath), { recursive: true });

    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      n: model === "dall-e-3" ? 1 : Math.min(finalOptions.n || 1, 10),
      size,
      response_format: finalOptions.responseFormat || "url",
    };

    // DALL-E 3 specific options
    if (model === "dall-e-3") {
      requestBody.quality = finalOptions.quality || "standard";
      requestBody.style = finalOptions.style || "vivid";
    }

    if (finalOptions.user) {
      requestBody.user = finalOptions.user;
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
      return {
        success: false,
        error: `OpenAI API error: ${errorMessage}`,
      };
    }

    const data = await response.json() as {
      data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
      }>;
    };

    const imageData = data.data[0];

    if (!imageData) {
      return {
        success: false,
        error: "No image data received from API",
      };
    }

    let savedFilePath: string | undefined;

    // Handle URL response
    if (imageData.url) {
      // Download the image
      const imageResponse = await fetch(imageData.url);
      if (!imageResponse.ok) {
        return {
          success: false,
          error: "Failed to download generated image",
        };
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      await writeFile(filePath, Buffer.from(imageBuffer));
      savedFilePath = filePath;
    }

    // Handle base64 response
    if (imageData.b64_json) {
      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      await writeFile(filePath, imageBuffer);
      savedFilePath = filePath;
    }

    return {
      success: true,
      filePath: savedFilePath,
      url: imageData.url,
      revisedPrompt: imageData.revised_prompt,
      base64: imageData.b64_json,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate multiple images
export async function generateMultipleImages(
  prompt: string,
  count: number = 4,
  options: ImageGenerationOptions = {}
): Promise<BatchImageGenerationResult> {
  const results: ImageGenerationResult[] = [];
  const model = options.model || "dall-e-3";

  // DALL-E 3 only supports n=1, so we need multiple requests
  if (model === "dall-e-3") {
    for (let i = 0; i < count; i++) {
      const result = await generateImageWithDALLE(prompt, undefined, {
        ...options,
        n: 1,
      });
      results.push(result);

      // Add a small delay between requests to avoid rate limiting
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } else {
    // DALL-E 2 supports n up to 10
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      return {
        success: false,
        images: [],
        error: "OPENAI_API_KEY environment variable is not set",
      };
    }

    const finalOptions = { ...DEFAULT_OPTIONS, ...options };
    const size = validateSizeForModel(finalOptions.size!, "dall-e-2");

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-2",
          prompt,
          n: Math.min(count, 10),
          size,
          response_format: "url",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
        return {
          success: false,
          images: [],
          error: `OpenAI API error: ${errorMessage}`,
        };
      }

      const data = await response.json() as {
        data: Array<{ url?: string; b64_json?: string }>;
      };

      for (let i = 0; i < data.data.length; i++) {
        const imageData = data.data[i];
        const filePath = getTempPath(finalOptions.format);

        if (imageData.url) {
          try {
            await mkdir(dirname(filePath), { recursive: true });
            const imageResponse = await fetch(imageData.url);
            const imageBuffer = await imageResponse.arrayBuffer();
            await writeFile(filePath, Buffer.from(imageBuffer));

            results.push({
              success: true,
              filePath,
              url: imageData.url,
            });
          } catch (error) {
            results.push({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        images: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    success: results.some((r) => r.success),
    images: results,
  };
}

// Edit an existing image (inpainting)
export async function editImage(
  imagePath: string,
  prompt: string,
  options: ImageEditOptions = {}
): Promise<ImageGenerationResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY environment variable is not set",
    };
  }

  // Check if path is allowed
  if (!isPathAllowed(imagePath)) {
    return {
      success: false,
      error: "Access to image path is not allowed",
    };
  }

  if (options.mask && !isPathAllowed(options.mask)) {
    return {
      success: false,
      error: "Access to mask path is not allowed",
    };
  }

  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const size = validateSizeForModel(finalOptions.size!, "dall-e-2");
  const filePath = getTempPath(finalOptions.format);

  try {
    await mkdir(dirname(filePath), { recursive: true });

    // Read image file
    const fs = await import("fs/promises");
    const imageBuffer = await fs.readFile(imagePath);
    const imageArrayBuffer = new Uint8Array(imageBuffer).buffer;
    const imageBlob = new Blob([imageArrayBuffer], { type: "image/png" });

    // Create form data
    const formData = new FormData();
    formData.append("model", "dall-e-2"); // Only DALL-E 2 supports edits
    formData.append("image", imageBlob, "image.png");
    formData.append("prompt", prompt);
    formData.append("n", "1");
    formData.append("size", size);
    formData.append("response_format", "url");

    // Add mask if provided
    if (options.mask) {
      const maskBuffer = await fs.readFile(options.mask);
      const maskArrayBuffer = new Uint8Array(maskBuffer).buffer;
      const maskBlob = new Blob([maskArrayBuffer], { type: "image/png" });
      formData.append("mask", maskBlob, "mask.png");
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
      return {
        success: false,
        error: `OpenAI API error: ${errorMessage}`,
      };
    }

    const data = await response.json() as {
      data: Array<{ url?: string }>;
    };

    const imageData = data.data[0];

    if (imageData?.url) {
      const imageResponse = await fetch(imageData.url);
      const downloadedBuffer = await imageResponse.arrayBuffer();
      await writeFile(filePath, Buffer.from(downloadedBuffer));

      return {
        success: true,
        filePath,
        url: imageData.url,
      };
    }

    return {
      success: false,
      error: "No image data received from API",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Create variations of an existing image
export async function createImageVariations(
  imagePath: string,
  count: number = 1,
  options: Omit<ImageGenerationOptions, "n"> = {}
): Promise<BatchImageGenerationResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return {
      success: false,
      images: [],
      error: "OPENAI_API_KEY environment variable is not set",
    };
  }

  // Check if path is allowed
  if (!isPathAllowed(imagePath)) {
    return {
      success: false,
      images: [],
      error: "Access to image path is not allowed",
    };
  }

  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const size = validateSizeForModel(finalOptions.size!, "dall-e-2");
  const results: ImageGenerationResult[] = [];

  try {
    // Read image file
    const fs = await import("fs/promises");
    const imageBuffer = await fs.readFile(imagePath);
    const imageArrayBuffer = new Uint8Array(imageBuffer).buffer;
    const imageBlob = new Blob([imageArrayBuffer], { type: "image/png" });

    // Create form data
    const formData = new FormData();
    formData.append("model", "dall-e-2"); // Only DALL-E 2 supports variations
    formData.append("image", imageBlob, "image.png");
    formData.append("n", String(Math.min(count, 10)));
    formData.append("size", size);
    formData.append("response_format", "url");

    const response = await fetch("https://api.openai.com/v1/images/variations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
      return {
        success: false,
        images: [],
        error: `OpenAI API error: ${errorMessage}`,
      };
    }

    const data = await response.json() as {
      data: Array<{ url?: string }>;
    };

    for (const imageData of data.data) {
      const filePath = getTempPath(finalOptions.format);

      if (imageData?.url) {
        try {
          await mkdir(dirname(filePath), { recursive: true });
          const imageResponse = await fetch(imageData.url);
          const downloadedBuffer = await imageResponse.arrayBuffer();
          await writeFile(filePath, Buffer.from(downloadedBuffer));

          results.push({
            success: true,
            filePath,
            url: imageData.url,
          });
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return {
      success: results.some((r) => r.success),
      images: results,
    };
  } catch (error) {
    return {
      success: false,
      images: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate placeholder image (fallback when API is not available)
export async function generatePlaceholderImage(
  prompt: string,
  filename?: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const [widthStr, heightStr] = (finalOptions.size || "1024x1024").split("x");
  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);

  const filePath = filename
    ? isPathAllowed(filename)
      ? filename
      : join(tmpdir(), filename)
    : getTempPath("svg");

  try {
    await mkdir(dirname(filePath), { recursive: true });

    // Generate a simple SVG placeholder
    const svgContent = generatePlaceholderSVG(prompt, width, height);
    const svgPath = filePath.replace(/\.(png|jpeg|webp)$/, ".svg");
    await writeFile(svgPath, svgContent, "utf-8");

    return {
      success: true,
      filePath: svgPath,
      revisedPrompt: `[Placeholder for: ${prompt}]`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Generate placeholder SVG
function generatePlaceholderSVG(prompt: string, width: number, height: number): string {
  // Generate a gradient background based on prompt hash
  const hash = simpleHash(prompt);
  const hue1 = hash % 360;
  const hue2 = (hash * 7) % 360;

  // Truncate prompt for display
  const displayPrompt = prompt.length > 50 ? prompt.substring(0, 47) + "..." : prompt;
  const escapedPrompt = displayPrompt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue1}, 70%, 60%);stop-opacity:1" />
      <stop offset="100%" style="stop-color:hsl(${hue2}, 70%, 40%);stop-opacity:1" />
    </linearGradient>
    <pattern id="pattern" patternUnits="userSpaceOnUse" width="40" height="40">
      <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)"/>
  <rect width="100%" height="100%" fill="url(#pattern)"/>
  <rect x="10%" y="40%" width="80%" height="20%" rx="10" fill="rgba(0,0,0,0.3)"/>
  <text x="50%" y="48%" font-family="Arial, sans-serif" font-size="${Math.max(12, width / 40)}" fill="white" text-anchor="middle" dominant-baseline="middle">
    AI Image Placeholder
  </text>
  <text x="50%" y="56%" font-family="Arial, sans-serif" font-size="${Math.max(10, width / 50)}" fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">
    ${escapedPrompt}
  </text>
  <text x="50%" y="90%" font-family="Arial, sans-serif" font-size="${Math.max(8, width / 60)}" fill="rgba(255,255,255,0.5)" text-anchor="middle">
    ${width} x ${height}
  </text>
</svg>`;
}

// Simple hash function for generating consistent colors
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Enhance prompt with additional details
export function enhancePrompt(prompt: string, style?: string): string {
  const styleEnhancements: Record<string, string> = {
    photorealistic: ", photorealistic, highly detailed, 8k resolution, professional photography",
    artistic: ", artistic style, creative composition, vibrant colors, expressive brushstrokes",
    minimal: ", minimalist design, clean lines, simple composition, modern aesthetic",
    cinematic: ", cinematic lighting, dramatic atmosphere, movie still, widescreen composition",
    anime: ", anime style, vibrant colors, detailed character design, Japanese animation aesthetic",
    "3d": ", 3D rendered, octane render, high quality, detailed textures, realistic lighting",
    watercolor: ", watercolor painting, soft edges, flowing colors, artistic texture",
    sketch: ", pencil sketch, detailed linework, artistic drawing, hand-drawn style",
    vintage: ", vintage style, retro aesthetic, film grain, nostalgic mood, aged appearance",
    fantasy: ", fantasy art, magical atmosphere, ethereal lighting, imaginative elements",
    scifi: ", science fiction, futuristic design, advanced technology, space aesthetic",
    portrait: ", professional portrait, studio lighting, sharp focus, detailed features",
    landscape: ", scenic landscape, natural beauty, atmospheric perspective, golden hour lighting",
    abstract: ", abstract art, non-representational, bold colors, geometric shapes",
  };

  if (style && styleEnhancements[style.toLowerCase()]) {
    return prompt + styleEnhancements[style.toLowerCase()];
  }

  return prompt;
}

// Main function for tool use
export async function generateImage(
  prompt: string,
  filename?: string,
  options?: ImageGenerationOptions & { enhancePrompt?: boolean; promptStyle?: string }
): Promise<ImageGenerationResult> {
  // Enhance prompt if requested
  let finalPrompt = prompt;
  if (options?.enhancePrompt || options?.promptStyle) {
    finalPrompt = enhancePrompt(prompt, options?.promptStyle);
  }

  // Try to generate with DALL-E first
  const result = await generateImageWithDALLE(finalPrompt, filename, options);

  // If DALL-E fails due to missing API key, use placeholder
  if (!result.success && result.error?.includes("OPENAI_API_KEY")) {
    console.log("[ImageGeneration] OpenAI API key not available, generating placeholder");
    return generatePlaceholderImage(prompt, filename, options);
  }

  return result;
}

export default {
  generateImage,
  generateImageWithDALLE,
  generateMultipleImages,
  editImage,
  createImageVariations,
  generatePlaceholderImage,
  enhancePrompt,
};
