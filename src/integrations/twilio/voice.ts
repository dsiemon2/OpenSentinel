/**
 * Twilio Voice Integration for Moltbot
 *
 * Provides functionality to make and receive phone calls with TTS,
 * recording, and transcription capabilities.
 */

import { env } from "../../config/env";
import { getTwilioConfig, type SMSConfig } from "./sms";

// Twilio API base URL
const TWILIO_API_URL = "https://api.twilio.com/2010-04-01";

export interface CallOptions {
  to: string;
  twiml?: string;
  url?: string;
  statusCallback?: string;
  statusCallbackMethod?: "GET" | "POST";
  statusCallbackEvent?: string[];
  record?: boolean;
  recordingStatusCallback?: string;
  timeout?: number;
  machineDetection?: "Enable" | "DetectMessageEnd";
  asyncAmd?: boolean;
  asyncAmdStatusCallback?: string;
}

export interface CallResponse {
  success: boolean;
  callSid?: string;
  status?: string;
  error?: string;
  from?: string;
  to?: string;
  direction?: string;
  dateCreated?: string;
}

export interface IncomingCall {
  callSid: string;
  accountSid: string;
  from: string;
  to: string;
  callStatus: string;
  direction: string;
  fromCity?: string;
  fromState?: string;
  fromCountry?: string;
  callerName?: string;
  digits?: string;
  speechResult?: string;
  recordingUrl?: string;
  recordingDuration?: number;
  transcriptionText?: string;
}

export interface RecordingInfo {
  recordingSid: string;
  recordingUrl: string;
  recordingDuration: number;
  recordingStatus: string;
  callSid: string;
}

export interface TranscriptionInfo {
  transcriptionSid: string;
  transcriptionText: string;
  transcriptionStatus: string;
  recordingSid: string;
  callSid: string;
}

export type TwiMLVoice =
  | "man"
  | "woman"
  | "alice"
  | "Polly.Joanna"
  | "Polly.Matthew"
  | "Polly.Amy"
  | "Polly.Brian"
  | "Google.en-US-Standard-A"
  | "Google.en-US-Standard-B"
  | "Google.en-US-Standard-C"
  | "Google.en-US-Standard-D";

export interface SayOptions {
  voice?: TwiMLVoice;
  language?: string;
  loop?: number;
}

export interface GatherOptions {
  input?: "dtmf" | "speech" | "dtmf speech";
  timeout?: number;
  numDigits?: number;
  actionUrl?: string;
  actionMethod?: "GET" | "POST";
  speechTimeout?: number | "auto";
  speechModel?: "default" | "numbers_and_commands" | "phone_call";
  hints?: string;
  language?: string;
  profanityFilter?: boolean;
}

export interface RecordOptions {
  maxLength?: number;
  timeout?: number;
  transcribe?: boolean;
  transcribeCallback?: string;
  playBeep?: boolean;
  trim?: "trim-silence" | "do-not-trim";
  recordingStatusCallback?: string;
  actionUrl?: string;
  actionMethod?: "GET" | "POST";
}

/**
 * Create basic auth header for Twilio API
 */
function createAuthHeader(accountSid: string, authToken: string): string {
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * Make an outbound phone call
 */
export async function makeCall(
  options: CallOptions,
  config?: SMSConfig
): Promise<CallResponse> {
  const twilioConfig = config || getTwilioConfig();

  if (!twilioConfig) {
    return {
      success: false,
      error: "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    };
  }

  const { accountSid, authToken, phoneNumber } = twilioConfig;

  if (!options.twiml && !options.url) {
    return {
      success: false,
      error: "Either twiml or url must be provided",
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("To", options.to);
    formData.append("From", phoneNumber);

    if (options.twiml) {
      formData.append("Twiml", options.twiml);
    } else if (options.url) {
      formData.append("Url", options.url);
    }

    if (options.statusCallback) {
      formData.append("StatusCallback", options.statusCallback);
    }

    if (options.statusCallbackMethod) {
      formData.append("StatusCallbackMethod", options.statusCallbackMethod);
    }

    if (options.statusCallbackEvent) {
      for (const event of options.statusCallbackEvent) {
        formData.append("StatusCallbackEvent", event);
      }
    }

    if (options.record) {
      formData.append("Record", "true");
    }

    if (options.recordingStatusCallback) {
      formData.append("RecordingStatusCallback", options.recordingStatusCallback);
    }

    if (options.timeout) {
      formData.append("Timeout", options.timeout.toString());
    }

    if (options.machineDetection) {
      formData.append("MachineDetection", options.machineDetection);
    }

    if (options.asyncAmd) {
      formData.append("AsyncAmd", "true");
    }

    if (options.asyncAmdStatusCallback) {
      formData.append("AsyncAmdStatusCallback", options.asyncAmdStatusCallback);
    }

    const response = await fetch(
      `${TWILIO_API_URL}/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: createAuthHeader(accountSid, authToken),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        error: (data.message as string) || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      callSid: data.sid as string,
      status: data.status as string,
      from: data.from as string,
      to: data.to as string,
      direction: data.direction as string,
      dateCreated: data.date_created as string,
    };
  } catch (error) {
    console.error("Error making call:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error making call",
    };
  }
}

/**
 * Make a call with text-to-speech message
 */
export async function makeCallWithTTS(
  to: string,
  message: string,
  sayOptions?: SayOptions,
  config?: SMSConfig
): Promise<CallResponse> {
  const twiml = generateTwiMLSay(message, sayOptions);
  return makeCall({ to, twiml }, config);
}

/**
 * Get call status by SID
 */
export async function getCallStatus(
  callSid: string,
  config?: SMSConfig
): Promise<CallResponse> {
  const twilioConfig = config || getTwilioConfig();

  if (!twilioConfig) {
    return {
      success: false,
      error: "Twilio is not configured.",
    };
  }

  const { accountSid, authToken } = twilioConfig;

  try {
    const response = await fetch(
      `${TWILIO_API_URL}/Accounts/${accountSid}/Calls/${callSid}.json`,
      {
        method: "GET",
        headers: {
          Authorization: createAuthHeader(accountSid, authToken),
        },
      }
    );

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        error: (data.message as string) || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      callSid: data.sid as string,
      status: data.status as string,
      from: data.from as string,
      to: data.to as string,
      direction: data.direction as string,
      dateCreated: data.date_created as string,
    };
  } catch (error) {
    console.error("Error getting call status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * End an active call
 */
export async function endCall(
  callSid: string,
  config?: SMSConfig
): Promise<CallResponse> {
  const twilioConfig = config || getTwilioConfig();

  if (!twilioConfig) {
    return {
      success: false,
      error: "Twilio is not configured.",
    };
  }

  const { accountSid, authToken } = twilioConfig;

  try {
    const formData = new URLSearchParams();
    formData.append("Status", "completed");

    const response = await fetch(
      `${TWILIO_API_URL}/Accounts/${accountSid}/Calls/${callSid}.json`,
      {
        method: "POST",
        headers: {
          Authorization: createAuthHeader(accountSid, authToken),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        error: (data.message as string) || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      callSid: data.sid as string,
      status: data.status as string,
    };
  } catch (error) {
    console.error("Error ending call:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get recordings for a call
 */
export async function getCallRecordings(
  callSid: string,
  config?: SMSConfig
): Promise<{ success: boolean; recordings?: RecordingInfo[]; error?: string }> {
  const twilioConfig = config || getTwilioConfig();

  if (!twilioConfig) {
    return {
      success: false,
      error: "Twilio is not configured.",
    };
  }

  const { accountSid, authToken } = twilioConfig;

  try {
    const response = await fetch(
      `${TWILIO_API_URL}/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`,
      {
        method: "GET",
        headers: {
          Authorization: createAuthHeader(accountSid, authToken),
        },
      }
    );

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        error: (data.message as string) || `HTTP ${response.status}`,
      };
    }

    const recordings = (data.recordings as Array<Record<string, unknown>> || []).map((rec) => ({
      recordingSid: rec.sid as string,
      recordingUrl: `https://api.twilio.com${rec.uri}`.replace(".json", ".mp3"),
      recordingDuration: parseInt(rec.duration as string, 10),
      recordingStatus: rec.status as string,
      callSid: rec.call_sid as string,
    }));

    return {
      success: true,
      recordings,
    };
  } catch (error) {
    console.error("Error getting recordings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a recording
 */
export async function deleteRecording(
  recordingSid: string,
  config?: SMSConfig
): Promise<{ success: boolean; error?: string }> {
  const twilioConfig = config || getTwilioConfig();

  if (!twilioConfig) {
    return {
      success: false,
      error: "Twilio is not configured.",
    };
  }

  const { accountSid, authToken } = twilioConfig;

  try {
    const response = await fetch(
      `${TWILIO_API_URL}/Accounts/${accountSid}/Recordings/${recordingSid}.json`,
      {
        method: "DELETE",
        headers: {
          Authorization: createAuthHeader(accountSid, authToken),
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const data = await response.json() as Record<string, unknown>;
      return {
        success: false,
        error: (data.message as string) || `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting recording:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse incoming call webhook data from Twilio
 */
export function parseIncomingCall(body: Record<string, string>): IncomingCall {
  return {
    callSid: body.CallSid || "",
    accountSid: body.AccountSid || "",
    from: body.From || body.Caller || "",
    to: body.To || body.Called || "",
    callStatus: body.CallStatus || "",
    direction: body.Direction || "",
    fromCity: body.FromCity || body.CallerCity,
    fromState: body.FromState || body.CallerState,
    fromCountry: body.FromCountry || body.CallerCountry,
    callerName: body.CallerName,
    digits: body.Digits,
    speechResult: body.SpeechResult,
    recordingUrl: body.RecordingUrl,
    recordingDuration: body.RecordingDuration
      ? parseInt(body.RecordingDuration, 10)
      : undefined,
    transcriptionText: body.TranscriptionText,
  };
}

/**
 * Parse recording callback webhook data
 */
export function parseRecordingCallback(body: Record<string, string>): RecordingInfo {
  return {
    recordingSid: body.RecordingSid || "",
    recordingUrl: body.RecordingUrl || "",
    recordingDuration: parseInt(body.RecordingDuration || "0", 10),
    recordingStatus: body.RecordingStatus || "",
    callSid: body.CallSid || "",
  };
}

/**
 * Parse transcription callback webhook data
 */
export function parseTranscriptionCallback(body: Record<string, string>): TranscriptionInfo {
  return {
    transcriptionSid: body.TranscriptionSid || "",
    transcriptionText: body.TranscriptionText || "",
    transcriptionStatus: body.TranscriptionStatus || "",
    recordingSid: body.RecordingSid || "",
    callSid: body.CallSid || "",
  };
}

// ============================================================================
// TwiML Generation Helpers
// ============================================================================

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate TwiML for text-to-speech
 */
export function generateTwiMLSay(message: string, options?: SayOptions): string {
  const voice = options?.voice || "Polly.Joanna";
  const language = options?.language || "en-US";
  const loop = options?.loop || 1;

  const escapedMessage = escapeXml(message);

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${voice}" language="${language}" loop="${loop}">${escapedMessage}</Say></Response>`;
}

/**
 * Generate TwiML for gathering user input (DTMF or speech)
 */
export function generateTwiMLGather(
  prompt: string,
  options?: GatherOptions,
  sayOptions?: SayOptions
): string {
  const input = options?.input || "dtmf speech";
  const timeout = options?.timeout || 5;
  const speechTimeout = options?.speechTimeout || "auto";
  const numDigits = options?.numDigits;
  const actionUrl = options?.actionUrl;
  const actionMethod = options?.actionMethod || "POST";
  const speechModel = options?.speechModel || "phone_call";
  const hints = options?.hints;
  const language = options?.language || "en-US";
  const profanityFilter = options?.profanityFilter !== false;

  const voice = sayOptions?.voice || "Polly.Joanna";
  const sayLanguage = sayOptions?.language || "en-US";

  let gatherAttrs = `input="${input}" timeout="${timeout}" speechTimeout="${speechTimeout}" speechModel="${speechModel}" language="${language}" profanityFilter="${profanityFilter}"`;

  if (numDigits) {
    gatherAttrs += ` numDigits="${numDigits}"`;
  }

  if (actionUrl) {
    gatherAttrs += ` action="${escapeXml(actionUrl)}" method="${actionMethod}"`;
  }

  if (hints) {
    gatherAttrs += ` hints="${escapeXml(hints)}"`;
  }

  const escapedPrompt = escapeXml(prompt);

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather ${gatherAttrs}><Say voice="${voice}" language="${sayLanguage}">${escapedPrompt}</Say></Gather></Response>`;
}

/**
 * Generate TwiML for recording
 */
export function generateTwiMLRecord(
  prompt: string,
  options?: RecordOptions,
  sayOptions?: SayOptions
): string {
  const maxLength = options?.maxLength || 120;
  const timeout = options?.timeout || 10;
  const transcribe = options?.transcribe || false;
  const playBeep = options?.playBeep !== false;
  const trim = options?.trim || "trim-silence";
  const actionUrl = options?.actionUrl;
  const actionMethod = options?.actionMethod || "POST";
  const transcribeCallback = options?.transcribeCallback;
  const recordingStatusCallback = options?.recordingStatusCallback;

  const voice = sayOptions?.voice || "Polly.Joanna";
  const language = sayOptions?.language || "en-US";

  let recordAttrs = `maxLength="${maxLength}" timeout="${timeout}" playBeep="${playBeep}" trim="${trim}"`;

  if (transcribe) {
    recordAttrs += ` transcribe="true"`;
    if (transcribeCallback) {
      recordAttrs += ` transcribeCallback="${escapeXml(transcribeCallback)}"`;
    }
  }

  if (actionUrl) {
    recordAttrs += ` action="${escapeXml(actionUrl)}" method="${actionMethod}"`;
  }

  if (recordingStatusCallback) {
    recordAttrs += ` recordingStatusCallback="${escapeXml(recordingStatusCallback)}"`;
  }

  const escapedPrompt = escapeXml(prompt);

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${voice}" language="${language}">${escapedPrompt}</Say><Record ${recordAttrs}/></Response>`;
}

/**
 * Generate TwiML for playing audio
 */
export function generateTwiMLPlay(audioUrl: string, loop?: number): string {
  const loopAttr = loop ? ` loop="${loop}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Play${loopAttr}>${escapeXml(audioUrl)}</Play></Response>`;
}

/**
 * Generate TwiML for redirecting to another URL
 */
export function generateTwiMLRedirect(url: string, method?: "GET" | "POST"): string {
  const methodAttr = method ? ` method="${method}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect${methodAttr}>${escapeXml(url)}</Redirect></Response>`;
}

/**
 * Generate TwiML for hanging up
 */
export function generateTwiMLHangup(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
}

/**
 * Generate TwiML for rejecting a call
 */
export function generateTwiMLReject(reason?: "rejected" | "busy"): string {
  const reasonAttr = reason ? ` reason="${reason}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Reject${reasonAttr}/></Response>`;
}

/**
 * Generate TwiML for pausing
 */
export function generateTwiMLPause(seconds?: number): string {
  const lengthAttr = seconds ? ` length="${seconds}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Pause${lengthAttr}/></Response>`;
}

/**
 * Generate combined TwiML response with multiple verbs
 */
export function generateTwiMLResponse(verbs: string[]): string {
  const content = verbs.join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`;
}

/**
 * TwiML verb builders (for use with generateTwiMLResponse)
 */
export const TwiMLVerbs = {
  say: (message: string, options?: SayOptions): string => {
    const voice = options?.voice || "Polly.Joanna";
    const language = options?.language || "en-US";
    const loop = options?.loop || 1;
    return `<Say voice="${voice}" language="${language}" loop="${loop}">${escapeXml(message)}</Say>`;
  },

  play: (url: string, loop?: number): string => {
    const loopAttr = loop ? ` loop="${loop}"` : "";
    return `<Play${loopAttr}>${escapeXml(url)}</Play>`;
  },

  pause: (seconds?: number): string => {
    const lengthAttr = seconds ? ` length="${seconds}"` : "";
    return `<Pause${lengthAttr}/>`;
  },

  hangup: (): string => "<Hangup/>",

  redirect: (url: string, method?: "GET" | "POST"): string => {
    const methodAttr = method ? ` method="${method}"` : "";
    return `<Redirect${methodAttr}>${escapeXml(url)}</Redirect>`;
  },
};
