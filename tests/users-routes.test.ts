import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import * as realMultiUser from "../src/core/enterprise/multi-user";

// ============================================
// Users Routes — API Tests
// ============================================
// Tests the users API: list, create, update, delete.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockUsers = [
  {
    id: "usr-001",
    email: "admin@example.com",
    name: "Admin User",
    role: "admin",
    status: "active",
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "usr-002",
    email: "john@example.com",
    name: "John Doe",
    role: "user",
    status: "active",
    lastLoginAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "usr-003",
    email: "suspended@example.com",
    name: "Suspended User",
    role: "user",
    status: "suspended",
    lastLoginAt: null,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
];

let createdUsers: any[] = [];
let updatedUsers: Array<{ id: string; updates: any }> = [];
let suspendedUsers: Array<{ id: string; reason: string }> = [];
let reactivatedUsers: string[] = [];
let deletedUsers: string[] = [];

mock.module("../src/core/enterprise/multi-user", () => ({
  ...realMultiUser,
  searchUsers: async (query: any) => mockUsers,
  createUser: async (data: any) => {
    const user = { id: `usr-${Date.now()}`, ...data, status: "active", createdAt: new Date().toISOString() };
    createdUsers.push(user);
    return user;
  },
  updateUser: async (id: string, updates: any) => {
    updatedUsers.push({ id, updates });
  },
  suspendUser: async (id: string, reason: string) => {
    suspendedUsers.push({ id, reason });
  },
  reactivateUser: async (id: string) => {
    reactivatedUsers.push(id);
  },
  deleteUser: async (id: string) => {
    deletedUsers.push(id);
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const usersRouter = (await import("../src/inputs/api/routes/users")).default;
  const testApp = new Hono();
  testApp.route("/api/users", usersRouter);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
): Promise<Response> {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("Users Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    createdUsers = [];
    updatedUsers = [];
    suspendedUsers = [];
    reactivatedUsers = [];
    deletedUsers = [];
  });

  describe("GET /api/users", () => {
    test("should return list of users", async () => {
      const res = await req(app, "GET", "/api/users");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(3);
    });

    test("each user should have required fields", async () => {
      const res = await req(app, "GET", "/api/users");
      const json = await res.json();

      for (const user of json) {
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.role).toBeDefined();
        expect(user.status).toBeDefined();
      }
    });

    test("should include users of different statuses", async () => {
      const res = await req(app, "GET", "/api/users");
      const json = await res.json();

      const active = json.filter((u: any) => u.status === "active");
      const suspended = json.filter((u: any) => u.status === "suspended");
      expect(active.length).toBe(2);
      expect(suspended.length).toBe(1);
    });

    test("should include users of different roles", async () => {
      const res = await req(app, "GET", "/api/users");
      const json = await res.json();

      const admins = json.filter((u: any) => u.role === "admin");
      const users = json.filter((u: any) => u.role === "user");
      expect(admins.length).toBe(1);
      expect(users.length).toBe(2);
    });
  });

  describe("POST /api/users", () => {
    test("should create a new user", async () => {
      const res = await req(app, "POST", "/api/users", {
        email: "new@example.com",
        name: "New User",
        role: "user",
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBeDefined();
      expect(json.email).toBe("new@example.com");
    });

    test("should pass data to createUser", async () => {
      await req(app, "POST", "/api/users", {
        email: "test@example.com",
        name: "Test User",
        role: "admin",
      });

      expect(createdUsers.length).toBe(1);
      expect(createdUsers[0].email).toBe("test@example.com");
      expect(createdUsers[0].name).toBe("Test User");
      expect(createdUsers[0].role).toBe("admin");
    });

    test("should return 400 if email is missing", async () => {
      const res = await req(app, "POST", "/api/users", {
        name: "No Email",
      });
      expect(res.status).toBe(400);
    });

    test("should default role to 'user' if not provided", async () => {
      await req(app, "POST", "/api/users", {
        email: "default-role@example.com",
      });

      expect(createdUsers.length).toBe(1);
      expect(createdUsers[0].role).toBe("user");
    });
  });

  describe("PUT /api/users/:id", () => {
    test("should suspend a user", async () => {
      const res = await req(app, "PUT", "/api/users/usr-002", {
        status: "suspended",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(suspendedUsers.length).toBe(1);
      expect(suspendedUsers[0].id).toBe("usr-002");
    });

    test("should reactivate a user", async () => {
      const res = await req(app, "PUT", "/api/users/usr-003", {
        status: "active",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(reactivatedUsers.length).toBe(1);
      expect(reactivatedUsers[0]).toBe("usr-003");
    });

    test("should update other fields via updateUser", async () => {
      const res = await req(app, "PUT", "/api/users/usr-001", {
        name: "Updated Admin",
        role: "superadmin",
      });

      expect(res.status).toBe(200);
      expect(updatedUsers.length).toBe(1);
      expect(updatedUsers[0].id).toBe("usr-001");
      expect(updatedUsers[0].updates.name).toBe("Updated Admin");
    });
  });

  describe("DELETE /api/users/:id", () => {
    test("should delete a user", async () => {
      const res = await req(app, "DELETE", "/api/users/usr-003");

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    test("should pass correct id to deleteUser", async () => {
      await req(app, "DELETE", "/api/users/usr-002");

      expect(deletedUsers.length).toBe(1);
      expect(deletedUsers[0]).toBe("usr-002");
    });
  });
});
