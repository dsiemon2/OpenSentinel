import { providerRegistry } from "../core/providers";
import { readFile } from "fs/promises";
import { isPathAllowed } from "../utils/paths";

export interface ImageAnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
}

// Supported image MIME types
const SUPPORTED_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function getMimeType(filename: string): string | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return SUPPORTED_TYPES[ext] || null;
}

// Analyze image from URL
export async function analyzeImageUrl(
  imageUrl: string,
  prompt: string
): Promise<ImageAnalysisResult> {
  try {
    const provider = providerRegistry.getDefault();
    const response = await provider.createMessage({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: prompt || "Describe this image in detail.",
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    return {
      success: true,
      analysis: textContent?.text,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Analyze image from local file
export async function analyzeImageFile(
  filePath: string,
  prompt: string
): Promise<ImageAnalysisResult> {
  try {
    // Security check
    if (!isPathAllowed(filePath)) {
      return {
        success: false,
        error: "Access to this path is not allowed",
      };
    }

    const mimeType = getMimeType(filePath);
    if (!mimeType) {
      return {
        success: false,
        error: "Unsupported image format. Supported: jpg, png, gif, webp",
      };
    }

    const imageData = await readFile(filePath);
    const base64 = imageData.toString("base64");

    const provider = providerRegistry.getDefault();
    const response = await provider.createMessage({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                mediaType: mimeType,
                data: base64,
              },
            },
            {
              type: "text",
              text: prompt || "Describe this image in detail.",
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    return {
      success: true,
      analysis: textContent?.text,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Analyze image from buffer
export async function analyzeImageBuffer(
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  prompt: string
): Promise<ImageAnalysisResult> {
  try {
    const base64 = imageBuffer.toString("base64");

    const provider = providerRegistry.getDefault();
    const response = await provider.createMessage({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                mediaType: mimeType,
                data: base64,
              },
            },
            {
              type: "text",
              text: prompt || "Describe this image in detail.",
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    return {
      success: true,
      analysis: textContent?.text,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Combined function for tool use
export async function analyzeImage(
  options: {
    imageUrl?: string;
    imagePath?: string;
    prompt: string;
  }
): Promise<ImageAnalysisResult> {
  if (options.imageUrl) {
    return analyzeImageUrl(options.imageUrl, options.prompt);
  }

  if (options.imagePath) {
    return analyzeImageFile(options.imagePath, options.prompt);
  }

  return {
    success: false,
    error: "Either imageUrl or imagePath must be provided",
  };
}

export default {
  analyzeImage,
  analyzeImageUrl,
  analyzeImageFile,
  analyzeImageBuffer,
};
