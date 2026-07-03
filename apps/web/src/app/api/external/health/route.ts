import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, service: "henley-hub", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
