import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the whole monorepo. Both apps/web (server
// actions, RSC) and apps/api (Express) import { prisma } from "@repo/db".
// The global cache prevents exhausting connections under dev hot-reload.
declare global {
  // eslint-disable-next-line no-var
  var __henleyPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__henleyPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__henleyPrisma = prisma;
}

// Re-export Prisma's generated types so consumers can
// `import { User, Project, Prisma } from "@repo/db"` without a second dependency.
export * from "@prisma/client";
