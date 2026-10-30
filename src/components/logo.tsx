/** The Koshava mark: three gusts of the košava wind on a yellow tile. */
function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden>
      <rect width="34" height="34" rx="7" fill="#fff000" />
      <path d="M7 12.5h13.5a3.5 3.5 0 1 0-3.5-3.5" stroke="#0050aa" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M7 18h19a3.5 3.5 0 1 1-3.5 3.5" stroke="#0050aa" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M7 23.5h8" stroke="#e60a14" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** `compact` drops the name on narrow phones, where the header needs the room for the cart total. */
export function Logo({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className={`font-display text-[22px] font-bold tracking-tight ${compact ? "max-[439px]:sr-only" : ""}`}>Koshava</span>
    </span>
  );
}
