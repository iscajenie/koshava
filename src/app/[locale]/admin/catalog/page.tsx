import { getI18n } from "@/i18n/server";
import { catalogStats } from "@/lib/orders";
import { formatDateTime } from "@/lib/format";

export default async function AdminCatalogPage() {
  const { locale, t } = await getI18n();
  const stats = await catalogStats();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [t.admin.products, stats.active],
          [t.admin.published, stats.published],
          [t.admin.withoutContent, stats.hidden],
          [t.nav.sale, stats.onSale],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      <section className="card overflow-x-auto">
        <h2 className="p-4 text-lg font-bold">{t.admin.importRuns}</h2>
        <table className="w-full min-w-[640px] text-sm">
          <tbody className="divide-y divide-line">
            {stats.runs.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-medium">{r.kind}</td>
                <td className="px-4 py-2.5">{formatDateTime(r.startedAt, locale)}</td>
                <td className={`px-4 py-2.5 font-semibold ${r.status === "ok" ? "text-success" : r.status === "failed" ? "text-sale" : ""}`}>{r.status}</td>
                <td className="px-4 py-2.5 text-muted">
                  {r.error ??
                    Object.entries(r.stats ?? {})
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
