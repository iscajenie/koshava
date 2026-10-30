import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Locale } from "@/i18n/config";

/** Telegram Bot API; TELEGRAM_API_URL points it at a stand-in server in tests. */
const API = process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

async function call<T>(token: string, method: string, body: object = {}): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string; error_code?: number } | null;
  if (!json?.ok) throw new TelegramError(json?.description ?? `HTTP ${res.status}`, json?.error_code ?? res.status);
  return json.result;
}

export const getBot = (token: string) => call<{ username: string; first_name: string }>(token, "getMe");

export function sendMessage(token: string, chatId: number, html: string) {
  return call(token, "sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

export type TelegramChat = { id: number; title: string };

type Update = {
  message?: { chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string } };
  my_chat_member?: Update["message"];
};

/**
 * Chats that wrote to the bot or added it in the last 24 hours (Telegram keeps updates that long). Reading them
 * does not confirm them, so other admins can still see the same list; the bot must not have a webhook.
 */
export async function recentChats(token: string): Promise<TelegramChat[]> {
  const updates = await call<Update[]>(token, "getUpdates", { allowed_updates: ["message", "my_chat_member"] });
  const chats = new Map<number, TelegramChat>();
  for (const update of updates) {
    const chat = (update.message ?? update.my_chat_member)?.chat;
    if (!chat) continue;
    const person = [chat.first_name, chat.last_name].filter(Boolean).join(" ") + (chat.username ? ` (@${chat.username})` : "");
    chats.set(chat.id, { id: chat.id, title: chat.title ?? (person || String(chat.id)) });
  }
  return [...chats.values()];
}

/** The bot that sends order notifications and the chats it sends them to, kept in the settings table. */
export type TelegramSettings = { token: string; bot: string; chats: (TelegramChat & { locale: Locale })[] };

export async function getTelegramSettings(): Promise<TelegramSettings | null> {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, "telegram"));
  return (row?.value as TelegramSettings | undefined) ?? null;
}

export async function saveTelegramSettings(value: TelegramSettings | null) {
  if (!value) {
    await db.delete(schema.settings).where(eq(schema.settings.key, "telegram"));
    return;
  }
  await db
    .insert(schema.settings)
    .values({ key: "telegram", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}
