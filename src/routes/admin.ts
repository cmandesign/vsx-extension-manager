import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { listUsers, createUser, updateUser, deleteUser } from "../services/user-service.js";
import { getTotalDownloads, getTopExtensions, getRecentDownloads, getDownloadsByDate } from "../services/stats-service.js";

const router = Router();

// All admin routes require admin role
router.use("/admin", requireAdmin);

// Dashboard with download stats
router.get("/admin/dashboard", async (_req, res) => {
  const [totalDownloads, topExtensions, recentDownloads, downloadsByDate] = await Promise.all([
    getTotalDownloads(),
    getTopExtensions(10),
    getRecentDownloads(20),
    getDownloadsByDate(30),
  ]);

  res.render("admin/dashboard", {
    totalDownloads,
    topExtensions,
    recentDownloads,
    downloadsByDate,
  });
});

// User management page
router.get("/admin/users", async (_req, res) => {
  const users = await listUsers();
  res.render("admin/users", { users, error: null, success: null });
});

// Create user
router.post("/admin/users", async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    const users = await listUsers();
    res.render("admin/users", { users, error: "Username and password are required", success: null });
    return;
  }

  try {
    await createUser(username, password, role || "viewer");
    const users = await listUsers();
    res.render("admin/users", { users, error: null, success: `User "${username}" created` });
  } catch (err: unknown) {
    const users = await listUsers();
    const message = err instanceof Error && err.message.includes("Duplicate")
      ? "Username already exists"
      : "Failed to create user";
    res.render("admin/users", { users, error: message, success: null });
  }
});

// Update user
router.post("/admin/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { username, password, role } = req.body;

  try {
    await updateUser(id, { username: username || undefined, password: password || undefined, role: role || undefined });
  } catch {
    // ignore update errors
  }

  res.redirect("/admin/users");
});

// Delete user
router.post("/admin/users/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id);

  // Prevent deleting yourself
  if (res.locals.user?.id === id) {
    const users = await listUsers();
    res.render("admin/users", { users, error: "Cannot delete your own account", success: null });
    return;
  }

  await deleteUser(id);
  res.redirect("/admin/users");
});

export default router;
