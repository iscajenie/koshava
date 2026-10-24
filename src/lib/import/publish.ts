import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Every product of the current price list is shown, with a placeholder when it has no photo.
 * Set PUBLISH_WITHOUT_IMAGE=false to show only products with a photo.
 */
export async function refreshPublished() {
  const withoutImage = process.env.PUBLISH_WITHOUT_IMAGE !== "false";
  const rows = await db.execute<{ published: number }>(sql`
    with updated as (
      update products
      set is_published = is_active and (${withoutImage} or image_url is not null)
      returning is_published
    )
    select count(*) filter (where is_published)::int as published from updated
  `);
  return rows[0]?.published ?? 0;
}
