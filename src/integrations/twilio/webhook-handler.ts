/**
 * Twilio Webhook Handler for OpenSentinel
 *
 * Handles incoming SMS and voice call webhooks from Twilio,
 * processing them with AI and returning appropriate responses.
 */

import { Hono } from "hono";
import { env } from "../../config/env";
import { chatWithTools, type Message } from "../../core/brain";
import {
  parseIncomingSMS,
  generateSMSResponse,
  validateTwilioSignature,
  getTwilioConfig,
  type IncomingSMS,
} from "./sms";
import {
  parseIncomingCall,
  parseRecordingCallback,
  parseTranscriptionCallback,
  generateTwiMLSay,
  generateTwiMLGather,
  generateTwiMLRecord,
  generateTwiMLHangup,
  type IncomingCall,
  type RecordingInfo,
  type TranscriptionInfo,
  type GatherOptions,
  type SayOptions,
} from "./voice";

// Conversation sessions for phone calls (keyed by CallSid)
const callSessions: Map<string, Message[]> = new Map();

// Conversation sessions for SMS (keyed by phone number)
const smsSessions: Map<string, Message[]> = new Map();

// Maximum messages to keep in session history
const MAX_SESSION_HISTORY = 20;

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Track last activity for session cleanup
const sessionActivity: Map<string, number> = new Map();

export interface WebhookConfig {
  validateSignature?: boolean;
  baseUrl?: string;
  smsHandler?: (sms: IncomingSMS) => Promise<string | null>;
  callHandler?: (call: IncomingCall) => Promise<string | null>;
  recordingHandler?: (recording: RecordingInfo) => Promise<void>;
  transcriptionHandler?: (transcription: TranscriptionInfo) => Promise<void>;
  allowedNumbers?: string[];
  systemPrompt?: string;
}

/**
 * Get or create SMS session for a phone number
 */
export function getSMSSession(phoneNumber: string): Message[] {
  if (!smsSessions.has(phoneNumber)) {
    smsSessions.set(phoneNumber, []);
  }
  sessionActivity.set(`sms:${phoneNumber}`, Date.now());
  return smsSessions.get(phoneNumber)!;
}

/**
 * Add message to SMS session
 */
export function addToSMSSession(
  phoneNumber: string,
  message: Message
): void {
  const session = getSMSSession(phoneNumber);
  session.push(message);

  // Keep only last MAX_SESSION_HISTORY messages
  if (session.length > MAX_SESSION_HISTORY) {
    session.splice(0, session.length - MAX_SESSION_HISTORY);
  }
}

/**
 * Clear SMS session for a phone number
 */
export function clearSMSSession(phoneNumber: string): void {
  smsSessions.delete(phoneNumber);
  sessionActivity.delete(`sms:${phoneNumber}`);
}

/**
 * Get or create call session for a CallSid
 */
export function getCallSession(callSid: string): Message[] {
  if (!callSessions.has(callSid)) {
    callSessions.set(callSid, []);
  }
  sessionActivity.set(`call:${callSid}`, Date.now());
  return callSessions.get(callSid)!;
}

/**
 * Add message to call session
 */
export function addToCallSession(
  callSid: string,
  message: Message
): void {
  const session = getCallSession(callSid);
  session.push(message);

  // Keep only last MAX_SESSION_HISTORY messages
  if (session.length > MAX_SESSION_HISTORY) {
    session.splice(0, session.length - MAX_SESSION_HISTORY);
  }
}

/**
 * Clear call session
 */
export function clearCallSession(callSid: string): void {
  callSessions.delete(callSid);
  sessionActivity.delete(`call:${callSid}`);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const entries = Array.from(sessionActivity.entries());

  for (const [key, lastActivity] of entries) {
    if (now - lastActivity > SESSION_TIMEOUT) {
      if (key.startsWith("sms:")) {
        smsSessions.delete(key.substring(4));
      } else if (key.startsWith("call:")) {
        callSessions.delete(key.substring(5));
      }
      sessionActivity.delete(key);
    }
  }
}

// Run session cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

/**
 * Default SMS handler - processes message with AI
 */
async function defaultSMSHandler(
  sms: IncomingSMS,
  systemPrompt?: string
): Promise<string> {
  const userId = `twilio:${sms.from}`;

  // Add user message to session
  addToSMSSession(sms.from, { role: "user", content: sms.body });

  // Get full session history
  const messages = getSMSSession(sms.from);

  // Include media info if present
  let userMessage = sms.body;
  if (sms.numMedia > 0 && sms.mediaUrls) {
    userMessage += `\n\n[User sent ${sms.numMedia} media attachment(s): ${sms.mediaUrls.join(", ")}]`;
    // Update the last message with media info
    messages[messages.length - 1].content = userMessage;
  }

  try {
    const response = await chatWithTools(messages, userId);

    // Add assistant response to session
    addToSMSSession(sms.from, { role: "assistant", content: response.content });

    // SMS has 1600 character limit, truncate if needed
    let responseText = response.content;
    if (responseText.length > 1500) {
      responseText = responseText.substring(0, 1497) + "...";
    }

    return responseText;
  } catch (error) {
    console.error("Error processing SMS with AI:", error);
    return "I apologize, but I encountered an error processing your message. Please try again.";
  }
}

/**
 * Default call handler - processes speech with AI
 */
async function defaultCallHandler(
  call: IncomingCall,
  systemPrompt?: string
): Promise<string> {
  const userId = `twilio:${call.from}`;
  const userInput = call.speechResult || call.digits || "";

  if (!userInput) {
    return "I didn't catch that. Could you please repeat?";
  }

  // Add user message to session
  addToCallSession(call.callSid, { role: "user", content: userInput });

  // Get full session history
  const messages = getCallSession(call.callSid);

  try {
    const response = await chatWithTools(messages, userId);

    // Add assistant response to session
    addToCallSession(call.callSid, { role: "assistant", content: response.content });

    return response.content;
  } catch (error) {
    console.error("Error processing call with AI:", error);
    return "I apologize, but I encountered an error. Please try again.";
  }
}

/**
 * Create Hono routes for Twilio webhooks
 */
export function createTwilioWebhooks(config: WebhookConfig = {}): Hono {
  const app = new Hono();

  const {
    validateSignature = true,
    baseUrl = "",
    smsHandler,
    callHandler,
    recordingHandler,
    transcriptionHandler,
    allowedNumbers,
    systemPrompt,
  } = config;

  // Middleware to validate Twilio signature
  if (validateSignature) {
    app.use("/twilio/*", async (c, next) => {
      const twilioConfig = getTwilioConfig();
      if (!twilioConfig) {
        return c.text("Twilio not configured", 500);
      }

      const signature = c.req.header("X-Twilio-Signature");
      if (!signature) {
        console.warn("Missing Twilio signature");
        return c.text("Forbidden", 403);
      }

      // Get the full URL
      const url = baseUrl + c.req.path;

      // Parse form data
      const contentType = c.req.header("Content-Type") || "";
      let params: Record<string, string> = {};

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await c.req.parseBody();
        params = Object.fromEntries(
          Object.entries(formData).map(([k, v]) => [k, String(v)])
        );
      }

      // Validate signature
      try {
        const isValid = validateTwilioSignature(
          signature,
          url,
          params,
          twilioConfig.authToken
        );

        if (!isValid) {
          console.warn("Invalid Twilio signature");
          return c.text("Forbidden", 403);
        }
      } catch (error) {
        // If validation fails, log but continue in development
        if (env.NODE_ENV === "production") {
          console.error("Signature validation error:", error);
          return c.text("Forbidden", 403);
        }
        console.warn("Signature validation skipped in development");
      }

      await next();
    });
  }

  // Middleware to check allowed numbers
  if (allowedNumbers && allowedNumbers.length > 0) {
    app.use("/twilio/*", async (c, next) => {
      const contentType = c.req.header("Content-Type") || "";
      let from = "";

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await c.req.parseBody();
        from = String(formData.From || formData.Caller || "");
      }

      if (from && !allowedNumbers.includes(from)) {
        console.warn(`Blocked message/call from unauthorized number: ${from}`);
        return c.text(generateSMSResponse("Unauthorized"), 200, {
          "Content-Type": "application/xml",
        });
      }

      await next();
    });
  }

  // ============================================================================
  // SMS Webhooks
  // ============================================================================

  /**
   * Handle incoming SMS messages
   */
  app.post("/twilio/sms", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const params = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, String(v)])
      );

      const sms = parseIncomingSMS(params);

      console.log(`[Twilio SMS] From: ${sms.from}, Body: ${sms.body.substring(0, 50)}...`);

      // Use custom handler or default
      let responseMessage: string | null;
      if (smsHandler) {
        responseMessage = await smsHandler(sms);
      } else {
        responseMessage = await defaultSMSHandler(sms, systemPrompt);
      }

      // Return TwiML response
      const twiml = generateSMSResponse(responseMessage || undefined);
      return c.text(twiml, 200, {
        "Content-Type": "application/xml",
      });
    } catch (error) {
      console.error("Error handling SMS webhook:", error);
      return c.text(generateSMSResponse("Error processing message"), 200, {
        "Content-Type": "application/xml",
      });
    }
  });

  /**
   * Handle SMS status callbacks
   */
  app.post("/twilio/sms/status", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const messageSid = String(formData.MessageSid || "");
      const status = String(formData.MessageStatus || "");

      console.log(`[Twilio SMS Status] ${messageSid}: ${status}`);

      // Just acknowledge - could add custom handling here
      return c.text("OK", 200);
    } catch (error) {
      console.error("Error handling SMS status webhook:", error);
      return c.text("OK", 200);
    }
  });

  // ============================================================================
  // Voice Webhooks
  // ============================================================================

  /**
   * Handle incoming voice calls
   */
  app.post("/twilio/voice", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const params = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, String(v)])
      );

      const call = parseIncomingCall(params);

      console.log(`[Twilio Voice] From: ${call.from}, Status: ${call.callStatus}`);

      // Initial greeting with input gathering
      const gatherUrl = `${baseUrl}/twilio/voice/gather`;
      const gatherOptions: GatherOptions = {
        input: "speech",
        timeout: 5,
        speechTimeout: "auto",
        speechModel: "phone_call",
        actionUrl: gatherUrl,
        actionMethod: "POST",
        hints: "help, status, weather, reminder, schedule",
      };

      const sayOptions: SayOptions = {
        voice: "Polly.Joanna",
        language: "en-US",
      };

      const twiml = generateTwiMLGather(
        "Hello! I'm OpenSentinel, your AI assistant. How can I help you today?",
        gatherOptions,
        sayOptions
      );

      return c.text(twiml, 200, {
        "Content-Type": "application/xml",
      });
    } catch (error) {
      console.error("Error handling voice webhook:", error);
      return c.text(generateTwiMLSay("Sorry, an error occurred."), 200, {
        "Content-Type": "application/xml",
      });
    }
  });

  /**
   * Handle gathered speech/DTMF input
   */
  app.post("/twilio/voice/gather", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const params = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, String(v)])
      );

      const call = parseIncomingCall(params);

      // Check for end commands
      const input = (call.speechResult || call.digits || "").toLowerCase();
      if (
        input.includes("goodbye") ||
        input.includes("bye") ||
        input.includes("hang up") ||
        input === "#"
      ) {
        clearCallSession(call.callSid);
        return c.text(
          generateTwiMLSay("Goodbye! Have a great day."),
          200,
          { "Content-Type": "application/xml" }
        );
      }

      // Process with AI
      let responseMessage: string;
      if (callHandler) {
        const customResponse = await callHandler(call);
        responseMessage = customResponse || "I couldn't process that. Please try again.";
      } else {
        responseMessage = await defaultCallHandler(call, systemPrompt);
      }

      console.log(`[Twilio Voice] Response: ${responseMessage.substring(0, 100)}...`);

      // Continue gathering input after response
      const gatherUrl = `${baseUrl}/twilio/voice/gather`;
      const gatherOptions: GatherOptions = {
        input: "speech",
        timeout: 5,
        speechTimeout: "auto",
        speechModel: "phone_call",
        actionUrl: gatherUrl,
        actionMethod: "POST",
      };

      const sayOptions: SayOptions = {
        voice: "Polly.Joanna",
        language: "en-US",
      };

      const twiml = generateTwiMLGather(
        responseMessage + " Is there anything else I can help you with?",
        gatherOptions,
        sayOptions
      );

      return c.text(twiml, 200, {
        "Content-Type": "application/xml",
      });
    } catch (error) {
      console.error("Error handling gather webhook:", error);
      return c.text(
        generateTwiMLSay("Sorry, an error occurred. Please try again."),
        200,
        { "Content-Type": "application/xml" }
      );
    }
  });

  /**
   * Handle call status updates
   */
  app.post("/twilio/voice/status", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const callSid = String(formData.CallSid || "");
      const callStatus = String(formData.CallStatus || "");

      console.log(`[Twilio Voice Status] ${callSid}: ${callStatus}`);

      // Clean up session when call ends
      if (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer") {
        clearCallSession(callSid);
      }

      return c.text("OK", 200);
    } catch (error) {
      console.error("Error handling voice status webhook:", error);
      return c.text("OK", 200);
    }
  });

  /**
   * Handle recording with transcription
   */
  app.post("/twilio/voice/record", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const params = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, String(v)])
      );

      const call = parseIncomingCall(params);

      console.log(`[Twilio Voice] Recording started for call: ${call.callSid}`);

      // Generate TwiML for recording with transcription
      const recordUrl = `${baseUrl}/twilio/voice/record/complete`;
      const transcribeUrl = `${baseUrl}/twilio/voice/transcription`;

      const twiml = generateTwiMLRecord(
        "Please leave your message after the beep.",
        {
          maxLength: 120,
          timeout: 10,
          transcribe: true,
          transcribeCallback: transcribeUrl,
          actionUrl: recordUrl,
          actionMethod: "POST",
        }
      );

      return c.text(twiml, 200, {
        "Content-Type": "application/xml",
      });
    } catch (error) {
      console.error("Error handling record webhook:", error);
      return c.text(generateTwiMLSay("Sorry, an error occurred."), 200, {
        "Content-Type": "application/xml",
      });
    }
  });

  /**
   * Handle recording completion
   */
  app.post("/twilio/voice/record/complete", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const params = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, String(v)])
      );

      const recording = parseRecordingCallback(params);

      console.log(
        `[Twilio Recording] Complete: ${recording.recordingSid}, Duration: ${recording.recordingDuration}s`
      );

      // Call custom handler if provided
      if (recordingHandler) {
        await recordingHandler(recording);
      }

      // Thank the caller and end
      const twiml = generateTwiMLSay(
        "Thank you for your message. Goodbye!",
        { voice: "Polly.Joanna" }
      );

      return c.text(twiml, 200, {
        "Content-Type": "application/xml",
      });
    } catch (error) {
      console.error("Error handling recording complete webhook:", error);
      return c.text(generateTwiMLHangup(), 200, {
        "Content-Type": "application/xml",
      });
    }
  });

  /**
   * Handle transcription results
   */
  app.post("/twilio/voice/transcription", async (c) => {
    try {
      const formData = await c.req.parseBody();
      const params = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, String(v)])
      );

      const transcription = parseTranscriptionCallback(params);

      console.log(
        `[Twilio Transcription] ${transcription.transcriptionSid}: "${transcription.transcriptionText}"`
      );

      // Call custom handler if provided
      if (transcriptionHandler) {
        await transcriptionHandler(transcription);
      }

      return c.text("OK", 200);
    } catch (error) {
      console.error("Error handling transcription webhook:", error);
      return c.text("OK", 200);
    }
  });

  /**
   * Fallback handler for unhandled routes
   */
  app.post("/twilio/fallback", async (c) => {
    console.log("[Twilio] Fallback handler called");
    return c.text(
      generateTwiMLSay("Sorry, something went wrong. Please try again later."),
      200,
      { "Content-Type": "application/xml" }
    );
  });

  return app;
}

/**
 * Export session management for testing
 */
export const sessions = {
  sms: smsSessions,
  call: callSessions,
  activity: sessionActivity,
};

export { MAX_SESSION_HISTORY, SESSION_TIMEOUT };
