import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Photos from the Lidl library. An id always points to the same bytes, so browsers (max-age) and the Vercel CDN (s-maxage) keep them for good.
export async function GET(_request: Request, ctx: RouteContext<"/api/img/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const [image] = await db
    .select({ contentType: schema.lidlImages.contentType, data: schema.lidlImages.data })
    .from(schema.lidlImages)
    .where(eq(schema.lidlImages.id, id))
    .limit(1);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.contentType, "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
  });
}
