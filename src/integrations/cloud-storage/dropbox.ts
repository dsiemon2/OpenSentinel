/**
 * Dropbox Integration
 *
 * Provides comprehensive Dropbox API integration for OpenSentinel,
 * including file operations, folder management, sharing, and sync.
 */

import { env } from "../../config/env";
import * as fs from "fs";
import * as path from "path";

// Types
export interface DropboxConfig {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface DropboxFile {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  ".tag": "file" | "folder" | "deleted";
  size?: number;
  is_downloadable?: boolean;
  client_modified?: string;
  server_modified?: string;
  rev?: string;
  content_hash?: string;
  sharing_info?: {
    read_only: boolean;
    parent_shared_folder_id?: string;
    modified_by?: string;
  };
}

export interface DropboxFolder {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  ".tag": "folder";
  sharing_info?: {
    read_only: boolean;
    parent_shared_folder_id?: string;
    traverse_only?: boolean;
    no_access?: boolean;
  };
}

export type DropboxEntry = DropboxFile | DropboxFolder;

export interface ListFolderOptions {
  path: string;
  recursive?: boolean;
  includeDeleted?: boolean;
  includeMediaInfo?: boolean;
  limit?: number;
}

export interface ListFolderResult {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

export interface UploadOptions {
  path: string;
  mode?: "add" | "overwrite" | "update";
  autorename?: boolean;
  mute?: boolean;
  strict_conflict?: boolean;
}

export interface DownloadOptions {
  destinationPath?: string;
}

export interface ShareOptions {
  requested_visibility?: "public" | "team_only" | "password";
  link_password?: string;
  expires?: string;
  audience?: "public" | "team" | "no_one";
  access?: "viewer" | "editor" | "max";
}

export interface SharedLink {
  url: string;
  name: string;
  path_lower: string;
  link_permissions: {
    resolved_visibility: {
      ".tag": string;
    };
    can_revoke: boolean;
  };
  expires?: string;
}

export interface SyncOptions {
  localPath: string;
  remotePath: string;
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

export interface SearchResult {
  matches: Array<{
    match_type: { ".tag": string };
    metadata: DropboxEntry;
  }>;
  more: boolean;
  start: number;
}

export interface SpaceUsage {
  used: number;
  allocation: {
    ".tag": "individual" | "team";
    allocated?: number;
  };
}

// OAuth2 Token Response
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  uid?: string;
  account_id?: string;
}

// State management
let currentConfig: DropboxConfig | null = null;
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

// API Base URLs
const API_BASE = "https://api.dropboxapi.com/2";
const CONTENT_API_BASE = "https://content.dropboxapi.com/2";
const OAUTH2_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const OAUTH2_AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";

/**
 * Initialize Dropbox client with configuration
 */
export function initDropbox(config: DropboxConfig): void {
  currentConfig = {
    appKey: config.appKey || env.DROPBOX_APP_KEY,
    appSecret: config.appSecret || env.DROPBOX_APP_SECRET,
    accessToken: config.accessToken || env.DROPBOX_ACCESS_TOKEN,
    refreshToken: config.refreshToken || env.DROPBOX_REFRESH_TOKEN,
  };

  // If access token provided directly, use it
  if (config.accessToken) {
    cachedAccessToken = config.accessToken;
    tokenExpiresAt = Date.now() + 14400000; // Dropbox tokens last 4 hours
  }
}

/**
 * Check if Dropbox is initialized
 */
export function isDropboxInitialized(): boolean {
  return currentConfig !== null;
}

/**
 * Get OAuth2 authorization URL for user consent
 */
export function getAuthorizationUrl(state?: string): string {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.appKey!,
    response_type: "code",
    token_access_type: "offline",
  });

  if (state) {
    params.set("state", state);
  }

  return `${OAUTH2_AUTHORIZE_URL}?${params.toString()}`;
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
      Authorization: `Basic ${Buffer.from(`${config.appKey}:${config.appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
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
      Authorization: `Basic ${Buffer.from(`${config.appKey}:${config.appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
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
  body?: unknown,
  baseUrl: string = API_BASE
): Promise<T> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error_summary: response.statusText }));
    throw new Error(error.error_summary || `API error: ${response.status}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Make content upload/download request
 */
async function contentRequest<T>(
  endpoint: string,
  args: unknown,
  content?: Buffer | Uint8Array
): Promise<T> {
  const accessToken = await getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Dropbox-API-Arg": JSON.stringify(args),
  };

  if (content) {
    headers["Content-Type"] = "application/octet-stream";
  }

  const response = await fetch(`${CONTENT_API_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: content ? new Blob([content]) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error_summary: response.statusText }));
    throw new Error(error.error_summary || `API error: ${response.status}`);
  }

  const resultHeader = response.headers.get("dropbox-api-result");
  if (resultHeader) {
    return JSON.parse(resultHeader) as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Download content request (returns binary data)
 */
async function downloadRequest(
  endpoint: string,
  args: unknown
): Promise<{ content: Buffer; metadata: DropboxFile }> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${CONTENT_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify(args),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error_summary: response.statusText }));
    throw new Error(error.error_summary || `API error: ${response.status}`);
  }

  const metadata = JSON.parse(response.headers.get("dropbox-api-result") || "{}") as DropboxFile;
  const arrayBuffer = await response.arrayBuffer();

  return {
    content: Buffer.from(arrayBuffer),
    metadata,
  };
}

/**
 * Get configuration, throwing if not initialized
 */
function getConfig(): DropboxConfig {
  if (!currentConfig) {
    // Try to initialize from environment
    if (env.DROPBOX_APP_KEY || env.DROPBOX_ACCESS_TOKEN) {
      initDropbox({});
    } else {
      throw new Error("Dropbox not initialized. Call initDropbox() first.");
    }
  }
  return currentConfig!;
}

/**
 * Normalize path for Dropbox API (must start with / or be empty for root)
 */
function normalizePath(filePath: string): string {
  if (!filePath || filePath === "/" || filePath === "") {
    return "";
  }
  const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return normalized.replace(/\/+$/, ""); // Remove trailing slashes
}

/**
 * List files and folders in a directory
 */
export async function listFolder(options: ListFolderOptions): Promise<ListFolderResult> {
  const path = normalizePath(options.path);

  const result = await apiRequest<ListFolderResult>("/files/list_folder", {
    path,
    recursive: options.recursive || false,
    include_deleted: options.includeDeleted || false,
    include_media_info: options.includeMediaInfo || false,
    limit: options.limit,
  });

  return result;
}

/**
 * Continue listing folder with cursor
 */
export async function listFolderContinue(cursor: string): Promise<ListFolderResult> {
  return apiRequest<ListFolderResult>("/files/list_folder/continue", { cursor });
}

/**
 * List all files in a folder (handles pagination automatically)
 */
export async function listAllFiles(
  path: string,
  options: Omit<ListFolderOptions, "path"> = {}
): Promise<DropboxEntry[]> {
  const allEntries: DropboxEntry[] = [];

  let result = await listFolder({ ...options, path });
  allEntries.push(...result.entries);

  while (result.has_more) {
    result = await listFolderContinue(result.cursor);
    allEntries.push(...result.entries);
  }

  return allEntries;
}

/**
 * Get file or folder metadata
 */
export async function getMetadata(
  path: string,
  includeMediaInfo: boolean = false
): Promise<DropboxEntry> {
  return apiRequest<DropboxEntry>("/files/get_metadata", {
    path: normalizePath(path),
    include_media_info: includeMediaInfo,
  });
}

/**
 * Search for files and folders
 */
export async function searchFiles(
  query: string,
  options: {
    path?: string;
    maxResults?: number;
    fileExtensions?: string[];
    fileCategories?: string[];
  } = {}
): Promise<DropboxEntry[]> {
  const searchOptions: Record<string, unknown> = {
    query,
    options: {
      max_results: options.maxResults || 100,
    },
  };

  if (options.path) {
    searchOptions.options = {
      ...searchOptions.options as object,
      path: normalizePath(options.path),
    };
  }

  if (options.fileExtensions) {
    searchOptions.options = {
      ...searchOptions.options as object,
      file_extensions: options.fileExtensions,
    };
  }

  if (options.fileCategories) {
    searchOptions.options = {
      ...searchOptions.options as object,
      file_categories: options.fileCategories.map((cat) => ({ ".tag": cat })),
    };
  }

  const result = await apiRequest<{
    matches: Array<{ metadata: { metadata: DropboxEntry } }>;
    has_more: boolean;
  }>("/files/search_v2", searchOptions);

  return result.matches.map((m) => m.metadata.metadata);
}

/**
 * Upload a file to Dropbox
 */
export async function uploadFile(
  content: Buffer | string | Uint8Array,
  options: UploadOptions
): Promise<DropboxFile> {
  const uploadArgs = {
    path: normalizePath(options.path),
    mode: options.mode ? { ".tag": options.mode } : { ".tag": "add" },
    autorename: options.autorename ?? true,
    mute: options.mute ?? false,
    strict_conflict: options.strict_conflict ?? false,
  };

  let contentBuffer: Buffer | Uint8Array;
  if (typeof content === "string") {
    contentBuffer = Buffer.from(content, "utf-8");
  } else if (Buffer.isBuffer(content)) {
    contentBuffer = content;
  } else {
    contentBuffer = content;
  }

  return contentRequest<DropboxFile>("/files/upload", uploadArgs, contentBuffer);
}

/**
 * Upload a file from local filesystem
 */
export async function uploadLocalFile(
  localPath: string,
  remotePath: string,
  options: Omit<UploadOptions, "path"> = {}
): Promise<DropboxFile> {
  const fileContent = await fs.promises.readFile(localPath);
  const fileName = path.basename(localPath);
  const fullRemotePath = remotePath.endsWith("/")
    ? `${remotePath}${fileName}`
    : remotePath;

  return uploadFile(fileContent, {
    ...options,
    path: fullRemotePath,
  });
}

/**
 * Upload large files (> 150MB) using session upload
 */
export async function uploadLargeFile(
  content: Buffer,
  options: UploadOptions,
  chunkSize: number = 8 * 1024 * 1024 // 8MB chunks
): Promise<DropboxFile> {
  // Start upload session
  const startResult = await contentRequest<{ session_id: string }>(
    "/files/upload_session/start",
    { close: false },
    content.subarray(0, Math.min(chunkSize, content.length))
  );

  const sessionId = startResult.session_id;
  let offset = Math.min(chunkSize, content.length);

  // Append chunks
  while (offset < content.length) {
    const chunk = content.subarray(offset, Math.min(offset + chunkSize, content.length));
    const isLast = offset + chunk.length >= content.length;

    if (!isLast) {
      await contentRequest(
        "/files/upload_session/append_v2",
        {
          cursor: { session_id: sessionId, offset },
          close: false,
        },
        chunk
      );
    }

    offset += chunk.length;
  }

  // Finish upload session
  return contentRequest<DropboxFile>(
    "/files/upload_session/finish",
    {
      cursor: { session_id: sessionId, offset: content.length },
      commit: {
        path: normalizePath(options.path),
        mode: options.mode ? { ".tag": options.mode } : { ".tag": "add" },
        autorename: options.autorename ?? true,
        mute: options.mute ?? false,
      },
    }
  );
}

/**
 * Download a file from Dropbox
 */
export async function downloadFile(
  remotePath: string,
  options: DownloadOptions = {}
): Promise<{ content: Buffer; name: string; size: number }> {
  const result = await downloadRequest("/files/download", {
    path: normalizePath(remotePath),
  });

  // Save to file if destination path provided
  if (options.destinationPath) {
    await fs.promises.writeFile(options.destinationPath, result.content);
  }

  return {
    content: result.content,
    name: result.metadata.name,
    size: result.metadata.size || result.content.length,
  };
}

/**
 * Create a folder in Dropbox
 */
export async function createFolder(
  folderPath: string,
  autorename: boolean = false
): Promise<DropboxFolder> {
  const result = await apiRequest<{ metadata: DropboxFolder }>("/files/create_folder_v2", {
    path: normalizePath(folderPath),
    autorename,
  });

  return result.metadata;
}

/**
 * Delete a file or folder
 */
export async function deleteFile(filePath: string): Promise<DropboxEntry> {
  const result = await apiRequest<{ metadata: DropboxEntry }>("/files/delete_v2", {
    path: normalizePath(filePath),
  });

  return result.metadata;
}

/**
 * Permanently delete a file or folder
 */
export async function permanentlyDelete(filePath: string): Promise<void> {
  await apiRequest("/files/permanently_delete", {
    path: normalizePath(filePath),
  });
}

/**
 * Move a file or folder
 */
export async function moveFile(
  fromPath: string,
  toPath: string,
  options: {
    autorename?: boolean;
    allowOwnershipTransfer?: boolean;
  } = {}
): Promise<DropboxEntry> {
  const result = await apiRequest<{ metadata: DropboxEntry }>("/files/move_v2", {
    from_path: normalizePath(fromPath),
    to_path: normalizePath(toPath),
    autorename: options.autorename ?? false,
    allow_ownership_transfer: options.allowOwnershipTransfer ?? false,
  });

  return result.metadata;
}

/**
 * Copy a file or folder
 */
export async function copyFile(
  fromPath: string,
  toPath: string,
  autorename: boolean = false
): Promise<DropboxEntry> {
  const result = await apiRequest<{ metadata: DropboxEntry }>("/files/copy_v2", {
    from_path: normalizePath(fromPath),
    to_path: normalizePath(toPath),
    autorename,
  });

  return result.metadata;
}

/**
 * Get a temporary link to download a file
 */
export async function getTemporaryLink(
  filePath: string
): Promise<{ link: string; metadata: DropboxFile }> {
  return apiRequest<{ link: string; metadata: DropboxFile }>("/files/get_temporary_link", {
    path: normalizePath(filePath),
  });
}

/**
 * Create a shared link for a file or folder
 */
export async function createSharedLink(
  filePath: string,
  options: ShareOptions = {}
): Promise<SharedLink> {
  const settings: Record<string, unknown> = {};

  if (options.requested_visibility) {
    settings.requested_visibility = { ".tag": options.requested_visibility };
  }
  if (options.link_password) {
    settings.link_password = options.link_password;
  }
  if (options.expires) {
    settings.expires = options.expires;
  }
  if (options.audience) {
    settings.audience = { ".tag": options.audience };
  }
  if (options.access) {
    settings.access = { ".tag": options.access };
  }

  try {
    return await apiRequest<SharedLink>("/sharing/create_shared_link_with_settings", {
      path: normalizePath(filePath),
      settings: Object.keys(settings).length > 0 ? settings : undefined,
    });
  } catch (error) {
    // If link already exists, get the existing one
    if (error instanceof Error && error.message.includes("shared_link_already_exists")) {
      const links = await listSharedLinks(filePath);
      if (links.length > 0) {
        return links[0];
      }
    }
    throw error;
  }
}

/**
 * Get shareable link for a file (creates if doesn't exist)
 */
export async function getShareableLink(filePath: string): Promise<string> {
  const link = await createSharedLink(filePath);
  return link.url;
}

/**
 * List shared links for a file or folder
 */
export async function listSharedLinks(
  filePath?: string
): Promise<SharedLink[]> {
  const result = await apiRequest<{ links: SharedLink[] }>("/sharing/list_shared_links", {
    path: filePath ? normalizePath(filePath) : undefined,
  });

  return result.links;
}

/**
 * Revoke a shared link
 */
export async function revokeSharedLink(url: string): Promise<void> {
  await apiRequest("/sharing/revoke_shared_link", { url });
}

/**
 * Get file revisions
 */
export async function getRevisions(
  filePath: string,
  options: {
    mode?: "path" | "id";
    limit?: number;
  } = {}
): Promise<Array<{ rev: string; name: string; size: number; server_modified: string }>> {
  const result = await apiRequest<{
    entries: Array<{ rev: string; name: string; size: number; server_modified: string }>;
  }>("/files/list_revisions", {
    path: normalizePath(filePath),
    mode: options.mode ? { ".tag": options.mode } : undefined,
    limit: options.limit || 10,
  });

  return result.entries;
}

/**
 * Restore a file to a previous revision
 */
export async function restoreFile(
  filePath: string,
  rev: string
): Promise<DropboxFile> {
  return apiRequest<DropboxFile>("/files/restore", {
    path: normalizePath(filePath),
    rev,
  });
}

/**
 * Sync local folder with Dropbox folder
 */
export async function syncFolder(options: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: [],
    downloaded: [],
    deleted: [],
    errors: [],
  };

  const remotePath = normalizePath(options.remotePath);

  try {
    // Ensure local directory exists
    await fs.promises.mkdir(options.localPath, { recursive: true });

    // Get remote files
    let remoteEntries: DropboxEntry[];
    try {
      remoteEntries = await listAllFiles(remotePath, { recursive: options.recursive });
    } catch (error) {
      if (error instanceof Error && error.message.includes("path/not_found")) {
        // Remote folder doesn't exist, create it
        await createFolder(remotePath);
        remoteEntries = [];
      } else {
        throw error;
      }
    }

    const remoteFileMap = new Map<string, DropboxEntry>();
    for (const entry of remoteEntries) {
      const relativePath = entry.path_display.substring(remotePath.length + 1);
      remoteFileMap.set(relativePath, entry);
    }

    // Get local files
    const localFiles = await getLocalFiles(options.localPath, options.recursive);
    const localFileNames = new Set(localFiles.map((f) => f.relativePath));

    // Upload new or modified local files
    for (const localFile of localFiles) {
      if (localFile.isDirectory) {
        continue;
      }

      const remoteEntry = remoteFileMap.get(localFile.relativePath);

      try {
        if (!remoteEntry || remoteEntry[".tag"] === "folder") {
          // Upload new file
          const remoteFilePath = `${remotePath}/${localFile.relativePath}`;
          await uploadLocalFile(localFile.absolutePath, remoteFilePath, { mode: "overwrite" });
          result.uploaded.push(localFile.absolutePath);
        } else if (remoteEntry[".tag"] === "file") {
          // Check if local file is newer
          const localStats = await fs.promises.stat(localFile.absolutePath);
          const remoteModified = remoteEntry.server_modified
            ? new Date(remoteEntry.server_modified).getTime()
            : 0;

          if (localStats.mtimeMs > remoteModified) {
            // Update remote file
            const remoteFilePath = `${remotePath}/${localFile.relativePath}`;
            await uploadLocalFile(localFile.absolutePath, remoteFilePath, { mode: "overwrite" });
            result.uploaded.push(localFile.absolutePath);
          } else if (localStats.mtimeMs < remoteModified) {
            // Download remote file
            await downloadFile(remoteEntry.path_display, {
              destinationPath: localFile.absolutePath,
            });
            result.downloaded.push(localFile.absolutePath);
          }
        }
      } catch (error) {
        result.errors.push({
          path: localFile.absolutePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Handle remote-only files
    for (const [relativePath, remoteEntry] of Array.from(remoteFileMap.entries())) {
      if (!localFileNames.has(relativePath)) {
        const localFilePath = path.join(options.localPath, relativePath);

        if (options.deleteRemote) {
          // Delete remote file
          try {
            await deleteFile(remoteEntry.path_display);
            result.deleted.push(`remote:${relativePath}`);
          } catch (error) {
            result.errors.push({
              path: `remote:${relativePath}`,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else if (remoteEntry[".tag"] === "file") {
          // Download remote file
          try {
            // Ensure parent directory exists
            await fs.promises.mkdir(path.dirname(localFilePath), { recursive: true });
            await downloadFile(remoteEntry.path_display, {
              destinationPath: localFilePath,
            });
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
 * Get local files recursively
 */
async function getLocalFiles(
  basePath: string,
  recursive: boolean = false,
  currentPath: string = ""
): Promise<Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }>> {
  const files: Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }> = [];

  const entries = await fs.promises.readdir(path.join(basePath, currentPath), {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const absolutePath = path.join(basePath, relativePath);

    files.push({
      absolutePath,
      relativePath,
      isDirectory: entry.isDirectory(),
    });

    if (recursive && entry.isDirectory()) {
      const subFiles = await getLocalFiles(basePath, true, relativePath);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Get space usage information
 */
export async function getSpaceUsage(): Promise<SpaceUsage> {
  return apiRequest<SpaceUsage>("/users/get_space_usage");
}

/**
 * Get current account information
 */
export async function getCurrentAccount(): Promise<{
  account_id: string;
  name: { display_name: string; familiar_name: string };
  email: string;
  email_verified: boolean;
  profile_photo_url?: string;
  country: string;
}> {
  return apiRequest("/users/get_current_account");
}

/**
 * Reset Dropbox client
 */
export function resetDropbox(): void {
  currentConfig = null;
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}
