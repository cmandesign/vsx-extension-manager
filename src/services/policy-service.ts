import { getPool } from "../db/connection.js";

export type PolicyMode = "blacklist" | "whitelist";
export type ListType = "whitelist" | "blacklist";

export interface PolicyListEntry {
  id: number;
  extension_id: string;
  version: string | null;
  list_type: ListType;
  added_by: number | null;
  username?: string;
  created_at: Date;
}

export async function getPolicyMode(): Promise<PolicyMode> {
  const [rows] = await getPool().query(
    "SELECT mode FROM policy_config WHERE id = 1"
  );
  const result = rows as Array<{ mode: PolicyMode }>;
  return result.length > 0 ? result[0].mode : "blacklist";
}

export async function setPolicyMode(mode: PolicyMode): Promise<void> {
  await getPool().query(
    "UPDATE policy_config SET mode = ? WHERE id = 1",
    [mode]
  );
}

export async function getPolicyList(): Promise<PolicyListEntry[]> {
  const [rows] = await getPool().query(
    `SELECT pl.*, u.username
     FROM policy_list pl
     LEFT JOIN users u ON pl.added_by = u.id
     ORDER BY pl.created_at DESC`
  );
  return rows as PolicyListEntry[];
}

export async function addToList(
  extensionId: string,
  listType: ListType,
  userId: number | null,
  version: string | null = null
): Promise<void> {
  await getPool().query(
    `INSERT INTO policy_list (extension_id, version, list_type, added_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE list_type = VALUES(list_type), added_by = VALUES(added_by)`,
    [extensionId.toLowerCase(), version || null, listType, userId]
  );
}

export async function removeFromList(id: number): Promise<void> {
  await getPool().query("DELETE FROM policy_list WHERE id = ?", [id]);
}

export async function removeFromListByExtensionId(extensionId: string, version: string | null = null): Promise<void> {
  if (version) {
    await getPool().query(
      "DELETE FROM policy_list WHERE extension_id = ? AND version = ?",
      [extensionId.toLowerCase(), version]
    );
  } else {
    await getPool().query(
      "DELETE FROM policy_list WHERE extension_id = ? AND version IS NULL",
      [extensionId.toLowerCase()]
    );
  }
}

export async function getListEntry(extensionId: string): Promise<PolicyListEntry | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM policy_list WHERE extension_id = ? AND version IS NULL",
    [extensionId.toLowerCase()]
  );
  const result = rows as PolicyListEntry[];
  return result.length > 0 ? result[0] : null;
}

export async function getVersionListEntries(extensionId: string): Promise<PolicyListEntry[]> {
  const [rows] = await getPool().query(
    "SELECT * FROM policy_list WHERE extension_id = ? ORDER BY version",
    [extensionId.toLowerCase()]
  );
  return rows as PolicyListEntry[];
}

export async function getBulkListStatus(
  extensionIds: string[]
): Promise<Map<string, ListType>> {
  if (extensionIds.length === 0) return new Map();

  const lowerIds = extensionIds.map((id) => id.toLowerCase());
  const placeholders = lowerIds.map(() => "?").join(",");
  const [rows] = await getPool().query(
    `SELECT extension_id, list_type FROM policy_list WHERE extension_id IN (${placeholders}) AND version IS NULL`,
    lowerIds
  );
  const result = new Map<string, ListType>();
  for (const row of rows as Array<{ extension_id: string; list_type: ListType }>) {
    result.set(row.extension_id, row.list_type);
  }
  return result;
}
