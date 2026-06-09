"use server";

import { auth } from "@/auth";
import { disconnectQBO } from "@/lib/quickbooks";
import { canSeeFinancials } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function disconnectQuickBooksAction() {
  const session = await auth();

  // 1. Authenticate user
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // 2. Authorize role (CEO or OFFICE can disconnect QuickBooks)
  const role = session.user.role;
  if (!canSeeFinancials(role)) {
    throw new Error("Forbidden - Only admins can manage QuickBooks connection");
  }

  // 3. Delete token from database
  await disconnectQBO();

  // 4. Revalidate page cache to update UI state
  revalidatePath("/integrations/quickbooks");
}
