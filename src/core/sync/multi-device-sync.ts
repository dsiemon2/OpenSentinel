/**
 * Multi-Device Sync with Conflict Resolution
 * Ported from Ecom-Sales to OpenSentinel
 *
 * Features:
 * - Version vector conflict resolution
 * - Eventual consistency across devices
 * - Conflict detection and merge strategies
 * - Sync state tracking per device
 */

export interface SyncDocument {
  id: string;
  data: Record<string, unknown>;
  version: VersionVector;
  lastModified: Date;
  deviceId: string;
}

export type VersionVector = Record<string, number>;

export type ConflictStrategy = "last-write-wins" | "merge" | "manual";

export interface SyncConflict {
  documentId: string;
  local: SyncDocument;
  remote: SyncDocument;
  strategy: ConflictStrategy;
  resolved: boolean;
  resolution?: SyncDocument;
}

export type MergeFunction = (
  local: Record<string, unknown>,
  remote: Record<string, unknown>
) => Record<string, unknown>;

/**
 * Multi-Device Sync Engine
 */
export class SyncEngine {
  private documents = new Map<string, SyncDocument>();
  private conflicts: SyncConflict[] = [];
  private deviceId: string;
  private defaultStrategy: ConflictStrategy;
  private mergeFunction: MergeFunction;
  private syncCallbacks: Array<(doc: SyncDocument) => void> = [];

  constructor(
    deviceId: string,
    options: {
      defaultStrategy?: ConflictStrategy;
      mergeFunction?: MergeFunction;
    } = {}
  ) {
    this.deviceId = deviceId;
    this.defaultStrategy = options.defaultStrategy || "last-write-wins";
    this.mergeFunction = options.mergeFunction || this.defaultMerge;
  }

  /**
   * Default merge function - combines fields from both versions
   */
  private defaultMerge(
    local: Record<string, unknown>,
    remote: Record<string, unknown>
  ): Record<string, unknown> {
    return { ...local, ...remote };
  }

  /**
   * Compare two version vectors
   * Returns: "equal" | "local-ahead" | "remote-ahead" | "conflict"
   */
  private compareVersions(
    local: VersionVector,
    remote: VersionVector
  ): "equal" | "local-ahead" | "remote-ahead" | "conflict" {
    const allDevices = new Set([
      ...Object.keys(local),
      ...Object.keys(remote),
    ]);

    let localAhead = false;
    let remoteAhead = false;

    for (const device of allDevices) {
      const localVersion = local[device] || 0;
      const remoteVersion = remote[device] || 0;

      if (localVersion > remoteVersion) localAhead = true;
      if (remoteVersion > localVersion) remoteAhead = true;
    }

    if (!localAhead && !remoteAhead) return "equal";
    if (localAhead && !remoteAhead) return "local-ahead";
    if (!localAhead && remoteAhead) return "remote-ahead";
    return "conflict";
  }

  /**
   * Increment version vector for local device
   */
  private incrementVersion(version: VersionVector): VersionVector {
    return {
      ...version,
      [this.deviceId]: (version[this.deviceId] || 0) + 1,
    };
  }

  /**
   * Merge two version vectors (take max of each)
   */
  private mergeVersionVectors(
    a: VersionVector,
    b: VersionVector
  ): VersionVector {
    const merged: VersionVector = { ...a };
    for (const [device, version] of Object.entries(b)) {
      merged[device] = Math.max(merged[device] || 0, version);
    }
    return merged;
  }

  /**
   * Create or update a document locally
   */
  upsert(
    id: string,
    data: Record<string, unknown>
  ): SyncDocument {
    const existing = this.documents.get(id);
    const version = existing
      ? this.incrementVersion(existing.version)
      : { [this.deviceId]: 1 };

    const doc: SyncDocument = {
      id,
      data,
      version,
      lastModified: new Date(),
      deviceId: this.deviceId,
    };

    this.documents.set(id, doc);
    return doc;
  }

  /**
   * Get a document by ID
   */
  get(id: string): SyncDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Delete a document
   */
  delete(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Receive a remote document and handle conflicts
   */
  receiveRemote(remote: SyncDocument): {
    action: "updated" | "conflict" | "ignored";
    document?: SyncDocument;
    conflict?: SyncConflict;
  } {
    const local = this.documents.get(remote.id);

    if (!local) {
      // No local version - accept remote
      this.documents.set(remote.id, remote);
      this.notifySync(remote);
      return { action: "updated", document: remote };
    }

    const comparison = this.compareVersions(local.version, remote.version);

    switch (comparison) {
      case "equal":
      case "local-ahead":
        // Local is same or newer - ignore remote
        return { action: "ignored" };

      case "remote-ahead":
        // Remote is newer - accept it
        this.documents.set(remote.id, remote);
        this.notifySync(remote);
        return { action: "updated", document: remote };

      case "conflict": {
        // True conflict - resolve based on strategy
        const conflict: SyncConflict = {
          documentId: remote.id,
          local,
          remote,
          strategy: this.defaultStrategy,
          resolved: false,
        };

        const resolved = this.resolveConflict(conflict);
        if (resolved) {
          this.documents.set(remote.id, resolved);
          this.notifySync(resolved);
          return { action: "updated", document: resolved };
        }

        this.conflicts.push(conflict);
        return { action: "conflict", conflict };
      }
    }
  }

  /**
   * Resolve a conflict using the configured strategy
   */
  private resolveConflict(
    conflict: SyncConflict
  ): SyncDocument | undefined {
    switch (conflict.strategy) {
      case "last-write-wins": {
        const winner =
          conflict.local.lastModified >= conflict.remote.lastModified
            ? conflict.local
            : conflict.remote;
        const mergedVersion = this.mergeVersionVectors(
          conflict.local.version,
          conflict.remote.version
        );
        conflict.resolved = true;
        conflict.resolution = {
          ...winner,
          version: this.incrementVersion(mergedVersion),
          lastModified: new Date(),
          deviceId: this.deviceId,
        };
        return conflict.resolution;
      }

      case "merge": {
        const mergedData = this.mergeFunction(
          conflict.local.data,
          conflict.remote.data
        );
        const mergedVersion = this.mergeVersionVectors(
          conflict.local.version,
          conflict.remote.version
        );
        conflict.resolved = true;
        conflict.resolution = {
          id: conflict.documentId,
          data: mergedData,
          version: this.incrementVersion(mergedVersion),
          lastModified: new Date(),
          deviceId: this.deviceId,
        };
        return conflict.resolution;
      }

      case "manual":
        // Leave unresolved for manual resolution
        return undefined;
    }
  }

  /**
   * Manually resolve a conflict
   */
  resolveManualConflict(
    documentId: string,
    resolvedData: Record<string, unknown>
  ): SyncDocument | undefined {
    const conflict = this.conflicts.find(
      (c) => c.documentId === documentId && !c.resolved
    );
    if (!conflict) return undefined;

    const mergedVersion = this.mergeVersionVectors(
      conflict.local.version,
      conflict.remote.version
    );

    const resolved: SyncDocument = {
      id: documentId,
      data: resolvedData,
      version: this.incrementVersion(mergedVersion),
      lastModified: new Date(),
      deviceId: this.deviceId,
    };

    conflict.resolved = true;
    conflict.resolution = resolved;
    this.documents.set(documentId, resolved);
    this.notifySync(resolved);

    return resolved;
  }

  /**
   * Get documents that need syncing (modified since last sync)
   */
  getChangedSince(since: Date): SyncDocument[] {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.lastModified > since
    );
  }

  /**
   * Get unresolved conflicts
   */
  getConflicts(): SyncConflict[] {
    return this.conflicts.filter((c) => !c.resolved);
  }

  /**
   * Register a callback for sync events
   */
  onSync(callback: (doc: SyncDocument) => void): void {
    this.syncCallbacks.push(callback);
  }

  private notifySync(doc: SyncDocument): void {
    for (const cb of this.syncCallbacks) {
      try {
        cb(doc);
      } catch {}
    }
  }

  /**
   * Get all documents
   */
  getAll(): SyncDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get stats
   */
  getStats(): {
    documentCount: number;
    unresolvedConflicts: number;
    totalConflicts: number;
    deviceId: string;
  } {
    return {
      documentCount: this.documents.size,
      unresolvedConflicts: this.getConflicts().length,
      totalConflicts: this.conflicts.length,
      deviceId: this.deviceId,
    };
  }
}
