import Link from "next/link";
import { ChevronRight } from "./icons";

export function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="flex shrink-0 items-center text-sm font-semibold text-brand hover:underline">
          {linkLabel}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
