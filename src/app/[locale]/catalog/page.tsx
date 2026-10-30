import { permanentRedirect } from "next/navigation";

/** The catalog is the front page now: old links and bookmarks land there with their sort, filter or search. */
export default async function CatalogPage({ params, searchParams }: PageProps<"/[locale]/catalog">) {
  const { locale } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const one of [value].flat()) if (one != null) query.append(key, one);
  const qs = query.toString();
  permanentRedirect(`/${locale}${qs ? `?${qs}` : ""}`);
}
