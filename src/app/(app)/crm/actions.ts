"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidPipelineStage, isValidLeadSource } from "@/lib/taxonomy";
import { revalidatePath } from "next/cache";

export async function setPipelineStage(
  projectId: string,
  stage: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "OFFICE" && role !== "CEO")
    throw new Error("Forbidden: office or CEO only");
  if (!isValidPipelineStage(stage)) throw new Error("Invalid pipeline stage");
  await prisma.project.update({
    where: { id: projectId },
    data: { pipelineStage: stage },
  });
  revalidatePath("/crm");
}

export async function setLeadSource(
  clientId: string,
  source: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "OFFICE" && role !== "CEO")
    throw new Error("Forbidden: office or CEO only");
  if (!isValidLeadSource(source)) throw new Error("Invalid lead source");
  await prisma.client.update({
    where: { id: clientId },
    data: { leadSource: source },
  });
  revalidatePath("/crm");
}
