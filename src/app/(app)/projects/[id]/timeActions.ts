"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { isInternal } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function clockInAction(projectId: string, costCode: string) {
  const me = await auth();
  if (!me?.user || !me.user.id) {
    throw new Error("Unauthorized: Please sign in.");
  }
  const role = me.user.role as Role;
  if (!isInternal(role)) {
    throw new Error("Unauthorized: External users cannot clock in.");
  }

  // Check if already clocked in
  const activeSession = await prisma.timeEntry.findFirst({
    where: {
      userId: me.user.id,
      clockOut: null,
    },
  });

  if (activeSession) {
    throw new Error("You are already clocked in. Please clock out of your active session first.");
  }

  await prisma.timeEntry.create({
    data: {
      userId: me.user.id,
      projectId,
      costCode,
      clockIn: new Date(),
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function clockOutAction(timeEntryId: string, projectId: string) {
  const me = await auth();
  if (!me?.user || !me.user.id) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const timeEntry = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
  });

  if (!timeEntry) {
    throw new Error("Time entry not found.");
  }

  if (timeEntry.userId !== me.user.id) {
    throw new Error("Unauthorized: You can only clock out of your own session.");
  }

  if (timeEntry.clockOut) {
    throw new Error("Already clocked out.");
  }

  const clockOut = new Date();
  const diffMs = clockOut.getTime() - timeEntry.clockIn.getTime();
  const hours = Math.round((diffMs / 3600000) * 100) / 100; // Round to 2 decimal places

  await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      clockOut,
      hours: Math.max(0.01, hours), // Minimum 0.01 hours
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function approveTimeEntryAction(timeEntryId: string, projectId: string) {
  const me = await auth();
  if (!me?.user || !me.user.id) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const role = me.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") {
    throw new Error("Unauthorized: Only CEO/Office can approve time entries.");
  }

  const timeEntry = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
  });

  if (!timeEntry) {
    throw new Error("Time entry not found.");
  }

  if (!timeEntry.clockOut) {
    throw new Error("Cannot approve a time entry that is still clocked in.");
  }

  await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      approved: true,
      approvedById: me.user.id,
      approvedAt: new Date(),
      qbReady: true,
    },
  });

  revalidatePath(`/projects/${projectId}`);
}
