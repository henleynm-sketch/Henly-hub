import { NextRequest, NextResponse } from "next/server";

// RFC 8414 Authorization Server Metadata. OAuth 2.1 posture: code + PKCE S256
// only, public clients, no implicit/password grants.
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["hub:tools"],
  });
}
