import mysql from "mysql2/promise";
import { config } from "../config.js";

export let dbAvailable = false;

let _pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return _pool;
}

export function setDbAvailable(available: boolean): void {
  dbAvailable = available;
}
