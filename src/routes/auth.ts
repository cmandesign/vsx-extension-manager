import { Router } from "express";
import { dbAvailable } from "../db/connection.js";
import { findByUsername, verifyPassword } from "../services/user-service.js";

const router = Router();

router.get("/login", (req, res) => {
  if (!dbAvailable) {
    res.status(503).send("Login requires database. Please configure MySQL.");
    return;
  }
  if (res.locals.user) {
    res.redirect("/");
    return;
  }
  res.render("login", { error: null });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.render("login", { error: "Username and password are required" });
    return;
  }

  const user = await findByUsername(username);
  if (!user || !(await verifyPassword(user, password))) {
    res.render("login", { error: "Invalid username or password" });
    return;
  }

  req.session.userId = user.id;
  req.session.save(() => {
    res.redirect(user.role === "admin" ? "/admin/dashboard" : "/");
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

export default router;
