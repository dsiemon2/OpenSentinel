import { describe, test, expect } from "bun:test";
import { ROLE_PERMISSIONS } from "../src/core/permissions/permission-manager";

describe("Permission Manager", () => {
  describe("ROLE_PERMISSIONS", () => {
    test("should define permissions for owner role", () => {
      expect(ROLE_PERMISSIONS.owner).toBeTruthy();
      expect(Array.isArray(ROLE_PERMISSIONS.owner)).toBe(true);
      expect(ROLE_PERMISSIONS.owner.length).toBeGreaterThan(0);
    });

    test("should define permissions for admin role", () => {
      expect(ROLE_PERMISSIONS.admin).toBeTruthy();
      expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(0);
    });

    test("should define permissions for member role", () => {
      expect(ROLE_PERMISSIONS.member).toBeTruthy();
      expect(ROLE_PERMISSIONS.member.length).toBeGreaterThan(0);
    });

    test("should define permissions for viewer role", () => {
      expect(ROLE_PERMISSIONS.viewer).toBeTruthy();
      expect(ROLE_PERMISSIONS.viewer.length).toBeGreaterThan(0);
    });

    test("owner should have most permissions", () => {
      expect(ROLE_PERMISSIONS.owner.length).toBeGreaterThan(
        ROLE_PERMISSIONS.admin.length
      );
    });

    test("admin should have more permissions than member", () => {
      expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(
        ROLE_PERMISSIONS.member.length
      );
    });

    test("member should have more permissions than viewer", () => {
      expect(ROLE_PERMISSIONS.member.length).toBeGreaterThan(
        ROLE_PERMISSIONS.viewer.length
      );
    });
  });

  describe("Permission inheritance", () => {
    test("owner should have org:manage permission", () => {
      expect(ROLE_PERMISSIONS.owner).toContain("org:manage");
    });

    test("admin should not have org:manage permission", () => {
      expect(ROLE_PERMISSIONS.admin).not.toContain("org:manage");
    });

    test("owner should have all admin permissions", () => {
      for (const permission of ROLE_PERMISSIONS.admin) {
        expect(ROLE_PERMISSIONS.owner).toContain(permission);
      }
    });

    test("all roles should have chat:basic permission", () => {
      expect(ROLE_PERMISSIONS.owner).toContain("chat:basic");
      expect(ROLE_PERMISSIONS.admin).toContain("chat:basic");
      expect(ROLE_PERMISSIONS.member).toContain("chat:basic");
      expect(ROLE_PERMISSIONS.viewer).toContain("chat:basic");
    });

    test("viewer should not have write permissions", () => {
      expect(ROLE_PERMISSIONS.viewer).not.toContain("memory:share");
      expect(ROLE_PERMISSIONS.viewer).not.toContain("memory:delete_shared");
      expect(ROLE_PERMISSIONS.viewer).not.toContain("agents:spawn");
    });
  });

  describe("Specific permissions", () => {
    test("should include org permissions", () => {
      const orgPermissions = ["org:manage", "org:invite", "org:remove_members", "org:view_members"];
      for (const perm of orgPermissions) {
        expect(ROLE_PERMISSIONS.owner).toContain(perm);
      }
    });

    test("should include memory permissions", () => {
      const memoryPermissions = ["memory:share", "memory:view_shared", "memory:delete_shared"];
      for (const perm of memoryPermissions) {
        expect(ROLE_PERMISSIONS.owner).toContain(perm);
      }
    });

    test("should include quota permissions", () => {
      expect(ROLE_PERMISSIONS.owner).toContain("quota:view");
      expect(ROLE_PERMISSIONS.owner).toContain("quota:manage");
    });

    test("should include agent permissions", () => {
      expect(ROLE_PERMISSIONS.owner).toContain("agents:spawn");
      expect(ROLE_PERMISSIONS.owner).toContain("agents:manage");
    });

    test("should include tool permissions", () => {
      expect(ROLE_PERMISSIONS.owner).toContain("tools:basic");
      expect(ROLE_PERMISSIONS.owner).toContain("tools:advanced");
      expect(ROLE_PERMISSIONS.owner).toContain("tools:shell");
    });

    test("viewer should have read-only permissions", () => {
      const viewerPerms = ROLE_PERMISSIONS.viewer;
      expect(viewerPerms).toContain("org:view_members");
      expect(viewerPerms).toContain("memory:view_shared");
      expect(viewerPerms).toContain("quota:view");
      expect(viewerPerms).not.toContain("org:invite");
      expect(viewerPerms).not.toContain("org:remove_members");
    });
  });
});
