import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Deployment check: database reachable and catalog loaded. Reports error codes only, never connection details. */
export async function GET() {
  try {
    const [row] = await db.execute<{
      products: number;
      published: number;
      withPhoto: number;
      lidlPhotos: number;
      lidlLibrary: number;
      priceListDate: string;
    }>(
      sql`select count(*)::int as products,
                 count(*) filter (where is_published)::int as published,
                 count(*) filter (where image_url is not null)::int as "withPhoto",
                 count(*) filter (where image_url like '/api/img/%')::int as "lidlPhotos",
                 (select count(*)::int from lidl_library) as "lidlLibrary",
                 max(price_list_date)::text as "priceListDate"
          from products where is_active`,
    );
    return Response.json({ db: "ok", ...row });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause ?? (error as { code?: string });
    return Response.json({ db: "error", code: cause?.code ?? "unknown" }, { status: 503 });
  }
}
