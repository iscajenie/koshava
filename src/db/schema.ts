import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "admin"]);
export const orderStatus = pgEnum("order_status", [
  "new",
  "confirmed",
  "assembling",
  "delivering",
  "delivered",
  "cancelled",
]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  // Category code from the Lidl price list; falls back to a slug of the name.
  code: text("code").notNull().unique(),
  slug: text("slug").notNull().unique(),
  nameSr: text("name_sr").notNull(),
  nameRu: text("name_ru"),
  sort: integer("sort").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    // Stable key from the price list: barcode when present, otherwise a hash of name + unit.
    sourceKey: text("source_key").notNull().unique(),
    slug: text("slug").notNull().unique(),
    barcode: text("barcode"),
    // Sister barcodes from Lidl's EAN.csv, used to find photos.
    altBarcodes: jsonb("alt_barcodes").$type<string[]>().notNull().default([]),
    name: text("name").notNull(),
    // Name exactly as in the price list.
    sourceName: text("source_name").notNull(),
    brand: text("brand"),
    categoryId: integer("category_id").references(() => categories.id),
    unit: text("unit"),
    soldByWeight: boolean("sold_by_weight").notNull().default(false),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
    // Current shelf price (discounted if a promotion is running) and the regular price.
    priceMinor: integer("price_minor").notNull(),
    regularPriceMinor: integer("regular_price_minor").notNull(),
    unitPriceMinor: integer("unit_price_minor"),
    unitPriceLabel: text("unit_price_label"),
    saleFrom: date("sale_from"),
    saleTo: date("sale_to"),
    priceListDate: date("price_list_date"),
    imageUrl: text("image_url"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    // Plain-text lines; rendered as a list on the product page.
    description: text("description"),
    // Where the photo came from: "lidl" (lidl.rs), "lidl-intl" (another Lidl country), "lidl-name" (a reviewed name match),
    // "maxi" (maxi.rs), "idea" (online.idea.rs), "cenolov" (cenolov.rs) or "off" (Open Food Facts).
    contentSource: text("content_source"),
    lidlUrl: text("lidl_url"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    // Present in the latest price list.
    isActive: boolean("is_active").notNull().default(true),
    // Shown on the site: active and enriched with an image and a description.
    isPublished: boolean("is_published").notNull().default(false),
    searchText: text("search_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_published_idx").on(t.isPublished),
    index("products_search_trgm_idx").using("gin", sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const priceHistory = pgTable(
  "price_history",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    priceMinor: integer("price_minor").notNull(),
    regularPriceMinor: integer("regular_price_minor").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.day] })],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  phone: text("phone"),
  role: userRole("role").notNull().default("customer"),
  locale: text("locale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 of the cookie token, so a database leak does not expose live sessions.
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A cart belongs either to a signed-in user or to an anonymous visitor cookie.
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  visitorId: text("visitor_id").unique(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    qty: numeric("qty", { precision: 10, scale: 3, mode: "number" }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.productId] })],
);

export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id"),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("favorites_user_product_idx").on(t.userId, t.productId),
    uniqueIndex("favorites_visitor_product_idx").on(t.visitorId, t.productId),
  ],
);

export type AddressFields = {
  street: string;
  house: string;
  apartment?: string;
  floor?: string;
  entrance?: string;
  intercom?: string;
  municipality?: string;
  note?: string;
};

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fields: jsonb("fields").$type<AddressFields>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: text("number").unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: orderStatus("status").notNull().default("new"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    deliveryFeeMinor: integer("delivery_fee_minor").notNull(),
    totalMinor: integer("total_minor").notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    address: jsonb("address").$type<AddressFields>().notNull(),
    deliveryDate: date("delivery_date").notNull(),
    deliverySlot: text("delivery_slot").notNull(),
    paymentMethod: text("payment_method").notNull(),
    comment: text("comment"),
    adminNote: text("admin_note"),
    locale: text("locale").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)],
);

export const orderItems = pgTable(
  "order_items",
  {
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(),
    unit: text("unit"),
    imageUrl: text("image_url"),
    priceMinor: integer("price_minor").notNull(),
    qty: numeric("qty", { precision: 10, scale: 3, mode: "number" }).notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
);

// Raw lookups against content sources, so daily runs only fetch what is new or stale.
export const contentCache = pgTable(
  "content_cache",
  {
    source: text("source").notNull(),
    key: text("key").notNull(),
    found: boolean("found").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.source, t.key] })],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export type LidlOffer = {
  seenAt: string;
  price: number | null;
  discountText: string | null;
  startDate: string | null;
  endDate: string | null;
  badge: string | null;
};

// Every product ever published on lidl.rs, kept after it leaves the site, with its photos stored here.
export const lidlLibrary = pgTable(
  "lidl_library",
  {
    // Lidl's product number; products from other Lidl countries are keyed "<country>:<erp>".
    erp: text("erp").primaryKey(),
    // "rs" for lidl.rs; other countries (see LIDL_SITES) only add photos of products lidl.rs does not show.
    // Products of other shops kept for their photos: "it" from Everli, "cenolov" and "cenoteka" (see importReferenceEntries).
    country: text("country").notNull().default("rs"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    brand: text("brand"),
    category: text("category"),
    gtins: jsonb("gtins").$type<string[]>().notNull().default([]),
    description: text("description"),
    // Every photo URL of the product on lidl.rs; only the first ones are stored in lidl_images.
    imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
    // Price and promotion window each time they changed, as seen on lidl.rs.
    offers: jsonb("offers").$type<LidlOffer[]>().notNull().default([]),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    // Last time the product was listed in the lidl.rs sitemap.
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    // Set while the product is no longer on lidl.rs; cleared if it comes back.
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [index("lidl_library_removed_idx").on(t.removedAt)],
);

export const lidlImages = pgTable(
  "lidl_images",
  {
    id: serial("id").primaryKey(),
    erp: text("erp")
      .notNull()
      .references(() => lidlLibrary.erp),
    // Variants of one product often share photos, so a photo is stored once per product.
    sourceUrl: text("source_url").notNull(),
    position: integer("position").notNull().default(0),
    contentType: text("content_type").notNull(),
    data: bytea("data").notNull(),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lidl_images_erp_source_idx").on(t.erp, t.sourceUrl)],
);

export const importRuns = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  stats: jsonb("stats").$type<Record<string, number | string>>(),
  error: text("error"),
});
