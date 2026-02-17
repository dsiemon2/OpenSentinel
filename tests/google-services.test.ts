import { describe, test, expect } from "bun:test";
import {
  GoogleServicesClient,
  createGoogleServices,
  GoogleAuth,
  createGoogleAuth,
  GmailService,
  createGmailService,
  GoogleCalendarService,
  createGoogleCalendarService,
  GoogleDriveService,
  createGoogleDriveService,
} from "../src/integrations/google";

describe("Google Services", () => {
  describe("Auth", () => {
    test("should export GoogleAuth class", () => {
      expect(GoogleAuth).toBeDefined();
    });

    test("should export createGoogleAuth function", () => {
      expect(typeof createGoogleAuth).toBe("function");
    });

    test("should create auth instance", () => {
      const auth = createGoogleAuth({
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
      });
      expect(auth).toBeInstanceOf(GoogleAuth);
    });

    test("should report configured when credentials provided", () => {
      const auth = createGoogleAuth({
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
      });
      expect(auth.isConfigured()).toBe(true);
    });

    test("should report not configured when missing credentials", () => {
      const auth = createGoogleAuth({
        clientId: "",
        clientSecret: "",
        redirectUri: "",
      });
      expect(auth.isConfigured()).toBe(false);
    });

    test("should report not authenticated without refresh token", () => {
      const auth = createGoogleAuth({
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
      });
      expect(auth.isAuthenticated()).toBe(false);
    });

    test("should report authenticated with refresh token", () => {
      const auth = createGoogleAuth({
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
        refreshToken: "test-refresh-token",
      });
      expect(auth.isAuthenticated()).toBe(true);
    });

    test("should generate authorization URL with scopes", () => {
      const auth = createGoogleAuth({
        clientId: "test-client-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
      });
      const url = auth.getAuthorizationUrl();
      expect(url).toContain("accounts.google.com");
      expect(url).toContain("test-client-id");
      expect(url).toContain("response_type=code");
      expect(url).toContain("access_type=offline");
    });

    test("should include custom scopes in auth URL", () => {
      const auth = createGoogleAuth({
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
      });
      const url = auth.getAuthorizationUrl(["https://www.googleapis.com/auth/gmail.readonly"]);
      expect(url).toContain("gmail.readonly");
    });
  });

  describe("Gmail", () => {
    test("should export GmailService class", () => {
      expect(GmailService).toBeDefined();
    });

    test("should export createGmailService function", () => {
      expect(typeof createGmailService).toBe("function");
    });

    test("should create gmail service", () => {
      const auth = createGoogleAuth({
        clientId: "test",
        clientSecret: "test",
        redirectUri: "http://localhost",
      });
      const gmail = createGmailService(auth);
      expect(gmail).toBeInstanceOf(GmailService);
    });

    test("should have listEmails method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const gmail = createGmailService(auth);
      expect(typeof gmail.listEmails).toBe("function");
    });

    test("should have sendEmail method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const gmail = createGmailService(auth);
      expect(typeof gmail.sendEmail).toBe("function");
    });

    test("should have searchEmails method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const gmail = createGmailService(auth);
      expect(typeof gmail.searchEmails).toBe("function");
    });

    test("should have getLabels method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const gmail = createGmailService(auth);
      expect(typeof gmail.getLabels).toBe("function");
    });
  });

  describe("Calendar", () => {
    test("should export GoogleCalendarService class", () => {
      expect(GoogleCalendarService).toBeDefined();
    });

    test("should export createGoogleCalendarService function", () => {
      expect(typeof createGoogleCalendarService).toBe("function");
    });

    test("should have listEvents method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const cal = createGoogleCalendarService(auth);
      expect(typeof cal.listEvents).toBe("function");
    });

    test("should have createEvent method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const cal = createGoogleCalendarService(auth);
      expect(typeof cal.createEvent).toBe("function");
    });

    test("should have updateEvent method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const cal = createGoogleCalendarService(auth);
      expect(typeof cal.updateEvent).toBe("function");
    });

    test("should have deleteEvent method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const cal = createGoogleCalendarService(auth);
      expect(typeof cal.deleteEvent).toBe("function");
    });
  });

  describe("Drive", () => {
    test("should export GoogleDriveService class", () => {
      expect(GoogleDriveService).toBeDefined();
    });

    test("should export createGoogleDriveService function", () => {
      expect(typeof createGoogleDriveService).toBe("function");
    });

    test("should have listFiles method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const drive = createGoogleDriveService(auth);
      expect(typeof drive.listFiles).toBe("function");
    });

    test("should have searchFiles method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const drive = createGoogleDriveService(auth);
      expect(typeof drive.searchFiles).toBe("function");
    });

    test("should have uploadFile method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const drive = createGoogleDriveService(auth);
      expect(typeof drive.uploadFile).toBe("function");
    });

    test("should have downloadFile method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const drive = createGoogleDriveService(auth);
      expect(typeof drive.downloadFile).toBe("function");
    });

    test("should have shareFile method", () => {
      const auth = createGoogleAuth({ clientId: "t", clientSecret: "t", redirectUri: "t" });
      const drive = createGoogleDriveService(auth);
      expect(typeof drive.shareFile).toBe("function");
    });
  });

  describe("Factory", () => {
    test("should export createGoogleServices function", () => {
      expect(typeof createGoogleServices).toBe("function");
    });

    test("should export GoogleServicesClient class", () => {
      expect(GoogleServicesClient).toBeDefined();
    });

    test("should create a client with all services", () => {
      const client = createGoogleServices({
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
      });

      expect(client).toBeInstanceOf(GoogleServicesClient);
      expect(client.auth).toBeInstanceOf(GoogleAuth);
      expect(client.gmail).toBeInstanceOf(GmailService);
      expect(client.calendar).toBeInstanceOf(GoogleCalendarService);
      expect(client.drive).toBeInstanceOf(GoogleDriveService);
    });
  });
});
