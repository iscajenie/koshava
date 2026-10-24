import { Logo } from "./logo";

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
