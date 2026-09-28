import type { ValueKind } from "./types";

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(6)).toString();
}

function normalizeScalar(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const match = value.match(/^(\d+(?:\.\d+)?)\s*(kW|W|V|Hz|litres|L)$/i);
  const quantity = match?.[1];
  const rawUnit = match?.[2];
  if (!quantity || !rawUnit) return value.trim();

  const n = parseFloat(quantity);
  const unit = rawUnit.toLowerCase();

  if (unit === "kw") return `${formatNumber(n * 1000)} W`;
  if (unit === "w") return `${formatNumber(n)} W`;
  if (unit === "v") return `${formatNumber(n)} V`;
  if (unit === "hz") return `${formatNumber(n)} Hz`;
  if (unit === "l" || unit === "litres") return `${formatNumber(n)} L`;

  return value.trim();
}

function normalizeList(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const trimmed = typeof item === "string" ? item.trim() : String(item).trim();
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

function normalizeProse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeValue(value: unknown, valueKind: ValueKind): unknown {
  if (valueKind === "scalar") return normalizeScalar(value);
  if (valueKind === "list") return normalizeList(value);
  if (valueKind === "prose") return normalizeProse(value);
  return value;
}
