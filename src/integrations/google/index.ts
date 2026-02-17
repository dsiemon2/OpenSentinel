/**
 * Google Services Integration for OpenSentinel
 *
 * Provides unified access to Gmail, Google Calendar, and Google Drive
 * through a single OAuth2 authentication layer.
 */

import { GoogleAuth, createGoogleAuth, type GoogleAuthConfig } from "./auth";
import { GmailService, createGmailService } from "./gmail";
import { GoogleCalendarService, createGoogleCalendarService } from "./calendar";
import { GoogleDriveService, createGoogleDriveService } from "./drive";

export interface GoogleServicesConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

export class GoogleServicesClient {
  readonly auth: GoogleAuth;
  readonly gmail: GmailService;
  readonly calendar: GoogleCalendarService;
  readonly drive: GoogleDriveService;

  constructor(config: GoogleServicesConfig) {
    this.auth = createGoogleAuth(config);
    this.gmail = createGmailService(this.auth);
    this.calendar = createGoogleCalendarService(this.auth);
    this.drive = createGoogleDriveService(this.auth);
  }
}

export function createGoogleServices(config: GoogleServicesConfig): GoogleServicesClient {
  return new GoogleServicesClient(config);
}

// Re-exports
export { GoogleAuth, createGoogleAuth } from "./auth";
export type { GoogleAuthConfig, GoogleTokens } from "./auth";
export { GmailService, createGmailService } from "./gmail";
export type { GmailMessage, GmailLabel } from "./gmail";
export { GoogleCalendarService, createGoogleCalendarService } from "./calendar";
export type { CalendarEvent, CreateEventInput } from "./calendar";
export { GoogleDriveService, createGoogleDriveService } from "./drive";
export type { DriveFile } from "./drive";
