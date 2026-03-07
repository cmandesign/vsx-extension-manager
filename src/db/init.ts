import { pool } from "./connection.js";
import bcrypt from "bcryptjs";

export async function initDatabase(): Promise<void> {
  console.log("Initializing database...");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'viewer') NOT NULL DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS download_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      publisher VARCHAR(255) NOT NULL,
      extension_name VARCHAR(255) NOT NULL,
      version VARCHAR(100) NOT NULL,
      asset_type VARCHAR(255) NOT NULL DEFAULT 'vspackage',
      user_id INT NULL,
      downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_extension (publisher, extension_name),
      INDEX idx_downloaded_at (downloaded_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Create sessions table for express-mysql-session
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(128) NOT NULL PRIMARY KEY,
      expires INT UNSIGNED NOT NULL,
      data MEDIUMTEXT,
      INDEX idx_expires (expires)
    )
  `);

  // Seed default admin if no users exist
  const [rows] = await pool.execute("SELECT COUNT(*) as count FROM users");
  const count = (rows as Array<{ count: number }>)[0].count;
  if (count === 0) {
    const hash = await bcrypt.hash("admin", 10);
    await pool.execute(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      ["admin", hash, "admin"]
    );
    console.log("Default admin user created (admin/admin)");
  }

  console.log("Database initialized successfully");
}
