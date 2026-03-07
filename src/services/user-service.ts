import { getPool } from "../db/connection.js";
import bcrypt from "bcryptjs";

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: "admin" | "viewer";
  created_at: Date;
  updated_at: Date;
}

export async function findByUsername(username: string): Promise<User | null> {
  const [rows] = await getPool().execute("SELECT * FROM users WHERE username = ?", [username]);
  const users = rows as User[];
  return users[0] || null;
}

export async function findById(id: number): Promise<User | null> {
  const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ?", [id]);
  const users = rows as User[];
  return users[0] || null;
}

export async function listUsers(): Promise<User[]> {
  const [rows] = await getPool().execute("SELECT id, username, role, created_at, updated_at FROM users ORDER BY id");
  return rows as User[];
}

export async function createUser(username: string, password: string, role: "admin" | "viewer"): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  await getPool().execute(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
    [username, hash, role]
  );
}

export async function updateUser(id: number, data: { username?: string; password?: string; role?: string }): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (data.username) {
    sets.push("username = ?");
    values.push(data.username);
  }
  if (data.password) {
    sets.push("password_hash = ?");
    values.push(await bcrypt.hash(data.password, 10));
  }
  if (data.role) {
    sets.push("role = ?");
    values.push(data.role);
  }

  if (sets.length === 0) return;
  values.push(id);
  await getPool().execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, values);
}

export async function deleteUser(id: number): Promise<void> {
  await getPool().execute("DELETE FROM users WHERE id = ?", [id]);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}
