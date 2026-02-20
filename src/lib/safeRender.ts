/**
 * Defensive rendering utilities to prevent "Objects are not valid as a React child" errors.
 * Use these when rendering any dynamic/AI-generated data.
 */

/**
 * Safely coerce any value to a renderable string.
 * Handles nested objects, null, undefined, booleans, etc.
 */
export function safeStr(v: any, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v || fallback;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    // Try common string-like properties from AI responses
    for (const key of ["text", "value", "message", "title", "content", "name", "description", "label"]) {
      if (typeof v[key] === "string") return v[key] || fallback;
    }
    // JSON as last resort — never render [object Object]
    try {
      const j = JSON.stringify(v);
      return j.length < 200 ? j : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Safely coerce any value to a number.
 */
export function safeNum(v: any, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}
