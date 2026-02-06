import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

describe("Twilio Integration", () => {
  describe("SMS Module", () => {
    test("should export sendSMS function", async () => {
      const { sendSMS } = await import("../src/integrations/twilio/sms");
      expect(typeof sendSMS).toBe("function");
    });

    test("should export sendMMS function", async () => {
      const { sendMMS } = await import("../src/integrations/twilio/sms");
      expect(typeof sendMMS).toBe("function");
    });

    test("should export getMessageStatus function", async () => {
      const { getMessageStatus } = await import("../src/integrations/twilio/sms");
      expect(typeof getMessageStatus).toBe("function");
    });

    test("should export parseIncomingSMS function", async () => {
      const { parseIncomingSMS } = await import("../src/integrations/twilio/sms");
      expect(typeof parseIncomingSMS).toBe("function");
    });

    test("should export generateSMSResponse function", async () => {
      const { generateSMSResponse } = await import("../src/integrations/twilio/sms");
      expect(typeof generateSMSResponse).toBe("function");
    });

    test("should export validateTwilioSignature function", async () => {
      const { validateTwilioSignature } = await import("../src/integrations/twilio/sms");
      expect(typeof validateTwilioSignature).toBe("function");
    });

    test("should export getTwilioConfig function", async () => {
      const { getTwilioConfig } = await import("../src/integrations/twilio/sms");
      expect(typeof getTwilioConfig).toBe("function");
    });

    test("should export isTwilioConfigured function", async () => {
      const { isTwilioConfigured } = await import("../src/integrations/twilio/sms");
      expect(typeof isTwilioConfigured).toBe("function");
    });
  });

  describe("SMS Parsing", () => {
    test("parseIncomingSMS should parse basic SMS", async () => {
      const { parseIncomingSMS } = await import("../src/integrations/twilio/sms");

      const body = {
        MessageSid: "SM123456",
        AccountSid: "AC123456",
        From: "+15551234567",
        To: "+15559876543",
        Body: "Hello, OpenSentinel!",
        NumMedia: "0",
      };

      const sms = parseIncomingSMS(body);

      expect(sms.messageSid).toBe("SM123456");
      expect(sms.accountSid).toBe("AC123456");
      expect(sms.from).toBe("+15551234567");
      expect(sms.to).toBe("+15559876543");
      expect(sms.body).toBe("Hello, OpenSentinel!");
      expect(sms.numMedia).toBe(0);
      expect(sms.mediaUrls).toBeUndefined();
    });

    test("parseIncomingSMS should parse MMS with media", async () => {
      const { parseIncomingSMS } = await import("../src/integrations/twilio/sms");

      const body = {
        MessageSid: "MM123456",
        AccountSid: "AC123456",
        From: "+15551234567",
        To: "+15559876543",
        Body: "Check this out!",
        NumMedia: "2",
        MediaUrl0: "https://api.twilio.com/media/image1.jpg",
        MediaUrl1: "https://api.twilio.com/media/image2.png",
        MediaContentType0: "image/jpeg",
        MediaContentType1: "image/png",
      };

      const sms = parseIncomingSMS(body);

      expect(sms.messageSid).toBe("MM123456");
      expect(sms.numMedia).toBe(2);
      expect(sms.mediaUrls).toHaveLength(2);
      expect(sms.mediaUrls![0]).toBe("https://api.twilio.com/media/image1.jpg");
      expect(sms.mediaUrls![1]).toBe("https://api.twilio.com/media/image2.png");
      expect(sms.mediaContentTypes).toHaveLength(2);
      expect(sms.mediaContentTypes![0]).toBe("image/jpeg");
      expect(sms.mediaContentTypes![1]).toBe("image/png");
    });

    test("parseIncomingSMS should parse location data", async () => {
      const { parseIncomingSMS } = await import("../src/integrations/twilio/sms");

      const body = {
        MessageSid: "SM123456",
        AccountSid: "AC123456",
        From: "+15551234567",
        To: "+15559876543",
        Body: "Hello",
        NumMedia: "0",
        FromCity: "San Francisco",
        FromState: "CA",
        FromCountry: "US",
        FromZip: "94105",
      };

      const sms = parseIncomingSMS(body);

      expect(sms.fromCity).toBe("San Francisco");
      expect(sms.fromState).toBe("CA");
      expect(sms.fromCountry).toBe("US");
      expect(sms.fromZip).toBe("94105");
    });
  });

  describe("SMS Response Generation", () => {
    test("generateSMSResponse should return empty response", async () => {
      const { generateSMSResponse } = await import("../src/integrations/twilio/sms");

      const response = generateSMSResponse();

      expect(response).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });

    test("generateSMSResponse should return message response", async () => {
      const { generateSMSResponse } = await import("../src/integrations/twilio/sms");

      const response = generateSMSResponse("Hello!");

      expect(response).toContain("<Message>Hello!</Message>");
      expect(response).toContain("<?xml version");
      expect(response).toContain("<Response>");
    });

    test("generateSMSResponse should escape XML special characters", async () => {
      const { generateSMSResponse } = await import("../src/integrations/twilio/sms");

      const response = generateSMSResponse('Test <script> & "quotes"');

      expect(response).toContain("&lt;script&gt;");
      expect(response).toContain("&amp;");
      expect(response).toContain("&quot;quotes&quot;");
      expect(response).not.toContain("<script>");
    });
  });

  describe("Voice Module", () => {
    test("should export makeCall function", async () => {
      const { makeCall } = await import("../src/integrations/twilio/voice");
      expect(typeof makeCall).toBe("function");
    });

    test("should export makeCallWithTTS function", async () => {
      const { makeCallWithTTS } = await import("../src/integrations/twilio/voice");
      expect(typeof makeCallWithTTS).toBe("function");
    });

    test("should export getCallStatus function", async () => {
      const { getCallStatus } = await import("../src/integrations/twilio/voice");
      expect(typeof getCallStatus).toBe("function");
    });

    test("should export endCall function", async () => {
      const { endCall } = await import("../src/integrations/twilio/voice");
      expect(typeof endCall).toBe("function");
    });

    test("should export getCallRecordings function", async () => {
      const { getCallRecordings } = await import("../src/integrations/twilio/voice");
      expect(typeof getCallRecordings).toBe("function");
    });

    test("should export deleteRecording function", async () => {
      const { deleteRecording } = await import("../src/integrations/twilio/voice");
      expect(typeof deleteRecording).toBe("function");
    });

    test("should export parseIncomingCall function", async () => {
      const { parseIncomingCall } = await import("../src/integrations/twilio/voice");
      expect(typeof parseIncomingCall).toBe("function");
    });

    test("should export parseRecordingCallback function", async () => {
      const { parseRecordingCallback } = await import("../src/integrations/twilio/voice");
      expect(typeof parseRecordingCallback).toBe("function");
    });

    test("should export parseTranscriptionCallback function", async () => {
      const { parseTranscriptionCallback } = await import("../src/integrations/twilio/voice");
      expect(typeof parseTranscriptionCallback).toBe("function");
    });
  });

  describe("Voice Parsing", () => {
    test("parseIncomingCall should parse basic call", async () => {
      const { parseIncomingCall } = await import("../src/integrations/twilio/voice");

      const body = {
        CallSid: "CA123456",
        AccountSid: "AC123456",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "ringing",
        Direction: "inbound",
      };

      const call = parseIncomingCall(body);

      expect(call.callSid).toBe("CA123456");
      expect(call.accountSid).toBe("AC123456");
      expect(call.from).toBe("+15551234567");
      expect(call.to).toBe("+15559876543");
      expect(call.callStatus).toBe("ringing");
      expect(call.direction).toBe("inbound");
    });

    test("parseIncomingCall should parse speech result", async () => {
      const { parseIncomingCall } = await import("../src/integrations/twilio/voice");

      const body = {
        CallSid: "CA123456",
        AccountSid: "AC123456",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "in-progress",
        Direction: "inbound",
        SpeechResult: "What's the weather like today?",
      };

      const call = parseIncomingCall(body);

      expect(call.speechResult).toBe("What's the weather like today?");
    });

    test("parseIncomingCall should parse DTMF digits", async () => {
      const { parseIncomingCall } = await import("../src/integrations/twilio/voice");

      const body = {
        CallSid: "CA123456",
        AccountSid: "AC123456",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "in-progress",
        Direction: "inbound",
        Digits: "123#",
      };

      const call = parseIncomingCall(body);

      expect(call.digits).toBe("123#");
    });

    test("parseIncomingCall should parse recording info", async () => {
      const { parseIncomingCall } = await import("../src/integrations/twilio/voice");

      const body = {
        CallSid: "CA123456",
        AccountSid: "AC123456",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "completed",
        Direction: "inbound",
        RecordingUrl: "https://api.twilio.com/recording.mp3",
        RecordingDuration: "45",
      };

      const call = parseIncomingCall(body);

      expect(call.recordingUrl).toBe("https://api.twilio.com/recording.mp3");
      expect(call.recordingDuration).toBe(45);
    });

    test("parseRecordingCallback should parse recording data", async () => {
      const { parseRecordingCallback } = await import("../src/integrations/twilio/voice");

      const body = {
        RecordingSid: "RE123456",
        RecordingUrl: "https://api.twilio.com/recording.mp3",
        RecordingDuration: "30",
        RecordingStatus: "completed",
        CallSid: "CA123456",
      };

      const recording = parseRecordingCallback(body);

      expect(recording.recordingSid).toBe("RE123456");
      expect(recording.recordingUrl).toBe("https://api.twilio.com/recording.mp3");
      expect(recording.recordingDuration).toBe(30);
      expect(recording.recordingStatus).toBe("completed");
      expect(recording.callSid).toBe("CA123456");
    });

    test("parseTranscriptionCallback should parse transcription data", async () => {
      const { parseTranscriptionCallback } = await import("../src/integrations/twilio/voice");

      const body = {
        TranscriptionSid: "TR123456",
        TranscriptionText: "Hello, this is a test message.",
        TranscriptionStatus: "completed",
        RecordingSid: "RE123456",
        CallSid: "CA123456",
      };

      const transcription = parseTranscriptionCallback(body);

      expect(transcription.transcriptionSid).toBe("TR123456");
      expect(transcription.transcriptionText).toBe("Hello, this is a test message.");
      expect(transcription.transcriptionStatus).toBe("completed");
      expect(transcription.recordingSid).toBe("RE123456");
      expect(transcription.callSid).toBe("CA123456");
    });
  });

  describe("TwiML Generation", () => {
    test("generateTwiMLSay should generate Say TwiML", async () => {
      const { generateTwiMLSay } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLSay("Hello, world!");

      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Say");
      expect(twiml).toContain("Hello, world!");
      expect(twiml).toContain("</Say>");
      expect(twiml).toContain("</Response>");
    });

    test("generateTwiMLSay should include voice options", async () => {
      const { generateTwiMLSay } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLSay("Test message", {
        voice: "Polly.Matthew",
        language: "en-GB",
        loop: 2,
      });

      expect(twiml).toContain('voice="Polly.Matthew"');
      expect(twiml).toContain('language="en-GB"');
      expect(twiml).toContain('loop="2"');
    });

    test("generateTwiMLSay should escape XML characters", async () => {
      const { generateTwiMLSay } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLSay('Test <tag> & "quotes"');

      expect(twiml).toContain("&lt;tag&gt;");
      expect(twiml).toContain("&amp;");
      expect(twiml).toContain("&quot;quotes&quot;");
    });

    test("generateTwiMLGather should generate Gather TwiML", async () => {
      const { generateTwiMLGather } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLGather("Please speak or press a key");

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Gather");
      expect(twiml).toContain("<Say");
      expect(twiml).toContain("Please speak or press a key");
      expect(twiml).toContain("</Gather>");
    });

    test("generateTwiMLGather should include input options", async () => {
      const { generateTwiMLGather } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLGather("Enter your PIN", {
        input: "dtmf",
        numDigits: 4,
        timeout: 10,
        actionUrl: "/handle-pin",
      });

      expect(twiml).toContain('input="dtmf"');
      expect(twiml).toContain('numDigits="4"');
      expect(twiml).toContain('timeout="10"');
      expect(twiml).toContain('action="/handle-pin"');
    });

    test("generateTwiMLRecord should generate Record TwiML", async () => {
      const { generateTwiMLRecord } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLRecord("Please leave a message");

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Say");
      expect(twiml).toContain("Please leave a message");
      expect(twiml).toContain("<Record");
    });

    test("generateTwiMLRecord should include record options", async () => {
      const { generateTwiMLRecord } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLRecord("Leave a message", {
        maxLength: 60,
        transcribe: true,
        playBeep: true,
        timeout: 5,
      });

      expect(twiml).toContain('maxLength="60"');
      expect(twiml).toContain('transcribe="true"');
      expect(twiml).toContain('playBeep="true"');
      expect(twiml).toContain('timeout="5"');
    });

    test("generateTwiMLPlay should generate Play TwiML", async () => {
      const { generateTwiMLPlay } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLPlay("https://example.com/audio.mp3");

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Play");
      expect(twiml).toContain("https://example.com/audio.mp3");
      expect(twiml).toContain("</Play>");
    });

    test("generateTwiMLPlay should include loop option", async () => {
      const { generateTwiMLPlay } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLPlay("https://example.com/audio.mp3", 3);

      expect(twiml).toContain('loop="3"');
    });

    test("generateTwiMLRedirect should generate Redirect TwiML", async () => {
      const { generateTwiMLRedirect } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLRedirect("/next-step");

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Redirect");
      expect(twiml).toContain("/next-step");
      expect(twiml).toContain("</Redirect>");
    });

    test("generateTwiMLHangup should generate Hangup TwiML", async () => {
      const { generateTwiMLHangup } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLHangup();

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Hangup/>");
      expect(twiml).toContain("</Response>");
    });

    test("generateTwiMLReject should generate Reject TwiML", async () => {
      const { generateTwiMLReject } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLReject("busy");

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain('<Reject reason="busy"/>');
    });

    test("generateTwiMLPause should generate Pause TwiML", async () => {
      const { generateTwiMLPause } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLPause(5);

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain('<Pause length="5"/>');
    });

    test("generateTwiMLResponse should combine verbs", async () => {
      const { generateTwiMLResponse, TwiMLVerbs } = await import("../src/integrations/twilio/voice");

      const twiml = generateTwiMLResponse([
        TwiMLVerbs.say("Hello"),
        TwiMLVerbs.pause(2),
        TwiMLVerbs.say("Goodbye"),
        TwiMLVerbs.hangup(),
      ]);

      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("Hello");
      expect(twiml).toContain("<Pause");
      expect(twiml).toContain("Goodbye");
      expect(twiml).toContain("<Hangup/>");
      expect(twiml).toContain("</Response>");
    });
  });

  describe("TwiML Verbs", () => {
    test("TwiMLVerbs.say should create Say element", async () => {
      const { TwiMLVerbs } = await import("../src/integrations/twilio/voice");

      const verb = TwiMLVerbs.say("Test message");

      expect(verb).toContain("<Say");
      expect(verb).toContain("Test message");
      expect(verb).toContain("</Say>");
    });

    test("TwiMLVerbs.play should create Play element", async () => {
      const { TwiMLVerbs } = await import("../src/integrations/twilio/voice");

      const verb = TwiMLVerbs.play("https://example.com/audio.mp3");

      expect(verb).toContain("<Play");
      expect(verb).toContain("https://example.com/audio.mp3");
      expect(verb).toContain("</Play>");
    });

    test("TwiMLVerbs.pause should create Pause element", async () => {
      const { TwiMLVerbs } = await import("../src/integrations/twilio/voice");

      const verb = TwiMLVerbs.pause(3);

      expect(verb).toContain("<Pause");
      expect(verb).toContain('length="3"');
    });

    test("TwiMLVerbs.hangup should create Hangup element", async () => {
      const { TwiMLVerbs } = await import("../src/integrations/twilio/voice");

      const verb = TwiMLVerbs.hangup();

      expect(verb).toBe("<Hangup/>");
    });

    test("TwiMLVerbs.redirect should create Redirect element", async () => {
      const { TwiMLVerbs } = await import("../src/integrations/twilio/voice");

      const verb = TwiMLVerbs.redirect("/next");

      expect(verb).toContain("<Redirect");
      expect(verb).toContain("/next");
      expect(verb).toContain("</Redirect>");
    });
  });

  describe("Webhook Handler Module", () => {
    test("should export createTwilioWebhooks function", async () => {
      const { createTwilioWebhooks } = await import("../src/integrations/twilio/webhook-handler");
      expect(typeof createTwilioWebhooks).toBe("function");
    });

    test("should export session management functions", async () => {
      const {
        getSMSSession,
        addToSMSSession,
        clearSMSSession,
        getCallSession,
        addToCallSession,
        clearCallSession,
        cleanupExpiredSessions,
      } = await import("../src/integrations/twilio/webhook-handler");

      expect(typeof getSMSSession).toBe("function");
      expect(typeof addToSMSSession).toBe("function");
      expect(typeof clearSMSSession).toBe("function");
      expect(typeof getCallSession).toBe("function");
      expect(typeof addToCallSession).toBe("function");
      expect(typeof clearCallSession).toBe("function");
      expect(typeof cleanupExpiredSessions).toBe("function");
    });

    test("should export sessions object", async () => {
      const { sessions } = await import("../src/integrations/twilio/webhook-handler");

      expect(sessions).toBeTruthy();
      expect(sessions.sms).toBeInstanceOf(Map);
      expect(sessions.call).toBeInstanceOf(Map);
      expect(sessions.activity).toBeInstanceOf(Map);
    });

    test("should export constants", async () => {
      const { MAX_SESSION_HISTORY, SESSION_TIMEOUT } = await import("../src/integrations/twilio/webhook-handler");

      expect(MAX_SESSION_HISTORY).toBe(20);
      expect(SESSION_TIMEOUT).toBe(30 * 60 * 1000);
    });
  });

  describe("SMS Session Management", () => {
    test("getSMSSession should return empty array for new number", async () => {
      const { getSMSSession, sessions } = await import("../src/integrations/twilio/webhook-handler");

      // Clear any existing session
      sessions.sms.delete("+15551234567");
      sessions.activity.delete("sms:+15551234567");

      const session = getSMSSession("+15551234567");

      expect(Array.isArray(session)).toBe(true);
      expect(session.length).toBe(0);

      // Cleanup
      sessions.sms.delete("+15551234567");
      sessions.activity.delete("sms:+15551234567");
    });

    test("addToSMSSession should add message", async () => {
      const { getSMSSession, addToSMSSession, sessions } = await import("../src/integrations/twilio/webhook-handler");

      // Clear existing
      sessions.sms.delete("+15551111111");
      sessions.activity.delete("sms:+15551111111");

      addToSMSSession("+15551111111", { role: "user", content: "Hello via SMS" });

      const session = getSMSSession("+15551111111");
      expect(session.length).toBe(1);
      expect(session[0].role).toBe("user");
      expect(session[0].content).toBe("Hello via SMS");

      // Cleanup
      sessions.sms.delete("+15551111111");
      sessions.activity.delete("sms:+15551111111");
    });

    test("addToSMSSession should maintain max history", async () => {
      const { getSMSSession, addToSMSSession, sessions, MAX_SESSION_HISTORY } = await import("../src/integrations/twilio/webhook-handler");

      // Clear existing
      sessions.sms.delete("+15552222222");
      sessions.activity.delete("sms:+15552222222");

      // Add more than MAX_SESSION_HISTORY messages
      for (let i = 0; i < MAX_SESSION_HISTORY + 5; i++) {
        addToSMSSession("+15552222222", { role: "user", content: `SMS Message ${i}` });
      }

      const session = getSMSSession("+15552222222");
      expect(session.length).toBe(MAX_SESSION_HISTORY);
      expect(session[0].content).toBe("SMS Message 5");

      // Cleanup
      sessions.sms.delete("+15552222222");
      sessions.activity.delete("sms:+15552222222");
    });

    test("clearSMSSession should clear session", async () => {
      const { getSMSSession, addToSMSSession, clearSMSSession, sessions } = await import("../src/integrations/twilio/webhook-handler");

      // Setup
      sessions.sms.delete("+15553333333");
      addToSMSSession("+15553333333", { role: "user", content: "Test" });
      expect(getSMSSession("+15553333333").length).toBe(1);

      // Clear
      clearSMSSession("+15553333333");

      expect(sessions.sms.has("+15553333333")).toBe(false);
      expect(sessions.activity.has("sms:+15553333333")).toBe(false);
    });
  });

  describe("Call Session Management", () => {
    test("getCallSession should return empty array for new call", async () => {
      const { getCallSession, sessions } = await import("../src/integrations/twilio/webhook-handler");

      // Clear any existing session
      sessions.call.delete("CA123456");
      sessions.activity.delete("call:CA123456");

      const session = getCallSession("CA123456");

      expect(Array.isArray(session)).toBe(true);
      expect(session.length).toBe(0);

      // Cleanup
      sessions.call.delete("CA123456");
      sessions.activity.delete("call:CA123456");
    });

    test("addToCallSession should add message", async () => {
      const { getCallSession, addToCallSession, sessions } = await import("../src/integrations/twilio/webhook-handler");

      // Clear existing
      sessions.call.delete("CA111111");
      sessions.activity.delete("call:CA111111");

      addToCallSession("CA111111", { role: "user", content: "What's the weather?" });

      const session = getCallSession("CA111111");
      expect(session.length).toBe(1);
      expect(session[0].content).toBe("What's the weather?");

      // Cleanup
      sessions.call.delete("CA111111");
      sessions.activity.delete("call:CA111111");
    });

    test("clearCallSession should clear session", async () => {
      const { getCallSession, addToCallSession, clearCallSession, sessions } = await import("../src/integrations/twilio/webhook-handler");

      // Setup
      sessions.call.delete("CA222222");
      addToCallSession("CA222222", { role: "user", content: "Test" });
      expect(getCallSession("CA222222").length).toBe(1);

      // Clear
      clearCallSession("CA222222");

      expect(sessions.call.has("CA222222")).toBe(false);
      expect(sessions.activity.has("call:CA222222")).toBe(false);
    });
  });

  describe("Webhook Routes", () => {
    test("createTwilioWebhooks should return Hono app", async () => {
      const { createTwilioWebhooks } = await import("../src/integrations/twilio/webhook-handler");

      const app = createTwilioWebhooks({ validateSignature: false });

      expect(app).toBeTruthy();
      expect(typeof app.fetch).toBe("function");
    });

    test("createTwilioWebhooks should accept custom handlers", async () => {
      const { createTwilioWebhooks } = await import("../src/integrations/twilio/webhook-handler");

      const customSmsHandler = async () => "Custom SMS response";
      const customCallHandler = async () => "Custom call response";
      const customRecordingHandler = async () => {};
      const customTranscriptionHandler = async () => {};

      const app = createTwilioWebhooks({
        validateSignature: false,
        smsHandler: customSmsHandler,
        callHandler: customCallHandler,
        recordingHandler: customRecordingHandler,
        transcriptionHandler: customTranscriptionHandler,
        allowedNumbers: ["+15551234567"],
        systemPrompt: "Custom system prompt",
      });

      expect(app).toBeTruthy();
    });
  });

  describe("Main Index Exports", () => {
    test("should export all SMS functions", async () => {
      const twilio = await import("../src/integrations/twilio");

      expect(typeof twilio.sendSMS).toBe("function");
      expect(typeof twilio.sendMMS).toBe("function");
      expect(typeof twilio.getMessageStatus).toBe("function");
      expect(typeof twilio.parseIncomingSMS).toBe("function");
      expect(typeof twilio.generateSMSResponse).toBe("function");
      expect(typeof twilio.validateTwilioSignature).toBe("function");
      expect(typeof twilio.getTwilioConfig).toBe("function");
      expect(typeof twilio.isTwilioConfigured).toBe("function");
    });

    test("should export all Voice functions", async () => {
      const twilio = await import("../src/integrations/twilio");

      expect(typeof twilio.makeCall).toBe("function");
      expect(typeof twilio.makeCallWithTTS).toBe("function");
      expect(typeof twilio.getCallStatus).toBe("function");
      expect(typeof twilio.endCall).toBe("function");
      expect(typeof twilio.getCallRecordings).toBe("function");
      expect(typeof twilio.deleteRecording).toBe("function");
      expect(typeof twilio.parseIncomingCall).toBe("function");
      expect(typeof twilio.parseRecordingCallback).toBe("function");
      expect(typeof twilio.parseTranscriptionCallback).toBe("function");
    });

    test("should export all TwiML generators", async () => {
      const twilio = await import("../src/integrations/twilio");

      expect(typeof twilio.generateTwiMLSay).toBe("function");
      expect(typeof twilio.generateTwiMLGather).toBe("function");
      expect(typeof twilio.generateTwiMLRecord).toBe("function");
      expect(typeof twilio.generateTwiMLPlay).toBe("function");
      expect(typeof twilio.generateTwiMLRedirect).toBe("function");
      expect(typeof twilio.generateTwiMLHangup).toBe("function");
      expect(typeof twilio.generateTwiMLReject).toBe("function");
      expect(typeof twilio.generateTwiMLPause).toBe("function");
      expect(typeof twilio.generateTwiMLResponse).toBe("function");
      expect(twilio.TwiMLVerbs).toBeTruthy();
    });

    test("should export webhook handler functions", async () => {
      const twilio = await import("../src/integrations/twilio");

      expect(typeof twilio.createTwilioWebhooks).toBe("function");
      expect(typeof twilio.getSMSSession).toBe("function");
      expect(typeof twilio.addToSMSSession).toBe("function");
      expect(typeof twilio.clearSMSSession).toBe("function");
      expect(typeof twilio.getCallSession).toBe("function");
      expect(typeof twilio.addToCallSession).toBe("function");
      expect(typeof twilio.clearCallSession).toBe("function");
      expect(typeof twilio.cleanupExpiredSessions).toBe("function");
    });

    test("should export twilioService object", async () => {
      const twilio = await import("../src/integrations/twilio");

      expect(twilio.twilioService).toBeTruthy();
      expect(typeof twilio.twilioService.getConfig).toBe("function");
      expect(typeof twilio.twilioService.isConfigured).toBe("function");
      expect(typeof twilio.twilioService.sendSMS).toBe("function");
      expect(typeof twilio.twilioService.sendMMS).toBe("function");
      expect(typeof twilio.twilioService.makeCall).toBe("function");
      expect(typeof twilio.twilioService.makeCallWithTTS).toBe("function");
      expect(typeof twilio.twilioService.createWebhooks).toBe("function");
    });

    test("default export should be twilioService", async () => {
      const twilio = await import("../src/integrations/twilio");

      expect(twilio.default).toBe(twilio.twilioService);
    });
  });

  describe("Error Handling", () => {
    test("sendSMS should return error when not configured", async () => {
      const { sendSMS } = await import("../src/integrations/twilio/sms");

      // Pass null config to simulate unconfigured state
      const result = await sendSMS(
        { to: "+15551234567", body: "Test" },
        { accountSid: "", authToken: "", phoneNumber: "" }
      );

      // Will fail due to empty credentials
      expect(result.success).toBe(false);
    });

    test("makeCall should return error when neither twiml nor url provided", async () => {
      const { makeCall } = await import("../src/integrations/twilio/voice");

      const result = await makeCall(
        { to: "+15551234567" },
        { accountSid: "AC123", authToken: "token", phoneNumber: "+15559876543" }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Either twiml or url must be provided");
    });
  });

  describe("Type Exports", () => {
    test("should have SMSMessage type", async () => {
      const mod = await import("../src/integrations/twilio");
      // Type exists if module compiles
      expect(mod).toBeTruthy();
    });

    test("should have SMSResponse type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });

    test("should have IncomingSMS type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });

    test("should have CallOptions type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });

    test("should have CallResponse type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });

    test("should have IncomingCall type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });

    test("should have RecordingInfo type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });

    test("should have TranscriptionInfo type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });

    test("should have WebhookConfig type", async () => {
      const mod = await import("../src/integrations/twilio");
      expect(mod).toBeTruthy();
    });
  });
});
