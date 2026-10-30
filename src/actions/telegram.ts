"use server";

import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getDictionary } from "@/i18n";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrder } from "@/lib/orders";
import { orderMessage } from "@/lib/order-message";
import { getBot, getTelegramSettings, recentChats, saveTelegramSettings, sendMessage, TelegramError } from "@/lib/telegram";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new Error("Forbidden");
}

function localeOf(form: FormData): Locale {
  const value = String(form.get("locale"));
  return isLocale(value) ? value : defaultLocale;
}

// The admin page shows the outcome from the address: ?notice=saved, ?error=send&reason=...
function back(locale: Locale, outcome: Record<string, string>): never {
  redirect(`/${locale}/admin/telegram?${new URLSearchParams(outcome)}`);
}

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 200);

export async function saveTelegramBot(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const token = String(form.get("token") ?? "").trim();
  if (!/^\d+:[\w-]{20,}$/.test(token)) back(locale, { error: "invalid" });
  let bot: string;
  try {
    bot = (await getBot(token)).username;
  } catch (error) {
    back(locale, { error: error instanceof TelegramError && (error.code === 401 || error.code === 404) ? "invalid" : "unreachable" });
  }
  const current = await getTelegramSettings();
  // A new token for the same bot (after revoking the old one) keeps its chats.
  await saveTelegramSettings({ token, bot, chats: current?.bot === bot ? current.chats : [] });
  back(locale, { notice: "saved" });
}

export async function removeTelegramBot(form: FormData) {
  await requireAdmin();
  await saveTelegramSettings(null);
  back(localeOf(form), { notice: "removed" });
}

export async function connectTelegramChat(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const settings = await getTelegramSettings();
  if (!settings) back(locale, {});
  const id = Number(form.get("id"));
  try {
    // Only a chat the bot sees right now can be connected; its name comes from Telegram, not from the form.
    const chat = (await recentChats(settings.token)).find((c) => c.id === id);
    if (!chat) throw new Error("chat not found");
    await sendMessage(settings.token, chat.id, getDictionary(locale).telegram.connected);
    await saveTelegramSettings({ ...settings, chats: [...settings.chats.filter((c) => c.id !== id), { ...chat, locale }] });
  } catch (error) {
    back(locale, { error: "send", reason: reason(error) });
  }
  back(locale, { notice: "connected" });
}

export async function disconnectTelegramChat(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const settings = await getTelegramSettings();
  const id = Number(form.get("id"));
  if (settings) await saveTelegramSettings({ ...settings, chats: settings.chats.filter((c) => c.id !== id) });
  back(locale, { notice: "disconnected" });
}

/** Sends every connected chat the latest order as it would have been announced, or a plain line before the first order. */
export async function sendTelegramTest(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const settings = await getTelegramSettings();
  if (!settings?.chats.length) back(locale, {});
  const [latest] = await db.select({ id: schema.orders.id }).from(schema.orders).orderBy(desc(schema.orders.id)).limit(1);
  const order = latest ? await getOrder({ id: latest.id }) : null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  try {
    for (const chat of settings.chats) {
      const t = getDictionary(chat.locale);
      const text = order
        ? `${t.telegram.test}\n\n${orderMessage(order, t, chat.locale, `${origin}/${chat.locale}/admin/orders/${order.id}`)}`
        : t.telegram.testEmpty;
      await sendMessage(settings.token, chat.id, text);
    }
  } catch (error) {
    back(locale, { error: "send", reason: reason(error) });
  }
  back(locale, { notice: "testSent" });
}
