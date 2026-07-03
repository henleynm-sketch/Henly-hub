import { prisma } from "@/lib/prisma";

export interface QBOTokenData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
  realmId: string;
}

/**
 * Retrieves the global QuickBooks token from the database.
 */
export async function getQBOToken() {
  return prisma.qBOToken.findUnique({
    where: { id: "global" },
  });
}

/**
 * Saves or updates the global QuickBooks token in the database.
 */
export async function saveQBOToken(data: QBOTokenData) {
  return prisma.qBOToken.upsert({
    where: { id: "global" },
    update: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenType: data.tokenType,
      expiresAt: data.expiresAt,
      realmId: data.realmId,
    },
    create: {
      id: "global",
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenType: data.tokenType,
      expiresAt: data.expiresAt,
      realmId: data.realmId,
    },
  });
}

/**
 * Removes the global QuickBooks token from the database (disconnect).
 */
export async function disconnectQBO() {
  try {
    await prisma.qBOToken.delete({
      where: { id: "global" },
    });
  } catch (err) {
    // Ignore if already deleted
  }
}

/**
 * Refreshes an expired or expiring QuickBooks Online access token.
 */
export async function refreshQBOToken(token: { refreshToken: string; realmId: string }) {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("QuickBooks client credentials (QB_CLIENT_ID/QB_CLIENT_SECRET) are not set.");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${authHeader}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks refresh request failed (${response.status}): ${errorText}`);
  }

  const body = await response.json();

  const expiresAt = new Date(Date.now() + body.expires_in * 1000);

  return saveQBOToken({
    accessToken: body.access_token,
    refreshToken: body.refresh_token || token.refreshToken,
    tokenType: body.token_type || "bearer",
    expiresAt,
    realmId: token.realmId,
  });
}

/**
 * Retrieves the global QuickBooks token, automatically refreshing it if it
 * is expired or will expire in the next 5 minutes.
 */
export async function getValidQBOToken() {
  const token = await getQBOToken();
  if (!token) return null;

  // Refresh if expired or within 5 minutes of expiration
  const bufferMs = 5 * 60 * 1000;
  const isExpiring = new Date(token.expiresAt).getTime() - Date.now() <= bufferMs;

  if (isExpiring) {
    return refreshQBOToken(token);
  }

  return token;
}
