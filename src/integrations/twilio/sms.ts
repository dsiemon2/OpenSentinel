/**
 * Twilio SMS Integration for Moltbot
 *
 * Provides functionality to send and receive SMS/MMS messages via Twilio.
 */

import { env } from "../../config/env";

// Twilio API base URL
const TWILIO_API_URL = "https://api.twilio.com/2010-04-01";

export interface SMSMessage {
  to: string;
  body: string;
  mediaUrl?: string | string[];
  statusCallback?: string;
}

export interface SMSResponse {
  success: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
  dateCreated?: string;
  direction?: string;
  from?: string;
  to?: string;
}

export interface IncomingSMS {
  messageSid: string;
  accountSid: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
  mediaUrls?: string[];
  mediaContentTypes?: string[];
  fromCity?: string;
  fromState?: string;
  fromCountry?: string;
  fromZip?: string;
}

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

/**
 * Get Twilio configuration from environment
 */
export function getTwilioConfig(): SMSConfig | null {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    return null;
  }

  return {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
  };
}

/**
 * Create basic auth header for Twilio API
 */
function createAuthHeader(accountSid: string, authToken: string): string {
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * Send an SMS message
 */
export async function sendSMS(
  message: SMSMessage,
  config?: SMSConfig
): Promise<SMSResponse> {
  const twilioConfig = config || getTwilioConfig();

  if (!twilioConfig) {
    return {
      success: false,
      error: "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    };
  }

  const { accountSid, authToken, phoneNumber } = twilioConfig;

  try {
    // Build form data
    const formData = new URLSearchParams();
    formData.append("To", message.to);
    formData.append("From", phoneNumber);
    formData.append("Body", message.body);

    // Add media URLs for MMS
    if (message.mediaUrl) {
      const mediaUrls = Array.isArray(message.mediaUrl) ? message.mediaUrl : [message.mediaUrl];
      for (const url of mediaUrls) {
        formData.append("MediaUrl", url);
      }
    }

    // Add status callback if provided
    if (message.statusCallback) {
      formData.append("StatusCallback", message.statusCallback);
    }

    const response = await fetch(
      `${TWILIO_API_URL}/Accounts/${accountSid}/Messages.json`,
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
      messageSid: data.sid as string,
      status: data.status as string,
      dateCreated: data.date_created as string,
      direction: data.direction as string,
      from: data.from as string,
      to: data.to as string,
    };
  } catch (error) {
    console.error("Error sending SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending SMS",
    };
  }
}

/**
 * Send an MMS message with media attachments
 */
export async function sendMMS(
  to: string,
  body: string,
  mediaUrls: string | string[],
  config?: SMSConfig
): Promise<SMSResponse> {
  return sendSMS(
    {
      to,
      body,
      mediaUrl: mediaUrls,
    },
    config
  );
}

/**
 * Get message status by SID
 */
export async function getMessageStatus(
  messageSid: string,
  config?: SMSConfig
): Promise<SMSResponse> {
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
      `${TWILIO_API_URL}/Accounts/${accountSid}/Messages/${messageSid}.json`,
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
      messageSid: data.sid as string,
      status: data.status as string,
      dateCreated: data.date_created as string,
      direction: data.direction as string,
      from: data.from as string,
      to: data.to as string,
    };
  } catch (error) {
    console.error("Error getting message status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse incoming SMS webhook data from Twilio
 */
export function parseIncomingSMS(body: Record<string, string>): IncomingSMS {
  const numMedia = parseInt(body.NumMedia || "0", 10);
  const mediaUrls: string[] = [];
  const mediaContentTypes: string[] = [];

  // Extract media URLs if present
  for (let i = 0; i < numMedia; i++) {
    if (body[`MediaUrl${i}`]) {
      mediaUrls.push(body[`MediaUrl${i}`]);
    }
    if (body[`MediaContentType${i}`]) {
      mediaContentTypes.push(body[`MediaContentType${i}`]);
    }
  }

  return {
    messageSid: body.MessageSid || body.SmsSid || "",
    accountSid: body.AccountSid || "",
    from: body.From || "",
    to: body.To || "",
    body: body.Body || "",
    numMedia,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    mediaContentTypes: mediaContentTypes.length > 0 ? mediaContentTypes : undefined,
    fromCity: body.FromCity,
    fromState: body.FromState,
    fromCountry: body.FromCountry,
    fromZip: body.FromZip,
  };
}

/**
 * Generate TwiML response for SMS
 */
export function generateSMSResponse(message?: string): string {
  if (!message) {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  // Escape XML special characters
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapedMessage}</Message></Response>`;
}

/**
 * Validate Twilio webhook signature
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
  authToken: string
): boolean {
  // Build the string to sign
  let data = url;
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // Create HMAC-SHA1 signature
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(data, "utf-8")
    .digest("base64");

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return getTwilioConfig() !== null;
}
