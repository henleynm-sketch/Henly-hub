import { NextRequest, NextResponse } from "next/server";

// RFC 9728 Protected Resource Metadata — points MCP clients at our AS.
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ["hub:tools"],
    bearer_methods_supported: ["header"],
  });
}
