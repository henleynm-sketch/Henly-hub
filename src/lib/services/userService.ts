import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api/errors";
import { cursorArgs, paginate, type Pagination } from "@/lib/api/validation";

// Read-only. passwordHash is never selected, so it can never leak via the API.
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  focusArea: true,
  phone: true,
  active: true,
  createdAt: true,
} as const;

export async function listUsers(p: Pagination) {
  const rows = await prisma.user.findMany({ orderBy: { name: "asc" }, select: userSelect, ...cursorArgs(p) });
  return paginate(rows, p.limit);
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw new NotFoundError("User not found");
  return user;
}
