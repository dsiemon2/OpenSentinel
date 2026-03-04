/**
 * Users API Routes — User management for the dashboard
 */

import { Hono } from "hono";

const usersRouter = new Hono();

// GET /api/users — List users
usersRouter.get("/", async (c) => {
  try {
    const { searchUsers } = await import("../../../core/enterprise/multi-user");
    const users = await searchUsers({});
    return c.json(users);
  } catch {
    return c.json([]);
  }
});

// POST /api/users — Create user
usersRouter.post("/", async (c) => {
  try {
    const { email, name, role } = await c.req.json<{
      email: string;
      name?: string;
      role?: string;
    }>();

    if (!email) {
      return c.json({ error: "email is required" }, 400);
    }

    const { createUser } = await import("../../../core/enterprise/multi-user");
    const user = await createUser({
      email,
      name: name || "",
      role: role || "user",
    });
    return c.json(user, 201);
  } catch (error) {
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// PUT /api/users/:id — Update user
usersRouter.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();

    if (updates.status === "suspended") {
      const { suspendUser } = await import("../../../core/enterprise/multi-user");
      await suspendUser(id, "Suspended via dashboard");
      return c.json({ success: true });
    }

    if (updates.status === "active") {
      const { reactivateUser } = await import("../../../core/enterprise/multi-user");
      await reactivateUser(id);
      return c.json({ success: true });
    }

    const { updateUser } = await import("../../../core/enterprise/multi-user");
    await updateUser(id, updates);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update user" }, 500);
  }
});

// DELETE /api/users/:id — Delete user
usersRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { deleteUser } = await import("../../../core/enterprise/multi-user");
    await deleteUser(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

export default usersRouter;
