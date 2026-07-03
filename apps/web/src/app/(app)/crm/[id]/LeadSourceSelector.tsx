"use client";

import { useTransition } from "react";
import { LEAD_SOURCE } from "@/lib/taxonomy";
import { setLeadSource } from "../actions";

export default function LeadSourceSelector({
  clientId,
  current,
}: {
  clientId: string;
  current: string | null;
}) {
  const [isPending, start] = useTransition();

  return (
    <select
      defaultValue={current ?? ""}
      disabled={isPending}
      className="input text-xs py-0.5 w-full"
      onChange={(e) => {
        const source = e.target.value;
        if (source) start(() => setLeadSource(clientId, source));
      }}
    >
      <option value="" disabled>
        — lead source —
      </option>
      {LEAD_SOURCE.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
