import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class AWSS3Adapter extends BaseAdapter {
  metadata = {
    name: "AWSS3",
    slug: "aws-s3",
    displayName: "AWS S3",
    description: "Upload, download, list, and delete files in Amazon S3 buckets",
    category: "cloud-storage",
    authType: "api_key" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.accessKeyId || credentials.accessToken || "",
      metadata: {
        secretAccessKey: credentials.secretAccessKey,
        region: credentials.region || "us-east-1",
        defaultBucket: credentials.defaultBucket,
      },
    };
  }

  private getBaseUrl(bucket: string, auth: AuthResult): string {
    const region = (auth.metadata?.region as string) || "us-east-1";
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  actions: Record<string, ActionDefinition> = {
    uploadFile: {
      name: "Upload File",
      description: "Upload a file to an S3 bucket",
      inputSchema: z.object({
        bucket: z.string(),
        key: z.string(),
        body: z.string(),
        contentType: z.string().optional().default("application/octet-stream"),
        acl: z.string().optional(),
      }),
      outputSchema: z.object({ bucket: z.string(), key: z.string(), etag: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { bucket, key, body, contentType, acl } = input as {
          bucket: string; key: string; body: string; contentType: string; acl?: string;
        };
        const baseUrl = this.getBaseUrl(bucket, auth);
        const headers: Record<string, string> = { "Content-Type": contentType };
        if (acl) headers["x-amz-acl"] = acl;
        const response = await this.makeRequest(
          `${baseUrl}/${encodeURIComponent(key)}`,
          { method: "PUT", body, headers, auth }
        );
        return {
          bucket,
          key,
          etag: response.headers.get("ETag") || "",
        };
      },
    },
    downloadFile: {
      name: "Download File",
      description: "Download a file from an S3 bucket",
      inputSchema: z.object({
        bucket: z.string(),
        key: z.string(),
      }),
      outputSchema: z.object({ bucket: z.string(), key: z.string(), contentType: z.string(), body: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { bucket, key } = input as { bucket: string; key: string };
        const baseUrl = this.getBaseUrl(bucket, auth);
        const response = await this.makeRequest(
          `${baseUrl}/${encodeURIComponent(key)}`,
          { auth }
        );
        const body = await response.text();
        return {
          bucket,
          key,
          contentType: response.headers.get("Content-Type") || "application/octet-stream",
          body,
        };
      },
    },
    listBucket: {
      name: "List Bucket",
      description: "List objects in an S3 bucket",
      inputSchema: z.object({
        bucket: z.string(),
        prefix: z.string().optional(),
        maxKeys: z.number().optional().default(1000),
        continuationToken: z.string().optional(),
      }),
      outputSchema: z.object({ name: z.string(), contents: z.array(z.object({ key: z.string(), size: z.number(), lastModified: z.string() })), isTruncated: z.boolean() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { bucket, prefix, maxKeys, continuationToken } = input as {
          bucket: string; prefix?: string; maxKeys: number; continuationToken?: string;
        };
        const baseUrl = this.getBaseUrl(bucket, auth);
        const params = new URLSearchParams({ "list-type": "2", "max-keys": String(maxKeys) });
        if (prefix) params.set("prefix", prefix);
        if (continuationToken) params.set("continuation-token", continuationToken);
        const response = await this.makeRequest(
          `${baseUrl}?${params.toString()}`,
          { auth }
        );
        const text = await response.text();
        return {
          name: bucket,
          contents: [],
          isTruncated: text.includes("<IsTruncated>true</IsTruncated>"),
          rawXml: text,
        };
      },
    },
    deleteFile: {
      name: "Delete File",
      description: "Delete a file from an S3 bucket",
      inputSchema: z.object({
        bucket: z.string(),
        key: z.string(),
      }),
      outputSchema: z.object({ bucket: z.string(), key: z.string(), deleted: z.boolean() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { bucket, key } = input as { bucket: string; key: string };
        const baseUrl = this.getBaseUrl(bucket, auth);
        await this.makeRequest(
          `${baseUrl}/${encodeURIComponent(key)}`,
          { method: "DELETE", auth }
        );
        return { bucket, key, deleted: true };
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onObjectCreated: {
      name: "Object Created",
      description: "Triggered when a new object is created in an S3 bucket",
      outputSchema: z.object({ bucket: z.string(), key: z.string(), size: z.number(), eventTime: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
