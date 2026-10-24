import { readFile } from "node:fs/promises";

export const USER_AGENT = "Mozilla/5.0 (compatible; KoshavaBot/0.1; +https://github.com/koshava)";

/** Reads a local path or downloads a URL, retrying transient failures. */
export async function loadText(source: string, attempts = 3): Promise<string> {
  if (!/^https?:\/\//.test(source)) return readFile(source, "utf8");
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(source, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${source}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastError;
}

export function belgradeToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
