-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "enrichedFromSignalId" TEXT,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'unverified',
    "linkedinUrl" TEXT,
    "provider" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contact_enrichedFromSignalId_fkey" FOREIGN KEY ("enrichedFromSignalId") REFERENCES "Signal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("companyId", "createdAt", "email", "emailStatus", "fullName", "id", "linkedinUrl", "provider", "title") SELECT "companyId", "createdAt", "email", "emailStatus", "fullName", "id", "linkedinUrl", "provider", "title" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");
CREATE INDEX "Contact_enrichedFromSignalId_idx" ON "Contact"("enrichedFromSignalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
