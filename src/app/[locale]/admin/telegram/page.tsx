import Link from "next/link";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { connectTelegramChat, disconnectTelegramChat, removeTelegramBot, saveTelegramBot, sendTelegramTest } from "@/actions/telegram";
import { getTelegramSettings, recentChats, type TelegramChat } from "@/lib/telegram";

export default async function AdminTelegramPage({ searchParams }: PageProps<"/[locale]/admin/telegram">) {
  const { locale, t } = await getI18n();
  const tg = t.admin.telegram;
  const params = await searchParams;
  const one = (key: string) => [params[key]].flat()[0];
  const settings = await getTelegramSettings();

  // "Find chats" reads the bot's recent messages on this request only.
  let found: TelegramChat[] | null = null;
  let findError: string | null = null;
  if (settings && one("find")) {
    try {
      found = (await recentChats(settings.token)).filter((c) => !settings.chats.some((s) => s.id === c.id));
    } catch (error) {
      findError = error instanceof Error ? error.message : String(error);
    }
  }
  const notice = tg.notices[one("notice") as keyof typeof tg.notices];
  const errorKey = one("error") as keyof typeof tg.errors | undefined;
  const error = findError ? fmt(tg.errors.find, { reason: findError }) : errorKey && tg.errors[errorKey] && fmt(tg.errors[errorKey], { reason: one("reason") ?? "" });
  const botLink = (name: string) => (
    <a href={`https://t.me/${name}`} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
      @{name}
    </a>
  );
  const tokenForm = (
    <form action={saveTelegramBot} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <div className="min-w-64 flex-1">
        <label className="label" htmlFor="token">
          {tg.token}
        </label>
        <input id="token" name="token" type="password" autoComplete="off" required placeholder="123456789:AA…" className="field" />
      </div>
      <button className="btn-primary h-11 px-5">{tg.save}</button>
    </form>
  );

  return (
    <div className="max-w-2xl space-y-4" data-testid="telegram-settings">
      <p className="text-sm text-muted">{tg.intro}</p>
      {notice && <div className="rounded-xl bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark">{notice}</div>}
      {error && <div className="rounded-xl bg-sale/10 px-4 py-3 text-sm font-medium text-sale">{error}</div>}

      {!settings ? (
        <section className="card space-y-4 p-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>{fmt(tg.step1, { botfather: "@BotFather" })}</li>
            <li>{tg.step2}</li>
          </ol>
          {tokenForm}
        </section>
      ) : (
        <>
          <section className="card space-y-3 p-5">
            <div className="text-sm">
              {tg.bot}: {botLink(settings.bot)}
            </div>
            <h2 className="font-bold">{tg.chats}</h2>
            {settings.chats.length === 0 ? (
              <p className="text-sm text-muted">{tg.noChats}</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {settings.chats.map((chat) => (
                  <li key={chat.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" data-testid="telegram-chat">
                    <span>
                      {chat.title} <span className="text-muted">· {chat.locale.toUpperCase()}</span>
                    </span>
                    <form action={disconnectTelegramChat}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={chat.id} />
                      <button className="text-muted hover:text-sale hover:underline">{tg.disconnect}</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {settings.chats.length > 0 && (
              <form action={sendTelegramTest}>
                <input type="hidden" name="locale" value={locale} />
                <button className="btn-secondary px-4 py-2 text-sm">{tg.test}</button>
              </form>
            )}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-bold">{tg.connectTitle}</h2>
            <p className="text-sm">{fmt(tg.connectText, { bot: `@${settings.bot}` })}</p>
            <Link href={`/${locale}/admin/telegram?find=1`} className="btn-secondary inline-flex px-4 py-2 text-sm">
              {tg.find}
            </Link>
            {found && found.length === 0 && <p className="text-sm text-muted">{tg.notFound}</p>}
            {found && found.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted">{tg.found}</p>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {found.map((chat) => (
                    <li key={chat.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" data-testid="telegram-found-chat">
                      <span>{chat.title}</span>
                      <form action={connectTelegramChat}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={chat.id} />
                        <button className="btn-primary px-4 py-1.5 text-sm">{tg.connect}</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <details className="card p-5">
            <summary className="cursor-pointer font-bold">{tg.changeBot}</summary>
            <div className="mt-4 space-y-4">
              {tokenForm}
              <form action={removeTelegramBot}>
                <input type="hidden" name="locale" value={locale} />
                <button className="text-sm text-muted hover:text-sale hover:underline">{tg.removeBot}</button>
              </form>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
