import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { getPool, setDbAvailable } from "./connection.js";

async function tryConnect(retries: number, delayMs: number): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      // First connect without database to create it if needed
      const conn = await mysql.createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
      });
      await conn.execute(
        `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\``
      );
      await conn.end();
      return;
    } catch (err) {
      const message = (err as Error).message;
      if (i < retries - 1) {
        console.log(`DB connection attempt ${i + 1}/${retries} failed: ${message}. Retrying in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }
}

export async function initDatabase(): Promise<boolean> {
  console.log("Initializing database...");

  try {
    await tryConnect(3, 1000);
  } catch (err) {
    console.warn(`WARNING: Could not connect to MySQL (${(err as Error).message})`);
    console.warn("The app will run in proxy-only mode. Admin/login/stats features are disabled.");
    return false;
  }

  try {
    const pool = getPool();

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
      console.log("Default admin user created (admin/admin) - change the password!");
    }

    setDbAvailable(true);
    console.log("Database initialized successfully");
    return true;
  } catch (err) {
    console.warn(`WARNING: Database initialization failed: ${(err as Error).message}`);
    console.warn("The app will run in proxy-only mode.");
    return false;
  }
}
