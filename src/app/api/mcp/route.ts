import { NextRequest, NextResponse } from "next/server";
import { getUserForBearer } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";
import { toolsForRole, type ToolCtx } from "@/lib/assistant/tools";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * Remote MCP endpoint (streamable HTTP, JSON response mode) exposing the SAME
 * role-scoped tool registry as the in-Hub assistant — one registry, two
 * transports. The bearer token maps to a Hub user; every call executes under
 * that user's role exactly like a session. The client (Claude) is never
 * trusted: role filtering + server-side scoping both apply.
 *
 * Excluded surfaces stay excluded: QBO push, time approval, team/settings
 * mutations, API-key management are not in the registry at all.
 */

const PROTOCOL_VERSION = "2025-06-18";

type RpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

const rpcError = (id: number | string | null, code: number, message: string) =>
  NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });

function unauthorized(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      // RFC 9728: point the client at the protected-resource metadata.
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const bearer = await getUserForBearer(req.headers.get("authorization"));
  if (!bearer) return unauthorized(req);

  const rl = rateLimit(`mcp:${bearer.userId}`, "write");
  if (!rl.ok) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: `Rate limited — retry in ${rl.retryAfterSec}s` } },
      { status: 429 },
    );
  }

  let msg: RpcRequest;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const id = msg.id ?? null;

  const ctx: ToolCtx = {
    userId: bearer.userId,
    userName: bearer.userName,
    role: bearer.role,
    clientId: bearer.clientId,
  };
  const defs = toolsForRole(ctx.role);

  switch (msg.method) {
    case "initialize":
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "henley-hub", title: "Henley Hub", version: "1.0.0" },
          instructions:
            'Henley Hub for Henley Contracting. NAMING: a "Project" is a client engagement grouping Jobs; a "Job" is the operational jobsite. You act as the signed-in Hub user — role limits apply server-side. Only real data; money values are integer cents.',
        },
      });

    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });

    case "ping":
      return NextResponse.json({ jsonrpc: "2.0", id, result: {} });

    case "tools/list":
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: defs.map((t) => ({
            name: t.name,
            title: t.name.replace(/_/g, " "),
            description: t.description,
            inputSchema: t.input_schema,
            annotations: {
              title: t.name.replace(/_/g, " "),
              readOnlyHint: !t.write,
              destructiveHint: false, // writes are additive/reclassifying; nothing irreversible is exposed
              openWorldHint: false,
            },
          })),
        },
      });

    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const def = defs.find((d) => d.name === name);
      if (!def) return rpcError(id, -32602, `Unknown tool for your role: ${name}`);
      try {
        const result = await def.execute(ctx, args);
        if (def.write) {
          await prisma.auditLog.create({
            data: {
              actorId: ctx.userId,
              action: `mcp.${def.name}`,
              target: JSON.stringify(args).slice(0, 180),
            },
          });
        }
        const isError = Boolean((result as { error?: unknown })?.error);
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError,
          },
        });
      } catch (err) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              { type: "text", text: err instanceof Error ? err.message : "Tool failed" },
            ],
            isError: true,
          },
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

// Streamable HTTP: GET without an SSE stream requirement → 405 is compliant.
export function GET() {
  return new NextResponse(null, { status: 405 });
}
