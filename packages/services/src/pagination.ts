import { z } from "zod";
import { ValidationError } from "./errors";

// Parse a request body against a Zod schema, throwing a ValidationError (→ 400
// with field-level details) on failure. Transport-agnostic.
export function parseBody<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid input", result.error.flatten().fieldErrors);
  }
  return result.data;
}

// Shared cursor pagination for list endpoints: ?limit=1..100 (default 25)
// &cursor=<opaque id>. The cursor is the id of the last item from the prior page.
export type Pagination = { limit: number; cursor?: string };

export function parsePagination(url: URL): Pagination {
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.trunc(rawLimit))) : 25;
  const cursor = url.searchParams.get("cursor") || undefined;
  return { limit, cursor };
}

// Build the Prisma cursor clause for a cursor pagination request. Fetches
// limit+1 to determine nextCursor without a second query.
export function cursorArgs(p: Pagination) {
  return {
    take: p.limit + 1,
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
  };
}

// Given the over-fetched rows (limit+1), return the page and the next cursor.
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number
): { items: T[]; nextCursor: string | null } {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    return { items, nextCursor: items[items.length - 1]?.id ?? null };
  }
  return { items: rows, nextCursor: null };
}
