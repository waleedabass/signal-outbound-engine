-- CreateTable
CREATE TABLE "Suppression" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
