import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const db = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }),
});

// Real, currently-live public job boards (verified against the actual
// Greenhouse/Lever public APIs while building this) — good enough to prove
// the ingestion pipeline finds real signals immediately. Whether any of
// these currently have an open SDR/BDR/AE role is real-time and out of our
// control; add your actual target accounts here once you have a list.
const SEED_COMPANIES = [
  { name: "Airbnb", domain: "airbnb.com", careersProvider: "greenhouse", careersSlug: "airbnb" },
  { name: "Greenhouse", domain: "greenhouse.io", careersProvider: "greenhouse", careersSlug: "greenhouse" },
  { name: "Plaid", domain: "plaid.com", careersProvider: "lever", careersSlug: "plaid" },
  { name: "Lever", domain: "lever.co", careersProvider: "lever", careersSlug: "lever" },
];

async function main() {
  for (const c of SEED_COMPANIES) {
    await db.company.upsert({
      where: { name_domain: { name: c.name, domain: c.domain } },
      create: { ...c, monitored: true },
      update: { careersProvider: c.careersProvider, careersSlug: c.careersSlug, monitored: true },
    });
    console.log(`seeded ${c.name}`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
