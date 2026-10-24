import { Logo } from "./logo";

/** Marks photos that come from Open Food Facts rather than Lidl. */
export function StockPhotoTag({ label, hint, className = "" }: { label: string; hint: string; className?: string }) {
  return (
    <span
      title={hint}
      className={`absolute bottom-2 left-2 rounded-sm bg-ink/70 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white ${className}`}
      data-testid="stock-photo-tag"
    >
      {label}
    </span>
  );
}

/** Product photo, or a neutral placeholder when the price list item has none (PUBLISH_WITHOUT_IMAGE=true). */
export function ProductImage({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex h-full w-full items-center justify-center rounded bg-surface text-line ${className}`} aria-hidden>
        <Logo className="scale-75 opacity-40 grayscale" />
      </div>
    );
  }
  // Remote images from lidl.rs and Open Food Facts are shown as-is.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-contain ${className}`} />;
}
