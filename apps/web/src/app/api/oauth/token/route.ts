import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sha256,
  newToken,
  verifyPkceS256,
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
} from "@/lib/oauth";

const err = (code: string, desc?: string, status = 400) =>
  NextResponse.json({ error: code, ...(desc ? { error_description: desc } : {}) }, { status });

// OAuth 2.1 token endpoint: authorization_code (+PKCE, single-use, exact
// redirect) and refresh_token with rotation. Public clients only.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return err("invalid_request", "form body required");
  const grantType = String(form.get("grant_type") ?? "");

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const verifier = String(form.get("code_verifier") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const clientId = String(form.get("client_id") ?? "");
    if (!code || !verifier || !redirectUri || !clientId) return err("invalid_request");

    const row = await prisma.oAuthCode.findUnique({
      where: { code },
      include: { client: true },
    });
    if (!row || row.client.clientId !== clientId) return err("invalid_grant");
    if (row.consumedAt || row.expiresAt < new Date()) return err("invalid_grant", "code expired or used");
    if (row.redirectUri !== redirectUri) return err("invalid_grant", "redirect_uri mismatch");
    if (!verifyPkceS256(verifier, row.codeChallenge)) return err("invalid_grant", "PKCE verification failed");

    await prisma.oAuthCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });

    const access = newToken("hubat");
    const refresh = newToken("hubrt");
    await prisma.oAuthToken.create({
      data: {
        accessTokenHash: sha256(access),
        refreshTokenHash: sha256(refresh),
        clientDbId: row.clientDbId,
        userId: row.userId,
        scopes: row.scopes,
        expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return NextResponse.json({
      access_token: access,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: refresh,
      scope: row.scopes,
    });
  }

  if (grantType === "refresh_token") {
    const refresh = String(form.get("refresh_token") ?? "");
    if (!refresh) return err("invalid_request");
    const row = await prisma.oAuthToken.findUnique({
      where: { refreshTokenHash: sha256(refresh) },
    });
    if (!row || row.revokedAt) return err("invalid_grant");
    if (!row.refreshExpiresAt || row.refreshExpiresAt < new Date()) return err("invalid_grant", "refresh expired");

    // Rotation: old grant revoked, new pair issued (same user + scopes).
    const access = newToken("hubat");
    const newRefresh = newToken("hubrt");
    await prisma.$transaction([
      prisma.oAuthToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), refreshTokenHash: null },
      }),
      prisma.oAuthToken.create({
        data: {
          accessTokenHash: sha256(access),
          refreshTokenHash: sha256(newRefresh),
          clientDbId: row.clientDbId,
          userId: row.userId,
          scopes: row.scopes,
          expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
          refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
      }),
    ]);
    return NextResponse.json({
      access_token: access,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: newRefresh,
      scope: row.scopes,
    });
  }

  return err("unsupported_grant_type");
}
