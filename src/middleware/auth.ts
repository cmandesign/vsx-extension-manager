import type { Request, Response, NextFunction } from "express";
import { findById } from "../services/user-service.js";

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// Attach user to res.locals if session exists
export async function optionalUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.locals.user = null;
  if (req.session?.userId) {
    const user = await findById(req.session.userId);
    if (user) {
      res.locals.user = { id: user.id, username: user.username, role: user.role };
    }
  }
  next();
}

// Require admin role, redirect to login if not authenticated
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!res.locals.user || res.locals.user.role !== "admin") {
    res.redirect("/login");
    return;
  }
  next();
}
