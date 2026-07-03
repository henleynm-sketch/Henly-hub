import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveQBOToken } from "@/lib/quickbooks";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const error = searchParams.get("error");

  const baseUrl = new URL("/integrations/quickbooks", request.url);

  // 1. Check if QuickBooks returned an error directly (e.g. user denied consent)
  if (error) {
    baseUrl.searchParams.set("error", error);
    return NextResponse.redirect(baseUrl.toString());
  }

  if (!code || !state || !realmId) {
    baseUrl.searchParams.set("error", "missing_parameters");
    return NextResponse.redirect(baseUrl.toString());
  }

  // 2. Verify state cookie to prevent CSRF attacks
  const cookieStore = await cookies();
  const savedState = cookieStore.get("qb_oauth_state")?.value;

  // Clear state cookie immediately
  cookieStore.delete("qb_oauth_state");

  if (!savedState || savedState !== state) {
    baseUrl.searchParams.set("error", "state_mismatch");
    return NextResponse.redirect(baseUrl.toString());
  }

  // 3. Exchange authorization code for tokens
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri = process.env.QB_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    baseUrl.searchParams.set("error", "missing_config");
    return NextResponse.redirect(baseUrl.toString());
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`QuickBooks token exchange failed (${response.status}):`, errorText);
      baseUrl.searchParams.set("error", "token_exchange_failed");
      return NextResponse.redirect(baseUrl.toString());
    }

    const body = await response.json();

    // 4. Save token to DB
    const expiresAt = new Date(Date.now() + body.expires_in * 1000);

    await saveQBOToken({
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      tokenType: body.token_type || "bearer",
      expiresAt,
      realmId,
    });

    baseUrl.searchParams.set("success", "connected");
    return NextResponse.redirect(baseUrl.toString());
  } catch (err) {
    console.error("QuickBooks callback error:", err);
    baseUrl.searchParams.set("error", "internal_error");
    return NextResponse.redirect(baseUrl.toString());
  }
}
