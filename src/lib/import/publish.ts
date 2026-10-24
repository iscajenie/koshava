import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * A product is shown on the site when it is in the current price list and has a photo.
 * Set PUBLISH_WITHOUT_IMAGE=true to show the whole price list with placeholders instead.
 */
export async function refreshPublished() {
  const withoutImage = process.env.PUBLISH_WITHOUT_IMAGE === "true";
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
