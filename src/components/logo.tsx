export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
        <rect width="34" height="34" rx="7" fill="#fff000" />
        {/* Three gusts of the košava wind. */}
        <path d="M7 12.5h13.5a3.5 3.5 0 1 0-3.5-3.5" stroke="#0050aa" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M7 18h19a3.5 3.5 0 1 1-3.5 3.5" stroke="#0050aa" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M7 23.5h8" stroke="#e60a14" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-[22px] font-extrabold tracking-tight">Koshava</span>
    </span>
  );
}
