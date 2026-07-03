import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newToken, isAcceptableRedirectUri } from "@/lib/oauth";

// RFC 7591 Dynamic Client Registration — lets Claude register itself as a
// public client (no secret; PKCE required at authorize time).
export async function POST(req: NextRequest) {
  let body: { client_name?: string; redirect_uris?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
  const name = String(body.client_name ?? "").trim().slice(0, 120) || "Unnamed client";
  const uris = (body.redirect_uris ?? []).filter(
    (u) => typeof u === "string" && isAcceptableRedirectUri(u),
  );
  if (uris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "https (or localhost) redirect_uris required" },
      { status: 400 },
    );
  }
  const clientId = newToken("hubc");
  await prisma.oAuthClient.create({
    data: { clientId, name, redirectUris: JSON.stringify(uris) },
  });
  return NextResponse.json(
    {
      client_id: clientId,
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201 },
  );
}
