/**
 * Google Drive Service
 *
 * Google Drive API integration for file management.
 * Uses the Drive REST API v3.
 */

import type { GoogleAuth } from "./auth";
import { promises as fs } from "fs";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  parents: string[];
  shared: boolean;
}

export class GoogleDriveService {
  constructor(private auth: GoogleAuth) {}

  /**
   * List files in Drive or a specific folder
   */
  async listFiles(folderId?: string, maxResults = 20): Promise<DriveFile[]> {
    const url = new URL(`${DRIVE_BASE}/files`);
    url.searchParams.set("pageSize", String(Math.min(maxResults, 100)));
    url.searchParams.set(
      "fields",
      "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,shared)"
    );
    url.searchParams.set("orderBy", "modifiedTime desc");

    if (folderId) {
      url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    } else {
      url.searchParams.set("q", "trashed = false");
    }

    const response = await this.auth.authenticatedFetch(url.toString());
    if (!response.ok) throw new Error(`Drive list error: ${response.status}`);

    const data = await response.json();
    return (data.files || []).map(parseDriveFile);
  }

  /**
   * Search files by name or content
   */
  async searchFiles(query: string, maxResults = 20): Promise<DriveFile[]> {
    const url = new URL(`${DRIVE_BASE}/files`);
    url.searchParams.set("pageSize", String(Math.min(maxResults, 100)));
    url.searchParams.set(
      "fields",
      "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,shared)"
    );

    const q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
    url.searchParams.set("q", q);

    const response = await this.auth.authenticatedFetch(url.toString());
    if (!response.ok) throw new Error(`Drive search error: ${response.status}`);

    const data = await response.json();
    return (data.files || []).map(parseDriveFile);
  }

  /**
   * Upload a file to Drive
   */
  async uploadFile(
    filePath: string,
    name?: string,
    folderId?: string
  ): Promise<DriveFile> {
    const fileContent = await fs.readFile(filePath);
    const fileName = name || filePath.split(/[\\/]/).pop() || "upload";

    // Create file metadata
    const metadata: any = { name: fileName };
    if (folderId) metadata.parents = [folderId];

    // Simple upload for files under 5MB
    if (fileContent.length < 5 * 1024 * 1024) {
      const boundary = "opensentinel_boundary";
      const body = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: application/octet-stream",
        "",
        fileContent.toString("binary"),
        `--${boundary}--`,
      ].join("\r\n");

      const response = await this.auth.authenticatedFetch(
        `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,shared`,
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );

      if (!response.ok) throw new Error(`Drive upload error: ${response.status}`);
      return parseDriveFile(await response.json());
    }

    // For larger files, use resumable upload
    const initResponse = await this.auth.authenticatedFetch(
      `${UPLOAD_BASE}/files?uploadType=resumable`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) throw new Error(`Drive resumable init error: ${initResponse.status}`);
    const uploadUrl = initResponse.headers.get("Location");
    if (!uploadUrl) throw new Error("No upload URL returned");

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": String(fileContent.length) },
      body: fileContent,
    });

    if (!uploadResponse.ok) throw new Error(`Drive upload error: ${uploadResponse.status}`);
    return parseDriveFile(await uploadResponse.json());
  }

  /**
   * Download a file from Drive
   */
  async downloadFile(fileId: string, destinationPath?: string): Promise<{ filePath: string; size: number }> {
    const url = `${DRIVE_BASE}/files/${fileId}?alt=media`;
    const response = await this.auth.authenticatedFetch(url);

    if (!response.ok) throw new Error(`Drive download error: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());

    // Get file name if no destination specified
    let outPath = destinationPath;
    if (!outPath) {
      const metaUrl = `${DRIVE_BASE}/files/${fileId}?fields=name`;
      const metaResponse = await this.auth.authenticatedFetch(metaUrl);
      const meta = await metaResponse.json();
      const { tmpdir: getTmpDir } = await import("os");
      const { join } = await import("path");
      outPath = join(getTmpDir(), meta.name || `drive-download-${fileId}`);
    }

    await fs.writeFile(outPath, buffer);
    return { filePath: outPath, size: buffer.length };
  }

  /**
   * Share a file with an email address
   */
  async shareFile(
    fileId: string,
    email: string,
    role: "reader" | "writer" | "commenter" = "reader"
  ): Promise<{ permissionId: string }> {
    const url = `${DRIVE_BASE}/files/${fileId}/permissions`;
    const response = await this.auth.authenticatedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user",
        role,
        emailAddress: email,
      }),
    });

    if (!response.ok) throw new Error(`Drive share error: ${response.status}`);
    const data = await response.json();
    return { permissionId: data.id };
  }
}

function parseDriveFile(item: any): DriveFile {
  return {
    id: item.id || "",
    name: item.name || "",
    mimeType: item.mimeType || "",
    size: item.size || "0",
    createdTime: item.createdTime || "",
    modifiedTime: item.modifiedTime || "",
    webViewLink: item.webViewLink || "",
    parents: item.parents || [],
    shared: item.shared || false,
  };
}

export function createGoogleDriveService(auth: GoogleAuth): GoogleDriveService {
  return new GoogleDriveService(auth);
}
