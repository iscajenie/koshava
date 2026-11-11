"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const texts = {
  ru: { title: "Что-то пошло не так", text: "Страница не загрузилась. Попробуйте ещё раз — обычно это помогает.", retry: "Повторить" },
  sr: { title: "Nešto nije u redu", text: "Stranica se nije učitala. Pokušajte ponovo — to obično pomaže.", retry: "Pokušaj ponovo" },
};

/** Shown instead of a bare 500 when a page fails to render; the shop's header and menu stay in place. */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = usePathname().startsWith("/sr") ? texts.sr : texts.ru;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-surface p-10 text-center" role="alert">
      <h1 className="font-display text-xl font-semibold">{t.title}</h1>
      <p className="mt-2 text-muted">{t.text}</p>
      <button onClick={() => retry()} className="btn-primary mt-5 h-11 px-6">
        {t.retry}
      </button>
    </div>
  );
}
