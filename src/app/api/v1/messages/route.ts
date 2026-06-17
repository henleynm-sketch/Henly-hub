import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { createMessage } from "@/lib/services/threadService";

const createMessageBody = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1),
  authorId: z.string().nullish(),
  fromName: z.string().optional(),
  direction: z.enum(["IN", "OUT"]).optional(),
  channel: z.string().optional(),
});

export const POST = apiRoute("messages:write", async ({ body }) => {
  const input = parseBody(createMessageBody, await body());
  const message = await createMessage(input);
  return { data: message, status: 201 };
});
