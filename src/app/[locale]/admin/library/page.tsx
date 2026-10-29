import Link from "next/link";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { libraryFilters, libraryStats, listLibrary, type LibraryFilter } from "@/lib/library";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { ProductImage } from "@/components/product-image";

export default async function AdminLibraryPage({ searchParams }: PageProps<"/[locale]/admin/library">) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const filter = libraryFilters.includes(params.filter as LibraryFilter) ? (params.filter as LibraryFilter) : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const [stats, { items, hasMore }] = await Promise.all([libraryStats(), listLibrary(filter, page)]);
  const l = t.admin.library;
  const href = (f: LibraryFilter, p = 1) => `/${locale}/admin/library?filter=${f}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted">{l.intro}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          [l.products, stats.products],
          [l.onSite, stats.onSite],
          [l.archived, stats.archived],
          [l.images, `${stats.images} · ${stats.megabytes} MB`],
          [l.matched, stats.matched],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {libraryFilters.map((f) => (
          <Link
            key={f}
            href={href(f)}
            className={`rounded px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${filter === f ? "bg-ink text-white" : "bg-white"}`}
          >
            {l.filters[f]}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-muted">{l.empty}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => {
            const offer = item.offers[item.offers.length - 1];
            return (
              <div key={item.erp} className="card flex flex-col overflow-hidden" data-testid="library-item">
                <div className="relative aspect-square bg-white p-2">
                  <ProductImage src={item.previewId ? `/api/img/${item.previewId}` : null} alt={item.title} />
                  {item.removedAt && (
                    <span className="absolute top-2 left-2 rounded-sm bg-ink/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {l.filters.archived}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3 text-xs">
                  {item.removedAt ? (
                    <span className="line-clamp-2 text-sm font-semibold">{item.title}</span>
                  ) : (
                    <a href={item.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold hover:text-brand">
                      {item.title}
                    </a>
                  )}
                  {offer?.price != null && (
                    <span className="font-semibold tabular-nums">
                      {formatPrice(Math.round(offer.price * 100), locale)}
                      {offer.discountText ? ` · ${offer.discountText}` : ""}
                    </span>
                  )}
                  {offer?.badge && <span className="text-muted">{offer.badge}</span>}
                  <span className="mt-auto pt-1 text-muted">
                    {item.removedAt
                      ? fmt(l.archivedSince, { date: formatDate(item.removedAt, locale, true) })
                      : fmt(l.firstSeen, { date: formatDate(item.firstSeenAt, locale, true) })}
                    {" · "}
                    {item.erp}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link href={href(filter, page - 1)} className="btn-secondary px-4 py-2 text-sm">
              {l.prev}
            </Link>
          )}
          {hasMore && (
            <Link href={href(filter, page + 1)} className="btn-secondary px-4 py-2 text-sm">
              {l.next}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
