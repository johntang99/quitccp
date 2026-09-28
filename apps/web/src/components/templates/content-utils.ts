export type JsonMap = Record<string, unknown>;

export function asRecord(value: unknown): JsonMap {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonMap;
  }
  return {};
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => asString(item)).filter(Boolean);
}

export function asObjectArray(value: unknown): JsonMap[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((row) => Object.keys(row).length > 0);
}
