import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.privacy.title };
}

export default async function PrivacyPage() {
  const { t } = await getI18n();
  const email = process.env.CONTACT_EMAIL || t.privacy.noEmail;
  return (
    <article className="card mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t.privacy.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.privacy.updated}</p>
      </header>
      {t.privacy.sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-lg font-bold">{section.title}</h2>
          {section.text.map((paragraph) => (
            <p key={paragraph} className="text-[15px] leading-relaxed">
              {fmt(paragraph, { email })}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
