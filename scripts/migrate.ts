import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL!;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("sslmode=disable");
  const client = postgres(url, { max: 1, ssl: local ? false : "require", onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
  console.log("Migrations applied");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
