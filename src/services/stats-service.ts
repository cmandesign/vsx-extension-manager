import { pool } from "../db/connection.js";

export interface DownloadRecord {
  id: number;
  publisher: string;
  extension_name: string;
  version: string;
  asset_type: string;
  user_id: number | null;
  downloaded_at: Date;
}

export async function trackDownload(
  publisher: string,
  extensionName: string,
  version: string,
  assetType: string,
  userId: number | null
): Promise<void> {
  await pool.execute(
    "INSERT INTO download_stats (publisher, extension_name, version, asset_type, user_id) VALUES (?, ?, ?, ?, ?)",
    [publisher, extensionName, version, assetType, userId]
  );
}

export async function getTotalDownloads(): Promise<number> {
  const [rows] = await pool.execute("SELECT COUNT(*) as count FROM download_stats");
  return (rows as Array<{ count: number }>)[0].count;
}

export async function getTopExtensions(limit = 10): Promise<Array<{ publisher: string; extension_name: string; downloads: number }>> {
  const [rows] = await pool.execute(
    `SELECT publisher, extension_name, COUNT(*) as downloads
     FROM download_stats
     GROUP BY publisher, extension_name
     ORDER BY downloads DESC
     LIMIT ?`,
    [limit]
  );
  return rows as Array<{ publisher: string; extension_name: string; downloads: number }>;
}

export async function getRecentDownloads(limit = 20): Promise<DownloadRecord[]> {
  const [rows] = await pool.execute(
    `SELECT ds.*, u.username
     FROM download_stats ds
     LEFT JOIN users u ON ds.user_id = u.id
     ORDER BY ds.downloaded_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows as DownloadRecord[];
}

export async function getDownloadsByDate(days = 30): Promise<Array<{ date: string; downloads: number }>> {
  const [rows] = await pool.execute(
    `SELECT DATE(downloaded_at) as date, COUNT(*) as downloads
     FROM download_stats
     WHERE downloaded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(downloaded_at)
     ORDER BY date`,
    [days]
  );
  return rows as Array<{ date: string; downloads: number }>;
}
