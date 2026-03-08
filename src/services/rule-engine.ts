import { getPool } from "../db/connection.js";
import type { Extension } from "../types/marketplace.js";
import type { PolicyMode, ListType } from "./policy-service.js";

export type RuleField = "title" | "author" | "license" | "description" | "date_updated" | "age_hours";
export type RuleOperator = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "regex";
export type RuleAction = "allow" | "block";

export interface PolicyRule {
  id: number;
  field: RuleField;
  operator: RuleOperator;
  value: string;
  action: RuleAction;
  override_policy: boolean;
  priority: number;
  enabled: boolean;
  created_at: Date;
}

export async function getRules(): Promise<PolicyRule[]> {
  const [rows] = await getPool().query(
    "SELECT * FROM policy_rules ORDER BY priority DESC, id ASC"
  );
  return rows as PolicyRule[];
}

export async function createRule(rule: Omit<PolicyRule, "id" | "created_at">): Promise<void> {
  await getPool().query(
    `INSERT INTO policy_rules (field, operator, value, action, override_policy, priority, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rule.field, rule.operator, rule.value, rule.action, rule.override_policy, rule.priority, rule.enabled]
  );
}

export async function updateRule(id: number, rule: Partial<Omit<PolicyRule, "id" | "created_at">>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(rule)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return;
  values.push(id);

  await getPool().query(
    `UPDATE policy_rules SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
}

export async function deleteRule(id: number): Promise<void> {
  await getPool().query("DELETE FROM policy_rules WHERE id = ?", [id]);
}

function extractField(ext: Extension, field: RuleField): string {
  switch (field) {
    case "title":
      return (ext as any).displayName || ext.extensionName || "";
    case "author":
      return ext.publisher?.publisherName || "";
    case "description":
      return (ext as any).shortDescription || "";
    case "license": {
      const versions = ext.versions || [];
      if (versions.length === 0) return "";
      const latest = versions[0] as any;
      const props = latest.properties || [];
      const licenseProp = props.find(
        (p: any) => p.key === "Microsoft.VisualStudio.Services.Links.License"
      );
      if (licenseProp) return licenseProp.value || "";
      // Try tags for license info
      const tags = (ext as any).tags || [];
      const licenseTag = tags.find((t: string) =>
        t.toLowerCase().startsWith("license:")
      );
      return licenseTag ? licenseTag.replace(/^license:/i, "").trim() : "";
    }
    case "date_updated": {
      const versions = ext.versions || [];
      if (versions.length > 0) {
        return (versions[0] as any).lastUpdated || (ext as any).lastUpdated || "";
      }
      return (ext as any).lastUpdated || "";
    }
    case "age_hours": {
      const versions = ext.versions || [];
      const dateStr = versions.length > 0
        ? ((versions[0] as any).lastUpdated || (ext as any).lastUpdated || "")
        : ((ext as any).lastUpdated || "");
      if (!dateStr) return "";
      const ageMs = Date.now() - new Date(dateStr).getTime();
      if (isNaN(ageMs)) return "";
      const ageHours = ageMs / (1000 * 60 * 60);
      return ageHours.toString();
    }
    default:
      return "";
  }
}

function evaluateCondition(fieldValue: string, operator: RuleOperator, ruleValue: string, isNumeric: boolean): boolean {
  if (isNumeric) {
    const numField = parseFloat(fieldValue);
    const numRule = parseFloat(ruleValue);
    if (isNaN(numField) || isNaN(numRule)) return false;
    switch (operator) {
      case "eq": return numField === numRule;
      case "neq": return numField !== numRule;
      case "gt": return numField > numRule;
      case "lt": return numField < numRule;
      case "gte": return numField >= numRule;
      case "lte": return numField <= numRule;
      default: return false;
    }
  }

  switch (operator) {
    case "eq":
      return fieldValue.toLowerCase() === ruleValue.toLowerCase();
    case "neq":
      return fieldValue.toLowerCase() !== ruleValue.toLowerCase();
    case "gt":
      return fieldValue > ruleValue;
    case "lt":
      return fieldValue < ruleValue;
    case "gte":
      return fieldValue >= ruleValue;
    case "lte":
      return fieldValue <= ruleValue;
    case "regex":
      try {
        return new RegExp(ruleValue, "i").test(fieldValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function ruleMatches(ext: Extension, rule: PolicyRule): boolean {
  const fieldValue = extractField(ext, rule.field);
  const isNumeric = rule.field === "age_hours";
  return evaluateCondition(fieldValue, rule.operator, rule.value, isNumeric);
}

export function isExtensionAllowed(
  ext: Extension,
  rules: PolicyRule[],
  policyMode: PolicyMode,
  listEntry: ListType | null
): boolean {
  const enabledRules = rules.filter((r) => r.enabled);

  // 1. Check override rules (first match wins)
  const overrideRules = enabledRules
    .filter((r) => r.override_policy)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of overrideRules) {
    if (ruleMatches(ext, rule)) {
      return rule.action === "allow";
    }
  }

  // 2. Check explicit policy list
  if (listEntry) {
    if (policyMode === "whitelist" && listEntry === "whitelist") return true;
    if (policyMode === "blacklist" && listEntry === "blacklist") return false;
    // If on the opposite list (e.g., whitelisted in blacklist mode), treat as explicitly allowed/blocked
    if (listEntry === "whitelist") return true;
    if (listEntry === "blacklist") return false;
  }

  // 3. Check normal rules (first match wins)
  const normalRules = enabledRules
    .filter((r) => !r.override_policy)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of normalRules) {
    if (ruleMatches(ext, rule)) {
      return rule.action === "allow";
    }
  }

  // 4. Fall back to global policy default
  return policyMode === "blacklist"; // blacklist mode: allow by default; whitelist mode: block by default
}

export function filterExtensions(
  extensions: Extension[],
  rules: PolicyRule[],
  policyMode: PolicyMode,
  policyListMap: Map<string, ListType>
): Extension[] {
  return extensions.filter((ext) => {
    const extId = `${ext.publisher.publisherName}.${ext.extensionName}`.toLowerCase();
    const listEntry = policyListMap.get(extId) || null;
    return isExtensionAllowed(ext, rules, policyMode, listEntry);
  });
}
