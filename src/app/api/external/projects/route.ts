import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

function keyMatches(presented: string | null): boolean {
  const expected = process.env.HUB_TASKS_API_KEY;
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export async function GET(req: Request) {
  const header = req.headers.get("authorization");
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!keyMatches(presented)) return unauthorized();

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      address: true,
      city: true,
      updatedAt: true,
      client: { select: { name: true } },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status.toLowerCase(),
        address: [p.address, p.city].filter(Boolean).join(", ") || null,
        clientName: p.client.name,
        updatedAt: p.updatedAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
