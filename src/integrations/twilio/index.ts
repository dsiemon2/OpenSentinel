/**
 * Twilio Integration for Moltbot
 *
 * Main export file for SMS and Voice (phone call) integration using Twilio.
 */

// SMS exports
export {
  sendSMS,
  sendMMS,
  getMessageStatus,
  parseIncomingSMS,
  generateSMSResponse,
  validateTwilioSignature,
  getTwilioConfig,
  isTwilioConfigured,
  type SMSMessage,
  type SMSResponse,
  type IncomingSMS,
  type SMSConfig,
} from "./sms";

// Voice exports
export {
  makeCall,
  makeCallWithTTS,
  getCallStatus,
  endCall,
  getCallRecordings,
  deleteRecording,
  parseIncomingCall,
  parseRecordingCallback,
  parseTranscriptionCallback,
  generateTwiMLSay,
  generateTwiMLGather,
  generateTwiMLRecord,
  generateTwiMLPlay,
  generateTwiMLRedirect,
  generateTwiMLHangup,
  generateTwiMLReject,
  generateTwiMLPause,
  generateTwiMLResponse,
  TwiMLVerbs,
  type CallOptions,
  type CallResponse,
  type IncomingCall,
  type RecordingInfo,
  type TranscriptionInfo,
  type TwiMLVoice,
  type SayOptions,
  type GatherOptions,
  type RecordOptions,
} from "./voice";

// Webhook handler exports
export {
  createTwilioWebhooks,
  getSMSSession,
  addToSMSSession,
  clearSMSSession,
  getCallSession,
  addToCallSession,
  clearCallSession,
  cleanupExpiredSessions,
  sessions,
  MAX_SESSION_HISTORY,
  SESSION_TIMEOUT,
  type WebhookConfig,
} from "./webhook-handler";

// Convenience re-exports
import { getTwilioConfig, sendSMS, sendMMS } from "./sms";
import { makeCall, makeCallWithTTS } from "./voice";
import { createTwilioWebhooks } from "./webhook-handler";

/**
 * Main Twilio service object for easy access
 */
export const twilioService = {
  // Configuration
  getConfig: getTwilioConfig,
  isConfigured: () => getTwilioConfig() !== null,

  // SMS/MMS
  sendSMS,
  sendMMS,

  // Voice
  makeCall,
  makeCallWithTTS,

  // Webhooks
  createWebhooks: createTwilioWebhooks,
};

export default twilioService;
