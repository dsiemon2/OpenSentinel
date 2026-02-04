/**
 * Unified Cloud Storage Interface
 *
 * Provides a unified API for interacting with multiple cloud storage
 * providers (Google Drive, Dropbox) through a common interface.
 */

import * as googleDrive from "./google-drive";
import * as dropbox from "./dropbox";
import * as fs from "fs";
import * as path from "path";

// Supported providers
export type CloudProvider = "google-drive" | "dropbox";

// Unified file representation
export interface CloudFile {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size?: number;
  createdAt?: Date;
  modifiedAt?: Date;
  isFolder: boolean;
  isShared?: boolean;
  webUrl?: string;
  downloadUrl?: string;
  provider: CloudProvider;
  providerMetadata: unknown;
}

// Unified folder representation
export interface CloudFolder extends CloudFile {
  isFolder: true;
}

// List options
export interface ListOptions {
  folderId?: string;
  path?: string;
  pageSize?: number;
  pageToken?: string;
  recursive?: boolean;
}

// List result
export interface ListResult {
  files: CloudFile[];
  nextPageToken?: string;
}

// Upload options
export interface UploadOptions {
  name: string;
  parentId?: string;
  parentPath?: string;
  mimeType?: string;
  overwrite?: boolean;
}

// Download options
export interface DownloadOptions {
  destinationPath?: string;
  exportFormat?: string;
}

// Share options
export interface ShareOptions {
  access: "view" | "edit" | "comment";
  type: "anyone" | "user" | "domain";
  email?: string;
  domain?: string;
  notifyUser?: boolean;
  message?: string;
}

// Share result
export interface ShareResult {
  url: string;
  permissionId?: string;
}

// Sync options
export interface SyncOptions {
  localPath: string;
  remotePath?: string;
  remoteId?: string;
  recursive?: boolean;
  deleteRemote?: boolean;
  deleteLocal?: boolean;
  conflictResolution?: "local" | "remote" | "newer";
}

// Sync result
export interface SyncResult {
  uploaded: string[];
  downloaded: string[];
  deleted: string[];
  conflicts: Array<{ path: string; resolution: string }>;
  errors: Array<{ path: string; error: string }>;
}

// Provider configuration
export interface ProviderConfig {
  "google-drive"?: googleDrive.GoogleDriveConfig;
  dropbox?: dropbox.DropboxConfig;
}

// Storage quota
export interface StorageQuota {
  used: number;
  total: number;
  available: number;
  provider: CloudProvider;
}

/**
 * Unified Cloud Storage Client
 */
export class UnifiedCloudStorage {
  private defaultProvider: CloudProvider | null = null;
  private initializedProviders: Set<CloudProvider> = new Set();

  /**
   * Initialize cloud storage providers
   */
  async initialize(config: ProviderConfig): Promise<void> {
    if (config["google-drive"]) {
      googleDrive.initGoogleDrive(config["google-drive"]);
      this.initializedProviders.add("google-drive");
      if (!this.defaultProvider) {
        this.defaultProvider = "google-drive";
      }
    }

    if (config.dropbox) {
      dropbox.initDropbox(config.dropbox);
      this.initializedProviders.add("dropbox");
      if (!this.defaultProvider) {
        this.defaultProvider = "dropbox";
      }
    }
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: CloudProvider): void {
    if (!this.initializedProviders.has(provider)) {
      throw new Error(`Provider ${provider} is not initialized`);
    }
    this.defaultProvider = provider;
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): CloudProvider | null {
    return this.defaultProvider;
  }

  /**
   * Check if provider is initialized
   */
  isProviderInitialized(provider: CloudProvider): boolean {
    return this.initializedProviders.has(provider);
  }

  /**
   * Get list of initialized providers
   */
  getInitializedProviders(): CloudProvider[] {
    return Array.from(this.initializedProviders);
  }

  /**
   * Validate provider
   */
  private validateProvider(provider?: CloudProvider): CloudProvider {
    const p = provider || this.defaultProvider;
    if (!p) {
      throw new Error("No provider specified and no default provider set");
    }
    if (!this.initializedProviders.has(p)) {
      throw new Error(`Provider ${p} is not initialized`);
    }
    return p;
  }

  /**
   * List files and folders
   */
  async listFiles(options: ListOptions = {}, provider?: CloudProvider): Promise<ListResult> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const result = await googleDrive.listFiles({
        folderId: options.folderId || options.path,
        pageSize: options.pageSize,
        pageToken: options.pageToken,
      });

      return {
        files: result.files.map((f) => this.mapGoogleDriveFile(f)),
        nextPageToken: result.nextPageToken,
      };
    }

    if (p === "dropbox") {
      const folderPath = options.path || options.folderId || "";
      const result = await dropbox.listFolder({
        path: folderPath,
        recursive: options.recursive,
        limit: options.pageSize,
      });

      return {
        files: result.entries.map((e) => this.mapDropboxEntry(e)),
        nextPageToken: result.has_more ? result.cursor : undefined,
      };
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * List all files (handles pagination)
   */
  async listAllFiles(options: Omit<ListOptions, "pageToken"> = {}, provider?: CloudProvider): Promise<CloudFile[]> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const files = await googleDrive.listAllFiles({
        folderId: options.folderId || options.path,
      });
      return files.map((f) => this.mapGoogleDriveFile(f));
    }

    if (p === "dropbox") {
      const entries = await dropbox.listAllFiles(options.path || "", {
        recursive: options.recursive,
      });
      return entries.map((e) => this.mapDropboxEntry(e));
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string, provider?: CloudProvider): Promise<CloudFile> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const file = await googleDrive.getFile(fileId);
      return this.mapGoogleDriveFile(file);
    }

    if (p === "dropbox") {
      const entry = await dropbox.getMetadata(fileId);
      return this.mapDropboxEntry(entry);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Search for files
   */
  async searchFiles(
    query: string,
    options: {
      mimeType?: string;
      folderId?: string;
      path?: string;
      maxResults?: number;
    } = {},
    provider?: CloudProvider
  ): Promise<CloudFile[]> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const files = await googleDrive.searchFiles(query, {
        mimeType: options.mimeType,
        folderId: options.folderId || options.path,
        pageSize: options.maxResults,
      });
      return files.map((f) => this.mapGoogleDriveFile(f));
    }

    if (p === "dropbox") {
      const entries = await dropbox.searchFiles(query, {
        path: options.path,
        maxResults: options.maxResults,
      });
      return entries.map((e) => this.mapDropboxEntry(e));
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Upload a file
   */
  async uploadFile(
    content: Buffer | string,
    options: UploadOptions,
    provider?: CloudProvider
  ): Promise<CloudFile> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const parents = options.parentId ? [options.parentId] : undefined;
      const file = await googleDrive.uploadFile(
        typeof content === "string" ? Buffer.from(content) : content,
        {
          name: options.name,
          mimeType: options.mimeType,
          parents,
        }
      );
      return this.mapGoogleDriveFile(file);
    }

    if (p === "dropbox") {
      const remotePath = options.parentPath
        ? `${options.parentPath}/${options.name}`
        : `/${options.name}`;
      const file = await dropbox.uploadFile(
        typeof content === "string" ? Buffer.from(content) : content,
        {
          path: remotePath,
          mode: options.overwrite ? "overwrite" : "add",
        }
      );
      return this.mapDropboxEntry(file);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Upload a local file
   */
  async uploadLocalFile(
    localPath: string,
    options: Omit<UploadOptions, "name"> & { name?: string } = {},
    provider?: CloudProvider
  ): Promise<CloudFile> {
    const p = this.validateProvider(provider);
    const fileName = options.name || path.basename(localPath);

    if (p === "google-drive") {
      const file = await googleDrive.uploadLocalFile(localPath, {
        name: fileName,
        parents: options.parentId ? [options.parentId] : undefined,
        mimeType: options.mimeType,
      });
      return this.mapGoogleDriveFile(file);
    }

    if (p === "dropbox") {
      const remotePath = options.parentPath
        ? `${options.parentPath}/${fileName}`
        : `/${fileName}`;
      const file = await dropbox.uploadLocalFile(localPath, remotePath, {
        mode: options.overwrite ? "overwrite" : "add",
      });
      return this.mapDropboxEntry(file);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Download a file
   */
  async downloadFile(
    fileId: string,
    options: DownloadOptions = {},
    provider?: CloudProvider
  ): Promise<{ content: Buffer; name: string; mimeType: string }> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const result = await googleDrive.downloadFile(fileId, {
        destinationPath: options.destinationPath,
        exportMimeType: options.exportFormat,
      });
      return result;
    }

    if (p === "dropbox") {
      const result = await dropbox.downloadFile(fileId, {
        destinationPath: options.destinationPath,
      });
      return {
        content: result.content,
        name: result.name,
        mimeType: "application/octet-stream", // Dropbox doesn't return mime type
      };
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Create a folder
   */
  async createFolder(
    name: string,
    options: { parentId?: string; parentPath?: string } = {},
    provider?: CloudProvider
  ): Promise<CloudFile> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const folder = await googleDrive.createFolder(name, options.parentId);
      return this.mapGoogleDriveFile(folder);
    }

    if (p === "dropbox") {
      const folderPath = options.parentPath
        ? `${options.parentPath}/${name}`
        : `/${name}`;
      const folder = await dropbox.createFolder(folderPath);
      return this.mapDropboxEntry(folder);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Delete a file or folder
   */
  async deleteFile(
    fileId: string,
    options: { permanent?: boolean } = {},
    provider?: CloudProvider
  ): Promise<void> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      await googleDrive.deleteFile(fileId, options.permanent);
      return;
    }

    if (p === "dropbox") {
      if (options.permanent) {
        await dropbox.permanentlyDelete(fileId);
      } else {
        await dropbox.deleteFile(fileId);
      }
      return;
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Move a file or folder
   */
  async moveFile(
    fileId: string,
    destinationId: string,
    provider?: CloudProvider
  ): Promise<CloudFile> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const file = await googleDrive.moveFile(fileId, destinationId);
      return this.mapGoogleDriveFile(file);
    }

    if (p === "dropbox") {
      // For Dropbox, destinationId should be the destination path
      const entry = await dropbox.moveFile(fileId, destinationId);
      return this.mapDropboxEntry(entry);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Copy a file
   */
  async copyFile(
    fileId: string,
    options: { name?: string; destinationId?: string; destinationPath?: string } = {},
    provider?: CloudProvider
  ): Promise<CloudFile> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const file = await googleDrive.copyFile(fileId, {
        name: options.name,
        parentId: options.destinationId,
      });
      return this.mapGoogleDriveFile(file);
    }

    if (p === "dropbox") {
      const toPath = options.destinationPath || fileId.replace(/\/[^/]+$/, `/${options.name || "copy"}`);
      const entry = await dropbox.copyFile(fileId, toPath);
      return this.mapDropboxEntry(entry);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Rename a file
   */
  async renameFile(
    fileId: string,
    newName: string,
    provider?: CloudProvider
  ): Promise<CloudFile> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const file = await googleDrive.renameFile(fileId, newName);
      return this.mapGoogleDriveFile(file);
    }

    if (p === "dropbox") {
      // For Dropbox, we need to move to same directory with new name
      const metadata = await dropbox.getMetadata(fileId);
      const parentPath = metadata.path_display.replace(/\/[^/]+$/, "");
      const newPath = `${parentPath}/${newName}`;
      const entry = await dropbox.moveFile(fileId, newPath);
      return this.mapDropboxEntry(entry);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Share a file and get shareable link
   */
  async shareFile(
    fileId: string,
    options: ShareOptions = { access: "view", type: "anyone" },
    provider?: CloudProvider
  ): Promise<ShareResult> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const roleMap: Record<string, "reader" | "writer" | "commenter"> = {
        view: "reader",
        edit: "writer",
        comment: "commenter",
      };
      const typeMap: Record<string, "anyone" | "user" | "domain"> = {
        anyone: "anyone",
        user: "user",
        domain: "domain",
      };

      const result = await googleDrive.shareFile(fileId, {
        role: roleMap[options.access],
        type: typeMap[options.type],
        emailAddress: options.email,
        domain: options.domain,
        sendNotificationEmail: options.notifyUser,
        emailMessage: options.message,
      });

      return {
        url: result.link || "",
        permissionId: result.permissionId,
      };
    }

    if (p === "dropbox") {
      const visibilityMap: Record<string, "public" | "team_only"> = {
        anyone: "public",
        user: "team_only",
        domain: "team_only",
      };

      const link = await dropbox.createSharedLink(fileId, {
        requested_visibility: visibilityMap[options.type] || "public",
        access: options.access === "edit" ? "editor" : "viewer",
      });

      return {
        url: link.url,
      };
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Get shareable link (anyone can view)
   */
  async getShareableLink(fileId: string, provider?: CloudProvider): Promise<string> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      return googleDrive.getShareableLink(fileId);
    }

    if (p === "dropbox") {
      return dropbox.getShareableLink(fileId);
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Sync a local folder with a cloud folder
   */
  async syncFolder(options: SyncOptions, provider?: CloudProvider): Promise<SyncResult> {
    const p = this.validateProvider(provider);

    const result: SyncResult = {
      uploaded: [],
      downloaded: [],
      deleted: [],
      conflicts: [],
      errors: [],
    };

    if (p === "google-drive") {
      const gdResult = await googleDrive.syncFolder({
        localPath: options.localPath,
        remoteFolderId: options.remoteId,
        recursive: options.recursive,
        deleteRemote: options.deleteRemote,
        deleteLocal: options.deleteLocal,
      });

      result.uploaded = gdResult.uploaded;
      result.downloaded = gdResult.downloaded;
      result.deleted = gdResult.deleted;
      result.errors = gdResult.errors;
    } else if (p === "dropbox") {
      const dbResult = await dropbox.syncFolder({
        localPath: options.localPath,
        remotePath: options.remotePath || "/",
        recursive: options.recursive,
        deleteRemote: options.deleteRemote,
        deleteLocal: options.deleteLocal,
      });

      result.uploaded = dbResult.uploaded;
      result.downloaded = dbResult.downloaded;
      result.deleted = dbResult.deleted;
      result.errors = dbResult.errors;
    } else {
      throw new Error(`Unsupported provider: ${p}`);
    }

    return result;
  }

  /**
   * Get storage quota
   */
  async getStorageQuota(provider?: CloudProvider): Promise<StorageQuota> {
    const p = this.validateProvider(provider);

    if (p === "google-drive") {
      const quota = await googleDrive.getStorageQuota();
      return {
        used: quota.usage,
        total: quota.limit,
        available: quota.limit - quota.usage,
        provider: p,
      };
    }

    if (p === "dropbox") {
      const usage = await dropbox.getSpaceUsage();
      const total = usage.allocation.allocated || 0;
      return {
        used: usage.used,
        total,
        available: total - usage.used,
        provider: p,
      };
    }

    throw new Error(`Unsupported provider: ${p}`);
  }

  /**
   * Get storage quota for all initialized providers
   */
  async getAllStorageQuotas(): Promise<StorageQuota[]> {
    const quotas: StorageQuota[] = [];

    for (const provider of Array.from(this.initializedProviders)) {
      try {
        const quota = await this.getStorageQuota(provider);
        quotas.push(quota);
      } catch (error) {
        // Skip providers that fail
        console.error(`Failed to get quota for ${provider}:`, error);
      }
    }

    return quotas;
  }

  /**
   * Search across all providers
   */
  async searchAllProviders(
    query: string,
    options: { maxResults?: number } = {}
  ): Promise<CloudFile[]> {
    const allFiles: CloudFile[] = [];

    for (const provider of Array.from(this.initializedProviders)) {
      try {
        const files = await this.searchFiles(query, options, provider);
        allFiles.push(...files);
      } catch (error) {
        // Skip providers that fail
        console.error(`Search failed for ${provider}:`, error);
      }
    }

    return allFiles;
  }

  /**
   * Map Google Drive file to unified format
   */
  private mapGoogleDriveFile(file: googleDrive.DriveFile): CloudFile {
    return {
      id: file.id,
      name: file.name,
      path: file.id, // Google Drive uses IDs, not paths
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdTime ? new Date(file.createdTime) : undefined,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      isFolder: file.mimeType === "application/vnd.google-apps.folder",
      isShared: file.shared,
      webUrl: file.webViewLink,
      downloadUrl: file.webContentLink,
      provider: "google-drive",
      providerMetadata: file,
    };
  }

  /**
   * Map Dropbox entry to unified format
   */
  private mapDropboxEntry(entry: dropbox.DropboxEntry): CloudFile {
    const isFolder = entry[".tag"] === "folder";
    const file = entry as dropbox.DropboxFile;

    return {
      id: entry.path_display,
      name: entry.name,
      path: entry.path_display,
      mimeType: isFolder ? "application/vnd.folder" : "application/octet-stream",
      size: file.size,
      createdAt: file.client_modified ? new Date(file.client_modified) : undefined,
      modifiedAt: file.server_modified ? new Date(file.server_modified) : undefined,
      isFolder,
      isShared: !!entry.sharing_info,
      webUrl: undefined,
      downloadUrl: undefined,
      provider: "dropbox",
      providerMetadata: entry,
    };
  }

  /**
   * Reset all providers
   */
  reset(): void {
    googleDrive.resetGoogleDrive();
    dropbox.resetDropbox();
    this.initializedProviders.clear();
    this.defaultProvider = null;
  }
}

// Singleton instance
let unifiedStorageInstance: UnifiedCloudStorage | null = null;

/**
 * Get or create unified cloud storage instance
 */
export function getUnifiedCloudStorage(): UnifiedCloudStorage {
  if (!unifiedStorageInstance) {
    unifiedStorageInstance = new UnifiedCloudStorage();
  }
  return unifiedStorageInstance;
}

/**
 * Create a new unified cloud storage instance
 */
export function createUnifiedCloudStorage(): UnifiedCloudStorage {
  return new UnifiedCloudStorage();
}

/**
 * Reset the singleton instance
 */
export function resetUnifiedCloudStorage(): void {
  if (unifiedStorageInstance) {
    unifiedStorageInstance.reset();
    unifiedStorageInstance = null;
  }
}
