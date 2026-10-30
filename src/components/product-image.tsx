/** Photos that do not show the Serbian product for sure: Open Food Facts, Maxi, Idea or another Lidl country, matched by barcode. */
export function isStockPhoto(contentSource: string | null) {
  return contentSource === "off" || contentSource === "maxi" || contentSource === "idea" || contentSource === "lidl-intl" || contentSource === "lidl-name";
}

/** Marks photos that are not Lidl's own; `source` (temporary) names the site the photo came from on a second line. */
export function StockPhotoTag({ label, hint, source, className = "" }: { label: string; hint: string; source?: string; className?: string }) {
  return (
    <span
      title={hint}
      className={`absolute bottom-2 left-2 rounded-sm bg-ink/70 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white ${className}`}
      data-testid="stock-photo-tag"
    >
      {label}
      {source && <span className="block font-normal opacity-80">{source}</span>}
    </span>
  );
}

/** Product photo, or a neutral placeholder when the price list item has none (PUBLISH_WITHOUT_IMAGE=true). */
export function ProductImage({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex h-full w-full items-center justify-center rounded bg-surface ${className}`} aria-hidden>
        <svg viewBox="0 0 34 34" className="h-1/3 max-h-16 w-1/3 max-w-16 opacity-25 grayscale">
          <rect width="34" height="34" rx="7" fill="#9ca3af" />
          <path d="M7 12.5h13.5a3.5 3.5 0 1 0-3.5-3.5" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M7 18h19a3.5 3.5 0 1 1-3.5 3.5" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M7 23.5h8" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  // Remote images (Maxi, Idea, Open Food Facts) and our stored Lidl photos are shown as-is.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-contain ${className}`} />;
}
