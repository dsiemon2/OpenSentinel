/**
 * Google Drive Integration
 *
 * Provides comprehensive Google Drive API integration for OpenSentinel,
 * including file operations, folder management, sharing, and sync.
 */

import { env } from "../../config/env";
import * as fs from "fs";
import * as path from "path";

// Types
export interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  refreshToken?: string;
  accessToken?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  starred?: boolean;
  trashed?: boolean;
  shared?: boolean;
  owners?: DriveUser[];
  permissions?: DrivePermission[];
}

export interface DriveUser {
  kind: string;
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

export interface DrivePermission {
  id: string;
  type: "user" | "group" | "domain" | "anyone";
  role: "owner" | "organizer" | "fileOrganizer" | "writer" | "commenter" | "reader";
  emailAddress?: string;
  domain?: string;
  displayName?: string;
}

export interface ListFilesOptions {
  folderId?: string;
  query?: string;
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
  fields?: string;
  includeTrash?: boolean;
}

export interface ListFilesResult {
  files: DriveFile[];
  nextPageToken?: string;
}

export interface UploadOptions {
  name: string;
  mimeType?: string;
  parents?: string[];
  description?: string;
  starred?: boolean;
}

export interface DownloadOptions {
  destinationPath?: string;
  exportMimeType?: string;
}

export interface ShareOptions {
  role: "owner" | "organizer" | "fileOrganizer" | "writer" | "commenter" | "reader";
  type: "user" | "group" | "domain" | "anyone";
  emailAddress?: string;
  domain?: string;
  sendNotificationEmail?: boolean;
  emailMessage?: string;
}

export interface SyncOptions {
  localPath: string;
  remoteFolderId?: string;
  recursive?: boolean;
  deleteRemote?: boolean;
  deleteLocal?: boolean;
}

export interface SyncResult {
  uploaded: string[];
  downloaded: string[];
  deleted: string[];
  errors: Array<{ path: string; error: string }>;
}

// OAuth2 Token Response
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// State management
let currentConfig: GoogleDriveConfig | null = null;
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

// API Base URLs
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3";
const OAUTH2_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Initialize Google Drive client with configuration
 */
export function initGoogleDrive(config: GoogleDriveConfig): void {
  currentConfig = {
    clientId: config.clientId || env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: config.clientSecret || env.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri: config.redirectUri || env.GOOGLE_DRIVE_REDIRECT_URI,
    refreshToken: config.refreshToken || env.GOOGLE_DRIVE_REFRESH_TOKEN,
    accessToken: config.accessToken,
  };

  // If access token provided directly, use it
  if (config.accessToken) {
    cachedAccessToken = config.accessToken;
    tokenExpiresAt = Date.now() + 3600000; // Assume 1 hour validity
  }
}

/**
 * Check if Google Drive is initialized
 */
export function isGoogleDriveInitialized(): boolean {
  return currentConfig !== null;
}

/**
 * Get OAuth2 authorization URL for user consent
 */
export function getAuthorizationUrl(state?: string): string {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.redirectUri || "urn:ietf:wg:oauth:2.0:oob",
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  if (state) {
    params.set("state", state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const config = getConfig();

  const response = await fetch(OAUTH2_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      redirect_uri: config.redirectUri || "urn:ietf:wg:oauth:2.0:oob",
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to exchange code: ${error.error_description || error.error}`);
  }

  const tokens = await response.json() as TokenResponse;

  // Cache the tokens
  cachedAccessToken = tokens.access_token;
  tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

  if (tokens.refresh_token && currentConfig) {
    currentConfig.refreshToken = tokens.refresh_token;
  }

  return tokens;
}

/**
 * Get valid access token, refreshing if necessary
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const config = getConfig();

  // If we have an access token in config and no refresh token, use it
  if (config.accessToken && !config.refreshToken) {
    return config.accessToken;
  }

  // Refresh the token
  if (!config.refreshToken) {
    throw new Error("No refresh token available. Please authenticate first.");
  }

  const response = await fetch(OAUTH2_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to refresh token: ${error.error_description || error.error}`);
  }

  const tokens = await response.json() as TokenResponse;
  cachedAccessToken = tokens.access_token;
  tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

  return cachedAccessToken;
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: string = DRIVE_API_BASE
): Promise<T> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Get configuration, throwing if not initialized
 */
function getConfig(): GoogleDriveConfig {
  if (!currentConfig) {
    // Try to initialize from environment
    if (env.GOOGLE_DRIVE_CLIENT_ID) {
      initGoogleDrive({});
    } else {
      throw new Error("Google Drive not initialized. Call initGoogleDrive() first.");
    }
  }
  return currentConfig!;
}

/**
 * List files in Google Drive
 */
export async function listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
  const params = new URLSearchParams();

  // Build query
  let query = options.query || "";
  if (options.folderId) {
    const folderQuery = `'${options.folderId}' in parents`;
    query = query ? `${query} and ${folderQuery}` : folderQuery;
  }
  if (!options.includeTrash) {
    const trashQuery = "trashed = false";
    query = query ? `${query} and ${trashQuery}` : trashQuery;
  }
  if (query) {
    params.set("q", query);
  }

  if (options.pageSize) {
    params.set("pageSize", Math.min(options.pageSize, 1000).toString());
  }
  if (options.pageToken) {
    params.set("pageToken", options.pageToken);
  }
  if (options.orderBy) {
    params.set("orderBy", options.orderBy);
  }

  const fields =
    options.fields ||
    "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, starred, trashed, shared)";
  params.set("fields", fields);

  const result = await apiRequest<{
    files: DriveFile[];
    nextPageToken?: string;
  }>(`/files?${params.toString()}`);

  return {
    files: result.files || [],
    nextPageToken: result.nextPageToken,
  };
}

/**
 * List all files (handles pagination automatically)
 */
export async function listAllFiles(options: Omit<ListFilesOptions, "pageToken"> = {}): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const result = await listFiles({ ...options, pageToken });
    allFiles.push(...result.files);
    pageToken = result.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Get file metadata by ID
 */
export async function getFile(fileId: string): Promise<DriveFile> {
  const fields =
    "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, iconLink, thumbnailLink, starred, trashed, shared, owners, permissions";
  return apiRequest<DriveFile>(`/files/${fileId}?fields=${fields}`);
}

/**
 * Search files by name or content
 */
export async function searchFiles(
  searchTerm: string,
  options: {
    searchContent?: boolean;
    mimeType?: string;
    folderId?: string;
    pageSize?: number;
  } = {}
): Promise<DriveFile[]> {
  const queries: string[] = [];

  if (options.searchContent) {
    queries.push(`fullText contains '${searchTerm}'`);
  } else {
    queries.push(`name contains '${searchTerm}'`);
  }

  if (options.mimeType) {
    queries.push(`mimeType = '${options.mimeType}'`);
  }

  if (options.folderId) {
    queries.push(`'${options.folderId}' in parents`);
  }

  queries.push("trashed = false");

  const result = await listFiles({
    query: queries.join(" and "),
    pageSize: options.pageSize || 100,
  });

  return result.files;
}

/**
 * Upload a file to Google Drive
 */
export async function uploadFile(
  content: Buffer | string | Blob,
  options: UploadOptions
): Promise<DriveFile> {
  const accessToken = await getAccessToken();

  // Prepare metadata
  const metadata: Record<string, unknown> = {
    name: options.name,
  };

  if (options.parents) {
    metadata.parents = options.parents;
  }
  if (options.description) {
    metadata.description = options.description;
  }
  if (options.starred !== undefined) {
    metadata.starred = options.starred;
  }

  // Convert content to Blob if needed
  let contentBlob: Blob;
  if (Buffer.isBuffer(content)) {
    contentBlob = new Blob([new Uint8Array(content)]);
  } else if (typeof content === "string") {
    contentBlob = new Blob([content], { type: "text/plain" });
  } else {
    contentBlob = content;
  }

  // Create multipart form
  const boundary = "-------" + Date.now().toString(16);
  const metadataString = JSON.stringify(metadata);

  // Build multipart body
  const parts: string[] = [];
  parts.push(`--${boundary}`);
  parts.push("Content-Type: application/json; charset=UTF-8");
  parts.push("");
  parts.push(metadataString);
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: ${options.mimeType || "application/octet-stream"}`);
  parts.push("");

  const prefix = parts.join("\r\n") + "\r\n";
  const suffix = `\r\n--${boundary}--`;

  // Combine into single body
  const contentArrayBuffer = await contentBlob.arrayBuffer();
  const prefixBuffer = new TextEncoder().encode(prefix);
  const suffixBuffer = new TextEncoder().encode(suffix);
  const contentBuffer = new Uint8Array(contentArrayBuffer);

  const bodyBuffer = new Uint8Array(prefixBuffer.length + contentBuffer.length + suffixBuffer.length);
  bodyBuffer.set(prefixBuffer, 0);
  bodyBuffer.set(contentBuffer, prefixBuffer.length);
  bodyBuffer.set(suffixBuffer, prefixBuffer.length + contentBuffer.length);

  const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Upload failed: ${error.error?.message || response.status}`);
  }

  return response.json() as Promise<DriveFile>;
}

/**
 * Upload a file from local filesystem
 */
export async function uploadLocalFile(
  localPath: string,
  options: Omit<UploadOptions, "name"> & { name?: string }
): Promise<DriveFile> {
  const fileContent = await fs.promises.readFile(localPath);
  const fileName = options.name || path.basename(localPath);

  // Detect MIME type from extension
  const ext = path.extname(localPath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".txt": "text/plain",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
  };

  return uploadFile(fileContent, {
    ...options,
    name: fileName,
    mimeType: options.mimeType || mimeTypes[ext] || "application/octet-stream",
  });
}

/**
 * Download file content
 */
export async function downloadFile(
  fileId: string,
  options: DownloadOptions = {}
): Promise<{ content: Buffer; name: string; mimeType: string }> {
  const accessToken = await getAccessToken();

  // Get file metadata first
  const file = await getFile(fileId);

  // Determine if we need to export (Google Docs) or download
  const isGoogleDoc = file.mimeType.startsWith("application/vnd.google-apps.");

  let url: string;
  let finalMimeType: string;

  if (isGoogleDoc) {
    // Export Google Docs format
    const exportMimeType = options.exportMimeType || getDefaultExportMimeType(file.mimeType);
    url = `${DRIVE_API_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
    finalMimeType = exportMimeType;
  } else {
    url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
    finalMimeType = file.mimeType;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const content = Buffer.from(arrayBuffer);

  // Save to file if destination path provided
  if (options.destinationPath) {
    await fs.promises.writeFile(options.destinationPath, content);
  }

  return {
    content,
    name: file.name,
    mimeType: finalMimeType,
  };
}

/**
 * Get default export MIME type for Google Docs formats
 */
function getDefaultExportMimeType(googleMimeType: string): string {
  const exportMap: Record<string, string> = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.drawing": "image/png",
  };
  return exportMap[googleMimeType] || "application/pdf";
}

/**
 * Create a folder in Google Drive
 */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  return apiRequest<DriveFile>("/files?fields=id,name,mimeType,createdTime,modifiedTime,webViewLink", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
}

/**
 * Delete a file or folder
 */
export async function deleteFile(fileId: string, permanent: boolean = false): Promise<void> {
  if (permanent) {
    await apiRequest(`/files/${fileId}`, {
      method: "DELETE",
    });
  } else {
    // Move to trash
    await apiRequest(`/files/${fileId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    });
  }
}

/**
 * Restore a file from trash
 */
export async function restoreFile(fileId: string): Promise<DriveFile> {
  return apiRequest<DriveFile>(`/files/${fileId}?fields=id,name,mimeType,trashed`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trashed: false }),
  });
}

/**
 * Move a file to a different folder
 */
export async function moveFile(
  fileId: string,
  newParentId: string,
  removeFromCurrentParent: boolean = true
): Promise<DriveFile> {
  const file = await getFile(fileId);
  const currentParents = file.parents?.join(",") || "";

  const params = new URLSearchParams();
  params.set("addParents", newParentId);
  if (removeFromCurrentParent && currentParents) {
    params.set("removeParents", currentParents);
  }
  params.set("fields", "id,name,mimeType,parents");

  return apiRequest<DriveFile>(`/files/${fileId}?${params.toString()}`, {
    method: "PATCH",
  });
}

/**
 * Rename a file
 */
export async function renameFile(fileId: string, newName: string): Promise<DriveFile> {
  return apiRequest<DriveFile>(`/files/${fileId}?fields=id,name,mimeType`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: newName }),
  });
}

/**
 * Copy a file
 */
export async function copyFile(
  fileId: string,
  options: { name?: string; parentId?: string } = {}
): Promise<DriveFile> {
  const body: Record<string, unknown> = {};

  if (options.name) {
    body.name = options.name;
  }
  if (options.parentId) {
    body.parents = [options.parentId];
  }

  return apiRequest<DriveFile>(`/files/${fileId}/copy?fields=id,name,mimeType,createdTime,modifiedTime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Share a file and get sharing link
 */
export async function shareFile(
  fileId: string,
  options: ShareOptions
): Promise<{ permissionId: string; link?: string }> {
  const body: Record<string, unknown> = {
    role: options.role,
    type: options.type,
  };

  if (options.emailAddress) {
    body.emailAddress = options.emailAddress;
  }
  if (options.domain) {
    body.domain = options.domain;
  }

  const params = new URLSearchParams();
  if (options.sendNotificationEmail !== undefined) {
    params.set("sendNotificationEmail", options.sendNotificationEmail.toString());
  }
  if (options.emailMessage) {
    params.set("emailMessage", options.emailMessage);
  }

  const permission = await apiRequest<DrivePermission>(
    `/files/${fileId}/permissions?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  // Get the sharing link
  const file = await getFile(fileId);

  return {
    permissionId: permission.id,
    link: file.webViewLink,
  };
}

/**
 * Get shareable link for a file (creates "anyone with link can view" permission)
 */
export async function getShareableLink(
  fileId: string,
  role: "reader" | "writer" | "commenter" = "reader"
): Promise<string> {
  // Create anyone permission
  await shareFile(fileId, {
    role,
    type: "anyone",
  });

  // Get the link
  const file = await getFile(fileId);
  return file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Remove sharing permission
 */
export async function unshareFile(fileId: string, permissionId: string): Promise<void> {
  await apiRequest(`/files/${fileId}/permissions/${permissionId}`, {
    method: "DELETE",
  });
}

/**
 * List permissions for a file
 */
export async function listPermissions(fileId: string): Promise<DrivePermission[]> {
  const result = await apiRequest<{ permissions: DrivePermission[] }>(
    `/files/${fileId}/permissions?fields=permissions(id,type,role,emailAddress,domain,displayName)`
  );
  return result.permissions || [];
}

/**
 * Sync local folder with Google Drive folder
 */
export async function syncFolder(options: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: [],
    downloaded: [],
    deleted: [],
    errors: [],
  };

  const remoteFolderId = options.remoteFolderId || "root";

  try {
    // Get remote files
    const remoteFiles = await listAllFiles({ folderId: remoteFolderId });
    const remoteFileMap = new Map(remoteFiles.map((f) => [f.name, f]));

    // Get local files
    const localFiles = await fs.promises.readdir(options.localPath, {
      withFileTypes: true,
    });
    const localFileNames = new Set(
      localFiles.filter((f) => f.isFile()).map((f) => f.name)
    );

    // Upload new or modified local files
    for (const localFile of localFiles) {
      if (!localFile.isFile()) {
        if (options.recursive && localFile.isDirectory()) {
          // Handle subdirectories recursively
          const subLocalPath = path.join(options.localPath, localFile.name);
          const remoteSubfolder = remoteFileMap.get(localFile.name);

          let subfolderId: string;
          if (remoteSubfolder && remoteSubfolder.mimeType === "application/vnd.google-apps.folder") {
            subfolderId = remoteSubfolder.id;
          } else {
            const newFolder = await createFolder(localFile.name, remoteFolderId);
            subfolderId = newFolder.id;
          }

          const subResult = await syncFolder({
            ...options,
            localPath: subLocalPath,
            remoteFolderId: subfolderId,
          });

          result.uploaded.push(...subResult.uploaded);
          result.downloaded.push(...subResult.downloaded);
          result.deleted.push(...subResult.deleted);
          result.errors.push(...subResult.errors);
        }
        continue;
      }

      const localFilePath = path.join(options.localPath, localFile.name);
      const remoteFile = remoteFileMap.get(localFile.name);

      try {
        if (!remoteFile) {
          // Upload new file
          await uploadLocalFile(localFilePath, { parents: [remoteFolderId] });
          result.uploaded.push(localFilePath);
        } else {
          // Check if local file is newer
          const localStats = await fs.promises.stat(localFilePath);
          const remoteModified = remoteFile.modifiedTime
            ? new Date(remoteFile.modifiedTime).getTime()
            : 0;

          if (localStats.mtimeMs > remoteModified) {
            // Update remote file
            await deleteFile(remoteFile.id, true);
            await uploadLocalFile(localFilePath, { parents: [remoteFolderId] });
            result.uploaded.push(localFilePath);
          } else if (localStats.mtimeMs < remoteModified) {
            // Download remote file
            await downloadFile(remoteFile.id, { destinationPath: localFilePath });
            result.downloaded.push(localFilePath);
          }
        }
      } catch (error) {
        result.errors.push({
          path: localFilePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Handle remote-only files
    for (const [remoteName, remoteFile] of Array.from(remoteFileMap.entries())) {
      if (!localFileNames.has(remoteName)) {
        const localFilePath = path.join(options.localPath, remoteName);

        if (options.deleteRemote) {
          // Delete remote file
          try {
            await deleteFile(remoteFile.id);
            result.deleted.push(`remote:${remoteName}`);
          } catch (error) {
            result.errors.push({
              path: `remote:${remoteName}`,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else if (remoteFile.mimeType !== "application/vnd.google-apps.folder") {
          // Download remote file
          try {
            await downloadFile(remoteFile.id, { destinationPath: localFilePath });
            result.downloaded.push(localFilePath);
          } catch (error) {
            result.errors.push({
              path: localFilePath,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  } catch (error) {
    result.errors.push({
      path: options.localPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<{
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInTrash: number;
}> {
  const result = await apiRequest<{
    storageQuota: {
      limit: string;
      usage: string;
      usageInDrive: string;
      usageInDriveTrash: string;
    };
  }>("/about?fields=storageQuota");

  return {
    limit: parseInt(result.storageQuota.limit, 10),
    usage: parseInt(result.storageQuota.usage, 10),
    usageInDrive: parseInt(result.storageQuota.usageInDrive, 10),
    usageInTrash: parseInt(result.storageQuota.usageInDriveTrash, 10),
  };
}

/**
 * Reset Google Drive client
 */
export function resetGoogleDrive(): void {
  currentConfig = null;
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}
