export type RecordData = Record<string, unknown>;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const value = payload?.error;
    const message = typeof value === "string" ? value : value?.message;
    throw new ApiError(message || payload?.message || `Request failed (${response.status}). Please try again.`, response.status);
  }
  return payload as T;
}

export function display(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function phoneLabel(value: unknown): string {
  const phone = typeof value === "string" ? value : "";
  return phone.length > 4 ? `••• ••• ${phone.slice(-4)}` : "—";
}

export function dateLabel(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
