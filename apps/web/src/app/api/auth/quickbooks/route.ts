import { auth } from "@/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canSeeFinancials } from "@/lib/roles";

export async function GET() {
  const session = await auth();

  // 1. Authenticate user
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 2. Authorize role (CEO or OFFICE can manage integration)
  const role = session.user.role;
  if (!canSeeFinancials(role)) {
    return new NextResponse("Forbidden - Only admins can connect QuickBooks", { status: 403 });
  }

  const clientId = process.env.QB_CLIENT_ID;
  const redirectUri = process.env.QB_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new NextResponse(
      "Configuration error: QB_CLIENT_ID or QB_REDIRECT_URI is not set in environment variables.",
      { status: 500 }
    );
  }

  // 3. Generate CSRF state token
  const state = crypto.randomUUID();

  // 4. Save state in a secure cookie
  const cookieStore = await cookies();
  cookieStore.set("qb_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  // 5. Construct QuickBooks Online OAuth URL
  const qboAuthUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
  qboAuthUrl.searchParams.set("client_id", clientId);
  qboAuthUrl.searchParams.set("response_type", "code");
  qboAuthUrl.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  qboAuthUrl.searchParams.set("redirect_uri", redirectUri);
  qboAuthUrl.searchParams.set("state", state);

  // 6. Redirect to Intuit login/consent screen
  return NextResponse.redirect(qboAuthUrl.toString());
}
