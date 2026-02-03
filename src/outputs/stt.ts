import OpenAI from "openai";
import { env } from "../config/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function transcribeAudio(
  audioBuffer: Buffer,
  language?: string
): Promise<string | null> {
  try {
    // Create a File object from the buffer (convert to Uint8Array for compatibility)
    const uint8Array = new Uint8Array(audioBuffer);
    const file = new File([uint8Array], "audio.ogg", { type: "audio/ogg" });

    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: language || "en",
    });

    return response.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return null;
  }
}
