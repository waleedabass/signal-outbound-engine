import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 requires an explicit driver adapter — no implicit engine-based
// connection anymore. DATABASE_URL keeps the familiar "file:./dev.db" form;
// the adapter just wants the bare path.
const sqliteUrl = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url: sqliteUrl });

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
