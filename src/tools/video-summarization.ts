import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "../config/env";
import { isPathAllowed, getSafeExtension } from "../utils/paths";
import { readFile, writeFile, unlink, mkdir, stat, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, basename } from "path";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const anthropic = new Anthropic({
  apiKey: env.CLAUDE_API_KEY,
});

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Supported video formats
const SUPPORTED_VIDEO_FORMATS = [".mp4", ".avi", ".mkv", ".mov", ".webm", ".m4v", ".flv", ".wmv"];

// Frame extraction settings
const DEFAULT_FRAME_COUNT = 8; // Number of keyframes to extract
const MAX_FRAME_COUNT = 20;
const FRAME_QUALITY = 90; // JPEG quality 1-100

export interface VideoSummarizationResult {
  success: boolean;
  summary?: VideoSummary;
  error?: string;
}

export interface VideoSummary {
  title: string;
  duration: number; // in seconds
  overview: string;
  keyMoments: KeyMoment[];
  transcript?: string;
  topics: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  contentType: VideoContentType;
  metadata: VideoMetadata;
}

export interface KeyMoment {
  timestamp: number; // in seconds
  description: string;
  frameAnalysis?: string;
}

export interface VideoMetadata {
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  bitrate?: number;
  fileSize: number;
  hasAudio: boolean;
}

export type VideoContentType =
  | "tutorial"
  | "presentation"
  | "interview"
  | "documentary"
  | "entertainment"
  | "news"
  | "meeting"
  | "lecture"
  | "vlog"
  | "other";

export interface VideoSummarizationOptions {
  frameCount?: number;
  includeTranscript?: boolean;
  analysisDepth?: "quick" | "standard" | "detailed";
  language?: string;
  focusAreas?: string[]; // Specific aspects to focus on
}

// Execute ffmpeg/ffprobe commands
async function execCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (error) => {
      reject(error);
    });
  });
}

// Get video metadata using ffprobe
async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  try {
    const { stdout } = await execCommand("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      videoPath,
    ]);

    const probeData = JSON.parse(stdout);
    const videoStream = probeData.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
    const audioStream = probeData.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");
    const format = probeData.format || {};

    const fileStat = await stat(videoPath);

    return {
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      frameRate: videoStream?.r_frame_rate ? parseFrameRate(videoStream.r_frame_rate) : 0,
      codec: videoStream?.codec_name || "unknown",
      bitrate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
      fileSize: fileStat.size,
      hasAudio: !!audioStream,
    };
  } catch (error) {
    // Return minimal metadata on error
    const fileStat = await stat(videoPath);
    return {
      width: 0,
      height: 0,
      frameRate: 0,
      codec: "unknown",
      fileSize: fileStat.size,
      hasAudio: false,
    };
  }
}

// Parse frame rate string (e.g., "30/1" or "29.97")
function parseFrameRate(frameRateStr: string): number {
  if (frameRateStr.includes("/")) {
    const [num, den] = frameRateStr.split("/").map(Number);
    return den > 0 ? num / den : 0;
  }
  return parseFloat(frameRateStr) || 0;
}

// Get video duration using ffprobe
async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execCommand("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);

    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

// Extract frames from video at specific intervals
async function extractFrames(
  videoPath: string,
  outputDir: string,
  frameCount: number
): Promise<string[]> {
  const duration = await getVideoDuration(videoPath);
  if (duration <= 0) {
    throw new Error("Could not determine video duration");
  }

  // Calculate frame timestamps (evenly distributed)
  const actualFrameCount = Math.min(frameCount, MAX_FRAME_COUNT);
  const interval = duration / (actualFrameCount + 1);
  const framePaths: string[] = [];

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  // Extract frames at calculated timestamps
  for (let i = 1; i <= actualFrameCount; i++) {
    const timestamp = interval * i;
    const outputPath = join(outputDir, `frame_${String(i).padStart(3, "0")}.jpg`);

    try {
      await execCommand("ffmpeg", [
        "-ss", timestamp.toString(),
        "-i", videoPath,
        "-vframes", "1",
        "-q:v", String(Math.max(1, 31 - Math.floor(FRAME_QUALITY / 3.5))),
        "-y",
        outputPath,
      ]);

      if (existsSync(outputPath)) {
        framePaths.push(outputPath);
      }
    } catch {
      // Continue with other frames if one fails
      console.warn(`Failed to extract frame at ${timestamp}s`);
    }
  }

  return framePaths;
}

// Extract audio from video for transcription
async function extractAudio(videoPath: string, outputPath: string): Promise<boolean> {
  try {
    await execCommand("ffmpeg", [
      "-i", videoPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-ar", "16000",
      "-ac", "1",
      "-y",
      outputPath,
    ]);

    return existsSync(outputPath);
  } catch {
    return false;
  }
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(
  audioPath: string,
  language?: string
): Promise<string | null> {
  try {
    const audioBuffer = await readFile(audioPath);
    const uint8Array = new Uint8Array(audioBuffer);
    const file = new File([uint8Array], "audio.mp3", { type: "audio/mpeg" });

    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: language || "en",
      response_format: "text",
    });

    return response;
  } catch (error) {
    console.error("Transcription error:", error);
    return null;
  }
}

// Analyze a single frame using Claude Vision
async function analyzeFrame(
  framePath: string,
  timestamp: number,
  context: string
): Promise<string> {
  try {
    const imageData = await readFile(framePath);
    const base64 = imageData.toString("base64");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analyze this video frame from timestamp ${formatTimestamp(timestamp)}. Context: ${context}. Describe what's happening, any text visible, key visual elements, and the apparent activity or scene.`,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    return textContent?.type === "text" ? textContent.text : "Unable to analyze frame";
  } catch (error) {
    return `Frame analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Analyze multiple frames together for efficiency
async function analyzeFramesBatch(
  framePaths: string[],
  duration: number
): Promise<KeyMoment[]> {
  const keyMoments: KeyMoment[] = [];
  const interval = duration / (framePaths.length + 1);

  // Process frames in parallel batches of 4
  const batchSize = 4;
  for (let i = 0; i < framePaths.length; i += batchSize) {
    const batch = framePaths.slice(i, i + batchSize);
    const batchPromises = batch.map(async (framePath, batchIndex) => {
      const frameIndex = i + batchIndex;
      const timestamp = interval * (frameIndex + 1);
      const analysis = await analyzeFrame(
        framePath,
        timestamp,
        `Frame ${frameIndex + 1} of ${framePaths.length} from a video`
      );

      return {
        timestamp,
        description: analysis.slice(0, 500), // Limit description length
        frameAnalysis: analysis,
      };
    });

    const batchResults = await Promise.all(batchPromises);
    keyMoments.push(...batchResults);
  }

  return keyMoments;
}

// Format timestamp for display
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// Generate comprehensive summary using Claude
async function generateSummary(
  keyMoments: KeyMoment[],
  transcript: string | null,
  metadata: VideoMetadata,
  duration: number,
  options: VideoSummarizationOptions
): Promise<Omit<VideoSummary, "keyMoments" | "metadata" | "duration">> {
  const frameDescriptions = keyMoments
    .map((m) => `[${formatTimestamp(m.timestamp)}] ${m.description}`)
    .join("\n");

  const prompt = `Analyze this video based on the following information:

## Frame Analysis (${keyMoments.length} keyframes):
${frameDescriptions}

${transcript ? `## Transcript:\n${transcript.slice(0, 10000)}` : "## No audio transcript available"}

## Video Info:
- Duration: ${formatTimestamp(duration)}
- Resolution: ${metadata.width}x${metadata.height}
- Has Audio: ${metadata.hasAudio}

${options.focusAreas?.length ? `## Focus Areas: ${options.focusAreas.join(", ")}` : ""}

Based on this information, provide a comprehensive analysis in JSON format:
{
  "title": "A descriptive title for the video",
  "overview": "A 2-3 paragraph summary of the video content",
  "topics": ["topic1", "topic2", "topic3"],
  "contentType": "one of: tutorial, presentation, interview, documentary, entertainment, news, meeting, lecture, vlog, other",
  "sentiment": "one of: positive, neutral, negative, mixed"
}

${options.analysisDepth === "detailed" ? "Provide extra detail in the overview." : ""}
${options.analysisDepth === "quick" ? "Keep the overview brief, 1-2 sentences." : ""}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || "Untitled Video",
        overview: parsed.overview || "No overview available",
        topics: parsed.topics || [],
        contentType: parsed.contentType || "other",
        sentiment: parsed.sentiment || "neutral",
        transcript: transcript || undefined,
      };
    }
  } catch (error) {
    console.error("Summary generation error:", error);
  }

  // Fallback summary
  return {
    title: "Video Analysis",
    overview: `This video is ${formatTimestamp(duration)} long and contains ${keyMoments.length} analyzed segments.`,
    topics: [],
    contentType: "other",
    sentiment: "neutral",
    transcript: transcript || undefined,
  };
}

// Clean up temporary files
async function cleanup(tempDir: string): Promise<void> {
  try {
    const files = await readdir(tempDir);
    await Promise.all(files.map((f) => unlink(join(tempDir, f))));
    await unlink(tempDir).catch(() => {}); // Remove directory
  } catch {
    // Ignore cleanup errors
  }
}

// Main video summarization function
export async function summarizeVideo(
  videoPath: string,
  options: VideoSummarizationOptions = {}
): Promise<VideoSummarizationResult> {
  // Validate path
  if (!isPathAllowed(videoPath)) {
    return {
      success: false,
      error: "Access to this path is not allowed",
    };
  }

  // Check file exists
  if (!existsSync(videoPath)) {
    return {
      success: false,
      error: "Video file not found",
    };
  }

  // Validate format
  const ext = getSafeExtension(videoPath);
  if (!SUPPORTED_VIDEO_FORMATS.includes(ext)) {
    return {
      success: false,
      error: `Unsupported video format: ${ext}. Supported: ${SUPPORTED_VIDEO_FORMATS.join(", ")}`,
    };
  }

  const tempDir = join(tmpdir(), `moltbot-video-${randomUUID()}`);

  try {
    await mkdir(tempDir, { recursive: true });

    // Get video metadata
    const metadata = await getVideoMetadata(videoPath);
    const duration = await getVideoDuration(videoPath);

    if (duration <= 0) {
      return {
        success: false,
        error: "Could not determine video duration",
      };
    }

    // Extract frames
    const frameCount = options.frameCount || DEFAULT_FRAME_COUNT;
    const framePaths = await extractFrames(videoPath, tempDir, frameCount);

    if (framePaths.length === 0) {
      return {
        success: false,
        error: "Failed to extract frames from video",
      };
    }

    // Transcribe audio if requested and available
    let transcript: string | null = null;
    if (options.includeTranscript !== false && metadata.hasAudio) {
      const audioPath = join(tempDir, "audio.mp3");
      const audioExtracted = await extractAudio(videoPath, audioPath);

      if (audioExtracted) {
        transcript = await transcribeAudio(audioPath, options.language);
      }
    }

    // Analyze frames
    const keyMoments = await analyzeFramesBatch(framePaths, duration);

    // Generate comprehensive summary
    const summaryData = await generateSummary(
      keyMoments,
      transcript,
      metadata,
      duration,
      options
    );

    // Build final summary
    const summary: VideoSummary = {
      ...summaryData,
      duration,
      keyMoments,
      metadata,
    };

    // Cleanup temp files
    await cleanup(tempDir);

    return {
      success: true,
      summary,
    };
  } catch (error) {
    // Cleanup on error
    await cleanup(tempDir);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Quick summary (fewer frames, no transcript)
export async function quickSummarizeVideo(
  videoPath: string
): Promise<VideoSummarizationResult> {
  return summarizeVideo(videoPath, {
    frameCount: 4,
    includeTranscript: false,
    analysisDepth: "quick",
  });
}

// Detailed summary (more frames, full transcript)
export async function detailedSummarizeVideo(
  videoPath: string,
  language?: string
): Promise<VideoSummarizationResult> {
  return summarizeVideo(videoPath, {
    frameCount: 16,
    includeTranscript: true,
    analysisDepth: "detailed",
    language,
  });
}

// Extract key moments only (no full summary)
export async function extractKeyMoments(
  videoPath: string,
  frameCount: number = 8
): Promise<{ success: boolean; moments?: KeyMoment[]; error?: string }> {
  if (!isPathAllowed(videoPath)) {
    return { success: false, error: "Access to this path is not allowed" };
  }

  if (!existsSync(videoPath)) {
    return { success: false, error: "Video file not found" };
  }

  const tempDir = join(tmpdir(), `moltbot-video-${randomUUID()}`);

  try {
    await mkdir(tempDir, { recursive: true });
    const duration = await getVideoDuration(videoPath);
    const framePaths = await extractFrames(videoPath, tempDir, frameCount);
    const moments = await analyzeFramesBatch(framePaths, duration);

    await cleanup(tempDir);

    return { success: true, moments };
  } catch (error) {
    await cleanup(tempDir);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Get video information without full analysis
export async function getVideoInfo(
  videoPath: string
): Promise<{ success: boolean; info?: VideoMetadata & { duration: number }; error?: string }> {
  if (!isPathAllowed(videoPath)) {
    return { success: false, error: "Access to this path is not allowed" };
  }

  if (!existsSync(videoPath)) {
    return { success: false, error: "Video file not found" };
  }

  try {
    const metadata = await getVideoMetadata(videoPath);
    const duration = await getVideoDuration(videoPath);

    return {
      success: true,
      info: { ...metadata, duration },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  summarizeVideo,
  quickSummarizeVideo,
  detailedSummarizeVideo,
  extractKeyMoments,
  getVideoInfo,
  SUPPORTED_VIDEO_FORMATS,
};
