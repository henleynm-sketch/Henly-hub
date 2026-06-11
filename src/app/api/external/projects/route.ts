import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

// The active Door 1 key is rotatable from Settings, so it lives in the
// Setting table; process.env is only the bootstrap fallback. Never write
// .env from the running server.
async function activeKey(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "HUB_TASKS_API_KEY" } });
    if (row?.value) return row.value;
  } catch {
    // Setting table may not exist yet on a fresh install.
  }
  return process.env.HUB_TASKS_API_KEY ?? null;
}

async function keyMatches(presented: string | null): Promise<boolean> {
  const expected = await activeKey();
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export async function GET(req: Request) {
  const header = req.headers.get("authorization");
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!(await keyMatches(presented))) return unauthorized();

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
