import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }
  const { email } = await req.json().catch(() => ({ email: "" }));
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "no such user" }, { status: 404 });
  try {
    await signIn("credentials", {
      email: user.email,
      password: "demo",
      redirect: false,
    });
  } catch (err) {
    if ((err as Error).message?.includes("NEXT_REDIRECT")) throw err;
    return NextResponse.json({ error: "sign-in failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
