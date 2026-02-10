import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { join } from "node:path";

describe("Cloud Storage Integration", () => {
  describe("Google Drive Module", () => {
    describe("Module Exports", () => {
      test("should export initGoogleDrive function", async () => {
        const { initGoogleDrive } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof initGoogleDrive).toBe("function");
      });

      test("should export isGoogleDriveInitialized function", async () => {
        const { isGoogleDriveInitialized } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof isGoogleDriveInitialized).toBe("function");
      });

      test("should export resetGoogleDrive function", async () => {
        const { resetGoogleDrive } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof resetGoogleDrive).toBe("function");
      });

      test("should export getAuthorizationUrl function", async () => {
        const { getAuthorizationUrl } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof getAuthorizationUrl).toBe("function");
      });

      test("should export exchangeCodeForTokens function", async () => {
        const { exchangeCodeForTokens } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof exchangeCodeForTokens).toBe("function");
      });

      test("should export listFiles function", async () => {
        const { listFiles } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof listFiles).toBe("function");
      });

      test("should export listAllFiles function", async () => {
        const { listAllFiles } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof listAllFiles).toBe("function");
      });

      test("should export getFile function", async () => {
        const { getFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof getFile).toBe("function");
      });

      test("should export searchFiles function", async () => {
        const { searchFiles } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof searchFiles).toBe("function");
      });

      test("should export uploadFile function", async () => {
        const { uploadFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof uploadFile).toBe("function");
      });

      test("should export uploadLocalFile function", async () => {
        const { uploadLocalFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof uploadLocalFile).toBe("function");
      });

      test("should export downloadFile function", async () => {
        const { downloadFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof downloadFile).toBe("function");
      });

      test("should export createFolder function", async () => {
        const { createFolder } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof createFolder).toBe("function");
      });

      test("should export deleteFile function", async () => {
        const { deleteFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof deleteFile).toBe("function");
      });

      test("should export restoreFile function", async () => {
        const { restoreFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof restoreFile).toBe("function");
      });

      test("should export moveFile function", async () => {
        const { moveFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof moveFile).toBe("function");
      });

      test("should export renameFile function", async () => {
        const { renameFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof renameFile).toBe("function");
      });

      test("should export copyFile function", async () => {
        const { copyFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof copyFile).toBe("function");
      });

      test("should export shareFile function", async () => {
        const { shareFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof shareFile).toBe("function");
      });

      test("should export getShareableLink function", async () => {
        const { getShareableLink } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof getShareableLink).toBe("function");
      });

      test("should export unshareFile function", async () => {
        const { unshareFile } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof unshareFile).toBe("function");
      });

      test("should export listPermissions function", async () => {
        const { listPermissions } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof listPermissions).toBe("function");
      });

      test("should export syncFolder function", async () => {
        const { syncFolder } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof syncFolder).toBe("function");
      });

      test("should export getStorageQuota function", async () => {
        const { getStorageQuota } = await import("../src/integrations/cloud-storage/google-drive");
        expect(typeof getStorageQuota).toBe("function");
      });
    });

    describe("Initialization", () => {
      test("should initialize with config", async () => {
        const { initGoogleDrive, isGoogleDriveInitialized, resetGoogleDrive } = await import(
          "../src/integrations/cloud-storage/google-drive"
        );

        resetGoogleDrive();
        expect(isGoogleDriveInitialized()).toBe(false);

        initGoogleDrive({
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
        });

        expect(isGoogleDriveInitialized()).toBe(true);
        resetGoogleDrive();
      });

      test("should reset properly", async () => {
        const { initGoogleDrive, isGoogleDriveInitialized, resetGoogleDrive } = await import(
          "../src/integrations/cloud-storage/google-drive"
        );

        initGoogleDrive({ clientId: "test-id" });
        expect(isGoogleDriveInitialized()).toBe(true);

        resetGoogleDrive();
        expect(isGoogleDriveInitialized()).toBe(false);
      });
    });

    describe("Authorization URL Generation", () => {
      test("should generate authorization URL", async () => {
        const { initGoogleDrive, getAuthorizationUrl, resetGoogleDrive } = await import(
          "../src/integrations/cloud-storage/google-drive"
        );

        resetGoogleDrive();
        initGoogleDrive({
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
          redirectUri: "http://localhost:3000/callback",
        });

        const url = getAuthorizationUrl();

        expect(url).toContain("accounts.google.com");
        expect(url).toContain("client_id=test-client-id");
        expect(url).toContain("response_type=code");
        expect(url).toContain("scope=");
        expect(url).toContain("access_type=offline");

        resetGoogleDrive();
      });

      test("should include state parameter if provided", async () => {
        const { initGoogleDrive, getAuthorizationUrl, resetGoogleDrive } = await import(
          "../src/integrations/cloud-storage/google-drive"
        );

        resetGoogleDrive();
        initGoogleDrive({ clientId: "test-client-id" });

        const url = getAuthorizationUrl("test-state-123");

        expect(url).toContain("state=test-state-123");

        resetGoogleDrive();
      });
    });
  });

  describe("Dropbox Module", () => {
    describe("Module Exports", () => {
      test("should export initDropbox function", async () => {
        const { initDropbox } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof initDropbox).toBe("function");
      });

      test("should export isDropboxInitialized function", async () => {
        const { isDropboxInitialized } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof isDropboxInitialized).toBe("function");
      });

      test("should export resetDropbox function", async () => {
        const { resetDropbox } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof resetDropbox).toBe("function");
      });

      test("should export getAuthorizationUrl function", async () => {
        const { getAuthorizationUrl } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof getAuthorizationUrl).toBe("function");
      });

      test("should export exchangeCodeForTokens function", async () => {
        const { exchangeCodeForTokens } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof exchangeCodeForTokens).toBe("function");
      });

      test("should export listFolder function", async () => {
        const { listFolder } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof listFolder).toBe("function");
      });

      test("should export listFolderContinue function", async () => {
        const { listFolderContinue } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof listFolderContinue).toBe("function");
      });

      test("should export listAllFiles function", async () => {
        const { listAllFiles } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof listAllFiles).toBe("function");
      });

      test("should export getMetadata function", async () => {
        const { getMetadata } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof getMetadata).toBe("function");
      });

      test("should export searchFiles function", async () => {
        const { searchFiles } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof searchFiles).toBe("function");
      });

      test("should export uploadFile function", async () => {
        const { uploadFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof uploadFile).toBe("function");
      });

      test("should export uploadLocalFile function", async () => {
        const { uploadLocalFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof uploadLocalFile).toBe("function");
      });

      test("should export uploadLargeFile function", async () => {
        const { uploadLargeFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof uploadLargeFile).toBe("function");
      });

      test("should export downloadFile function", async () => {
        const { downloadFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof downloadFile).toBe("function");
      });

      test("should export createFolder function", async () => {
        const { createFolder } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof createFolder).toBe("function");
      });

      test("should export deleteFile function", async () => {
        const { deleteFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof deleteFile).toBe("function");
      });

      test("should export permanentlyDelete function", async () => {
        const { permanentlyDelete } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof permanentlyDelete).toBe("function");
      });

      test("should export moveFile function", async () => {
        const { moveFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof moveFile).toBe("function");
      });

      test("should export copyFile function", async () => {
        const { copyFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof copyFile).toBe("function");
      });

      test("should export getTemporaryLink function", async () => {
        const { getTemporaryLink } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof getTemporaryLink).toBe("function");
      });

      test("should export createSharedLink function", async () => {
        const { createSharedLink } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof createSharedLink).toBe("function");
      });

      test("should export getShareableLink function", async () => {
        const { getShareableLink } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof getShareableLink).toBe("function");
      });

      test("should export listSharedLinks function", async () => {
        const { listSharedLinks } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof listSharedLinks).toBe("function");
      });

      test("should export revokeSharedLink function", async () => {
        const { revokeSharedLink } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof revokeSharedLink).toBe("function");
      });

      test("should export getRevisions function", async () => {
        const { getRevisions } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof getRevisions).toBe("function");
      });

      test("should export restoreFile function", async () => {
        const { restoreFile } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof restoreFile).toBe("function");
      });

      test("should export syncFolder function", async () => {
        const { syncFolder } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof syncFolder).toBe("function");
      });

      test("should export getSpaceUsage function", async () => {
        const { getSpaceUsage } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof getSpaceUsage).toBe("function");
      });

      test("should export getCurrentAccount function", async () => {
        const { getCurrentAccount } = await import("../src/integrations/cloud-storage/dropbox");
        expect(typeof getCurrentAccount).toBe("function");
      });
    });

    describe("Initialization", () => {
      test("should initialize with config", async () => {
        const { initDropbox, isDropboxInitialized, resetDropbox } = await import(
          "../src/integrations/cloud-storage/dropbox"
        );

        resetDropbox();
        expect(isDropboxInitialized()).toBe(false);

        initDropbox({
          appKey: "test-app-key",
          appSecret: "test-app-secret",
          accessToken: "test-access-token",
        });

        expect(isDropboxInitialized()).toBe(true);
        resetDropbox();
      });

      test("should reset properly", async () => {
        const { initDropbox, isDropboxInitialized, resetDropbox } = await import(
          "../src/integrations/cloud-storage/dropbox"
        );

        initDropbox({ accessToken: "test-token" });
        expect(isDropboxInitialized()).toBe(true);

        resetDropbox();
        expect(isDropboxInitialized()).toBe(false);
      });
    });

    describe("Authorization URL Generation", () => {
      test("should generate authorization URL", async () => {
        const { initDropbox, getAuthorizationUrl, resetDropbox } = await import(
          "../src/integrations/cloud-storage/dropbox"
        );

        resetDropbox();
        initDropbox({
          appKey: "test-app-key",
          appSecret: "test-app-secret",
        });

        const url = getAuthorizationUrl();

        expect(url).toContain("dropbox.com");
        expect(url).toContain("client_id=test-app-key");
        expect(url).toContain("response_type=code");
        expect(url).toContain("token_access_type=offline");

        resetDropbox();
      });

      test("should include state parameter if provided", async () => {
        const { initDropbox, getAuthorizationUrl, resetDropbox } = await import(
          "../src/integrations/cloud-storage/dropbox"
        );

        resetDropbox();
        initDropbox({ appKey: "test-app-key" });

        const url = getAuthorizationUrl("test-state-456");

        expect(url).toContain("state=test-state-456");

        resetDropbox();
      });
    });
  });

  describe("Unified Cloud Storage Module", () => {
    describe("Module Exports", () => {
      test("should export UnifiedCloudStorage class", async () => {
        const { UnifiedCloudStorage } = await import("../src/integrations/cloud-storage/unified");
        expect(typeof UnifiedCloudStorage).toBe("function");
      });

      test("should export getUnifiedCloudStorage function", async () => {
        const { getUnifiedCloudStorage } = await import("../src/integrations/cloud-storage/unified");
        expect(typeof getUnifiedCloudStorage).toBe("function");
      });

      test("should export createUnifiedCloudStorage function", async () => {
        const { createUnifiedCloudStorage } = await import("../src/integrations/cloud-storage/unified");
        expect(typeof createUnifiedCloudStorage).toBe("function");
      });

      test("should export resetUnifiedCloudStorage function", async () => {
        const { resetUnifiedCloudStorage } = await import("../src/integrations/cloud-storage/unified");
        expect(typeof resetUnifiedCloudStorage).toBe("function");
      });
    });

    describe("UnifiedCloudStorage Class", () => {
      test("should create instance", async () => {
        const { UnifiedCloudStorage } = await import("../src/integrations/cloud-storage/unified");

        const storage = new UnifiedCloudStorage();

        expect(storage).toBeTruthy();
        expect(typeof storage.initialize).toBe("function");
        expect(typeof storage.setDefaultProvider).toBe("function");
        expect(typeof storage.getDefaultProvider).toBe("function");
        expect(typeof storage.isProviderInitialized).toBe("function");
        expect(typeof storage.getInitializedProviders).toBe("function");
      });

      test("should initialize with Google Drive", async () => {
        const { UnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        resetUnifiedCloudStorage();
        const storage = new UnifiedCloudStorage();

        await storage.initialize({
          "google-drive": {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            accessToken: "test-token",
          },
        });

        expect(storage.isProviderInitialized("google-drive")).toBe(true);
        expect(storage.getDefaultProvider()).toBe("google-drive");
        expect(storage.getInitializedProviders()).toContain("google-drive");

        storage.reset();
      });

      test("should initialize with Dropbox", async () => {
        const { UnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        resetUnifiedCloudStorage();
        const storage = new UnifiedCloudStorage();

        await storage.initialize({
          dropbox: {
            appKey: "test-app-key",
            accessToken: "test-token",
          },
        });

        expect(storage.isProviderInitialized("dropbox")).toBe(true);
        expect(storage.getDefaultProvider()).toBe("dropbox");
        expect(storage.getInitializedProviders()).toContain("dropbox");

        storage.reset();
      });

      test("should initialize with both providers", async () => {
        const { UnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        resetUnifiedCloudStorage();
        const storage = new UnifiedCloudStorage();

        await storage.initialize({
          "google-drive": {
            clientId: "test-client-id",
            accessToken: "test-token",
          },
          dropbox: {
            appKey: "test-app-key",
            accessToken: "test-token",
          },
        });

        expect(storage.isProviderInitialized("google-drive")).toBe(true);
        expect(storage.isProviderInitialized("dropbox")).toBe(true);
        expect(storage.getInitializedProviders()).toHaveLength(2);

        storage.reset();
      });

      test("should set default provider", async () => {
        const { UnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        resetUnifiedCloudStorage();
        const storage = new UnifiedCloudStorage();

        await storage.initialize({
          "google-drive": { accessToken: "test-token" },
          dropbox: { accessToken: "test-token" },
        });

        storage.setDefaultProvider("dropbox");
        expect(storage.getDefaultProvider()).toBe("dropbox");

        storage.setDefaultProvider("google-drive");
        expect(storage.getDefaultProvider()).toBe("google-drive");

        storage.reset();
      });

      test("should throw error when setting non-initialized provider as default", async () => {
        const { UnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        resetUnifiedCloudStorage();
        const storage = new UnifiedCloudStorage();

        await storage.initialize({
          "google-drive": { accessToken: "test-token" },
        });

        expect(() => storage.setDefaultProvider("dropbox")).toThrow();

        storage.reset();
      });

      test("should have all expected methods", async () => {
        const { UnifiedCloudStorage } = await import("../src/integrations/cloud-storage/unified");

        const storage = new UnifiedCloudStorage();

        expect(typeof storage.listFiles).toBe("function");
        expect(typeof storage.listAllFiles).toBe("function");
        expect(typeof storage.getFile).toBe("function");
        expect(typeof storage.searchFiles).toBe("function");
        expect(typeof storage.uploadFile).toBe("function");
        expect(typeof storage.uploadLocalFile).toBe("function");
        expect(typeof storage.downloadFile).toBe("function");
        expect(typeof storage.createFolder).toBe("function");
        expect(typeof storage.deleteFile).toBe("function");
        expect(typeof storage.moveFile).toBe("function");
        expect(typeof storage.copyFile).toBe("function");
        expect(typeof storage.renameFile).toBe("function");
        expect(typeof storage.shareFile).toBe("function");
        expect(typeof storage.getShareableLink).toBe("function");
        expect(typeof storage.syncFolder).toBe("function");
        expect(typeof storage.getStorageQuota).toBe("function");
        expect(typeof storage.getAllStorageQuotas).toBe("function");
        expect(typeof storage.searchAllProviders).toBe("function");
        expect(typeof storage.reset).toBe("function");
      });
    });

    describe("Singleton Instance", () => {
      test("should return same instance from getUnifiedCloudStorage", async () => {
        const { getUnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        resetUnifiedCloudStorage();

        const instance1 = getUnifiedCloudStorage();
        const instance2 = getUnifiedCloudStorage();

        expect(instance1).toBe(instance2);

        resetUnifiedCloudStorage();
      });

      test("should create new instance from createUnifiedCloudStorage", async () => {
        const { createUnifiedCloudStorage, getUnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        resetUnifiedCloudStorage();

        const singleton = getUnifiedCloudStorage();
        const newInstance = createUnifiedCloudStorage();

        expect(newInstance).not.toBe(singleton);

        resetUnifiedCloudStorage();
      });

      test("should reset singleton properly", async () => {
        const { getUnifiedCloudStorage, resetUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        const instance1 = getUnifiedCloudStorage();
        await instance1.initialize({
          "google-drive": { accessToken: "test-token" },
        });

        expect(instance1.isProviderInitialized("google-drive")).toBe(true);

        resetUnifiedCloudStorage();

        const instance2 = getUnifiedCloudStorage();
        expect(instance2.isProviderInitialized("google-drive")).toBe(false);

        resetUnifiedCloudStorage();
      });
    });
  });

  describe("Main Index Module", () => {
    describe("Google Drive Exports", () => {
      test("should export initGoogleDrive", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.initGoogleDrive).toBe("function");
      });

      test("should export isGoogleDriveInitialized", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.isGoogleDriveInitialized).toBe("function");
      });

      test("should export resetGoogleDrive", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.resetGoogleDrive).toBe("function");
      });

      test("should export Google Drive file operations", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");

        expect(typeof cloudStorage.listGoogleDriveFiles).toBe("function");
        expect(typeof cloudStorage.listAllGoogleDriveFiles).toBe("function");
        expect(typeof cloudStorage.getGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.searchGoogleDriveFiles).toBe("function");
        expect(typeof cloudStorage.uploadGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.uploadLocalGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.downloadGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.createGoogleDriveFolder).toBe("function");
        expect(typeof cloudStorage.deleteGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.restoreGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.moveGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.renameGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.copyGoogleDriveFile).toBe("function");
      });

      test("should export Google Drive sharing operations", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");

        expect(typeof cloudStorage.shareGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.getGoogleDriveShareableLink).toBe("function");
        expect(typeof cloudStorage.unshareGoogleDriveFile).toBe("function");
        expect(typeof cloudStorage.listGoogleDrivePermissions).toBe("function");
      });

      test("should export Google Drive sync and quota", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");

        expect(typeof cloudStorage.syncGoogleDriveFolder).toBe("function");
        expect(typeof cloudStorage.getGoogleDriveStorageQuota).toBe("function");
      });
    });

    describe("Dropbox Exports", () => {
      test("should export initDropbox", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.initDropbox).toBe("function");
      });

      test("should export isDropboxInitialized", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.isDropboxInitialized).toBe("function");
      });

      test("should export resetDropbox", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.resetDropbox).toBe("function");
      });

      test("should export Dropbox file operations", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");

        expect(typeof cloudStorage.listDropboxFolder).toBe("function");
        expect(typeof cloudStorage.continueDropboxListing).toBe("function");
        expect(typeof cloudStorage.listAllDropboxFiles).toBe("function");
        expect(typeof cloudStorage.getDropboxMetadata).toBe("function");
        expect(typeof cloudStorage.searchDropboxFiles).toBe("function");
        expect(typeof cloudStorage.uploadDropboxFile).toBe("function");
        expect(typeof cloudStorage.uploadLocalDropboxFile).toBe("function");
        expect(typeof cloudStorage.uploadLargeDropboxFile).toBe("function");
        expect(typeof cloudStorage.downloadDropboxFile).toBe("function");
        expect(typeof cloudStorage.createDropboxFolder).toBe("function");
        expect(typeof cloudStorage.deleteDropboxFile).toBe("function");
        expect(typeof cloudStorage.permanentlyDeleteDropboxFile).toBe("function");
        expect(typeof cloudStorage.moveDropboxFile).toBe("function");
        expect(typeof cloudStorage.copyDropboxFile).toBe("function");
      });

      test("should export Dropbox sharing operations", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");

        expect(typeof cloudStorage.getDropboxTemporaryLink).toBe("function");
        expect(typeof cloudStorage.createDropboxSharedLink).toBe("function");
        expect(typeof cloudStorage.getDropboxShareableLink).toBe("function");
        expect(typeof cloudStorage.listDropboxSharedLinks).toBe("function");
        expect(typeof cloudStorage.revokeDropboxSharedLink).toBe("function");
      });

      test("should export Dropbox revision operations", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");

        expect(typeof cloudStorage.getDropboxRevisions).toBe("function");
        expect(typeof cloudStorage.restoreDropboxFile).toBe("function");
      });

      test("should export Dropbox sync and account", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");

        expect(typeof cloudStorage.syncDropboxFolder).toBe("function");
        expect(typeof cloudStorage.getDropboxSpaceUsage).toBe("function");
        expect(typeof cloudStorage.getDropboxAccount).toBe("function");
      });
    });

    describe("Unified Interface Exports", () => {
      test("should export UnifiedCloudStorage class", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.UnifiedCloudStorage).toBe("function");
      });

      test("should export getUnifiedCloudStorage function", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.getUnifiedCloudStorage).toBe("function");
      });

      test("should export createUnifiedCloudStorage function", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.createUnifiedCloudStorage).toBe("function");
      });

      test("should export resetUnifiedCloudStorage function", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        expect(typeof cloudStorage.resetUnifiedCloudStorage).toBe("function");
      });
    });

    describe("Default Export", () => {
      test("should have default export with all namespaces", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        const defaultExport = cloudStorage.default;

        expect(defaultExport).toBeTruthy();
        expect(defaultExport.getUnifiedStorage).toBeTruthy();
        expect(defaultExport.createUnifiedStorage).toBeTruthy();
        expect(defaultExport.resetUnifiedStorage).toBeTruthy();
        expect(defaultExport.googleDrive).toBeTruthy();
        expect(defaultExport.dropbox).toBeTruthy();
      });

      test("should have Google Drive namespace with all methods", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        const gd = cloudStorage.default.googleDrive;

        expect(typeof gd.init).toBe("function");
        expect(typeof gd.isInitialized).toBe("function");
        expect(typeof gd.reset).toBe("function");
        expect(typeof gd.getAuthUrl).toBe("function");
        expect(typeof gd.exchangeCode).toBe("function");
        expect(typeof gd.list).toBe("function");
        expect(typeof gd.listAll).toBe("function");
        expect(typeof gd.get).toBe("function");
        expect(typeof gd.search).toBe("function");
        expect(typeof gd.upload).toBe("function");
        expect(typeof gd.uploadLocal).toBe("function");
        expect(typeof gd.download).toBe("function");
        expect(typeof gd.createFolder).toBe("function");
        expect(typeof gd.delete).toBe("function");
        expect(typeof gd.restore).toBe("function");
        expect(typeof gd.move).toBe("function");
        expect(typeof gd.rename).toBe("function");
        expect(typeof gd.copy).toBe("function");
        expect(typeof gd.share).toBe("function");
        expect(typeof gd.getShareableLink).toBe("function");
        expect(typeof gd.unshare).toBe("function");
        expect(typeof gd.listPermissions).toBe("function");
        expect(typeof gd.sync).toBe("function");
        expect(typeof gd.getQuota).toBe("function");
      });

      test("should have Dropbox namespace with all methods", async () => {
        const cloudStorage = await import("../src/integrations/cloud-storage");
        const db = cloudStorage.default.dropbox;

        expect(typeof db.init).toBe("function");
        expect(typeof db.isInitialized).toBe("function");
        expect(typeof db.reset).toBe("function");
        expect(typeof db.getAuthUrl).toBe("function");
        expect(typeof db.exchangeCode).toBe("function");
        expect(typeof db.list).toBe("function");
        expect(typeof db.listAll).toBe("function");
        expect(typeof db.get).toBe("function");
        expect(typeof db.search).toBe("function");
        expect(typeof db.upload).toBe("function");
        expect(typeof db.uploadLocal).toBe("function");
        expect(typeof db.uploadLarge).toBe("function");
        expect(typeof db.download).toBe("function");
        expect(typeof db.createFolder).toBe("function");
        expect(typeof db.delete).toBe("function");
        expect(typeof db.permanentlyDelete).toBe("function");
        expect(typeof db.move).toBe("function");
        expect(typeof db.copy).toBe("function");
        expect(typeof db.getTemporaryLink).toBe("function");
        expect(typeof db.createSharedLink).toBe("function");
        expect(typeof db.getShareableLink).toBe("function");
        expect(typeof db.listSharedLinks).toBe("function");
        expect(typeof db.revokeSharedLink).toBe("function");
        expect(typeof db.getRevisions).toBe("function");
        expect(typeof db.restore).toBe("function");
        expect(typeof db.sync).toBe("function");
        expect(typeof db.getSpaceUsage).toBe("function");
        expect(typeof db.getAccount).toBe("function");
      });
    });
  });

  describe("Type Exports", () => {
    test("should export Google Drive types", async () => {
      // Type exports are compile-time only, so we just check the module loads
      const mod = await import("../src/integrations/cloud-storage/google-drive");
      expect(mod).toBeTruthy();
    });

    test("should export Dropbox types", async () => {
      const mod = await import("../src/integrations/cloud-storage/dropbox");
      expect(mod).toBeTruthy();
    });

    test("should export Unified types", async () => {
      const mod = await import("../src/integrations/cloud-storage/unified");
      expect(mod).toBeTruthy();
    });
  });

  describe("Environment Configuration", () => {
    test("should have Google Drive env variables in schema", async () => {
      const fs = await import("fs");
      const envContent = fs.readFileSync(join(import.meta.dirname, "..", "src", "config", "env.ts"), "utf-8");

      expect(envContent).toContain("GOOGLE_DRIVE_CLIENT_ID");
      expect(envContent).toContain("GOOGLE_DRIVE_CLIENT_SECRET");
      expect(envContent).toContain("GOOGLE_DRIVE_REDIRECT_URI");
      expect(envContent).toContain("GOOGLE_DRIVE_REFRESH_TOKEN");
    });

    test("should have Dropbox env variables in schema", async () => {
      const fs = await import("fs");
      const envContent = fs.readFileSync(join(import.meta.dirname, "..", "src", "config", "env.ts"), "utf-8");

      expect(envContent).toContain("DROPBOX_APP_KEY");
      expect(envContent).toContain("DROPBOX_APP_SECRET");
      expect(envContent).toContain("DROPBOX_ACCESS_TOKEN");
      expect(envContent).toContain("DROPBOX_REFRESH_TOKEN");
    });

    test("Google Drive env variables should be optional", async () => {
      const fs = await import("fs");
      const envContent = fs.readFileSync(join(import.meta.dirname, "..", "src", "config", "env.ts"), "utf-8");

      // Check they're marked as optional
      expect(envContent).toContain("GOOGLE_DRIVE_CLIENT_ID: z.string().optional()");
      expect(envContent).toContain("GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional()");
    });

    test("Dropbox env variables should be optional", async () => {
      const fs = await import("fs");
      const envContent = fs.readFileSync(join(import.meta.dirname, "..", "src", "config", "env.ts"), "utf-8");

      // Check they're marked as optional
      expect(envContent).toContain("DROPBOX_APP_KEY: z.string().optional()");
      expect(envContent).toContain("DROPBOX_APP_SECRET: z.string().optional()");
    });
  });

  describe("Error Handling", () => {
    describe("Google Drive Errors", () => {
      test("should throw when not initialized", async () => {
        const { listFiles, resetGoogleDrive } = await import(
          "../src/integrations/cloud-storage/google-drive"
        );

        resetGoogleDrive();

        // Should throw because no credentials available
        await expect(listFiles()).rejects.toThrow();
      });

      test("should throw when no refresh token for auth", async () => {
        const { initGoogleDrive, listFiles, resetGoogleDrive } = await import(
          "../src/integrations/cloud-storage/google-drive"
        );

        resetGoogleDrive();
        initGoogleDrive({
          clientId: "test-id",
          clientSecret: "test-secret",
          // No access token or refresh token
        });

        // Should throw because no token available
        await expect(listFiles()).rejects.toThrow();

        resetGoogleDrive();
      });
    });

    describe("Dropbox Errors", () => {
      test("should throw when not initialized", async () => {
        const { listFolder, resetDropbox } = await import(
          "../src/integrations/cloud-storage/dropbox"
        );

        resetDropbox();

        // Should throw because no credentials available
        await expect(listFolder({ path: "" })).rejects.toThrow();
      });

      test("should throw when no token available", async () => {
        const { initDropbox, listFolder, resetDropbox } = await import(
          "../src/integrations/cloud-storage/dropbox"
        );

        resetDropbox();
        initDropbox({
          appKey: "test-key",
          appSecret: "test-secret",
          // No access token or refresh token
        });

        // Should throw because no token available
        await expect(listFolder({ path: "" })).rejects.toThrow();

        resetDropbox();
      });
    });

    describe("Unified Storage Errors", () => {
      test("should throw when no provider is set", async () => {
        const { createUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        const storage = createUnifiedCloudStorage();

        // Should throw because no provider initialized
        await expect(storage.listFiles()).rejects.toThrow();
      });

      test("should throw for unsupported provider operation", async () => {
        const { createUnifiedCloudStorage } = await import(
          "../src/integrations/cloud-storage/unified"
        );

        const storage = createUnifiedCloudStorage();

        // Should throw when trying to use non-initialized provider
        await expect(storage.listFiles({}, "google-drive")).rejects.toThrow();
        await expect(storage.listFiles({}, "dropbox")).rejects.toThrow();
      });
    });
  });
});
